import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './components/ui';
import { AppBootstrap } from './app/AppBootstrap';
import { SyncProvider } from './app/SyncProvider';
import { UpdatePrompt } from './components/UpdatePrompt';
import { router } from './app/router';
import './i18n';
import './styles/globals.css';
import './styles/print.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Refetch whenever a component mounts (navigation, route change).
      // This is critical for an ERP where users expect to see up-to-date data
      // after making changes in another module (e.g. inventory → POS, POS → reports).
      refetchOnMount: 'always',
      // Refetch when the user returns to the tab so stale data never lingers.
      refetchOnWindowFocus: true,
      // Short stale window so rapid re-renders within the same view don't spam the API.
      staleTime: 10_000,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SyncProvider>
          <AppBootstrap>
            <RouterProvider router={router} />
            <UpdatePrompt />
          </AppBootstrap>
        </SyncProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
