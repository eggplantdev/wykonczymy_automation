---
project: 'Wykonczymy — off-sheets phase 1'
version: 1
status: draft
created: 2026-06-12
updated: 2026-07-08
prd_version: 1
main_goal: quality
top_blocker: none
---

# Roadmap: Wykonczymy — off-sheets phase 1

> Derived from `context/foundation/prd.md` (v1) + probed codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

> **Reconciled with the POC (2026-07-08).** This roadmap was written 2026-06-12, before the
> in-app-editor POC (branch `poc-kosztorys-in-app`) built and settled the shape. The slice list
> below now reflects that: **S-05 rooms is cut** (pokoje out of scope), **S-10 importer is
> deferred** to a post-MVP band, and **S-11 subcontractor-pricing / S-12 VAT / S-13 undo /
> S-14 column-locking / S-15 hardening** are added as own slices. The two-mode discount folds
> into S-01; robocizna netto/brutto into S-01/S-03. Full rationale + the POC decisions +
> owner's four calls: **`context/changes/kosztorys-mvp/change.md`**.

## Where work is tracked

- **`roadmap.md` (this file) — source of truth for slices:** the v2 arc (`F-`/`S-` slices) + their `Status`, in the [At a glance](#at-a-glance) table. Dependency order, what to build next.
- **Linear "Wykonczymy" — live status + the ONLY home for ad-hoc todos:** mirrors slice status (flip to Done at archive) and holds every smaller / one-off task. No second todo file. Reality-check Linear access first (see AGENTS.md).
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

One row per F-NN / S-NN — the index and the backlog handoff in one place. **Plan-ready** = ready to feed into `/10x-plan` now (prerequisites met and no blocking open decision); `no` means blocked, `—` means n/a (cut / deferred). Run a ready slice with `/10x-plan <change-id>`.

| ID       | Change ID                       | Outcome (user can …)                                                      | Prerequisites                                              | PRD refs                      | Status    | Plan-ready |
| -------- | ------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------- | --------- | ---------- |
| F-01     | e2e-harness                     | (foundation) Playwright E2E harness, CI-runnable, isolated DB             | —                                                          | FR-011                        | ready     | yes        |
| S-01     | kosztorys-sections-items        | author kosztorys sections + items in-app with live totals                 | —                                                          | FR-001, FR-002, FR-007, US-01 | in review | —          |
| S-02     | financial-core-smoke            | trust an automated smoke that transfers update balances/figures           | F-01                                                       | FR-012, FR-011, FR-015, US-02 | deferred  | —          |
| S-03     | kosztorys-price-models          | record three price models per item and toggle the pricing view            | S-01                                                       | FR-003                        | proposed  | no         |
| S-04     | kosztorys-stages                | manage stages (etapy) and record per-item, per-stage progress             | S-01                                                       | FR-004                        | proposed  | no         |
| ~~S-05~~ | ~~kosztorys-rooms~~             | ~~room (pokoje) measurements~~ — **CUT** (pokoje out of scope)            | —                                                          | ~~FR-005~~                    | cut       | —          |
| S-06     | kosztorys-catalogue             | maintain a work catalogue and add items via autocomplete                  | S-01                                                       | FR-006                        | proposed  | no         |
| S-16     | kosztorys-preset                | seed a new kosztorys from a preset; save a kosztorys as a preset          | S-01                                                       | — (owner request)             | proposed  | no         |
| S-07     | kosztorys-export                | CSV-export the kosztorys (WYSIWYG snapshot; no print/PDF)                 | S-01                                                       | FR-008                        | proposed  | no         |
| S-11     | kosztorys-subcontractor-pricing | price subcontractor work via markup coefficient + per-item override       | S-01, S-03                                                 | — (POC)                       | proposed  | no         |
| S-12     | kosztorys-vat                   | set VAT per investment; enter net, compute gross                          | S-01                                                       | — (POC)                       | proposed  | no         |
| S-13     | kosztorys-undo                  | undo the last editor edit(s)                                              | S-01                                                       | — (POC)                       | proposed  | no         |
| S-14     | kosztorys-column-locking        | lock / pin editor columns                                                 | S-01                                                       | — (POC)                       | proposed  | no         |
| S-08     | editor-e2e-coverage             | (gate) rely on automated E2E over the editor before release               | F-01, S-01, S-03, S-04, S-06, S-07, S-11, S-12, S-13, S-14 | FR-013                        | proposed  | no         |
| S-15     | kosztorys-hardening             | quality / perf / a11y hardening pass before cutover                       | S-08                                                       | — (POC)                       | proposed  | no         |
| S-09     | new-investment-no-sheet         | create a new investment with no Google Sheet, kosztorys app-only          | S-08, S-15                                                 | FR-009, FR-014, FR-016, US-01 | proposed  | no         |
| S-10     | kosztorys-importer              | import an existing sheet kosztorys into the app — **DEFERRED** (post-MVP) | S-09                                                       | FR-010, FR-016                | deferred  | —          |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                   | Chain                                                                                              | Note                                                                                                             |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A      | Test automation         | `F-01` → `S-02` → `S-08`                                                                           | Quality bias sequences the harness first; `S-08` also joins Stream B (needs editor slices).                      |
| B      | Kosztorys editor parity | `S-01` → `S-03` / `S-04` / `S-06` / `S-07` / `S-11` / `S-12` / `S-13` / `S-14` / `S-16` (parallel) | North star `S-01` heads the owner-facing track; the parity follow-ons run in parallel. `S-11` also needs `S-03`. |
| C      | Cutover & import        | `S-08` → `S-15` → `S-09` → `S-10`                                                                  | `S-09` is the release gate — after the E2E gate (`S-08`) and hardening (`S-15`). `S-10` deferred.                |

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
- **In-app kosztorys editor:** absent on `main` — kosztorys is Google-Sheet-backed: the `kosztoryses` collection holds a sheet id, UI is `iframe-view.tsx` + a one-way `INVESTMENT_EXPENSE` mirror + sync button (`src/collections/sheets.ts`, `src/components/sheets`). → workstream B (S-01+). **A working POC exists on branch `poc-kosztorys-in-app`** (react-datasheet-grid editor + tested `calc.ts`/`v2-rows.ts` core + `kosztorys_sections/items/stages/stage_progress` schema) — the MVP ports its tested core, not its editor/migrations. See `context/changes/kosztorys-mvp/change.md`.

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
- **Folded from POC (settled, not open):** unified item list (materials = `INVESTMENT_EXPENSE`, no separate table); **hard-delete**; reorder via ▲▼ arrows with a `display_order` layer (DnD later would need sparse keys); **przedmiar + pomiar = two independent columns**, value computed from pomiar; **two-mode discount** (`discount_type ∈ {percent, amount}` + `discount_value`); values **computed, not stored** (only inputs persist). The Unknowns above are largely answered by these — carry the POC's shape.
- **Risk:** Introduces the additive kosztorys tables (sections, items) and the "worth = qty × snapshotted price, totals derived" rule. Additive-only — must not touch transfers/balance/marża write paths (FR-015). Risk: inline-edit + live totals at 1000+ rows is the hard UX/perf problem; the spreadsheet parity bar is high.
- **Status:** in review — implemented on branch `kosztorys-sections-items` (change.md `implemented`, 2026-07-08), PR pending. Not `done` until shipped: prod migration + manual-verification rows outstanding; `/10x-archive` flips it to `done` at cutover.

### S-02: Financial-core smoke spec

- **Outcome:** a developer/CI run signs in, creates a transfer, and asserts the register balance and investment figures update — automated, no human interaction, replacing the manual Playwright-MCP session for that flow.
- **Change ID:** financial-core-smoke
- **PRD refs:** FR-012, FR-011, FR-015, US-02
- **Prerequisites:** F-01
- **Parallel with:** all editor slices (S-01, S-03, S-04, S-06, S-07, S-11–S-14) — independent of all editor work
- **Blockers:** —
- **Unknowns:**
  - Transfer side effects (register recalculation hooks) make the spec slower/heavier — confirm the seed + assertion shape keeps it deterministic. — Owner: team. Block: no.
- **Risk:** This is the operator-facing payoff of workstream A and the regression guard for guardrail #1 (financial integrity). Risk: asserting the action's return value instead of persisted balances would hide a failed write — assert observable state.
- **Status:** deferred — blocks no editor slice (Stream A only); parked 2026-07-09 to keep momentum on the editor parity track (S-03+). F-01 harness + the two existing transfer specs cover the flow in the interim; pick back up before S-08. Safe to defer only while editor slices stay additive and don't touch transfer/balance/marża write paths (FR-015).

### S-03: Three price models + pricing-view toggle

- **Outcome:** a Manager+ user can record three price models per item (klient / podwykonawca z narzędziami / własne narzędzia) and toggle which model the kosztorys view and totals use.
- **Change ID:** kosztorys-price-models
- **PRD refs:** FR-003
- **Prerequisites:** S-01
- **Parallel with:** S-04, S-06, S-07, S-11, S-12, S-13, S-14
- **Blockers:** —
- **Scope note (POC):** S-03 is the **"one dataset, three views"** price-column toggle
  (Robocizna / z narzędziami / bez narzędzi) over one item set. The _derivation_ of the two
  subcontractor prices moved to **S-11** (coefficient + override, replacing the old three
  snapshot columns); VAT moved to **S-12**; per-item discount folded into **S-01**.
- **Resolved by POC:** robocizna netto vs brutto is **derived from the client billing context**
  (B2B? 23% vs 8%), tied to S-12's per-investment VAT rate — a determined rule, not an open
  question.
- **Risk:** Extends the item price from one snapshotted value (S-01) to three views; totals must recompute under the selected view. Risk: snapshot semantics — a later catalogue price change must not retroactively alter existing items. dsg gotcha: the active view must be in the grid remount key (POC bug, see `lessons.md`).
- **Status:** proposed

### S-04: Stage progress (etapy)

- **Outcome:** a Manager+ user can manage a variable number of stages (etapy) and record per-item, per-stage progress.
- **Change ID:** kosztorys-stages
- **PRD refs:** FR-004
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-06, S-07, S-11, S-12, S-13, S-14
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Adds a stages table + per-item-per-stage progress join keyed off S-01's items. Variable stage count (not fixed 10 columns) is the parity requirement. Risk: progress totals interacting with the live-totals rule from S-01.
- **Status:** proposed

### ~~S-05: Rooms (pokoje) measurements~~ — CUT

- **CUT (2026-07-08):** pokoje are out of scope (owner, POC 2026-06-20). The POC's
  `kosztorys_rooms` table is a dead orphan — do not build. Room-measurement formulas were
  recognised during the POC but parked; revive only via a new change (see
  `context/changes/kosztorys-mvp/change.md`).
- **Outcome (dropped):** a Manager+ user can manage room (pokoje) measurements per investment.
- **Change ID:** kosztorys-rooms
- **Status:** cut

### S-06: Work catalogue + autocomplete

- **Outcome:** a Manager+ user can maintain a work catalogue (master price list) and add kosztorys items via autocomplete, with hand-typing always allowed.
- **Change ID:** kosztorys-catalogue
- **PRD refs:** FR-006
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-07, S-11, S-12, S-13, S-14
- **Blockers:** —
- **Unknowns:**
  - Catalogue seeding — hand-type from scratch, parse a live sheet once to populate, or start empty and grow with use? Required at release. (PRD Q6 / spec Q8). — Owner: user. Block: no.
- **Risk:** Adds the catalogue table that S-01 items snapshot their price from. Risk: an empty catalogue is dead weight at release; the seeding decision gates whether this slice ships usefully.
- **Status:** proposed

### S-07: CSV export

- **Outcome:** the owner can CSV-export the kosztorys. **Print/PDF is out of MVP scope** (POC, 2026-07-08) — the client-facing document polish is deferred; CSV is the release bar.
- **Change ID:** kosztorys-export
- **PRD refs:** FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-11, S-12, S-13, S-14
- **Blockers:** —
- **Unknowns:**
  - CSV shape for nested data (sections → items → stages) — flatten how? — Owner: user. Block: no.
- **Risk:** Reuses the existing export infrastructure (transfers already CSV-export); only the kosztorys-shaped render is new — which is why this is cheap.
- **Status:** proposed

### S-16: Kosztorys presets (templates)

- **Outcome:** a Manager+ user can (a) seed a new kosztorys from a preset — a reusable skeleton of sekcje + prace + prices — instead of starting blank, and (b) save an existing kosztorys back as a preset. Restores the legacy Sheets behaviour (`KOSZTORYS_TEMPLATE_SHEET_ID` seeded new sheets from a template) that the in-app editor dropped in S-01 — a parity gap the original roadmap never captured.
- **Change ID:** kosztorys-preset
- **PRD refs:** — (owner request, 2026-07-09; not in the original PRD)
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-07, S-11, S-12, S-13, S-14
- **Blockers:** —
- **Settled shape (owner, 2026-07-09):**
  - A preset = a kosztorys with the job-specific fields stripped. **Keep:** sekcje (structure), prace (opis), J.m., prices, coefficients/overrides. **Reset:** przedmiar/pomiar (amounts), rabat (discount), stage progress (S-04), note, hiddenInExport.
  - **Snapshot pricing throughout.** Catalogue and preset prices are _seed-defaults only_ — copied in as an initial value, then owned/overwritable per item. Never a live source of truth. Rationale: the same work costs differently investment-to-investment (different team → different price), so a centralised/live price is wrong. This mirrors the PRD's catalogue snapshot rule (a later master-price change never touches existing items) and extends it to presets.
  - **Decouples from S-06.** Because the preset embeds its own frozen prices, it needs no live catalogue at instantiation — this slice can ship independent of S-06. Any catalogue link is for autocomplete/traceability only, never pricing.
- **Open (decision 9):** one global default preset vs a named library picked at create-time (owner leans library — "selecting from presets", plural). — Owner: user. Block: no.
- **Open (decision 10):** save-as behaviour — always save-as-new vs overwrite an existing preset; and retroactivity (recommendation: kosztorysy already spawned from a preset stay frozen when the preset is later edited — same snapshot rule). — Owner: user. Block: no.
- **Risk:** Overlaps S-06 conceptually (both are "reuse") but is a distinct data model — preset carries _structure_ (sekcje → prace), the catalogue is a _flat_ price list. Risk: letting a catalogue link become a live price authority reintroduces the centralisation the owner explicitly rejected. Keep prices embedded + overwritable.
- **Status:** proposed

### S-08: Editor E2E coverage (release gate)

- **Outcome:** the kosztorys editor flows are end-to-end-covered by the automated suite before the owner-facing release — sections/items/pricing/stages/subcontractor-pricing/VAT/undo/column-locking/catalogue/export exercised without a manual pass.
- **Change ID:** editor-e2e-coverage
- **PRD refs:** FR-013
- **Prerequisites:** F-01, S-01, S-03, S-04, S-06, S-07, S-11, S-12, S-13, S-14
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the quality gate that lets the owner touch the editor only once it is verified — the whole point of workstream A. Risk: if editor slices land faster than their specs, coverage lags and the gate slips; keep specs close behind each editor slice.
- **Status:** proposed

### S-09: New investments get no Google Sheet (cutover gate)

- **Outcome:** creating a new investment provisions no Google Sheet and nothing is synced; its kosztorys exists only in the app, authored through the editor.
- **Change ID:** new-investment-no-sheet
- **PRD refs:** FR-009, FR-014, FR-016, US-01
- **Prerequisites:** S-08, S-15 (transitively: all parity slices + E2E gate + hardening)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Escape hatch — does the owner ever want to opt a new investment back to a sheet, or is the cutover absolute? PRD resolved "stands as written" (no lingering sheet option); confirm at cutover. — Owner: user. Block: no.
- **Risk:** The release gate — only flips once full parity (S-01..S-07) is built and E2E-covered (S-08). Guardrail: the materiały-mirror must keep syncing for investments still on sheets (FR-014), and existing sheet kosztorysy stay accessible (FR-016). Risk: a half-built editor behind this flag recreates the two-worlds problem.
- **Status:** proposed

### S-10: Importer for existing sheet kosztorysy — DEFERRED (post-MVP)

- **Outcome:** the owner can import an existing sheet kosztorys into the app, writing only the new kosztorys tables.
- **Change ID:** kosztorys-importer
- **PRD refs:** FR-010, FR-016
- **Prerequisites:** S-09
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Importer trigger — what concretely triggers this second-release importer so "later" does not become "never"? Name a condition or date. (PRD Q8). — Owner: user. Block: no.
- **Risk:** Second release within the arc, after parity is proven. Reads sheets, writes only new tables (additive). Guardrail: live sheet data must survive untouched until safely imported (FR-016). Risk: without a named trigger this slips indefinitely — resolve the trigger question before planning.
- **Status:** deferred — owner pulled the importer out of the MVP arc (2026-07-08). New investments start clean in the app (S-09); back-importing old sheet kosztorysy is a post-MVP band, unblocked only once the trigger question is answered.

---

The five slices below (**S-11…S-15**) were added on 2026-07-08 reconciling the roadmap with
the POC. S-11/S-12 carve out pricing dimensions that the pre-POC S-01/S-03 under-specified;
S-13/S-14 are owner-requested MVP features; S-15 is the pre-cutover hardening gate. Rationale
and the full decision register: `context/changes/kosztorys-mvp/change.md`.

### S-11: Subcontractor pricing (markup coefficient + override)

- **Outcome:** the two subcontractor price views (z narzędziami / bez narzędzi) are derived from the client price via a **markup coefficient** — inherited global(investment) → section(nullable) — with a per-item **two-state override** (`coeff` / fixed `amount` / null). Replaces the sheet's three hand-maintained snapshot columns.
- **Change ID:** kosztorys-subcontractor-pricing
- **PRD refs:** — (POC decision)
- **Prerequisites:** S-01, S-03
- **Parallel with:** S-04, S-06, S-07, S-12, S-13, S-14
- **Blockers:** —
- **Open note (decision 4):** where the coefficients are edited (settings-home UX) is TBD — owner leans detail-inwestycji or a future "Podsumowanie" panel, not the side panel.
- **Risk:** `clientPrice` stays the snapshot; the two other views are computed. Risk: override precedence (item > section > investment) must be unambiguous and the derived views must recompute under the S-03 toggle without re-snapshotting.
- **Status:** proposed

### S-12: VAT per investment (netto entry, brutto computed)

- **Outcome:** each investment carries one VAT rate (`investments.vat_rate`); prices are entered **netto** and brutto is computed. One rate per investment — no per-section/per-item rate, no cascade, no override.
- **Change ID:** kosztorys-vat
- **PRD refs:** FR (PRD Q2)
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-07, S-11, S-13, S-14
- **Blockers:** —
- **Open note (decision 4):** where the rate is set (settings-home UX) is TBD — same placement question as S-11.
- **Risk:** Additive column on `investments` + a computed brutto layer. Risk: robocizna netto/brutto derivation (client billing context, 23% vs 8%) is downstream of this rate — keep the rule in one place.
- **Status:** proposed

### S-13: Undo

- **Outcome:** the editor supports undo for destructive/edit actions (row delete, cell edit, reorder), so the spreadsheet-parity bar includes recovering from a mistake.
- **Change ID:** kosztorys-undo
- **PRD refs:** — (owner request)
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-07, S-11, S-12, S-14
- **Blockers:** —
- **Risk:** Autosave is per-field/optimistic/debounced (POC), so undo must reconcile with the persisted state, not just local grid state. Risk: scope creep — bound it to a shallow action history, not a full command stack.
- **Status:** proposed

### S-14: Column locking

- **Outcome:** columns can be locked so managers don't accidentally edit protected fields (parity with the sheet's protected `materiały` range). Complements the sheet's `addProtectedRange` model now that authoring moves in-app.
- **Change ID:** kosztorys-column-locking
- **PRD refs:** — (owner request)
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04, S-06, S-07, S-11, S-12, S-13
- **Blockers:** —
- **Open note:** overlaps the POC follow-on P10 (hide sensitive subcontractor cost/margin columns from MANAGER — OWNER/ADMIN-only). Decide whether locking and column-visibility are one slice or two at plan time.
- **Risk:** react-datasheet-grid column config is frozen on mount (same class of bug as the S-03 view toggle) — a lock toggle must go through the grid remount key. Risk: interaction with autosave (a locked cell must reject writes server-side, not just hide the input).
- **Status:** proposed

### S-15: Pre-cutover hardening

- **Outcome:** the editor is hardened before the cutover gate — perf at 1000+ rows re-verified on the clean build, autosave failure/revert paths exercised, access rules (MANAGEMENT_ROLES full / EMPLOYEE none) enforced, and the POC shortcuts (per-browser localStorage, inv-7) removed.
- **Change ID:** kosztorys-hardening
- **PRD refs:** —
- **Prerequisites:** S-08
- **Parallel with:** —
- **Blockers:** —
- **Risk:** This is the gate between "feature-complete editor" and "safe to make it the only authoring path" (S-09). Risk: skipping it pushes POC-grade shortcuts into the cutover.
- **Status:** proposed

## Open Roadmap Questions

These are the PRD's open questions, carried verbatim. The user called the top blocker
`none` — they ride as non-blocking, but several are load-bearing for the slice they sit
under and are best resolved before that slice is planned. Per-slice context lives in each
slice's Unknowns.

**Resolved by the POC (2026-07-08)** — kept for the record; see `context/changes/kosztorys-mvp/change.md`:

1. ~~**Per-item discount (rabat).**~~ **Resolved:** two-mode discount (`percent`/`amount`), folded into S-01.
2. ~~**VAT.**~~ **Resolved:** one rate per investment, netto entry / brutto computed — carved into **S-12**.
3. ~~**Labour vs. materials shape.**~~ **Resolved:** unified item list; materials = `INVESTMENT_EXPENSE`, no separate table.
4. ~~**Delete semantics.**~~ **Resolved:** hard-delete.
5. ~~**Ordering.**~~ **Resolved:** ▲▼ arrow reorder over a `display_order` layer (DnD deferred).
6. ~~**Item-to-room link.**~~ **Resolved:** rooms cut (S-05) — no link.

**Still open:**

6. **Catalogue seeding.** Hand-type, parse a live sheet once, or start empty and grow? — Owner: user. Gates: S-06 (spec Q8).
7. **Importer trigger (FR-010).** What concretely triggers the deferred importer? — Owner: user. Gates: S-10.
8. **Settings-home UX.** Where VAT (S-12) + subcontractor coefficients (S-11) are edited — detail-inwestycji or a future "Podsumowanie" panel, not the side panel. — Owner: user. Gates: S-11, S-12.
9. **Preset scope (S-16).** One global default preset vs a named library picked at create-time (owner leans library). — Owner: user. Gates: S-16.
10. **Preset save-as + retroactivity (S-16).** Save-as-new vs overwrite; and whether editing a preset retroactively touches kosztorysy already spawned from it (rec: no — snapshot). — Owner: user. Gates: S-16.

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
