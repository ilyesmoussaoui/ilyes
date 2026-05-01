import { api } from '../../lib/api';

export type NotificationType =
  | 'subscription_expiring'
  | 'payment_due'
  | 'document_expiring'
  | 'birthday'
  | 'general';

export interface NotificationMemberSummary {
  id: string;
  firstNameLatin: string | null;
  lastNameLatin: string | null;
  firstNameArabic: string | null;
  lastNameArabic: string | null;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  memberId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
  member: NotificationMemberSummary | null;
}

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  type?: NotificationType;
  isRead?: boolean;
}

export interface ListNotificationsResponse {
  data: NotificationItem[];
  total: number;
  page: number;
  totalPages: number;
}

export function listNotifications(params: ListNotificationsParams = {}) {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.type) qs.set('type', params.type);
  if (params.isRead !== undefined) qs.set('isRead', String(params.isRead));
  const query = qs.toString();
  return api.get<ListNotificationsResponse>(
    `/notifications${query ? `?${query}` : ''}`,
  );
}

export function fetchUnreadCount() {
  return api.get<{ count: number }>('/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return api.patch<{ notification: NotificationItem }>(
    `/notifications/${id}/read`,
    {},
  );
}

export function markAllNotificationsRead() {
  return api.post<{ updated: number }>('/notifications/mark-all-read', {});
}
