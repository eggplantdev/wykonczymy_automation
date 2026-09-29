# Worker view settlement columns — Plan Brief

> Full plan: `context/changes/2026-09-29-worker-view-settlement-columns/plan.md`

## What & Why

The worker's document (link, owner's Podgląd, PDF) should read like the investor's: settlement
columns only once work has been entered, empty etapy never. On top, a firm-wide checkbox (default
on) takes „Przedmiar" and „Wartość przedmiaru netto" off once the worker's etapy have entries.

## Starting Point

The investor's document already hides empty settlement columns (`emptySettlementColumnIds`). The
worker's does not — by an explicit earlier decision this change reverses — and shows every etap
column and the przedmiar pair at all times.

## Desired End State

Before work: offer shape (przedmiar, stawka, wartość przedmiaru). After the first entry in his
etapy: his filled etapy, Σ etapów and wartość wykonana; przedmiar pair gone unless the owner
unticks the new checkbox. Link, Podgląd and PDF identical.

## Key Decisions Made

| Decision      | Choice                                              | Why                                          |
| ------------- | --------------------------------------------------- | -------------------------------------------- |
| Surfaces      | Link + Podgląd + PDF via one pure function          | They cannot drift                            |
| „Work exists" | Any entry in **this worker's** etapy                | Another crew's work doesn't reshape his page |
| „Pozostało"   | Not governed by the checkbox                        | Not named in the request; own tick           |
| Summary block | Unchanged                                           | Checkbox is about table columns              |
| Investor view | Unchanged                                           | Already has the reveal/empty-etap rule       |
| Storage       | New boolean on the worker-view global, default true | Firm-wide like the rest of the set           |

## Scope

**In scope:** setting + migration + dialog checkbox; column rule on link, Podgląd, PDF; domain notes.

**Out of scope:** investor document, worker summary, per-investment overrides, the column ceiling.

## Phases at a Glance

| Phase              | What it delivers                      | Key risk                                                       |
| ------------------ | ------------------------------------- | -------------------------------------------------------------- |
| 1. The setting     | Persisted, editable flag (default on) | Prod migrate must precede the push                             |
| 2. The column rule | Same column set on all three surfaces | Hiding by group key instead of full id would drop filled etapy |

**Prerequisites:** none. **Estimated effort:** one session.

## Open Risks & Assumptions

- The three defaulted decisions above were taken without a question round — veto before implementing.

## Success Criteria (Summary)

- A worker with no entries sees the offer; with entries, the settlement — per the checkbox.
- PDF and link never disagree on columns.
