import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// RUN-AFTER-DEPLOY
//
// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Second half of EX-1075: 20261015_2 copied the szablony into `templates`; this deletes the old
// `investments` rows once the deploy that reads `templates` is live — the previous code still lists
// and opens them.
//
// The cascade takes their kosztorys_sections / items / snapshots / stages / shares and locked-docs
// rows; no transaction, lead, kosztorys link or equipment event points at a szablon (checked on
// prod, 2026-10-16), so none of the NO ACTION FKs refuses the DELETE.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // A szablon created after 20261015_2 copied them (the old code was still live) has no `templates`
  // row — the DELETE would lose it with nothing left to restore from.
  await db.execute(sql`
    DO $$
    DECLARE uncopied text;
    BEGIN
      SELECT string_agg(i.name, ', ') INTO uncopied
      FROM investments i
      WHERE i.status = 'szablon' AND i.trashed_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM templates t WHERE lower(trim(t.name)) = lower(trim(i.name)));
      IF uncopied IS NOT NULL THEN
        RAISE EXCEPTION 'szablony missing from templates, copy them first: %', uncopied;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DROP INDEX IF EXISTS "investments_szablon_name_idx";

    DELETE FROM investments WHERE status = 'szablon';

    ALTER TYPE "enum_investments_status" RENAME TO "enum_investments_status_old";
    CREATE TYPE "enum_investments_status" AS ENUM
      ('active', 'completed', 'planowana', 'quote', 'rejected');
    ALTER TABLE "investments" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "investments" ALTER COLUMN "status"
      TYPE "enum_investments_status" USING "status"::text::"enum_investments_status";
    ALTER TABLE "investments" ALTER COLUMN "status" SET DEFAULT 'quote';
    DROP TYPE "enum_investments_status_old";

    ALTER TABLE "investments" DROP COLUMN IF EXISTS "content_edited_at";
  `)
}

// Schema only — the deleted szablon rows are not restorable (their copy lives in `templates`).
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_investments_status" ADD VALUE IF NOT EXISTS 'szablon';
    ALTER TABLE "investments" ADD COLUMN IF NOT EXISTS "content_edited_at" timestamp(3) with time zone;
  `)
}
