-- Migration: 20260420000000_add_tasks_and_at_risk
-- Adds:
--   1. at_risk column on members (NOT NULL DEFAULT false) + index
--   2. TaskType and TaskStatus enums
--   3. tasks table with composite indexes
--   4. tasks permission seed for admin/manager roles

-- ─── 1. at_risk on members ───────────────────────────────────────────────────

ALTER TABLE "members" ADD COLUMN "at_risk" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "members_at_risk_idx" ON "members"("at_risk");

-- ─── 2. Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE "TaskType" AS ENUM ('call_parent', 'general');
CREATE TYPE "TaskStatus" AS ENUM ('open', 'done', 'cancelled');

-- ─── 3. tasks table ──────────────────────────────────────────────────────────

CREATE TABLE "tasks" (
    "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
    "type"        "TaskType"  NOT NULL,
    "member_id"   UUID,
    "assigned_to" UUID,
    "status"      "TaskStatus" NOT NULL DEFAULT 'open',
    "due_date"    DATE,
    "notes"       TEXT,
    "created_by"  UUID,
    "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- Indexes per spec
CREATE INDEX "tasks_status_due_date_idx" ON "tasks"("status", "due_date");
CREATE INDEX "tasks_member_status_idx"   ON "tasks"("member_id", "status");
CREATE INDEX "tasks_assigned_to_idx"     ON "tasks"("assigned_to");

-- Foreign keys
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey"
    FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 4. Permission seed for tasks resource ───────────────────────────────────

-- Insert tasks permissions (idempotent via ON CONFLICT DO NOTHING)
INSERT INTO "permissions" ("id", "resource", "action", "description") VALUES
  (gen_random_uuid(), 'tasks', 'view',   'View staff tasks'),
  (gen_random_uuid(), 'tasks', 'create', 'Create staff tasks'),
  (gen_random_uuid(), 'tasks', 'edit',   'Edit staff tasks'),
  (gen_random_uuid(), 'tasks', 'manage', 'Full task management')
ON CONFLICT ("resource", "action") DO NOTHING;

-- Grant all tasks permissions to admin role
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', p."id", NOW()
FROM "permissions" p
WHERE p."resource" = 'tasks'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Grant tasks view + create to manager role
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000002', p."id", NOW()
FROM "permissions" p
WHERE p."resource" = 'tasks' AND p."action" IN ('view', 'create', 'edit', 'manage')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Grant tasks view to receptionist role
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000003', p."id", NOW()
FROM "permissions" p
WHERE p."resource" = 'tasks' AND p."action" IN ('view')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
