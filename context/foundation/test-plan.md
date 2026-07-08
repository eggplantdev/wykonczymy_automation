# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-08 (Phase 1 change opened)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic diff that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in `<area>`"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is produced
   by `/10x-research` during each rollout phase. If the plan and research
   disagree about where the failure lives, research is the ground truth.

**Governing lesson (this project).** The team has already been burned by
tests that were green while the product was wrong: the investments _listing_
and the individual investment _view_ computed different numbers, and the
suite passed because the tests asserted the implementation, not the truth.
Therefore every test's **oracle must come from an independent source** —
product requirements or a second surface that must agree — never from the
code under test. An assertion whose expected value was lifted from the
implementation is tautological and is treated as a defect in the test.

Hot-spot scope used for likelihood weighting: `src/` (excluding
`payload-types`, `__tests__`, build output).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                 | Impact | Likelihood | Source (evidence — not anchor)                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------- |
| 1   | Two app surfaces disagree — investment totals ≠ kosztorys totals (or listing ≠ detail view); numbers silently diverge   | High   | High       | interview Q1b, Q2 (lived burn); roadmap S-01 live-totals rule             |
| 2   | A form / mutation change breaks the user-facing path silently — no integration or e2e test exercises the real flow      | High   | High       | interview Q4 (layer gap); hot-spot dir `src/lib/actions` (38 commits/30d) |
| 3   | The core ledger drifts — a transfer stops correctly updating a register balance / marża / bilans                        | High   | Medium     | interview Q1a, Q3; roadmap FR-015 guardrail #1                            |
| 4   | Editor data loss — optimistic autosave swallows an error, an unsaved change is lost, and there is no way to revert      | High   | Medium     | interview Q1 (2nd worry), Q4; roadmap S-13 undo                           |
| 5   | The in-app kosztorys computes different numbers than the Google Sheet it replaces — clients billed on wrong figures     | High   | Medium     | interview Q1c; roadmap S-09 cutover parity                                |
| 6   | Kosztorys mutations are not gated — an EMPLOYEE writes, or a role bypasses the MANAGEMENT_ROLES check on the new tables | High   | Medium     | abuse lens; roadmap S-15 access rule                                      |
| 7   | The transactions/transfers table (listing + queries) degrades or breaks under thousands of rows                         | Medium | Medium     | interview Q5; hot-spot dirs `src/lib/queries` (27), `src/lib/db` (18)     |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                                                  | Must challenge                                                                                                        | Context `/10x-research` must ground                                                                       | Likely cheapest layer                                                                 | Anti-pattern to avoid                                                                                                                      |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| #1   | For a fixed investment fixture, the total shown in the listing, the detail view, and the kosztorys all equal the same independently-derived expected figure                                  | That "listing and view both call the same helper" means they agree — they diverged before despite shared-looking code | The two (or three) code paths that each produce a total, and the single source figure they must all match | integration (DB-backed, cross-surface assertion)                                      | Oracle copied from either surface's own calculation; asserting one view against the other instead of against an independent expected value |
| #2   | Submitting the real form through the server action persists the expected state AND the UI reflects it — a broken handler fails the test                                                      | That a passing unit test on the action means the wired-up form works                                                  | The form → action → persisted-state boundary; auth/session shape needed to drive it                       | integration first; e2e only for the full auth+cookie+handler crossing                 | Testing the action's return value instead of persisted state; happy-path-only with no error/validation branch                              |
| #3   | After a transfer create/delete, the register balance and investment figures equal an independently-computed expected value, including LABOR_COST / RABAT / LOSS / CANCELLATION special cases | That a 2xx / success result means the write landed correctly                                                          | Which figures each transfer type moves (balance vs marża vs bilans), and the recalculation hook timing    | unit for the pure calc; integration for the hook-driven recalculation                 | Asserting the action result rather than the persisted balance; skipping the no-source-register transfer types                              |
| #4   | A simulated save failure leaves the grid showing the pre-edit value (revert), not the optimistic value; a successful save persists it                                                        | That optimistic UI == persisted state; that "no error thrown" means "saved"                                           | The autosave debounce/optimistic path and where the persisted state is read back from                     | integration (drive save, force failure, assert reverted + persisted)                  | Asserting only local grid state; mocking the persistence layer so the revert path never actually runs                                      |
| #5   | For a golden investment present in both worlds, the app's computed kosztorys figures match the sheet's figures within rounding                                                               | That matching one total means all derived figures (netto/brutto/discount/stage sums) match                            | A golden fixture: the sheet's numbers as the oracle, and the app inputs that should reproduce them        | contract / one-time parity check against a golden fixture (not testing the live sync) | Testing the dying Sheets sync itself; using the app's own output as the oracle                                                             |
| #6   | An EMPLOYEE (and any non-management role) is denied create/update/delete on kosztorys sections/items/stages at the server boundary                                                           | That hiding the UI control is access control; that the client-side gate is enough                                     | The server-side access-control functions applied to the kosztorys mutations, per role                     | integration (call the action as each role, assert allow/deny)                         | Testing only the UI visibility; asserting the client guard instead of the server rejection                                                 |
| #7   | The transactions listing/query returns correct results and stays within an agreed time/row budget at thousands of rows                                                                       | That current small-dataset performance predicts large-dataset behavior                                                | The query/render path for the transactions table and a realistic large-row fixture                        | targeted perf smoke on the query/render, not through the full browser                 | e2e-through-the-browser perf assertions (flaky); asserting wall-clock without a fixed dataset                                              |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                          | Goal (one line)                                                                                  | Risks covered | Test types                   | Status        | Change folder                |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------ | ------------- | ---------------------------- | ------------- | ---------------------------- |
| 1   | Finish E2E harness                  | Authed browser flows run deterministically against the isolated `wykonczymy-test` DB + fixture   | enables #2    | e2e harness, auth fixture    | change opened | context/changes/e2e-harness/ |
| 2   | Lock the financial core             | Ledger correctness + cross-surface parity (listing = view = kosztorys) with independent oracles  | #1, #3        | unit + integration           | not started   | —                            |
| 3   | Kosztorys calc-core + editor safety | Computed-not-stored correctness + autosave-revert + undo + server-side authz gate                | #1, #4, #6    | unit + integration           | not started   | —                            |
| 4   | Editor E2E coverage                 | User-facing editor paths (section/item, live totals, autosave, undo, view toggle) run in-browser | #2, #4        | e2e                          | not started   | —                            |
| 5   | Migration parity + scale gate       | Kosztorys figures match the sheet on a golden investment; transactions table holds at scale      | #5, #7        | contract/golden + perf smoke | not started   | —                            |

**Status vocabulary** (fixed): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer                | Tool                                 | Version | Notes                                                                                                                                  |
| -------------------- | ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| unit + integration   | Vitest                               | ^4.0.18 | `pnpm test`; specs in `src/__tests__` (52 files), `@/*` alias, env stubbed via `src/__tests__/stubs/`                                  |
| DB-backed tests      | Vitest + docker Postgres             | ^4.0.18 | `*.db.test.ts` hit a real Postgres; new isolated test DB `wykonczymy-test` on port 5435                                                |
| e2e                  | Playwright                           | ^1.50.0 | `pnpm test:e2e`; own port 3100, isolated `.next-e2e` build, system Chrome; **auth fixture + isolated-DB wiring missing — see Phase 1** |
| API mocking          | none yet — see Phase 2/3             | —       | Integration layer is thin; mock only at the network edge (e.g. Google Sheets HTTP)                                                     |
| accessibility        | none yet                             | —       | Out of scope this rollout (a11y hardening lives in roadmap S-15)                                                                       |
| (optional) AI-native | Playwright MCP — checked: 2026-07-08 | n/a     | Available for exploratory verification only; not a substitute for deterministic e2e                                                    |

**Stack grounding tools (current session):**

- Docs: Context7 — available; not queried yet (Playwright/Vitest setup is already established in-repo); checked: 2026-07-08
- Search: Exa.ai — available; not used (no stale-status question raised); checked: 2026-07-08
- Runtime/browser: Playwright MCP — available; possible use for exploratory editor verification during Phase 4, not for the committed suite; checked: 2026-07-08
- Provider/platform: Linear (project tracking), Vercel (deploy) — available; not a test surface; checked: 2026-07-08

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required for §3 Phase N" means the gate is enforced once that rollout phase
lands; before that, the gate is `planned`.

| Gate                        | Where                     | Required?                         | Catches                                         |
| --------------------------- | ------------------------- | --------------------------------- | ----------------------------------------------- |
| lint + typecheck            | local + CI                | required                          | syntactic / type drift                          |
| unit + integration          | local + `.husky/pre-push` | required (pre-push runs tests)    | logic regressions                               |
| e2e on critical flows       | local + CI on PR          | required after §3 Phase 1         | broken critical user paths (financial + editor) |
| financial-core parity check | local + CI                | required after §3 Phase 2         | cross-surface total divergence                  |
| access-control on mutations | local + CI                | required after §3 Phase 3         | role-bypass writes on kosztorys tables          |
| migration parity smoke      | manual, pre-cutover       | required before §3 Phase 5 (S-09) | in-app vs sheet number drift                    |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once the
relevant rollout phase ships; before that, it reads "TBD — see §3 Phase N."

### 6.1 Adding a unit test

- **Location**: `src/__tests__/`, mirroring the unit's feature area (e.g. `src/__tests__/leads/`).
- **Naming**: `<subject>.test.ts`; DB-backed variants use `<subject>.db.test.ts`.
- **Reference test**: `src/__tests__/calculate-margin.test.ts` (pure calc), `src/__tests__/leads/store-lead.db.test.ts` (DB-backed).
- **Run locally**: `pnpm exec vitest run src/__tests__/<file>.test.ts`.
- **Oracle rule**: expected values come from requirements or a hand-computed figure, never from the function under test (see §1 governing lesson).

### 6.2 Adding an integration test

- TBD — see §3 Phase 2. (Cross-surface parity + form→action→persisted-state patterns land here.)

### 6.3 Adding an e2e test

- TBD — see §3 Phase 1 (harness + auth fixture) and Phase 4 (editor flows).

### 6.4 Adding a test for a new server action / mutation

- TBD — see §3 Phase 2. Assert **persisted state**, not the `ActionResultT` return value (a success result can hide a failed write — AGENTS.md testing rule).

### 6.5 Adding an access-control test

- TBD — see §3 Phase 3. Call the action as each role; assert server-side allow/deny, not UI visibility.

### 6.6 Per-rollout-phase notes

(Optional. After each phase lands, the implementing plan appends a 2-3 line
note here capturing anything surprising the phase taught.)

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Google Sheets sync / mirror** — retired at cutover (roadmap S-09). Don't invest in testing the dying integration beyond the one-time parity oracle in Phase 5 and not corrupting live data before then. Re-evaluate only if cutover is cancelled. (Source: Phase 2 interview Q5.)
- **Caching / revalidation correctness** — the team is explicitly not worried about caching. Re-evaluate if a stale-data incident surfaces. (Source: interview Q3, Q5.)
- **UI snapshot / visual-regression tests** — brittle, catch little on this app's screens. Re-evaluate if a purely-visual regression class emerges. (Source: interview Q5.)
- **Payload admin panel** — framework-owned, low blast radius, not our code. (Source: interview Q5.)
- **Neon prod data-loss via branch retention** — real, but a backup/observability concern, not a test target (tracked in memory + `lesson-db-backup-resilience`). Handled by the FTP backup pipeline, not this rollout.

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-08
- Stack versions last verified: 2026-07-08
- AI-native tool references last verified: 2026-07-08

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
