# Review-gate ledger — kosztorys-reorder-dialog (EX-999) · 2026-10-06

Scope: base `19411c01`, commits `0814181d` `936f4c11` `d350fe04` + uncommitted (in-dialog Cofnij/Ponów,
„Odznacz” removed, „Ustaw kolejność…” in the „Akcje” ⋯ menus via `ReorderHost`). Step 0.5 skipped —
no browser pass driven unprompted.

## Findings

- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/lib/db/kosztorys-layout.ts:26-31,77` · lock order: sections → items → investment runs against the replacements (investment first) and `addItem` (items, then the section's FK KEY SHARE) — both can deadlock (40P01) — investment FOR KEY SHARE first, rows FOR NO KEY UPDATE; order argued in the comment
      test: no automated test · integration — a two-connection deadlock repro is timing-bound; the order is argued in the code comment
- [x] 🟡 WARNING · fixed · impl-review · `editor/hooks/use-undo-keyboard.ts:16-33` · Ctrl/Cmd+Z reaches the grid's undo behind the dialog once focus falls to `body` (exhausted „Cofnij”, backdrop click)
      test: test-driven-debugging · unit (dom) — red spec: an open dialog + focus on body, Ctrl+Z never calls the grid's undo; was red, now green
- [x] 🟡 WARNING · fixed · impl-review · `src/__tests__/lib/kosztorys/save-lanes.test.ts:210-229` · planned "two in-flight keys" `drainAll` case gates only one lane — two gated lanes; drain still pending after the first resolves
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `reorder-dialog.tsx:236-241` · a `LAYOUT_STALE` refusal is a dead end: retry and reopen rebuild the same stale order until a page reload — the action answers `NOT_FOUND`, `settleTreeReplace` closes and refetches on it
      test: test-driven-debugging · unit + integration — `settleTreeReplace` spec red → green; DB spec asserts `code: 'NOT_FOUND'`
- [x] 🔵 OBSERVATION · fixed · code-review · `reorder-dialog.tsx:200-202` · dragging a section, the drop line jumps every half-row inside a long section (resolved against the hovered row, not the block) — a section drag resolves against `[data-section-block]`
      test: no automated test · dom — jsdom has no layout; the resolution itself is a node spec (`resolveDropTarget`); manual-checks box added
- [x] 🔵 OBSERVATION · fixed · code-review · `reorder-dialog.tsx:233-245` · list stays editable while the save is pending; moves made in that window are dropped silently — toolbar and list `inert` while pending, Ctrl+Z ignored
      test: no automated test · dom — a sub-second window between click and close
- [x] 🔵 OBSERVATION · fixed · code-review · `__tests__/lib/db/kosztorys-layout.db.test.ts:122` · "another investment's row" case changes the length, so it never reaches the ownership check — swaps a row for the foreign one, length kept
- [x] 🔵 OBSERVATION · fixed · code-review · `__tests__/lib/kosztorys/reorder-layout.test.ts:21-25` · "dropped onto itself" case only proves the tail no-op; the anchor-found branch is unexercised — second case drops a block above an unmoved row
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review + structure · `src/lib/db/kosztorys-layout.ts:9-15` · schema, `KosztorysLayoutT` and the Polish `LAYOUT_STALE` live in a `server-only` `lib/db` module that client code imports — moved to `lib/kosztorys/reorder-layout.ts`
- [x] 🔵 OBSERVATION · fixed · impl-review + structure · `src/__tests__/lib/db/kosztorys-layout.db.test.ts` · action-driven spec filed under the `lib/db` mirror — `git mv` to `__tests__/lib/actions/kosztorys-write-layout.db.test.ts`
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `reorder-dialog.tsx:38` · `RAIL` hard-codes 3px in an arbitrary `var()` class instead of `--section-rail-width` — `@theme inline` token `shadow-section-rail` (colour first, or Tailwind takes the width for the colour slot; compiled output checked), `.reorder-list` joins the rail-width scope
- [x] 🔵 OBSERVATION · fixed · impl-review · `reorder-dialog.tsx:91` · local `applyLayout` shares its name with the DB write `applyLayout` — renamed `pushLayout`
- [x] 🔵 OBSERVATION · fixed · impl-review · `plan.md:247` · Progress 3.1 carries no sha — `d350fe04`
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/capture-auto-snapshot.ts:14` · the snapshot's tree read runs on a second connection, not the transaction — optional `req` threaded through, passed by the layout write (precedent: `replaceTreeWithSnapshot`)
- [x] 🔵 OBSERVATION · dismissed · impl-review · `reorder-dialog.tsx:129-132` · Shift-range takes rows of folded sections — intended: folding is how a whole section is swept into a range, as hidden rows go with a spreadsheet cut; „Zaznaczone: N” shows the count
- [x] 🔵 OBSERVATION · dropped · impl-review · `actions/kosztorys.ts:688` · `investmentId` not zod-validated — matches every sibling but `clearKosztorysAction`; a bad id is a caught SQL error, nothing reachable from the UI
- [x] fixed · code-review · `src/lib/db/kosztorys-layout.ts:77` · `UPDATE investments SET updated_at` duplicates `bumpInvestmentRevision` — now calls it
- [x] fixed · structure · `reorder-dialog.tsx:187-214` · drop-target resolution is pure logic buried in a DOM handler — `resolveDropTarget` in `reorder-layout.ts`, 4 node cases
- [x] fixed · code-review + simplify · `reorder-dialog.tsx:136-161` · copy-a-Set-and-toggle repeated in two handlers, and in `toggle-stat-buttons.tsx` / `add-sections-from-preset-dialog.tsx` — `toggleInSet` in `lib/utils/toggle-in-set.ts`, all four sites use it
- [x] fixed · comment-noise · `reorder-dialog.tsx:185-186` · "one handler for the whole list" restates the code
- [x] fixed · comment-noise · `src/lib/db/kosztorys-layout.ts:6-8` · first sentence restates the type — trimmed in the move
- [x] fixed · comment-noise · `reorder-action.tsx:8`, `reorder-dialog.test.tsx:99,149-150`, `kosztorys-row-actions-menu.test.tsx:66-67`, `kosztorys-editor-toolbar.test.tsx:86` · duplicates of a why already on the source side
- [x] skipped · comment-noise · `reorder-dialog.tsx:74,169`, `save-lanes.ts:109` · kept — each carries a why the code can't say (history is local because nothing is written yet; a spreadsheet's drag-one-row convention)
- [x] dropped · tailwind-v4-audit + simplify · `globals.css` · hoist `--section-rail-width` to `:root` (and drop `.reorder-list` from the scope) — the scope block keeps every rail/divider dimension together; joining it costs one selector, splitting it would leave the width as the one rail value defined elsewhere
- [x] skipped · structure · `display-order.ts` / `kosztorys-layout.ts` · ordering SQL split across two files — two different writes (pairwise ▲▼ vs whole layout), one file each
- [x] skipped · structure · `src/lib/actions/kosztorys.ts` · pre-existing god module — not this slice's to split
- [x] fixed · simplify · `use-undo-keyboard.ts:16-21`, `reorder-dialog.tsx:116-127` · the Ctrl/Cmd+Z / Shift+Z / Ctrl+Y decoding written twice — `undoRedoIntent(event)` exported from the hook, the dialog reuses it
- [x] fixed · simplify · `reorder-dialog.tsx:123` · `stopPropagation` duplicated the guard the window hook already has (an open dialog stands it down) — dropped; the dialog spec now mounts the real `useUndoKeyboard` and asserts the grid's undo is never called
- [x] fixed · simplify · `use-undo-keyboard.ts:25` · `[role="dialog"]` also matches an open Radix popover, which would cost the grid its shortcut — narrowed to `[data-slot="dialog-content"]`; spec case: an open popover still lets the grid undo
- [x] fixed · simplify · `reorder-dialog.tsx:47-60` · `ReorderDialog` was a pass-through wrapper whose only job was `open && <Body/>` — the host gates the mount (`{open && <ReorderDialog onClose/>}`); one component; spec + row-menu mock updated
- [x] fixed · simplify · `reorder-dialog.tsx:298` · hand-rolled tri-state — `checkedState` (`components/ui/checkbox.tsx:48`)
- [x] fixed · simplify · `reorder-dialog.tsx:65-70` · `rows.filter` per section (O(sections×rows)) — `groupBySection` (`lib/kosztorys/row-ops.ts:108`)
- [x] fixed · simplify · `reorder-dialog.tsx:338` · the `<div key>` row wrapper made every row `last:`, so `border-b` never drew between rows — `Fragment`; rows now ruled, the section's last row unruled
- [x] fixed · simplify · `reorder-dialog.tsx:227-229` · per-section `slice().reduce()` numbering (quadratic) — `Map` over `flatItems`
- [x] fixed · simplify · `reorder-dialog.tsx:282,313` · `sectionMeta.get` twice per section — hoisted `meta`
- [x] fixed · simplify · `kosztorys-write-layout.db.test.ts:88-92` · hand-written `SELECT updated_at` — `readInvestmentRevision`
- [x] fixed · simplify · `reorder-dialog.test.tsx:86,110,123,154` · „Przenieś tutaj” lookup written four times — one `moveHere(section)` helper
- [x] filed · simplify · `clear-kosztorys-dialog.tsx`, `sheet-import-dialog.tsx`, `reload-from-preset-dialog.tsx`, `kosztorys-versions-drawer.tsx` · the other tree-replacing dialogs don't flush pending cell saves before writing, and each repeats the `startTransition` → `settleTreeReplace` → close block — filed EX-1002 (`useTreeReplace` hook; test disposition recorded there)
      test: TDD · unit (dom) — carried in EX-1002
- [x] dismissed · simplify · `settle-tree-replace.ts:28` · NOT_FOUND → refetch "leaks" into clear / import / preset / versions — it is the editor-wide convention (`action-failure.ts:29` maps any missing row to NOT_FOUND, `reportFailure` reseeds on it), applied at the shared seam; routing reorder through `recoverStaleTree` instead would double-toast
- [x] skipped · simplify · `reorder-dialog.tsx` rows · per-row memoised component / swap the visual-only Radix Checkbox — unmeasured perf, React Compiler is on — revisit on a measured stall with a 1000-row kosztorys
- [x] dropped · simplify · `src/lib/db/kosztorys-layout.ts` · `IS DISTINCT FROM` on the layout UPDATE — saves rewrites of unchanged rows only; one statement per save
- [x] dropped · simplify · `reorder-dialog.tsx:192` · `JSON.stringify` per dragover — microseconds on a two-field object
- [x] dropped · simplify · `reorder-dialog.tsx:71-74` · row labels frozen at open while `sectionMeta` stays live — a cell edit can't happen under the modal
- [x] dismissed · simplify · `save-lanes.ts` · `drainAll` duplicates `drain` — it can't route through `drain` (awaits every lane, not one key)
- [x] dismissed · simplify · `display-order.ts › renumberDisplayOrder`, `useUndoRedo`, a host factory, framer `Reorder` — not matches: the first raises the lock level, the editor stack writes to the server per step, two hosts don't earn a factory, framer has no multi-select block drag
- [x] fixed · reuse-scan · `use-kosztorys-view-state.ts:140` · `toggleSectionCollapsed` hand-rolls the same Set toggle — now `toggleInSet` (fifth site); view-state + preset specs green
- [x] filed · reuse-scan · `actions/use-tree-rewrite-action.ts:13` · `useTreeRewriteAction` is the existing home for whole-tree rewrite actions and it doesn't flush pending saves either — added to EX-1002 as the hook to grow, not a second one
- [x] dismissed · reuse-scan · `reorder-dialog.tsx` `rowNumbers` · looks like `baseOrdinals` (`section-band-rows.ts:28`) — that one numbers the grid's rows; the dialog numbers its own unsaved layout
- [x] dismissed · reuse-scan · `reorder-dialog.tsx` native DnD handlers + `dropLine`, `toggleSectionSelection` · the repo has no DnD or bulk-select helper; `ColumnOrderDialog` uses framer `Reorder` (single item, no block drag), and the `toggleAll` copies in leads / catalogue have different shapes

## Simplify pass

Ran /simplify (reuse / simplification / efficiency / altitude) — 12 applied, 1 filed (EX-1002), 3 dropped, 3 dismissed, 1 skipped; each folded into ## Findings (tagged simplify). Touched specs, tsc, eslint green; layout DB spec green on 5435.
Ran primitive-reuse-scan (homes from `.reuse-scan.json`) — 1 fixed, 1 folded into EX-1002, 2 dismissed (tagged reuse-scan).

## Tests & suite

Full suite deferred by user (2026-10-06) — the pre-push gate runs it. Green so far: touched specs, `tsc`, `eslint`, layout DB spec on 5435. E2E → EX-1000 (`e2e-backlog`).
