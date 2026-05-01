/**
 * Print helpers.
 *
 * Usage:
 *   printReceipt();              // 80mm thermal mode, auto-cleans on after-print
 *   printDocument();             // A4 document mode
 *   setPrintMode('receipt');     // manual mode toggle
 *
 * The helpers apply a class to <body> so `src/styles/print.css` can switch
 * between receipt / document / default layouts, fire `window.print()`, and
 * clear the class after the print dialog closes.
 */

export type PrintMode = 'receipt' | 'document' | null;

const MODE_CLASS_MAP: Record<Exclude<PrintMode, null>, string> = {
  receipt: 'print-mode-receipt',
  document: 'print-mode-document',
};

export function setPrintMode(mode: PrintMode): void {
  if (typeof document === 'undefined') return;
  const classes = Object.values(MODE_CLASS_MAP);
  document.body.classList.remove(...classes);
  if (mode) document.body.classList.add(MODE_CLASS_MAP[mode]);
}

function runPrint(mode: Exclude<PrintMode, null>): void {
  if (typeof window === 'undefined') return;
  setPrintMode(mode);

  const cleanup = () => {
    setPrintMode(null);
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Next tick so the class change applies before print dialog reads styles.
  window.requestAnimationFrame(() => {
    window.print();
    // Safety cleanup for browsers that don't fire afterprint.
    window.setTimeout(cleanup, 2000);
  });
}

export function printReceipt(): void {
  runPrint('receipt');
}

export function printDocument(): void {
  runPrint('document');
}
