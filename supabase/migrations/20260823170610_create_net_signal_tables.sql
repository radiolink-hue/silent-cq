/*
# Ham Radio Net & Signal Matrix tables

1. New Tables
  - `nets` — one row per scheduled or active ham radio net session.
    - `id` (uuid, primary key)
    - `name` (text) — optional human-friendly name for the net
    - `net_date` (date) — the date the net was held
    - `frequency` (text) — e.g. 7.130
    - `mode` (text) — e.g. USB, FM, FT8
    - `created_at` (timestamptz, default now())

  - `net_participants` — stations that checked into a given net.
    - `id` (uuid, primary key)
    - `net_id` (uuid, references nets, cascade delete)
    - `callsign` (text) — operator callsign
    - `grid` (text) — Maidenhead locator
    - `city` (text)
    - `antenna` (text)
    - `power` (text)
    - `created_at` (timestamptz, default now())

  - `signal_reports` — RST reports exchanged between participants during a net.
    - `id` (uuid, primary key)
    - `net_id` (uuid, references nets, cascade delete)
    - `tx_callsign` (text) — the transmitting station
    - `rx_callsign` (text) — the receiving station
    - `rst_report` (text) — e.g. 59, 57, 599
    - `created_at` (timestamptz, default now())

2. Security
  - Enable RLS on all three tables.
  - This is a public, shared, no-login app (same as cq_sessions): everyone sees
    and contributes to the same nets. Policies allow anon + authenticated full
    CRUD. USING (true) is appropriate because the data is intentionally public.

3. Realtime
  - All three tables added to supabase_realtime so connected clients see live
    updates when participants check in or signal reports are filed.

4. Notes
  1. No user accounts — the app is anonymous and globally shared by design.
  2. Indexes on net_id foreign keys for efficient joins.
  3. A unique constraint on (net_id, tx_callsign, rx_callsign) prevents duplicate
     signal reports for the same pair in the same net.
*/

CREATE TABLE IF NOT EXISTS nets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text DEFAULT '',
  net_date date NOT NULL DEFAULT CURRENT_DATE,
  frequency text NOT NULL DEFAULT '',
  mode text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS net_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  net_id uuid NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
  callsign text NOT NULL,
  grid text DEFAULT '',
  city text DEFAULT '',
  antenna text DEFAULT '',
  power text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS signal_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  net_id uuid NOT NULL REFERENCES nets(id) ON DELETE CASCADE,
  tx_callsign text NOT NULL,
  rx_callsign text NOT NULL,
  rst_report text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_signal_report UNIQUE (net_id, tx_callsign, rx_callsign)
);

CREATE INDEX IF NOT EXISTS idx_net_participants_net ON net_participants (net_id);
CREATE INDEX IF NOT EXISTS idx_signal_reports_net ON signal_reports (net_id);
CREATE INDEX IF NOT EXISTS idx_nets_date ON nets (net_date DESC);

ALTER TABLE nets ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_reports ENABLE ROW LEVEL SECURITY;

-- nets policies
DROP POLICY IF EXISTS "public_select_nets" ON nets;
CREATE POLICY "public_select_nets" ON nets FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_nets" ON nets;
CREATE POLICY "public_insert_nets" ON nets FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_nets" ON nets;
CREATE POLICY "public_update_nets" ON nets FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_nets" ON nets;
CREATE POLICY "public_delete_nets" ON nets FOR DELETE
  TO anon, authenticated USING (true);

-- net_participants policies
DROP POLICY IF EXISTS "public_select_participants" ON net_participants;
CREATE POLICY "public_select_participants" ON net_participants FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_participants" ON net_participants;
CREATE POLICY "public_insert_participants" ON net_participants FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_participants" ON net_participants;
CREATE POLICY "public_update_participants" ON net_participants FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_participants" ON net_participants;
CREATE POLICY "public_delete_participants" ON net_participants FOR DELETE
  TO anon, authenticated USING (true);

-- signal_reports policies
DROP POLICY IF EXISTS "public_select_reports" ON signal_reports;
CREATE POLICY "public_select_reports" ON signal_reports FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_reports" ON signal_reports;
CREATE POLICY "public_insert_reports" ON signal_reports FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_reports" ON signal_reports;
CREATE POLICY "public_update_reports" ON signal_reports FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_reports" ON signal_reports;
CREATE POLICY "public_delete_reports" ON signal_reports FOR DELETE
  TO anon, authenticated USING (true);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'nets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE nets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'net_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE net_participants;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'signal_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE signal_reports;
  END IF;
END $$;
