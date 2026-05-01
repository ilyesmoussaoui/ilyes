# Dashboard & Search Index Review

Reviewed by: db-architect
Date: 2026-04-15
Migration added: `20260415000000_add_dashboard_indexes/migration.sql`

---

## Alert Query Coverage

### 1. Subscriptions expiring soon
**Query pattern**
```sql
SELECT * FROM subscriptions
WHERE status = 'active'
  AND end_date BETWEEN now()::date AND (now() + interval '14 days')::date
  AND deleted_at IS NULL
```
**Existing indexes checked**: `subscriptions_status_idx` (single), `subscriptions_end_date_idx` (single).
**Gap**: Separate single-column indexes force the planner to either do an index
intersection (two bitmap scans + AND) or fall back to a seqscan on the status
index. At 10M+ subscriptions, the intersection overhead is significant.
**Resolution**: Added `subscriptions_status_end_date_idx (status, end_date)`.
Leading with the equality column (status) eliminates cancelled/expired/pending
rows before the range scan runs.

---

### 2. Unpaid balance
**Query pattern**
```sql
SELECT p.member_id, SUM(p.remaining) AS total_owed
FROM payments p
WHERE p.remaining > 0 AND p.deleted_at IS NULL
GROUP BY p.member_id
```
**Existing indexes checked**: None on `remaining`.
**Gap**: Full table scan on payments for every dashboard load.
**Resolution**: Added partial index `payments_remaining_partial_idx (remaining, member_id) WHERE remaining > 0`.
The partial index contains only outstanding-balance rows, keeping it small and
allowing the query to avoid touching paid-in-full rows entirely.

---

### 3. Renewal needed
**Query pattern**
```sql
SELECT * FROM subscriptions
WHERE status = 'active'
  AND end_date < now()::date
  AND deleted_at IS NULL
```
**Existing indexes checked**: Same as alert #1.
**Gap**: Same as alert #1 — single-column indexes inadequate.
**Resolution**: `subscriptions_status_end_date_idx` (added for alert #1) covers
this query as well. No additional index needed.

---

### 4. Missing documents
**Query pattern**
```sql
SELECT m.* FROM members m
WHERE NOT EXISTS (
  SELECT 1 FROM documents d
  WHERE d.member_id = m.id
    AND d.type = 'medical_certificate'   -- or any required type
    AND d.deleted_at IS NULL
)
AND m.deleted_at IS NULL
```
**Existing indexes checked**: `documents_member_id_idx` (single), `documents_type_idx` (single).
**Gap**: Each anti-join probe fetches all documents for a member then filters by
type in memory. For members with many documents, this is N extra heap reads.
**Resolution**: Added `documents_member_id_type_idx (member_id, type)`. The inner
side of the anti-join can now satisfy `member_id = $1 AND type = $2` in one
index seek with no heap access for non-matching rows.

---

### 5. Inactive members (no attendance in last 30 days)
**Query pattern**
```sql
SELECT m.* FROM members m
WHERE m.status = 'active' AND m.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records ar
    WHERE ar.member_id = m.id
      AND ar.check_in_time > now() - interval '30 days'
      AND ar.deleted_at IS NULL
  )
```
**Existing indexes checked**: `attendance_member_created_idx (member_id, created_at)`,
`attendance_records_check_in_time_idx (check_in_time)`.
**Gap**: `created_at` is the row insertion timestamp; `check_in_time` is the
actual check-in event (can differ if operators backdate entries). The composite
exists for `created_at`, not `check_in_time`. The range predicate on
`check_in_time` cannot use the existing composite.
**Resolution**: Added `attendance_member_check_in_idx (member_id, check_in_time)`.

---

### 6. Absent today
**Query pattern**
```sql
SELECT m.* FROM members m
WHERE m.status = 'active' AND m.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM attendance_records ar
    WHERE ar.member_id = m.id
      AND ar.check_in_time >= $today_start
      AND ar.check_in_time <  $today_end
      AND ar.deleted_at IS NULL
  )
```
**Existing indexes checked**: Same as alert #5.
**Gap**: Same — check_in_time composite missing.
**Resolution**: `attendance_member_check_in_idx` (added for alert #5) covers this
query. No additional index needed.

---

### 7. Stock out
**Query pattern**
```sql
SELECT * FROM equipment
WHERE stock_quantity <= 0
  AND deleted_at IS NULL
```
**Existing indexes checked**: `equipment_name_idx (name)`, `equipment_discipline_id_idx`.
No index on `stock_quantity`.
**Gap**: Full table scan on every dashboard load.
**Resolution**: Added partial index `equipment_stock_out_partial_idx (id, stock_quantity) WHERE stock_quantity <= 0`.
The partial condition means the index only holds rows that are actually out of
stock — typically a small fraction of the equipment catalogue. Scan is O(out-of-stock rows), not O(total rows).

---

## Search Query Coverage

### 8. Members — name search (ILIKE)
**Query pattern**
```sql
SELECT * FROM members
WHERE (
  first_name_latin  ILIKE '%query%' OR
  last_name_latin   ILIKE '%query%' OR
  first_name_arabic ILIKE '%query%' OR
  last_name_arabic  ILIKE '%query%'
) AND deleted_at IS NULL
```
**Existing indexes checked**: `member_name_latin_idx (first_name_latin, last_name_latin)`,
`member_name_arabic_idx (first_name_arabic, last_name_arabic)` — both B-tree.
**Gap**: B-tree indexes cannot satisfy `ILIKE '%text%'` (leading wildcard).
Postgres falls back to a sequential scan on the members table.
**Resolution**: Added four GIN trigram indexes using `gin_trgm_ops` (requires
`pg_trgm` extension, enabled in the same migration):
- `members_first_name_latin_trgm_idx`
- `members_last_name_latin_trgm_idx`
- `members_first_name_arabic_trgm_idx`
- `members_last_name_arabic_trgm_idx`

Note: Four separate GIN indexes are preferred over one multi-column GIN because
each OR branch targets a single column; a multi-column GIN cannot be used for
per-column ILIKE predicates connected by OR.

---

### 9. Payments — receipt number search
**Query pattern**
```sql
SELECT * FROM payments WHERE receipt_number = $1
```
**Existing indexes checked**: `payments_receipt_number_key` (UNIQUE constraint index),
`payments_receipt_number_idx` (secondary B-tree — redundant but harmless).
**Status**: FULLY COVERED. Equality lookup on a UNIQUE index is O(log n).
No action required.

---

### 10. Equipment — name search (ILIKE)
**Query pattern**
```sql
SELECT * FROM equipment WHERE name ILIKE '%query%' AND deleted_at IS NULL
```
**Existing indexes checked**: `equipment_name_idx (name)` — B-tree.
**Gap**: Same as member name search — B-tree cannot handle a leading wildcard.
**Resolution**: Added `equipment_name_trgm_idx` GIN trigram index on `name`.
The existing B-tree index is retained for prefix-only queries and ORDER BY.

---

## Summary of Indexes Added

| Index name | Table | Columns / Predicate | Covers alerts |
|---|---|---|---|
| `subscriptions_status_end_date_idx` | subscriptions | (status, end_date) | #1, #3 |
| `payments_remaining_partial_idx` | payments | (remaining, member_id) WHERE remaining > 0 | #2 |
| `documents_member_id_type_idx` | documents | (member_id, type) | #4 |
| `attendance_member_check_in_idx` | attendance_records | (member_id, check_in_time) | #5, #6 |
| `equipment_stock_out_partial_idx` | equipment | (id, stock_quantity) WHERE stock_quantity <= 0 | #7 |
| `members_first_name_latin_trgm_idx` | members | GIN(first_name_latin gin_trgm_ops) | search #8 |
| `members_last_name_latin_trgm_idx` | members | GIN(last_name_latin gin_trgm_ops) | search #8 |
| `members_first_name_arabic_trgm_idx` | members | GIN(first_name_arabic gin_trgm_ops) | search #8 |
| `members_last_name_arabic_trgm_idx` | members | GIN(last_name_arabic gin_trgm_ops) | search #8 |
| `equipment_name_trgm_idx` | equipment | GIN(name gin_trgm_ops) | search #10 |

---

## Concerns and Recommendations

### GIN index write overhead
GIN trigram indexes are write-heavier than B-tree. At the expected volume for a
gym management system (thousands to low tens of thousands of members, not
millions), this is not a concern. If the system is ever deployed at very high
member volume (100k+), consider `fastupdate = off` to avoid GIN pending list
buildup during bulk imports, or schedule periodic `VACUUM` on those tables.

### pg_trgm extension
The migration calls `CREATE EXTENSION IF NOT EXISTS pg_trgm`. This requires
superuser or the `CREATE` privilege on the database. It is a standard bundled
Postgres extension and is available in all major managed Postgres services
(RDS, Cloud SQL, Supabase, Neon). No additional packages need to be installed.

### Partial indexes and query planner
For the planner to use `payments_remaining_partial_idx` and
`equipment_stock_out_partial_idx`, the query WHERE clause must exactly match the
partial index predicate. Ensure the application queries use `remaining > 0` and
`stock_quantity <= 0` respectively — not `remaining != 0` or `stock_quantity < 1`,
which would prevent index usage.

### schema.prisma not modified
All new indexes are expressed as raw SQL in the migration file. The Prisma
schema does not declare them via `@@index`, meaning `prisma migrate diff` will
report them as "extra" indexes if run in the future. To prevent this, the
`@@index` declarations for the non-GIN, non-partial indexes
(`subscriptions_status_end_date_idx`, `documents_member_id_type_idx`,
`attendance_member_check_in_idx`) should eventually be added to `schema.prisma`.
GIN and partial indexes must always remain as raw SQL since Prisma's `@@index`
syntax does not support `USING GIN` or `WHERE` clauses.
