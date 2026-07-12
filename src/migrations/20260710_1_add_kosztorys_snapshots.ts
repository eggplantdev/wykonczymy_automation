import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// S-06 durable version net: one row per snapshot holding the serialized whole kosztorys tree
// (sections + items + stages + progress) plus the investment editor-settings as `payload` jsonb.
// Scoped to an investment and cascade-deleted with it. Not a Payload collection — read and
// written only via raw SQL (the notification_reads pattern), so it carries no collection config.
// `taken_by` SET NULL on user delete keeps a snapshot when its author is removed.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "kosztorys_snapshots" (
      "id" serial PRIMARY KEY,
      "investment_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE CASCADE,
      "taken_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "taken_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
      "kind" varchar NOT NULL,
      "label" varchar,
      "schema_version" integer NOT NULL,
      "payload" jsonb NOT NULL
    );
    -- List (newest-first) + the auto-throttle lookup both key on (investment, taken_at DESC).
    CREATE INDEX IF NOT EXISTS "kosztorys_snapshots_investment_taken_at_idx"
      ON "kosztorys_snapshots" ("investment_id", "taken_at" DESC);
    -- Retention pruning (count cap + age GC) scans per (investment, kind) in taken_at order.
    CREATE INDEX IF NOT EXISTS "kosztorys_snapshots_investment_kind_taken_at_idx"
      ON "kosztorys_snapshots" ("investment_id", "kind", "taken_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "kosztorys_snapshots";
  `)
}
