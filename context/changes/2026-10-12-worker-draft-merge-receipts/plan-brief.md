# Merge and split paragon rows in the „Przyjmij” dialog — Plan Brief

> Full plan: `context/changes/2026-10-12-worker-draft-merge-receipts/plan.md`
> Research: `context/changes/2026-10-12-worker-draft-merge-receipts/research.md`

## What & Why

The manager can merge several paragon rows of a worker's zgłoszenie into one transakcja („Połącz
zaznaczone”) and split it back („Rozłącz”). The worker loses „Jeden wydatek”: asking the model for one
total over many documents is wrong (#13: 257.50 / null / 286.90 zł for a true 287.90 zł), while
summing per-paragon reads in code is exact.

## Starting Point

The worker picks „Jeden wydatek” / „Kilka wydatków”; a multi-photo „Jeden wydatek” is read as one
document. „Przyjmij” builds one row per read row, with no way to group them. A booked transakcja
remembers its photos but not its paragony, so the duplicate check can't see a paragon inside a merged
booking.

## Desired End State

Every zgłoszenie is read paragon by paragon. In „Przyjmij” the manager ticks rows, merges them into
one row (summed Kwota, all photos once), splits it back from the stored read, and saves one transakcja
per row. A removed merged row is recorded paragon by paragon, so the worker's history and „Przywróć”
work as before. A paragon booked inside a merged transakcja is still caught as a duplicate.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Who groups paragony | The manager, by hand; „Jeden wydatek” removed from the worker | Removes the inexact single-document read and the second code path | Plan (owner) |
| Merged Kwota | Sum of what the rows show; blank = 0 | Manual merge — the manager sees and corrects it | Plan (owner) |
| Missing Kwota in a merge | Merged row shows „nie odczytano”, keeps all photos | Flags the gap without blocking the merge | Plan (owner) |
| „Rozłącz” | Rebuilds rows from the stored AI read; manual edits lost | The read is immutable, so the split is exact | Plan |
| Re-read a merged row | Hidden („Rozłącz” first) | A re-read of many photos is the inexact read being removed | Plan |
| Storage model | UI groups, DB keeps one fact per paragon (skips fan out) | `restoreSkippedReceipt` and the worker's history stay unchanged | Plan |
| Duplicates after booking | Fixed now: `read_rows int[]` on the link table | A merged transakcja otherwise hides its paragony from the check | Plan (owner) |
| Management „Nowy wydatek” | Untouched | Different flow, no reported problem | Plan |
| Multi-page invoice read per photo | Accepted risk, recorded in test-plan | Never arrived as a zgłoszenie; the manager corrects the sum | Plan |

## Scope

**In scope:** per-photo read for every draft; prefill from read rows; worker dialog without the mode
toggle; checkboxes, „Połącz zaznaczone”, „Rozłącz”; per-paragon skip fan-out; `read_rows` column and
duplicate candidates from merged bookings; test-plan + manual-checks docs.

**Out of scope:** management form „Generuj”/„Jeden wydatek”; dropping `scan_mode`; paragony the AI
omits entirely; merging hand-added rows; preserving edits across „Rozłącz”.

## Architecture / Approach

A line item maps to a list of parts (`{ mediaIds, readRow? }`) instead of one receipt. Pure
merge/sum/union logic lives in `src/lib/worker-expenses/`; one hook in `forms/expense-form/` updates
the parts map, the form rows and the file map in one handler. Booking sends each row's photo union plus
its read rows; the server stores `read_rows` on the link and the duplicate query expands them.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Read & prefill core | Per-photo read, prefill from read rows, merge/split functions | A paragon lost between booked and skipped — guarded by an invariant spec |
| 2. Worker dialog | No mode toggle, drafts stored `one-per-photo` | Stale i18n keys still read by the management form |
| 3. „Połącz” / „Rozłącz” | Selection, merge, split, hints that follow rows | Parts map, form rows and file map drifting apart |
| 4. Duplicates after booking | `read_rows` column + expanded candidates | Prod migration must run before the push |
| 5. Docs | test-plan risk row, manual-checks section | — |

**Prerequisites:** local 5433 and 5435 DBs up; `git status src/migrations` clean of other sessions' files before migrating.
**Estimated effort:** ~2–3 sessions across 5 phases.

## Open Risks & Assumptions

- Old pending drafts stored as one row over all photos open as one row — no special case, but the
  manager can't split it (no per-paragon read exists).
- A multi-page invoice read per photo may yield per-page subtotals; the manager corrects the sum.
- Additive migration: a human runs `pnpm db:migrate:prod` before the push.

## Success Criteria (Summary)

- #13-shaped zgłoszenie: 24 bileciki merged into one transakcja of 287.90 zł with all ticket photos.
- Merge → „Rozłącz” returns the original rows; a removed merged row lists each paragon as „odrzucony”.
- Resending a bilecik booked in a merged transakcja shows a duplicate hint pointing at it.
