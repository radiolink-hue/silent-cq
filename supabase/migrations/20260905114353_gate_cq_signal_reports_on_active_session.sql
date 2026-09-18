/*
# Signal Report Authorization Gate

## Purpose
Restrict signal report submissions so that ONLY stations who have an active
(published) Silent CQ session can submit a signal report to another station.
Users who are simply logged in without having transmitted/published a Silent CQ
are blocked from sending signal reports.

## Changes
1. Replace the INSERT policy on `cq_signal_reports` with a new policy that
   requires the `reporter_callsign` to match an active session in `cq_sessions`.
2. Keep SELECT, UPDATE, DELETE policies unchanged (they remain open for the
   no-auth shared-data model).

## Security
- INSERT: the reporter must have an active CQ session (callsign match, active=true).
- The check uses a subquery on `cq_sessions` to verify the reporter has published.
- This is enforced at the database level, so it cannot be bypassed by the client.
*/

-- Drop the old open INSERT policy
DROP POLICY IF EXISTS "public_insert_cq_reports" ON cq_signal_reports;

-- New INSERT policy: reporter must have an active CQ session
CREATE POLICY "public_insert_cq_reports" ON cq_signal_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cq_sessions
      WHERE cq_sessions.callsign = cq_signal_reports.reporter_callsign
        AND cq_sessions.active = true
    )
  );