# Podsumowanie podwykonawców — Plan Brief

> Full plan: `context/changes/podsumowanie-podwykonawcow/plan.md`
> Change identity + owner decisions: `context/changes/podsumowanie-podwykonawcow/change.md`

## What & Why

EX-554 (closes EX-551, owner-confirmed): the Editor V2 footer summary is one block shared by all three
views. The subcontractor views (Z narzędziami / Bez narzędzi) need to count the **cost side** — what
the crew is owed vs already paid — not the client figures. Split it: Klient keeps today's block; the
subcontractor views get „Podsumowanie podwykonawców".

## Starting Point

`KosztorysSummary` renders identically in all three views (only the robocizna waterfall reprices). No
PAYOUT-per-worker-per-investment query exists; worker names are never SQL-joined (resolved from
`refData.workers`); there is no `worker` URL filter; and there is zero worker↔work attribution in the
kosztorys plane.

## Desired End State

The subcontractor views show a single-„Kwota" block: **Suma wykonanej pracy** (należne, pre-rabat, at
the active view's subcontractor price) → per-worker **Zaliczki (wypłaty)** with links → **Zaliczki
razem** → **Pozostało do wypłaty** (może być ujemne). The Klient view is unchanged.

## Key Decisions Made

| Decision            | Choice                                                                    | Why                                                                                                                                                                  | Source   |
| ------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Należne base        | **Pre-rabat**: `Σ(subtotals.net + subtotals.discount)` at the active view | Rabat is a client concession absorbed by margin; the crew is owed its price regardless. NOT `totalNet` (per-item rabat) or `laborCostsNetFromKosztorys` (global too) | Q1       |
| Block structure     | Separate `SubcontractorSummary`, panel selects by `priceView`             | Avoids an EX-515-style god-component; different props (no moneyAxis/materiały/recon)                                                                                 | Q2       |
| Scope               | Whole-investment total, no per-crew attribution                           | Zero worker↔work link in the data model; per-crew = a future larger slice                                                                                            | Change   |
| Null-worker payouts | Counted, bucketed „Bez przypisanego pracownika"                           | ~11% of investment PAYOUTs lack a worker; dropping them makes Σ zaliczek (and pozostało) lie                                                                         | Q3       |
| Netto/brutto        | None — single „Kwota" column; toggle hidden in these views                | EX-558: subcontractors paid without VAT                                                                                                                              | Change   |
| Worker link         | `/inwestycje/{id}?type=PAYOUT&worker=<id>` (new filter param)             | Mirrors the client „Wpłaty" link                                                                                                                                     | Change   |
| Name resolution     | Join at the page from `refData.workers`, not in the cached query          | Repo convention; keeps the query tagged on `transfers` alone                                                                                                         | Research |
| Tests               | SQL integ + filter unit; E2E → `e2e-backlog`                              | Covers the two real risks (money sum, new filter) on the cheapest layer                                                                                              | Q4       |

## Scope

**In scope:** new `sumPayoutsByWorkerForInvestment` (null bucket kept) + cached fetch; `worker` param in
`buildTransferFilters`; pre-rabat należne helper; `SubcontractorSummary` component; panel branch by
`priceView`; hide the netto/brutto toggle in subcontractor views.

**Out of scope:** per-crew/per-worker work attribution; materiały/marża in the block; netto/brutto axis;
PAYOUTs without an investment; any Klient-view / balance / transfer-write change; migrations.

## Architecture / Approach

Three phases, no schema change. Phase 1 (server figure) and Phase 2 (worker filter) are independent.
Phase 3 builds the component on both. All money arithmetic in pure, unit-tested helpers
(`executedWorkNetPreRabat`, `computeSubcontractorSummary`); the component is plumbing. The new editor
prop is optional (default `[]`) so the two read-only share entry points stay untouched.

## Phases at a Glance

| Phase              | What it delivers                                                                                    | Key risk                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Server figure   | `sumPayoutsByWorkerForInvestment` (per worker×investment, null bucket) + cached fetch + prop thread | Must NOT drop null workers, else Σ zaliczek understates                     |
| 2. `worker` filter | `worker` param in `buildTransferFilters`                                                            | Trivial; mirror `expenseCategory`                                           |
| 3. Block + branch  | `SubcontractorSummary` + panel branch + należne helper + edge cases                                 | Należne = pre-rabat (not `totalNet`); locate + gate the netto/brutto toggle |

**Prerequisites:** none blocking — read-only over existing data.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Należne must use `Σ(net + discount)` over the **active-view** subtotals — using `totalNet` or
  `laborCostsNetFromKosztorys` silently subtracts rabat the crew is still owed.
- The netto/brutto toggle control render site must be located and gated off for subcontractor views
  (Phase 3).
- „Pozostało do wypłaty" is a whole-build figure, not per-crew — accepted owner limitation (no
  worker↔work attribution in the data model).

## Success Criteria (Summary)

- Subcontractor views show „Podsumowanie podwykonawców"; Klient view unchanged.
- `Suma wykonanej pracy` = executed value at the active subcontractor price, pre-rabat; reacts to the
  view toggle and progress edits.
- Per-worker rows link to that worker's payouts on this investment; null-worker payouts bucketed; razem
  and pozostało reconcile (negative shown).
- No netto/brutto toggle in the subcontractor views.
