# Daily snapshot change detection Implementation Plan

## Overview

The nightly `daily` capture stores a full copy of the tree whenever the new payload differs from the
previous `daily` row. It compares raw payloads, so a key that a deploy adds to the serialized tree
counts as a change and writes a copy for nearly every open investment. Compare the two payloads as
the investor's history reads them instead. EX-1076, step 1.

## Current State Analysis

- `captureDailySnapshot` (`src/lib/kosztorys/capture-daily-snapshots.ts:21`) runs `isDeepStrictEqual`
  on the JSON-normalized new payload against the stored `previous.payload`.
- Prod, 2026-10-18: of 448 non-first `daily` rows, 268 (63 of 116 MB) only add keys the previous row
  lacked (`cur @> prev`). The spikes match field-adding merges: `ref`, `aiPlannedQty`/`reviewStatus`/
  `currentPlannedQty`, `catalogueItemId`, etap `completed`, `aiRecheck`/`aiNewInformation`, and the
  stage `workerId` → `split` shape.
- A reader already turns any stored payload into a full tree with the column defaults:
  `snapshotToTree` (`src/lib/kosztorys/history/snapshot-to-tree.ts:9`), built on
  `itemWithColumnDefaults` / `storedStageSplit` / `aiDraftOf` / `toDescriptionTranslations`.
  „Historia zmian" renders every `daily` row through it.

## Desired End State

A `daily` row is stored only when the tree the investor would see for that day differs from the
previous `daily` row's tree. A deploy that adds a field (absent in old rows, at its default now)
stores nothing. A field that gains a real non-default value is still a change.

### Key Discoveries:

- `snapshotToTree(payload, live)` falls back to `live` for absent `settings` / `globalDiscount`. Pass
  the same live tree on both sides so the fallbacks cancel out.
- `snapshotToTree` spreads `...live`. Both sides get the same extra fields, so they are equal.
- Every `daily` row carries `globalDiscount` (written by `serializeTree`), so the `live` fallback can't
  mask a rabat change.

## What We're NOT Doing

- No deleting or rewriting of the existing spurious `daily` rows. They are investor history, and a
  backfill is a separate, explicitly approved data migration (EX-1076).
- No change to the `auto` / `manual` / `named` capture, retention, or the payload format.
- No `SNAPSHOT_SCHEMA_VERSION` bump.

## Implementation Approach

Normalize both sides through `snapshotToTree` against the current tree, JSON-round-trip both (drops
`undefined` keys), and compare with `isDeepStrictEqual`. Extract that as a pure, exported predicate so
the edge cases get node unit tests. Keep one DB case for the persisted outcome.

## Phase 1: Compare through the history reader

### Overview

Test-first: the failing cases are a previous row missing deploy-added keys (must be `unchanged`) and
a previous row missing a key whose current value is non-default (must be `stored`).

### Changes Required:

#### 1. Daily capture comparison

**File**: `src/lib/kosztorys/capture-daily-snapshots.ts`

**Intent**: Replace the raw-payload comparison with one over the trees both payloads render as, so a
key that only exists in the newer payload at its default value is not a change.

**Contract**: a new exported pure predicate
`sameDailyState(previous: StoredSnapshotPayloadT, current: KosztorysSnapshotPayloadT, live: KosztorysTreeT): boolean`,
used by `captureDailySnapshot` in place of the inline `isDeepStrictEqual`. `live` is the tree just
built by `buildKosztorysTree`.

#### 2. Unit tests

**File**: `src/__tests__/lib/kosztorys/capture-daily-snapshots.test.ts` (new, node)

**Intent**: Cover the predicate's cases. Use the `kosztorys-history` helpers.

- identical payloads → same
- a previous payload missing item keys a deploy added (`aiRecheck`, `catalogueItemId`, `ref`,
  `currentPlannedQty`), stage `completed`, and with a legacy `workerId` stage instead of `split` → same
- a previous payload missing a key whose current value is non-default (e.g. `catalogueItemId: 5`) → differs
- a real edit (`plannedQty`) → differs
- a rabat change → differs

#### 3. DB regression case

**File**: `src/__tests__/lib/kosztorys/capture-daily-snapshots.db.test.ts`

**Intent**: Assert persisted state. Seed a previous `daily` row whose payload lacks the deploy-added
keys, run `captureDailySnapshot` for the next day, and expect `'unchanged'` with still exactly one
`daily` row.

### Success Criteria:

#### Automated Verification:

- Unit spec passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/capture-daily-snapshots.test.ts`
- DB spec passes against 5435: `set -a; . ./.env; set +a; DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec vitest run src/__tests__/lib/kosztorys/capture-daily-snapshots.db.test.ts`
- History reader spec still passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/history/snapshot-to-tree.test.ts`

#### Manual Verification:

- After the first production night following a deploy that adds an item field, the `daily-snapshots` cron stores roughly
  the number of investments actually edited that day, not ~50–80 (prod read-only:
  `SELECT count(*) FROM kosztorys_snapshots WHERE kind='daily' AND taken_at::date = <day>`).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

## Testing Strategy

### Unit Tests:

- The predicate cases listed in Phase 1 §2.

### Integration Tests:

- The DB case in Phase 1 §3. The existing flow test (store / unchanged / store after edit) must stay
  green.

## Performance Considerations

`snapshotToTree` runs twice per open investment per night (~100 trees, sequential). This is cheap
next to `buildKosztorysTree`.

## Whole-tree Gate

Run once, after the final phase:

- Type checking passes: `pnpm typecheck`
- Lint passes: `pnpm lint`

## References

- Linear: EX-1076 (step 0a + analysis comment, 2026-10-18)
- Reader: `src/lib/kosztorys/history/snapshot-to-tree.ts:9`
- Defaults: `src/lib/kosztorys/snapshot-format.ts:116`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Compare through the history reader

#### Automated

- [x] 1.1 Unit spec passes — b20c4cb8
- [x] 1.2 DB spec passes against 5435 — b20c4cb8
- [x] 1.3 History reader spec still passes — b20c4cb8
