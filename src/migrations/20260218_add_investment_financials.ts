import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE investments
      ADD COLUMN total_income numeric DEFAULT 0 NOT NULL,
      ADD COLUMN labor_costs numeric DEFAULT 0 NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE investments
      DROP COLUMN IF EXISTS total_income,
      DROP COLUMN IF EXISTS labor_costs;
  `)
}
