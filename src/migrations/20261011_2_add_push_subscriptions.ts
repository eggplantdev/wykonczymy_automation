import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// `endpoint` is unique, not (user, endpoint): one device belongs to whoever enabled push on it last,
// so a phone handed to another worker stops receiving the previous owner's pushes.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" serial PRIMARY KEY,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "endpoint" text NOT NULL UNIQUE,
      "p256dh" text NOT NULL,
      "auth" text NOT NULL,
      "user_agent" text,
      "created_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
      "last_seen_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "push_subscriptions";
  `)
}
