import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// Per-section colour (the „Sekcje" palette). Deliberately a plain varchar, NOT a pg enum like
// kosztorys_stages.plane: `plane` is a domain union of two that never grows, while this holds a
// design-system palette key — SECTION_COLORS is expected to gain entries, and each one would
// otherwise owe an ALTER TYPE. The allowlist lives in src/lib/kosztorys/section-colors.ts and is
// enforced on write (zod) and on read (isSectionColorKey), so a retired key degrades to "unpinned".
// Nullable, no default, no backfill: NULL = unpinned = the positional chart palette, i.e. exactly
// today's rendering. Kosztorys data is throwaway until dogfooding lands.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_sections"
    ADD COLUMN IF NOT EXISTS "color" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_sections"
    DROP COLUMN IF EXISTS "color";
  `)
}
