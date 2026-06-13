-- ================================================================
-- Dispute & Lesson Recordings migration
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Add dispute_type and dispute_reason columns to bookings if missing
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS dispute_reason   TEXT,
  ADD COLUMN IF NOT EXISTS disputed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS student_absent_at TIMESTAMPTZ;

-- 2. Allow student_absent as a booking status
-- (Supabase uses TEXT for status, so no enum change needed)

-- 3. Make sure disputes table has all needed columns
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS tutor_id   UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- 4. lesson_recordings table (stores Jitsi session info for 24h)
CREATE TABLE IF NOT EXISTS lesson_recordings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  recording_url TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  CONSTRAINT lesson_recordings_booking_id_key UNIQUE (booking_id)
);

-- Index for cleanup cron (delete by expires_at)
CREATE INDEX IF NOT EXISTS idx_lesson_recordings_expires_at
  ON lesson_recordings (expires_at);

-- RLS
ALTER TABLE lesson_recordings ENABLE ROW LEVEL SECURITY;

-- Admins can read all recordings
CREATE POLICY IF NOT EXISTS "admin_read_recordings"
  ON lesson_recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Tutor or student of the booking can insert/upsert
CREATE POLICY IF NOT EXISTS "participants_upsert_recordings"
  ON lesson_recordings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id
        AND (b.tutor_id = auth.uid() OR b.student_id = auth.uid())
    )
  );

-- Service role (cron) can delete
CREATE POLICY IF NOT EXISTS "service_delete_recordings"
  ON lesson_recordings FOR DELETE
  USING (true);
