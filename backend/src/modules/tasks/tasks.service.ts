import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { CreateTaskServiceInput, ListTasksQuery } from './tasks.types.js';

// ─── Error class ──────────────────────────────────────────────────────────────

export class TaskError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'TaskError';
  }
}

// ─── Shared include ───────────────────────────────────────────────────────────

const taskInclude = {
  member: {
    select: {
      id: true,
      firstNameLatin: true,
      lastNameLatin: true,
      firstNameArabic: true,
      lastNameArabic: true,
    },
  },
  assignee: {
    select: {
      id: true,
      fullNameLatin: true,
      fullNameArabic: true,
    },
  },
  creator: {
    select: {
      id: true,
      fullNameLatin: true,
      fullNameArabic: true,
    },
  },
} as const;

// ─── Create a task ────────────────────────────────────────────────────────────

export async function createTask(input: CreateTaskServiceInput) {
  // Validate memberId references a real member when provided
  if (input.memberId) {
    const member = await prisma.member.findFirst({
      where: { id: input.memberId, deletedAt: null },
      select: { id: true },
    });
    if (!member) {
      throw new TaskError('NOT_FOUND', 'Member not found', 404);
    }
  }

  // Validate assignedTo references a real user when provided
  if (input.assignedTo) {
    const user = await prisma.user.findFirst({
      where: { id: input.assignedTo, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new TaskError('NOT_FOUND', 'Assigned user not found', 404);
    }
  }

  const task = await prisma.task.create({
    data: {
      type: input.type,
      memberId: input.memberId ?? null,
      assignedTo: input.assignedTo ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      status: 'open',
    },
    include: taskInclude,
  });

  return task;
}

// ─── List tasks with optional filtering ──────────────────────────────────────

export async function listTasks(query: ListTasksQuery) {
  const where: Prisma.TaskWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.memberId) {
    where.memberId = query.memberId;
  }

  if (query.assignedTo) {
    where.assignedTo = query.assignedTo;
  }

  const skip = (query.page - 1) * query.limit;

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: query.limit,
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, total, page: query.page, limit: query.limit };
}
