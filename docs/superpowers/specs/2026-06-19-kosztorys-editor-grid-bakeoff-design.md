# Kosztorys — edytor siatki: bake-off TanStack vs react-datasheet-grid

**Data:** 2026-06-19
**Status:** zaakceptowany (design)
**Kontekst:** POC `kosztorys-poc-in-app`, Faza 3 (edytowalna siatka) — rdzeń POC.
**Powiązane:** `2026-06-19-kosztorys-poc-in-app-design.md`,
`context/changes/kosztorys-poc-in-app/plan.md` (Phase 3).

## Wymaganie podstawowe (raison d'être POC)

**Największy ból właściciela:** dziś utrzymuje **trzy zduplikowane kosztorysy**
nad tymi samymi pozycjami, różniące się **tylko ceną**: (1) kosztorys robocizny
(cena klienta), (2) zakres prac _z narzędziami_ (cena podwykonawcy z narzędziami),
(3) zakres prac _bez narzędzi_ (cena podwykonawcy bez narzędzi). Te same wiersze,
ilości, etapy — trzy ręcznie synchronizowane kopie. Stąd dryf i „rozwalające się
formuły".

**Warunek konieczny POC:** te trzy kosztorysy stają się **trzema widokami nad
jednym zbiorem danych**, idealnie zsynchronizowanymi. Wpisanie dowolnej komórki,
dodanie rzędu, dodanie etapu (kolumny) dzieje się **w jednym miejscu** i propaguje
do wszystkich trzech widoków automatycznie. Zero osobnego dodawania do trzech
zakładek, zero dryfu, zero ręcznej synchronizacji.

**Gwarancja strukturalna (nie „dopilnowanie"):** schemat (wariant A) trzyma
wszystkie trzy ceny w **jednym wierszu** `kosztorys_items`
(`clientPrice`, `subcontractorWToolsPrice`, `subcontractorOwnToolsPrice`), a etapy
w jednej tabeli `kosztorys_stages` na inwestycję. Dlatego:

- dodanie pozycji = jeden `INSERT` do `kosztorys_items` → we wszystkich widokach,
- dodanie etapu = jeden `INSERT` do `kosztorys_stages` → dla wszystkich pozycji
  i widoków,
- formuły się nie rozwalają, bo **nie ma formuł w komórkach** — netto/brutto/
  wartość etapu liczy `calc.ts` (czyste funkcje sparametryzowane ceną widoku).

**Prezentacja = przełącznik widoku** (segmented control: Robocizna / Z narzędziami /
Bez narzędzi). Naraz jedna kolumna ceny + jej wartości liczone; ten sam zbiór pod
spodem. To wymaganie stoi pod obiema wersjami siatki — wybór biblioteki go nie
zmienia, ale **obie wersje muszą wystawić przełącznik widoku i aktywną cenę**
(dzisiejsza v1 pokazuje tylko `clientPrice` — to luka do uzupełnienia w obu).

## Problem

Faza 3 (edytowalna rozpiska) to rdzeń POC i **nie idziemy dalej, dopóki nie
zdecydujemy, że siatka jest wystarczająco szybka, niezawodna i „sheet-like"**.
Pojawiły się nowe wymagania, których obecna implementacja nie spełnia:

- nawigacja klawiaturą między kolumnami i wierszami (strzałki / Tab / Enter /
  pisanie wchodzi w edycję),
- dynamiczna szerokość kolumn (resize) i dynamiczna wysokość wierszy,
- ukrywanie/pokazywanie kolumn (**już jest** — `ColumnToggle`),
- ogólny „sheet-feel".

### Dlaczego obecny model jest architektonicznie sprzeczny z tymi celami

Dzisiejszy edytor (`src/components/kosztorys/editable-cell.tsx`) renderuje **każdą
komórkę jako zawsze-zamontowany `<input>`/`<select>`**. Arkusz ma natomiast model
**dwutrybowy**: komórka jest albo _zaznaczona_ (nawigacja, zwykły tekst, jeden
globalny kursor `{row,col}`), albo _w edycji_ (dopiero wtedy input). Brak tego
rozdzielenia łamie trzy cele naraz:

- **Keyboard-nav** wymaga jednego źródła prawdy „która komórka aktywna" i komórek,
  które oddają focus. Przy inpucie w każdej komórce strzałka przesuwa kursor
  tekstu, nie zaznaczenie; Tab gubi się na wirtualizowanych wierszach.
- **Wydajność** przy ~1000 wierszy: ~15 kolumn × widoczne wiersze = setki
  kontrolowanych inputów zamiast tekstu + jednego inputa w aktywnej komórce.
- **Zmienna wysokość wiersza** kłóci się ze sztywnym `virtualRowHeight={40}` i
  jednoliniowym `<input>`.

Te trzy wymagania zbiegają się w jednej zmianie: przejść z „każda komórka =
input" na „komórki = tekst + globalny model zaznaczenia + jeden input w aktywnej
komórce". Dedykowane gridy mają ten model wbudowany; na TanStack trzeba go napisać
ręcznie. To jest realny fork — stąd bake-off.

## Decyzja

Budujemy **dwie wersje edytora i porównujemy je** na żywej bazie `wykonczymy-poc`:

- **v1 — TanStack Table** (obecna, headless + shadcn `DataTable`). Dwutrybowość
  i keyboard-nav trzeba **dobudować ręcznie**.
- **v2 — react-datasheet-grid** (`nick-keller`, DOM). Biblioteka zaprojektowana
  _jako arkusz_: dwutrybowość, keyboard-nav, resize, **copy/paste z/do Excela**,
  wirtualizacja — **z pudełka**.

### Świadomie odrzucone

- **react-data-grid** (adazzle/comcast) — rozważona jako pierwszy kandydat na v2,
  ale to _uniwersalny_ grid, który _umie_ edycję. react-datasheet-grid celuje
  wprost w „sheet-feel" (copy/paste z Excela, nawigacja arkuszowa), wyżej w
  benchmarku Context7 (93.5 vs 81.75), też DOM-owy. Skoro całe kryterium to
  „czuje się jak arkusz", datasheet-grid jest bliższym dopasowaniem.
- **Glide Data Grid / cokolwiek na `<canvas>`** — odrzucone. Powód: chcemy to
  **testować** (Playwright/RTL nie widzą komórek na canvasie — to jeden bitmap),
  a przy **tysiącach** wierszy (nie dziesiątkach tysięcy) przewaga perf canvasu
  jest w praktyce niewidoczna. Koszt (własne malowanie zamiast shadcn/Tailwind,
  brak testowalności DOM) nie zwraca się przy tej skali.
- **AG Grid** — kluczowa edycja/zakresy w płatnym Enterprise, ciężki bundle,
  obcy look. Przerost dla POC.

## Architektura — uczciwy bake-off

Porównanie ma sens tylko, jeśli wersje różnią się **wyłącznie warstwą siatki**.

### Wspólny rdzeń (nie duplikowany)

Obie wersje czytają to samo:

- query drzewa: `src/lib/queries/kosztorys.ts` (`getKosztorysTree`),
- akcje mutujące: `src/lib/actions/kosztorys.ts`,
- czyste formuły: `src/lib/kosztorys/calc.ts`,
- typy: `src/types/kosztorys.ts`.

Różnica = tylko komponent siatki + toolbar + renderowanie/edycja komórki.
Gdy v2 wypadnie lepiej, wiadomo, że to zasługa grida, nie innego query.

### Współistnienie = osobna trasa-rodzeństwo

- v1 zostaje na `/inwestycje/[id]/kosztorys-edytor`.
- v2 ląduje na `/inwestycje/[id]/kosztorys-edytor-v2`.

Zero ryzyka dla działającej v1; A/B przez dwie karty. Toggle `?grid=rdg` na jednej
trasie odrzucony (miesza dwa drzewa komponentów w jednym pliku).

### Zakres v2 (react-datasheet-grid) — tyle, ile potrzeba na uczciwą ocenę

Nie pełna parność z v1 — tyle, by ocenić „sheet-feel":

- **przełącznik widoku** (Robocizna / Z narzędziami / Bez narzędzi) zmieniający
  aktywną kolumnę ceny i jej wartości liczone — warunek podstawowy POC,
- edytowalne komórki z **dwutrybowością** (zaznaczenie ≠ edycja) — natywne,
- keyboard-nav: strzałki, Tab, Enter, pisanie-wchodzi-w-edycję, copy/paste,
- resize kolumn, dynamiczne kolumny etapów (`DynamicDataSheetGrid`), kolumny
  liczone read-only (netto/brutto/pozostało) jako custom `component`,
- autosave optymistyczny podpięty pod `onChange(value, operations)` — operacja
  `UPDATE` niesie indeksy zmienionych wierszy; diffujemy do zmienionych pól i
  strzelamy istniejącymi akcjami (`updateItemFieldAction`/`setStageProgressAction`)
  z debounce; `router.refresh()` po sukcesie — lekcja fire-and-forget.

Model wiersza v2 = **płaski** (jak v1 `KosztorysEditorRowT`): pozycja +
zdenormalizowana nazwa sekcji + ilości etapów spłaszczone do `stage_<stageId>`,
żeby `keyColumn` mapował 1:1. Grupowanie sekcji (collapsible GROUP/CHILD,
wspierane natywnie) = opcjonalny follow-on, nie warunek oceny. Dodawanie/usuwanie
sekcji/etapów może być lżejsze — nie decyduje o sheet-feel.

## Kryteria oceny (bramka „idziemy dalej")

Decyzja v1 vs v2 zapada po zmierzeniu poniższego; wynik + uzasadnienie dopisujemy
do `change.md` i `plan.md`.

**Oś rozstrzygająca = sheet-feel, nie surowa wydajność.** v1 (TanStack) jest już
_dosyć szybka_ na realnych danych — perf nie jest tu bólem. Dlatego o wyborze
decydują keyboard-nav, resize i dwutrybowość komórki, a **wydajność v2 traktujemy
jako bramkę „nie pogorszyć poniżej v1"**, nie jako główny argument. Plan nie ma
celować w optymalizację, która niczego nie rozstrzyga.

Wymierne:

- **jeden zbiór, trzy widoki (warunek podstawowy):** przełącznik Robocizna /
  Z narzędziami / Bez narzędzi zmienia aktywną cenę i jej wartości liczone;
  dodanie pozycji/etapu w jednym widoku jest natychmiast w pozostałych dwóch
  (bo to ten sam rekord) — sprawdzić, że nic nie wymaga osobnego dodania,
- keyboard-nav działa po całej siatce, łącznie z zawijaniem wierszy i wierszami
  wirtualizowanymi (jeszcze nie w DOM),
- edycja jednego pola przy ~1000 wierszy bez janku; log `[PERF]` potwierdza zapis
  **jednego** rekordu, nie całego arkusza,
- resize kolumn + zmienna wysokość wiersza działają,
- autosave niezawodny: revert + toast na błąd, brak utraty wpisów,

Subiektywne:

- „czy to _czuje się_ jak arkusz" (ocena właściciela na realnych danych
  inwestycji 6).

## Ryzyka

- **Zgodność react-datasheet-grid z React 19 / Next 16 / React Compiler i SSR** —
  stack jest bleeding-edge (Next 16.1, React 19.2), a datasheet-grid jest mniej
  aktywnie utrzymywany niż react-data-grid. **Pierwsze zadanie planu to bramka
  zgodności**: instalacja + smoke-render w `'use client'` w Next 16 (montuje się,
  edytuje, keyboard-nav działa). Jeśli pęknie na React 19 — fallback na
  react-data-grid (API blisko: kolumny + `onRowsChange`), bez zmiany reszty planu.
- **Instalacja na arm64 macu** — `pnpm install`/`remove` potrafi podmienić
  lightningcss na x64 i zepsuć build CSS. Dodać zależność ręcznie do
  `package.json`, potem `pnpm install`; przy pęknięciu CSS: `pnpm install --force`
  - `rm -rf .next` (lekcja w `context/foundation/lessons.md`).
- Re-implementacja toolbara/szukajki/ukrywania kolumn przeciw API datasheet-grid
  (świadomie zaakceptowane jako mus dla szybkiej edycji/nawigacji).
- Styling datasheet-grid blisko, ale nie 1:1 z shadcn (zaakceptowane).

## Po bake-offie — v2 jako fundament

Zakładamy (przy zdanej bramce zgodności i kryteriach), że **v2 (datasheet) staje
się docelową bazą edytora**. Pozostałe funkcjonalności z planu POC — subtotale per
sekcja, panel plan-vs-actual (Faza 4), kalkulator pokoi (Faza 5), eksport PDF
(Faza 6), dodawanie/usuwanie sekcji i etapów — **dokładamy na v2**, równolegle, po
zbudowaniu rdzenia siatki. v1 zostaje jako punkt odniesienia do czasu werdyktu.
Bake-off nie jest więc „zbuduj i wyrzuć przegraną", lecz wyborem fundamentu, na
którym jedzie dalej cały POC.

## Czego NIE robimy

- Nie ruszamy v1 — zostaje nietknięta jako punkt odniesienia do werdyktu.
- Nie dążymy do pełnej parności funkcji w v2 na etapie bake-offu (rdzeń + warunek
  podstawowy „trzy widoki" wystarczą do decyzji; reszta planu POC dochodzi po niej).
- Nie wybieramy zwycięzcy arbitralnie — decyduje pomiar wg kryteriów powyżej.
