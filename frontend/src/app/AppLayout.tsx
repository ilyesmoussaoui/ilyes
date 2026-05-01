import { useCallback, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { SidebarProvider } from './SidebarProvider';
import { useAuthStore } from '../features/auth/authStore';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { useSidebar } from './sidebarContext';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function AppLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const setLocked = useAuthStore((s) => s.setLocked);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { collapsed, setCollapsed } = useSidebar();

  const onIdle = useCallback(() => {
    if (!useAuthStore.getState().isAuthenticated) return;
    setLocked(true);
    navigate('/lock', { state: { from: location.pathname }, replace: true });
  }, [navigate, location.pathname, setLocked]);

  useIdleTimer({
    timeoutMs: IDLE_TIMEOUT_MS,
    onIdle,
    enabled: isAuthenticated,
  });

  // On small screens, auto-collapse the sidebar when the route changes
  // (i.e. after navigating to a page, close the drawer).
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile && !collapsed) {
      setCollapsed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close sidebar on mobile when clicking the overlay.
  const handleOverlayClick = useCallback(() => {
    setCollapsed(true);
  }, [setCollapsed]);

  // Auto-collapse on initial load for mobile.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    // Run once on mount to set correct initial state.
    if (window.innerWidth < 768) {
      setCollapsed(true);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setCollapsed]);

  // On mobile, the sidebar overlays the content (drawer style).
  // On desktop, the sidebar pushes the content to the right.
  const isSidebarOpen = !collapsed;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <Sidebar />

      {/* Mobile overlay — tap to close sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={handleOverlayClick}
        />
      )}

      <main
        className="h-[calc(100vh-56px)] overflow-y-auto transition-[margin] duration-200 ease-out"
        style={{
          marginTop: '56px',
          // On desktop: respect sidebar width. On mobile (< 768px): no left margin.
          marginLeft: 'var(--sidebar-width-main, 0px)',
          padding: '24px',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppLayoutInner />
    </SidebarProvider>
  );
}
