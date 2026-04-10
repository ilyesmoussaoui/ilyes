import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import type { ToastItem, ToastType } from '../../types/ui';
import { ToastContext } from '../../hooks/useToast';
import { CheckIcon, AlertIcon, InfoIcon, XIcon } from './Icon';

const MAX_STACK = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setItems((prev) => {
      const next = [...prev, { ...toast, id }];
      return next.slice(-MAX_STACK);
    });
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            role="region"
            aria-label="Notifications"
            className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-sm flex-col gap-2"
          >
            {items.map((t) => (
              <ToastItemView key={t.id} item={t} onDismiss={dismiss} />
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

interface ToastItemViewProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

const STYLES: Record<ToastType, { classes: string; iconWrap: string; icon: ReactNode }> = {
  success: {
    classes: 'border-success/30 bg-white',
    iconWrap: 'bg-success-bg text-success',
    icon: <CheckIcon size={16} />,
  },
  error: {
    classes: 'border-danger/30 bg-white',
    iconWrap: 'bg-danger-bg text-danger',
    icon: <AlertIcon size={16} />,
  },
  warning: {
    classes: 'border-warning/30 bg-white',
    iconWrap: 'bg-warning-bg text-warning',
    icon: <AlertIcon size={16} />,
  },
  info: {
    classes: 'border-info/30 bg-white',
    iconWrap: 'bg-info-bg text-info',
    icon: <InfoIcon size={16} />,
  },
};

function ToastItemView({ item, onDismiss }: ToastItemViewProps) {
  const { type, title, description, duration = 4000, id } = item;
  const config = STYLES[type];

  useEffect(() => {
    if (duration <= 0) return;
    const timer = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, id, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 shadow-elevation-2 animate-toast-in',
        config.classes,
      )}
    >
      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', config.iconWrap)}>
        {config.icon}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {description && <p className="mt-0.5 text-xs text-neutral-600">{description}</p>}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
