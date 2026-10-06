# Review-gate ledger — kosztorys-summary-resizable · 2026-10-06

Scope: `d350fe04...HEAD` (branch point off `staging`) plus the working tree. Step 0.5 (the browser
verification pass) was skipped because the Playwright MCP is not driven unprompted. The browser
behaviour is covered by the manual checks in `context/foundation/manual-checks.md` §
`kosztorys-summary-resizable`.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `comment-noise-audit`, and the
three structure audits.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/components/kosztorys/summary/totals-panel-overlay.tsx` · the full-width hit strip over the panel edge stole clicks from the grid's last row and its horizontal scrollbar. Only the pill's own width overhangs now.
      test: no automated test · e2e — layout only, which jsdom can't see; covered by a manual check
- [x] 🔵 OBSERVATION · fixed · code-review · `totals-panel-overlay.tsx` · `top` slid on every load as the stored split or the measured height arrived. The transition is now limited to fold/unfold (`settledOpen`).
      test: no automated test · e2e — CSS transition timing; covered by a manual check
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx` · the phone tools menu (z-30) opened under the panel (z-40). The panel is back at z-20, so the toolbar change is reverted (see the simplify altitude finding below).
      test: no automated test · e2e — stacking order needs a real browser; covered by a manual check at 390px
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review F2 · `totals-panel-overlay.tsx` · at full height (the default) the pill was cut in half by the container's `overflow-hidden`. At full height it now drops inside the panel (`top-0`).
      test: no automated test · e2e — clipping is layout only; covered by a manual check
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review F5 · `totals-panel-overlay.tsx` · a click with 1px of jitter didn't fold the panel. Travel under 3px now counts as a click (`CLICK_SLOP_PX`).
      test: no automated test · e2e — jsdom has no pointer capture; covered by a manual check
- [x] 🔵 OBSERVATION · dropped · code-review · `totals-panel-overlay.tsx` · a drag gets stuck if the panel is closed mid-drag. Reaching it means pressing the keyboard toggle while holding the mouse on the handle, which nobody does.
      test: no automated test — unreachable in practice
- [x] fixed · impl-review F1 · `src/components/kosztorys/editor/kosztorys-editor-body.tsx` · a split panel covered the empty / no-results / filter screens and their buttons. They now sit in a wrapper sized to the grid beside the panel.
      test: no automated test · e2e — layout only; covered by a manual check
- [x] fixed · impl-review F3 · `plan.md` · the blank band between grid and panel while dragging down, or during the 200ms slide-in, was unrecorded. It is now documented as an accepted cost.
- [x] fixed · impl-review F4 · `src/lib/kosztorys/totals-panel-height.ts` · the closed/full `top` rule was written twice. It is now one `panelTop`, with a unit test.
- [x] fixed · impl-review F6 · `plan.md` · the stored range was written `(0.15, 1]`; it is now `[0.15, 1]`.
- [x] fixed · impl-review F7 + comment-noise-audit · 15 comments describing the old state, or restating the code, were trimmed or deleted.
- [x] fixed · module-cohesion-audit · `src/hooks/use-persisted-enum.ts` → `use-persisted-value.ts` · the module now holds numbers too. Renamed, `writeEnum` became `writeStored`, the header was rewritten, and 15 importers were updated.
- [x] fixed · module-cohesion-audit · `totals-panel-height.ts` · `PanelSnapT` and `panelTopPx` are no longer exported; nothing outside reads them.
- [x] skipped · structure-scatter-audit · `kosztorys-editor-body.tsx` · extracting the totals-split lines into a hook would only move about 6 lines of wiring.
- [x] dismissed · module-cohesion-audit · `kosztorys-editor-body.tsx` · the size of that module predates this slice.
- [x] dropped · simplify (reuse) · `use-persisted-value.ts` · the `usePersistedNumber` / `usePersistedEnum` skeleton is only 6 lines. A generic version needs stable parse functions and gains nothing.
- [x] fixed · simplify (altitude) · `totals-panel-overlay.tsx` · the z-40 / z-50 escalation rested on a false premise. `.dsg-container` has `will-change: transform` in react-datasheet-grid's CSS, which is its own stacking context, so the frozen columns' z-30 never competes with the panel. The panel went back to z-20 and the toolbar menu to z-30. `change.md`/`plan.md` still state the z-40 reasoning as history, and `sidebar.tsx`'s identical comment is outside this slice.
- [x] fixed · simplify (simplification) · `kosztorys-editor-body.tsx` · removed `pointer-events-none` from the three `EmptyState`s, since they inherit it from the new wrapper.
- [x] fixed · simplify (simplification) · `totals-panel-overlay.tsx` · the drag maths was written twice; it is now `fractionAt`. Dropped the explicit `releasePointerCapture`, which the browser does on `pointerup`. The pointer-up path reuses `endDrag`.
- [x] fixed · simplify (simplification) · `totals-panel-height.ts` · `panelTop` had a redundant full-height branch, because `panelTopPx` clamps to 1 → 0.
- [x] skipped · simplify (reuse) · `totals-panel-overlay.tsx` + `ui/datasheet-grid/{row,column}-resize-handle.tsx` · this is the third pointer-capture drag lifecycle. A `usePointerDrag` hook would take about 4 callbacks, roughly the size of the code it replaces, and each handle keeps its own measurement and propagation rules. Pre-existing drift noted: `ResizableHeader` has no left-button guard.
- [x] dismissed · simplify (altitude) · `totals-panel-overlay.tsx` · `settledOpen` misses the case where `open` itself arrives late at hydration. That is the same behaviour as before the slice (`transition-[height]`), so no regression. The deeper fix, animating on the user's action, would be a new mechanism.
- [x] dropped · simplify (efficiency) · `kosztorys-editor-body.tsx` · the body re-renders once per toggle even when the grid height doesn't change. That costs microseconds, once per click.
- [x] dropped · simplify (efficiency) · `use-persisted-value.ts` · `getSnapshot` re-reads localStorage on every render. A few µs, and the pattern predates the slice.
- [x] dropped · simplify (efficiency) · `totals-panel-overlay.tsx` · writes on release are unconditional, about 40 `getItem`s, once per release. Not worth the code.
- [x] dropped · e2e · the drag gesture. It is cosmetic layout only; the snap/geometry logic is unit-tested and the gesture is covered by manual checks. Filed as EX-1003 and canceled by the owner.

## Simplify pass

Ran /simplify (reuse, simplification, efficiency, altitude): 5 applied, 0 proposed, 7 dropped / skipped / dismissed. Each finding is folded into ## Findings above, tagged `simplify`.

## Tests & suite

- `pnpm typecheck`: passed.
- eslint on the changed files: clean.
- `vitest` on `totals-panel-height.test.ts` + `__tests__/components/kosztorys/summary`: 14 files / 89 tests passed.
- Full suite + build: deferred by user; pre-push runs the unit leg.
