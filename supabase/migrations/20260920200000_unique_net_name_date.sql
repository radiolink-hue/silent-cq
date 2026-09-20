/*
  One net session per name per date.
  Keep the oldest duplicate, then enforce uniqueness.
*/

DELETE FROM nets
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY net_date, lower(btrim(name))
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM nets
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_nets_date_name
  ON nets (net_date, lower(btrim(name)));
