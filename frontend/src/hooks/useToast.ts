import { createContext, useContext } from 'react';
import type { ToastItem } from '../types/ui';

export interface ToastContextValue {
  show: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
