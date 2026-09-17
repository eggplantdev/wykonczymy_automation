import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Separate migration from 20260914_0, already applied — amending it would leave databases that ran
// it without these constraints.
//
// Moves two rules from app-code convention into enforced schema:
// 1. Singleton warsztat. `resolveWorkshopInvestment`'s SELECT-then-INSERT lets two racing "Otwórz"
//    clicks both insert; `getWorkshop`'s `ORDER BY id LIMIT 1` would then silently orphan the second
//    row. The partial unique index makes the second INSERT fail instead.
// 2. `template_preset_id` is a pointer that could outlive its target — a deleted szablon left the
//    warsztat rendering a missing row under someone else's name. `ON DELETE SET NULL` degrades that
//    to the "nic nie jest otwarte" state the UI already handles.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "investments_single_szablon_idx"
      ON "investments" ("status") WHERE "status" = 'szablon';

    ALTER TABLE "investments"
      ADD CONSTRAINT "investments_template_preset_id_fk"
      FOREIGN KEY ("template_preset_id") REFERENCES "kosztorys_presets"("id") ON DELETE SET NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP CONSTRAINT IF EXISTS "investments_template_preset_id_fk";
    DROP INDEX IF EXISTS "investments_single_szablon_idx";
  `)
}
