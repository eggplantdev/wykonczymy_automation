---
project: 'Wykonczymy — off-sheets phase 1'
version: 1
status: active
created: 2026-06-12
updated: 2026-09-17
prd_version: 1
main_goal: quality
top_blocker: none
---

# Roadmap: Wykonczymy — off-sheets phase 1

> Derived from `context/foundation/prd.md` (v1) + probed codebase baseline.
> Edit-in-place; archive when superseded.
> Slices are ordered by number (F-01, S-01…S-19; `O-01`/`O-02` are standalone, outside the arc), and the number _is_ the order — to reorder, renumber the slice, never move a row/block out of numeric sequence. The "At a glance" table is the index.

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
>   never wired because on a fresh sheet `O` equals `N` in practice, so `S` would duplicate `T` until
>   stage quantities are entered. **Corrected 2026-07-16 (EX-494):** `O` is not `=N` — it is
>   `=SUM(D:M)`, the ten stage-quantity columns, so **pomiar IS the stage sum** (see AGENTS.md, which
>   supersedes the 2026-07-15 reading below). Our przedmiar/pomiar are independent, so the column is
>   meaningful here: **built as
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
> Change-ids are the stable key (pure relabel). Design: `context/archive/2026-07-20-kosztorys-client-share/design.md`.

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
> decisions + owner's four calls: reconciled into this roadmap (the `kosztorys-mvp` decision
> register that captured them was deleted 2026-07-24 with no rescue needed — its content is this
> file); raw POC docs at `context/archive/kosztorys-poc-in-app/`.

## Where work is tracked

- **`roadmap.md` (this file) — source of truth for slices:** the v2 arc (`F-`/`S-` slices) + their `Status`, in the [At a glance](#at-a-glance) table. Dependency order, what to build next.
- **Linear "Wykonczymy" — live status + the ONLY home for ad-hoc todos:** mirrors slice status (flip to Done at archive) and holds every smaller / one-off task. No second todo file. Reality-check Linear access first (see AGENTS.md).
- **Linear "Wykonczymy"** — also the refactor / cleanup / known-bugs backlog (judgment-heavy, not PRD slices). Record new findings there, not in a standalone audit doc (per AGENTS.md).

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

Bands: **editor parity S-01–S-09** → **financial-plane bridge S-11–S-12** → **client share / import S-13, S-15** → **testing S-16** (**active**) → **cutover S-19** (done 2026-08-25). Every numbered slice is `done` except S-16, the E2E release gate — band 4 is the only band still open. S-10, S-14, S-17 and S-18 are missing on purpose — `kosztorys-column-rbac` (2026-08-18), `kosztorys-export` (2026-08-15), `financial-core-smoke` (2026-08-25) and `kosztorys-hardening` (2026-08-25) were cut whole and their numbers kept as tombstones; see [Cut & folded slices](#cut--folded-slices).

| ID   | Change ID                       | Outcome (user can …)                                                                    | Prerequisites      | PRD refs                      | Status   | Plan-ready |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------- | ------------------ | ----------------------------- | -------- | ---------- |
| F-01 | e2e-harness                     | (foundation) Playwright E2E harness, CI-runnable, isolated DB                           | —                  | FR-011                        | done     | —          |
| O-01 | sentry-observability            | capture prod errors + tracing + session replay in Sentry (standalone infra)             | —                  | — (owner request)             | proposed | yes        |
| O-02 | rwd-mobile                      | make the app usable on a phone: navigation, adding + showing transactions (standalone)  | —                  | — (owner request)             | done     | —          |
| S-01 | kosztorys-sections-items        | author kosztorys sections + items in-app with live totals                               | —                  | FR-001, FR-002, FR-007, US-01 | done     | —          |
| S-02 | kosztorys-price-models          | record three price models per item and toggle the pricing view                          | S-01               | FR-003                        | done     | —          |
| S-03 | kosztorys-stages                | manage stages (etapy) and record per-item, per-stage progress                           | S-01               | FR-004                        | done     | —          |
| S-04 | kosztorys-subcontractor-pricing | price subcontractor work via markup coefficient + per-item override                     | S-01, S-02         | — (POC)                       | done     | —          |
| S-05 | kosztorys-vat                   | set VAT per investment; enter net, compute gross                                        | S-01               | — (POC)                       | done     | yes        |
| S-06 | kosztorys-snapshots             | save + restore point-in-time versions of a kosztorys (durable net)                      | S-01               | — (owner request)             | done     | yes        |
| S-07 | kosztorys-undo                  | fast in-session undo/redo of the last editor edit(s)                                    | S-01               | — (owner request)             | done     | yes        |
| S-08 | kosztorys-delete-guard          | confirm-then-snapshot when deleting a populated row / section / stage / column (EX-477) | S-01               | — (owner request)             | done     | yes        |
| S-09 | kosztorys-preset                | seed from a preset; save as preset (autocomplete carved out → EX-434, since cut)        | S-01               | (owner request)               | done     | yes        |
| S-11 | kosztorys-bridge                | read kosztorys figures joined into the investment financial plane (read-only)           | S-01, S-03         | — (owner request)             | done     | —          |
| S-12 | robocizna-from-kosztorys        | see investment robocizna + rabat derived from the kosztorys, not manual transfers       | S-11               | — (owner request)             | done     | —          |
| S-13 | kosztorys-client-share          | share a live, read-only client view of a kosztorys via a token link (EX-532)            | S-01, S-02, S-04   | — (owner request)             | done     | —          |
| S-15 | kosztorys-importer              | import an existing sheet kosztorys into the app                                         | S-01 (full parity) | FR-010, FR-016                | done     | —          |
| S-16 | editor-e2e-coverage             | (gate) rely on automated E2E over the editor before release                             | F-01, S-01…S-15    | FR-013                        | deferred | —          |
| S-19 | new-investment-no-sheet         | create a new investment with no Google Sheet, kosztorys app-only                        | S-16               | FR-009, FR-014, FR-016, US-01 | done     | —          |

**Cut / folded (unnumbered):** `kosztorys-rooms` — CUT (pokoje out of scope, 2026-07-08). `kosztorys-catalogue` — FOLDED into S-09 (2026-07-09), then the autocomplete carved back out as `kosztorys-item-autocomplete` — now CUT (2026-07-28, superseded by EX-503 section-append). See [Cut & folded slices](#cut--folded-slices).

## Bands

Navigation aid — the five execution bands and what gates the jump between them.

| Band | Theme                  | Slices          | Gate to next band                                                                                        |
| ---- | ---------------------- | --------------- | -------------------------------------------------------------------------------------------------------- |
| 1    | Editor parity          | `S-01` … `S-09` | Editor feature-complete: every POC decision + braindump todo built.                                      |
| 2    | Financial-plane bridge | `S-11` → `S-12` | Kosztorys figures readable from (and authoritative for) the investment plane — read-only, no write-back. |
| 3    | Client share / import  | `S-13` → `S-15` | Last feature work before the editor is locked with tests.                                                |
| 4    | Testing (**active**)   | `S-16`          | E2E deferred to here on purpose — specs stabilise only once the editor direction settles.                |
| 5    | Cutover / release      | `S-19`          | **Reached 2026-08-25** without a flip: nothing provisioned a sheet, and the app now seeds the kosztorys. |

**Band 2 inserted 2026-07-20 (owner: "separate slices").** `kosztorys-bridge` and
`robocizna-from-kosztorys` were being built with no roadmap row. They are not editor parity — they
join the kosztorys to the investment financial plane — so they earn their own band rather than a
band-1 tail, and it is placed **before** import/export because it is the work actually in flight.
Inserting it cascaded the tail by two: client-share S-11→S-13, export S-12→S-14, importer S-13→S-15,
e2e S-14→S-16, smoke S-15→S-17, hardening S-16→S-18, cutover S-17→S-19. Change-ids are the stable
key (pure relabel).

**Band 2 reopened 2026-08-18 (EX-649, `marza-prognoza-rzeczywista`).** `S-11`/`S-12` joined the
kosztorys to the financial plane; this change adds the figure that plane was missing — a marża that
prices the crew from the kosztorys instead of from wypłaty, plus a przedmiar-based prognoza. It rides
on the same seam, so it is band-2 work rather than a new slice: no roadmap row, tracked in Linear as
EX-649. What it changes structurally is that `marginV2` stands **beside** `calculateMargin`; nothing
in bands 1–5 is redirected by it.

Within band 1, `S-01` (north star) heads the track; `S-02`–`S-09` all build on it and run in parallel (`S-04` also needs `S-02`). `F-01` (harness) is independent and can run any time; it unblocks the band-4 test slices. `O-01` (Sentry observability) and `O-02` (RWD) are likewise standalone — no dependency on any slice, ship any time.

## Baseline

What's already in place in the codebase as of 2026-06-12 (probed + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Next.js App Router, Tailwind v4, Shadcn UI, React Compiler (`src/app/(frontend)`, `src/components/ui`).
- **Backend / API:** present — Payload CMS collections + server actions via `protectedAction()` (`src/collections`, `src/lib/actions`).
- **Data:** present — Postgres (Neon prod / docker local on 5433), Payload migrations, raw SQL via `@vercel/postgres` (`src/lib/db`, `src/migrations`).
- **Auth:** present — JWT `payload-token` cookie, four roles (ADMIN/OWNER/MANAGER/EMPLOYEE) (`src/lib/auth`, `src/access`).
- **Deploy / infra:** present — Vercel (build runs `generate:types` + `next build`; migrations applied deliberately, not by build).
- **Observability:** partial — `perfStart()` perf logging only; no error tracking (`global-error.tsx` has no reporter). **Un-parked 2026-07-11 into O-01 `sentry-observability`** (still `proposed`, EX-433) — the original "out of scope for this phase" no longer holds.
- **Test / E2E:** present — Vitest unit specs under `src/__tests__`; Playwright harness under `e2e/` (F-01 done). → band 4 grows coverage on top.
- **In-app kosztorys editor:** building — kosztorys was Google-Sheet-backed (the `kosztoryses` collection holds a sheet id, UI is `iframe-view.tsx` + a one-way `INVESTMENT_EXPENSE` mirror + sync button — `src/collections/sheets.ts`, `src/components/sheets`). The in-app editor ships across band 1 (S-01+), porting the POC's tested core (`calc.ts`/`v2-rows.ts` + `kosztorys_sections/items/stages/stage_progress` schema). See `context/archive/kosztorys-poc-in-app/`.

## Foundations

### F-01: E2E test harness

- **Outcome:** (foundation) a Playwright harness is installed and CI-runnable against an isolated test database, with an auth fixture and one green smoke spec; no operator-driven MCP session required to run it.
- **Change ID:** e2e-harness
- **PRD refs:** FR-011
- **Unlocks:** S-16 (editor E2E coverage), the transfer/financial-core specs (S-17 cut 2026-08-25 — the harness is what let its legs be written slice by slice), and the FR-013 release gate; reduces the migration-risk guardrail by giving the financial core automated regression protection.
- **Prerequisites:** —
- **Parallel with:** the whole editor band (no dependency on the harness).
- **Blockers:** —
- **Unknowns:**
  - Test-data isolation strategy — self-seed unique per-run data against the dump-restored docker DB. — Owner: team. Block: no.
- **Risk:** Every band-4 E2E slice depends on it and the financial core is guardrail #1. Risk: a flaky harness erodes trust in the suite — keep the first spec minimal and deterministic.
- **Status:** done — harness shipped; `e2e/` carries `global-setup.ts` + auth fixture and **32 spec files / 67 tests** against the isolated 5435 `db-test` container. Band-3 slices are unblocked.

### O-01: Sentry error tracking + tracing + session replay

- **Outcome:** production runtime failures are captured and triageable — unhandled exceptions (client via `global-error.tsx`, server via the `protectedAction()` catch path + Payload route handlers), performance tracing spans, and session replays flow to a Sentry project. Replaces the current blind spot where a failed prod write is invisible unless a user reports it.
- **Change ID:** sentry-observability
- **PRD refs:** — (un-parks the parked "Observability / error tracking" non-goal; owner request 2026-07-11)
- **Prerequisites:** — (independent of the whole S-arc, like F-01; can ship any time)
- **Parallel with:** everything
- **Placement:** standalone infra slice, outside S-01…S-19 — not renumbered into the editor arc.
- **Scope:** `@sentry/nextjs` — errors + tracing + session replay, **production only** (gate init on env so preview/local stay silent and the free quota stays clean). Free Developer tier: 5k errors / 5M spans / 50 replays per month, 1 seat — sufficient for this low-traffic internal tool.
- **Problems to solve at plan time:**
  - **Env layer:** `SENTRY_AUTH_TOKEN` (build, source maps), `NEXT_PUBLIC_SENTRY_DSN`, and an env gate — all through `src/lib/env/schema.ts`, never raw `process.env` (AGENTS.md). `NEXT_PUBLIC_SENTRY_DSN` is client-side → `env/index.ts`; the token is build-only.
  - **Replay privacy (load-bearing):** replay records real sessions containing financial data (registers, marża, client amounts). Must enable `maskAllText` / `blockAllMedia` and verify no money figures leak into replays before this ships. This is the main risk.
  - **Source maps on Vercel:** the Sentry build plugin needs the auth token in the Vercel build env; confirm it doesn't fight the existing `generate:types` + `next build` pipeline.
  - **Instrumentation surface:** `instrumentation.ts` + `sentry.client/server/edge.config.ts`; wire `global-error.tsx` (currently no reporter) and confirm `protectedAction()` errors surface (Next auto-instruments server actions, but verify).
  - **Quota guard:** low `tracesSampleRate` / `replaysSessionSampleRate` so 5M spans / 50 replays aren't burned; keep `replaysOnErrorSampleRate` higher (replay only when something breaks).
- **Risk:** additive, touches no financial write path. Primary risk is a **PII/financial-data leak via unmasked session replay** — the guardrail is verifying masking on a real prod-shaped session before enabling replay. Secondary: source-map upload misconfig makes stack traces useless (unminified verification needed). Seat limit (1 user) caps triage to the owner — acceptable now.
- **Status:** proposed

### O-02: RWD — make the app usable on a phone

- **Outcome:** on a phone a user can navigate the app, add a transaction, and read the transaction list without fighting the layout. Not desktop parity — the three named flows work, the obvious breakage everywhere else is gone.
- **Change ID:** rwd-mobile
- **PRD refs:** — (owner request 2026-09-16)
- **Prerequisites:** — (independent of the whole S-arc, like F-01 and O-01; can ship any time)
- **Parallel with:** everything
- **Placement:** standalone cross-cutting UI slice, outside S-01…S-19 — not renumbered into the editor arc.
- **Scope:** phased, explicitly NOT a parity push. Must work on mobile: **navigation**, **adding a transaction**, **showing transactions**. The in-app kosztorys editor is a desktop surface by the owner's call — in scope only to the extent that it must not break the page.
- **Phases (approved 2026-09-16):**
  1. **Shell** — root-cause + fix the horizontal overflow; a mobile menu in the top bar, reusing the sidebar's existing link data (`SECTION_LINKS` + `MANAGEMENT_LINKS`, role gating, unread badges) rather than redefining it; one z-index scale as `@theme` tokens.
  2. **Primitives** — `DialogContent` full-height on mobile; `PopoverContent` / `CommandList` collision-aware. Two files, every caller fixed at once.
  3. **The two named flows** — the three top-bar transfer dialogs + expense form, and the filters + transfer table, working end to end on a phone.
  4. **The rest** — scoped after 1–3 land.
- **Decisions taken while shaping:**
  - **The shell's mobile↔desktop switch moves from `lg` (1280) to `sm` (768).** `globals.css:27` already declares `sm` as this app's single mobile→desktop line; the shell disagreeing with it is why 768–1280 currently gets neither the sidebar (`nav/sidebar.tsx:87` is `hidden … lg:flex`) nor any menu. Tablets get the sidebar back.
  - `nav/app-footer.tsx`'s `h-14` is load-bearing for the kosztorys editor's viewport math — change one, change the other.
- **Problems to solve at plan time:**
  - **The overflow's root cause is NOT identified.** The containers that should leak (`ui/data-table/data-table.tsx:185`, the kosztorys grid) are already `overflow-x-auto`, and the shell has the `min-w-0` fix at `(frontend)/layout.tsx:62`. Measure it in a browser; do not guess. An `overflow-x-hidden` backstop on `body` is worth having but MASKS the cause — root-cause first.
  - **The z-index scale is ad hoc and contradictory.** Dialog `10000`, AlertDialog + toasts `10001`, Popover/DropdownMenu/Tooltip `50`, sidebar/top-nav `40`, datasheet frozen columns `30`. So a Popover or DropdownMenu opened **inside a dialog** paints under the dialog overlay; `ui/combobox.tsx:124` already hardcodes `z-10001` to escape it. Replace the free-for-all with tokens and drop the plaster.
  - **Popovers ignore the viewport:** `PopoverContent` is a fixed `w-72` with no `max-w`, `CommandList` a hard `max-h-[300px]` (`ui/command.tsx:88`). Neither consults Radix's `--radix-*-available-height` / `-available-width`, so on a 360px viewport with the keyboard up the list is boxed off-screen.
  - **Dialogs float:** `DialogContent` is `max-w-[min(90vw,600px)] max-h-[90vh]` centred with `top-1/2 left-1/2 -translate-*`; the virtual keyboard shoves it around.
  - **Filters wall up:** `filters/filter-grid.tsx` is `flex flex-wrap`, so ~10 trigger buttons stack above the table. The „Filtry" fold (2026-09-16) helps; the row still needs a deliberate mobile form.
  - **Baseline to respect:** only 19 of 479 `.tsx` files use `sm:` at all (35 occurrences). This is a desktop-first codebase — prefer fixing shared primitives over sprinkling breakpoints per component.
- **Risk:** touches shared `ui/` primitives (dialog, popover, command) and the app shell, so a regression is visible on every desktop screen too, not just mobile. No financial write path is involved. The z-index retokenization is the sharpest edge — it silently reorders every overlay in the app.
- **Status:** done

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
- **Status:** done (EX-395). Implemented on `kosztorys-sections-items` (change.md `implemented`, 2026-07-08) and shipped; every later editor slice builds on it.

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
- **Shipped adjacent, not part of this slice:** the stage **value** axis (the sheet's `V–AE`) — a computed `kwota netto` + `kwota brutto` column per stage, brutto hidden by default. `context/archive/2026-07-15-kosztorys-stage-values/`, 2026-07-15. It reverses S-03's plan's "no brutto column" exclusion; S-03's own scope is unchanged. Distinct from open question 12(b), which is a total **along** the stage axis and stays open.
- **Status:** done (EX-398). `change.md` `impl_reviewed`; the stage-value axis shipped adjacent (see above).

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
- **Status:** done

### S-06: Snapshots (point-in-time version history)

- **Outcome:** a Manager+ user can **save a named snapshot** of a kosztorys and later **restore** it, reverting the whole kosztorys (sections + items + stages + progress) to that saved point; the system also takes an **automatic snapshot before a destructive cascade delete** (section / stage delete) as a safety net. This is the **durable** recovery layer — snapshots survive reload and target the "a bad edit / a cascade delete noticed a day later, after the client may have seen it" failure that in-session undo (S-07) cannot catch.
- **Change ID:** kosztorys-snapshots
- **PRD refs:** — (owner request, 2026-07-10)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-05, S-07–S-09). **Independent of S-07** — undo does not depend on snapshots and vice-versa.

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

- **Status:** done (EX-403 + EX-526 hardening, 2026-07-18). Re-integrated onto staging; manual checks (S-07 Faza 4) signed off. Archived → `context/archive/2026-07-18-kosztorys-undo/`. Deferred DB-integration E2E → EX-525 (`e2e-backlog`); owed `hasPendingBurst` unit delivered by EX-521 (`undoAvailability`, 2026-08-17) — the `renderHook` premise was refuted, the logic was extracted instead.
- **Outcome:** the editor supports **undo/redo** of recent actions — cell edit, stage-progress edit, reorder, and single-row add/delete — via a toolbar button **and Cmd+Z / Cmd+Shift+Z**, so the spreadsheet-parity bar includes instantly reversing a fat-finger without reaching for a snapshot. In-session (the stack lives in the browser tab, gone on reload); durable recovery is S-06's job.
- **Change ID:** kosztorys-undo
- **PRD refs:** — (owner request)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-06, S-08–S-09). **Independent of S-06.**

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

### S-08: Confirm-gated delete for populated rows / sections / stages / columns

> **Policy reversed by EX-477 (2026-07-17, owner).** The original "hard-block a populated delete,
> clear the values first" rule was **too rigid** — the owner wants to delete a whole populated
> section/item/stage in one move. New rule: a populated delete is **allowed behind a confirmation
> dialog**, and every destructive delete that can take child data with it (item, section, stage/column)
> takes an **auto snapshot right before deleting** (`captureAutoSnapshot`), so it is recoverable via
> S-06 restore. The server actions no longer reject a populated delete; the client owns the confirm.
> The empty-sheet floor (a kosztorys keeps ≥1 item) survived as the one remaining hard block, and was
> itself removed on 2026-08-31 (owner: a kosztorys may be emptied to zero, EX-751 canceled) — there is
> no hard block left, and every item delete confirms, populated or not.
> Change doc: `context/archive/2026-07-17-kosztorys-delete-confirm/`.

- **Outcome:** deleting a kosztorys row (item), a section, a stage, or a stage-column that **holds recorded work** goes through a **confirm dialog**, then deletes after taking a pre-delete auto snapshot. No delete is hard-blocked anymore — the last remaining item included (floor removed 2026-08-31).
- **Change ID:** kosztorys-delete-guard (superseded by `kosztorys-delete-confirm` — EX-477)
- **PRD refs:** — (owner request, 2026-07-10; policy reversed 2026-07-17)
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-07, S-09)
- **Blockers:** —
- **Scope:** the confirm-and-snapshot flow covers an **item** (`RowActionsMenu`), a **section** (`SectionSummary`, cascades its items + `stage_progress`), and a **stage/column** (`StageHeader`, cascades its `stage_progress`). "Populated" = the row/subtree holds recorded `stage_progress` — that is the only work a delete destroys and the only case that pops the confirm; a plan-only row deletes without a prompt.
- **Split note:** carved out of the old `kosztorys-column-locking` slice (2026-07-10); the role-based visibility half moved to **S-10 `kosztorys-column-rbac`**, since cut (2026-08-18) — see [Cut & folded slices](#cut--folded-slices). The hard-block half then reversed to confirm-gated (EX-477).
- **Risk:** the snapshot must be taken **inside the server action, before** the cascade delete — a client-only snapshot races autosave and misses the pre-delete state. The confirm is client-side UX; recoverability is the server's job.
- **Status:** done (EX-477)

### S-09: Kosztorys presets (templates)

- **Outcome:** a Manager+ user can (a) seed a new kosztorys from a preset — a reusable skeleton of sekcje + prace + prices — instead of starting blank, and (b) save an existing kosztorys back as a preset. Restores the legacy Sheets behaviour (`KOSZTORYS_TEMPLATE_SHEET_ID` seeded new sheets from a template) that the in-app editor dropped in S-01 — a parity gap the original roadmap never captured.
- **Shipped 2026-07-11 (EX-414, Done).** The autocomplete-over-preset-prace part (FR-006, item (c)) was **carved out** at plan time (owner, 2026-07-11) into a separate deferred slice → **EX-434** (`kosztorys-item-autocomplete`, **CUT 2026-07-28** — superseded by EX-503 section-append); S-09 shipped presets-only. Review gate filed EX-438/439/440/441 (tech-debt) and EX-442 (owed E2E, `e2e-backlog`).
- **Change ID:** kosztorys-preset
- **PRD refs:** owner request (2026-07-09; not in the original PRD). FR-006 (autocomplete) was folded in here on 2026-07-09, then **carved back out** on 2026-07-11 (owner) as its own slice, which was **cut 2026-07-28** — see [Cut & folded slices](#cut--folded-slices). S-09 no longer ships autocomplete, and nothing else will.
- **Prerequisites:** S-01
- **Parallel with:** the other editor + export slices (S-02–S-08, S-11–S-13)
- **Blockers:** —
- **Settled shape (owner, 2026-07-09):**
  - A preset = a kosztorys with the job-specific fields stripped. **Keep:** sekcje (structure), prace (opis), J.m., prices, coefficients/overrides. **Reset:** przedmiar/pomiar (amounts), rabat (discount), stage progress (S-03), note.
  - **Snapshot pricing throughout.** Preset prices are _seed-defaults only_ — copied in as an initial value, then owned/overwritable per item. Never a live source of truth. Rationale: the same work costs differently investment-to-investment (different team → different price), so a centralised/live price is wrong. This mirrors the PRD's catalogue snapshot rule (a later master-price change never touches existing items) and extends it to presets.
- **Resolved (decision 9, owner 2026-07-11):** named library, one row per preset in a new global `kosztorys_presets` table (`{id, name, schema_version, payload jsonb, created_at, created_by}`); reuses the S-06 serialize/apply engine via a forked `restoreKosztorys`. See `context/archive/2026-07-11-kosztorys-preset/change.md`.
- **Resolved (decision 10, owner 2026-07-11):** save-as offers **both** save-new and overwrite-existing; kosztorysy already spawned from a preset stay **frozen** when the preset is later edited (snapshot rule). Seed target v1 = **empty kosztorys only** (insert-only, no wipe/append/pre-apply snapshot).
- **Risk:** The preset carries _structure_ (sekcje → prace) with embedded snapshot prices. Risk: letting a preset link become a live price authority reintroduces the centralisation the owner explicitly rejected. Keep prices embedded + overwritable.
- **Status:** done

### S-11: Read-only bridge to the financial plane

- **Outcome:** the kosztorys and the investment financial plane (materiały / zaliczki / transfers) are joined **live, on read** — the editor's Podsumowanie shows a Robocizna / Materiały / Łącznie split with materiały summed from the investment's transactions, plus „Wpłaty" and „Do zapłaty". Also lands the 6 plannable parity rows from `kosztorys-parity-gaps` (folder folded into `context/archive/2026-07-18-kosztorys-bridge/change.md`).
- **Change ID:** kosztorys-bridge
- **Linear:** EX-530
- **PRD refs:** — (owner request, 2026-07-18). Closes the [Open Roadmap Questions](#open-roadmap-questions) 12(a) Robocizna/Materiały/Łącznie split.
- **Prerequisites:** S-01, S-03 (executed Σetapów is the figure being joined)
- **Parallel with:** the editor slices (S-02–S-09)
- **Blockers:** —
- **Locked in shaping (owner, 2026-07-18):**
  - **Read-only for this arc.** Write-back (auto-`LABOR_COST` from the rozpiska sum, rabat unification) is a separate later change, decided only after the read side is dogfooded. The FR-015 write firewall stays intact.
  - **No sync machinery.** Same Postgres — query at render + the existing cache-tag revalidation. The v1 mechanisms (Synchronizuj button / mirror tabs / iframe) are obsolete and are never rebuilt.
  - **Access control unchanged** — new surfaces inherit ADMIN/OWNER/MANAGER gating.
- **Zaliczka model — decided 2026-07-19 by reading `calculate-balance.ts`, not by picking an option.** `Bilans inwestora = totalIncome − (materiały + robocizna) + rabat`, so „Wpłaty" = `totalIncome` (every investment-attached deposit type) and „Do zapłaty" = `−Bilans` — matching the investment page by construction. The per-etap `kosztorysStage` deposit tag stays a separate, sparser signal for the „Suma transzy" table only; the old etap-tagged-Σ source was dropped because it returned `{}` for nearly every investment, silently hiding „Wpłaty".
- **Risk:** a read-only join, so no write path is touched — but it is the first surface where a kosztorys figure and a financial-plane figure sit side by side, which makes any disagreement between them visible to the owner. Guardrail: the two must be derived from one source, not computed twice (the review gate caught exactly this class — recon parity across editor Podsumowanie + investment page).
- **Status:** done

### S-12: Robocizna + rabat derived from the kosztorys

- **Outcome:** an investment's **robocizna** and **rabat** come from the kosztorys („Suma prac wykonanych" — executed Σetapów, client view, pre-rabat; and the unified global-or-Σper-item rabat) instead of hand-entered `LABOR_COST` / `RABAT` transfers. Those transfers were temporary workarounds — the two "no source register" billing figures that only ever existed to carry a number, never cash.
- **First increment is the reconciliation instrument, not the flip.** The Podsumowanie compares the transaction figures (Σ `LABOR_COST`, Σ `RABAT`) against the kosztorys figures at 1-grosz tolerance and **screams on mismatch** (bold red figure + `!` + tooltip), forcing the Rabat row visible when either side is non-zero. Read-only — this is the instrument that proves population is correct _before_ any per-investment source flip.
- **Change ID:** robocizna-from-kosztorys
- **Linear:** EX-535 (sub-work: EX-541 recon scream / price view, EX-542 Suspense streaming)
- **PRD refs:** — (owner vision, 2026-07-19)
- **Prerequisites:** S-11 (the read-side join it builds on)
- **Parallel with:** the editor slices (S-02–S-09)
- **Blockers — two open, both the same trap on different figures.** Each gates this slice's **archive** (not its implementation). Both were answered by the owner 2026-07-21 and banked in `context/reference/kosztorys-editor-domain-notes.md` (sekcja VAT / rekoncyliacja).
  - **EX-536 (Q1) — zaliczka netto czy brutto?** Owner ruled **both**; the **entry axis is now shipped** — each deposit stores a `vatPlane` flag (NET/GROSS/null, **null⇒netto** per the 2026-07-23 flip), surfaced in the tryb-mieszany reconciliation where the gotówka target is **derived from the netto wpłaty**, not typed. **This is presentation-only** (it does not yet feed bilans/marża — the ledger plane is untouched). What remains open for _this_ slice's archive: whether the reconciliation figure should feed the P&L at all, on which axis.
  - **EX-539 (Q2) — is the rabat transaction entered netto or brutto?** Rabat was settled as a reduction of prace, so it has a netto/brutto dimension. If the owner thinks "rabat off the gross" and types gross, Σ rabat is brutto while the kosztorys rabat is netto — and the scream false-fires by exactly the VAT (1000 netto vs 1230).
- **Not a write-back, and does not cross FR-015** (a _write_ firewall). Marża and bilans are already computed on read; only the _source_ of two of their inputs changes. No new transactions, no mutation of the kosztorys. wypłaty / strata / materiały stay transactions — they are real cash with a source register.
- **Why the symmetry matters:** one rabat figure (the kosztorys one) feeds the one `totalRabat` term, which dissolves the pre/post-rabat double-count.
- **VAT axis — the working model, NOT yet settled.** As implemented, reconciliation compares **netto ↔ netto**: the ledger plane is treated as carrying no VAT (robocizna, rabat, materiały, korekta, wpłaty all nominal, never grossed up), VAT being a **prace-only** concept on the client-price plane. So the kosztorys side is never grossed before comparison — grossing it false-fires the scream by the entire VAT amount. **But this rests on an unverified premise: that the owner actually types those transactions netto.** Nobody has confirmed it, and EX-536 / EX-539 above are exactly that question asked of zaliczka and rabat. If either turns out to be entered gross, this axis is wrong for that figure and the comparison must gross the kosztorys side (or de-gross the transaction) for it. Treat „netto ↔ netto" as the current assumption to be validated during population, not as the decided answer. Background: `context/reference/kosztorys-editor-domain-notes.md` („VAT dotyczy wyłącznie prac").
- **Transition plan (owner, 2026-07-19) — not a flag day.** Two independent switches: a **read switch** (`deriveFinancials` sources robocizna/rabat from the kosztorys) and a **write switch** (stop offering `LABOR_COST`/`RABAT` as manual transfer types). Per-investment cutover is gated on an **explicit "verified/populated" flag**, flipped by hand only after the owner confirms both figures match during population — **not** an implicit "has rows" check, so a stray row can never silently reassign an investment's authoritative figures. Un-flipped investments keep the transaction-sum fallback, so live investments without a kosztorys don't read 0.
- **Risk:** this reassigns the source of two figures that feed marża and bilans — the highest-consequence read change in the arc. Guardrail: the explicit per-investment flag + the fallback, so no investment silently changes its numbers.
- **Still open, for whoever builds the read switch:**
  - **Listing-page perf — the real engineering cost.** The detail page already loads the tree (free), but the investment _listing_ runs every investment through `deriveFinancials`, and the client-view net total lives in TS settlement over up to 1000+ rows each. Either load N trees on the listing or replicate the client-view-net formula in SQL.
  - **Where the read runs** — inside `deriveFinancials` (every consumer inherits it) vs a dedicated server join in `sum-transfers.ts`. Leaning `deriveFinancials`.
  - **Existing `LABOR_COST` / `RABAT` rows on live investments** — these are real transfers, not throwaway kosztorys data. Ignored once the source flips, or removed?
  - **Sheets slots are position-frozen.** `LABOR_COST` owns summary slot 2 in `TRANSFERS_SUMMARY_TYPES`, written as a column-positioned SUMIF. When those transfers stop being entered the columns go to 0 — leave the slots as 0-placeholders (frozen-contract lesson); deleting them shifts old investments' sheet formulas.
  - **Fixed-price job with no kosztorys** — does that case still need a manual robocizna/rabat override, or is „no kosztorys → 0" acceptable?
  - Retiring the `LABOR_COST` type itself is otherwise safe: it has no source register (the recalc hook only busts caches, never moves a balance) and the cancellation path is type-agnostic. What it is _not_ is optional — it's the positive base of both marża and bilans, so the number still has to arrive, just from elsewhere.
- **Status:** done
- **Shipped beyond the entry-axis (zaliczka-v2 batch, → staging 2026-07-24).** The EX-536 presentation layer grew past the deposit flag into a full **tabbed Podsumowanie** on branch `konradantonik/ex-536-zaliczka-v2`: a netto / brutto / **Mieszane** money axis, materiały **brutto→netto** reduction (owner-set % control), per-plane deposit + per-category wydatki breakdown tables, and the „Postęp prac" bar moved into the Robocizna tab. **Still presentation-only** — same caveat as the entry-axis: it does not feed bilans/marża, so it does not unblock this slice's archive. Change folders: `kosztorys-zaliczka-v2` + `kosztorys-tryb-mieszany` (both `implemented`).
- **Planned follow-ons:** **EX-564** (`kosztorys-percent-rabat-bulk-apply`) — percent global rabat becomes a one-shot „Zastosuj" that writes per-item rabaty; **implemented + review-gate passed, in review** pending manual verification (2026-07-24). **EX-565** (`etap-tool-plane`) — per-etap z/bez-narzędzi plane + one view-independent podwykonawcy settlement (Todo, docs-only, no impl commits). Both are Podsumowanie/kosztorys work tracked in Linear.

### S-13: Client share view (live, read-only, token link)

- **Outcome:** the owner can share a **live, read-only client-facing view** of a kosztorys via a token link. The client reopens the URL over the life of the job and sees current per-etap progress (not a frozen offer). WYSIWYG on the active columns + totals; the subcontractor cost view (z narzędziami / bez narzędzi) is **never** shown.
- **Change ID:** kosztorys-client-share
- **Linear:** EX-532
- **PRD refs:** — (owner request, 2026-07-18)
- **Prerequisites:** S-01, S-02 (pricing view), S-04 (subcontractor derivation — the thing being kept out)
- **Parallel with:** the editor slices (S-02–S-09) and the other band-3 slice (S-15)
- **Blockers:** —
- **Core safety principle:** prices are computed live via `calc.ts`; the entire leak surface is the `view` argument. The client path **hardcodes `view: 'client'`** so subcontractor prices are never computed (not filtered — never derived). Reinforced structurally by a `ClientKosztorysViewT` DTO that carries no coeffs/overrides. **Safety lives in the data projection, never in a component conditional** — a prop-gated price branch is exactly the leak this design rules out.
- **Scope:** a `kosztorys-shares` table keyed on `investment` holding the token (generate/rotate/revoke = OWNER/ADMIN) → one projection core behind two entrances, `getClientKosztorysByToken(token)` (unauthenticated) and `getClientKosztorysPreview(investmentId)` (authed) — unlike `getKosztorysTree`, which self-guards → an **always-available** „Podgląd dla klienta" linked directly from the kosztorys, independent of share state (owner, 2026-07-20) → public `(share)` route `/k/[token]`, `noindex`, bare layout → a read-only render reusing the editor's presentation primitives with client-safe data.
- **Out of scope (separate slices):** Google Sheet export, PDF export (may be dropped — a live link beats a static file).
- **Risk:** a live public URL that leaks the subcontractor cost view defeats the purpose. Guardrail: assert at the projection boundary that `view` is pinned to `'client'` and the DTO carries no subcontractor fields — verified by a test inspecting the client payload, not the DOM. Design doc: `context/archive/2026-07-20-kosztorys-client-share/design.md`.
- **Status:** done — implemented 2026-07-20 across 4 phases (`fe143fbe`, `88fcf326`, `218383c4`, `ec12f15f`) on branch `konradantonik/ex-532-kosztorys-client-share`. Local migration `20260720_0_add_kosztorys_shares` applied; automated checks green (typecheck, lint, `pnpm build` compiling `/k/[token]`, 1087 unit tests incl. the leak-boundary and share-lifecycle specs). Slice review gate ran 2026-07-20 (ledger `context/archive/2026-07-20-kosztorys-client-share/review-gate.md`): 7/7 read-only checks + `/simplify`; the critical finding (public `/k/<token>` 307ing to login — Next renamed `middleware.ts`→`proxy.ts`) was caught and fixed, all findings closed. Two follow-ups filed: EX-549 (hiddenInExport editor control) and EX-550 (`e2e-backlog`: cookie-less `/k/<token>` reachability guard). The manual browser checks in `manual-checks.md` (8/8) were ticked 2026-07-24, clearing the archive blocker; `kosztorys-client-share` archived → `context/archive/2026-07-20-kosztorys-client-share/`. Remaining: the prod migration when the code ships. Earlier context — resumed 2026-07-20 (owner: domain rework "mostly settled"; the editor stays under active development and that is accepted as controlled). Plan revised and approved, no code yet. Two corrections applied on resume: the token lives in its own `kosztorys-shares` table, not on `kosztoryses` (that slug is the v1 Google-Sheet link row, whose `googleSheetId` is required — a sheet-less v2 kosztorys could never have been shared); and the design's "v2 is disconnected from the app's financials" premise is stale (EX-541 added a read-only recon bridge — a comparison surface, never a data feed, and the client payload carries no reconciliation at all). The no-second-render concern still resolves via a single column-config + `clientVisible` flag + read-only reuse of the editor grid. **Superseded 2026-07-20 by change `kosztorys-client-view-reuse` (commits `4af855c0`, `d270ff22`):** the bespoke `ClientKosztorysView`/`ClientKosztorysFooter` render is torn out and replaced by a read-only reuse of the real admin `KosztorysEditorBody` mounted in a new `clientView` mode (`view:'client'` + `readOnly` + `clientVisible` column filter + hidden chrome). **Leak posture reversed (owner decision):** the field-stripping `toClientView`/`ClientKosztorysViewT` DTO is **retired** — the client now ships the full tree, kept safe by the pinned client view + read-only render + hidden chrome, not by projecting the payload. This makes the "Core safety principle"/"Risk" DTO-projection bullets above obsolete for the shipped implementation. **EX-549 cancelled 2026-08-15, column dropped 2026-08-18:** the retired `toClientView` was the only reader of `hiddenInExport`, and hiding rows for the client shipped as a rule instead (EX-695's „ukryj puste pozycje" filter), so the per-row flag never got a consumer. Dropped as dead schema — migration `20260818_0_drop_kosztorys_hidden_in_export`. **Extended 2026-08-15 by EX-695 (`client-preview-settings`):** what the client sees is no longer a constant — a per-investment row plus a firm-wide default decide which of the allowlisted columns are hidden and whether pozycje with neither przedmiar nor executed work are dropped. `PREVIEW_VISIBLE_COLUMNS` stays the ceiling (stored keys only subtract); the settings are read beside the cached preview payload, so no cache tag is involved. Browser-level guard deferred to EX-696 (`e2e-backlog`).

### S-15: Importer for existing sheet kosztorysy

- **Outcome:** the owner can import an existing sheet kosztorys into the app, writing only the new kosztorys tables.
- **Change ID:** kosztorys-importer
- **PRD refs:** FR-010, FR-016
- **Prerequisites:** S-01 (needs the editor schema; benefits from full parity S-01–S-09 to import every field)
- **Parallel with:** S-13 (client share)
- **Blockers:** —
- **Unknowns:**
  - ~~Importer trigger (PRD Q8).~~ **Resolved (2026-08-11):** a button in the editor's "Opcje" menu, invoked per investment on demand — not a one-shot migration.
- **Risk:** Reads sheets, writes only new tables (additive). Guardrail: live sheet data must survive untouched until safely imported (FR-016). **Note (2026-07-10):** no longer depends on the cutover (S-19) — moved ahead of it into the import/export band per the reorder; import now happens before, not after, new investments go sheet-less.
- **Status:** done (EX-417) — shaped 2026-08-11, archived 2026-08-14 → `context/archive/2026-08-11-kosztorys-importer/`. Column resolution is by header label, validated across all 45 real sheets; 2 need an owner header fix. **Follow-up shipped 2026-08-13**, `context/archive/2026-08-13-sheet-live-compare/`: „Porównaj z arkuszem Google" — one live read that reports both sides' totals, the prace only one side holds, the stale stawki, and the classes of formula our reading has to refuse — **and refreshes the stored Pomiar z natury on the way**, since „keep the stale copy" is not an answer anyone would pick once the sheet has just been read. The separate „Zaciągnij pomiary z arkusza" action was folded into it and deleted, as was the per-row „Etapy są prawdą" escape hatch, both on the owner's ruling. The „Rozjazd" column became **„Pozostało do rozliczenia"** — the same subtraction, reframed from a defect to a balance line. E2E deferred to EX-687 (`e2e-backlog`).

### S-16: Editor E2E coverage (release gate)

- **Outcome:** the kosztorys editor flows are end-to-end-covered by the automated suite before the owner-facing release — sections/items/pricing/stages/subcontractor-pricing/VAT/snapshots/undo/delete-guard/column-rbac/client-share/preset/import exercised without a manual pass (autocomplete once its deferred slice ships).
- **Change ID:** editor-e2e-coverage
- **PRD refs:** FR-013
- **Prerequisites:** F-01, S-01…S-15 (all editor + bridge + import/export slices)
- **Parallel with:** — (S-17 financial-core-smoke was cut 2026-08-25)
- **Blockers:** —
- **Unknowns:** —
- **Risk:** This is the quality gate that lets the owner touch the editor only once it is verified. Deliberately deferred to band 4: the editor will churn heavily through bands 1–3 while the direction settles, so standing specs up earlier only chases moving targets. Risk: once here, if coverage lags the slices it locks, the cutover gate (S-19) slips — write the specs close behind the settled editor.
- **Status:** in progress (EX-405) — band 4, and the only open slice in the arc. The 2026-09-15 `e2e-backlog-audit` worked the whole backlog and closed 71 issues (`context/changes/2026-09-15-e2e-backlog-audit/audit.md`); five `e2e-backlog` items survive — EX-715, EX-689, EX-442, EX-472, EX-525 — plus EX-731, handed forward when S-17 was cut. No longer gates S-19: the cutover was reached 2026-08-25 without it.

### S-19: New investments get no Google Sheet (cutover gate)

- **Outcome:** creating a new investment provisions no Google Sheet and nothing is synced; its kosztorys exists only in the app, authored through the editor.
- **Change ID:** new-investment-no-sheet
- **PRD refs:** FR-009, FR-014, FR-016, US-01
- **Prerequisites:** S-16 (E2E gate) — transitively: all editor + bridge + import/export slices. Hardening (S-18) was **cut** 2026-08-25; see [Cut & folded slices](#cut--folded-slices).
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - ~~Escape hatch — does the owner ever want to opt a new investment back to a sheet?~~ **Moot (2026-08-25):** there is no opt-in to keep, because there is no provisioning step to opt out of.
- **Risk:** The release gate. Guardrail: the materiały-mirror must keep syncing for investments still on sheets (FR-014), and existing sheet kosztorysy stay accessible (FR-016) — **both hold**, the mirror is untouched and resolves per linked sheet.
- **Status:** **done (2026-08-25) — reached without a slice, and verified rather than declared.** Three facts, none of them a flag that was flipped: (1) **nothing ever provisioned a sheet.** No code path creates or copies a spreadsheet on investment create; `KOSZTORYS_TEMPLATE_SHEET_ID` is read only by the env schema and consumed by nobody, and the service account has no Drive quota anyway — linking was always manual. (2) **Nothing syncs without a link.** The mirror in `hooks/transfers/sync-sheet.ts` resolves the sheet from the investment and returns on `!sheetId`, so a sheet-less investment is a silent no-op, not an error. (3) **The app now authors the kosztorys itself** — `createInvestmentAction` seeds the new investment's kosztorys from the chosen preset (`seedInvestmentFromPreset`, best-effort with a warning toast if the preset fails), and `/inwestycje/[id]/kosztorys_v2` renders for every investment, empty state included. What the slice would still have done is a **habit and one nudge**, not a build: stop linking sheets by hand, and retire the „Inwestycje bez kosztorysu" table on `/kosztorysy`, whose only purpose is to prompt for a sheet. Tearing down the Google integration itself is a separate, later release per the vision — not this slice.

### Cut & folded slices

Kept for the record; pulled out of the numbered sequence because they carry no executable work.

#### kosztorys-column-rbac — CUT (S-10 tombstone)

- **CUT entirely (2026-08-18, owner).** No role-based hiding of kosztorys columns or rows. S-10's
  number stays a tombstone — the table jumps S-09 → S-11 — rather than renumbering the done tail.
- **Why the column half dies: the requirement was met, and then overruled.** The owner's ruling is
  that **a MANAGER sees everything**; the only surface withheld from them is the Marża tab, already
  gated server-side by `isAdminOrOwnerRole` on the investment page and the v2 Podsumowanie. The
  separate client-facing need — hide sensitive columns from the person receiving the offer — shipped
  as **S-13's per-investment client-view settings** (EX-695). So the slice's two candidate readers
  both have an answer, and neither is "split the payload per role".
- **Why the row half dies: it never had a source.** It was extrapolated from the column half by
  symmetry, not requested. The POC question it cites, **P10**
  (`context/reference/kosztorys-editor-domain-notes.md`), asks only _which columns/cells to hide from
  a MANAGER_, hypothesising subcontractor prices — it says nothing about rows or sections. Hiding
  _rows_ from the client, the one live version of that need, shipped as a **rule** („ukryj puste
  pozycje", EX-695) rather than a per-row flag.
- **Dead schema removed with the cut.** `kosztorys_items.hidden_in_export` — the per-row flag this
  slice would have consumed — was written on every insert and read by nothing; dropped 2026-08-18
  (change `2026-08-18-drop-hidden-in-export`, migration
  `20260818_0_drop_kosztorys_hidden_in_export`). EX-549, which owned that deletion, was cancelled.
- **Its one test obligation resolved with it (EX-603).** This slice's Risk line demanded that
  redaction be asserted at the **server boundary**, by a test reading a MANAGER's payload rather than
  the DOM. That assertion was **loosened to the UI plane** (owner, 2026-08-18): the bundle gate
  withholds `financials`, but every term of `marża = robocizna − wypłaty − rabat − strata` still
  reaches a MANAGER as its own prop, because `laborCostsNetFromTransactions` feeds the reconciliation
  scream a MANAGER is meant to see. What remains is extraction from the serialized payload, not a
  leak in the UI, and that is accepted. The guard now asserts no `financials` bundle and no „Marża"
  tab — already covered by `allowedSummaryViews`. See EX-603.
- **Outcome (dropped):** subcontractor cost/margin columns and restricted rows are withheld from a
  MANAGER server-side.
- **Change ID:** kosztorys-column-rbac. **PRD refs:** — (POC follow-on P10, now resolved).
- **Was:** S-10 (also S-07 under the pre-2026-07-10 `kosztorys-column-locking` numbering, before that
  slice was split into S-08 delete-guard + S-10 RBAC).
- **If it ever revives:** the hard part is unchanged and worth re-reading — this is authorization,
  not a CSS toggle. Derived prices are computed in `calc.ts` and shipped in the row payload, so
  hiding per-role means splitting what the server _sends_; a client-only hide leaks the numbers in
  the network response. Two questions that were never answered: what marks a row restricted (flag vs
  rule), and whether a MANAGER's totals recompute over the visible set or keep including hidden rows.

#### kosztorys-export — CUT (S-14 tombstone)

- **CUT entirely (2026-08-15, owner).** No kosztorys export in any format. Two decisions on the
  same day: **CSV** (the slice as scoped, EX-400) and then **PDF + live-formula sheet**
  (EX-666, the un-scoped remainder that had been parked since the POC). S-14's number stays a
  tombstone — the table jumps S-13 → S-15 — rather than renumbering the done/archived tail.
- **Why:** the **client view** (S-13 `kosztorys-client-share`) does both client-facing jobs the
  export existed for — presenting the offer at signing, and the live progress preview during the
  work. It beats a file on the axis that made the sheet export hard: the client re-verifies the
  _current_ math on our surface, so nothing needs re-sending when a figure moves, and the app's
  SQL-computed figures never have to be translated into spreadsheet formulas. Secondary: the
  export contract (what to export, how to flatten sekcja → pozycja → etap) was never decided, and
  EX-672 deleted the transfers CSV/print layer, so there was no infrastructure left to reuse.
- **Carried forward, not lost — the column-strip requirement.** In the old sheets a hidden column
  was only _hidden_: anyone could unhide it in Excel and read purchase prices / marża /
  subcontractor prices. Any future export must make such a column **physically absent** from the
  file, with no formula referencing it. Recorded on EX-666 for whoever revives an export. The
  client view satisfies the same requirement its own way — the view is pinned to `view:'client'`
  and rendered read-only.
- **Outcome (dropped):** the owner can print/PDF, CSV-export, or hand the client a live formula
  sheet of a kosztorys.
- **Change ID:** kosztorys-export. **PRD refs:** FR-008 — **unimplemented**, deliberately, by this cut.
- **Was:** S-14 (also S-07/S-09/S-10/S-11/S-12 under earlier numberings).

#### financial-core-smoke — CUT (S-17 tombstone)

- **CUT entirely (2026-08-25, owner).** The slice was overtaken by the specs other slices wrote on
  the way past it: what it still owns is **one** spec, which is not a slice. S-17's number stays a
  tombstone — the table jumps S-16 → S-19 — rather than renumbering the tail again. Linear EX-396
  cancelled with the same rationale.
- **Already covered, incidentally.** Sign-in without a human: `global-setup.ts` + `storageState`,
  plus `auth.spec.ts`. Transfer → register balance: `transfer-create.spec.ts` — and it already
  asserts the polled **rendered** balance rather than the action's return value, which is the exact
  anti-pattern this slice's Risk line was written to prevent. The reversal:
  `transfer-cancel.spec.ts` (reason-length gate, balance returns to its pre-create value, row
  leaves the default view). A kosztorys write → marża on the listing:
  `investments-listing-kosztorys.spec.ts`, which is also where the „Odśwież dane" discipline is
  written down.
- **Carried forward, not lost — the one uncovered leg.** No spec asserts that a **booked transfer**
  moves the investment's own figures (materiały / bilans v1 on `/inwestycje/[id]`) without a manual
  refresh. The layer below is covered — `pnpm test:parity` for the SQL, unit specs for marża — so
  the only thing that can fail there is the browser leg, i.e. the cache tag: a figure read off the
  wrong tag renders as a zero, not as an error. Filed as **EX-731** (`e2e-backlog`).
- **Outcome (dropped):** a dedicated smoke slice gates the financial core.
- **Change ID:** financial-core-smoke. **PRD refs:** FR-012, FR-011, FR-015, US-02 — covered by the
  specs listed above plus EX-731, not by a slice.
- **Was:** S-17 (also S-02/S-12/S-13/S-14/S-15 under earlier numberings).

#### kosztorys-hardening — CUT (S-18 tombstone)

- **CUT entirely (2026-08-25, owner).** The pre-cutover hardening slice did not survive its own
  verification: three of its four bullets were already done or overruled by the ~750 kosztorys
  commits between its writing (2026-07-08) and today, and what remained was one E2E spec plus one
  manual spot-check. S-18's number stays a tombstone — the table jumps S-16 → S-19 — rather than
  renumbering the tail a fifth time. Linear EX-406 cancelled with the same rationale.
- **Access rules — already enforced, and the wider question was overruled.** Every kosztorys
  collection (`kosztorys-items` / `-sections` / `-stages` / `-shares` / `-client-view`) gates on
  `isAdminOrOwnerOrManager`, so EMPLOYEE has none. The broader role-based hiding this bullet
  gestured at died with S-10 (`kosztorys-column-rbac`, 2026-08-18): a MANAGER sees everything but
  the Marża tab.
- **The "POC shortcuts" stopped being shortcuts.** `inv-7` exists nowhere in `src/` except as the
  default target of `perf-seed-kosztorys.ts` — a tool, not a hardcode. Per-browser `localStorage`
  became a deliberate layer of **reading preferences** (`editor/hooks/use-hidden-columns`,
  `-column-widths`, `-column-order`, `-money-axis`, `-layer`), each storing the deviation rather
  than a snapshot of today's defaults, and hardened against a hand-edited store by EX-591.
  Removing it would be a regression, not hardening.
- **Perf at 1000+ rows is the question EX-521 already answered on numbers.** The one path filed at
  that scale — the whole-owner `FOR UPDATE` in `display-order.ts` — locks a **section**, not the
  sheet, and benchmarked at +1 ms under a continuous ▲▼ burst. `lessons.md` names this exact
  distortion: a whole-sheet 1000+ figure quoted for a per-owner scope. The grid is virtualized to
  ~28 DOM rows. What is left is a spot-check on a clean build, not a slice — it lives in
  `manual-checks.md` under "S-18 (cut)".
- **Carried forward, not lost — the failed-autosave rollback.** The revert path is built and
  non-trivial (`revertField` / `revertOne`, per-field debounce lanes, rollback on a refused
  renumber) and unit-covered at `src/__tests__/lib/kosztorys/kosztorys-v2-rows.test.ts:552`. What
  no test exercises is the browser plane: a rejected save must leave the grid reading what the DB
  holds, not the optimistic value behind a toast. Recorded on **EX-405** (S-16
  `editor-e2e-coverage`), which owns the editor specs.
- **Outcome (dropped):** a dedicated hardening pass gates the cutover.
- **Change ID:** kosztorys-hardening. **PRD refs:** — (POC).
- **Was:** S-18 (also S-13/S-15/S-16 under earlier numberings).

#### kosztorys-rooms — CUT

- **CUT (2026-07-08):** pokoje are out of scope (owner, POC 2026-06-20). The POC's
  `kosztorys_rooms` table is a dead orphan — do not build. Room-measurement formulas were
  recognised during the POC but parked; revive only via a new change (see
  `context/archive/kosztorys-poc-in-app/`).
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
- **CUT (2026-07-28, owner) — superseded by EX-503 `kosztorys-section-append`.** „Dodaj sekcję
  z szablonu" (shipped 2026-07-24) reads the same `kosztorys_presets` storage at **section**
  granularity, which covers the job FR-006 was for: composing a kosztorys out of existing prace
  without retyping. What per-item autocomplete would have added on top is finer granularity at the
  cost of the custom dsg cell — not worth it. Revivable if section-append proves too coarse in
  practice; the Model A design below still stands.
- **Change ID:** kosztorys-item-autocomplete (FR-006). **Status: cut, unsequenced** — never
  numbered, never started.
- **PRD refs:** FR-006 — **unimplemented**, deliberately, by this cut.
- **Was:** S-06 (pre-2026-07-10 numbering; as kosztorys-catalogue).

## Open Roadmap Questions

These are the PRD's open questions, carried verbatim. The user called the top blocker
`none` — they ride as non-blocking, but several are load-bearing for the slice they sit
under and are best resolved before that slice is planned. Per-slice context lives in each
slice's Unknowns.

**Resolved by the POC (2026-07-08)** — kept for the record; see `context/archive/kosztorys-poc-in-app/`:

1. ~~**Per-item discount (rabat).**~~ **Resolved:** two-mode discount (`percent`/`amount`), folded into S-01.
2. ~~**VAT.**~~ **Resolved:** one rate per investment, netto entry / brutto computed — carved into **S-05**.
3. ~~**Labour vs. materials shape.**~~ **Resolved:** unified item list; materials = `INVESTMENT_EXPENSE`, no separate table.
4. ~~**Delete semantics.**~~ **Resolved:** hard-delete.
5. ~~**Ordering.**~~ **Resolved:** ▲▼ arrow reorder over a `display_order` layer (DnD deferred).
6. ~~**Item-to-room link.**~~ **Resolved:** rooms cut — no link.

**Still open:**

6. ~~**Catalogue seeding.**~~ **Resolved (2026-07-09):** dissolved by folding the catalogue into S-09 with Model A — autocomplete sources from preset prace, so building presets _is_ seeding. No standalone catalogue to seed.
7. ~~**Importer trigger (FR-010).**~~ **Resolved (2026-08-11):** a "Pobierz z arkusza Google…" item in the editor's "Opcje" menu, run per investment with a preview → confirm step. Not a migration, so it stays useful after the first pass.
8. ~~**Settings-home UX.**~~ **Resolved (2026-07-15):** a **second row in the editor toolbar** — neither anticipated option (detail-inwestycji / a "Podsumowanie" panel). The global multipliers + VAT rate are always visible there; the Sekcje panel keeps only the per-section overrides. EX-478.
9. ~~**Preset scope (S-09).**~~ **Resolved (2026-07-11):** named library (`kosztorys_presets` table), picked by name at seed-time.
10. ~~**Preset save-as + retroactivity (S-09).**~~ **Resolved (2026-07-11):** save-as offers both new + overwrite; spawned kosztorysy stay frozen (snapshot).
11. ~~**Duplicate prace across presets (`kosztorys-item-autocomplete`).**~~ **Dissolved (2026-07-28):** the autocomplete slice was CUT (superseded by EX-503 section-append), and the section picker already answers it its own way — each occurrence is listed, labelled by source szablon. Nothing left to decide.
12. **`Podsumowanie` parity + per-etap total (2026-07-15).** Two separate gaps, surfaced by inspecting the live sheet:
    - ~~**(a) `Podsumowanie` tab has no slice.**~~ **Resolved — closed by the owner 2026-09-16.** All three parts shipped, none of them as a slice: per-section totals in the section-summary panel, the Robocizna/Materiały/Łącznie split in **S-11** (`kosztorys-bridge`), and the „% udziału” pie in `kosztorys-summary-charts` (EX-529, mounted in the Podsumowanie footer; components at `src/components/kosztorys/summary/charts/`, change folder deleted without archiving). The owner has seen the pies and signed off. Nothing here needs a slice number.
    - **(b) Per-etap total does not exist in the sheet.** New work, no parity to copy: decide whether "suma etapu" is an invoice figure (client price) or a payout figure (subcontractor price, under the active price view), and whether it's global or per-section. That answer decides whether it's a cheap `Σ V` readout or a distinct figure. — Owner: user. **(b) is the only half still open** — it blocks its own slice; (a) closed 2026-09-16.

## Parked

Lifted from PRD `## Non-Goals` — explicitly out of scope for this arc.

- **Mirror / Google integration teardown** — Why parked: removing the integration (design-spec Phase 3b) is a later change, triggered only after cutover is proven.
- **Bidirectional sheet ↔ app sync** — Why parked: the editor never reads from or writes to sheets; the importer (S-15) is the only exception, and it reads only — on demand, per investment, never writing back.
- **Real-time collaborative editing** — Why parked: PRD non-goal.
- **Multi-currency** — Why parked: PLN only, confirmed non-goal.
- **Multi-tenant catalogues** — Why parked: single shared catalogue; PRD non-goal.
- **Schema-level customization** (per-investment custom columns / arbitrary-field sidecars) — Why parked: a free-text note field covers ad-hoc needs; PRD non-goal.
- **Observability / error tracking** — ~~parked~~ **un-parked 2026-07-11** into standalone slice **O-01 `sentry-observability`** (Sentry errors + tracing + replay, prod only). Runs independently of the editor arc.

## Done

(`/10x-archive` appends here when a change whose Change ID matches a roadmap item is archived.)

> **Backfilled 2026-07-20** — the five entries below were `done` in the table but never appended here
> (archive step didn't write back). Recorded from Linear + the change/archive folders.

- **F-01: E2E test harness** — Shipped; harness lives in `e2e/` (not archived, `change.md` still `implementing`). `global-setup.ts` + auth fixture + five specs against the isolated 5435 `db-test` container. Unblocks band 4. Lesson: —.
- **S-01: Kosztorys sections + items (north star)** — EX-395 Done. Archived 2026-07-24 → `context/archive/2026-07-08-kosztorys-sections-items/`. Absorbed S-04's coefficient/override derivation. Lesson: —.
- **S-03: Stage progress (etapy)** — EX-398 Done. Archived 2026-07-24 → `context/archive/2026-07-09-kosztorys-stages/`. The stage **value** axis shipped adjacent as `kosztorys-stage-values` (2026-07-15). Lesson: —.
- **S-06: Snapshots (point-in-time version history)** — EX-418 Done, archived 2026-07-10 → `context/archive/2026-07-10-kosztorys-snapshots/`. Deferred E2E → EX-428 (`e2e-backlog`); `CRON_SECRET` deploy gate → EX-429. Lesson: a snapshot is only trustworthy if its payload is complete — EX-432 caught serialize silently truncating at 5000 items, which would have made restore permanently lossy.
- **S-07: Fast undo / redo (in-session)** — EX-403 + EX-526 hardening, archived 2026-07-18 → `context/archive/2026-07-18-kosztorys-undo/`. Deferred DB-integration E2E → EX-525 (`e2e-backlog`); owed `hasPendingBurst` unit delivered by EX-521 (2026-08-17). Lesson: with per-field optimistic autosave, undo is an inverse **server** write, not a local rewind — it must reconcile with the in-flight save rather than race it.
- **S-08: Confirm-gated delete (populated rows / sections / stages / columns)** — EX-477 Done. Archived 2026-07-24 → `context/archive/2026-07-17-kosztorys-delete-confirm/` (superseded `kosztorys-delete-guard`, also archived → `context/archive/2026-07-10-kosztorys-delete-guard/`). Reversed the original hard-block policy to confirm-then-auto-snapshot. Lesson: the pre-delete snapshot must be taken **inside the server action** — a client-side one races autosave and captures the wrong state.
- **S-13: Client share view (live, read-only, token link)** — EX-532 Done. Archived 2026-07-24 → `context/archive/2026-07-20-kosztorys-client-share/`. Bespoke render superseded 2026-07-20 by `kosztorys-client-view-reuse` (already archived → `context/archive/2026-07-20-kosztorys-client-view-reuse/`), which reuses the admin `KosztorysEditorBody` read-only instead of a separate client component tree. The 8 share-link-lifecycle manual checks (generate/rotate/revoke, no-subcontractor-leak, read-only, live-not-snapshot, preview parity, MANAGER-blocked) were run and ticked 2026-07-24. Lesson: —.
- **S-11: Read-only bridge to the financial plane** — EX-530 Done. Archived 2026-07-24 → `context/archive/2026-07-18-kosztorys-bridge/`. Phases 4–5 (zaliczka etap-tagging on deposits + its R+M netting) shipped then were retired (EX-536 domain resolution); phases 1–3 (Podsumowanie split, etap axis, komentarz column) stand. EX-531 (E2E for the retired tagging flow) closed Canceled rather than authored — it would have tested deleted code. EX-544 (recon-parity E2E, still valid) remains open in the e2e-backlog. Lesson: a deferred E2E can go stale if the feature under test gets retired before the test is written — check the feature still exists before authoring a backlog E2E.

- **S-09: Kosztorys presets (templates)** — Archived 2026-07-11 → `context/archive/2026-07-11-kosztorys-preset/`. Named `kosztorys_presets` library (seed-new-from-preset + save-as-preset new/overwrite), reusing the S-06 serialize/apply engine; UI renamed preset→szablon, two save-as buttons merged into one. Lesson: a seed that runs after the parent row commits must be non-fatal — flipping the whole action to failure skips revalidation and invites a duplicate-creating retry. Browser E2E deferred → EX-442.

- **S-02: Three price models + pricing-view toggle** (was S-03) — Archived 2026-07-09 → `context/archive/2026-07-09-kosztorys-price-models/`. Core (three views + toggle + coefficient/override derivation) shipped in S-01; this change closed the residual polish (per-kosztorys view persistence, "Klient" relabel, pricing-model explainer tooltip). Lesson: —.
- **S-04: Subcontractor pricing (markup coefficient + override)** (was S-11) — Absorbed by S-01 (`kosztorys-sections-items`), which ported the POC's final `calc.ts` derivation verbatim; marked done here (no separate change folder). Lesson: —.
- **S-05: VAT per investment (netto entry, brutto computed)** — Archived 2026-07-10 → `context/archive/2026-07-10-kosztorys-vat/`. Lesson: a migration is "verified" only when the running app reads the new column — `payload migrate` "Done." is necessary, not sufficient.
- **S-12: Robocizna + rabat derived from the kosztorys** — Archived 2026-07-26 → `context/archive/2026-07-19-robocizna-from-kosztorys/`. Lesson: —.
- **S-15: Importer for existing sheet kosztorysy** — EX-417 Done. Archived 2026-08-14 → `context/archive/2026-08-11-kosztorys-importer/`. Follow-up „Porównaj z arkuszem Google" archived alongside → `context/archive/2026-08-13-sheet-live-compare/` and `context/archive/2026-08-13-pomiar-bez-etapu/`. Deferred E2E → EX-671 + EX-687 (`e2e-backlog`); comparison blind to a global rabat → EX-691; 12 manual checks left unticked in `manual-checks.md`. Lesson: column resolution must key on the **header label**, never an offset — across 45 real sheets „Przedmiar" lives in six different columns and stage headers get renamed to crew names.
- **O-02: RWD — make the app usable on a phone** — EX-785 Done. Archived 2026-09-17 → `context/archive/2026-09-16-rwd-mobile/`. Phases 1–3 shipped (overflow root-caused, mobile drawer, shell switch `lg`→`sm`, dialog-as-sheet, collision-aware popover, the two named flows walked at 390px); two follow-ups shipped alongside — EX-787 (`ui/` stops importing upward) and EX-789 (v2 editor toolbar collapsed on mobile). Phase 4 („the rest") was never scoped and has no ticket; the z-index retokenization (plan item 1.4) was written up as EX-786 and then **Canceled** — no user-visible defect, so it is dropped, not queued. Only EX-788 (E2E for the phone flows, `e2e-backlog`) stays open. Lesson: a `grid grid-cols-1` wrapper re-creates the `min-width: auto` overflow the flex shell already fixed with `min-w-0` — the guard has to be repeated per layout mode, it does not inherit.
