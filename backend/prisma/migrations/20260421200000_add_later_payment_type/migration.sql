-- Add 'later' value to PaymentType enum so pay-later transactions are a
-- first-class status distinct from a partial payment.
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'later' BEFORE 'refund';
