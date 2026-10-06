# Review-gate ledger — kosztorys-reorder-dialog (EX-999) · 2026-10-06

Scope: base `19411c01`, commits `0814181d` `936f4c11` `d350fe04` + uncommitted (in-dialog Cofnij/Ponów,
„Odznacz” removed, „Ustaw kolejność…” in the „Akcje” ⋯ menus via `ReorderHost`). Step 0.5 skipped —
no browser pass driven unprompted.

## Findings

- [x] 🔵 OBSERVATION · dismissed · impl-review · `reorder-dialog.tsx:129-132` · Shift-range takes rows of folded sections — intended: folding is how a whole section is swept into a range, as hidden rows go with a spreadsheet cut; „Zaznaczone: N” shows the count
- [x] 🔵 OBSERVATION · dropped · impl-review · `actions/kosztorys.ts:688` · `investmentId` not zod-validated — matches every sibling but `clearKosztorysAction`; a bad id is a caught SQL error, nothing reachable from the UI
- [x] skipped · comment-noise · `reorder-dialog.tsx:74,169`, `save-lanes.ts:109` · kept — each carries a why the code can't say (history is local because nothing is written yet; a spreadsheet's drag-one-row convention)
- [x] dropped · tailwind-v4-audit + simplify · `globals.css` · hoist `--section-rail-width` to `:root` (and drop `.reorder-list` from the scope) — the scope block keeps every rail/divider dimension together; joining it costs one selector, splitting it would leave the width as the one rail value defined elsewhere
- [x] skipped · structure · `display-order.ts` / `kosztorys-layout.ts` · ordering SQL split across two files — two different writes (pairwise ▲▼ vs whole layout), one file each
- [x] skipped · structure · `src/lib/actions/kosztorys.ts` · pre-existing god module — not this slice's to split
- [x] filed · simplify · `clear-kosztorys-dialog.tsx`, `sheet-import-dialog.tsx`, `reload-from-preset-dialog.tsx`, `kosztorys-versions-drawer.tsx` · the other tree-replacing dialogs don't flush pending cell saves before writing, and each repeats the `startTransition` → `settleTreeReplace` → close block — filed EX-1002 (`useTreeReplace` hook; test disposition recorded there)
      test: TDD · unit (dom) — carried in EX-1002
- [x] dismissed · simplify · `settle-tree-replace.ts:28` · NOT_FOUND → refetch "leaks" into clear / import / preset / versions — it is the editor-wide convention (`action-failure.ts:29` maps any missing row to NOT_FOUND, `reportFailure` reseeds on it), applied at the shared seam; routing reorder through `recoverStaleTree` instead would double-toast
- [x] skipped · simplify · `reorder-dialog.tsx` rows · per-row memoised component / swap the visual-only Radix Checkbox — unmeasured perf, React Compiler is on — revisit on a measured stall with a 1000-row kosztorys
- [x] dropped · simplify · `src/lib/db/kosztorys-layout.ts` · `IS DISTINCT FROM` on the layout UPDATE — saves rewrites of unchanged rows only; one statement per save
- [x] dropped · simplify · `reorder-dialog.tsx:192` · `JSON.stringify` per dragover — microseconds on a two-field object
- [x] dropped · simplify · `reorder-dialog.tsx:71-74` · row labels frozen at open while `sectionMeta` stays live — a cell edit can't happen under the modal
- [x] dismissed · simplify · `save-lanes.ts` · `drainAll` duplicates `drain` — it can't route through `drain` (awaits every lane, not one key)
- [x] dismissed · simplify · `display-order.ts › renumberDisplayOrder`, `useUndoRedo`, a host factory, framer `Reorder` — not matches: the first raises the lock level, the editor stack writes to the server per step, two hosts don't earn a factory, framer has no multi-select block drag
- [x] filed · reuse-scan · `actions/use-tree-rewrite-action.ts:13` · `useTreeRewriteAction` is the existing home for whole-tree rewrite actions and it doesn't flush pending saves either — added to EX-1002 as the hook to grow, not a second one
- [x] dismissed · reuse-scan · `reorder-dialog.tsx` `rowNumbers` · looks like `baseOrdinals` (`section-band-rows.ts:28`) — that one numbers the grid's rows; the dialog numbers its own unsaved layout
- [x] dismissed · reuse-scan · `reorder-dialog.tsx` native DnD handlers + `dropLine`, `toggleSectionSelection` · the repo has no DnD or bulk-select helper; `ColumnOrderDialog` uses framer `Reorder` (single item, no block drag), and the `toggleAll` copies in leads / catalogue have different shapes

## Simplify pass

Ran /simplify (reuse / simplification / efficiency / altitude) — 12 applied, 1 filed (EX-1002), 3 dropped, 3 dismissed, 1 skipped; each folded into ## Findings (tagged simplify). Touched specs, tsc, eslint green; layout DB spec green on 5435.
Ran primitive-reuse-scan (homes from `.reuse-scan.json`) — 1 fixed, 1 folded into EX-1002, 2 dismissed (tagged reuse-scan).

## Tests & suite

Full suite deferred by user (2026-10-06) — the pre-push gate runs it. Green so far: touched specs, `tsc`, `eslint`, layout DB spec on 5435. E2E → EX-1000 (`e2e-backlog`).
