import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  SidebarContext,
  SIDEBAR_STORAGE_KEY,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
} from './sidebarContext';

function readInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => readInitialCollapsed());

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v);
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, v ? 'true' : 'false');
    } catch {
      // ignore persistence failures
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'true' : 'false');
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
    document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    // On desktop (≥768px) the sidebar pushes content; on mobile it overlays.
    const isMobile = window.innerWidth < 768;
    document.documentElement.style.setProperty(
      '--sidebar-width-main',
      isMobile ? '0px' : `${width}px`,
    );
  }, [collapsed]);

  // Update --sidebar-width-main on resize.
  useEffect(() => {
    const handler = () => {
      const isMobile = window.innerWidth < 768;
      const width = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
      document.documentElement.style.setProperty(
        '--sidebar-width-main',
        isMobile ? '0px' : `${width}px`,
      );
    };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [collapsed]);

  const value = useMemo(
    () => ({ collapsed, setCollapsed, toggle }),
    [collapsed, setCollapsed, toggle],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
