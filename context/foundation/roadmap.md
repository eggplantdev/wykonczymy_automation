---
project: 'Wykonczymy — off-sheets phase 1'
version: 1
status: draft
created: 2026-06-12
updated: 2026-07-18
prd_version: 1
main_goal: quality
top_blocker: none
---

# Roadmap: Wykonczymy — off-sheets phase 1

> Derived from `context/foundation/prd.md` (v1) + probed codebase baseline.
> Edit-in-place; archive when superseded.
> Slices are ordered by number (F-01, S-01…S-17), and the number _is_ the order — to reorder, renumber the slice, never move a row/block out of numeric sequence. The "At a glance" table is the index.

> **Sheet-parity reference — read before designing any editor slice.**
> `context/reference/kosztorys-editor-domain-notes.md` is the domain reference for the original
> spreadsheet (column map, closed decisions, open owner questions). **Verify its claims against the
> live sheet before trusting them** — parts of it are stale (see below).
>
> The source sheet is readable again: the service account
> `kosztorys-sheets@wykonczymy-kosztorys-bk.iam.gserviceaccount.com` was granted Viewer on
> `KOSZTORYS_TEMPLATE_SHEET_ID` (2026-07-15), so the read-only inspector works:
>
> ```bash
> MAX_ROWS=464 TABS=kosztorys_robocizny node --env-file=.env scripts/inspect-sheet.mjs
> ```
>
> **Verified against the live sheet 2026-07-15** (formulas, not screenshots) — supersedes the
> reference where they disagree:
>
> - **10 etapów, not 6.** The reference's `C–H 1–6 etap` column map is stale. Real layout:
>   `D–M` = 1–10 etap ilość (wykonano) · `N` przedmiar · `O` pomiar · `Q` cena · `R` rabat ·
>   `S` wartość przedmiaru (header only — see below) · `T` wartość netto · `U` komentarz ·
>   `V–AE` = 1–10 etap wartość · `AF` pozostało/bilans.
> - **`S` "wartość przedmiaru" is a header with no formula and no values in any of the 464 rows**
>   (this map originally skipped `R` → `T` and missed it entirely — corrected 2026-07-15). Likely
>   never wired because `O` (pomiar) is `=N`, so `S` would duplicate `T` until pomiar is overridden
>   by hand. Our przedmiar/pomiar are independent, so the column is meaningful here: **built as
>   `Wartość przedmiaru netto/brutto`** (`rowPlannedNetForView`), rabat applied, so it differs from
>   `Netto` by qty alone. New work, not parity — there was no sheet behaviour to copy.
> - **The app's stage math is 1:1 with the sheet.** `T = O*Q-(Q*R)*O`, `V = D*$Q-(D*$Q*$R)`,
>   `AF = T-V-W-…-AE` — matching `stageValueForView` / `rowRemainingForView` exactly. `AF`
>   ("pozostało do rozliczenia") is progress control, not a billing figure — confirms P9.
> - **Section total** = `T4 = SUM(T5:T21)` on the section header row; `U4 = T4` mirrors it so the
>   `Podsumowanie` tab's `SUMIF` can find it.
> - **No per-etap total exists anywhere.** Zero formulas sum the etap axis (`V–AE`) across all 464
>   rows. A per-etap figure is therefore **new work, not parity** — it has no sheet behaviour to
>   copy, so it needs an owner decision (client price = invoice vs. subcontractor price = payout).
> - **Undocumented `Podsumowanie` tab** — per-section totals + **% share**, plus a
>   Robocizna/Materiały/Łącznie split. Mechanic:
>   `=SUMIF(kosztorys_robocizny!B:B; <section>; kosztorys_robocizny!U:U)`. The app's section-summary
>   panel covers the per-section totals but **not** the % share or the Robocizna/Materiały split.
>   Not covered by any slice — see [Open Roadmap Questions](#open-roadmap-questions).
> - The template's own `Podsumowanie!B6`/`B7` point at item rows (`T395`/`T398`) instead of grand
>   totals, so its Robocizna reads `0 zł` and the % column is `#DIV/0!` — the sheet's hand-kept
>   references rot as rows shift. An argument for deriving these in code.

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

> **Carved autocomplete out of S-09 (2026-07-11, owner).** FR-006 (add items via autocomplete over
> preset prace) — folded into the preset slice on 2026-07-09 — was carved back out into its own
> **deferred, unsequenced** slice `kosztorys-item-autocomplete`. S-09 narrows to preset **seed +
> save-as**. Reason: autocomplete is the highest-UI-risk / lowest-marginal-value part (custom dsg
> cell, no async-combobox precedent) and is strictly downstream of preset storage, so it can ship
> later with zero rework. The owner is still deciding whether/when to build it; it gets a number
> (tail renumber) only on commit. Detail in [Cut & folded slices](#cut--folded-slices).

> **Inserted snapshots slice (2026-07-10, owner).** Editor-safety recovery was split into **two
> independent nets** after a design discussion (see each slice's body): **S-06 kosztorys-snapshots**
> (durable point-in-time version history — restore the whole kosztorys to a saved/auto point) and
> **S-07 kosztorys-undo** (fast in-session undo/redo of recent actions). Snapshots go first (owner
> priority — the durable net catches the scarier "cascade delete noticed a day later" case); undo is
> independent of it. Inserting snapshots as S-06 cascaded the tail by one: old S-06 undo→S-07,
> S-07 column-locking→S-08, S-08 preset→S-09, S-09 export→S-10, S-10 importer→S-11,
> S-11 e2e→S-12, S-12 smoke→S-13, S-13 hardening→S-14, S-14 cutover→S-15. Change-ids unchanged
> (pure relabel). Downstream change-folder docs (`plan-brief.md`, `test-plan.md`) still cite the
> pre-insertion numbers for undo — the **change-id `kosztorys-undo` is the stable key**, not the number.

> **Inserted client-share slice as S-11 (2026-07-18, owner).** A live, read-only client-facing
> view of a kosztorys behind a token link (`kosztorys-client-share`, EX-532) was judged big enough
> to be its own slice, placed first in band 2 (import/export). It never leaks the subcontractor cost
> view — the client price path pins the `calc.ts` `view` argument to `'client'` so subcontractor
> prices are never computed. Inserting it cascaded the band-2+ tail by one: export S-11→S-12,
> importer S-12→S-13, e2e S-13→S-14, smoke S-14→S-15, hardening S-15→S-16, cutover S-16→S-17.
> Change-ids are the stable key (pure relabel). Design: `context/changes/kosztorys-client-share/design.md`.

> **Split S-08 + inserted RBAC slice (2026-07-10, owner).** The old S-08 `kosztorys-column-locking`
> conflated two unrelated concerns; the owner split them. (1) The easy edit-safety guard stays at
> **S-08**, redefined as **`kosztorys-delete-guard`** — originally hard-block deleting a _populated_ row /
> section / stage / column, **reversed by EX-477 (2026-07-17) to confirm-then-snapshot** (see S-08 below).
> (2) The hard, security-shaped concern — **role-based column AND row visibility** (hide subcontractor
> cost/margin price views, and whole sections/items, from MANAGER; OWNER/ADMIN only) — becomes a new
> **S-10 `kosztorys-column-rbac`**, placed last in the editor band, before import/export. Inserting it
> cascaded the tail by one: export S-10→S-11, importer S-11→S-12, e2e S-12→S-13, smoke S-13→S-14,
> hardening S-14→S-15, cutover S-15→S-16. Change-ids are the stable key; `kosztorys-column-locking` is
> retired in favour of the two new change-ids.

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

Bands: **editor parity S-01–S-10** (active) → **import/export S-11–S-13** → **testing + hardening S-14–S-16** → **cutover S-17**.

| ID   | Change ID                       | Outcome (user can …)                                                                    | Prerequisites      | PRD refs                      | Status    | Plan-ready |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------- | ------------------ | ----------------------------- | --------- | ---------- |
| F-01 | e2e-harness                     | (foundation) Playwright E2E harness, CI-runnable, isolated DB                           | —                  | FR-011                        | ready     | yes        |
| O-01 | sentry-observability            | capture prod errors + tracing + session replay in Sentry (standalone infra)             | —                  | — (owner request)             | proposed  | yes        |
| S-01 | kosztorys-sections-items        | author kosztorys sections + items in-app with live totals                               | —                  | FR-001, FR-002, FR-007, US-01 | done      | —          |
| S-02 | kosztorys-price-models          | record three price models per item and toggle the pricing view                          | S-01               | FR-003                        | done      | —          |
| S-03 | kosztorys-stages                | manage stages (etapy) and record per-item, per-stage progress                           | S-01               | FR-004                        | in review | —          |
| S-04 | kosztorys-subcontractor-pricing | price subcontractor work via markup coefficient + per-item override                     | S-01, S-02         | — (POC)                       | done      | —          |
| S-05 | kosztorys-vat                   | set VAT per investment; enter net, compute gross                                        | S-01               | — (POC)                       | done      | yes        |
| S-06 | kosztorys-snapshots             | save + restore point-in-time versions of a kosztorys (durable net)                      | S-01               | — (owner request)             | done      | yes        |
| S-07 | kosztorys-undo                  | fast in-session undo/redo of the last editor edit(s)                                    | S-01               | — (owner request)             | done      | yes        |
| S-08 | kosztorys-delete-guard          | confirm-then-snapshot when deleting a populated row / section / stage / column (EX-477) | S-01               | — (owner request)             | done      | yes        |
| S-09 | kosztorys-preset                | seed from a preset; save as preset (autocomplete carved out → EX-434)                   | S-01               | (owner request)               | done      | yes        |
| S-10 | kosztorys-column-rbac           | restrict sensitive columns + rows (subcontractor cost/margin; sections) to OWNER/ADMIN  | S-01, S-02, S-04   | — (POC P10)                   | proposed  | yes        |
| S-11 | kosztorys-client-share          | share a live, read-only client view of a kosztorys via a token link (EX-532)            | S-01, S-02, S-04   | — (owner request)             | deferred  | —          |
| S-12 | kosztorys-export                | CSV-export the kosztorys (WYSIWYG snapshot; no print/PDF)                               | S-01               | FR-008                        | deferred  | —          |
| S-13 | kosztorys-importer              | import an existing sheet kosztorys into the app                                         | S-01 (full parity) | FR-010, FR-016                | deferred  | —          |
| S-14 | editor-e2e-coverage             | (gate) rely on automated E2E over the editor before release                             | F-01, S-01…S-13    | FR-013                        | deferred  | —          |
| S-15 | financial-core-smoke            | trust an automated smoke that transfers update balances/figures                         | F-01               | FR-012, FR-011, FR-015, US-02 | deferred  | —          |
| S-16 | kosztorys-hardening             | quality / perf / a11y hardening pass before cutover                                     | S-14               | — (POC)                       | deferred  | —          |
| S-17 | new-investment-no-sheet         | create a new investment with no Google Sheet, kosztorys app-only                        | S-14, S-16         | FR-009, FR-014, FR-016, US-01 | deferred  | —          |

**Cut / folded (unnumbered):** `kosztorys-rooms` — CUT (pokoje out of scope, 2026-07-08). `kosztorys-catalogue` — FOLDED into S-09 (2026-07-09), then the autocomplete carved back out as `kosztorys-item-autocomplete` — DEFERRED, unsequenced (owner still deciding, 2026-07-11). See [Cut & folded slices](#cut--folded-slices).

## Bands

Navigation aid — the four execution bands and what gates the jump between them.

| Band | Theme                      | Slices                   | Gate to next band                                                                         |
| ---- | -------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| 1    | Editor parity (**active**) | `S-01` … `S-10`          | Editor feature-complete: every POC decision + braindump todo built.                       |
| 2    | Import / export            | `S-11` → `S-12` → `S-13` | Last feature work before the editor is locked with tests.                                 |
| 3    | Testing + hardening        | `S-14` · `S-15` · `S-16` | E2E deferred to here on purpose — specs stabilise only once the editor direction settles. |
| 4    | Cutover / release          | `S-17`                   | The release gate: new investments get no sheet. Needs E2E (`S-14`) + hardening (`S-16`).  |

Within band 1, `S-01` (north star) heads the track; `S-02`–`S-10` all build on it and run in parallel (`S-04` also needs `S-02`; `S-10` also needs `S-02` + `S-04`). `F-01` (harness) is independent and can run any time; it unblocks the band-3 test slices. `O-01` (Sentry observability) is likewise standalone infra — no dependency on any slice, ships any time.

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
- **Unlocks:** S-14 (editor E2E coverage), S-15 (financial-core smoke), and the FR-013 release gate; reduces the migration-risk guardrail by giving the financial core automated regression protection.
- **Prerequisites:** —
- **Parallel with:** the whole editor band (no dependency on the harness).
- **Blockers:** —
- **Unknowns:**
  - Test-data isolation strategy — self-seed unique per-run data against the dump-restored docker DB. — Owner: team. Block: no.
- **Risk:** Every band-3 E2E slice depends on it and the financial core is guardrail #1. Risk: a flaky harness erodes trust in the suite — keep the first spec minimal and deterministic.
- **Status:** ready

### O-01: Sentry error tracking + tracing + session replay

- **Outcome:** production runtime failures are captured and triageable — unhandled exceptions (client via `global-error.tsx`, server via the `protectedAction()` catch path + Payload route handlers), performance tracing spans, and session replays flow to a Sentry project. Replaces the current blind spot where a failed prod write is invisible unless a user reports it.
- **Change ID:** sentry-observability
- **PRD refs:** — (un-parks the parked "Observability / error tracking" non-goal; owner request 2026-07-11)
- **Prerequisites:** — (independent of the whole S-arc, like F-01; can ship any time)
- **Parallel with:** everything
- **Placement:** standalone infra slice, outside S-01…S-17 — not renumbered into the editor arc.
- **Scope:** `@sentry/nextjs` — errors + tracing + session replay, **production only** (gate init on env so preview/local stay silent and the free quota stays clean). Free Developer tier: 5k errors / 5M spans / 50 replays per month, 1 seat — sufficient for this low-traffic internal tool.
- **Problems to solve at plan time:**
  - **Env layer:** `SENTRY_AUTH_TOKEN` (build, source maps), `NEXT_PUBLIC_SENTRY_DSN`, and an env gate — all through `src/lib/env/schema.ts`, never raw `process.env` (AGENTS.md). `NEXT_PUBLIC_SENTRY_DSN` is client-side → `env/index.ts`; the token is build-only.
  - **Replay privacy (load-bearing):** replay records real sessions containing financial data (registers, marża, client amounts). Must enable `maskAllText` / `blockAllMedia` and verify no money figures leak into replays before this ships. This is the main risk.
  - **Source maps on Vercel:** the Sentry build plugin needs the auth token in the Vercel build env; confirm it doesn't fight the existing `generate:types` + `next build` pipeline.
  - **Instrumentation surface:** `instrumentation.ts` + `sentry.client/server/edge.config.ts`; wire `global-error.tsx` (currently no reporter) and confirm `protectedAction()` errors surface (Next auto-instruments server actions, but verify).
  - **Quota guard:** low `tracesSampleRate` / `replaysSessionSampleRate` so 5M spans / 50 replays aren't burned; keep `replaysOnErrorSampleRate` higher (replay only when something breaks).
- **Risk:** additive, touches no financial write path. Primary risk is a **PII/financial-data leak via unmasked session replay** — the guardrail is verifying masking on a real prod-shaped session before enabling replay. Secondary: source-map upload misconfig makes stack traces useless (unminified verification needed). Seat limit (1 user) caps triage to the owner — acceptable now.
- **Status:** proposed

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
- **Parallel with:** the other editor + export slices (S-03–S-10)
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
- **Parallel with:** the other editor + export slices (S-02, S-04–S-10)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Adds a stages table + per-item-per-stage progress join keyed off S-01's items. Variable stage count (not fixed 10 columns) is the parity requirement. Risk: progress totals interacting with the live-totals rule from S-01.
- **Shipped adjacent, not part of this slice:** the stage **value** axis (the sheet's `V–AE`) — a computed `kwota netto` + `kwota brutto` column per stage, brutto hidden by default. `context/changes/kosztorys-stage-values/`, 2026-07-15. It reverses S-03's plan's "no brutto column" exclusion; S-03's own scope is unchanged. Distinct from open question 12(b), which is a total **along** the stage axis and stays open.
- **Status:** in review

### S-04: Subcontractor pricing (markup coefficient + override)

- **Outcome:** the two subcontractor price views (z narzędziami / bez narzędzi) are derived from the client price via a **markup coefficient** — inherited global(investment) → section(nullable) — with a per-item **two-state override** (`coeff` / fixed `amount` / null). Replaces the sheet's three hand-maintained snapshot columns.
- **Change ID:** kosztorys-subcontractor-pricing
- **PRD refs:** — (POC decision)
- **Prerequisites:** S-01, S-02
- **Parallel with:** the other editor + export slices (S-03, S-05–S-10)
- **Blockers:** —
- **Open note (decision 4):** where the coefficients are edited (settings-home UX) is TBD — owner leans detail-inwestycji or a future "Podsumowanie" panel, not the side panel.
- **Risk:** `clientPrice` stays the snapshot; the two other views are computed. Risk: override precedence (item > section > investment) must be unambiguous and the derived views must recompute under the S-02 toggle without re-snapshotting.
- **Status:** done

### S-05: VAT per investment (netto entry, brutto computed)

- **Outcome:** each investment carries one VAT rate (`investments.vat_rate`); prices are entered **netto** and brutto is computed. One rate per investment — no per-section/per-item rate, no cascade, no override.
- **Change ID:** kosztorys-vat
- **PRD refs:** — (PRD Q2)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-04, S-06–S-10)
- **Blockers:** —
- **Open note (decision 4):** where the rate is set (settings-home UX) is TBD — same placement question as S-04.
- **Risk:** Additive column on `investments` + a computed brutto layer. Risk: robocizna netto/brutto derivation (client billing context, 23% vs 8%) is downstream of this rate — keep the rule in one place.
- **Status:** done

### S-06: Snapshots (point-in-time version history)

- **Outcome:** a Manager+ user can **save a named snapshot** of a kosztorys and later **restore** it, reverting the whole kosztorys (sections + items + stages + progress) to that saved point; the system also takes an **automatic snapshot before a destructive cascade delete** (section / stage delete) as a safety net. This is the **durable** recovery layer — snapshots survive reload and target the "a bad edit / a cascade delete noticed a day later, after the client may have seen it" failure that in-session undo (S-07) cannot catch.
- **Change ID:** kosztorys-snapshots
- **PRD refs:** — (owner request, 2026-07-10)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-05, S-07–S-10). **Independent of S-07** — undo does not depend on snapshots and vice-versa.

- **Chosen architecture — independent snapshots, NOT an event log (owner, 2026-07-10).**
  A snapshot = one row `{ investment_id, taken_at, taken_by, label (nullable), kind: 'manual' | 'auto', payload jsonb }` where `payload` is the **serialized whole kosztorys tree**. **Restore = wipe the current tree → re-insert from the payload, in one transaction.** Coarse (whole-kosztorys, all-or-nothing) by design. We deliberately rejected the Event-Sourcing alternative (one append-only change log feeding both undo + history + a per-field "who changed what" audit): it forces every server action to append a correct, invertible log entry, makes replaying cascade deletes backward fiddly, and needs snapshots as a replay optimisation anyway (even Google Sheets, which _is_ event-sourced with OT, still materialises periodic snapshots). The app is **single-editor (lock, POC decision #10)**, so the one thing that forces event sourcing — live collaboration / OT — is out of scope. Owner confirmed: **no field-level "who changed a value" audit is needed — "just going back to a point in time is good enough."** So the simple snapshot table wins.
- **Triggers:** **manual** ("Zapisz wersję", named, kept forever) **+ automatic** (unnamed, `kind:'auto'`, fired **right before a section-delete or stage-delete** — the FK-cascade operations that wipe a subtree; that is exactly when unrecoverable loss is possible).
- **Retention:** keep every **manual** snapshot; **prune `auto` snapshots** to the last ~N (≈20) per kosztorys so the table stays bounded. Confirm N at plan time.
- **Division of labour with S-07:** snapshots own the **heavy, rare, destructive** cases (cascade deletes, "restore yesterday"); undo owns the **frequent, cheap, reversible** ones. A cascade-delete undo is explicitly NOT built into S-07 — it is recovered by restoring the pre-delete auto-snapshot.
- **Problems to solve at plan time:**
  - **Payload shape + versioning:** exactly which tables/columns the `jsonb` captures (items, stage rows, per-investment VAT/coeffs?), and how a restore behaves if the schema changed since the snapshot was taken (a later slice added a column). Snapshot format needs a version tag.
  - **Restore semantics on ids:** wipe-and-reinsert mints **new** primary keys — confirm nothing outside the kosztorys references item/stage ids (e.g. the `INVESTMENT_EXPENSE` materials mirror) in a way a restore would break.
  - **Restore vs. live totals / mirror:** restoring must re-fire the same revalidation the editor actions do (cache tags) and, if materials are mirrored, keep the mirror consistent.
  - **Auto-snapshot cost:** serialising a 1000+ row tree on every cascade delete — is it cheap enough inline, or does it need to be deferred?
  - **Access:** who can restore (MANAGEMENT_ROLES) and does a restore itself get snapshotted (so a mistaken restore is also recoverable)?
- **Risk:** Additive `kosztorys_snapshots` table + a restore path — the restore is the only dangerous write (it deletes the live tree). Guardrail: restore must be transactional and additive-only to the kosztorys tables — it must not touch transfers / balances / marża (FR-015). Risk: an under-captured payload restores a _partial_ tree; a snapshot is only trustworthy if its payload is complete. **Owner note: snapshots should be the easy slice** — keep restore dead-simple (wipe + rewrite), resist scope creep into diffing or partial restore.
- **Status:** done (EX-418 closed 2026-07-17). Implemented on `main` (change.md `implemented`, 2026-07-10). Deferred E2E → EX-428 (`e2e-backlog`); `CRON_SECRET` deploy gate → EX-429; both orthogonal to slice completion.

### S-07: Fast undo / redo (in-session)

- **Status:** done (EX-403 + EX-526 hardening, 2026-07-18). Re-integrated onto staging; manual checks (S-07 Faza 4) signed off. Archived → `context/archive/2026-07-18-kosztorys-undo/`. Deferred DB-integration E2E → EX-525 (`e2e-backlog`); owed `hasPendingBurst` unit → EX-521 (behind the `renderHook` harness).
- **Outcome:** the editor supports **undo/redo** of recent actions — cell edit, stage-progress edit, reorder, and single-row add/delete — via a toolbar button **and Cmd+Z / Cmd+Shift+Z**, so the spreadsheet-parity bar includes instantly reversing a fat-finger without reaching for a snapshot. In-session (the stack lives in the browser tab, gone on reload); durable recovery is S-06's job.
- **Change ID:** kosztorys-undo
- **PRD refs:** — (owner request)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-06, S-08–S-10). **Independent of S-06.**

- **Chosen approach — Command pattern over a stable client-identity map (owner leans B, 2026-07-10).**
  Two in-memory stacks (undo / redo) of command objects, each a `{ do, undo }` pair. **Key wrinkle:** the editor already persists every edit within 500ms (per-field optimistic autosave via server actions), so a command's `undo` is **not** a local rewind — it **issues the inverse server mutation** (write the old value back / recreate the row / swap order back), reusing the existing actions (`updateItemFieldAction`, `addItemAction`, `removeItemAction`, `swapItemOrderAction`). **Identity-map indirection is the chosen design:** stamp every row with a session `uid` at load (in `treeToRows`), keep one `Map<uid, dbId>`, and have the undo stack reference **only `uid`** — never a raw DB id. When undoing a delete recreates a row with a **new** DB id, update the map entry; every other stack command still resolving that `uid` stays valid, so **the stack survives every action including deletes — no stack-clearing**. (Same pattern as React `key`s, dnd-kit item ids, and Fowler's Identity Map; a cousin of the editor's existing `display_order` decoupling.)
- **Scope (owner leans B = also undo single-row add/delete), but ship-and-test order:** snapshots (S-06) ship **first**; then evaluate whether "restore a version" already covers the delete case in practice. If yes, S-07 can land at the simpler **cell-edit + reorder** scope and defer single-row delete-undo; if not, build the full identity-map version. Cell edits + stage progress + reorder are in scope either way (cheap, ids stable).
- **Problems to solve at plan time (the hard ones — flag loudly):**
  - **The cascade cases — section-delete / stage-delete.** These FK-cascade a whole subtree (all items + `stage_progress` of that stage/section). Undoing one means recreating the entire deleted set with fresh ids and re-pointing children — genuinely hard. **Decision from the design discussion: undo does NOT reconstruct a cascade delete — it is handed to S-06's auto-snapshot** (taken right before the delete). Plan must define what a cascade delete does to the undo stack (drop those commands / mark unrecoverable-by-undo) and how the UI signals "use restore for that."
  - **Column delete** (stage-as-column work; confirm-gated per S-08/EX-477): deleting a populated stage column is the same cascade class — same pre-delete snapshot hand-off.
  - **The one discipline:** nothing in the stack may cache a raw DB id — always the `uid`, resolved through the map at execution time. A single raw-id command dangles on recreate and reintroduces stack-clearing.
  - **Redo invalidation:** a fresh edit clears the redo stack (standard). Confirm interaction with the debounced saver (an undo must reconcile with / cancel any in-flight save for the same field, not race it).
  - **Stack depth cap** (~N) so memory stays bounded on a long session.
  - **Feed S-06's periodic snapshot an activity signal (deferred from S-06).** S-06 ships its 10-min periodic `auto` snapshot as a **plain interval that fires unconditionally, even on an idle open editor** — deliberately no dirty check, because there is no client edit-queue yet. This slice introduces exactly that (the identity-map / command stack tracks whether anything changed), so **add the "skip the snapshot when nothing changed since the last one" gate here** — gate the interval on the undo stack / dirty flag so an untouched editor stops writing identical snapshots. Small follow-up, not a new mechanism.
  - **Reconcile with revert-on-error:** the existing `revertOne` (rollback on a rejected save) and an undo both mutate optimistic + persisted state — they must not fight.
- **Risk:** Autosave is per-field/optimistic/debounced (POC), so undo reconciles with **persisted** state, not just local grid state — every undo is an inverse server write. Risk: scope creep into a full command stack that tries to reverse cascades; keep cascades on snapshots. Test priority #2 (formulas #1) per the POC braindump.
- **Status:** proposed

### S-08: Confirm-gated delete for populated rows / sections / stages / columns

> **Policy reversed by EX-477 (2026-07-17, owner).** The original "hard-block a populated delete,
> clear the values first" rule was **too rigid** — the owner wants to delete a whole populated
> section/item/stage in one move. New rule: a populated delete is **allowed behind a confirmation
> dialog**, and every destructive delete that can take child data with it (item, section, stage/column)
> takes an **auto snapshot right before deleting** (`captureAutoSnapshot`), so it is recoverable via
> S-06 restore. The server actions no longer reject a populated delete; the client owns the confirm.
> The empty-sheet floor (a kosztorys keeps ≥1 item) is the one remaining hard block.
> Change doc: `context/changes/kosztorys-delete-confirm/`.

- **Outcome:** deleting a kosztorys row (item), a section, a stage, or a stage-column that **holds recorded work** goes through a **confirm dialog**, then deletes after taking a pre-delete auto snapshot. No populated delete is hard-blocked anymore (only the last remaining item is).
- **Change ID:** kosztorys-delete-guard (superseded by `kosztorys-delete-confirm` — EX-477)
- **PRD refs:** — (owner request, 2026-07-10; policy reversed 2026-07-17)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-07, S-09, S-10)
- **Blockers:** —
- **Scope:** the confirm-and-snapshot flow covers an **item** (`RowActionsMenu`), a **section** (`SectionSummary`, cascades its items + `stage_progress`), and a **stage/column** (`StageHeader`, cascades its `stage_progress`). "Populated" = the row/subtree holds recorded `stage_progress` — that is the only work a delete destroys and the only case that pops the confirm; a plan-only row deletes without a prompt.
- **Split note:** carved out of the old `kosztorys-column-locking` slice (2026-07-10); the role-based visibility half moved to **S-10 `kosztorys-column-rbac`**. The hard-block half then reversed to confirm-gated (EX-477).
- **Risk:** the snapshot must be taken **inside the server action, before** the cascade delete — a client-only snapshot races autosave and misses the pre-delete state. The confirm is client-side UX; recoverability is the server's job.
- **Status:** done (EX-477)

### S-09: Kosztorys presets (templates)

- **Outcome:** a Manager+ user can (a) seed a new kosztorys from a preset — a reusable skeleton of sekcje + prace + prices — instead of starting blank, and (b) save an existing kosztorys back as a preset. Restores the legacy Sheets behaviour (`KOSZTORYS_TEMPLATE_SHEET_ID` seeded new sheets from a template) that the in-app editor dropped in S-01 — a parity gap the original roadmap never captured.
- **Shipped 2026-07-11 (EX-414, Done).** The autocomplete-over-preset-prace part (FR-006, item (c)) was **carved out** at plan time (owner, 2026-07-11) into a separate deferred slice → **EX-434** (`kosztorys-item-autocomplete`); S-09 shipped presets-only. Review gate filed EX-438/439/440/441 (tech-debt) and EX-442 (owed E2E, `e2e-backlog`).
- **Change ID:** kosztorys-preset
- **PRD refs:** owner request (2026-07-09; not in the original PRD). FR-006 (autocomplete) was folded in here on 2026-07-09, then **carved back out** on 2026-07-11 (owner) as its own deferred slice — see [Cut & folded slices](#cut--folded-slices). S-09 no longer ships autocomplete.
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-08, S-10–S-12)
- **Blockers:** —
- **Settled shape (owner, 2026-07-09):**
  - A preset = a kosztorys with the job-specific fields stripped. **Keep:** sekcje (structure), prace (opis), J.m., prices, coefficients/overrides. **Reset:** przedmiar/pomiar (amounts), rabat (discount), stage progress (S-03), note, hiddenInExport.
  - **Snapshot pricing throughout.** Preset prices are _seed-defaults only_ — copied in as an initial value, then owned/overwritable per item. Never a live source of truth. Rationale: the same work costs differently investment-to-investment (different team → different price), so a centralised/live price is wrong. This mirrors the PRD's catalogue snapshot rule (a later master-price change never touches existing items) and extends it to presets.
- **Resolved (decision 9, owner 2026-07-11):** named library, one row per preset in a new global `kosztorys_presets` table (`{id, name, schema_version, payload jsonb, created_at, created_by}`); reuses the S-06 serialize/apply engine via a forked `restoreKosztorys`. See `context/changes/kosztorys-preset/change.md`.
- **Resolved (decision 10, owner 2026-07-11):** save-as offers **both** save-new and overwrite-existing; kosztorysy already spawned from a preset stay **frozen** when the preset is later edited (snapshot rule). Seed target v1 = **empty kosztorys only** (insert-only, no wipe/append/pre-apply snapshot).
- **Risk:** The preset carries _structure_ (sekcje → prace) with embedded snapshot prices. Risk: letting a preset link become a live price authority reintroduces the centralisation the owner explicitly rejected. Keep prices embedded + overwritable.
- **Status:** done

### S-10: Column + row RBAC (role-based visibility)

- **Outcome:** sensitive **columns** — the subcontractor price views (z narzędziami / bez narzędzi = koszt/marża) — and sensitive **rows** (whole sections / items flagged restricted) are visible only to OWNER/ADMIN; a MANAGER never sees them. Enforced **server-side**: the derived subcontractor prices and restricted rows are withheld from a MANAGER's payload, and the price-view toggle does not offer the restricted views. Client price, przedmiar/pomiar, and stage progress stay visible to MANAGER.
- **Change ID:** kosztorys-column-rbac
- **PRD refs:** — (POC follow-on P10, `context/reference/kosztorys-editor-domain-notes.md:260`)
- **Prerequisites:** S-01, S-02 (price-view toggle), S-04 (subcontractor price derivation — the columns being hidden)
- **Parallel with:** the other editor slices — but sequenced **last in the editor band, before import/export** (owner, 2026-07-10): it is the hard, security-shaped slice, so it lands once the columns/rows it gates have settled.
- **Blockers:** —
- **Why this is the hard one:** unlike S-08 (a UX guard), this is **authorization**. The derived prices are computed in `calc.ts` and shipped in the row payload; hiding per-role means splitting what the server _sends_ per role, not toggling a CSS class — a client-only hide leaks the numbers in the network response. Same axis for restricted rows.
- **Problems to solve at plan time:**
  - **Column half:** MANAGER must not receive the z-narzędziami / bez-narzędzi derived prices at all; the `priceMode` toggle must drop those options for MANAGER; CSV export (S-12) must respect the same rule.
  - **Row half:** what marks a section/item as restricted — a per-row `restricted` flag, or a fixed rule? Where and by whom (OWNER/ADMIN) is it set? A restricted row must not appear in a MANAGER's tree, totals, or export.
  - **dsg gotcha:** the column set changes per role → must go through the grid remount `key` (same class as the S-02 view-toggle bug).
  - **Totals under redaction:** do a MANAGER's section/grand totals include the hidden rows/costs, or recompute over the visible set? Decide — it changes what number the MANAGER trusts.
- **Open (P10 scope, domain-notes:260):** confirm the exact hidden set = subcontractor cost/margin only; client price / przedmiar / pomiar / stage progress stay visible to MANAGER.
- **Risk:** security slice — a leak (numbers in a payload a MANAGER can read via devtools) defeats the purpose. Guardrail: assert redaction at the **server boundary** (query/action), verified by a test that inspects the MANAGER payload, not just the rendered DOM.
- **Status:** proposed

### S-11: Client share view (live, read-only, token link)

- **Outcome:** the owner can share a **live, read-only client-facing view** of a kosztorys via a token link. The client reopens the URL over the life of the job and sees current per-etap progress (not a frozen offer). WYSIWYG on the active columns + totals; the subcontractor cost view (z narzędziami / bez narzędzi) is **never** shown.
- **Change ID:** kosztorys-client-share
- **Linear:** EX-532
- **PRD refs:** — (owner request, 2026-07-18)
- **Prerequisites:** S-01, S-02 (pricing view), S-04 (subcontractor derivation — the thing being kept out)
- **Parallel with:** the editor slices (S-02–S-10) and the other band-2 slices (S-12–S-13)
- **Blockers:** —
- **Core safety principle:** prices are computed live via `calc.ts`; the entire leak surface is the `view` argument. The client path **hardcodes `view: 'client'`** so subcontractor prices are never computed (not filtered — never derived). Reinforced structurally by a `ClientKosztorysViewT` DTO that carries no coeffs/overrides. **Safety lives in the data projection, never in a component conditional** — a prop-gated price branch is exactly the leak this design rules out.
- **Scope:** `shareToken` on `kosztoryses` (generate = OWNER/ADMIN, revoke = rotate) → unauthenticated `getClientKosztorysView(token)` (unlike `getKosztorysTree`, which self-guards) → public `(share)` route `/k/[token]`, `noindex`, bare layout → a read-only render reusing the editor's presentation primitives with client-safe data.
- **Out of scope (separate slices):** Google Sheet export, PDF export (may be dropped — a live link beats a static file).
- **Risk:** a live public URL that leaks the subcontractor cost view defeats the purpose. Guardrail: assert at the projection boundary that `view` is pinned to `'client'` and the DTO carries no subcontractor fields — verified by a test inspecting the client payload, not the DOM. Design doc: `context/changes/kosztorys-client-share/design.md`.
- **Status:** deferred — shaped, parked until the editor stabilizes (owner, 2026-07-18). Held so the client view doesn't become a second render to keep in sync while the editor churns; the design resolves that with a single column-config + `clientVisible` flag + read-only reuse of the editor grid. Pick up once the editor settles.

### S-12: CSV export

- **Outcome:** the owner can CSV-export the kosztorys. **Print/PDF is out of MVP scope** (POC, 2026-07-08) — the client-facing document polish is deferred; CSV is the release bar.
- **Change ID:** kosztorys-export
- **PRD refs:** FR-008
- **Prerequisites:** S-01
- **Parallel with:** the editor slices (S-02–S-10)
- **Blockers:** —
- **Unknowns:**
  - CSV shape for nested data (sections → items → stages) — flatten how? — Owner: user. Block: no.
- **Risk:** Reuses the existing export infrastructure (transfers already CSV-export); only the kosztorys-shaped render is new — which is why this is cheap.
- **Status:** deferred — parked 2026-07-10 into band 2 (import/export, last feature work before the editor is locked with tests). The export scope (what to actually export, CSV shape) rides on open POC decisions not yet settled; pick back up once the export contract is decided.

### S-13: Importer for existing sheet kosztorysy

- **Outcome:** the owner can import an existing sheet kosztorys into the app, writing only the new kosztorys tables.
- **Change ID:** kosztorys-importer
- **PRD refs:** FR-010, FR-016
- **Prerequisites:** S-01 (needs the editor schema; benefits from full parity S-01–S-10 to import every field)
- **Parallel with:** S-12 (export)
- **Blockers:** —
- **Unknowns:**
  - Importer trigger — what concretely triggers this second-release importer so "later" does not become "never"? Name a condition or date. (PRD Q8). — Owner: user. Block: no.
- **Risk:** Reads sheets, writes only new tables (additive). Guardrail: live sheet data must survive untouched until safely imported (FR-016). Risk: without a named trigger this slips indefinitely — resolve the trigger question before planning. **Note (2026-07-10):** no longer depends on the cutover (S-17) — moved ahead of it into band 2 per the reorder; import now happens before, not after, new investments go sheet-less.
- **Status:** deferred — band 2. Back-importing old sheet kosztorysy is unblocked only once the trigger question is answered.

### S-14: Editor E2E coverage (release gate)

- **Outcome:** the kosztorys editor flows are end-to-end-covered by the automated suite before the owner-facing release — sections/items/pricing/stages/subcontractor-pricing/VAT/snapshots/undo/delete-guard/column-rbac/client-share/preset/export/import exercised without a manual pass (autocomplete once its deferred slice ships).
- **Change ID:** editor-e2e-coverage
- **PRD refs:** FR-013
- **Prerequisites:** F-01, S-01…S-13 (all editor + import/export slices)
- **Parallel with:** S-15 (financial-core smoke)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the quality gate that lets the owner touch the editor only once it is verified. Deliberately deferred to band 3: the editor will churn heavily through band 1–2 while the direction settles, so standing specs up earlier only chases moving targets. Risk: once here, if coverage lags the slices it locks, the cutover gate (S-17) slips — write the specs close behind the settled editor.
- **Status:** deferred — band 3. Waits until the editor + import/export are built and the direction is stable. Gates S-17 (cutover).

### S-15: Financial-core smoke spec

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

### S-16: Pre-cutover hardening

- **Outcome:** the editor is hardened before the cutover gate — perf at 1000+ rows re-verified on the clean build, autosave failure/revert paths exercised, access rules (MANAGEMENT_ROLES full / EMPLOYEE none) enforced, and the POC shortcuts (per-browser localStorage, inv-7) removed.
- **Change ID:** kosztorys-hardening
- **PRD refs:** —
- **Prerequisites:** S-14 (E2E coverage in place before hardening so regressions surface)
- **Parallel with:** —
- **Blockers:** —
- **Risk:** This is the gate between "feature-complete editor" and "safe to make it the only authoring path" (S-17). Risk: skipping it pushes POC-grade shortcuts into the cutover.
- **Status:** deferred — band 3.

### S-17: New investments get no Google Sheet (cutover gate)

- **Outcome:** creating a new investment provisions no Google Sheet and nothing is synced; its kosztorys exists only in the app, authored through the editor.
- **Change ID:** new-investment-no-sheet
- **PRD refs:** FR-009, FR-014, FR-016, US-01
- **Prerequisites:** S-14 (E2E gate), S-16 (hardening) — transitively: all editor + import/export slices
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Escape hatch — does the owner ever want to opt a new investment back to a sheet, or is the cutover absolute? PRD resolved "stands as written" (no lingering sheet option); confirm at cutover. — Owner: user. Block: no.
- **Risk:** The release gate — only flips once full parity is built, E2E-covered (S-14), and hardened (S-16). Guardrail: the materiały-mirror must keep syncing for investments still on sheets (FR-014), and existing sheet kosztorysy stay accessible (FR-016). Risk: a half-built editor behind this flag recreates the two-worlds problem.
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

#### kosztorys-catalogue — FOLDED into S-09, then autocomplete CARVED OUT

- **FOLDED into S-09 (2026-07-09, owner).** FR-006 (add items via autocomplete, hand-typing
  always allowed) survives — it is **not cut** — but ships as part of the preset slice, not a
  standalone catalogue. Rationale: the POC already flagged the "podpowiadarka" as arriving _with
  szablony_ and deliberately kept prices as typed snapshots so a suggestion layer could sit on top
  (`context/reference/kosztorys-editor-domain-notes.md:179`).
- **Chosen model: A (preset-sourced).** There is **no separate catalogue table.** The "master
  price list" _is_ the union of `prace` across presets; autocomplete is a read-only view over
  that data, snapshotting opis + J.m. + price into the new item on select (overwritable per the
  snapshot rule). This dissolves the old seeding question (Q6) — building presets _is_ seeding the
  suggestions.
- **CARVED BACK OUT of S-09 (2026-07-11, owner).** S-09 narrowed to preset **seed + save-as**; the
  autocomplete (FR-006) becomes its own deferred slice **`kosztorys-item-autocomplete`**. Reasoning:
  it is the highest-UI-risk, lowest-marginal-value part (custom `react-datasheet-grid` cell — the
  repo has no async-search combobox precedent — plus the remount-`key`/frozen-columns dsg traps),
  and it is a strictly downstream, read-only view over preset `prace`, so it needs preset storage
  (which S-09 builds) to exist first and can land later with zero rework to the preset engine. With
  "seed-then-tweak" as the primary flow (seed on empty only), per-item suggestions barely get
  exercised. Model A (preset-sourced, snapshot-into-item) still stands; open question — duplicate
  prace across presets (show each vs dedupe by opis) — moves to that slice.
- **Change ID:** kosztorys-item-autocomplete (FR-006). **Status: deferred, unsequenced** — owner
  still deciding whether/when to build. To be numbered (renumber the tail, per the strict-numeric
  convention) into the editor band after S-09 when the owner commits.
- **PRD refs:** FR-006.
- **Was:** S-06 (pre-2026-07-10 numbering; as kosztorys-catalogue).

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
7. **Importer trigger (FR-010).** What concretely triggers the deferred importer? — Owner: user. Gates: S-13.
8. ~~**Settings-home UX.**~~ **Resolved (2026-07-15):** a **second row in the editor toolbar** — neither anticipated option (detail-inwestycji / a "Podsumowanie" panel). The global multipliers + VAT rate are always visible there; the Sekcje panel keeps only the per-section overrides. EX-478.
9. ~~**Preset scope (S-09).**~~ **Resolved (2026-07-11):** named library (`kosztorys_presets` table), picked by name at seed-time.
10. ~~**Preset save-as + retroactivity (S-09).**~~ **Resolved (2026-07-11):** save-as offers both new + overwrite; spawned kosztorysy stay frozen (snapshot).
11. **Duplicate prace across presets (`kosztorys-item-autocomplete`).** When autocomplete unions `prace` across presets, show each occurrence or dedupe by opis with a default price? — Owner: user. Gates: the deferred autocomplete slice (FR-006), not S-09.
12. **`Podsumowanie` parity + per-etap total (2026-07-15).** Two separate gaps, surfaced by inspecting the live sheet:
    - **(a) `Podsumowanie` tab has no slice.** Per-section totals + % share + Robocizna/Materiały/Łącznie. The app's section-summary panel covers the totals but not the % share or the split. Pure parity — the sheet's behaviour is the spec. Needs a slice number.
    - **(b) Per-etap total does not exist in the sheet.** New work, no parity to copy: decide whether "suma etapu" is an invoice figure (client price) or a payout figure (subcontractor price, under the active price view), and whether it's global or per-section. That answer decides whether it's a cheap `Σ V` readout or a distinct figure. — Owner: user. Gates: (b) blocks its own slice; (a) is plannable now.

## Parked

Lifted from PRD `## Non-Goals` — explicitly out of scope for this arc.

- **Mirror / Google integration teardown** — Why parked: removing the integration (design-spec Phase 3b) is a later change, triggered only after cutover is proven.
- **Bidirectional sheet ↔ app sync** — Why parked: the editor never reads from or writes to sheets; the one-shot importer (S-13) is the only exception.
- **Real-time collaborative editing** — Why parked: PRD non-goal.
- **Multi-currency** — Why parked: PLN only, confirmed non-goal.
- **Multi-tenant catalogues** — Why parked: single shared catalogue; PRD non-goal.
- **Schema-level customization** (per-investment custom columns / arbitrary-field sidecars) — Why parked: a free-text note field covers ad-hoc needs; PRD non-goal.
- **Observability / error tracking** — ~~parked~~ **un-parked 2026-07-11** into standalone slice **O-01 `sentry-observability`** (Sentry errors + tracing + replay, prod only). Runs independently of the editor arc.

## Done

(`/10x-archive` appends here when a change whose Change ID matches a roadmap item is archived.)

- **S-09: Kosztorys presets (templates)** — Archived 2026-07-11 → `context/archive/2026-07-11-kosztorys-preset/`. Named `kosztorys_presets` library (seed-new-from-preset + save-as-preset new/overwrite), reusing the S-06 serialize/apply engine; UI renamed preset→szablon, two save-as buttons merged into one. Lesson: a seed that runs after the parent row commits must be non-fatal — flipping the whole action to failure skips revalidation and invites a duplicate-creating retry. Browser E2E deferred → EX-442.

- **S-02: Three price models + pricing-view toggle** (was S-03) — Archived 2026-07-09 → `context/archive/2026-07-09-kosztorys-price-models/`. Core (three views + toggle + coefficient/override derivation) shipped in S-01; this change closed the residual polish (per-kosztorys view persistence, "Klient" relabel, pricing-model explainer tooltip). Lesson: —.
- **S-04: Subcontractor pricing (markup coefficient + override)** (was S-11) — Absorbed by S-01 (`kosztorys-sections-items`), which ported the POC's final `calc.ts` derivation verbatim; marked done here (no separate change folder). Lesson: —.
- **S-05: VAT per investment (netto entry, brutto computed)** — Archived 2026-07-10 → `context/archive/2026-07-10-kosztorys-vat/`. Lesson: a migration is "verified" only when the running app reads the new column — `payload migrate` "Done." is necessary, not sufficient.
