# Harden bulk-INSERT restore — ORDINALITY id-mapping + owed tests — Implementation Plan

## Overview

`restoreKosztorys` reverts an investment's whole kosztorys to a serialized snapshot via wipe →
bulk re-insert → settings rewrite. The re-insert (`insert-kosztorys-tree.ts` composing the two
primitives in `insert-rows.ts`) issues **one `INSERT … RETURNING id` per level** and maps old→new ids
**by array position**, relying on Postgres returning `RETURNING` rows in `VALUES` order. That holds for
a plain INSERT today but is not SQL-guaranteed; if it ever broke, child FKs would remap to the **wrong
parents silently** — the worst failure mode for a restore. This change removes that reliance and pays
down the owed test debt from the S-06 review gate.

## Current State Analysis

- `insertSections` / `insertItems` (`src/lib/kosztorys/insert-rows.ts`) each build per-row `VALUES`
  tuples, run one `INSERT … RETURNING id`, and return `res.rows.map(r => Number(r.id))` — new ids **in
  input order**. Callers (`insert-kosztorys-tree.ts:29,38`) zip that array back to inputs positionally.
- The stages insert is inline in `insert-kosztorys-tree.ts:43-50`, same positional-zip pattern
  (`res.rows.forEach((row, i) => stageIdMap.set(stages[i].id, …))`).
- The progress insert (`insert-kosztorys-tree.ts:56-64`) does **not** RETURN or remap ids — no change
  needed there.
- **Three callers** share the two primitives, so one fix hardens all: `restoreKosztorys`,
  `applyPreset` (via `insertKosztorysTree`), and `appendPresetSections` (calls `insertSections` /
  `insertItems` directly, same positional zip at `append-preset-sections.ts:37-48`).
- Each row already carries a **batch-unique natural key**: sections → `displayOrder` (unique per
  investment); items → `(sectionId, displayOrder)` (displayOrder unique per section); stages →
  `ordinal` (unique per investment). This is the key that makes the natural-key remap safe.
- Existing coverage: `serialize-restore-roundtrip.test.ts` (real-DB identity roundtrip, small tree) +
  `kosztorys-restore.test.ts` (restore action) — both in the pre-push integration gate. Neither
  asserts rollback-on-error, wide field coverage, or column↔schema alignment.
- Sibling EX-432 (serialize 5000-item truncation → fail-loud guard) is **Done**, so the
  parameter-limit "save-but-fail-to-restore" interaction the ticket flagged is already neutralized.

## Desired End State

Old→new id mapping in all three insert paths keys off each row's natural key returned by `RETURNING`,
not its array position — so a future `RETURNING` reorder (partitioning, `INSERT … SELECT`) can never
silently misparent children. Three new/widened tests guard the restore path: rollback-on-error,
wide-field roundtrip, and a schema-drift guard. All run green in the pre-push integration gate.

### Key Discoveries:

- Natural-key remap needs **no typed-array unnest** — the current `VALUES`-tuple SQL stays; only the
  `RETURNING` list and the JS mapping change (`insert-rows.ts:44-46`, `63-71`).
- `insertKosztorysTree` already resolves item rows to their final `sectionId` before insert
  (`insert-kosztorys-tree.ts:33-37`), so `(sectionId, displayOrder)` is available on both the input
  side and the `RETURNING` side for the join.
- The restore roundtrip test already drives a real transaction (`beginTransaction` →
  `restoreKosztorys` → `commit`/`rollback`, roundtrip test lines 209-222) — the rollback test reuses
  that harness shape.

## What We're NOT Doing

- **No chunked inserts / parameter-limit fix.** ~3,855-item ceiling, ~10× headroom, EX-432 removed the
  ugly interaction. Documented-only, deferred by design (per ticket + owner 2026-07-11).
- **No snapshot validation layer** and **no re-adding suppressed hooks** — both accepted bypasses.
- **No change to the progress insert** — it never remaps ids.
- **No API/UX changes** — this is pure internal hardening + tests.

## Implementation Approach

Phase 1 changes the id-mapping mechanism in the two primitives and the inline stages insert to
natural-key remap, guarded by an in-batch uniqueness assertion. The existing roundtrip + restore-action
tests already exercise all three callers and act as the regression net for the refactor. Phases 2-4 add
the three owed tests. Phases are independent after Phase 1 and can land in one session.

## Phase 1: Natural-key id-mapping

### Overview

Replace positional old→new id mapping with natural-key mapping in `insertSections`, `insertItems`, and
the inline stages insert, so a `RETURNING` reorder can never misparent children.

### Changes Required:

#### 1. Section + item insert primitives

**File**: `src/lib/kosztorys/insert-rows.ts`

**Intent**: Stop returning a bare positional id array. Return each new id paired with its row's natural
key so callers map by key, not position. Add an assertion that the natural key is unique within the
batch (defensive tripwire — should always hold given how callers build rows).

**Contract**: `insertSections` → `RETURNING id, display_order`, returns `Map<number /*displayOrder*/,
number /*id*/>` (or `{ displayOrder, id }[]`). `insertItems` → `RETURNING id, section_id, display_order`,
returns a lookup keyed by `(sectionId, displayOrder)`. Update the leading comment block (currently
asserts "Postgres returns RETURNING rows in VALUES order") to describe the natural-key contract. Both
callers (`insert-kosztorys-tree.ts`, `append-preset-sections.ts`) must be updated in lockstep — see
changes 3 & 4.

#### 2. Inline stages insert

**File**: `src/lib/kosztorys/insert-kosztorys-tree.ts` (lines 42-50)

**Intent**: Same natural-key remap for stages, keyed by `ordinal`.

**Contract**: `RETURNING id, ordinal`; build `stageIdMap` by matching each returned `ordinal` back to
the source stage's `id`, not by loop index.

#### 3. insertKosztorysTree remap sites

**File**: `src/lib/kosztorys/insert-kosztorys-tree.ts` (lines 24-38)

**Intent**: Consume the new key-based return shapes from change 1 to build `sectionIdMap` /
`itemIdMap`.

**Contract**: `sectionIdMap`: old section id → new id via the section's `displayOrder`. `itemIdMap`: old
item id → new id via `(resolvedSectionId, displayOrder)`. Behavior identical; only the join key changes.

#### 4. appendPresetSections remap sites

**File**: `src/lib/kosztorys/append-preset-sections.ts` (lines 37-48)

**Intent**: Same consumption update; remove the stale "Postgres returns RETURNING rows in VALUES order"
comment (line 20).

**Contract**: Map new section/item ids by natural key. Note the section-level `displayOrder` offset the
append applies (`base + i`) is the key value written **and** returned, so it joins cleanly.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Roundtrip identity test passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`
- Restore action test passes: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-restore.test.ts`

#### Manual Verification:

- Restore a real seeded kosztorys (`INV=6` seed) in the editor and confirm section/item/stage/progress
  tree is content-identical after an undo-to-snapshot.
- Apply a preset to a blank investment and confirm items land under the correct sections.

---

## Phase 2: Restore rollback-on-error integration test

### Overview

The owed impl-review 🟡 test: a throw mid-reinsert must roll the whole transaction back, never leave the
tree half-wiped. Also the tripwire for a Payload upgrade silently breaking the tx handle in `getDb`.

### Changes Required:

#### 1. Rollback test

**File**: `src/__tests__/lib/kosztorys/restore-rollback.test.ts` (new) — author via `/10x-tdd`.

**Intent**: Seed a known tree, `vi.spyOn` the last insert level (stages or progress) to throw **after**
sections + items are already inserted, run `restoreKosztorys` inside a transaction, catch, rollback,
then assert the **persisted** live tree equals the pre-restore state (not empty, not half-inserted).

**Contract**: Real-DB spec gated on `ENV_READY` like the roundtrip test; asserts persisted state via a
re-serialize, per the "assert observable state, not the return value" rule. The spy targets the
`db.execute` for the stages/progress INSERT so the throw lands in the danger window (tree already
wiped, sections+items already reinserted).

### Success Criteria:

#### Automated Verification:

- Test fails first without a fix present / with a deliberately broken rollback, then passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/restore-rollback.test.ts`
- Full kosztorys unit+integration slice green: `pnpm exec vitest run src/__tests__/lib/kosztorys`

#### Manual Verification:

- None (integration-level assertion on persisted DB state is authoritative).

---

## Phase 3: Wide-field-coverage roundtrip

### Overview

Widen column-mapping coverage so the natural-key remap and every column tuple are exercised across
nulls, all discount/cost-variant/override combos, and unicode notes.

### Changes Required:

#### 1. Wide-field roundtrip case

**File**: `src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts` (extend)

**Intent**: Add a second tree (or parametrize the existing one) covering: null vs set for every nullable
column; `discountType` percent/amount/none; `costVariant` w_tools/own_tools; w/own tools override
type+value combos; unicode + newline in `note`/`description`; a section with both coeffs null and one
with both set.

**Contract**: Reuse the existing `canonical()` comparison — restore(serialize()) stays a content+order
identity with fresh ids across the widened data.

### Success Criteria:

#### Automated Verification:

- Widened roundtrip passes: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`

#### Manual Verification:

- None.

---

## Phase 4: Schema-drift guard

### Overview

A test asserting each INSERT's column list matches the table's real columns, so an added column fails
loudly instead of silently dropping data on restore.

### Changes Required:

#### 1. Column↔schema alignment test

**File**: `src/__tests__/lib/kosztorys/insert-schema-drift.test.ts` (new)

**Intent**: For `kosztorys_sections`, `kosztorys_items`, `kosztorys_stages`, `stage_progress`, query
`information_schema.columns` and assert the set of columns the inserts write equals the set of
non-auto-managed columns (excluding `id`, `created_at`, `updated_at`, and any DB-defaulted column). A
new column that snapshots should carry then fails this test until the insert list is updated.

**Contract**: Real-DB spec gated on `ENV_READY`. The "columns the insert writes" side is the source of
truth — declared as a per-table constant in the test (mirroring the INSERT column lists), compared to
the live schema minus the documented auto/defaulted exclusion set. Exclusions are enumerated
explicitly so an unexpected new column surfaces rather than hides.

### Success Criteria:

#### Automated Verification:

- Schema-drift guard passes against current schema: `pnpm exec vitest run src/__tests__/lib/kosztorys/insert-schema-drift.test.ts`
- Guard demonstrably fails when a column is removed from an insert list (verify once during authoring).

#### Manual Verification:

- None.

---

## Testing Strategy

### Unit / Integration Tests:

- Phase 1 refactor is covered by the **existing** roundtrip + restore-action tests (regression net).
- Phase 2: rollback-on-error (new) — the owed S-06 debt; guards atomicity + tx-handle integrity.
- Phase 3: wide-field roundtrip (extend existing) — column-mapping breadth.
- Phase 4: schema-drift guard (new) — fail-loud on additive schema changes.

### Manual Testing Steps:

1. Seed `INV=6`, edit the kosztorys, capture then restore a snapshot — confirm identical tree.
2. Apply a preset to a blank investment — confirm items sit under correct sections.

## Performance Considerations

Natural-key remap adds one extra returned column per insert and an in-memory map build — negligible
against the existing single-round-trip-per-level design; the ~216ms/3030-row restore profile is
unaffected.

## Migration Notes

None — no schema change, no data migration. Kosztorys data is throwaway pre-dogfooding, and this change
touches only code paths, not stored rows.

## References

- Ticket: EX-430; related EX-432 (Done)
- Change identity: `context/changes/ex-430-harden-bulk-insert-restore/change.md`
- Primitives: `src/lib/kosztorys/insert-rows.ts`, `src/lib/kosztorys/insert-kosztorys-tree.ts`
- Callers: `src/lib/kosztorys/restore-kosztorys.ts`, `apply-preset.ts`, `append-preset-sections.ts`
- Existing tests: `src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`,
  `src/__tests__/lib/actions/kosztorys-restore.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Natural-key id-mapping

#### Automated

- [ ] 1.1 Type checking passes: `pnpm typecheck`
- [ ] 1.2 Linting passes: `pnpm lint`
- [ ] 1.3 Roundtrip identity test passes
- [ ] 1.4 Restore action test passes

### Phase 2: Restore rollback-on-error integration test

#### Automated

- [ ] 2.1 Rollback test red-then-green
- [ ] 2.2 Kosztorys unit+integration slice green

### Phase 3: Wide-field-coverage roundtrip

#### Automated

- [ ] 3.1 Widened roundtrip passes

### Phase 4: Schema-drift guard

#### Automated

- [ ] 4.1 Schema-drift guard passes against current schema
- [ ] 4.2 Guard demonstrably fails when a column is dropped from an insert list
