import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// EX-1042: the worker's answer to a wypłata. A label, never a gate — no figure reads these columns.
// Nullable, no default, no backfill: a legacy wypłata was never put to any worker, so it has no
// status (rendered „—"), and `validateTransfer` stamps `pending` on every new one. The decision is
// a raw-SQL UPDATE that runs no collection hook, so the shape is enforced here instead.
// Additive — migrate prod before pushing the code that reads the columns.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_transactions_payout_status" AS ENUM('pending', 'accepted', 'rejected');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "transactions"
    ADD COLUMN IF NOT EXISTS "payout_status" "enum_transactions_payout_status",
    ADD COLUMN IF NOT EXISTS "payout_decided_at" timestamp(3) with time zone,
    ADD COLUMN IF NOT EXISTS "payout_rejection_reason" varchar;

    ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_payout_status_only_on_payout"
      CHECK ("payout_status" IS NULL OR "type" = 'PAYOUT'),
    ADD CONSTRAINT "transactions_payout_decided_at_iff_decided"
      CHECK (("payout_status" IS NULL OR "payout_status" = 'pending') = ("payout_decided_at" IS NULL)),
    ADD CONSTRAINT "transactions_payout_rejected_has_reason"
      CHECK ("payout_status" <> 'rejected' OR "payout_rejection_reason" IS NOT NULL),
    ADD CONSTRAINT "transactions_payout_reason_only_after_rejection"
      CHECK ("payout_rejection_reason" IS NULL OR "payout_status" IN ('rejected', 'accepted'));
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions"
    DROP CONSTRAINT IF EXISTS "transactions_payout_status_only_on_payout",
    DROP CONSTRAINT IF EXISTS "transactions_payout_decided_at_iff_decided",
    DROP CONSTRAINT IF EXISTS "transactions_payout_rejected_has_reason",
    DROP CONSTRAINT IF EXISTS "transactions_payout_reason_only_after_rejection";

    ALTER TABLE "transactions"
    DROP COLUMN IF EXISTS "payout_status",
    DROP COLUMN IF EXISTS "payout_decided_at",
    DROP COLUMN IF EXISTS "payout_rejection_reason";

    DROP TYPE IF EXISTS "public"."enum_transactions_payout_status";
  `)
}
