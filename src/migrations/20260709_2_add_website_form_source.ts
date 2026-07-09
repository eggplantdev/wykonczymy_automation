import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Adds the WPForms/website ingestion source to the leads source enum so a
// WordPress form submission can be stored alongside Facebook Lead Ads leads.
// Additive only: PG12+ allows ADD VALUE inside a transaction as long as the new
// value isn't also USED in the same transaction (it isn't).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_leads_source" ADD VALUE IF NOT EXISTS 'website_form';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres does not support removing enum values — no-op
}
