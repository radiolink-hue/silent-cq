/*
  Recurring wall-clock for each public net.
  Admin edits in Net Manager upsert one row here, then rewrite nets
  whose Jerusalem date is today or later. Past sessions stay as recorded.
*/

CREATE TABLE IF NOT EXISTS net_schedule_templates (
  schedule_id text PRIMARY KEY,
  start_hour smallint NOT NULL CHECK (start_hour BETWEEN 0 AND 23),
  start_minute smallint NOT NULL CHECK (start_minute BETWEEN 0 AND 59),
  end_hour smallint NOT NULL CHECK (end_hour BETWEEN 0 AND 23),
  end_minute smallint NOT NULL CHECK (end_minute BETWEEN 0 AND 59),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT net_schedule_templates_end_after_start CHECK (
    (end_hour * 60 + end_minute) > (start_hour * 60 + start_minute)
  )
);

ALTER TABLE net_schedule_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_net_schedule_templates" ON net_schedule_templates;
CREATE POLICY "public_select_net_schedule_templates" ON net_schedule_templates
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_net_schedule_templates" ON net_schedule_templates;
CREATE POLICY "public_insert_net_schedule_templates" ON net_schedule_templates
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_net_schedule_templates" ON net_schedule_templates;
CREATE POLICY "public_update_net_schedule_templates" ON net_schedule_templates
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'net_schedule_templates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE net_schedule_templates;
  END IF;
END $$;
