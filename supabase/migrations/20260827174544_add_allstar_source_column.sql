/*
# Add allstar_source column for Allmon2 auto-ingestion

1. Modified Tables
  - `cq_sessions`
    - New column `allstar_source` (text, default '') — identifies stations
      auto-ingested from Allmon2 node 48552. When non-empty, the row was
      created by the Allstar Monitor edge function rather than a manual CQ.
      Used for dedup so each Allstar node appears only once per active session.

2. Index
  - `idx_cq_sessions_allstar_source` on (allstar_source, active) for fast
    dedup lookups by the edge function.

3. Security
  - No RLS policy changes. The existing public CRUD policies already cover
    the new column since it has a safe default and is writable by anon.
*/

ALTER TABLE cq_sessions
  ADD COLUMN IF NOT EXISTS allstar_source text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_cq_sessions_allstar_source
  ON cq_sessions (allstar_source) WHERE active = true;
