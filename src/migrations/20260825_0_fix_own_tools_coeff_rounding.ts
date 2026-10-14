import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The stawka „bez narzędzi" is not an independent number: in the owner's sheet it is the stawka
// „z narzędziami" less 15% (`0.65 × 0.85 = 0.5525`). 20260708_2 created the column with DEFAULT 0.55
// — a rounding — and stamped it on every investment that existed. The application default has said
// 0.5525 since (`DEFAULT_COEFFS`), so the two sources have disagreed ever since: a new investment
// created through Payload gets 0.5525, one created around it gets 0.55, and nothing on screen says
// which. Half a percent under on every pozycja without an override.
//
// Free to run today and only today: not one investment has a kosztorys yet, so no figure moves — the
// rounding has never been used to price anything. The moment kosztorysy land it stops being a column
// value and becomes a rozjazd in a subcontractor's wycena. Verify the premise before running:
//   SELECT count(*) FROM kosztorys_items;                                  -- expected 0
//   SELECT own_tools_coeff, count(*) FROM investments GROUP BY 1;          -- expected all 0.55
//
// Neither additive nor destructive: no code reads a column that isn't there either way, so the deploy
// order in AGENTS.md does not bite. The sheet-import path already overrides the stawka from the
// cennika formulas; this fixes every other way a kosztorys can be born (template, by hand).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "investments" ALTER COLUMN "own_tools_coeff" SET DEFAULT 0.5525;

    UPDATE "investments" SET "own_tools_coeff" = 0.5525 WHERE "own_tools_coeff" = 0.55;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Only the column default comes back. A corrected value is indistinguishable from one an owner
  // typed, and putting the rounding back would be re-introducing the defect on rows that may by then
  // be pricing real work.
  await db.execute(sql`
    ALTER TABLE "investments" ALTER COLUMN "own_tools_coeff" SET DEFAULT 0.55;
  `)
}
