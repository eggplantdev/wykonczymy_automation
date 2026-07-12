import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// S-09 preset library: one row per reusable preset holding a stripped kosztorys tree
// (sections + items + stages, job fields zeroed at serialize time) as `payload` jsonb.
// Unlike kosztorys_snapshots this table is GLOBAL — no `investment_id` — because a preset is
// a cross-investment template. `name` is the preset's identity (UNIQUE; save-as overwrites by
// name). Not a Payload collection — read/written only via raw SQL (the notification_reads
// pattern). `created_by` SET NULL on user delete keeps a preset when its author is removed.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_presets" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "schema_version" integer NOT NULL,
      "payload" jsonb NOT NULL,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      CONSTRAINT "kosztorys_presets_name_unique" UNIQUE ("name")
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "kosztorys_presets";
  `)
}
