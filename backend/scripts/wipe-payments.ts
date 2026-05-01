/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping payment history...');

  const before = await prisma.$transaction([
    prisma.payment.count(),
    prisma.paymentItem.count(),
    prisma.memberEquipment.count(),
    prisma.stockAdjustment.count({ where: { reason: 'pos_sale' } }),
  ]);
  console.log('Before:', {
    payments: before[0],
    paymentItems: before[1],
    memberEquipment: before[2],
    posSaleStockAdjustments: before[3],
  });

  await prisma.$transaction(async (tx) => {
    // 1) Unlink member_equipment from payments (setNull is auto, but we also want
    //    to drop POS-acquired equipment entries since those were test purchases).
    await tx.memberEquipment.deleteMany({});

    // 2) Delete stock adjustments tied to POS sales (these reflect payment events).
    await tx.stockAdjustment.deleteMany({ where: { reason: 'pos_sale' } });

    // 3) Delete payment items (also cascades from payments, but explicit is safer).
    await tx.paymentItem.deleteMany({});

    // 4) Delete all payments.
    await tx.payment.deleteMany({});

    // 5) Clear audit logs referencing payments / payment_items.
    await tx.auditLog.deleteMany({
      where: { tableName: { in: ['payments', 'payment_items', 'member_equipment'] } },
    });
  });

  const after = await prisma.$transaction([
    prisma.payment.count(),
    prisma.paymentItem.count(),
    prisma.memberEquipment.count(),
    prisma.stockAdjustment.count({ where: { reason: 'pos_sale' } }),
  ]);
  console.log('After:', {
    payments: after[0],
    paymentItems: after[1],
    memberEquipment: after[2],
    posSaleStockAdjustments: after[3],
  });

  console.log('✓ Payment history wiped clean.');
}

main()
  .catch((err) => {
    console.error('Failed to wipe payment history:', err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
