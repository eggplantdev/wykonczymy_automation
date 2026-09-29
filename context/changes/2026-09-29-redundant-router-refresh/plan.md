# Redundant `router.refresh()` removal (EX-908) Implementation Plan

## Overview

Sixteen client sites call `router.refresh()` after a Server Action that already expired its tags
with `updateTag`. That action's POST already carries the re-rendered route, so each refresh is a
second full server render and a second download of the same flight, with no new data. The baseline
measured this at every site: 2 renders per write (3 at K). This plan removes the refresh on every
success path. It keeps the refresh only where the write produced no render: the three editor
dialogs' `catch` branches. It then measures the same flows again.

## Current State Analysis

- Mechanism, confirmed in Next 16.1.7 source (research §1): an action that runs `updateTag` renders
  the current route into its POST, and the client applies it even after the calling dialog has
  unmounted. `router.refresh()` right after it is `ACTION_REFRESH`, a full refetch against a cache
  the action's render has just rewarmed.
- The baseline (`baseline.md`, 2026-09-29, `4c3ee036`) counted this at every site:

  | Site         | Renders per write                    |
  | ------------ | ------------------------------------ |
  | J expense    | 2                                    |
  | J investment | 2                                    |
  | I            | 2                                    |
  | E            | 2                                    |
  | F, G, H      | 2 each                               |
  | A, B, C      | 2 each                               |
  | D            | 2                                    |
  | M            | 2                                    |
  | N            | 2                                    |
  | O            | 2                                    |
  | K            | **3**                                |
  | L            | 2                                    |
  | P            | 2 per cell edit (4 per 3-edit burst) |

  Control: „Usuń sekcję", which has no refresh, is 1 POST and 0 GET.

- Largest waste: P on a 411-item kosztorys re-downloads 52 KB encoded / 395 KB decoded per cell edit.
- J's refresh was re-added in `097eb8c8` from a backlog diagnosis that was never reproduced. The one
  plausible real mechanism behind it (hook `revalidateTag(…, 'default')` racing `updateTag`) was
  removed by `62a0590a` (research §3).

## Desired End State

- No `router.refresh()` follows a revalidating action on a success path anywhere in `src/`.
- The only remaining `router.refresh()` call is inside `handleTreeReplaced`, gated on the
  `catch`-path flag.
- The after-run on the same fixtures shows 1 render per write at every site (2 at K, 0 extra GETs
  in P). Every write stays visible without a reload.
- Verify with `grep -rn "\.refresh()" src --include='*.ts' --include='*.tsx' | grep -v __tests__`.
  It should return only the `kosztorys-editor-v2.tsx` gated call and comments.
- The after-run section in `baseline.md` is diffable row by row against the before tables.

### Key Discoveries:

- **The restore latch.** `resolve(actionResult)` runs **before** the action's tree commits
  (`server-action-reducer.js:212`). So `triggerRestore()` armed after `await` still fires on the
  action's own render; L's success path needs no refetch. The latch comment at
  `use-restore-remount.ts:11` names the refresh as the trigger, so it must be reworded.
- **The `catch` branches.** In `clear-kosztorys-dialog.tsx:25-38`,
  `reload-from-preset-dialog.tsx:81-96` and `sheet-import-dialog.tsx:81-96` the branches fall
  through to `onTreeReplaced` / `onImported`. A transport rejection can arrive after the commit, and
  no flight data arrives, so the refresh is the only fresh read there.
- **Callers without a `catch` fall-through.** `clean-item-texts-action.tsx:25`,
  `sheet-compare-action.tsx:43` and `kosztorys-versions-drawer.tsx:67` call the callback on success
  only.
- **K's `onSaved`.** `catalogue-item-from-kosztorys-dialog.tsx:57` exposes `onSaved` for exactly
  one caller (`catalogue-compare-dialog.tsx:167`), and that caller only refreshes. Removing it
  leaves the prop, its comment at `:95-97` and the action wrapper's `if (res.success) onSaved?.()`
  dead.
- **P's timer.** It spans `use-kosztorys-editor.ts:157` (`TOTALS_REFRESH_DEBOUNCE_MS`), the
  `refreshTimer` ref at `:283`, its cleanup at `:364`, and the scheduling at `:1274-1280`.
- **Comments that name the refresh as the data source.** These become false and must be reworded:
  - `use-kosztorys-editor.ts:753`, `:772`, `:1028`, `:1221`;
  - `use-kosztorys-settings.ts:55`;
  - `use-restore-remount.ts:11`;
  - `save-default-register-button.tsx:22-24`;
  - `use-form-submit.ts:47-48`;
  - `catalogue-compare-dialog.tsx:165-166`.
- **`useRouter` after removal.** In every touched component except `kosztorys-editor-v2.tsx`,
  `useRouter` exists only for the refresh. The implementer drops the import and the hook call where
  that holds (read each file; some may use `router.push`).
- **Spec mocks.** 22 specs under `src/__tests__` mock `refresh` on `useRouter`, and none asserts a
  call. A mock is dead once the component the spec renders no longer calls `useRouter` at all.
- **The grid-writes spec.** `e2e/kosztorys-grid-writes.spec.ts:130-137` is the only
  refresh-count assertion (`≥1 && ≤ typed.length*2`). Its comment explains the ×2 as the trailing
  refresh.

## What We're NOT Doing

- No change to any action's revalidation (`updateTag`, `deferRefresh`, hook tags). This plan removes
  client refetches only.
- No EX-909 work: `createEmptyPresetAction`, the template tail, `expireCollectionsAfterResponse` and
  `create-empty-preset-dialog.tsx`'s `router.push` stay as they are.
- No `refreshDataAction` / `handleStaleTree` changes. They already rely on the action's own render.
- No new E2E specs. A–H and K go to one `e2e-backlog` issue.
- No running `pnpm test:e2e`, even one spec, without the user's explicit go.
- No staging deploy or push. The J staging confirmation is a manual check the human runs after
  deploying.
- No fix for the `unstable_cache` prefetch-poisoning race (`lessons.md:1905-1928`, EX-808 rejected).

## Implementation Approach

Delete, layer by layer. Each phase ends with typecheck-clean edits, the touched DOM specs green,
and a commit. The editor phase goes last among the code phases because it is the only one with a
contract change (the `refetch` flag) and the only one with latch timing. The after-run then
measures the whole tree at once against the before tables.

## Critical Implementation Details

**State sequencing (L).** `handleTreeReplaced` must keep its order: arm `triggerRestore()` first,
then (if flagged) `router.refresh()`, then `undoRedo.reset()` and `autoSnapshot.skipNext()`.
Without the refresh, the landing that drives the remount is the action's own render. That render is
still pending when the callback runs, because the callback is invoked after `await`, which resolves
before the commit. If the latch misses and the body does not remount after a restore or reload, do
not paper over it by re-adding an unconditional refresh. Stop and report, because the premise in
research Open Q3 would then be false.

**Watch items carried from the baseline.** On clear (L), „Kosztorys jest pusty" appeared ~120 ms
after the refresh GET. On A/B, the row state appeared ~150–200 ms after it. Both may have been
painted from the refetched payload. The after-run must confirm they still appear, and when. A lost
or stuck state there is a regression. A later but correct state is just a new timing to record.

## Phase 1: Risk anchor + forms, transfers, trash

### Overview

Name the risk the manual checks and the backlog issue anchor on. Then remove the refresh from the
FormDialog submit (J, every form) and from the list and trash actions (E, I, F, G, H).

### Changes Required:

#### 1. Test-plan risk #16

**File**: `context/foundation/test-plan.md`

**Intent**: Research Open Q5. Add the risk this change can break, so the manual checks and the
`e2e-backlog` issue point at a named risk and not at a file.

**Contract**:

- §2 Risk Map: a new row **#16** after #15. The failure scenario: a saved write is not visible
  without a reload — a list, balance or editor tree keeps its pre-write face after the action
  succeeded. Impact High, Likelihood Low. Source: EX-908 (16 refresh sites removed; the POST render
  is now the only post-write read).
- Risk Response Guidance: a row **#16**.
  - Proof: after each write, the change is visible with no reload, with exactly one action POST
    and no non-prefetch RSC GET.
  - Challenge: that the refresh was ever what showed the data.
  - Layer: E2E for the browser crossing; the existing guards are J, I, M, N, O, P and L.
  - Anti-pattern: asserting after the write's own refresh (`lessons.md:1905-1928`) or counting
    prefetch GETs as renders.
- Check §7 („What We Deliberately Don't Test", `:179`): if it excludes cache correctness
  wholesale, add one sentence carving out #16.

#### 2. FormDialog submit (J)

**File**: `src/components/forms/hooks/use-form-submit.ts`

**Intent**: Drop both refreshes: keepOpen success at `:49`, optimistic `onSuccess` at `:61`. Every
consumer's action revalidates with `updateTag` (research §3 table).

**Contract**:

- The keepOpen branch ends at `opts.onReset()`.
- The optimistic `onSuccess` becomes `opts.onReset` (or `() => opts.onReset()`).
- Drop the stale comment at `:47-48` and the `useRouter` import/call.
- The hook's return shape is unchanged.

#### 3. Row and dialog actions (E, I, F, G, H)

**Files**:

- `src/components/forms/form-fields/save-default-register-button.tsx` (E)
- `src/components/transfers/cancel-transfer-button.tsx` (I)
- `src/components/trash/trashed-investment-actions.tsx` (F)
- `src/components/trash/delete-forever-dialog.tsx` (G)
- `src/components/investments/trash-investment-button.tsx` (H)

**Intent**: Remove the success-path `router.refresh()` in each file, plus `useRouter` where it
becomes unused. For E, reword the comment at `:22-24`: `savedId` is seeded from the server value
and owned locally, and the fresh server value arrives with the action's own render.

**Contract**: No prop or signature changes.

#### 4. Dead router mocks in this phase's specs

**Files**: the specs among the 22 that render a component this phase changed (e.g. the forms'
specs, `trash/delete-forever-dialog.test.tsx`, `trash/trash-contents.test.tsx`).

**Intent**: Delete a `useRouter`/`refresh` mock only where the rendered tree no longer calls
`useRouter`. Leave any mock the tree still needs (e.g. `push`).

**Contract**: The specs stay green. No assertion is weakened.

### Success Criteria:

#### Automated Verification:

- The touched DOM specs pass: `pnpm exec vitest run <each spec edited or rendering a changed component>`.
- The refresh grep for the Phase 1 files returns nothing:
  `grep -n "\.refresh()" src/components/forms/hooks/use-form-submit.ts src/components/forms/form-fields/save-default-register-button.tsx src/components/transfers/cancel-transfer-button.tsx src/components/trash/*.tsx src/components/investments/trash-investment-button.tsx`

#### Manual Verification:

- J expense on `/kasa/<id>`: the new row and balance appear without a reload. Network shows 1
  POST (`x-action-revalidated: 1`, the new row in the flight) and no non-prefetch RSC GET.
- J investment create on `/inwestycje`: the new row appears. Same network shape.
- J on another form (worker, cash register or equipment, whichever is quickest), opened from a
  page that lists it: the row appears.
- J staging (after the human deploys): one expense on preview shows the row without a reload. This
  is the only place research §3 hypothesis 2 can show up.
- E: „Zapisz jako domyślną kasę" stops offering to save right after success, and a reopened
  expense dialog preselects the new register.
- I: a cancelled transfer shows as cancelled, and the balance moves, without a reload.
- H: an investment trashed from the listing leaves the list.
- F: „Przywróć" on `/kosz` removes the row from the kosz.
- G: „Usuń na zawsze" removes the row from the kosz.

**Implementation Note**: When this phase's automated verification passes, commit and continue. Do
not pause for per-phase manual confirmation. Manual verification is collected once, at the end of
the change, into the manual-checks registry.

---

## Phase 2: Sheet actions

### Overview

Remove the refresh from the four sheet dialogs and actions: A, B, C on `/kosztorysy`, and D, the
SheetButton on the investment page.

### Changes Required:

#### 1. Sheet sites (A–D)

**Files**:

- `src/components/sheets/linked-sheet-actions.tsx` (A: `:39` unlink, `:49` delete)
- `src/components/dialogs/link-sheet-to-investment-dialog.tsx` (B, `:49`)
- `src/components/dialogs/add-sheet-dialog.tsx` (C, `:55`)
- `src/components/dialogs/sheet-setup-dialog.tsx` (D, `:43`)

**Intent**: Every action here revalidates `kosztoryses` / `investments` inline, plus the hook
(research §2). Remove the refresh and the now-unused `useRouter`.

**Contract**: No prop or signature changes. Any dead router mock in the specs rendering these goes
too (same rule as Phase 1 §4).

### Success Criteria:

#### Automated Verification:

- The touched DOM specs pass, if any render these components:
  `pnpm exec vitest run <spec>`.
- The refresh grep over the four files returns nothing.

#### Manual Verification:

- A unlink on `/kosztorysy`: the row shows as unlinked without a reload (watch item: note when it
  appears relative to the POST).
- A delete: the row is gone without a reload.
- B link: the row shows the investment name without a reload (watch item as for A).
- C add: the new row appears without a reload.
- D, SheetButton „Dodaj kosztorys" on `/inwestycje/<id>`: the „Otwórz" link appears without a
  reload.
- Network for each of A–D: 1 POST, no non-prefetch RSC GET.
- The writes stay on the reader credential. The sync writes are still refused locally
  („Refusing to write…"); nothing reaches Google.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Kosztorys editor

### Overview

Remove the editor's refreshes: K, M, N, O and the whole P timer. Put L behind a `catch`-only flag.
Reword every comment that names the refresh as the data source. Tighten the one E2E count
assertion.

### Changes Required:

#### 1. Grid timer and handlers (M, N, O, P)

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**:

- P: delete `TOTALS_REFRESH_DEBOUNCE_MS` (`:157`), the `refreshTimer` ref (`:283`), its unmount
  cleanup (`:364`) and the scheduling block in `onChange` (`:1274-1280`, including its two comment
  lines).
- M: delete the reversal's refresh (`:772-773`).
- N: delete `handleAppendedSections`'s refresh (`:1033`).
- O: delete `handleAppendedCatalogueItems`'s refresh (`:1059`).
- Drop `useRouter` if nothing else in the hook uses it.

**Contract**: The hook's return shape is unchanged. Reword these comments:

- `:753`: the rollback reason stays. `rows` is mount-frozen, so no render, the action's included,
  can undo an optimistic apply. Only the „trailing `router.refresh()`" wording goes.
- `:1028`: new rows reach the grid only through this local patch, never through a render.
- `:1221`: same fix — „the action's render won't pick them up".

#### 2. Tree-replacing callers (L)

**Files**:

- `src/components/kosztorys/editor/kosztorys-editor-v2.tsx`
- `src/components/kosztorys/editor/use-kosztorys-editor-context.tsx`
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx`
- `src/components/kosztorys/editor/hooks/use-sheet-import.ts`
- `src/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog.tsx`
- `src/components/kosztorys/editor/dialogs/clear-kosztorys-dialog.tsx`
- `src/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog.tsx`

**Intent**: On success the action's own render lands the new tree and drives the armed latch. Only
a transport rejection, where no flight arrives but the commit may have happened, still needs a
refetch.

**Contract**:

- `handleTreeReplaced({ refetch }: { refetch?: boolean } = {})` calls `router.refresh()` only when
  `refetch` is true (ordering per Critical Implementation Details).
- `onTreeReplaced?: (opts?: { refetch?: boolean }) => void` in the context type and the body props.
- `SheetImportDialog`'s `onImported` takes the same optional arg, and `use-sheet-import.ts`
  forwards it.
- The three dialogs pass `{ refetch: true }` only from their `catch` branch (e.g. a local
  `let refetch = false` set in `catch`, passed at the shared tail).
- `clean-item-texts-action.tsx`, `sheet-compare-action.tsx` and `kosztorys-versions-drawer.tsx`
  (`onRestored`) stay unchanged and call with no argument.
- Reword `handleTreeReplaced`'s header comment: it lists restore and import; reload and clear land
  there too.
- Reword `use-restore-remount.ts:11`: arm right after the action returns, and the action's render
  (or the `catch` path's refresh) is the landing.

#### 3. Catalogue compare (K)

**Files**:

- `src/components/kosztorys/editor/dialogs/catalogue/catalogue-compare-dialog.tsx`
- `src/components/kosztorys/editor/dialogs/catalogue/catalogue-item-from-kosztorys-dialog.tsx`

**Intent**: The save's action already renders the fresh cennik, and `useFormSubmit`'s own refresh
is gone after Phase 1. `onSaved` has no other caller, so delete it end to end.

**Contract**:

- Remove `onSaved` from the dialog's props.
- Remove the `:95-97` comment and the `if (res.success) onSaved?.()` wrapper. The `action` prop can
  pass the chosen action straight through.
- Remove the `:165-167` comment and prop in the compare dialog, and its `useRouter` if unused.

#### 4. Settings comment

**File**: `src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts`

**Intent**: `:55` says „until router.refresh() lands". The lag it describes is the action's render
landing. Reword so the comment stays true.

**Contract**: Comment only.

#### 5. Grid refresh-count assertion

**File**: `e2e/kosztorys-grid-writes.spec.ts`

**Intent**: With the trailing refresh gone, each etap edit costs exactly one route fetch (the
`deferRefresh` follow-up). The ceiling at `:137` tightens so a re-added refresh fails the spec.

**Contract**:

- `expect(refreshes()).toBeLessThanOrEqual(typed.length)`; the floor `≥ 1` stays.
- Rewrite the comment at `:130-135`: one fetch per edit is the `deferRefresh` floor, and a second
  is the regression (the trailing refresh EX-908 removed; the autosave's own POST render EX-604
  removed).

#### 6. Dead router mocks in the editor specs

**Files**: the editor specs among the 22 (e.g. `kosztorys-editor-body-history.test.tsx`,
`use-kosztorys-itemless-sections.test.tsx`, `use-kosztorys-catalogue-problems.test.tsx`,
`catalogue-compare-dialog.test.tsx`, `kosztorys-actions-menu.test.tsx`,
`kosztorys-editor-toolbar.test.tsx`, `add-items-from-catalogue-dialog.test.tsx`).

**Intent**: Same rule as Phase 1 §4. A spec that passes `onSaved` or asserts on it is updated to
the removed prop.

**Contract**: The specs stay green. `use-restore-remount.test.tsx` stays unchanged (it tests the
latch, not the refresh).

### Success Criteria:

#### Automated Verification:

- The touched DOM specs pass: `pnpm exec vitest run <each edited editor spec>` plus
  `src/__tests__/components/kosztorys/editor/hooks/use-restore-remount.test.tsx`.
- The repo-wide refresh grep returns only the gated call in `kosztorys-editor-v2.tsx`:
  `grep -rn "\.refresh()" src --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v '//' | grep -v '^\s*\*'`

#### Manual Verification:

- P small (1 section, 3 items): an etap edit refreshes the section/summary totals. Network: 1 POST
  (`f` empty) plus 1 GET, no second GET ~750 ms later.
- P Przedmiar edit: the totals refresh from the POST alone (0 GET).
- P burst of 3 etap edits: 3 GETs, not 4, and the final totals are right.
- P large (411 items): per edit 1 render, and the totals are right.
- M: Cofnij and Ponów each restore the value and the totals. 1 POST and 0 extra GET per reversal
  (etap reversals: the `deferRefresh` GET only).
- N: „Sekcja z szablonu…" shows the section and the totals. 1 POST, 0 GET.
- O: „Dodaj pracę z katalogu do sekcji…" shows the row and the totals. 1 POST, 0 GET.
- K: „Porównaj z katalogiem" → „Dodaj do katalogu" → „Dodaj": the row leaves „Brak w katalogu".
  1 POST, 0 GET (was 2).
- L reload from szablon: the body remounts to the szablon's rozpiska, and the toast shows. 1 POST,
  0 GET.
- L clear: „Kosztorys jest pusty" appears (watch item: record the timing against the POST). 1 POST,
  0 GET.
- L restore version (versions drawer): the body remounts to the restored tree (research Open Q3).
- L sheet import: the imported rozpiska shows. „Wyczyść teksty" and compare-with-sheet reach the
  same path, so a spot-check of one suffices.
- L `catch` path: force a transport rejection on clear or reload (DevTools → offline right after
  the click, or block the action request). The error toast shows, and one RSC GET follows once back
  online, so the refetch still happens.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: After-run, manual checks, backlog, docs

### Overview

Measure the same flows on the same rig, write the result next to the before tables, fill the
change's manual-checks, file the E2E backlog issue, and record the rule in `lessons.md`.

### Changes Required:

#### 1. After-run

**File**: `context/changes/2026-09-29-redundant-router-refresh/baseline.md`

**Intent**: Research Open Q1 and Q2 and the watch items. Reproduce every before table on a build
of the tree carrying Phases 1–3.

**Contract**:

- Append an `# After-run — EX-908` part with the same columns per flow (J, I, E, J-invest/H/F/G,
  P small + large, M, N, O, K, L, A–C, D).
- Rig per the header of the file:
  - a clean worktree at the Phase 3 commit;
  - `NEXT_DIST_DIR=.next-e2e pnpm build` and `pnpm test:e2e:warm:server` on :3100 against 5435;
  - check the machine-wide test lock and other agents' `.next-e2e` use before building;
  - the Playwright MCP window at 2400×1300.
- Record the J decisive reading: header 1 **and** the new row in `f`.
- Record the watch items, A/B row timing and L clear empty-state timing, against the POST.
- End with a delta table: per site, before renders → after renders.
- The EX-909 after-run later compares against this table, not the before one (EX-909
  `baseline.md` ordering note).

#### 2. Change manual checks

**File**: `context/changes/2026-09-29-redundant-router-refresh/manual-checks.md`

**Intent**: A new file holding the Manual Verification bullets of Phases 1–3 as `- [ ]` boxes,
grouped by site. `/10x-implement` moves it into `context/foundation/manual-checks.md` at close. The
boxes the after-run proved get ticked there, with the evidence indented under them.

**Contract**: Format per `context/foundation/manual-checks.md:1-24`. The header anchors on test-plan
risk #16.

#### 3. E2E backlog issue

**Linear**: project „Wykonczymy", label `e2e-backlog`.

**Intent**: A–H and K have no browser guard. One issue lists them, anchored on risk #16, with the
check shape (write visible without reload, 1 POST, 0 non-prefetch RSC GET) and the reuse hint
`countRouteRefreshes` (`e2e/kosztorys-grid-writes.spec.ts:61-74`).

**Contract**: Record the issue id in `plan.md` Progress and in `manual-checks.md`.

#### 4. Lessons

**File**: `context/foundation/lessons.md`

**Intent**: Extend the EX-597 entry (`:653-680`) with the app-wide form of its rule.

- The write's response **is** the render.
- A client `router.refresh()` belongs only after a write that did not go through a revalidating
  action: a route handler, an upload API, a thrown action (L's `catch`), or an `after()`-expired
  action.
- The K triple render is the example of two layers each adding „their" refresh.

**Contract**: Edit the existing section's **Rule** / **Applies to**. No new top-level entry
(one concept, one place).

### Success Criteria:

#### Automated Verification:

- `baseline.md` has an after-run part covering every before table.
- `manual-checks.md` exists in the change folder.

#### Manual Verification:

- The after-run delta shows 1 render per write at every site (K: 1, P: 0 trailing GETs), with no
  write left invisible without a reload.

**Implementation Note**: Phase 4 is the final phase: `/10x-implement` aggregates the manual checks
into the registry here.

---

## Testing Strategy

### Unit Tests:

- None new. The change deletes calls. A spec asserting „`refresh` not called" would test
  implementation and not visibility (decision: manual + backlog).

### Integration Tests:

- Existing E2E guards cover J (`transfer-create.spec.ts`), I (`transfer-cancel.spec.ts`), M
  (`kosztorys-undo-redo.spec.ts`), N (`kosztorys-structure.spec.ts:372`), O
  (`work-catalogue.spec.ts:190`), P (`kosztorys-grid-writes.spec.ts`, tightened) and L
  (`kosztorys-presets.spec.ts:193-249`, `kosztorys-versions.spec.ts:44,97`).
- These run only on the user's explicit go (~1 h per run). Recommend the P, L and J specs as the
  minimal set when asked.

### Manual Testing Steps:

1. Each Phase 1–3 Manual Verification bullet, on the after-run rig (Phase 4 drives most of them in
   the same Playwright session).
2. The J staging check after the human deploys.

## Performance Considerations

This is the whole point of the change: one server render and one flight download fewer per write,
which is ~395 KB decoded per cell edit on a 411-item kosztorys. The after-run is the proof, and a
site that does not drop to 1 render is a finding, not noise.

## Migration Notes

None. No schema or data change.

## Whole-tree Gate

Run **once**, after the final phase:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`
- The touched DOM specs pass together:
  `pnpm exec vitest run <all specs edited in Phases 1–3>`
- Not run unasked: the full `pnpm test`, `pnpm test:e2e`.

## References

- Research: `context/changes/2026-09-29-redundant-router-refresh/research.md`
- Baseline (before): `context/changes/2026-09-29-redundant-router-refresh/baseline.md`
- EX-597 precedent: `context/archive/2026-07-27-decouple-panel-write-refresh/change.md:50-69`
- Follow-on: `context/changes/2026-09-29-szablony-plain-revalidation/` (EX-909), measured on top of
  this change

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Risk anchor + forms, transfers, trash

#### Automated

- [x] 1.1 Touched DOM specs pass — 10314c9e
- [x] 1.2 Refresh grep over Phase 1 files returns nothing — 10314c9e

### Phase 2: Sheet actions

#### Automated

- [x] 2.1 Touched DOM specs pass — 9bf7c6b5
- [x] 2.2 Refresh grep over the four sheet files returns nothing — 9bf7c6b5

### Phase 3: Kosztorys editor

#### Automated

- [x] 3.1 Touched editor DOM specs + `use-restore-remount.test.tsx` pass — efcdfd77
- [x] 3.2 Repo-wide refresh grep returns only the gated call in `kosztorys-editor-v2.tsx` — efcdfd77

### Phase 4: After-run, manual checks, backlog, docs

#### Automated

- [x] 4.1 `baseline.md` has an after-run part covering every before table
- [x] 4.2 `manual-checks.md` exists in the change folder

E2E backlog for A–H/K: EX-924.
