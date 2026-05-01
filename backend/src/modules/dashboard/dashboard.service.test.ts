/**
 * dashboard.service.test.ts
 *
 * Tests are unit-level: all Prisma calls are mocked with vi.mock so no
 * real database connection is required.  Each test suite covers one of
 * the seven alert categories and asserts the correct row appears in the
 * output given a controlled fixture.
 *
 * Run with:
 *   cd backend && npm test -- dashboard
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the Prisma singleton ────────────────────────────────────────────────
// The mock must be defined before any imports that use prisma.

vi.mock('../../lib/prisma.js', () => {
  const mockPrisma = {
    subscription: {
      findMany: vi.fn(),
    },
    payment: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    member: {
      findMany: vi.fn(),
    },
    documentRequirement: {
      findMany: vi.fn(),
    },
    attendanceRecord: {
      findMany: vi.fn(),
    },
    equipment: {
      findMany: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';
import {
  getSubscriptionsExpiring,
  getUnpaidBalance,
  getRenewalNeeded,
  getMissingDocuments,
  getInactiveMembers,
  getAbsentToday,
  getStockOut,
  getDashboardAlerts,
} from './dashboard.service.js';

// ─── Fixture factories ────────────────────────────────────────────────────────

const NOW = new Date('2026-04-15T00:00:00.000Z');

function makeMemberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-uuid-1',
    firstNameLatin: 'Alice',
    lastNameLatin: 'Smith',
    firstNameArabic: null,
    lastNameArabic: null,
    photoPath: null,
    type: 'athlete',
    disciplines: [],
    attendanceRecords: [],
    documents: [],
    ...overrides,
  };
}

function makeSubscriptionRow(overrides: Record<string, unknown> = {}) {
  return {
    endDate: new Date('2026-04-20T00:00:00.000Z'), // 5 days from now
    member: makeMemberRow(),
    ...overrides,
  };
}

// ─── 1. getSubscriptionsExpiring ──────────────────────────────────────────────

describe('getSubscriptionsExpiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
  });

  it('returns a member whose subscription ends within the window', async () => {
    const row = makeSubscriptionRow();
    vi.mocked(prisma.subscription.findMany).mockResolvedValueOnce([row] as never);

    const result = await getSubscriptionsExpiring(14, 20);

    expect(result).toHaveLength(1);
    expect(result[0]!.memberId).toBe('member-uuid-1');
    expect(result[0]!.firstNameLatin).toBe('Alice');
    expect(result[0]!.renewalDate).toBe('2026-04-20');
  });

  it('returns empty array when no subscriptions are expiring', async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValueOnce([] as never);

    const result = await getSubscriptionsExpiring(14, 20);
    expect(result).toHaveLength(0);
  });

  it('filters out rows with null member', async () => {
    const row = { ...makeSubscriptionRow(), member: null };
    vi.mocked(prisma.subscription.findMany).mockResolvedValueOnce([row] as never);

    const result = await getSubscriptionsExpiring(14, 20);
    expect(result).toHaveLength(0);
  });
});

// ─── 2. getUnpaidBalance ──────────────────────────────────────────────────────

describe('getUnpaidBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns members with outstanding balance', async () => {
    vi.mocked(prisma.payment.groupBy).mockResolvedValueOnce([
      { memberId: 'member-uuid-1', _sum: { remaining: 50000 } },
    ] as never);

    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([
      makeMemberRow(),
    ] as never);

    const result = await getUnpaidBalance(20);

    expect(result).toHaveLength(1);
    expect(result[0]!.memberId).toBe('member-uuid-1');
    expect(result[0]!.extra?.balanceDue).toBe(50000);
  });

  it('returns empty when no members have outstanding balance', async () => {
    vi.mocked(prisma.payment.groupBy).mockResolvedValueOnce([] as never);

    const result = await getUnpaidBalance(20);
    expect(result).toHaveLength(0);
  });
});

// ─── 3. getRenewalNeeded ──────────────────────────────────────────────────────

describe('getRenewalNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
  });

  it('returns members with expired-but-active subscriptions', async () => {
    const row = makeSubscriptionRow({
      endDate: new Date('2026-04-10T00:00:00.000Z'), // 5 days ago
    });
    vi.mocked(prisma.subscription.findMany).mockResolvedValueOnce([row] as never);

    const result = await getRenewalNeeded(20);

    expect(result).toHaveLength(1);
    expect(result[0]!.memberId).toBe('member-uuid-1');
    expect(result[0]!.renewalDate).toBe('2026-04-10');
  });

  it('returns empty when no lapsed subscriptions exist', async () => {
    vi.mocked(prisma.subscription.findMany).mockResolvedValueOnce([] as never);
    const result = await getRenewalNeeded(20);
    expect(result).toHaveLength(0);
  });
});

// ─── 4. getMissingDocuments ───────────────────────────────────────────────────

describe('getMissingDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns members who are missing a required document', async () => {
    vi.mocked(prisma.documentRequirement.findMany).mockResolvedValueOnce([
      { documentType: 'medical_certificate', memberTypes: ['athlete'] },
    ] as never);

    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([
      makeMemberRow({ documents: [] }), // no documents uploaded
    ] as never);

    const result = await getMissingDocuments(20);

    expect(result).toHaveLength(1);
    expect(result[0]!.extra?.missingDocTypes).toContain('medical_certificate');
  });

  it('excludes members who already have all required documents', async () => {
    vi.mocked(prisma.documentRequirement.findMany).mockResolvedValueOnce([
      { documentType: 'medical_certificate', memberTypes: ['athlete'] },
    ] as never);

    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([
      makeMemberRow({
        documents: [{ type: 'medical_certificate' }],
      }),
    ] as never);

    const result = await getMissingDocuments(20);
    expect(result).toHaveLength(0);
  });

  it('returns empty when no requirements are configured', async () => {
    vi.mocked(prisma.documentRequirement.findMany).mockResolvedValueOnce([] as never);

    const result = await getMissingDocuments(20);
    expect(result).toHaveLength(0);
    // member.findMany should NOT have been called
    expect(prisma.member.findMany).not.toHaveBeenCalled();
  });

  it('ignores requirements for a different member type', async () => {
    vi.mocked(prisma.documentRequirement.findMany).mockResolvedValueOnce([
      { documentType: 'medical_certificate', memberTypes: ['staff'] }, // athlete not in list
    ] as never);

    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([
      makeMemberRow({ type: 'athlete', documents: [] }),
    ] as never);

    const result = await getMissingDocuments(20);
    expect(result).toHaveLength(0);
  });
});

// ─── 5. getInactiveMembers ────────────────────────────────────────────────────

describe('getInactiveMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
  });

  it('returns active members who have not attended recently', async () => {
    // No recent attendance records
    vi.mocked(prisma.attendanceRecord.findMany).mockResolvedValueOnce([] as never);

    // Member with an old check-in
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([
      makeMemberRow({
        attendanceRecords: [
          { checkInTime: new Date('2026-03-01T10:00:00.000Z') }, // 45 days ago
        ],
      }),
    ] as never);

    const result = await getInactiveMembers(30, 20);

    expect(result).toHaveLength(1);
    expect(result[0]!.memberId).toBe('member-uuid-1');
    expect(result[0]!.extra?.daysInactive).toBeGreaterThanOrEqual(30);
  });

  it('excludes members who attended within the threshold', async () => {
    // Member IS in the recently-active set
    vi.mocked(prisma.attendanceRecord.findMany).mockResolvedValueOnce([
      { memberId: 'member-uuid-1' },
    ] as never);

    // member.findMany will be called with notIn: ['member-uuid-1']
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([] as never);

    const result = await getInactiveMembers(30, 20);
    expect(result).toHaveLength(0);
  });

  it('returns empty when all members are recently active', async () => {
    vi.mocked(prisma.attendanceRecord.findMany).mockResolvedValueOnce([
      { memberId: 'member-uuid-1' },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([] as never);

    const result = await getInactiveMembers(30, 20);
    expect(result).toHaveLength(0);
  });
});

// ─── 6. getAbsentToday ───────────────────────────────────────────────────────

describe('getAbsentToday', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
  });

  it('returns active members with no check-in today', async () => {
    vi.mocked(prisma.attendanceRecord.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([
      makeMemberRow(),
    ] as never);

    const result = await getAbsentToday(20);
    expect(result).toHaveLength(1);
    expect(result[0]!.memberId).toBe('member-uuid-1');
  });

  it('excludes members who already checked in today', async () => {
    vi.mocked(prisma.attendanceRecord.findMany).mockResolvedValueOnce([
      { memberId: 'member-uuid-1' },
    ] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([] as never);

    const result = await getAbsentToday(20);
    expect(result).toHaveLength(0);
  });
});

// ─── 7. getStockOut ──────────────────────────────────────────────────────────

describe('getStockOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns equipment with stockQuantity = 0', async () => {
    vi.mocked(prisma.equipment.findMany).mockResolvedValueOnce([
      { id: 'equip-uuid-1', name: 'Boxing Gloves', stockQuantity: 0 },
    ] as never);

    const result = await getStockOut(20);
    expect(result).toHaveLength(1);
    expect(result[0]!.equipmentId).toBe('equip-uuid-1');
    expect(result[0]!.stockQuantity).toBe(0);
  });

  it('returns equipment with negative stockQuantity', async () => {
    vi.mocked(prisma.equipment.findMany).mockResolvedValueOnce([
      { id: 'equip-uuid-2', name: 'Shin Guards', stockQuantity: -2 },
    ] as never);

    const result = await getStockOut(20);
    expect(result).toHaveLength(1);
    expect(result[0]!.stockQuantity).toBe(-2);
  });

  it('returns empty when all stock is positive', async () => {
    vi.mocked(prisma.equipment.findMany).mockResolvedValueOnce([] as never);

    const result = await getStockOut(20);
    expect(result).toHaveLength(0);
  });
});

// ─── 8. getDashboardAlerts (integration of all 7) ────────────────────────────

describe('getDashboardAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(NOW);
  });

  it('calls all 7 category functions and returns aggregated result', async () => {
    // Stub all Prisma calls to return empty arrays
    vi.mocked(prisma.subscription.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.payment.groupBy).mockResolvedValue([] as never);
    vi.mocked(prisma.documentRequirement.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.attendanceRecord.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.member.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.equipment.findMany).mockResolvedValue([] as never);

    const result = await getDashboardAlerts({
      expiringWindowDays: 14,
      inactiveThresholdDays: 30,
      limitPerCategory: 20,
    });

    expect(result).toHaveProperty('subscriptionsExpiring');
    expect(result).toHaveProperty('unpaidBalance');
    expect(result).toHaveProperty('renewalNeeded');
    expect(result).toHaveProperty('missingDocuments');
    expect(result).toHaveProperty('inactiveMembers');
    expect(result).toHaveProperty('absentToday');
    expect(result).toHaveProperty('stockOut');

    // All empty
    expect(result.subscriptionsExpiring).toEqual([]);
    expect(result.unpaidBalance).toEqual([]);
    expect(result.stockOut).toEqual([]);
  });
});
