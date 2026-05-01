import type {
  MemberNote,
  FamilyLink,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type {
  AttendanceQuery,
  PaymentsQuery,
  AuditLogQuery,
} from './profile.types.js';

// ─── Error class ──────────────────────────────────────────────────────────────

export class ProfileError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'ProfileError';
  }
}

// ─── Pagination helper type ───────────────────────────────────────────────────

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
};

// ─── Serialization helpers ────────────────────────────────────────────────────

type RawProfile = NonNullable<Awaited<ReturnType<typeof fetchRawProfile>>>;

function toISODateString(d: Date | null | undefined): string | null {
  if (!d) return null;
  // Date-only fields (Prisma @db.Date) come back as midnight UTC Date objects
  return d.toISOString().split('T')[0];
}

function toISOString(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString();
}

function serializeProfile(
  member: RawProfile,
  balance: number,
  totalAttendance: number,
  documentsStatus: { valid: number; expired: number; pending: number },
) {
  const contactLabelMap: Record<string, string> = {
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
  };

  return {
    id: member.id,
    type: member.type,
    firstNameLatin: member.firstNameLatin,
    lastNameLatin: member.lastNameLatin,
    firstNameArabic: member.firstNameArabic,
    lastNameArabic: member.lastNameArabic,
    gender: member.gender,
    dateOfBirth: toISODateString(member.dateOfBirth),
    placeOfBirth: member.placeOfBirth,
    photoPath: member.photoPath,
    status: member.status,
    createdAt: member.createdAt.toISOString(),

    contacts: member.contacts.map((c) => ({
      id: c.id,
      type: c.type,
      value: c.value,
      label: contactLabelMap[c.type] ?? c.type,
      isPrimary: c.isPrimary,
    })),

    emergencyContacts: member.emergencyContacts.map((ec) => ({
      id: ec.id,
      name: ec.name,
      phone: ec.phone,
      relationship: ec.relationship,
    })),

    disciplines: member.disciplines.map((md) => ({
      id: md.id,
      disciplineId: md.disciplineId,
      disciplineName: md.discipline.name,
      instructorName: null as string | null, // instructor relation not loaded; extend if needed
      beltRank: md.beltRank,
      enrollmentDate: toISODateString(md.enrollmentDate) ?? '',
      status: md.status,
      schedules: md.schedules.map((s) => ({
        id: s.id,
        dayOfWeek: s.timeSlot.dayOfWeek,
        startTime: s.timeSlot.startTime,
        endTime: s.timeSlot.endTime,
      })),
    })),

    documents: member.documents.map((doc) => ({
      id: doc.id,
      type: doc.type,
      status: doc.status as 'valid' | 'expired' | 'pending',
      issueDate: toISODateString(doc.issueDate),
      expiryDate: toISODateString(doc.expiryDate),
      notes: null as string | null,
    })),

    subscriptions: member.subscriptions.map((sub) => ({
      id: sub.id,
      planName: sub.planType,
      startDate: toISODateString(sub.startDate) ?? '',
      endDate: toISODateString(sub.endDate),
      status: sub.status,
      autoRenew: sub.autoRenew,
      price: sub.amount,
    })),

    equipmentPurchases: member.equipmentPurchases.map((ep) => ({
      id: ep.id,
      equipmentName: ep.equipment.name,
      quantity: ep.quantity,
      unitPrice: ep.equipment.price,
      purchaseDate: toISODateString(ep.purchaseDate) ?? '',
      paymentReceiptNo: ep.payment?.receiptNumber ?? null,
    })),

    familyLinks: member.familyLinks.map((fl) => ({
      id: fl.id,
      relatedMemberId: fl.relatedMemberId,
      relatedMemberName: [fl.relatedMember.firstNameLatin, fl.relatedMember.lastNameLatin]
        .filter(Boolean)
        .join(' '),
      relatedMemberPhoto: fl.relatedMember.photoPath,
      relationship: fl.relationship,
    })),

    payments: member.payments.map((p) => ({
      id: p.id,
      receiptNo: p.receiptNumber,
      date: p.createdAt.toISOString(),
      total: p.totalAmount,
      paid: p.paidAmount,
      remaining: p.remaining,
      type: p.paymentType,
      items: p.items.map((i) => ({
        id: i.id,
        description: i.description,
        amount: i.amount,
      })),
    })),

    notes: member.notes.map((n) => ({
      id: n.id,
      content: n.content,
      creatorName: n.creator?.fullNameLatin ?? 'Unknown',
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),

    recentAttendance: member.attendanceRecords.map((ar) => ({
      id: ar.id,
      date: toISODateString(ar.checkInTime) ?? '',
      timeIn: toISOString(ar.checkInTime),
      timeOut: toISOString(ar.checkOutTime),
      disciplineName: ar.discipline?.name ?? '',
      method: ar.method,
      status: 'present' as 'present' | 'absent' | 'excused',
    })),

    balance,
    totalAttendance,
    documentsStatus,
  };
}

// ─── Internal raw fetcher (typed for serializeProfile) ───────────────────────

async function fetchRawProfile(memberId: string) {
  return prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    include: {
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
      subscriptions: {
        where: { deletedAt: null },
        include: { discipline: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      },
      equipmentPurchases: {
        where: { deletedAt: null },
        include: {
          equipment: true,
          payment: { select: { receiptNumber: true } },
        },
        orderBy: { purchaseDate: 'desc' },
      },
      familyLinks: {
        where: { deletedAt: null },
        include: {
          relatedMember: {
            select: {
              id: true,
              firstNameLatin: true,
              lastNameLatin: true,
              photoPath: true,
            },
          },
        },
      },
      payments: {
        where: { deletedAt: null },
        include: {
          items: { where: { deletedAt: null } },
        },
        orderBy: { createdAt: 'desc' },
      },
      notes: {
        where: { deletedAt: null },
        include: {
          creator: {
            select: { id: true, fullNameLatin: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      attendanceRecords: {
        where: { deletedAt: null },
        include: { discipline: { select: { id: true, name: true } } },
        orderBy: { checkInTime: 'desc' },
        take: 30,
      },
    },
  });
}

// ─── getFullProfile ───────────────────────────────────────────────────────────

export async function getFullProfile(memberId: string) {
  const member = await fetchRawProfile(memberId);

  if (!member) {
    throw new ProfileError('NOT_FOUND', 'Member not found', 404);
  }

  // Computed fields
  const balance = member.payments.reduce(
    (sum, p) => sum + (p.remaining > 0 ? p.remaining : 0),
    0,
  );

  const totalAttendance = await prisma.attendanceRecord.count({
    where: { memberId, deletedAt: null },
  });

  const documentsStatus = {
    valid: member.documents.filter((d) => d.status === 'valid').length,
    expired: member.documents.filter((d) => d.status === 'expired').length,
    pending: member.documents.filter((d) => d.status === 'pending').length,
  };

  return serializeProfile(member, balance, totalAttendance, documentsStatus);
}

// ─── getAttendance ────────────────────────────────────────────────────────────

export async function getAttendance(
  memberId: string,
  filters: AttendanceQuery,
): Promise<PaginatedResult<unknown>> {
  // Ensure member exists
  const memberExists = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: { id: true },
  });
  if (!memberExists) {
    throw new ProfileError('NOT_FOUND', 'Member not found', 404);
  }

  const { page, limit, month, year, disciplineId } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.AttendanceRecordWhereInput = {
    memberId,
    deletedAt: null,
  };

  if (disciplineId) {
    where.disciplineId = disciplineId;
  }

  if (year !== undefined || month !== undefined) {
    const now = new Date();
    const targetYear = year ?? now.getUTCFullYear();
    const targetMonth = month ?? (now.getUTCMonth() + 1);

    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const endDate = new Date(Date.UTC(targetYear, targetMonth, 1));

    where.checkInTime = {
      gte: startDate,
      lt: endDate,
    };
  }

  const [records, total] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where,
      include: {
        discipline: { select: { id: true, name: true } },
      },
      orderBy: { checkInTime: 'desc' },
      skip,
      take: limit,
    }),
    prisma.attendanceRecord.count({ where }),
  ]);

  const formatTime = (d: Date | null): string | null =>
    d ? d.toISOString().slice(11, 16) : null;

  const data = records.map((r) => ({
    id: r.id,
    date: r.checkInTime.toISOString(),
    timeIn: formatTime(r.checkInTime),
    timeOut: formatTime(r.checkOutTime),
    disciplineName: r.discipline?.name ?? '—',
    method: r.method,
    status: 'present' as const,
  }));

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── getPayments ──────────────────────────────────────────────────────────────

export async function getPayments(
  memberId: string,
  filters: PaymentsQuery,
): Promise<PaginatedResult<unknown>> {
  const memberExists = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: { id: true },
  });
  if (!memberExists) {
    throw new ProfileError('NOT_FOUND', 'Member not found', 404);
  }

  const { page, limit, type, startDate, endDate } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.PaymentWhereInput = {
    memberId,
    deletedAt: null,
  };

  if (type) {
    where.paymentType = type;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      (where.createdAt as Prisma.DateTimeFilter).gte = new Date(startDate);
    }
    if (endDate) {
      (where.createdAt as Prisma.DateTimeFilter).lte = new Date(endDate);
    }
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        items: { where: { deletedAt: null } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  const data = payments.map((p) => ({
    id: p.id,
    receiptNo: p.receiptNumber,
    date: p.createdAt.toISOString(),
    total: p.totalAmount,
    paid: p.paidAmount,
    remaining: p.remaining,
    type: p.paymentType,
    items: p.items.map((i) => ({
      id: i.id,
      description: i.description,
      amount: i.amount,
    })),
  }));

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── getAuditLog ──────────────────────────────────────────────────────────────

// Tables related to a member record
const MEMBER_RELATED_TABLES = [
  'members',
  'member_contacts',
  'emergency_contacts',
  'member_disciplines',
  'documents',
  'subscriptions',
  'payments',
  'payment_items',
  'member_equipment',
  'attendance_records',
  'family_links',
  'member_notes',
];

export async function getAuditLog(
  memberId: string,
  filters: AuditLogQuery,
): Promise<PaginatedResult<unknown>> {
  const memberExists = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: { id: true },
  });
  if (!memberExists) {
    throw new ProfileError('NOT_FOUND', 'Member not found', 404);
  }

  const { page, limit, userId, tableName } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.AuditLogWhereInput = {
    OR: [
      { recordId: memberId },
      {
        tableName: { in: MEMBER_RELATED_TABLES },
        recordId: memberId,
      },
    ],
  };

  if (tableName) {
    where.tableName = tableName;
    // When filtering by specific tableName, only filter by recordId
    where.OR = undefined;
    where.recordId = memberId;
  }

  if (userId) {
    where.userId = userId;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullNameLatin: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    data: logs,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function createNote(
  memberId: string,
  content: string,
  userId: string,
): Promise<MemberNote & { creator: { id: string; fullNameLatin: string } | null }> {
  const memberExists = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
    select: { id: true },
  });
  if (!memberExists) {
    throw new ProfileError('NOT_FOUND', 'Member not found', 404);
  }

  const note = await prisma.memberNote.create({
    data: {
      memberId,
      content,
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      creator: {
        select: { id: true, fullNameLatin: true },
      },
    },
  });

  return note;
}

export async function updateNote(
  memberId: string,
  noteId: string,
  content: string,
  userId: string,
): Promise<MemberNote & { creator: { id: string; fullNameLatin: string } | null }> {
  const note = await prisma.memberNote.findFirst({
    where: { id: noteId, memberId, deletedAt: null },
  });
  if (!note) {
    throw new ProfileError('NOT_FOUND', 'Note not found', 404);
  }

  if (note.createdBy !== userId) {
    throw new ProfileError('FORBIDDEN', 'Only the note creator can edit this note', 403);
  }

  const updated = await prisma.memberNote.update({
    where: { id: noteId },
    data: {
      content,
      updatedBy: userId,
    },
    include: {
      creator: {
        select: { id: true, fullNameLatin: true },
      },
    },
  });

  return updated;
}

export async function deleteNote(
  memberId: string,
  noteId: string,
  _userId: string,
): Promise<void> {
  const note = await prisma.memberNote.findFirst({
    where: { id: noteId, memberId, deletedAt: null },
  });
  if (!note) {
    throw new ProfileError('NOT_FOUND', 'Note not found', 404);
  }

  await prisma.memberNote.update({
    where: { id: noteId },
    data: { deletedAt: new Date() },
  });
}

// ─── Family links ─────────────────────────────────────────────────────────────

function getInverseRelationship(relationship: string): string {
  const lower = relationship.toLowerCase().trim();
  const inverses: Record<string, string> = {
    parent: 'child',
    child: 'parent',
    father: 'child',
    mother: 'child',
    son: 'parent',
    daughter: 'parent',
    brother: 'brother',
    sister: 'sister',
    sibling: 'sibling',
    spouse: 'spouse',
    husband: 'wife',
    wife: 'husband',
    cousin: 'cousin',
    uncle: 'nephew/niece',
    aunt: 'nephew/niece',
    nephew: 'uncle/aunt',
    niece: 'uncle/aunt',
    'nephew/niece': 'uncle/aunt',
    'uncle/aunt': 'nephew/niece',
    grandparent: 'grandchild',
    grandchild: 'grandparent',
  };
  return inverses[lower] ?? relationship;
}

export async function createFamilyLink(
  memberId: string,
  relatedMemberId: string,
  relationship: string,
  _userId: string,
): Promise<FamilyLink & { relatedMember: { id: string; firstNameLatin: string | null; lastNameLatin: string | null; firstNameArabic: string | null; lastNameArabic: string | null; photoPath: string | null; status: string } }> {
  if (memberId === relatedMemberId) {
    throw new ProfileError('VALIDATION_ERROR', 'Cannot create family link to self', 422);
  }

  const [member, relatedMember] = await Promise.all([
    prisma.member.findFirst({ where: { id: memberId, deletedAt: null }, select: { id: true } }),
    prisma.member.findFirst({
      where: { id: relatedMemberId, deletedAt: null },
      select: {
        id: true,
        firstNameLatin: true,
        lastNameLatin: true,
        firstNameArabic: true,
        lastNameArabic: true,
        photoPath: true,
        status: true,
      },
    }),
  ]);

  if (!member) {
    throw new ProfileError('NOT_FOUND', 'Member not found', 404);
  }
  if (!relatedMember) {
    throw new ProfileError('NOT_FOUND', 'Related member not found', 404);
  }

  const inverseRelationship = getInverseRelationship(relationship);

  const link = await prisma.$transaction(async (tx) => {
    const forward = await tx.familyLink.upsert({
      where: {
        memberId_relatedMemberId: { memberId, relatedMemberId },
      },
      update: {
        relationship,
        deletedAt: null,
      },
      create: {
        memberId,
        relatedMemberId,
        relationship,
      },
    });

    await tx.familyLink.upsert({
      where: {
        memberId_relatedMemberId: {
          memberId: relatedMemberId,
          relatedMemberId: memberId,
        },
      },
      update: {
        relationship: inverseRelationship,
        deletedAt: null,
      },
      create: {
        memberId: relatedMemberId,
        relatedMemberId: memberId,
        relationship: inverseRelationship,
      },
    });

    return forward;
  });

  return {
    ...link,
    relatedMember,
  };
}

export async function deleteFamilyLink(
  memberId: string,
  linkId: string,
  _userId: string,
): Promise<void> {
  const link = await prisma.familyLink.findFirst({
    where: { id: linkId, memberId, deletedAt: null },
  });
  if (!link) {
    throw new ProfileError('NOT_FOUND', 'Family link not found', 404);
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // Soft delete the forward link
    await tx.familyLink.update({
      where: { id: linkId },
      data: { deletedAt: now },
    });

    // Soft delete the reverse link
    await tx.familyLink.updateMany({
      where: {
        memberId: link.relatedMemberId,
        relatedMemberId: memberId,
        deletedAt: null,
      },
      data: { deletedAt: now },
    });
  });
}
