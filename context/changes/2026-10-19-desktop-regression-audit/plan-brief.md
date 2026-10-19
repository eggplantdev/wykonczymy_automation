# Desktop audit + regression click-through — Plan Brief

> Full plan: `context/changes/2026-10-19-desktop-regression-audit/plan.md`

## What & Why

Between 17 and 19.10 the refactor touched 1276 files under `src/`. It was audited in code, but nobody
has clicked through the refactored app as each role. A desktop (1280 px) audit was planned but never
ran.

This pass does both jobs in one walk:

- checks the desktop layout;
- hunts regressions;
- verifies the open manual-checks boxes that can be checked locally.

## Starting Point

- The tests are green.
- The `app-audit-refactor` record has an empty "Roles checked" column for every UI directory.
- The manual-checks registry holds 251 open boxes, about 58 of them from the refactor itself.
- The `fix/desktop-1280-qa` worktree has no commits and stays untouched.

## Desired End State

- Every route × role cell has been visited at 1280 px (plus a 1024 px glance) and is either OK or tied to
  a finding.
- Every finding is fixed (regressions with a failing-first test), answered by the user, dropped or
  filed.
- Every locally verifiable registry box is ticked or has become a finding.
- A visual report (an Artifact) shows screenshots of every cell with its status, plus before/after shots
  for each layout fix.

## Key Decisions Made

| Decision             | Choice                                                                                       | Why (1 sentence)                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| One pass vs. two     | Audit, regression hunt and registry boxes in one walk                                        | All three need the same browser, logins and screens.                                            |
| Target               | :3010 against 5435, main checkout                                                            | :3000 runs on the dev DB 5433, and this pass writes data.                                       |
| Roles                | EMPLOYEE + MANAGER → OWNER + ADMIN → logged-out                                              | The least-privileged roles hit the most conditional branches; share tokens come from the OWNER. |
| ADMIN depth          | Smoke test of the role-branch cells only                                                     | Every role branch in the pages is `isAdminOrOwnerRole`, so ADMIN renders like OWNER.            |
| Order inside a stage | By refactor diff weight (kosztorys, investment page, transactions first)                     | The riskiest screens get the freshest attention.                                                |
| Finding categories   | regression / layout / doubtful                                                               | Each routes differently: TDD fix, CSS fix, or ask the user.                                     |
| Registry boxes       | Attached to the matrix cell where they happen; out-of-scope ones stay unticked with a reason | Avoids a second walk and avoids ticking what wasn't verified.                                   |
| Record               | `review-gate.md` in the change folder + an Artifact updated after each stage                 | The ledger is durable; the screenshots need a page, not the terminal.                           |

## Scope

**In scope:**

- every `(frontend)`, `(auth)`, `(share)` and `(legal)` route, at 1280 and 1024;
- primary write actions on 5435;
- registry boxes that can be verified locally.

**Out of scope:**

- phone widths;
- `/admin`;
- the code audit;
- E2E and the full suite;
- mail, SMS, Sheets, staging and production;
- Safari and PWA checks;
- redesigns.

## Phases at a Glance

| Phase                           | What it delivers                                                                  | Key risk                                                        |
| ------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1. Preflight                    | Current code on :3010/5435, 4 logins, ledger and report skeleton, registry triage | Staging doesn't yet have the announced change.                  |
| 2. Stage A — EMPLOYEE + MANAGER | Worker surface and guards; all management routes as MANAGER                       | Another agent's uncommitted edit mistaken for a regression.     |
| 3. Stage B — OWNER + ADMIN      | Full write paths, share tokens, ADMIN smoke                                       | The kosztorys editor and investment page carry the most change. |
| 4. Stage C — logged-out + share | Login, recovery, legal pages, investor and worker links                           | Share tokens missing if Stage B skipped them.                   |
| 5. Close-out                    | Ledger and registry closed, final report, teardown                                | `tsconfig.json` drift mixed with another agent's edit.          |

**Prerequisites:** the user's announced change is on `staging`; Docker is up (5435); the Playwright MCP
browser is free.

**Estimated effort:** about 4–8 hours over 2–3 sessions. The registry boxes roughly double the pure
audit.

## Open Risks & Assumptions

- The latest local dump may be old. `db:import:test` + `db:migrate:test` fixes the schema; data gaps get
  filled through the UI.
- AI-dependent boxes depend on the local AI key working. If it doesn't, they are marked out.
- The shared tree moves under the pass. Run `git status` before every fix; commit by pathspec only.

## Success Criteria (Summary)

- Each role can do its daily work on desktop without a broken screen or a console error.
- No open box remains in the ledger, and every locally verifiable registry box is resolved.
- The report shows every screen and every fix with an after-shot.
