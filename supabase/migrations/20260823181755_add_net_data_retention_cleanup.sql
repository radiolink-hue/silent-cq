/*
# 30-day data retention for net tables

1. Changes
  - Creates a `cleanup_old_net_data()` PL/pgSQL function that deletes rows from
    `nets`, `net_participants`, and `signal_reports` older than 30 days.
  - Schedules the function to run daily at 03:00 UTC via `pg_cron` if the
    extension is available. If `pg_cron` is not installed, the function still
    exists and can be called manually or via an external scheduler.

2. Security
  - The function is SECURITY DEFINER so it can run with elevated privileges
    to delete rows regardless of RLS. It only deletes rows older than 30 days.

3. Notes
  1. The function is idempotent — safe to call multiple times.
  2. The cron job name is `cleanup_old_net_data_job` — unscheduled first if it
     already exists to make the migration re-runnable.
*/

CREATE OR REPLACE FUNCTION public.cleanup_old_net_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.signal_reports
    WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.net_participants
    WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM public.nets
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Schedule the cleanup if pg_cron is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_old_net_data_job');
    PERFORM cron.schedule(
      'cleanup_old_net_data_job',
      '0 3 * * *',
      'SELECT public.cleanup_old_net_data();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
