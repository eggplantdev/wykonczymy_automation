# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Repair native-arch breakage, don't re-`pnpm remove` — one remove can swap lightningcss to the wrong arch and kill the CSS build

- **Context**: Any dependency op (`pnpm remove <pkg>`, casual `pnpm install`) on this Apple-Silicon (darwin arm64) machine — especially the "remove unused deps" cleanup steps from the simplify audit. `lightningcss` is a transitive native dep of `@tailwindcss/postcss` (Tailwind v4) with one optional prebuilt package per platform.
- **Problem**: `pnpm remove recharts` re-linked `node_modules` and pulled `lightningcss-darwin-x64` (Intel) instead of `lightningcss-darwin-arm64`, dropping `lightningcss.darwin-arm64.node`. `@tailwindcss/postcss → lightningcss` then threw `Cannot find module '../lightningcss.darwin-arm64.node'` and Turbopack failed to evaluate `src/styles/globals.css` — the whole dev CSS build broke. Everything reports arm64 (node, pnpm's runtime, the binary itself), the lockfile lists every platform optional incl. arm64, and there's no arch config — yet a plain `pnpm install` no-ops (thinks `node_modules` is in sync) and leaves the stale x64 artifact. ~15–20 min to diagnose because (a) the error blames `globals.css` (looks like a CSS/source bug) when the cause is install-state, and (b) the fix has TWO parts and the first looks complete on its own. Tell in the `pnpm remove` output: `reused 0, downloaded 948` = it rebuilt the store from scratch.
- **Rule**: Prefer hand-editing `package.json` deps over `pnpm remove`/`pnpm install` on this repo. When a dependency op is unavoidable, expect native-arch breakage and repair in **both** layers: (1) **binary** — `pnpm install --force` (re-links optionals for the real arch; ~3–4 min), confirm `node_modules/.pnpm/lightningcss-darwin-arm64@*/node_modules/lightningcss-darwin-arm64/lightningcss.darwin-arm64.node` exists; (2) **cache** — the running `next dev` keeps failing from `.next/dev` even after the binary is fixed, so `rm -rf .next` and restart the dev server. Critically: a bare `require('lightningcss')` or even a standalone `@tailwindcss/postcss` compile can succeed while the dev server still errors — **verify against the actual running dev server, not a node one-liner** (same family as the verify-against-reality / don't-trust-a-stale-harness rule). When an error blames a CSS/source file right after a dependency op, suspect install-state before re-diagnosing the code.
- **Applies to**: /10x-implement, /10x-impl-review, /simplify, dead-code-scanner, any dep-removal cleanup on this machine

## Treat kosztorys sheet column positions as a frozen external contract

- **Context**: Any change to the Google Sheets sync algorithm (`src/lib/google/sheets.ts`, `src/lib/actions/sheets-sync.ts`, `src/hooks/transfers/sync-sheet.ts`) that affects what gets written to a tab — especially the summary/SUMIF block layout, column order, or the lists that drive it (`SHEET_TRANSFER_TAB_TYPES`, `TRANSFERS_SUMMARY_TYPES`, `transferSummaryKeys`, `*_TAB_CONFIG.header`). Holds until the sheets are removed entirely.
- **Problem**: Kosztorys sheets across many client spreadsheets contain hand-built formulas that reference summary columns by fixed position. Dropping or reordering a column shifts the survivors, silently breaking those formulas — and there is no fix except going sheet-by-sheet by hand. This already happened: removing CORRECTION from `SHEET_TRANSFER_TAB_TYPES` (a data-routing list) also fed `transferSummaryKeys()`, so a tab rebuild would have shrunk the summary and slid Strata into Korekta's slot.
- **Rule**: Never let a column leave or move in a written sheet layout. When data routing must change, keep the column in place (a zero-total placeholder label is fine) and decouple the layout list from the routing list. Audit every consumer of the changed constant before editing it — one list often drives both routing and layout. Guard the frozen layout with a test that asserts exact column order/count.
- **Applies to**: plan, plan-review, implement, impl-review

## A parity test must run the REAL per-surface assembly on REAL data — a shared stand-in is false confidence

- **Context**: Any figure shown in more than one place computed by more than one code path — here the investor `bilans`/`marża` on the investments listing (`lib/queries/investments.ts` → `calculateBalance`/`calculateMargin`) vs the detail/report page (`financial-stats` → `ToggleStatButtons` interactive sum + `calculateMargin`). A third surface — print/export — computed the same figure with its own `calculateBalance` until EX-672 deleted it; two functions of that name (a static formula vs a sum-of-visible-cards) is what the drift below turns on, and the parity spec now inlines the sum-of-visible-cards side. Applies to any future change touching these figures.
- **Problem**: Equality between independently-assembled copies of the same figure is an unenforced coincidence that decays on every change. We shipped a "parity test" that compared `extractFigures ↔ extractFigures` — a helper **no page uses** — so it stayed green while the listing and detail pages disagreed by hundreds of zł on 7 real investments (legacy un-categorised corrections: counted by the listing's `totalMaterialCosts`, absent from the detail's category-card sum). Repeatedly declared "verified / can't break" from reasoning about the wrong layer; only real/legacy data exposed the gap. Also mis-stated the duplication ("4–6 places") from memory instead of grep (truth: marża = 1 formula, 3 call sites incl. an orphaned `extractFigures`; bilans = 2 legitimate algorithms — the detail's interactive toggle vs the listing's static formula).
- **Rule**: (1) A parity/regression test must call the **actual functions the surface renders**, on **real data** (gated DB test), not a stand-in. (2) Prove it **red** — it must fail when you break the real thing; a test that's only ever green may be tautological. (3) A _legitimate_ difference (interactive toggle vs static formula) is fine — but then assert the invariant (default/all-visible == formula) with a test; don't assume. (4) Never claim "verified" without an executable red→green on the real path. (5) Count call sites with `grep`, never from memory. (6) Consolidate duplicated assembly into one function that takes the whole `financials` object (`calculateBalance(financials)`, `calculateMargin(financials)`) — no long positional-arg lists, no vaguely-named orphan bundles.
- **Applies to**: plan, plan-review, implement, impl-review, tdd, simplify

## Production must run on the stable DB branch, and a backup is only real once restore-tested — full post-incident playbook in `lesson-db-backup-resilience.md`

- **Context**: Anything touching the prod database's identity or durability — the connection string the app/CI/backups/migrations resolve to (`DB_POSTGRES_URL_PROD` and friends), the Neon↔Vercel integration, deployment-retention windows, and the GitHub-Actions→FTP backup chain (see `restore-prod-backup-local` skill).
- **Problem**: A near-miss outage where prod had been silently pinned to a **Neon preview branch** (hand-pasted connection string), a routine 30-day deployment-retention sweep deleted that branch — i.e. production's data — and the nightly "backups" had been dumping a _different, frozen_ database for weeks while reporting green. A pooled `28P01` made a permanently-deleted branch look like a recoverable auth failure, wasting hours. Recovery was luck (a 3-day-old pre-push dump), not design.
- **Rule**: (1) Production must use the project's **main/production** DB branch — never a preview/staging branch, never a hand-copied branch string; review retention windows. (2) The DB the app reads, CI backs up, and migrations target must be the **same** host — verify, don't assume. (3) Validate backups by **content** (row-count floor + freshness via `max(created_at)` not a date-grep + no-shrink vs previous + a real restore-test), never by file size. (4) `28P01`/auth errors are credentials, not your migration; a `28P01` through a **shared pooler** does NOT prove the branch exists — confirm via the direct endpoint. (5) Dump/restore over the **direct** connection, never the pooler. Full failure chain, distilled principles, and the runnable agent audit: `context/foundation/lesson-db-backup-resilience.md`.
- **Applies to**: plan, plan-review, implement, impl-review, db-github-backup, restore-prod-backup-local

## `readonly` on a read-only param/const is load-bearing, not noise — never strip type annotations without a typecheck, and never commit a refactor that breaks `tsc`

- **Context**: Any "cleanup" that removes a type annotation it judges cosmetic — here a `remove noise readonly` commit (`0624320`) that stripped `readonly` from `requireAuth(allowedRoles: readonly RoleT[])`, `computeSummary(entries: readonly StatEntryT[])`, and the `: readonly RoleT[]` annotation on the `MANAGEMENT_ROLES`/`ADMIN_OR_OWNER_*` constants. Applies to any annotation-removal sweep (`readonly`, explicit return types, widening annotations).
- **Problem**: The `readonly` was structural. `readonly T[]` on a param that only reads is strictly **more permissive** — it accepts both mutable arrays and `as const` tuples. And `: readonly RoleT[]` on a constant **widens** the `as const` tuple from `readonly ["ADMIN","OWNER","MANAGER"]` to `readonly RoleT[]`; that widening is what lets `.includes(user.role)` take any `RoleT` and lets the constant pass to a guard. Removing it collapsed the constants to narrow tuples and the params to mutable arrays, breaking **15 call sites** across pages, routes, queries and tests (`readonly [...]` → mutable `RoleT[]`, and `.includes(EMPLOYEE)` rejected). The commit landed broken — `tsc` was never run. The first instinct on repair was also wrong: making the data mutable (`: RoleT[]`, `[...ROLES]`, dropping `as const` from a test fixture) to honor the commit's "no readonly" intent — fighting the type system instead of restoring the annotation that was correct. The fix was to put `readonly` **back** only where it was load-bearing (3 spots), leaving the genuinely-noise removals (data-table, sync-sheet, etc.) alone.
- **Rule**: (1) A `readonly` parameter/const that the code only reads is good design, not noise — don't strip it. (2) Never remove a type annotation without running `pnpm exec tsc --noEmit` immediately; a "noise" annotation that's actually load-bearing fails the build. (3) **Never commit a refactor that breaks `tsc` or `pnpm build`** — gate cosmetic/cleanup commits on typecheck+build, since `next build` is not run on every commit and a broken type can sit latent. (4) When a removal does break, the fix is usually to restore the annotation, not to mutate the data around it — don't fight the type system to preserve a wrong premise. (5) `ROLES` stays `as const` (it derives `RoleT`); read-only consumers take `readonly RoleT[]` so the immutable list flows through untouched.
- **Applies to**: implement, impl-review, simplify, dead-code-scanner, plan-review

## An invariant enforced in two planes needs a test on the BRIDGE, not one test per plane

- **Context**: Any business rule that is implemented in more than one representation of the same data — here a `settled` ("wliczone w robociznę") expense, which must be excluded from what the client is billed. Plane A = the app's financial math (`src/lib/db/sum-transfers.ts` → marża/bilans, covered by `settled-vs-unsettled-expense.test.ts`). Plane B = the Google Sheets serialization the client actually reads (`expenseRow` in `src/lib/google/tab-rows.ts` → the bill tab's `SUM(E:E)`). Applies to any figure/rule that has both an in-app computation and an exported/serialized mirror (Sheets, PDF/print export, CSV, an API payload).
- **Problem**: Both planes had tests, but they tested the rule _in isolation_: the app-math test proved marża/bilans exclude settled; the row-mapping tests proved `expenseRow` maps fields. **Neither asserted that the Sheets bill-tab output obeys the same settled exclusion as the financial model.** The Sheets layer simply never knew about `settled`, so it mirrored settled expenses at full amount in column E and the client's `SUM(E:E)`/`SUMIF` billed them — the exact opposite of intent (FAZA 2 bug). Each plane was green; the _bridge_ between them was untested, so the divergence shipped. This is the same failure shape as the parity-test lesson above (independently-assembled copies of one figure drift when nothing asserts their equality), generalized from "two code paths" to "two representations."
- **Rule**: (1) When a rule lives in two planes, write a test that pins the **shared invariant across the boundary** — e.g. "the sum of bill-tab column-E amounts equals the app's client-billable total, settled excluded," running the _real_ serializer (`expenseRow`) over a mixed settled/non-settled dataset. (2) Prove it **red** against the pre-fix behavior (settled at full amount) before trusting green. (3) A regression that "slipped past the tests" is mandatory-test-first: reproduce the leak with a failing assertion on the serialized output, then keep it as the guard. (4) Don't accept "both sides are tested" as coverage of the bridge — name the boundary and test it explicitly.
- **Applies to**: plan, plan-review, implement, impl-review, tdd, simplify

## Debug Playwright E2E against a WARM manual server, never by re-running the 2.5-min `pnpm build` webServer per hypothesis

- **Context**: Any work on the Playwright harness (`playwright.config.ts`, `e2e/*.spec.ts`, `e2e/global-setup.ts`, `e2e/helpers.ts`). The webServer command is `pnpm build && pnpm start` on PORT 3100 / `NEXT_DIST_DIR=.next-e2e` with `reuseExistingServer:false`, so **every** `pnpm test:e2e` does a full cold production build (~107s warm, >300s cold) before a single line of test runs. Building the auth foundation + first specs took ~2h, almost all of it in this loop.
- **Problem**: Each failed hypothesis cost a full build to observe — and three real dead-ends stacked up (see rules below), so that's ~8 rebuilds ≈ an hour of pure waiting. Worse, launching overlapping `test:e2e` runs left orphaned `next start` / test processes holding `:3100` and `.next-e2e/lock`, producing _fake_ failures ("port already used", "Unable to acquire lock", and a logout that "didn't fire") that looked like code bugs and burned another ~20 min. `retries:0` locally means no trace is kept on a normal run, so failures were opaque.
- **Rule** — for ANY E2E diagnosis, switch to a warm-server + throwaway-script loop (seconds per iteration, no rebuild):
  ```bash
  # 1. build ONCE (only when app source changed — specs/config changes need no rebuild)
  NEXT_DIST_DIR=.next-e2e pnpm build
  # 2. start the warm server and LEAVE IT RUNNING (use the bin directly, NOT `node .../.bin/next`
  #    — that runs the shell wrapper through node and throws "missing ) after argument list")
  NEXT_DIST_DIR=.next-e2e PORT=3100 ./node_modules/.bin/next start &
  # 3. iterate: drive a throwaway ./dbg.mjs from the REPO ROOT (imports resolve there),
  #    `import { chromium } from '@playwright/test'`, baseURL http://127.0.0.1:3100,
  #    viewport {width:1280,height:720}; log page.on('console'|'pageerror'|'request'(POST)).
  #    Loop it 5-6× in one launch to surface flakes a single pass hides.
  node ./dbg.mjs
  # 4. BETWEEN full `pnpm test:e2e` runs, always reclaim the port+lock first — orphaned procs
  #    cause fake "port in use" / "lock" / no-op-click failures that mimic real bugs:
  lsof -ti tcp:3100 | xargs -r kill -9; pkill -9 -f playwright_chromiumdev_profile; rm -f .next-e2e/lock
  ```
  For a full-suite trace when you must, pass `--trace on` and unzip `test-results/**/trace.zip` (`0-trace.network` for POSTs, `0-trace.trace` for console). Only fall back to full `pnpm test:e2e` for the final green confirmation, not for diagnosis.
- **Applies to**: implement, impl-review, e2e, tdd

## Playwright's loader can't import the Payload/Next graph, and driving the real UI hits hydration races — seed via subprocess, wait for `__reactFiber$`, and run `workers:1`

- **Context**: `e2e/global-setup.ts` and specs that seed data or drive the real login/mutation UI in this Payload + Next App Router app. Surfaced building the authenticated E2E foundation.
- **Problem**: Three distinct traps, each initially mistaken for something else: (1) **`next/cache` is unresolvable in Playwright's module loader.** Importing `seedE2eUser()` into global-setup pulled `@payload-config` → collections → `src/hooks/revalidate-collection.ts` → `next/cache`, throwing `Cannot find module '.../next/cache'` — it resolves fine under `node --import tsx` but not Playwright's transform. (2) **Hydration races when Playwright drives real UI.** The login `<form>`'s `onSubmit` `preventDefault` only exists post-hydration, so an early click did a native GET (`/zaloguj?email=…&password=…`) that never logged in; and because `(auth)/zaloguj` and `(frontend)/` are **different Next root layouts**, `router.push('/')` is a full document nav that re-hydrates from scratch — so the logout click was a silent no-op (no POST fired) until the dashboard hydrated. (3) **`fullyParallel:false` does NOT serialize across files.** Playwright still spawned 2 workers that hammered the one cold server + one shared local DB, flaking the auth spec's render; the fix is `workers:1`.
- **Rule**: (1) **Never import the Payload config graph (or anything re-exporting `next/cache`) into the Playwright process.** Keep credentials/constants in a payload-free module (`src/scripts/e2e-user-credentials.ts`); run the seeder as a subprocess (`execFileSync('pnpm',['seed:e2e'])`, which loads its own `.env` via tsx) — global-setup runs after the webServer is up, so Local-API seeding before the browser login is fine. (2) When driving real UI, **wait for React hydration before interacting** — poll the target for a `__reactFiber$…` key (`e2e/helpers.ts:waitForHydration`); fill controlled inputs only _after_ hydration or they reset. Assume every cross-root-layout navigation (`(auth)`↔`(frontend)`) is a hard reload that re-hydrates. (3) Set **`workers:1`** for this suite (cold server + shared DB) — `fullyParallel:false` alone isn't enough. (4) `payload.create` for a user outside a request context needs `context:{skipRevalidation:true}` (the Users `afterChange` hook calls `revalidateTag`, which throws there).
- **Applies to**: plan, plan-review, implement, impl-review, e2e

## With React Compiler on, a hook must be called through a `use`-prefixed identifier — a bare param/local name silently demotes it to a plain call and breaks the Rules of Hooks

- **Context**: This repo runs React Compiler (`reactCompiler: true` in `next.config.ts`). Any refactor that extracts hook logic into a shared custom hook and passes another hook in as an argument — here `useManagedForm({ store, … })` receiving a zustand bound-store hook and calling it `store((s) => s.formData)`. Surfaced after the `extract FormShell + useManagedForm` refactor (`aee3131`) broke every transfer form (deposit/investment/worker/internal-transfer) with `React has detected a change in the order of Hooks` → `Should have a queue. You are likely calling Hooks conditionally`.
- **Problem**: React Compiler identifies hooks **by the `use*` naming convention at the call site**, not by what the value actually is. A zustand store hook received as a parameter named `store` and invoked as `store((s) => …)` doesn't start with `use`, so the compiler treats those calls as ordinary function calls — then memoizes and **conditionally skips** them across renders. The hook count varies between renders → order-of-hooks error → crash. The pre-refactor inlined calls (`useDepositFormStore((s) => …)`) started with `use`, were recognized as hooks, and always ran — which is exactly why it worked before and broke only after extraction. Deceptive to diagnose: the extracted code's per-render hook order is stable and reads identically to the working version, so the bug is invisible in the source and only the compiler's naming heuristic explains it.
- **Rule**: (1) Never call a hook through an identifier that doesn't begin with `use` — not a param, not a renamed local, not a destructured field. When passing a hook as an argument, name the parameter `useXxx` (fix here: `store` → `useFormStore`). (2) When an order-of-hooks / "Should have a queue" error appears right after an extraction refactor and the source order looks provably stable, suspect React Compiler failing to recognize a hook call, not a literal conditional. (3) Verify a form/hook fix against the **running dev server in the browser** (0 console errors, dialog renders), not just `tsc` — the compiler transform only bites at runtime.
- **Applies to**: implement, impl-review, simplify, plan-review, tdd

## Iterate E2E specs with `pnpm test:e2e:warm` (reuse a running server), and drive cmdk comboboxes with the committed `pickComboOption` recipe — don't re-derive either

- **Context**: Writing/fixing Playwright specs that drive the expense form (`e2e/transfer-*.spec.ts`, `e2e/helpers.ts`). Companion to the warm-server lesson above: that one keeps a warm `next start` for throwaway `.mjs` probes; the two gaps it left cost ~1h building the mutation specs.
- **Problem**: (1) **No fast way to run the REAL harness.** Throwaway `.mjs` scripts prove a flow but skip global-setup/storageState/`workers:1`/timeouts, and the default `pnpm test:e2e` rebuilds (~6 min) every run because `reuseExistingServer:false` forces `pnpm build && pnpm start`. Every real-harness hypothesis cost a full build. (2) **cmdk/Radix combobox selection is a minefield** — six strategies failed before one stuck: `keyboard.type` drops chars racing the popup focus; `.fill()` filters but leaves no item highlighted so **Enter is a no-op**; the filtered list re-renders so a normal click **detaches mid-action** and force-click dispatches to a dead node (selection silently lost → required field empty → submit blocked, dialog just stays open with no error); and on a cold render the option is clickable **before cmdk wires `onSelect`**, so the first click closes the popover without committing.
- **Rule**: (1) **Debug the real harness warm, not cold.** `playwright.warm.config.ts` reuses an already-running server (`reuseExistingServer:true`, no build); `pnpm test:e2e:warm [spec]` runs the actual specs + global-setup in ~20s. Loop: `NEXT_DIST_DIR=.next-e2e pnpm build` once → start the warm server **on the 5435 test DB** `source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" NEXT_DIST_DIR=.next-e2e PORT=3100 ./node_modules/.bin/next start &` → iterate with `test:e2e:warm` → run the full `pnpm test:e2e` **only as the final gate** (it builds fresh and is the only thing that catches cold-boot flakiness). (2) **Reuse `pickComboOption` in `e2e/helpers.ts` for any cmdk combo** — its shape is load-bearing: _don't_ type into the search (filtering churns the list); click the exact option in the **unfiltered** list; then **assert the trigger now shows the chosen label** before touching the next field (racing the next combo drops the value); wrap it in a **bounded retry** (cold renders swallow the first click); and wait for `[data-radix-popper-content-wrapper]` to **detach** between combos or the next trigger click hangs on "stable". (3) A combo whose selection didn't commit gives NO error — the form just won't submit and the dialog stays open; when a submit "hangs", suspect a dropped combo value first. (4) Cold prod-server first hits are slow (~30s for the first authenticated render + heavy `/kasa/[id]` route); keep the per-test `timeout` generous (120s) — warm these specs run in ~3s, so the budget is pure cold-boot headroom.
- **Applies to**: implement, impl-review, e2e, tdd

## A static-audit finding is a candidate, not a verdict — read the actual edge (static vs lazy) before calling a dependency-cruiser cycle "debt"

- **Context**: Acting on any static-analysis audit output — dependency-cruiser `no-circular`/boundary/orphan warnings (`.dependency-cruiser.cjs`, the M4L2 `context/map/` artifacts), but equally knip/depcheck dead-code, ESLint, a security scanner. Triggered here while triaging the "one real import cycle" the structure map flagged as top structural debt.
- **Problem**: The tool reported 16 cycles; the map (and then I) elevated the one non-form cycle to "top structural debt" with a proposed refactor. All of it was wrong. Reading the source showed the Payload `config → collections/transfers → sync-sheet → sheets-sync → … → config` loop is **already runtime-safe**: `hooks/transfers/sync-sheet.ts` imports the action with a deliberate lazy `await import()` (commented), so the module-init chain never closes — depcruise flags it only because it resolves dynamic imports into the graph. The second cycle (`lib/constants/transfer-rules.ts ↔ transfers.ts`) is likewise author-documented as call-time-safe (`transfers.ts:139`). I compounded the tool's low precision with my own: asserted a "latent timebomb" and a "one-line fix in `get-current-user-jwt.ts`" from a partial `grep` — the fix would have killed only 1 of 3 overlapping paths and not silenced the warning anyway — and even proposed a `dependencyTypesNot: ['dynamic-import']` config tweak that, **when actually run, didn't work** (excluding dynamic on the `to`-edge doesn't drop a cycle whose dynamic edge is mid-loop). A user's "one line?" was the only precision filter applied.
- **Rule**: (1) Static audits are **high-recall, low-precision** — they surface _candidates_; the value is pruning false positives, not trusting the count. Never promote a raw finding to "debt"/"bug" without reading the code it points at. (2) For a cycle specifically, **read the edge types**: a loop with a lazy `await import()` (or values used only at call time) has no init-time cycle and is usually a deliberate, safe break — the tool can't see "runtime-only." Check for an author comment at the edge before proposing a "fix." (3) **Verify any proposed fix by running it**, don't assert it from a `grep` — count _all_ the paths (multiple static importers of a shared node = multiple cycles), and if you suggest a config change, execute it and confirm the warning actually clears. (4) Consequently, when wiring a static audit into a gate (pre-push/CI), a rule that fires only on known-safe findings (`no-circular` here) belongs at **`warn`** (never blocks), while invariant-encoding boundary rules that catch real build-breakers (`no-hook-imports-revalidate`, `no-payload-graph-imports-env-server`) block at **`error`**. (5) **And often the gate shouldn't be the graph tool at all.** Wiring depcruise into pre-push was considered and rejected (2026-07-08): of the two `error` boundaries, `no-payload-graph-imports-env-server` is already self-enforcing (`server-only` throws under `generate:types`), and `no-hook-imports-revalidate` is a **direct-import ban** — ESLint's sweet spot, where it fires in-editor and at pre-commit instead of at push. It lives as a `no-restricted-imports` block in `eslint.config.mjs` scoped to `src/hooks/**`. Reach for depcruise's unique capability (the transitive graph) only when a rule actually needs transitivity; neither of these does.
- **Applies to**: research, plan, plan-review, implement, impl-review, simplify, dead-code-scanner

## react-datasheet-grid in a flex container flickers — give it a definite width with `grid-cols-[minmax(0,1fr)]`

- **Context**: Mounting `react-datasheet-grid` (`DataSheetGrid`/`DynamicDataSheetGrid`) full-height inside a flexbox layout (`flex flex-col` + `flex-1`), e.g. the kosztorys v2 editor (`src/components/kosztorys/kosztorys-editor-v2.tsx`). Any datasheet-grid where the sum of column min-widths exceeds the viewport.
- **Problem**: The whole page flickered ("blinking navbar / Kolumny button"), DevTools Issues climbed ~900/sec (silent ResizeObserver-loop issues, no console error). Cause: the grid's column min-widths (~1650px) exceed the viewport (~1200px); in a flex context the container width has no _definite_ size, so it oscillated viewport↔content (measured 1200↔1653 **every frame**) and the grid's internal `react-resize-detector` chased it forever. ~30 min lost theorizing about ResizeObserver/`router.refresh` loops; the truth only showed up by sampling `getBoundingClientRect().width` over a 2s rAF loop and seeing two alternating values. A `min-w-0` + `overflow-hidden` on the wrapper did **not** fix it.
- **Rule**: Give the grid's container a **definite** width so its resize-detector settles: wrap it in a CSS-grid track `className="grid grid-cols-[minmax(0,1fr)] …"` (the `minmax(0,1fr)` — not the default `1fr`=`minmax(auto,1fr)` — forbids expand-to-content; the grid then scrolls its columns internally). Diagnose width/height loops by sampling `getBoundingClientRect()` across `requestAnimationFrame` for 1–2s and checking for >1 distinct value — don't rely on console errors (Chrome reports RO loops only in the Issues panel). Separately: feed the grid a `height` decoupled from its own box (`window.innerHeight − rect.top`, measured on mount + window-resize, **no** ResizeObserver), and only call `router.refresh()` in `onChange` on a real edit.
- **Applies to**: implement, impl-review, verify, frontend grid/table work

## Driving react-datasheet-grid in a QA pass: use the app's own controls + accessibility refs, and don't instrument a defect the code can't produce

- **Context**: Manually verifying / E2E-driving the kosztorys v2 editor (`react-datasheet-grid`, ~1000 rows) — the `verify-manual-checks` pass, Playwright specs, any agent poking the grid through the browser. The grid is **virtualized**: only ~28 rows exist in the DOM at once; row refs churn on every re-render; the first row renders its gutter action buttons differently from the rest; and a dev-server HMR rebuild can destroy a Playwright `evaluate` execution context mid-script.
- **Problem**: Spent ~20 min on the "no vanish-then-reappear flicker on a blocked delete" check building a `MutationObserver` + rAF row-count sampler and fighting the virtualization (scrolling to find an appended row, hunting the right delete button, an eval that threw `Cannot read properties of null` and another killed by "Execution context was destroyed" from a Fast Refresh). All to catch a transient the code **cannot emit**: the blocked-delete handler does a synchronous client pre-check (`isRowPopulated(row) → toast + return`) _before_ any `setRows`, so React never commits a removed-row render — flicker is structurally impossible on that path. The single observation already in hand (the "999 pozycji" counter never moved during the blocked delete) plus reading the early-return was conclusive.
- **Rule**: (1) **Match evidence to the failure mode.** Read the handler first; if a defect requires an async optimistic-then-revert cycle and the code takes a synchronous early `return`, one observation that the visible state never changed closes the check — no `MutationObserver`/frame sampling. (2) **Drive via the app's own affordances, not ad-hoc DOM archaeology**: prefer accessibility-snapshot refs / Playwright role selectors (`getByRole('button', {name:'Usuń pozycję'})`) and the app's add/delete controls; to place a known row for interaction, use a **new blank row** (appended last by `applyAddItem`) or the side **Sekcje** panel's per-section buttons rather than scrolling the virtualized body to a specific index. (3) Confirm persisted state with a **DB query** (`docker exec … psql` against the 5435 test DB), which sidesteps the grid entirely. (4) Expect HMR to invalidate long `evaluate` scripts — keep them short, or turn the assertion into a DB check.
- **Applies to**: verify, verify-manual-checks, 10x-e2e, implement, impl-review

## The number of writes must match the real change, not the collection size — swap 2 rows, don't renumber the section

- **Context**: Operations on a reorderable list stored as contiguous integer `display_order` (e.g. `kosztorys-items`, the ▲▼ move and future drag-and-drop). Real scale: 1000+ rows, several-to-a-dozen sections.
- **Problem**: `reorderItemsAction` renumbered the **whole section** (`Promise.all` N×`payload.update`) on _every_ ▲▼ click — yet ▲▼ actually changes only two rows. On a large section one click = hundreds of heavy Payload writes (access control + hooks + validation + a separate round-trip each). "Performance wise it's shit". The same bottleneck returns with DnD's _move_ semantics (dragging across half the list shifts the whole range) if we stay on contiguous ints.
- **Rule**: Match the write count to the real change, not the collection size. Swapping neighbors (▲▼) = exchanging 2 `display_order` values = 2 updates, regardless of section size. For an arbitrary _move_ at scale use **sparse/fractional** ordering keys (a value between the new neighbors = 1 write + an occasional rebalance; the LexoRank / Trello / Linear pattern), not range renumbering. When you must renumber many rows, do one bulk `UPDATE … CASE`, not N ORM calls. Principle: push the cost into the **data model**, not the operation — whether a reorder is O(1) or O(n) writes is decided by the schema, not the UI (▲▼ vs DnD are just different calls to the same operation).
- **Applies to**: plan, implement, impl-review

- **Corollary — drag-and-drop reorder forces a `display_order` migration.** Arrow ▲▼ reorder is a _swap
  of two neighbours_, so exchanging their two `display_order` values is 2 writes at any list size. DnD
  has _move/insert_ semantics: dragging an item across half a section shifts the whole range between
  source and target, so a contiguous-integer `display_order` needs N writes per drop — the same
  bottleneck, reintroduced. The moment DnD lands is the moment to move `display_order` to **sparse /
  fractional** keys (LexoRank, or the midpoint between neighbours → 1 write per drop plus an occasional
  rebalance). Don't build that ahead of need, but don't let DnD ship on contiguous ints either.

## `react-datasheet-grid` ALIASES its exports — the public `DataSheetGrid` IS `StaticDataSheetGrid` (frozen columns). Import `DynamicDataSheetGrid`

- **Superseded (2026-07-15)**: this entry previously read _"the library freezes `columns` at mount and ignores ALL runtime column-definition changes — remount it with a `key`"_. **The blame was wrong, and that wrong generalisation cost a full debug session** (EX-422). One export freezes; the other does not. Nothing below requires a remount `key`.
- **Context**: any `react-datasheet-grid` (4.x) usage, e.g. the kosztorys v2 editor (`src/components/kosztorys/kosztorys-editor-body.tsx`, `src/lib/tables/kosztorys-v2-columns.tsx`). Verified against 4.11.6 `dist/`.
- **Problem — the trap**: `dist/index.js:6-7` **swaps the public names relative to the internal filenames**:

  ```js
  exports.DynamicDataSheetGrid = DataSheetGrid_1.DataSheetGrid // ← REACTIVE
  exports.DataSheetGrid = StaticDataSheetGrid_1.StaticDataSheetGrid // ← FROZEN
  ```

  So the obvious-looking `import { DataSheetGrid }` silently gets `StaticDataSheetGrid`, which snapshots columns at mount (`StaticDataSheetGrid.js:23`, `const [staticProps] = useState({ columns, … })`) and never updates them. `DynamicDataSheetGrid` runs `useColumns(rawColumns, …)` = `useMemo(…, [gutterColumn, stickyRightColumn, columns])` (`useColumns.js`) — it recomputes whenever the `columns` array identity changes, which it does on every render when you build the array inline. **`grep StaticDataSheetGrid` over the whole history returns zero hits** — the frozen component was only ever reached through the aliased name, which is exactly why the trap survived several reviews.

- **The damage this caused (the shape to recognise)**: being on the frozen export produced the 2026-06-20 "all three price views show the client price" bug (the grid rendered the mount-time `view`; **tell**: DB had `subcontractor_*_price = 0` while the UI showed the client figure in every view — UI ≠ DB means a stale render, not a write bug). That bug got a whole-grid remount `key` as a workaround — **and that remount was the flicker** of EX-422. Then `4dc6d32` ("fix migotania") switched _to_ the frozen export to chase an unrelated flicker (the ResizeObserver width oscillation, which has its own fix: the definite-width container, entry above). Net: a workaround for a fix for a flicker _was_ the flicker. Fixed in `ee497cb` — reactive import, whole `key` deleted, all four of its segments (`view`, `sorted/natural`, `widthsKey`, `stagesKey`) fell out with it.
- **Rule**: **Import `DynamicDataSheetGrid`.** Column definitions are then reactive end-to-end — runtime width changes, `keyColumn(field)` swaps, and state-dependent computed columns all apply live, with no remount `key`. Never add a `key` to force a column change through; that is the frozen export's symptom, and a remount destroys DOM/virtualization/scroll/selection. Resizing is still **commit-on-release** (persist on pointer-up) with a `fixed` guide-line overlay during the drag — but for save-churn and drag feel, _not_ because a remount is needed. Anchor in-header affordances to `.dsg-cell-header` (the library gives it `position:absolute`) by leaving the title wrapper **non-positioned** — a `position:relative` wrapper re-anchors `absolute` children to the shrink-wrapped title content, not the cell edge.
- **The transferable lesson (beyond this library)**: when a component ignores a prop, **check what the barrel actually exports before theorising about the component's internals**. Reading `dist/components/DataSheetGrid.js` describes an export the app may not be using — resolve the name through `index.js` first. Corollary, learned the hard way here: a lessons entry with weak provenance is not thereby false; verify it against source, don't dismiss it — and when it turns out true, still check whether it names the right **mechanism**.
- **Applies to**: implement, impl-review, verify, frontend grid/table work

## A `react-datasheet-grid` column's `component` must be a STABLE reference — a fresh one per render remounts the cell and drops typed characters

- **Context**: any column-wrapping helper in the kosztorys v2 editor (`withTotalsRow` in `src/components/kosztorys/kosztorys-totals-row.tsx`; the column builders in `kosztorys-v2-columns.tsx`). Sibling to the export-aliasing entry above: that one is about the `columns` **array** being reactive; this one is about each column's `component` **field** identity.
- **Problem — the trap**: dsg renders each cell as `createElement(columns[i].component, props)` (`dist/components/Grid.js`). React diffs by component _type_: a changed **prop** re-renders in place, but a changed component **type** unmounts + remounts — destroying the focused `<input>`. So if a helper assigns a fresh inline closure `component: (props) => …` and the `columns` array is rebuilt every render (it is — and correctly so, per the entry above), every keystroke gives that cell a new `component` identity → remount → the input is torn down mid-edit and only the **last character typed survives**. The tell: typing "ABCD" lands "D". Regression came from `9ed84af4` (totals row); the inline closure looked harmless because `columns` rebuilding is harmless.
- **Why the library's own columns don't hit this**: `keyColumn`/`textColumn`/etc. point `component` at a **module-level** `KeyComponent` and pass per-column data through `columnData` (a prop). Prop changes → re-render, not remount. That indirection is the fix, not an implementation detail.
- **Rule**: a `Column.component` handed to dsg must be defined once at module scope. Anything that varies per column (a baked total, the wrapped base cell, a field name) rides on `columnData`, never captured in a per-call closure. When wrapping, merge over the column's own `columnData` (`{ ...column.columnData, … }`) so a delegated base cell — e.g. `keyColumn`'s `KeyComponent`, which reads `columnData.key`/`.original` — still finds what it needs.
- **Applies to**: implement, impl-review, verify, frontend grid/table work

- **Corollary (frozen columns)**: because the column array is captured at mount, a cell component that
  needs live state — e.g. "is this the last row in its section?", to disable a delete button — cannot read
  it from a ref or a closure; it would render the mount-time answer. Carry the flag **on the grid's
  `value`** (the row objects, which are reactive) and read it from `rowData`.

## Never fire a server action / cache revalidation inside a `setState` updater

- **Context**: Client components that fire a server action (or `router.refresh` / `updateTag` / any effect that touches the Router or cache) — in particular kosztorys editors with optimistic structural changes via a `setRows` updater (`src/components/kosztorys/kosztorys-editor-v2.tsx`).
- **Problem**: `reorderItemsAction` fired from inside the `setRows` updater executed **during render**; its cache revalidation updated the Router → React "Cannot update a component (Router) while rendering KosztorysEditorV2". The action being idempotent does not help — the problem is _when_ it fires (during render), not _how many times_. Lost iteration: the optimistic swap worked visually, but every ▲▼ click threw the error.
- **Rule**: Never call a server action or a Router/cache-mutating effect inside a `setState` updater function. In the updater compute only the pure next state; fire side effects from the event handler (read fresh state from a "latest-value" ref when the closure is stale — e.g. `react-datasheet-grid` columns frozen at mount).
- **Applies to**: plan, implement, impl-review

## Denormalized fields changed from outside the grid: patch rows optimistically, don't rely on `router.refresh()` (a `useState` initializer is a mount-time snapshot)

- **Context**: `KosztorysEditorV2` and any editor that holds rows in `useState(() => deriveFromProp(treeProp))` and mutates them optimistically, where a denormalized field present on EVERY row (vatRate, global/section markup coefficients) changes OUTSIDE the grid (a panel) and relies on `router.refresh()`. Files: `src/components/kosztorys/kosztorys-editor-v2.tsx` (`handleVatChange`/`handleGlobalCoeffChange`/`handleSectionCoeffChange`, `patchRows`).
- **Problem**: `router.refresh()` supplies a fresh `tree` prop, but the `useState` initializer runs once at mount — `rows` does not re-initialize, so the denormalized fields stay stale, and computed columns (Brutto/Cena) show the old value until a hard reload. Tell: panel and DB = new value, grid = old value (UI-panel = DB, UI-grid ≠ DB). Same FAMILY as the lesson about `react-datasheet-grid` freezing `columns` at mount (an init-at-mount snapshot ignores later input changes) — just one floor up, in our `useState`, not in the library.
- **Rule**: When changing a denormalized field from outside the grid, patch it optimistically on the matching rows + `prevById` (the `patchRows` helper), the same pattern as `handleRenameSection` for `sectionName` — don't assume `router.refresh()` will re-seed `rows`. Leave `router.refresh()` only for components that read the prop directly (the panel). A naive full-editor remount via `key` is out — it would reset sort/filter/active section/`stages`/optimistic rows.
- **Applies to**: implement, impl-review, plan, verify

## An undo's inverse write races the forward autosave — serialize them on a per-key lane; cancelling a debounce timer can't stop an in-flight action

- **Context**: An optimistic per-field autosave (debounced) plus an undo/redo that issues an **inverse** server write to the same cell. Kosztorys editor: `src/lib/kosztorys/save-lanes.ts`, `src/components/kosztorys/use-debounced-save.ts`, `use-kosztorys-editor.ts` (`runGridReversal`). The undo coalesce window (`UNDO_COALESCE_MS` 700ms) is deliberately **longer** than the save debounce (500ms).
- **Problem**: Because 700ms > 500ms, by the time an undo command exists its forward save has already **dispatched** (the timer fired). Calling `cancel(key)` only `clearTimeout`s a not-yet-fired timer — it can't stop an action already in flight. So the inverse write and the still-in-flight forward write hit the same row with no ordering; on a slow network the forward can commit **last** and silently overwrite the undo. A `Promise.all(writes)` that ignores `ActionResultT.success` compounds it: a rejected inverse escapes as an unhandled rejection (fired via `void undo()`), and a logical failure diverges DB from grid with no toast/revert.
- **Rule**: Model the (row,field) cell as a **serialized write lane** — every write for a key chains behind the previous one (`tails.get(key) ?? Promise.resolve()`), so the inverse is enqueued _after_ the in-flight forward and observes its result instead of racing it. Keep the lane React-free and pure so the ordering contract is unit-testable without a DOM. Route BOTH a logical `!success` and a thrown/rejected action through one `onError` and swallow inside the lane so it never rejects and the next write still runs. Failed inverse ⇒ same `revertOne`(rows + prevById → pre-reversal value) the forward save uses — `router.refresh()` alone can't fix it (see the mount-frozen-`rows` lesson above). Serialization, not timer-cancellation, is the fix.
- **Applies to**: plan, implement, impl-review, verify

## Critical webhook/ingestion paths must fail loud and verify their delivery config

- **Context**: Any inbound integration on a critical data path — Meta/Facebook Lead Ads webhook (`src/app/(frontend)/api/webhooks/*`, `src/lib/leads/*`), or any handler that ingests external events via a third-party-managed subscription + access token.
- **Problem**: 2026-07-09 leads silently stopped reaching prod for two independent reasons, each invisible: (1) the app-level webhook `callback_url` had been overwritten to a dev's **ngrok tunnel**, so Meta delivered live leads to a laptop — and the page-level `subscribed_apps` still showed `leadgen` subscribed, masking it; (2) prod's `META_PAGE_ACCESS_TOKEN` was **expired** (Graph `190/463`), so `fetchLead` threw → route returned 500 → Meta retried ~36h then dropped the lead, logging only a `console.error`. Nobody was alerted; the gap surfaced only by eyeballing `/zgloszenia`.
- **Rule**: Never let a critical ingestion path fail with only a `console.error` — a Graph/API auth failure must raise an alert (`LEADS_ALERT_EMAIL`) or a reconcile sweep must backstop it. Prefer non-expiring credentials (System User token / `APP_ID|APP_SECRET`) over user-derived tokens that expire silently. When leads/events go missing, verify BOTH the app-level subscription `callback_url` (`GET /{app_id}/subscriptions`) AND the page `subscribed_apps` before blaming code — and treat dev tooling (ngrok) as able to clobber prod webhook config.
- **Applies to**: research, plan, implement, impl-review

## Name migrations so filename sort matches dependency order

- **Context**: Any Payload migration batch under `src/migrations/` where a same-date/same-prefix group is applied together on a fresh DB (prod, test container, CI) — especially when one migration creates a table another references via FK.
- **Problem**: Payload's `readMigrationFiles` runs `fs.readdirSync().sort()` — pending migrations execute in **filename lexical order, not** the `index.ts` array order. Numeric suffixes sort before letters (`_1`/`_2` < `_a`), so `20260709_1_fix_locked_docs` and `20260709_2_add_website_form` ran before `20260709_add_kosztorys_stages`, applying an FK migration before its table existed → `relation "kosztorys_stages" does not exist`. It passed in dev (applied incrementally, one pending at a time) and only broke on the fresh batch apply to prod.
- **Rule**: Name migrations so their filename lexical sort matches dependency order — a table-creating migration must sort before its dependents. Within a same-date batch use a consistent zero-padded numeric infix (`_0`/`_1`/`_2`), never a bare `_add` name alongside `_1`/`_2` (`'a'` > `'1'`). Verify any multi-migration batch against a fresh DB (test container / prod mirror), never trust that it works in dev where migrations were applied one at a time.
- **Applies to**: plan, implement, impl-review

## A migration is "verified" only when the RUNNING APP reads the new column — `payload migrate` "Done." is necessary, not sufficient; and a dev server booted before the migration keeps erroring until restarted

- **Context**: Any phase that adds a column + code that reads it (here S-05 `investments.vat_rate`). The `/10x-implement` phase gate splits automated (`pnpm payload migrate` exits clean) from manual (the tree/page actually shows the value), and defers the manual rows to an end-of-change checklist. Surfaced when Phase 1 was treated as effectively verified off the migrate output, then the browser threw `Failed query: select … "vat_rate" … from "investments"` on a page load.
- **Problem**: Two independent facts got conflated into one green check. (1) **"Applies cleanly" ≠ "the app serves the page."** `payload migrate` printing `Done.` only proves the DDL ran; it says nothing about a request path. (2) **A dev server started BEFORE the migration keeps erroring even though the DB is now correct.** Payload's postgres adapter builds the `SELECT` from the (hot-reloaded) collection config — so the new column is already in the query text — but the running process's render/connection state predates the column landing, so the page 500s. Both local dev servers booted from `.env` → 5433 (the DB that _did_ get the column), yet one booted at 13:34 and the migration ran at 13:53, so it served the stale error. `psql \d investments` showed `vat_rate` present and a fresh `getPayload().findByID(77)` returned `vatRate: 0.08` — proving DB+code correct while the browser still failed. ~15 min chasing "wrong DB" before the boot-time ordering was the answer.
- **Rule**: (1) Do not mark a schema/migration phase done — or move to the next phase that depends on it — on the migrate command's exit output alone. Verify **live**: reload the actual page (or run the real `getPayload` query path), see the new field render. This is the same family as the lightningcss / React-Compiler lessons: **verify against the running app, not a command one-liner.** (2) After applying a migration, **restart every dev server that was running before it** — a pre-migration process serves stale `column does not exist` errors that look like a code bug but are a boot-order artifact; the tell is `psql`/a fresh query succeeding while the browser 500s. (3) When a "column does not exist" error contradicts `\d table`, suspect a stale process or wrong-DB connection before re-diagnosing the migration.
- **Applies to**: implement, impl-review, verify, plan-review

## Before filing "X isn't validated", follow X to its READ path — a scoped query can make the invalid state unreachable

- **Context**: Any "layer L doesn't validate field F" finding. Surfaced on `transactions.kosztorysStage`: `createTransferAction` checks the etap belongs to the tagged investment, `validateTransfer` doesn't — so admin/REST can tag a deposit on investment B with investment A's etap.
- **Problem**: Filed (EX-547) from write-side reasoning alone. The read path kills it: `sumDepositRowsForInvestment` is scoped `WHERE investment_id = $1` and `kosztorys-etap-totals.tsx` sums only that investment's stages — the foreign tag is never fetched for A, never read for B, and falls into „Bez etapu" with `zaliczkiTotal + pozaEtapem = wplatyNet` intact. Worst case renders identically to an untagged deposit, a legal state. The "fix" would have made `validateTransfer` async and rewritten ~39 sync tests to defend a non-defect.
- **Rule**: A missing write-side check is a candidate, not a defect — trace the field to its consumers and finish the sentence "and then the user sees ⟨wrong figure⟩" before filing. Scoped reads are load-bearing validation; read the SQL/`where` before assuming an orphan propagates. If a cheap fix exists anyway, prefer it (here: `filterOptions` on the field, not an async hook).
- **Note (EX-536)**: the concrete anchor — `transactions.kosztorysStage`, `sumDepositRowsForInvestment`, `kosztorys-etap-totals.tsx`, `zaliczkiTotal + pozaEtapem` — was **removed** when the deposit→etap bridge was torn out (column dropped, `zaliczki.ts` deleted). A grep for those symbols now finds nothing; the reasoning generalizes regardless of the retired example.
- **Applies to**: code-review, impl-review, simplify, plan, tdd

## Enforce "one concept, one name" with an AST rule, not grep — and ship the guard DORMANT until the renames land

- **Context**: Domain-name drift (EX-548) — kosztorys named financial figures in Polish (`bilans`/`marza`/`rabat`/`wplaty`) while transfers/`lib/db` named the same figures in English (`balance`/`margin`/`discount`/`deposit`). One concept, two names, colliding exactly at the recon seam. We wanted a mechanical guard so new code can't reintroduce the drift, wired into the review gate.
- **Problem**: grep is unusable for this — the prose-to-identifier ratio drowns the signal (`rabat` = 37 identifier hits inside 193 total occurrences; `etap` = 3 inside 175). The Polish words live overwhelmingly in **UI strings and comments**, which are _correct_ (Polish UI is the rule) — only code **identifiers** are drift. A second footgun: adding a `no-restricted-syntax` block on overlapping files silently **overrides** (doesn't merge) the existing `process.env` guard in flat config.
- **Rule**: Scope the check to `Identifier` AST nodes via a custom flat-config ESLint rule (inline `local` plugin, not `no-restricted-syntax`) — Polish UI strings/comments become invisible, only identifiers are flagged, and match each Polish stem at a camelCase word boundary (`^stem|Stem`) so English collisions (`strategy`≠`strata`, `metaphor`≠`etap`) and uppercase DB enum values (`RABAT`/`LOSS`) pass clean. Validated: 268 flags / 31 files / zero false positives. But a guard that flags a large **pre-existing** violation must be committed **commented out** (`TODO(EX-548)`, re-enable = pure uncomment): flipping it to `error` before the ~268-site rename lands paints `pnpm lint` red on every un-renamed site and blocks all unrelated work. Order is renames-first, then enable — never the reverse. Also: the whole `.claude/` tree (parallel worktrees with built `.next`) must be in eslint's global ignores or `eslint .` OOMs traversing it.
- **Note (2026-07-26 re-inventory, `a5ef7baf`)**: two follow-on failures of the guard _as committed_, found by running it read-only as an inventory tool. (1) **The stem list is the weak point, not the rule.** Its nine stems match far less in identifier positions than grep suggests (`strata` → 0, `zaliczk` → 0, `robocizn` → 1, `etap` → 2) while ~22 real drift identifiers live in families it never lists (`sumaPrac*`, `doZaplaty*`, `materialy*`, `saldo*`, `wydatki*`, `reszta*`, `netto*`, `brutto*`, `wykonan*`) — so enabling it as written would **certify the codebase clean while a third of the drift survives**. Treat a stem list as spec to be reviewed, not a list to append to; and re-derive it from an Identifier-scoped scan at the moment you enable the rule, because ⅓ of this surface was created in the six days between two research passes. (2) **`Identifier` scoping has a blind spot: Polish string-literal union members.** `SectionPieBaseT = 'przedmiar' | 'wykonane'` and `SummaryViewT = 'summary' | 'wydatki' | 'wplaty' | 'etapy' | 'podwykonawcy'` are structurally invisible to the rule; closing it needs a second visitor (`TSLiteralType` / `Literal` inside `TSUnionType`). Also widen `files` beyond `src/**` — live drift sat in `e2e/`.
- **Note (2026-08-15, rename executed)**: the third and worst failure, found only by rewriting the rule and re-running it as the worklist. **The rule used letter case as a proxy for "frozen DB enum value".** Matching `/^stem|Stem/` against raw `Identifier` names means an all-caps name can never match a lowercase-anchored stem — so `RABAT` passed, which was intended, and `ROBOCIZNA_TAB` and `PRE_RABAT_CLIENT` passed for exactly the same reason, which was not. A proxy that happens to exempt the right thing on the examples you tested will exempt the wrong things on the ones you didn't. Replace it with the two explicit pieces it was standing in for: split the identifier into words (`([a-z0-9])([A-Z])` + `[_\s]`), test each word case-**insensitively**, and keep a literal `FROZEN` allowlist of the actual enum values (`RABAT`, `KOREKTA`). Same pass closed the other three blind spots — Polish string unions (`TSLiteralType > Literal`), code-valued object properties (`Property > Literal.value` gated on an `id`/`key`/`value`/`type` key), and the `payload-types.ts` ignore that had no reason to exist. Enabling the fixed rule surfaced a dozen violations the "clean" version had certified green.
- **Applies to**: code-review, impl-review, simplify, plan, rule-authoring

## A frozen wire value is frozen at the boundary only — naming a variable after it propagates a constraint inward that never applied

- **Context**: EX-548. `'RABAT'` is a value in `enum_transactions_type` (`migrations/20260611_add_rabat_enum.ts:7`) and, via `TRANSFER_TYPE_LABELS.RABAT = 'Rabat'`, the SUMIF criterion in every client sheet (`sheet-summary.ts:42`). It genuinely cannot change — stored on real transfer rows, and changing it breaks client spreadsheet totals.
- **Problem**: Because the _value_ is `RABAT`, everything derived from it got named after it — `rabatClientNet`, `totalRabat`, `investmentRabat`, `globalRabatNet`, `itemRabatNet`, `rabatAmount`, `applyPercentRabatSchema`, `handleApplyPercentRabat`, `PercentRabatTool`, `rabatMismatch`, and the file `lib/kosztorys/percent-rabat.ts` — ~150 occurrences, the largest stem in the drift inventory, none of them a stored value. The same shape appears inverted one plane over: `sum-transfers.ts` aliases `AS balance` in SQL, then `register-saldo.ts` wraps the result and renames it _back_ to `saldo`, which `use-saldo.ts` propagates through 20 files. In both directions a boundary name leaked into ordinary TypeScript symbols by proximity, not by necessity.
- **Rule**: Translate at the boundary and never again. A DB enum value, a sheet label, a third-party payload key, a URL segment — each is frozen exactly where it is serialized; the first identifier that touches it takes the **domain** name, not the wire name. When a wrapper renames an already-correct English field into the local dialect (`AS balance` → `{ saldo }`), that wrapper is the defect, not the callers downstream of it. Corollary for audits: "we can't change it, it's in the DB" is a claim about one string — verify it against `src/collections` / `src/migrations` before accepting it as cover for a family of identifiers (here: zero hits for every drift stem).
- **Applies to**: code-review, impl-review, simplify, plan, rule-authoring

## A consumer with an empty-means-everything fallback degrades silently when the store's only writer goes — record the degradation, or it gets "fixed"

- **Context**: `investment-summary-panel` (2026-07-26). Under `?widok=v2`, `/inwestycje/[id]` stops rendering `FinancialStats`; the summary panel carries the client figures and an owner-only strip carries the rest. The tile block was also the only UI writing `header-fields-store`. (`?widok=v1` is the unchanged page and keeps the dynamic bilans.) **EX-672 (2026-08-12) deleted the concrete subject** — print, CSV and the store are gone — so the paragraphs below are the worked example, not live behavior; the rule outlives them.
- **Problem**: the print button read the visibility store and, when it was **empty**, passed every header field through. With no tiles on the page the store was always empty, so the printout took the all-fields branch unconditionally: the header printed complete, but its bilans was **static** — the deselect-a-tile-and-watch-the-bilans-move affordance was gone from that page. Nothing errored and nothing looked broken, so the next reader was likely to read the always-empty store as a bug and "restore" it.
- **Rule**: When you remove the only writer of a store that another feature reads with an empty-means-everything fallback, the fallback stops being a fallback and becomes the behavior — say so in writing at the moment you remove it. In that case it was **accepted, not a defect**: the owner wanted the tiles off that page and a static header was the correct trade. A silent always-default branch is the kind of thing a code review flags as dead code and deletes.
- **Applies to**: implement, code-review, simplify

## A guard that fails on the ordinary path teaches people to silence it — scope its invalidation to the entity that actually moved

- **Context**: `financial-golden-master-db.test.ts` (2026-07-28). The golden master froze every figure against the prod dataset restored into the 5435 `db-test` container, and validated the fixture with ONE checksum over all `transactions`. The pre-push hook refreshes `dumps/dump-latest.sql` from Neon on **every** push, so the dataset it guards moves whenever the business enters a transfer.
- **Problem**: One new transaction anywhere invalidated the fixture for all 128 investments at once, and the only thing the suite could say was "regenerate". The design comment even names the failure mode it was avoiding ("a golden master earns a reputation for noise and gets deleted") and then walked into a slower version of it: the ritual response to a red parity leg became `pnpm test:golden:update`, without reading the 500-line diff — which is exactly the push where a real drift rides along unnoticed. Worse, the whole-dataset check ran FIRST and short-circuited, so a genuine drift and a new invoice were indistinguishable.
- **Rule**: Invalidate a golden master **per entity**, not per dataset. Hash the inputs that feed each row's figures separately (per investment / per register / per worker), compare only the rows whose inputs are byte-identical, and report the rest as skipped rather than failed. Growth then silences only what it touched, and every untouched row still holds the net. Two things this needs to stay honest: a **floor** (fail if fewer than half the fixture's rows are still comparable — otherwise a rotted fixture is a green test that compares nothing) and a **console.warn naming the skip count**, so "regenerate at your leisure" doesn't decay into never. Generalize: before writing an all-or-nothing precondition, ask how often the ordinary workflow trips it. If the answer is "most pushes", it is not a precondition, it is noise with a stack trace.
- **Applies to**: implement, code-review, plan, test-plan

## Restore + migrate are one operation, and shared-DB fixtures must clean up on ENTRY

- **Context**: The 5435 `db-test` container, after a `pnpm db:import:test` run to chase an unrelated parity failure (2026-07-28).
- **Problem**: Two separate wedges, both from the same reset. (1) `db:import:test` restored a **prod-schema** dump and stopped, so every migration since that dump was missing — the next run died on `column "net_amount" does not exist`, which reads as a code bug. (2) That broken run crashed two DB specs **after** their `beforeAll` had created fixture users and **before** `afterAll` could delete them. `users.email` is unique, so every later run then failed in setup with Payload's `ValidationError: The following field is invalid: email` — a message naming neither the duplicate nor the collision. The DB stayed wedged until the rows were deleted by hand, and `cash_registers.owner_id` being NOT NULL made even that delete fail on the first try.
- **Rule**: A dump restore is never finished until migrations run — chain `payload migrate` into the import script itself (`db:import:test` now ends with `&& pnpm db:migrate:test`), because the two are one operation and an agent reaching for the restore will not remember the second half. And in a spec that writes to a **shared** database, cleanup belongs in `beforeAll`, not only in `afterAll`: the run that crashed is exactly the run whose `afterAll` never fired, so exit-cleanup is guaranteed absent precisely when it is needed. `purgeFixtureUsers()` (`src/__tests__/helpers/`) clears the whole `%@test.local` namespace on entry — dependent registers first, since Postgres cannot null a NOT NULL owner. Meta-rule for the agent: when a DB-backed guard fails, **read its verdict before resetting anything** — this one printed "the fixture is stale, not the code", and the reset that ignored it caused both wedges above.
- **Applies to**: implement, test-plan, debugging

## A DB-level `ON DELETE CASCADE` deletes rows Payload never sees — the child cache tags are yours to invalidate by hand

- **Context**: The kosztorys tree (2026-07-10, S-06). `kosztorys_sections` → `kosztorys_items` → `stage_progress` cascade at the FK level (`migrations/20260708_2_add_kosztorys_sections_items.ts`, `20260709_0_add_kosztorys_stages.ts`), and every read of them is cached under its own tag (`lib/cache/tags.ts`).
- **Problem**: Payload's `afterDelete` hook fires for the row **it** deleted, not for the rows Postgres removed underneath it. So `payload.delete(section)` invalidates `kosztorysSections` and leaves `kosztorysItems` / `stageProgress` serving rows that no longer exist. Nothing errors — the stale read just looks like a caching flake, and it reproduces only after a delete.
- **Rule**: Wherever a cascade FK deletes cached children, the server action must list the **child** tags alongside the parent's (`removeSectionAction` / `removeStageAction` in `lib/actions/kosztorys.ts` do exactly this). Generalize: a hook-based invalidation scheme only covers what the ORM performed. Any deletion the database does on its own — cascade, trigger, `ON DELETE SET NULL` — is outside the hook's field of view, so adding a cascade FK to a cached table is also a cache-invalidation change.
- **Applies to**: implement, plan, code-review

## Wipe-and-reinsert is safe for the kosztorys tree because nothing outside it stores an item/section/stage id

- **Context**: Snapshot restore (S-06) reverts a kosztorys by deleting the whole tree and re-inserting from a `jsonb` payload, minting fresh primary keys rather than preserving them.
- **Problem**: That is only safe if no other table references those ids as a business FK — otherwise restore silently orphans the referrers. Verified at design time: transfers, expenses and the sheet sync all key on transfer id + category, never on a kosztorys row id; the only external references are Payload's internal `payload_locked_documents_rels`, which cascade harmlessly.
- **Rule**: The invariant is load-bearing, not incidental — the day something starts keying on a kosztorys item id (a per-item photo, a per-item transfer link), restore-by-reinsert stops being correct and must preserve ids or remap the referrer. Check this before adding an FK **to** `kosztorys_items` / `kosztorys_sections` / `kosztorys_stages`.
- **Applies to**: plan, implement, code-review

## A destructive replace's undo is a `manual` snapshot taken on the TRANSACTION handle, before the wipe

- **Context**: The two paths that replace a whole kosztorys — the Google-sheet import (EX-417) and „Wczytaj szablon…" (EX-560) — both promise the user the swap is reversible from „Wczytaj". They now share `lib/kosztorys/replace-tree-with-snapshot.ts`.
- **Problem**: Three independent ways to break that promise, none of which errors. Take the snapshot **outside** the transaction and a rollback leaves an orphan restore point pointing at a wipe that never happened. Take it **after** the wipe and it captures an empty tree — the undo restores nothing. Write it as `kind: 'auto'` and it is ambient history: capped at the newest 50 and swept after 7 days, so the undo silently expires. Only a labelled `manual` row is a targetable entry in „Wczytaj".
- **Rule**: Snapshot on the transaction handle, before the destructive write, `kind: 'manual'`, with a label that names _what_ it precedes (`Przed wczytaniem: «nazwa szablonu»`) — an unnamed label makes two swaps indistinguishable. Pin it with a spec that forces a mid-transaction throw and asserts the snapshot table is **unchanged**, not just that the tree is. Related: the client sends a preset/sheet **id**, never tree data, so a forged payload can't decide what gets written.
- **Applies to**: plan, implement, code-review

## A restored dump has invoice METADATA but not the bytes — media lives in Vercel Blob, and most of it is PDF

- **Context**: Building a ground-truth eval for receipt extraction (2026-07-11) from real `INVESTMENT_EXPENSE` rows in the restored local DB.
- **Problem**: `pg_dump` captures Postgres rows only. The `media` row holds an absolute Vercel Blob `url`, filename and mime type — the image itself is in an external object store, so a restored dump gives you every field except the one thing an extraction test needs. Any local fixture must `fetch()` the blob URL over the network, which also means it breaks the day a blob is rotated or deleted. Second surprise from the same corpus: **PDFs outnumber images** (479 vs 470 in the restored dev DB), so a "receipt scanner" that assumes photos is wrong for the majority of real attachments — which is why the OpenRouter `file-parser` plugin path exists alongside the plain vision call.
- **Rule**: For anything that reads attachment _content_ in a test, snapshot a fixed set of blobs into a local fixtures dir once rather than fetching live — a network-dependent fixture is a flaky test with an expiry date. And check the real mime distribution before designing around one format.
- **Applies to**: test-plan, implement, debugging

## Resolve an LLM-supplied name to an id by EXACT match or blank — never fuzzy

- **Context**: Receipt extraction maps a model-returned category name onto `expense_categories.id`.
- **Problem**: A near-match resolver looks helpful and is the worst outcome available: a hallucinated or mis-read category silently resolves to a real, wrong category and the row saves clean. Nobody reviews a field that came back filled in.
- **Rule**: Exact match (case/trim-normalized) or blank. Blank collides with the required-field validation and forces a human to pick — which is the point. This generalizes to any model output feeding a foreign key: make the failure mode "empty and blocking", never "plausible and silent".
- **Applies to**: implement, plan, code-review

## `transform-gpu` on the app shell breaks every `position: fixed` child — portal to `document.body`

- **Context**: The frontend shell's `<main>` (`(frontend)/layout.tsx`) carries `transform-gpu`. Two separate features shipped with the same bug: the row menu opened centre-screen instead of at the cursor, and the column-resize guide stripe sat offset by the sidebar width.
- **Problem**: A `transform` ancestor becomes the containing block for `position: fixed` descendants, so `fixed` + `{left, top}` measured from viewport coordinates resolve against `<main>` instead — offset by the sidebar and the scroll position. Nothing about the CSS looks wrong; the element is simply somewhere else. The first instinct was to delete the resize guide as non-essential, which was reversed once the drag felt worse without it (owner: "now that it is lacking, I see that it was helpful").
- **Rule**: Anything positioned from cursor/viewport coordinates in this app must render through `createPortal(…, document.body)` — body is outside the transform. And don't delete a visual aid to dodge a positioning bug; fix the position.
- **Applies to**: implement, code-review, debugging

## dsg keys header cells by column INDEX — an uncontrolled header input renames the wrong entity after a delete

- **Context**: `stage-header.tsx` renders `<input defaultValue={stage.label}>` (uncontrolled) for each stage column.
- **Problem**: dsg's column virtualizer keys header cells by index (`Grid.js:98`), with no stable identity. Delete a stage and every later stage slides one index left **onto a DOM node still holding the previous stage's text**; the next blur then fires `onRename(nextStage.id, previousStageLabel)` — a silent rename of the wrong stage. This was invisible for months because the whole-grid remount `key` reinitialized every header input; removing that remount (the export-aliasing fix above) exposed it.
- **Rule**: Give any uncontrolled input inside a dsg header an explicit `key` tied to the entity (`key={stage.id}`), not to its position. Generalize: removing a remount is also a correctness change — a remount masks every stale-uncontrolled-state bug underneath it, so audit uncontrolled inputs before deleting one.
- **Applies to**: implement, code-review, debugging

## Reproduce first, explain second — and a repro that shows ZERO events is a broken repro, not evidence

- **Context**: The EX-422 grid-flicker session (2026-07-13), where three detailed causal theories were built before anything was reproduced.
- **Problem**: Four separate workarounds had accreted on top of one wrong import, each explaining the previous one's symptom. One screenshot from the owner did more diagnostic work than four files of library source read line by line. Worse, a synthetic repro that recorded no events at all was briefly read as _confirming_ a theory — the actual cause was a Radix overlay swallowing `pointerdown`.
- **Rule**: Build the reproduction before the explanation, and treat an empty observation as a broken instrument rather than a negative result. When a symptom resists synthetic input, instrument the live app on a real failure instead of running more synthetic variants.
- **Applies to**: debugging, implement, code-review

## The owner picks a formula on what the number MEANS, not on which formula makes two columns compare cleanly

- **Context**: `Wartość przedmiaru netto` (2026-07-15). The agent shipped it with rabat applied, mirroring `rowNetForView`, so the two columns would differ by quantity alone — a clean comparison.
- **Problem**: The owner overrode it on domain grounds: przedmiar is the **pre-negotiation valuation**, and rabat is a settlement-time concession that has no business touching the offer figure. So the gap `Netto − Wartość przedmiaru` deliberately carries both the quantity revision and the rabat — that is the honest picture of what happened to the position, not a defect. The agent's rationale was UI symmetry and never asked what przedmiar represents. Same failure in the other direction on EX-479: "z pomiaru z natury" was read as a quantity base and filed as a data-model change, when price is constant within a row so the value ratio already IS the pomiar ratio.
- **Rule**: When a formula is a decision rather than a reading of the sheet, argue it from what the figure means to the business. Symmetry with a neighbouring column is not evidence. And an owner's phrasing describes what they want to **see**, not the computation — don't escalate a slice off one word without checking whether the existing figures already express it.
- **Applies to**: plan, implement, code-review

## react-datasheet-grid's own row menu can't be reused under `lockRows` — and its inserted row has no server identity

- **Context**: The kosztorys editor's insert/delete row affordances (2026-07-11, now the ⋯ row menu in `components/kosztorys/editor/grid/menus`).
- **Problem**: dsg ships a context menu (`INSERT_ROW_BELLOW` / `DELETE_ROW` / `DUPLICATE_ROW`), so reaching for it looks like the cheap option. Two things stop it: `lockRows` — which we need, since rows are server entities — disables it outright, and `createContextMenuComponent` only **relabels** the built-in entries, it cannot add custom ones. Even without `lockRows`, dsg's row-create produces a client-only row with no `id`, no `sectionId` and no `displayOrder`, which our model can't use — an item must come back from a server action first.
- **Rule**: Any row insert/delete affordance in this grid is ours end-to-end: our menu component, our action, our optimistic splice. Don't re-litigate dsg's built-in menu. Related: `insertItemAction` shifts `display_order` for a **range** of rows, which is only acceptable because the shift is bounded by one section — the 1000-row scale that forced reordering to be a neighbour-swap is a whole-sheet concern, and a section is far smaller.
- **Applies to**: plan, implement, code-review

## The owner's sheet is the authority on what a figure MEANS — it is not a spec for what to build

- **Context**: Globalny rabat (2026-07-15). A read-only probe of the live V1 sheet found **no
  „rabat za całość" row anywhere** — `Podsumowanie` is `Robocizna + Materiały = Łącznie`, and the only
  working discount is the per-row percent in column `R`.
- **Problem**: `AGENTS.md` says the sheet is the domain authority, which invites the inverse reading:
  "no sheet parity ⇒ don't build it" (or worse, "invent parity"). Both are wrong. The sheet answers
  _what does this number mean to the business_; it does not enumerate what the business needs next.
  The same probe found the opposite trap too — `transfery!K3 = SUMIF(C:C;"Rabat";E:E)` exists in the
  sheet and **no formula reads it**, so a cell's presence is not evidence of use either.
- **Rule**: Probe the sheet to learn a figure's meaning and to find where a new figure would attach.
  When the owner asks for something the sheet lacks, that's **new work without parity** — say so
  explicitly in the change doc so nobody later "restores parity" by deleting it. Check whether a
  sheet cell is _read_ by a formula before calling it a live figure.
- **Applies to**: frame, research, plan, domain conversation

## Sequence changes that redefine the same total — bundling makes the wrong number unattributable

- **Context**: Globalny rabat was deliberately built _after_ `kosztorys-stages-source-of-truth`, not
  alongside it, because that change was in the middle of moving what "total" means (sum of etapy, not
  pomiar). Same call was made earlier in `kosztorys-stage-values`.
- **Problem**: Two changes that both move one definition are cheap to bundle and expensive to debug —
  when the total comes out wrong you cannot say which of the two moves broke it, and whichever one
  was written against the old definition has to be rewritten anyway.
- **Rule**: When change B sits on a definition change A is currently rewriting, sequence them. The
  cost of waiting is one merge; the cost of bundling is a non-falsifiable bug.
- **Corollary — price a coupling premise in lines before accepting it.** `kosztorys-stage-values`
  was proposed as one change because "both pieces share a netto/brutto axis, so building them apart
  means tagging the columns twice." Read in the code, the intersection was **two string constants**
  and the double-tagging cost ~0 lines — a one-way dependency, not a shared axis. Worse, the bundle
  made its own justification circular: piece 1 argued brutto stage columns were fine because piece 2
  would hide them, while piece 2's value rested on hiding piece 1's new columns. Split, each claim
  became testable.
- **Applies to**: frame, plan, roadmap sequencing

## A test that guards the OLD definition goes tautological when the definition changes — it stays green and stops testing anything

- **Context**: `kosztorys-stages-source-of-truth` moved „Pomiar z natury" from a typed field to
  `Σ etapów`. One test block existed _specifically_ to stop the licznik regressing to 150% (EX-489).
  After the change its numerator and denominator both read the stage sum, so it computed `1/1` for
  every input — green, permanently, and blind.
- **Problem**: A definition change doesn't break the tests that encode the old definition; it
  **silences** them. Six assertions saw the rule, all in one file, and a full green suite would have
  been read as "no regression". Adding new assertions beside the old block is the trap: the tautology
  survives, still looking like coverage.
- **Rule**: Before changing what a figure means, find every assertion that reads it and ask what each
  one computes _after_ the change. Any that degenerates gets **rewritten, not supplemented** — and
  written **red first**, so the suite proves the new rule instead of tolerating it. A suite that goes
  green without a single test having gone red first has told you nothing.
- **Applies to**: plan, implement, any change to a shared figure's definition

## React Compiler bails SILENTLY — no error, no warning — and "restore memoization" is not automatically a win

- **Context**: EX-496. `use-kosztorys-editor.ts` emitted **zero** `_c` cache slots. `panicThreshold`
  defaults to skip-and-continue, so the file left the pipeline untransformed with no build error, no
  lint warning, no console message. Every compiled downstream consumer keyed on its handlers/`columns`
  therefore missed on every keystroke, invisibly.
- **Problem**: Two traps, in sequence.
  1. **You cannot tell by reading the source.** The three constructs that bailed here were mundane:
     a computed object key whose value is a **call expression** (`{ ...r, [stageKey(id)]: 0 }`), a
     **forward reference** between function declarations (legal at runtime via hoisting), and a
     **ref read during render**. Bails surface one at a time — fixing the first reveals the second.
     The only honest check is to compile the file and look for `_c(` in the output.
  2. **Chasing the memoization made things worse.** Clearing the bails required deleting the ref
     mirrors and routing cell handlers through context — and a context **value** whose identity churns
     re-renders every consumer, which `React.memo` and datasheet-grid's per-row memoization do not
     stop. The un-memoized hook had been smooth its whole life. Reverted.
- **Rule**: If a hot component's identity-stability matters, **verify compilation empirically** —
  compile the file through `babel-plugin-react-compiler` and assert `_c(` appears inside the function
  (assert positively; "no bail logged" is weaker, an unrelated `_c` elsewhere can mask a new bail).
  Then, before fixing a bail, ask what the fix costs: a memoization win is worth nothing if the wiring
  that buys it introduces a per-keystroke re-render. Measure the actual complaint, not the metric.
- **Applies to**: perf work, React Compiler, any "make this memoize" task

## This repo has no hook renderer — logic that must be tested has to live OUTSIDE the hook

- **Context**: EX-448 gave expense line-item rows a stable client `id` and rekeyed the file map /
  generation markers by it. The alignment logic ended up **inside** `useInvoiceFiles`, and the two
  existing unit tests had covered the pure exports (`reindexAfterRemoval`, `setFilesAt`) the refactor
  deleted. There is no `@testing-library/react` and no jsdom in `@package.json`, and adding one is not
  free here — a `pnpm install` on this arm64 machine can swap the native `lightningcss` binary and
  break the Tailwind build (see the dependency rule in `AGENTS.md`).
- **Problem**: A refactor that pulls logic _into_ a hook silently converts testable code into
  untestable code, and the deleted tests make the loss look like tidying. Nothing fails; coverage just
  evaporates.
- **Rule**: When a hook carries logic worth guarding, extract it as a **pure function beside the
  hook** and test that — `positionalFiles` / `filesByRowId` in `src/lib/utils/upload-file-client.ts`
  are the shape: id-space↔position-space projections the hook merely calls. Anything genuinely
  hook-internal (effects, subscriptions, render timing) is a **browser-level** risk in this repo — it
  goes to `/10x-e2e` or the `e2e-backlog`, not to a hook-renderer dependency.
- **Applies to**: implement, test-plan, any React hook refactor

## Positional identity is two roles fused — split them, don't replace them

- **Context**: EX-448. A line-item row's array index served as both (a) its **editor-lifecycle
  identity** (which file, which spinner, which "nie odczytano" marker belongs to this row) and (b) the
  **wire order** the submit contract uses — the server matches uploaded mediaIds to rows by position.
  Role (a) is the bug: an index shifts on every insert/remove, so the code grew a reindex/remount
  apparatus just to keep out-of-form state chasing moving rows.
- **Problem**: "Index as key is a bug" invites replacing the index everywhere — which would have meant
  changing `resolveInvoiceMediaIds` and the server contract for a purely client-side defect.
- **Rule**: Separate the two roles instead of picking one. Stable ids own identity for the whole
  editing lifecycle; position stays the wire format; and the conversion happens at **exactly one
  boundary each way** (`positionalFiles` at submit, `filesByRowId` on recovery). The reindexing
  machinery then deletes itself — it existed only to paper over the fusion.
- **Applies to**: plan, implement, any list-editing UI with an out-of-form side map

## In the editor, a figure's SOURCE follows whether it can change mid-session — not whether it's "kosztorys data"

- **Context**: The read-only bridge put Robocizna and Materiały side by side in one Podsumowanie block,
  from two different places: robocizna from the **client-side** editor calc, materiały (and the per-etap
  zaliczki) as **server props** off `deriveFinancials`. That looks like an inconsistency worth
  "fixing" — one block, two sources.
- **Problem**: Unifying it either way is wrong. Move robocizna server-side and it stops reacting to
  unsaved grid edits, which is the whole point of showing it live. Move materiały client-side and you
  are re-deriving the transactions plane inside the editor — duplicating `deriveFinancials` and
  reopening the FR-015 firewall you deliberately kept shut.
- **Rule**: Pick the source per figure by asking **can this change during an editing session?** Only
  what the grid edits does — those are client-calc. Everything from the transactions plane is a server
  prop, cached under `CACHE_TAGS.transfers` so a transfer mutation already revalidates it, no sync
  machinery. Two sources in one block is the correct shape, not a smell.
- **Applies to**: plan, implement, any kosztorys↔financial-plane surface

## A stale branch whose integration surface was refactored gets PORTED, not rebased

- **Context**: S-07 undo/redo was fully built on `feat/kosztorys-undo` — engine, commands, 30 unit
  tests — off a base ~200 commits behind `staging`. In between, EX-515 split
  `use-kosztorys-editor.ts` (+366/−139): exactly the file the integration hooks into.
- **Problem**: `merge`/`rebase` treats that as a text conflict and asks you to reconcile hunks
  line by line against a file that no longer has the same shape. That's not a merge, it's a
  re-implementation performed under the worst possible interface — three-way diff markers, with the
  refactor's intent invisible.
- **Rule**: Split the branch by coupling before you touch git. **Self-contained files** (a pure engine,
  its tests, a pure reducer) **copy verbatim** — zero conflict by construction; typecheck confirms.
  The **integration** (the ~250 lines that reach into refactored handlers) gets **re-written against
  the current code**, using the branch as a specification, not as a patch. Verify up front that each
  seam still exists _by name_; if the names survived, every capture has a definite home and the
  re-write is mechanical.
- **Applies to**: implement, any long-lived branch reintegration

## A Suspense fallback for a warning surface must be NEUTRAL — never render the reassuring state

- **Context**: EX-542 streamed the investment page's „z kosztorysu" recon block behind `<Suspense>`.
  That block's whole job is to scream when the kosztorys and the transactions plane disagree.
- **Problem**: The obvious skeleton — the block's own layout with its usual „zgodne" cue — flashes
  _"everything reconciles"_ for as long as the slow query runs, then flips to a mismatch. A fallback
  that shows the good state is a lie with a timer on it, and the user's eye has already moved on.
- **Rule**: Deferring a check does not license showing its optimistic outcome. The fallback keeps the
  heading and the shape (no layout shift) and shows placeholders — never the green/OK cue, never a
  value. Same logic applies to any badge, health dot, or „brak różnic" line rendered from data that
  hasn't loaded.
- **Applies to**: implement, any Suspense boundary over a reconciliation / validation surface

## A price-view flag is not an audience flag — an owner-internal warning must be gated on WHO is looking

- **Context**: EX-535 added a reconciliation scream (red `!` + „Niezgodność z transakcjami") to the
  kosztorys footer, and EX-541 gated it on `priceView === 'client'`. That gate reads like an
  audience check but isn't one: the client-facing view _pins_ the price view to `'client'`, so the
  gate leaves the scream **on** for exactly the reader who must never see it.
- **Problem**: the two flags answer different questions — `priceView` says _which price column is
  being rendered_, the audience says _who is on the other side of the screen_. They coincide on the
  owner's screen and diverge on the shared one, which is why the bug is invisible in dev.
- **Rule**: an owner-internal surface (a reconciliation warning, a margin figure, a debug badge)
  gets its **own** audience flag, threaded from the route that decided the audience. The live gate
  is `!preview && priceView === 'client'` (`brutto-netto-summary.tsx:92`) — two flags, because they
  are two facts. Verify the guarantee on the **payload**, not the DOM.
- **Applies to**: any flag whose name describes a _rendering mode_ being reused as a _permission_.

## `describe.skipIf(!ENV_READY)` makes a green run indistinguishable from a run that did nothing

- **Context**: every DB-backed spec here opens with
  `const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)` and
  `describe.skipIf(!ENV_READY)`. Without those vars the suite exits 0 having asserted nothing.
- **Problem**: "the test passes" is the sentence you say at a review gate, and it is false here in
  the one case that matters — a fresh shell, CI without secrets, an agent that forgot
  `node --env-file=.env`. The skip is silent by design; the exit code cannot tell you.
- **Rule**: when a success criterion names one of these specs, **confirm the reported test count is
  non-zero** before checking the box. A skipped spec is an unmet criterion, not a met one.
- **Applies to**: `src/__tests__/**` DB specs (`financial-golden-master-db`, `share-token`,
  `kosztorys-restore`, `preview-kosztorys-token`, the `leads/*.db` specs, …) and any future
  `skipIf`-guarded suite.

## Moving a disclosure guarantee from the DATA side to the RENDER side inherits every persisted client preference as an attack surface

- **Context**: the client kosztorys view originally stripped subcontractor fields out of the payload
  (`toClientView`). The owner retired that: the full tree ships, and the render alone decides what
  is shown by pinning the price plane to `'client'`.
- **Problem**: the review found the plane was still read from **per-investment localStorage**. On a
  public page that is client-controlled state — flip the stored value and the contractor's cost
  basis renders. A data-side projection can't be defeated that way; a render-side one can, by every
  input it reads that the client can write.
- **Rule**: when the guarantee lives in the render, enumerate the render's inputs and pin the
  load-bearing ones server-side. In this repo that's `use-kosztorys-editor.ts:162-167`
  (`const view = preview ? 'client' : persistedView`) plus the column allowlist — two halves of one
  lock; neither is sufficient alone. Persistence gets its own kill-switch (`:1194`), because
  read-only cells are a UI fact, not a write guarantee.
- **Applies to**: any public/shared surface that reuses an authenticated component tree — localStorage,
  cookies, URL params and stored user preferences are all attacker-writable there.

## When a scope cut would distort the model to simplify the view, sequence instead — "model ma odwzorować rzeczywistość, nie odwrotnie"

- **Context**: EX-536 (materiały netto/brutto). The proposed simplification was to make the view's
  materiały figure agree with the ledger by flattening a distinction that exists in reality —
  invoices are not always with VAT.
- **Problem**: the tempting cut is always the one that makes two numbers on screen agree. It buys a
  clean screenshot by writing a false rule into the model, and the false rule then has to be
  unwound by every slice built on top of it.
- **Rule**: cut by **sequencing**, not by distortion — ship the faithful piece now, name the
  divergence it creates, and record it as _accepted and intended_ rather than as a bug to chase.
  Slice A shipped with the Podsumowanie deliberately not reconciling against the investment page;
  the persistence slice closed it. A stated divergence is cheap; a wrong rule in the model is not.
- **Applies to**: any "can we just treat X as Y for now" that changes what a figure _means_ rather
  than how much of it we build.

## Adding a field to a kosztorys tree entity is not done until the raw restore INSERT knows about it

- **Context**: EX-556 added a nullable `plane` column to `kosztorys_stages`. The Payload collection
  field, the `KosztorysStageT` type and the read path were all updated — and snapshot restore still
  silently dropped the value.
- **Problem**: The snapshot restore path does not go through Payload. `src/lib/kosztorys/insert-kosztorys-tree.ts`
  builds a raw `INSERT INTO kosztorys_stages` from a hand-written column list (`STAGE_INSERT_COLUMNS`).
  A column missing from that array is not an error anywhere — the insert succeeds, the field comes back
  `null`, and the loss only shows up as "everything re-warns after a restore".
- **Rule**: When you add a field to a kosztorys tree entity, update the raw insert column list in the
  same edit as the collection field. Treat the two as one change; a Payload field alone is half of it.
- **Applies to**: `src/lib/kosztorys/insert-kosztorys-tree.ts`, snapshots, presets — any path that
  writes the tree with raw SQL rather than the ORM.

## In a git worktree with symlinked node_modules, `next build` must be run with `--webpack`

- **Context**: Verifying a slice inside `.claude/worktrees/<name>` (the 10x worktree pattern).
- **Problem**: Next 16's default Turbopack builder is incompatible with the symlinked `node_modules`
  a worktree gets, so `pnpm build` fails for reasons that have nothing to do with the diff — easy to
  misread as a real breakage and chase.
- **Rule**: In a worktree, run `next build --webpack`. It is the equivalent build signal; don't "fix"
  the Turbopack failure and don't treat it as a slice regression.
- **Applies to**: any review-gate suite run executed from a worktree rather than the main checkout.

## A TypeScript spec table cannot govern a choice made inside SQL — carry both sums and pick above the query

- **Context**: EX-536's netto expense type added a `billedAmount: 'amount' | 'netAmount'` column to
  `TRANSFER_TYPE_SPECS`, saying which stored column bills the investor.
- **Problem**: By the time `deriveFinancials` runs, the aggregation has already happened — the natural
  place to honour the column looks like the query (`SUM(CASE WHEN type = 'INVESTMENT_EXPENSE_NET' …)`).
  That puts the type name back into SQL, where the spec table cannot reach it: the table stops being the
  single answer, and the _next_ netto-billed type silently misses the `CASE` with no build error.
- **Rule**: When a spec-table column decides which of several sums a row contributes, have the query
  return **all** the sums (`SUM(amount)` _and_ `SUM(net_amount)`) and let the TypeScript layer pick by
  the column. The query stays type-agnostic; the table stays the only authority.
- **Applies to**: `src/lib/db/sum-transfers.ts` ↔ `src/lib/db/investment-financials.ts`
  (`billedAmountFor`), and any future spec-table column with a SQL-side twin.

## A server action that accepts a caller-supplied `Where` can never be relaxed for a public surface

- **Context**: EX-569 put a bulk invoice download on the unauthenticated kosztorys share path. The
  obvious move was to reuse the transfers table's bulk-fetch action, `fetchFilteredTransfers`.
- **Problem**: That action takes a `Where` from the caller with no investment scoping — its only
  scope check is `requireAuth`. Dropping the auth to serve a public page would hand anyone the entire
  transfers table, not just the invoices of one investment.
- **Rule**: When a public surface needs data an authenticated action already returns, ask what bounds
  the query. If the _caller_ supplies the filter, the auth check is the only bound and the action is
  not reusable — route around it (server-render the rows into props, or write a scoped read that takes
  an id, not a `Where`).
- **Applies to**: `src/lib/actions/fetch-transfers-for-invoices.ts`, and any `'use server'` read whose parameter is a query
  rather than an identifier.

## An exhaustiveness assertion only protects while both sides are authored independently

- **Context**: `TransferTypeT` is a literal union built from a hand-written `TRANSFER_TYPES`
  tuple, and `src/collections/transfers.ts:38-44` asserts the Payload `options` list covers it
  (`_AllTransferTypesCovered`). Collapsing the type list into one derived source looks like
  obvious dedup.
- **Problem**: deriving `TRANSFER_TYPES` from `Object.keys(TABLE)` widens `TransferTypeT` to
  `string` — `z.enum` and every `Record<TransferTypeT, …>` exhaustiveness check silently stop
  checking anything. Deriving the Payload options by `.map()` over the same tuple makes the
  drift assertion **vacuously true**: it compares a list against itself. Neither failure is a
  build error; both are a _loss of protection_ that looks like a successful refactor.
- **Rule**: a drift assertion is only worth its bytes while its two sides are written by hand
  from different places. Before deduping one into the other, ask what the assertion would still
  catch — if the answer is "nothing", the dedup deleted the check, not the duplication.
- **Applies to**: `satisfies Record<Union, …>` tables, Payload `options` vs a TS union, zod
  enums mirrored from a constant, any "single source of truth" collapse of two lists.

## A golden master frozen over a borrowed dataset needs a dataset fingerprint

- **Context**: the per-investment golden master (`src/__tests__/financial-golden-master-db.test.ts`)
  freezes every financial figure over the shared 5435 `db-test` restore — a dataset the test does
  not own and that `pnpm db:import:test` replaces wholesale.
- **Problem**: after a refresh, every figure differs, so the suite reports a full-width drift that
  reads as "the refactor broke everything". The rational response to a test that cries wolf at
  that scale is to delete it. The snapshot is also **preservation, not correctness** — it faithfully
  freezes existing bugs (EX-574 was deliberately left inside it), so a green run means "unchanged",
  never "right".
- **Rule**: fingerprint the dataset (row counts / a floor like `DATASET_FLOOR`) and check it
  **first**, so a refreshed DB fails as "regenerate the snapshot" rather than as drift. Assert the
  floor both as a test and as a precondition on the regenerate path, or an empty DB silently
  freezes a snapshot of nothing.
- **Applies to**: any characterization/golden-master spec over a restored or shared DB.

## A per-browser preference stops being a preference the moment a second audience reads the same surface

- **Context**: the Podsumowanie panel's netto / brutto / mieszane pick lived in the reader's
  `localStorage` (`useSummaryAxis`). Then the same panel got a client-facing view.
- **Problem**: the client had no control, so it silently rendered whatever the **owner's browser**
  last remembered — and the same investment read netto for one person and brutto for another.
  Hiding the control (the first stopgap) removes the affordance but not the effect: the value is
  still being read, just by someone who can no longer see or set it.
- **Rule**: ask who else renders from this state. A choice only one person makes and only that
  person sees is a preference; a choice that decides what a _second_ audience is shown is a fact
  about the entity — store it on the entity and delete the browser layer rather than layering the
  stored value on top of it. Two sources of truth for one plane is the ambiguity you set out to fix.
- **Applies to**: `usePersistedEnum` / `localStorage` column and axis preferences on any surface
  that also has a share, preview, print or client mode.
- **The guards move with it, and most of them stop being true.** The old axis picker was `disabled`
  at `vatRate === 0` ("the pick silently does nothing" — true of a rendering preference). Carried
  onto the stored mode unexamined, that same line stranded an investment in `GROSS`/`MIXED`
  permanently, editable only from the Payload admin, because the panel is the sole edit surface —
  and at VAT 0 the mode is _not_ a no-op: `MIXED` still drives both money columns. When a control's
  subject changes, re-derive every guard on it from the new subject; a guard whose rationale names
  the old subject is a bug in waiting.

## An A/B comparison affordance belongs in the URL, not in client state — the old reading must skip the new one's fetches

- **Context**: `investment-summary-panel` (2026-07-26) kept a v1 (transactions) / v2 (kosztorys)
  reading of the investment page so the owner could check the totals agree. The plan built it as a
  `useState` toggle swapping two numbers inside one panel.
- **Problem**: that made v1 a _new rendering of old figures_, not the old page — it still paid for
  every v2 server fetch, and a shared query grew columns only v2 needed. The whole point of a
  comparison axis is that one side is untouched; a client toggle cannot skip a server fetch, so it
  can't give you that side.
- **Rule**: make the reading a search param (`?widok=v1|v2`) and branch on the **server**, so the old
  reading runs its original queries and nothing else, the new reading owns all of its own fetching,
  and each side is a link two browser tabs can hold open at once. Write down the deletion condition
  with it — a comparison axis is temporary by construction.
- **Applies to**: any "keep the old surface next to the new one" migration, v1/v2 readings, and
  before/after refactor comparisons.

## A server action that invalidates any tag forces a full route render — cache tags cannot decouple two panels

- **Context**: EX-597 tried to stop a kosztorys-settings write on the investment page from
  re-rendering the (unrelated, expensive) transfers table. The instinct was tag precision: invalidate
  only what the panel reads, and the table stays put. Traced through Next 16's own source instead of
  reasoning from the docs.
- **Problem**: `addRevalidationHeader` sets `x-action-revalidated` on `pendingRevalidatedTags.length`
  alone, and **both** `revalidateTag` and `updateTag` push into that array. The cache _profile_ gates
  only `pathWasRevalidated`, which decides whether the render rides on the POST — with a profile the
  POST skips the render, the client sees a non-zero `revalidationKind` with `flightData === undefined`,
  and falls through to a plain `navigate(…, RefreshAll)`: a fresh GET of the current route. So a
  profile-revalidation does not remove the re-render, it **relocates** it and adds a round-trip. The
  only branch that renders nothing is `ActionDidNotRevalidate && flightData === undefined` — i.e. an
  action that invalidates _nothing_.
- **Rule**: if a write must not re-render the route, it has to leave the server-action path entirely
  (a route handler, which sets no `x-action-revalidated`) — and that only ships if the client already
  owns every figure the removed render would have refreshed, or the siblings go stale until the next
  navigation. Decoupling and client-side ownership are one refactor, not two. No amount of tag
  precision is a substitute.
- **Applies to**: any "this write shouldn't re-render that" instinct on a server action; `updateTag`
  vs `revalidateTag` reasoning about render cost.

## Neon latency is bimodal — separate warm from cold before believing any per-request number

- **Context**: a performance spike on the investment page produced three wrong structural theories in
  a row: `sumAllRegisterBalances` "costs 1015 ms" (it is 2.4 ms by `EXPLAIN ANALYZE`, both legs
  index-scanned), "the tree's five ORM reads cost per round trip" (they were already fully parallel —
  total equals the _slowest_ read, not the sum), and "the 83–119 ms 1-row read proves pool contention"
  (warm it is 21 ms).
- **Problem**: every one of those was a handful of **cold** samples. Neon compute wake + TLS + pool
  establishment is billed entirely to whichever query touches the DB first in a cold lambda, so the
  first query in the fan-out always looks structurally expensive, and a 2–4 sample median is dominated
  by whichever mode it happened to land in. The surface is ~20–60 ms warm and ~160–200 ms cold; a local
  bench cannot see any of it (no network, no pool), which is why local measurement agreed with the
  wrong answer twice.
- **Rule**: never accept a per-request timing without separating warm from cold, and prefer **one
  request that exposes the mechanism** to a dozen that produce a median — the sample that settled the
  tree question did so by showing the five reads' timings overlapping, not by being faster. Also read
  where `perfStart()` fires: if it wraps the first `db.execute` of a request, it is measuring the
  connection, not the query.
- **Applies to**: any DB/latency measurement taken against a preview or prod deployment; deciding
  whether an index, a denormalized column, or a query rewrite is justified.

## A hand-written `Where` → SQL translator fails OPEN — an operator it doesn't know silently widens the result set

- **Context**: `buildTransferFilters` emits a half-open amount range
  (`{ greater_than_equal: low, less_than: high }`), but `where-to-sql.ts`'s `buildFieldCondition` is a
  flat chain of `if ('op' in cond)` and had no `less_than` branch.
- **Problem**: an unmatched operator is not an error — it falls through. The ceiling vanished and the
  stats query ran `amount >= low` unbounded, so searching „500,00" listed 20 rows totalling 10 000 zł
  under a tile reading 22 560 189,17 zł. Nothing typed, logged or threw; the list plane (Payload
  `find`) and the stats plane (raw SQL) simply disagreed. The same file's other trap is upstream:
  `stripCancelledFilters` discarded the default `type not_in ['CANCELLATION']` while the SQL re-added
  only `cancelled IS NOT TRUE` — a comment saying "SQL already excludes cancelled" is exactly what hid
  the gap, because `cancelled = true` and `type = 'CANCELLATION'` are two different concepts.
- **Rule**: any operator the filter builder can emit needs a branch in the translator, and the
  translator should be exhaustive (or throw on an unknown operator) rather than fall through — widening
  is the dangerous direction. Test the **bridge**: run the real builder through the real strip into the
  real translator and assert the **emitted SQL**, not the intermediate `Where` object. Asserting the
  `Where` still holds `not_in` stays green even if the translator drops the operator entirely.
- **Applies to**: `src/lib/db/where-to-sql.ts` and every `src/lib/queries/*-filters.ts` that feeds it;
  any two-plane visibility rule enforced once in the ORM and once in hand-written SQL.

## Unifying a type across carriers launders the dead ones — check every carrier is live before the merge

- **Context**: `CostVariantT` and `StagePlaneT` were merged into one `ToolPlaneT` (EX-548, "one
  concept, one name"). Three fields then carried that type: `KosztorysStageT.plane` (live, the sole
  settlement input), `KosztorysItemT.costVariant` and `KosztorysSectionT.defaultCostVariant` — both
  inert since 39 minutes after they were born, when their only consumer (`effectiveCostVariant`) was
  removed in a `calc.ts` dead-code sweep that never looked at the schema.
- **Problem**: the merge was correct on its own terms and had an unintended cost — giving three
  carriers one type name erased the visual cue that two of them were vestigial, so they _read_ as
  load-bearing. Worse, both were admin-visible free-text Payload fields with no option list: an owner
  could type anything into „Domyślny wariant kosztu" and it validated, persisted, and did nothing.
  Dead **and** misleading beats merely dead.
- **Rule**: before unifying a type across carriers, confirm each carrier actually has a reader — a
  merge is a good moment to delete, not to inherit. And when you delete a _function_ for having 0 refs,
  check whether it was the only reader of a column; a dead-code sweep of one file leaves schema behind.
- **Applies to**: any `satisfies`/type-consolidation refactor; any "0 refs, deleting" sweep that
  touches a resolver over persisted fields.

## A stale doc section marked OTWARTE is read as a foundation for planned work

- **Context**: dropping the dead cost-variant columns, the real risk was never the data — it was
  `context/reference/kosztorys-editor-domain-notes.md`, which carried a 94-line section titled
  „…model się rozjeżdża (**OTWARTE**, duża zmiana)" naming `default_cost_variant` as level 1 of a
  cascade, „już istnieje". The design had been superseded and shipped elsewhere (on `stage.plane`)
  months earlier; the doc never learned.
- **Problem**: an agent reading that without git history concludes the columns are the foundation of
  planned work and preserves them. The same happens with code comments: `kosztorys-items.ts` asserted
  a section→item cascade with zero implementing code, because the resolver died and the comment didn't.
- **Rule**: when a change makes a doc section or a comment factually wrong, fix it **in the same
  change** — the doc-lifecycle rule covers code comments too. An **OTWARTE** / open-question marker
  is a stronger claim than plain prose, so it needs closing out explicitly when the question is
  answered somewhere else.
- **Applies to**: `context/reference/**` and `context/domain/**` living docs; any comment that
  describes a cascade, fallback or resolution order.

## Don't bump `SNAPSHOT_SCHEMA_VERSION` for a dropped field nobody read — and know what a bump actually breaks

- **Context**: `snapshot-format.ts` says "bump only on a non-additive payload change (a renamed/dropped
  field)", so the letter said bump when the cost-variant columns went. The precedent said otherwise:
  `20260724_1_drop_kosztorys_section_coeff.ts` dropped two sibling columns from the same table and did
  not bump.
- **Problem**: the version rule's own **rationale** is "reject because the tolerant mapper would seed
  wrong/missing columns" — a failure mode that doesn't exist when the mapper stops reading the field
  and the column stops existing; an old payload seeds exactly the rows it would today. Meanwhile a bump
  makes `assertReadableSchemaVersion` throw on **every** stored row — including the **global,
  hand-curated `kosztorys_presets` library**, which is not covered by the kosztorys throwaway-data
  carve-out. And it fails asymmetrically: the three list queries don't assert, so the versions list and
  the „dodaj sekcję z szablonu" picker keep offering entries that error the moment you use one.
- **Rule**: bump on the rationale, not the letter — only when a stored payload would restore into
  _wrong_ rows. Before bumping, check which stored artifacts are global and curated rather than
  throwaway, and whether the listing path asserts the version at all.
- **Applies to**: `src/lib/kosztorys/snapshot-format.ts`, `snapshots.ts`, `presets.ts`; any column drop
  that appears in a serialized payload.
- **Corollary (2026-09-02, snapshot retention thinning)**: a bump is **not done until the existing
  rows are dealt with**. Three exits, and exactly one must be picked: **don't bump** (additive, or a
  key the mapper never reads — five column drops have taken this exit with no failure), **migrate the
  stored payloads** (presets — a hand-curated library, deleting it destroys real work), **delete the
  stored rows** (snapshots — ambient history, cheap to re-accumulate). Forbidden: bump and leave.
  What that buys is the invariant _every row in `kosztorys_snapshots` is readable by the current
  code_, which is why `listSnapshots` deliberately carries **no** `schema_version` filter — a filter
  would guard a state that must not exist, and an unreadable snapshot is not history, it is a row that
  lies on a list. The same corollary kills the phrase "additive fields need no bump": a new column
  that is NOT NULL **without** a DEFAULT breaks every stored payload however additive it looks,
  because `insertKosztorysTree` only defaults the NOT NULL DEFAULT columns and `display_order`.

## A tolerance the code relies on must be a TYPE, or the dead-code rule licenses deleting it

- **Context**: extending kosztorys snapshot retention from 7 days to a year (2026-09-02) made "an old
  stored payload restores correctly" load-bearing for the first time. Every numeric column on the tree
  tables is NOT NULL DEFAULT 0, and a payload captured before a column existed simply has no key —
  which binds an explicit NULL, and Postgres does **not** substitute a DEFAULT for an explicit NULL
  (23502). The insert path therefore carries a `?? 0` on each of them.
- **Problem**: those fallbacks were typed against the strict `SnapshotPayloadT`, where the fields are
  required — so to `tsc` every `??` was a dead branch. This repo gates dead-code removal on a green
  typecheck (deliberately, see the dead-code lesson), which means the next cleanup pass would have
  been told it may delete the exact guards a year of retention depends on, and the typecheck would
  have agreed. A comment saying "these are load-bearing" is not evidence a tool reads.
- **Rule**: when stored data may legitimately be shaped differently from what today's serializer
  writes, declare that in a second type (`StoredSnapshotPayloadT` = the strict type with exactly the
  NOT NULL DEFAULT columns marked optional) and give the discharging function the **strict** type as
  its return. Then the compiler, not a comment, guarantees each optional field got filled, and the
  fallbacks stop looking dead. Thread the tolerant type through _every_ reader of the stored payload —
  restore, presets, catalogue seed — because they share the exposure; the discharge point is the
  payload boundary, not the SQL bind, since the same primitives are also called with rows built in
  code where a missing value is a caller bug to surface.
- **Applies to**: `src/lib/kosztorys/snapshot-format.ts`, and any other jsonb payload read back after
  the schema it was written against has moved on.
- **Aside on the premise**: the old 7-day / 50-row limits were never derived — the S-06 brief filed
  them as "starting points". Measuring killed the only argument for keeping them: a snapshot is
  **~23 KB** stored, so the entire old ceiling was ~1,2 MB per investment. Measure before defending a
  placeholder.

## Migration filenames sort lexically — the unpadded counter breaks at 10

- **Context**: migrations are `YYYYMMDD_<seq>_<snake_case>.ts` with a single-digit unpadded counter
  restarting at 0 each date. Payload's `readMigrationFiles` does `readdirSync().sort()` and filters
  `index.ts` — **the filename's lexical order is the run order**, and `payload.config.ts` passes only
  `migrationDir`.
- **Problem**: at ten migrations in one day `_10_` sorts before `_2_` and the day's migrations run out
  of order. Max so far is 4, so it hasn't bitten.
- **Rule**: if a date is heading past `_9_`, pad the counter (`_09_`, `_10_`) for that whole date —
  never mix padded and unpadded within one day. Related: `down` is written faithfully by every
  migration but is **never run** (no `migrate:down`/`refresh`/`reset` script exists) — it must restore
  the original DDL exactly, but it need not preserve data.
- **Applies to**: every file added under `src/migrations/`.

## A commented-out guard is a candidate finding, not a dropped invariant — confirm intent in git first

- **Context**: a DDD distillation pass ranked "an AUXILIARY register must not go negative" as the
  #1 invariant to restore: core to the cash ledger, enforced by **zero** layers, surviving only as a
  commented-out block in `transfers.ts` plus a `// TODO re-add` stub. A whole guardian-aggregate plan
  was written on it and EX-410 was opened.
- **Problem**: the premise was false. `git log` on the commented block showed it dropped in `76dd757`
  and flip-flopped **four times** — registers are _allowed_ to go negative, by a deliberate client
  decision. The plan was canceled unimplemented. Commented-out code and a TODO look identical whether
  they mark an accident or a decision; a static read cannot tell them apart, and the more emphatic the
  code looks ("this used to be enforced!"), the more confident the wrong conclusion.
- **Rule**: before ranking a commented-out or deleted guard as debt, run `git log -S` on it and read
  the commit that removed it. A guard that was removed _once_ is a candidate; one that flip-flopped is
  a decision someone kept re-litigating, and re-adding it restarts the argument. Record the verdict in
  a living doc so the next audit doesn't rediscover the same "hole" — this one lives in
  `context/domain/01-domain-distillation.md` under intentional non-targets.
- **Applies to**: any audit, distillation or "what invariants aren't enforced" sweep; commented-out
  validation, disabled lint rules, and `TODO re-add` stubs.

## Verify an HMAC over the RAW request bytes — `request.json()` destroys the signature

- **Context**: the Facebook Lead Ads webhook must reject forged POSTs by HMAC-SHA256 over the body,
  compared against Meta's `X-Hub-Signature-256: sha256=…` header.
- **Problem**: the obvious handler shape — `const body = await request.json()` — makes verification
  impossible. The signature covers the exact bytes Meta sent; re-serializing the parsed object changes
  key order, whitespace and number formatting, so the recomputed digest never matches. Worse, a body
  can only be read once, so the mistake isn't recoverable later in the handler. The same trap applies
  to every signed webhook (Stripe, GitHub, Slack).
- **Rule**: read the body **once** as text (`const raw = await request.text()`), verify the HMAC against
  `raw`, then `JSON.parse(raw)` from that same string. Compare digests with `crypto.timingSafeEqual`,
  not `===`.
- **Applies to**: any Route Handler receiving a signed webhook.

## Payload `unique: true` is single-column only — a compound uniqueness key is raw SQL in the migration

- **Context**: `leads` needed idempotency on `(source, externalId)` so a re-fired webhook can't create
  a duplicate row.
- **Problem**: there is no field-level way to express it — Payload's `unique: true` covers one column,
  and no collection-level compound-unique option exists. The constraint has to be created by hand in the
  hand-written migration (`CREATE UNIQUE INDEX … ON leads (source, external_id)`), which means it lives
  in a different file from the collection config that depends on it and is easy to lose in a rewrite.
  Copy `src/migrations/20260527_add_unique_google_sheet_id.ts`.
- **Rule**: express compound uniqueness in the migration as a raw unique index, and note it in the
  collection config so the two stay linked. Postgres treats NULLs as distinct under a unique index, so a
  nullable member column (here `external_id`) never collides — that's a feature for optional external
  ids, and a hole if you meant the pair to be strictly unique.
- **Applies to**: any Payload collection needing multi-column uniqueness or idempotency on an external id.

## An editable grid that mounts an `<input>` in every cell can't become sheet-like — the two-mode cell is the fork

- **Context**: the kosztorys editor v1 was TanStack Table + shadcn `DataTable`, with
  `editable-cell.tsx` rendering every cell as an always-mounted `<input>`/`<select>`. New requirements
  arrived — arrow/Tab/Enter navigation, typing enters edit, column resize, variable row height,
  copy/paste with Excel.
- **Problem**: those aren't features you bolt on; they all depend on a **two-mode cell model** (a cell is
  either _selected_ — plain text, one global `{row,col}` cursor — or _editing_, and only then an input).
  With an input in every cell an arrow key moves the text caret instead of the selection, Tab gets lost
  in virtualized rows, ~1000 rows × ~15 columns means hundreds of controlled inputs, and a single-line
  `<input>` fights variable row height. One architectural change unblocks all three, and on a headless
  table you write that model yourself.
- **Rule**: when a grid needs to _feel_ like a spreadsheet, treat "two-mode cell + global selection" as
  the deciding requirement and pick a library that ships it (here `react-datasheet-grid`, built for
  sheet-feel: keyboard nav, resize, Excel copy/paste, virtualization). Rejected alternatives and why:
  **react-data-grid** — a general grid that _can_ edit, not one aimed at sheet-feel; **Glide Data Grid /
  any `<canvas>` grid** — Playwright and RTL see one bitmap, so nothing is testable, and canvas's perf
  edge doesn't show at thousands (not tens of thousands) of rows; **AG Grid** — range editing is paid
  Enterprise, heavy bundle, foreign look. Decide it with a **bake-off on a sibling route** where the only
  difference is the grid layer (same query, same actions, same pure calc), so the verdict can't be
  confounded — and gate it on a compatibility smoke-render first, because a sheet library is usually the
  least actively maintained thing in a bleeding-edge stack.
- **Applies to**: any editable data grid; more generally, any "make it feel like <native app>" requirement
  where the interaction model, not the feature list, is what forks the implementation.

## Hierarchical visibility is ONE set of leaf exclusions — a parent toggle is a bulk op, not a second set

- **Context**: the export picker had to answer "the whole kosztorys except the Klimatyzacja section, but
  keep this one item from it" — visibility controllable per section _and_ per item. **The concrete
  subject was cut (2026-08-15): there is no kosztorys export at all** (EX-400 + EX-666), so the picker
  below is the worked example, not live code — the rule outlives it and lands next on whatever picker
  the client view grows.
- **Problem**: the obvious model is two pieces of state (hidden sections + hidden items), and it
  immediately needs reconciliation rules: does an explicitly-shown item beat its hidden section? What
  happens when you then hide the section again? Every combination is a special case, and the two sets
  drift out of agreement with what the file actually contains.
- **Rule**: keep exactly one set — `excludedItems: Set<itemId>` — and make the parent control a **bulk
  operation** over it (hide section = add all its item ids; show = remove them). The parent's own
  rendered state is then **derived**, three-valued: all excluded → hidden, some → indeterminate, none →
  visible. Un-hiding one item inside a hidden section needs no logic at all, because there is nothing to
  reconcile. Compute the exported/previewed set and its subtotals from that same filtered collection, so
  the document always sums to what is shown.
- **Applies to**: export/print pickers, permission and column toggles, tree checkboxes — any UI where a
  container and its children can both be switched.

## Implementation that drifted from a settled decision gets the schema cleaned, not the dead columns parked

- **Context**: The kosztorys POC (2026-06-20). `change.md` recorded a `[PEWNE]` owner decision —
  ONE VAT rate per investment, the section→item cascade explicitly rejected — but the code shipped
  the cascade (`kosztorys_sections.vat_rate` + `kosztorys_items.vat_rate`, `effectiveVat = item ?? section`)
  and `investments` had no VAT column at all. The rejected variant was the only one that existed.
- **Problem**: The tempting cheap fix is to leave the columns in place and just point `calc` at the
  investment — nobody edits them, they default to `0.08`, they're harmless. The owner rejected that:
  a dead field carrying a rejected model "comes back 100%", and the next reader takes the schema as
  evidence of intent. That doc↔code divergence is what produced the drift in the first place.
- **Rule**: When you find code implementing an explicitly rejected variant, correct it **down to the
  schema** — drop the columns in the same change, and in the same pass sweep the prose that still
  describes the rejected model (design notes, comments, `change.md` status). Retiring a model means
  removing the places it could be re-inferred from, not just the place it is read.
- **Applies to**: any correction of an implementation that drifted from a recorded decision — dead
  columns, dead enum members, dead config knobs. Related: the stale-`OTWARTE`-section entry above.

## Folding one slice's scope into another makes roadmap bookkeeping a deliverable, not a formality

- **Context**: `2026-07-09-kosztorys-price-models` absorbed the scope of two later slices. Its archive
  step included "mark them absorbed in `roadmap.md`" — that step was never run.
- **Problem**: The roadmap kept listing both as work still to do, so a later session opened a full
  research pass on scope that had already shipped. The waste isn't the stale line, it's the research
  the stale line commissions.
- **Rule**: When a change swallows scope that another roadmap entry owns, updating that entry is part
  of the change — do it in the same pass that closes the slice, not as an archive-time chore. Absorbed
  scope needs the pointer ("shipped in X"), not just a status flip, so the next reader can verify.
- **Applies to**: roadmap slices, Linear issues that duplicate each other, plan documents that fold in
  a follow-up's scope.

## Spreading a datasheet-grid column inherits the column, not the component you replaced

- **Context**: EX-538 (`2026-07-19-kosztorys-note-cell-overlay`) swapped `textColumn`'s single-line
  `<input>` for an overlay `<textarea>` via the repo's usual `{ ...textColumn, component }` idiom.
- **Problem**: The spread carries the column's _data_ hooks — `copyValue` / `pasteValue` /
  `deleteValue` / `isCellEmpty` — but **not** `parseUserInput` (`textColumn.js:127`,
  `value.trim() || null`), because only the component being replaced ever called it. An emptied cell
  then persisted `''` while the same column's `deleteValue` and `isCellEmpty` still spoke `null`.
  Two more traps sit in the same seam: `stopEditing`'s own default is `{ nextRow: true }`
  (`DataSheetGrid.js:415`), so a bare call on a _cancel_ path silently walks the selection down a row;
  and `disableKeys` makes the grid return out of its Tab branch **without** `preventDefault`
  (`DataSheetGrid.js:979`) — stock cells survive on `tabIndex: -1`, a natively-tabbable `<textarea>`
  does not, so Tab tore DOM focus out of a grid that still believed it was editing.
- **Rule**: When you replace a stock column's component, enumerate what that _component_ did — value
  normalization, tab-trapping, key handling — and re-own each one explicitly. Read the library source
  for the default of every callback you invoke; `stopEditing()` and `stopEditing({ nextRow: false })`
  are different commands, and only one of them means "cancel".
- **Applies to**: any custom `react-datasheet-grid` cell here; more generally, any library where
  swapping one slot of a config object silently drops behaviour that lived in the slot's default.

## `stopPropagation` does not stop a listener co-located on the same node

- **Context**: Same slice. The overlay had to keep Escape / Enter / Shift+Enter / mousedown away from
  `react-datasheet-grid`, which registers its handlers on `document`.
- **Problem**: Next's App Router hydrates on `document`, so React's delegated listeners and the grid's
  own listeners hang off the **same node**. Propagation has already finished arriving there — only
  `stopImmediatePropagation` stops a sibling listener on that node, and it only works because React
  registered first (at hydration, before the grid's effect ran). `stopPropagation` alone looked
  correct and did nothing.
- **Rule**: Reach for `event.nativeEvent.stopImmediatePropagation()` whenever the listener you're
  trying to outrun is on `document` or `window` — the same node React uses. Registration order is then
  load-bearing, so verify it rather than assume it. `src/lib/utils/enter-escape-keydown.ts` still uses
  bare `stopPropagation` and carries this latent leak (harmless today; tracked on EX-657).
- **Applies to**: any third-party widget with document-level key/mouse handlers layered under a React
  editor — grids, drag libraries, hotkey managers.

## A store that owns recovery state does not have to be the thing that renders the signal

- **Context**: `optimistic-form-store` closes a dialog and saves in the background, so it already
  carries what a failed save needs to recover — the form id, the picked-file snapshot, reopen-on-
  failure. `PendingSubmitIndicator` therefore read _it_ for "is a save in flight". EX-648 added a
  generic keyed `pending-store` for transition-based saves that can't satisfy that contract, and left
  the dialog path on the old source — so one pill had two sources and a `label ?? 'Zapisywanie…'`
  fallback to paper over the one that carries no label.
- **Problem**: The two sources weren't two states, they were one state read twice. The dialog source
  was also a bare boolean, so two saves overlapping meant the first to settle cleared the second's
  pill. The fallback existed only to hide that one source was shaped wrong for the job.
- **Rule**: Separate _owning_ state from _broadcasting_ it. A store that legitimately owns rich
  recovery state can call into the generic signal store like any other caller — one `start` on entry,
  one `stop` in a `finally` — instead of being subscribed to as a second source. The renderer then has
  one selector and no fallback branch, and the signal store's keying (not a boolean) makes concurrency
  correct for free.
- **Applies to**: any global indicator fed by more than one store; more broadly, any place a `??`
  chain between two sources is standing in for "these should have been one".

## No hook-test infrastructure is a design signal, not a blocker — extract the logic, don't install a runner

- **Context**: EX-577's plan called for a `renderHook` spec on `useReceiptGeneration` to prove the
  scan writes `netAmount` onto the row regardless of transfer type — the decision most likely to be
  "corrected" by a later reader. The repo has no `@testing-library/react` and no jsdom, and on this
  arm64 machine any `pnpm install` risks the lightningcss swap.
- **Problem**: The two obvious moves are both bad. Installing a React test stack to assert four
  `setFieldValue` calls buys a whole dependency and a jsdom environment for one test. Skipping the
  spec leaves the load-bearing decision — the deliberately absent `billsNetAmount` gate — with
  nothing but a comment defending it.
- **Rule**: When a behaviour is only reachable through a rendered hook, that is usually the hook
  hoarding logic that isn't stateful. Lift the pure part out (`applyReceiptToRow(setFieldValue,
index, data)`) and spec it with a stub. The hook keeps the `useState`/concurrency/toast work that
  genuinely needs React; the decision worth defending moves to a function whose name a future reader
  meets before the comment. Reach for new test infrastructure only when the thing under test is
  actually React behaviour — rendering, effects, re-render timing.
- **Applies to**: any hook in `src/components/**` whose interesting logic is a mapping or a decision;
  more broadly, any "I need a heavier harness to test this" moment — check first whether the harness
  is standing in for a missing seam.

## Widening a Payload relation to `hasMany` makes every `typeof field === 'number'` guard fail SILENTLY — `tsc` stays green and the data just disappears

- **Context**: EX-659 turned `transactions.invoice` from a scalar `upload` field into `hasMany`. The
  research pass expected "six read surfaces" and found ~19 code sites, four of which discriminated the
  relation with `typeof doc.invoice === 'number'` to tell an unhydrated id from a populated doc.
- **Problem**: At `depth: 0` a relation field is typed loosely enough (`RelationIdT`,
  `(number | null) | Media`) that widening it to an array produces **no** type error — the guard simply
  evaluates `false` on every array, the extractor returns `[]`, the media map comes back empty, and
  every invoice vanishes from the UI with no error anywhere. One of the four guards was a _duplicated_
  copy feeding the unauthenticated client-share page, so the silent regression would have been
  client-visible. A second trap sat behind the same shape: the cleanup path read `oldMediaId` through
  the same guard, so replaced blobs would silently stop being deleted.
- **Rule**: Before widening a relation's cardinality, grep for `typeof <field> === 'number'` (and any
  `Array.isArray`-free discrimination of that field) and treat each hit as a **red-first test target**,
  not a reading exercise — `tsc` is not a safety net at a loosely-typed DB boundary. The related
  structural facts, worth knowing before planning the same move: this repo joins media in TypeScript
  (`lib/queries/media.ts` caches the whole table and filters by id), so an invasive relation change
  touches zero raw SQL and `depth: 0` must stay; and the FK semantics flip — a scalar column's
  `ON DELETE SET NULL` becomes `ON DELETE CASCADE` on the join row, which quietly re-points any
  "delete this media id" action at every parent referencing it.
- **Applies to**: plan, research, implement, impl-review, code-review

## A backfill may not write a terminal status for an effect it never performed

- **Context**: Any recovery/reconcile path that re-inserts records a primary path dropped, where the record carries per-channel delivery status columns used as an idempotency ledger — here `runLeadReconcileSweep` (`src/lib/leads/reconcile-sweep.ts`) vs `captureLead` (`src/lib/leads/capture-lead.ts`), `leads.notifyStatus` / `autoReplyStatus`.
- **Problem**: The sweep stamped every lead it recovered `notifyStatus: 'skipped'` — a **terminal** state meaning "we decided not to send". It had no authority to decide that: it cannot know whether sales was told, and sales was not. So a lead the webhook silently dropped was recovered into the DB and then hidden from the only people who could act on it. Worse, `captureLead` gates each channel on `pending`, so `skipped` also short-circuited a later webhook redelivery — the one thing that would have rescued it. The failure is invisible by construction: the row looks fully processed, and the alert mail (counts only) reads like a clean recovery. It shipped, then needed a stopgap (listing contact details in the alert) whose only job was to make the swallowed leads findable at all.
- **Rule**: A status column records **what happened**, not what a caller assumed. Only the component that owns the send may write its outcome — give the backfill an _option_ on that component (`captureLead(…, { autoReply: 'skip' })`) instead of letting it stamp the row itself. Suppress a channel only where lateness genuinely degrades it: a customer-facing reply days late is embarrassing, an internal heads-up never is — so the internal one gets **no** suppression option at all, deliberately. Resist a freshness window as the fix: once the internal channel is unconditional, a threshold has nothing left to decide and a wrong N just reintroduces the same defect in a narrower band. Tell: a record whose status says "settled" while no one can name the message that was sent.
- **Applies to**: plan, implement, impl-review, plan-review

## Widening a type that flows through an `unstable_cache` payload needs a KEY bump — tags don't help

**Symptom.** The investments listing threw `Cannot read properties of undefined (reading 'find')` in
`costForCategory`, and before that rendered `NaN zł` in three columns — on a branch whose typecheck,
2036 unit tests, DB parity spec and cross-path audit were all green.

**Cause.** `investments-listing-expense-plane` widened two shapes: `InvestmentFinancialsT` gained
`netCategoryCosts`, and the investment reference row gained `vatRate`. Both travel through
`unstable_cache` — `['investment-financials']` and `['reference-data']`. A cache entry written before
the change carries the OLD shape. The new reader dereferences a field that entry doesn't have, so it
crashes (`.find` on `undefined`) or prints `NaN`.

**Why a tag doesn't save you.** A tag marks an entry stale; the request that finds it stale still
serves the old payload once and revalidates behind it. That is exactly right for a value that is
merely out of date, and exactly wrong for one that is structurally incompatible — the "one last
serve" is the crash. Adding more tags, or revalidating harder, cannot fix it.

**The rule.** The cache key is the schema version of its payload. **Change the shape → bump the key**
(`['reference-data-v2']`). The old entry becomes unreachable instead of being served once more. A
field ADDED is as breaking as one removed the moment a reader dereferences it.

**Why no test caught it, and what would.** Every gate we ran calls the query functions directly or
re-derives them — none goes through the cache layer, and a fresh cache is always the right shape.
The failure needs an OLD entry, which only exists in a long-running dev server or a live deploy. So
this is not a coverage gap to close with another spec; it is a **checklist item at the moment of the
edit**: widening a type, grep for the `unstable_cache` keys its payload passes through and bump them
in the same commit.

## A guard running on REAL data is still blind if the real data predates the feature

`lessons.md:19` says a parity test must run the real per-surface assembly on real data. The
investments-listing plane defect satisfied that rule and shipped anyway. The reason is one level
below it: the test DB is restored from a prod dump taken **before** the materiały-netto concession
existed, so it held **0 of 109** investments with a `materials_net_rate` and **0**
`INVESTMENT_EXPENSE_NET` rows. Every guard reading that dataset — the parity test, the golden master
— was green because the entire plane it was supposed to police was absent from its input. The
integration test that would have screamed on a rate-bearing investment was, on that dataset,
unfalsifiable.

Worse, the same restore hid a second defect: the parity test called `deriveFinancials` without the
rate and mode, which would have produced a **false** mismatch on any investment with a rate. It was
green only because no such row existed. A borrowed dataset can make a guard both blind and wrong at
the same time, and neither shows up as a failure.

**The rule.** When a feature adds a new plane, rate, or type, ask what the guard's dataset actually
contains before trusting a green run — `SELECT count(*) WHERE <the new column IS NOT NULL>` is a
ten-second check. Zero rows means the guard is decorative on that axis, and the honest options are a
synthetic unit test (independent of the restore) or a fixture, not a green integration run.

## Two surfaces reading the same figure wrong are not always the same defect

The investments listing and the investment page's v1 stat tiles both summed raw `categoryCosts`, so
the tiles looked like the same one-line fix. They were not. On the listing the category columns are
independent figures, so pricing them onto the billed plane is simply a correction. On the tiles the
**sum of the visible tiles IS the balance**, and the concession already has its own tile („Obniżka
materiałów") — repricing the category tiles there would have counted the concession twice and
broken a balance that currently reconciles.

**The rule.** Before extending a fix to "the other place with the same expression", check what
invariant that place holds. Identical arithmetic under a different closure rule is a different
defect, and the shared-looking line is a coincidence, not a duplication. (This one became EX-670 —
an owner decision, not a fix.)

## An optional config field hides its own death — `tsc` stays green while pages compute into the void

`TransferTableConfigT` carried three optional fields (`headerFields`, `totalPayouts`,
`context`/`contextId`) that four pages built and nobody read. Because they were optional, deleting the
reader never broke the writer: the pages kept running aggregate queries and formatting figures that
went nowhere, and the compiler had nothing to say. EX-672 removed one such reader (print) and found
two more fields already long dead in the same type.

**The rule.** Optionality is what lets a config field outlive its consumer, so when you delete the
consumer, gate the producer cleanup on **grep + `dead-code-scanner`, not on `tsc`**. A green typecheck
after removing a reader proves nothing about whether its writers are now dead code. The same asymmetry
applies to any optional prop or optional payload key — deleting the read end is silent by
construction.

## Parking two features' buttons in one component makes one feature's data the other's visibility gate

Print, CSV and invoice download all lived in `TransferExportToolbar`, and the toolbar was mounted on
`headerFields` — **print's** data. So invoice download appeared exactly where print's data happened to
be built, and was absent from the manager dashboard by accident rather than by decision. Deleting
print as the ticket described would have silently dropped invoice download from four pages.

**The rule.** When a container renders buttons for more than one feature, its mount condition belongs
to whichever feature it names — every other feature inside it is gated on a condition nobody chose.
Before deleting such a container, list its children and give each surviving one its own explicit
condition (here: `invoiceDownload?: boolean`). Splitting the buttons apart is not enough if the shared
gate survives the split — that is exactly what an earlier refactor did here and why the trap was still
live.

## Hiding a form field in JSX does not clear it — the value ships anyway

The deposit form seeded `investment` from the URL into `defaultValues`, hid the picker behind a JSX
condition when the type changed, and `toData` still submitted the whole value object. That is where
the three garbage `OTHER_DEPOSIT` rows carrying an investment came from — nobody ever saw the field
they filled in. The identical shape leaked a stale `vatPlane: 'NET'` onto deposit types that must not
carry a VAT plane; `resetField` only reset it back to that same seeded default.

**The rule.** A type-conditional field owes **two** edits, not one: hide it _and_ drop it from the
submitted payload (clear on the type change, or strip in `toData`). A hidden field is a field the user
cannot see and therefore cannot correct — it is strictly worse than a visible wrong value. And when a
form both seeds a default from the URL and resets on a control change, `resetField` restores the seed;
"reset" is not "clear".

## An action spec with a mocked writer can assert that a forbidden shape SUCCEEDS

`transfer-actions.test.ts` sent `investment: 1` on `COMPANY_FUNDING` / `OTHER_DEPOSIT` and asserted
`success: true`, with `payload.create` mocked — so the `beforeValidate` hook never ran. Adding the
guard in the hook left both tests **green while they pinned the illegal shape as accepted**. The suite
was not silent about the change; it was actively arguing for the bug.

**The rule.** Before choosing an enforcement layer, grep the specs that already exercise the shape you
are about to forbid and read what they assert. A spec that mocks the layer holding the new rule cannot
observe it — it must be rewritten to assert rejection, or the rule needs a second seat above the mock.
Related: enforcing in SQL was disqualified here for the mirror-image reason — two DB specs deliberately
insert the forbidden shape by raw SQL, and a CHECK constraint would have broken them.

## A total and the list it summarises must come from ONE query — and after you unify them, an equality test is a tautology

The wpłaty figure reached one component through three hosts. Two passed a SQL aggregate (`totalIncome`,
bucket `income`) **and** the deposit list side by side and trusted them to agree; the third — the client
share — passed the aggregate and no list at all, so `bucketDepositsByPlane([])` returned zeros and „Do
zapłaty" was overstated by the entire amount paid. Nobody had to make a mistake: the type let a host
supply the total without the rows, and four comments cheerfully claimed the three hosts were assembled
identically.

**The rule.** When a component renders both a figure and the rows behind it, the figure is **derived
from the rows in the component**, not delivered alongside them. Delete the redundant prop rather than
picking a winner — a drift you cannot represent is one you cannot ship, and a missing required list is
a compile error instead of a silently empty table.

**The corollary about the guard.** Once all hosts read the same list, a test asserting `Σ list ===
aggregate` pins its own implementation — green by construction, green also on broken data. The real
precondition here was a **data** invariant (`COMPANY_FUNDING` / `OTHER_DEPOSIT` never carry an
`investment_id`, EX-557), so that is what the guard asserts, on the persisted row. Guard the cause that
makes the two definitions coincide, not the coincidence.

**Do not "fix" the aggregate's definition to match.** `totalIncome` is a **company-level** figure —
`/raporty` needs both legacy deposit types inside bucket `income`. It is only correct per-investment
because of the EX-557 invariant, and its name says none of that.

## This codebase assumes "money may be signed, quantities may not" — a negative quantity fails to ZERO instead of propagating

Scoping a design that would have carried a difference as a negative stage quantity (EX-686) turned up
the same shape everywhere: the kosztorys layer has clamps on money, and on quantities it has **`> 0`
truthiness tests**. `netForQtyForView` returns `0` for a non-positive total qty, so an item whose stages
carry real work prices at 0 zł; `stageValueForView` is a qty _share_ of the row net rather than
`qty × price`, so one negative contributor inflates every sibling stage above what it delivered; and
`stageAxisForView` zeroes each stage's net while still accumulating its qty, breaking the
Σ-per-stage == row-net invariant its own comment declares. The SQL twins clamp identically, so
`test:parity` stays green with both planes wrong the same way.

**The rule.** Before introducing a signed quantity anywhere, grep the consumers for `> 0` rather than
for clamps. A clamp is a decision someone made; a truthiness test is an assumption nobody wrote down,
and it converts your new state into a plausible zero instead of an error. Negative _money_ is already
a normal rendered state here, deliberately unclamped and explained to the owner in Polish — that
precedent does not transfer.

**The tell that this is worth checking:** a golden-master spec whose per-investment fingerprint
includes `sum(sp.qty)` **skips silently** when the input hash moves. Green-but-blind is the loud
failure; no-signal-at-all is the quiet one.

## A snapshot taken "inside the transaction, before the wipe" is not a transaction-consistent read

`captureAutoSnapshot` → `serializeKosztorys` → `getKosztorysTree` goes through the cached query layer,
which opens its own connection. So calling it from inside a `withPayloadTransaction` block — with that
block's `txDb` handle threaded through every write around it — still reads whatever the query layer
currently returns, not the rows the transaction is about to destroy. Nothing at the call site says so;
the handle you passed for the writes simply isn't the one the read used.

Every caller that reuses the snapshot-before-write pattern inherits this: import, restore, presets.
In practice the tags are fresh at click time so it hasn't produced a wrong undo yet, which is exactly
why it will stay unnoticed. **If a restore or an import ever comes back subtly wrong — the right shape,
stale contents — start here**, not in the write path.

## A review finding names a mechanism; it does not measure one — three from EX-521 died on the numbers

The EX-521 gate filed three "structural" findings against the kosztorys editor. All three described a
**real mechanism** and all three were closed unfixed, because the magnitude nobody had checked turned
out to be the whole question:

- **The whole-owner `FOR UPDATE` in `display-order.ts`.** Filed as blocking autosaves on "a 1000-item
  section". The owner block is one _section_, and the modelled sheet is 10 × 100
  (`perf-seed-kosztorys.ts`) — so ~100 row locks, never the sheet. Benchmarked with a throwaway spec:
  autosave p50 6.7 → 7.9 ms, p95 9.8 → 12.1 ms under a continuous ▲▼ burst. **+1 ms**, against a
  redesign that would have to re-establish EX-632's ascending-id discipline from scratch. The spec was
  deleted with the finding — an opt-in benchmark nothing runs is a maintenance tax on a settled
  decision; the numbers belong here and at `display-order.ts:84`, not in the test tree.
- **The undo burst buffer outside `useUndoRedo`.** `undoRedo.revision` really does under-report for
  ≤700 ms. Its one consumer is a **10-minute** snapshot interval whose marker only advances when a
  snapshot is taken, so a skipped tick self-heals on the next one — and the edit is already persisted
  by the autosave, which never went through the undo stack. Worst case: one snapshot delayed.
- **"Extract the row store — six members that only move together."** They move with _everything_: 47
  references across ~30 handlers. The extraction relocates five declarations and leaves all 47 call
  sites reaching in. Cohesion is measured by the **width of the seam**, not by how related the names
  sound.

**The rule.** A finding earns a plan once someone has put a number on it: how many rows, how wide the
window, how many call sites, how often the path runs. Do that arithmetic **before** the plan, not
inside it — each of these three would have been a multi-day restructure of the editor's hottest path,
and each collapsed to a two-hour verification. The corollary for whoever files: a finding that names a
mechanism without a magnitude is a **question**, and it should be worded as one.

Two recurring distortions to check for by name, because both showed up here: a whole-sheet figure
(1000+) quoted for a **per-owner** scope, and "concurrent users" invoked where the app has no editing
lock and **one** operator already races themselves — ▲▼ is `void`-called and autosaves are
fire-and-forget, so contention needs no second person.

## A stored preference records the DEVIATION, never a snapshot of today's defaults

Two settings landed a day apart and both hit the same fork. Column visibility for the client
(`client-preview-settings`) could store the visible keys or the hidden ones; column order
(`kosztorys-column-order`) could store a dense `0..n` list or a sparse `key → rank` map with
fractional ranks and one written key per drag. In both, the dense/positive form is the one that reads
more naturally and is the wrong choice.

The reason is the same both times: **a dense snapshot freezes the current default into every stored
row**. Add a 23rd column to the client allowlist and every investment that stored "the 22 visible
keys" keeps hiding it forever — silently, because the row looks complete. Ship a new grid column and
every user who ever reordered anything gets it appended at the end rather than in the slot the code
declares, because their localStorage holds a full ordering that predates it. Store exclusions and
overrides instead, and an addition flows to everyone who never expressed an opinion about it — which
is the whole population that didn't touch the setting.

The corollary is that the default has to stay live in code, not be copied into storage at first save.
`useHiddenColumns` and `useColumnWidths` already argued this for themselves; `useColumnOrder` is the
third, and the pattern is now the repo's answer. Related: „Hierarchical visibility is ONE set of leaf
exclusions" above — same instinct, applied to a parent/child toggle.

## A disclosure setting subtracts from a code ceiling, and fails CLOSED

`PREVIEW_VISIBLE_COLUMNS` decides what a client at `/k/<token>` may ever see (no subcontractor prices,
no marża, no „komentarz"). The owner's per-investment settings hide more on top of it. The filter must
therefore read `allowed.has(key) && !hidden.has(key)` — never "the stored list decides", which would
let a stored key outside the allowlist _reveal_ a barred column. The reuse pass went further and
derived the allowlist from the dialog's own groups, so a column can no longer be offerable-but-barred
or barred-but-offerable; the illegal pairing stopped being representable.

The same asymmetry governs the failure path: when the settings read throws, `/k/<token>` 500s instead
of rendering. That looks user-hostile until you name the only available fallback — the code default,
i.e. **wider** disclosure than the owner configured. For a disclosure setting, a page that fails to
load beats a page that shows a client the columns someone hid from them.

## Header drag in `react-datasheet-grid` is a 2–3 day job, not an afternoon

Considered and rejected for `kosztorys-column-order`. Columns are virtualized **horizontally**
(`useVirtualizer` with `horizontal: true`, dsg's `Grid.js`), so computing a drop index means
reconstructing dsg's own layout against `scrollLeft` plus edge auto-scroll — and the header already
carries two gestures (a Radix trigger filling `h-full w-full`, and the resize handle). A modal with a
`framer-motion` `Reorder` list bought the same capability in hours with no regression risk to resize
or header sort. If header drag comes back as a request, the estimate is the virtualization work, not
the drag.

## A deferral rationale written into an issue ages into a dependency — re-verify the blocker before planning around it

EX-521 sat parked for four weeks reading "split the editor hook **(behind a `renderHook` harness)**".
Nothing about that clause was ever true: two entries in this file already rule that the repo extracts
the logic instead of installing a hook renderer, three in-tree modules implement exactly that shape
(`createUndoRedoStack`, `createSaveLanes`, `createJsonMapStore`), and the fallback objection — "the
logic lives in a `.tsx` file, so it needs a DOM" — was refuted by a spec that already imports a `.tsx`
module. The clause was a **reason for not starting today**, written in the grammar of a prerequisite,
and every later reader took it as a fact about the codebase. Three review findings were then filed
against the same hook, each carrying "waits on the same harness", which turned one unverified sentence
into a queue.

**The rule.** When an issue names a prerequisite, the first research step is to check the prerequisite,
not to plan around it. Cheap tell: a blocker phrased as infrastructure we lack, where nobody links the
attempt that established we need it. And when _writing_ the deferral, say which it is — "declined, see
X" reads differently from "blocked on Y" a month later.

The payoff here was structural, not just scheduling: the harness would have made the god hook testable
**as it is**, and the reason no harness exists is that the logic is welded to the hook body. Extracting
it is the fix and the testability in one move — so the missing infrastructure was the design signal, and
installing it would have preserved what needed removing.

## An invariant enforced in two planes — deleting the second plane beats testing the bridge

`display_order`'s shift rule lived three times: once as the server `UPDATE … WHERE display_order >= at`,
and twice as hand-written client loops that transliterated it. Each plane was tested in isolation;
their **agreement** was not, and the client cache behind it was seeded at mount and never re-seeded
after `router.refresh()`, so "insert a section mid-sheet, then move a later one" was untested at every
layer. The standing rule for that shape is to test the bridge — but the better answer is available
whenever one plane exists only to predict the other: make the actions **intent-based**
(`'up' | 'down'`, `'above' | 'below'`, an id sequence for the bake), resolve position inside the
transaction that writes it, and the client plane has nothing left to mirror. No absolute integers reach
the client at all, so the numbering becomes a server implementation detail and the bridge test is moot.

**How to spot it:** the duplicate is a _transliteration_ — same predicate, same delta, same scope, in a
second language. That is different from two planes that genuinely compute different things and must
agree, which still needs the bridge test. Worth doing with no live victim: here every path that changed
stored order happened to go through the client or remount, so nothing was broken — the defect was the
triplicated rule, and the fix deleted code the following refactor would otherwise have relocated first.

## A capability offered by a helper, not declared by a column, gets its coverage decided by accident

Sorting in the kosztorys grid looked like a per-column product decision and was nothing of the kind:
`title()` was the only helper that constructed a `SortHeader`, so every column built by a different
header component (`StageHeader`, the stage-value header) shipped unsortable without anyone choosing
that. Nothing in the repo ever recorded a decision to exclude them; the one written justification was
a limitation note about two columns whose keys genuinely could not resolve, and a third column's
opt-out arrived as an unremarked third argument in an unrelated feature commit.

**The tell:** a capability whose presence is a side effect of _which constructor a call site reached
for_ rather than a property the column declares. When you find one, the fix is the rule, not the
patches — decide what the capability's universal predicate is („every column carrying data"), then
make the exceptions the ones that fail it, so the next column added inherits the right answer instead
of the nearest helper's.

The corollary is what makes it worth writing down: a limitation note in a commit message ages into a
believed constraint. Here the note said `columnSortValue` had no case for per-stage ids — true of the
two **value** namespaces it was written about, and false of the **quantity** namespace it was later
read as covering, since `stage_<id>` is a real always-numeric row field the default branch already
resolved. That is the second instance in this file of a deferral rationale hardening into a
dependency; both times, checking the stated blocker took minutes and dissolved most of the work.

**Two constraints this change leaves standing, for whoever touches grid sorting next.** First,
`reconcileSort` derives a sort's validity from the rendered column ids, so _anything_ that removes a
column silently cancels the user's sort — cheap and correct while only deliberate axis toggles could
do it, considerably less obvious now that a stage-scoped „Problemy" filter narrows the stage columns
too. Second, the sort is a pure lens: it is persisted nowhere — not in localStorage, presets,
snapshots, URL params or the DB — which is the only reason `stage_<id>` is safe as a sort field at
all. Postgres reissues a deleted stage's id, which is exactly why stage ids are kept out of the
persisted hidden-columns map. If anyone ever proposes persisting the sort, that question reopens on
day one.

## A render throw in a streamed RSC page still answers 200 — an E2E status assertion cannot see it

`e2e/kosztorys-share-link.spec.ts` guards a hazard the authed app cannot show: `(share)/layout.tsx`
mounts no `CurrentUserProvider` (the share token is the whole credential), `useCurrentUser` throws on
a null context, and `KosztorysTotalsPanel` is `forceMount`ed — so a session read added anywhere under
`SummaryPanelContent` breaks every investor link while typecheck, units and every other spec stay
green. The spec was written with `expect(response.status()).toBe(200)` as its headline assertion, on
the reasoning that a hard render throw is served as a 500 and so cannot slip past.

It cannot slip past **a page Next renders in one shot**. Break-verifying the spec (planting a
`useCurrentUser()` inside `SummaryPanelContent`, rebuilding, re-running) produced this:

```
[WebServer] ⨯ Error: useCurrentUser must be used within CurrentUserProvider
✘ a generated share link renders ... — expect(getByText('Fundamenty …')).toBeVisible() failed
```

The server logged the throw and **still answered 200**. The status line ships with the first chunk;
by the time the component throws, the headers are long gone and the failure is delivered inside the
stream, to the client error boundary. Status codes only describe what was known before the first byte.

**The rule:** on a streamed route, assert what the page _shows_, never what it _returned_. A status
assertion is worth keeping for the pre-render failures it does catch (a 404 from a rejected token),
but it must never be the load-bearing one, and it must never be traded for the content assertions —
a spec asserting only the status would have passed a share link that renders nothing but an error.

**The generalisation is about method, not Next.js.** The spec was authored, typechecked, run green,
and reported as protecting the risk — and its headline assertion protected nothing. The only step
that surfaced that was deliberately breaking the production behaviour and watching _which_ assertion
went red. Green proves the test runs; it says nothing about what the test would catch. On a guard
written for a specific failure — where the whole point is the day someone breaks it — the break check
is the test of the test, and skipping it is how a decorative assertion gets committed with confidence.

## A cross-field invariant belongs in the collection hook, not the server action — and `beforeValidate` on update can see the change

- **Context**: A deposit carried an etap tag that had to belong to the tagged investment's kosztorys.
  The guard was written where the app writes — `updateTransferAction` — and covered exactly the app's
  own edit form. The Payload admin panel and the REST API write the collection directly, so moving a
  deposit to another investment there kept a tag pointing into the previous investment's tree.
- **The boundary this draws**: the repo's default is still "a new side effect goes in the server
  action, not a new `afterChange` hook". That default is about _effects_ — revalidation, sync, the
  work that follows a write. An **invariant of the row itself** is the opposite case: it has to hold
  for every writer, and the action is only one of at least three. Put it in the collection hook, and
  next to its siblings — the same `validate.ts` already cleared the tag for the wrong _type_, so the
  wrong _investment_ had an obvious home.
- **The premise that nearly killed the fix was wrong, and reading the source is what got it wrong.**
  The finding was filed believing `beforeValidate` cannot tell "field not provided" from "field
  cleared" on a partial update — so a hook guard would be guessing. Ten minutes of probing the hook
  against the test DB disproved it: on update Payload hands the hook `data` as the **full merged
  document** (every field present, the new `investment` already in place) alongside `originalDoc`, so
  `resolveId(data.x) !== resolveId(originalDoc.x)` is unambiguous. Even a one-field
  `payload.update({ data: { investment: X } })` arrives fully populated.
- **The rule**: a behavioural claim about a framework hook is a claim you can _run_. Reading the
  library's source produced a confident wrong answer; a probe against the real thing settled it and
  cost less than the workaround would have.
- **Testing it needs the path the action can't reach**: the regression guard drives `payload.update`
  directly (DB-gated spec), because an action-level test exercises the one writer that was never
  broken.

## A fixture in a degenerate state makes every absence assertion vacuous

- **Context**: the per-view column specs built their fixture with stages carrying `plane: null`.
  Under `viewStages` a null-plane stage belongs to no view, so at `view: 'w_tools'` the builder
  emitted **no stage columns at all** — and the spec asserted only absences.
- **Problem**: the spec would stay green if every stage column vanished from the product. It was
  comparing nothing against nothing. That is exactly how the EX-571 critical shipped green
  (`stageTotalsForView` splitting a view-scoped total across the other crew's etapy): the guard that
  should have caught it was passing without exercising the filter it was named after.
- **Rule**: a spec made only of `expect(...).not.toContain(...)` is only a guard while something
  positive is also asserted from the **same** fixture — pin what _is_ there next to what isn't.
  When a fixture leaves the discriminator unset (`null` plane, empty array, no rows), ask what the
  assertion is comparing; if the answer is "an empty list against an empty list", the fixture is the
  bug, not the subject.
- **Applies to**: any view/plane/role-filtered builder spec, and any plan that says fixtures "get
  explicit values rather than accommodating patches" — that sentence is the tell that someone
  already saw this coming.

## A row type files with the producer when it is nominal, with the consumer when it is structural

- **Context**: `src/types/reference-data.ts` had accreted `MaterialTransactionRowT`,
  `PayoutTransactionRowT` and their siblings — shapes returned by transfer queries, sitting in a
  module named for reference data (roles, categories, settlement modes).
- **The symptom that made it concrete**: the file imported `@/lib/constants/transfers`, so every
  change to the transfer-type union recompiled a module that has nothing to do with transfers.
- **Rule**: ask whether the type is _nominal_ or _structural_. Nominal — it describes what a
  particular query returns and changes when that schema changes → it files with the **producer**
  (`src/types/transfers.ts`), even though the only code reading it is kosztorys UI. Structural — it
  is just a shape several unrelated places happen to need → it files with the consumer, or in a
  neutral home. "Who imports it" is the wrong axis; "what makes it change" is the right one.
- **Applies to**: `src/types/*`, and the same split one level up — `queries/reference-data.ts`
  shed its nine per-investment aggregates into `balances.ts` / `investment-transactions.ts` /
  `transfer-totals.ts` rather than into one `transfers.ts`, which would only have moved the
  grab-bag.

## `unstable_cache` dedupes across requests, never within one — and nesting two of them disables the cache

- **Context**: EX-597's read-path audit, verified against the installed Next 16.1.7 source rather
  than the docs.
- **What is actually true**: every `unstable_cache` invocation independently does an
  `incrementalCache.get` plus a full `JSON.parse`; the only dedup structure it keeps is keyed on the
  _revalidation_ promise, not the read. So on a cold entry three callers in one render each run the
  whole query. `fetchReferenceData` ran 3× per render of the investment page for exactly this reason
  — the page, the transfers table and the root-layout nav each call it.
- **The two caches are different axes, and you often want both**: `unstable_cache` spans requests
  and re-runs on tag invalidation; React `cache()` collapses calls _within one render_. Wrap
  `cache(unstable_cache(fn))` — that order, React's outside. It is only safe when nothing reads the
  value before a mutation in the same request, so the first call is always post-write.
- **The trap in the other direction**: an `unstable_cache` **nested inside another** bypasses the
  cache entirely — the inner call just runs. Before wrapping an existing query, check whether any of
  its callers is already wrapped.
- **Applies to**: anything under `src/lib/queries`; the reference-data blob is the worked example
  (`src/lib/queries/reference-data.ts:41-46`).

## A correlated `jsonb_array_elements` count is slow for a reason the row counts don't show: it trips JIT

- **Where**: `listPresetSections` in `src/lib/db/presets.ts` (EX-622, 2026-07-28) — count the items per
  sekcja across every szablon.
- **Measured** on 2 szablony / 26 sekcji / 320 items each: a lateral count re-expanded per section ran
  ~122 ms (423 ms with JIT enabled); the same result as a pre-aggregated CTE joined once ran **~2.5 ms**.
- **Why the gap is bigger than O(sections × items) explains**: Postgres has no statistics for a
  set-returning function, so it estimates `jsonb_array_elements` at a flat **100 rows**. The correlated
  form therefore costed at `rows=72000`, crossed `jit_above_cost`, and paid ~115 ms of code emission to
  produce a 26-row result. The CTE form stays under the threshold. A plan that looks merely quadratic can
  be paying a fixed compile tax on top — read the cost estimate, not just the row counts.
- **Rule**: aggregate a JSON array **once** in a CTE and hash-join it, never re-expand it per outer row.
  And when a count is keyed on an id that is only unique _inside_ its parent document (a `sectionId`
  within one szablon), the join must carry the parent id too — dropping it doesn't merely mistally, it
  fans the join out and duplicates rows.
- **`WITH ORDINALITY` when replacing a JS sort with SQL**: `Array.prototype.sort` is stable, Postgres'
  is not. If a consumer relies on ties arriving in array order (here: one szablon's metas must arrive
  consecutively), the array position has to be an explicit tiebreaker in `ORDER BY`.

## A shared object store is the one plane env isolation forgets — and `.env.local` outranks `.env`

- **Context**: Vercel Blob holds the invoice bytes (`media.filename` = the blob key). Postgres was already isolated per environment — prod Neon / dev 5433 / e2e 5435 — but every environment's `BLOB_READ_WRITE_TOKEN` pointed at the **production** store. Fixed 2026-08-19 (`blob-store-isolation`); backdrop is the EX-459 backup work.
- **Problem**: because local dev runs against a restored prod dump, `media.filename` values are the real invoices — so deleting a test expense on localhost issued a `del()` against production, and Blob has no versioning, no undelete, no PITR. Five years of tax-retained faktury sat one routine cleanup away from gone, in the one plane nobody thought of as "the database". The near-miss that proved it was already live: a stale token variable in a scratch file sent 7 `put()`s at production during the restore drill, saved only by the bytes being identical. Then the swap itself hid a second trap: editing `.env` looked correct and changed nothing, because `vercel env pull` had written `.env.local` hours earlier and **Next.js gives `.env.local` precedence over `.env`** — the guard fired on a file the fix never touched.
- **Rule**: (1) Enumerate every stateful plane when you claim "environments are isolated" — object stores, queues, search indexes and third-party sandboxes all carry per-env credentials that nobody swaps because they aren't "the DB". (2) Put the guard where the app cannot start without passing it: a `superRefine` in the zod env schema, parsed eagerly behind the build gate, turns a wrong token into a boot failure instead of a latent hazard. (3) Key such a guard on `VERCEL_ENV`, never `NODE_ENV` — a local `next build` sets `NODE_ENV=production` and switches the guard off on exactly the machine it protects. (4) A guard in the env layer does **not** cover scripts that read `process.env` directly, so the one tool that writes needs its own explicit flag (`--allow-prod`). (5) When an env change appears to have no effect, check `.env.local` before re-reading your edit. (6) Isolating onto a point-in-time copy buys safety and pays in staleness: an invoice uploaded to production after the copy was taken **404s in local dev**, which is expected, not a bug — top the copy up (`pnpm blob:refresh:preview`) rather than reaching for the production token. (7) An env-layer guard covers only the graph that parses it — the Payload CLI graph never does, so the same check has to sit on `payload.config.ts` where the token reaches the plugin that deletes; a guard on a boot path is worthless if the destructive path boots without it. (8) Keep the top-up **manual** — an automatic schedule was rejected because every `put()`/`copy()`/`list()` is a metered "advanced operation", and exceeding that quota suspended **every** store on the account, production included, on 2026-08-19; a recurring job against a 2000-file mirror is the shape that trips it. Same reason the refresh caps its burst (`BLOB_REFRESH_MAX`) and resumes rather than retrying wholesale. (9) Refuse the mismatch in **both** directions: a production deploy pointed at the preview store writes real invoices into a store that is periodically wiped and re-restored as scratch — a slower loss than a stray `del()`, not a smaller one. But keep it a mismatch check, not an allow-list: an unrecognised store id must pass, or rotating a store turns a stale constant into a refused production boot.
- **Applies to**: implement, plan, code-review, debugging

## A Payload bulk `delete({ where })` collects per-document failures instead of throwing — a partial wipe reports success

- **Context**: „Pobierz i zastąp" (sheet import) and „Przywróć wersję" both run through `restoreKosztorys`, which wiped an investment's tree with `payload.delete({ collection: 'kosztorys-sections', where })` before re-inserting. Fixed 2026-08-19 while chasing a rozjazd between the editor and the sheet immediately after an import.
- **Problem**: Payload's bulk delete is not one statement — it finds the documents and deletes them **one by one**, pushing each failure into `result.errors` rather than throwing. `restoreKosztorys` never read that field, so a wipe that removed 13 of 15 sections returned normally and the restore inserted the fresh tree **beside** the survivors. The damage arrived in two disguises, neither of which named the wipe: duplicated sections whose prace then read as „tylko w aplikacji" in „Porównaj z arkuszem" (17 phantom prace = 7 + 10, the two survivors' contents), and a surviving etap colliding with `kosztorys_stages_investment_ordinal_unique`, whose 23505 the code translated into „Ktoś zmieniał ten kosztorys w tym samym czasie" — a race that never happened. Both readings sent the investigation at the import parser, which was correct all along.
- **Rule**: (1) A wholesale wipe is one `DELETE … WHERE parent_id = $1` per table on the transaction handle — one statement cannot half-succeed, and FK cascades do the rest. Reach for the ORM's bulk delete only where you then inspect its result. (2) Any API that returns errors instead of throwing is a silent-corruption generator when its result is dropped; treat an unread return value from a destructive call as a bug. (3) Don't map a whole error class onto one friendly message — the 23505 handler swallowed the constraint name, which was the only thing separating a genuine race from this bug. Log the raw error before translating. (4) A duplicate that the import creates looks exactly like a row the import failed to remove; when a diff shows „only in the app", count the parents before re-reading the parser.
- **Applies to**: implement, code-review, debugging

## A migration that both ADDs and DROPs has no safe deploy order when a public route reads the table

- **Context**: `kosztorys_client_view` swapped one column set (`hidden_columns` / `hide_empty_rows`) for two (`mode` / `variants`). The first draft did it in one migration — add the new pair, drop the old. Caught at the review gate of `kosztorys-client-view-offer-settlement-variants`, 2026-08-20. Follow-up DROP tracked as EX-722.
- **Problem**: AGENTS.md already gives the direction rule — additive migrates **before** the push, destructive **after** the deploy is live — but a single migration doing both cannot obey it, because the two halves want opposite orders. Migrate first and the still-live old deploy selects a column that no longer exists; push first and the new deploy selects a column not yet added. Postgres answers 42703 either way, and here the read sits on `/k/:token`, the unauthenticated entrance a client is holding a link to — so the transitional window doesn't degrade an admin screen, it hands an investor a 500. Nothing about the migration file looks wrong; the defect lives entirely in the fact that it is one file.
- **Rule**: (1) Split it. The ADD ships alone and is **orderless** — no live code reads the new columns yet, so it can migrate before or after the push. The DROP is a separate migration authored **after** the additive deploy is live. (2) Do not write the DROP migration "while you're in here" — a migration file that exists rides the next `pnpm db:migrate:prod`, so authoring it early reinstates exactly the window you split to avoid. Park it in a tracked issue instead; the issue is the mechanism that makes it happen later rather than never. (3) The cost of the split is dead columns sitting in prod for one deploy cycle — that is the correct price, not a smell. (4) Ask which routes read the table _before_ judging a transitional window acceptable: the same window that is a shrug on an authenticated admin list is an outage when a public, cookie-less route is on the read path. (5) A leftover row from before the migration is its own hazard — here rows would have survived with `variants = '{}'`, which the resolver reads as a real answer and which therefore opts those investments out of the firm-wide default silently and forever. When throwaway data makes it legal, `DELETE` the rows in the migration rather than leaving a shape nobody will ever notice is wrong.
- **Applies to**: implement, plan, code-review

## A default value on a parameter that drives money turns a forgotten argument into a wrong number

- **Context**: `shapeInvestments` (`src/lib/queries/shape-investments.ts`) builds every row of the investments listing. Its wpłaty arrive as a per-investment map; the parameter carried `= {}`. Found 2026-08-23 in `mixed-settlement-both-planes`, while making the listing's bilans and the panel's „Pozostało do zapłaty" one call instead of two formulas.
- **Problem**: with a default, a call site that forgets the map still compiles, still runs, and still renders — every investment simply shows a bilans that deducted no wpłaty at all. On the real dataset that was a **63 278,90 zł** drift on a single investment. The parity gate exists precisely to catch listing-vs-detail drift and it stayed green, because it fed the same forgotten `{}` to both sides: an oracle built from the same missing argument agrees with the subject perfectly. Removing the default turns exactly that mistake into a compile error at every call site, including the test's.
- **Rule**: (1) A parameter whose absence changes a **figure** gets no default — the empty case must be spelled at the call site (`NO_DEPOSITS`), so the reader sees a decision instead of a gap. Defaults are for parameters whose absence changes a _preference_ (a sort order, a page size). (2) A parity/oracle test only tests what the two sides do **not** share: assemble the oracle from a different route than the subject, or it will confirm whatever they both got wrong. (3) Prove such a gate red before trusting its green — pass the wrong argument on purpose once and check it screams. A gate you have never seen fail is a gate you have never tested. (4) The blast radius scales with how many rows one call shapes: a listing builder is a single call site behind hundreds of numbers, which is exactly where a silent default costs most.
- **Applies to**: implement, plan, code-review, test design

## A slice that retires a measurement must chase it into the comments that assert it — or the retired claim gets re-derived from the code

- **Context**: EX-597 measured the kosztorys tree read and retired the belief that Neon cost scales with the **number** of round trips (five reads at 20/21/21/21/44 ms total 45 ms — the slowest, not the sum; the 83–119 ms one-row read that "proved" per-trip cost was cold-start connection setup). It recorded that in `context/archive/2026-07-27-decouple-panel-write-refresh/change.md` § Superseded beliefs. It did not touch the comment at the top of `src/lib/db/kosztorys-tree.ts`, which went on stating the retired model in the imperative: "the cost is the round trip itself … it scales with the NUMBER of reads, not their size. So the lever is the count, and the floor is one (EX-597)."
- **Problem**: the comment cites the very slice that disproved it, so it reads as the conclusion rather than the premise. It was then quoted as fact by a later slice's research and became the whole stated premise of EX-720 ("remove redundant fetches" — on a page whose reads are already parallel, where removing one buys ~0 ms). Two slices reasoned from a number that had been dead for a month. An archived record loses to a comment sitting in the file every reader opens; the archive is where a claim goes to be **remembered**, not where anyone goes to check whether one still holds.
- **Rule**: (1) When a slice retires a measurement or a belief, `grep` for the claim's own vocabulary in `src/**` in the **same** change and fix every comment that asserts it — writing it into "Superseded beliefs" is half the job. (2) A comment that cites a slice id is the highest-risk kind, because the citation reads as evidence; when you touch a slice, audit the comments that name it. (3) State the correction as the correction — "this is NOT what makes it fast, and don't collapse more queries on that reasoning" beats deleting the sentence, which just lets the next reader re-derive the wrong model from the same code shape. (4) A performance premise inherited from a comment is not a measurement: re-measure, or drop the performance framing and justify the change on correctness and shape.
- **Applies to**: implement, plan, research, code-review

## A migration that only tightens can still be additive-first — when the ORM backfills an absent value from the stored doc

- **Context**: `fleet-costs-column` made `vehicle_inspections.cost` `required`, with a migration that backfills `NULL → 0` then `SET NOT NULL`. Both `plan-brief.md` and the Linear issue had written the deploy order as "destructive → push first, migrate after", straight off AGENTS.md's direction rule. Reversed at the review gate, 2026-08-24, after reading Payload's own source.
- **Problem**: AGENTS.md's rule reads the migration's SQL and asks whether it removes something the old code needs. A `SET NOT NULL` removes nothing, so the rule's classifier says "destructive" on the wrong evidence — what actually matters is which window is survivable. Push-first leaves legacy `NULL` rows sitting under a field the new code marks `required`, and Payload's `beforeValidate` `getFallbackValue` tests `typeof siblingDoc[field.name] !== 'undefined'` — **a stored `NULL` counts as present**, so it is backfilled as the fallback, assigned into `siblingData`, and then fails the number validator (`if (!value && !isNumber(value))`). Every _partial_ update on such a row throws `ValidationError`: the sweep's notify stamp, any `/admin` edit. Nothing in the app calls that out — `Promise.allSettled` in `sweep-io.ts` swallows it and the daily digest just re-announces the same overdue inspection. That window is unbounded and silent. Migrate-first's window is the mirror image and far better: for the few minutes before the push, old code can still submit an empty koszt and Postgres refuses it with a loud `23502` — which is precisely the input the change exists to forbid.
- **Rule**: (1) Classify a migration by **which window is survivable**, not by whether the SQL contains a `DROP`. Ask what breaks in each order, then pick the loud, bounded failure over the silent, unbounded one. (2) A tightening under an ORM is not symmetric with a `DROP COLUMN`: the ORM is between the schema and the code, and it will happily manufacture the value that fails validation. Read the ORM's own fallback/validation source before assuming a legacy row is merely "not updated yet". (3) A stored `NULL` is _present_ to almost every "did the caller supply this?" check — `typeof x !== 'undefined'`, `'k' in obj`, `hasOwnProperty`. Any code distinguishing "absent" from "explicitly null" has to say so deliberately. (4) When you reverse a documented order, chase the reversal into every artifact that asserts the old one — the migration header, the tracker issue the human reads at `pnpm db:migrate:prod` time, the plan. One un-chased copy re-derives the wrong order (see the retired-measurement lesson above).
- **Applies to**: implement, plan, code-review, debugging

## „Nobody recorded it" is retired by closing the source, not by redefining the display

- **Context**: `summariseCosts` deliberately **omitted** an inspection type with no priced entry rather than showing `0 zł`, with the reasoning written in three places — the function's comment, a test named after it, and a manual check. The owner then asked for a costs column where a vehicle with no priced inspections reads `0 zł`. `fleet-costs-column`, 2026-08-24.
- **Problem**: the two are flatly contradictory, and the tempting resolution is the cheap one — change what the column renders and leave the source optional. That produces a figure that means two things at once: `0 zł` for a vehicle that genuinely cost nothing, and `0 zł` for one where nobody typed a price. Aggregate them into a footer total and the ambiguity is no longer even visible per row. The precedent that _does_ license a hard zero (`investment-financials-and-discount.md`: „an empty kosztorys is an answer, not a question to forward to the transfers") works only because that source plane is complete and authoritative. The fleet's `cost` was optional, so empty was not yet an answer.
- **Rule**: (1) A display rule that distinguishes "unknown" from "zero" is load-bearing; you retire it by making the unknown impossible — here, `cost` becomes `required` plus a `NOT NULL` migration — not by collapsing the two at the render layer. If you cannot close the source, keep the distinction. (2) When a rule is asserted in a comment, a test, and a checklist, all three are part of the change that reverses it; leaving one behind lets the old rule get re-derived. (3) Watch the sort, not just the cell: an accessor returning `0` for "unknown" sorts that vehicle as the cheapest — the same defect as the `sortUndefined: 'last'` no-op already fixed on this table, where „brak danych" sorted as most urgent. (4) One figure, one rule: the card and the listing must compute it with the same function, or you have shipped two answers to one question.
- **Applies to**: implement, plan, code-review

## A rename splits into two halves with opposite economics — and the half with a deadline is the worthless one

- **Context**: EX-704, the `client` → `investor` rename of the paying party in code (the UI half shipped 2026-08-17). Measured at 123 files / ~880 sites, then **canceled** 2026-08-25 rather than planned. The argument that nearly bought it was timing: „albo teraz" — do it before the dogfooding merge turns throwaway kosztorys data into real data, and before a 1450-commit `staging`→`main` merge.
- **Problem**: both halves of the timing argument were false, and in an instructive way. (1) **The value and the deadline sit on opposite halves.** What `tsc` sees — types, props, components, filenames, cache tags — carries the entire benefit (`client` is overloaded in this repo: ~40 of 66 `client`-containing identifiers are SDK/React, `e.clientX`, `getReadonlySheetsClient`, `'use client'`) and has **no** expiry, because `tsc` is a load-bearing gate there and it will cost the same in a year. What expires is the persisted half — the `client_price` column plus five payload surfaces — and a key name inside serialized JSON is read by nobody, so that half is worth ~0 while carrying ~all the risk. The window was closing over the part not worth doing. (2) **The merge opened no window at all**: `git rev-list --count staging..main` = 0, so it was a fast-forward with no conflict surface, before or after. Nobody checked that number before reasoning from it.
- **Problem (the risk half, why `tsc` green proves nothing)**: the name exists as **data**, not as a symbol, on every surface that matters — raw-SQL strings; the mapper `clientPrice: num(row.client_price)`, where `num(undefined)` is **0**, so a missed rename is a silent wrong number rather than a crash; `ITEM_INSERT_COLUMNS` ↔ its VALUES tuple, correlated **by position only**; an untyped `defaultColumns: string[]`; a bare-`string` `RowConditionT.id`. Five persisted surfaces each sit behind a parser that drops an unknown key **in silence** (`kosztorys_snapshots.payload`, `kosztorys_presets.payload`, `kosztoryses.sheet_column_mapping` — which has no version constant at all, `kosztorys_client_view.hidden_columns`, and two `localStorage` keys). The Payload field `name` is the sharpest trap: `generate:types` regenerates `payload-types.ts` to **conform**, so `payload-types.ts` can never disagree with the collection — a generated type is not a gate, it is an echo.
- **Rule**: (1) Before planning a rename, split it at the `tsc` line and price the halves separately — benefit is almost always on the symbol side, risk and deadlines almost always on the persisted side. If the deadline lands on the worthless half, „now or never" is an argument for **never**. (2) Documented drift is a stable state: a glossary line saying „reading either word, mean the same person" delivers the comprehension benefit at zero risk, and is the deliverable when the sweep is not. (3) Never rename a string-keyed name — DB column, JSON payload key, `localStorage` key, Payload field `name` — as part of a readability change; those are wire format, and their only honest reasons to move are behavioural. (4) A type generated **from** the schema can never contradict it; the real gates here are set-equality drift tests against the live DB (`insert-schema-drift.test.ts`, both directions vs `information_schema.columns` on 5435). Note the golden master does **not** cover kosztorys figures — they come from `sum-transfers.ts`, which never joins `kosztorys_items`; `investment-render-parity-db.test.ts` is the one that does. (5) Check the merge topology before invoking it as urgency — `git rev-list --count <target>..<source>` = 0 means fast-forward, and a fast-forward has no conflict surface to race.
- **Applies to**: plan, research, code-review, implement

## A focused element that is REMOVED fires no blur — every blur-settled draft owes an unmount path

- **Context**: the kosztorys grid holds a numeric cell's text as a draft and settles it on blur / Escape (`useCellDraft`), which is what rolls a refused value back and says so out loud. `react-datasheet-grid` virtualizes rows, so scrolling the edited row out of the window unmounts its input; a filter change or a refresh landing mid-typing does the same. EX-735, 2026-08-25.
- **Problem**: keystrokes commit as they go, so the row carries the last **accepted prefix** of a value the policy refused — the settle is the only thing that takes it back. Unmount skips the settle entirely, so the prefix stays on the row, autosaves, and nobody is told: the exact outcome the rollback exists to prevent, reached through the one exit that never runs it. It survives review because blur "obviously" means leaving a cell — but the DOM fires blur when focus **moves**, never when the focused node is removed. Two follow-on traps sit behind the fix: a bare `useEffect(fn, [])` cleanup closes over the FIRST render, so it settles a draft that is several keystrokes stale; and a blur can land in the same commit as the unmount, so the teardown must be idempotent or one rollback is announced twice — which forces a ref, because a state setter's result is not readable in the same tick.
- **Rule**: (1) A draft held outside the row it edits owes **three** exits, not two — commit (blur / Enter), cancel (Escape), and _disappear_ (unmount). Enumerate them when writing the contract; the third one is the one that silently persists bad data. (2) In a virtualized or filterable list, unmount is an ordinary event on the happy path, not an edge case — anything that "will get flushed when the user leaves" is wrong there. (3) A cleanup that must run current logic reads it from a ref refreshed every render (latest-ref); the empty dep array is what makes it run once, not what makes it correct. (4) Make the teardown idempotent whenever two exits can fire in one commit, and put the flag in a ref — state is too late.
- **Applies to**: implement, code-review, plan

## A time-window coalescer cannot tell a rollback from an edit — the pair must cancel across the window boundary

- **Context**: grid undo coalesces per-keystroke `onChange` batches into one command inside a 700 ms window (`undo-coalesce.ts`), dropping a burst whose net is zero. A refused value leaves an accepted prefix on the row and `cellSettle` rolls it back on the way out. EX-737, 2026-08-25.
- **Problem**: a **blocked** keystroke produces no `onChange` at all, so the window expires while the user is still typing — or still reading the tooltip that says the value was refused. The prefix flushes as command A, the rollback arrives as command B, and Cmd+Z hands back exactly the number the user was told had been rejected. Inside one window the existing net-zero drop already cancelled the pair, which is precisely why the hole looked covered: the window is a heuristic for "one user gesture", and a wall-clock heuristic fails wherever the app writes on the user's behalf, because that write is separated from the user's by an arbitrary pause.
- **Rule**: (1) When a lower layer undoes its own write, the undo stack sees two user edits. The retraction has to cancel against the command **already pushed** — extend the net-zero rule across exactly one boundary, not "flush earlier". (2) Rewrite the top of a stack by **identity**, never by position: anything pushed / undone / pruned in between must make the amend a silent no-op instead of rewriting a command the caller never saw. (3) Only an exact there-and-back cancels; a burst that _continues_ the previous one is two genuine states and owes two undo steps. (4) Alternatives that look cleaner and are not, so they don't get re-litigated: raising `blocked` out of `cellKeystroke` misses the `invalid` and Escape paths; holding the window open while a draft is open needs `columnData` plumbed through the column assembly and inherits the never-settles-on-unmount hazard (EX-735); dropping the timer breaks the failed-save retraction (`dropPendingField`), which needs the burst to still be buffered ≥500 ms later.
- **Applies to**: implement, code-review

## A library's ready-made numeric column parses a comma as a PREFIX and renders in the browser's locale — two silent halves of one wrong number

- **Context**: the kosztorys grid used `react-datasheet-grid`'s stock `floatColumn` for quantities and prices. Report from the owner: „przecinek nie działa, a kropka zamienia się w przecinek". Root cause of the whole `kosztorys-decimal-cell-draft` slice, 2026-08-25.
- **Problem**: two independent defects, neither of which throws. (1) `parseFloat('12,5')` is **12**, not `NaN` — JS parses the longest valid **prefix** and returns it, so a decimal comma is not an error, it is a silent truncation, and the cell stored a figure ten times too small while looking like it had accepted the input. (2) `new Intl.NumberFormat()` with no locale argument formats in the **runtime's** locale, so on a Polish machine the cell rendered `12,5` — the very separator its parser refused. The two halves conspire: the display teaches the user a convention the input rejects, and the rejection is invisible because it returns a plausible number instead of an error.
- **Rule**: (1) Never let `parseFloat` / `Number.parseFloat` validate user input — prefix parsing turns garbage into a number rather than `NaN`. Parse through a contract that can say **reject** as a distinct outcome from _empty_ and _value_ (`parseDecimalInput`'s three-way result is exactly that, which is why the slice was told not to touch it). (2) Any `Intl.*` constructor without an explicit locale reads the environment's; pin it wherever the app has one convention — here comma in, comma out, no thousands separator, one representation both directions. (3) A ready-made column from a grid library bakes both decisions in invisibly: read its parse **and** its format before pointing it at money or quantities. (4) The cheap guard is a round trip, not a parse test — type the app's canonical figure, then assert both what the row stores and what the cell displays.
- **Applies to**: implement, code-review, frontend grid/table work

## A mount-frozen client copy of a wipe-and-reinsert tree writes to dead ids forever — and a bare framework „not found" is what the user sees

- **Context**: the kosztorys grid seeds its rows once at mount (EX-441) and autosaves per cell. A sheet import (`applyKosztorysImport`) and a version restore both go through `replaceTreeWithSnapshot`, which **deletes and re-inserts the whole tree**, so every item id changes. In-tab that is handled (`useRestoreRemount` remounts the body); across tabs / sessions nothing tells the open editor. Reported by the owner 2026-08-31: typing „222" into Przedmiar left „2" and a red toast reading „Nie znaleziono".
- **Problem**: two failures stacked. (1) Every write from the stale tab hit `payload.update` on an id that no longer existed, so Payload threw `NotFound`, whose Polish message is the bare `general:notFound` — „Nie znaleziono" — with no subject and no remedy; the wrapper passed it through verbatim, and the revert-on-error handler then rolled the cell back to a value from a tree that no longer exists. Nothing had persisted for the whole session, once per keystroke, and the DB confirmed it: `max(updated_at)` on `kosztorys_items` predated the session entirely. (2) Around it sat the same class of silence from the other side — `handleAddItem`, `handleInsertItem`, `handleAddSection`, `handleInsertSection`, `handleAddStage` all did `if (!res.success) return`, and the ▲▼ reorders fired `void swapItemOrderAction(...)`, so a refused structural change was invisible **and** left the grid showing an order or a row the DB never had.
- **Rule**: (1) A failure whose meaning is „your whole copy is stale" is not the same event as „your value was rejected", and a message cannot be branched on — carry a **code** (`ActionResultT.code`, set from `NotFound` in one place) and let the client pick the recovery. (2) The recovery for a stale copy is a **reseed, never a revert**: reverting restores a value from the tree that vanished. Refresh the DATA (the server action whose response carries the fresh tree) and remount the grid — not the page. (3) Guard the reseed with a one-shot: a stale tree fails every pending write, so the failures arrive as a burst and each one would otherwise queue its own refresh. (4) Never surface a framework's own not-found sentence to a user; it names nothing and suggests nothing. (5) `if (!res.success) return` and `void someAction()` are the two shapes a swallowed failure takes — an optimistic mutation owes a rollback **and** a toast on every path, including the ones that "can't fail".
- **Applies to**: implement, code-review, plan

## A note appended to a name is welded into that name's identity key — and only one of the writers remembers to strip it

- **Context**: ~750 prace pulled out of 57 old investment sheets into the katalog prac carry a visible „[stary arkusz]" note at the end of their `description`, which the owner deletes by hand while reviewing. No column for it — deliberately (owner, 2026-09-01). But `description` is half of `catalogueKey(description, unit)`, the katalog's identity, so the note sits inside the key's input. EX-753.
- **Problem**: the import script knew to strip the note before computing `match_key`; the katalog's own edit form did not, and the form is the surface the whole review runs through. So the first time the owner corrected a price on a marked praca, the row's key silently became `…stary arkusz|szt` — a key nothing else in the app computes. That praca then stopped matching itself: it lost its wzór twin in „Porównaj z cennikiem", and the insert-only production load, finding no such key, would have added a second copy of a praca already there. Nothing throws, nothing renders red — the row looks correct in the listing, and the damage only shows up as a duplicate weeks later. It survived review because the marker was designed as _display text_, and reviewing display text does not prompt anyone to ask who else computes the key from it.
- **Rule**: (1) Adding anything to a field that feeds an identity key makes that addition part of the identity by default — the question is not "is this display text?" but "which functions compute a key from this field, and do all of them strip it?" Enumerate the writers before choosing the field, not after. (2) When the answer is more than one writer, the strip belongs in a module both import, next to the marker's own definition — a rule that lives at call sites is a rule that is missing at the third one. (3) Prefer a suffix over a prefix for a marker on a name that gets sorted: a suffix stands the marked row next to its unmarked twin, which is exactly the comparison a human review is doing; a prefix piles every marked row into one block, sorted by the marker instead of by the name. (4) The regression guard asserts the **persisted** key (`SELECT match_key …`), never the action's return value — a successful result is what a poisoned key looks like from the outside.
- **Applies to**: implement, code-review, plan

## Namespacing a column id splits two lookups that used to be one — config resolves by BASE key, disclosure only by the FULL id

- **Context**: both subcontractor planes' „Cena j.m. netto" had to stand next to the client price in the Inwestor view, so the column id stopped being a constant and became a function of the plane (`price__w_tools`, `price__own_tools`, built by `plane-price-keys.ts` on the `stage-keys.ts` pattern). Everything downstream keys off that id: labels, header tips, the money axis, the Praca/Postęp layer, the preview allowlist, the „Problemy" reveal, sorting, widths, the hidden-columns set. `kosztorys-contractor-price-columns-in-client-view`, 2026-09-01.
- **Problem**: the two obvious answers are both wrong. Adding an entry per plane to every config map means one map eventually gets forgotten — the exact divergence the change exists to prevent, and the invariant specs (`COLUMN_MONEY_AXIS` ⊆ `COLUMN_LABELS`, same for `COLUMN_LAYER`) only catch the half that was added. Resolving every lookup through the base key is worse in the opposite direction: `PREVIEW_VISIBLE_COLUMNS` would then read `price__own_tools` as `price`, and a subcontractor rate would inherit the client price's pass into the offer the client reads. The two lookups look identical at the call site and have opposite failure modes — one fails by drifting, the other by leaking.
- **Rule**: (1) A namespaced id needs an explicit split: configuration that describes _what kind of figure this is_ (label, axis, layer, tip) resolves through the base key so one concept keeps one entry; anything that decides _who may see it_ matches the full id, and says so in a comment at the definition. (2) The gate on an audience is the audience flag (`previewVisible`), never the view — a view flag read as an audience flag is a regression this repo has already paid for once. (3) Never rename an id that is persisted in a client's **hidden**-columns set: the sanitizer drops unknown keys, so a lost key does not hide the column, it reveals it — renaming fails open, in the one direction that matters. That is why the client's own `price` kept its bare id while the crew rates took the suffix. (4) An id that carries a dimension must not collapse in the picker the way stage keys do: the point of two ids is showing one plane without the other.
- **Applies to**: implement, plan, code-review, kosztorys grid work

## A counter's UNIT is part of its meaning — two honest counts of one defect differ by 4×

- **Context**: EX-761 added a „Problemy" row for prace priced differently in different sekcje. The katalog import had already reported the same condition on the wzór and printed **9**; the new row on the same kosztorys read **38**. 2026-09-02.
- **Problem**: both numbers are right and neither says so. The import counts **prace** — one per `catalogueKey` group whose prices disagree; the registry counts **pozycje**, because every `ROW_CONDITIONS` entry counts rows and rows are what you get to look at when you press the problem. The owner read the gap as a defect in the new diagnostic, and the plan's „Open Risks" section had pre-registered exactly this mismatch — which changed nothing, because the person reading `(38)` is reading the UI, not the plan. A caveat parked in a planning doc is not a mitigation. The same slice carried a second unverified claim: it justified excluding rows with no cena j.m. by asserting the registry „keeps its counters disjoint". It does not and never did — `no-client-price-with-work` and `work-without-planned-qty` fire on the same pozycja. The narrower true reason (the „Cena j.m." seam already has two diagnostics for a missing price, so a third would report the same pozycja for the same thing) was sufficient on its own; the invented invariant added nothing but a wrong statement about the codebase.
- **Rule**: (1) When two surfaces count one condition, make the units match or put the unit in the label — a bare `(38)` standing next to a remembered `9` reads as a bug, and the reader has no way to discover otherwise. (2) Never justify a design choice with a system-wide invariant you have not checked across every member of that system; if the narrow, local reason is already sufficient, write **that** and nothing more. (3) An „Open Risks" bullet discharges nothing — if the risk is that a user misreads a number, the fix has to live where the number is rendered.
- **Applies to**: implement, plan, code-review

## A spec helper routed through a TOLERANT lookup makes every negative assertion vacuous under a rename

- **Context**: the `row-conditions` spec asked „czy ten warunek łapie ten wiersz?" through
  `countMatching([row], id, ctx) === 1`. `countMatching` looks the id up in a `Map` and answers **0**
  for an id nobody knows — deliberately, because a filter persisted in `localStorage` under a since
  removed condition must not blank the kosztorys.
- **Problem**: that production tolerance became test blindness. 58 helper calls, dozens of them
  `expect(...).toBe(false)`, would pass vacuously the day someone rewrites an `id` in the registry —
  the spec would stay green while describing conditions that no longer exist.
- **Rule**: a spec helper that resolves a subject **by key** must fail loudly on an unknown key. Read
  the registry directly and throw, rather than borrowing the production lookup whose whole job is to
  survive a bad key. The forgiving path is for the app, not for the guard that watches it.
- **Applies to**: every `BY_ID.get(...)`, `?? fallback`, `find(...) ?? default` reached from a spec —
  and every id that lives in persisted user state, where tolerance is the correct production
  behaviour. Sibling of „A fixture in a degenerate state makes every absence assertion vacuous".

## Part of this schema is invisible to Payload — reference-level rules live only in SQL, and `push: false` is the only thing guarding them

- **Context**: Research into ending hand-written migrations (2026-09-03). `migrate:create` has been useless since 2026-02-22 because it diffs the config against the newest `.json` snapshot in `src/migrations/`, and the last one predates that date — every hand-written migration since leaves no snapshot, so the generator regenerates months of schema and starts prompting for rename resolution.
- **Problem**: The database and the config disagree in ways that are not cosmetic, and every disagreement is knowledge the config does not hold: unique indexes that encode domain rules the collections never state, columns held NOT NULL where Payload believes they are nullable, narrower column types, non-Payload tables, Postgres-default constraint names, and dead enum labels Postgres cannot drop without rebuilding the type. Nothing in the codebase states any of this and nothing checks it, so a tool that reasons from the config alone reasons from a partial picture — confidently.
- **Rule**: (1) **`push: false` in `payload.config.ts` is load-bearing** — `pushDevSchema` introspects the live database and drops what the config lacks, so flipping it silently discards whatever the config has not been told about. (2) **Never apply an auto-generated migration without reading it**, even once the snapshot chain is repaired: the generator's notion of "correct" deletes indexes it did not author and relaxes constraints it cannot see, and the drizzle-kit rename prompt turns one wrong answer into `DROP COLUMN` + `ADD COLUMN`. (3) **Tables outside Payload are not the obstacle** people assume — drizzle diffs snapshot against snapshot and never reads the database, so a table absent from `adapter.schema` is absent from both sides and generates nothing. The obstacle is the broken snapshot chain, plus the fact that repairing it honestly demands a prod migration that changes column types, nullability and constraint names while fixing no bug. That trade was judged not worth making; hand-written migrations stay. (4) **When a constraint is the enforcement of a domain rule, the collection is not where it is written** — read the indexes before concluding a rule is unenforced, and before assuming a schema-shaped tool understands the schema.
- **Re-measuring the gap** (any enumeration here would be stale by the next migration — take the measurement instead): build two throwaway databases and diff their catalogues. One is the prod dump plus `payload migrate` (what the migration chain produces); the other is created from the SQL that `generateMigration(adapter.defaultDrizzleSnapshot, generateDrizzleJson(adapter.schema))` emits (what Payload thinks the schema is). Compare `information_schema.columns`, `pg_indexes`, `pg_constraint` and `pg_enum` between them. Run it against a scratch container on an unused port, never against the dev or test database.
- **Applies to**: /10x-plan, /10x-implement, /10x-impl-review, payload-prod-migrate, any change touching `payload.config.ts`'s adapter or `src/migrations/`

## Gdzie stoi bramka, decyduje profil zapisu płaszczyzny — nie upodobanie do hooków albo do akcji

- **Context**: EX-748 zamyka zakończoną inwestycję na zapisy w dwóch płaszczyznach naraz — transakcje i kosztorys. 2026-09-03.
- **Problem**: obie wyglądają na „to samo — zablokuj zapis", więc kusi jedna bramka. Ale `transactions` pisze **wyłącznie** przez Payload, a kosztorys w ~12 miejscach idzie surowym SQL-em (`getDb` + `sql`), co omija hooki kolekcji; akcje jadą Local API, gdzie `overrideAccess` jest domyślnie `true`, więc `access` nie widzi ich wcale. Jedna bramka dla obu światów zostawia dziurę po którejś stronie — i zostawiła: `beforeValidate` nie odpala się na delete, więc kasowanie transakcji z `/admin` przechodziło mimo bramki, dopóki review nie dołożyło `beforeDelete`.
- **Rule**: (1) Zanim wybierzesz warstwę bramki, **policz ścieżki zapisu płaszczyzny** — Payload, surowy SQL, Local API, REST, `/admin`. Bramka idzie tam, gdzie widać je wszystkie: hook kolekcji, gdy zapis jest wyłącznie przez Payload; wrapper akcji, gdy istnieje ścieżka surowego SQL-a, a `access` domyka wtedy tylko `/admin`. (2) Hook to nie jeden punkt — `beforeValidate` nie widzi delete. Wyliczaj operacje, nie „hook założony". (3) Ślepy zaułek: `access.update: () => false` na kolekcji zamyka też pole, którym się odblokowuje. Reguła zamka musi być **polowa**, nie kolekcyjna, inaczej zamek nie ma klucza. (4) Odmowa z hooka leci jako `APIError(msg, 403)`, nie goły `Error` — `routeError` przepisuje komunikat, którego nie umie uznać za publiczny, więc panel pokazuje „Something went wrong" i 500 zamiast zdania po polsku.
- **Applies to**: /10x-plan, /10x-implement, code-review — każda zmiana dokładająca regułę dostępu ponad istniejący zapis
