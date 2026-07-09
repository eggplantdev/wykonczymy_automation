import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written fix (see AGENTS.md — migrate:create's snapshot is stale, internal
// Payload tables must be adjusted by hand). The kosztorys sections/items
// (20260708_2) and stages/progress (20260709) migrations created their tables but
// forgot to register the new collections in `payload_locked_documents_rels`.
// Payload's schema expects a `<collection>_id` column there for EVERY collection,
// so its lock-check SELECT references these four columns on any create/update/
// delete — and threw "column ... does not exist" until they exist. Mirrors the
// kosztoryses_id wiring from 20260528.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "kosztorys_sections_id" integer
      REFERENCES "kosztorys_sections"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_sections_id_idx"
      ON "payload_locked_documents_rels" ("kosztorys_sections_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "kosztorys_items_id" integer
      REFERENCES "kosztorys_items"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_items_id_idx"
      ON "payload_locked_documents_rels" ("kosztorys_items_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "kosztorys_stages_id" integer
      REFERENCES "kosztorys_stages"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_kosztorys_stages_id_idx"
      ON "payload_locked_documents_rels" ("kosztorys_stages_id");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "stage_progress_id" integer
      REFERENCES "stage_progress"("id") ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_stage_progress_id_idx"
      ON "payload_locked_documents_rels" ("stage_progress_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_stage_progress_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "stage_progress_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_kosztorys_stages_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kosztorys_stages_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_kosztorys_items_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kosztorys_items_id";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_kosztorys_sections_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "kosztorys_sections_id";
  `)
}
