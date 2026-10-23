# Review-gate ledger — 2026-10-22-column-width-command (EX-1127) · 2026-10-23

Scope: uncommitted work on `staging` against `HEAD` (05bf89af6) — 7 modified + 8 new files.
Step 0.5 verification pass skipped: driving a browser needs an explicit ask; the user verified
single- and multi-column sizing on :3000 by hand.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `actions/column-width-header-items.tsx:31` · reset item resets the whole selection but showed no count — label „Przywróć domyślną szerokość (N)" when N > 1
      test: TDD · unit (dom) — `column-width-header-items.test.tsx` asserts both counted labels and the single-column hint
- [x] 🟡 WARNING · fixed · impl-review · `plan.md` / `manual-checks.md` · manual check „12,6 → 13 px" contradicted the 40 px clamp — now „120,6 → 121 px"
      test: no automated test · — doc fix; `parse-column-width.test.ts` already pins `['120,6', 121]`
- [x] 🔵 OBSERVATION · fixed · code-review · `ui/datasheet-grid/header-menu.tsx` · Shift `stopPropagation` ran on every header, extension or not — now `extended && e.shiftKey`
      test: no automated test · — two-line guard; jsdom can't reproduce dsg's pointer selection
- [x] 🔵 OBSERVATION · fixed · code-review · `ui/datasheet-grid/header-menu.tsx` · `extension.items` built on every header render — now only while the menu is open with targets
- [x] 🔵 OBSERVATION · fixed · code-review · `actions/column-width-host.tsx` · „Przywróć domyślne szerokości" missed a hand-dragged layerGap — `resetAll` drops every column id
- [x] 🔵 OBSERVATION · dropped · code-review · `lib/kosztorys/parse-column-width.ts` · no maximum on the typed width — drag-resize has none either and the reset undoes it
- [x] 🟡 WARNING · fixed · impl-review · `lib/kosztorys/grid-column-ids.ts` · chrome column ids spelled out three times — one module, used by section-header-cell, row-actions-column, column-sizing, column-width-targets
- [x] 🔵 OBSERVATION · fixed · impl-review · `kosztorys-editor-body.tsx` · every header-menu open re-rendered the whole body — target ids are state in `HeaderMenu`, dialog state in `ColumnWidthHost`
- [x] 🔵 OBSERVATION · skipped · impl-review · `kosztorys-editor-body.tsx:343` · width command is off in read-only while drag-resize works there — changes what a user may do; raised to the user
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md` · `parseColumnWidth` signature and Phase 2 file list stale — amended to `(text, minPx)` and the host
- [x] 🔵 OBSERVATION · fixed · impl-review · `ui/datasheet-grid/header-menu-extension.tsx` · context pattern — `use()` + `<Ctx value>`, provider wrapper removed
- [x] 🔵 OBSERVATION · fixed · impl-review · `change.md` · stale status — set at gate close
- [x] fixed · structure-scatter-audit · `actions/column-width-host.tsx` · „Opcje" opener had no host — `ColumnWidthHost` mirrors `ReorderHost`
- [x] fixed · module-cohesion-audit · `hooks/use-column-width-command.tsx` · a `.tsx` hook rendering menu UI — deleted; JSX moved to `actions/column-width-header-items.tsx`
- [x] fixed · module-cohesion-audit · `lib/kosztorys/parse-column-width.ts` · parsing mixed into the targets module and hand-rolled — own file on `parseDecimalInput`, own spec
- [x] dropped · feature-first-structure · `ui/datasheet-grid/header-menu-extension.tsx` · rename to `.ts` — not worth the churn
- [x] fixed · comment-noise-audit · `ui/datasheet-grid/header-menu-extension.tsx:6` · duplicated contract comment — one comment on `targetIds`
- [x] dismissed · tailwind-v4-audit · — · nothing found
- [x] fixed · simplify · `lib/kosztorys/column-width-targets.ts:6` · "fixed width" rule written twice (`withResize` + `isResizable`) — one `isFixedWidth`, imported by `column-sizing.tsx`
- [x] fixed · simplify · `actions/column-width-host.tsx:56` · stale-id filter on Apply — unreachable: the dialog is modal and Cmd+Z is blocked under an open dialog
- [x] dismissed · simplify · `ui/datasheet-grid/header-menu.tsx:46` · Shift passthrough on every header menu — would change Shift+click where the width command is off
- [x] dismissed · simplify · `ui/datasheet-grid/header-menu.tsx:77` · `menuOpen &&` called redundant — it keeps `extension.items()` off closed-header renders
- [x] dismissed · simplify · `actions/column-width-open.ts` · file name — mirrors `reorder-open.ts`
- [x] dropped · simplify · `hooks/create-json-map-store.ts:77` · `setMany` for one caller — one-line sibling of `set` / `drop`
- [x] dropped · simplify · `lib/kosztorys/parse-column-width.ts:6` · clamp repeated in `ResizableHeader` — one-liner, a helper's params would equal the code
- [x] dismissed · simplify · `column-width-header-items.tsx` vs `column-width-action.tsx` · two copies of a menu-item pair — extract at the third
- [x] dropped · e2e · — · browser-level slice, but the gesture is cosmetic — the manual checks cover it

## Simplify pass

Ran /simplify — 2 applied, 0 proposed, 6 dismissed/dropped (+ the read-only gate, already skipped above); each folded into ## Findings (tagged simplify). Report: /var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.WqsyOBIN94.md

## Tests & suite

- vitest, 6 touched specs (column-width-targets, parse-column-width, create-json-map-store, column-width-dialog, column-width-header-items, kosztorys-actions-menu) — 39 passed
- `pnpm typecheck` — clean
- eslint on the touched files — clean
- full suite / E2E / build — not run (fast legs only)
