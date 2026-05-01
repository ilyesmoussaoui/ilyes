import { prisma } from '../../lib/prisma.js';
import { generateReceiptNumber } from '../../lib/receiptNumber.js';
import { scheduleAutoBackup } from '../backups/backups.hooks.js';

// ─── Error class ─────────────────────────────────────────────────────────────

export class SubscriptionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

// ─── Plan durations ──────────────────────────────────────────────────────────

const PLAN_DURATION_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
  session_pack: 1,
};

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

// ─── Process auto-renewals ───────────────────────────────────────────────────

type RenewalResult = {
  renewalsProcessed: number;
  details: Array<{
    memberId: string;
    oldSubscriptionId: string;
    newSubscriptionId: string;
    paymentId: string;
    notificationId: string;
  }>;
};

export async function processAutoRenewals(
  userId: string,
): Promise<RenewalResult> {
  const today = new Date();
  const todayDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  // Find all subscriptions eligible for auto-renewal
  const expiredAutoRenew = await prisma.subscription.findMany({
    where: {
      status: 'active',
      autoRenew: true,
      endDate: { lte: todayDate },
      deletedAt: null,
    },
    include: {
      discipline: {
        select: { id: true, name: true },
      },
      member: {
        select: {
          id: true,
          firstNameLatin: true,
          lastNameLatin: true,
        },
      },
    },
  });

  if (expiredAutoRenew.length === 0) {
    return { renewalsProcessed: 0, details: [] };
  }

  const details: RenewalResult['details'] = [];

  // Process each renewal in a transaction
  await prisma.$transaction(async (tx) => {
    for (const sub of expiredAutoRenew) {
      const durationMonths = PLAN_DURATION_MONTHS[sub.planType] ?? 1;
      const newStartDate = todayDate;
      const newEndDate = addMonths(todayDate, durationMonths);

      // 1. Create new subscription
      const newSub = await tx.subscription.create({
        data: {
          memberId: sub.memberId,
          disciplineId: sub.disciplineId,
          planType: sub.planType,
          startDate: newStartDate,
          endDate: newEndDate,
          amount: sub.amount,
          status: 'active',
          autoRenew: true,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      // 2. Create payment record (balance owed, not paid yet)
      const receiptNumber = await generateReceiptNumber(tx);
      const amountDzd = Math.round(sub.amount / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

      const payment = await tx.payment.create({
        data: {
          memberId: sub.memberId,
          receiptNumber,
          totalAmount: sub.amount,
          paidAmount: 0,
          remaining: sub.amount,
          paymentType: 'adjustment',
          notes: `Auto-renewal: ${sub.discipline.name} ${sub.planType} subscription`,
          createdBy: userId,
          updatedBy: userId,
          items: {
            create: [
              {
                description: `${sub.discipline.name} - ${sub.planType} subscription (auto-renewal)`,
                amount: sub.amount,
                type: 'subscription',
              },
            ],
          },
        },
      });

      // 3. Create notification
      const notification = await tx.notification.create({
        data: {
          type: 'payment_due',
          memberId: sub.memberId,
          message: `Auto-renewal: ${sub.discipline.name} ${sub.planType} subscription renewed. Amount due: ${amountDzd} DZD`,
        },
      });

      // 4. Expire the old subscription
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'expired',
          updatedBy: userId,
        },
      });

      details.push({
        memberId: sub.memberId,
        oldSubscriptionId: sub.id,
        newSubscriptionId: newSub.id,
        paymentId: payment.id,
        notificationId: notification.id,
      });
    }
  });

  if (details.length > 0) {
    scheduleAutoBackup(userId);
  }

  return {
    renewalsProcessed: details.length,
    details,
  };
}
