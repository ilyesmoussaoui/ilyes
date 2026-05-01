import { prisma } from '../../lib/prisma.js';
import { createTask } from '../tasks/tasks.service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type AbsenceResult = {
  memberId: string;
  memberName: string;
  consecutiveAbsences: number;
  disciplineName: string;
  missedDates: string[];
};

type CheckAbsencesResult = {
  absences: AbsenceResult[];
  notificationsCreated: number;
  tasksCreated: number;
};

// ─── Check consecutive absences ──────────────────────────────────────────────

/**
 * For each active member with schedules, checks if they missed 2+ consecutive
 * scheduled sessions (no attendance record for a scheduled time slot that has
 * already passed). Creates notifications and a "call_parent" staff task for
 * each detected case. Sets Member.atRisk = true when triggered.
 */
export async function checkAbsences(): Promise<CheckAbsencesResult> {
  const now = new Date();

  // ── Consecutive-absence threshold ──────────────────────────────────────────
  const ABSENCE_THRESHOLD = 2;

  // Get all active members with schedules
  const membersWithSchedules = await prisma.member.findMany({
    where: {
      deletedAt: null,
      status: 'active',
      disciplines: {
        some: {
          deletedAt: null,
          status: 'active',
          schedules: {
            some: {
              deletedAt: null,
            },
          },
        },
      },
    },
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
      atRisk: true,
      disciplines: {
        where: {
          deletedAt: null,
          status: 'active',
        },
        select: {
          id: true,
          disciplineId: true,
          discipline: {
            select: { id: true, name: true },
          },
          schedules: {
            where: { deletedAt: null },
            select: {
              dayOfWeek: true,
              timeSlot: {
                select: {
                  startTime: true,
                  endTime: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const absences: AbsenceResult[] = [];
  const notificationIds: string[] = [];
  let tasksCreated = 0;

  for (const member of membersWithSchedules) {
    const memberName =
      [member.firstNameLatin, member.lastNameLatin].filter(Boolean).join(' ') ||
      [member.firstNameArabic, member.lastNameArabic].filter(Boolean).join(' ') ||
      'Unknown';

    for (const enrollment of member.disciplines) {
      if (enrollment.schedules.length === 0) continue;

      // Get the scheduled days for this enrollment
      const scheduledDays = enrollment.schedules.map((s) => s.dayOfWeek);
      const uniqueDays = [...new Set(scheduledDays)].sort((a, b) => a - b);

      if (uniqueDays.length === 0) continue;

      // Look back enough days to find at least 2 scheduled sessions
      // Maximum lookback: 4 weeks (28 days) to keep it reasonable
      const lookbackDays = 28;
      const missedDates: string[] = [];

      for (let daysAgo = 1; daysAgo <= lookbackDays; daysAgo++) {
        const checkDate = new Date(now);
        checkDate.setUTCDate(checkDate.getUTCDate() - daysAgo);
        const checkDayOfWeek = checkDate.getDay();

        // Was this a scheduled day?
        if (!uniqueDays.includes(checkDayOfWeek)) continue;

        // For past days (daysAgo >= 1), all slots have already passed.
        const startOfCheckDay = new Date(
          Date.UTC(
            checkDate.getUTCFullYear(),
            checkDate.getUTCMonth(),
            checkDate.getUTCDate(),
          ),
        );
        const endOfCheckDay = new Date(
          Date.UTC(
            checkDate.getUTCFullYear(),
            checkDate.getUTCMonth(),
            checkDate.getUTCDate(),
            23,
            59,
            59,
            999,
          ),
        );

        const attendanceCount = await prisma.attendanceRecord.count({
          where: {
            memberId: member.id,
            disciplineId: enrollment.disciplineId,
            deletedAt: null,
            checkInTime: {
              gte: startOfCheckDay,
              lte: endOfCheckDay,
            },
          },
        });

        if (attendanceCount === 0) {
          missedDates.push(startOfCheckDay.toISOString().split('T')[0]!);
        } else {
          // They attended — consecutive absence streak is broken
          break;
        }
      }

      // If 2+ consecutive absences detected (threshold lowered from 3 to 2)
      if (missedDates.length >= ABSENCE_THRESHOLD) {
        absences.push({
          memberId: member.id,
          memberName,
          consecutiveAbsences: missedDates.length,
          disciplineName: enrollment.discipline.name,
          missedDates,
        });
      }
    }
  }

  // Process each absence case
  for (const absence of absences) {
    // Avoid duplicate notifications: check if one already exists for this member
    // in the last 24 hours with the same pattern
    const recentNotification = await prisma.notification.findFirst({
      where: {
        memberId: absence.memberId,
        type: 'general',
        deletedAt: null,
        message: {
          contains: `${absence.consecutiveAbsences} consecutive absences`,
        },
        createdAt: {
          gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!recentNotification) {
      // ── Transaction: create notification + set atRisk + create task ────────
      await prisma.$transaction(async (tx) => {
        // 1. Create notification
        const notification = await tx.notification.create({
          data: {
            type: 'general',
            memberId: absence.memberId,
            message: `Member ${absence.memberName} has ${absence.consecutiveAbsences} consecutive absences in ${absence.disciplineName}. Consider calling the parent.`,
          },
        });
        notificationIds.push(notification.id);

        // 2. Set atRisk = true on the member if not already set
        const wasAtRisk = (
          await tx.member.findUnique({
            where: { id: absence.memberId },
            select: { atRisk: true },
          })
        )?.atRisk ?? false;

        if (!wasAtRisk) {
          await tx.member.update({
            where: { id: absence.memberId },
            data: { atRisk: true },
          });

          // Audit the atRisk flag change (system-initiated — userId is null).
          // insertAuditEntries maps to audit_logs which has nullable user_id.
          await tx.auditLog.create({
            data: {
              tableName: 'members',
              recordId: absence.memberId,
              fieldName: 'at_risk',
              oldValue: 'false',
              newValue: 'true',
              userId: null,
              reason: `Consecutive absences: ${absence.consecutiveAbsences} in ${absence.disciplineName}`,
            },
          });
        }
      });

      // 3. Create a staff task to call the parent (outside the transaction —
      //    task creation is best-effort and should not roll back notifications).
      try {
        await createTask({
          type: 'call_parent',
          memberId: absence.memberId,
          notes: `${absence.memberName} missed ${absence.consecutiveAbsences} consecutive sessions in ${absence.disciplineName} (${absence.missedDates.join(', ')}). Please contact the parent.`,
        });
        tasksCreated += 1;
      } catch {
        // Task creation failure must never break the absence-check flow.
      }
    }
  }

  return {
    absences,
    notificationsCreated: notificationIds.length,
    tasksCreated,
  };
}
