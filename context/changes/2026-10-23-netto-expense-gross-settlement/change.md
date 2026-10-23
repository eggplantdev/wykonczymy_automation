---
change_id: netto-expense-gross-settlement
title: Netto expense bills netto plus the investment's VAT when materiały settle brutto
status: implemented
created: 2026-10-23
updated: 2026-10-23
archived_at: null
branch: netto-expense-gross-settlement
worktree: ../wykonczymy-worktrees/netto-expense-gross-settlement
---

## Notes

Przy rozliczeniu materiałów brutto wydatek inwestycyjny netto nadal jest przypadkiem specjalnym: liczy się
jako netto + stawka VAT inwestycji (netto × (1 + vatRate)). Rozliczenie netto bez zmian (zamrożone netto).

Decyzja 2026-10-23 (zastępuje wcześniejsze „po kwocie brutto z wydatku”): „wydatek budowlany netto w
przypadku rozliczenia wydatków brutto to jest ciągle specjalny przypadek — będzie liczył się jako netto +
stawka vat inwestycji”.

Źródło: zgłoszenie Bartka 21.10.2026 (Mateusz Polis, Hilarego Koprowskiego 11m12; Karol Pawlak
Mirabelki 5/93 #5986 — dziś przy brutto liczy 3662,38 zamiast 4504,73).

Poprzednia zmiana tego mechanizmu: `context/archive/2026-07-29-netto-expense-grossup/`.
