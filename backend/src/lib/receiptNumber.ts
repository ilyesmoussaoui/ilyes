import type { Prisma } from '@prisma/client';

/**
 * Generate a unique receipt number in format: RCP-YYYYMMDD-NNNN
 * Uses a transaction client to safely get the next sequence number.
 */
export async function generateReceiptNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const now = new Date();
  const dateStr = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('');

  const prefix = `RCP-${dateStr}-`;

  const latest = await tx.payment.findFirst({
    where: {
      receiptNumber: { startsWith: prefix },
    },
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true },
  });

  let seq = 1;
  if (latest) {
    const lastSeq = parseInt(latest.receiptNumber.slice(prefix.length), 10);
    if (!Number.isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}
