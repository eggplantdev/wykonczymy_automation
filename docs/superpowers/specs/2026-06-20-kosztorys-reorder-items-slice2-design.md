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
- **Brak akcji reorderu** — to jedyny brakujący backend tego slice'a (dodajemy
  `swapItemOrderAction`; patrz §Akcja).

## Zakres (Slice 2)

Ręczne przestawianie **pozycji w obrębie ich sekcji**. Pozycja **nie zmienia sekcji**.
Sekcje się nie przestawiają. „Przywrócić nieposortowane" = **zdjąć sort kolumnowy** (trzeci
klik w nagłówek) — `display_order` cały czas leży nietknięty pod spodem, więc nie trzeba
trzymać żadnego osobnego stanu/snapshotu/historii.

## Schemat

**Bez zmian.** `kosztorys-items.displayOrder` istnieje. Reorder = przepisanie wartości tego
pola pozycjom w sekcji.

## Akcja — `swapItemOrderAction`

`swapItemOrderAction(first, second)` w `src/lib/actions/kosztorys.ts`, gdzie każdy argument
to `{ id: number; displayOrder: number }` z **nowym** `display_order`, jaki pozycja ma przyjąć:

- ▲▼ to **zawsze swap dwóch sąsiadów**, więc realnie zmieniają się tylko **dwa** wiersze →
  **2 update'y, niezależnie od rozmiaru sekcji**. Sortowanie zapytania po `display_order`
  (`src/lib/queries/kosztorys.ts`) gwarantuje, że wymiana ich wartości wystarcza.
- Wzorzec `protectedAction`, tag `['kosztorysItems']`.

> **Dlaczego nie renumeracja całej sekcji.** Pierwotny szkic używał
> `reorderItemsAction(sectionId, orderedItemIds[])` — renumeracja całej listy od zera. Przy
> 1000+ wierszach jeden klik ▲▼ = N×`payload.update` = dławik (lekcja „Liczba zapisów ma
> odpowiadać realnej zmianie" w `context/foundation/lessons.md`). `reorderItemsAction`
> **zostaje** w kodzie, ale jest zarezerwowana na **cross-section move** (patrz „Poza
> zakresem"), gdzie zmienia się więcej niż dwa wiersze — nie używa jej ten slice.

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

1. **Lokalnie:** swap dwóch wierszy w master `rows` (`swapItemInSection`) → siatka od razu
   pokazuje nowy układ (przy `sort === null` `viewRows` zachowuje kolejność `rows`, bo
   `filterRows` nie sortuje).
2. **W tle:** `swapItemOrderAction({ id: row.id, displayOrder: neighbor.displayOrder },
{ id: neighbor.id, displayOrder: row.displayOrder })` — wymiana `display_order` przeciąganej
   pozycji i jej sąsiada. **Odpalane z event-handlera, NIE z updatera `setRows`** — w updaterze
   akcja wykonałaby się w trakcie renderu, a jej rewalidacja cache ruszyłaby Router → błąd React
   (lekcja „Nie odpalaj server actions w updaterze setState"). Świeży `rows` czytamy z
   „latest-value" refa, bo closure kolumny dsg jest zamrożona na montażu.
3. **`prevById`** (mapa po `id` pozycji) — bez zmian; jest niezależna od kolejności, więc
   diff edycji pól zostaje spójny.
4. **`router.refresh()`** bezpieczny — serwer ma już zapisaną kolejność, reseed `treeToRows`
   odtworzy ten sam układ.

## Helpery

Oba w `src/lib/kosztorys/v2-rows.ts`, czyste i testowalne, operują na **sekwencji
wyświetlania pozycji tej samej sekcji** (nie na surowych indeksach / ciągłości bloku):

- `swapItemInSection(rows, itemId, dir)` — zwraca nową tablicę `rows` z przestawioną pozycją
  (optymistyka), albo **tę samą referencję** przy no-opie (brzeg bloku / nieznane id).
- `sectionNeighbor(rows, itemId, dir)` — zwraca sąsiada w sekcji w kierunku ▲/▼ (albo
  `undefined` na brzegu). Edytor bierze z niego `displayOrder` obu wierszy do `swapItemOrderAction`.

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
  `sectionDefaultCostVariant`, współczynniki — `vatRate` jest na inwestycji, więc się nie
  zmienia) i wymaga renumeracji `display_order` w **dwóch** sekcjach (źródłowej i docelowej).
  Model `display_order` z tego slice'a (per-sekcja, renumeracja pełną listą) **celowo tego
  nie blokuje** — cross-section move to dwa wywołania renumeracji + patch pól sekcji wiersza.
  Osobny brainstorm (UX: drag przez granicę vs „przenieś do sekcji…", przeliczenie cen po
  zmianie coeff sekcji).
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

Odłożone na życzenie właściciela (faza POC). Gdy wrócą: ryzyko siedzi w helperach, więc
jednostkowo czyste `swapItemInSection` i `sectionNeighbor` (swap w środku sekcji, no-op /
`undefined` na brzegu bloku, tolerancja na pozycję dodaną na koniec `rows`) — nie cienka
akcja serwerowa.
