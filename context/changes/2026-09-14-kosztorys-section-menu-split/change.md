---
change_id: kosztorys-section-menu-split
title: Rozbicie menu ⋯ — akcje sekcji na pasek sekcji, akcje pracy na wiersz
status: implementing
created: 2026-09-14
updated: 2026-09-14
archived_at: null
branch: szablony-crud
worktree: null
---

## Notes

Ponowne rozbicie jednego menu ⋯ na dwa: „Praca" zostaje na wierszu pozycji, cała grupa „Sekcja"
przenosi się na pasek sekcji. Odwraca `context/archive/2026-07-26-kosztorys-merged-row-menu/`
(które samo odwracało EX-580 p4, commit `7af257b2`).

### Dlaczego znowu

Powód scalenia z 2026-07-26 brzmiał: dwa ⋯ w tej samej przyklejonej kolumnie „Akcje" powtarzają te
same cztery komendy porządkowe i nie widać, do czego się odnoszą. Dziś jest nieaktualny — menu nosi
nagłówki grup („Praca" / „Sekcja"), a oba triggery siedzą na **różnych wierszach** (pasek vs wiersz
pozycji), więc cel jest czytelny bez etykiety.

Drugi, mocniejszy powód: zaakceptowany wtedy kompromis „rozwiń żeby działać" — zwinięta sekcja
renderuje tylko pasek, więc jej własne komendy są nieosiągalne. Split to kasuje.

### Decyzje właściciela (2026-09-14)

1. **⋯ sekcji siedzi w slocie „Akcje" paska** — trzeci slot w `SectionHeaderCell` obok `label` /
   `blank`. Ta jedna komórka **nie zwija sekcji**, tylko otwiera menu. Bez zatrzymywania propagacji:
   komórka po prostu nie dostaje handlera zwijania.
2. **Grupa „Sekcja" znika z menu wiersza całkowicie.** Świadomie przyjęty efekt uboczny: przy
   włączonym sortowaniu kolumny paski sekcji znikają z gridu, więc razem z nimi znika jedyne wejście
   do akcji sekcji. Dziś przy sortowaniu „Wstaw/Przesuń" są wygaszone, ale kolor i „Usuń sekcję"
   nadal działają z menu wiersza — po zmianie trzeba najpierw wyczyścić sortowanie.
3. **„Wybierz pozycję z katalogu prac" → „Dodaj pracę z katalogu…", tylko w menu sekcji.** Ta akcja
   od zawsze celowała w sekcję, nie w pozycję: praca ląduje **na końcu sekcji**
   (`insertCatalogueItemsAction` → `appendCatalogueItems`), dlatego jako jedyna nie gasła przy
   sortowaniu. Zostaje na końcu sekcji — bez wstawiania pod klikniętym wierszem.
4. **„Zapisz pozycję do katalogu prac" zostaje na wierszu** — dotyczy tej jednej pozycji.

### Stan wyjściowy w kodzie

- `grid/cells/section-header-cell.tsx` — `SectionHeaderSlotT = 'label' | 'blank'`; kolumna „Akcje"
  paska to dziś pusta, klikalna komórka zwijająca. `CHROME_COLUMN_IDS` wyklucza `actions` z bycia
  kolumną etykiety.
- `grid/menus/kosztorys-row-actions-menu.tsx` — obie grupy z `DropdownMenuLabel` + separatorem;
  `section?: SectionActionsT` gatuje całą grupę (widok read-only → brak).
- `grid/row-actions-column.tsx` — składa bundle `section` z czterech callbacków `editorOnly()` oraz
  `getSectionItemCount`; `useCataloguePicker()` z kontekstu (stan pickera nie może siedzieć tam,
  gdzie grid się przerysowuje — EX-496).
- `kosztorys-editor-body.tsx:165` — buduje `sectionHeader` (figures / collapsed / onRename /
  labelColumnId); tędy trzeba dowieźć callbacki sekcji na pasek.
- `use-kosztorys-editor.ts:496-505` — `onInsertSection` / `onReorderSection` / `onSetSectionColor` /
  `onRemoveSection` / `getSectionItemCount` w `columnOpts`; hook zwraca dziś na zewnątrz tylko
  `onRenameSection` (linia 1241).
- Punkt wyjścia do odtworzenia menu sekcji: `git show 7af257b2 -- .../kosztorys-section-actions-menu.tsx`
  (skasowany plik). Uwaga: `CellMenuTrigger` i obecna treść `ConfirmDialog` są nowsze niż tamten commit.

### Do posprzątania przy okazji

`context/foundation/manual-checks.md:581,589` trzyma dwa otwarte FAIL-e EX-580 („pasek nie ma menu,
akcje sekcji siedzą na wierszu") — opisywały projekt porzucony w 2026-07-26. Ta zmiana przywraca
opisany tam stan, więc oba wpisy domykają się tutaj.
