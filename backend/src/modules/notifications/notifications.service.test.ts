/**
 * notifications.service.test.ts
 *
 * Unit tests for the notifications service. All Prisma calls are mocked
 * so no real database connection is required.
 *
 * Run with:
 *   cd backend && npm test -- notifications
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the Prisma singleton ────────────────────────────────────────────────
// Must be hoisted above any import that resolves prisma.

vi.mock('../../lib/prisma.js', () => {
  const mockPrisma = {
    notification: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from '../../lib/prisma.js';
import { getUnreadCount } from './notifications.service.js';

// ─── getUnreadCount ───────────────────────────────────────────────────────────

describe('getUnreadCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 when there are no notifications', async () => {
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(0 as never);

    const result = await getUnreadCount();

    expect(result).toBe(0);
    expect(prisma.notification.count).toHaveBeenCalledOnce();
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { isRead: false, deletedAt: null },
    });
  });

  it('should return 3 when there are 3 unread and 2 read notifications', async () => {
    // The service queries isRead=false directly, so Prisma returns 3
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(3 as never);

    const result = await getUnreadCount();

    expect(result).toBe(3);
    expect(prisma.notification.count).toHaveBeenCalledOnce();
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: { isRead: false, deletedAt: null },
    });
  });

  it('should exclude soft-deleted notifications (deletedAt != null)', async () => {
    // 2 unread but 1 of them is soft-deleted; Prisma honours deletedAt: null
    // in the where clause — the mock returns 2 (soft-deleted one excluded)
    vi.mocked(prisma.notification.count).mockResolvedValueOnce(2 as never);

    const result = await getUnreadCount();

    expect(result).toBe(2);
    // Verify the query explicitly filters deletedAt: null
    expect(prisma.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});
