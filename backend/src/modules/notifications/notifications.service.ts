import type { Notification, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { ListNotificationsQuery } from './notifications.types.js';

// ─── Error class ─────────────────────────────────────────────────────────────

export class NotificationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationWithMember = Notification & {
  member: {
    id: string;
    firstNameLatin: string | null;
    lastNameLatin: string | null;
    firstNameArabic: string | null;
    lastNameArabic: string | null;
  } | null;
};

type PaginatedNotifications = {
  data: NotificationWithMember[];
  total: number;
  page: number;
  totalPages: number;
};

// ─── List notifications ──────────────────────────────────────────────────────

export async function listNotifications(
  query: ListNotificationsQuery,
): Promise<PaginatedNotifications> {
  const { page, limit, type, isRead, memberId } = query;

  const where: Prisma.NotificationWhereInput = {
    deletedAt: null,
  };

  if (type) {
    where.type = type;
  }

  if (isRead !== undefined) {
    where.isRead = isRead;
  }

  if (memberId) {
    where.memberId = memberId;
  }

  const [total, data] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            firstNameLatin: true,
            lastNameLatin: true,
            firstNameArabic: true,
            lastNameArabic: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ─── Unread count ─────────────────────────────────────────────────────────────

export async function getUnreadCount(): Promise<number> {
  return prisma.notification.count({
    where: {
      isRead: false,
      deletedAt: null,
    },
  });
}

// ─── Mark notification as read ───────────────────────────────────────────────

export async function markNotificationRead(
  id: string,
): Promise<Notification> {
  const notification = await prisma.notification.findFirst({
    where: { id, deletedAt: null },
  });

  if (!notification) {
    throw new NotificationError('NOT_FOUND', 'Notification not found', 404);
  }

  return prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
}

// ─── Mark all notifications as read ──────────────────────────────────────────

export async function markAllNotificationsRead(): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { isRead: false, deletedAt: null },
    data: { isRead: true },
  });
  return result.count;
}
