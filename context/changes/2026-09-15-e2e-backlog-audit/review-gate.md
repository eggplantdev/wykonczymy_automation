# Review-gate ledger — e2e-backlog-audit (branch `e2e-backlog-tests`) · 2026-09-15

Scope: the whole uncommitted slice in the worktree
`/Users/konradantonik/workspace/yolo/wykonczymy-worktrees/e2e-backlog-tests` — 18 modified files,
64 new ones (E2E specs + seeds + DOM specs + `audit.md` + one product fix in
`src/components/forms/inspection-form/inspection-form.tsx`).

Step 0.5 (browser verification pass) **skipped**: the standing rule forbids driving Playwright or
`pnpm test:e2e` unprompted, and the slice adds tests rather than app behaviour — the single product
change it carries (`prefillNextDue`) was found by a red DOM test and is guarded by it.

## Findings

<!-- One checkbox per finding, every source folded in. Most-severe first; bug-finding checks keep
     their native severity, structural/style checks stay tag-free. -->

- [x] 🔴 CRITICAL · fixed · `code-review` · `src/components/forms/inspection-form/inspection-form.tsx:134` · `suggestedNextDue` is never re-synced when something other than `prefillNextDue` writes `nextDueAt` — `form.reset(defaultValues)` after a `keepOpen` submit leaves ref and field disagreeing, so every later type change is silently refused — the ref now tracks EVERY write to the field: lazily seeded from the live form value and re-seeded in `onReset`
      test: test-driven-debugging · unit (DOM) — „podpowiada dalej po zapisie z otwartym dialogiem"; instrument validated by reverting the fix (2 failed / 6 passed), 8 green with it
- [x] 🔴 CRITICAL · fixed · `code-review` · `src/components/forms/inspection-form/inspection-form.tsx:134` · the ref is seeded from `defaultValues.nextDueAt`, but the form's real initial value comes from the restored draft (`use-managed-form.ts:111`) — so on any draft restore the ref is stale from the first keystroke — same root cause, same one-line fix
      test: test-driven-debugging · unit (DOM) — „podpowiada dalej po przywróceniu szkicu" pre-seeds the zustand draft slot before mounting
- [x] 🟡 WARNING · fixed · `code-review` · `package.json:29-37` · six new `seed:*` scripts ran against `DB_POSTGRES_URL` (dev docker 5433) — all six now carry the guarded `source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST"` idiom
- [x] 🟡 WARNING · fixed · `code-review` · `e2e/client-share.spec.ts:167` · `toContain(bare(formatNet(300)))` could not fail — `12 300,00` already contains `300,00`; now `expectNetInDocument` anchors the needle on a left non-digit boundary (verified: `12 300,00` no longer matches, `300,00` does)
      test: test-driven-debugging · e2e — the guard is the assertion itself; boundary checked against both strings
- [x] 🟡 WARNING · fixed · `code-review` · `src/__tests__/components/kosztorys/summary/blocks/subcontractor-summary.test.tsx:115` · the two `.not.toContain` needles carried spaces `moneyIn` had already stripped — replaced by `within(residual).queryByText(…)`
- [x] 🟡 WARNING · fixed · `code-review` · `e2e/kosztorys-share-link.spec.ts:108` · the poisoned-plane leak was read before hydration could re-read the planted localStorage key — the read is now gated on `waitForHydration` of a rendered section name
- [x] 🟡 WARNING · fixed · `test-quality` · `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar.test.tsx:74` · the negative had no known-positive — the chip („Szukaj: „kafle"") is now asserted present first
- [x] 🟡 WARNING · dismissed · `test-quality` · `e2e/investment-lock.spec.ts:99` · false positive — line 96 asserts „Zapisz jako szablon" visible immediately before the three negatives
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/scripts/seed-panel-filter-blind.ts:51` · the blanket catch could let all four creates fail while the script still printed its marker — now `skipSheetSync` + `disableTransaction`, a narrowed catch, and a `payload.count` that throws unless exactly 4 rows landed
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/__tests__/components/kosztorys/summary/settlement-block.test.tsx:134` · the expected `href` was produced by the component's own expression — now pinned to a literal `/inwestycje/${ID}?type=INVESTOR_DEPOSIT,COMPANY_FUNDING,OTHER_DEPOSIT`
- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/__tests__/components/kosztorys/summary/blocks/subcontractor-summary.test.tsx:37` · the plane split and the payout arithmetic rendered identical figures — fixture moved to `wTools: 6_500 / ownTools: 2_500` so the two readings can no longer collide
- [x] 🔵 OBSERVATION · dropped · `code-review` · `src/scripts/seed-client-share.ts` · a `media` orphan per E2E run — the preview Blob store is scratch and is periodically re-restored; not worth a cleanup path in a seed
- [x] dismissed · `audit-drift` · `…/audit.md:495` · false positive — the reviewer counted `it(` lines and missed `it.each`; an authoritative per-file vitest run gives 12, matching the audit
- [x] dismissed · `audit-drift` · `…/audit.md:540` · same false positive — the file runs 10, matching the audit (the entry now cites both halves of the split, 8 + 2)
- [x] fixed · `audit-drift` · `…/audit.md:886` · harness table said 6, the file runs 7 — corrected
- [x] fixed · `audit-drift` · `…/audit.md:358` · the citation named a non-existent file — now `src/__tests__/lib/actions/kosztorys-import.test.ts`
- [x] fixed · `placement-audit` · `src/__tests__/components/kosztorys/editor/grid/menus/sort-and-row-commands.test.tsx` · two subjects in one file — split into `grid/sort-menu-items.test.tsx` (8) and `grid/menus/kosztorys-row-actions-menu.test.tsx` (2), both green
- [x] fixed · `placement-audit` · `AGENTS.md` · the fixtures bullet now names `e2e/fixtures/` as the second legitimate home; the „never needed `renderHook`" line was already repaired in this worktree
- [x] fixed · `module-cohesion` · `e2e/client-share.spec.ts:42`, `e2e/kosztorys-share-link.spec.ts:36`, `e2e/kosztorys-section-headers.spec.ts:21` · three hand-rolled `execFileSync` seeders now call the shared `runSeedScript`
- [x] fixed · `module-cohesion` · 4 specs · `openEditor` and `GridSeedT` hoisted into `e2e/helpers.ts` (`openEditor`, `seedGridInvestments`); the two same-named-but-different `openEditor`s in `investment-lock` / `notification-recipients` deliberately left alone
- [x] fixed · `module-cohesion` · `e2e/work-catalogue.spec.ts:68` / `e2e/fleet-inspections.spec.ts:48` · `expectMoney` and `uniqueAmount` now live in `e2e/helpers.ts`; `expectAmount` folded into `expectMoney`
- [x] fixed · `module-cohesion` · 3 Vitest specs · `bare()` moved to `src/__tests__/helpers/money.ts`; `settlement-block`'s variant normalises to a single space rather than stripping, so it stays local
- [x] fixed · `module-cohesion` · `e2e/invoice-ingest.spec.ts:206` · the shadow is now `openExpenseDialogOnRegister`, delegating to the shared helper after the route change it adds
- [x] dropped · `module-cohesion` · `e2e/kosztorys-route-guards.spec.ts:24` · `readGridRow` overlaps `readSummaryFigures` but returns a different shape (one grid's header→cell map vs a page-wide label→joined-string map); unifying them buys indirection, not reuse
- [x] fixed · `module-cohesion` · two subcontractor specs · the 20-line `ViewPricingT` fixture is now `src/__tests__/fixtures/subcontractor-pricing-row.ts` (`pricingRow(overrides)`), 14 tests green
- [x] fixed · `module-cohesion` · `src/__tests__/components/fleet/fleet-data-table.test.tsx` · the local builder returns a `FleetRowT`, not a vehicle — renamed `fleetRow`, ending the collision with `helpers/fleet.ts`'s `vehicle()`
- [x] fixed · `module-cohesion` · `e2e/investment-panel-filters.spec.ts:109` · the hand-rolled toggle/panel locators are now `expandSummaryPanel`, the mirror of `collapseSummaryPanel`, shared with `kosztorys-global-discount-overrides`
- [x] fixed · `module-cohesion` · `e2e/helpers.ts:139` · `pickComboOption` was documented as expense-form-specific — the doc now says any form's combobox
- [x] skipped · `module-cohesion` · `e2e/helpers.ts` · 536 lines / ~45 exports, two competing seeding conventions — splitting the seed cluster into its own module is a review-worthy refactor touching every spec's import block; not inside a gate whose subject is the specs themselves
- [x] skipped · `module-cohesion` · 5 seed scripts · the kosztorys fixture ladder (investment → kosztorys → section → items) is copied across all of them — a shared builder is the right shape, but it changes what every new E2E fixture is, which deserves its own review
- [x] fixed · `comment-noise` · 7 sites · pure restatements deleted — the three „Podsumowanie panel opens over the grid" copies went with the `openEditor` dedup (the rationale now lives once, on `collapseSummaryPanel`); plus `equipment-registry.spec.ts` („One InfoList entry's value, by its label"), `investments-listing-kosztorys.spec.ts` („Overwrite the „Etap 1" quantity…"), `helpers.ts` („The SignedMoneyDisplay value on a /kasa/[id] page")
- [x] fixed · `comment-noise` · 4 sites · trims — `helpers.ts` lost „Poll until two consecutive reads agree" (mechanism; the three lines above carry the why); `seed-kosztorys-deletes.ts` and `settlement-block.test.tsx` lost their vanished-state clauses; `work-catalogue.spec.ts` tightened. `equipment-registry.spec.ts:141` left alone — it is a one-line risk divider, already minimal
- [x] fixed · `comment-noise` · 10 files · 33 Polish-prose comments translated to English, Polish domain nouns and „…" UI strings kept verbatim inside the English sentences; no test title, `describe`/`it` string or other literal touched. The remaining diacritic hits are English prose quoting Polish strings, which is the repo norm

## Simplify pass

Folded into `## Findings` (tagged `module-cohesion` / `comment-noise` / `code-review`) rather than
kept as a second list. 33 findings: **25 fixed, 3 dismissed, 2 dropped, 2 skipped, 1 dismissed as
already-repaired** — 0 open.

Two findings are deliberately parked as review-worthy refactors rather than filed: splitting
`e2e/helpers.ts` (536 lines / ~45 exports) and hoisting the kosztorys fixture ladder out of the five
seed scripts. Both change what every future E2E fixture looks like, which is its own change, not a
line item in a gate whose subject is the specs.

Two secondary defects surfaced while closing the comment pass and were fixed in the same sweep:
literal U+00A0 / U+202F characters inside two regex literals (`src/__tests__/helpers/money.ts`,
`src/__tests__/components/kosztorys/summary/summary-panel-content.test.tsx`) — `no-irregular-whitespace`
errors, now escaped.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec eslint` over `e2e/`, `src/__tests__/`, `src/scripts/`, `src/components/forms/inspection-form/`
  — 0 errors (30 pre-existing unused-binding warnings, none from this slice).
- `pnpm exec prettier --check` — clean on every file this slice touched. Five repo files fail
  pre-existing, none of them this slice's doing.
- `pnpm test` (both Vitest projects) — **3612 passed, 298 skipped, 0 failed** across 365 files.
- **`pnpm test:e2e` NOT run** — the standing rule forbids it unprompted (~1 h per pass). Every new
  Playwright spec in this slice is therefore authored-but-unrun by design, and that is the one thing
  this gate does not certify.
