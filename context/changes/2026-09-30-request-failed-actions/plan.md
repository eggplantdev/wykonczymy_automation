# Request-failed server actions (EX-940) Implementation Plan

## Overview

A server action called from the client **rejects** when the request itself never completes
(offline, a deploy invalidating the action id). `protectedAction` only folds handler throws into
`{ success: false }`, so every unwrapped call site turns that rejection into a stuck button, a
silent no-op, an error page (inside `startTransition`), a grid showing state the DB doesn't have,
or English browser text („Failed to fetch"). This plan routes every remaining client call through
`settleAction`, gives the failure a code (`REQUEST_FAILED`) so callers can pick a recovery, and adds
an ESLint guard so new calls can't land unwrapped.

## Current State Analysis

Full inventory with file:line: `research.md` in this folder. In short:

- `src/lib/utils/settle-action.ts` converts a rejection to `{ success: false, error }` with **no
  code**; 23 client call sites still bypass it (13 components/forms/hooks + 10 structural ops in
  `use-kosztorys-editor.ts`). The form submit path is already fully wrapped.
- `src/lib/kosztorys/save-lanes.ts:43-44` catches but forwards `error.message` — the grid autosave
  shows „Failed to fetch". `save-lanes.test.ts:77-91` asserts that pass-through.
- `optimistic-setting-save.ts` already shows a specific Polish message (the issue was wrong there);
  converting it only adds `logError`.
- Four tree-replacing dialogs (clear, reload-from-preset, sheet import, „Popraw literówki") use their
  own try/catch to close + refetch on a transport failure; the versions-drawer restore (already on
  `settleAction`) has no refetch at all.
- `logoutAction` redirects, and a redirecting action **rejects** client-side by design
  (`next/dist/client/components/router-reducer/reducers/server-action-reducer.js:189-209`, verified,
  Next 16.1.7) — `settleAction` as written would swallow it.

## Desired End State

Every client-side server-action call either goes through `settleAction` / `settled(...)` or sits in a
try/catch that handles the rejection. A transport failure anywhere ends in: a Polish message, a
control back at rest, optimistic state rolled back, and — only for wipe-and-reinsert operations —
a tree refetch. Logout still redirects. `pnpm lint` fails on a new unwrapped `await fooAction()` /
`void fooAction()` / bare `.then` / `startTransition(() => fooAction())` in client code.

### Key Discoveries:

- `use-debounced-save.ts:36-47` routes every non-`NOT_FOUND` code to toast + revert — so
  `REQUEST_FAILED` in the lanes needs no new branch, only the code.
- Every structural op in `use-kosztorys-editor.ts` (775, 816, 842, 867, 903, 932, 982, 990, 1076, 1196) already has a correct `!success` branch (incl. `persistItemSwap` →
  `swapItemInSection` + `amendTop`); only the rejection path is missing.
- The versions drawer's `onRestored` is already wired to `handleTreeReplaced`
  (`kosztorys-editor-v2.tsx:86`), which accepts `{ refetch }` — only the drawer's prop type is narrow.
- `use-kosztorys-stage-ops.ts:52,63` already pass a `settleAction` result's `code` into
  `reportFailure(code?: ActionErrorCodeT)` — widening `ActionErrorCodeT` is required for typecheck.
- `eslint.config.mjs:43-58` holds the `process.env` `no-restricted-syntax` block; a second block for
  overlapping files **replaces** its selectors (probed).

## What We're NOT Doing

- A local ESLint rule tracking imports from `'use server'` modules (name-based rule only; the 24
  exports not ending in `Action` stay unguarded — decided).
- Toast dedupe for N cells failing at once while offline.
- `handleAcceptCatalogueName` not routing `NOT_FOUND` to the reseed; `runReorderReversal` leaving the
  command on the wrong stack after a failed undo — pre-existing, separate class.
- Renaming server actions to fit the lint suffix.
- A test per mechanical call site — tests go where there is state or logic (decided: „po ryzyku").

## Implementation Approach

Foundation first (the code + redirect safety + `settled` factory), then highest-traffic path (grid
autosave), then the editor, then the tree-replacing dialogs, then the mechanical sweep, then the lint
guard last so it lands at zero violations. Each phase is independently shippable.

## Critical Implementation Details

- **Redirect must survive `settleAction`.** Call `unstable_rethrow(err)` (from `next/navigation`) first
  in the catch, before `logError`. Without it, logout logs a „failed request" and never navigates.
- **Lanes: `REQUEST_FAILED` reverts, never reseeds.** The reseed rides the same dead connection
  (`refreshDataAction`), resets the undo stack and arms the remount latch with no tree coming.
- **Do not wrap `handleStaleTree`'s `refreshDataAction()`** (`kosztorys-editor-v2.tsx:68`): its
  rejection is what `use-stale-tree-recovery.ts:53` turns into `STALE_TREE_FAILED`. If
  `refreshDataAction` gains a return value (Phase 5), widen `useStaleTreeRecovery`'s
  `onStaleTree` to `() => Promise<unknown>` rather than touching that call.
- **Tree-replacing dialogs keep their own „…przerwane — odświeżam…" toast** on the
  `REQUEST_FAILED` branch — the generic settleAction sentence („odśwież stronę") contradicts a dialog
  that refreshes itself. A plain `!success` branch would silently drop the refetch; the code branch is
  the whole point.

## Phase 1: settleAction foundation

### Overview

Give the transport failure a code, make redirects pass through, and add the per-import decorator the
editor needs.

### Changes Required:

#### 1. Error code

**File**: `src/types/action.ts`

**Intent**: Let callers branch on „the request never completed" the same way they branch on
`NOT_FOUND`.

**Contract**: `ActionErrorCodeT = 'NOT_FOUND' | 'REQUEST_FAILED'`.

#### 2. settleAction + settled

**File**: `src/lib/utils/settle-action.ts`

**Intent**: Return the code on a rejection, rethrow Next's control-flow errors (redirect / notFound),
and expose a decorator that wraps an action once at import.

**Contract**:

- `settleAction<R extends { success: boolean }>(call) : Promise<R | { success: false; error: string; code: 'REQUEST_FAILED' }>`
- catch: `unstable_rethrow(err)` → `logError` → return with `code: 'REQUEST_FAILED'`.
- `settled(action)` → `(...args) => settleAction(() => action(...args))`, preserving the parameter
  tuple and result type.
- Update the comment block to mention the code; keep the existing Polish sentence.

#### 3. Spec

**File**: `src/__tests__/lib/utils/settle-action.test.ts` (new, node)

**Intent**: Pin the three behaviours: resolved result passes through; `TypeError('Failed to fetch')`
→ `{ success: false, code: 'REQUEST_FAILED' }` with a Polish message; an error thrown by
`redirect('/x')` is rethrown, not swallowed. `settled` forwards arguments.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/utils/settle-action.test.ts` passes

#### Manual Verification:

- Sidebar „Wyloguj" still logs out and lands on /zaloguj (redirect not swallowed).

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 2: Kosztorys autosave lanes and settings

### Overview

Kill the English toast on the most frequent write path; pin that a transport failure reverts rather
than reseeds.

### Changes Required:

#### 1. Save lanes

**File**: `src/lib/kosztorys/save-lanes.ts`

**Intent**: Replace the try/catch around `run()` with `settleAction(run)` and forward
`(res.error, res.code)` to `onError`. The lane still never rejects.

**Contract**: `enqueue` signature unchanged; `onError` now receives `'REQUEST_FAILED'` on a rejection.

#### 2. Optimistic setting save

**File**: `src/lib/kosztorys/optimistic-setting-save.ts`

**Intent**: Go through `settleAction` (gains `logError`), keep the caller's specific Polish message on
`REQUEST_FAILED`, `res.error` otherwise. Drop the try/catch and its comment.

**Contract**: signature unchanged; `optimistic-setting-save.test.ts` stays green unmodified.

#### 3. Specs

**File**: `src/__tests__/lib/kosztorys/save-lanes.test.ts`

**Intent**: The „thrown action" case (:77-91) now asserts `onError` gets a message without the browser
text and the code `'REQUEST_FAILED'` — red before change #1.

**File**: `src/__tests__/components/kosztorys/editor/hooks/use-debounced-save.test.tsx` (new, dom)

**Intent**: `runNow` with a rejecting action → caller `onError` called, `onStale` **not** called,
Polish toast. Pins „REQUEST_FAILED reverts, never reseeds".

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/save-lanes.test.ts src/__tests__/lib/kosztorys/optimistic-setting-save.test.ts src/__tests__/components/kosztorys/editor/hooks/use-debounced-save.test.tsx` passes

#### Manual Verification:

- Kosztorys → DevTools Network „Offline" → edit a Przedmiar cell: Polish toast („Brak połączenia z
  serwerem…"), the cell returns to its previous value, no „Failed to fetch".
- Same offline → change a rabat in „Opcje rozliczenia": the specific Polish message, value reverts.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Editor structural operations

### Overview

Make each of the 10 existing `!success` branches cover the rejection, without touching handler bodies.

### Changes Required:

#### 1. Wrap at import

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Declare module-level wrapped versions of the 10 actions with `settled(...)` and call those
at lines 775, 816, 842, 867, 903, 932, 982, 990, 1076, 1196. Handler logic, reverts and
`reportFailure` calls stay as they are.

**Contract**: No change to the hook's return shape. `handleApplyCatalogueToItems` (:1160) keeps its
own try/catch.

#### 2. Spec

**File**: `src/__tests__/components/kosztorys/editor/use-kosztorys-editor-request-failed.test.tsx` (new, dom)

**Intent**: Reuse the harness of `use-kosztorys-itemless-sections.test.tsx` (mocked actions, captured
`grid.opts`, real undo stack) with a tree of two pozycje in one section. `swapItemOrderAction` rejects
→ fire `onReorderItem` → rows back in the original order, `undoDepth === 0`, Polish error toast.
Second case: `removeItemAction` rejects → the row is back.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/use-kosztorys-editor-request-failed.test.tsx src/__tests__/components/kosztorys/editor/use-kosztorys-itemless-sections.test.tsx` passes

#### Manual Verification:

- Kosztorys offline → move a pozycja with ▲/▼: order snaps back, Polish toast; Cmd+Z does nothing.
- Kosztorys offline → „Dodaj pozycję" / „Dodaj sekcję": Polish toast, no row added, no error page.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Tree-replacing dialogs and the versions drawer

### Overview

One failure shape for every wipe-and-reinsert operation: a transport failure closes, tells the user
it is refreshing, and refetches the tree — because the commit may have landed.

### Changes Required:

#### 1. Four dialogs

**Files**: `src/components/kosztorys/editor/dialogs/clear-kosztorys-dialog.tsx`,
`.../dialogs/preset/reload-from-preset-dialog.tsx`, `.../dialogs/sheet/sheet-import-dialog.tsx`,
`.../actions/clean-item-texts-action.tsx`

**Intent**: Replace try/catch (and the `.then/.catch/.finally` chain in clean-item-texts) with
`settleAction`; branch `code === 'REQUEST_FAILED'` → the dialog's existing „…przerwane —
odświeżam…" toast, close, `onTreeReplaced({ refetch: true })` (sheet import: `onImported({ refetch })`).
Other `!success` and success paths unchanged.

**Contract**: No prop changes. Behaviour identical to today apart from `logError` now firing.

#### 2. Versions drawer

**File**: `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx`

**Intent**: On `REQUEST_FAILED` after restore: toast that the restore was interrupted and the
kosztorys is refreshing, close, `onRestored({ refetch: true })`. Success path calls
`onRestored()` as today.

**Contract**: `onRestored: OnTreeReplacedT` (from `use-kosztorys-editor-context.tsx:10`); the shell
already passes `handleTreeReplaced`, so no change in `kosztorys-editor-v2.tsx`.

#### 3. Specs

**File**: `src/__tests__/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog.test.tsx`

**Intent**: Add the transport case: apply action rejects → `onImported({ refetch: true })`, dialog
closed, „przerwane" toast.

**File**: `src/__tests__/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.test.tsx`
(new if absent, dom)

**Intent**: `restoreSnapshotAction` rejects → `onRestored` called with `{ refetch: true }`.

`clean-item-texts-action.test.tsx` must stay green unmodified (it already pins the refetch on
rejection).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs/sheet/sheet-import-dialog.test.tsx src/__tests__/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.test.tsx src/__tests__/components/kosztorys/editor/actions/clean-item-texts-action.test.tsx` passes

#### Manual Verification:

- Kosztorys → „Wyczyść kosztorys" confirm while offline: „Czyszczenie przerwane — odświeżam…", dialog
  closes; back online the grid shows the real DB state.
- Szuflada wersji → przywróć wersję while offline: toast about the interrupted restore, drawer closes,
  no error page.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Remaining call sites

### Overview

The mechanical sweep: every remaining unwrapped call goes through `settleAction`, feeding the branch
that already exists at each site.

### Changes Required:

#### 1. Stuck pending flags

**Files**: `src/components/transfers/cancel-transfer-button.tsx:38`,
`.../editor/dialogs/preset/add-sections-from-preset-dialog.tsx:91`,
`.../editor/dialogs/preset/save-preset-dialog.tsx:39`, `.../editor/dialogs/save-version-dialog.tsx:34`

**Intent**: Wrap the call; the existing `!success` branch shows the message and the pending flag
resets.

#### 2. Transitions that reach the error boundary

**Files**: `src/components/forms/form-fields/warehouse-field.tsx:35`,
`src/components/nav/refresh-data-button.tsx:26`, `src/components/nav/logout-button.tsx:27`,
`src/lib/actions/refresh.ts`, `src/components/kosztorys/editor/hooks/use-stale-tree-recovery.ts`

**Intent**: Wrap each call. `refreshDataAction` returns `{ success: true as const }` so it fits
`settleAction`; the button toasts the error on failure. Logout: only the transport branch ever returns
(the redirect rethrows via Phase 1), so it toasts `res.error`.

**Contract**: `useStaleTreeRecovery(onStaleTree?: () => Promise<unknown>)` — widened so
`handleStaleTree` can keep returning the raw `refreshDataAction()` promise (see Critical Details).

#### 3. Auth forms

**Files**: `src/app/(auth)/zaloguj/login-form.tsx:25`,
`.../reset-hasla/reset-password-form.tsx:36`, `.../zapomniane-haslo/forgot-password-form.tsx:17`

**Intent**: Wrap the call; failure sets the form back to idle with the message. Forgot-password has
no error state today (its action always succeeds) — add one, rendered like login's error line.
Remove the stray `console.log('response', …)` in login-form.

#### 4. Fire-and-forget reads and writes

**Files**: `src/components/kosztorys/editor/hooks/use-auto-snapshot.ts:39`,
`src/components/kosztorys/editor/actions/save-preset-action.tsx:24`,
`src/components/leads/lead-assets-dialog.tsx:75`

**Intent**: Auto-snapshot stays silent (settleAction only logs). The two reads apply their data only
on `res.success`; lead-assets keeps its `cancelled` guard.

#### 5. Specs

**File**: `src/__tests__/components/transfers/cancel-transfer-button.test.tsx` (new, dom)

**Intent**: Action rejects → error toast, the dialog's buttons are enabled again.

**File**: `src/__tests__/app/(auth)/zaloguj/login-form.test.tsx` (new, dom)

**Intent**: `loginAction` rejects → the submit button is back to „Zaloguj" and the Polish message is
shown.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/transfers/cancel-transfer-button.test.tsx "src/__tests__/app/(auth)/zaloguj/login-form.test.tsx"` passes

#### Manual Verification:

- Transakcje → Anuluj transakcję while offline: Polish toast, buttons usable again.
- /zaloguj offline → submit: message under the form, button not stuck on „Logowanie...".
- Sidebar „Odśwież dane" offline: toast, no error page.
- Formularz wydatku → „Dodaj magazyn" offline: toast, no error page.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 6: ESLint guard

### Overview

Keep new calls from landing unwrapped. Lands last, at zero violations.

### Changes Required:

#### 1. Rule

**File**: `eslint.config.mjs`

**Intent**: Extract the `process.env` selector into a constant; add a block for client code that
repeats it plus the server-action selectors S1–S5 from `research.md` §7 (with
`ACT = [callee.name=/Action$/]:not([callee.name='settleAction'])`): unwrapped `await` outside a
try-with-handler, `void`, `.then` without a rejection handler or chained `.catch`,
`startTransition(() => fooAction())`, bare expression statement. Message points to `settleAction`.

**Contract**: files `src/components/**/*.{ts,tsx}`, `src/hooks/use-*.{ts,tsx}`,
`src/app/**/*.{ts,tsx}`, `src/stores/**/*.ts`; same `ignores` as the env block. Not `src/lib/**`
(actions call actions there) and not the rest of `src/hooks/**` (Payload hooks). Any remaining hit
that is genuinely handled (e.g. `investor-actions.tsx:78`, promise stored then `.catch`ed) gets an
`eslint-disable-next-line` with the reason.

### Success Criteria:

#### Automated Verification:

- `pnpm lint` passes
- The rule fires on a probe: a temporary `await fooAction()` in a component is reported (then removed)
- `process.env.X` in a component is still reported (env selector not overridden)

#### Manual Verification:

- None — tooling only.

**Implementation Note**: When this phase's automated verification passes, commit.

---

## Testing Strategy

### Unit Tests:

- `settleAction`: code on rejection, redirect rethrown, `settled` forwarding.
- `save-lanes`: code + no browser text.

### Component / hook (dom):

- `use-debounced-save`: REQUEST_FAILED reverts, never reseeds.
- `use-kosztorys-editor`: reorder and remove roll back on rejection.
- sheet-import dialog + versions drawer: rejection → refetch.
- cancel-transfer button + login form: control back at rest, Polish message.

### Manual Testing Steps:

Collected per phase above; run on staging with DevTools Network „Offline" (a stale-action-id after
deploy is not reproducible on demand; offline exercises the same rejection path).

## Performance Considerations

None — one extra try/catch per call.

## Whole-tree Gate

Run once, after the final phase:

- `pnpm typecheck`
- `pnpm lint`
- Full `pnpm test` only when explicitly requested (review gate).

## References

- Research: `context/changes/2026-09-30-request-failed-actions/research.md`
- Precedent: `src/components/kosztorys/editor/hooks/use-kosztorys-stage-ops.ts:51,62`
- Test template: `src/__tests__/components/investments/trash-investment-button.test.tsx`
- Lesson: `context/foundation/lessons.md` — „A mount-frozen client copy…", „serialized write lane"

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: settleAction foundation

#### Automated

- [x] 1.1 `pnpm exec vitest run src/__tests__/lib/utils/settle-action.test.ts` passes — c3794d63

### Phase 2: Kosztorys autosave lanes and settings

#### Automated

- [x] 2.1 save-lanes, optimistic-setting-save and use-debounced-save specs pass

### Phase 3: Editor structural operations

#### Automated

- [ ] 3.1 use-kosztorys-editor-request-failed and use-kosztorys-itemless-sections specs pass

### Phase 4: Tree-replacing dialogs and the versions drawer

#### Automated

- [ ] 4.1 sheet-import-dialog, kosztorys-versions-drawer and clean-item-texts-action specs pass

### Phase 5: Remaining call sites

#### Automated

- [ ] 5.1 cancel-transfer-button and login-form specs pass

### Phase 6: ESLint guard

#### Automated

- [ ] 6.1 `pnpm lint` passes
- [ ] 6.2 The rule fires on a probe `await fooAction()` in a component
- [ ] 6.3 `process.env.X` in a component is still reported
