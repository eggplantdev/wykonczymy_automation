# Review-gate ledger — branch `staging` batch → origin/staging · 2026-07-17

Unit of work: the **12 commits** `origin/staging (942f4df) .. HEAD (f800bfe)` — today's
fresh batch on top of the last push to staging. 53 files, +751 / −395. No single 10x change
folder → fallback branch-diff scope; ledger lives in `.review-gate/`.

Commits (EX): 3e90f50 EX-465 · ae0baf7 EX-464 · 3263436 EX-492 · d51acaf EX-440 ·
9dbe3b1 EX-445 · d2e93f4 EX-439 · 3db0724 leads-doc · 2c60752 EX-481 · 8f3f4ab EX-486/487 ·
92223f3 EX-496 · c554845 EX-482 · f800bfe EX-504.

Surviving checks (fan-out): `/code-review` (diff-scoped), `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit` (diff-scoped), `tailwind-v4-audit`,
`comment-noise-audit` (flag-only, diff-scoped). `/10x-impl-review` **dropped** — batch has no
single anchoring `plan.md`.

Step 0.5 (browser verification): **skipped by user decision** (2026-07-17) — fan-out only.

## Findings

<!-- ONE checkbox per finding. [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason
     Correctness findings carry: test: <test-driven-debugging | TDD | no automated test> · <unit|integration|e2e> — why -->

<!-- Fan-out result: /code-review found ZERO CRITICAL/WARNING correctness bugs. It verified
     transactions (EX-440/464), the localStorage store unification (EX-481, stale-closure fix
     confirmed), the sort comparator (EX-486/487, all 13 computed cases match their renderers),
     optimistic revert (EX-496), the schema_version gate (EX-439, drops no valid data), and the
     bulk-insert primitives (EX-504, positional id remap preserved). feature-first, structure-scatter,
     and tailwind: no findings (the types/ → lib/kosztorys/ move RESOLVES prior scatter). -->

- [x] 🔵 OBSERVATION · fixed · code-review · `kosztorys_v2/page.tsx:13-14` · EX-445's guard extraction serialized the heavy tree fetch AFTER auth+getInvestment (was `Promise.all`) → adds that latency to first paint on 1000+-row sheets. **Fixed**: validate id inline, kick `getKosztorysTree` off concurrently with `requireInvestmentOr404`, await tree after the guard — restores the pre-EX-445 concurrency and auth-ordering.
      test: no automated test · — perf/concurrency, no behavior change in output; typecheck-verified, restores prior parallelism. Not regression-test-shaped.
- [x] 🔵 OBSERVATION · dismissed · code-review · `investments.ts:88` · guard redirects failed auth to `/zaloguj` vs the two pages' old `redirect('/')`. Verified an improvement (`/` itself requires auth; `/zaloguj` is the real login route other pages use). Intentional, no action.
- [x] fixed · module-cohesion · `insert-rows.ts:6` · `DbHandleT = Awaited<ReturnType<typeof getDb>>` was a redundant alias of `DbExecutorT` (`getDb`'s declared return type) squatting a generic infra type in the kosztorys layer. **Fixed**: deleted `DbHandleT`, imported `DbExecutorT` from `@/lib/db/get-db` in insert-rows.ts + insert-kosztorys-tree.ts. typecheck clean.
- [x] fixed · comment-noise · `use-column-widths.ts:32` · TRIM — cut the "Called when a stage goes away." opener (redundant with the two preceding lines); kept the Postgres-id-reuse + variadic why.
- [x] fixed · comment-noise · `kosztorys-v2-columns.tsx:467` · TRIM — cut the vanished-state "running it twice per render … was pure waste" clause; kept the O(columns·stages) single-pass why.
- [x] fixed · comment-noise · `insert-rows.ts:9` · stray typo `compose.3` → `compose.` in the new EX-504 header (trivial, same-file cleanup).
- [x] dismissed · comment-noise · `create-json-map-store.ts:29` · FLAGGED borderline (catch-block comment vs the header) — kept as an intentional-swallow marker.
- [x] dismissed · comment-noise · `kosztorys.ts:19` · FLAGGED — the schema↔type "single source" note is load-bearing (schema doesn't reference the type structurally); keep.
- [x] dismissed · feature-first + structure-scatter · `src/types/leads.ts` still holds a feature type while kosztorys colocates · both auditors raised this as a repo-wide convention divergence NOT introduced by this batch → out of scope, not filed (cosmetic, dropped as too-minor to file).

<!-- /simplify pass (Step 2) — 4 cleanup agents, findings folded below tagged `simplify`. -->

- [x] fixed · simplify(simplification+altitude) · `kosztorys_v2/page.tsx` + `investments.ts` · my own parallel-fetch fix re-inlined the guard's `Number(id)` + finiteness check → id-validity rule now lived in two places (raised by 3 of 4 agents). **Fixed**: extracted `parseInvestmentId(id): number` (single home for the rule, `notFound()` on bad input); `requireInvestmentOr404` calls it internally, the v2 page calls it directly to keep the concurrent tree fetch. No duplicated `notFound` clause. typecheck clean.
- [x] fixed · simplify(reuse) · `append-preset-sections.ts:35` + `kosztorys.ts:161` · byte-identical `SELECT COALESCE(MAX(display_order)+1,0)` section-append-slot query + its "MAX not COUNT, deletes leave gaps" rationale duplicated across both callers. **Fixed**: extracted `nextSectionDisplayOrder(db, investmentId)` into `insert-rows.ts` (both callers hold a `DbExecutorT`); the rule + comment now live once. typecheck clean.
- [x] fixed (was filed EX-522) · simplify(simplification) · `use-kosztorys-editor.ts` (~518/552/578/604) · 4 setting handlers shared the optimistic→await→refresh-or-rollback+toast skeleton (EX-496 amplified it). **Fixed** in the filed-item follow-up pass: extracted a **tail-only** `optimisticSettingSave(persist, revert, errorMessage)` — the success-or-rollback tail was the identical part; each handler keeps its own optimistic apply + pre-patch capture + a `revert` closure (revert semantics differ per handler, so they stay at the call site). Behavior preserved (toast still always fires — it lives in the helper, so an empty kosztorys can't swallow the failure). typecheck clean. Hook still has zero unit coverage → renderHook harness owed under EX-521.
      test: TDD · unit (renderHook) — owed under EX-521 (hook has no harness yet); extraction is typecheck-guarded + behavior-preserving.
- [x] fixed (was filed EX-523) · simplify(altitude) · `with-payload-transaction.ts:16` · default `context = { skipRevalidation: true }` leaked kosztorys policy into the generic primitive; a future caller omitting the arg would silently inherit it. **Fixed** in the follow-up pass: dropped the default (param now required); the 4 kosztorys callers (presets/snapshots/seed/insert-at-index) pass `{ skipRevalidation: true }` explicitly, transfers already passed `{ skipSheetSync: true }`. typecheck clean across all 5 call sites.
- [x] dropped · simplify(reuse) · `ui/data-table/column-visibility-storage.ts` · pre-existing TanStack-table localStorage code could later delegate to the new `createJsonMapStore` primitive — out of scope (not in this diff), optional consolidation, dropped rather than manufacturing backlog.
- [x] dropped · simplify(simplification) · `use-kosztorys-editor.ts:166` · `reconcileSort(sort, …) !== sort` reads awkwardly; inlining the predicate would decouple the call site from the unit-tested helper. Minor readability, not worth the churn or the decoupling.

## Simplify pass

Ran /simplify — **2 applied** (parseInvestmentId extraction, nextSectionDisplayOrder dedup), **2 deferred+filed** (EX-522 optimistic-save helper, EX-523 transaction default), **2 dropped** (pre-existing/minor); each finding folded into `## Findings` (tagged `simplify`). No separate report file (agents returned inline). The batch was already net-positive on all four angles — the loudest finding was duplication my own parallel-fetch fix had just introduced, now resolved. typecheck clean after every edit.

## Tests & suite

**No tests authored this gate — recorded decision, not omission:**

- The batch's genuinely new logic shipped WITH its unit tests: `create-json-map-store.test.ts` (EX-481) + `kosztorys-sort-value.test.ts` (EX-486/487), both added in these 12 commits.
- `parseInvestmentId` (extracted this gate) — 2-line id-validity guard lifted verbatim from two pages that already shipped without a unit test on it; no `next/navigation`/`notFound` mock harness exists in the suite. Standing one up for a 2-line guard is disproportionate (same call the prior gate made on `handleRenameSection`). Disposition: no automated test — verified by typecheck + both callers exercised at runtime.
- `nextSectionDisplayOrder` (extracted this gate) — behavior-preserving SQL extraction (identical query string), typecheck-guarded signatures. No new test owed.
- No new browser-level flow introduced (refactors + fixes to existing flows); editor E2E obligations already filed EX-510/EX-511 (prior gate). No new E2E owed.

**Full suite (user chose fast legs: typecheck + lint + unit; e2e/build skipped):**

- [x] `pnpm typecheck` — clean.
- [x] `pnpm lint` — 0 errors, 85 warnings (all `src/migrations/*` unused-arg Payload boilerplate, pre-existing, not batch-authored). Pass.
- [x] unit suite (`node --env-file=.env node_modules/vitest/vitest.mjs run`) — **1017 passed, 1 failed**. The 1 failure (`leads/notifications.db.test.ts`, off-by-one `expected 76 to be 77`) is **not this batch**: it touches zero leads logic (only `src/types/leads.ts` doc-comment), and the file **passes 2/2 in isolation**. Cause = shared 5433 dev-DB cross-contamination between `.db` specs (known; the pre-push `test:integration` gate uses the isolated 5435 db-test). Same disposition as the prior staging gate. Not a merge blocker.
- [ ] `pnpm test:e2e` — skipped by user decision (no new browser flow this batch; editor E2E obligations already filed EX-510/EX-511).
- [ ] `pnpm build` — skipped by user decision (fast legs only).
