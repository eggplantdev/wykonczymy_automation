# Worktree slice isolation + verification-before-review

Spec for baking git branch/worktree isolation into the 10x flow so that **a slice = a
reviewable branch**, and moving the browser verification + its regression tests **before**
review so reviewers see the tests.

## Decisions (locked)

- **Branch: mandatory.** Every slice implemented on its own branch off a base (default `main`,
  configurable per change — some branch off `staging`, cf. `table`→`staging`).
- **Branch creation point: `/10x-implement` phase-1**, idempotent (create-if-on-base, adopt-if-already-on-a-branch).
  `/10x-new` may seed it when used, but is not the source of truth (slices get added ad-hoc without `/10x-new`).
- **Worktree: opt-in**, not mandatory — the repo's `.env`/`node_modules`/lightningcss/port friction
  makes always-on too costly. Backed by a tested bootstrap script.
- **node_modules: symlink-with-install-fallback.** Symlink to main at creation (dodges the arm64
  lightningcss reinstall trap). If the slice changes `package.json`/lockfile, detach and `pnpm install --force`
  into an own node_modules. Re-running the bootstrap script performs this fallback.
- **Test DB (5435) is a single shared resource.** Coding/typecheck/build/unit-tests are fully parallel
  across worktrees (never touch it). Only manual-check/E2E passes touch it → **serialized by a lock**;
  a second pass waits.
- **Manual-check lock: 90-min TTL**, atomic `mkdir` at `$(git rev-parse --git-common-dir)/manual-check.lock`
  (shared across all worktrees of the repo). Age-based staleness (fresh shell per Bash call → PID useless).
- **`db:migrate:test`**: named script (not inline env override) to migrate the test DB safely; doubles as
  the prod-migration dry-run.
- **Verification before review.** Sequence becomes: manual-check (Playwright, dispatched) → author
  finding-driven regression tests → review. Reviewers then see fixes + tests in one diff.
- **Test authoring always routes to a skill** (`/10x-tdd` unit/integration, `/10x-e2e` browser), never
  hand-rolled; anchored on a risk in `context/foundation/test-plan.md` when it exists, else the finding
  is its own risk.

## Done (project-local, verified)

- `scripts/worktree-new.sh` — create/repair worktree: symlink `.env` + node_modules (install-fallback on
  dep drift), regen payload types, self-test (lightningcss resolves + typecheck). Idempotent repair mode.
- `scripts/worktree-rm.sh` — teardown; `--delete-branch` only deletes a **merged** branch (`git branch -d`).
- `package.json` — `db:migrate:test`, `wt:new`, `wt:rm`.
- `verify-manual-checks` skill — Step 0.0 lock (acquire/wait/reclaim/release), migrate line → `db:migrate:test`
  run from the worktree, lock release in teardown.

## Done (global 10x skills — edited in ~/.claude/skills only)

> ⚠ These live as **separate copies** in `~/workspace/10x_devs/.claude/skills/` too, which now
> DIVERGE. If 10x_devs is your source of truth, port these four edits there or they'll be clobbered
> on the next sync. (`slice-review-gate` has no 10x_devs copy — ~/.claude is its only home.)

Reconciliation confirmed by user: behavior-asserting regression tests run before review; impl-coupled
tests stay after `/simplify`. All four applied:

1. **`10x-implement`** — phase-1: create/adopt branch, write `branch:` into `change.md`. If project provides
   `scripts/worktree-new.sh` and the user opted into a worktree, invoke it and record `worktree:`.
2. **`change.md` frontmatter** — add `branch:` and `worktree:` (record-only). Update `10x-new` + schema doc.
3. **`slice-review-gate`** — new **Step 0.5** (after scope ID, before review fan-out): if the project has a
   browser/manual verification skill, dispatch it; route each finding needing a test to `/10x-tdd`|`/10x-e2e`
   (anchored on test-plan.md risk); author those regression tests **now** so review covers them. Kept generic
   (no wykonczymy specifics — guarded by "does the project provide these").
4. **`10x-archive`** — on close: print `git push -u … && gh pr create …` (human pushes, never auto). Post-merge:
   suggest `scripts/worktree-rm.sh <id> --delete-branch`. "archive = PR prepared", merge stays human.

## The conflict to resolve (gate philosophy)

`slice-review-gate` §"Why the order is load-bearing" (SKILL.md:89-105) insists **tests come LAST**, after
`/simplify`, so specs don't lock in code `/simplify` is about to reshape. The reorder authors regression
tests **before** review/simplify.

**Reconciliation (recommended):** the two aren't in conflict once you split by test kind.

- The pre-review tests are **finding-driven regression tests that assert observable behavior** (the repo's
  mandated style). `/simplify` reshapes _internals_, not behavior — so behavior-asserting tests survive it by
  construction. Authoring them early does **not** trip the gate's trap.
- The trap the gate warns about is **implementation-coupled** tests. Those still wait until Step 3 (after
  `/simplify`), unchanged.

So: carve an exception into §"Why the order is load-bearing" for behavior-asserting regression tests from the
verification pass; leave the rest of the order intact. Net sequence:

**implement → branch → manual-check (fix + behavior regression tests) → review → `/simplify` → (impl-coupled/coverage tests) → suite → archive (PR prepared).**

## Open

- Confirm the reconciliation above vs. keeping tests strictly last (would weaken your "reviewers see tests" goal).
- Worktree home dir default: `<repo-parent>/<repo-name>-worktrees/<change-id>` — OK?
