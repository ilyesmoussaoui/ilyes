-- Migration: add_fee_settings
-- Inserts three configurable fee keys into the settings key-value table.
-- Default values are in centimes (DZD * 100).
--   registrationFee   = 50000  (500 DZD)
--   licenseFee        = 120000 (1 200 DZD)
--   extraSessionPrice = 75000  (750 DZD)
-- Uses ON CONFLICT DO NOTHING so re-running is safe.

INSERT INTO settings (id, key, value, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'registrationFee',   '50000',  now(), now()),
  (gen_random_uuid(), 'licenseFee',        '120000', now(), now()),
  (gen_random_uuid(), 'extraSessionPrice', '75000',  now(), now())
ON CONFLICT (key) DO NOTHING;
