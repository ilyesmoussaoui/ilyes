import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  action?: ReactNode;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  title,
  action,
  hover,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-200 bg-white shadow-elevation-1',
        hover && 'cursor-pointer transition-shadow hover:shadow-elevation-2 hover:border-neutral-300',
        className,
      )}
      {...rest}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-neutral-100 px-6 py-4">
          {title && <h3 className="text-base font-semibold text-neutral-900">{title}</h3>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={PADDING[padding]}>{children}</div>
    </div>
  );
}
