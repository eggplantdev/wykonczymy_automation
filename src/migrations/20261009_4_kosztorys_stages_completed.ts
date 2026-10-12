import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Additive: every existing etap starts open, so production migrates BEFORE the push that selects it.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_stages" ADD COLUMN IF NOT EXISTS "completed" boolean NOT NULL DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_stages" DROP COLUMN IF EXISTS "completed";
  `)
}
