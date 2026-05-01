import { useCallback, useEffect, useState } from 'react';
import { Button, Card } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { Skeleton } from '../../components/ui/Skeleton';
import { Icon } from '../../components/ui';
import { CheckIcon } from '../../components/ui/Icon';
import {
  fetchNotificationSettings,
  updateNotificationSettings,
  type NotificationSetting,
} from './settingsApi';
import { api, ApiError } from '../../lib/api';
import { cn } from '../../lib/cn';

const TYPE_LABELS: Record<string, string> = {
  subscription_expiring: 'Subscription expiring',
  payment_due: 'Payment due',
  document_expiring: 'Document expiring',
  birthday: 'Member birthday',
  general: 'General announcements',
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  subscription_expiring: 'Alert when an active subscription is about to end.',
  payment_due: 'Alert when a member has an outstanding balance on an invoice.',
  document_expiring: 'Alert when a required document is nearing expiry.',
  birthday: "Remind staff of today's member birthdays.",
  general: 'Generic one-off notifications raised from other parts of the app.',
};

function labelFor(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

export function NotificationsSettings() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotificationSettings();
      setSettings(data.settings);
      setDirty(false);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load notification settings';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleEnabled = (id: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s)),
    );
    setDirty(true);
  };

  const updateDaysBefore = (id: string, value: string) => {
    const days = value === '' ? null : parseInt(value, 10);
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, daysBefore: days } : s)),
    );
    setDirty(true);
  };

  const updateTemplate = (id: string, template: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, template } : s)),
    );
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateNotificationSettings(settings);
      setSettings(data.settings);
      setDirty(false);
      toast.show({
        type: 'success',
        title: 'Notification settings saved',
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to save';
      toast.show({ type: 'error', title: 'Save failed', description: message });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const summary = await api.post<{
        subscription_expiring: number;
        document_expiring: number;
        payment_due: number;
        birthday: number;
        total: number;
      }>('/notifications/generate', {});
      toast.show({
        type: summary.total > 0 ? 'success' : 'info',
        title: summary.total > 0 ? `Generated ${summary.total} notification${summary.total === 1 ? '' : 's'}` : 'Nothing to notify',
        description:
          summary.total > 0
            ? `Subs ${summary.subscription_expiring} · Docs ${summary.document_expiring} · Payments ${summary.payment_due} · Birthdays ${summary.birthday}`
            : 'No lifecycle events matched the current rules.',
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Generation failed';
      toast.show({ type: 'error', title: 'Generation failed', description: message });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton variant="text" lines={1} width="200px" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm font-semibold text-neutral-800">
            Failed to load notification settings
          </p>
          <p className="text-xs text-neutral-500">{error}</p>
          <Button variant="secondary" onClick={load}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (settings.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Icon name="bell" size={28} className="text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-800">
            No notification types configured
          </p>
          <p className="text-xs text-neutral-500">
            Notification types are managed from the backend database.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Notification Preferences</h2>
          <p className="text-sm text-neutral-600">
            Configure how and when notifications are sent. The generator runs daily at 07:00.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="text-xs font-medium text-warning-fg">Unsaved changes</span>
          )}
          <Button
            variant="secondary"
            onClick={() => { void handleGenerate(); }}
            loading={generating}
            disabled={dirty}
          >
            Run generator now
          </Button>
        </div>
      </div>

      {/* Notification cards */}
      <div className="space-y-4">
        {settings.map((setting) => (
          <Card key={setting.id} padding="md">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                {/* Toggle */}
                <label className="mt-0.5 inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={setting.isEnabled}
                    onChange={() => toggleEnabled(setting.id)}
                    className="sr-only"
                    aria-label={`Enable ${setting.type}`}
                  />
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
                      setting.isEnabled
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-neutral-300 bg-white hover:border-neutral-400',
                    )}
                  >
                    {setting.isEnabled && <CheckIcon size={12} />}
                  </span>
                </label>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-900">{labelFor(setting.type)}</p>
                  {TYPE_DESCRIPTIONS[setting.type] && (
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {TYPE_DESCRIPTIONS[setting.type]}
                    </p>
                  )}
                  {setting.daysBefore !== null && (
                    <div className="mt-2 flex items-center gap-2">
                      <label
                        htmlFor={`days-${setting.id}`}
                        className="text-xs text-neutral-600 whitespace-nowrap"
                      >
                        Days before:
                      </label>
                      <input
                        id={`days-${setting.id}`}
                        type="number"
                        min="0"
                        max="365"
                        value={setting.daysBefore ?? ''}
                        onChange={(e) => updateDaysBefore(setting.id, e.target.value)}
                        disabled={!setting.isEnabled}
                        className="h-8 w-20 rounded-md border border-neutral-300 bg-white px-2 text-center text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-neutral-100"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Template */}
            <div className="mt-3">
              <label
                htmlFor={`template-${setting.id}`}
                className="mb-1 block text-xs font-medium text-neutral-600"
              >
                Message Template
              </label>
              <textarea
                id={`template-${setting.id}`}
                rows={3}
                value={setting.template ?? ''}
                onChange={(e) => updateTemplate(setting.id, e.target.value)}
                disabled={!setting.isEnabled}
                placeholder="Notification message template..."
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} loading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}
