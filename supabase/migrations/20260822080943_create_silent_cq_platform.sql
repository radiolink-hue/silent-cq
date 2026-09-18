/*
# Silent CQ Platform (GAL LO-SHEKED) schema

1. New Tables
  - `cq_sessions` — one row per active "Silent CQ" operating session published by a ham radio operator.
    - `id` (uuid, primary key)
    - `callsign` (text) — operator callsign, e.g. 4X1DA
    - `gridsquare` (text) — Maidenhead locator, e.g. KM71mv
    - `band` (text) — e.g. 40m, 20m
    - `mode` (text) — e.g. USB, CW, FT8
    - `frequency` (text) — MHz as entered, e.g. 7.130
    - `power` (text) — e.g. 100W
    - `antenna` (text) — e.g. Dipole
    - `city` (text)
    - `country` (text)
    - `comments` (text)
    - `lat` (double precision) — latitude derived from gridsquare for the map
    - `lng` (double precision) — longitude derived from gridsquare for the map
    - `heard_count` (integer, default 0) — number of acknowledgments received
    - `active` (boolean, default true) — whether the session is still live
    - `created_at` (timestamptz, default now())

  - `cq_events` — broadcast notification events (a new CQ, or an acknowledgment). Clients subscribe to inserts to show toasts / play alerts.
    - `id` (uuid, primary key)
    - `session_id` (uuid, references cq_sessions)
    - `kind` (text) — 'new_cq' | 'received_ok' | 'calling_you'
    - `from_callsign` (text) — who triggered the event
    - `target_callsign` (text) — the station being acknowledged
    - `band` (text) — band context for optional filtering
    - `mode` (text) — mode context for optional filtering
    - `message` (text) — human-readable message
    - `created_at` (timestamptz, default now())

2. Security
  - Enable RLS on both tables.
  - This is a public, shared, no-login app: everyone sees the same live board.
    Policies allow anon + authenticated to read and write, since the data is
    intentionally public/shared. (USING (true) is appropriate here.)

3. Realtime
  - Both tables are added to the supabase_realtime publication so all connected
    clients receive inserts/updates/deletes instantly.

4. Notes
  1. No user accounts: the app is anonymous and globally shared by design.
  2. Indexes added on created_at and active for the live list, and on band/mode
     for filter queries.
*/

CREATE TABLE IF NOT EXISTS cq_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  callsign text NOT NULL,
  gridsquare text DEFAULT '',
  band text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT '',
  frequency text DEFAULT '',
  power text DEFAULT '',
  antenna text DEFAULT '',
  city text DEFAULT '',
  country text DEFAULT '',
  comments text DEFAULT '',
  lat double precision,
  lng double precision,
  heard_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cq_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES cq_sessions(id) ON DELETE CASCADE,
  kind text NOT NULL,
  from_callsign text DEFAULT '',
  target_callsign text DEFAULT '',
  band text DEFAULT '',
  mode text DEFAULT '',
  message text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cq_sessions_active_created ON cq_sessions (active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cq_sessions_band ON cq_sessions (band);
CREATE INDEX IF NOT EXISTS idx_cq_sessions_mode ON cq_sessions (mode);
CREATE INDEX IF NOT EXISTS idx_cq_events_created ON cq_events (created_at DESC);

ALTER TABLE cq_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cq_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_sessions" ON cq_sessions;
CREATE POLICY "public_select_sessions" ON cq_sessions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_sessions" ON cq_sessions;
CREATE POLICY "public_insert_sessions" ON cq_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_sessions" ON cq_sessions;
CREATE POLICY "public_update_sessions" ON cq_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_sessions" ON cq_sessions;
CREATE POLICY "public_delete_sessions" ON cq_sessions FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_select_events" ON cq_events;
CREATE POLICY "public_select_events" ON cq_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_events" ON cq_events;
CREATE POLICY "public_insert_events" ON cq_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_events" ON cq_events;
CREATE POLICY "public_delete_events" ON cq_events FOR DELETE
  TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cq_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cq_sessions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cq_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cq_events;
  END IF;
END $$;
