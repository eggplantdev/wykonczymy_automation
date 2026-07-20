---
project: 'Wykonczymy — off-sheets phase 1'
context_type: brownfield
created: 2026-06-11
updated: 2026-06-12
timeline_budget:
  delivery_weeks: 8
  hard_deadline: null
  after_hours_only: false
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 16
  gray_areas_resolved:
    - topic: 'PRD scope'
      decision: 'One PRD, two workstreams: (A) automated test coverage incl. E2E, (B) in-app kosztorys replacing sheets. Test automation gates the migration; one roadmap sequences both.'
    - topic: 'Migration depth'
      decision: "Parity + importer, teardown later. In-app editor reaches full sheet parity AND existing investments' sheet data is imported; sheet-sync code removed only after cutover is proven (Phase 3b stays a future change)."
    - topic: 'Primary persona'
      decision: 'The owner (client) feels the sheets pain most, day-to-day.'
    - topic: 'Auth model'
      decision: 'No changes — JWT payload-token cookie and existing four roles preserved.'
    - topic: 'Kosztorys editor access'
      decision: "Same gating as today's kosztorys surfaces: ADMIN/OWNER/MANAGER. No view/edit split."
    - topic: 'Release model'
      decision: 'No piecemeal owner-facing releases. The owner touches the in-app kosztorys only when it is fully functional. Release gate = full parity for NEW investments (no sheet created, nothing synced); importer for existing investments is a later, separate release within the arc. Engineering may merge internal milestones continuously.'
    - topic: 'Parity bar at release'
      decision: 'All four surfaces required: stage progress (etapy), print/PDF export, rooms (pokoje), work catalogue + autocomplete.'
    - topic: 'Timeline'
      decision: '6–8 weeks of regular (not after-hours) work; sustained-effort cost accepted. Recorded as delivery_weeks: 8, after_hours_only: false.'
    - topic: 'First E2E target'
      decision: 'Financial core smoke: login → create transfer → register balance + investment figures update.'
    - topic: 'Must preserve'
      decision: 'Financial integrity (transfers/balances/marża), live kosztorys sheet data (inv 6/31 + any live job) until safely imported, materiały-mirror keeps syncing during transition. Role/access boundaries NOT flagged as an at-risk concern.'
  quality_check_status: accepted
---

# Shape Notes (brownfield)

## Current System

wykonczymy — a business-management dashboard (Next.js + Payload CMS + Postgres) for
cash registers, transfers, investments, and employees. Polish UI, English code.
Roles: ADMIN / OWNER / MANAGER / EMPLOYEE.

The kosztorys (line-item budget + stage progress + per-room measurements + summary)
lives in Google Sheets — 6 tabs per investment. The app owns exactly one tab per
sheet (`wydatki inwestycyjne (tylko do odczytu)`), a one-way materialised mirror of
active `INVESTMENT_EXPENSE` rows (see `context/reference/kosztorys-sync.md`). Everything else is
"sheet land" the owner edits manually. This bridge is explicitly transitional —
the user is "trying to fit the sheets with the data from the app" as a temporary
solution.

Testing today: Vitest unit specs under `src/__tests__`. End-to-end verification is
**manual** — an agent drives Playwright MCP against the dev server and reads sheets
back through the API. Nothing E2E is automated or repeatable in CI.

Prior design work for this change: the POC decision register
`context/changes/kosztorys-poc-in-app/change.md` (on branch `poc-kosztorys-in-app`),
which superseded the deleted 2026-05-28 design draft (D1–D13 + draft schema, now built).

## Vision & Problem Statement

The delta: move the kosztorys fully into the app and retire Google Sheets as a
data surface, and make verification automated instead of agent-driven.

Pain 1 (primary, owner-felt): the owner works across two worlds — sheets for the
kosztorys plan, the app for actuals. Syncing between them is "a crazy pain": stale
mirrors, manual reconciliation, drift the Synchronizuj button has to heal. The
current sheet-fitting work is acknowledged as temporary; the permanent solution is
all sheet functionality executable in-app, with no sheet↔app syncing at all.

Pain 2 (operator-felt): E2E coverage exists only as manual Playwright-MCP sessions.
Every change to financially-sensitive flows requires a hand-driven verification
pass; nothing regression-protects the app automatically. This gap also gates the
migration itself — cutting over the kosztorys without automated end-to-end checks
is high-risk.

This change is **phase 1 of the off-sheets arc**: full functional parity in-app
plus import of existing investments' sheet data. Sheet-sync teardown (Phase 3b in
the spec) is explicitly a later change, triggered once cutover is proven.

## User & Persona

Primary: the **owner** (the client running the finishing business). Non-technical;
today lives in Google Sheets for kosztorys work and in the app for cash/transfer
operations. The moment of pain: planning or updating a kosztorys and needing the
numbers to agree with the app's actuals — currently mediated by a fragile one-way
mirror and manual habits.

### Secondary persona

The **operator/maintainer** (Konrad) — pays the maintenance cost of the Google API
bridge and performs all E2E verification by hand via Playwright MCP.

## Access Control

No changes planned — current model preserved: JWT auth via the `payload-token`
cookie (24h), roles ADMIN / OWNER / MANAGER / EMPLOYEE, hierarchy in
`src/lib/auth/roles.ts`.

The new in-app kosztorys editor (including per-item client prices and both
subcontractor price models) is gated exactly like today's kosztorys surfaces:
ADMIN | OWNER | MANAGER. No view/edit split. EMPLOYEE has no kosztorys access,
unchanged.

## Success Criteria

### Primary

- A newly created investment's kosztorys lives **only in-app** and the owner runs
  its full lifecycle there — sections, items, three price models, stage progress
  (etapy), rooms (pokoje), totals, and print/PDF — with no Google Sheet created
  and no syncing involved.
- E2E verification of the financial core (login → create transfer → register
  balance and investment figures update) runs automated (CI-runnable Playwright),
  replacing manual Playwright-MCP sessions for that flow.

### Secondary

- Authoring a kosztorys in-app is subjectively faster for the owner than it was
  in Sheets.

### Guardrails

- Financial integrity: transfers, register balances, marża/bilans figures stay
  correct — kosztorys work must not touch these write paths.
- Live kosztorys sheet data (inv 6 / inv 31 and any live job) survives untouched
  until safely imported in a later release.
- The materiały-mirror keeps syncing for every investment still on sheets during
  the transition.

## Timeline acknowledgment

Acknowledged on 2026-06-11: 6–8-week delivery (regular working time, not
after-hours); sustained-effort cost accepted. Owner-facing release is gated on
full parity for new investments — no intermediate owner-visible releases.

## Functional Requirements

Socrates round 2026-06-11: every FR was challenged with a domain-specific
counter-argument; the user resolved all 16 as "stands as written". The considered
counter-arguments are recorded per FR for downstream context.

### Kosztorys in-app (workstream B)

- FR-001: Manager+ can create, rename, reorder, and delete kosztorys sections for an investment. Priority: must-have. Change: new
  > Socrates: considered "sections could be a plain item label / catalogue-owned grouping". Stands — per-investment, renameable, orderable sections are core to how the owner organizes a kosztorys.
- FR-002: Manager+ can add, edit inline, reorder, and delete kosztorys items (description, unit, planned qty, measured qty, note). Priority: must-have. Change: new
  > Socrates: considered "dialog-form editing is cheaper than spreadsheet-style inline cells". Stands — inline editing is the parity bar; the owner is replacing a spreadsheet.
- FR-003: Manager+ can record three price models per item and toggle the pricing view (klient / podwykonawca z narzędziami / własne narzędzia). Priority: must-have. Change: new
  > Socrates: considered "only one model may be used in practice / per-item mixing may be needed". Stands — inspection confirmed all three carry real data (spec D7).
- FR-004: Manager+ can manage variable-count stages (etapy) and record per-item, per-stage progress. Priority: must-have. Change: new
  > Socrates: considered "fixed 10 columns simpler / progress could be a later feature". Stands — etapy are how the owner tracks a job; parity without them is not parity.
- FR-005: Manager+ can manage rooms (pokoje) measurements per investment. Priority: must-have. Change: new
  > Socrates: considered "Q7 doubted real usage; could be a calculator inside the item form". Stands — owner uses pokoje; part of the parity bar.
- FR-006: Manager+ can maintain a work catalogue and add items via autocomplete (hand-typing always allowed). Priority: must-have. Change: new
  > Socrates: considered "empty catalogue is dead weight until seeded (Q8); could grow organically from typed items". Stands — master price list required at release.
- FR-007: Owner sees per-row, per-section, and grand totals computed live. Priority: must-have. Change: new
  > Socrates: considered "1000+ row scale risk; server-computed totals safer". Stands — live totals are table-stakes for replacing a spreadsheet.
- FR-008: Owner can print/PDF and CSV-export the kosztorys. Priority: must-have. Change: modified — reuses the existing export layer (`src/lib/export/`: print.tsx, print-iframe.ts, csv.ts); only the kosztorys-shaped render is new.
  > Socrates: considered "client-facing doc may need design beyond browser print; CSV shape for nested data is its own decision". Stands — reuse is why this is cheap; polish later if needed.
- FR-009: New investments get no Google Sheet — their kosztorys exists only in-app, nothing synced. Priority: must-have. Change: modified (was: provision/link a sheet)
  > Socrates: considered "needs an explicit activation moment; owner may want an escape hatch". Stands — a lingering sheet option recreates the two-worlds problem.
- FR-010: Owner can import an existing sheet kosztorys into the app (second release, after the parity release). Priority: must-have. Change: new
  > Socrates: considered "'later' becomes never without a trigger; manual retyping may be cheaper than a 6-tab parser". Stands — second-release importer is the right risk ordering.

### Test automation (workstream A)

- FR-011: Developer/CI can run an automated Playwright E2E suite (no agent-driven MCP sessions). Priority: must-have. Change: new
  > Socrates: considered "the real cost is DB isolation + auth fixtures (local dev points at the real DB); flakiness tax". Stands — manual MCP verification doesn't scale and gates the migration.
- FR-012: The financial-core smoke (login → create transfer → register balance + investment figures update) runs automated. Priority: must-have. Change: new
  > Socrates: considered "transfer hooks (balance recalc, sheet sync) make it slow/flaky; editor might deserve the first test instead". Stands — financial integrity is guardrail #1.
- FR-013: Kosztorys editor flows are E2E-covered before the owner-facing release. Priority: must-have. Change: new
  > Socrates: considered "gate on critical paths only / one manual pass is cheaper". Stands — the owner gets the editor only when it's verified; that's the point of workstream A.

### Preserved (defensive)

- FR-014: The materiały-mirror keeps syncing for investments still on sheets. Change: preserved
  > Socrates: considered "freeze it entirely / mark deprecated from release day". Stands — preserved as-is until teardown.
- FR-015: Transfers, register balances, and marża/bilans computations behave identically. Change: preserved
  > Socrates: considered "make the read/write boundary explicit for future plan-vs-actual joins". Stands as written.
- FR-016: Existing sheet kosztorysy stay accessible (Arkusz view) until imported. Change: preserved
  > Socrates: considered "two-worlds confusion returns; read-only the old sheets post-release". Stands — full sheet workflow for old investments until imported; transition period accepted.

## User Stories

### US-01: Owner runs a new investment's kosztorys fully in-app

- **Given** the parity release has shipped and a Manager+ user creates a new investment
- **When** they open the investment's kosztorys
- **Then** they author it entirely in-app — sections, items with three price models, stage progress, rooms, live totals — and no Google Sheet exists for this investment
- _(Before: a sheet was provisioned/linked per investment and the kosztorys lived there, bridged by a one-way mirror.)_

#### Acceptance Criteria

- No kosztoryses row pointing at a Google Sheet is created for the new investment
- All four parity surfaces work: etapy, pokoje, print/PDF + CSV, catalogue autocomplete
- Totals (row / section / grand) match hand-computed values

### US-02: Financial core is regression-protected automatically

- **Given** the Playwright suite is installed and CI-runnable
- **When** a developer pushes a change touching transfers
- **Then** the automated smoke logs in, creates a transfer, and asserts the register balance and investment figures update — with no agent-driven manual session
- _(Before: E2E verification was a hand-driven Playwright-MCP session per change.)_

#### Acceptance Criteria

- Runs against an isolated test database, never the real local DB
- Red on balance-calculation regression; green run requires no human interaction

## Business Logic

**A kosztorys item's worth is computed, never stored: quantity × its snapshotted
price** — prices copy from the catalogue at item creation and never change
retroactively, and all totals (row / section / stage / grand) derive from that
rule on read.

The rule consumes the quantities the user enters (planned, measured, per-stage
done) and the per-item prices under the selected pricing view; its output is the
live row/section/grand totals the owner sees while editing and in the
printed/exported document. A master-price change in the catalogue affects only
items created afterwards — existing kosztorysy are immutable to it.

Existing domain rules are unchanged: marża = robocizna − wypłaty − rabat − strata,
bilans computation, and register-balance recalculation on transfer create/delete.
Workstream A (test automation) is infrastructure-only: no domain logic change.

## Constraints & Preserved Behavior

- Schema changes are strictly additive (new kosztorys tables); no existing table
  is altered and no data migration of current records is needed at the parity
  release. The importer (second release) reads sheets and writes only the new
  tables.
- The materiały-mirror (one-way INVESTMENT_EXPENSE → sheet sync, incl. its Payload
  collection hooks) must keep working unchanged for investments still on sheets.
- Financial write paths (transfers, balance recalc hooks, marża/bilans SQL) are
  off-limits to this change; future plan-vs-actual views may read
  INVESTMENT_EXPENSE but never write.
- Existing sheet kosztorysy (inv 6 / 31, any live job) keep their full Arkusz
  workflow until imported; their sheet data must survive untouched.
- Auth model and role boundaries are preserved (see Access Control).

## Non-Functional Requirements

- Editing a kosztorys stays fluid at 1000+ items — no perceptible input lag while
  typing, totals update without blocking the user.
- Automated tests leave no trace in the real local database and never write
  through live Google credentials.
- The printed/exported kosztorys is client-presentable as the formal offer
  document, on par with what the sheet produced.
- No regression in existing app responsiveness — current pages stay as fast as
  today after the new collections and queries land.

## Product Framing

- `product_type`: no change — existing web-app.
- `target_scale`: no change — small (owner + small management team); change does
  not open the system to new users.
- `timeline_budget`: `delivery_weeks: 8` (6–8 committed), `hard_deadline: null`,
  `after_hours_only: false` (regular working time).

## Non-Goals

- **No real-time collaborative editing, no multi-currency (PLN only), no
  multi-tenant catalogues** — user-confirmed 2026-06-12; spec §10 exclusions stay
  excluded.
- **No sheet-sync teardown in this change** — carried from the locked "Migration
  depth" decision: mirror/Google code removal is Phase 3b, a later change
  triggered after cutover is proven.
- **No bidirectional sheet↔app sync** — carried from spec D5; the editor never
  reads from or writes to sheets (the one-shot importer excepted).
- **No schema-level customization** — carried from spec D6: no per-investment
  custom columns, JSONB sidecars, or EAV; the note/komentarz field covers ad-hoc
  needs.

## Quality cross-check

Ran 2026-06-12 — all elements present, no gaps:

- Access Control: present
- Business Logic (one-sentence rule): present
- Project artifacts: present
- Timeline-cost acknowledged: present (8 weeks, sustained effort accepted)
- Non-Goals: present
- Preserved behavior (brownfield): present
