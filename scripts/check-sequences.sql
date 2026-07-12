-- READ-ONLY. Report every owned sequence whose last_value has fallen behind its table's MAX(id).
-- Each NOTICE = a sequence that will hand out an already-used id on the next INSERT (surfaces as
-- Payload "ValidationError: id"). No NOTICEs = all healthy. Safe on prod: no setval/DDL, only reads.
DO $$
DECLARE
  rec RECORD;
  max_id BIGINT;
  seq_val BIGINT;
  lagging INT := 0;
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
    EXECUTE format('SELECT MAX(%I) FROM public.%I', rec.col, rec.tbl) INTO max_id;
    EXECUTE format('SELECT last_value FROM public.%I', rec.seq) INTO seq_val;
    IF max_id IS NOT NULL AND seq_val < max_id THEN
      lagging := lagging + 1;
      RAISE NOTICE 'LAG  %  (table %.%): seq_last=%  max_id=%  behind_by=%',
        rec.seq, rec.tbl, rec.col, seq_val, max_id, max_id - seq_val;
    END IF;
  END LOOP;
  RAISE NOTICE '--- % lagging sequence(s) ---', lagging;
END $$;
