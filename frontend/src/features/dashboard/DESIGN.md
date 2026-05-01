# Dashboard — Design Specification

**Version:** 1.0  
**Date:** 2026-04-15  
**Status:** Implementation-ready  
**Audience:** frontend-dev

This spec is written against the existing token system in `src/styles/tokens.css` and
`tailwind.config.js`. No new tokens are invented; every value references an existing
variable or Tailwind class. Where a one-off value is genuinely needed it is called out
explicitly and kept to a minimum.

---

## 0. Token Reference Cheat-Sheet

The values below are the full token vocabulary. All specs in this document use
these names only.

### Colors

| Token (CSS var)              | Tailwind class            | Hex       |
|------------------------------|---------------------------|-----------|
| `--color-primary-50`         | `bg-primary-50`           | #EEF4FF   |
| `--color-primary-100`        | `bg-primary-100`          | #DCE8FF   |
| `--color-primary-500`        | `bg-primary-500`          | #2563EB   |
| `--color-primary-600`        | `bg-primary-600`          | #1D4ED8   |
| `--color-neutral-50`         | `bg-neutral-50`           | #F8FAFC   |
| `--color-neutral-100`        | `bg-neutral-100`          | #F1F5F9   |
| `--color-neutral-200`        | `bg-neutral-200`          | #E2E8F0   |
| `--color-neutral-300`        | `bg-neutral-300`          | #CBD5E1   |
| `--color-neutral-400`        | `text-neutral-400`        | #94A3B8   |
| `--color-neutral-500`        | `text-neutral-500`        | #64748B   |
| `--color-neutral-600`        | `text-neutral-600`        | #475569   |
| `--color-neutral-700`        | `text-neutral-700`        | #334155   |
| `--color-neutral-800`        | `text-neutral-800`        | #1E293B   |
| `--color-neutral-900`        | `text-neutral-900`        | #0F172A   |
| `--color-success`            | `text-success`            | #16A34A   |
| `--color-success-bg`         | `bg-success-bg`           | #DCFCE7   |
| `--color-success-fg`         | `text-success-fg`         | #14532D   |
| `--color-danger`             | `text-danger`             | #DC2626   |
| `--color-danger-bg`          | `bg-danger-bg`            | #FEE2E2   |
| `--color-danger-fg`          | `text-danger-fg`          | #7F1D1D   |
| `--color-warning`            | `text-warning`            | #D97706   |
| `--color-warning-bg`         | `bg-warning-bg`           | #FEF3C7   |
| `--color-warning-fg`         | `text-warning-fg`         | #78350F   |
| `--color-info`               | `text-info`               | #0284C7   |
| `--color-info-bg`            | `bg-info-bg`              | #E0F2FE   |
| `--color-info-fg`            | `text-info-fg`            | #0C4A6E   |

### Spacing (4-px grid)

`space-1`=4px, `space-2`=8px, `space-3`=12px, `space-4`=16px, `space-5`=20px,
`space-6`=24px, `space-8`=32px, `space-10`=40px

### Typography

| Role          | Font                | Tailwind              |
|---------------|---------------------|-----------------------|
| UI / Latin    | Inter               | `font-sans`           |
| Arabic sub    | Noto Sans Arabic    | `font-arabic`         |
| `text-xs`     | 12px / 16px lh      |                       |
| `text-sm`     | 14px / 20px lh      |                       |
| `text-base`   | 16px / 24px lh      |                       |
| `text-lg`     | 20px / 28px lh      |                       |
| `text-xl`     | 24px / 32px lh      |                       |

### Shadows

`shadow-elevation-1` · `shadow-elevation-2` · `shadow-elevation-3`

### Radii

`rounded-sm`=4px · `rounded-md`=8px · `rounded-lg`=12px · `rounded-full`=9999px

### Animations (existing keyframes)

| Name          | Duration   | Easing      | Use-case                |
|---------------|------------|-------------|-------------------------|
| `fade-in`     | 150ms      | ease-out    | Overlay/dropdown appear |
| `slide-up`    | 180ms      | ease-out    | Dropdown / modal entry  |
| `shimmer`     | 1.4s lin.  | linear      | Skeleton loader         |
| `toast-in`    | 200ms      | ease-out    | Toast notifications     |

New keyframe required (defined once in `globals.css` under `@layer components`):

```css
@keyframes highlight-pulse {
  0%   { background-color: transparent; }
  20%  { background-color: var(--color-primary-50); }
  80%  { background-color: var(--color-primary-50); }
  100% { background-color: transparent; }
}
```

New keyframe for facial-search glow (defined in same layer):

```css
@keyframes icon-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
  50%       { box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.25); }
}
```

Both keyframes respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-highlight-pulse,
  .animate-icon-glow { animation: none; }
}
```

---

## 1. Alert Card — Member Variant

Used in: Abonnements expirant, Renouvellement requis, Solde impayé, Documents
manquants, Inactifs, Absents (6 sections).

### Anatomy

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────┐  Full Name (Latin) bold                [Discipline]   │
│  │  64  │  Arabic subtitle text (dir=rtl)                       │
│  │  px  │  Renewal: 15 Apr 2026  ·  in 3 days                   │
│  └──────┘                                                       │
│  ←── left-accent-bar (3px, severity color) ──────────────────→  │
└─────────────────────────────────────────────────────────────────┘
```

The card itself is a `<a>` or `<button>` element — making the entire surface
keyboard-reachable without nesting interactive elements.

### Exact Dimensions

| Property              | Value                         |
|-----------------------|-------------------------------|
| Card height           | min 80px (auto with content)  |
| Card padding          | `p-3` (12px all sides)        |
| Avatar size           | 64px × 64px                   |
| Avatar border-radius  | `rounded-full`                |
| Gap avatar → content  | `gap-3` (12px)                |
| Left accent bar       | 3px wide, full card height    |
| Left accent bar radius| `rounded-l-md` on card        |
| Discipline badge      | pill, `rounded-full`          |

### Tailwind Class String — Card Wrapper

```
relative flex items-center gap-3 p-3 rounded-md border border-neutral-200
bg-white shadow-elevation-1 cursor-pointer transition-all duration-200
hover:shadow-elevation-2 hover:border-neutral-300
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
focus-visible:ring-offset-2
```

The left accent bar is a sibling `<div>` absolutely positioned:
```
absolute left-0 inset-y-0 w-[3px] rounded-l-md
```
Its `bg-*` class is the severity color (see §3).

### Avatar

```
h-16 w-16 shrink-0 rounded-full object-cover
```

Fallback initials div (when no photo):
```
h-16 w-16 shrink-0 rounded-full bg-primary-100 text-primary-600
flex items-center justify-center text-base font-semibold select-none
```
Initials: up to 2 chars, `font-sans`, uppercase.

### Content Area

```
min-w-0 flex-1 flex flex-col gap-1
```

**Full Name (Latin):**
```
text-sm font-semibold text-neutral-900 truncate
```

**Arabic subtitle:**
```
text-xs font-arabic text-neutral-500 truncate
```
Rendered with `dir="rtl"` on the element itself, not the card wrapper.
If the Arabic field is empty, this line is omitted entirely (no empty space).

**Renewal / date line:**
```
flex items-center gap-1.5 text-xs text-neutral-500
```
Date portion: `font-medium text-neutral-700`  
Relative hint ("in 3 days"): `text-neutral-400`  
When overdue ("5 days ago"): `text-danger` for the relative hint only.

**Discipline badge (pill):**
Positioned at top-right of the content area using `absolute top-3 right-3`
on the badge, or via `flex justify-between items-start` on the content wrapper
with the badge in a `shrink-0` container.

Badge markup reuses the existing `Badge` component pattern:
```
inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium
```
Badge color is discipline-specific (see §3 for the mapping per section).

### States

**Hover:**
- `shadow-elevation-2`
- `border-neutral-300`
- Transition: `duration-200 ease-out` on `shadow` and `border-color`

**Focus-visible (keyboard):**
- `ring-2 ring-primary-500 ring-offset-2 rounded-md`
- The left accent bar remains visible (it is not obscured by the ring because
  `ring-offset-2` pushes the ring 2px outward)

**Empty state (section has 0 alerts):**
```
flex flex-col items-center justify-center py-8 gap-2
text-sm text-neutral-400
```
Icon: `<Icon name="inbox" size={32} />` in `text-neutral-300`  
Label: e.g. "No expiring memberships" in `text-neutral-400 text-sm`

### Skeleton (loading state, 1 card)

```
┌──────────────────────────────────────────────────────────┐
│  [■■■■ 64px ■■■■]  [████████████ 60%] [■■■ 18%]          │
│                    [████████ 40%]                         │
│                    [████ 30%]                             │
└──────────────────────────────────────────────────────────┘
```

Use `<Skeleton variant="row" />` (already covers the avatar + two text lines
pattern). For the discipline badge placeholder add a 3rd block `w-16 h-4
rounded-full skeleton-shimmer animate-shimmer` via `className` extension.

---

## 2. Stock Alert Card — Non-Member Variant

Used in: "Rupture de stock" section only.

### Anatomy

```
┌───────────────────────────────────────────────────────┐
│ [package icon 20px]  Product Name          [Qty pill] │
│                      → link to inventory item         │
└───────────────────────────────────────────────────────┘
```

### Tailwind Class String — Card Wrapper

```
flex items-center gap-3 px-3 py-2.5 rounded-md border border-neutral-200
bg-white shadow-elevation-1 cursor-pointer transition-all duration-150
hover:shadow-elevation-2 hover:border-neutral-300
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
focus-visible:ring-offset-1
```

### Icon

```
shrink-0 text-neutral-400
```
Use `<Icon name="package" size={20} />`.

### Product Name

```
min-w-0 flex-1 text-sm font-medium text-neutral-800 truncate
```

### Quantity Pill

When `qty === 0`:
```
inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold
bg-danger-bg text-danger-fg border-danger/20
```
Content: "Rupture" (out-of-stock label).

When `qty > 0` but below threshold (low stock):
```
inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold
bg-warning-bg text-warning-fg border-warning/30
```
Content: quantity number, e.g. "2 restant".

### Link-to-item

A `<a>` wraps the entire card to navigate to `/inventory/:productId`.
The `<Icon name="arrow-right" size={14} />` in `text-neutral-400 shrink-0`
appears at far right, visible on hover via:
```
opacity-0 group-hover:opacity-100 transition-opacity duration-150
```
Add `group` class to the wrapper `<a>`.

### Empty state

```
text-sm text-neutral-400 text-center py-6
```
"All items stocked." with `<Icon name="check" size={24} />` in `text-success`.

---

## 3. Severity Color Mapping

Each alert section maps to exactly one severity tier. The tier controls:
1. The left accent bar `bg-*` color on the Member Alert Card.
2. The section count-pill color (see §4).

| Section (FR)                   | Severity tier | Accent bar class           | Count-pill classes                                     |
|--------------------------------|---------------|----------------------------|--------------------------------------------------------|
| Abonnements expirant           | warning       | `bg-warning`               | `bg-warning-bg text-warning-fg border-warning/30`      |
| Renouvellement requis          | warning       | `bg-warning`               | `bg-warning-bg text-warning-fg border-warning/30`      |
| Solde impayé                   | danger        | `bg-danger`                | `bg-danger-bg text-danger-fg border-danger/20`         |
| Documents manquants            | warning       | `bg-warning`               | `bg-warning-bg text-warning-fg border-warning/30`      |
| Membres inactifs               | info          | `bg-info`                  | `bg-info-bg text-info-fg border-info/20`               |
| Membres absents                | info          | `bg-info`                  | `bg-info-bg text-info-fg border-info/20`               |
| Rupture de stock               | danger        | `bg-danger` (on section)   | `bg-danger-bg text-danger-fg border-danger/20`         |

**Contrast verification (WCAG 2.1 AA):**

| Text / Background pair          | Approximate ratio | Pass? |
|---------------------------------|-------------------|-------|
| `warning-fg` (#78350F) on `warning-bg` (#FEF3C7) | 7.2:1  | Pass  |
| `danger-fg` (#7F1D1D) on `danger-bg` (#FEE2E2)   | 6.9:1  | Pass  |
| `info-fg` (#0C4A6E) on `info-bg` (#E0F2FE)       | 7.1:1  | Pass  |
| `neutral-900` on `white`                          | 17.5:1 | Pass  |
| `neutral-500` on `white`                          | 4.6:1  | Pass  |

All severity pairs use the existing semantic tokens — no new colors needed.

---

## 4. Dashboard Layout

### Page Shell

The dashboard lives inside the main app shell. Header is fixed at `h-14`
(56px), so the page content must start with `pt-14` (or handled by the shell
wrapper). A sticky "Alert Summary Bar" sits immediately below the header.

```
┌────────────────────────────────────────────────────────────┐
│  Header (fixed, h-14, z-50)                                │
├────────────────────────────────────────────────────────────┤
│  Alert Summary Bar (sticky top-14, z-40, h-10, bg-white)   │
│  [Abonnements 12] [Impayés 3] [Docs 7] [Stock 2] …         │
├────────────────────────────────────────────────────────────┤
│  Page content (pt-[96px] = 56px header + 40px sticky bar)  │
│  px-4 md:px-6                                              │
│                                                            │
│  Dashboard title row                                       │
│  Section grid                                              │
└────────────────────────────────────────────────────────────┘
```

### Alert Summary Bar

A horizontal scrollable row of compact count-chips acting as jump-links to
each section. On desktop all chips fit without scrolling; on mobile it
overflows-x with `overflow-x-auto scrollbar-none`.

```
fixed top-14 inset-x-0 z-40 bg-white border-b border-neutral-200
flex items-center gap-2 px-4 h-10 overflow-x-auto
```

Each chip is an `<a href="#section-id">`:
```
inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1
text-xs font-semibold whitespace-nowrap transition-colors duration-150
cursor-pointer
```
Color classes come from the section's severity tier (§3 count-pill classes).

### Section Grid — Desktop (≥1024px)

```
grid grid-cols-2 gap-6
```

Sections are ordered by urgency (danger → warning → info):
1. Solde impayé (danger)
2. Rupture de stock (danger)
3. Abonnements expirant (warning)
4. Renouvellement requis (warning)
5. Documents manquants (warning)
6. Membres inactifs (info)
7. Membres absents (info)

Each section occupies one grid cell. Section 7 (Absents) spans `col-span-2`
if the total count is odd, keeping the layout balanced.

### Section Grid — Tablet (768px–1023px)

```
grid grid-cols-2 gap-4
```

All 7 sections in two columns; last section full-width if odd. Same urgency
ordering.

### Section Grid — Mobile (<768px)

```
flex flex-col gap-4
```

Stacked single column. Same urgency ordering.

### Section Card (wrapper for each alert section)

```
rounded-lg border border-neutral-200 bg-white shadow-elevation-1
overflow-hidden
```

**Section Header Pattern:**

```
┌───────────────────────────────────────────────────────┐
│ px-4 py-3 flex items-center gap-3 border-b            │
│ border-neutral-100                                    │
│                                                       │
│ [severity-dot 8px]  Section Title          [N] Voir → │
└───────────────────────────────────────────────────────┘
```

Section title: `text-sm font-semibold text-neutral-800`

Severity dot: `h-2 w-2 rounded-full` + severity accent `bg-*` (§3)

Count pill:
```
inline-flex items-center rounded-full border px-2 py-0.5
text-xs font-semibold
```
Color from §3 severity mapping.

"Voir tout" link:
```
ml-auto flex items-center gap-1 text-xs font-medium text-primary-500
hover:text-primary-600 transition-colors duration-150 cursor-pointer
focus-visible:ring-2 focus-visible:ring-primary-500 rounded-sm
```
Followed by `<Icon name="arrow-right" size={12} />`.

**Section Body:**

```
divide-y divide-neutral-100
```

Each alert card sits in the `divide-y` list. Padding already inside the card
(`p-3`), so the section body wrapper has no extra padding.

Maximum visible cards per section: **5**. If more exist, a "View N more"
footer row appears:
```
px-4 py-2.5 text-xs font-medium text-primary-500 hover:text-primary-600
hover:bg-primary-50 transition-colors duration-150 cursor-pointer
text-center border-t border-neutral-100
```

### Skeleton Loader — Full Dashboard

While data loads, render 2 columns × 3 section skeletons (desktop) or 1
column × 4 (mobile). Each section skeleton:

```
┌──────────────────────────────────────────┐
│ [████ header 40px shimmer] ────────────  │
│ ──────── row skeleton ─────────────────  │
│ ──────── row skeleton ─────────────────  │
│ ──────── row skeleton ─────────────────  │
└──────────────────────────────────────────┘
```

Use:
- Section header: `<Skeleton variant="block" height="40px" />` with
  `bg-neutral-100 rounded-none border-b border-neutral-200`
- Each row: `<Skeleton variant="row" />` — already renders avatar + two text
  lines, matching the Alert Card anatomy

Visible count during loading: 3 rows per section (avoids layout shift).

---

## 5. Global Search Dropdown

Anchored directly below the `<input>` in the Header. The input already has
`max-w-[400px]` — the dropdown inherits this width.

### Positioning

```
position: absolute;
top: calc(100% + 4px);   /* 4px gap below input */
left: 0;
width: 100%;
z-index: 50;             /* matches header z-50 context */
```

Tailwind equivalent on the panel wrapper:
```
absolute left-0 top-[calc(100%+4px)] w-full z-50
rounded-md border border-neutral-200 bg-white shadow-elevation-3
overflow-hidden animate-slide-up
```

### Panel Structure

```
┌──────────────────────────────────────────────────┐
│ MEMBERS (3)                           section hdr │
│ ├ [avatar] Full Name     Membership ends…         │
│ ├ [avatar] Full Name     Membership ends…         │
│ └ [avatar] Full Name     Membership ends…         │
│──────────────────────────────────────────────────│
│ PAYMENTS (1)                          section hdr │
│ └ [icon]  Receipt #0042  2,500 DA · 14 Apr 2026   │
│──────────────────────────────────────────────────│
│ PRODUCTS (2)                          section hdr │
│ ├ [icon]  Whey Protein   Stock: 14 units          │
│ └ [icon]  Resistance Band Stock: 0 — Rupture      │
│──────────────────────────────────────────────────│
│  Appuyer sur Entrée pour tous les résultats →     │
└──────────────────────────────────────────────────┘
```

Maximum panel height: `max-h-[420px] overflow-y-auto` (scrollable, never
clips the page).

**Section header row:**
```
px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest
text-neutral-400 bg-neutral-50 sticky top-0
```

**Hit row (member):**
```
flex items-center gap-3 px-3 py-2.5 cursor-pointer
transition-colors duration-100
hover:bg-neutral-50 aria-selected:bg-primary-50
```

- Photo/avatar: 32px circle (`h-8 w-8 rounded-full`)
- Fallback initials: `bg-primary-100 text-primary-600 text-xs font-semibold`
- Primary text: `text-sm font-medium text-neutral-900 truncate`
- Secondary text: `text-xs text-neutral-400 shrink-0`

**Hit row (payment):**
Same layout but avatar replaced with:
```
h-8 w-8 rounded-md bg-neutral-100 flex items-center justify-center
text-neutral-400 shrink-0
```
Icon: `<Icon name="credit-card" size={16} />`

**Hit row (product):**
Same layout but icon: `<Icon name="package" size={16} />`

**Keyboard highlight (`aria-selected="true"`):**
```
bg-primary-50
```
Text color unchanged — contrast is maintained (`neutral-900` on `primary-50`
= ~17:1).

Currently active item must have `role="option"` and its `id` referenced in
`aria-activedescendant` on the `<input>`. The list has `role="listbox"`.

**Footer hint row:**
```
px-3 py-2 text-xs text-neutral-400 border-t border-neutral-100
flex items-center justify-between
```
"Entrée — tous les résultats" on left; `Esc pour fermer` on right.

### Loading State

Replace the results list with 3 shimmer rows (no section headers):
```
<Skeleton variant="row" />  ×3
```

### Empty State

```
flex flex-col items-center justify-center py-8 gap-2
text-sm text-neutral-400
```
`<Icon name="search" size={32} />` in `text-neutral-200`
"Aucun résultat pour « {query} »" in `text-neutral-500 text-sm`

### Error State

```
flex items-center gap-2 px-4 py-3 text-sm text-danger
```
`<Icon name="alert" size={16} />` + "Erreur de recherche. Réessayer."

### Dismiss Behavior

- Click outside panel or `Esc` → close, return focus to input
- `Tab` out of panel → close
- `Enter` on highlighted row → navigate
- Arrow keys cycle through `role="option"` rows
- Debounce: 200ms after last keystroke before fetching

---

## 6. Scope Filter

Positioned immediately to the **right** of the search input, still inside the
existing `max-w-[400px]` container or just outside it. Use a compact segmented
control for desktop; a `<select>` for mobile (< 640px).

### Desktop Segmented Control (≥640px)

```
┌─────┬──────────┬──────────┬──────────┐
│ All │ Members  │Payments  │ Products │
└─────┴──────────┴──────────┴──────────┘
```

Wrapper:
```
inline-flex items-center rounded-md border border-neutral-200 bg-neutral-50
overflow-hidden
```

Each segment button:
```
px-2.5 py-1.5 text-xs font-medium text-neutral-600
transition-colors duration-150 cursor-pointer
border-r border-neutral-200 last:border-r-0
hover:bg-neutral-100 hover:text-neutral-900
```

Active segment:
```
bg-white text-primary-600 font-semibold shadow-elevation-1
```
Active segment is styled to "lift" out of the row with a white background
and `shadow-elevation-1`, creating a tab-within-bar visual at no extra
component complexity.

Focus-visible on segment:
```
focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500
```

### Mobile Select (<640px)

Replace the segmented control with:
```
h-9 rounded-md border border-neutral-200 bg-neutral-50 px-2 text-xs
font-medium text-neutral-700 focus:border-primary-300 focus:ring-2
focus:ring-primary-200 focus:outline-none cursor-pointer
```
Options: "Tout", "Membres", "Paiements", "Produits".

### Placement in Header

```
<div class="relative flex items-center w-full max-w-[560px] gap-2">
  <div class="relative flex-1">  {/* search input + camera icon */}  </div>
  <div class="shrink-0">          {/* scope filter */}               </div>
</div>
```
The outer container grows to `max-w-[560px]` (from `400px`) to accommodate
the filter control next to the search input.

---

## 7. Facial-Search Icon States

The camera icon button currently lives at `right-1` inside the search input.
It requires three distinct visual states.

### State: Inactive (default)

```
h-7 w-7 rounded-full flex items-center justify-center
text-neutral-400 transition-colors duration-150
hover:text-neutral-600 hover:bg-neutral-100
cursor-pointer
```
Icon: `<Icon name="camera" size={16} />` (outline, stroke-only)

### State: Active (face-search toggled on)

```
h-7 w-7 rounded-full flex items-center justify-center
text-primary-600 bg-primary-50
cursor-pointer
animate-icon-glow          /* subtle pulse defined in §0 */
```
Icon: same `<Icon name="camera" size={16} />` but with `stroke-width={2.5}`
(bolder) to read as "filled/active" without a separate filled SVG.
Ring: replace the standard focus ring with a persistent
`ring-2 ring-primary-200` to signal the active state even when not focused.

Animation: `animate-icon-glow` (2s ease-in-out infinite).
Reduced-motion fallback: static `bg-primary-50 text-primary-600` (no pulse).

### State: Processing / Capture Modal Trigger

While the modal opens (< 300ms):
```
text-primary-600 bg-primary-100
```
The `<Icon name="spinner" size={16} />` replaces the camera icon for the
duration of the permission prompt + camera init.

---

## 8. Capture Modal

Triggered by clicking the active camera icon or as a standalone facial-search
flow.

### Modal Shell

Use the existing `<Modal>` component from `ui/Modal`. Additional classes on
the panel:
```
w-full max-w-md mx-auto
```
Standard modal has `rounded-lg border border-neutral-200 bg-white
shadow-elevation-3 p-6`.

### Live Camera Preview

```
┌─────────────────────────────────────────────────────┐
│  Camera Preview (16:9, rounded-md, overflow-hidden)  │
│  w-full aspect-video bg-neutral-900                  │
│                                                     │
│           [ live <video> stream ]                   │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  [ Cancel ]                       [ Capture Photo ] │
└─────────────────────────────────────────────────────┘
```

Camera preview `<video>` element:
```
w-full aspect-video rounded-md object-cover bg-neutral-900
```

**Capture button:**
```
h-10 px-5 rounded-full bg-primary-600 text-white text-sm font-semibold
hover:bg-primary-500 transition-colors duration-150 cursor-pointer
focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
```

**Cancel button:**
```
h-10 px-5 rounded-full border border-neutral-200 text-sm font-medium
text-neutral-700 hover:bg-neutral-50 transition-colors duration-150
cursor-pointer
```

### Permission Denied State

Replace the `<video>` block with:
```
flex flex-col items-center justify-center h-48 gap-3 bg-neutral-50
rounded-md border border-neutral-200 text-center
```
`<Icon name="camera" size={32} />` in `text-neutral-300`
"Accès caméra refusé. Vérifiez les permissions du navigateur."
in `text-sm text-neutral-500`

### After Capture — Result State

Video replaced by the captured frame `<img>`:
```
w-full aspect-video rounded-md object-cover bg-neutral-900
```

Below the image, a results list:
```
mt-3 divide-y divide-neutral-100 rounded-md border border-neutral-200
overflow-hidden
```
Each matched member row uses the same layout as the Search Dropdown hit row
(§5) — 32px avatar + name + confidence percentage badge.

Confidence badge:
- ≥ 85%: `bg-success-bg text-success-fg border-success/20`
- 50–84%: `bg-warning-bg text-warning-fg border-warning/30`
- < 50%: `bg-danger-bg text-danger-fg border-danger/20`

Empty result:
```
py-6 text-center text-sm text-neutral-400
```
"Aucun membre reconnu."

---

## 9. Highlight Animation — Member Profile

When navigating from a dashboard alert to the member profile page the URL
includes `?highlight=alerts` (or similar parameter). The highlighted section
on the profile receives a transient background flash to draw the eye.

### Spec

1. **Trigger:** On component mount, detect `?highlight=` param.
2. **Target element:** The section identified by the param value (e.g. the
   "Membership" card on the profile page).
3. **Animation:**

```css
/* In @layer components */
.section-highlight {
  animation: highlight-pulse 2000ms ease-in-out forwards;
}

@keyframes highlight-pulse {
  0%   { background-color: transparent; }
  15%  { background-color: var(--color-primary-50); }   /* #EEF4FF */
  75%  { background-color: var(--color-primary-50); }
  100% { background-color: transparent; }
}
```

4. **Scroll:** `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`
   called **before** the animation class is added (50ms `setTimeout` gap).
5. **Duration:** 2000ms total (15% = 300ms fade-in, 75–100% = 500ms fade-out).
6. **One-shot:** The class is removed after `animationend` to avoid repeat.
7. **Reduced motion:** Check `window.matchMedia('(prefers-reduced-motion: reduce)')`.
   If true, skip the animation entirely but still scroll into view.
8. **Background color:** `var(--color-primary-50)` (#EEF4FF). At 4px border-radius
   the glow is contained to the card boundary — no color bleeds onto adjacent cards.

### Class Application Pattern

```tsx
// Pseudocode, not TSX
const ref = useRef(null);

useEffect(() => {
  if (!shouldHighlight || !ref.current) return;
  const el = ref.current;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!reduceMotion) {
      el.classList.add('section-highlight');
      el.addEventListener('animationend', () => {
        el.classList.remove('section-highlight');
      }, { once: true });
    }
  }, 50);
}, [shouldHighlight]);
```

---

## 10. Accessibility Checklist (enforced per component)

| Requirement                             | Implementation                                 |
|-----------------------------------------|------------------------------------------------|
| Keyboard-accessible cards               | `<a>` or `<button>` wraps entire surface       |
| Focus ring on every interactive element | `focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2` |
| ARIA on search dropdown                 | `role="listbox"`, `role="option"`, `aria-activedescendant` |
| Scope filter accessibility              | `role="radiogroup"` on segmented control; `aria-checked` per segment |
| Camera button label                     | `aria-label="Recherche par visage"` with state: "activé" / "désactivé" |
| Capture modal                           | `role="dialog"` with `aria-labelledby`, focus trapped |
| Skeleton loaders                        | `aria-hidden="true"` + `role="status"` on wrapper with `sr-only` text |
| Color not sole indicator                | Severity always paired with text label and icon, never color alone |
| 44px minimum touch target               | All interactive elements min `h-11 w-11` or explicit padding to reach 44px |
| Reduced motion                          | `animate-highlight-pulse` and `animate-icon-glow` suppressed via media query |
| Alt text on member photos               | `alt="{fullName} — photo de profil"` |
| Arabic text direction                   | `dir="rtl"` on the Arabic subtitle element, not on the card |

---

## 11. Summary — Component List for frontend-dev

| Component file (suggested path)                            | Covered by spec section |
|------------------------------------------------------------|-------------------------|
| `features/dashboard/components/AlertCard.tsx`             | §1                      |
| `features/dashboard/components/StockAlertCard.tsx`        | §2                      |
| `features/dashboard/components/AlertSection.tsx`          | §4 section card         |
| `features/dashboard/components/AlertSummaryBar.tsx`       | §4 sticky bar           |
| `features/dashboard/DashboardPage.tsx`                    | §4 page shell & grid    |
| `app/components/SearchDropdown.tsx`                       | §5                      |
| `app/components/ScopeFilter.tsx`                          | §6                      |
| `app/Header.tsx` (modify existing)                        | §5, §6, §7              |
| `features/dashboard/hooks/useHighlight.ts`                | §9                      |
| `styles/globals.css` (add keyframes)                      | §0, §9                  |

All new utility classes (`section-highlight`, `animate-icon-glow`,
`animate-highlight-pulse`) must be added to `globals.css` under
`@layer components` and declared in `tailwind.config.js` under
`theme.extend.animation` / `theme.extend.keyframes` to ensure they survive
PurgeCSS.
