# Review-gate ledger — e2e-harness · 2026-09-20

Scope: the E2E harness fixes (`e2e/**`, `playwright*.config.ts`) plus the product cache change
(`EXPIRE_NOW` at every `revalidateTag` site outside a Server Action) and the docs that record both.

**Not in scope** (a parallel agent's uncommitted work in the same tree, left untouched):
`src/components/tables/transfers.tsx`, `src/components/kosztorys/editor/toolbar/kosztorys-global-settings.tsx`,
`src/lib/kosztorys/**`, `src/__tests__/lib/kosztorys/**`, `src/__tests__/fixtures/subcontractor-pricing-row.ts`,
`src/__tests__/components/kosztorys/**`, `src/__tests__/lib/actions/work-catalogue-insert.test.ts`,
`context/archive/2026-09-18-lead-delivery/`.

Step 0.5 (browser verification pass) skipped: the slice has no UI surface — its verification IS the
Playwright suite, and driving the Playwright MCP browser is off-limits unless asked.

## Findings

- [x] filed EX-816 · module-cohesion · `e2e/helpers.ts` · 33 importers pull seeds, grid drivers and
      wait primitives out of one 800-line grab-bag — splits into `e2e/seeds.ts` +
      `e2e/drivers/kosztorys-grid.ts`. Out of scope to do here: a rename rippling through every
      spec deserves its own review, not a line in this one.
      **DONE 2026-09-23, commit `545a3282`:** split into `e2e/support/`, `e2e/seeds.ts` and
      `e2e/drivers/`; `e2e/helpers.ts` is gone.

- [x] 🔵 OBSERVATION · skipped · code-review · `e2e/helpers.ts` `settleWrites` · counts ANY action
      POST rather than correlating each to its write, so two overlapping writes are
      indistinguishable. Deliberately not fixed: Next's `next-action` header carries an action id,
      not a call id, so there is no correlation seam to key on without instrumenting the app itself —
      a bigger change than the flake it would remove, and the suite is green on the count.

- [x] 🔵 OBSERVATION · dismissed · impl-review (F2) · an E2E read-back that does not go through
      `refreshUntil` · would be flaky BY CONSTRUCTION, not by omission: EX-808 makes a single
      un-retried read non-deterministic, which is why `refreshUntil` exists. EX-808 is the tracked
      issue for the underlying poisoning; nothing to add here.

- [x] 🔵 OBSERVATION · dropped · code-review · `e2e/kosztorys-route-guards.spec.ts:29` · a latent
      `display:none` edge in a selector. Real, but it has never fired and the rewrite would make the
      selector less readable than the risk is worth.

- [x] 🔵 OBSERVATION · dropped · impl-review (F10) · fetch-cache wipe ordering in the warm loop ·
      now moot: the wipe moved into `test:e2e:warm:server`, so it always precedes the run.

- [x] dismissed · comment-noise · `src/__tests__/lib/cache/revalidate.test.ts:31` · the flagged
      comment no longer exists — the de-tautologising rewrite replaced it with one that carries the
      rationale (why literals, which two values break the branch). Superseded, not skipped.

- [x] dismissed · feature-first-structure / structure-scatter · no finding · `EXPIRE_NOW` living in
      `tags.ts` rather than `revalidate.ts` is FORCED, not stylistic: 6 of its 7 consumers are Payload
      hooks / Route Handlers / crons, which AGENTS.md's own rule bars from importing `revalidate.ts`.

### simplify pass (Step 2)

- [x] skipped · simplify · `e2e/helpers.ts:437` · drop `settleWrite`'s bounded `response.finished()`
      drain / merge `settleWrite` into `settleWrites`. Both are behaviour-changing on the exact axis
      the suite was just stabilised for (when a write is considered landed), and neither is
      verifiable without a ~1 h full run, which is not authorised. The suite is green as written.

- [x] skipped · simplify · `e2e/chrome-arm64.sh` · replace the shim with `arch -arm64 node …/cli.js
test` at the suite entrypoint. Deletes both new files and is the deeper fix, but `arch` is
      macOS-only and the shim's non-macOS branch (`channel: 'chrome'`) is what keeps the config
      portable. Review-worthy on its own, not a drive-by.

- [x] dropped · simplify · `e2e/kosztorys-route-guards.spec.ts:26` + `deposit-settlement-plane.spec.ts:98`
      · extract a shared grid-cell chunker. The kernel is three lines and must run INSIDE
      `page.evaluate`; the three readers diverge on output (page-wide dict / header-keyed row /
      typed rows reading `classList`), so a shared one would need a fourth shape nobody wants.
      Deposit's hardcoded 4 tracks fails loudly if the grid changes.

- [x] dropped · simplify · `e2e/helpers.ts` · reorder refresh-before-read in two specs. The
      efficiency agent hedged it itself, and both specs' own comments say the stale read is the
      COMMON case there — the refresh is not speculative.

- [x] dropped · simplify · `e2e/helpers.ts:455` · re-running `openTransferFilters` costs under a
      second; seeding the panel preference into `storageState` trades a real coupling for it.

- [x] dismissed · simplify · `package.json` / `playwright.warm.config.ts` · `test:e2e:warm:server`
      „duplicates" `PORT` / `NEXT_DIST_DIR` / the fetch-cache wipe. It is the point: the script exists
      so the DB is hard-wired and cannot be pasted wrong. A drifted port fails loudly on connect.

- [x] dismissed · simplify · `playwright.config.ts` · the fetch-cache wipe ordering (before the build
      in the config, after it in the warm script). Verified correct in both: the config's wipe drops
      the PREVIOUS run's entries and the build repopulates from the current test DB; the script's is
      merely stricter.

## Simplify pass

Ran `/simplify` (4 agents: reuse / simplification / efficiency / altitude) — **12 applied, 2 skipped,
3 dropped, 2 dismissed; 0 open**. Every finding is folded into `## Findings` above, tagged `simplify`;
no separate report file, per this gate's override of the `/simplify` output protocol.

Verified after the pass: `pnpm typecheck` clean, `eslint` clean on every touched file,
`vitest run src/__tests__/lib/cache/revalidate.test.ts src/__tests__/app/(payload)/api/cron/leads-reconcile/route.test.ts`
— 10/10 green. The E2E suite itself was NOT re-run (~1 h, not authorised this turn).

## Tests & suite

- `pnpm typecheck` — **clean**.
- `pnpm lint` — **0 errors**, 83 pre-existing warnings (unused `db`/`payload`/`req` args in
  migrations and Payload hooks, none in this slice's files).
- `pnpm test` — **3639 passed, 3 failed**, none of them this slice's:
  `subcontractor-columns.test.tsx` and `row-conditions/registry.test.ts` fail against a PARALLEL
  agent's uncommitted 80 %→65 % subcontractor-price-ceiling edits in `src/lib/kosztorys/`
  (explicitly out of this slice's scope and untouched by it);
  `search-filter-input.test.tsx` failed once under full-suite load and passes in isolation
  (debounce timing). The two specs this slice owns — `lib/cache/revalidate.test.ts` and
  `api/cron/leads-reconcile/route.test.ts` — are 10/10 green.
- `pnpm build` — **succeeded** (importmap + types + `next build`; no migrate, by design).
- `pnpm test:e2e` — **not run**. ~1 h per run and it is the surface this slice changes, so it needs
  an explicit go-ahead.

No new tests owed. The slice's own deliverable IS the E2E suite, so its browser-level risk is
discharged by the suite itself rather than by a further spec; the one behavioural change outside
`e2e/` (`EXPIRE_NEXT` in `revalidateCollections`) is pinned by `lib/cache/revalidate.test.ts`,
authored during Step 1's triage.
