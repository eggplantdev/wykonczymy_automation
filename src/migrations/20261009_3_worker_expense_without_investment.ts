import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Additive — every existing account gets `false` and every existing draft keeps its investment, so
// this goes to production BEFORE the code that sends a draft without one.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "can_add_expenses_without_investment" boolean NOT NULL DEFAULT false;
    ALTER TABLE "worker_expense_drafts" ALTER COLUMN "investment_id" DROP NOT NULL;
  `)
}

// Lossy: a draft without an investment cannot survive NOT NULL, so it is deleted with its pages —
// an accepted one loses its link to the booked transfer, and its receipts stay unreferenced.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM "worker_expense_drafts" WHERE "investment_id" IS NULL;
    ALTER TABLE "worker_expense_drafts" ALTER COLUMN "investment_id" SET NOT NULL;
    ALTER TABLE "users" DROP COLUMN "can_add_expenses_without_investment";
  `)
}
