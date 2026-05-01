-- Allow progressive wizard saves: only `type` is required on member creation.
-- Core identity fields become nullable; status='pending' flags incomplete records.

ALTER TABLE "members" ALTER COLUMN "first_name_latin" DROP NOT NULL;
ALTER TABLE "members" ALTER COLUMN "last_name_latin" DROP NOT NULL;
ALTER TABLE "members" ALTER COLUMN "gender" DROP NOT NULL;
ALTER TABLE "members" ALTER COLUMN "date_of_birth" DROP NOT NULL;
