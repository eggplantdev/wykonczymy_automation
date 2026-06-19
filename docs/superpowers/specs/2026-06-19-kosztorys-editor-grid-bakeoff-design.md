# Kosztorys — edytor siatki: bake-off TanStack vs react-data-grid

**Data:** 2026-06-19
**Status:** zaakceptowany (design)
**Kontekst:** POC `kosztorys-poc-in-app`, Faza 3 (edytowalna siatka) — rdzeń POC.
**Powiązane:** `2026-06-19-kosztorys-poc-in-app-design.md`,
`context/changes/kosztorys-poc-in-app/plan.md` (Phase 3).

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
- **v2 — react-data-grid** (adazzle, DOM). Dwutrybowość, keyboard-nav, resize,
  selection — **z pudełka**.

### Świadomie odrzucone

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

### Zakres v2 (react-data-grid) — tyle, ile potrzeba na uczciwą ocenę

Nie pełna parność z v1 — tyle, by ocenić „sheet-feel":

- edytowalne komórki z **dwutrybowością** (zaznaczenie ≠ edycja),
- keyboard-nav: strzałki, Tab, Enter, pisanie-wchodzi-w-edycję,
- resize kolumn, dynamiczne kolumny etapów, kolumny liczone
  (netto/brutto/pozostało),
- autosave optymistyczny podpięty pod zdarzenia edycji RDG (reuse istniejących
  akcji + debounce; `router.refresh()` po sukcesie — lekcja fire-and-forget).

Dodawanie/usuwanie sekcji/etapów może być lżejsze — nie decyduje o sheet-feel.

## Kryteria oceny (bramka „idziemy dalej")

Decyzja v1 vs v2 zapada po zmierzeniu poniższego; wynik + uzasadnienie dopisujemy
do `change.md` i `plan.md`.

**Oś rozstrzygająca = sheet-feel, nie surowa wydajność.** v1 (TanStack) jest już
_dosyć szybka_ na realnych danych — perf nie jest tu bólem. Dlatego o wyborze
decydują keyboard-nav, resize i dwutrybowość komórki, a **wydajność v2 traktujemy
jako bramkę „nie pogorszyć poniżej v1"**, nie jako główny argument. Plan nie ma
celować w optymalizację, która niczego nie rozstrzyga.

Wymierne:

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

- **Zgodność react-data-grid 7.x z React 19 / Next 15 / React Compiler i SSR** —
  komponent będzie `'use client'`. Zweryfikować **na starcie planu**, zanim
  cokolwiek powstanie (Context7 / docs RDG). Jeśli niezgodne — wrócić do tej
  decyzji.
- Re-implementacja toolbara/szukajki/ColumnToggle przeciw API RDG (świadomie
  zaakceptowane jako mus dla szybkiej edycji/nawigacji).
- Styling RDG blisko, ale nie 1:1 z shadcn (zaakceptowane).

## Czego NIE robimy

- Nie ruszamy v1 — zostaje nietknięta jako punkt odniesienia.
- Nie dążymy do pełnej parności funkcji w v2 na etapie bake-offu.
- Nie wybieramy zwycięzcy z góry — decyduje pomiar wg kryteriów powyżej.
