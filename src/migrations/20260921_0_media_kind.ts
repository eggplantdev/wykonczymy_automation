import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// `media` stops being the invoice library and becomes the one upload collection: lead attachments
// and investment photos land here too, so a row has to be able to say what it is. Nullable with no
// default — existing rows are invoices by provenance, but back-filling that guess is worse than a
// blank.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_media_kind') THEN
        CREATE TYPE "enum_media_kind" AS ENUM ('faktura', 'projekt', 'zdjecie', 'inne');
      END IF;
    END $$;

    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "kind" "enum_media_kind";
  `)
}

// The type is new here, so unlike an ADD VALUE on an existing enum this reverts cleanly — drop the
// column first, then the type it depends on.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "media" DROP COLUMN IF EXISTS "kind";
    DROP TYPE IF EXISTS "enum_media_kind";
  `)
}
