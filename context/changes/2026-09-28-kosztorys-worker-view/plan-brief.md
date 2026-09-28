# Widok pracownika (część 1) — Plan Brief

> Full plan: `context/changes/2026-09-28-kosztorys-worker-view/plan.md`
> Spec: `context/changes/2026-09-28-kosztorys-worker-view/design.md`

## What & Why

The owner gives a worker or subcontractor a **named**, read-only view of an investment's kosztorys,
as a live link or a PDF. The view shows what the worker has to do and what it pays at their stawka,
and in the course of the work, how much they have done, been paid and are still owed.

Alongside it, the editor gains a „Wartość przedmiaru netto — <rozliczenie>" column in the crew
views, visible to the owner and the manager.

## Starting Point

Several pieces already exist:

- etap → worker assignment and etap `plane`;
- per-worker executed value (`subcontractorDueByPlane.byWorker`) and payouts (`derivePayoutsByWorker`);
- a complete investor share pipeline (token table, `/k/[token]`, closed column list,
  `assertDisclosurePair`, `client-empty`, offer print).

What is missing:

- a planned-value column at a crew rate;
- a third closed surface;
- worker tokens, settings and projection;
- a parametrized print.

## Desired End State

- The editor's „Pracownicy" menu lists each assigned worker, with Podgląd, Link and PDF. A worker
  with plane-less or mixed-plane etapy is blocked, with the reason shown.
- `/p/[token]` shows only that worker's etapy, priced at their stawka, with a four-part summary:
  - przedmiar at stawka;
  - wykonane per etap;
  - wypłacone + list;
  - pozostało / „Nadpłata".
- No path renders a client price on a worker surface.

## Key Decisions Made

| Decision          | Choice                                                              | Why                                                                    | Source             |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------ |
| Link identity     | One token per (investment, worker), own table                       | Part 2 needs to know who types; no investor/worker branch to get wrong | Owner / design #1  |
| Scope             | All items, only the worker's etap columns                           | Matches assignment; Part 2 = writes only in their own                  | Owner / design #2  |
| Price             | The worker's etapy's rozliczenie, never chosen                      | One worker ≈ one rozliczenie per investment                            | Owner / design #3  |
| Modes             | One, no Oferta/Rozliczenie                                          | An empty etap column is the to-do list                                 | Owner / design #4  |
| Settings          | One firm-wide set, fail-closed                                      | A working tool, not a client document                                  | Owner / design #5  |
| „Pozostało"       | Przedmiar at stawka − execution in **all** etapy                    | An item finished by someone else reads 0                               | Owner / design #9  |
| Wypłacone         | Sum + list (date, amount), no description                           | Verifiable without leaking internal notes                              | Owner / design #10 |
| Mixed planes      | Block link + PDF                                                    | One „Cena j.m." must mean one thing                                    | Owner / design #11 |
| New column        | „Wartość przedmiaru — <rozliczenie>" in crew views, owner + manager | Owner request; keeps the 2026-09-23 client-price ruling                | Owner / design #13 |
| Scoping mechanism | Server narrows `stages` to the worker's etapy                       | Every existing sum scopes for free                                     | Plan               |
| Audience flag     | Separate `worker` input, not `preview`                              | Lesson: a price-view flag is not an audience flag                      | Plan / lessons     |
| Blocked check     | One pure function for menu, mint and page                           | The three cannot disagree                                              | Plan               |

## Scope

**In scope:**

- the crew-plane przedmiar column + totals;
- the worker scope/summary/settings logic;
- the token collection + settings global + migration;
- link and settings actions;
- the projection builder;
- `/p/[token]` + Podgląd route;
- the third closed surface + plane-pin assert;
- the „Pracownicy" menu + dialogs;
- the parametrized PDF;
- the domain-notes update.

**Out of scope:**

- Part 2 (worker input);
- per-investment settings override;
- „Pozostało po stawce" in the owner editor;
- payout descriptions;
- a server-side PDF;
- E2E (goes to the `e2e-backlog`).

## Architecture / Approach

1. `buildWorkerKosztorysData(investment, worker)` reads the tree and runs `resolveWorkerScope`.
2. **If ready**, it returns rows over **only the worker's etapy**, a per-row all-etapy executed qty,
   the plane and `computeWorkerSummary`.
3. **If blocked**, it returns the reason only.
4. The link page, Podgląd and PDF all consume that one result.
5. The grid renders it through a third `closedColumnList` entry (`workerVisible`, plane-resolved
   allowlist) with `view` pinned to the worker's plane. An assert throws on a mismatch.

## Phases at a Glance

| Phase                          | What it delivers                                         | Key risk                                               |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------ |
| 1. Crew-plane przedmiar column | New column + totals in the editor                        | Leaking into the client view                           |
| 2. Pure worker logic           | Scope, summary, settings, closed list (TDD)              | Client price reachable via settings                    |
| 3. Data                        | Token collection, settings global, migration             | Pair uniqueness / locked-docs rel missed               |
| 4. Server                      | Actions, projection, routes, DB specs                    | Cross-token resolution; other workers' data in payload |
| 5. Grid surface                | Closed list + assert, „Pozostało", header, summary block | View not pinned → client price rendered                |
| 6. Editor entry                | „Pracownicy" menu, link + settings dialogs               | Blocked worker still mintable                          |
| 7. PDF + docs                  | Parametrized print, worker print, domain notes           | Investor PDF regressing                                |

**Prerequisites:** local docker DB + `db-test` (5435). Prod `pnpm db:migrate:prod` by a human
before the push that ships Phase 3.
**Estimated effort:** ~3–4 sessions across 7 phases.

## Open Risks & Assumptions

- „Pozostało" needs the all-etapy executed quantity that the narrowed rows lose. The payload carries
  it explicitly and it must never feed the empty-rows rule.
- The section-subtotal path may key by column id separately from `columnTotalsForRows`. Phase 1
  verifies this.
- A kosztorys restore can change which etapy a worker's link shows. This is accepted; links key on
  (investment, user), not on stage ids.

## Success Criteria (Summary)

- A worker's link and PDF show only their etapy, at their stawka, and never a client price.
- The summary matches that worker's line in „Podsumowanie pracowników".
- Owner and manager see „Wartość przedmiaru — <rozliczenie>" in both crew views, and never in the
  client view.
