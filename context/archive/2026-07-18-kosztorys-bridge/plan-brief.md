# Kosztorys bridge — Plan Brief

> Full plan: `context/changes/kosztorys-bridge/plan.md`
> Braindump: `context/changes/kosztorys-bridge/braindump.md`
> Gap table: `context/changes/kosztorys-parity-gaps/braindump.md`

## What & Why

Open the kosztorys↔financial-plane firewall **read-only** so the owner can run the money
conversation from the app: the sheet's summary economics (Podsumowanie R/M/Łącznie split,
suma transzy per etap, zaliczki, „aktualnie do zapłaty R + M") plus the komentarz column.
Live join over the shared Postgres — no sync, no write-back.

## Starting Point

The editor loads only the kosztorys tree; no investment transaction data reaches it (FR-015).
The financial read side already exists (`fetchFilteredByType` → `deriveFinancials`, cached on
the transfers tag) — the bridge reuses it. Transfers have no etap link; the `note` field is
plumbed but has no grid column.

## Desired End State

Below/beside the grid the owner sees Robocizna/Materiały/Łącznie (materiały live from real
transactions), per-etap suma transzy netto+brutto, suma prac wykonanych, per-etap zaliczka
sums, and the footer „do zapłaty R + M" = robocizna − Σ zaliczki + materiały. A komentarz
column in the grid. Marża/register figures byte-identical.

## Key Decisions Made

| Decision               | Choice                                                          | Why                                                 | Source   |
| ---------------------- | --------------------------------------------------------------- | --------------------------------------------------- | -------- |
| Bridge direction       | Read-only; write-back is a future change                        | Decide ownership of shared figures after dogfooding | Owner    |
| Sync                   | None — live join + existing cache tags                          | Same Postgres; v1 sync was a Sheet workaround       | Owner    |
| Zaliczka model         | Deposit transfer with investment + etap; read-only in kosztorys | One source of truth, no double entry                | Owner    |
| Etap totals price base | Follow the active view                                          | Consistent with every figure in the editor          | Owner    |
| Oferta view + PDF      | Out — import/export slice                                       | Export mechanism belongs with the importer work     | Owner    |
| Pie „% udziału"        | Out — filed EX-529 (nice-to-have)                               | Viz, not economics                                  | Owner    |
| „Pozostało/bilans"     | Treat as provisional; no tests lock it                          | Formula still under owner discussion                | Gap docs |

## Scope

**In scope:** Podsumowanie split · suma transzy per etap · suma prac wykonanych · komentarz
column · zaliczka etap tag on deposits · footer „do zapłaty R + M".

**Out of scope:** any write-back · oferta view / PDF (import/export slice) · pie (EX-529) ·
udział-% base change · Brutto column placement · client delivery mechanism.

## Architecture / Approach

Server: editor page mirrors the investment-detail read pattern (cached queries →
`deriveFinancials`) and passes plain numbers (materiały, per-etap zaliczki) as props. Client:
new pure `stageTotalsForView` in `settlement.ts`; `KosztorysTotalsBar` renders the new rows.
Only schema change: nullable `kosztorysStage` on transfers (hand-written migration; prod
applied by a human).

## Phases at a Glance

| Phase                 | What it delivers                         | Key risk                                                      |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| 1. Podsumowanie split | First firewall opening; materiały live   | Robocizna (client calc) vs materiały (server prop) mixing     |
| 2. Etap axis          | Suma transzy per etap + wykonane readout | Rabat 'amount' reconciliation across stages                   |
| 3. Komentarz column   | Grid column for existing `note` field    | None (plumbing exists)                                        |
| 4. Zaliczki           | Etap tag on deposits + per-etap sums     | Migration touches real prod transfers (nullable, no backfill) |
| 5. „Do zapłaty R + M" | The headline footer figure               | Netting semantics need owner sign-off                         |

**Prerequisites:** none — starts on current staging.
**Estimated effort:** ~5 small increments, each shippable and dogfooded independently.

## Open Risks & Assumptions

- „Pozostało/bilans" formula provisional — no dependents hardened on it.
- Etap-tag semantics: a tagged deposit _is_ a zaliczka; untagged deposits aren't netted.
- Sheet's zaliczka SUM range is known-broken — we spec the intent, not the range.

## Success Criteria (Summary)

- Owner reads the full R+M money picture inside the kosztorys, live with real transactions.
- No kosztorys code path writes to the financial plane; existing figures unchanged.
- Each phase lands with unit tests; E2E authored or filed `e2e-backlog` at the review gate.
