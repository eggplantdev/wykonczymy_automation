import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "media_detachments" (
      "id" serial PRIMARY KEY,
      "media_id" integer NOT NULL REFERENCES "media"("id") ON DELETE CASCADE,
      "from_collection" varchar,
      "from_field" varchar,
      "from_id" integer,
      "detached_at" timestamptz NOT NULL DEFAULT now(),
      "restored_at" timestamptz
    );

    CREATE UNIQUE INDEX IF NOT EXISTS "media_detachments_open_media_idx"
      ON "media_detachments" ("media_id") WHERE "restored_at" IS NULL;
    CREATE INDEX IF NOT EXISTS "media_detachments_open_detached_at_idx"
      ON "media_detachments" ("detached_at") WHERE "restored_at" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "media_detachments";
  `)
}
