-- CreateTable
CREATE TABLE "member_notes" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "member_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_notes_member_id_idx" ON "member_notes"("member_id");

-- CreateIndex
CREATE INDEX "member_notes_created_at_idx" ON "member_notes"("created_at");

-- AddForeignKey
ALTER TABLE "member_notes" ADD CONSTRAINT "member_notes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member_notes" ADD CONSTRAINT "member_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
