/*
# Secure session deletion (owner-only)

1. Changes
  - Add a SECURITY DEFINER function `delete_own_session(p_session_id uuid, p_callsign text)`
    that verifies the session's callsign matches the supplied callsign (case-insensitive)
    before deleting the row. This enforces ownership server-side even though the app
    has no login — the callsign IS the identity.
  - Revoke the existing public DELETE policy on cq_sessions so direct client deletes
    are blocked; all deletes must go through the function.
  - Grant EXECUTE on the function to anon + authenticated.

2. Security
  - The function runs with elevated privileges (SECURITY DEFINER) but only deletes
    when `cq_sessions.callsign` matches `p_callsign` (uppercased, trimmed). A mismatch
    returns an error and deletes nothing.
  - The public DELETE policy is dropped so the anon role cannot delete rows directly.

3. Notes
  1. The function returns JSONB with `{ ok: true }` on success or `{ ok: false, error }`.
  2. Case-insensitive comparison via `upper()` so 4x1da and 4X1DA are the same owner.
*/

CREATE OR REPLACE FUNCTION delete_own_session(p_session_id uuid, p_callsign text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_callsign text;
BEGIN
  SELECT upper(trim(callsign)) INTO v_callsign
  FROM cq_sessions
  WHERE id = p_session_id;

  IF v_callsign IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF v_callsign <> upper(trim(p_callsign)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  DELETE FROM cq_sessions WHERE id = p_session_id AND upper(trim(callsign)) = upper(trim(p_callsign));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_own_session(uuid, text) TO anon, authenticated;

-- Remove the open public DELETE policy so direct deletes are blocked.
DROP POLICY IF EXISTS "public_delete_sessions" ON cq_sessions;
