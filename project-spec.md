creat the document that you will folow here is what you need to do Project Lead (You)
1
Assigns tasks, reviews progress daily, approves sprint completion, communicates with client. You do NOT code.
Frontend Developer
2
Build all screens, components, forms, and interactions. One senior, one mid-level.
Backend Developer
1
Build the API, database, business logic, authentication, and all server-side systems.
QA Reviewer (The Gatekeeper)
1
Reviews EVERY deliverable before it is accepted. Checks code quality, UI accuracy, performance, and security. Has the power to REJECT work.
The QA Reviewer — The Gatekeeper
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
How the Team Works
WORKFLOW — HOW GOOGLE, STRIPE, AND LINEAR DO IT
Project Lead assigns a Part (sprint) from this document.
Developers read the Part spec completely before writing a single line of code.
Developers work for the sprint duration (typically 5–10 working days per Part).
When done, developer opens a Pull Request with screenshots and a self-checklist.
Gatekeeper reviews the PR against the Part’s checklist within 24 hours.
If rejected: developer fixes and resubmits. No new Part until the current one passes.
If approved: Project Lead marks Part as complete. Team moves to the next Part.
RULE: No Part is started until the previous Part is fully approved. Sequential delivery.
Git + GitHub/GitLab
Version control
One repo, main branch is protected, all work via Pull Requests.
Docker
Deployment
Everything runs in Docker. No ‘it works on my machine’ excuses.
Before Any Code — Architecture Decisions
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
Auth: JWT token in Authorization: Bearer  header. Token expires in 8 hours.
Role check middleware on every endpoint. Frontend hiding a button is NOT security.
Rate limiting: 100 requests/minute per user.
Input validation on EVERY endpoint using Zod schemas. Never trust frontend validation alone.
File uploads: multipart/form-data, max 5MB, accept only: jpg, png, webp, pdf.
Every endpoint logs: who called it, what they sent, what was returned, timestamp.
you will do this the best Project Setup + Design System
Who Does What
Person
Tasks
Frontend Senior
Initialize React + TypeScript + Tailwind project.2. Configure Tailwind with the exact design tokens (colors, spacing, fonts, shadows, radii) from this document.3. Build the shared UI component library: Button, Input, Select, DatePicker (3 dropdowns), Badge, Card, Modal, Toast, Table, Skeleton Loader.4. Build a Storybook or demo page showing every component in every state (default, hover, focus, error, disabled, loading).
Backend Developer
Initialize Node.js + Fastify + TypeScript project.2. Set up Prisma + PostgreSQL connection.3. Design and create the full database schema (all tables, relations, indexes).4. Set up Docker Compose: postgres, backend, and a placeholder for the frontend.5. Create seed data script with 20 test members, 3 disciplines, sample payments.

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