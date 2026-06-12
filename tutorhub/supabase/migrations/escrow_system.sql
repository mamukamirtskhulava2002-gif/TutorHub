-- ══════════════════════════════════════════════════════════
-- TutorHub — Escrow / Credit Wallet / Completion System
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. Credit balance on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 2. Credit transactions log
CREATE TABLE IF NOT EXISTS credit_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount     NUMERIC(10,2) NOT NULL,        -- positive = credit added, negative = debit
  reason     TEXT,                           -- 'booking_payment','student_cancelled','tutor_cancelled','auto_expired','dispute_resolved'
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_transactions_user_idx ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS credit_transactions_booking_idx ON credit_transactions(booking_id);

-- 3. Booking: completion token (SMS one-click confirmation)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS completion_token             TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS completion_token_expires_at  TIMESTAMPTZ;

-- 4. Booking: auto-expiry for pending bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 5. Booking: confirmation / completion timestamps
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS student_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_completed_at    TIMESTAMPTZ;

-- 6. Booking: Stripe payment tracking (needed for Stripe Connect transfers)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT,
  ADD COLUMN IF NOT EXISTS payment_status        TEXT NOT NULL DEFAULT 'pending';
  -- payment_status values: 'pending' | 'paid' | 'refunded'

-- 7. Booking: cancellation metadata
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
  -- e.g. 'auto_expired', 'tutor_timeout', 'student_request', 'tutor_request'

-- 8. Index for cron queries
CREATE INDEX IF NOT EXISTS bookings_status_completion_idx
  ON bookings(status, completion_token_expires_at)
  WHERE status = 'completed_by_tutor';

CREATE INDEX IF NOT EXISTS bookings_status_expires_idx
  ON bookings(status, expires_at)
  WHERE status = 'pending';

-- 9. RLS: credit_transactions — users can read their own, service role can write
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own credit transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Allow inserts from authenticated calls (API routes run with anon key + user session)
CREATE POLICY "Service inserts credit transactions"
  ON credit_transactions FOR INSERT
  WITH CHECK (true);
