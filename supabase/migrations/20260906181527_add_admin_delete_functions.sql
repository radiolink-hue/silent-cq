/*
# Admin-only delete functions for 4X1DA

1. Changes
  - Add `admin_delete_session(p_session_id uuid, p_admin_callsign text)` — SECURITY DEFINER
    function that allows the admin callsign (4X1DA) to delete ANY session row, bypassing
    the owner-only `delete_own_session` restriction.
  - Add `admin_delete_report(p_report_id uuid, p_admin_callsign text)` — SECURITY DEFINER
    function that allows the admin callsign (4X1DA) to delete ANY signal report row.
  - Both functions verify `upper(p_admin_callsign) = '4X1DA'` before deleting.
  - Grant EXECUTE to anon + authenticated (no sign-in; callsign IS identity).

2. Security
  - SECURITY DEFINER with `SET search_path = public` prevents search_path injection.
  - Only the hardcoded admin callsign '4X1DA' (case-insensitive) can delete.
  - Returns JSONB `{ ok: true }` on success, `{ ok: false, error }` on failure.

3. Notes
  1. These functions supplement (not replace) `delete_own_session` — regular users
     still use the owner-only function; only 4X1DA can use the admin variants.
  2. Real-time sync is handled by Supabase Realtime — the DELETE event propagates
     to all subscribed clients automatically.
*/

CREATE OR REPLACE FUNCTION admin_delete_session(p_session_id uuid, p_admin_callsign text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF upper(trim(p_admin_callsign)) <> '4X1DA' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM cq_sessions WHERE id = p_session_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_session(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION admin_delete_report(p_report_id uuid, p_admin_callsign text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF upper(trim(p_admin_callsign)) <> '4X1DA' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM cq_signal_reports WHERE id = p_report_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_report(uuid, text) TO anon, authenticated;
