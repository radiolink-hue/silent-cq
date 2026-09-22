/*
  Admin proxy Silent CQ: mark check-ins posted by 4X1DA on behalf of another station.

  Run in the Supabase SQL editor if the CLI cannot apply migrations:

    ALTER TABLE net_participants
    ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS proxy_added_by TEXT;

    ALTER TABLE cq_sessions
    ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS proxy_added_by TEXT;
*/

ALTER TABLE net_participants
  ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS proxy_added_by TEXT;

ALTER TABLE cq_sessions
  ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS proxy_added_by TEXT;
