import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Input } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { Skeleton } from '../../components/ui/Skeleton';
import { UploadIcon } from '../../components/ui/Icon';
import { fetchSettings, updateSettings, type ClubSettings } from './settingsApi';
import { ApiError } from '../../lib/api';

const EMPTY_SETTINGS: ClubSettings = {
  club_name: '',
  club_phone: '',
  club_email: '',
  club_address: '',
  club_city: '',
  club_logo: null,
  receipt_header: '',
  receipt_footer: '',
};

export function GeneralSettings() {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ClubSettings>(EMPTY_SETTINGS);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSettings();
      setForm(data.settings);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('settings.general.loadFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (field: keyof ClubSettings, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await updateSettings(form);
      setForm(data.settings);
      toast.show({
        type: 'success',
        title: t('settings.general.saved'),
        description: t('settings.general.savedDesc'),
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : t('settings.general.saveFailed');
      toast.show({ type: 'error', title: t('settings.general.saveFailed'), description: message });
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleLogoFile(file);
  };

  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.show({ type: 'error', title: t('settings.general.invalidFile'), description: t('settings.general.invalidFileDesc') });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, club_logo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
            <span className="text-xl font-bold">!</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-800">{t('settings.general.loadFailed')}</p>
            <p className="mt-1 text-xs text-neutral-500">{error}</p>
          </div>
          <Button variant="secondary" onClick={load}>
            {t('common.actions.retry')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Club Information */}
      <Card title={t('settings.general.clubInfo')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('settings.general.clubName')}
            value={form.club_name}
            onChange={(e) => handleChange('club_name', e.target.value)}
            placeholder={t('settings.general.clubNamePlaceholder')}
          />
          <Input
            label={t('settings.general.phone')}
            value={form.club_phone}
            onChange={(e) => handleChange('club_phone', e.target.value)}
            placeholder={t('settings.general.phonePlaceholder')}
          />
          <Input
            label={t('settings.general.email')}
            type="email"
            value={form.club_email}
            onChange={(e) => handleChange('club_email', e.target.value)}
            placeholder={t('settings.general.emailPlaceholder')}
          />
          <Input
            label={t('settings.general.city')}
            value={form.club_city}
            onChange={(e) => handleChange('club_city', e.target.value)}
            placeholder={t('settings.general.cityPlaceholder')}
          />
          <div className="sm:col-span-2">
            <Input
              label={t('settings.general.address')}
              value={form.club_address}
              onChange={(e) => handleChange('club_address', e.target.value)}
              placeholder={t('settings.general.addressPlaceholder')}
            />
          </div>
        </div>
      </Card>

      {/* Logo */}
      <Card title={t('settings.general.logo')}>
        <div className="flex items-start gap-6">
          {form.club_logo ? (
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-neutral-200">
              <img
                src={form.club_logo}
                alt={t('settings.general.logoPreviewAlt')}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, club_logo: null }))}
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900/60 text-white transition-colors hover:bg-neutral-900/80"
                aria-label={t('settings.general.removeLogo')}
              >
                <span className="text-xs">&times;</span>
              </button>
            </div>
          ) : null}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={t('settings.general.uploadLogo')}
            className={`flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
              dragActive
                ? 'border-primary-400 bg-primary-50'
                : 'border-neutral-300 hover:border-primary-300 hover:bg-neutral-50'
            }`}
          >
            <UploadIcon size={28} className="text-neutral-400" />
            <p className="text-sm font-medium text-neutral-700">
              {t('settings.general.dragDropUpload')}
            </p>
            <p className="text-xs text-neutral-500">{t('settings.general.fileTypes')}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoFile(file);
            }}
          />
        </div>
      </Card>

      {/* Receipt Templates */}
      <Card title={t('settings.general.receiptTemplates')}>
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="receipt-header" className="text-sm font-medium text-neutral-700">
              {t('settings.general.receiptHeader')}
            </label>
            <textarea
              id="receipt-header"
              rows={3}
              value={form.receipt_header}
              onChange={(e) => handleChange('receipt_header', e.target.value)}
              placeholder={t('settings.general.receiptHeaderPlaceholder')}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="receipt-footer" className="text-sm font-medium text-neutral-700">
              {t('settings.general.receiptFooter')}
            </label>
            <textarea
              id="receipt-footer"
              rows={3}
              value={form.receipt_footer}
              onChange={(e) => handleChange('receipt_footer', e.target.value)}
              placeholder={t('settings.general.receiptFooterPlaceholder')}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={handleSave} loading={saving}>
          {t('settings.general.save')}
        </Button>
      </div>
    </div>
  );
}
