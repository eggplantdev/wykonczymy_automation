# Review-gate ledger — szablony-crud · 2026-09-14

Slice scope: `297ad5d1..3af6a728` (branch `szablony-crud`), 33 files.
Fan-out: impl-review, code-review, tailwind-v4-audit, feature-first-structure,
module-cohesion-audit, structure-scatter-audit, comment-noise-audit.
Step 0.5 (browser verification pass): skipped — no `verify-manual-checks` skill installed.

## Findings

<!-- [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — why -->

- [ ] e2e-backlog · gate Step 3 · the browser-level path (otwórz szablon → edytuj → zapisz → warsztat zajęty przez inny szablon) owes a Playwright spec or an `e2e-backlog` Linear issue in project „Wykonczymy" — box checks once one of the two exists

- [x] 🔵 fixed · code-review · `src/migrations/20260914_2_snapshot_template_preset.ts` · the warsztat's version history mixed restore points of different szablony into one date-ordered list — restoring one and saving wrote its content into the szablon now open, which the warsztat pointer cannot catch (after a restore that content IS the warsztat's). Owner's call: stamp + filter, NOT per-szablon warsztaty (that is its own feature, not a gate fix). `kosztorys_snapshots.template_preset_id` is stamped from the investment row inside `insertSnapshot`, so no caller can forget it, and one clause — `IS NOT DISTINCT FROM` the investment's own pointer — scopes both the list and the by-id read. Off the warsztat both sides are NULL and nothing narrows. The by-id half is the real guard: filtering the drawer only shapes what is offered, a stale tab still holds the ids. The drawer already prints the szablon name per row (`investmentName`), so the labelling half needed no UI change — filtering is what makes that name true
      test: TDD · integration — `snapshots.test.ts` „szablon-scoped restore points": listed only under the held szablon, refused by id under another, and a normal investment keeps its whole history
- [x] 🔵 fixed · code-review · `src/migrations/20260914_1_szablon_workshop_constraints.ts` · SELECT-then-INSERT race on the warsztat + a pointer that could outlive its szablon — both moved into the schema: partial unique index `investments_single_szablon_idx` on `status = 'szablon'`, and FK `template_preset_id → kosztorys_presets(id) ON DELETE SET NULL`. A SECOND migration, not an amendment of `20260914_0` — that one is committed and already applied, so editing it would leave every database that ran it without the constraints. Applied to the dev DB and the 5435 test DB; owed on prod before the push
      test: TDD · integration — `workshop-investment.test.ts` „refuses a second warsztat at the database level"; the spec fixtures now BORROW the singleton warsztat (`__tests__/helpers/workshop.ts`) instead of creating one, since the index allows exactly one and `db:import:test` restores production's
- [x] 🟡 fixed · code-review · `save-template-button.tsx:20` · „Zapisz szablon" upserted BY NAME → overwrote/forked/resurrected the wrong szablon (3 scenarios) — now `saveWorkshopPresetAction(presetId)`: re-reads `template_preset_id` at WRITE time and refuses on mismatch; `updatePresetPayload` is an UPDATE, never an upsert, so a deleted szablon cannot be resurrected. `templateName` → `templatePresetId` through the editor context
      test: test-driven-debugging · integration — `__tests__/lib/db/presets.test.ts` asserts the persisted rows for update-vs-upsert
- [x] 🟡 fixed · code-review · `src/lib/queries/reference-data.ts:41` · workbench investment leaked into Kosztorysy v1 and was offerable as a sheet-link target. First fixed per consumer with `isBookableInvestment`, which the /simplify altitude pass showed also dropped _zakończone_ inwestycje from sheet-linking — the warsztat is now excluded once, at the SQL source, and both call-site filters are reverted
      test: fixed · unit — `investment-lock.test.ts` pins that the predicate answers ONE question (`szablon` is unbookable-by-source, not locked)
- [x] 🟡 fixed · code-review + feature-first #2 · `szablony/[id]/page.tsx:39` · GET render performed a write (`resolveWorkshopInvestment` creates) — the page now reads with `getWorkshopInvestmentId` and renders `OpenWorkshopPrompt` when the workbench holds something else (also discharges the plan's „redirect must say why": it explains in place instead of bouncing silently)
      test: no automated test · — provisioning is asserted at the action layer; the page half is a render branch an E2E would cover (see Tests & suite)
- [x] 🟡 fixed · code-review · `lib/db/presets.ts:173` · `String(row.created_at)` on a driver `Date` → TanStack sorted „Utworzono" by weekday name, breaking the default newest-first — now `isoOrNull(row.created_at) ?? ''`
      test: test-driven-debugging · integration — covered by the listPresets assertions in `presets.test.ts`
- [x] 🔵 skipped · code-review · deploy order — the additive migration must be applied to prod BEFORE the push; already the documented human step (`pnpm db:migrate:prod`), nothing to change in code
- [x] 🔵 dropped · code-review · `kosztorys-presets.ts:96` · `renamePreset` false conflates „name taken" with „row gone" — reachable only by a delete racing a rename; both mean „nothing was renamed", not worth a second round trip
- [x] 🔵 skipped · code-review · `preset-row-actions.tsx:70` · owner-only buttons render for MANAGER — the server refuses and toasts; hiding them would mean threading the role into every row, and this mirrors how the rest of the app presents owner-only actions
- [x] 🔵 dropped · code-review · `szablony/[id]/page.tsx:22` · `notFound()` before auth for a non-numeric id — discloses nothing beyond „this route exists"
- [x] 🔵 dropped · impl-review · `collections/investments.ts:12` · `szablon` is pickable in the /admin status select — Payload's select has no per-option hide, so this needs a custom field component for an owner-only surface; the intent is documented at the option
- [x] fixed · structure (all three audits) · `components/tables/presets.tsx:9` · `PresetRowT` stranded in a `'use client'` column module — moved to `lib/queries/presets.ts` beside the read that produces it (not `lib/db`, which owns statements + row mappers, not view rows); all three consumers repointed
- [x] fixed · feature-first #1 · `szablony/page.tsx:17` · tally fold was read-shaping in the routing tier — now `getPresetRows()` in `lib/queries/presets.ts`; the page is auth + render
- [x] dismissed · feature-first #4 / cohesion #2 · `lib/db/workshop-investment.ts:17` · Payload-ORM write inside the raw-SQL DAL — provisioning has to go through `payload.create` to run the collection's hooks; precedent `stamp-sequentially.ts:27`. The read/write split now makes the one ORM call the only thing in `resolveWorkshopInvestment`
- [x] dismissed · cohesion #3 · `lib/actions/kosztorys-presets.ts` · watch-for-growth on the workbench half — one more action added; still one cohesive preset-library module
- [x] fixed · comment-noise · 2 deletes, 7 trims, 2 moves applied (`tables/presets.tsx:8` fell out with the type move; `use-kosztorys-editor-context.tsx:21`, `szablony/[id]/page.tsx:11`, `workshop-investment.ts:13/36/8`, `kosztorys-presets.ts:84/118`, `presets.ts:145`, `presets.test.ts:135`, `use-status-filter.ts:7`)
- [x] fixed · comment-noise · `collections/investments.ts:169` · rationale named a `payload.update` write path the code never takes — rewritten to the true reason (the column must be in Payload's drizzle schema and generated types at all)
- [x] dropped · comment-noise · triple-stated „szablon workbench" preamble (`investment-lock.ts:17`, `workshop-investment.ts:8`, migration:4) — each file is read alone and needs its own one-liner; deduping would leave two of the three pointing elsewhere
- [x] dismissed · tailwind-v4-audit · 0 findings attributable to this slice

- [x] fixed · simplify · `lib/db/workshop-investment.ts:12` · two round trips to read the warsztat → one `getWorkshop(db)` returning `{ id, presetId }`; both old helpers gone
- [x] fixed · simplify · `szablony/[id]/page.tsx:30` · whole jsonb payload loaded to render a title → `getPresetName`, and the two now-independent reads run in one `Promise.all`
- [x] fixed · simplify · `szablony/[id]/page.tsx:28` · `getPayload`/`getDb` plumbing in the routing tier → `getWorkshopView()` in `lib/queries/presets.ts`
- [x] fixed · simplify · `kosztorys-presets.ts:129` · `openPresetInWorkshopAction` returned an id nobody read, and called another ACTION (re-paying auth + a perf span) → plain `ActionResultT`, body shared via `lib/kosztorys/reload-from-preset.ts`
- [x] fixed · simplify · `components/presets/use-open-preset.ts` · the open-szablon transition was duplicated in the row actions and the prompt → one hook, one post-open destination
- [x] fixed · simplify · `open-workshop-prompt.tsx:26` · hand-rolled card → `EmptyState`; `preset-row-actions.tsx:104` · hand-rolled rename dialog → `FormDialogShell` (+ `pending` pass-through)
- [x] fixed · simplify · `szablony/page.tsx:9` · `requireManagementPage()` instead of a hand-rolled auth+redirect; `[id]/page.tsx` takes `DynamicPagePropsT`
- [x] fixed · simplify · `lib/db/presets.ts:169` · `renamePreset` → `boolean`, matching its two siblings; `WORKSHOP_INVESTMENT_NAME` unexported; `getPresetRows` no longer looks the same tally up twice
- [x] dismissed · simplify · `lib/db/presets.ts:193` · `isoOrNull(…) ?? ''` — a type narrowing on a NOT NULL column, not dead defence
- [x] dismissed · simplify · `lib/kosztorys/types.ts` · narrowing the UI status maps to exclude `szablon` — the warsztat stays reachable by direct id URL, so the maps must cover it
- [x] skipped · simplify · `preset-row-actions.tsx:43` · `IconActionButton` extraction — 5 copies across two feature dirs; its own review, not this slice
- [x] skipped · simplify · `lib/cache/tags.ts` · splitting the `presets` tag — cache-correctness change, and not worth it at this library size

## Simplify pass

Ran /simplify — 12 applied, 0 proposed, 2 dismissed, 2 skipped; each finding folded into `## Findings` (tagged `simplify`).
Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.fsKtSQ9dFh.md`

## Tests & suite

- `pnpm typecheck` — pass.
- `eslint` + `prettier` on every touched file — clean.
- New specs, run against the isolated 5435 `db-test` (24 passed, 4 files):
  - `src/__tests__/lib/db/workshop-investment.test.ts` (new) — the warsztat is found by STATUS, not recency, and reports the szablon it holds.
  - `src/__tests__/lib/db/presets.test.ts` — `updatePresetPayload` overwrites in place by id, and resurrects nothing when the szablon was deleted while open (the upsert bug's regression guard).
  - `src/__tests__/lib/actions/kosztorys-presets.test.ts` — `saveWorkshopPresetAction` writes into the szablon the warsztat holds and refuses, writing nothing, when it holds another.
  - `src/__tests__/lib/db/snapshots.test.ts` — restore points are scoped to the szablon the warsztat holds, by list AND by id; a normal investment is untouched.
- Migrations `20260914_1` + `20260914_2` applied to the dev DB (5433) and the test DB (5435). Prod owes both, BEFORE the push (additive).
- `src/__tests__/lib/constants/investment-lock.test.ts` — 4 passed after the altitude revert.
- Full suite (`typecheck && lint && test && build`) + `test:e2e` — not run yet; awaiting the go.
- E2E obligation (gate Step 3): not yet authored or filed — see the open box above.
