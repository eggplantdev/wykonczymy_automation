# Review-gate ledger — e2e-harness · 2026-09-20

Scope: the E2E harness fixes (`e2e/**`, `playwright*.config.ts`) plus the product cache change
(`EXPIRE_NOW` at every `revalidateTag` site outside a Server Action) and the docs that record both.

**Not in scope** (a parallel agent's uncommitted work in the same tree, left untouched):
`src/components/tables/transfers.tsx`, `src/components/kosztorys/editor/toolbar/kosztorys-global-settings.tsx`,
`src/lib/kosztorys/**`, `src/__tests__/lib/kosztorys/**`, `src/__tests__/fixtures/subcontractor-pricing-row.ts`,
`src/__tests__/components/kosztorys/**`, `src/__tests__/lib/actions/work-catalogue-insert.test.ts`,
`context/changes/2026-09-18-lead-delivery/`.

Step 0.5 (browser verification pass) skipped: the slice has no UI surface — its verification IS the
Playwright suite, and driving the Playwright MCP browser is off-limits unless asked.

## Findings

- [x] filed EX-816 · module-cohesion · `e2e/helpers.ts` · 33 importers pull seeds, grid drivers and
      wait primitives out of one 800-line grab-bag — splits into `e2e/seeds.ts` +
      `e2e/drivers/kosztorys-grid.ts`. Out of scope to do here: a rename rippling through every
      spec deserves its own review, not a line in this one.

- [x] 🔴 CRITICAL · fixed · code-review + impl-review · `src/lib/cache/revalidate.ts:32` ·
      `EXPIRE_NOW` in the `deferRefresh` branch silently reverted EX-597. `revalidate()` ends with
      `if (!profile || cacheLife?.expire === 0) store.pathWasRevalidated = …`, and that flag is what
      streams a fresh render of the calling route back in the action response — so `expire: 0` inside
      a Server Action is observationally `updateTag`, re-adding the 90-193 ms per debounced editor
      autosave EX-597 removed. Fixed with `EXPIRE_NEXT` (`{ expire: 1 }`): non-zero leaves the flag
      unset, and one second is past before the next request for another route arrives, so the entry
      is still a hard miss rather than stale-while-revalidate.
      test: TDD · unit — `revalidate.test.ts` pins the literal profile on both branches, plus a
      fourth test pinning `EXPIRE_NOW === { expire: 0 }` and `EXPIRE_NEXT.expire > 0`.

- [x] 🟡 WARNING · fixed · code-review · `src/__tests__/lib/cache/revalidate.test.ts:35` and
      `src/__tests__/app/(payload)/api/cron/leads-reconcile/route.test.ts:82,148` · both specs
      imported the constant the impl passes and asserted against it — a tautology that survives ANY
      value, including the two that break the branch. Literals pinned; 11/11 green.
      test: TDD · unit — the de-tautologised assertions ARE the guard.

- [x] 🟡 WARNING · fixed · user challenge + self · `src/lib/cache/tags.ts` docblock · claimed a named
      profile „changed nothing" and that `stale` is read only by `'use cache'`. Both wrong:
      `unstable_cache` honours `isStale` and background-recomputes, so `'default'` degraded
      invalidation to stale-while-revalidate, and most hook sites were redundant with a co-located
      `updateTag` anyway. The app was not broken for six months. Docblock, `lessons.md` and
      `change.md` item 8 all rewritten to the corrected framing.
      test: no automated test — a docblock's claim is verified against `node_modules/next`, not a spec.

- [x] 🟡 WARNING · fixed · code-review · `playwright.warm.config.ts` · the documented start command
      was a hand-pasted env override, so forgetting it starts the warm server against the 5433 DEV
      DB. `globalSetup` pins only ITS OWN connection to `DB_POSTGRES_URL_TEST`, so the run seeds the
      test DB and then mutates — and deletes — real local data with every assertion green. Replaced
      with `pnpm test:e2e:warm:server`, which hard-wires the test DB and does the fetch-cache wipe.
      test: no automated test — the footgun is a human typing a command, not a code path.

- [x] 🟡 WARNING · fixed · code-review · `e2e/chrome-launch.ts` · gated on `process.arch === 'arm64'`,
      which is exactly the value the shim exists to work around: pnpm ships as the x64 build, so Node
      reports `x64` on the very Apple Silicon machine that needs the shim. Now gates on `darwin` plus
      the shim's presence, resolved from `import.meta.url` — which also fixes the CWD-relative
      `executablePath` that would pick a non-existent binary from any other working directory.
      test: no automated test — only a real launch on each platform proves it; the `channel` fallback
      is manual check 4.6.

- [x] 🟡 WARNING · fixed · code-review · `e2e/helpers.ts` `settleWrite` · a `write()` that throws
      leaves `settled` pending with nobody awaiting it, and 60 s later it rejects as an UNHANDLED
      rejection attributed to whatever test is running by then. Same for the losing
      `page.waitForTimeout` leg of the `Promise.race` („Target page closed"). Both swallowed.
      test: no automated test — reproducing it means failing a real spec on purpose to watch the
      blame land elsewhere; the fix is three lines and strictly removes a false signal.

- [x] 🟡 WARNING · fixed · code-review · `e2e/helpers.ts` `refreshData` · ran inside `refreshUntil`'s
      `toPass` with unbounded inner calls, so one click on the 45 s `actionTimeout` ate the loop's
      whole 90 s budget — the retry it exists to provide never ran twice. Bounded to 5 s / 10 s.
      test: no automated test — a timeout budget is not observable from a spec that passes.

- [x] 🔵 OBSERVATION · fixed · code-review · `e2e/notification-recipients.spec.ts:72` · same shape:
      `readList` unbounded inside `refreshUntil`. Now takes an optional timeout, passed 5 s.
      test: no automated test — as above.

- [x] 🔵 OBSERVATION · fixed · code-review · `e2e/investment-lock.spec.ts:152` · `page.reload()`
      unbounded inside `expect.poll`, which cannot abort a call already in flight. Bounded to 15 s.
      test: no automated test — as above.

- [x] 🔵 OBSERVATION · fixed · code-review · `e2e/work-catalogue.spec.ts:113` · the surviving
      `page.keyboard.press('Enter')` commit. `page.keyboard` delivers to whatever
      `document.activeElement` is at that instant and the grid steals focus on its own schedule, so
      the commit is the press that goes missing. Now `commitCellValue(priceCell, …)`.
      test: no automated test — the spec IS the test; it goes red when the press misses.

- [x] 🔵 OBSERVATION · fixed · code-review · `e2e/kosztorys-undo-redo.spec.ts:137` · the same press,
      but only the FINAL one — converted to `cell.locator('input').press('Enter')`. The press at
      `:131` opens edit mode before the input exists and the `keyboard.type('1234')` drives the
      coalescing this spec measures; both must stay page-level.
      test: no automated test — as above.

- [x] 🔵 OBSERVATION · fixed · code-review · `e2e/helpers.ts:371` · comment said „700 ms of debounce";
      the save debounce is 500 ms (`use-debounced-save.ts:15`) — 700 ms is `UNDO_COALESCE_MS`.
      Two different windows, and the comment named the wrong one.

- [x] 🔵 OBSERVATION · fixed · code-review · `e2e/chrome-arm64.sh` · no system Chrome surfaced as
      `spawn EACCES` from inside Playwright — an error about the shim, pointing nowhere near the
      missing browser. Now an explicit `[ -x ]` check with a message naming `E2E_CHROME_PATH`.

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

- [x] fixed · impl-review · `context/changes/e2e-harness/plan.md` · Phase 3 was factually complete
      and unticked. 3.1/3.2/3.3 ticked with the grep as evidence; 2.3 left open with the reason
      (awaits a cold full run); Phase 4 appended for the September stabilization.

- [x] fixed · impl-review · `context/foundation/roadmap.md:249` · F-01 said „five specs"; the suite is
      32 spec files / 67 tests.

- [x] dismissed · comment-noise · `src/__tests__/lib/cache/revalidate.test.ts:31` · the flagged
      comment no longer exists — the de-tautologising rewrite replaced it with one that carries the
      rationale (why literals, which two values break the branch). Superseded, not skipped.

- [x] dismissed · feature-first-structure / structure-scatter · no finding · `EXPIRE_NOW` living in
      `tags.ts` rather than `revalidate.ts` is FORCED, not stylistic: 6 of its 7 consumers are Payload
      hooks / Route Handlers / crons, which AGENTS.md's own rule bars from importing `revalidate.ts`.

### simplify pass (Step 2)

- [x] fixed · simplify · `e2e/helpers.ts:28` · four hand-rolled copies of the same
      „retry the NUDGE, not the wait" loop (`openExpenseDialog`, `openTransferFilters`,
      `settleSummaryPanel`, `pickKosztorysOption`) collapse onto one `nudgeUntil` + `RETRY_STEP_MS` /
      `RETRY_BUDGET_MS`. Each carried its own 30 s literal, its own 2 s inner bounds and its own
      paragraph re-explaining why `toPass` cannot abort an in-flight call — the reason now lives once,
      on the primitive that enforces it.

- [x] fixed · simplify · `e2e/kosztorys-undo-redo.spec.ts:25` · the local `serverAction()` was a
      third copy of `settleWrite`'s `next-action` wait, minus its unhandled-rejection guard and its
      bounded body drain. Deleted; `typeQty`, `runStackCommand` and the two inline waits now call
      `settleWrite`.

- [x] fixed · simplify · `e2e/helpers.ts:418` · the `next-action` predicate is now `isServerAction`,
      spelled once and read by both `settleWrite` and `settleWrites`.

- [x] fixed · simplify · `e2e/helpers.ts:757` · `commitCellValue` now owns the `cell.click()` that
      five call sites repeated. It is not a caller's choice — dsg only mounts the `<input>` for the
      ACTIVE cell, so the click is the precondition for the two lines that follow.

- [x] fixed · simplify · `e2e/investment-lock.spec.ts:24` · two near-identical reload polls of
      opposite polarity (`:94`, `:152`) become one `reloadUntilBanner(page, 'present' | 'gone')`;
      the unbounded `page.reload()` in the first one picks up the 15 s bound the second already had.

- [x] fixed · simplify · `e2e/chrome-launch.ts:24` · `chromeUse` deleted — `channel` is itself a
      `LaunchOptions` field, so one export covers both branches and `playwright.config.ts` spreads
      nothing.

- [x] fixed · simplify · `src/__tests__/lib/cache/revalidate.test.ts:55` · the fourth test asserted
      `EXPIRE_NOW` equals `{ expire: 0 }` — a restatement of the `const` two files over. The real
      pinning is `leads-reconcile/route.test.ts:82,148`, which asserts the same literal through a
      live call path.

- [x] fixed · simplify · `e2e/notification-recipients.spec.ts:38` · `readList`'s `page.goto` was
      unbounded while the wait beside it took the caller's timeout — inside a retry loop the
      navigation alone could spend the whole budget.

- [x] fixed · simplify · `e2e/helpers.ts:25` · `HYDRATION_POLL_MS` 250 → 50. The 250 was tuned when
      hydration took 20 s under the translated renderer the shim removed; native it is ~300 ms, so
      every one of ~33 call sites overshot by up to a full tick.

- [x] fixed · simplify · `e2e/helpers.ts:56` · `waitForHydration` takes a timeout; `refreshData`
      passes 5 s, because it runs inside `refreshUntil`'s 90 s loop and a 20 s default there is the
      same budget bug as the click beside it.

- [x] fixed · simplify · `e2e/helpers.ts:228` · `refreshUntil`'s docstring now names EX-808, so the
      production cache-poisoning defect is traceable from the workaround that exists for it.

- [x] fixed · simplify · `e2e/kosztorys-route-guards.spec.ts:30` · the „computed, not inline
      `gridTemplateColumns`" trap was explained twice; the second copy now points at
      `readSummaryFigures`, which owns the explanation.

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
