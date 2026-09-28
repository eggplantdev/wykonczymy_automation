import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).
// The client preview goes back to ONE column set per investment (and one firm-wide default): the
// settlement columns now show themselves once there are entries, so the offer/settlement switch has
// nothing left to switch. The flat pair comes back and is filled from the variant each row serves.
//
// Purely ADDITIVE, for the reason 20260819_0 was: `/k/:token` reads this table, so `mode` /
// `variants` are dropped by a follow-up migration once this deploy is live.
//
// `hidden_columns` is nullable with NO default. It stores what is HIDDEN, so `'[]'` means „hide
// nothing" — as a default it would hand every row the whole allowlist, rabat included. NULL reads as
// „never chosen" and resolves to the code default in `sanitizeClientViewSettings`.
//
// Backfill (owner, 2026-09-28), from the variant `mode` points at:
//   - no such variant stored → NULL (code default);
//   - SETTLEMENT → its hidden set verbatim;
//   - OFFER → its hidden set minus the netto settlement keys, which the offer hid only because there
//     was nothing to settle yet — they now stay hidden by themselves until there is. Brutto and
//     „Pozostało" choices are kept as stored.
// `jsonb_agg` over zero elements is NULL, so the OFFER branch coalesces to `'[]'`: an offer that hid
// only settlement keys is a real choice („show everything else"), not „never chosen".
// `IS DISTINCT FROM`, not `<>`: `jsonb_typeof(NULL) <> 'array'` is NULL and would fall through to the
// next branch instead of taking this one.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view"
      ADD COLUMN IF NOT EXISTS "hidden_columns" jsonb,
      ADD COLUMN IF NOT EXISTS "hide_empty_rows" boolean DEFAULT true;

    ALTER TABLE "kosztorys_client_view_defaults"
      ADD COLUMN IF NOT EXISTS "hidden_columns" jsonb,
      ADD COLUMN IF NOT EXISTS "hide_empty_rows" boolean DEFAULT true;

    UPDATE "kosztorys_client_view" AS v SET
      "hidden_columns" = CASE
        WHEN jsonb_typeof(v."variants" -> v."mode"::text -> 'hiddenColumns') IS DISTINCT FROM 'array'
          THEN NULL
        WHEN v."mode" = 'SETTLEMENT'
          THEN v."variants" -> 'SETTLEMENT' -> 'hiddenColumns'
        ELSE COALESCE(
          (SELECT jsonb_agg(k.value)
             FROM jsonb_array_elements(v."variants" -> 'OFFER' -> 'hiddenColumns') AS k
            WHERE k.value NOT IN ('"stageQtySum"', '"stages"', '"stageValueNet"', '"net"', '"donePercent"')),
          '[]'::jsonb)
      END,
      "hide_empty_rows" = (v."variants" -> v."mode"::text -> 'hideEmptyRows') IS DISTINCT FROM 'false'::jsonb;

    UPDATE "kosztorys_client_view_defaults" AS v SET
      "hidden_columns" = CASE
        WHEN jsonb_typeof(v."variants" -> v."mode"::text -> 'hiddenColumns') IS DISTINCT FROM 'array'
          THEN NULL
        WHEN v."mode" = 'SETTLEMENT'
          THEN v."variants" -> 'SETTLEMENT' -> 'hiddenColumns'
        ELSE COALESCE(
          (SELECT jsonb_agg(k.value)
             FROM jsonb_array_elements(v."variants" -> 'OFFER' -> 'hiddenColumns') AS k
            WHERE k.value NOT IN ('"stageQtySum"', '"stages"', '"stageValueNet"', '"net"', '"donePercent"')),
          '[]'::jsonb)
      END,
      "hide_empty_rows" = (v."variants" -> v."mode"::text -> 'hideEmptyRows') IS DISTINCT FROM 'false'::jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "kosztorys_client_view"
      DROP COLUMN IF EXISTS "hidden_columns",
      DROP COLUMN IF EXISTS "hide_empty_rows";

    ALTER TABLE "kosztorys_client_view_defaults"
      DROP COLUMN IF EXISTS "hidden_columns",
      DROP COLUMN IF EXISTS "hide_empty_rows";
  `)
}
