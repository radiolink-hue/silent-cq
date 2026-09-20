/*
# Operator profiles (callsign-keyed settings)

1. New Tables
  - `operator_profiles` — persistent per-operator settings keyed by callsign
    (the app has no auth accounts; callsign is identity, same as cq_sessions).
    - `callsign` (text, primary key) — uppercase callsign
    - `power` (integer, default 100) — transmit power in watts (1–1500)
    - `created_at` / `updated_at` (timestamptz)

2. Security
  - Enable RLS.
  - Public read/write for anon + authenticated, matching the rest of the
    shared board (no user accounts).
*/

CREATE TABLE IF NOT EXISTS operator_profiles (
  callsign text PRIMARY KEY,
  power integer NOT NULL DEFAULT 100
    CHECK (power >= 1 AND power <= 1500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE operator_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_operator_profiles" ON operator_profiles;
CREATE POLICY "public_select_operator_profiles" ON operator_profiles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_operator_profiles" ON operator_profiles;
CREATE POLICY "public_insert_operator_profiles" ON operator_profiles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_operator_profiles" ON operator_profiles;
CREATE POLICY "public_update_operator_profiles" ON operator_profiles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
