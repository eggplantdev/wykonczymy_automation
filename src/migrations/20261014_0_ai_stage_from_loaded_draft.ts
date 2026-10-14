import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The listing used to lift „Analiza AI” to „Przeanalizowana” for any investment with a loaded AI
// draft, which hid a stage set by hand below it. The listing now reads the stored stage alone, so an
// investment the lift covered gets that stage stored. Data only — migrate prod before pushing the
// code, or those investments read „Uzupełnianie informacji” until it runs.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "investments" i
    SET "ai_stage" = 'analyzed'
    WHERE (i."ai_stage" IS NULL OR i."ai_stage" = 'ready_for_analysis')
      AND EXISTS (
        SELECT 1 FROM "kosztorys_items" ki
        WHERE ki."investment_id" = i."id" AND ki."ai_planned_qty" IS NOT NULL
      );
  `)
}

// Irreversible: after `up` a backfilled row is indistinguishable from one set by hand.
export async function down(_args: MigrateDownArgs): Promise<void> {}
