import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Zaliczki bridge: optional etap tag on a deposit transfer. Nullable, no backfill —
// transfers are real prod data. ON DELETE SET NULL so removing an etap only untags
// its advances rather than deleting the cash movement.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS kosztorys_stage_id integer
    REFERENCES kosztorys_stages(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS "transactions_kosztorys_stage_id_idx"
      ON transactions ("kosztorys_stage_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE transactions
    DROP COLUMN IF EXISTS kosztorys_stage_id;
  `)
}
