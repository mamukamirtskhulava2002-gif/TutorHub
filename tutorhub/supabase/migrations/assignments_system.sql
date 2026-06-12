-- ══════════════════════════════════════════════════════════
-- TutorHub — Assignments System
-- Run this in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════

-- 1. assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  description TEXT,
  deadline    TIMESTAMPTZ,
  file_url    TEXT,
  file_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_tutor_idx   ON assignments(tutor_id);
CREATE INDEX IF NOT EXISTS assignments_student_idx ON assignments(student_id);

-- 2. assignment_submissions table
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'submitted', -- 'submitted' | 'reviewed'
  file_url      TEXT,
  file_name     TEXT,
  comment       TEXT,
  feedback      TEXT,
  feedback_at   TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submissions_assignment_idx ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS submissions_student_idx    ON assignment_submissions(student_id);

-- 3. RLS: assignments
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Tutor sees their own assignments
CREATE POLICY "Tutors read own assignments"
  ON assignments FOR SELECT
  USING (auth.uid() = tutor_id);

-- Student sees assignments sent to them
CREATE POLICY "Students read own assignments"
  ON assignments FOR SELECT
  USING (auth.uid() = student_id);

-- Parents see assignments for their children
CREATE POLICY "Parents read children assignments"
  ON assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_children
      WHERE parent_id = auth.uid()
        AND child_id = assignments.student_id
    )
  );

-- API routes use admin client (service role key) — bypasses RLS entirely, no policy needed

-- 4. RLS: assignment_submissions
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Tutor sees submissions for their assignments
CREATE POLICY "Tutors read submissions"
  ON assignment_submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM assignments
      WHERE assignments.id = assignment_submissions.assignment_id
        AND assignments.tutor_id = auth.uid()
    )
  );

-- Student sees their own submissions
CREATE POLICY "Students read own submissions"
  ON assignment_submissions FOR SELECT
  USING (auth.uid() = student_id);

-- API routes use admin client (service role key) — bypasses RLS entirely, no policy needed

-- 5. Storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('assignment-files', 'assignment-files', true),
  ('assignment-submissions', 'assignment-submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: allow authenticated users to upload
CREATE POLICY "Authenticated upload assignment-files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'assignment-files');

CREATE POLICY "Public read assignment-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assignment-files');

CREATE POLICY "Authenticated upload assignment-submissions"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'assignment-submissions');

CREATE POLICY "Public read assignment-submissions"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'assignment-submissions');
