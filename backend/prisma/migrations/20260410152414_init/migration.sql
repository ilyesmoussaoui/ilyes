-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'receptionist', 'instructor', 'accountant');

-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('athlete', 'staff', 'external');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('active', 'inactive', 'suspended', 'expired', 'pending');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('phone', 'email', 'address');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'inactive', 'graduated', 'suspended');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('id_card', 'medical_certificate', 'photo', 'birth_certificate', 'insurance', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('valid', 'expired', 'pending', 'rejected');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('monthly', 'quarterly', 'biannual', 'annual', 'session_pack');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'expired', 'cancelled', 'pending');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('full', 'partial', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "PaymentItemType" AS ENUM ('subscription', 'equipment', 'fee', 'registration', 'other');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('face', 'manual', 'barcode');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('subscription_expiring', 'payment_due', 'document_expiring', 'birthday', 'general');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "full_name_latin" TEXT NOT NULL,
    "full_name_arabic" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "type" "MemberType" NOT NULL,
    "first_name_latin" TEXT NOT NULL,
    "last_name_latin" TEXT NOT NULL,
    "first_name_arabic" TEXT,
    "last_name_arabic" TEXT,
    "gender" "Gender" NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "place_of_birth" TEXT,
    "photo_path" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_contacts" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "type" "ContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "member_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disciplines" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_disciplines" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "instructor_id" UUID,
    "belt_rank" TEXT,
    "enrollment_date" DATE NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "member_disciplines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_slots" (
    "id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "max_capacity" INTEGER NOT NULL DEFAULT 20,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL,
    "member_discipline_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "time_slot_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "file_path" TEXT NOT NULL,
    "issue_date" DATE,
    "expiry_date" DATE,
    "status" "DocumentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "discipline_id" UUID NOT NULL,
    "plan_type" "PlanType" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "paid_amount" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_items" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "PaymentItemType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "payment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "discipline_id" UUID,
    "price" INTEGER NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member_equipment" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "purchase_date" DATE NOT NULL,
    "payment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "member_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "discipline_id" UUID,
    "check_in_time" TIMESTAMPTZ(6) NOT NULL,
    "check_out_time" TIMESTAMPTZ(6),
    "method" "AttendanceMethod" NOT NULL,
    "device" TEXT,
    "operator_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "face_embeddings" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "embedding_vector" BYTEA NOT NULL,
    "model_version" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "face_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_links" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "related_member_id" UUID NOT NULL,
    "relationship" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "family_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" UUID NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "user_id" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "receipt_path" TEXT,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "member_id" UUID,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "member_name_latin_idx" ON "members"("first_name_latin", "last_name_latin");

-- CreateIndex
CREATE INDEX "member_name_arabic_idx" ON "members"("first_name_arabic", "last_name_arabic");

-- CreateIndex
CREATE INDEX "members_status_idx" ON "members"("status");

-- CreateIndex
CREATE INDEX "members_type_idx" ON "members"("type");

-- CreateIndex
CREATE INDEX "members_created_at_idx" ON "members"("created_at");

-- CreateIndex
CREATE INDEX "members_deleted_at_idx" ON "members"("deleted_at");

-- CreateIndex
CREATE INDEX "member_contacts_member_id_idx" ON "member_contacts"("member_id");

-- CreateIndex
CREATE INDEX "member_contacts_type_idx" ON "member_contacts"("type");

-- CreateIndex
CREATE INDEX "member_contacts_value_idx" ON "member_contacts"("value");

-- CreateIndex
CREATE INDEX "emergency_contacts_member_id_idx" ON "emergency_contacts"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "disciplines_name_key" ON "disciplines"("name");

-- CreateIndex
CREATE INDEX "disciplines_name_idx" ON "disciplines"("name");

-- CreateIndex
CREATE INDEX "disciplines_is_active_idx" ON "disciplines"("is_active");

-- CreateIndex
CREATE INDEX "member_disciplines_member_id_idx" ON "member_disciplines"("member_id");

-- CreateIndex
CREATE INDEX "member_disciplines_discipline_id_idx" ON "member_disciplines"("discipline_id");

-- CreateIndex
CREATE INDEX "member_disciplines_instructor_id_idx" ON "member_disciplines"("instructor_id");

-- CreateIndex
CREATE INDEX "member_disciplines_status_idx" ON "member_disciplines"("status");

-- CreateIndex
CREATE INDEX "time_slots_discipline_id_idx" ON "time_slots"("discipline_id");

-- CreateIndex
CREATE INDEX "time_slots_day_of_week_idx" ON "time_slots"("day_of_week");

-- CreateIndex
CREATE INDEX "schedules_member_discipline_id_idx" ON "schedules"("member_discipline_id");

-- CreateIndex
CREATE INDEX "schedules_time_slot_id_idx" ON "schedules"("time_slot_id");

-- CreateIndex
CREATE INDEX "schedules_day_of_week_idx" ON "schedules"("day_of_week");

-- CreateIndex
CREATE INDEX "documents_member_id_idx" ON "documents"("member_id");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_expiry_date_idx" ON "documents"("expiry_date");

-- CreateIndex
CREATE INDEX "subscriptions_member_id_idx" ON "subscriptions"("member_id");

-- CreateIndex
CREATE INDEX "subscriptions_discipline_id_idx" ON "subscriptions"("discipline_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_end_date_idx" ON "subscriptions"("end_date");

-- CreateIndex
CREATE INDEX "subscriptions_created_at_idx" ON "subscriptions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receipt_number_key" ON "payments"("receipt_number");

-- CreateIndex
CREATE INDEX "payments_member_id_idx" ON "payments"("member_id");

-- CreateIndex
CREATE INDEX "payments_receipt_number_idx" ON "payments"("receipt_number");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE INDEX "payments_payment_type_idx" ON "payments"("payment_type");

-- CreateIndex
CREATE INDEX "payment_items_payment_id_idx" ON "payment_items"("payment_id");

-- CreateIndex
CREATE INDEX "payment_items_type_idx" ON "payment_items"("type");

-- CreateIndex
CREATE INDEX "equipment_name_idx" ON "equipment"("name");

-- CreateIndex
CREATE INDEX "equipment_discipline_id_idx" ON "equipment"("discipline_id");

-- CreateIndex
CREATE INDEX "member_equipment_member_id_idx" ON "member_equipment"("member_id");

-- CreateIndex
CREATE INDEX "member_equipment_equipment_id_idx" ON "member_equipment"("equipment_id");

-- CreateIndex
CREATE INDEX "member_equipment_payment_id_idx" ON "member_equipment"("payment_id");

-- CreateIndex
CREATE INDEX "attendance_records_member_id_idx" ON "attendance_records"("member_id");

-- CreateIndex
CREATE INDEX "attendance_records_discipline_id_idx" ON "attendance_records"("discipline_id");

-- CreateIndex
CREATE INDEX "attendance_records_check_in_time_idx" ON "attendance_records"("check_in_time");

-- CreateIndex
CREATE INDEX "attendance_records_method_idx" ON "attendance_records"("method");

-- CreateIndex
CREATE INDEX "face_embeddings_member_id_idx" ON "face_embeddings"("member_id");

-- CreateIndex
CREATE INDEX "family_links_member_id_idx" ON "family_links"("member_id");

-- CreateIndex
CREATE INDEX "family_links_related_member_id_idx" ON "family_links"("related_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_links_member_id_related_member_id_key" ON "family_links"("member_id", "related_member_id");

-- CreateIndex
CREATE INDEX "audit_logs_table_name_record_id_idx" ON "audit_logs"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_created_at_idx" ON "expenses"("created_at");

-- CreateIndex
CREATE INDEX "notifications_member_id_idx" ON "notifications"("member_id");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE INDEX "settings_key_idx" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_contacts" ADD CONSTRAINT "member_contacts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_disciplines" ADD CONSTRAINT "member_disciplines_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_disciplines" ADD CONSTRAINT "member_disciplines_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_disciplines" ADD CONSTRAINT "member_disciplines_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_member_discipline_id_fkey" FOREIGN KEY ("member_discipline_id") REFERENCES "member_disciplines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_time_slot_id_fkey" FOREIGN KEY ("time_slot_id") REFERENCES "time_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_items" ADD CONSTRAINT "payment_items_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_equipment" ADD CONSTRAINT "member_equipment_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_equipment" ADD CONSTRAINT "member_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_equipment" ADD CONSTRAINT "member_equipment_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_discipline_id_fkey" FOREIGN KEY ("discipline_id") REFERENCES "disciplines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "face_embeddings" ADD CONSTRAINT "face_embeddings_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_links" ADD CONSTRAINT "family_links_related_member_id_fkey" FOREIGN KEY ("related_member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
