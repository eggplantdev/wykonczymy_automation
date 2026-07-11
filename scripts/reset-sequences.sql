-- Resync every owned sequence in the public schema to its column's MAX(value).
--
-- Why: pg_dump copies prod's setval() verbatim. When a dump-restored local/test
-- DB later gets locally-seeded rows past prod's max, the restored sequence sits
-- BEHIND MAX(id). The next nextval() then returns an already-used id, Postgres
-- raises a PK collision, and Payload mislabels it as "ValidationError: id".
-- Running this after every import makes the desync unreachable.
--
-- NEVER point this at DB_POSTGRES_URL_PROD — prod sequences are authoritative
-- and a human owns any prod-side reset (Linear EX-446).
DO $$
DECLARE
  rec RECORD;
  max_val BIGINT;
BEGIN
  FOR rec IN
    SELECT
      pg_get_serial_sequence(quote_ident(c.table_schema) || '.' || quote_ident(c.table_name), c.column_name) AS seq,
      quote_ident(c.table_schema) || '.' || quote_ident(c.table_name) AS tbl,
      quote_ident(c.column_name) AS col
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND pg_get_serial_sequence(quote_ident(c.table_schema) || '.' || quote_ident(c.table_name), c.column_name) IS NOT NULL
  LOOP
    EXECUTE format('SELECT COALESCE(MAX(%s), 0) FROM %s', rec.col, rec.tbl) INTO max_val;
    -- is_called = (max_val > 0): with a MAX, next value is max+1; on an empty
    -- table, seed at 1 with is_called=false so the first insert gets id 1.
    PERFORM setval(rec.seq, GREATEST(max_val, 1), max_val > 0);
  END LOOP;
END $$;
