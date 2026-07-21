import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Reverse 20260718_1: the deposit→etap „zaliczka" bridge is dropped end to end (EX-536).
// The tag held kosztorys-plane data (throwaway per AGENTS.md), so no backfill.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "transactions_kosztorys_stage_id_idx";

    ALTER TABLE transactions
    DROP COLUMN IF EXISTS kosztorys_stage_id;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS kosztorys_stage_id integer
    REFERENCES kosztorys_stages(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS "transactions_kosztorys_stage_id_idx"
      ON transactions ("kosztorys_stage_id");
  `)
}
