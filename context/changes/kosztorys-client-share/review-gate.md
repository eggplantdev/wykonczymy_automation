# Review-gate ledger — kosztorys-client-share (S-13 / EX-532) · 2026-07-20

Scope: `fe143fbe..068524a7` (8 commits, 32 files).
Step 0.5 verification pass: **skipped** — no `verify-manual-checks` skill installed; owner deferred the manual pass.
Fan-out: 7/7 checks ran (impl-review, code-review, tailwind-v4, feature-first, module-cohesion, structure-scatter, comment-noise).

**Impl-review verdict: REJECTED** — not on the leak boundary (which holds, three tested layers), but on delivery: the public route is unreachable.

## Findings

<!-- Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings carry a test disposition sub-line. Most-severe first. -->

- [x] 🔴 CRITICAL · fixed · `impl-review` · `src/proxy.ts:5-16` · `/k/<token>` 307s to `/zaloguj` — the matcher catches it and the public allowlist is only `/privacy`, `/usuwanie-danych`, `/terms`. Phase 4 is functionally undelivered. Root cause: the plan's premise "no `middleware.ts`, so a new route group is public by construction" — Next renamed it to `proxy.ts`; the research grepped the old filename and recorded an absence as a fact.
      test: test-driven-debugging · e2e — **filed EX-550** (`e2e-backlog`): cookie-less GET of `/k/<token>` returns 200 and renders, not 307. Browser-level guard, deferred into the E2E backlog per the gate (this slice owes it authored or filed; filed). Discharges impl-review F2 (no test asserts public reachability).

- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/queries/client-kosztorys.ts:40` · the unauthenticated path calls `fetchReferenceData()` — 6 queries returning ALL users (name/role/email) and ALL investments (address/phone/email/notes) — to consume only `expenseCategories`. Nothing leaks today; one identifier away from a company-wide PII disclosure with no auth in front of it. Fetch only the categories.
      test: TDD · integration — assert the client read path never materializes users/investments reference data.

- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/kosztorys/column-config.ts:106` + `v2-columns.tsx:458` · `CLIENT_VISIBLE_COLUMNS` is NOT the independent second lock its comment and test claim. `subcontractor-columns.tsx:85` and `v2-columns.tsx:221` both use `id: 'price'`, and `price`/`net`/`gross`/`plannedNet`/`remaining` are all allowlisted, all computed at whatever `view` is passed. The allowlist keys on column IDENTITY; the leak axis is `view`. Verified by grep.
      test: test-driven-debugging · unit — `v2-columns-readonly.test.ts:37-43` asserts a strictly weaker property than its comment states. Either make the filter view-aware (real second lock) or correct comment + test to claim only what holds.

- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/queries/client-kosztorys.ts:21-28` · `expenseCategories` is baked into the cached payload but absent from `KOSZTORYS_TAGS`, and no `revalidate` is set — so tags are the only invalidation. Renaming/adding a category never reaches the client footer. Stale forever.
      test: TDD · unit — assert the tag list covers every input baked into the cached view.

- [x] 🟡 WARNING · fixed · `code-review` · `src/components/kosztorys/kosztorys-share-dialog.tsx:37-40` · `void ...then()` with no `.catch` → unhandled rejection + dialog stuck on „Sprawdzanie…" forever. Worse: the `res.success === false` branch sets `loaded = true` but leaves `token` at its prior value, so a revoked link renders as live.
      test: TDD · unit — assert the failure branch nulls the token.

- [x] 🟡 WARNING · fixed · `code-review` + `impl-review F6` · `src/lib/actions/kosztorys-share.ts:26-33` · `getShareLinkAction` is the only one of three missing `isAdminOrOwnerRole`. A MANAGER reads and distributes a bearer token they cannot rotate or revoke — the asymmetry is the wrong way round. Also hide the dialog from non-owners.
      test: TDD · integration — a MANAGER gets no token back.

- [x] 🟡 WARNING · fixed · `impl-review F4` + `comment-noise` · `client-kosztorys-footer.tsx:198-218` · section **pie** specified in `design.md:100,114` and `plan.md:49,223,231`; a table shipped instead. The stale `types.ts:161` "for the pie" comment is the fossil of the dropped requirement — two checks found opposite ends of one miss.
      test: no automated test · — visual; covered by the manual checks.

- [x] 🟡 WARNING · fixed · `tailwind-v4` · `src/app/(share)/layout.tsx:15` · `<body>` has no `bg-background text-foreground`. Light theme masks it; under `.dark` the tokens flip while the body stays white — dark cells on a white page, on the client-facing surface.
      test: no automated test · — visual; belongs in the manual checks.

- [x] 🟡 WARNING · fixed · `tailwind-v4` · `src/app/(share)/layout.tsx:14` · `abcFavorit.variable` / `spaceMono.variable` never applied, so `--font-heading` / `--font-mono` are undefined and every such utility silently falls back. The client sees a different typeface than the owner.
      test: no automated test · — visual.

- [x] 🟡 WARNING · fixed · `impl-review F5` + `code-review` · `podglad-klienta/page.tsx:8-13` · `getClientKosztorysPreview` throws on a dead session → 500 via `global-error`, where every other investment page `redirect('/zaloguj')`s. Non-existent investment also 500s instead of `notFound()`.
      test: TDD · integration — assert 404 for a missing investment.

- [x] 🟡 WARNING · dismissed · `impl-review F3` + `code-review` · `client-kosztorys.ts:35-49` · unscoped per-category material cost breakdown reaches the client, and can include a row labelled `"Korekta (bez kategorii)"` — an internal bookkeeping artifact. Figures probably intended (they match the sheet's Podsumowanie); the label is not.
      Owner ruling 2026-07-20: **keep both as-is** — the figures and the „Korekta (bez kategorii)" label both match what the sheet's Podsumowanie already shows a client. No test owed.

- [x] 🟡 WARNING · fixed · `code-review` · `src/lib/kosztorys/to-client-view.ts:39-49` · `hiddenInExport` is ignored — every row is projected. Verified: the field is read in `queries/kosztorys.ts:99` and lives in `v2-rows.ts` `ITEM_FIELDS`, but is never used as a filter anywhere. AGENTS.md describes the offer view as which columns **and rows** the owner hides. This is the flag's one natural consumer.
      Owner ruling 2026-07-20: **honour it**. Filtered into `visibleRows` BEFORE the subtotals, not just before the row projection — a hidden row still counted in the totals would leave the client's visible rows summing to one figure while the footer showed another.
      Follow-up **filed EX-549** (owner-requested): the projection honours the flag but the editor has no control to _set_ it. Out of this slice's scope — a new authoring surface (column-config toggle key, cell renderer, row-menu affordance, hidden-columns/axis maps), explicitly ABSENT from `CLIENT_VISIBLE_COLUMNS`.
      test: TDD · unit — a hidden row is absent from `rows` AND from every subtotal, share and stage total.

- [x] 🔵 OBSERVATION · fixed · `impl-review F9` · `src/lib/kosztorys/types.ts:157` · the „komentarz" free-text `note` reaches the client unreviewed. Owner-authored internal notes on a client-facing page.
      Owner ruling 2026-07-20: **drop it from the client DTO**. Removed from `ClientKosztorysRowT` and from `CLIENT_VISIBLE_COLUMNS`.
      test: TDD · unit — `v2-columns-readonly.test.ts` asserts `note` is not among the client-visible column ids.

- [x] 🔵 OBSERVATION · fixed · `code-review` + `impl-review F7` · `src/lib/actions/kosztorys-share.ts:60,75` · the `['kosztorysShares']` revalidation is dead (nothing is cached under that tag — the token lookup is deliberately uncached) AND duplicated (the collection already registers `makeRevalidateAfterChange`/`AfterDelete` for it at `kosztorys-shares.ts:26-27`).

- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/__tests__/lib/queries/client-kosztorys-token.test.ts:22` · hardcoded `'test-token-ex532-share'` against a globally unique column; a crash between `beforeAll`/`afterAll` wedges every later run until someone clears the row by hand. Per-run suffix.

- [x] 🔵 OBSERVATION · fixed · `impl-review F8` · `src/lib/actions/kosztorys-share.ts:49-57` · concurrent `generate` surfaces a raw DB constraint error instead of a handled result.

- [x] 🔵 OBSERVATION · fixed · `impl-review F10` · `change.md:3` · slice id drift: `S-11` in the change file vs `S-13` in the roadmap. Also `plan.md:361` — the plan's own test command passes vacuously because the 7 DB specs `skipIf(!ENV_READY)`; boxes 1.4 and 4.3 were ticked on a green run that skipped them.

- [x] fixed · `structure-scatter` + `feature-first` (converged) · `src/components/kosztorys/client/to-grid-rows.ts` · pure domain adapter (no JSX, no `'use client'`) in the component tier; `src/lib/kosztorys/` owns every other kosztorys transform 34:1. Move + update the one importer at `client-kosztorys-view.tsx:12`. It also has no spec while its twin `treeToRows` does.
      test: TDD · unit — cover `NO_SUBCONTRACTOR_PRICING` and the "index IS display order" assumption.

- [x] fixed · `tailwind-v4` · `client-kosztorys-view.tsx:65` · `grid-cols-[minmax(0,1fr)]` → `grid-cols-1` (byte-identical in v4). The comment at `:60-62` names the class, so it changes in the same edit.

- [x] fixed · `comment-noise` · 9 sites · 1 delete (`kosztorys-share.ts:25`, restates the signature) + 8 opener-line trims of one repeated shape: a JSDoc line restating the symbol above a genuinely load-bearing rationale paragraph. Keep every rationale; cut the openers. ~10 lines of ~120.

- [x] fixed · `comment-noise` · `kosztorys-v2-columns.tsx:423` vs `kosztorys-v2-column-opts.ts:53` · the "callback-less cell still takes focus" gotcha is written out in full twice; the declaration site is the better single home.

- [x] dismissed · `code-review` · `src/app/(share)/k/[token]/page.tsx` · no rate limiting on the public route — 192 bits of entropy makes guessing infeasible, so this is a DB-query amplifier, not an enumeration risk. Belongs in a Vercel firewall rule on `/k/*`, not app code.

- [x] dismissed · `code-review` · `to-grid-rows.ts:58` · the `as KosztorysV2RowT` cast weakens the type-level lock — but `treeToRows` has the identical cast, so it is pre-existing style, not a regression this slice introduced.

- [x] dismissed · `comment-noise` · `k/[token]/page.tsx:5` vs `client-kosztorys.ts:63` · the enumeration rationale appears twice deliberately — the query owns _why null_, the page owns _why null → 404_. Two halves of one boundary at their own enforcement points.

- [x] dismissed · `feature-first` · `v2-columns-readonly.test.ts` placement · three prior specs already follow the same pattern; fixing the mirror is a separate sweep, not a slice regression.

- [x] dismissed · `module-cohesion` · all 8 new files · 0 splits, every file one reason to change. `client-kosztorys.ts`'s unexported builder flagged explicitly as load-bearing — do NOT let a reuse pass hoist it.

## Simplify pass

Ran `/simplify` — 4 cleanup agents (reuse / simplification / efficiency / altitude), parallel. Strong
convergence: 3 of 4 independently flagged the footer↔Podsumowanie duplication. Findings folded below
(tagged `simplify`); no separate list.

- [x] fixed · `simplify` (reuse+simplification+altitude, 3-way converge) · `client-kosztorys-footer.tsx` + `kosztorys-podsumowanie.tsx` · the `row()` summary-row helper, `moneyCols` and the header block were duplicated near-verbatim. Extracted `SummaryRow` + `summaryMoneyCols` into `summary-grid.tsx` (renamed from `.ts`); both footers now call it. `mismatch`/`danger` opts stay optional and the client path simply never passes them — which is exactly what keeps the EX-535 recon scream off a client surface without a second copy.
- [x] fixed · `simplify` (simplification) · `collections/kosztorys-shares.ts:26-27` + `cache/tags.ts:13` · dead `kosztorysShares` cache tag + its two revalidate hooks (nothing is cached under that tag — token lookup is uncached by design). Removed the hooks and the tag.
- [x] fixed · `simplify` (simplification) · `lib/actions/kosztorys-share.ts` · the owner-guard `if (!isAdminOrOwnerRole)` was retyped verbatim in all three exports. Wrapped in a local `ownerShareAction` so the security check runs once, structurally — a fourth share action can't forget it.
- [x] dismissed · `simplify` (reuse) · `kosztorys-share-dialog.tsx:65` `copy()` vs `add-sheet-dialog.tsx` `copyEmail()` · two sites, only the success string differs. A `copyToClipboard` util is defensible but out of this slice's scope (would touch an unrelated dialog for a 2nd occurrence). Dropped as not worth the cross-file churn now.
- [x] skipped · `simplify` (reuse) · `client-kosztorys-footer.tsx:147-195` etap block vs `KosztorysEtapTotals` · real ~48-line dup, but reuse needs the shared editor component's required `investmentId` made optional + a Map/array adapter + a deposits-plane the client never renders. Behavior-adjacent change to a live editor component with its own tests; the client's copy is genuinely the simpler subset. Review-worthy, not a mechanical fix — and the cell-shape drift risk it carried is already closed by the shared `SummaryRow`. Left as-is.
- [x] skipped · `simplify` (efficiency) · `to-client-view.ts` ↔ `to-grid-rows.ts` stageQty round-trip · server unpacks stageKey fields → `Record<stageId,qty>`, grid repacks → stageKey fields. Real O(rows×stages) waste, BUT it runs once per `unstable_cache` entry (not per client request), and the fix reshapes `ClientKosztorysRowT` — the security-boundary type. Cost/benefit doesn't justify touching the leak boundary in a cleanup pass.
- [x] skipped · `simplify` (altitude) · `to-grid-rows.ts` `NO_SUBCONTRACTOR_PRICING` + `clientVisible` inline `if` in the column builder · both are "split `KosztorysV2RowT` into client-base + owner-extension / generalize the narrowing axes into a predicate" refactors — genuinely deeper fixes, but each is its own review-sized change to shared editor infrastructure. Out of scope for this slice's gate; the current altitude is defensible (fail-closed stand-ins, a documented allowlist).
- [x] dismissed · `simplify` (simplification) · `client-kosztorys-read.test.ts:35-48` two guard tests · the two cases differ only by the mocked error string; role-checking lives inside the mocked `requireAuth`. Kept both — they document the two rejection reasons and cost nothing.

/simplify report: findings folded here (no separate mktemp report written — the gate ledger is the single source of truth per slice-review-gate).

## Tests & suite

Suite run 2026-07-20 (user chose typecheck+lint+test+build; `test:e2e` skipped — the one browser spec this
slice owes is filed as EX-550, not yet authored, so there is nothing new to run there):

- `typecheck` — **pass** (tsc --noEmit, 0 errors).
- `lint` — **pass** (0 errors; 89 warnings, all pre-existing `src/migrations/*` unused-arg noise, none from slice files).
- `test` — **16 passed, 3 skipped**. Skips are the `client-kosztorys-token` DB-integration specs (`skipIf(!ENV_READY)` — no live DB wired locally; the nodemailer ECONNREFUSED is setup noise, unrelated). All slice unit/integration specs green: `to-client-view` (8, incl. hiddenInExport), `v2-columns-readonly` (6, incl. note-withheld), `client-kosztorys-read` (2).
- `build` — **pass**. Both new routes emitted (`/k/[token]`, `/inwestycje/[id]/kosztorys_v2/podglad-klienta`); Proxy middleware registered.
- `test:e2e` — **deferred**, filed EX-550 (`e2e-backlog`).

## Gate outcome

Slice lands at **in review**, NOT archived. Manual verification pass was deferred by the owner (Step 0.5
skipped, no `verify-manual-checks` skill), and manual checks are a hard archive blocker — the visual findings
(section pie, dark-theme body tokens, font variables) are only closeable by a human eyeball, not an automated
leg. Archive is owed a manual pass first.

Follow-ups filed: **EX-549** (hiddenInExport editor control, owner-requested) · **EX-550** (E2E: public `/k/<token>` reachability, `e2e-backlog`).
