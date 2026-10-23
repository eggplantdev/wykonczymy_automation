import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Seeded on every environment: each list is `required` + `minRows: 1`, so an empty one makes every
// `saveRecipientListAction` (which rewrites all lists) fail validation.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "notification_recipients_ai_pipeline" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "notification_recipients"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY,
      "email" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "notification_recipients_ai_pipeline_order_idx"
      ON "notification_recipients_ai_pipeline" ("_order");
    CREATE INDEX IF NOT EXISTS "notification_recipients_ai_pipeline_parent_id_idx"
      ON "notification_recipients_ai_pipeline" ("_parent_id");

    CREATE TABLE IF NOT EXISTS "notification_recipients_ai_reviewers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL REFERENCES "notification_recipients"("id") ON DELETE CASCADE,
      "id" varchar PRIMARY KEY,
      "email" varchar NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "notification_recipients_ai_reviewers_order_idx"
      ON "notification_recipients_ai_reviewers" ("_order");
    CREATE INDEX IF NOT EXISTS "notification_recipients_ai_reviewers_parent_id_idx"
      ON "notification_recipients_ai_reviewers" ("_parent_id");

    INSERT INTO "notification_recipients_ai_pipeline" ("_order", "_parent_id", "id", "email")
      VALUES (1, 1, 'seed_ai_pipeline_1', 'admin@wykonczymy.com.pl')
      ON CONFLICT ("id") DO NOTHING;

    INSERT INTO "notification_recipients_ai_reviewers" ("_order", "_parent_id", "id", "email")
      VALUES
        (1, 1, 'seed_ai_reviewers_1', 'bartek@wykonczymy.com.pl'),
        (2, 1, 'seed_ai_reviewers_2', 'yuri@wykonczymy.com.pl')
      ON CONFLICT ("id") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "notification_recipients_ai_reviewers";
    DROP TABLE IF EXISTS "notification_recipients_ai_pipeline";
  `)
}
