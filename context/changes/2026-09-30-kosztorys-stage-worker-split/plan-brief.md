# Several workers per etap — split of the executed-work pool (EX-943) — Plan Brief

> Full plan: `context/changes/2026-09-30-kosztorys-stage-worker-split/plan.md`
> Research: `context/changes/2026-09-30-kosztorys-stage-worker-split/research.md`

## What & Why

An etap can now have several workers. Its executed-work value (pomiar × stawka podwykonawcy,
pre-rabat, at the etap's plane) is divided between them by percent or by amount. Every worker but
one carries an entered value, and the last one takes the rest.

This reverses EX-613's rule „jeden etap, jeden pracownik". Real crews share etapy, and today the
whole etap's money lands on one person.

## Starting Point

Today an etap stores one `worker_id`. The etap's value is credited to that one person in two
places:
- the TS fold `subcontractorDueByPlane`, used by the editor, the panel and the worker view;
- its SQL twin `selectWorkerPayoutPairs`, used by Pracownicy, „Rozlicz wypłaty" and the listing.

Both are pinned together by a DB parity spec.

## Desired End State

- „Pracownicy etapu…" in the etap header opens a dialog with:
  - a % / kwota switch;
  - a value per person, and one person taking the rest;
  - live zł per person.
- The header shows „Jan Kowalski +1".
- Every per-person figure follows the split: Podsumowanie podwykonawców, Pracownicy, Rozlicz
  wypłaty, the listing, the worker link and the PDF („Twój udział").
- Margin and every investment-level total are unchanged.
- Existing etapy migrate as one-person splits, so no figure moves.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| The pool | pomiar × stawka podwykonawcy, pre-rabat, at the etap's own plane | the figure EX-613 already credits wholesale | Owner |
| Fixed-amount cap | Σ kwot ≤ executed work at save; refused otherwise | „nie da się ustalić kwoty ponad pracę" | Owner |
| Pool drops later | fixed amounts shrink pro rata, the reszta gets 0, marker + filter entry | never negative; a pomiar correction is never refused | Owner |
| No executed work | nobody is credited | „nie dzielimy pieniędzy, których nie ma" | Owner |
| Plane-less etap | credits nobody and flags every member | kept from EX-613 | Owner |
| Worker view | whole-etap rows and totals, „Twój udział" separately, no co-workers; przedmiar unscaled | owner rule | Owner |
| New etap from the menu | copies the whole split | same as plane/worker today | Owner |
| Dialog | a new person enters at 0; a mode switch zeroes values; no confirm on save | live zł makes „Zapisz" the decision | Plan |
| Storage | raw table `kosztorys_stage_workers` plus `split_mode` on the etap | a Payload collection costs 9 migration items (lesson ~1732) | Research |
| One rule | SQL prices the pool per etap; one TS `splitStagePool` runs on both paths | the rule cannot drift between screens | Owner |
| `worker_id` | kept this deploy, dropped in a follow-up push | never ADD and DROP in one push (lesson ~1558) | Plan |
| Snapshots | no version bump; a tolerant reader turns legacy `workerId` into a one-person split | lesson ~772 | Research |

## Scope

**In scope:**
- the split rule;
- the migration and backfill;
- tree read, split action, add-etap copy, sheet import, restore/snapshots;
- the user-delete guard;
- the reference fold and the SQL pairs path;
- the dialog, header and problem filter;
- the worker view and PDF;
- the golden-master re-sign;
- the living docs.

**Out of scope:**
- dropping `worker_id`;
- showing co-workers to a worker;
- scaling przedmiar by the share;
- undo for split edits;
- splits in szablony;
- any change to margin or the client figures.

## Architecture / Approach

The arithmetic lives in one pure module (`stage-worker-split.ts`). The reference fold
(`subcontractor-due.ts`) routes each etap's pool through it. The pairs SQL stops grouping by
worker and returns a pool per etap, plus the members, and a pure TS fold applies the same rule.
The server action writes the mode and the members in one transaction, and re-checks the cap
against a pool it computes itself.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Split rule | pure split / validate / normalise + specs | float residue producing a negative share |
| 2. Storage & reference fold | migration, type change, every read/write path, delete guard, cache keys, golden master | a missed stage-write path (lesson ~530); ~46 spec fixtures to move |
| 3. Pairs path | SQL pool per etap + TS fold on the same rule | Σ pairs ≠ the listing |
| 4. Editor UI | split dialog, „+N" header, scaled-down marker and filter | dialog state and validation UX |
| 5. Worker view + PDF | „Twój udział", whole-etap totals | the PDF footer no longer adds up — intentional |
| 6. Docs | domain notes, financials, glossary, test-plan risk | — |

**Prerequisites:**
- `fae76527` (sheet import) is landed.
- Local docker and `db-test` are migrated before the DB specs run.

**Estimated effort:** ~3–4 sessions. Phase 2 is the heaviest.

## Open Risks & Assumptions

- A worker reassigned between the prod migrate and the deploy going live is lost, because the old
  code writes only `worker_id`. That is acceptable at 5 users; it goes in the push note.
- The members table cascades on user delete. The delete guard blocks this, and normalisation
  covers a bypass.
- The golden master must be diffed figure-by-figure before re-signing (lesson ~1781).

## Success Criteria (Summary)

- A 4-person etap at 25% shows each person a quarter on every screen, and the investment totals
  do not move.
- Lowering pomiar below the fixed amounts shrinks them pro rata, shows „popraw podział", and never
  shows a negative share.
- After migration every existing etap shows the same worker and the same figures as before.
