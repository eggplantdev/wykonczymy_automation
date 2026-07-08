import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written — migrate:create's snapshot baseline is stale on this branch
// (see AGENTS.md / project memory). Per-user read cursor for notification
// streams: one row per (user, stream) holding the high-water mark. Unread =
// count of stream items newer than seen_at. Not a Payload collection — read and
// written only via raw SQL, so it carries no collection config / access control.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "notification_reads" (
      "id" serial PRIMARY KEY,
      "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "stream" text NOT NULL,
      "seen_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "notification_reads_user_stream_idx"
      ON "notification_reads" ("user_id", "stream");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "notification_reads";
  `)
}
