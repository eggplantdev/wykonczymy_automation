import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-985: a worker's report link is minted when he is put on an etap; this gives one to every pair
// that predates the mint. pgcrypto is not installed, so the token is two uuids (244 random bits).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "worker_report_shares" ("investment_id", "worker_id", "token")
    SELECT pairs."investment_id", pairs."worker_id",
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    FROM (
      SELECT DISTINCT ks."investment_id", ksw."worker_id"
      FROM "kosztorys_stage_workers" ksw
      JOIN "kosztorys_stages" ks ON ks."id" = ksw."stage_id"
    ) pairs
    ON CONFLICT ("investment_id", "worker_id") DO NOTHING;
  `)
}

// A minted link cannot be told apart from one a manager handed out, so nothing is removed.
export async function down(_args: MigrateDownArgs): Promise<void> {}
