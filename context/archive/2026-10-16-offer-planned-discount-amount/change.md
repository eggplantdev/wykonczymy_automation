---
change_id: offer-planned-discount-amount
title: Show the rabat amount on przedmiar in the offer and the kosztorys editor
status: archived
created: 2026-10-16
updated: 2026-10-18
archived_at: 2026-10-18T09:25:00Z
branch: offer-planned-discount-amount
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/offer-planned-discount-amount
---

## Notes

The investor document (share link, podgląd, PDF) shows the rabat % but not the rabat amount on
przedmiar. „Rabat kwota netto" is computed on pomiar (Σ etapów, sheet column T), so it sits in the
settlement columns and stays hidden until some etap has an entry — i.e. always, in the offer phase.
„Wartość przedmiaru netto" (sheet column S) is already after the rabat, but its header doesn't say so.

Agreed with the user (2026-10-16):

- New column „Rabat kwota netto (przedmiar)" = przedmiar × cena − wartość przedmiaru netto.
- Shown in the investor document when any pozycja has a rabat; an offer without rabat is unchanged.
- Must also be available in the main kosztorys editor — the investor document never shows a figure
  the editor doesn't.
- „Wartość przedmiaru netto" header gets „po rabacie" only on offers that carry a rabat
  (b921b9476 dropped „po rabacie" from the executed-value column because it read as a granted rabat
  on offers that had none — the conditional label avoids repeating that).
- Keep the existing „Rabat kwota netto" single-meaning (rabat on pomiar); don't overload it.

Decisions and known gaps from the review gate (2026-10-16):

- Known gap, no test: `hasPlannedDiscount` reads przedmiar only, so a rabat row with przedmiar 0 but
  „aktualizacja przedmiaru" > 0 leaves the „aktualizacji" headers without „— po rabacie". Header hint
  on a rare state; widening the predicate would also un-drop the empty column (the same predicate
  feeds `investorEmptyColumnIds`), so it was left alone.
- The „Opcje" checklist keeps the plain name „Rabat kwota netto (przedmiar)" — a setting keeps one
  stable name (`COLUMN_LABELS`); the „— po rabacie" suffix lives only on headers
  (`withAfterDiscountSuffix`).
- Follow-up the user asked for (2026-10-16): the investor PDF also prints the rabat sum under each
  „Razem — <sekcja>" row and a „W tym rabat" line under „Razem netto". The wording „W tym rabat" is
  the user's even though „Razem netto" is already post-rabat — don't reword it.
