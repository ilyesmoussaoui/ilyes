import { prisma } from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';
import { dispatchCheckinAlerts } from '../sms/attendance-alerts.js';
import type {
  KioskAlert,
  FaceMatchResponse,
  FaceServiceHealthResponse,
} from './kiosk.types.js';

// ─── Structured no-match response returned to callers ───────────────────────

type NoMatchResponse = {
  matched: false;
  confidence: number;
  reason: 'no_face' | 'no_match' | 'low_confidence';
};

// ─── Error class ─────────────────────────────────────────────────────────────

export class KioskError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'KioskError';
  }
}

// ─── Shared member select for kiosk responses ───────────────────────────────

const kioskMemberSelect = {
  id: true,
  firstNameLatin: true,
  lastNameLatin: true,
  firstNameArabic: true,
  lastNameArabic: true,
  photoPath: true,
  status: true,
  disciplines: {
    where: { deletedAt: null, status: 'active' as const },
    select: {
      discipline: {
        select: { id: true, name: true },
      },
    },
  },
} as const;

// ─── Transform member for kiosk response ────────────────────────────────────

function transformKioskMember(member: {
  id: string;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  photoPath: string | null;
  status: string;
  disciplines: Array<{ discipline: { id: string; name: string } }>;
}) {
  return {
    id: member.id,
    firstNameLatin: member.firstNameLatin ?? '',
    lastNameLatin: member.lastNameLatin ?? '',
    firstNameArabic: member.firstNameArabic ?? '',
    lastNameArabic: member.lastNameArabic ?? '',
    photoPath: member.photoPath,
    status: member.status,
    disciplines: member.disciplines.map((d) => d.discipline.name),
  };
}

// ─── Attendance include for check-in response ───────────────────────────────

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

// ─── Alert checks ───────────────────────────────────────────────────────────

async function checkExpiredAlert(memberId: string): Promise<KioskAlert | null> {
  const activeSubscription = await prisma.subscription.findFirst({
    where: {
      memberId,
      deletedAt: null,
      status: 'active',
    },
  });

  if (!activeSubscription) {
    return {
      type: 'expired',
      message: 'No active subscription found. All subscriptions are expired or cancelled.',
    };
  }

  return null;
}

async function checkUnpaidAlert(memberId: string): Promise<KioskAlert | null> {
  const payments = await prisma.payment.findMany({
    where: {
      memberId,
      deletedAt: null,
      remaining: { gt: 0 },
    },
    select: {
      remaining: true,
    },
  });

  if (payments.length > 0) {
    const totalRemaining = payments.reduce((sum, p) => sum + p.remaining, 0);
    return {
      type: 'unpaid',
      message: `Outstanding balance: ${(totalRemaining / 100).toFixed(2)} DZD`,
      totalRemaining,
    };
  }

  return null;
}

async function checkExpiringSoonAlert(memberId: string): Promise<KioskAlert | null> {
  const now = new Date();
  const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  const expiringSub = await prisma.subscription.findFirst({
    where: {
      memberId,
      deletedAt: null,
      status: 'active',
      endDate: {
        gte: now,
        lte: fourDaysFromNow,
      },
    },
    select: {
      id: true,
      endDate: true,
      discipline: { select: { name: true } },
    },
  });

  if (expiringSub) {
    const daysLeft = Math.ceil(
      (expiringSub.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
    );
    return {
      type: 'expiring_soon',
      message: `Subscription for ${expiringSub.discipline.name} expires in ${daysLeft} day(s)`,
      subscriptionId: expiringSub.id,
      endDate: expiringSub.endDate.toISOString(),
      daysLeft,
    };
  }

  return null;
}

async function checkDuplicateCheckinAlert(memberId: string): Promise<KioskAlert | null> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );

  const existingCheckin = await prisma.attendanceRecord.findFirst({
    where: {
      memberId,
      deletedAt: null,
      checkInTime: { gte: startOfDay, lte: endOfDay },
      checkOutTime: null,
    },
    select: {
      id: true,
      checkInTime: true,
    },
    orderBy: { checkInTime: 'desc' },
  });

  if (existingCheckin) {
    return {
      type: 'duplicate_checkin',
      message: `Already checked in today at ${existingCheckin.checkInTime.toISOString()}`,
      existingRecordId: existingCheckin.id,
      checkInTime: existingCheckin.checkInTime.toISOString(),
    };
  }

  return null;
}

async function checkConsecutiveAbsenceAlert(memberId: string): Promise<KioskAlert | null> {
  // Check if member has active enrollments
  const activeEnrollments = await prisma.memberDiscipline.findFirst({
    where: {
      memberId,
      deletedAt: null,
      status: 'active',
    },
  });

  if (!activeEnrollments) {
    return null; // No active enrollments, skip this check
  }

  // Check attendance in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentAttendance = await prisma.attendanceRecord.count({
    where: {
      memberId,
      deletedAt: null,
      checkInTime: { gte: sevenDaysAgo },
    },
  });

  if (recentAttendance === 0) {
    return {
      type: 'consecutive_absence',
      message: 'No attendance records in the last 7 days',
      daysSinceLastVisit: 7,
    };
  }

  return null;
}

export async function getAlertsForMember(memberId: string): Promise<KioskAlert[]> {
  const alertResults = await Promise.all([
    checkExpiredAlert(memberId),
    checkUnpaidAlert(memberId),
    checkExpiringSoonAlert(memberId),
    checkDuplicateCheckinAlert(memberId),
    checkConsecutiveAbsenceAlert(memberId),
  ]);

  return alertResults.filter((a): a is KioskAlert => a !== null);
}

// ─── Face service HTTP calls ────────────────────────────────────────────────

// Extended result type that carries face-detection failure reason
type FaceMatchCallResult =
  | { matched: true; memberId: string; confidence: number; embeddingId: string }
  | { matched: false; reason: 'no_face' | 'no_match' };

export async function callFaceMatch(imageBase64: string): Promise<FaceMatchCallResult> {
  const env = getEnv();
  const url = `${env.FACE_SERVICE_URL}/match`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64 }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new KioskError(
      'FACE_SERVICE_UNAVAILABLE',
      'Face recognition service is unavailable',
      503,
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new KioskError(
      'FACE_SERVICE_ERROR',
      `Face service returned status ${response.status}: ${text}`,
      502,
    );
  }

  const data = (await response.json()) as FaceMatchResponse;

  // Face service returned a detection error (no face, multiple faces, poor lighting, etc.)
  // Return a structured no-match result instead of throwing — this is an expected outcome.
  if (!data.success) {
    return { matched: false, reason: 'no_face' };
  }

  // No match found in the database
  if (data.match === null) {
    return { matched: false, reason: 'no_match' };
  }

  // Successful match — map to clean internal shape
  return {
    matched: true,
    memberId: data.match.member_id,
    confidence: data.match.confidence,
    embeddingId: data.match.embedding_id,
  };
}

export async function callFaceServiceHealth(): Promise<FaceServiceHealthResponse> {
  const env = getEnv();
  const url = `${env.FACE_SERVICE_URL}/health`;

  const start = Date.now();
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return { online: false, latencyMs: null };
  }

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    return { online: false, latencyMs: null };
  }

  const data = (await response.json()) as { status?: string };
  return {
    online: data.status !== 'offline',
    latencyMs,
  };
}

export async function enrollFaceAsync(
  memberId: string,
  imageBase64: string,
): Promise<void> {
  const env = getEnv();
  const url = `${env.FACE_SERVICE_URL}/enroll`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, image_base64: imageBase64 }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'Unknown error');
      console.error(
        `[kiosk] Face enrollment failed for member ${memberId}: status ${response.status} - ${text}`,
      );
    }
  } catch (err) {
    console.error(
      `[kiosk] Face enrollment request failed for member ${memberId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ─── Match member by face ───────────────────────────────────────────────────

export async function matchMemberByFace(
  imageBase64: string,
): Promise<NoMatchResponse | {
  matched: true;
  confidence: number;
  member: ReturnType<typeof transformKioskMember>;
  canAutoCheckIn: boolean;
  subscriptionStatus: 'expired' | 'active' | 'none';
  expiryDate: string | null;
  outstandingBalance: number;
  alreadyCheckedIn: boolean;
  lastCheckInTime: string | null;
  alerts: KioskAlert[];
}> {
  const env = getEnv();

  const faceResult = await callFaceMatch(imageBase64);

  // callFaceMatch only throws for actual service failures (network/HTTP errors).
  // Detection failures and no-match cases are returned as structured results.
  if (!faceResult.matched) {
    return { matched: false, confidence: 0, reason: faceResult.reason };
  }

  // Below-threshold confidence: return structured no-match instead of proceeding
  if (faceResult.confidence < env.FACE_MATCH_THRESHOLD) {
    return { matched: false, confidence: faceResult.confidence, reason: 'low_confidence' };
  }

  const member = await prisma.member.findFirst({
    where: { id: faceResult.memberId, deletedAt: null },
    select: kioskMemberSelect,
  });

  if (!member) {
    throw new KioskError('MEMBER_NOT_FOUND', 'Matched member not found in database', 404);
  }

  const alerts = await getAlertsForMember(member.id);

  // ─── Derive flattened fields from alerts ──────────────────────────────────

  const expiredAlert = alerts.find((a) => a.type === 'expired');
  const unpaidAlert = alerts.find((a) => a.type === 'unpaid');
  const duplicateAlert = alerts.find((a) => a.type === 'duplicate_checkin');

  // subscriptionStatus: 'expired' | 'active' | 'none'
  let subscriptionStatus: 'expired' | 'active' | 'none';
  if (expiredAlert) {
    subscriptionStatus = 'expired';
  } else {
    // If no expired alert, check for any active subscription
    const activeSub = await prisma.subscription.findFirst({
      where: { memberId: member.id, deletedAt: null, status: 'active' },
      select: { id: true },
    });
    subscriptionStatus = activeSub ? 'active' : 'none';
  }

  // expiryDate: nearest active subscription endDate
  let expiryDate: string | null = null;
  if (subscriptionStatus === 'active') {
    const nearestSub = await prisma.subscription.findFirst({
      where: { memberId: member.id, deletedAt: null, status: 'active' },
      orderBy: { endDate: 'asc' },
      select: { endDate: true },
    });
    expiryDate = nearestSub?.endDate.toISOString() ?? null;
  }

  // outstandingBalance: from unpaid alert or 0
  const outstandingBalance =
    unpaidAlert && typeof unpaidAlert.totalRemaining === 'number'
      ? unpaidAlert.totalRemaining
      : 0;

  // alreadyCheckedIn + lastCheckInTime: from duplicate_checkin alert
  const alreadyCheckedIn = !!duplicateAlert;
  const lastCheckInTime =
    duplicateAlert && typeof duplicateAlert.checkInTime === 'string'
      ? duplicateAlert.checkInTime
      : null;

  const hasBlockingAlert = !!(expiredAlert || unpaidAlert || duplicateAlert);

  const canAutoCheckIn =
    faceResult.confidence > env.FACE_MATCH_THRESHOLD &&
    member.status === 'active' &&
    !hasBlockingAlert;

  return {
    matched: true as const,
    confidence: faceResult.confidence,
    member: transformKioskMember(member),
    canAutoCheckIn,
    subscriptionStatus,
    expiryDate,
    outstandingBalance,
    alreadyCheckedIn,
    lastCheckInTime,
    alerts,
  };
}

// ─── Kiosk check-in ─────────────────────────────────────────────────────────

export async function kioskCheckIn(
  memberId: string,
  method: 'face' | 'manual',
  operatorId: string,
  disciplineId?: string,
  confidence?: number,
) {
  // Verify member exists and is not deleted — use kioskMemberSelect to return full data
  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: kioskMemberSelect,
  });
  if (!member) {
    throw new KioskError('NOT_FOUND', 'Member not found', 404);
  }

  // Verify discipline exists if provided
  if (disciplineId) {
    const discipline = await prisma.discipline.findFirst({
      where: { id: disciplineId, deletedAt: null },
    });
    if (!discipline) {
      throw new KioskError('NOT_FOUND', 'Discipline not found', 404);
    }
  }

  const record = await prisma.attendanceRecord.create({
    data: {
      memberId,
      disciplineId: disciplineId ?? null,
      checkInTime: new Date(),
      method,
      device: 'kiosk',
      operatorId,
      notes: confidence !== undefined ? `Face confidence: ${confidence.toFixed(3)}` : null,
    },
    include: attendanceInclude,
  });

  // Fire-and-forget SMS notification (parent/off-schedule) — never blocks kiosk flow.
  void dispatchCheckinAlerts({ memberId, checkInTime: record.checkInTime });

  // Get any alerts for this member
  const alerts = await getAlertsForMember(memberId);

  return {
    record: {
      ...record,
      status: record.checkOutTime ? ('left' as const) : ('present' as const),
    },
    member: transformKioskMember(member),
    alerts,
  };
}

// ─── Search members ─────────────────────────────────────────────────────────

export async function searchMembers(query: string) {
  const members = await prisma.member.findMany({
    where: {
      deletedAt: null,
      OR: [
        { firstNameLatin: { contains: query, mode: 'insensitive' } },
        { lastNameLatin: { contains: query, mode: 'insensitive' } },
        { firstNameArabic: { contains: query, mode: 'insensitive' } },
        { lastNameArabic: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: kioskMemberSelect,
    orderBy: [{ firstNameLatin: 'asc' }, { lastNameLatin: 'asc' }],
    take: 20,
  });

  return members.map(transformKioskMember);
}
