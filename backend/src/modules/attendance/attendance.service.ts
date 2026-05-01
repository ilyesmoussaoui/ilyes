import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { diffToAuditEntries, insertAuditEntries } from '../../lib/audit.js';
import { dispatchCheckinAlerts } from '../sms/attendance-alerts.js';
import type {
  CheckInInput,
  UpdateAttendanceInput,
  LogsQuery,
  CheckInState,
} from './attendance.types.js';

// ─── Error classes ───────────────────────────────────────────────────────────

export class AttendanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'AttendanceError';
  }
}

/**
 * Thrown when a check-in gate blocks the operation.
 * Always maps to HTTP 403.
 */
export class AttendanceGateError extends Error {
  public readonly statusCode = 403;
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = 'AttendanceGateError';
  }
}

// ─── Shared include for member + discipline ──────────────────────────────────

const attendanceInclude = {
  member: {
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
      photoPath: true,
      type: true,
      status: true,
    },
  },
  discipline: {
    select: {
      id: true,
      name: true,
    },
  },
  operator: {
    select: {
      id: true,
      fullNameLatin: true,
      fullNameArabic: true,
    },
  },
} as const;

// ─── Transform helpers ──────────────────────────────────────────────────────

function transformMember(member: {
  id: string;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  photoPath: string | null;
  type: string;
  status: string;
}) {
  return {
    id: member.id,
    firstNameLatin: member.firstNameLatin ?? '',
    lastNameLatin: member.lastNameLatin ?? '',
    firstNameArabic: member.firstNameArabic ?? '',
    lastNameArabic: member.lastNameArabic ?? '',
    photoUrl: member.photoPath ? `/api/v1/files/photos/${member.photoPath}` : null,
    membershipType: member.type,
    paymentStatus: member.status === 'active' ? 'paid' : 'unpaid',
  };
}

type AttendanceWithRelations = Prisma.AttendanceRecordGetPayload<{
  include: typeof attendanceInclude;
}>;

function transformRecord(record: AttendanceWithRelations) {
  return {
    ...record,
    member: record.member ? transformMember(record.member) : null,
    status: record.checkOutTime ? 'left' as const : 'present' as const,
  };
}

// ─── Get currently present members ───────────────────────────────────────────

export async function getPresent() {
  const records = await prisma.attendanceRecord.findMany({
    where: {
      checkOutTime: null,
      deletedAt: null,
    },
    include: attendanceInclude,
    orderBy: { checkInTime: 'desc' },
  });

  return records.map(transformRecord);
}

// ─── Evaluate check-in gates for a member ───────────────────────────────────

/**
 * Pure evaluation — does NOT create any record.
 * Returns the full state needed by the check-in gate and by the state endpoint.
 */
export async function evaluateCheckInState(memberId: string): Promise<CheckInState> {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Run all data fetches in parallel for performance.
  const [activeSubscription, anyExpiredSubscription, openPayment, openRecord] = await Promise.all([
    // 1. Is there at least one active subscription?
    prisma.subscription.findFirst({
      where: {
        memberId,
        deletedAt: null,
        status: 'active',
        endDate: { gte: todayStart },
      },
      orderBy: { endDate: 'asc' },
      select: { endDate: true },
    }),

    // 2. Is there at least one expired subscription (needed for SUBSCRIPTION_EXPIRED gate)?
    prisma.subscription.findFirst({
      where: {
        memberId,
        deletedAt: null,
        status: { in: ['active', 'expired'] },
        endDate: { lt: todayStart },
      },
      orderBy: { endDate: 'desc' },
      select: { endDate: true },
    }),

    // 3. Any open payment with remaining > 0?
    prisma.payment.findFirst({
      where: {
        memberId,
        deletedAt: null,
        remaining: { gt: 0 },
      },
      select: { remaining: true },
    }),

    // 4. Any open attendance record (not checked out, not deleted)?
    prisma.attendanceRecord.findFirst({
      where: {
        memberId,
        deletedAt: null,
        checkOutTime: null,
      },
      orderBy: { checkInTime: 'desc' },
      select: { id: true, checkInTime: true },
    }),
  ]);

  const state: CheckInState = {
    canCheckIn: true,
    blockingReason: null,
    warnings: [],
    balance: null,
    expiryDate: null,
    daysRemaining: null,
    alreadyCheckedIn: false,
    lastCheckInTime: null,
    recordId: null,
  };

  // Gate 1: SUBSCRIPTION_EXPIRED — no active subscription AND at least one expired one.
  if (!activeSubscription) {
    if (anyExpiredSubscription) {
      state.canCheckIn = false;
      state.blockingReason = 'SUBSCRIPTION_EXPIRED';
      state.expiryDate = anyExpiredSubscription.endDate.toISOString().split('T')[0] ?? null;
      return state;
    }
    // No subscriptions at all — fall through (no explicit gate for this case).
  }

  // Gate 2: UNPAID_BALANCE — any open payment with remaining > 0.
  if (openPayment) {
    // Sum total unpaid balance across all open payments.
    const agg = await prisma.payment.aggregate({
      where: {
        memberId,
        deletedAt: null,
        remaining: { gt: 0 },
      },
      _sum: { remaining: true },
    });
    state.canCheckIn = false;
    state.blockingReason = 'UNPAID_BALANCE';
    state.balance = agg._sum.remaining ?? openPayment.remaining;
    return state;
  }

  // Gate 3: DUPLICATE_CHECKIN — already has an open record.
  if (openRecord) {
    state.canCheckIn = false;
    state.blockingReason = 'DUPLICATE_CHECKIN';
    state.alreadyCheckedIn = true;
    state.lastCheckInTime = openRecord.checkInTime.toISOString();
    state.recordId = openRecord.id;
    return state;
  }

  // Warning: EXPIRING_SOON — active subscription ends within 4 days.
  if (activeSubscription) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.ceil(
      (activeSubscription.endDate.getTime() - todayStart.getTime()) / msPerDay,
    );
    if (daysRemaining <= 4) {
      state.warnings.push('EXPIRING_SOON');
      state.expiryDate = activeSubscription.endDate.toISOString().split('T')[0] ?? null;
      state.daysRemaining = daysRemaining;
    }
  }

  return state;
}

// ─── Check in a member ───────────────────────────────────────────────────────

export async function checkIn(data: CheckInInput, operatorId: string) {
  // Verify member exists and is not deleted
  const member = await prisma.member.findFirst({
    where: { id: data.memberId, deletedAt: null },
  });
  if (!member) {
    throw new AttendanceError('NOT_FOUND', 'Member not found', 404);
  }

  // ── Gate evaluation ──────────────────────────────────────────────────────
  const state = await evaluateCheckInState(data.memberId);

  if (!state.canCheckIn) {
    const messages: Record<string, string> = {
      SUBSCRIPTION_EXPIRED: 'Abonnement expiré.',
      UNPAID_BALANCE: 'Solde impayé.',
      DUPLICATE_CHECKIN: 'Pointage en double.',
    };

    type DetailMap = {
      SUBSCRIPTION_EXPIRED: { expiryDate: string | null };
      UNPAID_BALANCE: { balance: number | null };
      DUPLICATE_CHECKIN: { lastCheckInTime: string | null; recordId: string | null };
    };

    const details: DetailMap[keyof DetailMap] = (() => {
      if (state.blockingReason === 'SUBSCRIPTION_EXPIRED') {
        return { expiryDate: state.expiryDate };
      }
      if (state.blockingReason === 'UNPAID_BALANCE') {
        return { balance: state.balance };
      }
      // DUPLICATE_CHECKIN
      return { lastCheckInTime: state.lastCheckInTime, recordId: state.recordId };
    })();

    throw new AttendanceGateError(
      state.blockingReason!,
      messages[state.blockingReason!] ?? 'Check-in blocked.',
      details,
    );
  }
  // ────────────────────────────────────────────────────────────────────────

  // Verify discipline exists if provided
  if (data.disciplineId) {
    const discipline = await prisma.discipline.findFirst({
      where: { id: data.disciplineId, deletedAt: null },
    });
    if (!discipline) {
      throw new AttendanceError('NOT_FOUND', 'Discipline not found', 404);
    }
  }

  const record = await prisma.attendanceRecord.create({
    data: {
      memberId: data.memberId,
      disciplineId: data.disciplineId ?? null,
      checkInTime: new Date(),
      method: data.method,
      device: data.device ?? null,
      operatorId,
      notes: data.notes ?? null,
    },
    include: attendanceInclude,
  });

  // Fire-and-forget SMS dispatch — never blocks the check-in response.
  void dispatchCheckinAlerts({ memberId: record.memberId, checkInTime: record.checkInTime });

  const transformed = transformRecord(record);

  // Return with warnings array (additive — backwards compatible).
  return { ...transformed, warnings: state.warnings };
}

// ─── Check out a member ──────────────────────────────────────────────────────

export async function checkOut(recordId: string) {
  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, deletedAt: null },
  });
  if (!record) {
    throw new AttendanceError('NOT_FOUND', 'Attendance record not found', 404);
  }
  if (record.checkOutTime) {
    throw new AttendanceError('ALREADY_CHECKED_OUT', 'Member has already been checked out', 409);
  }

  const updated = await prisma.attendanceRecord.update({
    where: { id: recordId },
    data: { checkOutTime: new Date() },
    include: attendanceInclude,
  });

  return transformRecord(updated);
}

// ─── Mass checkout ───────────────────────────────────────────────────────────

export async function massCheckout(): Promise<number> {
  const now = new Date();
  const result = await prisma.attendanceRecord.updateMany({
    where: {
      checkOutTime: null,
      deletedAt: null,
    },
    data: {
      checkOutTime: now,
    },
  });

  return result.count;
}

// ─── Get single attendance record ────────────────────────────────────────────

export async function getAttendanceById(recordId: string) {
  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, deletedAt: null },
    include: attendanceInclude,
  });
  if (!record) {
    throw new AttendanceError('NOT_FOUND', 'Attendance record not found', 404);
  }
  return transformRecord(record);
}

// ─── Update attendance record ────────────────────────────────────────────────

export async function updateAttendance(
  recordId: string,
  data: UpdateAttendanceInput,
  userId: string,
) {
  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, deletedAt: null },
  });
  if (!record) {
    throw new AttendanceError('NOT_FOUND', 'Attendance record not found', 404);
  }

  // Validate discipline if provided
  if (data.disciplineId !== undefined && data.disciplineId !== null) {
    const discipline = await prisma.discipline.findFirst({
      where: { id: data.disciplineId, deletedAt: null },
    });
    if (!discipline) {
      throw new AttendanceError('NOT_FOUND', 'Discipline not found', 404);
    }
  }

  const oldSnapshot: Record<string, unknown> = {};
  const newSnapshot: Record<string, unknown> = {};
  const updateData: Record<string, unknown> = {};

  if (data.checkInTime !== undefined) {
    oldSnapshot.checkInTime = record.checkInTime.toISOString();
    newSnapshot.checkInTime = data.checkInTime;
    updateData.checkInTime = new Date(data.checkInTime);
  }
  if (data.checkOutTime !== undefined) {
    oldSnapshot.checkOutTime = record.checkOutTime?.toISOString() ?? null;
    newSnapshot.checkOutTime = data.checkOutTime;
    updateData.checkOutTime = data.checkOutTime ? new Date(data.checkOutTime) : null;
  }
  if (data.disciplineId !== undefined) {
    oldSnapshot.disciplineId = record.disciplineId;
    newSnapshot.disciplineId = data.disciplineId;
    updateData.disciplineId = data.disciplineId;
  }
  if (data.method !== undefined) {
    oldSnapshot.method = record.method;
    newSnapshot.method = data.method;
    updateData.method = data.method;
  }
  if (data.notes !== undefined) {
    oldSnapshot.notes = record.notes;
    newSnapshot.notes = data.notes;
    updateData.notes = data.notes;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.attendanceRecord.update({
      where: { id: recordId },
      data: updateData,
      include: attendanceInclude,
    });

    const auditEntries = diffToAuditEntries(
      'attendance_records',
      recordId,
      oldSnapshot,
      newSnapshot,
      userId,
      data.reason,
    );
    await insertAuditEntries(tx, auditEntries);

    return result;
  });

  return transformRecord(updated);
}

// ─── Soft-delete attendance record ───────────────────────────────────────────

export async function deleteAttendance(
  recordId: string,
  reason: string,
  userId: string,
): Promise<void> {
  const record = await prisma.attendanceRecord.findFirst({
    where: { id: recordId, deletedAt: null },
  });
  if (!record) {
    throw new AttendanceError('NOT_FOUND', 'Attendance record not found', 404);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.attendanceRecord.update({
      where: { id: recordId },
      data: { deletedAt: now },
    });
    await insertAuditEntries(tx, [
      {
        tableName: 'attendance_records',
        recordId,
        fieldName: 'deleted_at',
        oldValue: null,
        newValue: now.toISOString(),
        userId,
        reason,
      },
    ]);
  });
}

// ─── Attendance logs with filtering ──────────────────────────────────────────

export async function getAttendanceLogs(query: LogsQuery) {
  const where: Prisma.AttendanceRecordWhereInput = {
    deletedAt: null,
  };

  // Date range filtering
  if (query.startDate) {
    const sd = query.startDate.includes('T') ? query.startDate : query.startDate + 'T00:00:00.000Z';
    where.checkInTime = { ...where.checkInTime as object, gte: new Date(sd) };
  }
  if (query.endDate) {
    const ed = query.endDate.includes('T') ? query.endDate : query.endDate + 'T23:59:59.999Z';
    where.checkInTime = { ...where.checkInTime as object, lte: new Date(ed) };
  }

  // Member filter
  if (query.memberId) {
    where.memberId = query.memberId;
  }

  // Discipline filter
  if (query.disciplineId) {
    where.disciplineId = query.disciplineId;
  }

  // Method filter
  if (query.method) {
    where.method = query.method;
  }

  // Device filter
  if (query.device) {
    where.device = query.device;
  }

  // Status filter: present = no checkout, left = has checkout
  if (query.status === 'present') {
    where.checkOutTime = null;
  } else if (query.status === 'left') {
    where.checkOutTime = { not: null };
  }

  // Search by member name (Latin or Arabic)
  if (query.search) {
    const searchTerm = query.search;
    where.member = {
      deletedAt: null,
      OR: [
        { firstNameLatin: { contains: searchTerm, mode: 'insensitive' } },
        { lastNameLatin: { contains: searchTerm, mode: 'insensitive' } },
        { firstNameArabic: { contains: searchTerm, mode: 'insensitive' } },
        { lastNameArabic: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };
  }

  const skip = (query.page - 1) * query.limit;

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: attendanceInclude,
      orderBy: { checkInTime: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  return { records: records.map(transformRecord), total, page: query.page, limit: query.limit };
}

// ─── Today's stats ───────────────────────────────────────────────────────────

export async function getTodayStats() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );

  const baseWhere: Prisma.AttendanceRecordWhereInput = {
    deletedAt: null,
    checkInTime: { gte: startOfDay, lte: endOfDay },
  };

  const [totalCheckIns, currentlyPresent, totalCheckOuts] = await Promise.all([
    prisma.attendanceRecord.count({ where: baseWhere }),
    prisma.attendanceRecord.count({
      where: { ...baseWhere, checkOutTime: null },
    }),
    prisma.attendanceRecord.count({
      where: { ...baseWhere, checkOutTime: { not: null } },
    }),
  ]);

  return { totalCheckIns, currentlyPresent, totalCheckOuts };
}

// ─── Today's sessions (time slots) ──────────────────────────────────────────

export async function getTodaySessions() {
  const now = new Date();
  // JavaScript getDay(): 0 = Sunday, 6 = Saturday — matches schema convention
  const dayOfWeek = now.getDay();

  const timeSlots = await prisma.timeSlot.findMany({
    where: {
      dayOfWeek,
      deletedAt: null,
    },
    include: {
      discipline: {
        select: {
          id: true,
          name: true,
        },
      },
      schedules: {
        where: {
          deletedAt: null,
          memberDiscipline: {
            deletedAt: null,
            status: 'active',
          },
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  return timeSlots.map((slot) => ({
    id: slot.id,
    discipline: { id: slot.discipline.id, name: slot.discipline.name },
    startTime: slot.startTime,
    endTime: slot.endTime,
    enrolledCount: slot.schedules.length,
  }));
}
