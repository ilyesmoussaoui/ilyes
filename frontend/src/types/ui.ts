import type { ReactNode } from 'react';

export type Size = 'default' | 'touch';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'disabled';

export type BadgeVariant =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'expired'
  | 'pending'
  | 'paid'
  | 'partial'
  | 'unpaid';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

export interface TableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}
