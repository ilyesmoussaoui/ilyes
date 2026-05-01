import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/cn';
import { AlertIcon } from './Icon';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  compact?: boolean;
}

/**
 * ErrorState — human-readable error display for async failures.
 * Never surfaces raw error objects. Accepts an optional `error` that is
 * safely coerced to a string if the caller wants to show the message.
 */
export function ErrorState({
  title,
  description,
  error,
  onRetry,
  retryLabel,
  className,
  compact = false,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const fallback = coerceErrorMessage(error);
  const resolvedTitle = title ?? t('common.messages.somethingWrong');
  const resolvedRetryLabel = retryLabel ?? t('common.actions.tryAgain');
  const body = description ?? fallback ?? t('common.messages.tryAgainLater');

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-3 px-4 py-10' : 'gap-4 px-4 py-16 sm:py-20',
        'rounded-lg border border-dashed border-danger/30 bg-danger-bg/30',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-danger-bg text-danger',
          compact ? 'h-12 w-12' : 'h-14 w-14',
        )}
      >
        <AlertIcon size={compact ? 22 : 26} />
      </div>
      <div className="max-w-md space-y-1.5">
        <h3 className={cn('font-semibold text-neutral-800', compact ? 'text-base' : 'text-lg')}>
          {resolvedTitle}
        </h3>
        <p className={cn('text-neutral-600', compact ? 'text-xs' : 'text-sm')}>{body}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {resolvedRetryLabel}
        </Button>
      )}
    </div>
  );
}

function coerceErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message && err.message !== 'undefined') return err.message;
  if (typeof err === 'object' && err !== null) {
    const maybe = err as { message?: unknown };
    if (typeof maybe.message === 'string' && maybe.message !== 'undefined') return maybe.message;
  }
  return null;
}
