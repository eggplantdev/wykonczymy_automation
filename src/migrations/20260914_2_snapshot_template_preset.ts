import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
//
// Which szablon a restore point belongs to. Punkty przywracania są per-inwestycja, a warsztat to
// JEDNA inwestycja obsługująca wszystkie szablony — bez tego pola jego historia miesza punkty
// różnych szablonów w jedną listę po dacie, w której nic ich nie odróżnia. Przywrócenie punktu
// jednego szablonu i zapis wlewa jego treść do drugiego, a wskaźnik warsztatu tego nie łapie:
// po przywróceniu to jest już legalnie „bieżąca treść warsztatu".
//
// NULL means „not a szablon restore point" — every snapshot of a real investment, and every row
// taken before this migration. The reads compare it against the investment's own
// `template_preset_id`, which is NULL for everything that is not the warsztat, so normal investments
// keep seeing their whole history through the same predicate.
//
// ON DELETE SET NULL rather than CASCADE: deleting a szablon must not delete history, and a
// de-attributed point simply stops matching any szablon (the daily GC reaps it on the normal
// schedule).
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
