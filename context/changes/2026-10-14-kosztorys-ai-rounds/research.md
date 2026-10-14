---
date: 2026-10-14T18:20:00+02:00
researcher: Claude (Opus 5.5)
git_commit: e1198ba3ded16da22677cb89adfc11321d6439f0
branch: main
repository: wykonczymy
topic: 'AI kosztorys later rounds — the app part: „Nowe informacje”, the recheck flag, the Status column, and every reader'
tags: [research, kosztorys, ai-review, review-status, migrations, editor]
status: complete
last_updated: 2026-10-14
last_updated_by: Claude (Opus 5.5)
---

# Research: AI kosztorys later rounds — the app part

**Git Commit**: e1198ba3d · **Branch**: main · Linear: EX-1057

## Research Question

Spec: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md` § „Later rounds”.
(1) Where „Nowe informacje” (append-only text) and the „Do ponownego sprawdzenia” flag go on
`kosztorys_items`, and the migration shape. (2) How the editor's Status column works today (stored vs
derived), how a flag shown above the owner's Status and lowered by any Status pick fits, and where
„Nowe informacje” sits beside Komentarz AI. (3) Every other reader that a flagged pozycja must not break.

## Summary

- **Schema is simple and additive.** Two columns on `kosztorys_items`: `ai_new_information varchar`
  (unbounded, Payload `textarea`, AI-only access like the other AI fields) and
  `ai_recheck boolean NOT NULL DEFAULT false`. One hand-written migration, no snapshot version bump.
- **The plumbing is the work.** Every path that copies a pozycja names its columns, so both fields go
  into the raw INSERT list (`insert-rows.ts`, guarded by a schema-drift spec), the tree SELECT +
  mapper, snapshot restore, preset strip, and the sheet re-import keep-list. Doing this exposed two
  **existing** gaps for Komentarz AI (below).
- **Two behaviours in the editor don't fit the spec as they stand:**
  1. Picking the Status already shown is a no-op today (no diff → no write). Under the spec it must
     lower the flag, so the pick has to change the row.
  2. Picking „Zaakceptowana” copies AI przedmiar into Przedmiar **only when the stored status
     changes**. On a flagged pozycja already stored as accepted, re-picking Zaakceptowana would lower
     the flag but leave the old Przedmiar — the owner would „accept” a number he never got.
- **Nothing outside the editor breaks.** Money figures read no AI field or status; client preview,
  worker view, PDFs, protokół and the sheet sync are closed allowlists. „Etap AI” is a hand-set label
  that nothing derives, so a raised flag means „review not finished” only where we make it so — the
  editor's „do sprawdzenia (szkic AI)” problem is the place.

## Detailed Findings

### 1. Schema and migration

- AI fields today: `src/collections/kosztorys-items.ts:65-86` — `aiPlannedQty` number,
  `aiMissingData` / `aiAssumptions` text, all `access: { create: () => false, update: () => false }`
  (only Local API / raw SQL loaders write them). Only hook: revalidation (`:28-31`).
- Their columns: `20261007_0_add_ai_review_columns.ts:17` (`ai_planned_qty numeric`),
  `20261008_2_add_kosztorys_item_ai_comment.ts:9-10` (`varchar`, unbounded = text).
- Precedent for multi-line AI text: `investments.aiNotes` — `collections/investments.ts:94-96`,
  migration `20261014_2_add_investment_ai_notes.ts:8` (`ai_notes varchar`). Mirror it.
- Latest migration: `20261014_3_move_ai_doubts_to_ai_notes.ts`; registration is a `{ up, down, name }`
  entry at the end of `src/migrations/index.ts`.
- No boolean on `kosztorys_items` today (`hidden_in_export` was dropped in `20260818_0`).
  **Trap:** `insertItems` binds every value, and a bound NULL skips the column DEFAULT
  (`snapshot-format.ts:150-152`) — bind the flag `?? false`.
- **Access for the flag differs from the other AI fields:** the AI raises it, the owner lowers it
  through `updateItemFieldAction`, which runs `payload.update` with access. It can't carry
  `update: () => false`; the narrowing lives in the patch schema instead (see §2).
- Naming: the investment stage `new_information` („Nowe informacje”, `investment-ai-stage.ts:7,42`,
  migration `20261014_1`) already uses the Polish label. The stage means „the client sent more”, the
  column holds what a round changed — related, same words. The column identifier should be distinct
  (`aiNewInformation` / `ai_new_information` vs stage value `new_information`); the UI label clash is
  a question for the owner, not a blocker.

### 2. Copy / serialize paths (all name columns explicitly)

| Path                                                                                | File                                                                                                                                              | Today                                                 | New fields                                                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Raw INSERT (restore, apply preset, append preset, add pozycja, catalogue placement) | `src/lib/kosztorys/insert-rows.ts:21-46,134`                                                                                                      | all 3 AI cols                                         | add both; `insert-schema-drift.test.ts:47-63` fails otherwise               |
| Editor tree read                                                                    | `src/lib/db/kosztorys-tree.ts:77-78,211-215`                                                                                                      | all 3                                                 | add both                                                                    |
| Type                                                                                | `src/lib/kosztorys/types.ts:76-85` (`KosztorysItemT`)                                                                                             | `aiMissingData?` / `aiAssumptions?` optional          | declare **required** so tsc lists every builder                             |
| Snapshot restore                                                                    | `snapshot-format.ts:121-135` (`TolerantT`), `:188-192` (`itemWithColumnDefaults`)                                                                 | defaults only `aiPlannedQty`                          | add both with explicit defaults (`null`, `false`) — old snapshots lack them |
| Preset (szablon)                                                                    | `serialize-preset.ts:28-40`                                                                                                                       | strips `aiPlannedQty`, `changeReason`, `reviewStatus` | strip both                                                                  |
| Sheet re-import                                                                     | `sheet-import/build-import-plan.ts:239-242`                                                                                                       | keeps `aiPlannedQty`, `changeReason`, `reviewStatus`  | keep both (`current?.x ?? …`)                                               |
| Blank builders                                                                      | `item-from-fields.ts:58-60`, `work-catalogue/item-to-catalogue.ts:33-35`, `sheet-import/parse-labor-tab.ts:197-199`, `create-case-local.ts:58-60` | `aiPlannedQty: null`                                  | `null` / `false`                                                            |
| Local loader                                                                        | `src/scripts/load-ai-draft.ts:61-69`                                                                                                              | writes the 3                                          | round mode                                                                  |
| Prod loader                                                                         | `…/scripts/load-draft-sql-prod.ts:79-88`                                                                                                          | names 3 columns                                       | round mode                                                                  |

**Existing gaps found on the same lines (verified):**

- `serialize-preset.ts:35-38` strips `aiPlannedQty` but **not** `aiMissingData` / `aiAssumptions` —
  a szablon made from an AI kosztorys carries one job's Komentarz AI into every investment it lands
  in (with AI przedmiar NULL, so the editor hides the column — a latent leak, not a visible one).
- `build-import-plan.ts:239-242` keeps `aiPlannedQty` but **not** the Komentarz AI pair, and the
  import is wipe-and-reinsert (`actions/kosztorys-import.ts:319` → `restore-kosztorys.ts:34-38`), so
  a sheet re-import erases Komentarz AI on matched pozycje. Inferred from code, not reproduced.

Both are the optional-field miss the type change above prevents; fixing them is a line each in files
this change edits anyway.

Golden master (`financial-golden-master-db.test.ts:180-184`) hashes an explicit `ROW(...)` of price/
discount/override columns — new columns don't move it.

### 3. The editor's Status column

- Column + cell: `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:38-69`
  (`ReviewStatusCell`, `reviewStatusColumn`, id `reviewStatus`). Pick → `setRowData({...rowData,
reviewStatus})` (`:52`). Values `accepted | rejected | edited | added` (`review-status.ts:3`), labels
  `labels.ts:41-48`, „Do sprawdzenia” = unset.
- Shown value: `effectiveReviewStatus = stored ?? derived` (`review-status.ts:29-30`); derived
  (`:24-27`) = Zaakceptowana when offered and Przedmiar = AI przedmiar, Dodana when not offered and
  Przedmiar > 0. Stored and derived render identically.
- Status ↔ Przedmiar are one concept (`applyReviewRules`, `review-status.ts:41-67`, run at
  `use-kosztorys-editor.ts:1235`): a **changed** status writes the qty (accepted → AI przedmiar,
  rejected → 0); a typed qty re-derives the status (`statusForTypedQty`).
- Write path: `planGridChanges` (`grid-change-plan.ts:25-61`) → one `updateItemFieldAction(id,
{[field]: value})` per field on its own lane (`use-kosztorys-editor.ts:1237-1246`) → zod
  `itemPatchSchema` (`item-patch-schema.ts:13-39`) → `normalizeOverridePatch`
  (`override-patch.ts:24-56`) → `payload.update` (`actions/kosztorys.ts:137-157`).
- `CellSelectMenu` fires on every pick, the current value included (`cell-select-menu.tsx:47`), but
  `applyReviewRules` acts only on `prev.reviewStatus !== row.reviewStatus` and `diffRow`
  (`v2-rows.ts:60-64`) finds no field change → **no write**. Exception: a derived-only status
  (stored NULL) writes on pick.

**How the flag fits (design implied by the code):**

- The flag joins `ITEM_FIELDS` (`v2-rows.ts:6-22`), `ItemPatchT` (`types.ts:110-127`) and
  `itemPatchSchema` as `z.literal(false)` — the owner can lower it, never raise it.
- Lowering = a rule in `applyReviewRules`: when the row is flagged and a Status is picked, set the
  flag false. To catch a same-value pick the cell has to put a change into the row (e.g.
  `{...rowData, reviewStatus, aiRecheck: false}`), so `diffRow` sees the flag field.
- The accept rule must also fire on a flagged row whose stored status is unchanged: re-picking
  Zaakceptowana on a flagged row copies the **new** AI przedmiar; re-picking Odrzucona writes 0.
- Atomicity: Status, flag and Przedmiar go out as separate per-field writes in one undo batch — the
  same as Status + Przedmiar today. A server-side normalizer (`reviewStatus` in patch → flag false,
  sibling of `normalizeOverridePatch`) would make the Status write lower the flag on its own; with
  the flag also in the client diff it is belt and braces, and undo/revert work per field for free.
- Cell rendering: „Do ponownego sprawdzenia” above the stored Status means a two-line cell;
  `reviewStatus` is excluded from row-height measurement (`row-content-lines.ts:10`), so the row
  height has to account for it.

### 4. Komentarz AI columns and where „Nowe informacje” goes

- `aiCommentColumn` (`ai-review-columns.tsx:85-99`), id `aiComment`, `disabled: true`, minWidth 320;
  `aiCommentLines` (`lib/kosztorys/ai-review-columns.ts:19-27`) flattens the two fields.
- Long text: `ReadOnlyCellText` with `whitespace-pre-line` (`read-only-cell-text.tsx:31`), clipped by
  row height with an „…” overlay (`kosztorys-editor-body.tsx:625-628`, `globals.css:509`). No popover
  for read-only text; the only click-to-open cell is `WorkNoteCell` (`ai-review-columns.tsx:107-154`,
  button + `GridEventBoundary` + dialog) — the pattern to copy if the full history is needed on click.
- Ids: `AI_REVIEW_COLUMN_IDS` (`lib/kosztorys/ai-review-columns.ts:3-10`), base keys, labels in
  `columns/column-config.ts:54-59`, `DEFAULT_HIDDEN_COLUMNS` `:261`, `LAYER_NEUTRAL_COLUMNS` `:209`,
  cyan styling `AI_REVIEW_COLUMN_CLASS` (`globals.css:548-562`).
- Assembly: `kosztorys-v2-columns.tsx:190-222`, built only when `hasAiDraft`. „Nowe informacje” is a
  sibling of `aiCommentColumn` inserted after it (`:203`), read-only, newlines kept.
- Views: „Przegląd AI” (`use-kosztorys-view-state.ts:67-69,117-122`) and Oferta + Przegląd AI
  (`column-selection.ts:85-89`) both take `AI_REVIEW_COLUMN_IDS` — adding the id there is enough.
- Owner can't edit AI fields on any layer: grid (`disabled` / computed), patch schema (no AI field),
  Payload access. „Nowe informacje” keeps all three; the flag keeps only the grid one (no column of
  its own — it renders inside the Status cell).

### 5. Readers outside the editor grid

| Reader                             | Where                                                                                              | Reads                                             | Impact                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Investments listing „Analiza AI”   | `queries/reference-data.ts:79,143` → `shape-investments.ts:116` → `tables/investments.tsx:124-133` | `ai_stage` column only                            | none; no review count, no auto stage                                                                               |
| Investment page                    | `investments/investment-info-fields.tsx:38-40`, `ai-stage-select.tsx:59-80`                        | `ai_stage`, hand-set                              | none                                                                                                               |
| Stage changes                      | `actions/investments.ts:212-224` (manual), both loaders (`'analyzed'`)                             | —                                                 | the round loader sets `analyzed` as today                                                                          |
| Robocizna v2 / marża / recon       | `db/kosztorys-client-totals.ts:38-53`                                                              | prices, rabat, Σ etapów                           | none (reads no AI field, no status)                                                                                |
| Client preview `/k/<token>`        | `client-view/columns.ts:37`, `column-selection.ts:81`, `client-view/settings.ts:46-73`             | allowlist                                         | fails closed                                                                                                       |
| Worker view                        | `worker-view/columns.ts:18-31`                                                                     | allowlist                                         | fails closed                                                                                                       |
| PDFs                               | `print/offer-columns.ts:111`, `print/worker-columns.ts:76`                                         | allowlists                                        | fails closed                                                                                                       |
| Protokół                           | `acceptance-protocol/scope-rows.ts:16-25`                                                          | opis, j.m., ilość                                 | none                                                                                                               |
| Sheet sync                         | `google/sheet-configs.ts:99`, `actions/sheets-sync.ts:275`                                         | fixed lists, no pozycje                           | none                                                                                                               |
| Editor problems                    | `row-conditions/registry.ts:509-528`                                                               | effective status, Powód                           | **change:** „do sprawdzenia (szkic AI)” should also match a flagged row; today a row with any status never matches |
| `collect-reasons-prod.ts`          | `:16,32`                                                                                           | `aiStage = review_done`, non-empty `changeReason` | a round drops the investment out until re-reviewed; the skip-lifted record is already in the spec                  |
| `itemsOf` (`prod-client.ts:85-90`) | REST depth 1                                                                                       | full docs                                         | new fields arrive automatically                                                                                    |

## Code References

- `src/collections/kosztorys-items.ts:65-93` — AI fields + review fields
- `src/lib/kosztorys/review-status.ts:24-67` — derived status, `applyReviewRules`
- `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:38-99` — Status + Komentarz AI cells
- `src/lib/kosztorys/v2-rows.ts:6-22,60-64` — `ITEM_FIELDS`, `diffRow`
- `src/lib/kosztorys/item-patch-schema.ts:13-39` — owner-writable patch
- `src/lib/actions/kosztorys.ts:137-157` — `updateItemFieldAction`
- `src/lib/kosztorys/insert-rows.ts:21-46,134` — the one raw INSERT
- `src/lib/kosztorys/snapshot-format.ts:121-135,150-152,188-192` — restore defaults
- `src/lib/kosztorys/serialize-preset.ts:28-40`, `sheet-import/build-import-plan.ts:239-242` — the two gaps
- `src/lib/kosztorys/row-conditions/registry.ts:509-528` — AI review problems

## Architecture Insights

- AI-only fields are enforced in three layers (grid, patch schema, Payload access); an owner-lowerable
  AI field (the flag) is the first that crosses layer two in one direction only — `z.literal(false)`
  expresses that without a new mechanism.
- Every pozycja copy names its columns; the drift spec catches the INSERT, but builders and keep-lists
  are caught only by making the field required in `KosztorysItemT`. The Komentarz AI pair being
  optional is exactly how the two existing gaps slipped through.
- „Etap AI” is a label, never computed. The spec keeps it that way (the round sets `analyzed`).

## Historical Context

- `context/foundation/lessons.md:539-551` — a kosztorys tree field isn't done until the raw restore
  INSERT knows it (snapshots, presets).
- `lessons.md:788+` — additive field → no `SNAPSHOT_SCHEMA_VERSION` bump.
- `lessons.md:2583-2590` — `ADD COLUMN IF NOT EXISTS` silently no-ops over a spike column; check `\d`.
- Spec and owner rulings: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md`
  § „Later rounds”.

## Open Questions

1. ~~Typing a Przedmiar on a flagged row~~ — **decided 2026-10-14: yes**, typing a Przedmiar is a
   verdict and lowers the flag, like picking a Status.
2. ~~UI label~~ — **decided 2026-10-14: keep „Nowe informacje”** for both the pozycja column and the
   investment stage.
3. ~~Fix the two existing Komentarz AI gaps?~~ — **decided 2026-10-14: yes**, in this change.
