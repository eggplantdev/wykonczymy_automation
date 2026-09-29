# „Pozostało do wypłaty" on the investments listing — Plan Brief

> Full plan: `context/changes/2026-09-29-investments-list-payout-remaining/plan.md`
> Research: `context/changes/2026-09-29-investments-list-payout-remaining/research.md`

## What & Why

The owner needs to scan the investments listing for where crews are still owed money. The figure
exists today only inside each kosztorys (Podsumowanie → Podwykonawcy → „Pozostało do wypłaty"),
which means opening investments one by one.

## Starting Point

The listing already fetches both parts per investment:
- „Suma wykonanej pracy", through the SQL that Marża v2 uses (pinned to the editor's calculation)
- „Zaliczki (wypłaty)", which is the „Wypłaty" column

Nothing subtracts them yet.

## Desired End State

A „Pozostało do wypłaty" column shows the same amount as the kosztorys tab, visible to every
management role. A negative amount is red. „ustaw etapy" appears where an etap lacks its
rozliczenie, and „brak danych" where there is no kosztorys; both sort last. The column follows the
„Kolumny v2" switch.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Etap with work but no rozliczenie | Withhold → „ustaw etapy" | The short figure understates the debt, which is the wrong direction for a debt scan; same as Marża v2 | Plan |
| No kosztorys | „brak danych" | `−wypłaty` would paint every legacy investment as overpaid | Plan |
| Role gate | None: all management roles | Owner's call; matches the editor's ungated Podwykonawcy tab (the investment page gates it) | Plan |
| Negative value | Red number only | Mirrors the tab; the overpayment wording is still open | Plan |
| „Kolumny v2" switch | Joins it | The figure is kosztorys-sourced | Plan |
| Data source | Reuse the existing fold + `totalPayouts` | No new SQL, cache or migration; one definition shared with the editor | Research |

## Scope

**In scope:** a row field in `shapeInvestments`, the listing column and its tooltip, unit specs, and
a listing↔panel parity check.

**Out of scope:** new SQL or cache keys, role gating, overpayment wording, a golden-master field,
and the per-worker breakdown (the employee-card change).

## Architecture / Approach

`shapeInvestments` already holds `{ due, hasUnconfirmedPlane }` and `totalPayouts` per row. It
derives `subcontractorRemaining = roundToCents(due − totalPayouts)`, or `undefined` when there is no
kosztorys or a plane is unconfirmed. The column copies the Marża v2 cell. The DB parity spec
compares the result with the panel's own `computeSubcontractorSummary` on real data.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Row field | `subcontractorRemaining` on each listing row, test-first | Confusing the two meanings of absent (handled by `hasKosztorys` in the cell) |
| 2. Column + parity | The visible column, its tooltip, and the listing = panel proof | Parity false positives if the detail side doesn't apply the same withholding |

**Prerequisites:** `db-test` populated (`pnpm db:import:test`) for the parity spec.
**Estimated effort:** one short session.

## Open Risks & Assumptions

- Stored wypłaty are grosz-precise, so the panel's per-worker rounding and the listing's raw sum
  agree exactly. The parity spec would catch a sub-grosz drift.
- A MANAGER can now work out total payouts from this column plus „Suma wykonanej pracy". Accepted by
  the owner.

## Success Criteria (Summary)

- For any investment, the listing cell equals the kosztorys Podwykonawcy „Pozostało do wypłaty".
- Investments owing crews stand out; unknown figures are labelled, not shown as zero.
