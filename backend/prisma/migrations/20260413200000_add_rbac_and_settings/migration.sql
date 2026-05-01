-- CreateTable: roles
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: permissions
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: role_permissions
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: subscription_plans
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "discipline_id" UUID NOT NULL,
    "plan_type" "PlanType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable: document_requirements
CREATE TABLE "document_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_type" "DocumentType" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "member_types" TEXT[] NOT NULL,
    "validity_months" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notification_settings
CREATE TABLE "notification_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" "NotificationType" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "days_before" INTEGER,
    "template" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- Add role_id to users
ALTER TABLE "users" ADD COLUMN "role_id" UUID;

-- Unique constraints
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE UNIQUE INDEX "subscription_plans_discipline_id_plan_type_key" ON "subscription_plans"("discipline_id", "plan_type");
CREATE UNIQUE INDEX "document_requirements_document_type_key" ON "document_requirements"("document_type");
CREATE UNIQUE INDEX "notification_settings_type_key" ON "notification_settings"("type");

-- Indexes
CREATE INDEX "roles_name_idx" ON "roles"("name");
CREATE INDEX "roles_is_system_idx" ON "roles"("is_system");
CREATE INDEX "roles_is_active_idx" ON "roles"("is_active");
CREATE INDEX "permissions_resource_idx" ON "permissions"("resource");
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");
CREATE INDEX "subscription_plans_discipline_id_idx" ON "subscription_plans"("discipline_id");
CREATE INDEX "subscription_plans_is_active_idx" ON "subscription_plans"("is_active");
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- Foreign keys
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- SEED: System roles
-- =============================================
INSERT INTO "roles" ("id", "name", "description", "is_system", "is_active", "created_at", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin',         'Full system access',                           true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'manager',       'Club management access',                       true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'receptionist',  'Front desk and member operations',             true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'coach',         'Training sessions and attendance management',  true, true, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000005', 'accountant',    'Financial operations and reports',             true, true, NOW(), NOW());

-- =============================================
-- SEED: Permissions (resource + action)
-- =============================================
INSERT INTO "permissions" ("id", "resource", "action", "description") VALUES
  -- dashboard
  (gen_random_uuid(), 'dashboard', 'view', 'View dashboard'),
  -- members
  (gen_random_uuid(), 'members', 'view',   'View member details'),
  (gen_random_uuid(), 'members', 'create', 'Create new members'),
  (gen_random_uuid(), 'members', 'edit',   'Edit member information'),
  (gen_random_uuid(), 'members', 'delete', 'Delete members'),
  (gen_random_uuid(), 'members', 'manage', 'Full member management'),
  -- attendance
  (gen_random_uuid(), 'attendance', 'view',   'View attendance records'),
  (gen_random_uuid(), 'attendance', 'create', 'Check in members'),
  (gen_random_uuid(), 'attendance', 'edit',   'Edit attendance records'),
  (gen_random_uuid(), 'attendance', 'delete', 'Delete attendance records'),
  (gen_random_uuid(), 'attendance', 'manage', 'Full attendance management'),
  -- payments
  (gen_random_uuid(), 'payments', 'view',   'View payment records'),
  (gen_random_uuid(), 'payments', 'create', 'Create payments'),
  (gen_random_uuid(), 'payments', 'edit',   'Edit payments'),
  (gen_random_uuid(), 'payments', 'delete', 'Delete payments'),
  (gen_random_uuid(), 'payments', 'manage', 'Full payment management'),
  -- settings
  (gen_random_uuid(), 'settings', 'view',   'View settings'),
  (gen_random_uuid(), 'settings', 'manage', 'Manage all settings'),
  -- reports
  (gen_random_uuid(), 'reports', 'view',   'View reports'),
  (gen_random_uuid(), 'reports', 'manage', 'Manage reports and templates'),
  -- pos
  (gen_random_uuid(), 'pos', 'view',   'View POS products'),
  (gen_random_uuid(), 'pos', 'create', 'Process POS checkout'),
  (gen_random_uuid(), 'pos', 'manage', 'Full POS management'),
  -- inventory
  (gen_random_uuid(), 'inventory', 'view',   'View inventory'),
  (gen_random_uuid(), 'inventory', 'create', 'Add inventory items'),
  (gen_random_uuid(), 'inventory', 'edit',   'Edit inventory items'),
  (gen_random_uuid(), 'inventory', 'delete', 'Remove inventory items'),
  (gen_random_uuid(), 'inventory', 'manage', 'Full inventory management'),
  -- sessions
  (gen_random_uuid(), 'sessions', 'view',   'View training sessions'),
  (gen_random_uuid(), 'sessions', 'create', 'Create training sessions'),
  (gen_random_uuid(), 'sessions', 'edit',   'Edit training sessions'),
  (gen_random_uuid(), 'sessions', 'delete', 'Delete training sessions'),
  (gen_random_uuid(), 'sessions', 'manage', 'Full session management'),
  -- expenses
  (gen_random_uuid(), 'expenses', 'view',   'View expenses'),
  (gen_random_uuid(), 'expenses', 'create', 'Create expenses'),
  (gen_random_uuid(), 'expenses', 'edit',   'Edit expenses'),
  (gen_random_uuid(), 'expenses', 'delete', 'Delete expenses'),
  (gen_random_uuid(), 'expenses', 'manage', 'Full expense management'),
  -- kiosk
  (gen_random_uuid(), 'kiosk', 'view',   'View kiosk'),
  (gen_random_uuid(), 'kiosk', 'manage', 'Operate kiosk'),
  -- disciplines
  (gen_random_uuid(), 'disciplines', 'view',   'View disciplines'),
  (gen_random_uuid(), 'disciplines', 'create', 'Create disciplines'),
  (gen_random_uuid(), 'disciplines', 'edit',   'Edit disciplines'),
  (gen_random_uuid(), 'disciplines', 'delete', 'Delete disciplines'),
  (gen_random_uuid(), 'disciplines', 'manage', 'Full discipline management'),
  -- subscriptions
  (gen_random_uuid(), 'subscriptions', 'view',   'View subscriptions'),
  (gen_random_uuid(), 'subscriptions', 'create', 'Create subscriptions'),
  (gen_random_uuid(), 'subscriptions', 'edit',   'Edit subscriptions'),
  (gen_random_uuid(), 'subscriptions', 'delete', 'Delete subscriptions'),
  (gen_random_uuid(), 'subscriptions', 'manage', 'Full subscription management'),
  -- documents
  (gen_random_uuid(), 'documents', 'view',   'View documents'),
  (gen_random_uuid(), 'documents', 'create', 'Upload documents'),
  (gen_random_uuid(), 'documents', 'edit',   'Edit documents'),
  (gen_random_uuid(), 'documents', 'delete', 'Delete documents'),
  (gen_random_uuid(), 'documents', 'manage', 'Full document management'),
  -- notifications
  (gen_random_uuid(), 'notifications', 'view',   'View notifications'),
  (gen_random_uuid(), 'notifications', 'manage', 'Manage notifications');

-- =============================================
-- SEED: Admin role gets ALL permissions
-- =============================================
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000001', p."id", NOW()
FROM "permissions" p;

-- =============================================
-- SEED: Manager permissions
-- =============================================
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000002', p."id", NOW()
FROM "permissions" p
WHERE (p."resource" = 'dashboard' AND p."action" IN ('view'))
   OR (p."resource" = 'members' AND p."action" IN ('view', 'create', 'edit', 'delete', 'manage'))
   OR (p."resource" = 'attendance' AND p."action" IN ('view', 'create', 'edit', 'manage'))
   OR (p."resource" = 'payments' AND p."action" IN ('view', 'create', 'edit', 'manage'))
   OR (p."resource" = 'reports' AND p."action" IN ('view', 'manage'))
   OR (p."resource" = 'pos' AND p."action" IN ('view', 'create', 'manage'))
   OR (p."resource" = 'inventory' AND p."action" IN ('view', 'create', 'edit', 'delete', 'manage'))
   OR (p."resource" = 'sessions' AND p."action" IN ('view', 'create', 'edit', 'delete', 'manage'))
   OR (p."resource" = 'expenses' AND p."action" IN ('view', 'create', 'edit', 'delete', 'manage'))
   OR (p."resource" = 'kiosk' AND p."action" IN ('view', 'manage'))
   OR (p."resource" = 'disciplines' AND p."action" IN ('view', 'create', 'edit', 'manage'))
   OR (p."resource" = 'subscriptions' AND p."action" IN ('view', 'create', 'edit', 'manage'))
   OR (p."resource" = 'documents' AND p."action" IN ('view', 'create', 'edit', 'manage'))
   OR (p."resource" = 'notifications' AND p."action" IN ('view', 'manage'));

-- =============================================
-- SEED: Receptionist permissions
-- =============================================
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000003', p."id", NOW()
FROM "permissions" p
WHERE (p."resource" = 'dashboard' AND p."action" IN ('view'))
   OR (p."resource" = 'members' AND p."action" IN ('view', 'create', 'edit'))
   OR (p."resource" = 'attendance' AND p."action" IN ('view', 'create'))
   OR (p."resource" = 'payments' AND p."action" IN ('view', 'create'))
   OR (p."resource" = 'pos' AND p."action" IN ('view', 'create'))
   OR (p."resource" = 'inventory' AND p."action" IN ('view'))
   OR (p."resource" = 'kiosk' AND p."action" IN ('view', 'manage'))
   OR (p."resource" = 'disciplines' AND p."action" IN ('view'))
   OR (p."resource" = 'subscriptions' AND p."action" IN ('view', 'create', 'edit'))
   OR (p."resource" = 'documents' AND p."action" IN ('view', 'create', 'edit'))
   OR (p."resource" = 'notifications' AND p."action" IN ('view'));

-- =============================================
-- SEED: Coach permissions
-- =============================================
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000004', p."id", NOW()
FROM "permissions" p
WHERE (p."resource" = 'dashboard' AND p."action" IN ('view'))
   OR (p."resource" = 'attendance' AND p."action" IN ('view', 'create'))
   OR (p."resource" = 'sessions' AND p."action" IN ('view', 'create', 'edit', 'delete', 'manage'))
   OR (p."resource" = 'members' AND p."action" IN ('view'))
   OR (p."resource" = 'disciplines' AND p."action" IN ('view'));

-- =============================================
-- SEED: Accountant permissions
-- =============================================
INSERT INTO "role_permissions" ("id", "role_id", "permission_id", "created_at")
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000005', p."id", NOW()
FROM "permissions" p
WHERE (p."resource" = 'dashboard' AND p."action" IN ('view'))
   OR (p."resource" = 'payments' AND p."action" IN ('view', 'create', 'edit', 'manage'))
   OR (p."resource" = 'pos' AND p."action" IN ('view', 'create', 'manage'))
   OR (p."resource" = 'inventory' AND p."action" IN ('view'))
   OR (p."resource" = 'reports' AND p."action" IN ('view', 'manage'))
   OR (p."resource" = 'expenses' AND p."action" IN ('view', 'create', 'edit', 'delete', 'manage'))
   OR (p."resource" = 'notifications' AND p."action" IN ('view'));

-- =============================================
-- Assign roleId to existing users based on their enum role
-- =============================================
UPDATE "users" SET "role_id" = '00000000-0000-0000-0000-000000000001' WHERE "role" = 'admin';
UPDATE "users" SET "role_id" = '00000000-0000-0000-0000-000000000002' WHERE "role" = 'manager';
UPDATE "users" SET "role_id" = '00000000-0000-0000-0000-000000000003' WHERE "role" = 'receptionist';
UPDATE "users" SET "role_id" = '00000000-0000-0000-0000-000000000004' WHERE "role" = 'coach';
UPDATE "users" SET "role_id" = '00000000-0000-0000-0000-000000000005' WHERE "role" = 'accountant';
