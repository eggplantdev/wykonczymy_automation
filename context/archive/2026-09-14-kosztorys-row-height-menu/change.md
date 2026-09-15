---
change_id: kosztorys-row-height-menu
title: Wysokość wiersza — dwuklik znika z uchwytu, dopasowanie trafia do menu wiersza
status: archived
created: 2026-09-14
updated: 2026-09-14
archived_at: 2026-09-14T20:48:55Z
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

## Domknięcie punktu 4 — EX-776 (2026-09-15)

Rozstrzygnięcia właściciela, spisane tutaj, bo issue ginie. Reguła, która je porządkuje:
**komenda „Dopasuj wysokość do treści" należy się wierszowi, którego nadpisanie odcina od treści na
trwałe — a nie każdemu wierszowi z uchwytem.**

- **Pasek sekcji: uchwyt + ta sama komenda w menu „…".** Pasek ma treść (`sectionName`), ale
  jednolinijkową i wylewającą się w bok, nie w dół (`.kosztorys-band-label-cell { overflow: visible }`),
  a `rowContentLines` czyta wyłącznie `description`/`note`, których pasmo nie ma. Więc
  `fitRowHeight(bandId, 1)` zawsze zwraca `SECTION_BAND_ROW_HEIGHT` = 52 — na pasku ta komenda **jest**
  drogą powrotu z przeciągnięcia. Przy okazji podłoga `SECTION_BAND_ROW_HEIGHT` w `fitRowHeight()`
  przestała być nieosiągalna z UI, więc przelot dead-code jej nie skasuje.
- **Stopka sekcji („Razem <sekcja>"): zostaje bez komendy, świadomie.** Dostaje uchwyt (strażnik
  w `ordinal-gutter-column.tsx` wyklucza tylko `SPACER_ROW_ID`/`TOTALS_ROW_ID`), a `SectionFooterCell`
  renderuje w „Akcjach" pusty div. To nie jest ta sama pułapka co u pozycji: stopka nie jest pasmem,
  więc jej podłoga to `ITEM_ROW_HEIGHT` = 32 i `RowResizeHandle` klampuje do niej i na podglądzie,
  i przy commicie — a domyślna wysokość stopki to też 32. Zapisane nadpisanie 32 jest nieodróżnialne
  od trybu automatycznego, czyli przeciągnięcie stopki jest odwracalne gołym uchwytem. Koszt: martwy
  wpis w `kosztorys-v2-row-heights`.
- **Wiersz nagłówka: tylko ręcznie, i nie wracamy do tego.** Żadnej komendy w menu „Widok"; uchwyt
  zostaje. `resolveHeaderRowHeight()` niesie za to ten sam strażnik `Number.isFinite` + podłogę
  `HEADER_ROW_HEIGHT` co `resolveRowHeight`.
- **Etykieta na pozycji zostaje bez zmian** — „Dopasuj wysokość do treści" podmienia tam jedno trwałe
  nadpisanie na inne (wiersz nadal ignoruje przełącznik „Dopasuj wysokość wierszy", pkt 3 wyżej).
  Odrzucone przemianowanie na „Wróć do automatycznej wysokości".
- **Odrzucone:** zawijanie etykiety pasma (to zmiana układu pasma, osobny temat).

Komenda na pasku wywlekła przy okazji dwie wady w `react-datasheet-grid` — obie naprawione
w `patches/react-datasheet-grid@4.11.6.patch` (uzasadnienia stoją w komentarzach w samej łatce),
strażnik: `src/__tests__/datasheet-grid-row-height-cache.test.ts`.
