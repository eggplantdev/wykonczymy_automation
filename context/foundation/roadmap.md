<!--  -->---

project: 'Wykonczymy — off-sheets phase 1'
version: 1
status: draft
created: 2026-06-12
updated: 2026-06-12
prd_version: 1
main_goal: quality
top_blocker: none

---

# Roadmap: Wykonczymy — off-sheets phase 1

> Derived from `context/foundation/prd.md` (v1) + probed codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Where work is tracked

- **`roadmap.md` (this file) — source of truth for slices:** the v2 arc (`F-`/`S-` slices) + their `Status`, in the [At a glance](#at-a-glance) table. Dependency order, what to build next.
- **Linear "Wykonczymy v2" — live status + the ONLY home for ad-hoc todos:** mirrors slice status (flip to Done at archive) and holds every smaller / one-off task. No second todo file. Reality-check Linear access first (see AGENTS.md).
- **`context/reference/tech-debt-backlog.md`** — refactor / cleanup / known-bugs backlog (judgment-heavy, not PRD slices).

## Vision recap

The kosztorys (per-investment line-item budget: sections, items, three price
models, stage progress, room measurements, totals) lives in Google Sheets today,
bridged to the app by a fragile one-way mirror. This phase moves the kosztorys
**fully into the app** for new investments and retires the sheet as a data surface,
while making end-to-end verification of the financial core **automated** instead of
hand-driven. Two workstreams run in parallel: (A) a test-automation harness that
gates the migration, (B) the in-app kosztorys editor that replaces sheets.

The release gate is **full parity for new investments** — a newly created
investment gets no Google Sheet and its kosztorys is authored entirely in the app.
Importing existing sheet data and tearing down the Google integration are later,
separate releases within the same arc.

## North star

**S-01: Owner authors a kosztorys's sections and items in-app with live totals** —
this is the validation milestone because it is the first owner-visible proof that
the spreadsheet can be replaced by the app at all; everything else in workstream B
is parity polish on top of it.

> North star here means the smallest end-to-end slice whose successful delivery
> would prove the core product hypothesis (kosztorys can live in the app, not
> Sheets) — placed as early as Prerequisites allow because the rest of the editor
> only matters if this works.

## At a glance

| ID   | Change ID                | Outcome (user can …)                                             | Prerequisites                            | PRD refs                      | Status   |
| ---- | ------------------------ | ---------------------------------------------------------------- | ---------------------------------------- | ----------------------------- | -------- |
| F-01 | e2e-harness              | (foundation) Playwright E2E harness, CI-runnable, isolated DB    | —                                        | FR-011                        | ready    |
| S-01 | kosztorys-sections-items | author kosztorys sections + items in-app with live totals        | —                                        | FR-001, FR-002, FR-007, US-01 | ready    |
| S-02 | financial-core-smoke     | trust an automated smoke that transfers update balances/figures  | F-01                                     | FR-012, FR-011, FR-015, US-02 | proposed |
| S-03 | kosztorys-price-models   | record three price models per item and toggle the pricing view   | S-01                                     | FR-003                        | proposed |
| S-04 | kosztorys-stages         | manage stages (etapy) and record per-item, per-stage progress    | S-01                                     | FR-004                        | proposed |
| S-05 | kosztorys-rooms          | manage room (pokoje) measurements per investment                 | S-01                                     | FR-005                        | proposed |
| S-06 | kosztorys-catalogue      | maintain a work catalogue and add items via autocomplete         | S-01                                     | FR-006                        | proposed |
| S-07 | kosztorys-export         | print/PDF and CSV-export the kosztorys                           | S-01                                     | FR-008                        | proposed |
| S-08 | editor-e2e-coverage      | (gate) rely on automated E2E over the editor before release      | F-01, S-01, S-03, S-04, S-05, S-06, S-07 | FR-013                        | proposed |
| S-09 | new-investment-no-sheet  | create a new investment with no Google Sheet, kosztorys app-only | S-01, S-03, S-04, S-05, S-06, S-07, S-08 | FR-009, FR-014, FR-016, US-01 | proposed |
| S-10 | kosztorys-importer       | import an existing sheet kosztorys into the app                  | S-09                                     | FR-010, FR-016                | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                   | Chain                                                          | Note                                                                                        |
| ------ | ----------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A      | Test automation         | `F-01` → `S-02` → `S-08`                                       | Quality bias sequences the harness first; `S-08` also joins Stream B (needs editor slices). |
| B      | Kosztorys editor parity | `S-01` → `S-03` / `S-04` / `S-05` / `S-06` / `S-07` (parallel) | North star `S-01` heads the owner-facing track; the four follow-ons run in parallel.        |
| C      | Cutover & import        | `S-09` → `S-10`                                                | `S-09` is the release gate — joins Stream A at `S-08` and Stream B at `S-07`.               |

## Baseline

What's already in place in the codebase as of 2026-06-12 (probed + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js App Router, Tailwind v4, Shadcn UI, React Compiler (`src/app/(frontend)`, `src/components/ui`).
- **Backend / API:** present — Payload CMS collections + server actions via `protectedAction()` (`src/collections`, `src/lib/actions`).
- **Data:** present — Postgres (Neon prod / docker local on 5433), Payload migrations, raw SQL via `@vercel/postgres` (`src/lib/db`, `src/migrations`).
- **Auth:** present — JWT `payload-token` cookie, four roles (ADMIN/OWNER/MANAGER/EMPLOYEE) (`src/lib/auth`, `src/access`).
- **Deploy / infra:** present — Vercel (build runs `generate:types` + `payload migrate` + `next build`).
- **Observability:** partial — `perfStart()` perf logging only; no error tracking (`global-error.tsx` has no reporter). Out of scope for this phase.
- **Test / E2E:** absent — Vitest unit specs under `src/__tests__` only; no `playwright.config.*`, no `@playwright/test`, no `test:e2e` script. → workstream A (F-01).
- **In-app kosztorys editor:** absent — kosztorys is Google-Sheet-backed: the `kosztoryses` collection holds a sheet id, UI is `iframe-view.tsx` + a one-way `INVESTMENT_EXPENSE` mirror + sync button (`src/collections/sheets.ts`, `src/components/sheets`). → workstream B (S-01+).

## Foundations

### F-01: E2E test harness

- **Outcome:** (foundation) a Playwright harness is installed and CI-runnable against an isolated test database, with an auth fixture and one green smoke spec; no operator-driven MCP session required to run it.
- **Change ID:** e2e-harness
- **PRD refs:** FR-011
- **Unlocks:** S-02 (financial-core smoke), S-08 (editor E2E coverage), and the FR-013 release gate; reduces the migration-risk guardrail by giving the financial core automated regression protection.
- **Prerequisites:** —
- **Parallel with:** S-01 (the editor north star has no dependency on the harness).
- **Blockers:** —
- **Unknowns:**
  - Test-data isolation strategy — self-seed unique per-run data against the dump-restored docker DB (the tech-debt note proposes copying the working `playwright.config.ts` from `/Users/konradantonik/workspace/10x_devs`). — Owner: team. Block: no.
- **Risk:** Sequenced first under the quality bias because every E2E slice depends on it and the financial core is guardrail #1. Risk: a flaky harness erodes trust in the suite — keep the first spec minimal and deterministic.
- **Status:** ready

## Slices

### S-01: Kosztorys sections + items (north star)

- **Outcome:** a Manager+ user can create, rename, reorder, and delete kosztorys sections, and add, inline-edit, reorder, and delete items (description, unit, planned qty, measured qty, note) under them, seeing live row / section / grand totals as they edit.
- **Change ID:** kosztorys-sections-items
- **PRD refs:** FR-001, FR-002, FR-007, US-01
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - Labour vs. materials shape — one unified item list with a kind flag, or separate lists? (PRD Q3 / spec Q3). Load-bearing for the item schema; resolve before the table lands. — Owner: user. Block: no.
  - Delete semantics — soft-delete (audit) vs hard-delete (matches the rest of the app)? (PRD Q4). — Owner: user. Block: no.
  - Reorder interaction — drag-to-reorder vs by-creation/alphabetical? (PRD Q5). — Owner: user. Block: no.
  - Totals need a price to compute — S-01 carries a single per-item price (snapshotted from catalogue/typed value); the three price models arrive in S-03. Confirm a single model is acceptable for the first slice. — Owner: user. Block: no.
- **Risk:** Introduces the additive kosztorys tables (sections, items) and the "worth = qty × snapshotted price, totals derived" rule. Additive-only — must not touch transfers/balance/marża write paths (FR-015). Risk: inline-edit + live totals at 1000+ rows is the hard UX/perf problem; the spreadsheet parity bar is high.
- **Status:** ready

### S-02: Financial-core smoke spec

- **Outcome:** a developer/CI run signs in, creates a transfer, and asserts the register balance and investment figures update — automated, no human interaction, replacing the manual Playwright-MCP session for that flow.
- **Change ID:** financial-core-smoke
- **PRD refs:** FR-012, FR-011, FR-015, US-02
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-03, S-04, S-05, S-06, S-07 (independent of all editor work)
- **Blockers:** —
- **Unknowns:**
  - Transfer side effects (register recalculation hooks) make the spec slower/heavier — confirm the seed + assertion shape keeps it deterministic. — Owner: team. Block: no.
- **Risk:** This is the operator-facing payoff of workstream A and the regression guard for guardrail #1 (financial integrity). Risk: asserting the action's return value instead of persisted balances would hide a failed write — assert observable state.
- **Status:** proposed

### S-03: Three price models + pricing-view toggle

- **Outcome:** a Manager+ user can record three price models per item (klient / podwykonawca z narzędziami / własne narzędzia) and toggle which model the kosztorys view and totals use.
- **Change ID:** kosztorys-price-models
- **PRD refs:** FR-003
- **Prerequisites:** S-01
- **Parallel with:** S-04, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - VAT — per-item VAT rate, single net model, or net + a global gross flag? Matters if the kosztorys is the formal client offer. (PRD Q2). — Owner: user. Block: no.
  - Per-item discount (rabat) — keep the sheet's per-item discount column, derive from a catalogue default, or handle elsewhere? (PRD Q1). — Owner: user. Block: no.
- **Risk:** Extends the item price from one snapshotted value (S-01) to three; totals must recompute under the selected view. Risk: snapshot semantics — a later catalogue price change must not retroactively alter existing items.
- **Status:** proposed

### S-04: Stage progress (etapy)

- **Outcome:** a Manager+ user can manage a variable number of stages (etapy) and record per-item, per-stage progress.
- **Change ID:** kosztorys-stages
- **PRD refs:** FR-004
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-05, S-06, S-07
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Adds a stages table + per-item-per-stage progress join keyed off S-01's items. Variable stage count (not fixed 10 columns) is the parity requirement. Risk: progress totals interacting with the live-totals rule from S-01.
- **Status:** proposed

### S-05: Rooms (pokoje) measurements

- **Outcome:** a Manager+ user can manage room (pokoje) measurements per investment.
- **Change ID:** kosztorys-rooms
- **PRD refs:** FR-005
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-07
- **Blockers:** —
- **Unknowns:**
  - Item-to-room link — does an item carry an optional room link in this phase, or is that deferred? (PRD Q7 / spec Q10). — Owner: user. Block: no.
- **Risk:** Adds a rooms table. Risk: if items link to rooms (Q7), this couples back to S-01's item schema — resolve the link question before building to avoid a follow-up migration.
- **Status:** proposed

### S-06: Work catalogue + autocomplete

- **Outcome:** a Manager+ user can maintain a work catalogue (master price list) and add kosztorys items via autocomplete, with hand-typing always allowed.
- **Change ID:** kosztorys-catalogue
- **PRD refs:** FR-006
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-05, S-07
- **Blockers:** —
- **Unknowns:**
  - Catalogue seeding — hand-type from scratch, parse a live sheet once to populate, or start empty and grow with use? Required at release. (PRD Q6 / spec Q8). — Owner: user. Block: no.
- **Risk:** Adds the catalogue table that S-01 items snapshot their price from. Risk: an empty catalogue is dead weight at release; the seeding decision gates whether this slice ships usefully.
- **Status:** proposed

### S-07: Print/PDF + CSV export

- **Outcome:** the owner can print/PDF and CSV-export the kosztorys.
- **Change ID:** kosztorys-export
- **PRD refs:** FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-05, S-06
- **Blockers:** —
- **Unknowns:**
  - CSV shape for nested data (sections → items → stages) — flatten how? — Owner: user. Block: no.
- **Risk:** Reuses the existing export infrastructure (transfers already print/PDF + CSV); only the kosztorys-shaped render is new — which is why this is cheap. Risk: the client-facing document may need design beyond browser print; polish is deferred.
- **Status:** proposed

### S-08: Editor E2E coverage (release gate)

- **Outcome:** the kosztorys editor flows are end-to-end-covered by the automated suite before the owner-facing release — sections/items/pricing/stages/rooms/catalogue/export exercised without a manual pass.
- **Change ID:** editor-e2e-coverage
- **PRD refs:** FR-013
- **Prerequisites:** F-01, S-01, S-03, S-04, S-05, S-06, S-07
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the quality gate that lets the owner touch the editor only once it is verified — the whole point of workstream A. Risk: if editor slices land faster than their specs, coverage lags and the gate slips; keep specs close behind each editor slice.
- **Status:** proposed

### S-09: New investments get no Google Sheet (cutover gate)

- **Outcome:** creating a new investment provisions no Google Sheet and nothing is synced; its kosztorys exists only in the app, authored through the editor.
- **Change ID:** new-investment-no-sheet
- **PRD refs:** FR-009, FR-014, FR-016, US-01
- **Prerequisites:** S-01, S-03, S-04, S-05, S-06, S-07, S-08
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Escape hatch — does the owner ever want to opt a new investment back to a sheet, or is the cutover absolute? PRD resolved "stands as written" (no lingering sheet option); confirm at cutover. — Owner: user. Block: no.
- **Risk:** The release gate — only flips once full parity (S-01..S-07) is built and E2E-covered (S-08). Guardrail: the materiały-mirror must keep syncing for investments still on sheets (FR-014), and existing sheet kosztorysy stay accessible (FR-016). Risk: a half-built editor behind this flag recreates the two-worlds problem.
- **Status:** proposed

### S-10: Importer for existing sheet kosztorysy

- **Outcome:** the owner can import an existing sheet kosztorys into the app, writing only the new kosztorys tables.
- **Change ID:** kosztorys-importer
- **PRD refs:** FR-010, FR-016
- **Prerequisites:** S-09
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Importer trigger — what concretely triggers this second-release importer so "later" does not become "never"? Name a condition or date. (PRD Q8). — Owner: user. Block: no.
- **Risk:** Second release within the arc, after parity is proven. Reads sheets, writes only new tables (additive). Guardrail: live sheet data must survive untouched until safely imported (FR-016). Risk: without a named trigger this slips indefinitely — resolve the trigger question before planning.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                | Suggested issue title                                      | Ready for `/10x-plan` | Notes                                                |
| ---------- | ------------------------ | ---------------------------------------------------------- | --------------------- | ---------------------------------------------------- |
| F-01       | e2e-harness              | Stand up Playwright E2E harness (CI-runnable, isolated DB) | yes                   | Run `/10x-plan e2e-harness`                          |
| S-01       | kosztorys-sections-items | In-app kosztorys: sections + items with live totals        | yes                   | North star. Run `/10x-plan kosztorys-sections-items` |
| S-02       | financial-core-smoke     | Financial-core E2E smoke (transfer → balances update)      | no                    | After F-01                                           |
| S-03       | kosztorys-price-models   | Kosztorys: three price models + pricing-view toggle        | no                    | After S-01                                           |
| S-04       | kosztorys-stages         | Kosztorys: stage progress (etapy)                          | no                    | After S-01                                           |
| S-05       | kosztorys-rooms          | Kosztorys: room (pokoje) measurements                      | no                    | After S-01                                           |
| S-06       | kosztorys-catalogue      | Kosztorys: work catalogue + autocomplete                   | no                    | After S-01                                           |
| S-07       | kosztorys-export         | Kosztorys: print/PDF + CSV export                          | no                    | After S-01; reuses export infra                      |
| S-08       | editor-e2e-coverage      | E2E coverage of the kosztorys editor (release gate)        | no                    | After F-01 + editor slices                           |
| S-09       | new-investment-no-sheet  | New investments: no Google Sheet, kosztorys app-only       | no                    | Cutover gate; after parity + S-08                    |
| S-10       | kosztorys-importer       | Import existing sheet kosztorysy into the app              | no                    | Second release; after S-09                           |

This table is the clean handoff to Linear/Jira or any MCP-backed backlog. One row per F-NN and S-NN.

## Open Roadmap Questions

These are the PRD's open questions, carried verbatim. The user called the top blocker
`none` — they ride as non-blocking, but several are load-bearing for the slice they sit
under and are best resolved before that slice is planned. Per-slice context lives in each
slice's Unknowns.

1. **Per-item discount (rabat).** Per-item field, catalogue default, or handled elsewhere? — Owner: user. Gates: S-03 (spec Q1).
2. **VAT.** Per-item VAT rate, single net model, or net + global gross flag? — Owner: user. Gates: S-03 (spec Q2).
3. **Labour vs. materials shape.** Unified item list with a kind flag, or separate lists? Also affects when the materiały-mirror can retire. — Owner: user. Gates: S-01 (spec Q3).
4. **Delete semantics for kosztorys items.** Soft-delete (audit) or hard-delete? — Owner: user. Gates: S-01 (spec Q4).
5. **Ordering of sections / items / stages.** Drag-to-reorder or by-creation/alphabetical? — Owner: user. Gates: S-01, S-04 (spec Q6).
6. **Catalogue seeding.** Hand-type, parse a live sheet once, or start empty and grow? — Owner: user. Gates: S-06 (spec Q8).
7. **Item-to-room link.** Optional room link per item in this phase, or deferred? — Owner: user. Gates: S-05 (spec Q10).
8. **Importer trigger (FR-010).** What concretely triggers the second-release importer? — Owner: user. Gates: S-10.

## Parked

Lifted from PRD `## Non-Goals` — explicitly out of scope for this arc.

- **Mirror / Google integration teardown** — Why parked: removing the integration (design-spec Phase 3b) is a later change, triggered only after cutover is proven.
- **Bidirectional sheet ↔ app sync** — Why parked: the editor never reads from or writes to sheets; the one-shot importer (S-10) is the only exception.
- **Real-time collaborative editing** — Why parked: PRD non-goal.
- **Multi-currency** — Why parked: PLN only, confirmed non-goal.
- **Multi-tenant catalogues** — Why parked: single shared catalogue; PRD non-goal.
- **Schema-level customization** (per-investment custom columns / arbitrary-field sidecars) — Why parked: a free-text note field covers ad-hoc needs; PRD non-goal.
- **Observability / error tracking** — Why parked: baseline is perf-logging only; wiring a reporter (Sentry/structured) is out of scope for this phase (tracked in `docs/tech-debt-backlog.md`).

## Done

(Empty on first generation. `/10x-archive` appends here when a change whose Change ID matches a roadmap item is archived.)
