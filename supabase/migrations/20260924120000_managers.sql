/*
  Trusted operators who may use Admin Posted. App identity is callsign (no JWT).
  Insert/delete are public like other Silent CQ tables; the UI only lets 4X1DA manage rows.

  SQL editor (same table):

    CREATE TABLE IF NOT EXISTS managers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      callsign TEXT NOT NULL UNIQUE,
      added_by TEXT NOT NULL DEFAULT '4X1DA',
      added_at TIMESTAMPTZ DEFAULT NOW()
    );
*/

CREATE TABLE IF NOT EXISTS managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  callsign text NOT NULL UNIQUE,
  added_by text NOT NULL DEFAULT '4X1DA',
  added_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_managers_callsign_upper
  ON managers (upper(callsign));

ALTER TABLE managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read" ON managers;
CREATE POLICY "Anyone can read" ON managers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_managers" ON managers;
CREATE POLICY "public_insert_managers" ON managers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_delete_managers" ON managers;
CREATE POLICY "public_delete_managers" ON managers FOR DELETE
  TO anon, authenticated USING (true);
