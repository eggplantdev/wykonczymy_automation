import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// `assets` is investments' first hasMany upload, which Payload keeps on a <collection>_rels join
// table rather than a scalar FK column — investments had no relationship field until now, so the
// table itself is new. Shape mirrors equipment_events_rels (20260903_0).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "investments_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL REFERENCES "investments"("id") ON DELETE cascade,
      "path" varchar NOT NULL,
      "media_id" integer REFERENCES "media"("id") ON DELETE cascade
    );

    CREATE INDEX IF NOT EXISTS "investments_rels_order_idx" ON "investments_rels" ("order");
    CREATE INDEX IF NOT EXISTS "investments_rels_parent_idx" ON "investments_rels" ("parent_id");
    CREATE INDEX IF NOT EXISTS "investments_rels_path_idx" ON "investments_rels" ("path");
    CREATE INDEX IF NOT EXISTS "investments_rels_media_id_idx" ON "investments_rels" ("media_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "investments_rels_media_id_idx";
    DROP INDEX IF EXISTS "investments_rels_path_idx";
    DROP INDEX IF EXISTS "investments_rels_parent_idx";
    DROP INDEX IF EXISTS "investments_rels_order_idx";
    DROP TABLE IF EXISTS "investments_rels";
  `)
}
