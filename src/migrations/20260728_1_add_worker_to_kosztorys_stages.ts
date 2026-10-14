import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Per-etap worker assignment (EX-613): who is to do this etap, so należne stops being an
// investment-level lump. Nullable and no backfill — unlike `plane`, NULL is a legitimate resting
// state (an unassigned etap gets its own residual row) and never locks quantity entry.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_stages"
    ADD COLUMN IF NOT EXISTS "worker_id" integer
    REFERENCES "users"("id") ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS "kosztorys_stages_worker_id_idx"
      ON "kosztorys_stages" ("worker_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "kosztorys_stages_worker_id_idx";

    ALTER TABLE "kosztorys_stages"
    DROP COLUMN IF EXISTS "worker_id";
  `)
}
