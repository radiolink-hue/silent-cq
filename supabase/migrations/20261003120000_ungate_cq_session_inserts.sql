/*
  Regular Silent CQ inserts must stay public for every callsign.
  Manager/admin checks belong only in the app (Admin Posted + Managers UI).
*/

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'cq_sessions'
      AND NOT t.tgisinternal
      AND (
        p.proname ILIKE '%manager%'
        OR pg_get_triggerdef(t.oid) ILIKE '%manager%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON cq_sessions', r.tgname);
  END LOOP;

  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cq_sessions'
      AND (
        coalesce(qual, '') ILIKE '%manager%'
        OR coalesce(with_check, '') ILIKE '%manager%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON cq_sessions', r.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "public_insert_sessions" ON cq_sessions;
CREATE POLICY "public_insert_sessions" ON cq_sessions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_sessions" ON cq_sessions;
CREATE POLICY "public_update_sessions" ON cq_sessions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
