import type {
  Discipline,
  MemberDiscipline,
  Payment,
  PaymentItem,
  Schedule,
  Subscription,
  Document,
  TimeSlot,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { diffToAuditEntries, insertAuditEntries } from '../../lib/audit.js';
import { generateReceiptNumber } from '../../lib/receiptNumber.js';
import type {
  UpdateEnrollmentInput,
  AddEnrollmentInput,
  UpdateDocumentInput,
  AddDocumentInput,
  UpdateSubscriptionInput,
  RenewSubscriptionInput,
} from './edit.types.js';

export class EditError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'EditError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateOrNull(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00.000Z`);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

const PLAN_DURATION_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
  session_pack: 1,
};

// ─── Types returned to routes ─────────────────────────────────────────────────

export type EnrollmentWithRelations = MemberDiscipline & {
  discipline: Discipline;
  schedules: (Schedule & { timeSlot: TimeSlot })[];
};

export type AddEnrollmentResult = {
  enrollment: EnrollmentWithRelations;
  subscription: Subscription | null;
  payment: (Payment & { items: PaymentItem[] }) | null;
};

// ─── Enrollment operations ────────────────────────────────────────────────────

export async function updateEnrollment(
  memberId: string,
  enrollmentId: string,
  data: UpdateEnrollmentInput,
  userId: string,
): Promise<EnrollmentWithRelations> {
  // Verify membership and enrollment exist
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) throw new EditError('NOT_FOUND', 'Member not found', 404);

  const enrollment = await prisma.memberDiscipline.findFirst({
    where: { id: enrollmentId, memberId, deletedAt: null },
    include: { schedules: { where: { deletedAt: null } } },
  });
  if (!enrollment) throw new EditError('NOT_FOUND', 'Enrollment not found', 404);

  // Validate instructor if provided
  if (data.instructorId !== undefined && data.instructorId !== null) {
    const instructor = await prisma.user.findFirst({
      where: { id: data.instructorId, role: 'coach', isActive: true, deletedAt: null },
    });
    if (!instructor) throw new EditError('VALIDATION_ERROR', 'Instructor not found or not a coach', 422);
  }

  // Validate time slots if schedules are provided
  if (data.schedules !== undefined && data.schedules.length > 0) {
    const timeSlotIds = data.schedules.map((s) => s.timeSlotId);
    const slots = await prisma.timeSlot.findMany({
      where: { id: { in: timeSlotIds }, deletedAt: null, disciplineId: enrollment.disciplineId },
    });
    if (slots.length !== new Set(timeSlotIds).size) {
      throw new EditError(
        'VALIDATION_ERROR',
        'One or more time slots not found or do not belong to this discipline',
        422,
      );
    }
  }

  // Snapshot for audit diff
  const oldSnapshot: Record<string, unknown> = {
    beltRank: enrollment.beltRank,
    instructorId: enrollment.instructorId,
  };
  const newSnapshot: Record<string, unknown> = {};
  if (data.beltRank !== undefined) newSnapshot.beltRank = data.beltRank ?? null;
  if (data.instructorId !== undefined) newSnapshot.instructorId = data.instructorId ?? null;

  await prisma.$transaction(async (tx) => {
    // Update scalar fields
    const updateData: Record<string, unknown> = {};
    if (data.beltRank !== undefined) updateData.beltRank = data.beltRank ?? null;
    if (data.instructorId !== undefined) updateData.instructorId = data.instructorId ?? null;
    if (Object.keys(updateData).length > 0) {
      await tx.memberDiscipline.update({ where: { id: enrollmentId }, data: updateData });
    }

    // Replace schedules if provided
    if (data.schedules !== undefined) {
      await tx.schedule.deleteMany({ where: { memberDisciplineId: enrollmentId } });
      if (data.schedules.length > 0) {
        await tx.schedule.createMany({
          data: data.schedules.map((s) => ({
            memberDisciplineId: enrollmentId,
            dayOfWeek: s.dayOfWeek,
            timeSlotId: s.timeSlotId,
          })),
        });
      }
      newSnapshot.schedules = `${data.schedules.length} schedule(s)`;
      oldSnapshot.schedules = `${enrollment.schedules.length} schedule(s)`;
    }

    const auditEntries = diffToAuditEntries(
      'member_disciplines',
      enrollmentId,
      oldSnapshot,
      newSnapshot,
      userId,
    );
    await insertAuditEntries(tx, auditEntries);
  });

  const updated = await prisma.memberDiscipline.findFirst({
    where: { id: enrollmentId },
    include: {
      discipline: true,
      schedules: { where: { deletedAt: null }, include: { timeSlot: true } },
    },
  });
  if (!updated) throw new EditError('NOT_FOUND', 'Enrollment not found after update', 404);
  return updated;
}

export async function deleteEnrollment(
  memberId: string,
  enrollmentId: string,
  userId: string,
): Promise<void> {
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) throw new EditError('NOT_FOUND', 'Member not found', 404);

  const enrollment = await prisma.memberDiscipline.findFirst({
    where: { id: enrollmentId, memberId, deletedAt: null },
  });
  if (!enrollment) throw new EditError('NOT_FOUND', 'Enrollment not found', 404);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Soft-delete child schedules
    await tx.schedule.updateMany({
      where: { memberDisciplineId: enrollmentId, deletedAt: null },
      data: { deletedAt: now },
    });
    // Soft-delete the enrollment itself
    await tx.memberDiscipline.update({
      where: { id: enrollmentId },
      data: { deletedAt: now, status: 'inactive' },
    });
    await insertAuditEntries(tx, [
      {
        tableName: 'member_disciplines',
        recordId: enrollmentId,
        fieldName: 'deleted_at',
        oldValue: null,
        newValue: now.toISOString(),
        userId,
      },
    ]);
  });
}

export async function addEnrollment(
  memberId: string,
  data: AddEnrollmentInput,
  userId: string,
): Promise<AddEnrollmentResult> {
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) throw new EditError('NOT_FOUND', 'Member not found', 404);

  // Validate discipline
  const discipline = await prisma.discipline.findFirst({
    where: { id: data.disciplineId, deletedAt: null, isActive: true },
  });
  if (!discipline) throw new EditError('VALIDATION_ERROR', 'Discipline not found or inactive', 422);

  // Validate instructor
  if (data.instructorId) {
    const instructor = await prisma.user.findFirst({
      where: { id: data.instructorId, role: 'coach', isActive: true, deletedAt: null },
    });
    if (!instructor) throw new EditError('VALIDATION_ERROR', 'Instructor not found or not a coach', 422);
  }

  // Validate time slots
  if (data.schedules.length > 0) {
    const timeSlotIds = data.schedules.map((s) => s.timeSlotId);
    const slots = await prisma.timeSlot.findMany({
      where: { id: { in: timeSlotIds }, deletedAt: null, disciplineId: data.disciplineId },
    });
    if (slots.length !== new Set(timeSlotIds).size) {
      throw new EditError(
        'VALIDATION_ERROR',
        'One or more time slots not found or do not belong to this discipline',
        422,
      );
    }
  }

  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const { enrollmentId, subscriptionId, paymentId } = await prisma.$transaction(async (tx) => {
    const md = await tx.memberDiscipline.create({
      data: {
        memberId,
        disciplineId: data.disciplineId,
        instructorId: data.instructorId ?? null,
        beltRank: data.beltRank ?? null,
        enrollmentDate: todayDate,
        status: 'active',
      },
    });

    if (data.schedules.length > 0) {
      await tx.schedule.createMany({
        data: data.schedules.map((s) => ({
          memberDisciplineId: md.id,
          dayOfWeek: s.dayOfWeek,
          timeSlotId: s.timeSlotId,
        })),
      });
    }

    await insertAuditEntries(tx, [
      {
        tableName: 'member_disciplines',
        recordId: md.id,
        fieldName: 'created',
        oldValue: null,
        newValue: `discipline:${data.disciplineId}`,
        userId,
      },
    ]);

    // Optional billing: create Subscription + Payment when billing provided.
    // No registration / license fees here — those were charged at member creation.
    let subId: string | null = null;
    let payId: string | null = null;

    if (data.billing) {
      const { billing } = data;
      const startDate = billing.startDate
        ? new Date(`${billing.startDate}T00:00:00.000Z`)
        : todayDate;
      const durationMonths = PLAN_DURATION_MONTHS[billing.planType] ?? 1;
      const endDate = addMonths(startDate, durationMonths);

      const subscription = await tx.subscription.create({
        data: {
          memberId,
          disciplineId: data.disciplineId,
          planType: billing.planType as import('@prisma/client').PlanType,
          startDate,
          endDate,
          amount: billing.amount,
          status: 'active',
          createdBy: userId,
          updatedBy: userId,
        },
      });
      subId = subscription.id;

      await insertAuditEntries(tx, [
        {
          tableName: 'subscriptions',
          recordId: subscription.id,
          fieldName: 'created',
          oldValue: null,
          newValue: `enrollment:${md.id} plan:${billing.planType}`,
          userId,
        },
      ]);

      const totalAmount = billing.amount;
      if (totalAmount > 0) {
        const receiptNumber = await generateReceiptNumber(tx);
        const requestedPaid = billing.payment.paidAmount ?? 0;
        // Force paid=0 for pay-later; use full total for pay-full.
        const paidAmount =
          billing.payment.paymentType === 'later'
            ? 0
            : billing.payment.paymentType === 'full'
              ? totalAmount
              : requestedPaid;
        const remaining = Math.max(0, totalAmount - paidAmount);

        const payment = await tx.payment.create({
          data: {
            memberId,
            receiptNumber,
            totalAmount,
            paidAmount,
            remaining,
            paymentType: billing.payment.paymentType as import('@prisma/client').PaymentType,
            notes: billing.payment.notes ?? null,
            createdBy: userId,
            updatedBy: userId,
            items: {
              create: [
                {
                  description: `${discipline.name} - ${billing.planType} subscription`,
                  amount: totalAmount,
                  type: 'subscription',
                },
              ],
            },
          },
        });
        payId = payment.id;
      }
    }

    return { enrollmentId: md.id, subscriptionId: subId, paymentId: payId };
  });

  const created = await prisma.memberDiscipline.findFirst({
    where: { id: enrollmentId },
    include: {
      discipline: true,
      schedules: { where: { deletedAt: null }, include: { timeSlot: true } },
    },
  });
  if (!created) throw new EditError('NOT_FOUND', 'Enrollment not found after creation', 404);

  const subscription = subscriptionId
    ? await prisma.subscription.findUnique({ where: { id: subscriptionId } })
    : null;

  const payment = paymentId
    ? await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { items: true },
      })
    : null;

  return { enrollment: created, subscription, payment };
}

// ─── Document operations ──────────────────────────────────────────────────────

export async function updateDocument(
  memberId: string,
  documentId: string,
  data: UpdateDocumentInput,
  userId: string,
): Promise<Document> {
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) throw new EditError('NOT_FOUND', 'Member not found', 404);

  const document = await prisma.document.findFirst({
    where: { id: documentId, memberId, deletedAt: null },
  });
  if (!document) throw new EditError('NOT_FOUND', 'Document not found', 404);

  const oldSnapshot: Record<string, unknown> = {};
  const newSnapshot: Record<string, unknown> = {};
  const updateData: Record<string, unknown> = {};

  if (data.issueDate !== undefined) {
    oldSnapshot.issueDate = document.issueDate?.toISOString() ?? null;
    const parsed = toDateOrNull(data.issueDate);
    newSnapshot.issueDate = parsed?.toISOString() ?? null;
    updateData.issueDate = parsed;
  }
  if (data.expiryDate !== undefined) {
    oldSnapshot.expiryDate = document.expiryDate?.toISOString() ?? null;
    const parsed = toDateOrNull(data.expiryDate);
    newSnapshot.expiryDate = parsed?.toISOString() ?? null;
    updateData.expiryDate = parsed;
  }
  if (data.status !== undefined) {
    oldSnapshot.status = document.status;
    newSnapshot.status = data.status;
    updateData.status = data.status;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.document.update({
      where: { id: documentId },
      data: updateData,
    });
    const auditEntries = diffToAuditEntries(
      'documents',
      documentId,
      oldSnapshot,
      newSnapshot,
      userId,
    );
    await insertAuditEntries(tx, auditEntries);
    return result;
  });

  return updated;
}

export async function deleteDocument(
  memberId: string,
  documentId: string,
  userId: string,
): Promise<void> {
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) throw new EditError('NOT_FOUND', 'Member not found', 404);

  const document = await prisma.document.findFirst({
    where: { id: documentId, memberId, deletedAt: null },
  });
  if (!document) throw new EditError('NOT_FOUND', 'Document not found', 404);

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: documentId }, data: { deletedAt: now } });
    await insertAuditEntries(tx, [
      {
        tableName: 'documents',
        recordId: documentId,
        fieldName: 'deleted_at',
        oldValue: null,
        newValue: now.toISOString(),
        userId,
      },
    ]);
  });
}

export async function addDocument(
  memberId: string,
  data: AddDocumentInput,
  userId: string,
): Promise<Document> {
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) throw new EditError('NOT_FOUND', 'Member not found', 404);

  const created = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        memberId,
        type: data.type as import('@prisma/client').DocumentType,
        filePath: '',
        issueDate: toDateOrNull(data.issueDate),
        expiryDate: toDateOrNull(data.expiryDate),
        status: 'pending',
      },
    });
    await insertAuditEntries(tx, [
      {
        tableName: 'documents',
        recordId: doc.id,
        fieldName: 'created',
        oldValue: null,
        newValue: `type:${data.type}`,
        userId,
      },
    ]);
    return doc;
  });

  return created;
}

// ─── Subscription operations ──────────────────────────────────────────────────

export async function updateSubscription(
  memberId: string,
  subscriptionId: string,
  data: UpdateSubscriptionInput,
  userId: string,
): Promise<Subscription> {
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) throw new EditError('NOT_FOUND', 'Member not found', 404);

  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, memberId, deletedAt: null },
  });
  if (!subscription) throw new EditError('NOT_FOUND', 'Subscription not found', 404);

  const oldSnapshot: Record<string, unknown> = {};
  const newSnapshot: Record<string, unknown> = {};
  const updateData: Record<string, unknown> = { updatedBy: userId };

  if (data.planType !== undefined) {
    oldSnapshot.planType = subscription.planType;
    newSnapshot.planType = data.planType;
    updateData.planType = data.planType;
  }
  if (data.autoRenew !== undefined) {
    oldSnapshot.autoRenew = subscription.autoRenew;
    newSnapshot.autoRenew = data.autoRenew;
    updateData.autoRenew = data.autoRenew;
  }
  if (data.status !== undefined) {
    oldSnapshot.status = subscription.status;
    newSnapshot.status = data.status;
    updateData.status = data.status;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.subscription.update({
      where: { id: subscriptionId },
      data: updateData,
    });
    const auditEntries = diffToAuditEntries(
      'subscriptions',
      subscriptionId,
      oldSnapshot,
      newSnapshot,
      userId,
    );
    await insertAuditEntries(tx, auditEntries);
    return result;
  });

  return updated;
}

export async function renewSubscription(
  memberId: string,
  subscriptionId: string,
  data: RenewSubscriptionInput,
  userId: string,
): Promise<Subscription> {
  const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
  if (!member) throw new EditError('NOT_FOUND', 'Member not found', 404);

  const oldSub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, memberId, deletedAt: null },
  });
  if (!oldSub) throw new EditError('NOT_FOUND', 'Subscription not found', 404);

  const today = new Date();
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const durationMonths = PLAN_DURATION_MONTHS[data.planType] ?? 1;
  const endDate = addMonths(startDate, durationMonths);

  const newSub = await prisma.$transaction(async (tx) => {
    // Expire the old subscription
    await tx.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'expired', updatedBy: userId },
    });
    await insertAuditEntries(tx, [
      {
        tableName: 'subscriptions',
        recordId: subscriptionId,
        fieldName: 'status',
        oldValue: oldSub.status,
        newValue: 'expired',
        userId,
        reason: `renewed with plan ${data.planType}`,
      },
    ]);

    // Create the new subscription
    const created = await tx.subscription.create({
      data: {
        memberId,
        disciplineId: oldSub.disciplineId,
        planType: data.planType as import('@prisma/client').PlanType,
        startDate,
        endDate,
        amount: data.amount,
        status: 'active',
        autoRenew: oldSub.autoRenew,
        createdBy: userId,
        updatedBy: userId,
      },
    });
    await insertAuditEntries(tx, [
      {
        tableName: 'subscriptions',
        recordId: created.id,
        fieldName: 'created',
        oldValue: null,
        newValue: `renewed_from:${subscriptionId} plan:${data.planType}`,
        userId,
      },
    ]);

    return created;
  });

  return newSub;
}
