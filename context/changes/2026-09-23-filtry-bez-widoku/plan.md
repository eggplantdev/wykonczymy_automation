# „Filtry" bez widoku, tylko niepuste, z nagłówkami — plan wdrożenia

## Overview

Menu „Filtry" przestaje pytać o widok cen (wszystkie 16 zawężeń zawsze na liście), listuje tylko
wiersze z licznikiem > 0 (zaangażowany zostaje), i grupuje je pod sześcioma nagłówkami osi. Warsztat
szablonu traci przełącznik „Widok cen" i dostaje bazową płaszczyznę przypiętą do „Inwestor".

## Current State Analysis

Stan i jego uzasadnienia są zbadane w `research.md` — tu tylko to, co plan zmienia:

- `offeredFilterConditions(engagedIds, view, perItemDiscountInert)`
  (`src/lib/kosztorys/row-conditions/queries.ts:199-211`) trzyma dwie bramki: płaszczyzny i rabatu.
  Bramka płaszczyzny dotyczy 8 z 16 filtrów i **jest tą, która wypada**. Bramka rabatu zostaje bez
  jednej zmiany. Zaangażowany warunek omija obie — ta furtka też zostaje.
- Jedyny konsument to `use-kosztorys-filter-menu.ts`, a wynik czyta jeden komponent
  (`kosztorys-filters-menu.tsx`), który buduje etykietę i licznik u siebie. Nie ma dziś warstwy
  modelu — inaczej niż „Problemy", które mają `problems-menu-model.ts`.
- Filtry **nie mają pola kategorii**. `problemGroup` jest w `types.ts:72-75` opisane jako „tylko
  diagnostyki".
- Kolejność 16 filtrów w rejestrze jest już **ciągła po osiach** (przedmiar, wykonana praca, rabat,
  źródło stawki, sufit stawki, komentarz) — grupowanie nie wymaga przestawiania.
- Bazowe etykiety obu połówek pary stawkowej są **identyczne dla obu płaszczyzn**
  (`'ze stawką wykonawcy z kwoty stałej' + planeViewSuffix(plane)`), więc ogon „… w widoku …"
  **musi zostać** — bez niego menu pokazałoby dwa bliźniacze wiersze pod jednym nagłówkiem.
- `FilterMultiSelect` renderuje `toggles` jako **płaską** tablicę w jednej `CommandGroup`
  (`src/components/filters/filter-multi-select.tsx:304-329`). Poza „Filtrami" z `toggles` korzysta
  tylko `src/components/transfers/transfer-filters.tsx`.
- `useKosztorysViewState` liczy widok jako `preview ? 'client' : (problemPlane ?? persistedView)`
  (`hooks/use-kosztorys-view-state.ts:49`), a `pickView` (`:73`) jest **jedynym** zapisującym klucz
  `kosztorys-view:<id>`. Flaga `isWorkshop` już dochodzi do `use-kosztorys-editor.ts:152`, ale **nie
  jest** przekazywana do tego hooka (`:192`).

## Desired End State

- Menu „Filtry" pokazuje w każdym widoku te same zawężenia — te, które mają co ukryć — pod sześcioma
  nagłówkami osi, w kolejności rejestru.
- Zawężenie, które nic nie dotyczy, nie zajmuje wiersza; zawężenie **włączone** zostaje na liście
  także przy zerze, bo to jedyny jego wyłącznik.
- „Zaznacz / odznacz wszystkie" zamiata dokładnie wylistowane wiersze.
- Warsztat szablonu nie ma przełącznika widoku, stoi na „Inwestor", a wybór usterki w „Problemach"
  nadal przenosi go ulotnie na płaszczyznę tej usterki.
- Sortowanie po „Cena j.m." w warsztacie sortuje tym, co pokazuje.

Weryfikacja: nowe specs (Faza 1–3) plus wykaz `#### Manual Verification` z każdej fazy.

### Key Discoveries:

- Bramka widoku nie kosztowała liczenia — `rowConditionCounts` (`use-kosztorys-editor.ts:416-435`)
  już dziś chodzi po wszystkich 30 warunkach, `view` celowo poza zależnościami memo. Zdjęcie bramki
  nie dodaje ani jednego przebiegu po wierszach.
- Bramka nigdy nie pilnowała spójności — `engagedConditionIds` w localStorage ją omija
  (`hooks/use-engaged-conditions.ts`), więc stan „filtr obcej płaszczyzny tnie siatkę" jest
  osiągalny dziś.
- `preview ? 'client'` w `:49` to **druga połowa zamka ujawnienia** (`:46-48`, pierwsza to allowlist
  w `grid/column-selection.ts:40`). Przypięcie warsztatu wchodzi **pod** ten warunek, nie obok niego.
- Precedens ukrycia kontrolki w warsztacie: `{!isWorkshop && <KosztorysViewMenu />}`
  (`toolbar/kosztorys-editor-toolbar.tsx:105`).

## What We're NOT Doing

- Nie ruszamy bramki rabatu ani `DISCOUNT_CONDITION_IDS`.
- Nie przepinamy „Filtrów" na `DropdownCheckGroups` — dwie technologie menu w pasku zostają długiem
  na osobną zmianę.
- Nie skracamy etykiet w rejestrze; ogon „… w widoku …" zostaje wszędzie, a reguła z `7af9945b`
  jest nietknięta.
- Nie ruszamy „Problemów", „Sekcji", panelu podsumowania ani liczników.
- Nie czyścimy zaangażowanych filtrów przy zmianie widoku (dzisiejsze zachowanie zostaje).
- Nie dotykamy `sort-value.ts` — usterka sortowania w warsztacie ginie przez przypięcie płaszczyzny,
  bez zmiany w kodzie sortowania. W kosztorysie (gdzie przełącznik zostaje) zachowanie sortowania
  jest bez zmian.
- Nie piszemy E2E — cała zmiana jest w zasięgu warstwy `dom` i node.

## Implementation Approach

Trzy fazy, w kolejności warstw: najpierw logika bez Reacta (oś kategorii + model menu + bramka),
potem ekran (nagłówki w komponencie menu i przepięcie „Filtrów"), na końcu warsztat (przypięcie
płaszczyzny i zdjęcie kontrolki). Każda faza domyka się własnymi testami i da się zacommitować
osobno.

Model menu powstaje jako **czysty moduł** wzorem `problems-menu-model.ts` — grupowanie, próg
licznika i wyjątek dla zaangażowanego to dokładnie to, co warto testować bez renderowania, a
markup wokół nie.

## Critical Implementation Details

**Kolejność w modelu.** Model układa wiersze przez `FILTER_GROUPS.flatMap`, nie przez samą kolejność
rejestru — choć dziś dają ten sam wynik. `active-filters-model.test.ts` asercjuje kolejność rejestru
jako „kolejność, której używa menu «Filtry»"; ta zgodność ma być **pinowana testem w modelu**, a nie
zakładana, bo inaczej pierwsze przestawienie rejestru rozjedzie chipy z menu w milczeniu.

**Przypięcie wchodzi pod zamek ujawnienia.** `preview` musi zostać pierwszym warunkiem w wyrażeniu
widoku. Przypięcie warsztatu dotyczy **bazowej** płaszczyzny (`persistedView`), więc nakładka z
„Problemów" (`problemPlane`) zostaje nad nim — inaczej wybór usterki stawkowej w warsztacie pokazałby
właściwe pozycje z ceną klienta w odsłoniętej kolumnie stawki.

## Phase 1: Oś kategorii i model menu

### Overview

Cała logika bez Reacta: sześć nazw grup, pole kategorii na filtrach, zdjęcie bramki płaszczyzny i
czysty model menu z progiem licznika.

### Changes Required:

#### 1. Nazwy grup

**File**: `src/lib/kosztorys/filter-groups.ts` (nowy)

**Intent**: Sześć nagłówków, pod którymi czyta się „Filtry" — po osi, nie po płaszczyźnie: jedna
para (albo czwórka) zawężeń na nagłówek. Uzasadnienie w komentarzu: podział po tym, o co wiersz
pyta, bo płaszczyzna jest już w ogonie etykiety i powtórzona w nagłówku niczego nie zawęża.

**Contract**: `FILTER_GROUPS` jako `as const`, w kolejności: `Przedmiar`, `Wykonana praca`, `Rabat`,
`Źródło stawki wykonawcy`, `Sufit stawki wykonawcy`, `Komentarz`; plus `FilterGroupIdT`. Ta sama
struktura `{ id, label }` co `problem-groups.ts`.

#### 2. Pole kategorii na warunku

**File**: `src/lib/kosztorys/row-conditions/types.ts`

**Intent**: Filtr nazywa swoją oś, tak jak diagnostyka nazywa swoją kategorię. Komentarz mówi to
samo, co przy `problemGroup`: filtr bez kategorii wypada z listy w całości, więc zapomniana
kategoria to brakujący wiersz, który łapie spec — nie cichy sierota w koszu „Inne".

**Contract**: `filterGroup?: FilterGroupIdT`. Opcjonalne w typie (`RowConditionT` jest jednym
płaskim typem, nie unią po `kind`), wymagane dla `kind === 'filter'` przez spec z punktu 6.

#### 3. Otagowanie rejestru

**File**: `src/lib/kosztorys/row-conditions/registry.ts`

**Intent**: Każdy z 16 filtrów dostaje `filterGroup` zgodnie z osią, na której już stoi w kolejności
pliku. Diagnostyki i `client` nietknięte.

**Contract**: `no-planned-qty`/`has-planned-qty` → przedmiar; `no-measured-qty`/`has-measured-qty` →
wykonana praca; `has-discount`/`no-discount` → rabat; `manual-rate-*`/`formula-rate-*` (4) → źródło
stawki; `fixed-rate-*-ceiling-*` (4) → sufit stawki; `has-note`/`no-note` → komentarz.

#### 4. Zdjęcie bramki płaszczyzny

**File**: `src/lib/kosztorys/row-conditions/queries.ts`

**Intent**: `offeredFilterConditions` przestaje pytać o widok. Parametr `view` wypada z sygnatury —
zostaje bramka rabatu i furtka dla zaangażowanego.

**Contract**: `offeredFilterConditions(engagedIds, perItemDiscountInert)`. Komentarz nad funkcją do
**przepisania, nie poprawienia**: punkt o płaszczyźnie („nieodpowiadalne z «Inwestor»") przestaje
być prawdą i musi zniknąć wraz z podpunktem o strandowaniu filtra stawkowego przy zmianie widoku;
zostaje bramka rabatu i furtka dla zaangażowanego, a nowe zdanie ma nazwać, gdzie teraz mieszka
skracanie listy — w progu licznika w modelu, nie tutaj. Właściciel (2026-09-23): „i tak mi się nie
podoba, nie ma sensu".

#### 5. Model menu

**File**: `src/components/kosztorys/editor/toolbar/menus/filters-menu-model.ts` (nowy)

**Intent**: Arytmetyka „Filtrów" poza komponentem, wzorem `problems-menu-model.ts`: co jest do
zaoferowania, pod jakim nagłówkiem, z jakim licznikiem i czy wiersz jest zaptaszkowany. Próg
licznika mieszka tutaj — wiersz na stałym zerze zakopuje ten jeden, który zerem nie jest; wiersz
**zaangażowany** zostaje przy zerze, bo to jedyny jego wyłącznik.

**Contract**: `filtersMenuModel({ engagedIds, counts, perItemDiscountInert })` → tablica
`{ id, label, groupLabel, active }`, ułożona przez `FILTER_GROUPS.flatMap`. `label` to
`Pozycje ${condition.label} (${count})` — przenosi się z komponentu bez zmiany treści, razem z
komentarzem o tym, że licznik liczy stan rozpiski, nie ocalałe wiersze. `active: !engagedIds.has(id)`
(odwrotnie niż w „Problemach": ptaszek znaczy „widoczne"). Filtr bez `filterGroup` wypada z wyniku.

#### 6. Testy

**File**: `src/__tests__/lib/kosztorys/row-conditions/queries.test.ts`,
`src/__tests__/lib/kosztorys/row-conditions/registry.test.ts`,
`src/__tests__/components/kosztorys/editor/toolbar/menus/filters-menu-model.test.ts` (nowy)

**Intent**: Zapiąć trzy niezmienniki, których dziś nikt nie pilnuje: bramki oferowania, kompletność
kategorii i próg licznika.

**Contract**: w `queries.test.ts` — filtr stawkowy jest oferowany niezależnie od płaszczyzny (dziś
nie istnieje ani jeden test tej funkcji), bramka rabatu dalej chowa parę rabatową przy rabacie
globalnym, zaangażowany omija bramkę rabatu. W `registry.test.ts` — każdy `kind === 'filter'` nazywa
`filterGroup`, a kolejność filtrów w rejestrze jest ciągła po grupach. W `filters-menu-model.test.ts`
— zero wypada, zaangażowane zero zostaje, wiersze idą w kolejności `FILTER_GROUPS`, `groupLabel`
jest na każdym wierszu, i kolejność wyniku **zgadza się z kolejnością rejestru** (pin dla
`active-filters-model.test.ts`).

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/queries.test.ts src/__tests__/lib/kosztorys/row-conditions/registry.test.ts`
- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/filters-menu-model.test.ts`

#### Manual Verification:

- (brak — faza nie dotyka ekranu)

---

## Phase 2: Nagłówki w menu

### Overview

Komponent menu uczy się nagłówków per wiersz, „Filtry" przechodzą na model, a wiersz zbiorczy
zawęża się do wylistowanych.

### Changes Required:

#### 1. Nagłówki grup w komponencie menu

**File**: `src/components/filters/filter-multi-select.tsx`

**Intent**: Wiersze `toggles` mogą nazwać swoją grupę; nagłówek powstaje tam, gdzie nazwa się
zmienia — ten sam mechanizm, który „Problemy" mają w `DropdownCheckGroups`. Opcjonalnie, bo
`transfer-filters.tsx` nadal podaje jedną płaską listę pod `togglesHeading`.

**Contract**: `toggles?: ReadonlyArray<{ …, groupLabel?: string }>`. Gdy którykolwiek wiersz nazywa
grupę, lista dzieli się na ciągi o równym `groupLabel` i każdy ciąg dostaje własną `CommandGroup`
z tym nagłówkiem; gdy żaden nie nazywa — zachowanie bez zmian (jedna `CommandGroup` z
`togglesHeading`). Wiersz zbiorczy i separator zostają **nad** grupami, żeby „Zaznacz wszystkie" nie
czytało się jako część pierwszej osi. Lista przychodzi już posortowana po grupie — komponent nie
sortuje.

#### 2. Hook menu

**File**: `src/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu.ts`

**Intent**: Hook oddaje gotowe wiersze modelu zamiast surowych warunków, a zakres zamiatania idzie
za tym, co wylistowane.

**Contract**: zwraca `{ toggles, togglesBulk, resetAction }`, gdzie `toggles` to wynik
`filtersMenuModel` wzbogacony o `onToggle`. `togglesBulk` liczy się z tych samych wierszy.
Komentarz o zakresie zamiatania do **przepisania**: dotychczasowe uzasadnienie („filtry drugiej
płaszczyzny nie są na ekranie") przestaje być prawdą — nowe mówi, że zamiatamy to, co widać, bo
wiersza schowanego przy zerze i tak nie ma czym odptaszkować, a jego jedynym skutkiem byłoby
otwarcie kolumn cenowych bez żadnego ukrycia. „Zresetuj filtry" zostaje tym jednym, co obejmuje
całość.

#### 3. Komponent „Filtry"

**File**: `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx`

**Intent**: Komponent przestaje budować etykiety i liczniki — czyta wiersze z hooka i podaje je z
nagłówkami.

**Contract**: `togglesHeading="Prace"` wypada (nagłówki idą per wiersz); `triggerCount` liczy się
z wierszy modelu jak dziś. `conditionCounts` nie jest już czytane w komponencie.

#### 4. Testy menu

**File**: `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.test.tsx`

**Intent**: Cztery istniejące testy przestają przechodzić z założenia (podają pustą mapę liczników,
czyli po zmianie zero wierszy), a jeden z nich asercjuje wprost to, co zmiana odwraca. Poprawić, nie
usuwać — wzorem `problems-menu.test.tsx`, jeśli ten karmi liczniki.

**Contract**: fixture dostaje liczniki. „leaves the other plane's filters alone, since the menu never
listed them" zmienia sens na **przeciwny**: wiersz zbiorczy zamiata teraz obie płaszczyzny, bo obie
są na liście. Dochodzi test, że wiersz z licznikiem 0 nie jest listowany, a zaangażowany przy zerze
— jest. Dochodzi test nagłówka grupy.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.test.tsx`
- `pnpm exec vitest run src/__tests__/components/transfers/transfer-filters.test.tsx` (jeśli istnieje — dowód, że płaska ścieżka bez grup nie drgnęła)
- `pnpm exec vitest run src/__tests__/lib/kosztorys/active-filters-model.test.ts`

#### Manual Verification:

- Menu „Filtry" w kosztorysie pokazuje sześć nagłówków, a pod nimi tylko zawężenia, które mają co ukryć
- Ta sama lista w widoku „Inwestor" i w obu widokach wykonawców — bez różnic
- Odptaszkowanie zawężenia stawkowego z widoku „Inwestor" ukrywa pozycje i otwiera kolumny stawek
- „Odznacz wszystkie" zaptaszkowuje/odptaszkowuje dokładnie wylistowane wiersze, a licznik na przycisku zgadza się z liczbą odptaszkowanych
- Filtrowanie transferów (drugie miejsce, które korzysta z tego menu) wygląda i działa bez zmian

---

## Phase 3: Warsztat bez przełącznika

### Overview

Warsztat szablonu stoi na „Inwestor" i traci kontrolkę widoku, zachowując ulotną nakładkę z
„Problemów".

### Changes Required:

#### 1. Przypięcie bazowej płaszczyzny

**File**: `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts`

**Intent**: W warsztacie zamknięta lista kolumn pokazuje obie płaszczyzny naraz, więc bazowa
płaszczyzna nie ma czego wybierać — przypinamy ją do „Inwestor". Przypięcie jest **konieczne**, a nie
kosmetyczne: `pickView` jest jedynym zapisującym stan widoku, więc samo ukrycie przycisku zostawiłoby
na zawsze na płaszczyźnie wykonawcy każdą przeglądarkę, która go tam kiedyś przestawiła.

**Contract**: `ArgsT` dostaje `isWorkshop?: boolean`. Przypięcie dotyczy **`persistedView`**:
`preview` zostaje pierwszym warunkiem (druga połowa zamka ujawnienia), `problemPlane` zostaje nad
przypięciem. Komentarz ma nazwać oba powody — zamkniętą listę kolumn i jedynego zapisującego — oraz
to, że nakładka usterki zostaje celowo.

#### 2. Przekazanie flagi

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Flaga warsztatu jest już parametrem tego hooka, ale nie dochodzi do stanu widoku.

**Contract**: wywołanie w `:192` dostaje `isWorkshop`.

#### 3. Zdjęcie kontrolki

**File**: `src/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.tsx`

**Intent**: W warsztacie przełącznik „Widok cen" nie ma czego przełączać, więc go tam nie ma.

**Contract**: `ToolbarToggle` z `aria-label="Widok cen"` (`:43-48`) obwarowany `!isWorkshop`,
wzorem `{!isWorkshop && <KosztorysViewMenu />}` w `:105`.

#### 4. Nieaktualny komentarz

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Komentarz w `:97-104` mówi, że w szablonie przełącznik płaszczyzny działa jak wszędzie —
po tej zmianie nie ma tam przełącznika. To drugie podejście do tego samego komentarza (EX-820
zapisał poprzednią wersję jako dryf), więc nowy ma nazwać stan, nie historię: w warsztacie
płaszczyzna jest przypięta, a zamknięta lista kolumn jest powodem.

**Contract**: komentarz oddaje aktualny stan; zdanie o „szablon otwiera się na 'client'" wypada.

#### 5. Test paska narzędzi

**File**: `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx`

**Intent**: Punkt 4 nie ma dziś **żadnego** pokrycia — ani obecności kontrolki, ani przypięcia.

**Contract**: wzorem `kosztorys-actions-menu.test.tsx` („w warsztacie nie oferuje inwestora") — w
warsztacie nie ma kontrolki „Widok cen", w kosztorysie jest.

### Success Criteria:

#### Automated Verification:

- `pnpm exec vitest run src/__tests__/components/kosztorys/editor/toolbar/kosztorys-editor-toolbar.test.tsx`

#### Manual Verification:

- Warsztat szablonu nie ma przycisku „Widok cen"; kosztorys inwestycji ma
- Warsztat pokazuje ceny klienta w kolumnie „Cena j.m." i obie płaszczyzny stawek obok — jak dotąd
- Sortowanie po „Cena j.m." w warsztacie porządkuje wiersze tym, co w tej kolumnie widać
- Przeglądarka, która przed zmianą stała w warsztacie na płaszczyźnie wykonawcy, po wejściu widzi „Inwestor" (bez czyszczenia localStorage)
- Wybór usterki stawkowej w „Problemach" w warsztacie nadal przenosi na płaszczyznę tej usterki, a odznaczenie usterki / X na chipie / „Zresetuj filtry" wraca na „Inwestor"
- Podgląd klienta (`preview`) dalej stoi na „Inwestor"

---

## Testing Strategy

### Unit Tests:

- Bramki `offeredFilterConditions` — dziś zerowe pokrycie tej funkcji
- Kompletność `filterGroup` na filtrach i ciągłość grup w rejestrze
- Próg licznika, wyjątek dla zaangażowanego, kolejność grup, zgodność z kolejnością rejestru

### Integration Tests:

Brak — zmiana nie dotyka bazy, akcji ani cache'u.

### DOM Tests:

- Menu „Filtry": nagłówki, brak wiersza przy zerze, obecność zaangażowanego zera, zakres zamiatania
- Pasek narzędzi: obecność / brak kontrolki „Widok cen" w dwóch trybach

### Manual Testing Steps:

Zebrane w wykazach `#### Manual Verification` Faz 2 i 3 — trafiają do rejestru
`context/foundation/manual-checks.md`.

## Performance Considerations

Zero po stronie liczenia: liczniki już dziś chodzą po wszystkich warunkach niezależnie od widoku
(`use-kosztorys-editor.ts:416-435`, `view` celowo poza zależnościami memo). Model menu liczy po 16
wpisach na otwarciu menu.

## Migration Notes

Brak migracji bazy. Jedna rzecz zastana w przeglądarkach: klucz `kosztorys-view:<mirrorId>` może
trzymać płaszczyznę wykonawcy dla warsztatu. Nie czyścimy go — przypięcie po prostu przestaje go
czytać w warsztacie, a ten sam klucz dla kosztorysu inwestycji działa dalej.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Riserczy: `context/changes/2026-09-23-filtry-bez-widoku/research.md`
- Sąsiednia zmiana w tym menu: `context/changes/2026-09-22-stawka-problems-and-filters/change.md` (EX-820)
- Wzór modelu menu: `src/components/kosztorys/editor/toolbar/menus/problems-menu-model.ts`
- Wzór nazw grup: `src/lib/kosztorys/problem-groups.ts`
- Wzór testu „w warsztacie nie oferuje": `src/__tests__/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu.test.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Oś kategorii i model menu

#### Automated

- [x] 1.1 Specs bramek i rejestru przechodzą (`queries.test.ts`, `registry.test.ts`)
- [x] 1.2 Spec modelu menu przechodzi (`filters-menu-model.test.ts`)

### Phase 2: Nagłówki w menu

#### Automated

- [x] 2.1 Spec menu „Filtry" przechodzi (`kosztorys-filters-menu.test.tsx`)
- [x] 2.2 Płaska ścieżka bez grup nietknięta (spec filtrowania transferów)
- [x] 2.3 Spec chipów zaangażowanych zawężeń przechodzi (`active-filters-model.test.ts`)

### Phase 3: Warsztat bez przełącznika

#### Automated

- [x] 3.1 Spec paska narzędzi przechodzi (`kosztorys-editor-toolbar.test.tsx`)
