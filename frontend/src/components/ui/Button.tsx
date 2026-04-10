import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { ButtonVariant, Size } from '../../types/ui';
import { SpinnerIcon } from './Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-600 shadow-elevation-1 hover:shadow-elevation-2',
  secondary:
    'bg-white text-primary-600 border border-primary-300 hover:bg-primary-50 active:bg-primary-100',
  danger:
    'bg-danger text-white hover:bg-danger-fg shadow-elevation-1 hover:shadow-elevation-2',
  ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200',
  disabled: 'bg-neutral-200 text-neutral-400 cursor-not-allowed shadow-none',
};

const SIZE_STYLES: Record<Size, string> = {
  default: 'h-10 px-4 text-sm gap-2',
  touch: 'h-12 px-5 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'default',
    loading = false,
    disabled = false,
    iconLeft,
    iconRight,
    fullWidth,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading || variant === 'disabled';
  const forceDisabledLook = isDisabled && variant !== 'disabled';

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed',
        SIZE_STYLES[size],
        forceDisabledLook
          ? 'bg-neutral-200 text-neutral-400 shadow-none hover:bg-neutral-200'
          : VARIANT_STYLES[variant],
        fullWidth && 'w-full',
        className,
      )}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <SpinnerIcon size={16} aria-label="Loading" />
      ) : (
        iconLeft && <span className="flex shrink-0 items-center">{iconLeft}</span>
      )}
      <span>{children}</span>
      {!loading && iconRight && <span className="flex shrink-0 items-center">{iconRight}</span>}
    </button>
  );
});
