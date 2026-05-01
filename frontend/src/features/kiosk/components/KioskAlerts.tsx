import { AlertIcon, InfoIcon } from '../../../components/ui/Icon';
import { cn } from '../../../lib/cn';

export type AlertType = 'error' | 'warning' | 'info';

interface KioskAlertsProps {
  type: AlertType;
  message: string;
  onDismiss?: () => void;
}

const ALERT_STYLES: Record<AlertType, string> = {
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  info: 'border-primary-500/40 bg-primary-500/10 text-primary-300',
};

const ALERT_ICONS: Record<AlertType, typeof AlertIcon> = {
  error: AlertIcon,
  warning: AlertIcon,
  info: InfoIcon,
};

export function KioskAlerts({ type, message, onDismiss }: KioskAlertsProps) {
  const IconComponent = ALERT_ICONS[type];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-3 rounded-xl border px-5 py-4 text-lg',
        ALERT_STYLES[type],
      )}
    >
      <IconComponent size={24} className="shrink-0" />
      <span className="flex-1 font-medium">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="Dismiss alert"
        >
          <span aria-hidden="true" className="text-xl leading-none">&times;</span>
        </button>
      )}
    </div>
  );
}
