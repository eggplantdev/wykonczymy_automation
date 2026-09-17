import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The szablon workbench: one hidden investment the template editor works over. Its status keeps it
// off /inwestycje and every booking picker; `template_preset_id` points at the kosztorys_presets
// row currently loaded into it — set by „Otwórz", never a copy.
//
// Both statements share a transaction safely: PG 12+ allows `ADD VALUE` inside a transaction as
// long as the new value isn't *used* in it, and the nullable column has no default that would.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'szablon';
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "template_preset_id" integer;
  `)
}

// Postgres has no DROP VALUE — reverting the enum would mean recreating the type and its dependent
// column. The column is droppable, so that half reverts; the enum value is a documented no-op.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" DROP COLUMN IF EXISTS "template_preset_id";
  `)
}
