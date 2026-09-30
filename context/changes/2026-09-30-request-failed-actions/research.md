---
date: 2026-09-30T08:50:00+02:00
researcher: Claude (Opus 5.5)
git_commit: d57b77ef
branch: staging
repository: wykonczymy
topic: 'EX-940 — server action whose request never arrived: remaining unhandled call sites, REQUEST_FAILED code, lint guard'
tags: [research, server-actions, settle-action, kosztorys-editor, save-lanes, eslint]
status: complete
last_updated: 2026-09-30
last_updated_by: Claude (Opus 5.5)
---

# Research: EX-940 — unhandled transport failures of server actions

**Date**: 2026-09-30 · **Git Commit**: d57b77ef · **Branch**: staging

## Research Question

Full scope of EX-940: verify the issue's site list against current code, find missed sites, decide
how `REQUEST_FAILED` should behave in the kosztorys autosave lanes and structural ops (incl. the
`persistItemSwap` revert), how the four tree-replacing dialogs should branch, whether an ESLint
`no-restricted-syntax` guard is feasible, and which test patterns to reuse.

## Summary

- **No site missed by the issue; six listed sites are already handled.** 23 unhandled call sites
  remain (13 components/forms/hooks + 10 structural ops in `use-kosztorys-editor.ts`). The form
  submit path (`use-form-submit.ts:32`, `optimistic-form-store.ts:73`) is fully wrapped.
- **What a rejection actually does** (React 19.2, Next 16.1.7): inside an async `startTransition` it
  goes to `(frontend)/error.tsx` — the **page is replaced**, worse than the issue says. A `void`ed
  call or a bare handler is an unhandled rejection with a stuck pending flag.
- **`save-lanes.ts:44` leaks browser English** („Failed to fetch") — confirmed; and
  `save-lanes.test.ts:77-91` currently asserts that pass-through, so it is the red test.
- **`optimistic-setting-save.ts` does NOT leak** — the issue is wrong there; it toasts the caller's
  Polish message. Converting it only adds `logError`.
- **`REQUEST_FAILED` in the lanes = treat like a logical failure (revert + retract + toast), never
  reseed.** `use-debounced-save.ts:39` already routes every non-`NOT_FOUND` code there, so no new
  branch is needed.
- **Structural ops: wrap at the import, not per handler.** Every one of the 10 already has a
  `!success` branch with the correct revert (incl. `persistItemSwap` → `swapItemInSection` +
  `amendTop`); only the rejection path is missing. A `settled(action)` factory beside
  `settleAction` makes each existing branch cover the rejection with no handler-body change.
- **Trap: `logoutAction` redirects, and a redirecting action rejects client-side** by design
  (`server-action-reducer.js:189-209`, verified). `settleAction` would swallow the redirect →
  add `unstable_rethrow(err)` to `settleAction`'s catch.
- **ESLint guard is feasible** as a name-based `no-restricted-syntax` (S1–S5 below): 23 hits today
  = 21 real + 2 false positives; 0 after the fix + 2 justified disables. Misses the 2 sites whose
  action names don't end in `Action`. Flat-config override pitfall confirmed: the env selector must
  be repeated in the new block.

## Detailed Findings

### 1. `settleAction` and the new code

- `src/lib/utils/settle-action.ts:9-19` — returns `{ success: false, error: REQUEST_FAILED }`, no code.
- Change: `ActionErrorCodeT` (`src/types/action.ts:7`) → `'NOT_FOUND' | 'REQUEST_FAILED'`;
  `settleAction` return type `code: 'REQUEST_FAILED'`. **The widening is required**, not cosmetic:
  `use-kosztorys-stage-ops.ts:52,63` pass `res.code` from a `settleAction` result into
  `reportFailure(code?: ActionErrorCodeT)`.
- All code consumers compare `=== 'NOT_FOUND'` — no exhaustive switch, no truthy-code check
  (`use-stale-tree-recovery.ts:17,61`, `use-debounced-save.ts:39`, `save-lanes.ts:36,42`,
  `use-kosztorys-stage-ops.ts:25,52,63`, `use-kosztorys-editor.ts` via `reportFailure`). A new code
  falls through to the generic failure path everywhere.
- **Redirect trap** — `logoutAction` (`src/lib/actions/auth.ts:45`, the only `redirect(` in
  actions/queries) rejects on the client with a redirect error that `RedirectBoundary` must see.
  Fix once in `settleAction`: `unstable_rethrow(err)` (from `next/navigation`) at the top of the catch.
- Generic helper for the editor: `settled(action)` → `(...args) => settleAction(() => action(...args))`,
  in the same file (React-free).

### 2. Unhandled sites outside the editor (13)

| Site                                                               | Shape                                    | Today on rejection                                                                               | Fix                                                                                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/transfers/cancel-transfer-button.tsx:38`           | await, `void`ed handler                  | `setIsPending(false)` never runs; both buttons stuck on „Anulowanie...", reopening doesn't reset | `settleAction`; existing `else` toast at :45                                                                                           |
| `.../editor/dialogs/preset/add-sections-from-preset-dialog.tsx:91` | await                                    | `pending` stuck                                                                                  | `settleAction`; branch :93                                                                                                             |
| `.../editor/dialogs/preset/save-preset-dialog.tsx:39`              | await                                    | `saving` stuck → `canSave` false for the editor's life                                           | `settleAction`; branch :44                                                                                                             |
| `.../editor/dialogs/save-version-dialog.tsx:34`                    | await                                    | same                                                                                             | `settleAction`; branch :36                                                                                                             |
| `src/components/forms/form-fields/warehouse-field.tsx:35`          | await in `startTransition`               | error boundary                                                                                   | `settleAction`; branch :36                                                                                                             |
| `src/components/nav/refresh-data-button.tsx:26`                    | await in `startTransition`               | error boundary                                                                                   | `refreshDataAction` returns `void` → make it return `{ success: true as const }` (`src/lib/actions/refresh.ts:5`), then `settleAction` |
| `src/components/nav/logout-button.tsx:27`                          | `startTransition(() => logoutAction())`  | error boundary                                                                                   | `settleAction` **after** the `unstable_rethrow` fix; only the transport branch returns                                                 |
| `src/app/(auth)/zaloguj/login-form.tsx:25`                         | await in `onSubmit`                      | stuck „Logowanie...", spinner forever                                                            | `settleAction`; `else` :31. Stray `console.log` at :26 goes too                                                                        |
| `.../zaloguj/reset-hasla/reset-password-form.tsx:36`               | await                                    | stuck „Zapisywanie..."                                                                           | `settleAction`; `else` :44                                                                                                             |
| `.../zaloguj/zapomniane-haslo/forgot-password-form.tsx:17`         | await                                    | stuck „Wysyłanie..."                                                                             | action always succeeds (`auth.ts:56-59`), so transport is the only failure; form has no error state — add one (or toast)               |
| `.../editor/hooks/use-auto-snapshot.ts:39`                         | `void snapshotAction()` in `setInterval` | unhandled; marker already advanced at :38, snapshot lost until next edit                         | `void settleAction(...)` — keeps silent fire-and-forget, adds `logError`                                                               |
| `.../editor/actions/save-preset-action.tsx:24`                     | `void getPresetOptions().then()`         | „Nadpisz istniejący" toggle silently absent                                                      | `settleAction(getPresetOptions).then(res => res.success && ...)`                                                                       |
| `src/components/leads/lead-assets-dialog.tsx:75`                   | `void getInvestmentAssetIds().then()`    | `attachedIds` stays `null`, every file „waiting"                                                 | same, keep `cancelled` guard. `attach()` :105-121 already handled                                                                      |

### 3. Kosztorys grid autosave lanes

- Contract `src/lib/kosztorys/save-lanes.ts:33-52`; sole creator `hooks/use-debounced-save.ts:21`;
  `dispatch` (:36-47): `NOT_FOUND` → `onStale` (one-shot reseed, `use-stale-tree-recovery.ts:33-56`),
  anything else → 5 s toast + caller `onError`.
- Consumers: forward cell/stage autosave (`use-kosztorys-editor.ts:1229-1248`, onError =
  `revertOne` + `dropPendingField`/`dropPendingStage`), undo inverse writes (`runGridReversal`
  :748-763), section name/colour (:1109, toast only), stage ops.
- **Decision: `REQUEST_FAILED` reverts, does not reseed.**
  - Both named causes fail before the handler runs (offline `TypeError`; stale action id → Next
    „Server action not found"). „May have landed" is only a mid-response drop — rare.
  - Revert is safe even then: field / stage-progress writes set absolute values (idempotent), and
    retyping resends.
  - Reseed would be wrong: its toast („zmienił się w innym miejscu") lies; `refreshDataAction` rides
    the same dead connection → `STALE_TREE_FAILED`; it resets the undo stack and drops every other
    optimistic edit; it arms the remount latch with no fresh tree coming (the hazard
    `sheet-compare-action.tsx:30-33` documents).
  - Retraction timing holds: an offline `TypeError` arrives inside the 700 ms coalesce window.
- Change: `const res = await settleAction(run); if (!res.success) onError?.(res.error, res.code)`,
  drop the try/catch (settleAction also catches a synchronous throw from `run`).
- Side effect, not in scope: offline typing across N cells → N identical toasts (`toastMessage`,
  `src/lib/utils/toast.ts:9`, has no `toastId` dedupe).

### 4. `optimistic-setting-save.ts`

- :15-22 catch toasts the caller's specific Polish `errorMessage` (e.g. „Nie udało się zapisać
  rabatu", callers `use-kosztorys-settings.ts:88/127/177/199/236/281`). The issue's claim is wrong.
- Convert for consistency + `logError`, but keep the specific message:
  `toastMessage(res.code === 'REQUEST_FAILED' ? errorMessage : res.error, ...)`.
  `optimistic-setting-save.test.ts:44-78` stays green.

### 5. Structural ops in `use-kosztorys-editor.ts` (line numbers have not drifted)

| Line | Handler                                                                      | Action                         | Optimistic | `!success` today                                                                        | Rejection today                                              |
| ---- | ---------------------------------------------------------------------------- | ------------------------------ | ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 775  | `persistItemSwap` (from `handleReorderItem` :877, `runReorderReversal` :782) | `swapItemOrderAction`          | yes        | `swapItemInSection(opposite)` + `amendTop` + `reportFailure`                            | grid order ≠ DB, command stays on stack                      |
| 816  | `handleAddItem`                                                              | `addItemAction`                | no         | `reportFailure`                                                                         | escapes add-menu `onSelect` (`kosztorys-add-menu.tsx:59,75`) |
| 842  | `handleInsertItem`                                                           | `insertItemAction`             | no         | `reportFailure`                                                                         | same                                                         |
| 867  | `handleRemoveItem`                                                           | `removeItemAction`             | yes        | `applyRestoreItem` + `reportFailure`                                                    | row gone in grid only                                        |
| 903  | `runKosztorysRenumber`                                                       | `renumberKosztorysOrderAction` | yes        | `applyKosztorysOrder(revertTo)`                                                         | order ≠ DB                                                   |
| 932  | `persistSectionSwap`                                                         | `swapSectionOrderAction`       | yes        | `swapSection` + `amendTop`                                                              | order ≠ DB                                                   |
| 982  | `handleInsertSection`                                                        | `insertSectionAction`          | no         | `reportFailure`                                                                         | escapes                                                      |
| 990  | `handleAddSection`                                                           | `addSectionAction`             | no         | `reportFailure`                                                                         | escapes via `add-menu:58`                                    |
| 1076 | `handleRemoveSection`                                                        | `removeSectionAction`          | yes        | restores meta + rows                                                                    | section gone in grid only                                    |
| 1196 | `handleAcceptCatalogueName`                                                  | `updateItemFieldAction`        | yes        | patch back + warning toast (no `reportFailure` → no NOT_FOUND reseed; pre-existing gap) | escapes into `catalogue-missing-list.tsx:88,112`             |

- `persistItemSwap`'s revert already exists and is correct: `swapItemInSection` is pure
  (`src/lib/kosztorys/row-ops.ts:133`, tested `row-ops.test.ts:62`); `amendTop` works because the
  command is pushed synchronously (:893-894) before the failure lands.
- **Wrap at the import**: module-level `const swapItemOrder = settled(swapItemOrderAction)` etc.,
  rename the 10 call sites. Each existing `!success` branch then covers the rejection unchanged.
  Rejected: a `runStructural(call, onFail)` helper (moves each revert into a callback for no gain)
  and a new leaf hook (the handlers depend on `setRows`, `prevById`, `amendTop` — EX-702 said not
  to split them out). Precedent: `use-kosztorys-stage-ops.ts:51,62` (per-call `settleAction`).
- `:1160` `handleApplyCatalogueToItems` already has its own try/catch.

### 6. The four tree-replacing dialogs

- `onTreeReplaced` (`use-kosztorys-editor-context.tsx:10`) → `handleTreeReplaced`
  (`kosztorys-editor-v2.tsx:54-57`): `reseed(treeToken)` + `router.refresh()` only when `refetch`.
  Refetch-on-throw exists because these actions wipe-and-reinsert: a commit whose response was lost
  leaves every grid id dead (`efcdfd77`, EX-908).
- Today: clear (`clear-kosztorys-dialog.tsx:24-39`), reload (`reload-from-preset-dialog.tsx:82-98`),
  import (`sheet-import-dialog.tsx:93-113`) share one shape — `!success` toast+return; catch → own
  „…przerwane — odświeżam" toast, close, `refetch: true`; no `logError`.
  `clean-item-texts-action.tsx:21-35` is a `.then/.catch/.finally` chain that does log.
- The research agents disagreed: converting to `settleAction` is safe **only** if the dialog
  branches on `code === 'REQUEST_FAILED'` → close + `refetch: true`; a plain `!success` branch would
  drop the refetch. Net gain: `logError` on three dialogs and one shape; behaviour must not change.
  Keep each dialog's specific „odświeżam" toast on that branch — the generic „sprawdź internet albo
  odśwież stronę" contradicts a dialog that refreshes itself.
- **Gap found**: the versions-drawer restore (`kosztorys-versions-drawer.tsx:45`, already
  `settleAction` since EX-934) also wipe-and-reinserts but never refetches on a post-commit drop;
  recovery happens only when the next write returns NOT_FOUND. `onRestored` is typed `() => void`,
  kept narrow deliberately by the EX-908 review gate.

### 7. ESLint guard

- Probe scripts: scratchpad `lint-probe.mjs`, `override-probe.mjs` (run against real code via the
  ESLint API).
- **Override pitfall confirmed**: a second flat-config block setting `no-restricted-syntax` replaces
  the earlier one's selectors for overlapping files. Extract the `process.env` selector into a
  constant, repeat it in the new block, and copy the env block's `ignores`.
- **Glob pitfall**: `src/hooks/**` also holds Payload hooks (`transfers/`, `investments/`, …) —
  use `src/hooks/use-*.{ts,tsx}`.
- Selectors, with `ACT = [callee.name=/Action$/]:not([callee.name='settleAction'])`:
  - S1 `AwaitExpression:not(TryStatement[handler] > BlockStatement.block *) > CallExpression${ACT}` — 19, all real (28 without the try exclusion)
  - S2 `UnaryExpression[operator='void'] > CallExpression${ACT}` — 1
  - S3 `.then` without a second arg and without a chained `.catch` — 1 false positive (`investor-actions.tsx:78`, catches a stored promise)
  - S4 `CallExpression[callee.name='startTransition'] > ArrowFunctionExpression > CallExpression.body${ACT}` — 1 (logout)
  - S5 bare `ExpressionStatement > CallExpression${ACT}` outside try — 0 today, cheap guard
  - S6 `ReturnStatement > CallExpression${ACT}` — dropped (false positive `kosztorys-editor-v2.tsx:68`, 41 in `src/lib`)
- Files: `src/components/**`, `src/hooks/use-*`, `src/app/**`, `src/stores/**`; not `src/lib/**`
  (actions call actions there).
- Blind spots: 24 of 121 `'use server'` exports don't end in `Action` (13 queries + 11 actions, e.g.
  `getPresetOptions`, `getInvestmentAssetIds`, `applyKosztorysImport`, `toggleUserActive`) — misses
  2 real sites today; aliased imports; `Promise.all`; `onClick={() => fooAction()}` (too noisy: 17
  hits, nearly all handed to catching helpers). Closing the name gap needs a local rule in the style
  of `eslint-rules/no-domain-drift.mjs` that tracks imports from `'use server'` modules.

### 8. Test patterns

- **Harness**: `stubServerActions` (`vitest.config.ts:33-49`) applies to the `dom` project only;
  specs `vi.mock` the action module with `vi.fn()`s, spy `toastMessage` via `vi.hoisted`, and
  silence `logError` with `vi.spyOn(console, 'error')`.
- **Component template**: `src/__tests__/components/investments/trash-investment-button.test.tsx` —
  `mockRejectedValue(new TypeError('Failed to fetch'))`, assert error toast, no success toast, no
  refresh, dialog closed. `clean-item-texts-action.test.tsx:32-41` is the refetch-branch template.
- **Lanes**: `src/__tests__/lib/kosztorys/save-lanes.test.ts:77-91` becomes red → assert
  `onError(expect.not.stringContaining('Failed to fetch'), 'REQUEST_FAILED')`.
- **`use-debounced-save` / `use-stale-tree-recovery`**: no spec. Pinning „REQUEST_FAILED reverts,
  doesn't reseed" needs `src/__tests__/components/kosztorys/editor/hooks/use-debounced-save.test.tsx`
  (`runNow` avoids fake timers).
- **Editor**: renderHook harness in `use-kosztorys-itemless-sections.test.tsx:20-52,85-106` (mocks
  all actions, captures `grid.opts` via `buildV2Grid`, real `createUndoRedoStack`). No spec covers
  `persistItemSwap` today and that spec's tree has one item per section — a new file
  `use-kosztorys-editor-request-failed.test.tsx` with two items in a section: reject
  `swapItemOrderAction`, fire `onReorderItem`, assert rows back in order and `undoDepth === 0`.
  No extraction needed.

## Code References

- `src/lib/utils/settle-action.ts:9-19` — the wrapper; gains `code`, `unstable_rethrow`, `settled`
- `src/types/action.ts:7` — `ActionErrorCodeT`
- `src/lib/kosztorys/save-lanes.ts:40-45` — the English leak
- `src/components/kosztorys/editor/hooks/use-debounced-save.ts:36-47` — failure dispatch by code
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:773-780` — `persistItemSwap`
- `src/components/kosztorys/editor/kosztorys-editor-v2.tsx:54-69` — `handleTreeReplaced`, `handleStaleTree`
- `node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js:189-209` — redirect rejects the action promise
- `eslint.config.mjs` — existing `no-restricted-syntax` (process.env) block

## Architecture Insights

- `settleAction` is a **Null-Object-ish adapter**: it maps an exceptional channel (rejection) onto
  the existing result channel (`{ success: false }`) so every caller has one failure path. Its
  weakness is being opt-in per call site — hence the lint guard. The `settled(action)` factory is a
  **Decorator** applied once per import instead of once per call.
- The lanes deliberately separate „your value was refused" (revert) from „your copy is stale"
  (reseed) by **code**, not message (lessons: „mount-frozen client copy"). `REQUEST_FAILED` belongs
  to the first class.

## Historical Context

- `41e63ec0` — introduced `settleAction`, applied to ~23 files.
- `efcdfd77` (EX-908) — refetch only when the replacing action threw.
- `7f921ab4` (EX-934) — versions drawer, „Popraw literówki", sheet compare.
- `c9cc39a7` — Polish messages for transport/upload/DB failures.
- `context/foundation/lessons.md` — „A mount-frozen client copy…" (code-based recovery, `void
someAction()` as a swallowed-failure shape) and „serialized write lane".

## Open Questions

1. **Four dialogs**: convert to `settleAction` + `REQUEST_FAILED` branch (issue's plan; gains
   `logError`, one shape) or leave their working try/catch (S1 already exempts try blocks, so the
   lint rule doesn't force it)? Recommendation: convert.
2. **Versions-drawer restore refetch gap** — include (same class, small) or file separately?
3. **Lint name gap** — accept the name-based rule (misses non-`Action` names) or write the local
   import-tracking rule? Recommendation: name-based now; the local rule is disproportionate here.
4. Out of scope, noted: toast dedupe for offline typing; `handleAcceptCatalogueName` doesn't route
   NOT_FOUND to the reseed; `runReorderReversal` failure leaves the command on the wrong stack.
