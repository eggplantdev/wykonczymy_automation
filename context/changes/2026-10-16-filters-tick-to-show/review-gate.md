# Review-gate ledger — staging sweep e417000f1..e53d16503 · 2026-10-16

Scope: `e417000f1..e53d16503` on `staging` — 53 non-merge commits after the repo-wide comment purge
(the purges `c9488e714` / `e417000f1` / `5c28cfd26` themselves excluded): szablon-own-structure p1–p8 +
gate fixes + migration 2 (merged after the purge), investment-billing-data, umowa / acceptance-protocol,
filters-tick-to-show p1–p4 + follow-ups, small staging fixes.
Step 0.5 (browser verification) skipped — no browser pass unless asked.

## Findings

- [x] 🔵 OBSERVATION · skipped · code-review · `clauses.ts` · hard-coded 8% VAT; §5 cites a brutto figure §3 never states — contract text is the owner's legal wording, kept verbatim; not ours to edit
- [x] fixed · structure-scatter · `src/lib/kosztorys/acceptance-protocol/constants.ts:3` · protokół wrote „sp. z o. o.”, umowa „sp. z o.o.” — one space; protokół aligned to „sp. z o.o.”
- [x] 🟡 WARNING · dismissed · code-review · `src/migrations/index.ts` · M2 `20261016_0_drop_szablon_investments` sorts before the additive `20261016_1_investment_billing_data` — both migrations are already applied on prod, the ordering risk is gone
      test: no automated test · deploy-process ordering, not code behaviour
- [x] 🟡 WARNING · skipped · code-review · `src/components/…/sms-test-dialog.tsx` + `manager-dashboard.tsx` (d7fdee996) · temporary SMS test button visible to every management role in prod — user keeps it as is (temporary)
      test: no automated test · temporary tooling
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/migrations/20261016_0_drop_szablon_investments.ts:19,34` · M2 not idempotent on re-run — already applied on prod, never re-runs; user's call
      test: no automated test · a migration up-twice spec isn't worth it
- [x] 🔵 OBSERVATION · fixed · code-review · `src/collections/work-catalogue-items.ts:24` · REST `DELETE /api/work-catalogue-items/:id` skipped the szablon bump + `'presets'` revalidation — `delete: () => false`; the action deletes through the Local API (overrideAccess)
      test: no automated test · REST path unreachable from the app (admin panel unused)
- [x] dismissed · structure-scatter · `src/lib/kosztorys/print/styles.ts:1-30` · offer/worker prints lack the „Marginesy: Brak” fix — false positive: `styles.ts` already puts the horizontal inset on `body`
- [x] fixed · simplify (altitude) · `src/lib/queries/transfer-filters.ts` `withWorkerDrafts` · „Zgłoszone wydatki” ANDed with ticked types — now ORs like every other Typ option; the audit list keeps narrowing (its dotted Typ path can't sit inside an `or` for the sum tile)
      test: TDD · unit — `transfer-filters.test.ts` „ticked types widen with the drafts instead of narrowing them”
- [x] dismissed · simplify (altitude) · a katalog update doesn't stamp other szablony — the szablon tree is read live and uncached; `presets` holds only names and counts
- [x] 🟡 WARNING · dismissed · code-review · `src/components/dialogs/edit-investment-prefill.tsx` · Protokół/Umowa „Edytuj dane inwestycji” saves the whole record — intentional per 41ca39894, identical to „Edytuj inwestycję”
      test: no automated test · not a defect
- [x] 🟡 WARNING · fixed · impl-review · `plan.md` Progress · all boxes ticked with d43cf87a1 / 5ee08f0ec / 30fbf5466 / b4102b27a
- [x] 🟡 WARNING · fixed · impl-review · `plan.md` + `plan-brief.md:36` · approved deviations recorded in a new „Deviations From the Plan” section; brief row updated
- [x] 🔵 OBSERVATION · dismissed · impl-review · filters plan · „Komentarz” / „Puste pozycje” removed — user-requested in-session; recorded under Deviations
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/kosztorys/empty-grid-copy.ts` · same-group ticks joined with „lub”, groups with „i”
      test: TDD · unit — empty-grid-copy spec asserts the sentence for two ticks in one group
- [x] 🔵 OBSERVATION · dismissed · code-review · `contract-form.tsx` · `EditInvestmentPrefill` mounted per address group → shared `formId` `edit-investment-<id>` — one dialog open at a time, all three edit the same investment, so a recovered failed submit lands in the right form
- [x] 🔵 OBSERVATION · dropped · code-review · `investment-status-inline-select.tsx` · MANAGER can pick from a locked „Zakończona” — refused server-side by `guardInvestmentStatusUnlock` with an error toast
- [x] 🔵 OBSERVATION · dropped · code-review · `contract-planned-net.ts` · full kosztorys tree built on every dialog open — ~40 accounts, one dialog, not a hot path
- [x] 🔵 OBSERVATION · dropped · code-review · `contract-dialog.tsx` · key remount after a save loses manual fields — remount is the re-seed mechanism by design
- [x] 🔵 OBSERVATION · dropped · code-review · `investment-schema.ts` · no NIP/postal-code validation — free text by design; a new rule is a product decision
- [x] 🔵 OBSERVATION · dropped · code-review · `use-hidden-stages.ts` · old `kosztorys-hide-completed-stages` flag not migrated — one-time reset of a view preference
- [x] 🔵 OBSERVATION · dismissed · code-review · `filter-multi-select.tsx` legacy `__none__` now means „no filter” — intended, commented
- [x] fixed · impl-review · `filter-multi-select.tsx:63` · `LEGACY_NONE` documented under the plan's Deviations
- [x] fixed · impl-review · `filter-multi-select.tsx` · dead `selectAll`/`deselectAll` fallback + its keys in pl/uk/ru removed
- [x] dismissed · impl-review · plan's `ai-review-conditions.test.ts` untouched — coverage lives in the registry/queries specs
- [x] fixed · code-review · `acceptance-protocol/form-defaults.ts` · `prefilledClientName`/`prefilledSiteAddress` replaced by `clientNameOf`/`siteAddressOf`
- [x] fixed · code-review · `contract-form.tsx` · reads `isCompany` from the one `defaults` object; `contractPrefillKey` serializes the shared `investmentPrefill`
- [x] dropped · code-review · `20261016_1_investment_billing_data.ts:3` · comment restates AGENTS.md — migration file, not worth a touch
- [x] fixed · code-review · `kosztorys-view-stages-section.tsx` · „Zakończone”/„Aktywne” via `grid` dictionary keys, stable `key`
- [x] fixed · code-review · `kosztorys-filters-menu.tsx` + `catalogue-filters-menu.tsx` · redundant `triggerCount` dropped from both; the rest of the wrappers carry different toggles/intro — kept apart
- [x] dismissed · code-review · Komentarz/Puste removal in 909fb0879 — duplicate of the impl-review line
- [x] dismissed · code-review · `kosztorys-editor-v2.tsx:43-53` · template-only `hasCatalogueEdits` in the shared editor — not worth the churn
- [x] dismissed · code-review · `src/lib/db/templates.ts:100-110` · bump covers trashed szablony while the confirm list shows live ones — intended
- [x] fixed · module-cohesion · `kosztorys-presets.ts` · raw `SELECT name FROM investments` → `src/lib/db/investment-name.ts` `getInvestmentRecordName`
- [x] dropped · module-cohesion · `format-address.ts:15` · `formatBillingParty` to its own file — shares private `joinFilled`, one consumer, churn
- [x] dropped · module-cohesion · `src/lib/investments/prefill.ts` · named after its callers — rename churn
- [x] fixed · module-cohesion · „Nie znaleziono szablonu” / item / section messages → `src/lib/constants/not-found.ts`, used by presets, snapshots, trash, both action gates, kosztorys + template-structure
- [x] dropped · structure-scatter · `investment-form.tsx:211-233,305-325` · address-fields component — two blocks, extraction not worth the churn
- [x] dismissed · tailwind-v4-audit · whole range clean
- [x] dismissed · feature-first-structure · whole range clean
- [x] fixed · comment-noise · stale comments at HEAD (orphaned JSDoc, headless fragments) + ~46 deletions / ~30 trims applied by the comment agent
- [x] dismissed · comment-noise · flagged keepers (`queries.test.ts:116-117`, `template-tree.ts:111`, `kosztorys.ts:42-44`, engaged-option and number-space notes) — load-bearing
- [x] dropped · comment-noise · `kosztorys-presets.test.ts` single-row `it.each` — now two rows, no longer applies
- [x] fixed · simplify · `row-conditions/queries.ts` · facets grouped once (`Map.groupBy`) and checked with `every`
- [x] fixed · simplify · `use-condition-row-latch.ts` · `refresh` is a no-op when disabled instead of a separate branch
- [x] fixed · simplify · `filter-multi-select.tsx` · `deriveSelected` → inline `committed`; the two identical clear rows → one `ClearRow`
- [x] fixed · simplify · `kosztorys-problems-menu.tsx` + `catalogue-problems-menu.tsx` · `isEngaged` derived with `some`
- [x] fixed · simplify · `use-user-list-filters.ts` · one `shown(self, sibling)` rule for the worker and payout groups; `anyPayoutTicked` gone
- [x] fixed · simplify · `row-conditions/registry.ts` · 12 hand-written rate conditions → `TOOL_PLANES.flatMap(rateSourceConditions / rateCeilingConditions)`; ids, labels, order unchanged
- [x] fixed · simplify · `display-order.ts` · one exported `insertSectionSchema` for kosztorys + template-structure
- [x] fixed · simplify · `preset-picker-groups.ts` · `isEditedTemplate` shared by reload + save dialogs
- [x] fixed · simplify · `work-catalogue.ts` · dead `listCatalogueMatchKeys` deleted (gate: typecheck)
- [x] fixed · simplify · `template-tree.ts` · reuses exported `mapSection` from `kosztorys-tree.ts`
- [x] fixed · simplify · `kosztorys-presets.ts` · `savePresetAction` one `withPayloadTransaction`, layout/tree serialized once
- [x] fixed · simplify · `enter-escape-keydown.ts` · moved to `ui/datasheet-grid/`, reuses `swallowGridEvent`
- [x] fixed · simplify · `build-contract-html.ts` + `build-protocol-html.ts` · identical `fill`/`line` → `src/lib/utils/print-document-fields.ts`
- [x] fixed · simplify · `contract/form-defaults.ts` · own `Intl.NumberFormat` → `formatNet`
- [x] fixed · simplify · `add-items-from-catalogue-dialog.tsx` · hook call moved above the comment it doesn't belong to
- [x] dismissed · simplify · `isStageHidden: isStageOff` shim — maps onto the column-opts interface, both names accurate
- [x] dismissed · simplify (altitude) · `use-hidden-stages` key collision — unreachable, szablon has `stages: []`
- [x] dismissed · simplify · `captureTemplateSnapshot` gate copy — `templateAction` would mark the szablon edited
- [x] dismissed · simplify · `keepExistingCatalogueRefs` 3× — three data shapes, already share `existingCatalogueIds`
- [x] dismissed · simplify · `listTemplateSnapshots` unused `templateId` — it is used
- [x] dismissed · simplify · `hideStatus` derivation — `summary-investment-tab.tsx:24` shows the status; reverted
- [x] dismissed · simplify · inline hooks — single-use, cohesive
- [x] dropped · simplify · storage-scope helper (`use-price-view` / `use-engaged-conditions`) — two one-liners
- [x] dropped · simplify · dead `export` on signature types — contracts of exported functions
- [x] dropped · simplify · `droppedWorkerAssignments` optional — used by import and versions drawer
- [x] dropped · simplify · „Nie znaleziono szablonu.” UI copy in two dialogs / „Nie znaleziono sekcji” in two places — unifying changes the text
- [x] dropped · simplify · `isInvestmentStatus` → constants — single consumer
- [x] dropped · simplify · N+1 template inserts — szablon sizes, not a hot path
- [x] skipped · simplify · template-plane SQL twins of kosztorys queries — different tables/columns, a shared builder is a review-worthy refactor
- [x] skipped · simplify · `matchesFacets` shared between kosztorys and catalogue — different row shapes; refactor-sized
- [x] skipped · simplify · partial-patch rework of save paths — behaviour-adjacent, refactor-sized
- [x] skipped · simplify · `status-filter.tsx` changes — another surface's semantics

## Simplify pass

Ran /simplify — 15 applied, 2 held for the user, 17 dismissed/dropped/skipped; each finding folded into ## Findings (tagged simplify). Report: /var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.21GDTYUA2k.md

## Tests & suite

Not run yet — waits for „odpal testy” (touched specs + typecheck; gates the `listCatalogueMatchKeys` deletion).
