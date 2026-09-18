/*
# CQ Signal Reports table

1. New Tables
  - `cq_signal_reports` — structured signal reports filed by stations against
    active CQ sessions. Replaces the old free-text cq_events acknowledgment model
    with a proper one-report-per-callsign system.
    - `id` (uuid, primary key)
    - `session_id` (uuid, references cq_sessions, cascade delete)
    - `reporter_callsign` (text) — the station filing the report
    - `signal_report` (text) — the signal value, e.g. "5-9", "Not Heard", "5-9+20"
    - `created_at` (timestamptz, default now())

2. Security
  - Enable RLS. Public/shared no-login app: anon + authenticated full CRUD.

3. Realtime
  - Added to supabase_realtime publication.

4. Notes
  1. Unique constraint on (session_id, reporter_callsign) enforces one report
     per station per CQ session.
  2. Index on session_id for efficient lookups.
*/

CREATE TABLE IF NOT EXISTS cq_signal_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES cq_sessions(id) ON DELETE CASCADE,
  reporter_callsign text NOT NULL,
  signal_report text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_cq_signal_report UNIQUE (session_id, reporter_callsign)
);

CREATE INDEX IF NOT EXISTS idx_cq_signal_reports_session ON cq_signal_reports (session_id);

ALTER TABLE cq_signal_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_cq_reports" ON cq_signal_reports;
CREATE POLICY "public_select_cq_reports" ON cq_signal_reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_cq_reports" ON cq_signal_reports;
CREATE POLICY "public_insert_cq_reports" ON cq_signal_reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_cq_reports" ON cq_signal_reports;
CREATE POLICY "public_update_cq_reports" ON cq_signal_reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_cq_reports" ON cq_signal_reports;
CREATE POLICY "public_delete_cq_reports" ON cq_signal_reports FOR DELETE
  TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cq_signal_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cq_signal_reports;
  END IF;
END $$;
