---
change_id: worker-expense-paragon-decisions
title: Accept or reject a worker expense zgłoszenie paragon by paragon
status: new
created: 2026-10-13
updated: 2026-10-13
archived_at: null
branch: null
worktree: null
---

## Notes

Accept or reject a worker expense zgłoszenie paragon by paragon, with a shared three-number counter badge. Linear: EX-1053.

Shaped with the user 2026-10-13 (follow-up to EX-1048, mirrors the per-line decisions of „Zgłoszenia wykonanych prac”):

- „Przyjmij” dialog lists only paragony still „do sprawdzenia”; per row „Przyjmij” / „Odrzuć”, plus
  „Przyjmij zaznaczone (N)” / „Odrzuć zaznaczone (N)” over the existing row checkboxes. A decided row
  leaves the list immediately. Closing the dialog decides nothing.
- „Połącz” only across still-waiting paragony; a merged row books as one transfer.
- Zgłoszenie status derived like `settleReport`: any paragon waiting → oczekujące; else ≥1 booked →
  przyjęte; else odrzucone.
- Counter „Przyjęte X · Odrzucone Y · Do sprawdzenia Z” — dialog header, the queue row, the worker's
  own list. ONE shared badge, also replacing the work-report badge („Do sprawdzenia · X z Y”).
- Undo an accepted paragon: no — cancel the transaction the normal way; the paragon does not return.
- Undo a rejected paragon: „cofnij” in a collapsed „Odrzucone (N)” section of the dialog → back to
  „do sprawdzenia”. „Przywróć” in Historia reopens the paragon in place (no new zgłoszenie).
- Worker cannot delete a zgłoszenie once anything in it is booked.
- Historia: each paragon row carries its own status, not the zgłoszenie's.
- A zgłoszenie without an AI read (no paragon list) stays all-or-nothing, as today, with no counter.

## Spike (2026-10-13, uncommitted in the worktree)

No schema change. The status is derived by `settleExpenseDraft` after every decision (pending while a read row is undecided → accepted if any transakcja → rejected). Booking and refusing each lock the zgłoszenie (`FOR UPDATE`) and are refused if any requested read row is already decided. A refusal reopens in place (`reopenSkippedReceipt`). Verified against the local DB in a rolled-back transaction: reject 2 → 35 pending; a double reject is refused; reject the rest → rejected; reopen → back to pending.

Open for the plan:

- Photos the AI read does not cover (blank rows) are not tracked per paragon. Once every read row is decided the zgłoszenie settles, while a blank row may still sit in the open dialog, and the next booking is refused.
- A row is booked after only a subset check against `bulkExpenseFormSchema`, so a failure shows a toast, not the field error.
- The badge and labels are hardcoded Polish (no i18n). The badge is not yet shared with work reports (EX-1049 worktree).
- Worktree dev needs `next dev --webpack`: Turbopack rejects the symlinked node_modules.
- Test fixtures for `ExpenseDraftRowT` lack `acceptedReadRows` / `rejectedReceipts`.
- **Przyjmij / Odrzuć is extremely slow** (owner, 2026-10-13) — must be fixed before this ships.
- A decided paragon stays in the dialog as its full row, folded and locked. On reopen an accepted row shows the AI read, not what was booked if the manager edited it, and a merged booking shows as its separate paragony.
- Cofnij exists only for a refusal tied to a read row; a refused photo without a read can't be undone in the dialog.
