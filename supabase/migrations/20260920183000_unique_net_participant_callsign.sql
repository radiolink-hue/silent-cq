/*
  One participant row per callsign in a net (case-insensitive).
  Keep the newest duplicate, then enforce uniqueness.
*/

DELETE FROM net_participants a
WHERE a.id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY net_id, upper(callsign)
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM net_participants
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_net_participants_net_callsign
  ON net_participants (net_id, upper(callsign));
