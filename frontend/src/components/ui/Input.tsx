import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/cn';
import { CheckIcon, AlertIcon } from './Icon';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string | null;
  isValid?: boolean;
  helperText?: string;
  iconLeft?: ReactNode;
  direction?: 'ltr' | 'rtl';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    isValid,
    helperText,
    iconLeft,
    id,
    className,
    direction = 'ltr',
    disabled,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedById = `${inputId}-desc`;

  const state: 'default' | 'error' | 'valid' = error ? 'error' : isValid ? 'valid' : 'default';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
          {label}
        </label>
      )}
      <div className="relative">
        {iconLeft && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral-400">
            {iconLeft}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          dir={direction}
          disabled={disabled}
          aria-invalid={state === 'error' || undefined}
          aria-describedby={error || helperText ? describedById : undefined}
          className={cn(
            'h-10 w-full rounded-md border bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0',
            iconLeft && 'pl-9',
            (state === 'valid' || state === 'error') && 'pr-9',
            state === 'default' &&
              'border-neutral-300 focus:border-primary-500 focus:ring-primary-200',
            state === 'error' && 'border-danger focus:border-danger focus:ring-danger/30',
            state === 'valid' && 'border-success focus:border-success focus:ring-success/20',
            disabled && 'cursor-not-allowed bg-neutral-100 text-neutral-400',
            direction === 'rtl' && 'font-arabic text-right',
            className,
          )}
          {...rest}
        />
        {state === 'valid' && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-success">
            <CheckIcon size={16} />
          </span>
        )}
        {state === 'error' && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-danger">
            <AlertIcon size={16} />
          </span>
        )}
      </div>
      {(error || helperText) && (
        <p
          id={describedById}
          className={cn('text-xs', error ? 'text-danger' : 'text-neutral-500')}
        >
          {error ?? helperText}
        </p>
      )}
    </div>
  );
});
