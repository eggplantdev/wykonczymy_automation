# Review-gate ledger — pokaz-wszystkie-pozycje · 2026-09-23

Gate run jointly over all unpushed commits on `zamrozone-brutto-wydatku-netto` (origin/staging..HEAD, 13 commits, 3 changes). Findings are filed in the ledger of the change that owns the file. Step 0.5 (browser pass) skipped — Playwright is not driven without an explicit go.

## Findings

- [x] 🔵 OBSERVATION · skipped · impl-review · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:463` · a section of only-empty pozycje comes back with an unmuted header/footer — a visual judgement, not a defect; turned into a manual check in the registry so the owner decides on screen
      test: no automated test · — visual call, decided in the manual pass
- [x] 🔵 OBSERVATION · dropped · code-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts:437` · `client-empty` evaluated twice (the id set + `applyRowConditions`) — preview-only, memoized, one cheap predicate per row; filtering by the set would couple `documentRows` to one condition id
- [x] dropped · tailwind-v4-audit · `src/components/ui/switch.tsx:13,20` · `h-[1.15rem]`, `translate-x-[calc(100%-2px)]` — stock shadcn geometry, kept for upstream parity
- [x] dropped · simplify · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:76` · `showAllRows &&` in the row class is redundant (hidden rows aren't rendered) — harmless, reads as the intent
- [x] dropped · simplify (efficiency) · `src/lib/kosztorys/row-conditions/queries.ts:150` · filter→map→Set allocates two temp arrays — ~1000 entries, memoized, preview-only
- [x] dropped · simplify (reuse) · `src/components/kosztorys/editor/use-kosztorys-editor.ts:141` · `NO_ROW_IDS` repeats the empty-Set constant pattern — a shared constant buys nothing

## Simplify pass

Ran /simplify (joint run, see zamrozone-brutto-wydatku-netto) — 2 applied, 0 proposed; findings folded into ## Findings (tagged simplify). Report: `/private/tmp/claude-501/-Users-konradantonik-workspace-yolo-wykonczymy/8e2c7b28-971a-4b42-affb-7c9fe83aaf28/scratchpad/simplify-2026-09-23.md`

## Tests & suite

- typecheck — clean
- lint — 0 errors, 83 warnings (pre-existing, none in touched files)
- test (unit + DOM) — 349 files / 4059 passed, 73 skipped
- test:integration (5435 db-test) — 71 files / 332 passed
- test:e2e — not run (never unprompted); `e2e/client-share.spec.ts` edit owes an owner run, tracked as a manual check
- build — not run
- **Archive blocked:** every box in `## Findings` is checked, but the change's manual checks in `context/foundation/manual-checks.md` are unticked → slice stays **in review**
