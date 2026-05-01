import { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth } from './RequireAuth';
import { RequirePermission } from './RequireRole';
import { SpinnerIcon } from '../components/ui/Icon';

import { LoginPage } from '../features/auth/LoginPage';
import { LockScreenPage } from '../features/auth/LockScreenPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { MembersPage } from '../features/members/MembersPage';

// eslint-disable-next-line react-refresh/only-export-components
const KioskPage = lazy(() =>
  import('../features/kiosk/KioskPage').then((m) => ({ default: m.KioskPage })),
);

// eslint-disable-next-line react-refresh/only-export-components
const AddMemberPage = lazy(() =>
  import('../features/members/AddMemberPage').then((m) => ({ default: m.AddMemberPage })),
);

// eslint-disable-next-line react-refresh/only-export-components
const MemberProfilePage = lazy(() =>
  import('../features/members/profile/MemberProfilePage').then((m) => ({
    default: m.MemberProfilePage,
  })),
);

// eslint-disable-next-line react-refresh/only-export-components
const EditMemberPage = lazy(() =>
  import('../features/members/edit/EditMemberPage').then((m) => ({
    default: m.EditMemberPage,
  })),
);

const lazyFallback = (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-[320px] items-center justify-center text-neutral-400"
  >
    <SpinnerIcon size={24} />
    <span className="sr-only">Loading</span>
  </div>
);
import { AttendancePage } from '../features/attendance/AttendancePage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { PosPage } from '../features/pos/PosPage';
import { PaymentsPage } from '../features/payments/PaymentsPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';

// eslint-disable-next-line react-refresh/only-export-components
const ExpensesPage = lazy(() =>
  import('../features/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })),
);
import { NotFoundPage } from '../pages/NotFoundPage';
import { DesignSystemPage } from '../pages/DesignSystemPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/lock', element: <LockScreenPage /> },
  { path: '/_design-system', element: <DesignSystemPage /> },
  {
    path: '/kiosk',
    element: (
      <RequireAuth>
        {/* TODO: tighten permission — kiosk has no MENU_ITEMS entry; using attendance:view as closest semantic match */}
        <RequirePermission resource="attendance" action="view">
          <Suspense fallback={lazyFallback}>
            <KioskPage />
          </Suspense>
        </RequirePermission>
      </RequireAuth>
    ),
  },
  {
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: '/dashboard',
        element: (
          <RequirePermission resource="dashboard" action="view">
            <DashboardPage />
          </RequirePermission>
        ),
      },
      {
        path: '/members',
        element: (
          <RequirePermission resource="members" action="view">
            <MembersPage />
          </RequirePermission>
        ),
      },
      {
        path: '/members/add',
        element: (
          <RequirePermission resource="members" action="create">
            <Suspense fallback={lazyFallback}>
              <AddMemberPage />
            </Suspense>
          </RequirePermission>
        ),
      },
      {
        path: '/members/:id',
        element: (
          <RequirePermission resource="members" action="view">
            <Suspense fallback={lazyFallback}>
              <MemberProfilePage />
            </Suspense>
          </RequirePermission>
        ),
      },
      {
        path: '/members/:id/edit',
        element: (
          <RequirePermission resource="members" action="edit">
            <Suspense fallback={lazyFallback}>
              <EditMemberPage />
            </Suspense>
          </RequirePermission>
        ),
      },
      {
        path: '/attendance',
        element: (
          <RequirePermission resource="attendance" action="view">
            <AttendancePage />
          </RequirePermission>
        ),
      },
      {
        path: '/sessions',
        element: (
          <RequirePermission resource="sessions" action="view">
            <SessionsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/pos',
        element: (
          <RequirePermission resource="pos" action="view">
            <PosPage />
          </RequirePermission>
        ),
      },
      {
        path: '/payments',
        element: (
          <RequirePermission resource="payments" action="view">
            <PaymentsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/inventory',
        element: (
          <RequirePermission resource="inventory" action="view">
            <InventoryPage />
          </RequirePermission>
        ),
      },
      {
        path: '/reports',
        element: (
          <RequirePermission resource="reports" action="view">
            <ReportsPage />
          </RequirePermission>
        ),
      },
      {
        path: '/expenses',
        element: (
          <RequirePermission resource="expenses" action="view">
            <Suspense fallback={lazyFallback}>
              <ExpensesPage />
            </Suspense>
          </RequirePermission>
        ),
      },
      {
        path: '/settings',
        element: (
          <RequirePermission resource="settings" action="view">
            <SettingsPage />
          </RequirePermission>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
