# Kosztorys Editor — React Compiler Unblock + EX-496 Cleanup Tail — Implementation Plan

## Overview

`src/components/kosztorys/use-kosztorys-editor.ts` (740 lines) emits **zero** `_c` cache slots.
React Compiler bails on three constructs and, because `panicThreshold` defaults to skip-and-continue,
the file leaves the pipeline untransformed with no build error, no lint warning, no console message.
The consequence: `columns`, `columnToggleItems`, `sectionCoeffs`, and ~15 handlers get fresh
identities every render, so every _compiled_ downstream consumer keyed on them
(`kosztorys-toolbar-actions.tsx` `_c(21)`, `DynamicDataSheetGrid`'s `columns`) misses on every
keystroke. This change restores compilation via three surgical fixes, guards it with an automated
compile-assert test so it can never silently regress again, then clears the still-open EX-496 tail.

This is **Change A** of a two-change split of EX-496 + EX-521. Change B (the god-hook decomposition,
EX-521) builds on the compiled + guarded baseline this change establishes.

## Current State Analysis

**The three bails** (all re-verified present on `staging`, 2026-07-17):

1. **Computed key with a call-expression value** — `handleAddStage`, `use-kosztorys-editor.ts:405`:
   `(r) => ({ ...r, [stageKey(id)]: 0 })`. The compiler's HIR lowering won't take a computed key
   whose value is a `CallExpression`. This is the _first_ bail — it masks the two behind it.
2. **Forward reference across function declarations** — `handleRemoveItem` (`:303`) calls
   `handleRemoveSection` (`:312`), which is declared later at `:457`. Function hoisting makes this
   legal at runtime but the compiler bails.
3. **Ref access during render** — `removalPlan` (`:288`) and `getRemovePlan` (`:299`) read
   `stagesRef.current`. `getRemovePlan` is invoked _per cell_ during `buildV2Grid(columnOpts)` at
   render time (`:154`), so this is a render-phase ref read → "Cannot access refs during render".

**The refs** (`rowsRef` `:116-118`, `stagesRef` `:120-122`) are render-mirrored "latest value"
snapshots. The EX-422 note (`:112-115`) records they were introduced to dodge a mount-frozen column
closure that **no longer exists** (the grid is the reactive `DynamicDataSheetGrid` as of `ee497cb`),
kept deliberately as a rollback path. Their necessity is EX-422 / EX-521's question — **not this
change's**. So bail #3's fix is narrow: the render-invoked functions read `stages` (state, in scope);
the refs stay for event-time reads (`handleRenameStage:439`, the event-time `removalPlan` call).

**The EX-422 invariant** — "Handlers never fire an action from inside a `setRows` updater — that would
move the Router during render" (`:72-74`, reiterated `:337-338`). None of this change's edits touch a
`setRows` updater's action-firing, so the invariant is preserved by construction.

**Verified-stale audit findings** (already resolved, out of scope — see `change.md`): sort no-op
(#2, EX-487), coeff/VAT swallow (#3, EX-522), ownership bug (#5, actions derive investment from the
section), dead `kosztorysDoneNetForView` (#8, removed).

**Still-open tail:** 13 `as unknown as ViewPricingT` no-op casts in `kosztorys-v2-columns.tsx`
(`v2-rows.ts:323` passes the same type uncast and compiles — the casts bridge nothing); dead
`widthsKey`/`stagesKey` return keys (`:167-168`, `:708-709`, zero external consumers); a verify on the
missing `investments` cache tag (#4 — the settings actions now carry comments justifying items-only
tags, contradicting the audit's "oversight" read).

### Key Discoveries

- Bail order is sequential: each surfaces only once the prior clears, so the fix is "recompile after
  each" — the automated guard (Phase 1) makes that loop mechanical (`audit.md:172-178`).
- The compiler bail is **silent** by design (`panicThreshold` skip-and-continue) — the only way to
  know compilation is restored is to read the emitted output for `_c(n)`. That is exactly why the
  regression guard must be automated, not a one-time manual check.
- Standalone-compile repro (from `audit.md:61-72`): `@babel/core` is not hoisted under pnpm strict —
  resolve it and `babel-plugin-react-compiler@1.0.0` against the pnpm store; no
  `@babel/preset-typescript` is installed, so parse with `parserOpts: { plugins: ['jsx', 'typescript'] }`.
  **Do not `pnpm add` anything** — per `AGENTS.md` it can swap the native `lightningcss` binary to x64
  on this arm64 machine.
- Two consumer boundaries escape the hook: the ~40-key return object _and_ `columnOpts` →
  `buildV2Grid` (which carries handlers never returned). Bail #3 lives on the second boundary.

## Desired End State

`use-kosztorys-editor.ts` compiles — the standalone compile emits `_c(n)` slots and logs no bail — and
a Vitest test fails the suite if that ever regresses. The 13 no-op casts and the two dead return keys
are gone; finding #4 is either fixed or recorded as a deliberate decision. `settlement.ts` exists as a
real file, `HEADER_TIPS` lives outside the column builder, and the opts bag is `Pick<>`-narrowed. No
behavior change is observable in the editor — this is an identity-stability + cleanup change.

## What We're NOT Doing

- **Not** splitting the hook into sub-hooks — that is Change B (EX-521), which depends on this.
- **Not** removing `rowsRef` / `stagesRef` — their necessity is EX-422 / EX-521's scope. Bail #3 is
  fixed narrowly (render path reads state; refs stay for event-time reads).
- **Not** re-fixing the four already-resolved findings (#2, #3, #5, #8).
- **Not** touching the `setRows`-updater invariant or any handler's action-firing site.

## Implementation Approach

Test-first on the compiler fix: author the compile-assert guard (Phase 1), watch it fail on current
code — that failure _is_ the reproduction of the silent de-opt — then land the three bail fixes
(Phase 2) to green, which doubles as the recompile proof. Cleanup (Phase 3) and structural extractions
(Phase 4) follow, each behind typecheck + the now-green compile guard.

## Critical Implementation Details

**Timing & lifecycle.** Bails are sequential — fixing #1 (stageKey) reveals #2, fixing #2 reveals #3.
Land all three in Phase 2 and let the Phase-1 guard confirm the end state (`_c(n)` present), rather
than trying to assert intermediate bail counts.

**Debug & observability.** The guard test compiles the real hook file through
`babel-plugin-react-compiler` and asserts on the emitted output. It must assert **positively** on
`_c(` presence (compilation happened) — asserting "no bail logged" alone is weaker, because a future
structural change could bail on something new while an unrelated `_c` slot elsewhere masks it. Assert
the hook function itself carries a cache: grep the emitted code for the `useKosztorysEditor` function
body containing `_c(`.

## Phase 1: Compile-Assert Guard (TDD red)

### Overview

Author a Vitest test that compiles `use-kosztorys-editor.ts` through `babel-plugin-react-compiler` and
asserts the emitted output memoizes `useKosztorysEditor` (`_c(n)` present, no bail). It **fails** on
current code — that failure reproduces the silent de-opt and pins the regression.

### Changes Required

#### 1. Compile-assert test

**File**: `src/__tests__/use-kosztorys-editor.compile.test.ts` (new)

**Intent**: Guard against the silent React Compiler bail recurring. Compile the real hook file through
the babel plugin and assert `useKosztorysEditor` is memoized. This is a build-integrity guard, not a
behavior test — it belongs with the code it protects, run in the normal unit suite.

**Contract**: A Vitest test that (a) reads `src/components/kosztorys/use-kosztorys-editor.ts`, (b)
transforms it with `@babel/core` + `babel-plugin-react-compiler@1.0.0`, parsing with
`parserOpts: { plugins: ['jsx', 'typescript'] }`, and (c) asserts the emitted code contains a `_c(`
cache init inside the `useKosztorysEditor` function. Resolve `@babel/core` and the plugin against the
pnpm store (they are not hoisted) — mirror the resolution the audit documents (`audit.md:61-72`).
Capture bail events via the plugin's `logger.logEvent` hook and assert none fired for the hook. On
current code this **fails** (no `_c`, bail at `:405`).

### Success Criteria

#### Automated Verification

- The new test file exists and runs: `pnpm exec vitest run src/__tests__/use-kosztorys-editor.compile.test.ts`
- The test **fails** on current code with a clear message naming the missing `_c` / the bail (red state confirmed before Phase 2)
- Type checking passes: `pnpm typecheck`

#### Manual Verification

- The failure message is legible enough that a future dev who trips it understands "the hook stopped compiling" (not a cryptic babel error)

**Implementation Note**: After this phase, pause for confirmation that the test fails for the _right_
reason (the bail, not a harness/resolution error) before proceeding.

---

## Phase 2: React Compiler Unblock (green)

### Overview

Fix the three bails so the Phase-1 guard passes. Surgical, behavior-preserving edits.

### Changes Required

#### 1. Hoist the computed-key call expression

**File**: `src/components/kosztorys/use-kosztorys-editor.ts` (`handleAddStage`, ~`:398-407`)

**Intent**: Remove bail #1 — a computed object key whose value is a call expression. Compute the stage
key into a `const` above the `patchRows` updater, then use the plain identifier as the computed key.

**Contract**: `const key = stageKey(id)` (or similar) hoisted above the updater; the updater becomes
`(r) => ({ ...r, [key]: 0 })`. Behavior identical.

#### 2. Remove the forward reference

**File**: `src/components/kosztorys/use-kosztorys-editor.ts` (`handleRemoveSection` `:457`, `handleRemoveItem` `:303`)

**Intent**: Remove bail #2 — `handleRemoveItem` calls `handleRemoveSection` declared later. Move
`handleRemoveSection`'s declaration above `handleRemoveItem` so the reference resolves without relying
on hoisting.

**Contract**: `handleRemoveSection` declared before `handleRemoveItem`; no call-site or signature
change. Verify no _other_ function in between depends on declaration order after the move.

#### 3. Narrow the render-phase ref reads to state

**File**: `src/components/kosztorys/use-kosztorys-editor.ts` (`removalPlan` `:288`, `getRemovePlan` `:299`)

**Intent**: Remove bail #3 — render-invoked `getRemovePlan`/`removalPlan` read `stagesRef.current`.
Read `stages` (state, already in scope) instead in these render-path functions. Leave `stagesRef` for
the event-time readers (`handleRenameStage`, the event-time `removalPlan` call from `handleRemoveItem`).

**Contract**: `removalPlan` and `getRemovePlan` reference `stages` rather than `stagesRef.current`.
`stagesRef` declaration and its event-time reads are untouched. Confirm `removalPlan` is reachable from
both a render path (via `getRemovePlan`→`buildV2Grid`) and an event path (via `handleRemoveItem`); if
so, ensure the render path uses `stages` — the event path reading the same `stages` closure is correct
because handlers re-close over fresh state each render (the ref existed only for the vanished
mount-frozen closure).

### Success Criteria

#### Automated Verification

- The Phase-1 compile-assert test **passes**: `pnpm exec vitest run src/__tests__/use-kosztorys-editor.compile.test.ts`
- Full unit suite passes: `pnpm exec vitest run` (no behavior regressions)
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification

- Open the editor: add/remove a stage, add/insert/remove an item, remove a section — all behave exactly as before
- No new console warnings from the grid; the datasheet grid does not visibly re-render more than before

---

## Phase 3: Dead Code + Casts + Cache-Tag Verify

### Overview

Clear the verified-still-open non-structural tail.

### Changes Required

#### 1. Drop dead `widthsKey` / `stagesKey`

**File**: `src/components/kosztorys/use-kosztorys-editor.ts` (`:167-168` build, `:708-709` return)

**Intent**: Remove two write-once, return-only derived keys with zero external consumers (grep
confirmed). `JSON.stringify(widths)` runs every render for no reader.

**Contract**: Delete the two `const` builds and the two return-object keys. Confirm no consumer in
`kosztorys-editor-body.tsx` / the grid destructures them (grep before deleting; gate on typecheck).

#### 2. Remove the 13 no-op `ViewPricingT` casts

**File**: `src/components/kosztorys/kosztorys-v2-columns.tsx` (lines per `audit.md:127-137`)

**Intent**: Remove `as unknown as ViewPricingT` at each site — they disable type checking for nothing
(`v2-rows.ts:323` passes the same type uncast and compiles).

**Contract**: Strip the cast at each occurrence; the expression's inferred type must already satisfy
`ViewPricingT`. Gate on `pnpm typecheck` — if any site genuinely fails to compile without the cast,
that site bridges a real mismatch: leave it, and record why in the ledger. (Grep count is 13 today,
audit said 12 — reconcile during implementation.)

#### 3. Verify finding #4 (missing `investments` cache tag)

**File**: `src/lib/actions/kosztorys.ts` (`updateInvestmentCoeffsAction` `:102`, `updateInvestmentVatAction` `:119`, `updateInvestmentGlobalDiscountAction` `:135`)

**Intent**: Decide, don't blindly patch. The actions write investment-level fields (VAT / coeffs /
discount) but tag only `kosztorysItems`(+`kosztorysSections`), with comments justifying items-only.
Confirm whether anything reads those fields under an `investments` cache tag (a stale-read path). If
yes → add `investments` to the tag list. If no → the documented items-only decision stands; record it.

**Contract**: Either the tag arrays gain `'investments'` (with a one-line why), or the ledger records
"items-only is correct — no reader caches these fields under an investments tag" with the evidence.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm exec vitest run`
- The compile-assert guard still passes (dead-key removal didn't re-bail)

#### Manual Verification

- Change a VAT rate / global coefficient / global discount and confirm the sheet cache reflects it
  without a manual reload (guards the #4 decision)

---

## Phase 4: Structural Extractions

### Overview

The three EX-496 structural candidates. Behavior-preserving; each makes a layering the code currently
only _describes_ into something checkable.

### Changes Required

#### 1. Extract `settlement.ts` from `v2-rows.ts`

**File**: `src/lib/kosztorys/settlement.ts` (new), `src/lib/kosztorys/v2-rows.ts` (edit)

**Intent**: The `calc → settlement → rows` layering that `bb15fed` describes exists only as a comment.
Move the settlement-computing functions into their own file so the layering is a real import boundary.

**Contract**: Settlement functions move to `settlement.ts`; `v2-rows.ts` imports them. No signature
changes; pure relocation + re-export wiring. Identify the exact function set during implementation
(the ones the `bb15fed` comment names). Update any test imports.

#### 2. Extract `HEADER_TIPS`

**File**: `src/components/kosztorys/kosztorys-v2-columns.tsx` (edit), new sibling for the copy block

**Intent**: ~47 lines of Polish header-tooltip copy inline in the column builder makes it hard to scan.
Move the copy to its own module.

**Contract**: `HEADER_TIPS` (the copy map) moves to a sibling file (e.g. `kosztorys-header-tips.ts`);
the builder imports it. Copy strings unchanged (Polish UI text).

#### 3. Narrow the opts bag with `Pick<>`

**File**: `src/components/kosztorys/kosztorys-v2-columns.tsx` (the 16-field opts type / `buildV2Grid`)

**Intent**: The column-build opts bag declares 16 fields; narrow each consumer's parameter to the
fields it actually reads via `Pick<>`. Structural typing handles it with zero call-site changes.

**Contract**: Replace the wide opts type at internal consumers with `Pick<OptsT, ...>`. No call-site
edits; `pnpm typecheck` proves the narrowing is sound.

### Success Criteria

#### Automated Verification

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- Full unit suite passes: `pnpm exec vitest run`
- The compile-assert guard still passes
- `settlement.ts` exists and `v2-rows.ts` imports from it: file present, no duplicate definitions remain

#### Manual Verification

- Editor renders identically — column headers, tooltips, totals, settlement figures all unchanged
- Spot-check one investment's kosztorys end-to-end (add row, set progress, change a setting)

---

## Testing Strategy

### Unit Tests

- **Compile-assert guard** (Phase 1) — the primary new test. Compiles the hook via
  `babel-plugin-react-compiler`, asserts `_c(n)` in `useKosztorysEditor`, asserts no bail logged.
- Existing unit suite (`sort-value`, `create-json-map-store`, `v2-rows`, …) is the behavior net for
  Phases 2–4 — every phase must keep it green. The compiler fix and all cleanup are behavior-preserving,
  so a green existing suite is the regression signal.

### Integration Tests

- None owed. No new server-action behavior (the #4 decision either adds a cache tag — covered by the
  manual reload check — or records a no-op).

### Manual Testing Steps

1. Open an investment's kosztorys_v2 editor.
2. Add a stage, rename it, remove it; add / insert / remove an item; remove a section — all behave as before.
3. Change VAT, a global coefficient, and the global discount — each reflects without a manual reload.
4. Confirm no new console warnings and no visible extra grid re-rendering.

## Performance Considerations

This change is _net-positive_ on performance: restoring compilation means `columns` /
`columnToggleItems` / handlers regain stable identities, so `kosztorys-toolbar-actions.tsx` (`_c(21)`)
starts hitting its cache and `DynamicDataSheetGrid` stops receiving a new `columns` array on every
keystroke. No new hot-path work is added.

## Migration Notes

None. No schema, no data, no API contract change.

## References

- Audit: `context/changes/kosztorys-v2-audit/audit.md` (EX-496 full write-up; note it is stale — see `change.md`)
- Linear: [EX-496](https://linear.app/ex-plant/issue/EX-496/kosztorys-v2-audit-usekosztoryseditor-is-not-compiled-by-react), [EX-521](https://linear.app/ex-plant/issue/EX-521/split-use-kosztorys-editor-god-hook-behind-a-renderhook-harness) (Change B), [EX-422](https://linear.app/ex-plant/issue/EX-422/whole-data-table-flickers-when-clicking-the-toggle) (the setRows / ref invariant)
- Hook: `src/components/kosztorys/use-kosztorys-editor.ts`
- Casts: `src/components/kosztorys/kosztorys-v2-columns.tsx`
- Settings actions: `src/lib/actions/kosztorys.ts:102-151`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Compile-Assert Guard (TDD red)

#### Automated

- [x] 1.1 New test file exists and runs: `pnpm exec vitest run src/__tests__/use-kosztorys-editor.compile.test.ts` — 563859e
- [x] 1.2 Test fails on current code, naming the missing `_c` / the bail (red confirmed) — 563859e
- [x] 1.3 Type checking passes: `pnpm typecheck` — 563859e

### Phase 2: React Compiler Unblock (green) — REVERTED

> **Reverted 2026-07-17** (`git revert 4c7a1cd`). The context-routing this phase introduced caused a
> per-keystroke re-render regression (owner-confirmed by manual A/B); the compile-assert guard (p1) was
> deleted with it. EX-496 #1 (memoize the hook) is reopened, blocked on EX-521. See `change.md`.

- [x] 2.1 Compile-assert test passes: `pnpm exec vitest run src/__tests__/use-kosztorys-editor.compile.test.ts` — 4c7a1cd (reverted)
- [x] 2.2 Full unit suite passes: `pnpm exec vitest run` — 4c7a1cd (reverted)
- [x] 2.3 Type checking passes: `pnpm typecheck` — 4c7a1cd (reverted)
- [x] 2.4 Linting passes: `pnpm lint` — 4c7a1cd (reverted)

### Phase 3: Dead Code + Casts + Cache-Tag Verify

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — 0e4bd16
- [x] 3.2 Linting passes: `pnpm lint` — 0e4bd16
- [x] 3.3 Full unit suite passes: `pnpm exec vitest run` — 0e4bd16
- [x] 3.4 Compile-assert guard still passes — 0e4bd16

### Phase 4: Structural Extractions

#### Automated

- [x] 4.1 Type checking passes: `pnpm typecheck` — 5e6a9a6
- [x] 4.2 Linting passes: `pnpm lint` — 5e6a9a6
- [x] 4.3 Full unit suite passes: `pnpm exec vitest run` — 5e6a9a6
- [x] 4.4 Compile-assert guard still passes — 5e6a9a6
- [x] 4.5 `settlement.ts` exists and `v2-rows.ts` imports from it (no duplicate definitions) — 5e6a9a6

> Note: extractions #1 (`settlement.ts`) and #2 (`header-tips.ts`) already landed in the EX-515
> split (both are real modules, no duplicate defs in `v2-rows.ts`/`kosztorys-v2-columns.tsx`). Only
> #3 (Pick<>-narrow) was authored here — the two leaf consumers (`title`, `withResize`); the
> assembly/select functions keep the full bag since they thread it downstream.
