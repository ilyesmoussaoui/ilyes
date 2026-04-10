import { useEffect, type RefObject } from 'react';

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isActive: boolean,
): void {
  useEffect(() => {
    if (!isActive) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    focusable[0]?.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener('keydown', handleKey);
    return () => {
      container.removeEventListener('keydown', handleKey);
      previouslyFocused?.focus?.();
    };
  }, [containerRef, isActive]);
}
