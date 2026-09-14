import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Who recorded a handover. The log answered „kto to ma" from the day it shipped but never „kto tak
// napisał", which is the only question that matters once a tool is missing and the holder says he
// never took it.
//
// ON DELETE set null, not restrict: the author is provenance, and a leaving employee must not pin
// every row he ever typed. The event itself — the holder, the date — survives him.
//
// Rows that predate this stay NULL and there is nothing to backfill them from; `created_at` says
// when, and nothing anywhere says by whom.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "equipment_events"
      ADD COLUMN IF NOT EXISTS "created_by_id" integer
      REFERENCES "users"("id") ON DELETE set null;

    CREATE INDEX IF NOT EXISTS "equipment_events_created_by_idx"
      ON "equipment_events" ("created_by_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "equipment_events_created_by_idx";
    ALTER TABLE "equipment_events" DROP COLUMN IF EXISTS "created_by_id";
  `)
}
