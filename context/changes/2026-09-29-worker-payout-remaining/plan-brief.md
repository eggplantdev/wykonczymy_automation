# „Pozostało do wypłaty" per worker + „Rozlicz wypłaty" dialog — Plan Brief

> Full plan: `context/changes/2026-09-29-worker-payout-remaining/plan.md`
> Research: `context/changes/2026-09-29-worker-payout-remaining/research.md`

## What & Why

The firm can see per investment what the crew is still owed, but not **per worker**. It also can't
pay a worker for his executed etapy in one step. This change adds „Pozostało do wypłaty" per worker to
the employee list, and a dialog that prefills one wypłata per investment × worker pair and books them
together.

## Starting Point

Per-worker settlement exists only inside one investment's kosztorys (editor, worker view). The
investment list has a per-investment „Pozostało do wypłaty" computed in SQL. The employee list shows a
meaningless all-time „Wypłaty" sum. The wydatek form can't vary inwestycja/pracownik per line.

## Desired End State

- `/pracownicy` shows „Pozostało do wypłaty" per worker, with markers for nadpłata and etapy without a
  rozliczenie. „Wypłaty" is gone.
- Clicking it (or the investment list's cell) opens „Rozlicz wypłaty": Wykonane | Wypłacone |
  Pozostało | Kwota wypłaty | Po wypłacie, then Razem, with paying ahead flagged in red.
- Submit books N wypłaty atomically. It refuses if the figures moved since the dialog opened.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Grain | investment × worker pair, one query | One source for the column, both dialogs and the listing cross-check | Research |
| Booking UI | separate dialog, N PAYOUTs | The wydatek form shares inwestycja/pracownik across lines | Research |
| „Wypłaty" column | removed (detail page keeps its filtered one) | All-time Σ mixing salary, loans, fuel; never a settlement | Research |
| Wypłaty with no investment / no kosztorys | out / pair absent | Otherwise every long-time worker reads a huge nadpłata | Research |
| Netting | none; Σ positive pairs + markers | A nadpłata on one investment isn't a discount on another | Research |
| Wypłaty with no worker | inside the greyed „Nieprzypisane" row | Rows then sum to the listing cell; legacy-only (8 rows) | Research |
| Plane-less etap | withholds only that worker's pair | Other workers on the investment stay payable | Research |
| Completed investment | counted, not payable, reopen hint | The debt stays visible; the lock rule stays intact | Plan |
| Paying ahead | allowed, red row + sentence + „w tym zaliczka X zł" in opis | Deliberate but must be visible, now and in history | Research + Plan |
| Figures moved before submit | refuse, reload | Rare, but it's money | Research |
| Visibility | MANAGER too | Matches the listing's column | Research |
| Payment method | none | PAYOUT never stores one | Research |
| Browser E2E | e2e-backlog issue | DB + DOM specs cover the risky parts cheaply | Plan |

## Scope

**In scope:**
- the pair SQL + TS reference flag;
- the shaping module;
- the employee column;
- „Wypłaty" removal (incl. golden master axis);
- the booking action;
- the dialog + both triggers;
- a seed for manual checks;
- doc updates;
- archiving the superseded 2026-09-03 change.

**Out of scope:** netting, a salaried flag, a lock exception, a payment method, the editor/worker-view
surfaces, a browser E2E.

## Architecture / Approach

```
selectWorkerPayoutPairs (SQL, pinned to subcontractorDueByPlane.byWorker by parity spec)
  └─ worker-payout-pairs.ts (pure: classify, column figures, dialog rows, paidAheadOf)
       ├─ /pracownicy column          (cached fetch)
       ├─ fetchSettlePayoutRows       ('use server' read) → dialog
       └─ settlePayoutsAction         (uncached recompute → refuse if moved → one txn, sequential creates → sheet sync after commit)
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Per-pair read model | SQL fold + TS flag + shaping + cache, pinned by parity | SQL drifting from the TS formula |
| 2. Employee list column | „Wypłaty" out, „Pozostało do wypłaty" in | Golden master regenerated on a stale DB |
| 3. Booking action | N PAYOUTs atomically, stale/lock refusals | Partial write (EX-855), stale figures |
| 4. Dialog | Row UI, live math, both triggers | The row click also navigating |
| 5. Seed, docs, closure | Manual-check data, living docs, e2e-backlog | — |

**Prerequisites:** none (no migration). The golden master regenerates on a fresh `db:import:test`.
**Estimated effort:** ~3 sessions across 5 phases.

## Open Risks & Assumptions

- The multi-worker and withheld paths exist only in constructed data until real kosztorysy use them.
- Reading outside the booking transaction leaves a tiny race window. That's acceptable at 5 users.
- Sheet sync only writes from production; locally it's verified by the log line.

## Success Criteria (Summary)

- A worker's „Pozostało do wypłaty" equals Σ of his payable pairs. Per investment, Σ dialog rows
  equals the investment list's figure to the grosz.
- One submit books exactly the ticked wypłaty, or none at all.
- Paying ahead is impossible to miss in the dialog and remains readable on the booked wypłata.
