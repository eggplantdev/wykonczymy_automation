# AI kosztorys later rounds — Implementation Plan

## Overview

An investment the AI already analysed gets new information from the client (a projekt wykonawczy,
a list of extras). A round re-measures it, and every pozycja whose AI przedmiar changes for a reason
gets an appended „Runda N” block in a new AI field „Nowe informacje” and a raised „Do ponownego
sprawdzenia” flag. The owner sees the flag above his Status; picking any Status (or typing a
Przedmiar) lowers it. The loaders get a round mode, and the pipeline scripts get what #190 round 2
needs: a per-round record kept outside the repo, a round mode in `fill-case-prod.ts`, and a collect
that skips Powody already handed over. Linear: EX-1057.

## Current State Analysis

- Pozycja AI fields: `aiPlannedQty`, `aiMissingData`, `aiAssumptions` (`src/collections/kosztorys-items.ts:65-86`),
  closed to REST by field access; every app write goes through the Local API, which runs with
  `overrideAccess`, so the access setting governs REST only.
- Status is stored (`review_status`) or derived (`review-status.ts:24-30`). `applyReviewRules`
  (`review-status.ts:41-67`) binds Status ↔ Przedmiar but acts only when the stored status changes —
  so a same-value pick writes nothing, and re-picking „Zaakceptowana” never refreshes Przedmiar.
- Every pozycja copy names its columns: the raw INSERT (`insert-rows.ts:21-46,134`, guarded by
  `insert-schema-drift.test.ts`), tree read (`db/kosztorys-tree.ts:77,211-215`), snapshot restore
  (`snapshot-format.ts:121-135,188-192`), preset (`serialize-preset.ts:28-40`), sheet re-import
  (`build-import-plan.ts:239-242`), blank builders.
- Two existing gaps (research §2): the preset keeps Komentarz AI; a sheet re-import erases it.
  Both come from `aiMissingData?` / `aiAssumptions?` being optional in `KosztorysItemT`.
- Rows rest at one line (`row-height.ts`, 32 px); the Status column is excluded from content
  measurement (`row-content-lines.ts:10`).
- The loaders (`src/scripts/load-ai-draft.ts`, `…/scripts/load-draft-sql-prod.ts`) are round-1 only:
  they zero every pozycja missing from the draft and replace Komentarz AI.
- `adopt-case-prod.ts` refuses an existing `case.json`; `fill-case-prod.ts` renames „Łazienka”
  unconditionally when needed; `collect-reasons-prod.ts` lists every Powód on a `review_done` investment.

## Desired End State

- A round run on #190 (case `05-ursynow-61m2`) writes only the pozycje its draft names: their AI
  przedmiar moves, „Nowe informacje” gains one block, the flag rises; nothing else on the kosztorys
  changes, owner fields included.
- In the editor (Przegląd AI) a flagged pozycja shows „Do ponownego sprawdzenia” above its Status on
  a two-line row, „Nowe informacje” sits after Komentarz AI, and Problemy has „do ponownego
  sprawdzenia” with a count. Any Status pick or typed Przedmiar lowers the flag; undo raises it back.
  Re-picking „Zaakceptowana” on a flagged pozycja copies the new AI przedmiar.
- Restore, szablon, re-import and add-pozycja carry the new fields correctly, and Komentarz AI no
  longer leaks into a szablon or vanishes on re-import.
- The old change's „Later rounds” section is a runbook a fresh session can follow.

### Key Discoveries:

- `CellSelectMenu` fires on every pick, the current value included (`cell-select-menu.tsx:47`) — the
  no-op comes from the diff, so the cell can make a same-value pick count by lowering the flag in the
  row it sets.
- `itemPatchSchema` is the owner-writable boundary (`item-patch-schema.ts:13-39`); `ITEM_FIELDS`
  (`v2-rows.ts:6-22`) drives diff, per-field lanes, undo and revert.
- Bound NULL skips a column DEFAULT (`snapshot-format.ts:150-152`) — the flag binds `?? false`.
- The Local API ignores field access by default, so the flag can stay closed to REST like its
  siblings while the grid lowers it through `updateItemFieldAction`.

## What We're NOT Doing

- No server-side rule that lowers the flag on a Status save — see Critical Implementation Details.
- No full-history-on-click for „Nowe informacje” (owner: wait for #190 to show whether it's needed).
- No automatic Etap AI change from flags; the round loader sets `analyzed`, as round 1 does.
- No retroactive round record for round 1 beyond the bootstrap from `case.json` +
  `inputs/client-inquiry.md`.
- No knowledge-extraction automation, and no skip record in `collect-reasons-prod.ts` — cut for
  safety-over-polish; already-lifted Powody are skipped by hand.
- Not untracking the 31 already-committed szablon/knowledge dumps.
- No E2E authored here (see Testing Strategy).

## Implementation Approach

Schema and every copy path first, with the type made strict so the compiler finds the builders.
Then the editor, whose rules live in `applyReviewRules` (pure, unit-tested) and whose one cell-level
behaviour (same-value pick) gets a DOM spec. Then the loaders, sharing a small pure round module in
`src/lib/kosztorys/`. The pipeline scripts last, because they only feed the loaders.

## Critical Implementation Details

**Safety over polish (owner, 2026-10-14: the feature is still in testing).** Every new branch is
gated on `aiRecheck = true`. The column defaults to `false`, so every existing pozycja — every
non-AI kosztorys and every AI kosztorys before its first round — takes exactly today's code path.
Existing spec assertions are not edited, only added to; an existing assertion that needs changing
is a stop-and-ask, not a fix. Where polish and safety conflict, the plan takes the smaller change.

**Undo decides where the flag is lowered.** The flag is lowered in the row on the client, and only
there: Status, flag and Przedmiar go out as separate per-field writes in one undo batch, exactly like
Status + Przedmiar today. A server rule („a Status patch also clears the flag”) would fire again when
undo writes the previous Status back, racing the separate flag-revert lane — undo could leave the
flag down. For the same reason the patch schema accepts `aiRecheck` as a boolean, not
`literal(false)`: undo writes `true` back. The grid has no control that raises it.

**The flag floor applies only where the Status column is rendered.** The client preview `/k/<token>`
and the worker view never show AI columns; a flagged row must not grow there. An owner's dragged
row height still wins, as for every other row — the Problemy entry is what keeps a flattened flagged
row findable.

**A round is not idempotent by itself.** Re-running a loader would append the same block twice. The
loader refuses a round whose `Runda N` block already sits on any pozycja of the investment.

## Phase 1: Fields and copy paths

### Overview

Two new columns, the strict item type, every copy path, and the two existing Komentarz AI bugs.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261014_4_add_kosztorys_item_ai_round.ts` (+ entry in `src/migrations/index.ts`)

**Intent**: Additive columns for the round fields, hand-written like `20261014_2_add_investment_ai_notes.ts`.

**Contract**: `ALTER TABLE kosztorys_items ADD COLUMN IF NOT EXISTS ai_new_information varchar,
ADD COLUMN IF NOT EXISTS ai_recheck boolean NOT NULL DEFAULT false`; `down` drops both. Header
comment: additive → migrate prod before pushing.

#### 2. Collection

**File**: `src/collections/kosztorys-items.ts`

**Intent**: Declare both fields beside the other AI fields, closed to REST like them.

**Contract**: `aiNewInformation` — `textarea`, label pl „Nowe informacje”; `aiRecheck` — `checkbox`,
`defaultValue: false`, label pl „Do ponownego sprawdzenia”. Both `access: { create: () => false,
update: () => false }`. Comment: EX-1057, the AI raises the flag, the grid lowers it through the
action (Local API).

#### 3. Item type and tree read

**Files**: `src/lib/kosztorys/types.ts`, `src/lib/db/kosztorys-tree.ts`

**Intent**: Carry the fields to the editor; make all four AI text/flag fields required so tsc lists
every builder that forgot them.

**Contract**: `KosztorysItemT` gains `aiNewInformation: string | null`, `aiRecheck: boolean`;
`aiMissingData` / `aiAssumptions` become `string | null` (not optional). SELECT + mapper add both
columns (`ai_recheck` mapped with `=== true`).

#### 4. Copy paths

**Files**: `src/lib/kosztorys/insert-rows.ts`, `snapshot-format.ts`, `serialize-preset.ts`,
`sheet-import/build-import-plan.ts`, `item-from-fields.ts`, `work-catalogue/item-to-catalogue.ts`,
`sheet-import/parse-labor-tab.ts`, `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/create-case-local.ts`,
plus whatever else tsc names.

**Intent**: Each path does with the new fields what it does with AI przedmiar; the preset and the
re-import also get Komentarz AI right.

**Contract**:

- INSERT column list + VALUES: both columns; flag bound `?? false`.
- Snapshot: both in `TolerantT`; `itemWithColumnDefaults` defaults `aiMissingData`, `aiAssumptions`,
  `aiNewInformation` to `null` and `aiRecheck` to `false` (old snapshots lack them; no version bump).
- Preset: strips `aiMissingData`, `aiAssumptions`, `aiNewInformation` (→ `null`) and `aiRecheck`
  (→ `false`) — the existing comment („about one job's przedmiar”) covers all of them.
- Re-import: keeps all four from `current` (`?? null` / `?? false`), under the existing „the sheet
  knows nothing of the agent's draft” comment.
- Blank builders: `null` / `false`.

### Success Criteria:

#### Automated Verification:

- `git status src/migrations` shows only this change's migration, then local migrate applies cleanly: `pnpm payload migrate`, and `pnpm db:migrate:test`
- Preset regression (written failing first): `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-apply-preset.test.ts`
- Re-import regression (written failing first): `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts`
- Old snapshot restores with defaults: `pnpm exec vitest run src/__tests__/lib/kosztorys/snapshot-format.test.ts`
- INSERT matches the live schema: `pnpm exec vitest run src/__tests__/lib/kosztorys/insert-schema-drift.test.ts`

#### Manual Verification:

- An AI kosztorys → „Zapisz jako szablon”, then apply that szablon to another investment: no Komentarz AI and no „Nowe informacje” on the applied pozycje.
- An AI kosztorys with Komentarz AI → restore an earlier snapshot: Komentarz AI is still there and no pozycja shows „Do ponownego sprawdzenia”.

---

## Phase 2: Editor

### Overview

Status rules, the flagged Status cell, the „Nowe informacje” column, the row floor, the Problemy entry.

### Changes Required:

#### 1. Owner-writable flag

**Files**: `src/lib/kosztorys/item-patch-schema.ts`, `src/lib/kosztorys/types.ts` (`ItemPatchT`), `src/lib/kosztorys/v2-rows.ts` (`ITEM_FIELDS`)

**Intent**: Let the grid save a lowered flag, and undo save a raised one.

**Contract**: `aiRecheck: z.boolean()` in the patch schema with a comment on why not `literal(false)`
(undo); `aiRecheck` in `ItemPatchT` and `ITEM_FIELDS`.

#### 2. Review rules

**File**: `src/lib/kosztorys/review-status.ts`

**Intent**: Treat a lowered flag as a Status pick, and a typed Przedmiar as lowering the flag.

**Contract**: In `applyReviewRules`, a row is a _Status pick_ when the stored status changed **or**
the flag went from raised to lowered; a pick on an offered pozycja with unchanged Przedmiar keeps
today's writes (Zaakceptowana → AI przedmiar, Odrzucona → 0). A typed Przedmiar re-derives the
status as today and, **only if the flag was raised**, also lowers it — an unflagged row's patch is
byte-for-byte today's. `ReviewFieldsT` gains `aiRecheck`. Update the
„one concept in two columns” comment to name the flag.

#### 3. Status cell

**File**: `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx`

**Intent**: Show „Do ponownego sprawdzenia” (amber) on a first line above the Status menu while the
flag is up; every owner act on the cell lowers it.

**Contract**: `onChange`, `deleteValue` and `pasteValue` all set `aiRecheck: false` in the row they
return. The read-only (disabled) cell shows both lines too. Copy value unchanged.

#### 4. „Nowe informacje” column

**Files**: `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx`,
`src/lib/kosztorys/ai-review-columns.ts`, `src/lib/kosztorys/columns/column-config.ts`,
`src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: A read-only sibling of Komentarz AI, after it, shown wherever the AI review columns are.

**Contract**: id `aiNewInformation` added to `AI_REVIEW_COLUMN_IDS` (right after `aiComment`); label
„Nowe informacje” in `column-config.ts`; `disabled: true`, `ReadOnlyCellText` (newlines kept),
`copyValue` = the text, AI column class, width like Komentarz AI. Its presence in
`AI_REVIEW_COLUMN_IDS` puts it into Przegląd AI, Oferta + Przegląd AI, the hidden defaults and the
AI problems' revealed columns without further wiring — check each of those consumers picks it up.

#### 5. Row floor for a flagged pozycja

**Files**: `src/lib/kosztorys/row-height.ts`, `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Intent**: A flagged row rests at two lines where the Status column is rendered.

**Contract**: `resolveRowHeight` takes an **optional** `minLines` floor applied to the resting and
the content-sized height, never over a drag; omitted, the result is today's. The body passes
`minLines: 2` for a flagged row only when not in preview and the `reviewStatus` column is among the
rendered columns — every other row passes nothing.

#### 6. Problemy entry

**File**: `src/lib/kosztorys/row-conditions/registry.ts`

**Intent**: One click lists what the round changed.

**Contract**: New condition `ai-recheck`, label „do ponownego sprawdzenia”, `kind: 'diagnostic'`,
`problemGroup: 'ai-review'`, `revealsColumns: AI_REVIEW_COLUMN_IDS`, matches
`ctx.hasAiDraft && row.aiRecheck`. Placed before `ai-to-review`.

### Success Criteria:

#### Automated Verification:

- Rules: `pnpm exec vitest run src/__tests__/lib/kosztorys/review-status.test.ts` — re-pick of the stored Zaakceptowana on a flagged row copies the new AI przedmiar and lowers the flag; any pick lowers it; typed Przedmiar lowers it; an unflagged same-value pick still yields no change
- Patch schema: `pnpm exec vitest run src/__tests__/lib/kosztorys/item-patch-schema.test.ts`
- Row floor: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-height.test.ts`
- Condition: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/ai-review-conditions.test.ts`
- Status cell, same-value pick on a flagged row sets the flag down: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/cells/ai-review-columns-status.test.tsx`
- Column ids/labels: `pnpm exec vitest run src/__tests__/lib/kosztorys/ai-review-columns.test.ts`

#### Manual Verification:

- Non-regression, non-AI kosztorys: edit a Przedmiar, a cena, add and delete a pozycja, undo — all as before, row heights unchanged, no new column in the default view.
- Non-regression, AI kosztorys with no round loaded: Status picks (Zaakceptowana / Odrzucona / Zmieniona), a typed Przedmiar and undo behave exactly as before; Problemy shows no „do ponownego sprawdzenia”.
- AI kosztorys with a flagged pozycja (Phase 3's local round) → Przegląd AI: the row is two lines, „Do ponownego sprawdzenia” above the previous Status; „Nowe informacje” after Komentarz AI shows the „Runda N” block.
- Flagged pozycja stored as Zaakceptowana → pick Zaakceptowana again: the flag goes, Przedmiar becomes the new AI przedmiar, the row shrinks; reload — still so. Ctrl+Z: flag and old Przedmiar come back.
- Flagged pozycja → type a Przedmiar: the flag goes and the Status follows the typed number.
- Problemy → „do ponownego sprawdzenia”: count matches the flagged rows; clicking filters to them.
- Client preview of the same kosztorys: no row is taller, no AI column shows.

---

## Phase 3: Loader round mode

### Overview

Both loaders learn `ROUND=N`: write only the draft's pozycje, append their block, raise the flag.

### Changes Required:

#### 1. Round module

**File**: `src/lib/kosztorys/ai-round.ts` (new)

**Intent**: The pure rules both loaders share, so they can't drift.

**Contract**: `ROUND_BLOCK_SEPARATOR = '\n\n'`; `appendRoundBlock(existing: string | null, block:
string): string`; `assertRoundDraft(rows, round)` — throws unless every row's `newInformation`
starts with `Runda ${round} — `; `hasRoundBlock(text: string | null, round): boolean` (a block line
starting `Runda ${round} — `), used for the idempotency refusal.

#### 2. Local loader

**File**: `src/scripts/load-ai-draft.ts`

**Intent**: `ROUND=N` mode through the Local API, for the local manual check and local dry runs.

**Contract**: Draft rows gain `newInformation`. With `ROUND` set: validate with `assertRoundDraft`;
refuse if any pozycja already `hasRoundBlock`; matched pozycja → `aiPlannedQty`, appended
`aiNewInformation`, `aiRecheck: true`, nothing else; unmatched → new pozycja (Przedmiar 0) with
`aiPlannedQty`, `aiNewInformation`, `aiRecheck: true`, Komentarz AI empty; pozycje missing from the
draft untouched; `aiStage: 'analyzed'`. Without `ROUND`: today's behaviour. Header documents both.

#### 3. Prod SQL loader

**File**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/load-draft-sql-prod.ts`

**Intent**: Same round mode in the one-transaction SQL.

**Contract**: `ROUND=N` reads `measure/ai-draft-round-<N>.json` (round 1 keeps `kase.draft`). The
UPDATE's VALUES list holds only matched draft rows and sets `ai_planned_qty`,
`ai_new_information = CASE WHEN coalesce(…,'') = '' THEN block ELSE … || E'\n\n' || block END`,
`ai_recheck = true`; INSERT adds both columns. Validation and the idempotency refusal run before
any SQL is written; `DRY=1` still prints the SQL file path.

### Success Criteria:

#### Automated Verification:

- Round module: `pnpm exec vitest run src/__tests__/lib/kosztorys/ai-round.test.ts`
- Prod loader dry run on #190 with a round-2 test draft writes a SQL file naming only the draft's pozycje and only `ai_planned_qty` / `ai_new_information` / `ai_recheck` (+ `ai_stage`): `TOKEN_FILE=… CASE=05-ursynow-61m2 ROUND=2 DRY=1 node --env-file=.env --import tsx …/load-draft-sql-prod.ts`

#### Manual Verification:

- Local AI kosztorys → load a 3-row round-2 draft with `ROUND=2` (one changed pozycja, one taken to 0, one new): only those three show the flag and a block; every other pozycja, and every Przedmiar / Status / Powód zmiany, is unchanged; Etap AI reads „Przeanalizowana”.
- Run the same command again: it refuses before writing anything.

---

## Phase 4: Pipeline scripts and runbook

### Overview

What a round needs around the loader: its inputs and record, sekcje and Uwagi AI, and a collect
that doesn't re-list lifted Powody.

### Changes Required:

#### 1. Round script

**File**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/round-case-prod.ts` (new)

**Intent**: Start a round: work out what is new since the last record, fetch it, hand the agent the
current kosztorys with the owner's verdicts, and save this round's record.

**Contract**: `TOKEN_FILE=… CASE=… ROUND=N [DRY=1]`. Record dir
`~/.local/share/wykonczymy-ai-cases/<CASE>/rounds/` (never the repo — Notatki carry client PII).
Baseline = `rounds/<N-1>.json`, or for N=2 without one, bootstrapped from `case.json` `files` +
`inputs/client-inquiry.md`. Writes into `rounds/<N>/`: `notes.md` (full Notatki), `new-notes.md`
(lines absent from the baseline), `new-files.txt`, and `kosztorys.txt` (per pozycja: sekcja, opis,
j.m., cena, Przedmiar, AI przedmiar, Status, Powód zmiany, Komentarz AI, Nowe informacje); downloads
the new files beside the round-1 ones (same „Do analizy AI” filter as `adopt-case-prod.ts`); saves
`rounds/<N>.json` = `{ round, at, notes, files: [{ name, createdAt }], aiNotes }` (the Uwagi AI the
round will replace). Refuses if `rounds/<N>.json` exists. Read-only against production.

#### 2. `fill-case-prod.ts` round mode

**File**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/fill-case-prod.ts`

**Intent**: Same sekcje and Uwagi AI step for a round, minus the first-round rename.

**Contract**: `ROUND=N` reads `measure/ai-draft-round-<N>.json` and
`investment-notes-appendix-round-<N>.txt`; with `ROUND ≥ 2` the „Łazienka” rename never happens
(every new bathroom is a copy); the Uwagi AI PATCH writes the round's whole current state as today.

#### 3. Runbook

**File**: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md` § „Later rounds”

**Intent**: Turn the decided design into steps a fresh session follows; drop „Still to build”.

**Contract**: Ordered commands for round N (round script → `dump-knowledge-prod.ts` → agent
measures with the record + `kosztorys.txt` → draft `measure/ai-draft-round-<N>.json` + appendix →
`fill-case-prod.ts ROUND=N` → `load-draft-sql-prod.ts ROUND=N` (DRY first, then with the user's
go) → `touch-kosztorys-prod.ts`), the round-draft row shape, and a note that collect still lists
every Powód — Powody already lifted are skipped by hand against `context/ai-knowledge/`.

### Success Criteria:

#### Automated Verification:

- Round script dry run on #190 prints new files / new Notatki lines and writes nothing: `TOKEN_FILE=… CASE=05-ursynow-61m2 ROUND=2 DRY=1 node --import tsx …/round-case-prod.ts`
- `fill-case-prod.ts` dry run with `ROUND=2` reports no rename

#### Manual Verification:

- None beyond the dry runs — production writes happen in the #190 pilot, each with the user's go.

---

## Testing Strategy

### Unit Tests:

- `applyReviewRules` flagged cases (Phase 2); patch schema accepts both booleans; row floor never
  beats a drag; `ai-recheck` condition; `ai-round` append / validate / idempotency.
- Regression first for the two Komentarz AI bugs (preset strip, re-import keep) — test-driven
  debugging, assert the produced item, not a return code.

### Integration Tests:

- `insert-schema-drift.test.ts` against the migrated test DB.

### DOM:

- `ai-review-columns-status.test.tsx`: same-value pick on a flagged row sets `aiRecheck: false`; the
  flagged cell shows „Do ponownego sprawdzenia”.

### E2E:

- Not authored. At the review gate, add the round scenario (flagged pozycja → re-pick → survives a
  reload; undo restores the flag) to the existing E2E backlog issue for the AI review, EX-1015.

## Migration Notes

Additive: `pnpm db:migrate:prod` (a human) **before** the code is pushed. This is the one way the
change can break production for everyone: the tree read SELECTs `ai_new_information` / `ai_recheck`,
so code deployed ahead of the migration fails every kosztorys editor load (Postgres 42703). Locally run `git status src/migrations` first (shared tree).

## Whole-tree Gate

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Unit + DOM suite: `pnpm test`
- DB integration: `pnpm test:integration`
- Financial golden master unchanged: `pnpm test:parity`

## References

- Research: `context/changes/2026-10-14-kosztorys-ai-rounds/research.md`
- Spec: `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md` § „Later rounds”
- Pattern for two columns as one concept: `src/lib/kosztorys/review-status.ts:37-67`
- Click-to-open cell (not used now): `ai-review-columns.tsx:107-154`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Fields and copy paths

#### Automated

- [x] 1.1 Migration applies locally and on the test DB
- [x] 1.2 Preset regression spec passes
- [x] 1.3 Re-import regression spec passes
- [x] 1.4 Snapshot defaults spec passes
- [x] 1.5 Insert schema drift spec passes

### Phase 2: Editor

#### Automated

- [x] 2.1 Review rules spec passes
- [x] 2.2 Patch schema spec passes
- [x] 2.3 Row floor spec passes
- [x] 2.4 AI review conditions spec passes
- [x] 2.5 Status cell DOM spec passes
- [x] 2.6 AI review columns spec passes

### Phase 3: Loader round mode

#### Automated

- [x] 3.1 Round module spec passes
- [x] 3.2 Prod loader round dry run names only draft pozycje and AI columns

### Phase 4: Pipeline scripts and runbook

#### Automated

- [x] 4.1 Round script dry run on #190
- [x] 4.2 fill-case-prod round dry run reports no rename
