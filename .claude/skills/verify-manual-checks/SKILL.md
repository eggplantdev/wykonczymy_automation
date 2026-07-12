---
name: verify-manual-checks
description: >-
  Run the project's manual verification pass — drive each manual check against the running app in the
  browser, fix obvious bugs on the spot, tick the boxes that pass, and record every finding as a
  test-classified todolist in context/foundation/manual-checks.md. Use this WHENEVER the user says
  "run/verify the manual checks", "do the QA pass", "check the manual verification for slice S-XX",
  "manually verify this slice before Done", "go through it in the browser and tell me what's broken",
  OR asks to "audit/verify/QA <a part of the app>" even when no checklist exists yet (e.g. "audit the
  kosztorys editor and find problems", "poklikaj po edytorze i zapisz findingi"). Works two ways:
  drive an existing manual-checks.md slice section, or audit an area you name and derive the checks
  yourself. Handles the preflight (isolated test DB, credentials, login), and never silently drops a
  problem — every bug or regression found, in-scope or not, lands in the registry with a test
  disposition. NOT for: authoring a Playwright/Vitest test FILE (that's /10x-e2e or /10x-tdd),
  reproducing one named bug with a failing test (test-driven debugging), editing the checklist's
  wording, running an existing test suite, or reseeding the db-test container — this skill EXERCISES
  the app and logs what it finds.
---

# Verify manual checks

The project keeps one living QA registry at `context/foundation/manual-checks.md` — a `##` section
per slice, checkboxes ticked by hand as behavior is verified against the running app. A slice with
unticked boxes is **not `Done`** (hard gate in `/10x-implement`). This skill drives that pass.

You know how to run this project's app and exercise its flows. Two entry modes:

- **Checklist mode** — the user points at a slice section (e.g. "run S-03's Phase 4 checks"). Drive
  each existing checkbox.
- **Audit mode** — the user names an area with no checklist ready ("audit the kosztorys editor"). You
  derive the checks: read the relevant code, list the behaviors and edge cases a human would verify,
  confirm the list with the user, then drive them. Write them into `manual-checks.md` as a new
  section so the pass is repeatable.

## Non-negotiables

1. **Test DB only — never the dev DB, never prod.** Manual verification writes and mutates data.
   Point the app at the isolated **`db-test` container on 5435** (`DB_POSTGRES_URL_TEST`, db
   `wykonczymy-test`), the same DB the E2E suite uses. The dev DB (5433) holds data entered locally
   since the last dump and must not be wiped; the Neon prod URL is off-limits entirely.
2. **Never skip a problem because it's "out of scope."** If you trip over a bug, regression, console
   error, broken link, or bad state while checking something else, it goes in the registry. The point
   of the pass is to surface everything, not only the boxes you were handed.
3. **Don't stop on a blocker.** A check you can't verify, or a problem that needs a human decision,
   becomes an **unchecked** finding with an exact explanation of what to decide/answer — then move to
   the next check. Never abandon the pass halfway.
4. **Tick only what you verified passing.** Passing check → tick its box. Failing/uncertain → leave
   unchecked and log a finding.

## Step 0 — Preflight (do this first, always)

Before touching a single check, confirm you actually have what the pass needs. If any of these is
missing, **stop and report exactly what's missing** rather than run against the wrong DB or guess —
a pass run on the dev DB or with no login is worse than no pass.

### Step 0.0 — Acquire the manual-check lock (mutual exclusion across worktrees)

The 5435 `db-test` DB is a **single shared resource**: import → migrate → seed → mutate. Two passes
running at once (e.g. from two worktrees) corrupt each other's schema and fixtures. Only **one**
verification pass may hold it at a time. The lock lives at a path shared by every worktree of this
repo (worktrees share one common git dir), so it serializes across all of them:

```bash
LOCK="$(git rev-parse --git-common-dir)/manual-check.lock"
```

- **Acquire** with an atomic `mkdir` (portable, no `flock` needed):

  ```bash
  if mkdir "$LOCK" 2>/dev/null; then
    { echo "worktree: $(pwd)"; date -u +%s; date -u +%FT%TZ; } > "$LOCK/owner"
  fi
  ```

- **If it already exists**, read `"$LOCK/owner"` and decide by age (PID-liveness is useless here —
  every Bash call is a fresh shell):
  - Age `> 5400` s (90 min) → assume a crashed/abandoned pass, reclaim: `rm -rf "$LOCK"` and retry the `mkdir`.
  - Otherwise a live pass owns it → **wait**: sleep ~30–60 s, print `⏳ manual-check lock held by <owner worktree> since <time>; waiting…`, and retry. Don't proceed until you own it.
- **Release** at teardown (see the "Keep the running app up" note below) — pass, fail, or abort:
  `rm -rf "$LOCK"`. The 90-min TTL is the backstop if teardown never runs.
- **Break it by hand** when you're certain nothing is running:
  `rm -rf "$(git rev-parse --git-common-dir)/manual-check.lock"`.

- [ ] **Test DB is up and correct.** The `db-test` container answers on **5435** and `DB_POSTGRES_URL_TEST`
      points at `wykonczymy-test`. Start it if needed (`pnpm test:e2e` starts it, or `docker compose`);
      reset fixtures with `pnpm db:import:test`. Confirm it's the **test** DB, not 5433.
- [ ] **Test DB is migrated to the current code.** `db:import:test` restores a prod dump that can be
      **behind** the branch's schema, so current code queries columns the dump lacks and every read
      throws (seen: a seed dying on `errorMissingColumn`). Apply pending migrations to it first with
      **`pnpm db:migrate:test`** (targets `DB_POSTGRES_URL_TEST` — safe, it's the test DB, not prod;
      use the named script rather than an inline env override so you can't fat-finger the wrong DB).
      Run it **from the worktree** so it picks up the branch's own `src/migrations/`. This doubles as
      the dry-run for the eventual `pnpm db:migrate:prod` — a hand-written migration that breaks here
      would have broken prod.
- [ ] **Fixture content the checks assume actually exists in the test DB.** Query it — don't assume.
      Kosztorys editor content (sections/items/stages) is **locally seeded** and **not** in a prod dump,
      so `db:import:test` leaves the test DB schema-correct but content-empty for these flows. Seed it
      first, DB env pointed at `DB_POSTGRES_URL_TEST`: prefer **`perf-seed-kosztorys.ts`** (synthetic,
      no external calls) unless a check needs the realistic rozpiska — `seed-kosztorys.ts` reads the
      **live** Google Sheet, so only use it deliberately and confirm before it wipes that investment's
      kosztorys. Note: the synthetic seed keys rows by `investment_id` and may not create a
      `kosztoryses` row (the sheet link), so the sheet panel can show "no sheet" — fine for editor checks.
- [ ] **App runs against the test DB — in its own build dir.** Boot with `DB_POSTGRES_URL` set to the
      **test** URL. If a dev server is already running (the user's, on 3000/3001), a second `next dev`
      **fails on the `.next/dev/lock`** — give this instance its own dir and port. Use a dist dir the
      repo **already gitignores** (`.next-e2e` here — check `.gitignore`), never an un-ignored name:
      Tailwind v4 auto-scans the project root, and a non-ignored build dir poisons the _other_ server's
      CSS with garbage `data-[…]` utilities (`Parsing CSS source code failed`). Recover from that by
      clearing that server's `.next` and restarting.
      `NEXT_DIST_DIR=.next-e2e DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec next dev --turbo -p 3010`.
      Never kill the user's server. Poll the port until it serves before driving. First route hit
      compiles in Turbopack (~10–20s) — that's latency, not a hang.
      _A fresh Turbopack cache in a throwaway dist dir produces flaky bogus artifacts — a route can
      serve a spurious **404** (page module never executes — no logs from it) or a **500**
      (`Parsing CSS source code failed` / garbled selector, lightningcss family). Both are cache noise,
      not product bugs. Force a clean recompile of the route before believing it: touch/edit the route
      file, or `rm -rf` the dist dir and restart. Confirm the page's own code actually ran (a temporary
      top-of-page log, or its expected PERF line) before recording any route-level failure as a finding._
- [ ] **Credentials work — and you actually log in.** The E2E suite's seeded OWNER lives in this DB;
      ensure it with `seed-e2e-user.ts` (creds in `e2e-user-credentials.ts`), or mint a temp OWNER via
      the Local API with `skipRevalidation` (memory `project_local_login_and_test_fixtures`; `ADMIN`/`PASS`
      is stale). **Log in through the form and confirm the session's role — don't trust a leftover
      browser session**: a stale cookie can render the dashboard yet fail management-gated routes (a
      MANAGEMENT-only page bails with a bare 404/redirect, not a "no access" message), which reads as a
      phantom bug. Most kosztorys/stage controls need `MANAGEMENT_ROLES` (OWNER/MANAGER); note which
      role each check requires.
- [ ] **Login page + entry route known.** You have the login URL (`/zaloguj`) and the exact route(s)
      the checks live on (e.g. `/inwestycje/<id>/kosztorys`), with an investment id that has the seeded
      content.
- [ ] **Anything else the specific checks call for** — a Google Sheets credential for sheet-backed
      flows, a specific investment state, etc.

**Keep the running app up until the pass is genuinely finished.** Tearing down the server while any
check is unverified or any finding still needs the app to confirm it just forces a full, slow rebuild
(fresh Turbopack compile + reseed) to answer one more question — pure waste. The harness stays live
through Steps 1–4; cleanup is the **last** thing you do, only once every check is ticked-or-logged and
no open finding needs a running app. Then: kill the `:3010` server, `rm -rf` the throwaway dist dir,
and revert any file the tooling touched incidentally (`next dev` reformats `tsconfig.json` and injects
the dist dir into `include` — `git checkout` it). **Finally release the manual-check lock** acquired in
Step 0.0: `rm -rf "$(git rev-parse --git-common-dir)/manual-check.lock"`. Release it even if the pass
failed or you're bailing out — a held lock blocks every other worktree until the 90-min TTL expires.

Report the preflight result before proceeding: what's ready, what you set up, what (if anything)
blocks the pass.

## Step 1 — Drive the checks

Exercise each check the way a human would — **Playwright (browser) for UI behavior, plus reading code
and querying the test DB** to confirm the underlying state. A UI that looks right can still have
written the wrong row; a passing box means you confirmed the observable/persisted result, not just
that the screen didn't error.

For each check, decide per its nature: pure-backend checks (a query returns the right value, a column
carries real data) you can confirm by reading code/DB; UI checks (a column appears, a toast fires, a
value recomputes live) you drive in the browser. Most slices mix both.

As you go: tick a box the moment you've confirmed it passes. Everything else — a failing check, a
check you couldn't run, or an unrelated problem you stumbled on — becomes a finding (Step 3).

**Match the evidence to the failure mode — don't instrument a defect the code can't produce.** Before
building elaborate DOM/timing instrumentation to "prove" a check, read the handler and ask what code
shape the defect requires. A "no vanish-then-reappear flicker" check only fails if the code
optimistically mutates then reverts (an async two-render cycle); if the handler does a **synchronous
early `return`** before any `setState` (e.g. a client pre-check that toasts and returns), flicker is
structurally impossible and one observation that the visible state never changed (a stable row/count)
closes it. Reserve frame-by-frame instrumentation (`MutationObserver`, rAF sampling) for behavior that
is genuinely timing-dependent. Fighting a virtualized grid with ad-hoc JS to catch a non-event is the
anti-pattern this exists to stop (see `lessons.md` → "Driving react-datasheet-grid in a QA pass").

## Step 2 — Fix obvious bugs on the spot

If a finding is an unambiguous, low-risk bug with an obvious fix (a typo, a wrong constant, a missing
guard whose correct form isn't in question), fix it, re-verify, and record it as a **resolved**
finding (checked box, with a one-line note of what you changed). Change as little as possible and stay
inside the project's conventions.

Anything behavior-changing, judgment-heavy, or uncertain is **not** an on-the-spot fix — it's an open
finding for the human to decide. When in doubt, leave it open.

## Step 3 — Record every finding in the registry

Append findings **into `context/foundation/manual-checks.md`, under the slice's section** (create a
`### Findings — <date>` subsection; in audit mode, create the whole slice section first). Keep it a
todolist so open items are visibly unresolved. Each finding is one entry:

```
- [ ] **<short title>** — <what's wrong / what couldn't be verified>, at `file:line` or `<route>`.
      **Needs human:** <the exact question/decision/thing to verify>.
      **Test disposition:** <TDD | test-driven-debugging | no automated test> · <unit | integration | e2e> — <one-line why>.
```

- **Checked `- [x]`** = resolved by you (obvious fix applied + re-verified). Note what you changed.
- **Unchecked `- [ ]`** = open: a failing check, a blocker, or an out-of-scope problem. **Needs
  human:** states precisely what must be answered/decided/verified — no vague "investigate this".

### Test disposition — classify every finding

The pass isn't only bug-hunting; it feeds the test strategy. For each finding decide **whether and
how it should be covered**, routing to this project's conventions (see `AGENTS.md` › Testing):

- **TDD** (`/10x-tdd`) — the finding is _missing or new behavior_ you can name a first failing test
  for, impl-not-yet-written. Test-first.
- **test-driven-debugging** — the finding is _a real bug in existing code that slipped past the
  tests_. Per `AGENTS.md` this is **mandatory**: reproduce with a failing test **first**, then fix.
  Assert the **persisted/observable state, not the action's return value** — a success result can hide
  a failed write. The repro test stays as the regression guard.
- **no automated test** — genuinely not worth a test (one-off visual polish, a config value, a check
  cheaper to eyeball). Say _why_, so the skip is a decision, not an omission.

Then pick the **cheapest layer that gives a real signal** — never "cover this file":

- **unit** — Vitest spec under `src/__tests__` (`@/*` → `./src/*`). Pure logic: a calc, a guard, a
  reducer.
- **integration** — a boundary crossed without a browser (server action → DB, a query, a Payload
  hook). Assert the row that landed.
- **e2e** — Playwright spec under `e2e/` against the 5435 `db-test` container. Reserve for
  browser-level / multi-boundary risk that only shows up through the real UI.

A finding can be "no fix needed but should be covered" (behavior is correct but untested and risky) —
that's still a `- [x]`-behavior/`- [ ]`-test split; make the disposition explicit either way.

## Step 4 — Close out

Report a short tally: boxes ticked, findings opened, findings fixed, and anything that blocked the
pass. Link the registry section. Don't dump the full findings list in the terminal — that's the
file's job; surface only the count plus any finding that blocks the slice from `Done`.

Keep Linear/slice status in sync per the project's gate rules — but manual checks with open findings
mean the slice is **not `Done`**; don't mark it so.
