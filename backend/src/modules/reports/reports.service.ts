import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type {
  AttendanceReportQuery,
  FinancialReportQuery,
  MembershipReportQuery,
  InventoryReportQuery,
  DocumentReportQuery,
  CustomReportQuery,
  ExportQuery,
  SaveTemplateInput,
  OutstandingBalancesQuery,
  DailyCashQuery,
  MissingDocumentsQuery,
  AbsencesQuery,
  LateArrivalsQuery,
} from './reports.types.js';

// ─── Error class ─────────────────────────────────────────────────────────────

export class ReportError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'ReportError';
  }
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function buildDateFilter(
  dateFrom?: string,
  dateTo?: string,
): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;
  const filter: { gte?: Date; lte?: Date } = {};
  if (dateFrom) {
    filter.gte = new Date(dateFrom);
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setUTCHours(23, 59, 59, 999);
    filter.lte = end;
  }
  return filter;
}

function dateTruncExpression(groupBy: 'day' | 'week' | 'month'): string {
  switch (groupBy) {
    case 'day':
      return `DATE_TRUNC('day', check_in_time)`;
    case 'week':
      return `DATE_TRUNC('week', check_in_time)`;
    case 'month':
      return `DATE_TRUNC('month', check_in_time)`;
  }
}

function paymentDateTruncExpression(groupBy: 'day' | 'week' | 'month'): string {
  switch (groupBy) {
    case 'day':
      return `DATE_TRUNC('day', created_at)`;
    case 'week':
      return `DATE_TRUNC('week', created_at)`;
    case 'month':
      return `DATE_TRUNC('month', created_at)`;
  }
}

function expenseDateTruncExpression(groupBy: 'day' | 'week' | 'month'): string {
  switch (groupBy) {
    case 'day':
      return `DATE_TRUNC('day', date)`;
    case 'week':
      return `DATE_TRUNC('week', date)`;
    case 'month':
      return `DATE_TRUNC('month', date)`;
  }
}

function memberDateTruncExpression(groupBy: 'day' | 'week' | 'month'): string {
  switch (groupBy) {
    case 'day':
      return `DATE_TRUNC('day', created_at)`;
    case 'week':
      return `DATE_TRUNC('week', created_at)`;
    case 'month':
      return `DATE_TRUNC('month', created_at)`;
  }
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]!;
}

// ─── 1. Attendance Report ────────────────────────────────────────────────────

export async function getAttendanceReport(query: AttendanceReportQuery) {
  const { dateFrom, dateTo, disciplineId, groupBy } = query;
  const dateFilter = buildDateFilter(dateFrom, dateTo);

  const where: Prisma.AttendanceRecordWhereInput = {
    deletedAt: null,
    member: { deletedAt: null },
    ...(dateFilter ? { checkInTime: dateFilter } : {}),
    ...(disciplineId ? { disciplineId } : {}),
  };

  // Summary: total check-ins and unique members
  const [totalCheckIns, uniqueMembersResult] = await Promise.all([
    prisma.attendanceRecord.count({ where }),
    prisma.attendanceRecord.findMany({
      where,
      select: { memberId: true },
      distinct: ['memberId'],
    }),
  ]);

  const uniqueMembers = uniqueMembersResult.length;

  // Calculate average daily check-ins
  let avgDailyCheckIns = 0;
  if (totalCheckIns > 0) {
    const dayCountResult = await prisma.$queryRaw<[{ days: bigint }]>`
      SELECT COUNT(DISTINCT DATE(ar.check_in_time)) AS days
      FROM attendance_records ar
      JOIN members m ON m.id = ar.member_id AND m.deleted_at IS NULL
      WHERE ar.deleted_at IS NULL
      ${dateFilter?.gte ? Prisma.sql`AND ar.check_in_time >= ${dateFilter.gte}` : Prisma.empty}
      ${dateFilter?.lte ? Prisma.sql`AND ar.check_in_time <= ${dateFilter.lte}` : Prisma.empty}
      ${disciplineId ? Prisma.sql`AND ar.discipline_id = ${disciplineId}::uuid` : Prisma.empty}
    `;
    const days = Number(dayCountResult[0]?.days ?? 1);
    avgDailyCheckIns = Math.round(totalCheckIns / (days || 1));
  }

  // Peak hour
  const peakHourResult = await prisma.$queryRaw<{ hour: number; cnt: bigint | null }[]>`
    SELECT EXTRACT(HOUR FROM ar.check_in_time)::int AS hour, COUNT(*) AS cnt
    FROM attendance_records ar
    JOIN members m ON m.id = ar.member_id AND m.deleted_at IS NULL
    WHERE ar.deleted_at IS NULL
    ${dateFilter?.gte ? Prisma.sql`AND ar.check_in_time >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND ar.check_in_time <= ${dateFilter.lte}` : Prisma.empty}
    ${disciplineId ? Prisma.sql`AND ar.discipline_id = ${disciplineId}::uuid` : Prisma.empty}
    GROUP BY hour
    ORDER BY cnt DESC
    LIMIT 1
  `;
  const peakHour = peakHourResult.length > 0 ? peakHourResult[0]!.hour : 0;

  // Top discipline
  const topDisciplineResult = await prisma.attendanceRecord.groupBy({
    by: ['disciplineId'],
    where: { ...where, disciplineId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1,
  });

  let topDiscipline = 'N/A';
  if (topDisciplineResult.length > 0 && topDisciplineResult[0]!.disciplineId) {
    const disc = await prisma.discipline.findUnique({
      where: { id: topDisciplineResult[0]!.disciplineId },
      select: { name: true },
    });
    topDiscipline = disc?.name ?? 'N/A';
  }

  // Time series grouped by day/week/month
  // Note: dateTruncExpression returns an unqualified column reference (e.g. check_in_time).
  // Since attendance_records is aliased as ar below, rebuild the expression with the alias.
  const truncExpr = dateTruncExpression(groupBy).replace(
    'check_in_time',
    'ar.check_in_time',
  );
  const timeSeriesRaw = await prisma.$queryRaw<{ period: Date; cnt: bigint | null }[]>`
    SELECT ${Prisma.raw(truncExpr)} AS period, COUNT(*) AS cnt
    FROM attendance_records ar
    JOIN members m ON m.id = ar.member_id AND m.deleted_at IS NULL
    WHERE ar.deleted_at IS NULL
    ${dateFilter?.gte ? Prisma.sql`AND ar.check_in_time >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND ar.check_in_time <= ${dateFilter.lte}` : Prisma.empty}
    ${disciplineId ? Prisma.sql`AND ar.discipline_id = ${disciplineId}::uuid` : Prisma.empty}
    GROUP BY period
    ORDER BY period ASC
  `;
  const timeSeries = timeSeriesRaw.map((r) => ({
    date: toISODate(r.period),
    count: Number(r.cnt ?? 0),
  }));

  // By discipline
  const byDisciplineRaw = await prisma.$queryRaw<
    { name: string; cnt: bigint | null }[]
  >`
    SELECT COALESCE(d.name, 'Unknown') AS name, COUNT(*) AS cnt
    FROM attendance_records ar
    JOIN members m ON m.id = ar.member_id AND m.deleted_at IS NULL
    LEFT JOIN disciplines d ON d.id = ar.discipline_id
    WHERE ar.deleted_at IS NULL
    ${dateFilter?.gte ? Prisma.sql`AND ar.check_in_time >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND ar.check_in_time <= ${dateFilter.lte}` : Prisma.empty}
    ${disciplineId ? Prisma.sql`AND ar.discipline_id = ${disciplineId}::uuid` : Prisma.empty}
    GROUP BY d.name
    ORDER BY cnt DESC
  `;
  const byDiscipline = byDisciplineRaw.map((r) => ({
    name: r.name,
    count: Number(r.cnt ?? 0),
  }));

  // By method
  const byMethodRaw = await prisma.attendanceRecord.groupBy({
    by: ['method'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const byMethod = byMethodRaw.map((r) => ({
    method: r.method,
    count: r._count.id,
  }));

  // By hour (heatmap data)
  const byHourRaw = await prisma.$queryRaw<{ hour: number; cnt: bigint | null }[]>`
    SELECT EXTRACT(HOUR FROM ar.check_in_time)::int AS hour, COUNT(*) AS cnt
    FROM attendance_records ar
    JOIN members m ON m.id = ar.member_id AND m.deleted_at IS NULL
    WHERE ar.deleted_at IS NULL
    ${dateFilter?.gte ? Prisma.sql`AND ar.check_in_time >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND ar.check_in_time <= ${dateFilter.lte}` : Prisma.empty}
    ${disciplineId ? Prisma.sql`AND ar.discipline_id = ${disciplineId}::uuid` : Prisma.empty}
    GROUP BY hour
    ORDER BY hour ASC
  `;
  // Fill all 24 hours, zero-filling missing ones
  const hourMap = new Map(byHourRaw.map((r) => [r.hour, Number(r.cnt ?? 0)]));
  const byHour = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: hourMap.get(i) ?? 0,
  }));

  // By day-of-week + hour (real heatmap data)
  // Postgres EXTRACT(DOW) returns 0 (Sunday) … 6 (Saturday)
  const byDayHourRaw = await prisma.$queryRaw<
    { day_of_week: number; hour: number; cnt: bigint | null }[]
  >`
    SELECT
      EXTRACT(DOW FROM ar.check_in_time)::int AS day_of_week,
      EXTRACT(HOUR FROM ar.check_in_time)::int AS hour,
      COUNT(*) AS cnt
    FROM attendance_records ar
    JOIN members m ON m.id = ar.member_id AND m.deleted_at IS NULL
    WHERE ar.deleted_at IS NULL
    ${dateFilter?.gte ? Prisma.sql`AND ar.check_in_time >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND ar.check_in_time <= ${dateFilter.lte}` : Prisma.empty}
    ${disciplineId ? Prisma.sql`AND ar.discipline_id = ${disciplineId}::uuid` : Prisma.empty}
    GROUP BY day_of_week, hour
    ORDER BY day_of_week ASC, hour ASC
  `;
  const dayHourMap = new Map<string, number>(
    byDayHourRaw.map((r) => [`${r.day_of_week}-${r.hour}`, Number(r.cnt ?? 0)]),
  );
  const byDayHour: { dayOfWeek: number; hour: number; count: number }[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      byDayHour.push({
        dayOfWeek: day,
        hour,
        count: dayHourMap.get(`${day}-${hour}`) ?? 0,
      });
    }
  }

  return {
    summary: {
      totalCheckIns,
      uniqueMembers,
      avgDailyCheckIns,
      peakHour,
      topDiscipline,
    },
    timeSeries,
    byDiscipline,
    byMethod,
    byHour,
    byDayHour,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 2. Financial Report ─────────────────────────────────────────────────────

export async function getFinancialReport(query: FinancialReportQuery) {
  const { dateFrom, dateTo, groupBy, paymentType } = query;
  const dateFilter = buildDateFilter(dateFrom, dateTo);

  const paymentWhere: Prisma.PaymentWhereInput = {
    deletedAt: null,
    member: { deletedAt: null },
    ...(dateFilter ? { createdAt: dateFilter } : {}),
    ...(paymentType ? { paymentType } : {}),
  };

  const expenseWhere: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    ...(dateFilter ? { date: dateFilter } : {}),
  };

  // Summary aggregates
  const [
    revenueAgg,
    refundAgg,
    expenseAgg,
    transactionCount,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: { ...paymentWhere, paymentType: { not: 'refund' } },
      _sum: { paidAmount: true },
    }),
    prisma.payment.aggregate({
      where: { ...paymentWhere, paymentType: 'refund' },
      _sum: { paidAmount: true },
    }),
    prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    }),
    prisma.payment.count({
      where: paymentWhere,
    }),
  ]);

  const totalRevenue = revenueAgg._sum.paidAmount ?? 0;
  // Refund paidAmount is stored as negative in this schema
  const totalRefunds = Math.abs(refundAgg._sum.paidAmount ?? 0);
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const netIncome = totalRevenue - totalRefunds - totalExpenses;
  const avgTransactionValue =
    transactionCount > 0
      ? Math.round((totalRevenue - totalRefunds) / transactionCount)
      : 0;

  // Revenue time series
  const revTrunc = paymentDateTruncExpression(groupBy);
  const expTrunc = expenseDateTruncExpression(groupBy);

  // paymentDateTruncExpression returns unqualified `created_at` — qualify it
  // because the query joins `payments p` and `members m`.
  const revTruncQualified = revTrunc.replace('created_at', 'p.created_at');
  const revenueTimeRaw = await prisma.$queryRaw<
    { period: Date; revenue: bigint | null }[]
  >`
    SELECT ${Prisma.raw(revTruncQualified)} AS period,
      SUM(CASE WHEN p.payment_type != 'refund' THEN p.paid_amount ELSE 0 END) AS revenue
    FROM payments p
    JOIN members m ON m.id = p.member_id AND m.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
    ${dateFilter?.gte ? Prisma.sql`AND p.created_at >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND p.created_at <= ${dateFilter.lte}` : Prisma.empty}
    ${paymentType ? Prisma.sql`AND p.payment_type = ${paymentType}` : Prisma.empty}
    GROUP BY period
    ORDER BY period ASC
  `;

  const expenseTimeRaw = await prisma.$queryRaw<
    { period: Date; expenses: bigint | null }[]
  >`
    SELECT ${Prisma.raw(expTrunc)} AS period,
      SUM(amount) AS expenses
    FROM expenses
    WHERE deleted_at IS NULL
    ${dateFilter?.gte ? Prisma.sql`AND date >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND date <= ${dateFilter.lte}` : Prisma.empty}
    GROUP BY period
    ORDER BY period ASC
  `;

  // Merge revenue and expense time series
  const timeMap = new Map<
    string,
    { date: string; revenue: number; expenses: number }
  >();
  for (const r of revenueTimeRaw) {
    const key = toISODate(r.period);
    timeMap.set(key, { date: key, revenue: Number(r.revenue ?? 0), expenses: 0 });
  }
  for (const e of expenseTimeRaw) {
    const key = toISODate(e.period);
    const existing = timeMap.get(key);
    if (existing) {
      existing.expenses = Number(e.expenses ?? 0);
    } else {
      timeMap.set(key, { date: key, revenue: 0, expenses: Number(e.expenses ?? 0) });
    }
  }
  const revenueTimeSeries = Array.from(timeMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  // By payment type
  const byPaymentTypeRaw = await prisma.payment.groupBy({
    by: ['paymentType'],
    where: {
      deletedAt: null,
      member: { deletedAt: null },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    _sum: { paidAmount: true },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const byPaymentType = byPaymentTypeRaw.map((r) => ({
    type: r.paymentType,
    amount: r._sum.paidAmount ?? 0,
    count: r._count.id,
  }));

  // By expense category
  const byCategoryRaw = await prisma.expense.groupBy({
    by: ['category'],
    where: expenseWhere,
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });
  const byCategory = byCategoryRaw.map((r) => ({
    category: r.category,
    amount: r._sum.amount ?? 0,
  }));

  // Top members by total paid
  const topMembersRaw = await prisma.$queryRaw<
    {
      member_id: string;
      first_name_latin: string | null;
      last_name_latin: string | null;
      total_paid: bigint | null;
    }[]
  >`
    SELECT p.member_id,
      m.first_name_latin,
      m.last_name_latin,
      SUM(p.paid_amount) AS total_paid
    FROM payments p
    JOIN members m ON m.id = p.member_id AND m.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
      AND p.payment_type != 'refund'
    ${dateFilter?.gte ? Prisma.sql`AND p.created_at >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND p.created_at <= ${dateFilter.lte}` : Prisma.empty}
    GROUP BY p.member_id, m.first_name_latin, m.last_name_latin
    ORDER BY total_paid DESC
    LIMIT 10
  `;
  const topMembers = topMembersRaw.map((r) => ({
    memberId: r.member_id,
    name: [r.first_name_latin, r.last_name_latin].filter(Boolean).join(' ') || 'Unknown',
    totalPaid: Number(r.total_paid ?? 0),
  }));

  return {
    summary: {
      totalRevenue,
      totalExpenses,
      netIncome,
      avgTransactionValue,
      totalRefunds,
    },
    revenueTimeSeries,
    byPaymentType,
    byCategory,
    topMembers,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 3. Membership Report ────────────────────────────────────────────────────

export async function getMembershipReport(query: MembershipReportQuery) {
  const { dateFrom, dateTo } = query;
  const dateFilter = buildDateFilter(dateFrom, dateTo);

  const memberWhere: Prisma.MemberWhereInput = {
    deletedAt: null,
  };

  // Total and active members (current state)
  const [totalMembers, activeMembers] = await Promise.all([
    prisma.member.count({ where: memberWhere }),
    prisma.member.count({ where: { ...memberWhere, status: 'active' } }),
  ]);

  // New members in date range
  const newMembersInRange = dateFilter
    ? await prisma.member.count({
        where: { ...memberWhere, createdAt: dateFilter },
      })
    : 0;

  // Expiring subscriptions (within 30 days from now)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringSubscriptions = await prisma.subscription.count({
    where: {
      deletedAt: null,
      member: { deletedAt: null },
      status: 'active',
      endDate: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
    },
  });

  const activeRatio =
    totalMembers > 0
      ? Math.round((activeMembers / totalMembers) * 10000) / 100
      : 0;

  // By status
  const byStatusRaw = await prisma.member.groupBy({
    by: ['status'],
    where: memberWhere,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const byStatus = byStatusRaw.map((r) => ({
    status: r.status,
    count: r._count.id,
  }));

  // By type
  const byTypeRaw = await prisma.member.groupBy({
    by: ['type'],
    where: memberWhere,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const byType = byTypeRaw.map((r) => ({
    type: r.type,
    count: r._count.id,
  }));

  // By gender
  const byGenderRaw = await prisma.member.groupBy({
    by: ['gender'],
    where: { ...memberWhere, gender: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const byGender = byGenderRaw.map((r) => ({
    gender: r.gender ?? 'unknown',
    count: r._count.id,
  }));

  // By age bucket (using date of birth)
  const byAgeRaw = await prisma.$queryRaw<{ bucket: string; cnt: bigint | null }[]>`
    SELECT
      CASE
        WHEN date_of_birth IS NULL THEN 'unknown'
        WHEN EXTRACT(YEAR FROM AGE(date_of_birth))::int < 12 THEN 'under_12'
        WHEN EXTRACT(YEAR FROM AGE(date_of_birth))::int BETWEEN 12 AND 17 THEN '12_17'
        WHEN EXTRACT(YEAR FROM AGE(date_of_birth))::int BETWEEN 18 AND 24 THEN '18_24'
        WHEN EXTRACT(YEAR FROM AGE(date_of_birth))::int BETWEEN 25 AND 34 THEN '25_34'
        WHEN EXTRACT(YEAR FROM AGE(date_of_birth))::int BETWEEN 35 AND 49 THEN '35_49'
        WHEN EXTRACT(YEAR FROM AGE(date_of_birth))::int BETWEEN 50 AND 64 THEN '50_64'
        ELSE '65_plus'
      END AS bucket,
      COUNT(*) AS cnt
    FROM members
    WHERE deleted_at IS NULL
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  const byAge = byAgeRaw.map((r) => ({
    bucket: r.bucket,
    count: Number(r.cnt ?? 0),
  }));

  // Growth time series: new members per period + running cumulative count
  // of currently-active members whose createdAt <= end of period.
  // Baseline = count of active members created strictly before dateFrom (if any).
  const groupBy: 'day' | 'week' | 'month' = 'month';
  const truncExpr = memberDateTruncExpression(groupBy);

  let baselineActive = 0;
  if (dateFilter?.gte) {
    baselineActive = await prisma.member.count({
      where: {
        deletedAt: null,
        status: 'active',
        createdAt: { lt: dateFilter.gte },
      },
    });
  }

  const growthRaw = await prisma.$queryRaw<
    {
      period: Date;
      new_members: bigint | null;
      active_in_period: bigint | null;
      cumulative_active: bigint | null;
    }[]
  >`
    SELECT
      period,
      new_members,
      active_in_period,
      SUM(active_in_period) OVER (ORDER BY period ASC) AS cumulative_active
    FROM (
      SELECT
        ${Prisma.raw(truncExpr)} AS period,
        COUNT(*) AS new_members,
        COUNT(*) FILTER (WHERE status = 'active') AS active_in_period
      FROM members
      WHERE deleted_at IS NULL
      ${dateFilter?.gte ? Prisma.sql`AND created_at >= ${dateFilter.gte}` : Prisma.empty}
      ${dateFilter?.lte ? Prisma.sql`AND created_at <= ${dateFilter.lte}` : Prisma.empty}
      GROUP BY period
    ) AS monthly
    ORDER BY period ASC
  `;

  const growthTimeSeries = growthRaw.map((r) => ({
    date: toISODate(r.period),
    newMembers: Number(r.new_members ?? 0),
    totalActive: baselineActive + Number(r.cumulative_active ?? 0),
  }));

  // Subscriptions by plan
  const subsByPlanRaw = await prisma.subscription.groupBy({
    by: ['planType'],
    where: {
      deletedAt: null,
      member: { deletedAt: null },
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    _count: { id: true },
    _sum: { amount: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const subscriptionsByPlan = subsByPlanRaw.map((r) => ({
    planType: r.planType,
    count: r._count.id,
    revenue: r._sum.amount ?? 0,
  }));

  return {
    summary: {
      totalMembers,
      activeMembers,
      newMembersInRange,
      expiringSubscriptions,
      activeRatio,
    },
    byStatus,
    byType,
    byGender,
    byAge,
    growthTimeSeries,
    subscriptionsByPlan,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 4. Inventory Report ─────────────────────────────────────────────────────

export async function getInventoryReport(query: InventoryReportQuery) {
  const { dateFrom, dateTo, equipmentId } = query;
  const dateFilter = buildDateFilter(dateFrom, dateTo);

  const equipmentWhere: Prisma.EquipmentWhereInput = {
    deletedAt: null,
    ...(equipmentId ? { id: equipmentId } : {}),
  };

  // All equipment items
  const equipmentItems = await prisma.equipment.findMany({
    where: equipmentWhere,
    select: {
      id: true,
      name: true,
      stockQuantity: true,
      price: true,
    },
    orderBy: { name: 'asc' },
  });

  // Sales data from MemberEquipment
  const salesByEquipment = await prisma.memberEquipment.groupBy({
    by: ['equipmentId'],
    where: {
      deletedAt: null,
      member: { deletedAt: null },
      ...(equipmentId ? { equipmentId } : {}),
      ...(dateFilter ? { purchaseDate: dateFilter } : {}),
    },
    _sum: { quantity: true },
  });

  const salesMap = new Map(
    salesByEquipment.map((s) => [s.equipmentId, s._sum.quantity ?? 0]),
  );

  // Build items with sales data
  const items = equipmentItems.map((eq) => {
    const totalSold = salesMap.get(eq.id) ?? 0;
    return {
      id: eq.id,
      name: eq.name,
      currentStock: eq.stockQuantity,
      price: eq.price,
      totalSold,
      revenue: totalSold * eq.price,
    };
  });

  // Summary
  const totalItems = equipmentItems.length;
  const lowStockCount = equipmentItems.filter(
    (eq) => eq.stockQuantity <= 5,
  ).length;
  const totalStockValue = equipmentItems.reduce(
    (sum, eq) => sum + eq.price * eq.stockQuantity,
    0,
  );
  const totalSalesValue = items.reduce((sum, item) => sum + item.revenue, 0);

  // Stock movements
  const stockMovements = await prisma.stockAdjustment.findMany({
    where: {
      ...(equipmentId ? { equipmentId } : {}),
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    include: {
      equipment: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const stockMovementsList = stockMovements.map((m) => ({
    date: toISODate(m.createdAt),
    item: m.equipment.name,
    quantityChange: m.quantityChange,
    reason: m.reason,
  }));

  return {
    summary: {
      totalItems,
      lowStockCount,
      totalStockValue,
      totalSalesValue,
    },
    items,
    stockMovements: stockMovementsList,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 5. Document Report ──────────────────────────────────────────────────────

export async function getDocumentReport(query: DocumentReportQuery) {
  const { dateFrom, dateTo, documentType, status } = query;
  const dateFilter = buildDateFilter(dateFrom, dateTo);

  const where: Prisma.DocumentWhereInput = {
    deletedAt: null,
    member: { deletedAt: null },
    ...(documentType ? { type: documentType } : {}),
    ...(status ? { status } : {}),
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };

  // Summary counts
  const [totalDocuments, expiredCount, validCount] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.count({ where: { ...where, status: 'expired' } }),
    prisma.document.count({ where: { ...where, status: 'valid' } }),
  ]);

  // Documents expiring within 30 days
  const now = new Date();
  const thirtyDaysFromNow = new Date(now);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringDocs = await prisma.document.findMany({
    where: {
      deletedAt: null,
      member: { deletedAt: null },
      status: 'valid',
      expiryDate: {
        gte: now,
        lte: thirtyDaysFromNow,
      },
      ...(documentType ? { type: documentType } : {}),
    },
    include: {
      member: {
        select: {
          id: true,
          firstNameLatin: true,
          lastNameLatin: true,
        },
      },
    },
    orderBy: { expiryDate: 'asc' },
    take: 50,
  });

  const expiringCount = expiringDocs.length;
  const complianceRate =
    totalDocuments > 0
      ? Math.round((validCount / totalDocuments) * 10000) / 100
      : 0;

  // By type
  const byTypeRaw = await prisma.$queryRaw<
    {
      type: string;
      total: bigint | null;
      valid: bigint | null;
      expired: bigint | null;
      pending: bigint | null;
    }[]
  >`
    SELECT
      doc.type,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE doc.status = 'valid') AS valid,
      COUNT(*) FILTER (WHERE doc.status = 'expired') AS expired,
      COUNT(*) FILTER (WHERE doc.status = 'pending') AS pending
    FROM documents doc
    JOIN members mem ON mem.id = doc.member_id AND mem.deleted_at IS NULL
    WHERE doc.deleted_at IS NULL
    ${documentType ? Prisma.sql`AND doc.type = ${documentType}::"DocumentType"` : Prisma.empty}
    ${dateFilter?.gte ? Prisma.sql`AND doc.created_at >= ${dateFilter.gte}` : Prisma.empty}
    ${dateFilter?.lte ? Prisma.sql`AND doc.created_at <= ${dateFilter.lte}` : Prisma.empty}
    GROUP BY doc.type
    ORDER BY total DESC
  `;
  const byType = byTypeRaw.map((r) => ({
    type: r.type,
    total: Number(r.total ?? 0),
    valid: Number(r.valid ?? 0),
    expired: Number(r.expired ?? 0),
    pending: Number(r.pending ?? 0),
  }));

  // By status
  const byStatusRaw = await prisma.document.groupBy({
    by: ['status'],
    where,
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });
  const byStatus = byStatusRaw.map((r) => ({
    status: r.status,
    count: r._count.id,
  }));

  // Expiring documents list
  const expiringDocuments = expiringDocs.map((d) => ({
    memberId: d.member.id,
    memberName:
      [d.member.firstNameLatin, d.member.lastNameLatin]
        .filter(Boolean)
        .join(' ') || 'Unknown',
    documentType: d.type,
    expiryDate: d.expiryDate ? toISODate(d.expiryDate) : null,
  }));

  return {
    summary: {
      totalDocuments,
      expiredCount,
      expiringCount,
      complianceRate,
    },
    byType,
    byStatus,
    expiringDocuments,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 6. Custom Report ────────────────────────────────────────────────────────

export async function getCustomReport(query: CustomReportQuery) {
  const {
    metrics,
    dateFrom,
    dateTo,
    disciplineId,
    memberType,
    status,
    groupBy,
  } = query;

  const dateFilter = buildDateFilter(dateFrom, dateTo);
  const results: Record<string, unknown> = {};

  for (const metric of metrics) {
    switch (metric) {
      case 'attendance_count': {
        const where: Prisma.AttendanceRecordWhereInput = {
          deletedAt: null,
          member: { deletedAt: null },
          ...(dateFilter ? { checkInTime: dateFilter } : {}),
          ...(disciplineId ? { disciplineId } : {}),
        };
        const truncExpr = dateTruncExpression(groupBy).replace(
          'check_in_time',
          'ar.check_in_time',
        );
        const timeData = await prisma.$queryRaw<
          { period: Date; cnt: bigint | null }[]
        >`
          SELECT ${Prisma.raw(truncExpr)} AS period, COUNT(*) AS cnt
          FROM attendance_records ar
          JOIN members m ON m.id = ar.member_id AND m.deleted_at IS NULL
          WHERE ar.deleted_at IS NULL
          ${dateFilter?.gte ? Prisma.sql`AND ar.check_in_time >= ${dateFilter.gte}` : Prisma.empty}
          ${dateFilter?.lte ? Prisma.sql`AND ar.check_in_time <= ${dateFilter.lte}` : Prisma.empty}
          ${disciplineId ? Prisma.sql`AND ar.discipline_id = ${disciplineId}::uuid` : Prisma.empty}
          GROUP BY period
          ORDER BY period ASC
        `;
        const total = await prisma.attendanceRecord.count({ where });
        results.attendance_count = {
          total,
          series: timeData.map((r) => ({
            date: toISODate(r.period),
            value: Number(r.cnt ?? 0),
          })),
        };
        break;
      }
      case 'revenue': {
        const paymentWhere: Prisma.PaymentWhereInput = {
          deletedAt: null,
          member: { deletedAt: null },
          paymentType: { not: 'refund' },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        };
        const revTrunc = paymentDateTruncExpression(groupBy).replace(
          'created_at',
          'p.created_at',
        );
        const timeData = await prisma.$queryRaw<
          { period: Date; total: bigint | null }[]
        >`
          SELECT ${Prisma.raw(revTrunc)} AS period,
            SUM(p.paid_amount) AS total
          FROM payments p
          JOIN members m ON m.id = p.member_id AND m.deleted_at IS NULL
          WHERE p.deleted_at IS NULL AND p.payment_type != 'refund'
          ${dateFilter?.gte ? Prisma.sql`AND p.created_at >= ${dateFilter.gte}` : Prisma.empty}
          ${dateFilter?.lte ? Prisma.sql`AND p.created_at <= ${dateFilter.lte}` : Prisma.empty}
          GROUP BY period
          ORDER BY period ASC
        `;
        const agg = await prisma.payment.aggregate({
          where: paymentWhere,
          _sum: { paidAmount: true },
        });
        results.revenue = {
          total: agg._sum.paidAmount ?? 0,
          series: timeData.map((r) => ({
            date: toISODate(r.period),
            value: Number(r.total ?? 0),
          })),
        };
        break;
      }
      case 'new_members': {
        const memberWhere: Prisma.MemberWhereInput = {
          deletedAt: null,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(memberType ? { type: memberType } : {}),
          ...(status ? { status } : {}),
        };
        const truncExpr = memberDateTruncExpression(groupBy);
        const timeData = await prisma.$queryRaw<
          { period: Date; cnt: bigint | null }[]
        >`
          SELECT ${Prisma.raw(truncExpr)} AS period, COUNT(*) AS cnt
          FROM members
          WHERE deleted_at IS NULL
          ${dateFilter?.gte ? Prisma.sql`AND created_at >= ${dateFilter.gte}` : Prisma.empty}
          ${dateFilter?.lte ? Prisma.sql`AND created_at <= ${dateFilter.lte}` : Prisma.empty}
          ${memberType ? Prisma.sql`AND type = ${memberType}::"MemberType"` : Prisma.empty}
          ${status ? Prisma.sql`AND status = ${status}::"MemberStatus"` : Prisma.empty}
          GROUP BY period
          ORDER BY period ASC
        `;
        const total = await prisma.member.count({ where: memberWhere });
        results.new_members = {
          total,
          series: timeData.map((r) => ({
            date: toISODate(r.period),
            value: Number(r.cnt ?? 0),
          })),
        };
        break;
      }
      case 'active_subscriptions': {
        const subWhere: Prisma.SubscriptionWhereInput = {
          deletedAt: null,
          member: { deletedAt: null },
          status: 'active',
          ...(disciplineId ? { disciplineId } : {}),
        };
        const total = await prisma.subscription.count({ where: subWhere });
        // Group by plan type for pie charts
        const byPlan = await prisma.subscription.groupBy({
          by: ['planType'],
          where: subWhere,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
        });
        results.active_subscriptions = {
          total,
          series: byPlan.map((r) => ({
            date: r.planType,
            value: r._count.id,
          })),
        };
        break;
      }
      case 'expenses': {
        const expWhere: Prisma.ExpenseWhereInput = {
          deletedAt: null,
          ...(dateFilter ? { date: dateFilter } : {}),
        };
        const expTrunc = expenseDateTruncExpression(groupBy);
        const timeData = await prisma.$queryRaw<
          { period: Date; total: bigint | null }[]
        >`
          SELECT ${Prisma.raw(expTrunc)} AS period,
            SUM(amount) AS total
          FROM expenses
          WHERE deleted_at IS NULL
          ${dateFilter?.gte ? Prisma.sql`AND date >= ${dateFilter.gte}` : Prisma.empty}
          ${dateFilter?.lte ? Prisma.sql`AND date <= ${dateFilter.lte}` : Prisma.empty}
          GROUP BY period
          ORDER BY period ASC
        `;
        const agg = await prisma.expense.aggregate({
          where: expWhere,
          _sum: { amount: true },
        });
        results.expenses = {
          total: agg._sum.amount ?? 0,
          series: timeData.map((r) => ({
            date: toISODate(r.period),
            value: Number(r.total ?? 0),
          })),
        };
        break;
      }
    }
  }

  // Transform metrics record into series array matching frontend shape:
  // { series: [{ metric, data: [{ label, value }] }], lastUpdated }
  const series = Object.entries(results).map(([metricName, metricData]) => {
    const typed = metricData as { total: number; series: { date: string; value: number }[] };
    return {
      metric: metricName,
      data: typed.series.map((e) => ({ label: e.date, value: e.value })),
    };
  });

  return {
    series,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 7. Export Report ────────────────────────────────────────────────────────

export async function exportReport(query: ExportQuery) {
  const { reportType, format, dateFrom, dateTo } = query;
  const dateFilter = buildDateFilter(dateFrom, dateTo);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  // The frontend constructs the final file client-side (CSV download / window.print).
  // Always use .csv for the data export; PDF is handled entirely on the client.
  const filename = `${reportType}-report-${timestamp}.${format === 'excel' ? 'csv' : 'pdf'}`;

  let headers: string[] = [];
  let rows: (string | number | null)[][] = [];

  switch (reportType) {
    case 'attendance': {
      headers = [
        'Date',
        'Member ID',
        'Member Name',
        'Discipline',
        'Method',
        'Check-in Time',
        'Check-out Time',
      ];
      const records = await prisma.attendanceRecord.findMany({
        where: {
          deletedAt: null,
          member: { deletedAt: null },
          ...(dateFilter ? { checkInTime: dateFilter } : {}),
          ...(query.disciplineId ? { disciplineId: query.disciplineId } : {}),
        },
        include: {
          member: {
            select: {
              id: true,
              firstNameLatin: true,
              lastNameLatin: true,
            },
          },
          discipline: { select: { name: true } },
        },
        orderBy: { checkInTime: 'desc' },
        take: 5000,
      });
      rows = records.map((r) => [
        toISODate(r.checkInTime),
        r.member.id,
        [r.member.firstNameLatin, r.member.lastNameLatin]
          .filter(Boolean)
          .join(' ') || 'Unknown',
        r.discipline?.name ?? 'N/A',
        r.method,
        r.checkInTime.toISOString(),
        r.checkOutTime?.toISOString() ?? null,
      ]);
      break;
    }
    case 'financial': {
      headers = [
        'Date',
        'Receipt Number',
        'Member Name',
        'Payment Type',
        'Total Amount',
        'Paid Amount',
        'Remaining',
      ];
      const payments = await prisma.payment.findMany({
        where: {
          deletedAt: null,
          member: { deletedAt: null },
          ...(dateFilter ? { createdAt: dateFilter } : {}),
          ...(query.paymentType ? { paymentType: query.paymentType } : {}),
        },
        include: {
          member: {
            select: {
              firstNameLatin: true,
              lastNameLatin: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      rows = payments.map((p) => [
        toISODate(p.createdAt),
        p.receiptNumber,
        [p.member.firstNameLatin, p.member.lastNameLatin]
          .filter(Boolean)
          .join(' ') || 'Unknown',
        p.paymentType,
        p.totalAmount,
        p.paidAmount,
        p.remaining,
      ]);
      break;
    }
    case 'membership': {
      headers = [
        'Member ID',
        'First Name',
        'Last Name',
        'Type',
        'Status',
        'Gender',
        'Date of Birth',
        'Created At',
      ];
      const members = await prisma.member.findMany({
        where: {
          deletedAt: null,
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      rows = members.map((m) => [
        m.id,
        m.firstNameLatin,
        m.lastNameLatin,
        m.type,
        m.status,
        m.gender,
        m.dateOfBirth ? toISODate(m.dateOfBirth) : null,
        toISODate(m.createdAt),
      ]);
      break;
    }
    case 'inventory': {
      headers = [
        'Equipment ID',
        'Name',
        'Current Stock',
        'Price (centimes)',
        'Total Sold',
        'Revenue (centimes)',
      ];
      const equipment = await prisma.equipment.findMany({
        where: {
          deletedAt: null,
          ...(query.equipmentId ? { id: query.equipmentId } : {}),
        },
        orderBy: { name: 'asc' },
      });

      const salesByEquipment = await prisma.memberEquipment.groupBy({
        by: ['equipmentId'],
        where: {
          deletedAt: null,
          member: { deletedAt: null },
          ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
          ...(dateFilter ? { purchaseDate: dateFilter } : {}),
        },
        _sum: { quantity: true },
      });
      const salesMap = new Map(
        salesByEquipment.map((s) => [s.equipmentId, s._sum.quantity ?? 0]),
      );

      rows = equipment.map((eq) => {
        const totalSold = salesMap.get(eq.id) ?? 0;
        return [
          eq.id,
          eq.name,
          eq.stockQuantity,
          eq.price,
          totalSold,
          totalSold * eq.price,
        ];
      });
      break;
    }
    case 'documents': {
      headers = [
        'Document ID',
        'Member Name',
        'Type',
        'Status',
        'Issue Date',
        'Expiry Date',
      ];
      const documents = await prisma.document.findMany({
        where: {
          deletedAt: null,
          member: { deletedAt: null },
          ...(query.documentType ? { type: query.documentType } : {}),
          ...(query.documentStatus ? { status: query.documentStatus } : {}),
          ...(dateFilter ? { createdAt: dateFilter } : {}),
        },
        include: {
          member: {
            select: {
              firstNameLatin: true,
              lastNameLatin: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5000,
      });
      rows = documents.map((d) => [
        d.id,
        [d.member.firstNameLatin, d.member.lastNameLatin]
          .filter(Boolean)
          .join(' ') || 'Unknown',
        d.type,
        d.status,
        d.issueDate ? toISODate(d.issueDate) : null,
        d.expiryDate ? toISODate(d.expiryDate) : null,
      ]);
      break;
    }
  }

  return {
    fileName: filename,
    headers,
    rows,
    generatedAt: new Date().toISOString(),
  };
}

// ─── 8. Outstanding Balances Report ──────────────────────────────────────────

export async function getOutstandingBalances(query: OutstandingBalancesQuery) {
  const { minAmount, sortBy } = query;

  // All payments with remaining > 0, grouped by member.
  // Primary phone is pulled from member_contacts as a subquery.
  const outstandingRaw = await prisma.$queryRaw<
    {
      member_id: string;
      first_name_latin: string | null;
      last_name_latin: string | null;
      first_name_arabic: string | null;
      last_name_arabic: string | null;
      phone: string | null;
      total_outstanding: bigint | null;
      last_payment_at: Date | null;
      oldest_unpaid_at: Date | null;
      payment_count: bigint | null;
    }[]
  >`
    SELECT
      p.member_id,
      m.first_name_latin,
      m.last_name_latin,
      m.first_name_arabic,
      m.last_name_arabic,
      (
        SELECT mc.value
        FROM member_contacts mc
        WHERE mc.member_id = m.id
          AND mc.type = 'phone'
          AND mc.deleted_at IS NULL
        ORDER BY mc.is_primary DESC, mc.created_at ASC
        LIMIT 1
      ) AS phone,
      SUM(p.remaining) AS total_outstanding,
      MAX(p.created_at) AS last_payment_at,
      MIN(p.created_at) FILTER (WHERE p.remaining > 0) AS oldest_unpaid_at,
      COUNT(*) FILTER (WHERE p.remaining > 0) AS payment_count
    FROM payments p
    JOIN members m ON m.id = p.member_id AND m.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
      AND p.remaining > 0
    GROUP BY p.member_id, m.id, m.first_name_latin, m.last_name_latin, m.first_name_arabic, m.last_name_arabic
    ${minAmount !== undefined && minAmount > 0 ? Prisma.sql`HAVING SUM(p.remaining) >= ${minAmount}` : Prisma.empty}
  `;

  const now = new Date();
  const members = outstandingRaw.map((r) => {
    const ageDays = r.oldest_unpaid_at
      ? Math.floor((now.getTime() - r.oldest_unpaid_at.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      memberId: r.member_id,
      memberName:
        [r.first_name_latin, r.last_name_latin].filter(Boolean).join(' ') ||
        [r.first_name_arabic, r.last_name_arabic].filter(Boolean).join(' ') ||
        'Unknown',
      phone: r.phone,
      totalOutstanding: Number(r.total_outstanding ?? 0),
      paymentCount: Number(r.payment_count ?? 0),
      lastPaymentAt: r.last_payment_at?.toISOString() ?? null,
      oldestUnpaidAt: r.oldest_unpaid_at?.toISOString() ?? null,
      ageDays,
      ageBucket:
        ageDays <= 30
          ? '0_30'
          : ageDays <= 60
            ? '31_60'
            : ageDays <= 90
              ? '61_90'
              : '90_plus',
    };
  });

  // Sort
  members.sort((a, b) => {
    if (sortBy === 'memberName') return a.memberName.localeCompare(b.memberName);
    if (sortBy === 'lastPayment') {
      const aT = a.lastPaymentAt ? Date.parse(a.lastPaymentAt) : 0;
      const bT = b.lastPaymentAt ? Date.parse(b.lastPaymentAt) : 0;
      return bT - aT;
    }
    return b.totalOutstanding - a.totalOutstanding;
  });

  const totalOutstanding = members.reduce((s, m) => s + m.totalOutstanding, 0);
  const memberCount = members.length;
  const avgOutstanding = memberCount > 0 ? Math.round(totalOutstanding / memberCount) : 0;

  // Age buckets
  const buckets: Record<string, { count: number; total: number }> = {
    '0_30': { count: 0, total: 0 },
    '31_60': { count: 0, total: 0 },
    '61_90': { count: 0, total: 0 },
    '90_plus': { count: 0, total: 0 },
  };
  for (const m of members) {
    buckets[m.ageBucket]!.count += 1;
    buckets[m.ageBucket]!.total += m.totalOutstanding;
  }
  const byAgeBucket = Object.entries(buckets).map(([bucket, v]) => ({
    bucket,
    count: v.count,
    total: v.total,
  }));

  return {
    summary: {
      totalOutstanding,
      memberCount,
      avgOutstanding,
    },
    members,
    byAgeBucket,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 9. Daily Cash Report ────────────────────────────────────────────────────

export async function getDailyCashReport(query: DailyCashQuery) {
  const date = query.date ? new Date(query.date) : new Date();
  const dayStart = new Date(date);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setUTCHours(23, 59, 59, 999);

  // Revenue from payments created today (excluding refunds)
  const payments = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      member: { deletedAt: null },
      createdAt: { gte: dayStart, lte: dayEnd },
    },
    include: {
      member: {
        select: {
          firstNameLatin: true,
          lastNameLatin: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const revenuePayments = payments.filter((p) => p.paymentType !== 'refund');
  const refundPayments = payments.filter((p) => p.paymentType === 'refund');

  const totalRevenue = revenuePayments.reduce((s, p) => s + p.paidAmount, 0);
  const totalRefunds = refundPayments.reduce((s, p) => s + Math.abs(p.paidAmount), 0);

  // Expenses recorded today
  const expenses = await prisma.expense.findMany({
    where: {
      deletedAt: null,
      date: { gte: dayStart, lte: dayEnd },
    },
    orderBy: { createdAt: 'asc' },
  });
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Net cash = revenue - refunds - expenses
  const netCash = totalRevenue - totalRefunds - totalExpenses;

  // Breakdown by payment type
  const byTypeMap = new Map<string, { amount: number; count: number }>();
  for (const p of payments) {
    const existing = byTypeMap.get(p.paymentType);
    const amt = p.paymentType === 'refund' ? -Math.abs(p.paidAmount) : p.paidAmount;
    if (existing) {
      existing.amount += amt;
      existing.count += 1;
    } else {
      byTypeMap.set(p.paymentType, { amount: amt, count: 1 });
    }
  }
  const byPaymentType = Array.from(byTypeMap.entries())
    .map(([type, v]) => ({ type, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);

  // Expenses by category
  const byCategoryMap = new Map<string, { amount: number; count: number }>();
  for (const e of expenses) {
    const existing = byCategoryMap.get(e.category);
    if (existing) {
      existing.amount += e.amount;
      existing.count += 1;
    } else {
      byCategoryMap.set(e.category, { amount: e.amount, count: 1 });
    }
  }
  const expensesByCategory = Array.from(byCategoryMap.entries())
    .map(([category, v]) => ({ category, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount);

  // Hourly cash flow
  const hourlyMap = new Map<number, { revenue: number; refunds: number; expenses: number }>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { revenue: 0, refunds: 0, expenses: 0 });
  }
  for (const p of payments) {
    const h = p.createdAt.getUTCHours();
    const b = hourlyMap.get(h)!;
    if (p.paymentType === 'refund') b.refunds += Math.abs(p.paidAmount);
    else b.revenue += p.paidAmount;
  }
  for (const e of expenses) {
    const h = e.createdAt.getUTCHours();
    const b = hourlyMap.get(h)!;
    b.expenses += e.amount;
  }
  const hourly = Array.from(hourlyMap.entries())
    .map(([hour, v]) => ({
      hour,
      revenue: v.revenue,
      refunds: v.refunds,
      expenses: v.expenses,
      net: v.revenue - v.refunds - v.expenses,
    }))
    .sort((a, b) => a.hour - b.hour);

  // Transaction list
  const transactions = [
    ...payments.map((p) => ({
      id: p.id,
      time: p.createdAt.toISOString(),
      type: p.paymentType === 'refund' ? ('refund' as const) : ('revenue' as const),
      label: p.receiptNumber,
      memberName:
        [p.member.firstNameLatin, p.member.lastNameLatin].filter(Boolean).join(' ') ||
        'Unknown',
      amount: p.paymentType === 'refund' ? -Math.abs(p.paidAmount) : p.paidAmount,
      category: p.paymentType,
    })),
    ...expenses.map((e) => ({
      id: e.id,
      time: e.createdAt.toISOString(),
      type: 'expense' as const,
      label: e.description ?? e.category,
      memberName: null,
      amount: -e.amount,
      category: e.category,
    })),
  ].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));

  return {
    date: dayStart.toISOString(),
    summary: {
      totalRevenue,
      totalRefunds,
      totalExpenses,
      netCash,
      transactionCount: payments.length + expenses.length,
    },
    byPaymentType,
    expensesByCategory,
    hourly,
    transactions,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 10. Members Missing Required Documents ──────────────────────────────────

const DEFAULT_REQUIRED_DOC_TYPES = ['medical_certificate', 'id_card'];

export async function getMissingDocumentsReport(query: MissingDocumentsQuery) {
  const requiredTypes = query.requiredTypes ?? DEFAULT_REQUIRED_DOC_TYPES;

  // Find all active/pending members with their documents and primary phone contact
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      status: { in: ['active', 'pending'] },
    },
    include: {
      documents: {
        where: { deletedAt: null },
        select: {
          type: true,
          status: true,
          expiryDate: true,
        },
      },
      contacts: {
        where: { deletedAt: null, type: 'phone' },
        select: { value: true, isPrimary: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();

  const missingList = members
    .map((m) => {
      const missingTypes: string[] = [];
      for (const reqType of requiredTypes) {
        const doc = m.documents.find((d) => d.type === reqType);
        const isValid =
          doc !== undefined &&
          doc.status === 'valid' &&
          (!doc.expiryDate || doc.expiryDate > now);
        if (!isValid) missingTypes.push(reqType);
      }
      const primaryPhone =
        m.contacts.find((c) => c.isPrimary)?.value ?? m.contacts[0]?.value ?? null;
      return {
        memberId: m.id,
        memberName:
          [m.firstNameLatin, m.lastNameLatin].filter(Boolean).join(' ') || 'Unknown',
        phone: primaryPhone,
        type: m.type,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
        missingTypes,
        missingCount: missingTypes.length,
      };
    })
    .filter((r) => r.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount);

  // By required doc type
  const byType = requiredTypes.map((reqType) => ({
    type: reqType,
    missingCount: missingList.filter((m) => m.missingTypes.includes(reqType)).length,
  }));

  return {
    summary: {
      totalMembers: members.length,
      membersWithMissing: missingList.length,
      compliancePct:
        members.length > 0
          ? Math.round(((members.length - missingList.length) / members.length) * 10000) / 100
          : 100,
      requiredTypes,
    },
    members: missingList,
    byType,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 11. Absences Report (members inactive recently) ─────────────────────────

export async function getAbsencesReport(query: AbsencesQuery) {
  const { daysWithoutCheckIn } = query;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysWithoutCheckIn);

  // Active members with no attendance after the cutoff date.
  // Primary phone pulled from member_contacts.
  const inactiveRaw = await prisma.$queryRaw<
    {
      member_id: string;
      first_name_latin: string | null;
      last_name_latin: string | null;
      phone: string | null;
      type: string;
      created_at: Date;
      last_check_in: Date | null;
    }[]
  >`
    SELECT
      m.id AS member_id,
      m.first_name_latin,
      m.last_name_latin,
      (
        SELECT mc.value
        FROM member_contacts mc
        WHERE mc.member_id = m.id
          AND mc.type = 'phone'
          AND mc.deleted_at IS NULL
        ORDER BY mc.is_primary DESC, mc.created_at ASC
        LIMIT 1
      ) AS phone,
      m.type::text AS type,
      m.created_at,
      (
        SELECT MAX(ar.check_in_time)
        FROM attendance_records ar
        WHERE ar.member_id = m.id AND ar.deleted_at IS NULL
      ) AS last_check_in
    FROM members m
    WHERE m.deleted_at IS NULL
      AND m.status = 'active'
      AND (
        NOT EXISTS (
          SELECT 1 FROM attendance_records ar
          WHERE ar.member_id = m.id
            AND ar.deleted_at IS NULL
            AND ar.check_in_time >= ${cutoff}
        )
      )
    ORDER BY last_check_in DESC NULLS LAST
  `;

  const now = new Date();
  const members = inactiveRaw.map((r) => {
    const lastCheckIn = r.last_check_in;
    const daysSince = lastCheckIn
      ? Math.floor((now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    return {
      memberId: r.member_id,
      memberName:
        [r.first_name_latin, r.last_name_latin].filter(Boolean).join(' ') || 'Unknown',
      phone: r.phone,
      type: r.type,
      lastCheckIn: lastCheckIn?.toISOString() ?? null,
      daysSinceLastCheckIn: daysSince,
      neverCheckedIn: lastCheckIn === null,
    };
  });

  // Age buckets
  const buckets: Record<string, number> = {
    never: 0,
    '15_30': 0,
    '31_60': 0,
    '61_90': 0,
    '90_plus': 0,
  };
  for (const m of members) {
    if (m.neverCheckedIn) buckets.never! += 1;
    else if (m.daysSinceLastCheckIn! <= 30) buckets['15_30']! += 1;
    else if (m.daysSinceLastCheckIn! <= 60) buckets['31_60']! += 1;
    else if (m.daysSinceLastCheckIn! <= 90) buckets['61_90']! += 1;
    else buckets['90_plus']! += 1;
  }
  const byBucket = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));

  return {
    summary: {
      inactiveMemberCount: members.length,
      daysWithoutCheckIn,
      cutoffDate: cutoff.toISOString(),
    },
    members,
    byBucket,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 12. Late Arrivals Report ────────────────────────────────────────────────

export async function getLateArrivalsReport(query: LateArrivalsQuery) {
  const { dateFrom, dateTo, gracePeriodMinutes, disciplineId } = query;
  const dateFilter = buildDateFilter(dateFrom, dateTo);

  // "Late" means: the member checked in AFTER the scheduled start_time of the
  // session they were attending that day, by more than `gracePeriodMinutes`.
  //
  //   1. For each attendance record, look up the member's schedules whose
  //      day_of_week matches the check-in's DOW (via member_disciplines).
  //   2. Among those candidate slots, pick the one whose start_time is closest
  //      to — but ≤ — the check-in time. DISTINCT ON (+ ORDER BY delta ASC)
  //      breaks ties by returning the slot with the smallest positive delta.
  //      If the member arrived before any scheduled slot that day, no row is
  //      returned (unscheduled early check-in is not tardy).
  //   3. minutes_late = (check_in_time::time - start_time::time) in minutes.
  //   4. Outer filter keeps only minutes_late > gracePeriodMinutes.
  //
  // Note: time_slots.start_time / end_time are stored as TEXT 'HH:mm', so we
  // cast via ::time. ar.check_in_time::time uses the session TZ, matching the
  // convention already used elsewhere in this file (EXTRACT(HOUR FROM ...)).
  const lateRaw = await prisma.$queryRaw<
    {
      id: string;
      member_id: string;
      first_name_latin: string | null;
      last_name_latin: string | null;
      discipline_name: string | null;
      check_in_time: Date;
      start_time: string;
      end_time: string;
      minutes_late: number;
      session_duration_minutes: number;
    }[]
  >`
    WITH best_slots AS (
      SELECT DISTINCT ON (ar.id)
        ar.id,
        ar.member_id,
        ar.check_in_time,
        m.first_name_latin,
        m.last_name_latin,
        d.name AS discipline_name,
        ts.start_time,
        ts.end_time,
        (EXTRACT(EPOCH FROM (ar.check_in_time::time - ts.start_time::time)) / 60)::int AS minutes_late,
        (EXTRACT(EPOCH FROM (ts.end_time::time - ts.start_time::time)) / 60)::int AS session_duration_minutes
      FROM attendance_records ar
      JOIN members m ON m.id = ar.member_id AND m.deleted_at IS NULL
      JOIN member_disciplines md ON md.member_id = ar.member_id AND md.deleted_at IS NULL
      JOIN schedules s ON s.member_discipline_id = md.id AND s.deleted_at IS NULL
        AND s.day_of_week = EXTRACT(DOW FROM ar.check_in_time)::int
      JOIN time_slots ts ON ts.id = s.time_slot_id AND ts.deleted_at IS NULL
      LEFT JOIN disciplines d ON d.id = ar.discipline_id
      WHERE ar.deleted_at IS NULL
        AND ts.start_time::time <= ar.check_in_time::time
      ${dateFilter?.gte ? Prisma.sql`AND ar.check_in_time >= ${dateFilter.gte}` : Prisma.empty}
      ${dateFilter?.lte ? Prisma.sql`AND ar.check_in_time <= ${dateFilter.lte}` : Prisma.empty}
      ${disciplineId ? Prisma.sql`AND md.discipline_id = ${disciplineId}::uuid` : Prisma.empty}
      ORDER BY ar.id, (ar.check_in_time::time - ts.start_time::time) ASC
    )
    SELECT *
    FROM best_slots
    WHERE minutes_late > ${gracePeriodMinutes}
    ORDER BY check_in_time DESC
    LIMIT 2000
  `;

  const records = lateRaw.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    memberName:
      [r.first_name_latin, r.last_name_latin].filter(Boolean).join(' ') || 'Unknown',
    discipline: r.discipline_name,
    checkInTime: r.check_in_time.toISOString(),
    scheduledStartTime: r.start_time,
    minutesLate: Number(r.minutes_late),
  }));

  // Top late members (lateCount + avg minutesLate)
  const perMember = new Map<
    string,
    { memberId: string; memberName: string; lateCount: number; totalMinutes: number }
  >();
  for (const r of records) {
    const existing = perMember.get(r.memberId);
    if (existing) {
      existing.lateCount += 1;
      existing.totalMinutes += r.minutesLate;
    } else {
      perMember.set(r.memberId, {
        memberId: r.memberId,
        memberName: r.memberName,
        lateCount: 1,
        totalMinutes: r.minutesLate,
      });
    }
  }
  const topLateMembers = Array.from(perMember.values())
    .map((m) => ({
      memberId: m.memberId,
      memberName: m.memberName,
      lateCount: m.lateCount,
      avgMinutesLate: m.lateCount > 0 ? Math.round(m.totalMinutes / m.lateCount) : 0,
    }))
    .sort((a, b) => b.lateCount - a.lateCount || b.avgMinutesLate - a.avgMinutesLate)
    .slice(0, 20);

  // Duration buckets: 0-15, 16-30, 31-60, 60+ minutes late
  const bucketCounts = { '0_15': 0, '16_30': 0, '31_60': 0, '60_plus': 0 };
  for (const r of records) {
    const ml = r.minutesLate;
    if (ml <= 15) bucketCounts['0_15'] += 1;
    else if (ml <= 30) bucketCounts['16_30'] += 1;
    else if (ml <= 60) bucketCounts['31_60'] += 1;
    else bucketCounts['60_plus'] += 1;
  }
  const byBucket = (['0_15', '16_30', '31_60', '60_plus'] as const).map((bucket) => ({
    bucket,
    count: bucketCounts[bucket],
  }));

  const totalMinutes = records.reduce((sum, r) => sum + r.minutesLate, 0);
  const avgMinutesLate = records.length > 0 ? Math.round(totalMinutes / records.length) : 0;

  return {
    summary: {
      totalLateArrivals: records.length,
      uniqueMembersLate: perMember.size,
      gracePeriodMinutes,
      avgMinutesLate,
    },
    records,
    topLateMembers,
    byBucket,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── 13. Report Templates ───────────────────────────────────────────────────

const TEMPLATE_KEY_PREFIX = 'report_template:';

export async function saveTemplate(
  input: SaveTemplateInput,
  userId: string,
) {
  const key = `${TEMPLATE_KEY_PREFIX}${input.name}`;

  // Check for duplicate name
  const existing = await prisma.setting.findUnique({ where: { key } });
  if (existing) {
    throw new ReportError(
      'DUPLICATE_TEMPLATE',
      `A template with the name "${input.name}" already exists`,
      409,
    );
  }

  const setting = await prisma.setting.create({
    data: {
      key,
      value: JSON.stringify(input.config),
      updatedBy: userId,
    },
  });

  return {
    id: setting.id,
    name: input.name,
    config: input.config,
    chartType: input.config.chartType ?? 'bar',
    createdAt: setting.createdAt.toISOString(),
  };
}

export async function deleteTemplate(id: string) {
  const setting = await prisma.setting.findUnique({ where: { id } });
  if (!setting || !setting.key.startsWith(TEMPLATE_KEY_PREFIX)) {
    throw new ReportError('NOT_FOUND', 'Template not found', 404);
  }
  await prisma.setting.delete({ where: { id } });
}

export async function listTemplates() {
  const settings = await prisma.setting.findMany({
    where: {
      key: { startsWith: TEMPLATE_KEY_PREFIX },
    },
    orderBy: { createdAt: 'desc' },
  });

  return settings.map((s) => {
    const config = JSON.parse(s.value) as Record<string, unknown>;
    return {
      id: s.id,
      name: s.key.slice(TEMPLATE_KEY_PREFIX.length),
      config,
      chartType: (config.chartType as string) ?? 'bar',
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  });
}
