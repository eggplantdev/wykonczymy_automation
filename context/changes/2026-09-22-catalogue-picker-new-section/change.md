---
change_id: catalogue-picker-new-section
title: Nowa sekcja zakładana wprost w „Dodaj pracę z katalogu"
status: implemented
created: 2026-09-22
updated: 2026-09-22
archived_at: null
branch: null
worktree: null
---

## Notes

Dziś „Dodaj do:" w pickerze katalogu tylko **wybiera** sekcję. Żeby dołożyć prace do nowej sekcji,
trzeba zamknąć okno → „Dodaj" → „Sekcja" (powstaje „Nowa sekcja" **z pustym wierszem**) → zmienić
nazwę w siatce → otworzyć picker jeszcze raz. Wyjątkiem jest pusty kosztorys: `openPicker()`
(`kosztorys-add-menu.tsx:37`) sam zakłada sekcję i podaje ją wybraną.

Zakres uzgodniony w rozmowie:

- „Dodaj do:" przyjmuje **nazwę nowej sekcji** albo wybór istniejącej — jedna kontrolka,
  `ui/combobox.tsx` (`allowCustom` + `modal`), bo ma już wiersz „Dodaj „X"" dla wartości spoza listy;
- sekcja i prace powstają w **jednej transakcji** na „Dodaj" — nie z góry, żeby „Anuluj" nie
  zostawiało pustej sekcji-sieroty;
- nowa sekcja **bez pustego pierwszego wiersza** — prace są jej treścią
  (`createSectionWithFirstItem` zakłada wiersz, bo goła sekcja potrzebuje gdzie pisać; tu byłby
  dziurą nad pozycjami z katalogu).

Decyzja właściciela (2026-09-22): **dwie sekcje o tej samej nazwie nie mają sensu** — nazwa jest
tożsamością. Stąd kontrolka kluczowana nazwą, a wpisanie istniejącej nazwy trafia w tę sekcję
zamiast zakładać bliźniaczkę.

Świadomie **poza zakresem**: zmiana nazwy w siatce nadal może zrobić bliźniaczkę (brak bramki na
unikalność), a jedna para duplikatów już siedzi w zrzucie (185 sekcji) — jej druga sekcja będzie
z tego pickera nieosiągalna do czasu zmiany nazwy.
