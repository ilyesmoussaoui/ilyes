/**
 * search.service.test.ts
 *
 * Unit tests for globalSearch and faceSearch.
 * - Prisma is fully mocked (no DB required).
 * - fetch is mocked with vi.stubGlobal so no real HTTP calls are made.
 *
 * Run with:
 *   cd backend && npm test -- search
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock Prisma ──────────────────────────────────────────────────────────────
vi.mock('../../lib/prisma.js', () => {
  const mockPrisma = {
    member: { findMany: vi.fn(), findFirst: vi.fn() },
    payment: { findMany: vi.fn() },
    equipment: { findMany: vi.fn() },
  };
  return { prisma: mockPrisma };
});

// ─── Mock env (FACE_SERVICE_URL must be defined) ──────────────────────────────
vi.mock('../../config/env.js', () => ({
  getEnv: () => ({
    FACE_SERVICE_URL: 'http://localhost:8001',
    FACE_MATCH_THRESHOLD: 0.6,
  }),
}));

import { prisma } from '../../lib/prisma.js';
import { globalSearch, faceSearch, SearchError } from './search.service.js';

// ─── Fixture factories ────────────────────────────────────────────────────────

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-uuid-1',
    firstNameLatin: 'Alice',
    lastNameLatin: 'Smith',
    firstNameArabic: null,
    lastNameArabic: null,
    photoPath: null,
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'payment-uuid-1',
    receiptNumber: 'REC-001',
    paidAmount: 5000,
    createdAt: new Date('2026-04-01T10:00:00.000Z'),
    memberId: 'member-uuid-1',
    member: { firstNameLatin: 'Alice', lastNameLatin: 'Smith' },
    ...overrides,
  };
}

function makeEquipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'equip-uuid-1',
    name: 'Boxing Gloves',
    stockQuantity: 10,
    price: 3500,
    ...overrides,
  };
}

// JPEG magic bytes header (3 bytes minimum for detection)
function makeJpegBuffer(extraBytes = 100): Buffer {
  const buf = Buffer.alloc(3 + extraBytes);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  return buf;
}

// PNG magic bytes header (8 bytes)
function makePngBuffer(extraBytes = 100): Buffer {
  const buf = Buffer.alloc(8 + extraBytes);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  return buf;
}

// ─── globalSearch — scope=members ────────────────────────────────────────────

describe('globalSearch — scope=members', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return matched members and empty payments + products', async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([makeMember()] as never);

    const result = await globalSearch({ q: 'Alice', scope: 'members' });

    expect(result.members).toHaveLength(1);
    expect(result.members[0]!.id).toBe('member-uuid-1');
    expect(result.payments).toEqual([]);
    expect(result.products).toEqual([]);
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
    expect(prisma.equipment.findMany).not.toHaveBeenCalled();
  });

  it('should return empty members when no match found', async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([] as never);

    const result = await globalSearch({ q: 'NoMatch', scope: 'members' });

    expect(result.members).toEqual([]);
  });
});

// ─── globalSearch — scope=payments ───────────────────────────────────────────

describe('globalSearch — scope=payments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return matched payments and empty members + products', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValueOnce([makePayment()] as never);

    const result = await globalSearch({ q: 'REC-001', scope: 'payments' });

    expect(result.payments).toHaveLength(1);
    expect(result.payments[0]!.receiptNumber).toBe('REC-001');
    expect(result.payments[0]!.memberName).toBe('Alice Smith');
    expect(result.payments[0]!.amount).toBe(5000);
    expect(result.members).toEqual([]);
    expect(result.products).toEqual([]);
    expect(prisma.member.findMany).not.toHaveBeenCalled();
    expect(prisma.equipment.findMany).not.toHaveBeenCalled();
  });

  it('should handle member with null name parts gracefully', async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValueOnce([
      makePayment({ member: { firstNameLatin: null, lastNameLatin: null } }),
    ] as never);

    const result = await globalSearch({ q: 'REC', scope: 'payments' });

    expect(result.payments[0]!.memberName).toBe('');
  });
});

// ─── globalSearch — scope=products ───────────────────────────────────────────

describe('globalSearch — scope=products', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should return matched products and empty members + payments', async () => {
    vi.mocked(prisma.equipment.findMany).mockResolvedValueOnce([makeEquipment()] as never);

    const result = await globalSearch({ q: 'Boxing', scope: 'products' });

    expect(result.products).toHaveLength(1);
    expect(result.products[0]!.name).toBe('Boxing Gloves');
    expect(result.products[0]!.priceCents).toBe(3500);
    expect(result.members).toEqual([]);
    expect(result.payments).toEqual([]);
    expect(prisma.member.findMany).not.toHaveBeenCalled();
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });
});

// ─── globalSearch — scope=all ─────────────────────────────────────────────────

describe('globalSearch — scope=all (default)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should query all three groups in parallel', async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([makeMember()] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValueOnce([makePayment()] as never);
    vi.mocked(prisma.equipment.findMany).mockResolvedValueOnce([makeEquipment()] as never);

    const result = await globalSearch({ q: 'test', scope: 'all' });

    expect(result.members).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
    expect(result.products).toHaveLength(1);
    expect(prisma.member.findMany).toHaveBeenCalledOnce();
    expect(prisma.payment.findMany).toHaveBeenCalledOnce();
    expect(prisma.equipment.findMany).toHaveBeenCalledOnce();
  });

  it('should return empty arrays for all groups when no results found', async () => {
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.payment.findMany).mockResolvedValueOnce([] as never);
    vi.mocked(prisma.equipment.findMany).mockResolvedValueOnce([] as never);

    const result = await globalSearch({ q: 'xyz', scope: 'all' });

    expect(result.members).toEqual([]);
    expect(result.payments).toEqual([]);
    expect(result.products).toEqual([]);
  });
});

// ─── faceSearch — success ────────────────────────────────────────────────────

describe('faceSearch — success', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('should return a match when face service returns a valid hit', async () => {
    const jpegBuf = makeJpegBuffer();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          match: { member_id: 'member-uuid-1', confidence: 0.92, embedding_id: 'emb-1' },
        }),
      }),
    );

    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce(makeMember() as never);

    const result = await faceSearch(jpegBuf);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]!.memberId).toBe('member-uuid-1');
    expect(result.matches[0]!.confidence).toBe(0.92);
    expect(result.matches[0]!.member.firstNameLatin).toBe('Alice');
  });

  it('should return empty matches when face service returns success=true but no match', async () => {
    const jpegBuf = makeJpegBuffer();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, match: null }),
      }),
    );

    const result = await faceSearch(jpegBuf);

    expect(result.matches).toEqual([]);
    expect(prisma.member.findFirst).not.toHaveBeenCalled();
  });

  it('should return empty matches when face service reports an edge case (success=false)', async () => {
    const jpegBuf = makeJpegBuffer();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: 'NO_FACE_DETECTED',
          hint: 'No face found in the image.',
        }),
      }),
    );

    const result = await faceSearch(jpegBuf);

    expect(result.matches).toEqual([]);
  });

  it('should accept PNG images', async () => {
    const pngBuf = makePngBuffer();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, match: null }),
      }),
    );

    const result = await faceSearch(pngBuf);

    expect(result.matches).toEqual([]);
  });

  it('should return empty matches when matched member is soft-deleted', async () => {
    const jpegBuf = makeJpegBuffer();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          match: { member_id: 'deleted-member', confidence: 0.9, embedding_id: 'emb-1' },
        }),
      }),
    );

    // findFirst returns null because member has deletedAt set (WHERE deletedAt: null)
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce(null as never);

    const result = await faceSearch(jpegBuf);

    expect(result.matches).toEqual([]);
  });
});

// ─── faceSearch — error cases ─────────────────────────────────────────────────

describe('faceSearch — error: image too large', () => {
  it('should throw SearchError with 413 when image exceeds 5 MB', async () => {
    const tooBig = Buffer.alloc(5 * 1024 * 1024 + 1);
    // Add JPEG magic bytes so size check is the only failure
    tooBig[0] = 0xff;
    tooBig[1] = 0xd8;
    tooBig[2] = 0xff;

    await expect(faceSearch(tooBig)).rejects.toMatchObject({
      statusCode: 413,
      code: 'IMAGE_TOO_LARGE',
    });
  });
});

describe('faceSearch — error: bad MIME type', () => {
  it('should throw SearchError with 415 when image is not JPEG or PNG', async () => {
    const fakePdf = Buffer.from('%PDF-1.4 fake content here');

    await expect(faceSearch(fakePdf)).rejects.toMatchObject({
      statusCode: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('should throw 415 for a buffer that is too short to contain magic bytes', async () => {
    const tiny = Buffer.from([0xff, 0xd8]); // Only 2 bytes — incomplete JPEG

    await expect(faceSearch(tiny)).rejects.toMatchObject({
      statusCode: 415,
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });
});

describe('faceSearch — error: upstream down', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('should throw SearchError with 502 when face service is unreachable', async () => {
    const jpegBuf = makeJpegBuffer();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new Error('connect ECONNREFUSED')),
    );

    await expect(faceSearch(jpegBuf)).rejects.toMatchObject({
      statusCode: 502,
      code: 'FACE_SERVICE_UNAVAILABLE',
    });
  });

  it('should throw SearchError with 502 when face service returns a non-2xx status', async () => {
    const jpegBuf = makeJpegBuffer();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 503,
      }),
    );

    await expect(faceSearch(jpegBuf)).rejects.toMatchObject({
      statusCode: 502,
      code: 'FACE_SERVICE_ERROR',
    });
  });
});
