PROJECT EXECUTION BIBLE
Sports Club Management System




Team Structure • Task Breakdown • Quality Gates
14 Parts • 6 Team Members • 1 Gatekeeper








NO PART STARTS UNTIL THE PREVIOUS ONE IS APPROVED
Version 1.0 — April 2026

Table of Contents




1. Your Team — Who You Need
This project requires a core team of 6 people. No more, no less for Phase 1. Here is every role, what they do, and the rules they follow.

1.1 The Team Roster
#
Role
Count
Responsibility
1
Project Lead (You)
1
Assigns tasks, reviews progress daily, approves sprint completion, communicates with client. You do NOT code.
2
Frontend Developer
2
Build all screens, components, forms, and interactions. One senior, one mid-level.
3
Backend Developer
1
Build the API, database, business logic, authentication, and all server-side systems.
4
Facial Recognition Engineer
1
Build the face detection/matching microservice. Works independently, delivers an API the frontend and backend consume.
5
QA Reviewer (The Gatekeeper)
1
Reviews EVERY deliverable before it is accepted. Checks code quality, UI accuracy, performance, and security. Has the power to REJECT work.


1.2 The QA Reviewer — The Gatekeeper
GATEKEEPER RULES — THIS PERSON HAS ABSOLUTE POWER
No code is merged into the main branch without the Gatekeeper’s written approval.
The Gatekeeper does NOT write code. They only review, test, and approve or reject.
Every rejection must include: what is wrong, what the spec says, and what the developer must fix.
The Gatekeeper checks every deliverable against the checklist provided for that sprint (see each Part below).
If the Gatekeeper approves bad work, they are responsible. If they reject good work unfairly, escalate to the Project Lead.
The Gatekeeper tests on: Chrome desktop, Chrome tablet (dev tools), and Chrome mobile (dev tools). All three must pass.
The Gatekeeper runs a performance check on every page: FCP < 1.5s, LCP < 2.5s, CLS < 0.1.
The Gatekeeper verifies keyboard navigation works on every interactive element.
The Gatekeeper verifies every error state, empty state, and loading state exists.


1.3 How the Team Works
WORKFLOW — HOW GOOGLE, STRIPE, AND LINEAR DO IT
1. Project Lead assigns a Part (sprint) from this document.
2. Developers read the Part spec completely before writing a single line of code.
3. Developers work for the sprint duration (typically 5–10 working days per Part).
4. When done, developer opens a Pull Request with screenshots and a self-checklist.
5. Gatekeeper reviews the PR against the Part’s checklist within 24 hours.
6. If rejected: developer fixes and resubmits. No new Part until the current one passes.
7. If approved: Project Lead marks Part as complete. Team moves to the next Part.
8. RULE: No Part is started until the previous Part is fully approved. Sequential delivery.


1.4 Tools Required
Tool
Purpose
Rule
Git + GitHub/GitLab
Version control
One repo, main branch is protected, all work via Pull Requests.
Linear / Jira / Notion
Task tracking
Every task from this document becomes a ticket. No verbal assignments.
Figma
Design reference
If you have a designer, mockups go here. If not, developers reference this document directly.
Discord / Slack
Communication
One channel per Part. Daily 15-min standup message: what I did, what I’ll do, what’s blocking me.
Docker
Deployment
Everything runs in Docker. No ‘it works on my machine’ excuses.


2. Before Any Code — Architecture Decisions
These decisions are made ONCE, before Part 1 begins. The entire team must agree. No changing mid-project.

2.1 Tech Stack (Locked)
Layer
Technology
Why
Frontend
React 18 + TypeScript + Tailwind CSS
Component-based, type-safe, fast styling. Industry standard.
State Management
Zustand + TanStack Query
Zustand for UI state, TanStack Query for server data. Simple, no boilerplate.
Forms
React Hook Form + Zod
Best form library for complex validation. Zod for schema validation.
Tables
TanStack Table
The only table library that handles sorting, filtering, pagination, and virtualization.
Charts
Apache ECharts
Supports every chart type in the spec: heatmaps, funnels, calendar charts, scatter.
Real-time
Socket.IO
WebSocket wrapper for live attendance dashboard updates.
Offline
Workbox + IndexedDB (Dexie.js)
PWA service worker for offline check-ins. Dexie simplifies IndexedDB.
Backend
Node.js + Fastify + TypeScript
Fast, typed, same language as frontend.
ORM
Prisma
Type-safe database queries, auto-generated types, easy migrations.
Database
PostgreSQL 16
Relational, handles Arabic UTF-8, JSON columns, robust.
Auth
Custom JWT + bcrypt
Simple, self-hosted, no external dependency.
Face Recognition
Python + FastAPI + InsightFace
Runs locally on LAN server. No internet needed.
Barcode
quagga2 (browser)
Camera-based barcode scanning for POS.
Export
ExcelJS + jsPDF
Generate Excel and PDF exports.
DevOps
Docker Compose
Single docker-compose.yml runs everything on the Windows PC.


TECH STACK IS FROZEN
No developer may add a new library without Project Lead approval.
No developer may replace any technology in this stack.
If a developer says ‘I know a better library’ — the answer is no. The stack is locked.


2.2 Folder Structure (Locked)
PROJECT STRUCTURE — EVERY FILE GOES IN ITS PLACE
/src/components/ui/ — Shared reusable components (Button, Input, Modal, Table, Badge, Card, Toast).
/src/features/members/ — Everything related to members (pages, components, hooks, types).
/src/features/attendance/ — Everything related to attendance.
/src/features/payments/ — Everything related to payments and POS.
/src/features/inventory/ — Everything related to inventory.
/src/features/sessions/ — Everything related to sessions/scheduling.
/src/features/reports/ — Everything related to reports.
/src/features/settings/ — Everything related to settings.
/src/features/dashboard/ — Dashboard page.
/src/hooks/ — Shared hooks (useAuth, useSocket, useOffline).
/src/lib/ — Utilities, constants, validation schemas, API client.
/src/types/ — Shared TypeScript types.
/src/styles/ — Global CSS, design tokens, Tailwind config.
One component per file. PascalCase for components. camelCase for hooks. kebab-case for CSS.


2.3 Database Design Rules
DATABASE RULES — BACKEND DEVELOPER FOLLOWS THESE
Every table has: id (UUID), created_at, updated_at, created_by, updated_by.
Soft delete only. Never hard delete. Add a deleted_at column.
Every financial transaction is immutable. Never update a payment record. Create adjustment records instead.
Every change to a member record creates an audit_log entry with: table, field, old_value, new_value, user_id, timestamp, reason.
Foreign keys everywhere. No orphaned records.
Indexes on: member name (Latin + Arabic), phone, email, discipline, status, created_at.
Store photos as file paths, not blobs. Photos saved to /data/photos/[member_id]/.
Store face embeddings in a separate face_embeddings table linked to member_id.
All money values stored as integers in centimes (DZD * 100). Never use floats for money.
All dates stored as UTC timestamps. Convert to local time only in the frontend.


2.4 API Design Rules
API RULES — BACKEND DEVELOPER FOLLOWS THESE
RESTful JSON API. All endpoints under /api/v1/.
Standard responses: { success: true, data: {...} } or { success: false, error: { code: string, message: string } }.
Pagination: ?page=1&limit=20. Response includes: { data: [...], total: number, page: number, totalPages: number }.
Filtering: ?status=active&discipline=taekwondo. Backend validates allowed filters.
Sorting: ?sort=created_at&order=desc.
Auth: JWT token in Authorization: Bearer <token> header. Token expires in 8 hours.
Role check middleware on every endpoint. Frontend hiding a button is NOT security.
Rate limiting: 100 requests/minute per user.
Input validation on EVERY endpoint using Zod schemas. Never trust frontend validation alone.
File uploads: multipart/form-data, max 5MB, accept only: jpg, png, webp, pdf.
Every endpoint logs: who called it, what they sent, what was returned, timestamp.


3. The Build Plan — Part by Part
The project is divided into 14 Parts. Each Part is a mini-project with clear deliverables. You deliver Part 1 to me, I review it, and then I give you Part 2. No skipping ahead.

3.0 Overview of All Parts
Part
Name
Duration
Team Needed
1
Project Setup + Design System
5 days
Frontend Sr + Backend
2
App Shell (Layout + Navigation + Auth)
7 days
Frontend Sr + Frontend Jr + Backend
3
Add Member Wizard (Steps 1–4)
10 days
Frontend Sr + Frontend Jr + Backend
4
Add Member Wizard (Steps 5–8)
8 days
Frontend Sr + Frontend Jr + Backend
5
Member Profile (All 12 Sections)
10 days
Frontend Sr + Frontend Jr + Backend
6
Edit Member (All 11 Tabs)
7 days
Frontend Sr + Frontend Jr + Backend
7
Attendance Dashboard + Logs
7 days
Frontend Sr + Backend
8
Kiosk Mode + Face Recognition Integration
12 days
Frontend Sr + Backend + Face Engineer
9
Payments, Billing & POS
10 days
Frontend Sr + Frontend Jr + Backend
10
Inventory & Equipment
5 days
Frontend Jr + Backend
11
Sessions & Scheduling
5 days
Frontend Jr + Backend
12
Reports & Analytics
10 days
Frontend Sr + Frontend Jr + Backend
13
Settings, Roles & Permissions
7 days
Frontend Sr + Backend
14
Offline Mode, Print, Polish & Launch
10 days
Full Team

Total estimated duration: 113 working days (~5.5 months with a 6-person team).

PART 1 — Project Setup + Design System
Duration: 5 working days. This Part builds the foundation that everything else sits on.

Who Does What
Person
Tasks
Frontend Senior
1. Initialize React + TypeScript + Tailwind project.2. Configure Tailwind with the exact design tokens (colors, spacing, fonts, shadows, radii) from this document.3. Build the shared UI component library: Button, Input, Select, DatePicker (3 dropdowns), Badge, Card, Modal, Toast, Table, Skeleton Loader.4. Build a Storybook or demo page showing every component in every state (default, hover, focus, error, disabled, loading).
Backend Developer
1. Initialize Node.js + Fastify + TypeScript project.2. Set up Prisma + PostgreSQL connection.3. Design and create the full database schema (all tables, relations, indexes).4. Set up Docker Compose: postgres, backend, and a placeholder for the frontend.5. Create seed data script with 20 test members, 3 disciplines, sample payments.
QA Gatekeeper
Review component library against the checklist below. Test every component state. Verify design tokens match this document exactly.


Frontend Senior — Detailed Orders
DESIGN TOKEN CONFIGURATION
Colors: primary-50 through primary-600, neutral-50 through neutral-900, success, danger, warning, info — exact hex values from the UI/UX spec.
Spacing: 4px base grid. Tokens: space-1 (4px) through space-10 (40px).
Typography: Inter for Latin, Noto Sans Arabic for Arabic. Sizes: 12px, 14px, 16px, 20px, 24px.
Shadows: elevation-0 (none) through elevation-3.
Radii: radius-sm (4px), radius-md (8px), radius-lg (12px), radius-full (9999px).
All tokens as Tailwind custom theme extensions AND CSS variables. Both must exist.


COMPONENT LIBRARY — WHAT TO BUILD
Button: 5 variants (Primary, Secondary, Danger, Ghost, Disabled). 2 sizes (default 40px, touch 48px). Loading state with spinner. Icon support left/right. Focus ring.
Input: Label above, placeholder, error message below, green checkmark when valid. Real-time validation hook. Support for: text, phone (formatted), email, number, Arabic text.
Select: Native for < 8 options. Searchable combobox for > 8 options. Grouped options support.
DatePicker: THREE separate dropdowns (Day, Month, Year). Dynamic day count based on month. Future dates disabled. Returns ISO date string.
Badge: 8 status variants (Active, Inactive, Suspended, Expired, Pending, Paid, Partial, Unpaid). Each with icon + label + background color.
Card: White background, border, shadow, padding. Header with title + action. Hover variant for interactive cards.
Modal: Overlay, centered, close X, focus trap, Escape to close. Confirmation variant with destructive button.
Toast: 4 types (Success, Error, Warning, Info). Auto-dismiss with configurable duration. Stack max 3.
Table: Sticky header, sortable columns, pagination, alternating rows, hover, empty state, skeleton loading.
Skeleton: Animated shimmer effect for loading states. Variants for: text line, avatar, card, table row.


Backend Developer — Detailed Orders
DATABASE SCHEMA — CORE TABLES TO CREATE
users: id, email, password_hash, role, full_name_latin, full_name_arabic, is_active, last_login, created_at, updated_at.
members: id, type (athlete/staff/external), first_name_latin, last_name_latin, first_name_arabic, last_name_arabic, gender, date_of_birth, place_of_birth, photo_path, status, created_at, updated_at, deleted_at, created_by.
member_contacts: id, member_id, type (phone/email/address), value, is_primary, created_at.
emergency_contacts: id, member_id, name, phone, relationship, created_at.
disciplines: id, name, is_active, created_at.
member_disciplines: id, member_id, discipline_id, instructor_id, belt_rank, enrollment_date, status, created_at.
schedules: id, member_discipline_id, day_of_week, time_slot_id, created_at.
time_slots: id, discipline_id, day_of_week, start_time, end_time, max_capacity, created_at.
documents: id, member_id, type, file_path, issue_date, expiry_date, status, created_at.
subscriptions: id, member_id, discipline_id, plan_type, start_date, end_date, amount, status, auto_renew, created_at.
payments: id, member_id, receipt_number, total_amount, paid_amount, remaining, payment_type, created_at, created_by.
payment_items: id, payment_id, description, amount, type (subscription/equipment/fee), created_at.
equipment: id, name, discipline_id, price, stock_quantity, created_at.
member_equipment: id, member_id, equipment_id, quantity, purchase_date, payment_id, created_at.
attendance_records: id, member_id, discipline_id, check_in_time, check_out_time, method (face/manual), device, operator_id, notes, created_at.
face_embeddings: id, member_id, embedding_vector, created_at, updated_at.
family_links: id, member_id, related_member_id, relationship, created_at.
audit_logs: id, table_name, record_id, field_name, old_value, new_value, user_id, reason, created_at.
expenses: id, date, category, amount, description, receipt_path, created_by, created_at.
notifications: id, type, member_id, message, is_read, created_at.
settings: id, key, value, updated_by, updated_at.


Part 1 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 1
☐ Every design token matches the spec exactly (open Tailwind config, check each hex value).
☐ Button component: all 5 variants render correctly. Focus ring visible. Loading state works. Disabled state prevents clicks.
☐ Input component: label visible, placeholder present, error shows on invalid, checkmark shows on valid, real-time validation fires on keystroke.
☐ DatePicker: three separate dropdowns, day count updates with month, future dates disabled, age calculates correctly.
☐ Badge: all 8 variants have correct colors AND icons AND labels.
☐ Modal: overlay darkens, centers correctly, X closes, Escape closes, focus is trapped inside.
☐ Toast: all 4 types display correctly, auto-dismiss works, max 3 stacked.
☐ Table: sticky header works on scroll, sort toggles, pagination works, empty state shows illustration + message.
☐ Skeleton loader: shimmer animation runs smoothly.
☐ All components render correctly at 1280px, 1024px, and 768px widths.
☐ Docker Compose starts all services with one command: docker-compose up.
☐ Database has all tables with correct column types and foreign keys.
☐ Seed script creates 20 test members successfully.
☐ NO eslint errors. NO TypeScript errors. NO console warnings.


PART 2 — App Shell (Layout + Navigation + Auth)
Duration: 7 working days. Build the skeleton of the entire app: the header, sidebar, routing, login, and role-based access.

Who Does What
Person
Tasks
Frontend Senior
1. Build the master layout: fixed header (56px) + collapsible sidebar (240px/64px) + main content area.2. Build the sidebar with all menu items, icons, active states, collapse behavior, and role-based visibility.3. Build the header: logo, global search bar (text mode only for now), user avatar + role badge.4. Set up React Router with all routes (pages will be placeholder screens for now).
Frontend Junior
1. Build the Login page: email + password form, validation, error handling, remember me toggle.2. Build the Lock Screen (session timeout): blurred background, re-enter password.3. Build all placeholder pages (one per feature): just the page title + breadcrumb.4. Build the 404 Not Found page.
Backend Developer
1. Build auth endpoints: POST /api/v1/auth/login, POST /api/v1/auth/refresh, POST /api/v1/auth/logout.2. Build JWT middleware: validate token, extract user, attach to request.3. Build role middleware: check user role against route permissions.4. Build GET /api/v1/auth/me endpoint returning current user + permissions.5. Create default admin user in seed data.


Frontend Senior — Layout Orders
LAYOUT SPECIFICATION
Header: height 56px, fixed top, full width, z-index 50, white background, bottom border 1px neutral-200.
Header left: logo, max-height 36px, clickable (navigates to dashboard).
Header center: search bar, max-width 400px, rounded, placeholder text, camera icon toggle for face search (disabled for now, just show the icon).
Header right: notification bell (with red dot counter), user avatar circle (32px), user name + role text, dropdown menu (Profile, Logout).
Sidebar: fixed left, width 240px expanded / 64px collapsed, height: calc(100vh - 56px), white background, right border.
Sidebar toggle: button at the bottom to collapse/expand. Stores preference in localStorage.
Sidebar items: icon + label. Active item: primary-600 bg, white text. Hover: primary-50 bg.
Only one section expanded at a time (accordion). Sub-items indented.
Items the user’s role cannot access: COMPLETELY HIDDEN. Not grayed, not disabled. Invisible.
Main content: fills remaining space. Has its own scroll. Padding: 24px.
Sidebar bottom: user info block (name, role) + logout button.


Part 2 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 2
☐ Login works: correct credentials log in, wrong credentials show error, empty fields show validation.
☐ JWT token is stored in httpOnly cookie (NOT localStorage).
☐ Refreshing the page keeps the user logged in.
☐ After 30 minutes of no activity, lock screen appears.
☐ Header renders correctly: logo, search bar, notification bell, user avatar.
☐ Sidebar shows correct items based on user role (test with admin AND receptionist accounts).
☐ Sidebar collapse/expand works, animation is smooth (200ms), preference persists on reload.
☐ Clicking any sidebar item navigates to the correct route.
☐ Active sidebar item is highlighted with primary-600.
☐ Clicking the logo from any page returns to dashboard.
☐ All routes exist (even if placeholder). No 404 on any sidebar link.
☐ The actual 404 page shows for invalid URLs.
☐ Layout renders correctly at 1280px, 1024px, and 768px.
☐ Full keyboard navigation: Tab through header items, sidebar items. Enter activates.
☐ No horizontal scroll on any viewport width.


PART 3 — Add Member Wizard (Steps 1–4)
Duration: 10 working days. Build the first half of the member creation wizard: Classification, Photo, Identity, Contact.

Who Does What
Person
Tasks
Frontend Senior
1. Build the wizard framework: progress bar, step navigation, auto-save to localStorage, step validation gate.2. Build Step 1 (Classification): three selection cards + staff role dropdown.3. Build Step 2 (Photo Capture): camera component with start/capture/preview/crop/save flow.
Frontend Junior
1. Build Step 3 (Identity): Latin name fields, Arabic name fields, duplicate check warning, gender dropdown, date of birth (3 dropdowns + age/school level calc), place of birth (Wilayas dropdown).2. Build Step 4 (Contact): phone input with formatting, email input with XSS stripping, address field, emergency contacts with relationship dropdown. All support multiple entries.
Backend Developer
1. Build POST /api/v1/members endpoint (creates member with partial data, returns member ID).2. Build PATCH /api/v1/members/:id endpoint (updates any field).3. Build GET /api/v1/members/check-duplicate?name=... endpoint.4. Build POST /api/v1/members/:id/photo endpoint (file upload, saves to disk, creates face embedding placeholder).5. Implement Algerian Wilayas as a static API endpoint.


Frontend Senior — Wizard Framework Orders
WIZARD FRAMEWORK SPEC
Horizontal progress bar at the top of the page, full width of content area.
8 steps shown as circles with labels. Current: filled primary-600. Completed: success-600 checkmark. Future: neutral-300 outline.
Clicking a completed step jumps back to it. Clicking a future step does nothing (disabled).
Auto-save: every field change saves to localStorage under key ‘memberWizard’. On page load, restore from localStorage.
Each step exports a validation function. The Next button calls it. If it returns errors, highlight the invalid fields and scroll to the first one.
Next button: primary, disabled until step is valid. Previous button: secondary.
Step visibility: Step 5 (Disciplines) only shows if Classification = Athlete.
If browser closes and user returns: resume at the last step with all data intact.


CAMERA COMPONENT SPEC — REUSABLE ACROSS THE APP
This component is used in: Add Member Step 2, Edit Member Tab 8, Kiosk Mode. Build it ONCE in /src/components/ui/Camera.tsx.
Default state: dashed border box (300x300px), person silhouette icon, ‘Start Camera’ button.
Active state: video element fills the box, oval face guide overlay (CSS), ‘Capture’ primary button, ‘Stop Camera’ secondary button.
Preview state: captured image replaces video, ‘Retake’ secondary, ‘Crop’ ghost, ‘Save’ primary.
Crop: use a crop library (react-easy-crop). Constrained 1:1. Minimum output 200x200px.
Camera denied: show illustrated guide to enable camera permissions in Chrome.
Returns: Blob of the cropped image. Parent component handles upload.


Part 3 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 3
☐ Wizard progress bar shows 8 steps with correct labels.
☐ Step 1: Three cards display. Selecting one highlights it. Staff shows role dropdown. Cannot proceed without selection.
☐ Step 2: Camera starts, captures, shows preview, crop works, save stores image.
☐ Step 2: Camera denied shows the help guide.
☐ Step 3: Latin name fields reject Arabic characters. Arabic fields reject Latin characters.
☐ Step 3: Double spaces auto-corrected. First letter auto-capitalized. Max 40 chars enforced.
☐ Step 3: Duplicate check fires after name entry. If match found, warning card with photo appears.
☐ Step 3: Date of birth — 3 dropdowns work, future dates disabled, age calculates, school level shows.
☐ Step 3: Wilayas dropdown has all 58 entries in correct order.
☐ Step 4: Phone format 0X XX XX XX XX enforced. First digit locked to 0. Second to 5/6/7.
☐ Step 4: Can add multiple phones, emails, emergency contacts.
☐ Step 4: Email strips < > backtick characters.
☐ Auto-save: fill 3 steps, close browser, reopen — all data is restored.
☐ Next button disabled when required fields are empty. Enabled when all valid.
☐ Clicking a completed step in progress bar jumps back correctly.
☐ Backend: POST member creates record in database. PATCH updates fields. Duplicate check works.


PART 4 — Add Member Wizard (Steps 5–8)
Duration: 8 working days. Build: Disciplines, Documents, Billing, Summary & Confirmation.

Who Does What
Person
Tasks
Frontend Senior
1. Build Step 7 (Billing): subscription plan dropdowns per discipline, auto-fees, equipment selector, family links, payment options (full/partial/later), live receipt preview.2. Build Step 8 (Summary): read-only review of all data, clickable sections, confirm button, success modal with member ID.
Frontend Junior
1. Build Step 5 (Disciplines): discipline cards, weekly schedule grid, instructor dropdown, belt rank dropdown (Taekwondo), conflict detection, extra session warning.2. Build Step 6 (Documents): document cards with checkboxes, file upload, date fields, conditional visibility (belt cert for TKD, parental auth for <18).
Backend Developer
1. Build discipline enrollment endpoints.2. Build document upload endpoints.3. Build subscription creation endpoints with price calculation.4. Build payment creation endpoint with receipt number generation.5. Build the complete member finalization endpoint that validates all data.


Part 4 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 4
☐ Step 5: Discipline cards show for TKD, Swimming, Equestrian. Schedule grid is interactive.
☐ Step 5: Selecting a time slot in two disciplines with same time triggers conflict warning.
☐ Step 5: More than 2 sessions shows fee warning banner.
☐ Step 5: Belt rank dropdown only shows for Taekwondo.
☐ Step 6: Document cards are grayed out by default. Checkbox activates them.
☐ Step 6: Checked document without uploaded file blocks navigation with error message.
☐ Step 6: Parental authorization only shows for members under 18.
☐ Step 6: Belt certificate only shows if Taekwondo is selected.
☐ Step 7: Registration fee (500 DZD) and license (1200 DZD) auto-added and non-removable.
☐ Step 7: Equipment quantities work (1–6), prices update correctly.
☐ Step 7: Payment options (Full/Partial/Later) update the receipt preview in real-time.
☐ Step 7: Family link search finds existing members, shows relationship dropdown.
☐ Step 8: Summary shows all data from all steps. Missing data highlighted in warning color.
☐ Step 8: Clicking a section title navigates back to that step.
☐ Step 8: Confirm creates the member. Success modal shows member ID + quick actions.
☐ Receipt number is unique and auto-generated.
☐ Full wizard flow: create a complete member from step 1 to 8 with all fields. Verify in database.


PART 5 — Member Profile (All 12 Sections)
Duration: 10 working days. Build the complete member profile view.

Who Does What
Person
Tasks
Frontend Senior
1. Build profile layout: header banner (photo, name, status, balance) + left sidebar nav + content area.2. Build Section 1 (Overview): discipline card, attendance heatmap preview, billing summary, document status.3. Build Section 6 (Attendance): monthly heatmap calendar + attendance table.4. Build Section 7 (Payments): balance card, subscription status, payment history table, unpaid fees list.
Frontend Junior
1. Build Section 2 (Identity): read-only display of all identity fields.2. Build Section 3 (Contact): phone/email/address display with action icons (call, SMS, WhatsApp, email).3. Build Section 4 (Disciplines): discipline cards with status, enrollment date, belt history.4. Build Section 5 (Documents): document table with status colors and preview.5. Build Sections 8–12: Equipment, Schedule grid, Family links, Notes, Audit log.
Backend Developer
1. Build GET /api/v1/members/:id (full profile with all related data).2. Build GET /api/v1/members/:id/attendance (with filters and pagination).3. Build GET /api/v1/members/:id/payments (with filters and pagination).4. Build GET /api/v1/members/:id/audit-log (with filters and pagination).5. Build note CRUD endpoints.6. Build family link CRUD endpoints.


Part 5 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 5
☐ Profile header: photo shows (or initials if no photo), name bold, Arabic name below in gray, status badge correct color, balance shows in red if > 0.
☐ Balance click opens payment modal (can be a placeholder modal for now).
☐ Left sidebar: all 12 sections listed, clicking switches content, active item highlighted.
☐ Overview cards show correct data from the test member.
☐ Attendance heatmap: green/red/white/blue squares render correctly for test data.
☐ Payment history table: sortable, paginated, shows all columns from spec.
☐ Document table: status colors correct (green valid, red expired, gray missing).
☐ Audit log: shows changes with before/after values, filterable by user.
☐ Notes: can add, edit, delete notes. Timestamp and author shown.
☐ Family links: shows linked members, can add/remove links, cannot link member to self.
☐ All sections render without horizontal scroll at 1280px and 768px.


PART 6 — Edit Member (All 11 Tabs)
Duration: 7 working days. Build the tabbed edit interface for existing members.

Key Rules
EDIT MODE RULES — EVERY DEVELOPER READS THIS
Tabs, NOT wizard. All data exists already.
Every tab: Save (primary, disabled until change + valid) and Cancel (secondary).
Unsaved changes: switching tabs or leaving page triggers confirmation modal.
Member ID is read-only with copy-to-clipboard.
All validation identical to Add Member wizard.
Tab 11 (Audit Log) is read-only. No edit, no delete, even for admins.
Every save creates an audit_log entry automatically.


Part 6 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 6
☐ All 11 tabs render and switch correctly.
☐ Save button is disabled when no changes made. Enables after a change.
☐ Save button is disabled when changes make the form invalid.
☐ Unsaved changes modal appears when switching tabs with dirty data.
☐ Cancel reverts all changes in the current tab.
☐ Member ID has copy icon, clicking copies to clipboard, tooltip shows ‘Copied!’.
☐ Photo tab: current photo shows, replace opens camera, crop works, confirm replaces.
☐ Disciplines tab: can add/remove disciplines, schedule grid updates.
☐ Documents tab: expired docs show red border + ‘Expired X days ago’.
☐ Billing tab: changing plan updates price summary. Expired shows ‘Renew Now’ banner.
☐ Audit log: shows all changes with correct before/after values.
☐ Save a change, check the audit_log table in the database — entry must exist.


PART 7 — Attendance Dashboard + Logs
Duration: 7 working days.

Who Does What
Person
Tasks
Frontend Senior
1. Build attendance dashboard: quick action buttons, real-time presence grid (tiles with photo/name/discipline/time/payment badge), today’s session schedule panel.2. Implement Socket.IO connection: tiles update live when check-ins happen.3. Build tile interaction: click opens popup with member details + quick actions.4. Build offline banner: ‘Live updates paused — offline mode’.
Backend Developer
1. Build Socket.IO server: broadcast check-in/check-out events.2. Build attendance CRUD endpoints.3. Build attendance log endpoint with full filtering (date range, member, discipline, method, device, status).4. Build mass checkout endpoint.5. Build attendance stats endpoint for today’s count.


Part 7 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 7
☐ Dashboard shows currently present members as tiles with all required info.
☐ Tiles update in real-time when a new check-in is created via API (test with Postman).
☐ Clicking a tile opens popup with member details.
☐ Today’s session schedule shows on the left panel.
☐ Mass Checkout button checks out all currently present members.
☐ Attendance log table: all columns present, all filters work, pagination works.
☐ Admin can edit/delete attendance entries (with reason field).
☐ Non-admin cannot see edit/delete buttons.
☐ Disconnect internet — offline banner appears.
☐ Keyboard: Tab through tiles, Enter opens popup, Escape closes popup.


PART 8 — Kiosk Mode + Face Recognition
Duration: 12 working days. The most complex Part. Three people work in parallel.

Who Does What
Person
Tasks
Face Recognition Engineer
1. Set up InsightFace (or DeepFace) in a Python FastAPI microservice.2. Build POST /enroll endpoint: receives image, generates embedding, stores in database.3. Build POST /match endpoint: receives image, compares against all embeddings, returns top match with confidence score.4. Build GET /health endpoint.5. Dockerize the service.6. Target: match result in under 2 seconds for a database of 500 members.
Frontend Senior
1. Build Kiosk Mode: full-screen layout, camera feed, result area, sound alerts.2. Integrate face match: capture frame every 3 seconds, send to /match, display result.3. Build manual search fallback: large search input, big result tiles.4. Build all error states: no face detected, low confidence, expired, unpaid, duplicate check-in.5. Build receptionist view: approve/reject buttons on match results.
Backend Developer
1. Build kiosk check-in endpoint: receives member_id + method (face/manual), creates attendance record, broadcasts via Socket.IO.2. Build auto-check-in logic: if match confidence > threshold AND subscription active AND balance = 0, auto check in.3. Build all alert triggers: expired, unpaid, expiring in 4 days, duplicate check-in, 2 consecutive absences.4. Integrate face service with member enrollment (auto-enroll on photo save).


Part 8 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 8
☐ Face service health endpoint responds.
☐ Enroll a member’s face via the API. Match returns the correct member.
☐ Match returns a confidence score. Score > threshold = auto check-in.
☐ Kiosk full-screen: no browser chrome, no sidebar, no header. Camera active.
☐ Successful match: green card with photo + name + discipline + chime sound.
☐ Failed match (expired): red card with message + error beep.
☐ Failed match (unpaid): red card with ‘Proceed to Payment?’ button.
☐ Duplicate check-in: warning with ‘Already checked in at HH:MM’.
☐ No face detected: message appears after 5 seconds.
☐ Manual search: search input works, results show as big tiles.
☐ Biometric service offline: fallback message + manual mode.
☐ Camera denied: illustrated help guide shows.
☐ Sound alerts: success chime and failure beep play correctly.
☐ Match result < 2 seconds with 20 test members.


PART 9 — Payments, Billing & POS
Duration: 10 working days.

Deliverables
Payment modal: pre-filled items, full/partial/later options, live receipt, print trigger.
Payment history page: all payments, filterable, sortable, with view/refund actions.
POS screen: barcode scan input, cart, member identification (face or search), checkout flow.
Expenses page: add expense form, expense list table.
Auto-renewal logic: subscription expires → balance auto-updated → notification created.
3 consecutive absences trigger: dashboard notification asking to suspend or deactivate.

Part 9 — QA Gatekeeper Checklist
GATEKEEPER CHECKLIST — PART 9
☐ Payment modal: items pre-filled, totals calculate correctly, receipt preview updates live.
☐ Partial payment: amount input appears, remaining balance calculated.
☐ Pay Later: no amount charged, full balance recorded.
☐ After payment: receipt auto-prints (or shows print dialog). Receipt has all required fields.
☐ Payment history: all columns present, filters work, refund button works (creates adjustment).
☐ POS: barcode scan adds item to cart (test with a test barcode). Cart totals correctly.
☐ POS: member identification via search works. Option to add to member balance works.
☐ Expenses: form creates expense, list shows all expenses, sortable and filterable.
☐ All money displayed as integer DZD with space separator (1 500 DZD).
☐ Every financial operation triggers a database backup (or backup flag is set).


PART 10 — Inventory & Equipment
Duration: 5 working days.

Deliverables
Inventory management page: list all items, quantities, prices, low stock warnings.
Add/edit/deactivate inventory items.
Stock adjustment with reason logging.
Link between POS sales and stock deduction.
Equipment assignment on member profile — connect with Step 7 equipment selection.

Part 10 — QA Checklist
GATEKEEPER CHECKLIST — PART 10
☐ Inventory list shows all items with correct quantities and prices.
☐ Low stock items highlighted (quantity below threshold).
☐ Adding stock: quantity increases. Removing: decreases. Change logged in audit.
☐ POS sale deducts stock automatically.
☐ Member equipment section shows purchased items correctly.


PART 11 — Sessions & Scheduling
Duration: 5 working days.

Deliverables
Weekly schedule grid: visual timetable showing all disciplines, time slots, coaches.
Session management: create/edit/cancel sessions.
Session roster: list of enrolled members per session with attendance marking.
Conflict detection: warn when overlapping sessions.
Capacity tracking: show current enrollment vs max capacity per slot.

Part 11 — QA Checklist
GATEKEEPER CHECKLIST — PART 11
☐ Weekly grid renders all 7 days with correct time slots per discipline.
☐ Clicking a session shows the roster with enrolled members.
☐ Attendance can be marked from the session roster view.
☐ Creating overlapping sessions triggers a warning.
☐ Capacity shows (e.g., ‘12/30 enrolled’) and warns at 90%+.


PART 12 — Reports & Analytics
Duration: 10 working days.

Deliverables
Report page framework: header + filter bar + chart zone + data table + export button.
Attendance reports: total check-ins, absences, late arrivals.
Financial reports: revenue, unpaid balances, daily cash report, sales.
Membership reports: total members, growth, active vs inactive, demographics (age/gender), new members.
Inventory reports: stock value, total sales.
Document compliance reports: missing docs, expired, expiring soon.
Custom report builder: select metrics, filters, chart type, save as template.
Export: one-click download with current filters applied.

Part 12 — QA Checklist
GATEKEEPER CHECKLIST — PART 12
☐ Every report page: filter bar works, chart renders, data table matches chart, export works.
☐ Charts are interactive: hover shows tooltip, click filters the table.
☐ Date range filter works on all reports.
☐ At least one report uses each chart type: bar, line, pie, heatmap.
☐ Export produces a valid file with correct data.
☐ ‘Last updated’ timestamp shown on every report.
☐ Empty report (no data in range): shows empty state, not a broken chart.


PART 13 — Settings, Roles & Permissions
Duration: 7 working days.

Deliverables
Settings page: general (club name, logo, contact info), user management (create/edit/deactivate users), role management (create custom roles with granular permissions).
Discipline settings: add/edit/deactivate disciplines, set pricing per plan.
Pricing settings: update subscription prices, fees, equipment prices.
Document settings: configure required documents per discipline.
Notification settings: configure alert thresholds (days before expiry, absence count).
Permission enforcement: verify that changing a role’s permissions immediately hides/shows UI elements for users with that role.

Part 13 — QA Checklist
GATEKEEPER CHECKLIST — PART 13
☐ General settings: club name change reflects in header/receipts.
☐ User management: create user, assign role, deactivate user — all work.
☐ Role management: create custom role, assign permissions, user with that role sees only permitted items.
☐ Discipline settings: add a new discipline, it appears in the member wizard.
☐ Pricing: change a subscription price, new enrollments use the new price.
☐ Permission change: revoke a permission from a role, user with that role loses access immediately (no logout required).


PART 14 — Offline Mode, Print, Polish & Launch
Duration: 10 working days. The final Part. Full team works together.

Deliverables
Person
Tasks
Frontend Senior
1. Implement PWA service worker with Workbox: cache app shell, offline check-in/out via IndexedDB.2. Sync queue: when back online, push pending records and show sync progress.3. Print stylesheet: @media print hides sidebar/header, formats tables.4. Receipt printing: thermal printer format (80mm width).
Frontend Junior
1. Polish all empty states: add illustrations and CTAs.2. Polish all loading states: skeleton screens everywhere.3. Polish all error states: human-readable messages.4. Responsive fixes: test and fix every screen at 1280px, 1024px, 768px.5. Accessibility audit: tab order, focus rings, aria-labels, color contrast.
Backend Developer
1. Backup system: auto-backup after every financial transaction.2. Backup restore endpoint.3. SMS integration: connect to SMS provider for attendance alerts.4. Performance optimization: add database indexes, query optimization, connection pooling.5. Security audit: SQL injection tests, XSS tests, auth bypass tests.
Face Engineer
1. Performance optimization: match speed with 500 member database.2. Handle edge cases: multiple faces, poor lighting, partial face.3. Stress test the service.
QA Gatekeeper
Full regression test: test every feature end-to-end. Create a 50-member database and simulate real usage for one full day.


Part 14 — FINAL QA Checklist
FINAL LAUNCH CHECKLIST — EVERY ITEM MUST PASS
☐ OFFLINE: Disconnect server. Check in 5 members via kiosk. Reconnect. Records sync automatically.
☐ OFFLINE: Offline banner shows. Online: banner disappears.
☐ PRINT: Print a receipt. All required fields present. Format fits 80mm thermal paper.
☐ PRINT: Print an attendance report. Table formatted, no sidebar/header, page breaks correct.
☐ PERFORMANCE: Dashboard loads in < 2 seconds with 50 members.
☐ PERFORMANCE: Member list loads in < 2 seconds with 50 members.
☐ PERFORMANCE: Kiosk face match in < 2 seconds with 50 members.
☐ SECURITY: Try SQL injection in search bar. Must not work.
☐ SECURITY: Try accessing admin endpoints with receptionist token. Must return 403.
☐ SECURITY: Try XSS in name fields. Must be stripped.
☐ ACCESSIBILITY: Navigate the entire app using only the keyboard.
☐ ACCESSIBILITY: Every image has alt text. Every icon has aria-label.
☐ EMPTY STATES: Every list/table has a designed empty state.
☐ LOADING STATES: Every page has skeleton loading, not spinners.
☐ ERROR STATES: Disconnect the database. Every page shows a human-readable error, not a crash.
☐ BACKUP: Make a payment. Verify backup was triggered.
☐ AUDIT: Change a member field. Check audit log — entry with before/after exists.
☐ FULL FLOW: Create member → enroll in discipline → pay → check in via kiosk → view attendance → view report. Everything works.
☐ Docker Compose: docker-compose up starts everything. Fresh machine test.


4. Standards from the Best Companies
These practices are borrowed from Google, Stripe, Linear, Vercel, and Notion. They are not optional.

4.1 Code Quality Standards
CODE STANDARDS — ENFORCED BY THE GATEKEEPER
ZERO any types in TypeScript. Every variable, function parameter, and return value is typed.
ZERO console.log in production code. Use a proper logger.
ZERO commented-out code. If it’s not used, delete it. Git has history.
ZERO magic numbers. Every number has a named constant (e.g., MAX_NAME_LENGTH = 40).
ZERO inline styles. Everything in Tailwind classes or CSS modules.
Functions: max 50 lines. If longer, split into smaller functions.
Components: max 200 lines. If longer, extract sub-components.
Files: max 300 lines. If longer, split into modules.
Every function has a JSDoc comment explaining what it does.
Every API endpoint has a description comment.
Naming: descriptive English names. No abbreviations except: id, url, api, db.
Error handling: every API call wrapped in try/catch. Every error logged. Every error shown to the user.


4.2 Git Workflow
GIT RULES
Main branch: always deployable. Protected. No direct pushes.
Branch naming: feature/part-3-identity-step, fix/phone-validation, refactor/camera-component.
Commit messages: type(scope): description. Example: feat(members): add duplicate check on name entry.
One Pull Request per task. No mega-PRs with 50 files. Small, reviewable PRs.
PR description template: What changed? Why? Screenshots. Self-checklist.
Gatekeeper approves within 24 hours. Developer fixes within 24 hours.
No merge until: 0 TypeScript errors, 0 linter warnings, Gatekeeper approved.


4.3 Testing Standards
TESTING RULES
Unit tests are NOT required for Part 1–13 (speed over coverage for v1).
HOWEVER: the Gatekeeper manually tests every feature against the checklist.
The Gatekeeper creates a test member and walks through every flow end-to-end.
Before Part 14 (launch): the team does a full-day simulation with 50 test members.
After launch: add unit tests incrementally. Target: critical paths first (payments, attendance).


4.4 Communication Standards
COMMUNICATION RULES
Daily async standup (Slack/Discord): 3 lines — what I did, what I’ll do, what’s blocking me.
If blocked for more than 2 hours: escalate to Project Lead immediately. Don’t wait for standup.
Every decision is documented in writing. No verbal agreements.
If the spec is unclear: ASK the Project Lead before implementing. Don’t guess.
If a developer disagrees with the spec: discuss with Project Lead. But once decided, follow the spec.
Weekly demo: every Friday, the team demos what was built that week. Screen share, live walkthrough.


4.5 Delivery Standards
HOW STRIPE AND LINEAR SHIP
Ship small. Each Part is a complete, working feature. Not half-built.
Ship tested. Gatekeeper signs off before anything is merged.
Ship documented. Every endpoint has API docs. Every component has a demo page.
Ship incrementally. Client can see progress after every Part. Not a big bang after 6 months.
After each Part: deploy to a staging server. Client can test. Feedback incorporated into the next Part.


5. Final Notes
REMEMBER
This document is the single source of truth. If it’s not written here, don’t build it.
If something is unclear, ask before coding. A 5-minute question saves 5 hours of rework.
The Gatekeeper has the power to reject. Respect the process. It protects everyone.
Quality over speed. A feature that works perfectly in 10 days beats a buggy feature in 5.
When you finish a Part, come back to me with screenshots and a summary. I’ll review and give you the next Part.


START WITH PART 1. When it’s done and approved by the Gatekeeper, come back for Part 2.

END OF DOCUMENT.
 🏋️ Sport Club Management System — Complete User Experience Walkthrough
Purpose: This document describes every single screen, element, interaction, and expected result in the system. Follow it page by page, step by step. If anything is missing or behaves differently, it's a bug.

TABLE OF CONTENTS
Login & Access
Dashboard (Home Screen)
Add a Member — 8-Step Wizard
Member Profile — 12 Sections
Edit a Member — 11 Tabs
Attendance & Biometrics
Attendance Kiosk (Terminal)
Attendance Logs & Exports
Reports
Point of Sale (POS)
Expenses
Settings
Global Behaviors (Apply Everywhere)
1 — LOGIN & ACCESS
Step	Action	Expected Result
1.1	Open the app URL in a browser on the local network	You see a login screen
1.2	Enter valid credentials (admin/receptionist)	You are redirected to the Dashboard
1.3	Verify you only see menu items matching your role	Admin sees everything. Receptionist sees only what they're permitted
2 — DASHBOARD (HOME SCREEN)
This is the first screen after login. It has 3 zones: Header Bar, Left Panel, Main Content.

2.1 — Header Bar (top of every page)
Step	Action	Expected Result
2.1.1	Look at the top-left	You see the system logo
2.1.2	Click the system logo	You are taken back to the Dashboard from anywhere in the app
2.1.3	Look at the search bar	You see a search field with placeholder: "Recherche globale : tout…"
2.1.4	You see an icon next to the search bar	This is the facial search toggle (on/off)
2.1.5	Click the facial search icon to activate it	The icon lights up / changes state. The search now accepts a face for lookup
2.1.6	Click the facial search icon again to deactivate it	The search reverts to text-only mode
2.1.7	Type a member name in the search bar	You see matching results as you type (global search: members, payments, etc.)
2.1.8	Look for Filters next to the search bar	You see filter controls to narrow search results
2.2 — Left Panel (Sidebar Navigation)
Step	Action	Expected Result
2.2.1	Look at the left side of the screen	You see a vertical navigation menu with these items (in order):
1. Gestion des membres (Member Management)
2. Présence et biométrie (Attendance & Biometrics)
3. Paiements et finances (Payments & Finances)
4. Inventaire et point de vente (Inventory & POS)
5. Séances et planification (Sessions & Scheduling)
6. Rapports et analyses (Reports & Analytics)
7. Paramètres (Settings)
2.2.2	Click any menu item	The Main Content area updates to show that section
2.2.3	Verify: does the user only see items they have permission for?	Yes — items are hidden based on role
2.3 — Main Content: Notifications
Step	Action	Expected Result
2.3.1	Look at the main content area of the Dashboard	You see notification cards showing alerts
2.3.2	Check for these notification types:	
— Abonnements arrivant à expiration	Cards for members whose subscriptions are expiring soon
— Membres avec solde impayé	Cards for members with unpaid balances
— Membres nécessitant un renouvellement	Cards for members needing renewal
— Documents manquants	Cards for members with missing documents
— Membres inactifs depuis X jours	Cards for members inactive for X days
— Membres absents aujourd'hui	Cards for members absent today
— Rupture de stock	Cards for out-of-stock items
2.3.3	Look at each notification card	Each card shows: photo, full name, renewal date, discipline
2.3.4	Click on a notification card	You are taken to that member's profile with the relevant section highlighted
3 — ADD A MEMBER — 8-STEP WIZARD
Navigation model: Multi-step wizard with a permanent progress bar at the top. Auto-save happens on every modification. You can navigate between steps at any time.

3.0 — Access the Wizard
Step	Action	Expected Result
3.0.1	From the sidebar, go to Gestion des membres	Member management section opens
3.0.2	Click "Ajouter un membre" (Add a Member)	The wizard opens — you see Step 1 with a progress bar at the top showing 8 steps
3.0.3	Verify the progress bar shows these step labels:	1. Classification — 2. Photo — 3. Identité — 4. Coordonnées — 5. Disciplines — 6. Documents — 7. Facturation — 8. Récapitulatif
STEP 1 — Classification du membre
Step	Action	Expected Result
3.1.1	You see a field labeled "Type de membre"	It's a required field
3.1.2	The options are:	Athlète / Personnel / Externe
3.1.3	Select "Athlète"	Step 5 (Disciplines) becomes active in the progress bar
3.1.4	Select "Personnel"	A dropdown appears for the staff role
3.1.5	The staff role dropdown shows these predefined roles:	Administrateur, Réceptionniste (+ any roles added in Settings later)
3.1.6	The staff role is required	You cannot proceed without selecting a role
3.1.7	Select "Externe"	Step 5 (Disciplines) is skipped/disabled in the progress bar
3.1.8	Try to click "Next" without selecting a type	❌ Alert appears: the field is mandatory. You cannot proceed
3.1.9	Select a type and click "Next"	You move to Step 2 — Photo
STEP 2 — Capture de photo
Step	Action	Expected Result
3.2.1	You see the photo capture area	Default state: Camera is OFF. You see a "Démarrer la caméra" (Start Camera) button
3.2.2	Click "Démarrer la caméra"	Active state: You see the live video feed from the webcam, a "Capturer" (Capture) button, and a "Arrêter la caméra" (Stop Camera) button
3.2.3	Click "Capturer"	Preview state: The video freezes. You see the captured image with 3 options: "Reprendre" (Retake), "Recadrer" (Crop), "Enregistrer" (Save)
3.2.4	Click "Reprendre"	The camera goes back to live video mode (Active state)
3.2.5	Click "Recadrer"	A cropping tool appears on the image. Adjust the crop area and confirm
3.2.6	Click "Enregistrer"	The photo is saved. A thumbnail of the saved photo is displayed. You can proceed to Step 3
3.2.7	Click "Arrêter la caméra" (while camera is active)	The camera turns off. You return to the default state
3.2.8	This step is optional — click "Next" without taking a photo	You move to Step 3 without a photo
STEP 3 — Informations d'identité
Step	Action	Expected Result
3.3.1	You see fields for Prénom and Nom in Latin	Placeholder: "Saisissez votre nom complet". Fields are required
3.3.2	You see fields for Prénom and Nom in Arabic	Only Arabic characters (+ spaces) are allowed. Required
3.3.3	Type Latin letters in the Arabic name field	❌ Characters are rejected — the field blocks non-Arabic input
3.3.4	Type Arabic letters in the Latin name field	❌ Characters are rejected — the field blocks non-Latin input
3.3.5	Type a name with double spaces	The system automatically corrects double spaces to single spaces
3.3.6	Type a name with 41+ characters	The field stops accepting input at 40 characters
3.3.7	Type a name starting with lowercase	The system auto-capitalizes the first letter of each word
3.3.8	Fill in a name correctly	A green checkmark ✓ appears next to the field
3.3.9	The system checks if this member already exists	If a duplicate is found, a warning is displayed
3.3.10	Sexe (Gender) field	Dropdown: Homme / Femme. Required
3.3.11	Date de naissance (Date of Birth)	Three separate dropdowns: Jour (Day), Mois (Month), Année (Year)
3.3.12	The Year dropdown starts at	1945
3.3.13	Try to select a future date	❌ Future dates are disabled/blocked
3.3.14	Select only the Year (leave Day and Month empty)	The system shows an estimated age (based on current year minus birth year)
3.3.15	Select Year + Month + Day	The system shows the exact age (calculated from today's date)
3.3.16	Once a valid year is selected	A block appears showing: Âge (Age) + Niveau scolaire (School Level)
3.3.17	Each dropdown (Day, Month, Year) validates independently	Each shows a green check or red error on its own
3.3.18	Lieu de naissance (Place of Birth)	Dropdown listing all 48 Wilayas algériennes
3.3.19	Try to proceed without filling required fields	❌ Alert: mandatory fields are highlighted and block navigation
STEP 4 — Coordonnées (Contact Information)
Step	Action	Expected Result
3.4.1	Téléphone (Phone) field	You see a phone input field
3.4.2	Type a letter	❌ Rejected — only digits allowed
3.4.3	The 1st digit must be	0 — anything else is rejected
3.4.4	The 2nd digit must be	5, 6, or 7 — anything else is rejected
3.4.5	Digits 3–10 can be	Any digit (0–9)
3.4.6	Must be exactly	10 digits
3.4.7	As you type, the phone auto-formats to	0x xx xx xx xx (spaces inserted automatically)
3.4.8	You can add multiple phone numbers	A button like "Ajouter un numéro" lets you add more
3.4.9	Courriel (Email) field	Standard email validation. Dangerous characters (<, >, backticks, quotes) are stripped immediately
3.4.10	You can add multiple emails	Same add-more pattern as phone
3.4.11	Adresse résidentielle (Address)	Free text. HTML tags are blocked/stripped
3.4.12	Contact d'urgence (Emergency Contact)	Fields: Name + Phone (same phone validation as above)
3.4.13	Lien de parenté (Relationship) dropdown	Options: Mère, Père, Grand-père, Grand-mère, Frère, Sœur, Oncle, Tante, Cousin, Autre
3.4.14	You can add multiple emergency contacts	Button to add more contacts
STEP 5 — Sélection des disciplines (Athletes Only)
This step is only visible if "Athlète" was selected in Step 1.

Step	Action	Expected Result
3.5.1	You see the available disciplines	Taekwondo, Natation (Swimming), Équitation (Horse Riding)
3.5.2	Select one or more disciplines	For each selected discipline, the following options appear:
3.5.3	Planning hebdomadaire (Weekly Schedule)	A weekly grid is displayed. You select time slots for sessions
3.5.4	Select 1 session per week	✅ Accepted
3.5.5	Select 2 sessions per week	✅ Accepted (recommended minimum)
3.5.6	Select 3+ sessions per week	⚠️ Warning message: "Plus de 2 cours peuvent entraîner des frais supplémentaires."
3.5.7	Select a time slot that conflicts with another discipline	⚠️ Conflict warning is displayed
3.5.8	Attribution des instructeurs (Instructor Assignment)	Dropdown filtered by the selected discipline — only instructors for that discipline appear
3.5.9	Ceinture (Belt) — only for Taekwondo	Dropdown appears only if Taekwondo is selected
3.5.10	Belt options are:	K10–Blanc, K09–Jaune, K08–Orange, K07–Vert, K06–Bleu 1, K05–Bleu 2, K04–Bleu 3, K03–Rouge 1, K02–Rouge 2, K01–Rouge 3, Dan 1, Dan 2, Dan 3
STEP 6 — Soumission de documents
Step	Action	Expected Result
3.6.1	You see a list of document types, all disabled/greyed out by default	Each has a checkbox, quantity selector (1–6), upload button
3.6.2	The document types are:	Pièce d'identité (ID), Certificat médical, Acte de naissance, Groupe sanguin, Photos, Certificat de grade, Autorisation parentale
3.6.3	Check the checkbox next to "Certificat médical"	The fields activate: Upload, Date de délivrance, Date d'expiration (auto-calc: +1 year), Notes médicales
3.6.4	Check "Acte de naissance"	Fields activate: Upload, Date de délivrance, Date d'expiration (auto-calc: +10 years)
3.6.5	Check "Groupe sanguin"	Fields activate: Upload + Blood Group dropdown (no dates)
3.6.6	Check "Pièce d'identité"	Fields activate: Upload only
3.6.7	Check "Photos"	Fields activate: Upload only
3.6.8	"Certificat de grade"	Visible only if Taekwondo was selected in Step 5
3.6.9	"Autorisation parentale" (Parental Authorization)	Visible only if the member's age is under 18 (calculated in Step 3)
3.6.10	Upload a file for a checked document	The upload button transforms to: "filename.pdf [Afficher] [Supprimer]"
3.6.11	Click "Afficher" (View)	Opens a preview of the uploaded document
3.6.12	Click "Supprimer" (Delete)	The file is removed. The upload button returns
3.6.13	Expiration dates are auto-calculated	From the issue date. But you can click "Modifier" to change it manually
3.6.14	❌ Check a document box but don't upload a file, then try to proceed	Navigation is blocked. Warning: "Veuillez télécharger un fichier pour ce document ou le décocher."
3.6.15	Set quantity to e.g. 3	Quantity selector allows 1–6 per document type
STEP 7 — Facturation et abonnements (Billing & Subscriptions)
Step	Action	Expected Result
Subscription Plan		
3.7.1	You see a Plan d'abonnement dropdown	Options: Mensuel (1 month), 2 mois, 3 mois, 4 mois… up to 1 an (12 months)
3.7.2	Each discipline has its own plan/date config	If the member enrolled in 2 disciplines, you configure each separately
3.7.3	If the member selected 3+ sessions/week in Step 5	The plan is labeled with suffix: "(Personnalisé)". An extra charge of 750 DZD per extra session is shown explicitly
Dates		
3.7.4	Date de début (Start Date)	3 dropdowns (Day, Month, Year). Defaults to today
3.7.5	Start date cannot be before	1er septembre 2023
3.7.6	If year is 2023, months available are	September through December only
3.7.7	Date d'échéance (Due Date)	Auto-calculated: Start Date + plan duration. Can be modified manually
Mandatory Fees		
3.7.8	You see automatic line items on the receipt preview:	
— Frais d'inscription et d'assurance	500 DZD (added automatically)
— Licence sportive annuelle	1 200 DZD (added automatically)
— Abonnement mensuel	1 500 DZD
Equipment (Taekwondo)		
3.7.9	If Taekwondo was selected, you see equipment items	Each item has: Name, Price, Quantity selector (1–6, default 1)
3.7.10	Equipment list:	
— Uniforme	3 000 DZD
— Protège-dents	600 DZD
— Gants	2 200 DZD
— Protège-avant-bras	2 200 DZD
— Coquille	1 600 DZD (Homme) / 2 200 DZD (Femme)
— Protège-tibias	2 200 DZD
— Chaussettes	2 200 DZD
3.7.11	Cross-selling: Users can add equipment from any sport, not just the enrolled one	A browse/add mechanism is available
Family Links		
3.7.12	You see a "Liens entre membres" section	You can search for existing members (text + facial recognition)
3.7.13	Search finds an existing member	Their name is displayed with a "Lien de parenté" dropdown
3.7.14	Choose a relationship	Links the two members as family
3.7.15	Choose receipt option	Consolidated receipt (family) or Individual receipt
Payment Options		
3.7.16	You see 3 payment options:	
— Paiement intégral (Full Payment)	✅ Selected by default (recommended)
— Paiement partiel (Partial Payment)	Shows an input: "Montant payé maintenant" (Amount paid now)
— Payer plus tard (Pay Later)	Full amount goes to unpaid balance
3.7.17	Changing payment option updates the receipt preview in real-time	Immediate visual feedback
Receipt Preview		
3.7.18	You see a live receipt preview showing:	
— Membre(s) couvert(s)	Individual or family members
— Abonnements, durées et renouvellements	Plan details
— Matériel et équipement	Equipment items
— Montant total dû	Total amount
— Montant payé maintenant	What is being paid today
— Solde restant	Remaining balance
— Libellé du mode de paiement	"Payé en totalité" / "Paiement partiel" / "Payer plus tard"
3.7.19	The receipt updates in real-time as you change anything	Every change reflects instantly
STEP 8 — Récapitulatif et confirmation (Summary & Confirmation)
Step	Action	Expected Result
3.8.1	You see a complete summary of all data entered across all steps	Every field from every step is displayed
3.8.2	Any missing required data is highlighted	You can see exactly what's incomplete
3.8.3	Each section is clickable	Clicking a section takes you back to that exact step with the relevant field highlighted
3.8.4	Fix a missing field and return to Step 8	The previously-highlighted item is now filled and no longer flagged
3.8.5	Click "Confirmer" (Confirm) when everything is complete	The member is created. You are redirected (e.g., to the member's profile or member list)
4 — MEMBER PROFILE — 12 SECTIONS
Access: Click any member from a list, search result, or notification card. Layout: Header banner + Left sidebar + Main content area.

4.0 — Profile Header (Banner)
Step	Action	Expected Result
4.0.1	Photo	Member's photo is displayed. If no photo → circle with initials
4.0.2	Click the photo	A full-size photo viewer opens
4.0.3	Name	Bold text. Arabic name displayed below in light grey (if available)
4.0.4	Status indicator	Shows one of:
🟢 Actif (green)
⚫ Inactif (grey)
🟠 Suspendu (orange)
🔴 Expiré (red)
🟡 Documents en attente (yellow)
Each status has an icon + label	
4.0.5	Solde (Balance)	If unpaid balance > 0 → red indicator: "Solde : 3 000 DZD"
4.0.6	Click the balance indicator	Opens a payment window pre-filled with the items owed
4.1 — Left Sidebar (Section Navigation)
Step	Action	Expected Result
4.1.1	You see the sidebar with these sections:	1. Aperçu — 2. Identité — 3. Contact — 4. Disciplines — 5. Documents — 6. Présence — 7. Paiements — 8. Équipement — 9. Horaires — 10. Famille — 11. Notes — 12. Journal d'audit
4.1.2	Click any section name	The main content area updates to show that section
4.2 — Section 1: Aperçu (Overview)
Dashboard-style view with cards.

Step	Action	Expected Result
4.2.1	Carte récapitulative des disciplines	Shows each discipline, next due date, status
4.2.2	Carte aperçu des présences	Shows this week's attendance + a heatmap preview
4.2.3	Carte récapitulative de la facturation	Shows current plan, next renewal, unpaid balance
4.2.4	Carte statut des documents	Shows expired documents, missing documents
4.3 — Section 2: Identité
Step	Action	Expected Result
4.3.1	You see identity information in read-only mode	First name, last name (Latin + Arabic), gender, date of birth, age, place of birth
4.4 — Section 3: Contact
Step	Action	Expected Result
4.4.1	You see: Phone, Email, Address, Emergency Contact	All displayed with their values
4.4.2	Next to each contact, you see action icons:	📞 Call, 💬 SMS, 📱 WhatsApp, ✉️ Email
4.4.3	Click a contact action icon	Initiates the appropriate action (calls, opens WhatsApp, etc.)
4.5 — Section 4: Disciplines
Step	Action	Expected Result
4.5.1	You see a card for each enrolled discipline	Each shows: Name, Status, Enrollment date, Time since enrollment
4.5.2	For Taekwondo specifically	Also shows: Grade (belt) and exam history
4.6 — Section 5: Documents
Step	Action	Expected Result
4.6.1	You see a document table with columns:	Type, Date d'émission, Expiration, Statut, Actions
4.6.2	Status colors:	🟢 Valide (green), 🔴 Expiré (red), ⚫ Manquant (grey)
4.6.3	Click a table row	Opens a document preview window
4.6.4	You see a "Télécharger" (Download) button	Downloads the document file
4.7 — Section 6: Présence (Attendance)
Step	Action	Expected Result
4.7.1	You see a monthly heatmap	Grid of colored squares for each day:
🟢 Green = present
⬜ White = no class
🔴 Red = absent
🔵 Blue = extra class
4.7.2	Below the heatmap: attendance table	Sortable columns: Date, Heure d'arrivée, Heure de départ, Discipline, Mode de pointage (facial/manual)
4.8 — Section 7: Paiements (Payments)
Step	Action	Expected Result
4.8.1	Solde impayé (Unpaid Balance) is displayed	With a "Payer" button
4.8.2	Click "Payer"	Opens a payment window (same as billing in the wizard — full/partial/later options)
4.8.3	Statut de l'abonnement	Shows: Status, Subscription type(s), Plan, Renewal date
4.8.4	Tableau historique des paiements	Columns: N° reçu, Date, Articles, Total, Payé, Restant, Actions (View / Refund)
4.8.5	Click "Consulter" (View) on a payment	Opens the receipt detail
4.8.6	Click "Rembourser" (Refund)	Initiates a refund process
4.8.7	Liste des frais impayés	Auto-generated list. Each item has an "Ajouter au paiement" button
4.8.8	"Acheter" button	Opens the shop/store
4.8.9	Renewal logic:	Subscription renewal is automatic (balance updates automatically)
4.8.10	If a member misses 3 consecutive sessions	A notification appears on the Dashboard asking whether to suspend or deactivate the subscription
4.9 — Section 8: Équipement (Equipment)
Step	Action	Expected Result
4.9.1	You see: Required equipment vs. Owned equipment	Comparison view
4.9.2	Equipment cards show:	Item name, Quantity, Purchase date
4.9.3	"Acheter de l'équipement" (Buy Equipment) button	Opens equipment purchase flow
4.9.4	Purchase history	List of past equipment purchases
4.10 — Section 9: Horaires (Schedule)
Step	Action	Expected Result
4.10.1	You see a weekly schedule grid	Shows all enrolled sessions across all disciplines
4.11 — Section 10: Famille (Family)
Step	Action	Expected Result
4.11.1	You see linked family members in a list	Each entry shows the member name and relationship
4.11.2	Click "Ouvrir le profil"	Opens that family member's profile
4.11.3	Click "Supprimer le lien"	Removes the family link (with confirmation)
4.11.4	Click "Ajouter Lien"	Opens search to find and link another member
4.12 — Section 11: Notes
Step	Action	Expected Result
4.12.1	You see a notes section	Free-text notes about this member
4.13 — Section 12: Journal d'audit (Audit Log)
Step	Action	Expected Result
4.13.1	You see all modifications made to this member	Same format as the Edit Member audit log (see Section 5.11)
5 — EDIT A MEMBER — 11 TABS
Navigation model: Tabbed interface (not a wizard, since data already exists).

5.0 — Global Edit Behaviors
Step	Action	Expected Result
5.0.1	Each tab has "Enregistrer les modifications" (Save) and "Annuler" (Cancel) buttons	Top-right on desktop, bottom on mobile
5.0.2	The Save button is disabled until:	A modification is made AND all fields on the tab are valid
5.0.3	Try to change tabs with unsaved changes	⚠️ A modal appears: "Modifications non enregistrées — Vous avez des modifications non enregistrées. Souhaitez-vous les enregistrer avant de quitter ?" — Buttons: Enregistrer / Annuler
5.0.4	Try to leave the page with unsaved changes	Same modal appears
5.0.5	All validation rules are identical to the Add Member wizard	Real-time validation, same restrictions
5.1 — Tab 1: Identité
Step	Action	Expected Result
5.1.1	You see the Member ID (system-generated)	Read-only text. Example: M-2024-01837
5.1.2	Click the copy icon next to the ID	ID is copied to clipboard. Tooltip shows: "Copié !"
5.1.3	All identity fields are editable	Same rules as Step 3 of the wizard
5.2 — Tab 2: Contact
Step	Action	Expected Result
5.2.1	All contact fields are editable	Same rules as Step 4 of the wizard
5.3 — Tab 3: Disciplines
Step	Action	Expected Result
5.3.1	Enrolled disciplines are shown and editable	Can add/remove disciplines, change schedule, change instructor, change belt
5.4 — Tab 4: Documents
Step	Action	Expected Result
5.4.1	For each document you see:	File upload, Expiry date selector, Replace button, Delete button, Status badge
5.4.2	Status badges:	✅ Valide / 🔴 Expiré / ⚫ Manquant / 🟡 En attente
5.4.3	Expired documents show	Red border + text: "Document expiré il y a X jours"
5.4.4	Click "Remplacer" (Replace)	Asks for user confirmation before replacing
5.4.5	Filter by document type	Dropdown: Tous / Identité / Médical / Licence / …
5.5 — Tab 5: Calendrier (Schedule)
Step	Action	Expected Result
5.5.1	You see the current weekly schedule	Displayed as an interactive grid
5.5.2	Hover over a time slot	Tooltip: "Effectif actuel : 30" (Current count: 30)
5.5.3	Select a conflicting slot	Modal: "Ce créneau horaire est incompatible avec une inscription en Taekwondo. Continuer ?"
5.6 — Tab 6: Équipement
Step	Action	Expected Result
5.6.1	You see: Current equipment, Required equipment by discipline, Purchase history	
5.6.2	Table columns:	Article, Qté, Date d'achat, Actions
5.6.3	Buttons:	"Ajouter Équipement", "Supprimer Équipement"
5.7 — Tab 7: Facturation et abonnement
Step	Action	Expected Result
5.7.1	You see: Current subscription, Renewal date, Plan, Remaining balance, Payment history	
5.7.2	Toggle auto-renewal on/off	Auto-renewal state changes
5.7.3	Change the subscription plan	The price summary updates in real-time
5.7.4	If subscription has expired	A banner appears: "Renouveler maintenant" (Renew Now) button
5.7.5	Click "Ajouter un paiement"	Opens payment flow
5.7.6	Unpaid charges list	Shows all outstanding items
5.8 — Tab 8: Photo
Step	Action	Expected Result
5.8.1	You see the current photo	Displayed prominently
5.8.2	Click "Remplacer" (Replace)	Opens the camera modal (same as Step 2 of the wizard)
5.8.3	Take a new photo, crop the face, confirm	Old photo is replaced. You are asked to confirm the replacement
5.9 — Tab 9: Liens familiaux (Family Links)
Step	Action	Expected Result
5.9.1	You see a list of linked family members	With relationship type
5.9.2	Click "Ajouter un nouveau lien"	Search opens. Find a member and select a relationship from dropdown (Frère, Sœur, Parent, Enfant, Tuteur, …)
5.9.3	Try to link a member to themselves	❌ Blocked — error message
5.9.4	Click "Supprimer le lien"	Link is removed (with confirmation)
5.10 — Tab 10: Notes
Step	Action	Expected Result
5.10.1	You see a text area labeled "Ajouter une note"	You can type a note
5.10.2	Click "Enregistrer la note"	Note is saved and appears in the list below
5.10.3	Each note shows:	Timestamp, Author, Content
5.10.4	Each note has Modifier (Edit) and Supprimer (Delete) icons	Click to edit or delete
5.11 — Tab 11: Journal d'audit (Audit Log)
Step	Action	Expected Result
5.11.1	You see a table of all modifications	Columns: Champ (Field), Avant (Before), Après (After), Utilisateur (User), Horodatage (Timestamp)
5.11.2	Pagination works	Navigate through pages of audit entries
5.11.3	Filter by user	Dropdown to filter entries by who made the change
5.11.4	Sort by date	Click column header to sort ascending/descending
6 — ATTENDANCE & BIOMETRICS
Access: Left sidebar → Présence et biométrie

6.0 — Security & Global Rules
Rule	Expected Behavior
Admin overrides	Admin can correct biometric errors or expired statuses by providing a documented justification
Immediate feedback	✅ Green confirmations, 🔴 Red alerts, 🔊 Sound signals for successes/failures
Full traceability	Every check-in/check-out, every exception, every biometric match is logged with: actor, method, confidence score
6.1 — Attendance Dashboard
Step	Action	Expected Result
6.1.1	Click "Présence" in the sidebar	The attendance dashboard opens
Top Row: Quick Actions		
6.1.2	You see buttons:	"Démarrer le kiosque" (Start Kiosk), "Départ en masse" (Mass Check-out)
Main Zone		
6.1.3	Center: Présence (Present Members)	A grid of thumbnails showing members currently present
6.1.4	Each thumbnail shows:	Photo, Full name, Discipline, Arrival time, Payment status badge
6.1.5	Thumbnails are updated in real-time	New arrivals appear, departures disappear
6.1.6	Left: Planning du jour (Today's Schedule)	List of today's scheduled sessions: Discipline, Time, Coach
6.1.7	Each session row has buttons:	"Ouvrir la liste des athlètes" (Open Athlete List), "Marquer sa présence" (Mark Attendance)
Thumbnail Interactions		
6.1.8	Click/tap a presence thumbnail	A popup opens showing: Name, Belt/Grade, Balance, Last check-in/check-out times, Attendance for last 2 sessions
6.1.9	The popup has buttons:	"Ouvrir le profil" (Open Profile), "Marquer comme absent" (Mark as Absent)
Real-time & Offline		
6.1.10	If connection is lost	A banner appears: "Mises à jour en direct suspendues – mode hors ligne"
Keyboard Accessibility		
6.1.11	Tab order is:	Search → Filters → Attendance Grid → Schedule → Alerts
6.1.12	Use arrow keys and Enter	Thumbnails and rows are navigable via keyboard
7 — ATTENDANCE KIOSK (TERMINAL)
Interactive touch terminal. Used by athletes, parents, and staff at the club entrance.

7.0 — Kiosk Layout
Zone	Content
Upper-left	Camera feed + instructions: "Placez-vous devant la caméra. Alignez votre visage dans le cadre."
Upper-right	Current date & time + connection status indicator (Connecté / Hors ligne)
Lower area	Results / match display
7.1 — Automatic Scan Mode
Step	Action	Expected Result
7.1.1	A person stands in front of the kiosk camera	The system automatically detects and identifies their face
7.1.2	Face is matched + subscription is OK (balance = 0)	✅ Automatic check-in. A green confirmation + success sound plays
7.1.3	The match card shows:	Large photo, Name, Discipline badges, Balance chip
7.1.4	On the receptionist's device only:	"Refuser" (Reject — red button) + "Afficher le profil" (View Profile — small button)
7.1.5	Face is matched BUT subscription is expired or balance is unpaid	🔴 Red card with message + alert sound. Check-in is denied
7.1.6	Face is not detected	Message: "Visage non détecté !"
7.1.7	Low confidence match	Message: "Faible niveau de confiance de la reconnaissance faciale – veuillez réessayer ou utiliser l'enregistrement manuel."
7.2 — Manual Search Mode
Step	Action	Expected Result
7.2.1	You see a large centered search field	For manual lookup
7.2.2	Type a member name	Results appear as large thumbnails (name, photo, discipline)
7.2.3	On the athlete/parent terminal	Only the image is visible (no name/details)
7.2.4	Select a thumbnail	Two buttons appear: "Arrivée" (Check-in) and "Départ" (Check-out)
7.2.5	On the athlete/parent terminal	Validation is automatic after password entry
7.3 — Kiosk Payment Flow
Step	Action	Expected Result
7.3.1	A user opts to pay at the kiosk	The payment request is sent to administrators
7.3.2	An admin validates the transaction from any device	A receipt is automatically printed detailing the financial operation
7.4 — Kiosk Errors & Fallbacks
Scenario	Expected Result
Biometric service is offline	Message: "Service biométrique indisponible – veuillez procéder à l'enregistrement manuel"
Camera permission denied	Step-by-step help: "Autorisez l'accès à la caméra dans votre navigateur" with illustrated guide
Expired subscription or unpaid balance	Red card with message + access denied
Duplicate check-in detected	Message: "Arrivée en double détectés — déjà enregistré à 09h12."
Successful check-in	Message: "Arrivée enregistrés."
Subscription expired	"Abonnement expiré – accès refusé. Contactez le personnel."
Unpaid balance — with option	"Solde impayé. Accès refusé. Contactez le personnel. Procéder au paiement ?" → Buttons: Continuer / Annuler
Check-in on a non-scheduled session	🔴 Alert sound + warning
7.5 — Kiosk Alerts During Check-in
Alert Type	When Triggered
Solde impayé	Member has an unpaid balance
Abonnement expiré	Subscription has expired
Expiration dans < 4 jours	Subscription expires in less than 4 days
Arrivée en double	Same member already checked in today
2 absences consécutives	Member is flagged as "à risque" (at risk)
7.6 — Alert Actions
Action	Expected Result
Send SMS	SMS is sent to the member/parent
Create a staff task	A task is created for staff to call the parent
Add "à risque" status	The status is added to the member's profile
7.7 — Offline Behavior
Step	Action	Expected Result
7.7.1	Server goes offline	A permanent banner appears: "Hors ligne – les arrivées et les départs sont stockés localement et synchronisés lors de la connexion."
7.7.2	Check-in/check-out at the kiosk while offline	✅ Works — data is saved locally
7.7.3	Server comes back online	Local data is automatically synced to the server
7.7.4	Offline check-in confirmation	Message: "Hors ligne — l'arrivée est sauvegardée localement et sera synchronisée dès que vous serez en ligne."
8 — ATTENDANCE LOGS & EXPORTS
8.1 — Attendance Log Screen
Step	Action	Expected Result
8.1.1	Open the attendance log	You see a table with columns:
Date, Heure, Membre, Discipline, Méthode (face/manual), Appareil (kiosk-01), Statut (Arrivé/Départ), Durée, Notes, Intervenant (operator)
8.1.2	Filters available:	Date range (preset + custom), Member, Discipline, Method, Device, Status
8.1.3	Row actions:	"Afficher le membre" (View Member), "Modifier l'entrée" (Edit — admin only), "Supprimer l'entrée" (Delete — admin only, with reason)
8.1.4	Click "Exporter"	Exports the filtered data (Excel/PDF)
8.2 — Modification History
Step	Action	Expected Result
8.2.1	When an attendance entry is modified	The system records: before value, after value, reason for modification
9 — REPORTS
Access: Left sidebar → Rapports et analyses

9.0 — Reports General
Step	Action	Expected Result
9.0.1	Open the Reports section	You see a report builder/selector
9.0.2	You can create custom reports	With a builder interface
9.0.3	Each report has:	Header bar (report title), Chart area, Data table area, Export button
9.0.4	Supported chart types:	Bar charts, Line charts, Heatmaps, Pie/Donut charts, Column charts, Multi-series charts, Funnel charts, Calendar charts, Scatter plots
9.0.5	Click "Exporter"	Exports the report (Excel/PDF)
9.1 — Attendance Reports
Report	What It Shows
Total check-ins	Total number of arrivals in a period
Absence report	Members who were absent and when
Late arrivals report	Members arriving late
9.2 — Financial Reports
Report	What It Shows
Revenue	Total income over a period
Unpaid balances	All outstanding debts
Daily cash register	Daily financial summary
Sales & inventory	Product sales data
9.3 — Membership Reports
Report	What It Shows
Total members	Count of all members
Member growth	New members over time
Active vs. Inactive	Comparison breakdown
Gender & age distribution	Demographics
New members report	Recently added members
9.4 — Equipment/Inventory Reports
Report	What It Shows
Stock value	Total value of current inventory
Total sales	Revenue from equipment sales
9.5 — Document Compliance Reports
Report	What It Shows
Missing documents	Members without required documents
Expired documents	Documents past their expiry date
Expiring soon	Documents expiring within a set period
10 — POINT OF SALE (POS)
Access: Left sidebar → Inventaire et point de vente

Step	Action	Expected Result
10.1	Open the POS	You see a point-of-sale interface
10.2	Scan a barcode	The item is identified: name + price are displayed
10.3	Add items to the cart	Cart total updates
10.4	If the customer is a member:	Two options: Pay now or Add to existing balance
10.5	Identify the member by:	Facial recognition or manual search
10.6	Complete the sale	Receipt is generated
11 — EXPENSES
Access: Left sidebar → Paiements et finances → Dépenses

Step	Action	Expected Result
11.1	Open the Expenses section	You see a list/table of recorded expenses
11.2	Add a new expense	Fields for: date, category, amount, description, receipt upload
11.3	Save the expense	It appears in the expenses list
12 — SETTINGS
Access: Left sidebar → Paramètres

Step	Action	Expected Result
12.1	Open Settings	You see a settings panel
12.2	Every element in the application can be modified here	Prices, disciplines, roles, equipment items, document types, notification rules, etc.
12.3	Add a new staff role	The role becomes available in the Add Member wizard (Step 1, Personnel dropdown)
12.4	Modify subscription prices	Prices update across the system
12.5	Modify equipment prices	Prices update across the system
12.6	Modify disciplines	Disciplines update across the system
13 — GLOBAL BEHAVIORS (Apply Everywhere)
13.1 — Keyboard Navigation
Rule	Expected Behavior
Every interactive element is reachable via Tab	Focus ring is visible
Every element is clickable and leads to its section	With a highlight effect
"Précédent" (Back) button	Available on every page to return to the previous location
13.2 — Input Validation (All Forms)
Rule	Expected Behavior
Latin name fields	Only Latin letters + spaces
Arabic name fields	Only Arabic letters + spaces
Number fields	Only digits
Real-time validation	Errors appear/disappear instantly as you type
Double spaces	Auto-corrected to single space
Max 40 characters	Input stops at 40 chars
Auto-capitalize	First letter of each word is capitalized
Green checkmark ✓	Appears when a field is valid and filled
Required fields	❌ Block progression — alert on any navigation attempt
Warnings	Appear immediately on invalid input, disappear when corrected
13.3 — Backups
Rule	Expected Behavior
After every financial operation	A backup is performed
13.4 — Change Log
Field	What Is Recorded
Date	When the change happened
What changed	Description of the change
Who made it	User who performed the change
Why	Reason for the change
13.5 — Scrolling & Text Minimization
Rule	Expected Behavior
Minimize scrolling	Layouts are designed to show information without excessive scrolling
Minimize text input	Dropdowns, selectors, and pre-filled values are used wherever possible
13.6 — Two Distinct Alert Sounds
Sound	When It Plays
✅ Validation sound (green)	Successful check-in, payment confirmed, etc.
🔴 Anomaly sound (red)	Unpaid balance, expired subscription, check-in at non-scheduled session, etc.
Both sounds are loud and distinct — designed to be heard in a busy club environment.