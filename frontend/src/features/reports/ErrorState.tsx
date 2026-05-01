import { useTranslation } from 'react-i18next';
import { AlertIcon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Button';

interface ReportErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ReportErrorState({
  message,
  onRetry,
}: ReportErrorStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-danger/30 bg-danger-bg/30 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg">
        <AlertIcon size={24} className="text-danger" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-neutral-800">
          {message ?? t('common.messages.somethingWrong')}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {t('common.messages.tryAgainLater')}
        </p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t('common.actions.tryAgain')}
        </Button>
      )}
    </div>
  );
}
