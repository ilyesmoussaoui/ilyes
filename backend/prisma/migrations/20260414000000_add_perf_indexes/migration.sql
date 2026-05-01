-- Performance indexes requested by Part 14 audit.
-- All use IF NOT EXISTS for idempotency in re-application scenarios.

-- attendance_records: composite lookup by member + recency (user activity feed, alerts)
CREATE INDEX IF NOT EXISTS "attendance_member_created_idx"
  ON "attendance_records" ("member_id", "created_at");

-- member_disciplines (enrollments): filter active/pending per member
CREATE INDEX IF NOT EXISTS "enrollments_member_status_idx"
  ON "member_disciplines" ("member_id", "status");

-- time_slots: per-coach schedule lookups in coach dashboard / conflict detection
CREATE INDEX IF NOT EXISTS "time_slots_coach_start_idx"
  ON "time_slots" ("coach_id", "start_time");

-- member_contacts: phone/email search by exact value+type (login, kiosk search, dedup)
CREATE INDEX IF NOT EXISTS "member_contacts_type_value_idx"
  ON "member_contacts" ("type", "value");
