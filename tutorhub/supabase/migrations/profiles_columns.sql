-- ══════════════════════════════════════════════════════════
-- TutorHub — Add missing profile columns
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════

-- Student preference columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS student_level      TEXT,
  ADD COLUMN IF NOT EXISTS student_grade      INTEGER,
  ADD COLUMN IF NOT EXISTS preferred_subjects TEXT[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_format   TEXT,
  ADD COLUMN IF NOT EXISTS preferred_days     TEXT[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_times    TEXT[]    DEFAULT '{}';

-- Parent / contact columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS parent_name  TEXT,
  ADD COLUMN IF NOT EXISTS parent_phone TEXT;

-- Location columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS region_id       TEXT,
  ADD COLUMN IF NOT EXISTS municipality_id TEXT,
  ADD COLUMN IF NOT EXISTS village         TEXT,
  ADD COLUMN IF NOT EXISTS city            TEXT;

-- Avatar
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Credit balance (also in escrow migration — safe to re-run with IF NOT EXISTS)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS credit_balance NUMERIC(10,2) NOT NULL DEFAULT 0;
