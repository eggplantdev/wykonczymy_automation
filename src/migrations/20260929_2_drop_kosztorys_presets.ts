import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The DESTRUCTIVE half of EX-893: 20260929_1 moved every szablon onto its own investment, so the
// shared workshop, `kosztorys_presets` and both `template_preset_id` pointers are now read by nothing.
// Runs only once the new deploy is live — the old code SELECTs these columns (Postgres 42703).
//
// The workshop is found by its pointer, not by id: a restored test DB may give it a different id,
// and a migrated szablon never carries one. The cascade takes its tree and remaining restore points.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM investments WHERE status = 'szablon' AND template_preset_id IS NOT NULL;

    ALTER TABLE "investments" DROP CONSTRAINT IF EXISTS "investments_template_preset_id_fk";
    ALTER TABLE "kosztorys_snapshots"
      DROP CONSTRAINT IF EXISTS "kosztorys_snapshots_template_preset_id_fk";
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "template_preset_id";
    ALTER TABLE "kosztorys_snapshots" DROP COLUMN IF EXISTS "template_preset_id";

    DROP TABLE IF EXISTS "kosztorys_presets";
  `)
}

// Structure only — the presets, the workshop and its pointers do NOT come back. Rolling 20260929_1
// back after this would treat the oldest surviving szablon as the workshop and delete the rest.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_presets" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "schema_version" integer NOT NULL,
      "payload" jsonb NOT NULL,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "mirrored_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone,
      CONSTRAINT "kosztorys_presets_name_unique" UNIQUE ("name")
    );

    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "template_preset_id" integer;
    ALTER TABLE "investments"
      ADD CONSTRAINT "investments_template_preset_id_fk"
      FOREIGN KEY ("template_preset_id") REFERENCES "kosztorys_presets"("id") ON DELETE SET NULL;

    ALTER TABLE "kosztorys_snapshots" ADD COLUMN IF NOT EXISTS "template_preset_id" integer;
    ALTER TABLE "kosztorys_snapshots"
      ADD CONSTRAINT "kosztorys_snapshots_template_preset_id_fk"
      FOREIGN KEY ("template_preset_id") REFERENCES "kosztorys_presets"("id") ON DELETE SET NULL;
  `)
}
