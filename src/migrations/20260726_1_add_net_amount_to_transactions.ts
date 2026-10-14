import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (mirrors 20260721_1_add_vat_plane_to_transactions) — see AGENTS.md.
// The netto figure billed to the investor on an INVESTMENT_EXPENSE_NET row; `amount` stays
// the brutto that left the register. Nullable with no default and no backfill: every other
// type bills at `amount`, so NULL here means „this type has no netto plane", not zero.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions"
    ADD COLUMN IF NOT EXISTS "net_amount" numeric;
  `)
}

// FORWARD-ONLY as a pair with 20260726_0: that migration's `down` cannot remove the enum value
// (Postgres has no DROP TYPE VALUE), so rolling back only this one leaves rows typed
// INVESTMENT_EXPENSE_NET while every financial query still SUMs the dropped column — a hard error
// on every investment, not just the netto ones. Roll back both or neither.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions"
    DROP COLUMN IF EXISTS "net_amount";
  `)
}
