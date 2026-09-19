/*
  Store net session bounds as UTC timestamptz. Display converts to Asia/Jerusalem.
  Triggering uses now() (UTC) as master clock — not the client timezone.
*/

ALTER TABLE nets
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_nets_starts_at ON nets (starts_at DESC);

CREATE OR REPLACE FUNCTION public.server_utc_now()
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT now();
$$;

REVOKE ALL ON FUNCTION public.server_utc_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.server_utc_now() TO anon, authenticated;
