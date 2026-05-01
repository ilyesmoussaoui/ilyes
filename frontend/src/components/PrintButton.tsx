import { Button } from './ui';
import { Icon } from './ui';
import { printDocument, printReceipt } from '../lib/print';
import type { ButtonVariant, Size } from '../types/ui';

export interface PrintButtonProps {
  /** 'receipt' = 80mm thermal, 'document' = A4. Default: 'receipt'. */
  mode?: 'receipt' | 'document';
  /** Optional label override. Default: "Print". */
  label?: string;
  /** Button size passthrough. */
  size?: Size;
  /** Variant passthrough. Default: 'secondary'. */
  variant?: ButtonVariant;
  /** Optional className for positioning. */
  className?: string;
  /** Callback fired after print() is invoked (not after dialog closes). */
  onAfterPrint?: () => void;
}

/**
 * Accessible Print action. Applies the correct <body> print-mode class, calls
 * window.print(), and cleans up once the dialog closes.
 */
export function PrintButton({
  mode = 'receipt',
  label = 'Print',
  size = 'default',
  variant = 'secondary',
  className,
  onAfterPrint,
}: PrintButtonProps) {
  const handleClick = () => {
    if (mode === 'receipt') printReceipt();
    else printDocument();
    onAfterPrint?.();
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      iconLeft={<Icon name="printer" size={14} />}
      aria-label={label}
    >
      {label}
    </Button>
  );
}
