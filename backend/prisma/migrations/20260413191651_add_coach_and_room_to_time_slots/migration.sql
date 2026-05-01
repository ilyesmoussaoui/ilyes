-- AlterTable
ALTER TABLE "time_slots" ADD COLUMN     "coach_id" UUID,
ADD COLUMN     "room" TEXT;

-- AddForeignKey
ALTER TABLE "time_slots" ADD CONSTRAINT "time_slots_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
