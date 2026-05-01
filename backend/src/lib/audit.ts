import type { Prisma } from '@prisma/client';

interface AuditEntry {
  tableName: string;
  recordId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  userId: string;
  reason?: string;
}

/**
 * Compare old and new objects, returning AuditEntry records for every field
 * whose serialized value changed. Only keys present in `newData` are checked.
 */
export function diffToAuditEntries(
  tableName: string,
  recordId: string,
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  userId: string,
  reason?: string,
): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (const key of Object.keys(newData)) {
    const oldVal = oldData[key];
    const newVal = newData[key];
    const oldStr = oldVal == null ? null : String(oldVal);
    const newStr = newVal == null ? null : String(newVal);
    if (oldStr !== newStr) {
      entries.push({
        tableName,
        recordId,
        fieldName: key,
        oldValue: oldStr,
        newValue: newStr,
        userId,
        reason,
      });
    }
  }
  return entries;
}

/**
 * Batch-insert audit entries within an open transaction.
 * No-ops when the entries array is empty.
 */
export async function insertAuditEntries(
  tx: Prisma.TransactionClient,
  entries: AuditEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  await tx.auditLog.createMany({
    data: entries.map((e) => ({
      tableName: e.tableName,
      recordId: e.recordId,
      fieldName: e.fieldName,
      oldValue: e.oldValue,
      newValue: e.newValue,
      userId: e.userId,
      reason: e.reason ?? null,
    })),
  });
}
