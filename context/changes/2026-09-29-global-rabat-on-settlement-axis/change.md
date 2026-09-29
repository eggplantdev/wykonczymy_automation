---
change_id: global-rabat-on-settlement-axis
title: Rabat kwotowy takes netto or brutto via two linked fields
status: preparing
created: 2026-09-29
updated: 2026-09-29
archived_at: null
branch: null
worktree: null
---

## Notes

The rabat kwotowy field takes the kwota on the investment's settlement axis: brutto rozliczenie → the
typed kwota is brutto (5000 typed = 5000,00 off the brutto bill), netto → netto. Store the axis with
the kwota so brutto stays exact.

Repro (prod dump 2026-09-29 10:24 UTC, local DB): inv. 112 Szeligowska 57b/7 — rozliczenie brutto,
VAT 8%, rabat kwotowy 5000 → Podsumowanie shows Rabat −5400,00. Owner intent: 5000 zł off.

Today the kwota is always netto and grosses by VAT in the brutto column (owner rule 2026-07-19,
`context/reference/kosztorys-editor-domain-notes.md` „Rabat też jest na płaszczyźnie prac"). That
rule — a rabat is a price concession, so its netto and brutto differ by VAT — stays; what changes is
which axis the owner types it on. Open: mixed rozliczenie (proposed default: netto).

**User direction (2026-09-29):** the axis is the owner's choice, not derived from the settlement
mode. Proposed UI: two linked fields, netto and brutto — type into either, the other shows the
computed counterpart live. On inv. 112 the owner types 5000 in brutto and every figure follows.
The "field follows the settlement axis" idea above is superseded by this.

**VAT change (user, 2026-09-29):** "if you change VAT then obviously it changes" — no anchor on the
typed axis is needed. Storing the netto stays the model (no new column); a brutto entry is stored as
its UNROUNDED netto (`brutto / (1 + vat)`), so the brutto re-derives to exactly what was typed
instead of drifting a grosz through a cent-rounded netto. To verify in research: every reader
rounds at display, and the write-side rounding added for the „172024,28000000003" display bug does
not cut the netto back to cents.

**Under consideration (user, 2026-09-29):** "treating global rabat as fixed price" — meaning not yet
pinned down (face-value kwota like strata vs an agreed ryczałt the rabat derives from).
→ **Resolved (user):** "in old sheets rabat was a transaction and it was a fixed amount" — i.e. the
legacy `RABAT` transfer: a zł kwota off the bill, not a ryczałt. Sheet probe agrees: the sheet's own
rabat is only ever a per-row percent (axis-free); a zł rabat lived only as the transaction.
