import { promises as fs } from 'node:fs';
import { createReadStream, type ReadStream } from 'node:fs';
import path from 'node:path';
import { enrollFaceAsync } from '../kiosk/kiosk.service.js';
import type {
  Member,
  MemberContact,
  EmergencyContact,
  MemberDiscipline,
  Document,
  Subscription,
  MemberEquipment,
  FamilyLink,
  Payment,
  PaymentItem,
  Schedule,
  TimeSlot,
  Discipline,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { getEnv } from '../../config/env.js';
import { diffToAuditEntries, insertAuditEntries } from '../../lib/audit.js';
import type {
  CreateMemberInput,
  ListMembersQuery,
  MemberScope,
  UpdateMemberInput,
} from './members.types.js';

const FACE_EMBEDDING_SIZE = 512;
const PLACEHOLDER_MODEL_VERSION = 'placeholder-v0';

export class MemberError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'MemberError';
  }
}

export type MemberWithRelations = Member & {
  contacts: MemberContact[];
  emergencyContacts: EmergencyContact[];
};

export type MemberFullRecord = Member & {
  contacts: MemberContact[];
  emergencyContacts: EmergencyContact[];
  disciplines: (MemberDiscipline & {
    discipline: Discipline;
    schedules: (Schedule & { timeSlot: TimeSlot })[];
  })[];
  documents: Document[];
  subscriptions: Subscription[];
  equipmentPurchases: MemberEquipment[];
  familyLinks: FamilyLink[];
  payments: (Payment & { items: PaymentItem[] })[];
};

const memberInclude = {
  contacts: { where: { deletedAt: null } },
  emergencyContacts: { where: { deletedAt: null } },
} satisfies Prisma.MemberInclude;

const memberFullInclude = {
  contacts: { where: { deletedAt: null } },
  emergencyContacts: { where: { deletedAt: null } },
  disciplines: {
    where: { deletedAt: null },
    include: {
      discipline: true,
      schedules: {
        where: { deletedAt: null },
        include: { timeSlot: true },
      },
    },
  },
  documents: { where: { deletedAt: null } },
  subscriptions: { where: { deletedAt: null } },
  equipmentPurchases: { where: { deletedAt: null } },
  familyLinks: { where: { deletedAt: null } },
  payments: {
    where: { deletedAt: null },
    include: { items: { where: { deletedAt: null } } },
  },
} satisfies Prisma.MemberInclude;

function toDateOrNull(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00.000Z`);
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
}

export interface MemberListItem {
  id: string;
  type: string;
  status: string;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  photoPath: string | null;
  createdAt: string;
  disciplines: string[];
}

export interface ListMembersResult {
  members: MemberListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function todayUtcStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function resolveScopeMemberIds(scope: MemberScope): Promise<string[]> {
  const todayStart = todayUtcStart();

  switch (scope) {
    case 'unpaid': {
      const grouped = await prisma.payment.groupBy({
        by: ['memberId'],
        where: {
          deletedAt: null,
          remaining: { gt: 0 },
          member: { deletedAt: null },
        },
        _sum: { remaining: true },
      });
      return grouped.map((g) => g.memberId);
    }

    case 'renewal': {
      const subs = await prisma.subscription.findMany({
        where: {
          deletedAt: null,
          status: 'active',
          endDate: { lt: todayStart },
          member: { deletedAt: null },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      });
      return subs.map((s) => s.memberId);
    }

    case 'expiring': {
      const windowEnd = new Date(todayStart.getTime() + 14 * 24 * 60 * 60 * 1000);
      const subs = await prisma.subscription.findMany({
        where: {
          deletedAt: null,
          status: 'active',
          endDate: { gte: todayStart, lte: windowEnd },
          member: { deletedAt: null },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      });
      return subs.map((s) => s.memberId);
    }

    case 'docs': {
      const requirements = await prisma.documentRequirement.findMany({
        where: { isRequired: true },
        select: { documentType: true, memberTypes: true },
      });
      if (requirements.length === 0) return [];

      const members = await prisma.member.findMany({
        where: { deletedAt: null, status: 'active' },
        select: {
          id: true,
          type: true,
          documents: { where: { deletedAt: null }, select: { type: true } },
        },
      });

      const ids: string[] = [];
      for (const m of members) {
        const uploaded = new Set(m.documents.map((d) => d.type as string));
        const missing = requirements.some(
          (r) =>
            r.memberTypes.includes(m.type as string) &&
            !uploaded.has(r.documentType as string),
        );
        if (missing) ids.push(m.id);
      }
      return ids;
    }

    case 'inactive': {
      const threshold = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);
      const recent = await prisma.attendanceRecord.findMany({
        where: {
          deletedAt: null,
          checkInTime: { gte: threshold },
          member: { deletedAt: null, status: 'active' },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      });
      const recentSet = new Set(recent.map((r) => r.memberId));
      const actives = await prisma.member.findMany({
        where: { deletedAt: null, status: 'active' },
        select: { id: true },
      });
      return actives.filter((m) => !recentSet.has(m.id)).map((m) => m.id);
    }

    case 'absent': {
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
      const checked = await prisma.attendanceRecord.findMany({
        where: {
          deletedAt: null,
          checkInTime: { gte: todayStart, lte: todayEnd },
          member: { deletedAt: null, status: 'active' },
        },
        select: { memberId: true },
        distinct: ['memberId'],
      });
      const checkedSet = new Set(checked.map((r) => r.memberId));
      const actives = await prisma.member.findMany({
        where: { deletedAt: null, status: 'active' },
        select: { id: true },
      });
      return actives.filter((m) => !checkedSet.has(m.id)).map((m) => m.id);
    }
  }
}

export async function listMembers(query: ListMembersQuery): Promise<ListMembersResult> {
  const { search, type, status, scope, page, pageSize } = query;

  const where: Prisma.MemberWhereInput = { deletedAt: null };

  if (type) {
    where.type = type;
  }
  if (status) {
    where.status = status;
  }
  if (search && search.length > 0) {
    where.OR = [
      { firstNameLatin: { contains: search, mode: 'insensitive' } },
      { lastNameLatin: { contains: search, mode: 'insensitive' } },
      { firstNameArabic: { contains: search, mode: 'insensitive' } },
      { lastNameArabic: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (scope) {
    const scopedIds = await resolveScopeMemberIds(scope);
    if (scopedIds.length === 0) {
      return { members: [], total: 0, page, pageSize };
    }
    where.id = { in: scopedIds };
  }

  const [total, rows] = await Promise.all([
    prisma.member.count({ where }),
    prisma.member.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        status: true,
        firstNameLatin: true,
        lastNameLatin: true,
        firstNameArabic: true,
        lastNameArabic: true,
        gender: true,
        dateOfBirth: true,
        photoPath: true,
        createdAt: true,
        disciplines: {
          where: { deletedAt: null },
          select: { discipline: { select: { name: true } } },
        },
      },
    }),
  ]);

  const members: MemberListItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    firstNameLatin: r.firstNameLatin,
    lastNameLatin: r.lastNameLatin,
    firstNameArabic: r.firstNameArabic,
    lastNameArabic: r.lastNameArabic,
    gender: r.gender,
    dateOfBirth: r.dateOfBirth ? r.dateOfBirth.toISOString().split('T')[0]! : null,
    photoPath: r.photoPath,
    createdAt: r.createdAt.toISOString(),
    disciplines: r.disciplines.map((d) => d.discipline.name),
  }));

  return { members, total, page, pageSize };
}

export async function createMember(
  input: CreateMemberInput,
  userId: string,
): Promise<Member> {
  return prisma.member.create({
    data: {
      type: input.type,
      firstNameLatin: emptyToNull(input.firstNameLatin),
      lastNameLatin: emptyToNull(input.lastNameLatin),
      firstNameArabic: emptyToNull(input.firstNameArabic),
      lastNameArabic: emptyToNull(input.lastNameArabic),
      gender: input.gender ?? null,
      dateOfBirth: toDateOrNull(input.dateOfBirth),
      placeOfBirth: emptyToNull(input.placeOfBirth),
      status: 'pending',
      createdBy: userId,
      updatedBy: userId,
    },
  });
}

async function findActiveMember(id: string): Promise<Member | null> {
  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
  });
  return member;
}

export async function getMemberWithRelations(id: string): Promise<MemberWithRelations | null> {
  const member = await prisma.member.findFirst({
    where: { id, deletedAt: null },
    include: memberInclude,
  });
  return member;
}

export async function updateMember(
  id: string,
  input: UpdateMemberInput,
  userId: string,
): Promise<MemberWithRelations> {
  const existing = await findActiveMember(id);
  if (!existing) {
    throw new MemberError('NOT_FOUND', 'Member not found', 404);
  }

  const { contacts, emergencyContacts, ...rest } = input;

  const data: Prisma.MemberUpdateInput = {
    updatedBy: userId,
  };

  // Build a snapshot of the fields we are about to change (for diffing)
  const oldSnapshot: Record<string, unknown> = {};
  const newSnapshot: Record<string, unknown> = {};

  if (rest.firstNameLatin !== undefined) {
    oldSnapshot.firstNameLatin = existing.firstNameLatin;
    newSnapshot.firstNameLatin = emptyToNull(rest.firstNameLatin);
    data.firstNameLatin = newSnapshot.firstNameLatin as string | null;
  }
  if (rest.lastNameLatin !== undefined) {
    oldSnapshot.lastNameLatin = existing.lastNameLatin;
    newSnapshot.lastNameLatin = emptyToNull(rest.lastNameLatin);
    data.lastNameLatin = newSnapshot.lastNameLatin as string | null;
  }
  if (rest.firstNameArabic !== undefined) {
    oldSnapshot.firstNameArabic = existing.firstNameArabic;
    newSnapshot.firstNameArabic = emptyToNull(rest.firstNameArabic);
    data.firstNameArabic = newSnapshot.firstNameArabic as string | null;
  }
  if (rest.lastNameArabic !== undefined) {
    oldSnapshot.lastNameArabic = existing.lastNameArabic;
    newSnapshot.lastNameArabic = emptyToNull(rest.lastNameArabic);
    data.lastNameArabic = newSnapshot.lastNameArabic as string | null;
  }
  if (rest.gender !== undefined) {
    oldSnapshot.gender = existing.gender;
    newSnapshot.gender = rest.gender ?? null;
    data.gender = newSnapshot.gender as 'male' | 'female' | null;
  }
  if (rest.dateOfBirth !== undefined) {
    oldSnapshot.dateOfBirth = existing.dateOfBirth?.toISOString() ?? null;
    newSnapshot.dateOfBirth = toDateOrNull(rest.dateOfBirth)?.toISOString() ?? null;
    data.dateOfBirth = toDateOrNull(rest.dateOfBirth);
  }
  if (rest.placeOfBirth !== undefined) {
    oldSnapshot.placeOfBirth = existing.placeOfBirth;
    newSnapshot.placeOfBirth = emptyToNull(rest.placeOfBirth);
    data.placeOfBirth = newSnapshot.placeOfBirth as string | null;
  }

  return prisma.$transaction(async (tx) => {
    await tx.member.update({ where: { id }, data });

    // Audit scalar field changes
    const auditEntries = diffToAuditEntries('members', id, oldSnapshot, newSnapshot, userId);

    if (contacts !== undefined) {
      await tx.memberContact.deleteMany({ where: { memberId: id } });
      if (contacts.length > 0) {
        await tx.memberContact.createMany({
          data: contacts.map((c) => ({
            memberId: id,
            type: c.type,
            value: c.value,
            isPrimary: c.isPrimary ?? false,
          })),
        });
      }
      auditEntries.push({
        tableName: 'members',
        recordId: id,
        fieldName: 'contacts',
        oldValue: 'replaced',
        newValue: `${contacts.length} contact(s)`,
        userId,
        reason: undefined,
      });
    }

    if (emergencyContacts !== undefined) {
      await tx.emergencyContact.deleteMany({ where: { memberId: id } });
      if (emergencyContacts.length > 0) {
        await tx.emergencyContact.createMany({
          data: emergencyContacts.map((e) => ({
            memberId: id,
            name: e.name,
            phone: e.phone,
            relationship: e.relationship,
          })),
        });
      }
      auditEntries.push({
        tableName: 'members',
        recordId: id,
        fieldName: 'emergency_contacts',
        oldValue: 'replaced',
        newValue: `${emergencyContacts.length} contact(s)`,
        userId,
        reason: undefined,
      });
    }

    await insertAuditEntries(tx, auditEntries);

    const refreshed = await tx.member.findFirst({
      where: { id, deletedAt: null },
      include: memberInclude,
    });
    if (!refreshed) {
      throw new MemberError('NOT_FOUND', 'Member not found after update', 404);
    }
    return refreshed;
  });
}

export type DuplicateMatch = {
  id: string;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  photoPath: string | null;
  dateOfBirth: Date | null;
};

export async function findDuplicates(
  firstName: string,
  lastName: string,
  lang: 'latin' | 'arabic',
): Promise<DuplicateMatch[]> {
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  if (trimmedFirst.length < 2 && trimmedLast.length < 2) {
    return [];
  }

  const firstField = lang === 'arabic' ? 'firstNameArabic' : 'firstNameLatin';
  const lastField = lang === 'arabic' ? 'lastNameArabic' : 'lastNameLatin';

  const where: Prisma.MemberWhereInput = { deletedAt: null };
  const and: Prisma.MemberWhereInput[] = [];
  if (trimmedFirst.length >= 2) {
    and.push({ [firstField]: { not: null } });
    and.push({ [firstField]: { equals: trimmedFirst, mode: 'insensitive' } });
  }
  if (trimmedLast.length >= 2) {
    and.push({ [lastField]: { not: null } });
    and.push({ [lastField]: { equals: trimmedLast, mode: 'insensitive' } });
  }
  where.AND = and;

  const rows = await prisma.member.findMany({
    where,
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
      photoPath: true,
      dateOfBirth: true,
    },
  });

  return rows;
}

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function getPhotosRoot(): string {
  const env = getEnv();
  return path.resolve(env.PHOTOS_DIR);
}

export async function ensurePhotosDir(): Promise<void> {
  const root = getPhotosRoot();
  await fs.mkdir(root, { recursive: true });
}

export type SavePhotoInput = {
  memberId: string;
  mimeType: string;
  bytes: Buffer;
  userId: string;
};

export type SavePhotoResult = {
  photoPath: string;
  photoUrl: string;
};

export async function savePhoto(input: SavePhotoInput): Promise<SavePhotoResult> {
  const { memberId, mimeType, bytes, userId } = input;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new MemberError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Photo must be JPEG, PNG, or WebP',
      415,
    );
  }

  const member = await findActiveMember(memberId);
  if (!member) {
    throw new MemberError('NOT_FOUND', 'Member not found', 404);
  }

  const ext = MIME_TO_EXT[mimeType]!;
  const memberDir = path.join(getPhotosRoot(), memberId);
  await fs.mkdir(memberDir, { recursive: true });

  const filename = `profile-${Date.now()}.${ext}`;
  const absPath = path.join(memberDir, filename);
  await fs.writeFile(absPath, bytes);

  const relPath = path.join(memberId, filename);
  const photoUrl = `/api/v1/files/photos/${memberId}/${filename}`;

  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: memberId },
      data: { photoPath: relPath, updatedBy: userId },
    });
    await tx.faceEmbedding.create({
      data: {
        memberId,
        embeddingVector: Buffer.alloc(FACE_EMBEDDING_SIZE),
        modelVersion: PLACEHOLDER_MODEL_VERSION,
      },
    });
    await insertAuditEntries(tx, [
      {
        tableName: 'members',
        recordId: memberId,
        fieldName: 'photo_path',
        oldValue: member.photoPath ?? null,
        newValue: relPath,
        userId,
        reason: undefined,
      },
    ]);
  });

  // Fire-and-forget: enroll face in the recognition service
  // Do not await — photo save should not be blocked by face enrollment
  const imageBase64 = bytes.toString('base64');
  enrollFaceAsync(memberId, imageBase64).catch((err) => {
    console.error(
      `[members] Background face enrollment failed for member ${memberId}:`,
      err instanceof Error ? err.message : err,
    );
  });

  return { photoPath: relPath, photoUrl };
}

export type PhotoStream = {
  stream: ReadStream;
  contentType: string;
  size: number;
};

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function getPhotoStream(memberId: string, filename: string): Promise<PhotoStream> {
  const root = getPhotosRoot();
  const absPath = path.resolve(path.join(root, memberId, filename));
  const memberRoot = path.resolve(path.join(root, memberId));
  if (!absPath.startsWith(memberRoot + path.sep)) {
    throw new MemberError('NOT_FOUND', 'Photo not found', 404);
  }

  let stat;
  try {
    stat = await fs.stat(absPath);
  } catch {
    throw new MemberError('NOT_FOUND', 'Photo not found', 404);
  }
  if (!stat.isFile()) {
    throw new MemberError('NOT_FOUND', 'Photo not found', 404);
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = EXT_TO_MIME[ext] ?? 'application/octet-stream';
  return {
    stream: createReadStream(absPath),
    contentType,
    size: stat.size,
  };
}

export async function deleteMember(memberId: string, userId: string): Promise<void> {
  const existing = await findActiveMember(memberId);
  if (!existing) {
    throw new MemberError('NOT_FOUND', 'Member not found', 404);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.member.update({
      where: { id: memberId },
      data: { deletedAt: now, updatedBy: userId },
    });

    // Cascade soft-delete to every related table so reports don't keep
    // counting a deleted member's data. Scope to rows where deletedAt is
    // still null so this is idempotent and preserves prior deletion timestamps.
    const notDeleted = { memberId, deletedAt: null };

    await tx.subscription.updateMany({
      where: notDeleted,
      data: { deletedAt: now, updatedBy: userId },
    });
    await tx.attendanceRecord.updateMany({
      where: notDeleted,
      data: { deletedAt: now },
    });
    await tx.payment.updateMany({
      where: notDeleted,
      data: { deletedAt: now, updatedBy: userId },
    });
    await tx.memberDiscipline.updateMany({
      where: notDeleted,
      data: { deletedAt: now },
    });
    await tx.memberEquipment.updateMany({
      where: notDeleted,
      data: { deletedAt: now },
    });
    await tx.familyLink.updateMany({
      where: {
        deletedAt: null,
        OR: [{ memberId }, { relatedMemberId: memberId }],
      },
      data: { deletedAt: now },
    });
    await tx.document.updateMany({
      where: notDeleted,
      data: { deletedAt: now },
    });
    await tx.memberContact.updateMany({
      where: notDeleted,
      data: { deletedAt: now },
    });
    await tx.memberNote.updateMany({
      where: notDeleted,
      data: { deletedAt: now },
    });

    // Schedules are one level down via member_disciplines — cascade through.
    await tx.schedule.updateMany({
      where: {
        deletedAt: null,
        memberDiscipline: { memberId },
      },
      data: { deletedAt: now },
    });

    await insertAuditEntries(tx, [
      {
        tableName: 'members',
        recordId: memberId,
        fieldName: 'deleted_at',
        oldValue: null,
        newValue: now.toISOString(),
        userId,
        reason: undefined,
      },
    ]);
  });
}

export async function finalizeMember(
  memberId: string,
  userId: string,
): Promise<MemberFullRecord> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    include: {
      contacts: { where: { deletedAt: null } },
      disciplines: { where: { deletedAt: null } },
      subscriptions: { where: { deletedAt: null } },
    },
  });

  if (!member) {
    throw new MemberError('NOT_FOUND', 'Member not found', 404);
  }

  // Validation checks
  const errors: string[] = [];

  // Must have latin name
  if (!member.firstNameLatin || !member.lastNameLatin) {
    errors.push('Member must have first and last name (Latin)');
  }

  // Must have gender
  if (!member.gender) {
    errors.push('Member must have gender');
  }

  // Must have date of birth
  if (!member.dateOfBirth) {
    errors.push('Member must have date of birth');
  }

  // Must have at least 1 phone contact
  const phoneContacts = member.contacts.filter((c) => c.type === 'phone');
  if (phoneContacts.length === 0) {
    errors.push('Member must have at least one phone contact');
  }

  // Athletes: must have at least 1 discipline enrollment
  if (member.type === 'athlete' && member.disciplines.length === 0) {
    errors.push('Athlete must be enrolled in at least one discipline');
  }

  // Athletes: must have at least 1 subscription
  if (member.type === 'athlete' && member.subscriptions.length === 0) {
    errors.push('Athlete must have at least one subscription');
  }

  if (errors.length > 0) {
    throw new MemberError('VALIDATION_ERROR', errors.join('; '), 422);
  }

  // Activate member
  await prisma.member.update({
    where: { id: memberId },
    data: { status: 'active', updatedBy: userId },
  });

  // Return full member record
  const fullMember = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    include: memberFullInclude,
  });

  if (!fullMember) {
    throw new MemberError('NOT_FOUND', 'Member not found after update', 404);
  }

  return fullMember;
}
