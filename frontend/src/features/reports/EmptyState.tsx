import { useTranslation } from 'react-i18next';
import { BarChart3Icon } from '../../components/ui/Icon';

interface ReportEmptyStateProps {
  message?: string;
  height?: number;
}

export function ReportEmptyState({
  message,
  height = 400,
}: ReportEmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/50"
      style={{ height }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
        <BarChart3Icon size={28} className="text-neutral-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-600">
          {message ?? t('common.empty.noData')}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {t('common.empty.tryDifferentFilter')}
        </p>
      </div>
    </div>
  );
}
