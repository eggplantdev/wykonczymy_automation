-- Reset every owned sequence to its table's MAX(id) after a dump restore.
--
-- Why: the prod dump can carry a `setval` that lags the table's real max id (prod's own
-- sequence drifted behind, e.g. after manual inserts), and pg_dump copies that stale value
-- verbatim. A restored DB then hands out an already-used id on the next INSERT, which Payload
-- surfaces as the misleading `ValidationError: id`. Run this right after `db:import:test` so the
-- test DB always lands consistent — for every collection, not just the one that happened to break.
--
-- setval(seq, MAX(col), rows_exist): with rows, is_called=true → nextval = MAX+1; empty table,
-- is_called=false → nextval = 1.
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
