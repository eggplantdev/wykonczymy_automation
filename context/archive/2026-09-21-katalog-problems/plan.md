# Rozjazdy z katalogiem prac jako problemy w edytorze — plan wdrożenia

## Overview

Dwie kategorie z okna „Porównaj z katalogiem prac" — „Inne liczby niż w katalogu" i „Brak
w katalogu" — stają się wpisami w liście „Problemy" edytora kosztorysu, z licznikiem prawdziwym przy
wejściu na stronę i topniejącym w miarę poprawiania cen. Z okna da się jednym kliknięciem zawęzić
rozpiskę do każdej z nich. Porównanie przenosi się z akcji serwerowej do przeglądarki i staje się
jedynym źródłem dla obu powierzchni.

## Current State Analysis

- `buildCatalogueComparison` (`src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:68-126`)
  jest czystą funkcją bez zależności serwerowych, wołaną dziś wyłącznie z akcji
  `src/lib/actions/work-catalogue.ts:315`.
- Okno (`catalogue-compare-dialog.tsx`) dostaje wynik przez `useKosztorysActions().catalogueCompare`
  — fetch-on-click, bo Radix nie wystrzeli `onOpenChange` przy programowym otwarciu
  (`actions/catalogue-compare-action.tsx`).
- Lista „Problemy" wyprowadza się automatycznie z wpisów `kind: 'diagnostic'` w `ROW_CONDITIONS`
  (`src/lib/kosztorys/problem-conditions.ts`); menu i pasek aktywnych filtrów podłapią nowy wpis bez
  zmian. Wyboru dokonuje `toggleConditionExclusive(id, PROBLEM_IDS)`, dostępne w kontekście edytora.
- Fakty grupowe wstrzykuje się przez `RowConditionCtxT` (`row-conditions/types.ts`) — wzorzec
  `divergentPriceRowIds`, budowany w czterech miejscach w `use-kosztorys-editor.ts`
  (`:375-380`, `:478-483`, `:508-513`, `:542-545`).
- `getWorkCatalogue()` (`src/lib/queries/work-catalogue.ts:12-18`) to gotowe, otagowane zapytanie
  o cały cennik; akcje zapisu do cennika już unieważniają ten tag
  (`src/lib/actions/work-catalogue.ts:74,102,133,146`).

## Desired End State

Po wejściu na kosztorys (bez otwierania czegokolwiek) menu „Problemy" pokazuje dwa nowe wiersze
z prawdziwymi liczbami prac. Wybór wiersza zawęża rozpiskę; przy „innych liczbach" odsłaniane są
kolumny cenowe. Poprawienie ceny zmniejsza licznik natychmiast, bez zapisu i bez przeładowania.
Okno porównania pokazuje dokładnie te same liczby, bo czyta to samo porównanie, i ma przy obu blokach
przycisk zawężający rozpiskę. Serwerowa akcja porównania i `refreshComparison` już nie istnieją.

### Key Discoveries

- `KosztorysV2RowT` jest strukturalnym nadzbiorem `CatalogueComparisonItemT` — konwersja jest
  tożsamością, nie mapowaniem.
- Podpowiedź „może chodzi o…" kosztuje **401 ms przy 42 sondach i 10.7 s przy 400** (843 wpisy
  katalogu, dice po bigramach). Klasyfikacja bez niej: ~10.8 ms na 1000 składań nazwy, a największy
  realny kosztorys ma 379 pozycji / 198 różnych par (nazwa, j.m.).
- Katalog na drucie: 843 wiersze = 123 kB jako minimalne obiekty. Wystarczy.
- `router.refresh()` **nie** przesiewa `rows` — to `useState`-owe ziarno zamrożone przy montowaniu
  (EX-441, `use-kosztorys-editor.ts:903,1026`), więc świeży prop katalogu wjedzie bez ruszania
  niezapisanych wierszy.
- `sectionLabel: null` przy diagnostyce jest wymuszone testem (`registry.test.ts:176-181`).
- React Compiler cicho odpuszcza w `use-kosztorys-editor.ts` (historia EX-496) — memo pisane ręcznie.

## What We're NOT Doing

- Nie dotykamy podglądów (`(share)/k/[token]`, `(share)/podglad-inwestora/[id]`) — `preview` i tak
  zeruje każdy licznik, więc katalog tam nie jedzie.
- Nie zmieniamy `counted-nouns.ts` ani rzeczownika w pozostałych wierszach „Problemów".
- Nie dodajemy trzeciego, zbiorczego problemu „wszystko z katalogu".
- Nie zmieniamy tego, co okno **zapisuje** — „Dodaj do katalogu" i „Edytuj w katalogu" działają jak
  dziś, dalej piszą wyłącznie do cennika.
- Nie piszemy E2E w tej zmianie (patrz Testing Strategy — należność zapisana w backlogu E2E).

## Implementation Approach

Sprowadzić porównanie z katalogiem do tego samego kształtu, co reszta problemów: synchronicznego
predykatu na wierszu, karmionego faktem grupowym z `RowConditionCtxT`. Koszt rozdziela się wzdłuż
jednej linii — klasyfikacja jest O(pozycje) i należy do memo, podpowiedź jest O(pozycje × katalog)
i należy do okna. Najpierw czysty silnik (testowalny bez renderu), potem dane, potem problemy,
na końcu okno.

## Critical Implementation Details

**Wydajność.** Memo liczące oba zbiory id biegnie przy każdym zatwierdzonym klawiszu, obok memo, które
na 1000 pozycji zjadają razem ~5 ms. Klasyfikacja musi trzymać się w tym budżecie: klucz katalogu
liczony przez cache `Map<"opis|j.m." → klucz>` (198 różnych par na 379 pozycji w największym realnym
kosztorysie), a podpowiedź **nie może** się tu znaleźć w żadnej postaci — jej wywołanie na 400
pozycjach to 10.7 s zamrożonego edytora.

**Współczynniki.** `wToolsCoeff` / `ownToolsCoeff` biorą się z ustawień kosztorysu trzymanych
w pamięci, nie z serwerowego snapshotu — właściciel zmienia je w trakcie sesji i licznik ma to widzieć
natychmiast.

---

## Phase 1: Silnik — rozdzielić klasyfikację od podpowiedzi

### Overview

`buildCatalogueComparison` przestaje liczyć podpowiedzi i przestaje raportować jedną różnicę ceny jako
trzy. Podpowiedź wydziela się do osobnej funkcji, wołanej dopiero przy otwarciu okna.

### Changes Required

#### 1. Silnik porównania

**File**: `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts`

**Intent**: Zdjąć z gorącej ścieżki dwa koszty i jeden błąd. Podpowiedź („może chodzi o…") wypada
z `buildCatalogueComparison` — jej miejsce jest tam, gdzie ktoś na nią patrzy. Składanie klucza
katalogu dostaje cache po parze (nazwa, j.m.), bo te same nazwy powtarzają się w rozpisce dwukrotnie.
I jedna różnica ceny j.m. przestaje być raportowana trzy razy.

**Contract**:

- `buildCatalogueComparison(items, catalogue, settings)` zwraca `CatalogueMissingT` z `hint: null`
  — pole zostaje w typie, wypełnia je dopiero warstwa wyżej.
- Nowy eksport `attachCatalogueHints(missing, catalogue): CatalogueMissingT[]` — bierze gotową listę
  „brak w katalogu" i dokłada `hint`. To jedyne miejsce, które woła `hintCandidates` /
  `compareDescriptions`.
- Wewnątrz: pamięć `Map<string, string>` na klucz katalogu, keyed po `` `${description}|${unit}` ``.
- Gdy stawka po obu stronach jest „auto" (pozycja bez nadpisania **i** wpis cennika bez własnej
  stawki), obie są wyprowadzane jako `cena × współczynnik`, więc ich różnica jest tą samą różnicą co
  „Cena j.m." — w takim przypadku raportujemy wyłącznie „Cena j.m.".

#### 2. Wołający akcji

**File**: `src/lib/actions/work-catalogue.ts`

**Intent**: Utrzymać okno przy życiu do fazy 4 — akcja dokłada podpowiedzi sama.

**Contract**: po `buildCatalogueComparison` przepuszcza `missing` przez `attachCatalogueHints`.
Kształt zwracany z akcji bez zmian.

#### 3. Ryzyko w planie testów

**File**: `context/foundation/test-plan.md`

**Intent**: Plan testów nie nazywa dziś ryzyka pokrywającego tę zmianę. Dopisać je, żeby testy niżej
zaczepiały się o ryzyko, a nie o plik.

**Contract**: jedno ryzyko — „licznik rozjazdu z katalogiem kłamie albo zamraża edytor" — z warstwą
node (silnik) i dom (memo pod remountem).

### Success Criteria

#### Automated Verification

- Nowy spec silnika przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`
- Istniejące specy katalogu przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue`

#### Manual Verification

- Okno „Porównaj z katalogiem prac" pokazuje te same prace co przed zmianą, ale mniejszą liczbę
  różnic tam, gdzie obie stawki są „auto".
- Podpowiedzi „może chodzi o…" nadal się pojawiają przy „brak w katalogu".

---

## Phase 2: Katalog na drucie

### Overview

Cennik dojeżdża do edytora razem z rozpiską, na dwóch edytowalnych powierzchniach.

### Changes Required

#### 1. Typ danych edytora

**File**: `src/lib/kosztorys/types.ts`

**Intent**: Dołożyć katalog do wejścia edytora jako pole opcjonalne — powierzchnie podglądowe go nie
wożą, a ich brak ma znaczyć „brak licznika", nie „pusty katalog".

**Contract**: `KosztorysEditorDataT.workCatalogue?: WorkCatalogueItemT[]`.

#### 2. Fan-out stron

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys_v2/page.tsx`,
`src/app/(frontend)/szablony/[id]/page.tsx`

**Intent**: Dorzucić `getWorkCatalogue()` do równoległego pobierania i przekazać dalej. Podgląd
klienta i podgląd inwestora zostają bez zmian.

**Contract**: szósty element w istniejącym `Promise.all`; prop `workCatalogue` na komponencie
edytora.

### Success Criteria

#### Automated Verification

- Typy się spinają po dołożeniu propa: `pnpm typecheck`

#### Manual Verification

- Kosztorys inwestycji i szablon otwierają się bez błędu; podgląd klienta i podgląd inwestora dalej
  działają.

---

## Phase 3: Porównanie w pamięci i dwa problemy

### Overview

Klasyfikacja biegnie w przeglądarce przy każdej zmianie, a jej wynik zasila dwa nowe wpisy w liście
„Problemy".

### Changes Required

#### 1. Kontekst warunków wiersza

**File**: `src/lib/kosztorys/row-conditions/types.ts`

**Intent**: Wstrzyknąć fakt grupowy „piętro wyżej", jak `divergentPriceRowIds`. Pole **opcjonalne**:
brak katalogu (podglądy, fikstury specowe) ma cicho wyłączyć te dwie diagnostyki, a nie wywrócić
sześciu literałów ctx w testach — w przeciwieństwie do gwarancji pieniężnej nic tu nie odpowiada
milcząco „nie" na pytanie o pieniądze.

**Contract**: `catalogueRowIds?: { divergent: ReadonlySet<number>; missing: ReadonlySet<number> }`.

#### 2. Wpisy w rejestrze

**File**: `src/lib/kosztorys/row-conditions/registry.ts`

**Intent**: Dwa wpisy `kind: 'diagnostic'`, `tone: 'worklist'` — to nie usterki, tylko robota do
zrobienia. Osobne, bo różnią się tym, co mają do pokazania: przy rozjeździe liczb pokazujemy kolumny
cenowe, przy braku w katalogu nie ma czego odsłaniać.

**Contract**:

- `catalogue-price-divergence` — `problemLabel: (count) => …` zdanie mówiące o **pracach**,
  `revealsColumns: ALL_PRICE_COLUMNS`, `sectionLabel: null`,
  `matches: (row, ctx) => ctx.catalogueRowIds?.divergent.has(row.id) ?? false`.
- `catalogue-missing` — to samo bez `revealsColumns`.

#### 3. Memo w kompozycji edytora

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Policzyć oba zbiory id raz na zmianę i wstrzyknąć w cztery miejsca budowy ctx — tam, gdzie
już wstrzykiwany jest `divergentPriceRowIds`.

**Contract**: memo pisane ręcznie (kompilator tu odpuszcza), bramkowane przez `preview` jak
`divergentPriceIds`, zależne od wierszy, katalogu i współczynników z ustawień w pamięci. Woła
`buildCatalogueComparison` i bierze z wyniku same id — podpowiedzi nie dotyka.

### Success Criteria

#### Automated Verification

- Spec rejestru przechodzi z dwoma nowymi wpisami: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/registry.test.ts`
- Nowy spec dom sprawdzający, że licznik topnieje po zmianie ceny i przeżywa remount:
  `pnpm exec vitest run --project dom src/__tests__/components/kosztorys/editor/use-kosztorys-catalogue-problems.test.tsx`

#### Manual Verification

- Menu „Problemy" pokazuje oba wiersze z liczbami zgodnymi z oknem, bez otwierania okna.
- Wybór „inne liczby" zawęża rozpiskę i odsłania kolumny cenowe nawet przy odhaczonych w pickerze.
- Poprawienie ceny j.m. na zgodną z katalogiem zmniejsza licznik od razu.
- Na szablonie licznik też działa; na podglądzie klienta i podglądzie inwestora oba wiersze nie
  istnieją.

---

## Phase 4: Okno na jednym źródle

### Overview

Okno przestaje pytać serwer — czyta to samo porównanie, co licznik, i pozwala zawęzić rozpiskę.

### Changes Required

#### 1. Porównanie w kontekście edytora

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Wystawić pełny wynik porównania (nie tylko zbiory id) na kontekst, żeby okno miało co
renderować.

**Contract**: wynik `buildCatalogueComparison` z fazy 3 wystawiony jako `catalogueComparison`; zbiory
id wyprowadzane z niego, nie liczone drugi raz.

#### 2. Okno

**File**: `src/components/kosztorys/editor/dialogs/catalogue-compare-dialog.tsx`

**Intent**: Czytać porównanie z kontekstu, dokładać podpowiedzi leniwie przy otwarciu i dać dwa
gesty zawężenia. Przycisk zamyka okno, bo rozpiska jest pod nim — gest bez widocznego skutku czyta
się jak zepsuty.

**Contract**:

- Zamiast `useKosztorysActions().catalogueCompare` — `catalogueComparison` z kontekstu edytora;
  stany `loaded` / `error` znikają razem z fetchem.
- `attachCatalogueHints` wołane w memo bramkowanym przez `open`.
- W obu blokach przycisk „Pokaż w rozpisce" wołający `toggleConditionExclusive(<id>, PROBLEM_IDS)`
  i zamykający okno. Niedostępny w trybie tylko-do-odczytu, tak jak pozostałe akcje okna.
- `onSaved` na `CatalogueItemFromKosztorysDialog` woła `router.refresh()` zamiast
  `refreshComparison` — akcja zapisu unieważnia już tag cennika, a `rows` to ziarno zamrożone przy
  montowaniu, więc niezapisane wiersze przeżyją.

#### 3. Kasacja serwerowej ścieżki

**File**: `src/components/kosztorys/editor/actions/catalogue-compare-action.tsx`,
`src/lib/actions/work-catalogue.ts`

**Intent**: Usunąć drugi silnik. Po fazie 4 nie ma już wołającego akcji porównania.

**Contract**: znika hook `useCatalogueCompareAction` i eksport akcji porównania z `work-catalogue.ts`
(wraz z dokładaniem podpowiedzi z fazy 1, punkt 2); `catalogueCompare` znika z kształtu
`useKosztorysActions()`, zostaje samo sterowanie otwarciem okna.

### Success Criteria

#### Automated Verification

- Specy okna i akcji katalogu przechodzą: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/dialogs`
- Po kasacji nie ma martwych importów: `pnpm typecheck`

#### Manual Verification

- Okno otwiera się natychmiast, bez „Porównuję z katalogiem…" — liczby są już policzone.
- Liczby w oknie i w menu „Problemy" są identyczne, także po niezapisanych zmianach w rozpisce.
- „Pokaż w rozpisce" w obu blokach zamyka okno i zawęża rozpiskę do właściwego zbioru.
- „Dodaj do katalogu" na pracy spoza cennika zmniejsza licznik „brak w katalogu" bez przeładowania
  strony i bez utraty niezapisanych wierszy.
- Tryb tylko-do-odczytu: raport widoczny, obu przycisków zapisu brak, „Pokaż w rozpisce" też nie ma.

---

## Testing Strategy

### Unit (node)

- Silnik: praca zgodna, praca z rozjazdem na trzech liczbach, praca spoza katalogu, pusta nazwa.
- Obie stawki „auto" przy różnej cenie j.m. → dokładnie **jedna** różnica (regresja na błąd 3×).
- `attachCatalogueHints` dokłada podpowiedź i nie zmienia przynależności do kubełków.
- Rejestr: oba nowe wpisy mają `sectionLabel: null`, `problemLabel` i poprawne `revealsColumns`.

### Component (dom)

- Licznik topnieje po zmianie ceny na zgodną z katalogiem, bez zapisu.
- Brak katalogu (podgląd) → oba wiersze nie renderują się w menu.
- Zaangażowany problem przeżywa remount (`use-restore-remount` / latch wiersza).

### E2E

Nie w tej zmianie. Ryzyko jest w pełni obsłużone warstwą dom (menu, licznik, zawężenie) — nic tu nie
przecina granicy klient → akcja → baza → unieważnienie cache. Należność zapisujemy jako issue
z etykietą `e2e-backlog` na bramce przeglądu.

### Manual

Zebrane raz, na końcu, do rejestru `context/foundation/manual-checks.md`.

## Performance Considerations

Budżet: memo klasyfikacji ma się zmieścić w ~2 ms na 1000 pozycji, obok istniejących ~5 ms. Cache
klucza po parze (nazwa, j.m.) jest tym, co go domyka. Podpowiedź nie wchodzi do memo pod żadnym
pozorem — na 400 pozycjach to 10.7 s. Katalog na drucie: ~123 kB na dwóch edytowalnych
powierzchniach, zero na podglądach.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Research: `context/archive/2026-09-21-katalog-problems/research.md`
- Wzorzec wpisu diagnostycznego: `src/lib/kosztorys/row-conditions/registry.ts:250-264`
- Wzorzec faktu grupowego w ctx: `src/lib/kosztorys/row-conditions/types.ts`
- Zamrożone ziarno `rows` i `router.refresh()`: `src/components/kosztorys/editor/use-kosztorys-editor.ts:903,1026`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Silnik — rozdzielić klasyfikację od podpowiedzi

#### Automated

- [x] 1.1 Nowy spec silnika przechodzi — 4188ce17
- [x] 1.2 Istniejące specy katalogu przechodzą — 4188ce17

### Phase 2: Katalog na drucie

#### Automated

- [x] 2.1 Typy się spinają po dołożeniu propa — d79cc37f

### Phase 3: Porównanie w pamięci i dwa problemy

#### Automated

- [x] 3.1 Spec rejestru przechodzi z dwoma nowymi wpisami — a68ec2e1
- [x] 3.2 Nowy spec dom: licznik topnieje i przeżywa remount — a68ec2e1

### Phase 4: Okno na jednym źródle

#### Automated

- [x] 4.1 Specy okna i akcji katalogu przechodzą — 95d5470e
- [x] 4.2 Brak martwych importów po kasacji serwerowej ścieżki — 95d5470e
