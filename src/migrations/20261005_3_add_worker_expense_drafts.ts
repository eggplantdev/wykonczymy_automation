import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Raw tables, not a status on `transactions`: every balance / materiały / marża query reads that table,
// and a draft must move none of them until it is accepted.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "worker_expense_drafts" (
      "id" serial PRIMARY KEY,
      "worker_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "cash_register_id" integer NOT NULL REFERENCES "cash_registers"("id") ON DELETE CASCADE,
      "note" text,
      "status" text NOT NULL DEFAULT 'pending',
      "sent_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "decided_at" timestamp(3) with time zone,
      "decided_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "transfer_id" integer REFERENCES "transactions"("id") ON DELETE SET NULL,
      CONSTRAINT "worker_expense_drafts_status_check" CHECK ("status" IN ('pending', 'accepted', 'rejected')),
      CONSTRAINT "worker_expense_drafts_decided_check" CHECK (("status" = 'pending') = ("decided_at" IS NULL))
    );

    CREATE INDEX IF NOT EXISTS "worker_expense_drafts_worker_sent_idx"
      ON "worker_expense_drafts" ("worker_id", "sent_at" DESC);
    CREATE INDEX IF NOT EXISTS "worker_expense_drafts_pending_idx"
      ON "worker_expense_drafts" ("sent_at") WHERE "status" = 'pending';
    CREATE INDEX IF NOT EXISTS "worker_expense_drafts_investment_idx"
      ON "worker_expense_drafts" ("investment_id");
    CREATE INDEX IF NOT EXISTS "worker_expense_drafts_transfer_idx"
      ON "worker_expense_drafts" ("transfer_id");

    CREATE TABLE IF NOT EXISTS "worker_expense_draft_media" (
      "draft_id" integer NOT NULL REFERENCES "worker_expense_drafts"("id") ON DELETE CASCADE,
      "media_id" integer NOT NULL REFERENCES "media"("id") ON DELETE CASCADE,
      "position" integer NOT NULL,
      PRIMARY KEY ("draft_id", "media_id")
    );

    CREATE INDEX IF NOT EXISTS "worker_expense_draft_media_media_idx"
      ON "worker_expense_draft_media" ("media_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "worker_expense_draft_media";
    DROP TABLE IF EXISTS "worker_expense_drafts";
  `)
}
