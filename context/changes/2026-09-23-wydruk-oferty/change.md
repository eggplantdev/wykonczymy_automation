---
change_id: wydruk-oferty
title: Wydruk oferty z kosztorysu — PDF dla klienta
status: implemented
created: 2026-09-23
updated: 2026-09-23
archived_at: null
branch: spike/wydruk-oferty
worktree: null
---

## Notes

Spike gotowy na `spike/wydruk-oferty` — teraz robimy to porządnie jako change.

Co stoi w drzewie po spike'u:

- `src/lib/kosztorys/build-offer-print-html.ts` — buduje cały dokument wydruku (HTML + CSS
  print) z wierszy kosztorysu; kolumny keyed po `description` / `plannedQty` / `unit` / `price` /
  `plannedNet`, wiersze filtrowane przez `applyRowConditions` + `clientConditionIds`.
- `src/components/kosztorys/editor/actions/offer-print-action.tsx` — pozycja „Wygeneruj ofertę w
  PDF" w menu „Inwestor"; otwiera popup synchronicznie z kliknięciem, dopiero potem dociąga
  ustawienia podglądu i wypełnia dokument.
- `src/components/kosztorys/editor/toolbar/menus/kosztorys-investor-menu.tsx` — wpięcie pozycji.
- `src/components/kosztorys/editor/kosztorys-editor-body.tsx` — usunięty przycisk „Drukuj" ze
  strony podglądu inwestora.

Ustalenia z sesji spike'owej, które change ma utrzymać:

- Oferta respektuje **zapisane ustawienia podglądu** (`hiddenColumns` / `hideEmptyRows`), a nie
  własny filtr — to ta sama decyzja właściciela, co podgląd i link dla klienta.
- Drukuje `rows`, nie `viewRows`: search / plan / filtry na siatce to gest czytania, nie decyzja
  o zakresie oferty.
- Netto only, bez VAT-u. Wartości bez groszy, grupowane `useGrouping: 'always'` (pl-PL CLDR
  sam by nie pogrupował czterocyfrowych).
- Kolorowe szyny sekcji rysowane w modelu `border-collapse: separate`, hairline jako tło z
  `background-clip: padding-box` — border mitruje się z szyną pod 45° i wycina w niej klin.

Jeszcze nie zrobione / do decyzji w planie:

- Wykres kołowy udziału sekcji (jest na arkuszu właściciela, w stopce oferty).
- Telefon / e-mail w nagłówku oferty — `getPreviewKosztorysById` zwraca dziś tylko
  `investmentName`.
- Brak jakichkolwiek testów — spike ich świadomie nie miał.
- Przypadek 2 wydruku (jeszcze nieopisany przez właściciela) jest poza zakresem.
