---
project: 'Wykonczymy — off-sheets phase 1'
version: 1
status: draft
created: 2026-06-12
updated: 2026-07-10
prd_version: 1
main_goal: quality
top_blocker: none
---

# Roadmap: Wykonczymy — off-sheets phase 1

> Derived from `context/foundation/prd.md` (v1) + probed codebase baseline.
> Edit-in-place; archive when superseded.
> Slices are ordered by number (F-01, S-01…S-14), and the number _is_ the order — to reorder, renumber the slice, never move a row/block out of numeric sequence. The "At a glance" table is the index.

> **Reordered into execution bands (2026-07-10, owner).** The arc is now sequenced the way it
> will actually be built: **editor parity first** (S-01–S-08 — the full in-app editor with every
> POC decision + braindump todo), **then import/export** (S-09–S-10), **then testing + hardening**
> (S-11–S-13), **then cutover** (S-14). E2E testing moved to the end deliberately — the editor
> will churn heavily before the direction settles, so locking specs early would only chase moving
> targets. Slices were renumbered so numeric order = build order; the **change-id (not the number)
> is the stable key** used by branches, commits, and change folders, so the renumber is a pure
> relabel. Old→new map below.

> **Renumber map (2026-07-10).** old → new · slice:
> S-01→S-01 sections-items · S-03→S-02 price-models · S-04→S-03 stages · S-11→S-04
> subcontractor-pricing · S-12→S-05 vat · S-13→S-06 undo · S-14→S-07 column-locking ·
> S-16→S-08 preset · S-07→S-09 export · S-10→S-10 importer · S-08→S-11 editor-e2e-coverage ·
> S-02→S-12 financial-core-smoke · S-15→S-13 hardening · S-09→S-14 new-investment-no-sheet.
> Unnumbered (pulled out of sequence): S-05→cut rooms · S-06→folded catalogue (→S-08).

> **Reconciled with the POC (2026-07-08).** This roadmap was written 2026-06-12, before the
> in-app-editor POC (branch `poc-kosztorys-in-app`) built and settled the shape. Rooms (pokoje)
> were **cut**, the catalogue was **folded** into the preset slice (S-08), and subcontractor
> pricing / VAT / undo / column-locking / hardening were carved out as own slices. The two-mode
> discount folds into S-01; robocizna netto/brutto into S-01/S-02. Full rationale + the POC
> decisions + owner's four calls: **`context/changes/kosztorys-mvp/change.md`**.

## Where work is tracked

- **`roadmap.md` (this file) — source of truth for slices:** the v2 arc (`F-`/`S-` slices) + their `Status`, in the [At a glance](#at-a-glance) table. Dependency order, what to build next.
- **Linear "Wykonczymy" — live status + the ONLY home for ad-hoc todos:** mirrors slice status (flip to Done at archive) and holds every smaller / one-off task. No second todo file. Reality-check Linear access first (see AGENTS.md).
- **Linear "Wykonczymy v2"** — refactor / cleanup / known-bugs backlog (judgment-heavy, not PRD slices). Record new findings there, not in a standalone audit doc (per AGENTS.md).

## Vision recap

The kosztorys (per-investment line-item budget: sections, items, three price
models, stage progress, totals) lives in Google Sheets today, bridged to the app
by a fragile one-way mirror. This phase moves the kosztorys **fully into the app**
for new investments and retires the sheet as a data surface, while making
end-to-end verification of the financial core **automated** instead of hand-driven.

The build order is: (1) the in-app kosztorys editor that replaces sheets, at full
parity; (2) import/export; (3) automated E2E coverage + hardening once the editor
direction has settled; (4) the cutover that makes the app the only authoring path.

The release gate is **full parity for new investments** — a newly created
investment gets no Google Sheet and its kosztorys is authored entirely in the app.
Importing existing sheet data and tearing down the Google integration are later,
separate releases within the same arc.

## North star

**S-01: Owner authors a kosztorys's sections and items in-app with live totals** —
this is the validation milestone because it is the first owner-visible proof that
the spreadsheet can be replaced by the app at all; everything else in the editor
band is parity polish on top of it.

> North star here means the smallest end-to-end slice whose successful delivery
> would prove the core product hypothesis (kosztorys can live in the app, not
> Sheets) — placed as early as Prerequisites allow because the rest of the editor
> only matters if this works.

## At a glance

One row per F-NN / S-NN — the index and the backlog handoff in one place. **Plan-ready** = ready to feed into `/10x-plan` now (prerequisites met and no blocking open decision); `no` means blocked, `—` means n/a (deferred). Run a ready slice with `/10x-plan <change-id>`.

Bands: **editor parity S-01–S-08** (active) → **import/export S-09–S-10** → **testing + hardening S-11–S-13** → **cutover S-14**.

| ID   | Change ID                       | Outcome (user can …)                                                    | Prerequisites      | PRD refs                      | Status    | Plan-ready |
| ---- | ------------------------------- | ----------------------------------------------------------------------- | ------------------ | ----------------------------- | --------- | ---------- |
| F-01 | e2e-harness                     | (foundation) Playwright E2E harness, CI-runnable, isolated DB           | —                  | FR-011                        | ready     | yes        |
| S-01 | kosztorys-sections-items        | author kosztorys sections + items in-app with live totals               | —                  | FR-001, FR-002, FR-007, US-01 | in review | —          |
| S-02 | kosztorys-price-models          | record three price models per item and toggle the pricing view          | S-01               | FR-003                        | done      | —          |
| S-03 | kosztorys-stages                | manage stages (etapy) and record per-item, per-stage progress           | S-01               | FR-004                        | in review | —          |
| S-04 | kosztorys-subcontractor-pricing | price subcontractor work via markup coefficient + per-item override     | S-01, S-02         | — (POC)                       | done      | —          |
| S-05 | kosztorys-vat                   | set VAT per investment; enter net, compute gross                        | S-01               | — (POC)                       | proposed  | yes        |
| S-06 | kosztorys-undo                  | undo the last editor edit(s)                                            | S-01               | — (POC)                       | proposed  | yes        |
| S-07 | kosztorys-column-locking        | lock / pin editor columns                                               | S-01               | — (POC)                       | proposed  | yes        |
| S-08 | kosztorys-preset                | seed from a preset; save as preset; item autocomplete over preset prace | S-01               | FR-006, (owner request)       | proposed  | yes        |
| S-09 | kosztorys-export                | CSV-export the kosztorys (WYSIWYG snapshot; no print/PDF)               | S-01               | FR-008                        | deferred  | —          |
| S-10 | kosztorys-importer              | import an existing sheet kosztorys into the app                         | S-01 (full parity) | FR-010, FR-016                | deferred  | —          |
| S-11 | editor-e2e-coverage             | (gate) rely on automated E2E over the editor before release             | F-01, S-01…S-10    | FR-013                        | deferred  | —          |
| S-12 | financial-core-smoke            | trust an automated smoke that transfers update balances/figures         | F-01               | FR-012, FR-011, FR-015, US-02 | deferred  | —          |
| S-13 | kosztorys-hardening             | quality / perf / a11y hardening pass before cutover                     | S-11               | — (POC)                       | deferred  | —          |
| S-14 | new-investment-no-sheet         | create a new investment with no Google Sheet, kosztorys app-only        | S-11, S-13         | FR-009, FR-014, FR-016, US-01 | deferred  | —          |

**Cut / folded (unnumbered):** `kosztorys-rooms` — CUT (pokoje out of scope, 2026-07-08). `kosztorys-catalogue` — FOLDED into S-08 (Model A: preset-sourced autocomplete, 2026-07-09). See [Cut & folded slices](#cut--folded-slices).

## Bands

Navigation aid — the four execution bands and what gates the jump between them.

| Band | Theme                      | Slices                   | Gate to next band                                                                         |
| ---- | -------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| 1    | Editor parity (**active**) | `S-01` … `S-08`          | Editor feature-complete: every POC decision + braindump todo built.                       |
| 2    | Import / export            | `S-09` → `S-10`          | Last feature work before the editor is locked with tests.                                 |
| 3    | Testing + hardening        | `S-11` · `S-12` · `S-13` | E2E deferred to here on purpose — specs stabilise only once the editor direction settles. |
| 4    | Cutover / release          | `S-14`                   | The release gate: new investments get no sheet. Needs E2E (`S-11`) + hardening (`S-13`).  |

Within band 1, `S-01` (north star) heads the track; `S-02`–`S-09` all build on it and run in parallel (`S-04` also needs `S-02`). `F-01` (harness) is independent and can run any time; it unblocks the band-3 test slices.

## Baseline

What's already in place in the codebase as of 2026-06-12 (probed + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js App Router, Tailwind v4, Shadcn UI, React Compiler (`src/app/(frontend)`, `src/components/ui`).
- **Backend / API:** present — Payload CMS collections + server actions via `protectedAction()` (`src/collections`, `src/lib/actions`).
- **Data:** present — Postgres (Neon prod / docker local on 5433), Payload migrations, raw SQL via `@vercel/postgres` (`src/lib/db`, `src/migrations`).
- **Auth:** present — JWT `payload-token` cookie, four roles (ADMIN/OWNER/MANAGER/EMPLOYEE) (`src/lib/auth`, `src/access`).
- **Deploy / infra:** present — Vercel (build runs `generate:types` + `next build`; migrations applied deliberately, not by build).
- **Observability:** partial — `perfStart()` perf logging only; no error tracking (`global-error.tsx` has no reporter). Out of scope for this phase.
- **Test / E2E:** present — Vitest unit specs under `src/__tests__`; Playwright harness under `e2e/` (F-01 shipped). → band 3 grows coverage on top.
- **In-app kosztorys editor:** building — kosztorys was Google-Sheet-backed (the `kosztoryses` collection holds a sheet id, UI is `iframe-view.tsx` + a one-way `INVESTMENT_EXPENSE` mirror + sync button — `src/collections/sheets.ts`, `src/components/sheets`). The in-app editor ships across band 1 (S-01+), porting the POC's tested core (`calc.ts`/`v2-rows.ts` + `kosztorys_sections/items/stages/stage_progress` schema). See `context/changes/kosztorys-mvp/change.md`.

## Foundations

### F-01: E2E test harness

- **Outcome:** (foundation) a Playwright harness is installed and CI-runnable against an isolated test database, with an auth fixture and one green smoke spec; no operator-driven MCP session required to run it.
- **Change ID:** e2e-harness
- **PRD refs:** FR-011
- **Unlocks:** S-11 (editor E2E coverage), S-12 (financial-core smoke), and the FR-013 release gate; reduces the migration-risk guardrail by giving the financial core automated regression protection.
- **Prerequisites:** —
- **Parallel with:** the whole editor band (no dependency on the harness).
- **Blockers:** —
- **Unknowns:**
  - Test-data isolation strategy — self-seed unique per-run data against the dump-restored docker DB. — Owner: team. Block: no.
- **Risk:** Every band-3 E2E slice depends on it and the financial core is guardrail #1. Risk: a flaky harness erodes trust in the suite — keep the first spec minimal and deterministic.
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
  - Totals need a price to compute — S-01 carries a single per-item price (snapshotted from catalogue/typed value); the three price models arrive in S-02. Confirm a single model is acceptable for the first slice. — Owner: user. Block: no.
- **Folded from POC (settled, not open):** unified item list (materials = `INVESTMENT_EXPENSE`, no separate table); **hard-delete**; reorder via ▲▼ arrows with a `display_order` layer (DnD later would need sparse keys); **przedmiar + pomiar = two independent columns**, value computed from pomiar; **two-mode discount** (`discount_type ∈ {percent, amount}` + `discount_value`); values **computed, not stored** (only inputs persist). The Unknowns above are largely answered by these — carry the POC's shape.
- **Risk:** Introduces the additive kosztorys tables (sections, items) and the "worth = qty × snapshotted price, totals derived" rule. Additive-only — must not touch transfers/balance/marża write paths (FR-015). Risk: inline-edit + live totals at 1000+ rows is the hard UX/perf problem; the spreadsheet parity bar is high.
- **Status:** in review — implemented on branch `kosztorys-sections-items` (change.md `implemented`, 2026-07-08), PR pending. Not `done` until shipped: prod migration + manual-verification rows outstanding; `/10x-archive` flips it to `done` at cutover.

### S-02: Three price models + pricing-view toggle

- **Outcome:** a Manager+ user can record three price models per item (klient / podwykonawca z narzędziami / własne narzędzia) and toggle which model the kosztorys view and totals use.
- **Change ID:** kosztorys-price-models
- **PRD refs:** FR-003
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-03–S-09)
- **Blockers:** —
- **Scope note (POC):** S-02 is the **"one dataset, three views"** price-column toggle
  (Robocizna / z narzędziami / bez narzędzi) over one item set. The _derivation_ of the two
  subcontractor prices moved to **S-04** (coefficient + override, replacing the old three
  snapshot columns); VAT moved to **S-05**; per-item discount folded into **S-01**.
- **Resolved by POC:** robocizna netto vs brutto is **derived from the client billing context**
  (B2B? 23% vs 8%), tied to S-05's per-investment VAT rate — a determined rule, not an open
  question.
- **Risk:** Extends the item price from one snapshotted value (S-01) to three views; totals must recompute under the selected view. Risk: snapshot semantics — a later catalogue price change must not retroactively alter existing items. dsg gotcha: the active view must be in the grid remount key (POC bug, see `lessons.md`).
- **Status:** done

### S-03: Stage progress (etapy)

- **Outcome:** a Manager+ user can manage a variable number of stages (etapy) and record per-item, per-stage progress.
- **Change ID:** kosztorys-stages
- **PRD refs:** FR-004
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02, S-04–S-09)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Adds a stages table + per-item-per-stage progress join keyed off S-01's items. Variable stage count (not fixed 10 columns) is the parity requirement. Risk: progress totals interacting with the live-totals rule from S-01.
- **Status:** in review

### S-04: Subcontractor pricing (markup coefficient + override)

- **Outcome:** the two subcontractor price views (z narzędziami / bez narzędzi) are derived from the client price via a **markup coefficient** — inherited global(investment) → section(nullable) — with a per-item **two-state override** (`coeff` / fixed `amount` / null). Replaces the sheet's three hand-maintained snapshot columns.
- **Change ID:** kosztorys-subcontractor-pricing
- **PRD refs:** — (POC decision)
- **Prerequisites:** S-01, S-02
- **Parallel with:** the other editor + export slices (S-03, S-05–S-09)
- **Blockers:** —
- **Open note (decision 4):** where the coefficients are edited (settings-home UX) is TBD — owner leans detail-inwestycji or a future "Podsumowanie" panel, not the side panel.
- **Risk:** `clientPrice` stays the snapshot; the two other views are computed. Risk: override precedence (item > section > investment) must be unambiguous and the derived views must recompute under the S-02 toggle without re-snapshotting.
- **Status:** done

### S-05: VAT per investment (netto entry, brutto computed)

- **Outcome:** each investment carries one VAT rate (`investments.vat_rate`); prices are entered **netto** and brutto is computed. One rate per investment — no per-section/per-item rate, no cascade, no override.
- **Change ID:** kosztorys-vat
- **PRD refs:** — (PRD Q2)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-04, S-06–S-09)
- **Blockers:** —
- **Open note (decision 4):** where the rate is set (settings-home UX) is TBD — same placement question as S-04.
- **Risk:** Additive column on `investments` + a computed brutto layer. Risk: robocizna netto/brutto derivation (client billing context, 23% vs 8%) is downstream of this rate — keep the rule in one place.
- **Status:** proposed

### S-06: Undo

- **Outcome:** the editor supports undo for destructive/edit actions (row delete, cell edit, reorder), so the spreadsheet-parity bar includes recovering from a mistake.
- **Change ID:** kosztorys-undo
- **PRD refs:** — (owner request)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-05, S-07–S-09)
- **Blockers:** —
- **Risk:** Autosave is per-field/optimistic/debounced (POC), so undo must reconcile with the persisted state, not just local grid state. Risk: scope creep — bound it to a shallow action history, not a full command stack.
- **Status:** proposed

### S-07: Column locking

- **Outcome:** columns can be locked so managers don't accidentally edit protected fields (parity with the sheet's protected `materiały` range). Complements the sheet's `addProtectedRange` model now that authoring moves in-app.
- **Change ID:** kosztorys-column-locking
- **PRD refs:** — (owner request)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-06, S-08–S-09)
- **Blockers:** —
- **Open note:** overlaps the POC follow-on P10 (hide sensitive subcontractor cost/margin columns from MANAGER — OWNER/ADMIN-only). Decide whether locking and column-visibility are one slice or two at plan time.
- **Risk:** react-datasheet-grid column config is frozen on mount (same class of bug as the S-02 view toggle) — a lock toggle must go through the grid remount key. Risk: interaction with autosave (a locked cell must reject writes server-side, not just hide the input).
- **Status:** proposed

### S-08: Kosztorys presets (templates) + autocomplete

- **Outcome:** a Manager+ user can (a) seed a new kosztorys from a preset — a reusable skeleton of sekcje + prace + prices — instead of starting blank, (b) save an existing kosztorys back as a preset, and (c) **add items via autocomplete over preset prace** (FR-006, folded from the old catalogue slice on 2026-07-09), hand-typing always allowed. Restores the legacy Sheets behaviour (`KOSZTORYS_TEMPLATE_SHEET_ID` seeded new sheets from a template) that the in-app editor dropped in S-01 — a parity gap the original roadmap never captured.
- **Change ID:** kosztorys-preset
- **PRD refs:** FR-006 (folded from the catalogue slice); otherwise owner request (2026-07-09; not in the original PRD)
- **Folded catalogue (Model A, owner 2026-07-09):** no separate catalogue table — autocomplete is a read-only view over the union of `prace` across presets, snapshotting opis + J.m. + price into the item on select (overwritable). Building presets _is_ seeding the suggestions, so there is no empty-catalogue risk. **Open (from the fold):** duplicate prace across presets at different prices — show each occurrence or dedupe by opis with a default price? Decide at plan time.
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-07, S-09)
- **Blockers:** —
- **Settled shape (owner, 2026-07-09):**
  - A preset = a kosztorys with the job-specific fields stripped. **Keep:** sekcje (structure), prace (opis), J.m., prices, coefficients/overrides. **Reset:** przedmiar/pomiar (amounts), rabat (discount), stage progress (S-03), note, hiddenInExport.
  - **Snapshot pricing throughout.** Catalogue and preset prices are _seed-defaults only_ — copied in as an initial value, then owned/overwritable per item. Never a live source of truth. Rationale: the same work costs differently investment-to-investment (different team → different price), so a centralised/live price is wrong. This mirrors the PRD's catalogue snapshot rule (a later master-price change never touches existing items) and extends it to presets.
  - **Absorbs the catalogue (autocomplete), no live price authority.** Because the preset embeds its own frozen prices, autocomplete over preset prace is a _suggestion + seed-default_ layer only — the snapshotted item price stays overwritable and is never re-read from the source. Never a centralised/live price.
- **Open (decision 9):** one global default preset vs a named library picked at create-time (owner leans library — "selecting from presets", plural). — Owner: user. Block: no.
- **Open (decision 10):** save-as behaviour — always save-as-new vs overwrite an existing preset; and retroactivity (recommendation: kosztorysy already spawned from a preset stay frozen when the preset is later edited — same snapshot rule). — Owner: user. Block: no.
- **Risk:** The preset carries _structure_ (sekcje → prace) with embedded snapshot prices. Risk: letting a preset link become a live price authority reintroduces the centralisation the owner explicitly rejected. Keep prices embedded + overwritable.
- **Status:** proposed

### S-09: CSV export

- **Outcome:** the owner can CSV-export the kosztorys. **Print/PDF is out of MVP scope** (POC, 2026-07-08) — the client-facing document polish is deferred; CSV is the release bar.
- **Change ID:** kosztorys-export
- **PRD refs:** FR-008
- **Prerequisites:** S-01
- **Parallel with:** the editor slices (S-02–S-08)
- **Blockers:** —
- **Unknowns:**
  - CSV shape for nested data (sections → items → stages) — flatten how? — Owner: user. Block: no.
- **Risk:** Reuses the existing export infrastructure (transfers already CSV-export); only the kosztorys-shaped render is new — which is why this is cheap.
- **Status:** deferred — parked 2026-07-10 into band 2 (import/export, last feature work before the editor is locked with tests). The export scope (what to actually export, CSV shape) rides on open POC decisions not yet settled; pick back up once the export contract is decided.

### S-10: Importer for existing sheet kosztorysy

- **Outcome:** the owner can import an existing sheet kosztorys into the app, writing only the new kosztorys tables.
- **Change ID:** kosztorys-importer
- **PRD refs:** FR-010, FR-016
- **Prerequisites:** S-01 (needs the editor schema; benefits from full parity S-01–S-08 to import every field)
- **Parallel with:** S-09 (export)
- **Blockers:** —
- **Unknowns:**
  - Importer trigger — what concretely triggers this second-release importer so "later" does not become "never"? Name a condition or date. (PRD Q8). — Owner: user. Block: no.
- **Risk:** Reads sheets, writes only new tables (additive). Guardrail: live sheet data must survive untouched until safely imported (FR-016). Risk: without a named trigger this slips indefinitely — resolve the trigger question before planning. **Note (2026-07-10):** no longer depends on the cutover (S-14) — moved ahead of it into band 2 per the reorder; import now happens before, not after, new investments go sheet-less.
- **Status:** deferred — band 2. Back-importing old sheet kosztorysy is unblocked only once the trigger question is answered.

### S-11: Editor E2E coverage (release gate)

- **Outcome:** the kosztorys editor flows are end-to-end-covered by the automated suite before the owner-facing release — sections/items/pricing/stages/subcontractor-pricing/VAT/undo/column-locking/preset+autocomplete/export/import exercised without a manual pass.
- **Change ID:** editor-e2e-coverage
- **PRD refs:** FR-013
- **Prerequisites:** F-01, S-01…S-10 (all editor + import/export slices)
- **Parallel with:** S-12 (financial-core smoke)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the quality gate that lets the owner touch the editor only once it is verified. Deliberately deferred to band 3: the editor will churn heavily through band 1–2 while the direction settles, so standing specs up earlier only chases moving targets. Risk: once here, if coverage lags the slices it locks, the cutover gate (S-14) slips — write the specs close behind the settled editor.
- **Status:** deferred — band 3. Waits until the editor + import/export are built and the direction is stable. Gates S-14 (cutover).

### S-12: Financial-core smoke spec

- **Outcome:** a developer/CI run signs in, creates a transfer, and asserts the register balance and investment figures update — automated, no human interaction, replacing the manual Playwright-MCP session for that flow.
- **Change ID:** financial-core-smoke
- **PRD refs:** FR-012, FR-011, FR-015, US-02
- **Prerequisites:** F-01
- **Parallel with:** everything — independent of the editor arc (guards the financial core, not the editor).
- **Blockers:** —
- **Unknowns:**
  - Transfer side effects (register recalculation hooks) make the spec slower/heavier — confirm the seed + assertion shape keeps it deterministic. — Owner: team. Block: no.
- **Risk:** The regression guard for guardrail #1 (financial integrity). Risk: asserting the action's return value instead of persisted balances would hide a failed write — assert observable state.
- **Status:** deferred — band 3. Blocks no editor slice; F-01 harness + the two existing transfer specs cover the flow in the interim. Safe to defer only while editor slices stay additive and don't touch transfer/balance/marża write paths (FR-015).

### S-13: Pre-cutover hardening

- **Outcome:** the editor is hardened before the cutover gate — perf at 1000+ rows re-verified on the clean build, autosave failure/revert paths exercised, access rules (MANAGEMENT_ROLES full / EMPLOYEE none) enforced, and the POC shortcuts (per-browser localStorage, inv-7) removed.
- **Change ID:** kosztorys-hardening
- **PRD refs:** —
- **Prerequisites:** S-11 (E2E coverage in place before hardening so regressions surface)
- **Parallel with:** —
- **Blockers:** —
- **Risk:** This is the gate between "feature-complete editor" and "safe to make it the only authoring path" (S-14). Risk: skipping it pushes POC-grade shortcuts into the cutover.
- **Status:** deferred — band 3.

### S-14: New investments get no Google Sheet (cutover gate)

- **Outcome:** creating a new investment provisions no Google Sheet and nothing is synced; its kosztorys exists only in the app, authored through the editor.
- **Change ID:** new-investment-no-sheet
- **PRD refs:** FR-009, FR-014, FR-016, US-01
- **Prerequisites:** S-11 (E2E gate), S-13 (hardening) — transitively: all editor + import/export slices
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Escape hatch — does the owner ever want to opt a new investment back to a sheet, or is the cutover absolute? PRD resolved "stands as written" (no lingering sheet option); confirm at cutover. — Owner: user. Block: no.
- **Risk:** The release gate — only flips once full parity is built, E2E-covered (S-11), and hardened (S-13). Guardrail: the materiały-mirror must keep syncing for investments still on sheets (FR-014), and existing sheet kosztorysy stay accessible (FR-016). Risk: a half-built editor behind this flag recreates the two-worlds problem.
- **Status:** deferred — band 4 (release).

### Cut & folded slices

Kept for the record; pulled out of the numbered sequence because they carry no executable work.

#### kosztorys-rooms — CUT

- **CUT (2026-07-08):** pokoje are out of scope (owner, POC 2026-06-20). The POC's
  `kosztorys_rooms` table is a dead orphan — do not build. Room-measurement formulas were
  recognised during the POC but parked; revive only via a new change (see
  `context/changes/kosztorys-mvp/change.md`).
- **Outcome (dropped):** a Manager+ user can manage room (pokoje) measurements per investment.
- **Change ID:** kosztorys-rooms
- **Was:** S-05 (pre-2026-07-10 numbering).

#### kosztorys-catalogue — FOLDED into S-08

- **FOLDED into S-08 (2026-07-09, owner).** FR-006 (add items via autocomplete, hand-typing
  always allowed) survives — it is **not cut** — but ships as part of the preset slice, not a
  standalone catalogue. Rationale: the POC already flagged the "podpowiadarka" as arriving _with
  szablony_ and deliberately kept prices as typed snapshots so a suggestion layer could sit on top
  (`context/archive/kosztorys-poc-in-app/2026-06-19-...-notes-BRAINDUMP.md:185`).
- **Chosen model: A (preset-sourced).** There is **no separate catalogue table.** The "master
  price list" _is_ the union of `prace` across presets; autocomplete is a read-only view over
  that data, snapshotting opis + J.m. + price into the new item on select (overwritable per the
  snapshot rule). This dissolves the old seeding question (Q6) — building presets _is_ seeding the
  suggestions.
- **Change ID:** kosztorys-catalogue (retired; work tracked under kosztorys-preset / S-08).
- **PRD refs:** FR-006.
- **Was:** S-06 (pre-2026-07-10 numbering).

## Open Roadmap Questions

These are the PRD's open questions, carried verbatim. The user called the top blocker
`none` — they ride as non-blocking, but several are load-bearing for the slice they sit
under and are best resolved before that slice is planned. Per-slice context lives in each
slice's Unknowns.

**Resolved by the POC (2026-07-08)** — kept for the record; see `context/changes/kosztorys-mvp/change.md`:

1. ~~**Per-item discount (rabat).**~~ **Resolved:** two-mode discount (`percent`/`amount`), folded into S-01.
2. ~~**VAT.**~~ **Resolved:** one rate per investment, netto entry / brutto computed — carved into **S-05**.
3. ~~**Labour vs. materials shape.**~~ **Resolved:** unified item list; materials = `INVESTMENT_EXPENSE`, no separate table.
4. ~~**Delete semantics.**~~ **Resolved:** hard-delete.
5. ~~**Ordering.**~~ **Resolved:** ▲▼ arrow reorder over a `display_order` layer (DnD deferred).
6. ~~**Item-to-room link.**~~ **Resolved:** rooms cut — no link.

**Still open:**

6. ~~**Catalogue seeding.**~~ **Resolved (2026-07-09):** dissolved by folding the catalogue into S-08 with Model A — autocomplete sources from preset prace, so building presets _is_ seeding. No standalone catalogue to seed.
7. **Importer trigger (FR-010).** What concretely triggers the deferred importer? — Owner: user. Gates: S-10.
8. **Settings-home UX.** Where VAT (S-05) + subcontractor coefficients (S-04) are edited — detail-inwestycji or a future "Podsumowanie" panel, not the side panel. — Owner: user. Gates: S-04, S-05.
9. **Preset scope (S-08).** One global default preset vs a named library picked at create-time (owner leans library). — Owner: user. Gates: S-08.
10. **Preset save-as + retroactivity (S-08).** Save-as-new vs overwrite; and whether editing a preset retroactively touches kosztorysy already spawned from it (rec: no — snapshot). — Owner: user. Gates: S-08.

## Parked

Lifted from PRD `## Non-Goals` — explicitly out of scope for this arc.

- **Mirror / Google integration teardown** — Why parked: removing the integration (design-spec Phase 3b) is a later change, triggered only after cutover is proven.
- **Bidirectional sheet ↔ app sync** — Why parked: the editor never reads from or writes to sheets; the one-shot importer (S-10) is the only exception.
- **Real-time collaborative editing** — Why parked: PRD non-goal.
- **Multi-currency** — Why parked: PLN only, confirmed non-goal.
- **Multi-tenant catalogues** — Why parked: single shared catalogue; PRD non-goal.
- **Schema-level customization** (per-investment custom columns / arbitrary-field sidecars) — Why parked: a free-text note field covers ad-hoc needs; PRD non-goal.
- **Observability / error tracking** — Why parked: baseline is perf-logging only; wiring a reporter (Sentry/structured) is out of scope for this phase (tracked in Linear "Wykonczymy v2").

## Done

(`/10x-archive` appends here when a change whose Change ID matches a roadmap item is archived.)

- **S-02: Three price models + pricing-view toggle** (was S-03) — Archived 2026-07-09 → `context/archive/2026-07-09-kosztorys-price-models/`. Core (three views + toggle + coefficient/override derivation) shipped in S-01; this change closed the residual polish (per-kosztorys view persistence, "Klient" relabel, pricing-model explainer tooltip). Lesson: —.
- **S-04: Subcontractor pricing (markup coefficient + override)** (was S-11) — Absorbed by S-01 (`kosztorys-sections-items`), which ported the POC's final `calc.ts` derivation verbatim; marked done here (no separate change folder). Lesson: —.
