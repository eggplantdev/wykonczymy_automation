import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Its own file because 20260929_3 adds the value, and Postgres
// refuses a default naming an enum value added in the same transaction — Payload commits each
// migration file separately. The collection's `defaultValue` carries the same default for every
// create that goes through Payload; this keeps the column honest for anything that doesn't.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ALTER COLUMN "status" SET DEFAULT 'quote';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ALTER COLUMN "status" SET DEFAULT 'active';
  `)
}
