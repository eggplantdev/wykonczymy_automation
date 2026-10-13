import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// EX-766: the per-praca subcontractor stawka was a PAIR — `*_override_type` ('amount' | NULL) beside
// a NOT NULL DEFAULT 0 `*_override_value`. Two columns for one answer let the table hold a state no
// single write can produce ({type: NULL, value: 500}), and forced every reader to remember which
// column decides. It collapses to one nullable number: NULL = „auto" (derive from the investment's
// współczynnik), a number = a kwota frozen onto the praca, and 0 = a kwota someone set to zero.
//
// THE BACKFILL KEYS OFF THE TYPE, NEVER OFF THE VALUE. `WHERE type IS DISTINCT FROM 'amount'` is what
// turns an auto row into NULL; a bare `value` copy would keep 0 there and price 1059 + 1045 auto
// prace at zero złotych. `IS DISTINCT FROM` rather than `<> 'amount'` because the type column is
// itself nullable and NULL is exactly the auto case.
//
// The two halves owe OPPOSITE orders — the backfill is additive (the new code needs NULL to exist
// before it can read it), the `DROP COLUMN` is destructive (the old code still names those columns)
// — and they ship fused anyway. That is a deliberate call, not an oversight: no kosztorys has been
// issued to a client yet, so the window between the deploy and the apply has nobody in it, and the
// owner runs both within the same sitting. Fusing them stops being safe the day a client holds a
// share link; split it then (backfill before the push, `DROP COLUMN` after).
//
// The serialized payloads are DELETED, not rewritten — owner-approved, they are disposable test
// data. A stored payload carries the pair inside JSON, where {type: NULL, value: 0} restores as an
// explicit 0 zł instead of auto; the szablon is re-saved by hand after the deploy and the periodic
// `auto` snapshots re-accumulate on their own. The `manual` snapshots are spared only while they
// hold no pozycje — the audit found all of them empty, but `replaceTreeWithSnapshot` writes one of
// the CURRENT tree before every preset load and sheet import, so a non-empty row can appear between
// that audit and the apply. The predicate, not the audit, is what makes that safe.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      ALTER COLUMN "w_tools_override_value" DROP DEFAULT,
      ALTER COLUMN "w_tools_override_value" DROP NOT NULL,
      ALTER COLUMN "own_tools_override_value" DROP DEFAULT,
      ALTER COLUMN "own_tools_override_value" DROP NOT NULL;

    UPDATE "kosztorys_items"
      SET "w_tools_override_value" = NULL
      WHERE "w_tools_override_type" IS DISTINCT FROM 'amount';

    UPDATE "kosztorys_items"
      SET "own_tools_override_value" = NULL
      WHERE "own_tools_override_type" IS DISTINCT FROM 'amount';

    ALTER TABLE "kosztorys_items"
      DROP COLUMN "w_tools_override_type",
      DROP COLUMN "own_tools_override_type";

    DELETE FROM "kosztorys_presets";
    DELETE FROM "kosztorys_snapshots"
      WHERE "kind" = 'auto'
         OR jsonb_array_length(coalesce("payload" -> 'items', '[]'::jsonb)) > 0;
  `)
}

// LOSSY, deliberately. Every value discarded by the backfill was 0, which is what the coalesce
// restores — but the TYPE is not restored, only re-derived: a legacy 'coeff' row comes back as
// {type: NULL, value: 0}, which is what the old fold read it as anyway. The deleted szablon and
// snapshoty do not come back at all — they have no source.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_items"
      ADD COLUMN "w_tools_override_type" varchar,
      ADD COLUMN "own_tools_override_type" varchar;

    UPDATE "kosztorys_items"
      SET "w_tools_override_type" = 'amount'
      WHERE "w_tools_override_value" IS NOT NULL;

    UPDATE "kosztorys_items"
      SET "own_tools_override_type" = 'amount'
      WHERE "own_tools_override_value" IS NOT NULL;

    UPDATE "kosztorys_items"
      SET "w_tools_override_value" = coalesce("w_tools_override_value", 0),
          "own_tools_override_value" = coalesce("own_tools_override_value", 0);

    ALTER TABLE "kosztorys_items"
      ALTER COLUMN "w_tools_override_value" SET DEFAULT 0,
      ALTER COLUMN "w_tools_override_value" SET NOT NULL,
      ALTER COLUMN "own_tools_override_value" SET DEFAULT 0,
      ALTER COLUMN "own_tools_override_value" SET NOT NULL;
  `)
}
