---
change_id: worker-expense-paragon-decisions
title: Accept or reject a worker expense zgłoszenie paragon by paragon
status: implementing
created: 2026-10-13
updated: 2026-10-13
archived_at: null
branch: main
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
- ~~A zgłoszenie without an AI read stays all-or-nothing, with no counter.~~ **Reversed (owner,
  2026-10-13): one behaviour for every zgłoszenie.** A photo the read does not cover — the whole
  zgłoszenie when the read returned nothing — is a paragon like any read row: same dialog, per-row
  Przyjmij / Odrzuć, counter, filtering. No plain expense form (Wyczyść, trash) inside acceptance.

## Spike (2026-10-13, uncommitted in the worktree)

No schema change. The status is derived by `settleExpenseDraft` after every decision (pending while a read row is undecided → accepted if any transakcja → rejected). Booking and refusing each lock the zgłoszenie (`FOR UPDATE`) and are refused if any requested read row is already decided. A refusal reopens in place (`reopenSkippedReceipt`). Verified against the local DB in a rolled-back transaction: reject 2 → 35 pending; a double reject is refused; reject the rest → rejected; reopen → back to pending.

Open for the plan:

- **Duplicates inside a merged zgłoszenie (owner, 2026-10-13 — follow-up after the slice review,
  must be handled):** before a merge, the same paragon sent in two one-photo zgłoszenia is flagged
  „Duplikat zgłoszenia #X” draft against draft. After „Połącz zgłoszenia” both are read rows of
  one zgłoszenie, and the duplicate check skips the zgłoszenie it probes, so they stop flagging each
  other. Needed: read rows of the same zgłoszenie matched against each other.

- **No read → still paragony (done in the spike):** the draft read now saves its row per photo even
  when every row came back blank (`read-expense-draft-receipts.ts`), so a photo the AI got nothing
  from is a read row like any other and the whole per-paragon path applies unchanged. Cost: no
  automatic re-read on the next open — „Odczytaj ponownie" on the row is the retry. Every page now
  gets a read row (a blank or the unreadable sentinel), so a page without one exists only on a
  zgłoszenie read before EX-1048.
- ~~A row is booked after only a subset check against `bulkExpenseFormSchema`, so a failure shows a toast, not the field error.~~ **Done (EX-1053).**
- ~~The counter badge, the queue and „Połącz zgłoszenia" are translated (pl/uk/ru); the badge shows
  only parts above 0. The paragon dialog stays Polish, like the whole expense form. The badge is not
  yet shared with work reports (EX-1049 worktree).~~ **Done (EX-1053).**
- Worktree dev needs `next dev --webpack`: Turbopack rejects the symlinked node_modules.
- ~~Test fixtures for `ExpenseDraftRowT` lack `acceptedReadRows` / `rejectedReceipts`.~~ **Done (EX-1053).**
- ~~**Przyjmij / Odrzuć is extremely slow** (owner, 2026-10-13) — must be fixed before this ships.~~ **Done (EX-1053).**
- A decided paragon stays in the dialog as its full row, folded and locked. On reopen an accepted row shows the AI read, not what was booked if the manager edited it, and a merged booking shows as its separate paragony.
- ~~**A booking whose response is lost desyncs the dialog** (hit 2026-10-13, draft 24): the request
  was cut client-side (`ECONNRESET`) while the server committed transakcja #5890 for read rows
  31–36. The dialog took `REQUEST_FAILED` as „not booked" and kept those paragony as waiting. The
  next decision touching them hit the read-row clash and reported „To zgłoszenie zostało już
  rozpatrzone" — wrong, the zgłoszenie is still pending — and the duplicate check flagged them as
  duplicates of their own transakcje. Needed: on `REQUEST_FAILED` or a clash, re-read the draft's
  decided read rows and resync the dialog (the case `settleAction`'s `code` exists for), and a
  clash notice that names paragony rather than the whole zgłoszenie.~~ **Done (EX-1053).**
- **Historia status column** (owner, 2026-10-13): „czeka" is dropped while the counter is shown
  (done in the spike) — „Do sprawdzenia N" says it. Still open: an old zgłoszenie (no per-paragon data) should still get the counter, not fall back to the status
  badge alone. Owner to come back to the exact rule.
- **„Połącz zgłoszenia" in the queue (spike, owner 2026-10-13):** a worker sent ~30 one-photo
  zgłoszenia. Tick them in the pending queue → „Połącz zgłoszenia (N)" folds them into the oldest
  one, as if sent in one go (photos appended in send order, read rows concatenated, notes joined,
  the rest deleted), then it opens in the paragon dialog like any other. Allowed only when every
  selected zgłoszenie is pending with no decided paragon, and all share the worker, investment and
  kasa; each is read first (the merge needs the reads). Irreversible, ignores the 8-photo limit, and
  the worker sees one zgłoszenie — all accepted by the owner. `mergeExpenseDrafts` /
  `mergeExpenseDraftsAction`. Tested on the prod dump and approved as the way to do it (owner,
  2026-10-13). Combining automatically — a new send appended to the worker's open zgłoszenie for the
  same investment and kasa — was discussed and not taken; it would need a read of only the new photos
  and a rule for the worker's „Usuń" on a zgłoszenie holding several sends.
  A merge doesn't need the photos looked at first: it decides nothing — every paragon stays its own
  row — and the worker/investment/kasa rule matches what the dialog books under anyway. The opposite
  route, one dialog over several zgłoszenia, can't „Połącz" across them: a transakcja links to one
  zgłoszenie (`worker_expense_draft_transfers` is keyed by `transfer_id`).
