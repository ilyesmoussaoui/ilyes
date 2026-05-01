import type { Payment, PaymentItem, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { generateReceiptNumber } from '../../lib/receiptNumber.js';
import { deductStockInTransaction } from '../inventory/inventory.service.js';
import { scheduleAutoBackup } from '../backups/backups.hooks.js';
import type {
  CreatePaymentInput,
  ListPaymentsQuery,
  PosCheckoutInput,
  CollectPaymentInput,
} from './payments.types.js';

// ─── Error class ─────────────────────────────────────────────────────────────

export class PaymentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentWithItems = Payment & { items: PaymentItem[] };

export type SerializedPayment = {
  id: string;
  receiptNumber: string;
  memberId: string;
  memberName: string;
  memberPhotoUrl: string | null;
  items: {
    id: string;
    description: string;
    amount: number;
    type: PaymentItem['type'];
  }[];
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  paymentType: Payment['paymentType'];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PaginatedPayments = {
  payments: SerializedPayment[];
  total: number;
  page: number;
  limit: number;
};

// ─── Create payment ──────────────────────────────────────────────────────────

export async function createPayment(
  input: CreatePaymentInput,
  userId: string,
): Promise<PaymentWithItems> {
  // Verify member exists
  const member = await prisma.member.findFirst({
    where: { id: input.memberId, deletedAt: null },
  });
  if (!member) {
    throw new PaymentError('NOT_FOUND', 'Member not found', 404);
  }

  const totalAmount = input.items.reduce((sum, item) => sum + item.amount, 0);
  const remaining = totalAmount - input.paidAmount;

  const payment = await prisma.$transaction(async (tx) => {
    const receiptNumber = await generateReceiptNumber(tx);

    return tx.payment.create({
      data: {
        memberId: input.memberId,
        receiptNumber,
        totalAmount,
        paidAmount: input.paidAmount,
        remaining: remaining < 0 ? 0 : remaining,
        paymentType: input.paymentType,
        notes: input.notes ?? null,
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: input.items.map((item) => ({
            description: item.description,
            amount: item.amount,
            type: item.type,
          })),
        },
      },
      include: { items: true },
    });
  });

  // Trigger debounced auto-backup after financial mutation.
  scheduleAutoBackup(userId);

  return payment;
}

// ─── List payments ───────────────────────────────────────────────────────────

export async function listPayments(
  query: ListPaymentsQuery,
): Promise<PaginatedPayments> {
  const { page, limit, memberId, paymentType, dateFrom, dateTo, search, sortBy, sortOrder } =
    query;

  const where: Prisma.PaymentWhereInput = {
    deletedAt: null,
  };

  if (memberId) {
    where.memberId = memberId;
  }

  if (paymentType) {
    where.paymentType = paymentType;
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      (where.createdAt as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setUTCHours(23, 59, 59, 999);
      (where.createdAt as Prisma.DateTimeFilter).lte = endDate;
    }
  }

  if (search) {
    where.OR = [
      { receiptNumber: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
      {
        member: {
          OR: [
            { firstNameLatin: { contains: search, mode: 'insensitive' } },
            { lastNameLatin: { contains: search, mode: 'insensitive' } },
            { firstNameArabic: { contains: search } },
            { lastNameArabic: { contains: search } },
          ],
        },
      },
    ];
  }

  const orderBy: Prisma.PaymentOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [total, data] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: {
        items: true,
        member: {
          select: {
            id: true,
            firstNameLatin: true,
            lastNameLatin: true,
            firstNameArabic: true,
            lastNameArabic: true,
            photoPath: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const payments = data.map((p) => {
    const latinName = [p.member.firstNameLatin, p.member.lastNameLatin]
      .filter(Boolean)
      .join(' ')
      .trim();
    const arabicName = [p.member.firstNameArabic, p.member.lastNameArabic]
      .filter(Boolean)
      .join(' ')
      .trim();
    const memberName = latinName || arabicName || 'Unknown';

    return {
      id: p.id,
      receiptNumber: p.receiptNumber,
      memberId: p.memberId,
      memberName,
      memberPhotoUrl: p.member.photoPath
        ? `/api/v1/files/photos/${p.member.photoPath}`
        : null,
      items: p.items.map((i) => ({
        id: i.id,
        description: i.description,
        amount: i.amount,
        type: i.type,
      })),
      totalAmount: p.totalAmount,
      paidAmount: p.paidAmount,
      remaining: p.remaining,
      paymentType: p.paymentType,
      notes: p.notes,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  });

  return {
    payments,
    total,
    page,
    limit,
  };
}

// ─── Get single payment ──────────────────────────────────────────────────────

export async function getPaymentById(
  id: string,
): Promise<SerializedPayment> {
  const payment = await prisma.payment.findFirst({
    where: { id, deletedAt: null },
    include: {
      items: true,
      member: {
        select: {
          id: true,
          firstNameLatin: true,
          lastNameLatin: true,
          firstNameArabic: true,
          lastNameArabic: true,
          photoPath: true,
        },
      },
    },
  });

  if (!payment) {
    throw new PaymentError('NOT_FOUND', 'Payment not found', 404);
  }

  const latinName = [payment.member.firstNameLatin, payment.member.lastNameLatin]
    .filter(Boolean)
    .join(' ')
    .trim();
  const arabicName = [payment.member.firstNameArabic, payment.member.lastNameArabic]
    .filter(Boolean)
    .join(' ')
    .trim();
  const memberName = latinName || arabicName || 'Unknown';

  return {
    id: payment.id,
    receiptNumber: payment.receiptNumber,
    memberId: payment.memberId,
    memberName,
    memberPhotoUrl: payment.member.photoPath
      ? `/api/v1/files/photos/${payment.member.photoPath}`
      : null,
    items: payment.items.map((i) => ({
      id: i.id,
      description: i.description,
      amount: i.amount,
      type: i.type,
    })),
    totalAmount: payment.totalAmount,
    paidAmount: payment.paidAmount,
    remaining: payment.remaining,
    paymentType: payment.paymentType,
    notes: payment.notes,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

// ─── Create refund ───────────────────────────────────────────────────────────

export async function createRefund(
  originalPaymentId: string,
  reason: string,
  userId: string,
): Promise<PaymentWithItems> {
  const original = await prisma.payment.findFirst({
    where: { id: originalPaymentId, deletedAt: null },
    include: { items: true },
  });

  if (!original) {
    throw new PaymentError('NOT_FOUND', 'Original payment not found', 404);
  }

  if (original.paymentType === 'refund') {
    throw new PaymentError(
      'INVALID_OPERATION',
      'Cannot refund a refund record',
      422,
    );
  }

  // Create a new payment record with negative amounts
  const refund = await prisma.$transaction(async (tx) => {
    const receiptNumber = await generateReceiptNumber(tx);

    return tx.payment.create({
      data: {
        memberId: original.memberId,
        receiptNumber,
        totalAmount: -original.totalAmount,
        paidAmount: -original.paidAmount,
        remaining: 0,
        paymentType: 'refund',
        notes: `Refund for ${original.receiptNumber}: ${reason}`,
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: original.items.map((item) => ({
            description: `REFUND: ${item.description}`,
            amount: -item.amount,
            type: item.type,
          })),
        },
      },
      include: { items: true },
    });
  });

  scheduleAutoBackup(userId);

  return refund;
}

// ─── Collect payment against outstanding balance (FIFO) ─────────────────────

export type CollectPaymentResult = {
  memberId: string;
  applied: number;
  remainingBalance: number;
  affectedPayments: Array<{
    paymentId: string;
    receiptNumber: string;
    applied: number;
    remaining: number;
  }>;
};

export async function collectPayment(
  memberId: string,
  input: CollectPaymentInput,
  userId: string,
): Promise<CollectPaymentResult> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
  });
  if (!member) {
    throw new PaymentError('NOT_FOUND', 'Member not found', 404);
  }

  const result = await prisma.$transaction(async (tx) => {
    const unpaid = await tx.payment.findMany({
      where: {
        memberId,
        deletedAt: null,
        remaining: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalOutstanding = unpaid.reduce((sum, p) => sum + p.remaining, 0);
    if (totalOutstanding === 0) {
      throw new PaymentError(
        'NO_OUTSTANDING_BALANCE',
        'Member has no outstanding balance',
        422,
      );
    }
    if (input.amount > totalOutstanding) {
      throw new PaymentError(
        'AMOUNT_EXCEEDS_BALANCE',
        `Amount ${input.amount} exceeds outstanding balance ${totalOutstanding}`,
        422,
      );
    }

    let remainingToApply = input.amount;
    const affected: CollectPaymentResult['affectedPayments'] = [];

    for (const p of unpaid) {
      if (remainingToApply <= 0) break;
      const applied = Math.min(p.remaining, remainingToApply);
      const newPaid = p.paidAmount + applied;
      const newRemaining = p.remaining - applied;
      // Promote to 'full' when fully paid off to keep reporting accurate.
      const newType: Payment['paymentType'] =
        newRemaining === 0
          ? p.paymentType === 'refund' || p.paymentType === 'adjustment'
            ? p.paymentType
            : 'full'
          : p.paymentType === 'later'
            ? 'partial'
            : p.paymentType;

      const notesNext = input.notes
        ? [p.notes, `Topup ${applied} by ${userId}: ${input.notes}`]
            .filter(Boolean)
            .join(' | ')
        : p.notes;

      await tx.payment.update({
        where: { id: p.id },
        data: {
          paidAmount: newPaid,
          remaining: newRemaining,
          paymentType: newType,
          notes: notesNext,
          updatedBy: userId,
        },
      });
      affected.push({
        paymentId: p.id,
        receiptNumber: p.receiptNumber,
        applied,
        remaining: newRemaining,
      });
      remainingToApply -= applied;
    }

    return {
      memberId,
      applied: input.amount,
      remainingBalance: totalOutstanding - input.amount,
      affectedPayments: affected,
    };
  });

  scheduleAutoBackup(userId);
  return result;
}

// ─── POS checkout ────────────────────────────────────────────────────────────

export async function posCheckout(
  input: PosCheckoutInput,
  userId: string,
): Promise<PaymentWithItems> {
  // If memberId provided, verify member exists
  if (input.memberId) {
    const member = await prisma.member.findFirst({
      where: { id: input.memberId, deletedAt: null },
    });
    if (!member) {
      throw new PaymentError('NOT_FOUND', 'Member not found', 404);
    }
  }

  const totalAmount = input.items.reduce(
    (sum, item) => sum + item.amount * item.quantity,
    0,
  );
  const remaining = totalAmount - input.paidAmount;

  const payment = await prisma.$transaction(async (tx) => {
    const receiptNumber = await generateReceiptNumber(tx);

    // For POS without a member, we need a fallback. The schema requires memberId.
    // If no memberId is provided, we create a "walk-in" approach.
    // However, the Prisma schema requires memberId on Payment. Let's check:
    // The model has: memberId String @map("member_id") @db.Uuid — it's required.
    // We need a member for all payments. If no memberId, we error.
    if (!input.memberId) {
      throw new PaymentError(
        'VALIDATION_ERROR',
        'memberId is required for payment records. For walk-in POS, create a walk-in member first.',
        422,
      );
    }

    // Deduct stock for equipment items that have a productId
    for (const item of input.items) {
      if (item.productId && item.type === 'equipment') {
        await deductStockInTransaction(
          tx,
          item.productId,
          item.quantity,
          userId,
          `POS sale: ${item.description} x${item.quantity}`,
        );
      }
    }

    const createdPayment = await tx.payment.create({
      data: {
        memberId: input.memberId,
        receiptNumber,
        totalAmount,
        paidAmount: input.paidAmount,
        remaining: remaining < 0 ? 0 : remaining,
        paymentType: input.paymentType,
        notes: input.notes ?? null,
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: input.items.map((item) => ({
            description:
              item.quantity > 1
                ? `${item.description} x${item.quantity}`
                : item.description,
            amount: item.amount * item.quantity,
            type: item.type,
          })),
        },
      },
      include: { items: true },
    });

    // Create MemberEquipment records for equipment items linked to a member
    if (input.memberId) {
      for (const item of input.items) {
        if (item.productId && item.type === 'equipment') {
          await tx.memberEquipment.create({
            data: {
              memberId: input.memberId,
              equipmentId: item.productId,
              quantity: item.quantity,
              purchaseDate: new Date(),
              paymentId: createdPayment.id,
            },
          });
        }
      }
    }

    return createdPayment;
  });

  scheduleAutoBackup(userId);

  return payment;
}
