# Review-gate ledger — kosztorys-ai-knowledge-loop (EX-1006) · 2026-10-07

Scope: `df45add9...HEAD` (4 commits, 90 files). Step 0.5 browser verification skipped — Playwright is
not run unprompted; the manual checks live in `context/foundation/manual-checks.md` § EX-1006.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/lib/kosztorys/review-status.ts:46` · picking Zaakceptowana / Odrzucona on a row the agent left out (AI 0) overwrote the typed Przedmiar with 0 — the status→qty rule now fires only for AI > 0
      test: test-driven-debugging · unit — `review-status.test.ts` „leaves the typed Przedmiar of a row with AI %s alone", red on AI 0, now green
- [x] 🟡 WARNING · fixed · impl-review · `src/components/kosztorys/editor/dialogs/catalogue/work-note-dialog.tsx:50` · the comment dialog opens from a grid-cell click, so the grid kept its active cell and its `document` listeners took Backspace / Delete / arrows / Ctrl+A / paste — editing the kosztorys underneath instead of the comment. Keys, paste, copy and cut are swallowed by `ui/datasheet-grid/grid-event-boundary.tsx` around the dialog where the cell renders it (moved there from the Textarea by simplify, so the buttons are covered too); `swallowGridEvent` is shared with `long-text-cell.tsx`
      test: test-driven-debugging · unit (dom) — `grid/cells/ai-review-columns-work-note.test.tsx` opens the dialog from the cell, a `document` spy proves no key/paste reaches it; red without the boundary (7 failed), now green
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:79` · the dialog lives inside a virtualised cell and would unmount if the row scrolled away — the Radix modal locks page scroll while open, so the row cannot leave the viewport
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:19` · `toStatus` used `value in LABELS`, so a pasted `constructor` / `toString` passed as a status — now `Object.hasOwn`
      test: no automated test · unit — contrived paste, and the server's zod enum refuses it anyway
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:55` · Ctrl+C on a derived „Dodana" copied an empty string — `copyValue` now copies the effective status the cell shows
      test: no automated test · unit — one-line display parity with the cell's own value
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/kosztorys/editor/use-kosztorys-editor.ts:1320` · a picked status and the Przedmiar it writes are saved as two field writes — the existing per-field lane pattern (same as stage edits); undo restores both from one batch
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/kosztorys/row-conditions/registry.ts:483` · an engaged „szkic AI" condition on a kosztorys without a draft hides every row — identical to any diagnostic filter with zero matches, and the active-filters bar shows it
- [x] 🔵 OBSERVATION · dropped · code-review · `src/scripts/load-ai-draft.ts:42` · the loader resets every pozycja's status and powód, last duplicate opis wins, no prod-URL guard — a local one-off script whose header documents the reset; `DB_POSTGRES_URL` is the local docker DB
- [x] 🔵 OBSERVATION · skipped · impl-review · `src/lib/kosztorys/sheet-import/build-import-plan.ts:236` · a sheet re-import keeps a row's status while it may change its Przedmiar, leaving a stale Zaakceptowana — changes import behaviour, so it is the owner's call; raised in the close-out
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/actions/work-catalogue.ts:116` · two people editing one katalog comment: last write wins — ~5 users, the same as every other katalog field
- [x] fixed · module-cohesion-audit · `src/components/kosztorys/editor/use-kosztorys-editor.ts:262` · „Oferta" / „Przegląd AI" state was a new cluster inline in the composition root — first extracted to a leaf hook, then folded by simplify into `useKosztorysViewState`, which already derives `view` (AGENTS.md, EX-521)
- [x] fixed · structure-scatter-audit · `src/lib/kosztorys/labels.ts:41` · review status labels lived in `review-status.ts` — moved beside the other kosztorys labels
- [x] fixed · structure-scatter-audit · `src/lib/kosztorys/work-catalogue/types.ts:207` · `RowCatalogueEntryT` was declared in a helper file three modules import — moved to the katalog's types
- [x] fixed · module-cohesion-audit · `src/lib/kosztorys/offer-columns.ts:1` · `OFFER_VISIBLE_COLUMNS` sat in `ai-review-columns.ts`, unrelated to AI — own module
- [x] dropped · module-cohesion-audit · `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:189` · moving the `aiPlannedQty` / `changeReason` definitions into `cells/ai-review-columns.tsx` as factories — they are two `keyCol` / `computedColumn` calls like their neighbours; a factory would only wrap them
- [x] skipped · structure-scatter-audit · `src/lib/kosztorys/offer-columns.ts:1` · column-id lists live in several homes (`client-view/columns`, `workshop-columns`, `offer-columns`, `ai-review-columns`) — pre-existing precedent this slice followed; consolidating into `columns/` is its own change
- [x] fixed · comment-noise-audit · `src/__tests__/lib/kosztorys/review-status.test.ts:24` · comment restated the `apply(before, after)` helper — deleted
- [x] fixed · comment-noise-audit · `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:189` · placement narration trimmed; the owner-only and AI-only rationale kept
- [x] fixed · comment-noise-audit · `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:63` · „instead of editing the cell in place" cut
- [x] fixed · comment-noise-audit · `src/lib/kosztorys/work-catalogue/catalogue-entry-by-row.ts:6` · vanished-state „rather than stored on the pozycja" cut (the file was later deleted by simplify)
- [x] fixed · comment-noise-audit · `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:75` · „are a glance, not a preference" cut while moving the comment into the hook
- [x] dismissed · comment-noise-audit · `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:62` (+ `:150`, `column-selection.ts:141`, `column-config.ts:242`, `serialize-restore-roundtrip.test.ts:174`, `work-catalogue-item-schema.ts:75`, `workshop-columns.test.ts:77`, `row-conditions/registry.ts:480`, `write-catalogue-entry.ts:61`, `load-ai-draft.ts:1`) · flagged for deletion/trim, but each states a why the code cannot (why a switch hides under „Oferta", why a `.catch` exists, what the script resets, why „bez powodu" matters) — kept
- [x] fixed · simplify · `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:1` · the katalog match ran twice — once for the comparison, once in `catalogue-entry-by-row.ts` for the Komentarz column — now one pass returns `entryByItemId`; the second module and its spec deleted
- [x] fixed · simplify · `src/lib/kosztorys/review-status.ts:3` · the four statuses were spelled in the type, the collection options, the zod enum, the DB mapper and the cell — one `REVIEW_STATUSES` tuple + `isReviewStatus`
- [x] fixed · simplify · `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:75` · „Oferta" / „Przegląd AI" state lived in its own hook that re-derived `view` — folded into `useKosztorysViewState`; the toolbar reads `offerAvailable` / `aiReviewAvailable`
- [x] fixed · simplify · `src/components/kosztorys/editor/use-kosztorys-editor.ts:555` · „Przegląd AI" forced its columns through two special cases (`column-selection.ts`, `kosztorys-view-menu.tsx`) — now it adds them to `revealedColumnIds` like any engaged problem; `isAiReviewColumn` deleted
- [x] fixed · simplify · `src/lib/kosztorys/review-status.ts:18` · `effectiveReviewStatus`'s `aiDraft` param was `true` at every caller — dropped
- [x] fixed · simplify · `src/lib/kosztorys/review-status.ts:14` · „the agent offered work" was spelled three ways — one `aiOffered(row)`; „bez powodu" reads `status !== null && status !== 'accepted'`
- [x] fixed · simplify · `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:66` · `WorkNoteCell` carried an `editable` flag duplicating the column's `disabled` — reads dsg's `disabled` prop
- [x] fixed · simplify · `src/components/kosztorys/editor/dialogs/catalogue/work-note-dialog.tsx:20` · hand-rolled `saving` state — `useTransition` + `FormDialogShell` `pending` / `pendingLabel` (the `clear-kosztorys-dialog.tsx` pattern)
- [x] fixed · simplify · `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:36` · read-only status label searched the options list — direct label lookup
- [x] fixed · simplify · `src/__tests__/helpers/document-listener.ts:1` · the `document` spy was written twice (`long-text-cell.test.tsx`, the comment-dialog spec) — one shared helper
- [x] fixed · simplify · `src/scripts/load-ai-draft.ts:22` · own whitespace `norm` for matching — `fold` / `foldDescription`, the sheet import's identity (case, diacritics, known typos)
- [x] fixed · simplify · `src/scripts/assert-local-db.ts:1` · localhost guard copied in `seed-e2e-user.ts` and `seed-worker-payouts.ts`, and `load-ai-draft.ts` checked only for `neon.tech` — one shared `assertLocalDb`
- [x] fixed · simplify · `src/lib/db/work-catalogue.ts:36` · hand-rolled null coercion for `work_note` — `textOrNull`
- [x] skipped · simplify · `src/lib/kosztorys/review-status.ts:20` · „Dodana" is both derived (a row the agent never saw) and storable — choosing one source of truth changes what is saved; its own change
- [x] dismissed · simplify · `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:40` · drop `RowCatalogueEntryT` and the `?? null` — the `?? null` guards a katalog cached before the column existed, and the type is the contract three modules share
- [x] dismissed · simplify · `src/components/kosztorys/editor/use-kosztorys-editor.ts:1320` · two server calls per status click — same as the code-review line above: the per-field lane design
- [x] dropped · simplify · `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:191` · tag the AI class once via a wrapper — `changeReason` merges it with its wrap class and dsg's class props may be functions; a merge helper costs more than four spreads
- [x] dropped · simplify · `src/lib/kosztorys/offer-columns.ts:3` · derive `OFFER_VISIBLE_COLUMNS` from `CLIENT_DOCUMENT_COLUMNS` — it is `actions` plus a positional prefix; slicing would be more fragile than the list
- [x] dropped · simplify · `src/scripts/load-ai-draft.ts:38` · sequential per-row updates — a local one-off over a few hundred rows
- [x] dropped · simplify · `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx:128` · „Oferta" button could share a variant with „Przegląd AI" — cosmetic
- [x] dropped · simplify · `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx:199` · the blank-or-`formatQty` formatter repeats `:302` — one short lambda
- [x] fixed · reuse-scan · `src/scripts/load-ai-draft.ts:20` · the loader's `keyOf` re-spelled the sekcja + opis base that `itemKey` and `keyItems` each spelled inline — one `sectionItemKey` in `sheet-import/item-key.ts`, all three call it
- [x] dismissed · reuse-scan · `src/lib/actions/work-catalogue.ts:116` · `updateCatalogueNoteAction` beside `updateCatalogueItemAction` — the one-field lane is deliberate: the full update would write a stale dialog's prices back
- [x] dismissed · reuse-scan · `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx:94` · `workNoteColumn` shares a name with `tables/work-catalogue.tsx:258` — a dsg column vs a TanStack column; nothing to share but the label
- [x] dismissed · reuse-scan · `src/scripts/assert-local-db.ts:1`, `src/__tests__/helpers/document-listener.ts:1`, `src/components/ui/datasheet-grid/grid-event-boundary.tsx:1` · new primitives — no catalogue entry covers them (already deduped by simplify)
- [x] dismissed · tailwind-v4-audit · — · no findings
- [x] deferred · e2e · `src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx` · load a draft → accept / edit rows → reload → statuses and Przedmiar persisted — deferred to E2E backlog EX-1015

## Simplify pass

Ran /simplify — 13 applied, 0 proposed, 8 dismissed/dropped/skipped; then primitive-reuse-scan against a catalogue of `src/components/{ui,filters,tables}`, `src/hooks`, `src/lib/**`, `src/types`, `src/__tests__/helpers`, `src/scripts` — 1 applied, 3 dismissed. Every finding folded into ## Findings (tagged `simplify` / `reuse-scan`).

## Tests & suite

- typecheck (`tsc --noEmit`) — green
- touched-module specs — 59 files / 527 tests green (3 DB files skipped), plus sheet-import 12 files / 215 tests after the reuse-scan fix
- full suite (unit + integration) — deferred by user
- E2E — deferred to EX-1015

---

# Addendum gate — dogfooding on case 2 („Oliwa”, #180) · 2026-10-07

Scope: uncommitted working tree vs `HEAD` (`b07f1f16f`, staging), 22 files — the addendum in
`change.md` („Addendum (2026-10-07)”). Other sessions' dirty files excluded
(`2026-10-07-template-from-catalogue`, invoice-duplicate work). Step 0.5 skipped — Playwright is not
run unprompted; the owner is dogfooding the editor by hand.

## Findings

- [x] 🟡 WARNING · skipped · impl-review + code-review · `registry.ts` (`no-planned-or-ai-qty`) · „Nowa praca” / „Wstaw wiersz” in „Przegląd AI” lands with Przedmiar 0 and AI przedmiar empty, so the auto-unticked hider removes it at once — before a Przedmiar can be typed. Filters do not latch (only problems do). Owner, 2026-10-07: left as is — re-tick the filter before adding work.
      test: no automated test · — accepted behaviour, nothing to guard
- [x] 🟡 WARNING · fixed · impl-review + code-review · `use-kosztorys-view-state.ts:118` · switching „Przegląd AI” on engaged „bez przedmiaru i bez AI przedmiaru” but left a remembered „z przedmiarem lub AI przedmiarem” engaged → empty grid; the new spec asserted that state. Now ticks the other half back.
      test: TDD · dom — `use-kosztorys-view-state.test.tsx` „engages none of them until the view is switched on again” now expects only `has-note` + `no-planned-or-ai-qty`
- [x] 🟡 WARNING · fixed · impl-review + code-review · `ai-review-columns.tsx:27` · a derived Zaakceptowana / Dodana could not be cleared: „Do sprawdzenia” wrote NULL, which still derives the same status. The menu drops the unset entry wherever the quantities derive a status (Fix A).
      test: TDD · dom — `ai-review-columns-status.test.tsx`
- [x] 🟡 WARNING · fixed · impl-review · `context/foundation/manual-checks.md` · no boxes for the addendum; „cztery kolumny AI” and „do sprawdzenia … bez statusu” stale — new subsection „Dogfooding na „Oliwa””, two lines corrected
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · `queries.ts` (`isFoldSuppressed`) · the auto-engaged hider stood the sekcje folds down for the whole review pass — exempted like the client's hider
      test: TDD · unit — `queries.test.ts` „leaves them standing under the hider „Przegląd AI” engages”
- [x] 🔵 OBSERVATION · fixed · impl-review + code-review · raw `review_status` readers see NULL where the cell shows a derived status — recorded in `kosztorys-editor-domain-notes.md` (no raw reader exists today)
      test: no automated test · — no consumer to guard yet
- [x] 🔵 OBSERVATION · fixed · impl-review · `change.md` / `plan.md` · „Status … not derived” unmarked; plan has no addendum entry — note + pointer added
- [x] 🔵 OBSERVATION · dismissed · impl-review + code-review · `use-kosztorys-view-state.ts:72` · new Set per render while an AI id is stored — compiled client chunk shows the expression in a compiler memo slot keyed on `persistedConditionIds` (`$[3]`)
      test: no automated test · — verified in `.next/dev/static/chunks/src_components_kosztorys_editor_hooks_*.js`
- [x] 🔵 OBSERVATION · dismissed · impl-review + code-review · `column-config.ts` · „AI wartość netto przedmiar” hides on the Brutto axis — same as every netto figure; the axis rule is deliberate and the review is read on netto
      test: no automated test · — by design
- [x] 🔵 OBSERVATION · dismissed · impl-review · `types.ts` (`aiColumnsShown`) · „misnamed” — same name and meaning as the existing column-opts flag (`kosztorys-v2-column-opts.ts:123`); a second name for one toggle would be worse
      test: no automated test · — naming
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `use-kosztorys-editor.ts:498` · toggling recounts every condition — one pass per click
      test: no automated test · — perf, one-off
- [x] 🔵 OBSERVATION · dismissed · impl-review + code-review · `load-ai-draft.ts:63` · agent note overwrites Komentarz — local-only script, documented in its header, Komentarz is where „Przegląd AI” shows the agent's source
      test: no automated test · — local script
- [x] dismissed · code-review · `use-expense-draft-acceptance.tsx` · out of scope — the parallel worker-expenses session's file
- [x] fixed · structure-scatter + module-cohesion + feature-first · `registry.ts` / `use-kosztorys-view-state.ts` · `AI_REVIEW_FILTER_IDS` + `withoutIds` belonged with the set queries — now `editorConditionIds` in `queries.ts`, unit-tested
- [x] fixed · comment-noise · `registry.ts:120` · pair comment („is the whole gate … hides nothing”) false after the view-state gate — trimmed
- [x] fixed · comment-noise · `review-status.test.ts:86`, `column-values.test.ts:86` · comments restating the test name — deleted
- [x] dismissed · comment-noise · `filter-multi-select.tsx:85` · `intro` comment carries the why (unticking hides)
- [x] fixed · simplify · `review-status.ts` · derived Dodana (postdates the reviewed diff) duplicated `statusForTypedQty`'s rules — one `derivedReviewStatus` feeds the cell, the menu and typing
- [x] dismissed · tailwind-v4-audit · — clean

## Simplify pass

Ran inline on the post-fix delta (not the `/simplify` skill — the delta is three functions): 1 applied (`derivedReviewStatus`), 0 proposed, 0 dismissed; folded into ## Findings (tagged `simplify`).

## Tests & suite

Not run — waiting on „odpal testy”. Owed: typecheck + the touched specs (`review-status`, `ai-review-conditions`, `queries`, `column-values`, `column-totals`, `ai-review-toggles`, `use-kosztorys-view-state`, `ai-review-columns-status`).
