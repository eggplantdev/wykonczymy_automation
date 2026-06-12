import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written — migrate:create's snapshot baseline is stale on this branch
// (see AGENTS.md / project memory). `settled` flags an INVESTMENT_EXPENSE whose
// material is already priced into robocizna: leaves the register, excluded from
// bilans, reduces marża.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "settled" boolean DEFAULT false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "transactions" DROP COLUMN IF EXISTS "settled";
  `)
}
