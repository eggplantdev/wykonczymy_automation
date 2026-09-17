import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// Which szablon a restore point belongs to. Warsztat to jedna inwestycja dla wszystkich szablonów,
// więc bez tego pola ich punkty przywracania mieszają się w jedną listę nie do odróżnienia po dacie.
//
// NULL = "not a szablon restore point" (every snapshot of a real investment, plus every pre-migration
// row). Reads compare it against the investment's own `template_preset_id`, itself NULL outside the
// warsztat, so normal investments see their whole history through the same predicate unchanged.
//
// ON DELETE SET NULL, not CASCADE: deleting a szablon must not delete history — a de-attributed
// point just stops matching any szablon and gets reaped by the daily GC.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_snapshots" ADD COLUMN IF NOT EXISTS "template_preset_id" integer;

    ALTER TABLE "kosztorys_snapshots"
      ADD CONSTRAINT "kosztorys_snapshots_template_preset_id_fk"
      FOREIGN KEY ("template_preset_id") REFERENCES "kosztorys_presets"("id") ON DELETE SET NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_snapshots" DROP COLUMN IF EXISTS "template_preset_id";
  `)
}
