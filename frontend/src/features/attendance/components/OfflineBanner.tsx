import { useTranslation } from 'react-i18next';
import { AlertIcon } from '../../../components/ui/Icon';

interface OfflineBannerProps {
  visible: boolean;
}

export function OfflineBanner({ visible }: OfflineBannerProps) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-4 flex items-center gap-3 rounded-lg border border-warning/30 bg-warning-bg px-4 py-3 text-sm font-medium text-warning-fg shadow-elevation-1"
    >
      <AlertIcon size={18} className="shrink-0 text-warning" aria-hidden="true" />
      <span>{t('attendance.offline.banner')}</span>
    </div>
  );
}
