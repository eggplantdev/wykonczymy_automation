import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * The 20260309_add_expense_categories migration added the expense_categories
 * collection but forgot to update Payload's internal payload_locked_documents_rels
 * table. Payload queries that table with an expense_categories_id column on every
 * create/update/delete, causing "column does not exist" errors.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "expense_categories_id" integer
    REFERENCES "expense_categories"("id") ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_expense_categories_id_idx"
    ON "payload_locked_documents_rels" ("expense_categories_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "payload_locked_documents_rels_expense_categories_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "expense_categories_id";
  `)
}
