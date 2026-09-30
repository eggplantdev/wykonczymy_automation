# Review-gate ledger — request-failed-actions (EX-940) · 2026-09-30

Scope: `6b02742f...request-failed-actions` (40 files, no untracked). Step 0.5 browser pass skipped —
no browser driving unprompted; manual checks live in `context/foundation/manual-checks.md` § EX-940.

Fan-out: `/10x-impl-review`, `/code-review`, `/tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` (flag-only).

## Findings

- [x] 🟡 WARNING · filed · code-review · `src/components/kosztorys/editor/kosztorys-editor-v2.tsx` · the remount latch stays armed after an interrupted tree replace, so a later unrelated `tree` prop change remounts the grid — pre-existing latch semantics, out of scope for the transport fix; filed EX-950
      test: TDD · dom — recorded in EX-950
- [x] 🟡 WARNING · skipped · code-review · `eslint.config.mjs` · the lint rule matches only callees named `…Action`; a server export without the suffix slips past — accepted in the plan and stated in the config comment; renaming non-`…Action` exports was ruled out of scope
- [x] 🔵 OBSERVATION · fixed · code-review · `eslint.config.mjs` · `IN_TRY` counts any call under a `try` with a `catch` as handled, even inside a nested callback — blind spot now documented beside the selector; the other selector false positives/negatives dropped (none hit in the tree)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/utils/settle-action.ts` · a 5xx or client bug maps to the connection message — `protectedAction` catches handler throws, so only transport failures reach here, and „odśwież stronę" is the right advice for a stale deploy too
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/save-lanes.ts` · a redirecting action inside a lane — no lane action redirects; theoretical
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/save-lanes.ts` · N queued writes offline give N toasts, and a revert may undo a write that committed — plan decision (Phase 2: revert on a non-tree write, refetch only on tree replace)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/nav/logout-button.tsx` · a failure arriving after navigation started — the settled branch only resets pending state; harmless
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/app/(auth)/zaloguj/zapomniane-haslo/forgot-password-form.tsx` · no enumeration leak and no test — the message is generic on both paths; manual check covers it
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts` · `handleApplyCatalogueToItems` kept a hand-rolled try/catch — now `settleAction` like every other structural op
      test: no automated test · — same fold as the covered structural ops (`use-kosztorys-editor-request-failed.test.tsx`)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/kosztorys/editor/actions/investor-actions.tsx` · the share-link mint was exempted with an eslint-disable and still rejected unhandled — now `settleAction`, disable removed
      test: test-driven-debugging · dom — `investor-actions.test.tsx` „says the connection dropped when the mint request never arrived"
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/kosztorys/editor/dialogs/kosztorys-versions-drawer.tsx` · stale `?.` / `?? 0` / `?? '…'` on a narrowed result — removed
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/__tests__/…/sheet-import-dialog.test.tsx` · `onImported` spy never cleared between tests — the global `beforeEach(vi.clearAllMocks)` clears it
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts` · `ActionResultT` import looked unused — still used
- [x] dropped · code-review · other working `.catch` / try sites could migrate to `settleAction` — already decided in the plan; they handle the rejection today
- [x] dropped · code-review · specs assert exact toast durations — consistent with the rest of the suite; not worth churn
- [x] skipped · code-review · no specs for logout / refresh / auth forms / clear / reload dialogs — covered by manual checks; the shared tree-replace path is pinned by the drawer and sheet-import specs
- [x] skipped · code-review · no `RuleTester` spec for the lint rule — a lint config, verified by linting the tree (zero hits after migration)
- [x] 🔴 CRITICAL · dismissed · impl-review · `src/__tests__/…/subcontractor-due-by-plane.test.ts:289` · typecheck error — pre-existing on the base, outside the diff
- [x] 🔵 OBSERVATION · dismissed · impl-review · `context/changes/…/review-gate.md` · untracked file — it is this ledger
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/kosztorys/save-lanes.ts` · comment line over 100 cols — rewrapped
- [x] 🔵 OBSERVATION · fixed · impl-review · `eslint.config.mjs` · `IN_TRY` blind spot — same as the code-review item above
- [x] 🔵 OBSERVATION · dismissed · impl-review · revert-vs-refetch split — plan decision
- [x] fixed · comment-noise · `settle-action.ts`, `save-lanes.ts`, `clear-kosztorys-dialog.tsx`, `reload-from-preset-dialog.tsx` · four comments trimmed to the why
- [x] fixed · comment-noise · `use-kosztorys-editor.ts`, `kosztorys-versions-drawer.tsx` · two restating comments deleted
- [x] dismissed · tailwind-v4-audit · no class changes in the diff — clean
- [x] dismissed · feature-first-structure / module-cohesion-audit / structure-scatter-audit · clean
- [x] fixed · simplify · `src/lib/utils/settle-action.ts` · `settled()` duplicated `settleAction` with a second call shape — deleted; the editor's `settledOps` map inlined as `settleAction(() => …)` at its 10 sites
- [x] fixed · simplify · `eslint.config.mjs` · the new client block repeated `ignores: ENV_IGNORES`, which only the env rule needs — removed; message no longer mentions `settled()`
- [x] fixed · simplify · `src/lib/utils/settle-action.ts` · `RequestFailedT` re-spelled the failure shape — now `FailureT & { code: 'REQUEST_FAILED' }` (`FailureT` exported)
- [x] fixed · simplify · `src/lib/actions/refresh.ts` · return typed as `ActionResultT` instead of an `as const` literal
- [x] fixed · simplify · `save-version-dialog.tsx`, `add-sections-from-preset-dialog.tsx`, `save-preset-dialog.tsx` · `res.error ?? '…'` on a non-optional field — fallback removed
- [x] fixed · simplify · `clear-kosztorys-dialog.tsx`, `reload-from-preset-dialog.tsx`, `sheet-import-dialog.tsx`, `kosztorys-versions-drawer.tsx` · the tree-replace settle/toast/refetch branch was written out four times — extracted to `src/lib/kosztorys/settle-tree-replace.ts`; the restore refusal toast now shares the 6000 ms of the other three (was 4000)
- [x] dropped · simplify · `clean-item-texts-action.tsx` · double success check — same shape as its sibling dialogs; it isn't a tree replace (no reseed on 0 fixes), so it stays out of the helper
- [x] dropped · simplify · auth forms · reuse `FieldError` for the server error — changes markup and role on existing forms for a one-line pattern
- [x] dismissed · simplify · efficiency angle — clean

## Simplify pass

Ran /simplify — 8 applied, 0 proposed, 4 dropped/dismissed; each finding folded into ## Findings
(tagged simplify). No separate report file.

## Tests & suite

- Typecheck: clean except the pre-existing `subcontractor-due-by-plane.test.ts:289`.
- ESLint on touched files: clean.
- Touched specs: 8 files, 37 tests passed (settle-action, save-lanes, optimistic-setting-save,
  use-kosztorys-editor-request-failed, investor-actions, versions-drawer, sheet-import-dialog,
  kosztorys-actions-menu).
- Step 3: no further tests owed — `settleTreeReplace` is pinned through the drawer and sheet-import
  specs.
- Full suite: pending the user's call.
