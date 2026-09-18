/*
# Create callsign_geocache table for callsign-to-grid resolution caching

1. New Tables
  - `callsign_geocache` — server-side cache of resolved callsign geolocation
    data (grid square, lat, lng, city, country) from QRZ.com / Nominatim.
    Reduces external API lookups for Allmon2-ingested stations.
    - `id` (uuid, primary key)
    - `callsign` (text, unique, not null) — uppercase callsign
    - `gridsquare` (text) — Maidenhead grid, e.g. KM71mv
    - `lat` (double precision) — latitude
    - `lng` (double precision) — longitude
    - `city` (text) — resolved city/locality
    - `country` (text) — resolved country
    - `source` (text) — which API resolved it: 'qrz', 'nominatim', 'mock'
    - `created_at` (timestamptz, default now())
    - `updated_at` (timestamptz, default now()) — refreshed on each lookup

2. Indexes
  - `idx_callsign_geocache_callsign` on (callsign) for fast lookups
  - `idx_callsign_geocache_updated` on (updated_at) for cache expiry queries

3. Security
  - Enable RLS on `callsign_geocache`.
  - This is a server-side table accessed only by the edge function via the
    service role key. Public (anon) access is denied — no SELECT/INSERT/
    UPDATE/DELETE policies for anon or authenticated roles. The service
    role bypasses RLS, so the edge function can read/write freely.
*/
CREATE TABLE IF NOT EXISTS callsign_geocache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  callsign text UNIQUE NOT NULL,
  gridsquare text DEFAULT '',
  lat double precision,
  lng double precision,
  city text DEFAULT '',
  country text DEFAULT '',
  source text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_callsign_geocache_callsign ON callsign_geocache (callsign);
CREATE INDEX IF NOT EXISTS idx_callsign_geocache_updated ON callsign_geocache (updated_at);

ALTER TABLE callsign_geocache ENABLE ROW LEVEL SECURITY;
