import type {
  Equipment,
  FamilyLink,
  MemberEquipment,
  Payment,
  PaymentItem,
  Subscription,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { generateReceiptNumber } from '../../lib/receiptNumber.js';
import { deductStockInTransaction } from '../inventory/inventory.service.js';
import { scheduleAutoBackup } from '../backups/backups.hooks.js';
import { getFees } from '../settings/settings.service.js';
import type { CreateBillingInput } from './billing.types.js';

export class BillingError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'BillingError';
  }
}

// Plan durations in months
const PLAN_DURATION_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
  session_pack: 1, // default 1 month for session packs
};

/** Shape returned by GET /subscription-plans */
export type SubscriptionPlans = Record<string, Record<string, number>>;

/**
 * Returns all active subscription plans from the DB, grouped by discipline name.
 * Shape: { [disciplineName]: { [planType]: amountInCentimes } }
 * If no plans exist for a discipline the discipline key will not appear.
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlans> {
  const plans = await prisma.subscriptionPlan.findMany({
    where: { deletedAt: null, isActive: true },
    include: {
      discipline: { select: { name: true } },
    },
    orderBy: [{ discipline: { name: 'asc' } }, { planType: 'asc' }],
  });

  const result: SubscriptionPlans = {};
  for (const plan of plans) {
    const name = plan.discipline.name;
    if (!result[name]) result[name] = {};
    result[name][plan.planType] = plan.amount;
  }
  return result;
}

export async function listEquipment(): Promise<Equipment[]> {
  return prisma.equipment.findMany({
    where: { deletedAt: null },
    orderBy: { name: 'asc' },
  });
}

type MemberSearchResult = {
  id: string;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
  photoPath: string | null;
};

export async function searchMembers(query: string): Promise<MemberSearchResult[]> {
  const trimmed = query.trim();

  return prisma.member.findMany({
    where: {
      deletedAt: null,
      OR: [
        { firstNameLatin: { contains: trimmed, mode: 'insensitive' } },
        { lastNameLatin: { contains: trimmed, mode: 'insensitive' } },
        { firstNameArabic: { contains: trimmed } },
        { lastNameArabic: { contains: trimmed } },
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
    take: 10,
    orderBy: { createdAt: 'desc' },
  });
}

// Receipt number generation is now in ../../lib/receiptNumber.ts

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

export type BillingResult = {
  subscriptions: Subscription[];
  equipment: MemberEquipment[];
  familyLinks: FamilyLink[];
  payment: (Payment & { items: PaymentItem[] }) | null;
};

export async function createBilling(
  memberId: string,
  input: CreateBillingInput,
  userId: string,
): Promise<BillingResult> {
  const member = await prisma.member.findFirst({
    where: { id: memberId, deletedAt: null },
  });
  if (!member) {
    throw new BillingError('NOT_FOUND', 'Member not found', 404);
  }

  // Validate discipline IDs for subscriptions
  if (input.subscriptions.length > 0) {
    const disciplineIds = input.subscriptions.map((s) => s.disciplineId);
    const disciplines = await prisma.discipline.findMany({
      where: { id: { in: disciplineIds }, deletedAt: null, isActive: true },
    });
    if (disciplines.length !== new Set(disciplineIds).size) {
      throw new BillingError('VALIDATION_ERROR', 'One or more disciplines not found or inactive', 422);
    }
  }

  // Validate equipment IDs
  if (input.equipment.length > 0) {
    const equipmentIds = input.equipment.map((e) => e.equipmentId);
    const existingEquipment = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds }, deletedAt: null },
    });
    if (existingEquipment.length !== new Set(equipmentIds).size) {
      throw new BillingError('VALIDATION_ERROR', 'One or more equipment items not found', 422);
    }
  }

  // Validate related member IDs for family links
  if (input.familyLinks.length > 0) {
    const relatedIds = input.familyLinks.map((f) => f.relatedMemberId);
    // Prevent self-linking
    if (relatedIds.includes(memberId)) {
      throw new BillingError('VALIDATION_ERROR', 'Cannot create family link to self', 422);
    }
    const relatedMembers = await prisma.member.findMany({
      where: { id: { in: relatedIds }, deletedAt: null },
    });
    if (relatedMembers.length !== new Set(relatedIds).size) {
      throw new BillingError('VALIDATION_ERROR', 'One or more related members not found', 422);
    }
  }

  // Fetch configurable fees from settings
  const { registrationFee, licenseFee } = await getFees();

  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Subscriptions
    const createdSubscriptions: Subscription[] = [];
    for (const sub of input.subscriptions) {
      const durationMonths = PLAN_DURATION_MONTHS[sub.planType] ?? 1;

      // Determine start date: use provided or default to today
      const startDate = sub.startDate
        ? new Date(sub.startDate)
        : todayDate;
      const endDate = addMonths(startDate, durationMonths);

      // Resolve amount: use provided value or look up from SubscriptionPlan table
      let resolvedAmount = sub.amount;
      if (resolvedAmount === undefined) {
        const plan = await tx.subscriptionPlan.findFirst({
          where: { disciplineId: sub.disciplineId, planType: sub.planType as import('@prisma/client').PlanType, deletedAt: null, isActive: true },
        });
        resolvedAmount = plan?.amount ?? 0;
      }

      const subscription = await tx.subscription.create({
        data: {
          memberId,
          disciplineId: sub.disciplineId,
          planType: sub.planType,
          startDate,
          endDate,
          amount: resolvedAmount,
          status: 'active',
          createdBy: userId,
          updatedBy: userId,
        },
      });
      createdSubscriptions.push(subscription);
    }

    // 2. Create MemberEquipment records
    const createdEquipment: MemberEquipment[] = [];
    // We will link to payment below, so collect equipment for later update
    const equipmentForPayment: Array<{ meId: string; equipmentId: string; quantity: number }> = [];

    for (const eq of input.equipment) {
      // Deduct stock for this equipment purchase
      await deductStockInTransaction(
        tx,
        eq.equipmentId,
        eq.quantity,
        userId,
        `Registration purchase for member ${memberId}`,
      );

      const me = await tx.memberEquipment.create({
        data: {
          memberId,
          equipmentId: eq.equipmentId,
          quantity: eq.quantity,
          purchaseDate: todayDate,
        },
      });
      createdEquipment.push(me);
      equipmentForPayment.push({ meId: me.id, equipmentId: eq.equipmentId, quantity: eq.quantity });
    }

    // 3. Create FamilyLink records (bidirectional)
    const createdFamilyLinks: FamilyLink[] = [];
    for (const fl of input.familyLinks) {
      // Forward link
      const forward = await tx.familyLink.upsert({
        where: {
          memberId_relatedMemberId: {
            memberId,
            relatedMemberId: fl.relatedMemberId,
          },
        },
        update: {
          relationship: fl.relationship,
          deletedAt: null,
        },
        create: {
          memberId,
          relatedMemberId: fl.relatedMemberId,
          relationship: fl.relationship,
        },
      });
      createdFamilyLinks.push(forward);

      // Reverse link with inverse relationship
      const inverseRelationship = getInverseRelationship(fl.relationship);
      await tx.familyLink.upsert({
        where: {
          memberId_relatedMemberId: {
            memberId: fl.relatedMemberId,
            relatedMemberId: memberId,
          },
        },
        update: {
          relationship: inverseRelationship,
          deletedAt: null,
        },
        create: {
          memberId: fl.relatedMemberId,
          relatedMemberId: memberId,
          relationship: inverseRelationship,
        },
      });
    }

    // 4. Calculate totals and create Payment + PaymentItems
    let payment: (Payment & { items: PaymentItem[] }) | null = null;

    // Always compute total even if paying later (for reference)
    const paymentItems: Array<{ description: string; amount: number; type: 'registration' | 'fee' | 'subscription' | 'equipment' }> = [];

    // Registration fee + License fee — values come from DB settings
    paymentItems.push({
      description: 'Registration fee',
      amount: registrationFee,
      type: 'registration',
    });
    paymentItems.push({
      description: 'License fee',
      amount: licenseFee,
      type: 'fee',
    });

    // Subscription items
    for (const sub of createdSubscriptions) {
      const discipline = await tx.discipline.findUnique({
        where: { id: sub.disciplineId },
        select: { name: true },
      });
      paymentItems.push({
        description: `${discipline?.name ?? 'Unknown'} - ${sub.planType} subscription`,
        amount: sub.amount,
        type: 'subscription',
      });
    }

    // Equipment items
    for (const eq of equipmentForPayment) {
      const equipment = await tx.equipment.findUnique({
        where: { id: eq.equipmentId },
        select: { name: true, price: true },
      });
      if (equipment) {
        paymentItems.push({
          description: `${equipment.name} x${eq.quantity}`,
          amount: equipment.price * eq.quantity,
          type: 'equipment',
        });
      }
    }

    const totalAmount = paymentItems.reduce((sum, item) => sum + item.amount, 0);

    // Always create a Payment record when there's a chargeable total so the
    // outstanding balance is tracked even when the member defers ("later").
    const hasCharges = totalAmount > 0;

    if (hasCharges && input.payment != null) {
      const receiptNumber = await generateReceiptNumber(tx);
      const requestedPaid = input.payment.paidAmount ?? 0;
      // Force paid=0 for pay-later regardless of what the client sent, so the
      // invariant "later ⇒ nothing paid yet" holds.
      const paidAmount =
        input.payment.paymentType === 'later' ? 0 : requestedPaid;
      const remaining = Math.max(0, totalAmount - paidAmount);

      payment = await tx.payment.create({
        data: {
          memberId,
          receiptNumber,
          totalAmount,
          paidAmount,
          remaining,
          paymentType: input.payment.paymentType as import('@prisma/client').PaymentType,
          notes: input.payment.notes ?? null,
          createdBy: userId,
          updatedBy: userId,
          items: {
            create: paymentItems.map((item) => ({
              description: item.description,
              amount: item.amount,
              type: item.type,
            })),
          },
        },
        include: { items: true },
      });

      // Link equipment entries to the payment
      for (const eq of createdEquipment) {
        await tx.memberEquipment.update({
          where: { id: eq.id },
          data: { paymentId: payment.id },
        });
      }
    }

    return {
      subscriptions: createdSubscriptions,
      equipment: createdEquipment,
      familyLinks: createdFamilyLinks,
      payment,
    };
  });

  if (result.payment) {
    scheduleAutoBackup(userId);
  }

  return result;
}

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
