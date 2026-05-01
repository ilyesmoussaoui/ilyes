import { prisma } from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';
import type {
  GlobalSearchQuery,
  GlobalSearchResponse,
  FaceSearchResponse,
  MemberResult,
  PaymentResult,
  ProductResult,
  FaceMatchResult,
} from './search.schema.js';

// ─── Magic-byte MIME detection ────────────────────────────────────────────────

/**
 * Checks the first bytes of the buffer to determine if it is a valid
 * JPEG or PNG image, regardless of the Content-Type header.
 */
function detectImageMime(buf: Buffer): 'image/jpeg' | 'image/png' | null {
  // JPEG: FF D8 FF
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  return null;
}

// ─── globalSearch ─────────────────────────────────────────────────────────────

const SEARCH_LIMIT = 10;

export async function globalSearch(query: GlobalSearchQuery): Promise<GlobalSearchResponse> {
  const { q, scope } = query;
  const term = q.trim();

  const includeMembers = scope === 'all' || scope === 'members';
  const includePayments = scope === 'all' || scope === 'payments';
  const includeProducts = scope === 'all' || scope === 'products';

  const [members, payments, products] = await Promise.all([
    includeMembers ? searchMembers(term) : Promise.resolve<MemberResult[]>([]),
    includePayments ? searchPayments(term) : Promise.resolve<PaymentResult[]>([]),
    includeProducts ? searchProducts(term) : Promise.resolve<ProductResult[]>([]),
  ]);

  return { members, payments, products };
}

async function searchMembers(term: string): Promise<MemberResult[]> {
  const rows = await prisma.member.findMany({
    where: {
      deletedAt: null,
      OR: [
        { firstNameLatin: { contains: term, mode: 'insensitive' } },
        { lastNameLatin: { contains: term, mode: 'insensitive' } },
        { firstNameArabic: { contains: term, mode: 'insensitive' } },
        { lastNameArabic: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
      photoPath: true,
    },
    take: SEARCH_LIMIT,
    orderBy: { createdAt: 'desc' },
  });

  return rows;
}

async function searchPayments(term: string): Promise<PaymentResult[]> {
  const rows = await prisma.payment.findMany({
    where: {
      deletedAt: null,
      OR: [
        { receiptNumber: { startsWith: term, mode: 'insensitive' } },
        {
          member: {
            deletedAt: null,
            OR: [
              { firstNameLatin: { contains: term, mode: 'insensitive' } },
              { lastNameLatin: { contains: term, mode: 'insensitive' } },
              { firstNameArabic: { contains: term, mode: 'insensitive' } },
              { lastNameArabic: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
      ],
    },
    select: {
      id: true,
      receiptNumber: true,
      paidAmount: true,
      createdAt: true,
      memberId: true,
      member: {
        select: {
          firstNameLatin: true,
          lastNameLatin: true,
        },
      },
    },
    take: SEARCH_LIMIT,
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    receiptNumber: r.receiptNumber,
    amount: r.paidAmount,
    paidAt: r.createdAt.toISOString(),
    memberId: r.memberId,
    memberName: [r.member.firstNameLatin, r.member.lastNameLatin].filter(Boolean).join(' '),
  }));
}

async function searchProducts(term: string): Promise<ProductResult[]> {
  const rows = await prisma.equipment.findMany({
    where: {
      deletedAt: null,
      name: { contains: term, mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      stockQuantity: true,
      price: true,
    },
    take: SEARCH_LIMIT,
    orderBy: { name: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    stockQuantity: r.stockQuantity,
    priceCents: r.price,
  }));
}

// ─── faceSearch ───────────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export class SearchError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export async function faceSearch(imageBuffer: Buffer): Promise<FaceSearchResponse> {
  // Size guard (belt-and-suspenders — multipart plugin already enforces this,
  // but we validate again at service level so the service is testable standalone).
  if (imageBuffer.length > MAX_IMAGE_BYTES) {
    throw new SearchError(413, 'IMAGE_TOO_LARGE', 'Image must not exceed 5 MB');
  }

  // Magic-byte MIME validation.
  const mime = detectImageMime(imageBuffer);
  if (mime === null) {
    throw new SearchError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Image must be JPEG or PNG');
  }

  const env = getEnv();
  const imageBase64 = imageBuffer.toString('base64');

  // Call face service.
  let faceResponse: Response;
  try {
    faceResponse = await fetch(`${env.FACE_SERVICE_URL}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, threshold: env.FACE_MATCH_THRESHOLD }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new SearchError(502, 'FACE_SERVICE_UNAVAILABLE', 'Face recognition service is unreachable');
  }

  if (!faceResponse.ok) {
    throw new SearchError(502, 'FACE_SERVICE_ERROR', 'Face recognition service returned an error');
  }

  // Parse the face-service response. The service returns:
  //   { success: bool, match: { member_id, confidence, embedding_id } | null, error?, hint? }
  let body: unknown;
  try {
    body = await faceResponse.json();
  } catch {
    throw new SearchError(502, 'FACE_SERVICE_ERROR', 'Face recognition service returned invalid JSON');
  }

  const parsed = body as {
    success: boolean;
    match: { member_id: string; confidence: number; embedding_id: string } | null;
    error?: string;
    hint?: string;
  };

  // Service reported a non-success (e.g. edge-case: no face detected, blurry, etc.)
  // Return empty matches — not an error from the caller's perspective.
  if (!parsed.success || parsed.match === null) {
    return { matches: [] };
  }

  const { member_id, confidence } = parsed.match;

  // Hydrate member from DB; skip if soft-deleted.
  const member = await prisma.member.findFirst({
    where: { id: member_id, deletedAt: null },
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      photoPath: true,
    },
  });

  if (!member) {
    // Match found but member was deleted — return empty.
    return { matches: [] };
  }

  const result: FaceMatchResult = {
    memberId: member.id,
    confidence,
    member: {
      firstNameLatin: member.firstNameLatin,
      lastNameLatin: member.lastNameLatin,
      photoPath: member.photoPath,
    },
  };

  return { matches: [result] };
}
