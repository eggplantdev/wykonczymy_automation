-- Resync every owned sequence in the public schema to its table's MAX(id) after a dump restore.
--
-- Why: pg_dump copies prod's setval() verbatim. A restored local/test DB whose sequence lags
-- MAX(id) — prod drifted behind, or locally-seeded rows went past prod's max — hands out an
-- already-used id on the next INSERT, which Payload surfaces as the misleading "ValidationError: id".
-- Run this after every import (e.g. db:import:test) so the desync is unreachable, for every collection.
--
-- setval(seq, MAX(col), rows_exist): with rows, is_called=true → nextval = MAX+1; empty table,
-- is_called=false → nextval = 1.
--
-- NEVER point this at DB_POSTGRES_URL_PROD — prod sequences are authoritative and a human owns any
-- prod-side reset (Linear EX-446).
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
    FROM pg_class s
    JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    JOIN pg_namespace n ON n.oid = s.relnamespace
    WHERE s.relkind = 'S' AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM public.%I), 1), (SELECT COUNT(*) > 0 FROM public.%I))',
      rec.seq, rec.col, rec.tbl, rec.tbl
    );
  END LOOP;
END $$;
