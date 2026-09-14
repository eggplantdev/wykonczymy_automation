---
change_id: kosztorys-row-height-menu
title: Wysokość wiersza — dwuklik znika z uchwytu, dopasowanie i reset trafiają do menu wiersza
status: implemented
created: 2026-09-14
updated: 2026-09-14
archived_at: null
branch: null
worktree: null
---

## Notes

Dwuklik na uchwycie wiersza („dopasuj do treści") jest nieodkrywalny — jedyną wskazówką jest `title`
na 8-pikselowym pasku, który trzeba najpierw trafić kursorem. Odkąd w menu Widok stoi przełącznik
„Dopasuj wysokość wierszy" (`ffee8a92`), gest przestał być jedyną drogą do rozwinięcia opisu i został
jako pułapka: przy włączonym przełączniku nie robi nic widocznego, a cicho zapisuje nadpisanie.

Dziura ważniejsza od samego dwukliku: **nadpisania nie da się cofnąć.** `resolveRowHeight` stawia
przeciągniętą wysokość ponad wszystkim, więc wiersz spłaszczony przeciągnięciem ignoruje przełącznik
i nie ma polecenia, które by wpis z `kosztorys-v2-row-heights` usunęło.

Ustalenia z rozmowy (2026-09-14):

1. `onFit` wypada z `RowResizeHandle` — uchwyt tylko przeciąga.
2. Menu wiersza dostaje „Dopasuj wysokość do treści" (to, co robił dwuklik — świadome kliknięcie
   w nazwane polecenie to świadome przypięcie).
3. **Komenda kasująca nadpisanie wypadła** (decyzja właściciela po implementacji). Miała nazywać się
   „Przywróć domyślną wysokość" i pokazywać się tylko na wierszu z nadpisaniem — problem: „domyślna"
   nie jest jedną liczbą (52 px na pasku, treść przy włączonym przełączniku, 32 px poza tym), więc
   etykieta obiecywała coś innego niż robiła. Zdjęcie nadpisania nadal nie ma żadnej drogi w UI.
4. Nagłówek tabeli (klucz `header`) ma uchwyt, nie ma menu wiersza i nie ma `onFit`; jego nadpisanie
   też jest nie do cofnięcia — decyzja otwarta. Razem z paskiem sekcji i z nieosiągalną z UI podłogą
   `SECTION_BAND_ROW_HEIGHT` w `fitRowHeight()` zgłoszone jako **EX-776**.

Czeka na `2026-09-14-kosztorys-section-menu-split` (ten sam plik menu) — split wylądował w `1414b53d`.
