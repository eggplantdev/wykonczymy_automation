# Worker expense paragon decisions — Plan Brief

> Full plan: `context/changes/2026-10-13-worker-expense-paragon-decisions/plan.md`

## What & Why

The EX-1053 spike (merged to `main`) lets a manager accept or reject a worker's zgłoszenie wydatku paragon by paragon, and merge many one-photo zgłoszenia into one. It works, but:

- Przyjmij takes 2.5–3.5 s;
- a lost response leaves the dialog lying about what was booked;
- the logic has no tests;
- the counter badge is duplicated by the work-report one.

This plan turns the spike into a shippable change.

## Starting Point

- **Server side.** The DB derives the zgłoszenie's status after every decision under a lock, with no schema change. Both refusals collapse into one misleading notice.
- **Client side.** The dialog re-uploads the worker's photos for every paragon, and renders the route twice per decision.
- **Placement.** The queue lives only on the dashboard. `/zgloszenia-wydatkow` shows the history alone, pending first.

## Desired End State

- **Przyjmij of one paragon** costs the handler plus one render. The transakcja links the worker's existing photos under their camera filename.
- **A failed or clashing decision** resyncs the dialog from the server and names the paragony involved.
- **One three-number badge** („Przyjęte · Odrzucone · Do sprawdzenia”) serves both expense zgłoszenia and work reports.
- **`/zgloszenia-wydatkow`** shows the queue, with „Połącz zgłoszenia”, above a history of every status ordered by „Data wysłania” descending.

## Key Decisions Made

| Decision          | Choice                                                       | Why (1 sentence)                                                                                           |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Photos on booking | Link the zgłoszenie's existing media, no rename              | The re-upload is the biggest cost; a transakcja is only ever cancelled, never deleted, so the photo stays. |
| Attachment name   | Camera filename                                              | Owner ruling; reverses the EX-1048 rename check.                                                           |
| Refresh           | `deferRefresh` on the draft booking, one refresh on close    | The action's response is already the render (EX-908).                                                      |
| Ambiguous outcome | Re-read decided read rows and resync                         | Mirrors kosztorys `settle-tree-replace.ts`; never guess on `REQUEST_FAILED`.                               |
| Refusals          | `not-pending` vs `clash` with read-row indices               | A clash on a still-pending zgłoszenie must not say „już rozpatrzone”.                                      |
| Refactor depth    | Pure logic to `lib/worker-expenses/` + own paragon component | Testable without rendering; removes the three-way flag threading.                                          |
| Shared badge      | In this change, always shown, parts > 0, `ui/` primitive     | Owner: one badge everywhere, also replacing the work-report one.                                           |
| Page              | Same queue table as the dashboard, merge in both places      | Owner request.                                                                                             |
| History order     | All statuses, „Data wysłania” desc by default                | Owner: no pending-first default.                                                                           |

## Scope

**In scope:**

- distinct refusals, a resync read, and duplicate exclusion of the draft's own transakcje;
- DB specs for every per-paragon path;
- the speed fixes;
- dialog extraction and resync;
- the shared badge;
- the queue on `/zgloszenia-wydatkow` and the history order;
- lessons and test-plan updates.

**Out of scope:**

- photos without a read row (unreachable);
- dialog translation;
- undoing an accepted paragon;
- auto-combining on send;
- schema changes;
- an E2E spec.

## Architecture / Approach

1. **Server first.** The refusal union, `findExpenseDraftDecisions` and the duplicate exclusion, pinned by DB specs.
2. **The client stops doing work it doesn't need:** no re-upload, no rename, no second render.
3. **Extract before changing behaviour.** The dialog's logic moves to pure modules under test, then the paragon component gains `onFailed` → resync.
4. **Finish with UI on stable data:** the badge, then the page.

## Phases at a Glance

| Phase                | What it delivers                                                 | Key risk                                                       |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Server + DB tests | Distinct refusals, resync read, duplicate exclusion, specs       | Clash query must stay inside the `FOR UPDATE` lock             |
| 2. Speed             | No photo upload, one render per decision                         | Orphan cleanup must never delete a draft's existing photo      |
| 3. Dialog hardening  | Pure logic + tests, own paragon component, resync on failure     | Splitting `expense-form.tsx` without regressing the plain form |
| 4. Shared badge      | `DecisionProgressBadge` across expenses and work reports         | Six call sites; i18n keys removed in three languages           |
| 5. Page              | Queue with merge on `/zgloszenia-wydatkow`, newest-first history | Header sort state must match the new default order             |
| 6. Docs              | Lessons entry superseding EX-1009, test-plan risks               | —                                                              |

**Prerequisites:**

- the spike merged on `main` (done);
- the 5435 `db-test` container up and imported for the DB specs.

**Estimated effort:** ~2–3 sessions across 6 phases.

## Open Risks & Assumptions

- **Badge tone.** Negative for „Odrzucone” is assumed. Adjust at review if it reads as too alarming next to work reports.

## Success Criteria (Summary)

- A manager decides a 30-paragon zgłoszenie without waiting seconds per click.
- A dropped connection never leaves a booked paragon shown as waiting.
- Expense zgłoszenia and work reports show progress the same way.
