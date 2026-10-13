import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO other_categories (name, created_at, updated_at)
    SELECT 'Inne', NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM other_categories WHERE name = 'Inne');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DELETE FROM other_categories WHERE name = 'Inne';
  `)
}
