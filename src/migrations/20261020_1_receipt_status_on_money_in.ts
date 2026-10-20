import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// A worker now confirms every booking that hands him money, not only a wypłata. Additive — migrate
// prod before pushing the code that stamps the new types.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions"
    DROP CONSTRAINT IF EXISTS "transactions_payout_status_only_on_payout",
    ADD CONSTRAINT "transactions_payout_status_only_on_money_in"
      CHECK ("payout_status" IS NULL OR "type" IN (
        'PAYOUT', 'REGISTER_TRANSFER', 'INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT'
      ));
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "transactions"
    SET "payout_status" = NULL, "payout_decided_at" = NULL, "payout_rejection_reason" = NULL
    WHERE "type" <> 'PAYOUT';

    ALTER TABLE "transactions"
    DROP CONSTRAINT IF EXISTS "transactions_payout_status_only_on_money_in",
    ADD CONSTRAINT "transactions_payout_status_only_on_payout"
      CHECK ("payout_status" IS NULL OR "type" = 'PAYOUT');
  `)
}
