---
change_id: worker-view-settlement-columns
title: Worker view reveals settlement columns on first entry and can drop przedmiar once work exists
status: implementing
created: 2026-09-29
updated: 2026-09-29
archived_at: null
branch: staging # shared working tree — switching HEAD would redirect parallel agents' commits
worktree: null
---

## Notes

— widok pracownika (link, Podgląd, PDF): (1) kolumny rozliczenia (pomiar razem etapy, wartość wykonana, etapy) pojawiają się dopiero po pierwszym wpisie w etapach pracownika — tak jak u inwestora; (2) etapy bez wpisów ukryte; (3) nowy checkbox w „Ustawienia widoku pracownika", domyślnie zaznaczony: „Przedmiar" i „Wartość przedmiaru netto" znikają, gdy jest już wykonana praca; odznaczony — zostają.

Reverses the earlier decision recorded at `src/components/kosztorys/editor/grid/column-selection.ts:109`
(„an investor's empty etap is not a reason to hide it from a crew") — owner request, 2026-09-29.
