import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import type { Expense, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { diffToAuditEntries, insertAuditEntries } from '../../lib/audit.js';
import { getEnv } from '../../config/env.js';
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  ListExpensesQuery,
  SummaryQuery,
} from './expenses.types.js';

// ─── Error class ─────────────────────────────────────────────────────────────

export class ExpenseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'ExpenseError';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type PaginatedExpenses = {
  expenses: Expense[];
  total: number;
  page: number;
  limit: number;
};

// ─── Create expense ──────────────────────────────────────────────────────────

export async function createExpense(
  input: CreateExpenseInput,
  userId: string,
): Promise<Expense> {
  const expense = await prisma.expense.create({
    data: {
      date: new Date(input.date),
      category: input.category,
      amount: input.amount,
      description: input.description ?? null,
      receiptPath: input.receiptPath ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
  });

  return expense;
}

// ─── List expenses ───────────────────────────────────────────────────────────

export async function listExpenses(
  query: ListExpensesQuery,
): Promise<PaginatedExpenses> {
  const { page, limit, dateFrom, dateTo, category, sortBy, sortOrder } = query;

  const where: Prisma.ExpenseWhereInput = {
    deletedAt: null,
  };

  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) {
      (where.date as Prisma.DateTimeFilter).gte = new Date(dateFrom);
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setUTCHours(23, 59, 59, 999);
      (where.date as Prisma.DateTimeFilter).lte = endDate;
    }
  }

  if (category) {
    where.category = { equals: category, mode: 'insensitive' };
  }

  const orderBy: Prisma.ExpenseOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  };

  const [total, data] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    expenses: data,
    total,
    page,
    limit,
  };
}

// ─── Get single expense ──────────────────────────────────────────────────────

export async function getExpenseById(id: string): Promise<Expense> {
  const expense = await prisma.expense.findFirst({
    where: { id, deletedAt: null },
  });

  if (!expense) {
    throw new ExpenseError('NOT_FOUND', 'Expense not found', 404);
  }

  return expense;
}

// ─── Update expense ──────────────────────────────────────────────────────────

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
  userId: string,
): Promise<Expense> {
  const existing = await prisma.expense.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    throw new ExpenseError('NOT_FOUND', 'Expense not found', 404);
  }

  const updateData: Prisma.ExpenseUpdateInput = {
    updatedBy: userId,
  };

  if (input.date !== undefined) {
    updateData.date = new Date(input.date);
  }
  if (input.category !== undefined) {
    updateData.category = input.category;
  }
  if (input.amount !== undefined) {
    updateData.amount = input.amount;
  }
  if (input.description !== undefined) {
    updateData.description = input.description;
  }
  if (input.receiptPath !== undefined) {
    updateData.receiptPath = input.receiptPath;
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Audit trail
    const oldData: Record<string, unknown> = {
      date: existing.date.toISOString(),
      category: existing.category,
      amount: existing.amount,
      description: existing.description,
      receiptPath: existing.receiptPath,
    };
    const newData: Record<string, unknown> = {};
    if (input.date !== undefined) newData.date = input.date;
    if (input.category !== undefined) newData.category = input.category;
    if (input.amount !== undefined) newData.amount = input.amount;
    if (input.description !== undefined) newData.description = input.description;
    if (input.receiptPath !== undefined) newData.receiptPath = input.receiptPath;

    const auditEntries = diffToAuditEntries(
      'expenses',
      id,
      oldData,
      newData,
      userId,
    );
    await insertAuditEntries(tx, auditEntries);

    return tx.expense.update({
      where: { id },
      data: updateData,
    });
  });

  return updated;
}

// ─── Soft delete expense ─────────────────────────────────────────────────────

export async function deleteExpense(
  id: string,
  userId: string,
): Promise<void> {
  const existing = await prisma.expense.findFirst({
    where: { id, deletedAt: null },
  });

  if (!existing) {
    throw new ExpenseError('NOT_FOUND', 'Expense not found', 404);
  }

  await prisma.expense.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedBy: userId,
    },
  });
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export type CategoryBreakdown = {
  category: string;
  total: number;
  count: number;
};

export type ExpenseSummary = {
  total: number;
  count: number;
  byCategory: CategoryBreakdown[];
  currentMonthTotal: number;
  previousMonthTotal: number;
  monthOverMonthPct: number | null; // null = no prior month data
  yearToDateTotal: number;
  dailyAverage: number;
  topCategory: { category: string; total: number } | null;
};

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

export async function getExpensesSummary(
  query: SummaryQuery,
): Promise<ExpenseSummary> {
  const now = new Date();
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const prevMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  // Scope for filtered-range totals / breakdown
  const rangeWhere: Prisma.ExpenseWhereInput = { deletedAt: null };
  if (query.dateFrom || query.dateTo) {
    rangeWhere.date = {};
    if (query.dateFrom) {
      (rangeWhere.date as Prisma.DateTimeFilter).gte = startOfUtcDay(new Date(query.dateFrom));
    }
    if (query.dateTo) {
      (rangeWhere.date as Prisma.DateTimeFilter).lte = endOfUtcDay(new Date(query.dateTo));
    }
  }

  const [
    rangeAgg,
    rangeByCategory,
    currentMonthAgg,
    prevMonthAgg,
    ytdAgg,
  ] = await Promise.all([
    prisma.expense.aggregate({
      where: rangeWhere,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: rangeWhere,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.expense.aggregate({
      where: {
        deletedAt: null,
        date: { gte: currentMonthStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        deletedAt: null,
        date: { gte: prevMonthStart, lt: currentMonthStart },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        deletedAt: null,
        date: { gte: yearStart, lt: nextMonthStart },
      },
      _sum: { amount: true },
    }),
  ]);

  const total = rangeAgg._sum.amount ?? 0;
  const count = rangeAgg._count._all ?? 0;
  const currentMonthTotal = currentMonthAgg._sum.amount ?? 0;
  const previousMonthTotal = prevMonthAgg._sum.amount ?? 0;
  const yearToDateTotal = ytdAgg._sum.amount ?? 0;

  const monthOverMonthPct =
    previousMonthTotal > 0
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100
      : null;

  const byCategory: CategoryBreakdown[] = rangeByCategory
    .map((g) => ({
      category: g.category,
      total: g._sum.amount ?? 0,
      count: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);

  const topCategory = byCategory.length > 0
    ? { category: byCategory[0]!.category, total: byCategory[0]!.total }
    : null;

  // Daily average across the range (or last 30 days if no range given)
  let rangeDays = 30;
  if (query.dateFrom && query.dateTo) {
    const start = new Date(query.dateFrom);
    const end = new Date(query.dateTo);
    rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  }
  const dailyAverage = total > 0 ? Math.round(total / rangeDays) : 0;

  return {
    total,
    count,
    byCategory,
    currentMonthTotal,
    previousMonthTotal,
    monthOverMonthPct,
    yearToDateTotal,
    dailyAverage,
    topCategory,
  };
}

// ─── Receipts ────────────────────────────────────────────────────────────────

const RECEIPT_ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const RECEIPT_MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const RECEIPT_EXT_TO_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function getReceiptsRoot(): string {
  const env = getEnv();
  return path.resolve(env.PHOTOS_DIR, '..', 'receipts');
}

export async function ensureReceiptsDir(): Promise<void> {
  await fs.mkdir(getReceiptsRoot(), { recursive: true });
}

export type UploadReceiptInput = {
  expenseId: string;
  mimeType: string;
  bytes: Buffer;
  userId: string;
};

export async function uploadExpenseReceipt(
  input: UploadReceiptInput,
): Promise<{ expenseId: string; receiptPath: string }> {
  const { expenseId, mimeType, bytes, userId } = input;

  if (!RECEIPT_ALLOWED_MIME.has(mimeType)) {
    throw new ExpenseError(
      'UNSUPPORTED_MEDIA_TYPE',
      'Receipt must be PDF, JPEG, PNG, or WEBP',
      415,
    );
  }

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, deletedAt: null },
  });
  if (!existing) {
    throw new ExpenseError('NOT_FOUND', 'Expense not found', 404);
  }

  const ext = RECEIPT_MIME_TO_EXT[mimeType]!;
  const root = getReceiptsRoot();
  await fs.mkdir(root, { recursive: true });

  const filename = `${expenseId}-${Date.now()}.${ext}`;
  const absPath = path.join(root, filename);
  await fs.writeFile(absPath, bytes);

  // Best-effort cleanup of previous file for this expense
  if (existing.receiptPath && existing.receiptPath !== filename) {
    const prev = path.resolve(path.join(root, existing.receiptPath));
    if (prev.startsWith(root + path.sep)) {
      await fs.unlink(prev).catch(() => undefined);
    }
  }

  await prisma.expense.update({
    where: { id: expenseId },
    data: { receiptPath: filename, updatedBy: userId },
  });

  return { expenseId, receiptPath: filename };
}

export type ReceiptStream = {
  stream: ReturnType<typeof createReadStream>;
  contentType: string;
  size: number;
};

export async function getReceiptStream(filename: string): Promise<ReceiptStream> {
  const root = getReceiptsRoot();
  const absPath = path.resolve(path.join(root, filename));
  if (!absPath.startsWith(root + path.sep)) {
    throw new ExpenseError('NOT_FOUND', 'Receipt not found', 404);
  }

  let stat;
  try {
    stat = await fs.stat(absPath);
  } catch {
    throw new ExpenseError('NOT_FOUND', 'Receipt not found', 404);
  }
  if (!stat.isFile()) {
    throw new ExpenseError('NOT_FOUND', 'Receipt not found', 404);
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = RECEIPT_EXT_TO_MIME[ext] ?? 'application/octet-stream';
  return { stream: createReadStream(absPath), contentType, size: stat.size };
}
