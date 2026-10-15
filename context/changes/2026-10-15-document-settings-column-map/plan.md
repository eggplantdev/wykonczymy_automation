# Document settings column map Implementation Plan

## Overview

The investor document and the worker document store their column settings as the list of HIDDEN
keys, so a column absent from a stored list is SHOWN. Every new column that should start unticked
therefore needs a migration appending its key to every stored row — three in two days
(`20261008_1`, `20261009_1`, `20261009_2`), and a forgotten one is a disclosure on `/k/<token>` or
every worker link. This change stores `{ key: hidden }` instead and reads a key the map does not
mention as its code default, so a new column starts where the code declares it (EX-1033).

## Current State Analysis

- `sanitizeClientViewSettings` (`src/lib/kosztorys/client-view/settings.ts:57`) and
  `sanitizeWorkerViewSettings` (`src/lib/kosztorys/worker-view/settings.ts:39`) both read
  `hiddenColumns` as an array filtered by the ceiling; a non-array falls back to the default set.
- Writers: `saveClientViewSettingsAction` + `saveClientViewDefaultsAction`
  (`src/lib/actions/kosztorys-client-view.ts`) and `saveWorkerViewSettingsAction`
  (`src/lib/actions/kosztorys-worker-view.ts`) — each stores the sanitizer's output as-is.
- Readers outside the sanitizers consume the resolved `hiddenColumns: string[]` only (dialogs,
  `column-selection.ts`, `print/offer-columns.ts`, `print/worker-columns.ts`, `use-kosztorys-editor.ts`).
- Storage: `hidden_columns` jsonb on `kosztorys_client_view` (34 rows), `kosztorys_client_view_defaults`
  (1) and `kosztorys_worker_view_settings` (1) — local prod copy, 2026-10-15.

## Desired End State

Stored `hiddenColumns` is an object `{ key: boolean }` with one entry per ceiling key known at save
time (pinned `description` excluded). The sanitizers accept that object, read a missing or
non-boolean key as its code default, and still accept the legacy array exactly as today. Every
stored row is converted. Adding a hidden-by-default column to `CLIENT_VIEW_GROUPS` /
`WORKER_VIEW_GROUPS` needs no migration.

### Key Discoveries:

- `sanitizeDocumentRanks` (`src/lib/kosztorys/columns/document-column-order.ts`) is already the shared
  helper both settings modules call for column order — the visibility helper belongs beside it.
- `useHiddenColumns` (`src/components/kosztorys/editor/hooks/use-hidden-columns.ts`) is the existing
  `stored[key] ?? default` precedent.
- The old code reads a non-array as „never chosen" → default hidden set. The default can hide LESS
  than an owner chose (`price` is visible by default), so the conversion must not run before the deploy.
- `push: false` (`src/payload.config.ts:75`) — the column stays `jsonb`; no schema change.

## What We're NOT Doing

- No in-memory type change: `ClientViewSettingsT` / `WorkerViewSettingsT` keep `hiddenColumns: string[]`.
- No dialog, print, link or column-selection change.
- No per-key fallback to the firm-wide investor default: an investment's row still wins as a whole,
  and a key it does not mention reads as the code default (a key new since the row was saved is
  equally absent from the global, so a per-key chain would add a path that changes nothing today).
- No schema migration, no new column, no additive-then-drop.

## Implementation Approach

Change only the two edges: read (stored → resolved hidden list) and write (resolved hidden list →
full map). Everything between them is untouched. Then convert the stored arrays in one data
migration that runs after the deploy.

## Critical Implementation Details

**Deploy ordering.** The migration runs straight AFTER the code deploy, never before: the old code
reads an object as „never chosen" and would serve the code default — wider than an owner's choice
where they hid a default-visible column such as `price`. The new code reads both formats, so the
order is safe in that direction only. Say so in the migration's header comment.

## Phase 1: Read and write the map

### Overview

Both sanitizers accept the map (and still the array); both save paths write the map.

### Changes Required:

#### 1. Shared visibility helpers

**File**: `src/lib/kosztorys/columns/document-column-visibility.ts` (new, beside `document-column-order.ts`)

**Intent**: One resolver and one serializer both settings modules share, so the two documents cannot
drift in how a stored map is read.

**Contract**:

- `resolveHiddenColumns(stored: unknown, ceiling: ReadonlySet<string>, defaultHidden: ReadonlySet<string>): string[] | null`
  — array → today's filter (string, inside the ceiling, not pinned); plain object → every unpinned
  ceiling key whose `stored[key]` is `true`, or is not a boolean and `defaultHidden` has it; anything
  else → `null` (caller falls back to its default settings, as today).
- `toHiddenColumnMap(hidden: readonly string[], ceiling: ReadonlySet<string>): Record<string, boolean>`
  — one entry per unpinned ceiling key.

#### 2. Settings modules

**Files**: `src/lib/kosztorys/client-view/settings.ts`, `src/lib/kosztorys/worker-view/settings.ts`

**Intent**: Sanitizers resolve through the helper; each module exports the stored shape for its writers.

**Contract**: `sanitize*` signatures unchanged. New `toStoredClientViewSettings(settings)` /
`toStoredWorkerViewSettings(settings)` returning the sanitized settings with `hiddenColumns` as the
map. Comments that justify „fails closed because the stored value is the HIDDEN set" are rewritten
to the new contract.

#### 3. Save actions

**Files**: `src/lib/actions/kosztorys-client-view.ts`, `src/lib/actions/kosztorys-worker-view.ts`

**Intent**: The three writes store `toStored*(…)` instead of the sanitized list.

#### 4. Storage comments

**Files**: `src/collections/kosztorys-client-view.ts`, `src/globals/kosztorys-worker-view-settings.ts`

**Intent**: Both say „stores what is HIDDEN, so a column added later is served without rewriting a
row" — that is now the opposite of true; restate the map contract.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/columns/document-column-visibility.test.ts`
  — a key the map does not mention reads as its default (both directions); a legacy array reads as
  today; a key outside the ceiling or `description` never resolves hidden-or-shown from storage;
  map ↔ list roundtrip.
- `pnpm exec vitest run src/__tests__/lib/kosztorys/client-view/settings.test.ts src/__tests__/lib/kosztorys/worker-view/settings.test.ts`
  — a stored map without `plannedDonePercent` / `note` reads them hidden.
- `pnpm exec vitest run src/__tests__/lib/queries/kosztorys-client-view.test.ts` against 5435 — a map
  roundtrips through the real row and global.

#### Manual Verification:

- Investor settings dialog: untick a column, save, reopen — still unticked; the investor preview
  hides it.
- Worker settings dialog: same, and the worker link hides it.

---

## Phase 2: Convert the stored rows

### Overview

One data migration converting every legacy array into the map, against a hard-coded copy of today's
ceilings.

### Changes Required:

#### 1. Migration

**File**: `src/migrations/20261015_0_document_settings_column_map.ts` (+ `index.ts` entry)

**Intent**: `UPDATE … WHERE jsonb_typeof(hidden_columns) = 'array'` on the three tables, building
`{ key: hidden_columns ? key }` over the literal key list of each ceiling. `down` turns a map back into
the array of `true` keys. Idempotent: an object row is left alone.

**Contract**: client ceiling (17 unpinned keys): `note, plannedQty, currentPlannedQty, stageQtySum,
unit, price, discountType, discountValue, discountAmount, plannedNet, currentPlannedNet, net,
remaining, stages, stageValueNet, donePercent, plannedDonePercent`. Worker ceiling (11 unpinned):
`plannedQty, currentPlannedQty, stageQtySum, unit, rate, plannedNetForPlane, net, remainingForPlane,
stages, stageValueNet, plannedDonePercent`. Header comment carries the deploy-ordering rule.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/migrations/20261015_0_document_settings_column_map.test.ts`
  against 5435 — a legacy array row converts to the literal expected map, an object row is untouched,
  `down` restores the array.
- Migration applies to the local dev DB: `pnpm payload migrate` (after `git status src/migrations`).

#### Manual Verification:

- On the local DB, after migrating, one investment with saved settings shows the same investor
  preview columns as before the migration.

---

## Phase 3: Lesson

### Changes Required:

**File**: `context/foundation/lessons.md`

**Intent**: „A stored preference records the DEVIATION" argues for exactly the hidden-set storage
this change replaces. Add the disclosure exception to it — a disclosure setting stores a full
key → choice map and reads an unknown key as its code default, because „show a new column to
everyone who never touched the setting" is a leak there — and cross-link „A disclosure setting
subtracts from a code ceiling, and fails CLOSED".

### Success Criteria:

#### Automated Verification:

- None — prose only.

## Migration Notes

Prod: deploy first, then `pnpm db:migrate:prod` (human). Preview: `pnpm db:migrate:preview` after the
staging deploy. Until it runs, the new code reads the legacy arrays exactly as today.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`

## References

- Linear: EX-1033
- Precedent: `src/components/kosztorys/editor/hooks/use-hidden-columns.ts`
- Prior append migrations: `src/migrations/20261008_1_client_view_note_hidden.ts`, `20261009_1`, `20261009_2`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Read and write the map

#### Automated

- [x] 1.1 document-column-visibility spec passes
- [x] 1.2 client-view and worker-view settings specs pass
- [x] 1.3 kosztorys-client-view query spec passes against 5435

### Phase 2: Convert the stored rows

#### Automated

- [x] 2.1 migration spec passes against 5435
- [x] 2.2 migration applies to the local dev DB

### Phase 3: Lesson

#### Automated

- [x] 3.1 (prose only — no automated check)
