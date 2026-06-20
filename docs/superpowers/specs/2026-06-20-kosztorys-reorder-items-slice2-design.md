# Kosztorys v2 — edytowalność strukturalna, Slice 2 (reorder pozycji w sekcji)

**Status:** zaakceptowany (brainstorm 2026-06-20) · **Change:** `context/changes/kosztorys-poc-in-app`

Drugi slice zdejmowania `lockRows`: ręczne przestawianie **pozycji w obrębie jednej
sekcji** strzałkami ▲▼ w siatce edytora v2, z natychmiastowym zapisem `display_order`.
Reorder sekcji, przenoszenie pozycji między sekcjami i drag-drop są poza tym slice'em
(patrz „Poza zakresem"). Bazuje na Slice 1
(`2026-06-20-kosztorys-add-remove-struktura-slice1-design.md`).

## Kontekst

- Edytor v2 (`src/components/kosztorys/kosztorys-editor-v2.tsx`) renderuje **płaską**
  siatkę: każdy wiersz = pozycja, sekcja to zdenormalizowana kolumna; sekcje leżą jako
  **ciągłe bloki** (kolejność z `treeToRows`). `rows` żyje w `useState`, struktura zmienia
  się optymistycznym `setRows` (Slice 1), `lockRows` zostaje włączone.
- **Dwie niezależne „kolejności"** — kluczowe rozróżnienie tego slice'a:
  - **`display_order`** (`kosztorys-items.displayOrder`, per sekcja) — kolejność **zapisana**,
    „prawda" w bazie, naturalny układ wierszy. Pole **już istnieje** (używa go `addItemAction`
    i `treeToRows`).
  - **Sort kolumnowy** (`sort` w stanie edytora) — **nieniszcząca nakładka wizualna** nad
    `rows`. Klik nagłówka cyklicznie asc → desc → off; nie dotyka `display_order`.
- **Brak `reorderItemsAction`** — to jedyny brakujący backend tego slice'a.

## Zakres (Slice 2)

Ręczne przestawianie **pozycji w obrębie ich sekcji**. Pozycja **nie zmienia sekcji**.
Sekcje się nie przestawiają. „Przywrócić nieposortowane" = **zdjąć sort kolumnowy** (trzeci
klik w nagłówek) — `display_order` cały czas leży nietknięty pod spodem, więc nie trzeba
trzymać żadnego osobnego stanu/snapshotu/historii.

## Schemat

**Bez zmian.** `kosztorys-items.displayOrder` istnieje. Reorder = przepisanie wartości tego
pola pozycjom w sekcji.

## Akcja — `reorderItemsAction`

`reorderItemsAction(sectionId: number, orderedItemIds: number[])` w
`src/lib/actions/kosztorys.ts`:

- Renumeruje `display_order = <index na liście>` dla pozycji sekcji wg `orderedItemIds`.
- **Pełna lista** sekcji (nie swap dwóch) — serwer dostaje całą prawdę o kolejności i
  renumeruje od zera. Idempotentne, odporne na dryf między klientem a bazą.
- Wzorzec `protectedAction`, tag `['kosztorysItems']`.

## UX — strzałki ▲▼ w siatce

- **Kolumna akcji** w siatce: ▲▼ obok kosza z usuwaniem (Slice 1).
- ▲ robi swap z **poprzednią pozycją tej samej sekcji**; ▼ z **następną tej samej sekcji**.
- **Brak sąsiada w sekcji** (pozycja na górze/dole swojego bloku) → **no-op** — strzałka
  **nie** przeskakuje do innej sekcji (to feature docelowy, patrz niżej).
- **▲▼ aktywne tylko gdy `sort === null`** (kolejność naturalna). Przy aktywnym sorcie
  kolumnowym „w górę" względem listy posortowanej po cenie nie ma odwzorowania w
  `display_order` — więc strzałki **wyszarzone**; najpierw zdejmij sort.

## Model stanu — natychmiastowy optymistyczny splice

Spójnie z add/remove ze Slice 1 (**nie** jawny „Zapisz kolejność"). Świadome odejście od
szkicu Slice 1 (linie 98-101 tamtego specu) — uzasadnienie w „Odrzucone alternatywy".

1. **Lokalnie:** swap dwóch wierszy w master `rows` → siatka od razu pokazuje nowy układ
   (przy `sort === null` `viewRows` zachowuje kolejność `rows`, bo `filterRows` nie sortuje).
2. **W tle:** `reorderItemsAction(sectionId, orderedIds)`.
3. **`prevById`** (mapa po `id` pozycji) — bez zmian; jest niezależna od kolejności, więc
   diff edycji pól zostaje spójny.
4. **`router.refresh()`** bezpieczny — serwer ma już zapisaną kolejność, reseed `treeToRows`
   odtworzy ten sam układ.

## Helper

`swapItemInSection(rows, itemId, dir)` w `src/lib/kosztorys/v2-rows.ts` — czysty,
testowalny. Operuje na **sekwencji wyświetlania pozycji tej samej sekcji**, nie na surowych
indeksach tablicy `rows`. Zwraca nową tablicę `rows` (lub tę samą referencję / niezmieniony
układ przy no-op). Z niej edytor wyłuska `orderedItemIds` sekcji do akcji.

## Inwarianty i edge-case'y

- **Pozycja nie opuszcza sekcji.** Swap zawsze w obrębie `sectionId`; brak sąsiada → no-op.
- **Zazębienie z `applyAddItem` (Slice 1).** `applyAddItem` dopina nowy wiersz na **koniec**
  `rows`, nie do bloku swojej sekcji — więc świeżo dodana pozycja bywa wizualnie poza blokiem
  do najbliższego `router.refresh()`. Dlatego helper reorderu **musi** działać na sekwencji
  wyświetlania tej samej sekcji (filtr „ta sama `sectionId`" po kolejności w `rows`), nie na
  założeniu o ciągłości bloku. (Alternatywa — naprawić `applyAddItem`, by wstawiał w sekcję
  — dotyka Slice 1, więc tu wybieramy tolerancję.)
- **Filtr do sekcji (`activeSectionId`) + reorder** komponują się: `viewRows` to wtedy
  podzbiór jednej sekcji w tej samej kolejności względnej; swap działa identycznie.

## Świadomie POC-owe (TODO na MVP)

Te same kompromisy co przy koszu w Slice 1 — egzekwujemy regułę w event-time, wizualny
disabled odkładamy:

- **Wyszarzenie ▲ na górze bloku / ▼ na dole** — na razie **no-op** zamiast `disabled`
  (ten sam problem: dsg zamraża `columns` na montażu, a flagi „pierwsza/ostatnia w sekcji"
  są zależne od kolejności i render-time). MVP: nieść flagi na **wartości grida** (reaktywnej),
  jak w TODO kosza ze Slice 1.
- **Wskaźnik „aktywny sort kolumnowy"** — na razie wystarcza, że ▲▼ są szare przy sorcie.
- **UX strzałek do przeprojektowania (2026-06-20, po weryfikacji).** Działa, ale wygląda/klika
  się słabo: dwie małe ikonki ▲▼ ciasno spiętrzone w 64px kolumnie. Kandydaci na MVP: większy
  cel kliknięcia, drag-handle zamiast strzałek (spójne z docelowym drag-drop), albo ▲▼ tylko
  na hover wiersza. Wiązać z pozycją „drag-drop" z „Poza zakresem".

## Poza zakresem (kolejne slice'y) — kierunek docelowy

- **Przenoszenie pozycji między sekcjami (docelowo wymagane).** Pozycja przekracza granicę
  sekcji: zmienia `sectionId` **oraz** zdenormalizowane pola wiersza (`sectionName`,
  `sectionVatRate`, `sectionDefaultCostVariant`, współczynniki) i wymaga renumeracji
  `display_order` w **dwóch** sekcjach (źródłowej i docelowej). Model `display_order` z tego
  slice'a (per-sekcja, renumeracja pełną listą) **celowo tego nie blokuje** — cross-section
  move to dwa wywołania renumeracji + patch pól sekcji wiersza. Osobny brainstorm (UX: drag
  przez granicę vs „przenieś do sekcji…", przeliczenie cen po zmianie VAT/coeff sekcji).
- **Reorder sekcji** — ▲▼ na sekcji w panelu „Sekcje"; renumeruje `kosztorys-sections.displayOrder`
  (analogiczna akcja `reorderSectionsAction`). Przestawia całe bloki.
- **Drag-drop** — zamiast strzałek, gdy reorder się ustabilizuje.
  - **GOTCHA — DnD wymusza migrację `display_order` na klucze rzadkie.** ▲▼ to swap sąsiadów,
    więc tani `swapItemOrderAction` (2 update'y) wystarcza. DnD ma semantykę _move/insert_:
    przeciągnięcie pozycji przez pół sekcji przesuwa **cały zakres** między źródłem a celem →
    renumeracja N wierszy na drop = ten sam dławik, który zdjęliśmy ze strzałek (patrz lekcja
    „Liczba zapisów ma odpowiadać realnej zmianie" w `context/foundation/lessons.md`). Moment
    wejścia DnD = moment migracji `display_order` na **rzadkie/ułamkowe** wartości (LexoRank /
    midpoint między sąsiadami → 1 zapis na drop + okazjonalny rebalans). Wtedy
    `swapItemOrderAction`/`reorderItemsAction` stają się zbędne. Nie robić tego na zapas (YAGNI),
    ale i nie wpuszczać DnD na ciągłych intach — wejdzie z wbudowanym dławikiem.

## Testy

Odłożone na życzenie właściciela (faza POC). Gdy wrócą: ryzyko siedzi w helperze, więc
jednostkowo czysty `swapItemInSection` (swap w środku sekcji, no-op na brzegu bloku,
tolerancja na pozycję dodaną na koniec `rows`) — nie cienka akcja serwerowa.
