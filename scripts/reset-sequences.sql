-- A restored DB whose sequence lags MAX(id) hands out an already-used id on the next INSERT, which
-- Payload surfaces as the misleading "ValidationError: id".
-- NEVER point this at DB_POSTGRES_URL_PROD — prod sequences are authoritative.
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
