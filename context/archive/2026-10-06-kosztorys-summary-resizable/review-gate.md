# Review-gate ledger — kosztorys-summary-resizable · 2026-10-06

Scope: `d350fe04...HEAD` (branch point off `staging`) plus the working tree. Step 0.5 (the browser
verification pass) was skipped because the Playwright MCP is not driven unprompted. The browser
behaviour is covered by the manual checks in `context/foundation/manual-checks.md` §
`kosztorys-summary-resizable`.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `comment-noise-audit`, and the
three structure audits.

## Findings

- [x] 🔵 OBSERVATION · dropped · code-review · `totals-panel-overlay.tsx` · a drag gets stuck if the panel is closed mid-drag. Reaching it means pressing the keyboard toggle while holding the mouse on the handle, which nobody does.
      test: no automated test — unreachable in practice
- [x] skipped · structure-scatter-audit · `kosztorys-editor-body.tsx` · extracting the totals-split lines into a hook would only move about 6 lines of wiring.
- [x] dismissed · module-cohesion-audit · `kosztorys-editor-body.tsx` · the size of that module predates this slice.
- [x] dropped · simplify (reuse) · `use-persisted-value.ts` · the `usePersistedNumber` / `usePersistedEnum` skeleton is only 6 lines. A generic version needs stable parse functions and gains nothing.
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
