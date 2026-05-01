import { prisma } from '../../lib/prisma.js';
import { enqueueSms } from './sms.service.js';

// ─── Outside-schedule detection ─────────────────────────────────────────────
// A check-in is "outside allowed schedule" when the member has active
// enrollments, but none of their time slots cover the current time (±15 min).

const SCHEDULE_TOLERANCE_MIN = 15;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return (h ?? 0) * 60 + (m ?? 0);
}

async function isCheckinWithinSchedule(memberId: string, at: Date): Promise<boolean> {
  const enrollments = await prisma.memberDiscipline.findMany({
    where: { memberId, deletedAt: null, status: 'active' },
    include: {
      schedules: {
        where: { deletedAt: null },
        include: {
          timeSlot: {
            select: { dayOfWeek: true, startTime: true, endTime: true, deletedAt: true },
          },
        },
      },
    },
  });
  if (enrollments.length === 0) return true; // no enrollments -> cannot evaluate, skip alert

  const dow = at.getDay();
  const nowMin = at.getHours() * 60 + at.getMinutes();
  for (const enr of enrollments) {
    for (const s of enr.schedules) {
      if (!s.timeSlot || s.timeSlot.deletedAt) continue;
      if (s.timeSlot.dayOfWeek !== dow) continue;
      const start = toMinutes(s.timeSlot.startTime) - SCHEDULE_TOLERANCE_MIN;
      const end = toMinutes(s.timeSlot.endTime) + SCHEDULE_TOLERANCE_MIN;
      if (nowMin >= start && nowMin <= end) return true;
    }
  }
  return false;
}

// ─── Phone resolution ───────────────────────────────────────────────────────

async function getMemberPrimaryPhone(memberId: string): Promise<string | null> {
  const phone = await prisma.memberContact.findFirst({
    where: { memberId, deletedAt: null, type: 'phone' },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    select: { value: true },
  });
  return phone?.value ?? null;
}

async function getMemberEmergencyPhones(memberId: string): Promise<string[]> {
  const list = await prisma.emergencyContact.findMany({
    where: { memberId, deletedAt: null },
    select: { phone: true },
  });
  return list.map((c) => c.phone).filter(Boolean);
}

// ─── Parent opt-in flag stored in Settings (key: "sms.parent_optin.<memberId>") ──
// Value is "true" | "false".

async function isParentOptInForCheckin(memberId: string): Promise<boolean> {
  const s = await prisma.setting.findUnique({
    where: { key: `sms.parent_optin.${memberId}` },
    select: { value: true },
  });
  return s?.value === 'true';
}

function isMinor(dob: Date | null): boolean {
  if (!dob) return false;
  const now = new Date();
  const age = now.getFullYear() - dob.getFullYear() - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
  return age < 18;
}

// ─── Public entry point ─────────────────────────────────────────────────────

export interface CheckinAlertContext {
  memberId: string;
  checkInTime: Date;
}

export async function dispatchCheckinAlerts(ctx: CheckinAlertContext): Promise<void> {
  try {
    const member = await prisma.member.findFirst({
      where: { id: ctx.memberId, deletedAt: null },
      select: {
        id: true,
        firstNameLatin: true,
        lastNameLatin: true,
        dateOfBirth: true,
      },
    });
    if (!member) return;

    const name = [member.firstNameLatin, member.lastNameLatin].filter(Boolean).join(' ') || 'Member';
    const inSchedule = await isCheckinWithinSchedule(ctx.memberId, ctx.checkInTime);
    const timeStr = ctx.checkInTime.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    // Off-schedule alert to the member themselves.
    if (!inSchedule) {
      const phone = await getMemberPrimaryPhone(ctx.memberId);
      if (phone) {
        enqueueSms({
          memberId: ctx.memberId,
          to: phone,
          body: `Check-in recorded at ${timeStr} outside your scheduled hours.`,
          reason: 'attendance.offschedule',
        });
      }
    }

    // Parent/guardian notification for minors when opted in.
    const shouldNotifyParent = isMinor(member.dateOfBirth) && (await isParentOptInForCheckin(ctx.memberId));
    if (shouldNotifyParent) {
      const phones = await getMemberEmergencyPhones(ctx.memberId);
      for (const phone of phones) {
        enqueueSms({
          memberId: ctx.memberId,
          to: phone,
          body: `${name} checked in at ${timeStr}.`,
          reason: 'attendance.parent_notification',
        });
      }
    }
  } catch {
    // Never block attendance on SMS dispatch errors.
  }
}
