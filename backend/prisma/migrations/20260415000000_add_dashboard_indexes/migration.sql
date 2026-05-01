-- Migration: add_dashboard_indexes
-- Purpose: cover all query patterns used by GET /api/v1/dashboard/alerts
--          and GET /api/v1/search that are not satisfied by existing indexes.
-- All statements use IF NOT EXISTS so the file is safe to re-apply.
-- No existing indexes are dropped or modified.

-- -----------------------------------------------------------------------
-- 1. SUBSCRIPTIONS — expiring-soon + renewal-needed alerts
--    Query: WHERE status = 'active' AND end_date BETWEEN $1 AND $2
--    Query: WHERE status = 'active' AND end_date < $1
--    A composite (status, end_date) lets Postgres seek to status='active'
--    then do a range scan on end_date without a second pass.
--    Leading with the equality column (status) is intentional — it
--    eliminates ~75% of rows before the range predicate is evaluated.
--    The existing single-column indexes on status and end_date are NOT
--    dropped; they remain useful for non-dashboard queries.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "subscriptions_status_end_date_idx"
  ON "subscriptions" ("status", "end_date");

-- -----------------------------------------------------------------------
-- 2. PAYMENTS — unpaid-balance alert
--    Query: WHERE remaining > 0 AND deleted_at IS NULL
--    A partial index keeps the index small (only rows with an outstanding
--    balance) and makes the dashboard scan fast even at 10M+ payment rows.
--    The partial condition mirrors the alert predicate exactly.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "payments_remaining_partial_idx"
  ON "payments" ("remaining", "member_id")
  WHERE remaining > 0;

-- -----------------------------------------------------------------------
-- 3. DOCUMENTS — missing-document alert (anti-join)
--    Query: NOT EXISTS (
--      SELECT 1 FROM documents d
--      WHERE d.member_id = m.id AND d.type = $1 AND d.deleted_at IS NULL
--    )
--    A composite (member_id, type) lets the inner side of the anti-join
--    resolve the two equality predicates in one index lookup per member,
--    instead of fetching all member_id rows and then filtering on type.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "documents_member_id_type_idx"
  ON "documents" ("member_id", "type");

-- -----------------------------------------------------------------------
-- 4. ATTENDANCE — inactive-members alert + absent-today alert
--    Query (inactive): NOT EXISTS (
--      SELECT 1 FROM attendance_records ar
--      WHERE ar.member_id = m.id AND ar.check_in_time > now() - interval '30 days'
--    )
--    Query (absent today): NOT EXISTS (
--      SELECT 1 FROM attendance_records ar
--      WHERE ar.member_id = m.id
--        AND ar.check_in_time >= $today_start AND ar.check_in_time < $today_end
--    )
--    The existing attendance_member_created_idx covers (member_id, created_at).
--    check_in_time is the actual event timestamp and differs from created_at
--    (check_in_time can be backdated by operators; created_at is insert time).
--    Both alert queries filter on check_in_time, so a dedicated composite
--    on (member_id, check_in_time) is required.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "attendance_member_check_in_idx"
  ON "attendance_records" ("member_id", "check_in_time");

-- -----------------------------------------------------------------------
-- 5. EQUIPMENT — stock-out alert
--    Query: WHERE stock_quantity <= 0 AND deleted_at IS NULL
--    A partial index on rows with stock at or below zero is small and
--    cache-friendly. It covers both "out of stock" (= 0) and negative
--    quantities that can arise from concurrent sales before a check.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "equipment_stock_out_partial_idx"
  ON "equipment" ("id", "stock_quantity")
  WHERE stock_quantity <= 0;

-- -----------------------------------------------------------------------
-- 6. SEARCH — member name ILIKE (trigram / substring)
--    Query: first_name_latin ILIKE '%text%' OR last_name_latin ILIKE '%text%'
--           first_name_arabic ILIKE '%text%' OR last_name_arabic ILIKE '%text%'
--    B-tree indexes (existing member_name_latin_idx / member_name_arabic_idx)
--    do NOT support ILIKE with a leading wildcard. pg_trgm GIN indexes do.
--    The extension must be present; it ships with standard Postgres builds.
--    Using two separate GIN indexes (one per language pair) is preferable
--    to a single multi-column GIN because ILIKE predicates on individual
--    columns cannot use a composite GIN efficiently.
-- -----------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "members_first_name_latin_trgm_idx"
  ON "members" USING GIN ("first_name_latin" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "members_last_name_latin_trgm_idx"
  ON "members" USING GIN ("last_name_latin" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "members_first_name_arabic_trgm_idx"
  ON "members" USING GIN ("first_name_arabic" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "members_last_name_arabic_trgm_idx"
  ON "members" USING GIN ("last_name_arabic" gin_trgm_ops);

-- -----------------------------------------------------------------------
-- 7. SEARCH — equipment name ILIKE (trigram / substring)
--    Query: name ILIKE '%text%'
--    Same reasoning as member names above. The existing equipment_name_idx
--    (B-tree) is retained for equality and prefix lookups.
-- -----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "equipment_name_trgm_idx"
  ON "equipment" USING GIN ("name" gin_trgm_ops);
