# Part 2 — Dashboard (Home Screen) Fix Plan

## Goal
Make the Dashboard fully functional after login: working global search, facial-search toggle, filters, and 7 notification-alert card types wired to real data.

## Current State (audit)
- `frontend/src/features/dashboard/DashboardPage.tsx` is a placeholder.
- `frontend/src/app/Header.tsx` has a search `<input>` with no handlers, a **disabled** camera button ("coming soon"), no filter control, and a hard-coded "3 unread" badge.
- Backend has `GET /api/v1/members/search?q=` (members only) and `GET /api/v1/notifications` (5 types in enum).
- `AttendanceRecord`, `Document`, `DocumentRequirement`, `Equipment.stockQuantity`, `Subscription.endDate` all exist — sufficient to compute all 7 alert categories on-demand without new tables.
- `face-service/` (FastAPI, port 8001) already exists with `/match` endpoint.

## Architecture Decisions
1. **Dashboard alerts are computed on read**, not stored in the `Notification` table. Single endpoint returns all 7 categories in one response.
2. **Global search** is a new unified endpoint (members + payments by receipt # + equipment by name) with `scope` filter parameter.
3. **Facial search** reuses existing `face-service`. Backend exposes a thin proxy for identification searches; frontend adds a capture modal behind the icon toggle.
4. **Card click → member profile with highlight**: `/members/:id?highlight=<section>` — profile reads the query param and scrolls to/highlights the matching panel.
5. No new DB migrations required. No enum extensions required.

## API Contracts

### `GET /api/v1/dashboard/alerts`
Returns all seven categories. Each member-based entry carries fields needed to render a card.
```ts
{
  subscriptionsExpiring: AlertMember[];   // endDate within N days (default 14)
  unpaidBalance:         AlertMember[];   // outstanding > 0
  renewalNeeded:         AlertMember[];   // subscription expired (endDate < today)
  missingDocuments:      AlertMember[];   // missing any required doc
  inactiveMembers:       AlertMember[];   // no attendance in N days (default 30)
  absentToday:           AlertMember[];   // active member, no check-in today
  stockOut:              AlertStockItem[];// equipment with stockQuantity <= 0
}

AlertMember = {
  memberId: string;
  firstNameLatin: string;
  lastNameLatin: string;
  photoPath: string | null;
  discipline: string | null;     // primary discipline name
  renewalDate: string | null;    // subscription.endDate ISO
  extra?: Record<string, unknown>; // e.g., { balanceDue, daysInactive, missingDocTypes }
}
```
Query params: `expiringWindowDays` (default 14), `inactiveThresholdDays` (default 30), `limitPerCategory` (default 20).

### `GET /api/v1/search?q=<query>&scope=all|members|payments|products`
Grouped results. Debounce 250ms on client. Min 2 chars. Limit 10 per group.

### `POST /api/v1/search/face` (multipart/form-data, field `image`)
Proxies face-service `/match`. Returns top-N member matches with confidence.

## Task Breakdown

### Design (lead-designer)
- **D1** Visual specs for: alert card (member + stock variants, severity colors per category), grouped search dropdown, filter/scope selector, facial-search active state + capture modal.

### Database (db-architect)
- **DB1** Index review for alerts queries; add migration only if indexes are missing.

### Backend (backend-dev)
- **B1** `GET /api/v1/dashboard/alerts` — service computes all 7 categories; Zod response.
- **B2** `GET /api/v1/search` — unified search (members, payments, equipment) with scope filter.
- **B3** `POST /api/v1/search/face` — proxy to face-service; 5MB cap; image-type validation.
- **B4** `GET /api/v1/notifications/unread-count`.

### Frontend (frontend-dev)
- **F1** Header global search: controlled input, 250ms debounce, calls `/api/v1/search`, grouped dropdown, keyboard nav, click → route to hit.
- **F2** Scope filter dropdown next to search input.
- **F3** Facial-search icon: click toggles active state; opens camera modal; POST capture to `/api/v1/search/face`; show match list.
- **F4** Notification bell reads `/api/v1/notifications/unread-count`.
- **F5** Replace Dashboard placeholder with 7 alert sections; shared `AlertCard` (photo + name + renewalDate + discipline); `StockAlertCard` variant; empty states + skeletons.
- **F6** Member profile highlights `?highlight=<section>` param (scroll + transient highlight).

### QA (qa-engineer)
- **T1** Backend tests for `/dashboard/alerts`, `/search`, `/search/face` (mock face-service).
- **T2** Frontend integration tests (search debounce, scope filter, bell count, card click).
- **T3** Playwright e2e: dashboard alerts render; card click → profile with section highlight; search as-you-type; facial toggle opens modal.

### Gates
- **R1** code-reviewer (veto)
- **R2** security-auditor (veto)

## Execution Order
1. Parallel: D1 + DB1 (specs).
2. Parallel: B1–B4 (separate files, no conflicts).
3. Parallel: F1–F6 (separate files, after backend endpoints).
4. T1 alongside backend; T2–T3 after frontend.
5. R1 + R2 before merge.

## Definition of Done
- Search-as-you-type returns grouped live results with working scope filter.
- Facial-search icon toggles; active state opens camera; capture returns member matches.
- Dashboard shows 7 alert sections with real data and correct card fields; empty states handled.
- Any card click lands on the correct member profile with the section highlighted.
- Notification bell shows a real unread count.
- All tests pass; code + security review approved.
