-- ══════════════════════════════════════════════════════════
-- TutorHub — Notifications System
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'system',
  -- 'booking' | 'payment' | 'review' | 'lesson' | 'message' | 'dispute' | 'system'
  title      TEXT        NOT NULL,
  body       TEXT,
  link       TEXT,
  is_read    BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx     ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_unread_idx   ON notifications(user_id, is_read) WHERE is_read = false;

-- 2. RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can mark their own notifications as read
CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- API uses admin client (service role) for inserts — bypasses RLS

-- 3. Enable Realtime for notifications
-- Supabase Dashboard → Database → Replication → supabase_realtime publication
-- Add the notifications table to the publication so realtime events fire.
-- You can also run:
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
