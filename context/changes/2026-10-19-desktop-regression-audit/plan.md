# Desktop audit + regression click-through — Implementation Plan

## Overview

One browser pass over the whole app, run as four accounts (EMPLOYEE, MANAGER, OWNER, ADMIN) plus
logged-out. It checks two things at once:

- **desktop layout** at 1280 px, with a glance at 1024 px;
- **regressions** left by the 17–19.10 refactor (`app-audit-refactor` and the slices around it).

There is one ledger with three finding categories. Each stage ends with a commit and an update of a
visual report (an Artifact with screenshots).

The pass also works through the **open boxes in `context/foundation/manual-checks.md` that can be
verified locally at desktop width**. Each box is attached to the matrix cell (route × role) where it
naturally happens, so it is checked during that visit rather than in a second walk.

## Current State Analysis

- The refactor window is `c713fa2bf..staging` (the last commit before 17.10 is `c713fa2bf`). It changed
  1276 files under `src/` (+20.5k / −23k lines). The weight falls on `components/kosztorys` (78),
  `components/ui` (71), `components/forms` (46), `lib/kosztorys` (42), `collections` (42), `lib/actions` and
  `lib/queries` (29 + 28), `components/dialogs` (23) and `app/(frontend)` (15). The new `components/orders`
  (8) is in there too.
- `app-audit-refactor` audited every directory by code, but its "Roles checked" column is empty for
  every UI directory. Nobody has clicked the refactored app as each role.
- **The manual-checks registry holds 251 open boxes in about 85 sections** (counted 2026-10-19).
  - About 58 of them are the refactor's own checks: the `app-audit-refactor` phases 1–8, „preview
    brancha vs staging” and „poprawki z bramki przeglądu”. They verify exactly what this pass is
    worried about, so they are first-priority.
  - The largest feature sections are `big-bag-order` (25), `payout-cards` (17) and `slice-review-gate`
    (7), plus the EX-1118 section (6).
- The `fix/desktop-1280-qa` branch and its worktree never produced a commit. A desktop pass has never
  happened; only the mobile 375 audit ran. That worktree stays untouched.
- Tests caught what they cover. This pass exists for what they don't: layout, wiring between the
  screens, role-dependent rendering, and dialogs.
- **Server/DB mismatch.** The user's dev server on :3000 (`next dev --turbo`, main checkout) reads
  `.env`, so it runs on the dev DB **5433**. The pass writes data, so it boots the profile's server on
  **:3010 against 5435** (`context/reference/manual-verification.md` → Local target). It serves the
  same main checkout, so it serves the same code, and :3000 is never touched.
- **Accounts on 5435:**
  - OWNER comes from `pnpm seed:e2e` (`e2e@wykonczymy.test`, `src/scripts/e2e-user-credentials.ts`).
  - EMPLOYEE comes from `seed-e2e-workers` (`e2e-worker@wykonczymy.test`).
  - There is no seeded MANAGER or ADMIN. The OWNER creates them through `/pracownicy`
    (`assignableRoles`), using fabricated `.test` addresses.

### Route × role matrix

Legend:

- ✓ = full pass;
- Δ = role-specific delta only;
- ↪ = assert the redirect or 404 and move on;
- — = not reachable.

The **Weight** column is the order inside a stage, hottest first, by refactor diff. Gates are from the
page files.

| #   | Route                           | Weight | EMPLOYEE                 | MANAGER     | OWNER    | ADMIN | Role-specific rendering to check                                            |
| --- | ------------------------------- | ------ | ------------------------ | ----------- | -------- | ----- | --------------------------------------------------------------------------- |
| 1   | `/inwestycje/[id]/kosztorys`    | hot    | ↪                        | ✓           | ✓        | Δ     | editor, Filtry, view switcher, undo                                         |
| 2   | `/inwestycje/[id]/kosztorys_v2` | hot    | ↪                        | ✓           | ✓        | Δ     | `financials` only for ADMIN/OWNER                                           |
| 3   | `/inwestycje/[id]`              | hot    | ↪                        | ✓           | ✓        | Δ     | `canSeeMargin` ADMIN/OWNER; info block, orders dialog, umowa                |
| 4   | `/` (transakcje)                | hot    | ↪ own `/pracownicy/[id]` | ✓           | ✓        | Δ     | add / cancel transfer; BONUS + COMPANY_FUNDING only ADMIN/OWNER             |
| 5   | `/pracownicy/[id]`              | hot    | ✓ own · ↪ other id       | ✓           | ✓        | Δ     | own page = phone-scope page, also check at desktop; payouts, „Nowy wydatek” |
| 6   | `/kasa/[id]`                    | warm   | ↪                        | ✓           | ✓        | —     | „Lista wypłat”, `canViewRegister`                                           |
| 7   | `/kasy`                         | warm   | ↪                        | ✓           | ✓        | —     | user register stats                                                         |
| 8   | `/inwestycje`                   | warm   | ↪                        | ✓           | ✓        | —     | listing filters                                                             |
| 9   | `/zgloszenia-wydatkow`          | warm   | ↪                        | ✓           | ✓        | —     | accept / reject drafts, receipts toast                                      |
| 10  | `/zgloszenia-prac`              | warm   | ↪                        | ✓           | ✓        | —     |                                                                             |
| 11  | `/pracownicy`                   | warm   | ↪                        | ✓           | ✓        | Δ     | MANAGER manages EMPLOYEE only (`canManageAccount`)                          |
| 12  | `/kosztorysy`                   | warm   | ↪                        | ✓           | ✓        | —     |                                                                             |
| 13  | `/katalog-prac`                 | warm   | ↪                        | ✓           | ✓        | —     | Kolumny / Kategoria menus, chips                                            |
| 14  | `/szablony`, `/szablony/[id]`   | warm   | ↪                        | ✓           | ✓        | —     |                                                                             |
| 15  | `/zgloszenia` (leads)           | cool   | ↪                        | ✓           | ✓        | Δ     | recipients editor ADMIN/OWNER                                               |
| 16  | `/flota`, `/flota/[id]`         | cool   | ↪                        | ✓ read-only | ✓        | —     | `canEdit` ADMIN/OWNER                                                       |
| 17  | `/sprzet`, `/sprzet/[id]`       | cool   | ↪                        | ✓ read-only | ✓        | —     | `canEdit` ADMIN/OWNER                                                       |
| 18  | `/kosz`                         | cool   | ↪                        | ✓           | ✓        | Δ     | „Usuń na zawsze” asks for the typed name                                    |
| 19  | `/warianty-badge`               | cold   | ↪                        | —           | ✓ glance | —     | dev showcase page; layout glance only                                       |
| 20  | `[...catchAll]`                 | cold   | ✓                        | —           | ✓        | —     | 404 renders in the shell                                                    |

**Logged-out pass** (Phase 4):

- `/zaloguj`, `/zaloguj/zapomniane-haslo`, `/zaloguj/reset-hasla`;
- share routes: `/k/[token]`, `/z/[investment]/[name]/[token]`, `/zgloszenie-prac/[...rest]`,
  `/podglad-inwestora/[id]`, `/podglad-pracownika/[worker]/[id]`, `/p/[...rest]`;
- an unknown share token (404);
- `/privacy`, `/terms`, `/usuwanie-danych`;
- a protected route, which should go to `/zaloguj`.

## Desired End State

- **Every matrix cell resolved.** Each cell is ticked in the ledger as passed or carries a finding.
- **Every finding at a terminal box:**
  - regressions fixed, each with a failing-first test;
  - layout defects fixed and re-shot;
  - doubtful items answered by the user;
  - the rest dropped, dismissed or filed to Linear „Wykonczymy”, with a reason.
- **A complete visual report.** The Artifact shows every route × role at 1280 and 1024, with a status,
  a note, problem areas boxed, and before/after shots for each layout fix.
- **Each fix has a manual-checks box** in `context/foundation/manual-checks.md`, under one
  `## desktop-regression-audit` section.
- **Every in-scope registry box is resolved.** It is either ticked, or failed and turned into a ledger
  finding. A box that is out of scope stays unticked with its reason recorded (see the triage rules in
  Phase 1). Each section left fully ticked is collapsed into its index row, following the registry
  header's rules.

### Key Discoveries:

- Access gates:
  - management pages use `requireAuth(MANAGEMENT_ROLES)` or `requireManagementPage`;
  - `/` redirects EMPLOYEE to `/pracownicy/${user.id}` (`src/app/(frontend)/(dashboard)/page.tsx:15`);
  - ADMIN-vs-OWNER differences: every role branch in the pages is `isAdminOrOwnerRole`
    (`src/lib/auth/roles.ts:23`), so ADMIN renders exactly like OWNER. The ADMIN pass is a smoke test,
    not a full matrix.
- Verification profile and its traps: `context/reference/manual-verification.md`:
  - never click real print;
  - one browser means one session, so switch roles sequentially by logout + login;
  - `FilterMultiSelect` empty-state semantics;
  - hydration errors seen in the MCP browser need a clean headless re-run before they count;
  - never `clipboard.readText()`;
  - nav badges clear themselves.
- Breakpoints: `sm` = 768, `md` = 1024, `lg` = 1280 (`src/styles/globals.css`). **1024 is exactly the
  `md` edge**, so it is where `md:` layouts switch. Never add a 640 breakpoint.

## What We're NOT Doing

- **Phone widths.** The 375 audit already covered them. A phone-scope page is checked here only at
  desktop width.
- **The Payload admin panel** (`/admin`). It is unused.
- **Re-running the code audit.** `app-audit-refactor` covered it; this pass is behavioural and visual.
- **Running E2E or the full suite.** Only touched specs and typecheck run.
- **Mail delivery, Sheets writes, production or staging.** Everything runs locally on 5435.
- **Registry boxes that can't be verified locally at desktop width** stay unticked, with their reason in
  the ledger (Phase 1 triage rules). These include:
  - phones, installed PWAs and push;
  - Safari or WebKit;
  - real mail, SMS or Sheets writes;
  - dev tooling with no UI;
  - waiting for time to pass.
- **Polish-literal i18n gaps in management-only forms.** Those are a recorded decision.
- **New features or redesigns.** A layout fix restores intent at 1280/1024; it does not restyle.
- **Touching** `.worktrees/desktop-1280-qa`, the dev DB on 5433 or the user's server on :3000.

## Implementation Approach

The run is organised by role stages, in the order EMPLOYEE + MANAGER → OWNER + ADMIN → logged-out.
Roles switch through the app only (logout, then login on `/zaloguj`).

Inside a stage, routes go hottest-first by the Weight column, so the riskiest screens are seen while
attention is fresh.

### Per-screen procedure (every ✓ cell)

1. Set the viewport to 1280×800. Load the route and wait for it to settle.
2. Read the console. Errors that are not known noise become a finding.
3. Take a full-page screenshot, then look for:
   - overflow and horizontal scroll;
   - clipped or truncated text, and wrapped toolbars;
   - misaligned columns and broken sticky headers;
   - empty or loading states that never resolve;
   - untranslated strings where the role sees a translated UI (EMPLOYEE).
4. Run the route's **primary action**: open its main dialog or form, perform one write where the route
   has one (5435 only), and confirm the result shows without a reload.
5. Run the **registry boxes attached to this cell**, following the `verify-manual-checks` skill's
   conventions:
   - a box that passes is ticked in `manual-checks.md`;
   - a box that fails becomes a ledger finding, categorised like any other, and stays unticked until
     the fix lands.
6. Set the viewport to 1024×768 and take a second screenshot. At this width only the layout is checked.
7. Record the cell in the ledger.

**Δ cells** check only the role-specific rendering named in the matrix.
**↪ cells** check only the redirect or 404 by URL.

### Finding categories and routing

**regression** — behaviour that worked at `c713fa2bf` and doesn't now. Before calling it one:

- confirm it against the code at `c713fa2bf` (`git log -L` / `git show c713fa2bf:<file>`);
- confirm it against `git status` (the :3010 server serves the shared working tree, so another agent's
  uncommitted edit can be the cause, not the refactor).

The fix routes through test-driven-debugging: the failing test comes first, asserts observable state,
and sits at the cheapest layer that catches it. Then the fix.

**layout** — a desktop rendering defect at 1280 or 1024. Fix it with Tailwind or CSS on the `sm:` /
`md:` / `lg:` breakpoints. When an image's size changes, update its `next/image` `sizes` too. Re-shoot
the after state.

- No test for a cosmetic gesture.
- Before calling it a defect, check git and `context/` for intent (it may be a deliberate choice).

**doubtful** — it might be intended, or the fix would change what a role may do. Don't apply it. Ask the
user in prose, one item at a time, batched at the end of the stage. Never auto-apply a behaviour change
from this category.

**Before filing anything**, check reachability: a defect no user can reach is dropped. Fix first. File
to Linear (team Ex-plant, project „Wykonczymy”, Polish title, label `Bug`) only for a real but large or
risky fix. A fix that would take more than about 30 min and blocks a flow gets filed, its cell is marked
`blocked`, and the stage continues.

## Critical Implementation Details

- **Timing & lifecycle:** run `git status` before every fix and commit. Other agents commit to
  `staging` in this tree. Commits go by pathspec only, after loading `safe-commit`. A file another agent
  is also editing goes through the temporary-index patch route.
- **State sequencing:** do the stages in this order.
  - The OWNER creates the MANAGER and ADMIN accounts during preflight, so Stage A can log in as MANAGER.
  - Stage C needs share tokens that the OWNER generates in Stage B. Write those tokens and URLs into the
    ledger's Preflight section as they are created.
- **Debug & observability:**
  - Screenshots are saved as JPEG (quality ~70) to the implementing session's scratchpad, under
    `desktop-audit/<stage>/<route-slug>__<role>__<width>.jpg`.
  - The Artifact carries the durable copy. The scratchpad does not survive the session.

---

## Phase 1: Preflight

### Overview

Prepare the target: current code, a migrated 5435, a :3010 server, four logins, an empty ledger and an
empty report.

### Changes Required:

#### 1. Confirm the code under test

**File**: none (checks only).

**Intent**: The pass is worthless if it runs on stale code. Confirm that `staging` HEAD contains the
user's announced change.

**Contract**:

- `git log -5 staging` shows the change. Record its sha in the ledger header.
- `git status --short` is noted, so foreign uncommitted edits are known up front.

#### 2. Target DB and server

**File**: none (environment).

**Intent**: Bring up the target the profile requires, so every write stays on 5435.

**Contract**:

- Reset 5435 from the latest local dump: `pnpm db:import:test`. 5435 is a disposable test DB; never
  touch 5433.
- Run `git status src/migrations` (a migration from another agent's uncommitted work would also apply),
  then `pnpm db:migrate:test`.
- `DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm seed:e2e` creates the OWNER, and the e2e worker seed
  creates the EMPLOYEE.
- Boot `NEXT_DIST_DIR=.next-e2e DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec next dev --turbo -p 3010`
  as a background task.
- `next dev` rewrites `tsconfig.json`, so snapshot `git diff tsconfig.json` now and restore only that
  drift at teardown.

#### 3. Accounts

**File**: none (state created through the UI).

**Intent**: Four roles to log in as.

**Contract**:

- As the OWNER in `/pracownicy`, create a MANAGER and an ADMIN with fabricated `.test` e-mails and one
  test password.
- Record all four logins in the ledger's Preflight section. Test-only credentials on 5435 are fine to
  write down.
- Confirm each login works through `/zaloguj`.

#### 4. Ledger + report skeleton

**File**: `context/changes/2026-10-19-desktop-regression-audit/review-gate.md`, and the Artifact.

**Intent**: One durable record for the pass, plus the visual report, both set up before the first click.

**Contract**:

- **Ledger sections:**
  - `## Preflight`: sha, accounts, share tokens and other state created;
  - `## Matrix`: the table above with one status cell per role, values `pending` / `ok` / `finding #n`
    / `blocked`;
  - `## Findings`: the checkbox format of the slice-review-gate ledger, each line carrying
    `regression | layout | doubtful`, the route, the role and the width. Correctness lines carry the
    `test:` sub-line.
  - `## Tests & suite`.
- **Report:**
  - load the `artifact-design` skill first;
  - a single HTML page with a per-stage section, one card per route × role (1280 and 1024 shots, status
    badge, note) and a filter by status or category;
  - screenshots are published through `files` (`shots/<stage>/…jpg`), never inlined as data URIs;
  - one publish per stage, to the same file path, so the URL stays stable.

#### 5. Registry triage

**File**: the ledger's `## Manual checks` section. The registry itself is not edited here.

**Intent**: Decide which open registry boxes this pass can verify and where each one happens, using the
registry as it stands after the user's staging change has landed.

**Contract**:

- Load the `verify-manual-checks` skill.
- Read every open box in `context/foundation/manual-checks.md` and assign each one to exactly one of:
  - **cell `<#>/<role>`** — the matrix cell where it naturally happens. The role is the one the box
    names; if it names none, use the least-privileged role that reaches it.
  - **out: `<reason>`** — not verifiable here, for one of these reasons:
    - it needs a phone, an installed PWA or push;
    - it needs Safari or WebKit;
    - it needs real mail, SMS, a Sheets write or production;
    - it is dev tooling with no UI (pre-push, E2E speed);
    - it needs real time to pass, and no cron route can be triggered locally to stand in.
- A cron box is in scope when its route can be fired locally:
  `fetch('/api/cron/<route>', { headers: { Authorization: 'Bearer <CRON_SECRET>' } })` from a logged-in
  page.
- An AI-dependent box is in scope only if the local AI key works on the first try. Otherwise it is out,
  with that reason.
- Order the in-scope boxes inside each cell so that the `app-audit-refactor` boxes come first.
- Record the split as counts per stage plus the out list. The per-box assignment lives in the ledger
  only, not in this plan.

### Success Criteria:

#### Automated Verification:

- `pnpm db:migrate:test` exits 0.
- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3010/zaloguj` returns `200`.
- The ledger's `## Manual checks` section assigns every open registry box to a cell or marks it out.

#### Manual Verification:

- None. Preflight has no user-facing change.

**Implementation Note**: Commit `review-gate.md` (skeleton + Preflight) and record the Artifact URL in
`change.md` Notes.

---

## Phase 2: Stage A — EMPLOYEE + MANAGER

### Overview

Run the least-privileged roles first. They render the most conditional branches (hidden margin,
read-only fleet and equipment, scoped accounts), which is where a refactor most often drops a role
check.

### Changes Required:

#### 1. EMPLOYEE pass

**File**: fixes land where findings point; the ledger, the report.

**Intent**: The worker's whole desktop surface plus the guard rails.

**Contract**:

- `/` lands on their own `/pracownicy/[id]`.
- The own page gets the full per-screen procedure, including:
  - „Nowy wydatek” from the kasa;
  - the receipts and payout lists;
  - the language switch to `uk` once, which checks the freshly translated filters, toasts and preview.
- Another worker's `/pracownicy/[id]` returns a 404.
- `/kasy` and one `/kasa/[id]` redirect or 404.
- One management route per guard type (`requireAuth` and `requireManagementPage`) is refused.

#### 2. MANAGER pass

**File**: as above.

**Intent**: Every management route as MANAGER, hottest first.

**Contract**:

- Every ✓ cell in the MANAGER column, with these role assertions:
  - no margin on `/inwestycje/[id]`;
  - no financials on `kosztorys_v2`;
  - `/flota` and `/sprzet` are read-only;
  - no recipients editor on `/zgloszenia`;
  - BONUS and COMPANY_FUNDING are not offered in the add-transfer form;
  - only EMPLOYEE accounts are editable in `/pracownicy`.

#### 3. Stage close

**Intent**: Leave no open box from this stage.

**Contract**:

- Ask the stage's doubtful items.
- Fix or file every finding.
- Add a manual-checks box for each fix.
- Publish the report section for Stage A.
- Commit by concern: fixes with their tests, then the ledger and the registry.

### Success Criteria:

#### Automated Verification:

- Every regression spec written in this stage is green: `pnpm exec vitest run <each spec>`.

#### Manual Verification:

- Every layout fix from this stage looks right at 1280 and 1024 in the running app; its after-shot is
  in the report.
- Every regression fix from this stage: the broken flow works end-to-end as the role that hit it.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 3: Stage B — OWNER + ADMIN

### Overview

The full management surface with every write path, then an ADMIN smoke test on the role-branch cells.

### Changes Required:

#### 1. OWNER pass

**File**: fixes where findings point; the ledger, the report.

**Intent**: Every ✓ cell in the OWNER column, hottest first, primary write included.

**Contract**:

- The OWNER column of the matrix, including:
  - BONUS and COMPANY_FUNDING in the add-transfer form;
  - adding and cancelling a transfer;
  - the orders dialog and the umowa dialog on the investment page;
  - one kosztorys cell edit, then undo;
  - an accept and a reject in `/zgloszenia-wydatkow`;
  - `/kosz`: restore, and „Usuń na zawsze” with the typed name.
- Generate the share links Stage C needs (the investor link `/k/…`, the worker report link `/z/…`) and
  record them in the Preflight section.

#### 2. ADMIN smoke

**Intent**: Prove ADMIN renders like OWNER on every `isAdminOrOwnerRole` branch.

**Contract**:

- Only the Δ cells: margin, financials, recipients editor, BONUS and COMPANY_FUNDING, account management
  in `/pracownicy`, and `/kosz`.
- One screenshot per cell, at 1280 only.

#### 3. Stage close

**Contract**: as in Phase 2.

### Success Criteria:

#### Automated Verification:

- Every regression spec written in this stage is green: `pnpm exec vitest run <each spec>`.

#### Manual Verification:

- Every layout fix from this stage looks right at 1280 and 1024; its after-shot is in the report.
- Every regression fix from this stage works end-to-end as the role that hit it.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 4: Stage C — Logged-out and share routes

### Overview

Everything a person sees without an account, on the same 1280/1024 procedure.

### Changes Required:

#### 1. Auth and legal routes

**Intent**: Login, password recovery and the legal pages render and validate at desktop width.

**Contract**:

- `/zaloguj`: a wrong password shows the inline error; a correct one lands on the role's home.
- `zapomniane-haslo` submits. Mail is dead outside prod, so the confirmation UI is the whole check.
- `reset-hasla` with no or a bad token shows its error state.
- A protected route visited while logged out goes to `/zaloguj`.
- The three legal pages render.

#### 2. Share routes

**Intent**: The investor and worker share surfaces, with the tokens from Stage B.

**Contract**:

- `/k/[token]`, `/z/[investment]/[name]/[token]`, `/podglad-inwestora/[id]`,
  `/podglad-pracownika/[worker]/[id]`, `/zgloszenie-prac/…` and `/p/…` each get the per-screen
  procedure.
- A garbage token returns a 404.

#### 3. Stage close

**Contract**: as in Phase 2.

### Success Criteria:

#### Automated Verification:

- Every regression spec written in this stage is green: `pnpm exec vitest run <each spec>`.

#### Manual Verification:

- Every layout fix from this stage looks right at 1280 and 1024; its after-shot is in the report.

**Implementation Note**: When this phase's automated verification passes, commit and continue.

---

## Phase 5: Close-out

### Overview

Close the books on the pass and tear down what the run started.

### Changes Required:

#### 1. Ledger and report final state

**Intent**: Nothing pending or open.

**Contract**:

- Every matrix cell is `ok`, `finding #n` or `blocked` (a `blocked` cell's finding is filed).
- Every finding box is checked.
- Registry sweep:
  - every in-scope box is ticked or tied to a finding;
  - every section left fully ticked is replaced by its index row, as the registry header prescribes;
  - out-of-scope boxes stay unticked, with their reason in the ledger.
- The report gets a summary header: counts per category and per role, and filters.

#### 2. Teardown

**Intent**: Leave the machine as found.

**Contract**:

- Stop the :3010 task (TaskStop on my own task; never `pkill`).
- Restore only the `tsconfig.json` drift that `next dev` added. Compare it with the preflight snapshot;
  a hunk from another agent stays.
- `.next-e2e` stays; it is gitignored.

### Success Criteria:

#### Automated Verification:

- `grep -c '\- \[ \]' review-gate.md` in the change folder returns 0.

#### Manual Verification:

- None beyond the registry boxes the stages already added.

---

## Testing Strategy

### Unit Tests:

- One failing-first spec per regression, at the cheapest layer that catches it. Specs go under
  `src/__tests__/` and mirror the source path; DOM specs go to `*.test.tsx`.
- No test for a cosmetic layout fix.

### Integration Tests:

- Only when a regression crosses action → DB (`*.db.test.ts`, run singly). E2E only if the regression
  needs client → action → DB → revalidation and the user agrees. Otherwise file it with the
  `e2e-backlog` label.

### Manual Testing Steps:

1. Phases 2–4 are themselves the manual pass.
2. Each fix leaves a box in `context/foundation/manual-checks.md` § `desktop-regression-audit`.

## Performance Considerations

None to optimise. If a screen is visibly slow on 5435 (several seconds to settle), record it as a
`doubtful` finding with the time measured. Do not chase it in this pass.

## Whole-tree Gate

Run once, after Phase 5:

- Type checking passes: `pnpm typecheck`.
- Lint on the touched files passes: `pnpm exec eslint <touched files>`.
- Every spec written during the pass is green: `pnpm exec vitest run <specs>`.

Not run: the full suite, E2E and the build. The user asks for those explicitly.

## References

- Refactor record: `context/archive/2026-10-19-app-audit-refactor/change.md`
- Verification profile and traps: `context/reference/manual-verification.md`
- Accounts and access: `context/reference/accounts-and-access.md`; gates in `src/lib/auth/roles.ts`
- Nav titles and routes: `src/lib/constants/sections.ts`
- E2E credentials: `src/scripts/e2e-user-credentials.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Preflight

#### Automated

- [x] 1.1 `pnpm db:migrate:test` exits 0 — retargeted to staging: `pnpm db:migrate:preview` exit 0
- [x] 1.2 :3010 answers 200 on `/zaloguj` — retargeted: staging answers, QA logins work
- [x] 1.3 Registry triage recorded in the ledger (every open box assigned to a cell or marked out)

### Phase 2: Stage A — EMPLOYEE + MANAGER

#### Automated

- [ ] 2.1 Stage A regression specs green

### Phase 3: Stage B — OWNER + ADMIN

#### Automated

- [ ] 3.1 Stage B regression specs green

### Phase 4: Stage C — Logged-out and share routes

#### Automated

- [ ] 4.1 Stage C regression specs green

### Phase 5: Close-out

#### Automated

- [ ] 5.1 No open box in `review-gate.md`
