# Review-gate ledger — szablon-open-speed · 2026-09-28

Scope: branch `szablon-open-speed` vs base `19310ba6` (branch point off `staging`), 29 files, no untracked.
Checks: 10x-impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit (diff-scoped), comment-noise-audit (flag-only). Step 0.5 (browser verification
pass) skipped — no Playwright without an explicit go; the manual checks in `manual-checks.md` stay pending.

## Findings

- [ ] 🟡 WARNING · proposed · code-review · `src/components/presets/template-workshop.tsx:71` · Back/Forward onto a szablon page restores the cached `?open=1` render, the host remounts and runs the open again — a history traversal acts like a row click (evicts whatever the warsztat holds now) — behaviour call for the owner, see close-out
      test: TDD · unit (dom) — a remount from the same cached props after the flag was consumed must not call the action (if the behaviour is changed)
- [x] 🟡 WARNING · filed EX-893 · code-review · `src/lib/actions/investment-action.ts:84` · warsztat writes never carry the szablon the editor was opened for, so a stale warsztat editor's inserts land in whatever szablon is loaded now and the mirror copies them into that szablon's library — pre-existing; the two open-path findings below widen its reach — a gate change on every warsztat write, its own change
      test: TDD · integration — open A, someone opens C, an append-section write expecting A is refused and C's library row stays unchanged (recorded in EX-893)
- [x] 🟡 WARNING · filed EX-893 · code-review · `src/components/presets/template-workshop.tsx:52` · two opens from one tab can commit out of order (open A in flight, Back, open B on another instance) — the page renders B while the warsztat holds A; damage only through the finding above, so it is filed with it
      test: test-driven-debugging · integration — two out-of-order opens; pointer and last rendered szablon agree (travels with the issue above)
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/queries/presets.ts:85` · the top-bar crumb read the szablon name from the cached library, and „Nowy szablon" navigates before the after-response `presets` expiry lands → crumb could render empty — the crumb now reads the name uncached, like the page title
      test: no automated test · — the vitest `next/cache` stub passes `unstable_cache` through, so a cached and an uncached read are indistinguishable below the browser; the browser-level assertion is added to the E2E backlog issue EX-847 (its stale points 2–3 rewritten too), plus a manual check
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/cache/revalidate.ts:58` · the real `expireCollectionsAfterResponse` body was never executed by a spec — case added to `revalidate.test.ts` (nothing expires before the `after` callback, `EXPIRE_NOW` per slug after it)
      test: TDD · unit — the added case is the guard
- [x] 🟡 WARNING · fixed · impl-review · `src/components/tables/data-table/data-table.tsx:210` · prettier drift in 4 changed files (mis-indented `getRowClassName` left by the `onRowClick` removal) — `prettier --write` (also code-review #10, module-cohesion)
      test: no automated test · — formatting
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/kosztorys/retry-on-concurrent-write.ts:31` · shared retry helper logged `[replace-tree]` and toasted „Nie udało się zapisać kosztorysu" for a szablon open — each caller now passes its own label and message (also code-review #6, module-cohesion, feature-first, comment-noise)
      test: no automated test · — log label and copy
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/presets/template-workshop.tsx:76` · the `exhaustive-deps` suppression made the React Compiler skip the host (fresh `[]` props to the editor on every render) — `useEffectEvent` instead, suppression gone
      test: no automated test · — compiler behaviour; the StrictMode-once DOM case still pins the latch
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/preset-content.ts:8` · the content comparison allow-listed top-level keys, so a future content field would compare equal and never mirror — now strips only ids and `settings`
      test: no automated test · — the „unchanged outgoing keeps updated_at" and „switch mirrors an edit" DB cases cover both directions
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/components/presets/template-workshop.tsx:53` · a rejected action (transport error) goes to the error boundary, not the prompt — identical in the deleted `useOpenPreset`, not introduced here
      test: no automated test · — transport-level, unchanged behaviour
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/kosztorys/open-preset-in-workshop.ts:51` · `held.id` never compared with the resolved warsztat id — only reachable in a first-ever provisioning race, and the warsztat already exists in every restored DB
      test: no automated test · — unreachable once provisioned
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/kosztorys/mirror-workshop-preset.ts:85` · an outgoing szablon with an unreadable schema version blocks every open — only after a schema rollback; fails loud and rolls back cleanly
      test: no automated test · — rollback-only edge
- [x] fixed · feature-first / structure-scatter / impl-review F4 / code-review #12 · `src/lib/kosztorys/open-preset-in-workshop.ts:3` · first `lib/kosztorys → lib/actions` import: `mirror-workshop-preset.ts` and `provision-workshop.ts` are server-only orchestrators, not actions — moved into `src/lib/kosztorys/` (spec moved with them)
- [x] fixed · structure-scatter / code-review #12 · `src/lib/kosztorys/retry-on-concurrent-write.ts` · a generic Postgres retry beside `isConcurrentWrite`'s home — moved into `src/lib/db/with-payload-transaction.ts`, `isConcurrentWrite` now module-private
- [x] dismissed · structure-scatter · `src/components/presets/preset-open-href.ts` · first route-href builder under `components/` — feature-first judged it the presets feature's own route contract; the audits split and the move buys nothing
- [x] skipped · structure-scatter · `src/lib/kosztorys/` · 100-file flat directory, proposed `presets/` subdir for 9 files — predates this slice; a 9-file move is its own refactor, not this change's
- [x] fixed · simplify · `src/lib/kosztorys/open-preset-in-workshop.ts:15` · `{ investmentId, tree }` spelled out three times (action return, host state, open result) — one `WorkshopTreeT`, `OpenedWorkshopT` extends it
- [x] dismissed · primitive-reuse-scan · `src/components/presets/template-workshop.tsx` · the one new UI surface composes existing primitives (`PageWrapper`, `PageLoading`, `OpenWorkshopPrompt`) — nothing hand-rolled
- [x] fixed · code-review #11 · `context/foundation/lessons.md` · EX-876 bullet said an `after()` expiry never reaches `pendingRevalidatedTags` — it does; it is flushed after the response, which is why no `x-action-revalidated` goes out
- [x] fixed · code-review #11 · `src/lib/db/snapshots.ts:50` · comment still described the „Przed wczytaniem" snapshot the open no longer writes
- [x] fixed · impl-review F6 · `context/changes/2026-09-28-szablon-open-speed/plan.md` · the five deviations were not recorded, and the „switch away without editing keeps list order" manual check was missing — Deviations addendum added, check added to the registry
- [x] fixed · comment-noise #1 · `src/components/tables/data-table/data-table-row.tsx:3` · restates the component — deleted
- [x] fixed · comment-noise #2 · `src/lib/kosztorys/open-preset-in-workshop.ts:18` · `libraryChanged` comment duplicates the call-site why — deleted
- [x] fixed · comment-noise #3 · `src/lib/actions/kosztorys-presets.ts:160` · restates the action — deleted
- [x] fixed · comment-noise #4 · `src/__tests__/lib/actions/kosztorys-presets.test.ts:583` · verbatim copy of the eviction rationale — deleted
- [x] fixed · comment-noise #5 · `src/__tests__/lib/actions/kosztorys-presets.test.ts:642` · restates the test name — deleted
- [x] fixed · comment-noise #6 · `src/__tests__/components/presets/create-empty-preset-dialog.test.tsx:49` · restates the assertion — deleted
- [x] fixed · comment-noise #7 · `src/lib/kosztorys/provision-workshop.ts:25` · sentence without a verb — trimmed
- [x] fixed · comment-noise #8 · `src/lib/kosztorys/open-preset-in-workshop.ts:29` · vanished-state („used to write") + duplicate — trimmed
- [x] fixed · comment-noise #9 · `src/__tests__/lib/actions/kosztorys-presets.test.ts:612` · vanished-state — trimmed
- [x] fixed · comment-noise #10 · `src/components/kosztorys/editor/dialogs/reload-from-preset-dialog.tsx:91` · argues against the deleted hook — trimmed
- [x] fixed · comment-noise #11 · `src/lib/kosztorys/mirror-workshop-preset.ts:60` · restates signature and body — trimmed
- [x] dismissed · comment-noise #12–15 · `template-workshop.tsx:29`, `preset-open-href.ts:1`, EX-597 call sites, `kosztorys-presets.test.ts:623` · each carries a why at its own site — kept
- [x] dismissed · module-cohesion · `kosztorys-presets.ts`, `tags.ts`, `mirror-workshop-preset.ts`, `preset-open-href.ts`, `template-workshop.tsx`, `data-table.tsx` · scanner export-count flags — one concern each
- [x] dismissed · module-cohesion · `src/components/presets/template-workshop.tsx:19` · „`ServerWorkshopT` export has no consumer" — the DOM spec imports it
- [x] dismissed · tailwind-v4-audit · — · no className added or changed

## Simplify pass

Ran inline (reuse / dedup / efficiency over the slice diff plus the review fixes) instead of the /simplify
skill — the 7-agent fan-out had already covered reuse, cohesion and scatter. 1 applied, 0 proposed;
folded into ## Findings (tagged `simplify`). primitive-reuse-scan: no findings.

## Tests & suite

- Unit + DOM, affected: `presets/`, `kosztorys/editor/dialogs/`, `cache/revalidate`, `actions/investment-action` — 13 files / 81 tests green
- DB integration, affected (5435): `kosztorys-presets`, `kosztorys/mirror-workshop-preset`, `replace-tree-concurrent`, `replace-tree-lost-write`, `kosztorys-restore` — 5 files / 30 tests green
- `tsc --noEmit`: clean apart from the 6 history-spec errors already on `staging`
- eslint on changed files: clean (1 pre-existing `incompatible-library` warning in `data-table.tsx`)
- Full suite: not run in this gate — asked at close-out
