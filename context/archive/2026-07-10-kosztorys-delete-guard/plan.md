# Kosztorys Delete-Guard Implementation Plan

> **SUPERSEDED by EX-477 (2026-07-17).** The hard-block policy below was reversed to
> confirm-then-snapshot. Current truth: `context/changes/kosztorys-delete-confirm/change.md`.
> Kept for history only.

## Overview

Hard-block deleting a kosztorys **item (row)** or **section** that still holds measured/executed
values, mirroring the guard that already protects stage (column) deletion. Today `removeItemAction`
and `removeSectionAction` delete unconditionally and cascade-drop `stage_progress` silently; this
plan closes that data-loss path.

## Current State Analysis

- **Stage delete is already guarded** — `removeStageAction` (`src/lib/actions/kosztorys.ts:278-297`)
  runs a raw-SQL existence check and returns `{ success: false, error: 'Najpierw wyczyść ilości
wpisane w tym etapie' }` when `stage_progress.qty_done <> 0` exists for the stage
  (`kosztorys.ts:284-291`). This is the reference pattern.
- **Item + section deletes are unguarded** — `removeItemAction` (`kosztorys.ts:188-197`) and
  `removeSectionAction` (`kosztorys.ts:147-156`) just call `payload.delete(...)` and revalidate.
- **Cascade data loss is real** — FK `ON DELETE CASCADE`: section → items → `stage_progress`
  (`src/migrations/20260708_2_add_kosztorys_sections_items.ts:27`,
  `20260709_0_add_kosztorys_stages.ts:25-26`). Deleting a populated section silently drops all
  recorded progress for its items. Nothing blocks it.
- **Item/section UI is fire-and-forget** — `handleRemoveItem` (`use-kosztorys-editor.ts:214-228`)
  and `handleRemoveSection` (`:325-332`) mutate local state optimistically and call the action with
  `void` (no result handling). Only `handleRemoveStage` (`:282-299`) awaits + toasts on failure.
- **`ActionResultT`** discriminated union (`src/types/action.ts`) + `protectedAction`
  (`src/lib/actions/run-action.ts:33-62`, auth via `requireAuth(MANAGEMENT_ROLES)`) are the shared
  action contract already in use.
- **Item fields carry the predicate data client-side** — the grid rows hold `measuredQty` (pomiar)
  and per-stage progress, so a client pre-check needs no extra fetch.

### Key Discoveries:

- Guard template: `src/lib/actions/kosztorys.ts:284-291` (SQL existence check + early
  `{ success: false, error }`).
- The stage guard is enforced in the **action only**, not the collection layer, by design
  (`src/collections/kosztorys-stages.ts:5-7`). Follow the same placement.
- Adding a server guard without fixing the UI is a trap: the optimistic handlers would delete the
  row locally and never surface the server's rejection (`use-kosztorys-editor.ts:227,331`).

## Desired End State

- Deleting an item whose `measured_qty <> 0` **or** which has any `stage_progress.qty_done <> 0` is
  rejected server-side with a Polish "clear values first" message; the row remains in the DB.
- Deleting a section that transitively contains any such populated item is rejected the same way.
- The editor blocks the action up front with a toast (no vanish-then-reappear); the server guard is
  the authority behind it.
- Plan-only rows (opis / przedmiar / price, never measured) still delete instantly.
- Stage (column) deletion is unchanged — already guarded.

Verify: unit tests prove persisted state (row/section survives when populated, deletes when not);
browser check shows the toast and the surviving row.

## What We're NOT Doing

- **No role-based visibility / column hiding** — that is S-10 `kosztorys-column-rbac`.
- **No change to `removeStageAction`** — the column/stage case is already covered; its predicate
  (`qty_done <> 0`) is the correct "executed value" check for a stage (stages carry no pomiar).
- **No soft-delete / snapshot-before-delete** — durable recovery is S-06 `kosztorys-snapshots`.
- **No collection-hook or DB-trigger enforcement** — guard lives in the server action, matching the
  existing stage guard's placement.
- **No E2E specs** — browser coverage is band 3 (S-13); this slice stops at unit tests + manual check.
- **No change to the existing ≥1-item-per-section invariant** — it stays as-is.

## Implementation Approach

Two phases, server-first. Phase 1 adds the authoritative SQL guards to the two unguarded actions
and locks them with red-first unit tests that assert persisted state. Phase 2 wires the UI to
pre-check and surface the block cleanly. The predicate is defined once conceptually and implemented
in SQL (server, authority) and mirrored in a small client helper (UX); the plan notes the sync risk.

## Critical Implementation Details

- **Predicate:** an item is "populated" iff `measured_qty <> 0` OR it has a `stage_progress` row with
  `qty_done <> 0`. A section is "populated" iff it contains ≥1 populated item. Numeric columns are
  nullable — use `<> 0` (NULL is not `<> 0`, so NULL/absent counts as empty, which is correct).
- **Predicate lives in two planes** (server SQL + client helper). Per `lessons.md` ("an invariant
  enforced in two planes needs a test on the bridge"), keep the client helper thin and treat the
  server as authority; the client pre-check is only a UX shortcut. A single unit test file owns the
  server predicate; the client helper must not diverge (same field names: `measuredQty`, stage
  progress).

## Phase 1: Server-side delete guards + unit tests

### Overview

Add the populated-check to `removeItemAction` and `removeSectionAction`, returning the existing
`ActionResultT` failure shape. Guarantee behaviour with red-first unit tests against the gated test DB.

### Changes Required:

#### 1. Item delete guard

**File**: `src/lib/actions/kosztorys.ts` (`removeItemAction`, ~`:188`)

**Intent**: Before `payload.delete`, reject if the item is populated (pomiar or recorded progress),
mirroring `removeStageAction`. Return a Polish "clear values first" message.

**Contract**: `removeItemAction(itemId: number): Promise<ActionResultT>` (already returns
`ActionResultT` via `protectedAction`). Add a `getDb(payload)` + `db.execute(sql`…`)` existence
check on `kosztorys_items` joined to `stage_progress`:

```sql
SELECT 1 FROM kosztorys_items i
WHERE i.id = ${itemId}
  AND (i.measured_qty <> 0
       OR EXISTS (SELECT 1 FROM stage_progress sp WHERE sp.item_id = i.id AND sp.qty_done <> 0))
LIMIT 1
```

On a hit: `return { success: false, error: 'Najpierw wyczyść wartości wpisane w tej pozycji' }`.

#### 2. Section delete guard

**File**: `src/lib/actions/kosztorys.ts` (`removeSectionAction`, ~`:147`)

**Intent**: Reject if the section contains any populated item (same predicate, transitive), so a
cascade delete can't silently drop recorded progress.

**Contract**: `removeSectionAction(sectionId: number): Promise<ActionResultT>`. SQL existence check:

```sql
SELECT 1 FROM kosztorys_items i
WHERE i.section_id = ${sectionId}
  AND (i.measured_qty <> 0
       OR EXISTS (SELECT 1 FROM stage_progress sp WHERE sp.item_id = i.id AND sp.qty_done <> 0))
LIMIT 1
```

On a hit: `return { success: false, error: 'Najpierw wyczyść wartości w pozycjach tej sekcji' }`.

#### 3. Unit tests (red first)

**File**: `src/__tests__/lib/actions/kosztorys-delete-guard.test.ts` (new)

**Intent**: Prove the guards via **persisted state**, not the return value — a populated item/section
must still exist in the DB after a blocked delete; an empty one must be gone after a successful
delete. Cover the cascade case (section holding a populated item).

**Contract**: Vitest spec against the gated test DB (follow the existing action-test setup and
`getPayload`/`getDb` patterns in `src/__tests__`). Cases: (a) item with `measured_qty <> 0` →
`success:false` + row still present; (b) item with a `qty_done <> 0` progress row → blocked; (c)
plan-only item (przedmiar/price only) → deletes; (d) section with a populated item → blocked +
section + items still present; (e) empty/plan-only section → deletes. Assert `payload.findByID`
(or a count query) for existence, not just `res.success`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- New guard tests pass: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-delete-guard.test.ts`
- Tests were proven red before the guard code landed (blocked-delete assertion fails without the guard)
- Lint passes: `pnpm lint`

#### Manual Verification:

- (deferred to Phase 2 — server guard has no UI surface on its own)

**Implementation Note**: After Phase 1 automated verification passes, proceed to Phase 2 (the guard
is not user-observable until the UI surfaces it).

---

## Phase 2: UI pre-check + block surfacing

### Overview

Convert the two fire-and-forget optimistic handlers to a client pre-check that blocks a populated
delete with a toast (no optimistic remove), keeping the server guard as the backstop.

### Changes Required:

#### 1. Item remove handler

**File**: `src/components/kosztorys/use-kosztorys-editor.ts` (`handleRemoveItem`, `:214-228`)

**Intent**: Before the optimistic delete, run the client predicate on the row (pomiar + its stage
progress). If populated, toast the block message and return — do not remove locally, do not call the
action. Otherwise keep today's optimistic path, but await the result and revert + toast if the
server rejects (backstop for a client/server predicate drift). Preserve the existing ≥1-item guard.

**Contract**: reuse the same `toastMessage(..., 'warning', 4000)` pattern as `handleRemoveStage`
(`:284-288`). Client predicate reads the row's `measuredQty` and its per-stage progress values
already present in the grid row.

#### 2. Section remove handler

**File**: `src/components/kosztorys/use-kosztorys-editor.ts` (`handleRemoveSection`, `:325-332`)

**Intent**: Before removing, compute the predicate over all rows in that section (`rows` filtered by
`sectionId`). If any is populated, toast + return (skip the `window.confirm` in
`kosztorys-section-summary.tsx`); otherwise proceed, awaiting the result and reverting on rejection.

**Contract**: same toast pattern. The `window.confirm` in
`src/components/kosztorys/kosztorys-section-summary.tsx:111-115` remains for the non-populated path.

#### 3. Client predicate helper

**File**: colocated with the editor hook (or `src/lib/kosztorys/`) — small pure helper

**Intent**: `isRowPopulated(row)` / `isSectionPopulated(rows)` returning boolean from `measuredQty`

- stage progress, so both handlers share one definition and it mirrors the server SQL.

**Contract**: pure function over the grid row shape; no I/O. Field names must match the server
predicate (`measuredQty`, stage `qty_done`).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Lint passes: `pnpm lint`
- Existing kosztorys tests still pass: `pnpm exec vitest run src/__tests__`

#### Manual Verification:

- Deleting a row with a pomiar or recorded progress shows the toast and the row stays (existing test
  kosztorys, dev server per `project_local_login_and_test_fixtures`).
- Deleting a plan-only row (przedmiar/price only, no pomiar) still removes it instantly.
- Deleting a section containing a populated item is blocked with the toast; an empty/plan-only
  section still deletes (after confirm).
- No vanish-then-reappear flicker on a blocked delete.
- Stage (column) delete still blocks on recorded progress (unchanged) — quick regression check.

**Implementation Note**: After Phase 2, pause for manual confirmation before marking the slice
In Review. Manual-check rows go into `context/foundation/manual-checks.md` per the slice convention.

---

## Testing Strategy

### Unit Tests:

- Server guards via persisted state (Phase 1, cases a–e above), red-first.
- Optionally a tiny unit test for the shared client predicate helper (pure function).

### Integration / E2E:

- None this slice — browser coverage is deferred to S-13 (editor-e2e-coverage), per the roadmap and
  the POC "no premature E2E while the editor churns" stance.

### Manual Testing Steps:

1. Open a seeded test kosztorys; add a row, enter a pomiar, try to delete it → blocked toast, row stays.
2. Record stage progress on a row (pomiar 0), try to delete → blocked.
3. Add a plan-only row (przedmiar + price, no pomiar), delete → removed.
4. Try to delete a section holding row (1); blocked. Empty a section, delete → removed.
5. Confirm stage-column delete still blocks on recorded progress.

## Performance Considerations

Each guard is one indexed existence check (`LIMIT 1`) on the delete path — negligible. No change to
read/render paths, so the 1000-row perf profile is untouched.

## Migration Notes

None — no schema change. Purely additive action logic + UI wiring.

## References

- Guard template: `src/lib/actions/kosztorys.ts:284-291` (`removeStageAction`)
- Optimistic-vs-await UI contrast: `src/components/kosztorys/use-kosztorys-editor.ts:214-228` (item),
  `:282-299` (stage, the target pattern), `:325-332` (section)
- Cascade FKs: `src/migrations/20260708_2_add_kosztorys_sections_items.ts:27`,
  `20260709_0_add_kosztorys_stages.ts:25-26`
- Two-plane invariant lesson: `context/foundation/lessons.md` ("an invariant enforced in two planes
  needs a test on the BRIDGE")
- Roadmap slice: `context/foundation/roadmap.md` → S-08 `kosztorys-delete-guard`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Server-side delete guards + unit tests

#### Automated

- [x] 1.1 Type checking passes: `pnpm exec tsc --noEmit` — 2f6bde0
- [x] 1.2 Guard tests pass: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-delete-guard.test.ts` — 2f6bde0
- [x] 1.3 Tests proven red before the guard code landed — 2f6bde0
- [x] 1.4 Lint passes: `pnpm lint` — 2f6bde0

### Phase 2: UI pre-check + block surfacing

#### Automated

- [x] 2.1 Type checking passes: `pnpm exec tsc --noEmit` — eeba07b
- [x] 2.2 Lint passes: `pnpm lint` — eeba07b
- [x] 2.3 Existing kosztorys tests still pass: `pnpm exec vitest run src/__tests__` — eeba07b

#### Manual

- [x] 2.4 Row with pomiar / recorded progress: blocked with toast, row stays — verified 2026-07-10 (manual-checks.md S-08)
- [x] 2.5 Plan-only row (przedmiar/price only): still deletes instantly — verified 2026-07-10
- [x] 2.6 Section with a populated item: blocked; empty/plan-only section still deletes — verified 2026-07-10
- [x] 2.7 No vanish-then-reappear flicker on a blocked delete — verified 2026-07-10
- [x] 2.8 Stage (column) delete still blocks on recorded progress (regression) — verified 2026-07-10
