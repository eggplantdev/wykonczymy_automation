import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-974: `review_requested` (20261002_1) replaced the „Opinia" textarea. Destructive — production
// runs this only once the EX-973 deploy is live, because the code before it still SELECTs `review`.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "review";
  `)
}

// The free text is gone; the flag is the only thing a rollback can rebuild it from.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "review" varchar;
    UPDATE "investments" SET "review" = 'tak' WHERE "review_requested";
  `)
}
