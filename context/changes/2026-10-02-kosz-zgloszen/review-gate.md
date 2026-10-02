# Review-gate ledger — kosz-zgloszen (EX-970) · 2026-10-02

Base `4330aa8d` (staging merge-base) → `d2aee70c`, 9 commits, 39 files.
Step 0.5 (browser verification) skipped — no Playwright unprompted; manual checks go to the registry.
Fan-out: 10x-impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit, comment-noise-audit (flag-only) → /simplify (+ primitive-reuse-scan).

## Findings

- [x] 🟡 WARNING · dismissed · impl-review + code-review · `src/lib/leads/erase-lead.ts:63` · erase drops the asset references before `deleteUnreferencedMedia`, so a failed reclaim leaves orphaned media — the documented best-effort contract (`deleteUnreferencedMedia` runs after the write that drops the reference, by design: the reverse order could delete a file a row still names); the plan prescribes this order and the failure is logged
      test: no automated test — the orphan is the accepted outcome, nothing to pin
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/actions/lead-trash.ts:37` · the toast claimed the selected count, not how many leads were actually trashed (an already-trashed id counted twice) — `trashLeads` returns `RETURNING id` row count, the action returns `{ trashed }`, the toast reads it
      test: TDD · integration — `lead-trash.db.test.ts` asserts `{ trashed: 0 }` for an already-trashed id (authored, not run — user deferred tests)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/leads/leads-data-table.tsx:55` · toggling „Skontaktowano" refreshes `data` and cleared every tick — selection now prunes to the ids still on the page instead of resetting
      test: TDD · unit (dom) — `leads-data-table.test.tsx` „keeps the ticks when a refresh brings the same rows back" + „drops the ticks of rows that left the page" (authored, not run)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/db/lead-trash.ts:55` · bulk trash ran one Payload update per id, serially and unbounded — one `UPDATE … WHERE id IN (…) AND trashed_at IS NULL RETURNING id`; the only hook on that write was revalidation, which the action does itself
      test: TDD · integration — covered by the existing `lead-trash.db.test.ts` trash/restore cases (not run)
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/promote-lead.ts:24` · a stale tab can still promote / attach files of a lead that was trashed meanwhile — plan scoped it out; the input is the user's own form data and the result is a normal investment, nothing is lost
      test: no automated test — out of scope by plan
- [x] 🔵 OBSERVATION · dropped · code-review · `src/app/(frontend)/api/webhooks/landing/route.ts` · a trashed-but-not-erased lead whose notify crashed mid-flight is re-notified on a webhook redelivery — needs a crash between capture and notify plus a trash in the retry window; a trashed lead is still live data, so a duplicate mail is harmless
      test: no automated test — unreachable in practice
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/components/tables/data-table/data-table.tsx` · column-visibility toggle relies on `getCanHide()` for the select column — benign, `enableHiding: false` keeps it out of the menu
- [x] 🔵 OBSERVATION · fixed · impl-review · `AGENTS.md:349` · Auth section didn't say a zgłoszenie is erased in place rather than deleted — one clause added
- [x] fixed · simplify (altitude) · `src/components/tables/data-table/data-table.tsx:125` · column reordering could move the select column out of first place — DataTable pins every `enableHiding: false` column in front and keeps it out of the ranks (general mechanism, not a leads special case)
- [x] fixed · simplify (altitude) · `src/components/leads/leads-data-table.tsx:54` · selection identity tied to the `data` array — `{ data, ids }` state pruned during render, no effect
- [x] fixed · simplify (altitude) + module-cohesion-audit · `src/components/tables/data-table/select-column.tsx` · selected-ids context exported from the columns file and the select-cell pattern copied in three tables — one shared `SelectedIdsContext` / `SelectRowCell` / `SelectPageHeader`, adopted by leads and the catalogue picker
- [x] fixed · simplify (altitude) · `src/lib/leads/erase-lead.ts:13` · erase listed the cleared fields inline and the doc comment named the wrong kept set — `ERASED_LEAD_FIELDS` exported, comment corrected, and `src/__tests__/lib/leads/erase-lead.test.ts` fails when a new lead field is neither kept nor erased (authored, not run)
- [x] fixed · simplify (altitude) · `src/app/(frontend)/api/webhooks/landing/route.ts:96` · `isErased` threaded through the assets/held branches — one early return after capture releases the landing assets and acks
- [x] fixed · simplify (reuse) · `src/components/ui/checkbox.tsx` · tri-state header logic hand-rolled in three places — `checkedState(selected, total)`, adopted in `catalogue-diff-table.tsx:170`, `review-lines-table.tsx:81`, `SelectPageHeader`
- [x] fixed · simplify (reuse) · `src/lib/db/lead-trash.ts:4` · local text coercion — `textOrNull` from `row-coerce`
- [x] fixed · simplify (reuse) · `src/components/leads/leads-data-table.tsx:46` · hand-rolled „Bez plików" URL toggle — `useToggleSearchParam`
- [x] fixed · simplify (reuse) · `src/lib/actions/lead-trash.ts:9` · missing-lead message duplicated — `LEAD_MISSING_MESSAGE` from `erase-lead`
- [x] fixed · simplify · `src/components/leads/trash-leads-button.tsx` · `onTrashed` callback only cleared the selection, which the pruning now does — prop removed
- [x] fixed · structure-scatter-audit · `src/components/tables/leads.tsx:52` · row aria-label rebuilt the display-name fallback — `leadDisplayName`
- [x] fixed · comment-noise-audit · `src/lib/db/lead-trash.ts`, `src/lib/leads/lead-display-name.ts`, `src/components/tables/leads.tsx` · restating comments / JSDoc trimmed (incl. the onTogglePage JSDoc and the „Serial…" sentence in the action)
- [x] dropped · comment-noise-audit · `src/migrations/20261002_0_leads_trashed_erased_at.ts` · header line restates the filename — every sibling migration carries the same header; consistency wins
- [x] dropped · simplify (reuse) · `toggleInSet` helper, shared test-fixture builders, a `trashedAt` field factory across collections — params ≈ the code they'd replace, no win
- [x] dropped · simplify (reuse) · `TrashLeadsButton` vs `TrashRowButton` — bulk vs single-row confirm differ in every param; merging is a config object the size of the components
- [x] dropped · simplify (efficiency) · defer the erase reclaim via `after()` — the reclaim already runs after the committed write; deferring it would hide its failure from the action log
- [x] dropped · simplify (efficiency) · `depth: 0` on lead reads, the double fetch in erase, a cached new-count — microseconds on a page used a few times a week
- [x] dropped · simplify · `LeadSourceT` vs `Lead['source']` — same union, the alias predates this change
- [x] dismissed · simplify (reuse) · `stampSequentially` lookalike in another kind — different contract (ordered stamps), not a duplicate
- [x] filed · simplify (altitude) · `src/lib/{cash-registers,equipment,fleet,investments,leads,workers}/purge-trash.ts` · six near-copies of the purge cron body — one runner configured per kind; rewrites five other kinds' crons, needs its own review — filed **EX-975**
- [x] filed · E2E obligation · /zgloszenia → „Do kosza" → /kosz Zgłoszenia → Przywróć → Usuń na zawsze (typed name), galeria inwestycji nietknięta — deferred by plan, filed with label `e2e-backlog` — **EX-976**
- [x] none · tailwind-v4-audit · no findings
- [x] none · feature-first-structure · no findings (its spec-home note is answered by `src/__tests__/lib/leads/erase-lead.test.ts`)

## Simplify pass

Ran /simplify (4 angles + primitive-reuse-scan) — 13 applied, 0 proposed, 1 filed (EX-975), 7 dropped/dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck — pass (post-simplify)
- lint — 0 errors on touched files; 1 pre-existing warning (`useReactTable` incompatible-library); repo-wide 82 warnings, pre-existing
- specs authored, **not run** (user: „no tests now"): `src/__tests__/lib/leads/erase-lead.test.ts`, `src/__tests__/components/leads/leads-data-table.test.tsx`, `src/__tests__/lib/actions/lead-trash.db.test.ts`
- test / test:integration / e2e — deferred by user
