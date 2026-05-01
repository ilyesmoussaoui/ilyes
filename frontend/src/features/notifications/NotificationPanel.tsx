import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../components/ui';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';
import { ApiError } from '../../lib/api';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
  type NotificationType,
} from './notificationsApi';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange: (count: number) => void;
}

const TYPE_META: Record<NotificationType, { icon: string; tone: string }> = {
  subscription_expiring: { icon: 'clock', tone: 'text-warning-fg bg-warning-bg' },
  payment_due: { icon: 'credit-card', tone: 'text-danger-fg bg-danger-bg' },
  document_expiring: { icon: 'file-text', tone: 'text-info-fg bg-info-bg' },
  birthday: { icon: 'calendar', tone: 'text-primary-600 bg-primary-50' },
  general: { icon: 'bell', tone: 'text-neutral-600 bg-neutral-100' },
};

const TYPE_KEY: Record<NotificationType, string> = {
  subscription_expiring: 'notifications.types.subscription_expiring',
  payment_due: 'notifications.types.payment_due',
  document_expiring: 'notifications.types.document_expiring',
  birthday: 'notifications.types.birthday',
  general: 'notifications.types.general',
};

function useFormatRelative() {
  const { t } = useTranslation();
  return useCallback(
    (iso: string): string => {
      const then = new Date(iso).getTime();
      const now = Date.now();
      const seconds = Math.max(0, Math.floor((now - then) / 1000));
      if (seconds < 60) return t('common.time.justNow');
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return t('common.time.minutesAgo', { count: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t('common.time.hoursAgo', { count: hours });
      const days = Math.floor(hours / 24);
      if (days < 7) return t('common.time.daysAgo', { count: days });
      const weeks = Math.floor(days / 7);
      if (weeks < 5) return t('common.time.weeksAgo', { count: weeks });
      return new Date(iso).toLocaleDateString();
    },
    [t],
  );
}

function memberName(member: NotificationItem['member']): string | null {
  if (!member) return null;
  const first = member.firstNameLatin ?? '';
  const last = member.lastNameLatin ?? '';
  const combined = `${first} ${last}`.trim();
  return combined || null;
}

export function NotificationPanel({ open, onClose, onUnreadCountChange }: NotificationPanelProps) {
  const { t } = useTranslation();
  const formatRelative = useFormatRelative();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [marking, setMarking] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listNotifications({ page: 1, limit: 20 });
      setItems(res.data);
      const unread = res.data.filter((n) => !n.isRead).length;
      onUnreadCountChange(unread);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('notifications.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange, t]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleItemClick = async (n: NotificationItem) => {
    if (!n.isRead) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, isRead: true } : it)));
      onUnreadCountChange(items.filter((it) => !it.isRead && it.id !== n.id).length);
      try {
        await markNotificationRead(n.id);
      } catch {
        // Roll back if it fails
        setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, isRead: false } : it)));
      }
    }
    if (n.memberId) {
      navigate(`/members/${n.memberId}`);
      onClose();
    }
  };

  const handleMarkAll = async () => {
    if (marking) return;
    setMarking(true);
    const snapshot = items;
    setItems((prev) => prev.map((it) => ({ ...it, isRead: true })));
    onUnreadCountChange(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      setItems(snapshot);
      onUnreadCountChange(snapshot.filter((it) => !it.isRead).length);
      setError(err instanceof ApiError ? err.message : t('notifications.markAllFailed'));
    } finally {
      setMarking(false);
    }
  };

  if (!open) return null;

  const unreadCount = items.filter((n) => !n.isRead).length;
  const isEmpty = !loading && !error && items.length === 0;

  return (
    <div
      role="dialog"
      aria-label={t('notifications.title')}
      className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-elevation-3 animate-slide-up"
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{t('notifications.title')}</h2>
          <p className="text-xs text-neutral-500">
            {unreadCount > 0 ? t('notifications.unreadCount', { count: unreadCount }) : t('notifications.allCaughtUp')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void handleMarkAll(); }}
          disabled={marking || unreadCount === 0}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
            unreadCount === 0
              ? 'cursor-not-allowed text-neutral-300'
              : 'text-primary-600 hover:bg-primary-50',
            marking && 'opacity-60',
          )}
        >
          {t('notifications.markAllRead')}
        </button>
      </div>

      <div className="max-h-[28rem] overflow-y-auto">
        {loading && (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="row" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Icon name="alert" size={24} className="text-danger" />
            <p className="text-sm font-medium text-neutral-800">{error}</p>
            <button
              type="button"
              onClick={() => { void refresh(); }}
              className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {t('notifications.retry')}
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <Icon name="bell" size={28} className="text-neutral-300" />
            <p className="text-sm font-medium text-neutral-700">{t('notifications.empty.title')}</p>
            <p className="text-xs text-neutral-500">
              {t('notifications.empty.description')}
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="divide-y divide-neutral-100">
            {items.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.general;
              const name = memberName(n.member);
              const actionable = !!n.memberId;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => { void handleItemClick(n); }}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                      'hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none',
                      !n.isRead && 'bg-primary-50/40',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        meta.tone,
                      )}
                      aria-hidden="true"
                    >
                      <Icon name={meta.icon} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                          {t(TYPE_KEY[n.type])}
                        </span>
                        {!n.isRead && (
                          <span
                            aria-label={t('notifications.unread')}
                            className="h-2 w-2 rounded-full bg-primary-500"
                          />
                        )}
                        <span className="ml-auto text-xs text-neutral-400">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-neutral-800 line-clamp-3">
                        {n.message}
                      </p>
                      {(name || actionable) && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                          {name && <span className="truncate">{name}</span>}
                          {actionable && (
                            <span className="inline-flex items-center gap-1 text-primary-600">
                              <Icon name="arrow-right" size={12} />
                              {t('notifications.open')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
