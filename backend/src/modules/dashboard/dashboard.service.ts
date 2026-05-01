import { prisma } from '../../lib/prisma.js';
import type { AlertMember, AlertStockItem, AlertsQuery, AlertsResponse } from './dashboard.schema.js';

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Build today's UTC midnight boundaries as Date objects, which Prisma
 * serialises safely to parameterised queries.
 */
function todayBounds(): { todayStart: Date; todayEnd: Date } {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { todayStart, todayEnd };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Pick the first active MemberDiscipline discipline name, or null. */
function pickDiscipline(
  disciplines: Array<{ discipline: { name: string }; deletedAt: Date | null }>,
): string | null {
  const active = disciplines.find((d) => d.deletedAt === null);
  return active?.discipline.name ?? null;
}

// ─── 1. Subscriptions expiring ────────────────────────────────────────────────
/**
 * Subscriptions whose endDate is BETWEEN today and today+N (inclusive),
 * status='active', subscription not soft-deleted, member not soft-deleted.
 * Ordered by endDate asc (soonest first).
 */
export async function getSubscriptionsExpiring(
  windowDays: number,
  limit: number,
): Promise<AlertMember[]> {
  const { todayStart } = todayBounds();
  const windowEnd = addDays(todayStart, windowDays);

  const rows = await prisma.subscription.findMany({
    where: {
      deletedAt: null,
      status: 'active',
      endDate: {
        gte: todayStart,
        lte: windowEnd,
      },
      member: { deletedAt: null },
    },
    orderBy: { endDate: 'asc' },
    take: limit,
    select: {
      endDate: true,
      member: {
        select: {
          id: true,
          firstNameLatin: true,
          lastNameLatin: true,
          firstNameArabic: true,
          lastNameArabic: true,
          photoPath: true,
          disciplines: {
            where: { deletedAt: null },
            select: { discipline: { select: { name: true } }, deletedAt: true },
            take: 1,
          },
        },
      },
    },
  });

  return rows
    .filter((r) => r.member !== null)
    .map((r) => {
      const m = r.member!;
      return {
        memberId: m.id,
        firstNameLatin: m.firstNameLatin ?? '',
        lastNameLatin: m.lastNameLatin ?? '',
        firstNameArabic: m.firstNameArabic,
        lastNameArabic: m.lastNameArabic,
        photoPath: m.photoPath,
        discipline: pickDiscipline(m.disciplines),
        renewalDate: r.endDate.toISOString().split('T')[0] ?? null,
      };
    });
}

// ─── 2. Unpaid balance ────────────────────────────────────────────────────────
/**
 * Members with at least one Payment where remaining > 0
 * (not soft-deleted payment, not soft-deleted member).
 * Aggregates total remaining per member.
 * Ordered by total balanceDue desc (highest debt first).
 */
export async function getUnpaidBalance(limit: number): Promise<AlertMember[]> {
  // Group by memberId, sum remaining — use groupBy which Prisma supports.
  const grouped = await prisma.payment.groupBy({
    by: ['memberId'],
    where: {
      deletedAt: null,
      remaining: { gt: 0 },
      member: { deletedAt: null },
    },
    _sum: { remaining: true },
    orderBy: { _sum: { remaining: 'desc' } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const memberIds = grouped.map((g) => g.memberId);
  const members = await prisma.member.findMany({
    where: { id: { in: memberIds }, deletedAt: null },
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
      photoPath: true,
      disciplines: {
        where: { deletedAt: null },
        select: { discipline: { select: { name: true } }, deletedAt: true },
        take: 1,
      },
    },
  });

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const results: AlertMember[] = [];
  for (const g of grouped) {
    const m = memberMap.get(g.memberId);
    if (!m) continue;
    results.push({
      memberId: m.id,
      firstNameLatin: m.firstNameLatin ?? '',
      lastNameLatin: m.lastNameLatin ?? '',
      firstNameArabic: m.firstNameArabic,
      lastNameArabic: m.lastNameArabic,
      photoPath: m.photoPath,
      discipline: pickDiscipline(m.disciplines),
      renewalDate: null,
      extra: { balanceDue: g._sum.remaining ?? 0 },
    });
  }
  return results;
}

// ─── 3. Renewal needed ────────────────────────────────────────────────────────
/**
 * Subscriptions whose endDate < today AND status='active'.
 * These have lapsed without being renewed/cancelled.
 * Ordered by endDate asc (oldest lapse first).
 */
export async function getRenewalNeeded(limit: number): Promise<AlertMember[]> {
  const { todayStart } = todayBounds();

  const rows = await prisma.subscription.findMany({
    where: {
      deletedAt: null,
      status: 'active',
      endDate: { lt: todayStart },
      member: { deletedAt: null },
    },
    orderBy: { endDate: 'asc' },
    take: limit,
    select: {
      endDate: true,
      member: {
        select: {
          id: true,
          firstNameLatin: true,
          lastNameLatin: true,
          firstNameArabic: true,
          lastNameArabic: true,
          photoPath: true,
          disciplines: {
            where: { deletedAt: null },
            select: { discipline: { select: { name: true } }, deletedAt: true },
            take: 1,
          },
        },
      },
    },
  });

  return rows
    .filter((r) => r.member !== null)
    .map((r) => {
      const m = r.member!;
      return {
        memberId: m.id,
        firstNameLatin: m.firstNameLatin ?? '',
        lastNameLatin: m.lastNameLatin ?? '',
        firstNameArabic: m.firstNameArabic,
        lastNameArabic: m.lastNameArabic,
        photoPath: m.photoPath,
        discipline: pickDiscipline(m.disciplines),
        renewalDate: r.endDate.toISOString().split('T')[0] ?? null,
      };
    });
}

// ─── 4. Missing documents ─────────────────────────────────────────────────────
/**
 * Members who are missing at least one required document.
 * A DocumentRequirement is considered applicable when:
 *   - isRequired = true
 *   - member.type (as string) is in memberTypes array
 * A document satisfies the requirement when a non-deleted Document row of
 * that type exists for the member (status is not checked here — presence
 * is the criterion; expired docs are flagged by the documents module).
 * Ordered by lastNameLatin asc.
 */
export async function getMissingDocuments(limit: number): Promise<AlertMember[]> {
  // Fetch all active requirements.
  const requirements = await prisma.documentRequirement.findMany({
    where: { isRequired: true },
    select: { documentType: true, memberTypes: true },
  });

  if (requirements.length === 0) return [];

  // Fetch active members with their documents.
  const members = await prisma.member.findMany({
    where: { deletedAt: null, status: 'active' },
    orderBy: [{ lastNameLatin: 'asc' }, { firstNameLatin: 'asc' }],
    take: limit * 5, // over-fetch; we'll trim after filtering
    select: {
      id: true,
      type: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
      photoPath: true,
      disciplines: {
        where: { deletedAt: null },
        select: { discipline: { select: { name: true } }, deletedAt: true },
        take: 1,
      },
      documents: {
        where: { deletedAt: null },
        select: { type: true },
      },
    },
  });

  const results: AlertMember[] = [];

  for (const m of members) {
    if (results.length >= limit) break;

    const memberTypeStr = m.type as string;
    const uploadedTypes = new Set(m.documents.map((d) => d.type as string));

    const missingDocTypes = requirements
      .filter(
        (req) =>
          req.memberTypes.includes(memberTypeStr) &&
          !uploadedTypes.has(req.documentType as string),
      )
      .map((req) => req.documentType as string);

    if (missingDocTypes.length > 0) {
      results.push({
        memberId: m.id,
        firstNameLatin: m.firstNameLatin ?? '',
        lastNameLatin: m.lastNameLatin ?? '',
        firstNameArabic: m.firstNameArabic,
        lastNameArabic: m.lastNameArabic,
        photoPath: m.photoPath,
        discipline: pickDiscipline(m.disciplines),
        renewalDate: null,
        extra: { missingDocTypes },
      });
    }
  }

  return results;
}

// ─── 5. Inactive members ──────────────────────────────────────────────────────
/**
 * Active members who have no AttendanceRecord in the last N days.
 * Ordered by last check-in time asc (most inactive first); members who
 * never checked in appear first.
 */
export async function getInactiveMembers(
  thresholdDays: number,
  limit: number,
): Promise<AlertMember[]> {
  const { todayStart } = todayBounds();
  const thresholdDate = addDays(todayStart, -thresholdDays);

  // Find active member IDs that have at least one check-in in the window.
  const recentlyActive = await prisma.attendanceRecord.findMany({
    where: {
      deletedAt: null,
      checkInTime: { gte: thresholdDate },
      member: { deletedAt: null, status: 'active' },
    },
    select: { memberId: true },
    distinct: ['memberId'],
  });

  const recentMemberIds = new Set(recentlyActive.map((r) => r.memberId));

  // Fetch active members NOT in that set.
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      status: 'active',
      id: { notIn: recentMemberIds.size > 0 ? [...recentMemberIds] : [] },
    },
    take: limit,
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
      photoPath: true,
      disciplines: {
        where: { deletedAt: null },
        select: { discipline: { select: { name: true } }, deletedAt: true },
        take: 1,
      },
      attendanceRecords: {
        where: { deletedAt: null },
        orderBy: { checkInTime: 'desc' },
        take: 1,
        select: { checkInTime: true },
      },
    },
    // No reliable single-field ORDER BY for "most inactive first" without
    // a join; we sort in-process after fetching.
  });

  // Sort: members with no check-in at top, then by oldest last check-in.
  members.sort((a, b) => {
    const aTime = a.attendanceRecords[0]?.checkInTime?.getTime() ?? 0;
    const bTime = b.attendanceRecords[0]?.checkInTime?.getTime() ?? 0;
    return aTime - bTime; // ascending = most inactive first
  });

  return members.map((m) => {
    const lastCheckIn = m.attendanceRecords[0]?.checkInTime;
    const daysInactive = lastCheckIn
      ? Math.floor((todayStart.getTime() - lastCheckIn.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      memberId: m.id,
      firstNameLatin: m.firstNameLatin ?? '',
      lastNameLatin: m.lastNameLatin ?? '',
      firstNameArabic: m.firstNameArabic,
      lastNameArabic: m.lastNameArabic,
      photoPath: m.photoPath,
      discipline: pickDiscipline(m.disciplines),
      renewalDate: null,
      extra: daysInactive !== null ? { daysInactive } : undefined,
    };
  });
}

// ─── 6. Absent today ─────────────────────────────────────────────────────────
/**
 * Active members who have no AttendanceRecord today (any check-in
 * with checkInTime between 00:00 UTC and 23:59:59.999 UTC today).
 * Ordered by lastNameLatin asc, firstNameLatin asc.
 */
export async function getAbsentToday(limit: number): Promise<AlertMember[]> {
  const { todayStart, todayEnd } = todayBounds();

  const checkedInToday = await prisma.attendanceRecord.findMany({
    where: {
      deletedAt: null,
      checkInTime: { gte: todayStart, lte: todayEnd },
      member: { deletedAt: null, status: 'active' },
    },
    select: { memberId: true },
    distinct: ['memberId'],
  });

  const checkedInIds = new Set(checkedInToday.map((r) => r.memberId));

  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      status: 'active',
      id: { notIn: checkedInIds.size > 0 ? [...checkedInIds] : [] },
    },
    orderBy: [{ lastNameLatin: 'asc' }, { firstNameLatin: 'asc' }],
    take: limit,
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
      photoPath: true,
      disciplines: {
        where: { deletedAt: null },
        select: { discipline: { select: { name: true } }, deletedAt: true },
        take: 1,
      },
    },
  });

  return members.map((m) => ({
    memberId: m.id,
    firstNameLatin: m.firstNameLatin ?? '',
    lastNameLatin: m.lastNameLatin ?? '',
    firstNameArabic: m.firstNameArabic,
    lastNameArabic: m.lastNameArabic,
    photoPath: m.photoPath,
    discipline: pickDiscipline(m.disciplines),
    renewalDate: null,
  }));
}

// ─── 7. Stock out ─────────────────────────────────────────────────────────────
/**
 * Equipment where stockQuantity <= 0, not soft-deleted.
 * Ordered by name asc.
 */
export async function getStockOut(limit: number): Promise<AlertStockItem[]> {
  const rows = await prisma.equipment.findMany({
    where: {
      deletedAt: null,
      stockQuantity: { lte: 0 },
    },
    orderBy: { name: 'asc' },
    take: limit,
    select: {
      id: true,
      name: true,
      stockQuantity: true,
    },
  });

  return rows.map((r) => ({
    equipmentId: r.id,
    name: r.name,
    stockQuantity: r.stockQuantity,
  }));
}

// ─── Aggregate: all 7 in parallel ────────────────────────────────────────────

export async function getDashboardAlerts(query: AlertsQuery): Promise<AlertsResponse> {
  const { expiringWindowDays, inactiveThresholdDays, limitPerCategory } = query;

  const [
    subscriptionsExpiring,
    unpaidBalance,
    renewalNeeded,
    missingDocuments,
    inactiveMembers,
    absentToday,
    stockOut,
  ] = await Promise.all([
    getSubscriptionsExpiring(expiringWindowDays, limitPerCategory),
    getUnpaidBalance(limitPerCategory),
    getRenewalNeeded(limitPerCategory),
    getMissingDocuments(limitPerCategory),
    getInactiveMembers(inactiveThresholdDays, limitPerCategory),
    getAbsentToday(limitPerCategory),
    getStockOut(limitPerCategory),
  ]);

  return {
    subscriptionsExpiring,
    unpaidBalance,
    renewalNeeded,
    missingDocuments,
    inactiveMembers,
    absentToday,
    stockOut,
  };
}
