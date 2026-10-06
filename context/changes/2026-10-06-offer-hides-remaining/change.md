---
change_id: offer-hides-remaining
title: Investor document hides „Pozostało" until the first etap entry
status: new
created: 2026-10-06
updated: 2026-10-06
archived_at: null
branch: null
worktree: null
---

## Notes

The investor document (podgląd, share link, „Generuj ofertę") shows „Pozostało" on an offer. Before any
etap has an entry it equals Wartość netto przedmiar on every row — a duplicate, 100% of the offer.

Decision (2026-10-06): „Pozostało" joins the settlement columns that stay off the document until the
first etap entry (`SETTLEMENT_TOTAL_COLUMNS` in `src/lib/kosztorys/settlement-columns.ts`), alongside
Pomiar z natury, Wartość netto and % wykonania. This reverses the 2026-09-28 note in that file
(„Pozostało … is a real figure, and the owner hides it by choice, not by data").

Resulting offer view: Opis, Przedmiar, j.m., Cena j.m., Wartość netto przedmiar.
