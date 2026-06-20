---
project: 'Wykonczymy — off-sheets phase 1'
version: 1
status: draft
created: 2026-06-12
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 8
  hard_deadline: null
  after_hours_only: false
---

# Wykonczymy — off-sheets phase 1

## Current System Overview

wykonczymy is a business-management dashboard for a finishing/renovation business:
cash registers, transfers, investments, and employees. Polish UI, English code.
Architecture: a Next.js App Router application backed by Payload CMS over Postgres,
with role-based access (ADMIN / OWNER / MANAGER / EMPLOYEE).

The **kosztorys** — the per-investment line-item budget (items, sections, stage
progress, per-room measurements, and a summary) — does **not** live in the app
today. It lives in Google Sheets, six tabs per investment. The app owns exactly
one tab per sheet (`wydatki inwestycyjne (tylko do odczytu)`): a one-way
materialised mirror that pushes each active `INVESTMENT_EXPENSE` row into the sheet
so the owner sees actuals next to the plan. Postgres is the source of truth for
that one tab; everything else on the sheet is hand-edited "sheet land" the app
never reads. A manual **Synchronizuj** button heals drift. This mirror is
explicitly transitional — a bridge between "the plan lives in Sheets" and "the
actuals live in the app."

Verification today is split: Vitest unit specs under `src/__tests__` are automated,
but **end-to-end verification is manual** — an operator drives Playwright through
an MCP session against the dev server and reads sheets back through the API.
Nothing E2E is automated or CI-runnable.

Prior design work this PRD builds on:

- `docs/superpowers/specs/2026-05-28-kosztorys-in-app-editor-design.md` — 13 locked
  decisions (D1–D13), a draft six-table data shape, and ten open data-shape
  questions (Q1–Q10).
- `docs/kosztorys-sync.md` — the current mirror's authoritative behaviour.
- `docs/kosztorys-sheet-inspection.md` — tooling that dumped the template's
  structure.

### Key code locations (kosztorys rework reference)

Durable repo pointers salvaged from the POC plan (the POC editor code itself is
throwaway — see the banner in `context/changes/kosztorys-poc-in-app/change.md` — but
these existing-app anchors survive and are the starting point for the MVP rework):

- **Actuals are already queryable, no new ledger queries needed:** `deriveFinancials()`
  (`src/lib/db/sum-transfers.ts:303-322`) → `totalLaborCosts` / `totalPayouts` /
  `totalRabat` / `totalLoss` / materials; `calculateMargin()`
  (`src/lib/calculate-margin.ts:13-14`); assembled like
  `src/app/(frontend)/inwestycje/[id]/page.tsx:44-58`.
- **Mutation skeleton:** `protectedAction()` (`src/lib/actions/utils.ts:44-74`) +
  `revalidateCollections` (`src/lib/cache/revalidate.ts`).
- **Migrations are hand-written** (`migrate:create` broken since March) — pattern (table +
  FK + register in `payload_locked_documents_rels`):
  `src/migrations/20260528_move_sheet_id_to_kosztoryses.ts`; registry `src/migrations/index.ts`.
- **Role gate:** `MANAGEMENT_ROLES` (`src/lib/auth/roles.ts`), `src/access/index.ts`.
- **Zero-dependency print:** `buildPrintHtml` (`src/lib/export/print.tsx:95-107`) +
  `printViaIframe` (`src/lib/export/print-iframe.ts`).
- **Robocizna today = single aggregate `LABOR_COST` transfer** (`src/collections/transfers.ts`);
  the full line-item breakdown lived only in the sheet (now in the POC editor).

## Problem Statement & Motivation

Two pains drive this change.

**Pain 1 (primary, owner-felt).** The owner works across two worlds: Google Sheets
for the kosztorys plan, the app for actuals. Keeping them agreeing is "a crazy
pain" — stale mirrors, manual reconciliation, and drift that a button has to heal.
The work currently in flight (fitting the sheets with app data) is explicitly a
temporary patch. The permanent fix is to make every kosztorys capability executable
inside the app, with no sheet↔app syncing at all.

**Pain 2 (operator-felt, and a gate on Pain 1).** End-to-end coverage exists only
as manual Playwright-MCP sessions. Every change to a financially sensitive flow
needs a hand-driven verification pass, and nothing protects against regressions
automatically. This gap also makes the migration itself risky: cutting the
kosztorys over without automated end-to-end checks on the financial core is
high-risk.

This PRD is **phase 1 of the off-sheets arc**: full in-app parity for new
investments plus (as a second, later release within the same arc) an importer for
existing investments' sheet data. Removing the mirror/Google integration entirely
(Phase 3b in the design spec) is a separate future change, triggered only once
cutover is proven.

## User & Persona

**Primary — the owner** (the client running the finishing business). Non-technical.
Today they live in Google Sheets for kosztorys work and in the app for cash/transfer
operations. Their moment of pain: planning or updating a kosztorys and needing the
numbers to agree with the app's actuals — currently mediated by a fragile one-way
mirror and manual habit. After this change, a new investment's kosztorys is authored
entirely in the app; the two-worlds split disappears for new work.

### Secondary persona

**The operator/maintainer.** Pays the maintenance cost of the Google API bridge and
performs all E2E verification by hand. Their experience changes via workstream A:
automated, CI-runnable E2E replaces hand-driven MCP sessions for the financial core.

## Success Criteria

### Primary

- A newly created investment's kosztorys lives **only in the app**, and the owner
  runs its full lifecycle there — sections, items, three price models, stage
  progress (etapy), totals, and print/PDF — with no Google Sheet
  created and no syncing involved.
- End-to-end verification of the financial core (sign in → create a transfer →
  register balance and investment figures update) runs automated and CI-runnable,
  replacing manual operator-driven sessions for that flow.

### Secondary

- Authoring a kosztorys in the app is subjectively faster for the owner than it
  was in Sheets.

### Guardrails

- **Financial integrity preserved.** Transfers, register balances, and marża/bilans
  figures stay correct; kosztorys work must not touch these write paths.
- **Live sheet data preserved.** Existing kosztorys sheet data (the live jobs)
  survives untouched until it is safely imported in the later release.
- **Mirror keeps working.** The materiały-mirror keeps syncing for every investment
  still on sheets throughout the transition.

## User Stories

### US-01: Owner runs a new investment's kosztorys fully in-app

- **Given** the parity release has shipped and a Manager-or-above user creates a new
  investment
- **When** they open that investment's kosztorys
- **Then** they author it entirely in the app — sections, items with three price
  models, stage progress, and live totals — and no Google Sheet exists for
  this investment
- _(Before: a sheet was provisioned or linked per investment and the kosztorys lived
  there, bridged by a one-way mirror.)_

#### Acceptance Criteria

- No sheet-backed kosztorys record is created for the new investment.
- All parity surfaces work: etapy, print/PDF + spreadsheet export, catalogue autocomplete.
  (pokoje cut — owner 2026-06-20.)
- Totals (row / section / grand) match hand-computed values.

### US-02: Financial core is regression-protected automatically

- **Given** the automated E2E suite is installed and CI-runnable
- **When** a developer pushes a change touching transfers
- **Then** the suite signs in, creates a transfer, and asserts the register balance
  and investment figures update — with no operator-driven manual session
- _(Before: E2E verification was a hand-driven Playwright-MCP session per change.)_

#### Acceptance Criteria

- Runs against an isolated test database, never the real local data.
- Goes red on a balance-calculation regression; a green run requires no human
  interaction.

## Scope of Change

Each item carries its FR id and (where one was recorded during shaping) the
strongest counter-argument considered and its resolution. All sixteen requirements
were challenged and resolved as "stands as written."

### New — kosztorys in-app (workstream B)

- **[new] FR-001** — Manager+ can create, rename, reorder, and delete kosztorys
  sections for an investment.
  > Considered: "sections could be a plain item label / catalogue-owned grouping."
  > Stands — per-investment, renameable, orderable sections are core to how the
  > owner organizes a kosztorys.
- **[new] FR-002** — Manager+ can add, inline-edit, reorder, and delete kosztorys
  items (description, unit, planned qty, measured qty, note).
  > Considered: "dialog-form editing is cheaper than spreadsheet-style inline
  > cells." Stands — inline editing is the parity bar; the owner is replacing a
  > spreadsheet.
- **[new] FR-003** — Manager+ can record three price models per item and toggle the
  pricing view (klient / podwykonawca z narzędziami / własne narzędzia).
  > Considered: "only one model may be used in practice / per-item mixing may be
  > needed." Stands — inspection confirmed all three carry real data.
- **[new] FR-004** — Manager+ can manage variable-count stages (etapy) and record
  per-item, per-stage progress.
  > Considered: "fixed 10 columns is simpler / progress could be a later feature."
  > Stands — etapy are how the owner tracks a job; parity without them is not parity.
- ~~**[new] FR-005** — Manager+ can manage rooms (pokoje) measurements per investment.~~
  > **CANCELLED (owner, 2026-06-20):** pokoje are out of scope. The "pokoje" tab is
  > dropped and will not exist in the app — no rooms table, no item-to-room link.
  > Removes this from the parity bar.
  > **Standing instruction:** rooms MAY resurface in source sheets shown while working on
  > the app (the owner may share a sheet that has pokoje). Treat them as noise — do NOT
  > carry rooms into the app and do NOT re-open the question. The decision is final.
- **[new] FR-006** — Manager+ can maintain a work catalogue and add items via
  autocomplete (hand-typing always allowed).
  > Considered: "an empty catalogue is dead weight until seeded; could grow
  > organically from typed items." Stands — the master price list is required at
  > release.
- **[new] FR-007** — Owner sees per-row, per-section, and grand totals computed
  live.
  > Considered: "scale risk at 1000+ rows; server-computed totals safer." Stands —
  > live totals are table-stakes for replacing a spreadsheet.
- **[new] FR-010** — Owner can import an existing sheet kosztorys into the app
  (delivered in the second release, after the parity release).
  > Considered: "'later' becomes never without a trigger; manual retyping may be
  > cheaper than a parser." Stands — a second-release importer is the right risk
  > ordering. _(Trigger/timing is an open question — see Open Questions.)_

### New — test automation (workstream A)

- **[new] FR-011** — Developer/CI can run an automated end-to-end suite (no
  operator-driven MCP sessions).
  > Considered: "the real cost is test-data isolation + auth fixtures; flakiness
  > tax." Stands — manual verification doesn't scale and gates the migration.
- **[new] FR-012** — The financial-core smoke (sign in → create transfer → register
  balance + investment figures update) runs automated.
  > Considered: "transfer side effects make it slow/flaky; the editor might deserve
  > the first test instead." Stands — financial integrity is guardrail #1.
- **[new] FR-013** — Kosztorys editor flows are end-to-end-covered before the
  owner-facing release.
  > Considered: "gate on critical paths only / one manual pass is cheaper." Stands —
  > the owner gets the editor only when it is verified; that is the point of
  > workstream A.

### Modified

- **[modified] FR-008** — Owner can BOTH print/PDF AND spreadsheet-export the kosztorys —
  both are required, not either/or (owner, 2026-06-20). _(Was: print/PDF and CSV export
  exist for transfers only.)_ Two distinct client-facing moments drive this:
  - **At contract signing** the client usually gets **only a PDF**.
  - **After the work is done** the client gets a **spreadsheet (Excel / Google Sheets)** so
    they can re-verify and recompute the figures themselves.
    > Complication for the spreadsheet export: the app computes figures from **SQL, not from
    > cell formulas**, so a flat value dump can't be re-verified. The export script must
    > **translate app calculations into live spreadsheet formulas** when writing to Sheets/Excel,
    > so the client sees the math, not just the numbers. This is the load-bearing part — the
    > PDF and the value layout are the easy half.
    > **Export security (hard requirement):** the legacy sheets only **hid** the sensitive
    > columns (buy prices, margins, subcontractor prices) — anyone Excel-savvy could unhide
    > them. The app MUST NOT repeat this. Columns/data the client may not see must be
    > **physically removed from the exported file** — not hidden, not protected; simply absent.
    > Applies to both PDF and spreadsheet, and to the formula translation: an exported formula
    > must never reference a value whose column is not in the file.
- **[modified] FR-009** — New investments get no Google Sheet; their kosztorys exists
  only in the app, nothing synced. _(Was: each new investment provisioned or linked
  a sheet.)_
  > Considered: "needs an explicit activation moment; the owner may want an escape
  > hatch." Stands — a lingering sheet option recreates the two-worlds problem.

### Preserved (must not break)

- **[preserved] FR-014** — The materiały-mirror keeps syncing for investments still
  on sheets.
  > Considered: "freeze it entirely / mark it deprecated from release day." Stands —
  > preserved as-is until teardown.
- **[preserved] FR-015** — Transfers, register balances, and marża/bilans
  computations behave identically.
  > Considered: "make the read/write boundary explicit for future plan-vs-actual
  > joins." Stands as written.
- **[preserved] FR-016** — Existing sheet kosztorysy stay accessible (their current
  view) until imported.
  > Considered: "two-worlds confusion returns; the old sheets could go read-only
  > post-release." Stands — old investments keep their full sheet workflow until
  > imported; the transition period is accepted.

### Removed

None in this change. The mirror/Google integration teardown is explicitly deferred
(see Non-Goals).

## Constraints & Compatibility

- **Additive schema only.** New kosztorys tables are added; no existing table is
  altered and no migration of current records is needed at the parity release. The
  importer (second release) reads sheets and writes only the new tables.
- **Mirror untouched.** The one-way actuals mirror (and the Payload collection hooks
  that drive it) must keep working unchanged for investments still on sheets.
- **Financial write paths off-limits.** Transfers, balance-recalculation hooks, and
  marża/bilans calculations are not modified by this change. Future plan-vs-actual
  views may read investment-expense data but never write it.
- **Live sheet data survives.** Existing sheet kosztorysy keep their full current
  workflow until imported; their data must survive untouched.
- **Auth and roles preserved.** The authentication model and role boundaries are
  unchanged (see Access Control Changes).
- **Test isolation.** Automated tests must leave no trace in the real local data and
  must never write through live Google credentials.

## Business Logic Changes

**New rule (added):** a kosztorys item's worth is computed, never stored —
**quantity × its snapshotted price.** Prices are copied from the catalogue at the
moment an item is created and do not change retroactively; all totals (row, section,
stage, grand) are derived from that rule rather than persisted.

The rule consumes the quantities the user enters (planned, measured, per-stage done)
and the per-item price under the selected pricing view. Its output is the live
row/section/grand totals the owner sees while editing and in the printed/exported
document. A later change to a catalogue master price affects only items created
afterwards — existing kosztorysy are immutable to it.

**Existing rules unchanged:** marża = robocizna − wypłaty − rabat − strata, the
bilans computation, and register-balance recalculation on transfer create/delete.

Workstream A (test automation) is infrastructure-only: **no domain-logic change.**

## Access Control Changes

**No access-control changes — current model preserved.** Authentication and the four
roles (ADMIN / OWNER / MANAGER / EMPLOYEE) are unchanged.

The new in-app kosztorys editor — including per-item client prices and both
subcontractor price models — is gated exactly like today's kosztorys surfaces:
ADMIN, OWNER, and MANAGER. There is no view/edit split. EMPLOYEE has no kosztorys
access, unchanged.

## Non-Goals

- **No real-time collaborative editing, no multi-currency (PLN only), no
  multi-tenant catalogues** — confirmed out of scope.
- **No mirror/Google teardown in this change** — removing the integration is a later
  change, triggered only after cutover is proven.
- **No bidirectional sheet↔app sync** — the editor never reads from or writes to
  sheets (the one-shot importer is the only exception).
- **No schema-level customization** — no per-investment custom columns or
  arbitrary-field sidecars; a free-text note field covers ad-hoc needs.

## Open Questions

Resolved during shaping (recorded here for traceability): currency is PLN-only
(non-goal); ~~rooms/pokoje are in scope (FR-005)~~ — **rooms/pokoje CUT, out of scope
(owner 2026-06-20)**; the catalogue is a single shared
list (no multi-tenant). The following were surfaced by the design spec or by shaping
and remain open — they are load-bearing for implementation, not invented gaps.

1. **Per-item discount (rabat).** The sheet has a per-item discount column. Keep it
   as a per-item field, derive it from a catalogue default, or handle it elsewhere?
   — Owner: user. Ref: spec Q1.
2. ~~**VAT.**~~ RESOLVED (owner, 2026-06-20): **one VAT rate per investment** — not per
   section, not per item. Prices entered net; gross computed from the investment rate.
   Ref: spec Q2.
3. **Labour vs. materials shape.** Are labour items and materials one unified item
   list with a kind flag, or separate lists? This also affects whether the
   materiały-mirror can retire sooner. — Owner: user. Ref: spec Q3.
4. **Delete semantics for kosztorys items.** Soft-delete (audit trail) or hard-delete
   (simpler, matches the rest of the app)? — Owner: user. Ref: spec Q4.
5. **Ordering of sections / items / stages.** Drag-to-reorder or by-creation /
   alphabetical? FR-001 and FR-002 assume reorder; confirm the interaction cost is
   accepted. — Owner: user. Ref: spec Q6.
6. **Catalogue seeding.** FR-006 requires the catalogue at release. Hand-type from
   scratch, parse a live sheet once to populate, or start empty and let it grow with
   use? — Owner: user. Ref: spec Q8.
7. ~~**Item-to-room link.**~~ RESOLVED (owner, 2026-06-20): moot — pokoje cut entirely
   (FR-005 cancelled). No rooms, no item-to-room link. Ref: spec Q10.
8. **Importer trigger (FR-010).** What concretely triggers the second-release
   importer, so "later" does not become "never"? Name a condition or date. — Owner:
   user.
