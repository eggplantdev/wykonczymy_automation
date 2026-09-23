# Przywrócenie „własnego mnożnika" jako trzeciego źródła stawki wykonawcy — plan wdrożenia

## Overview

„Źródło ceny wykonawcy" odzyskuje trzecią opcję — **„własny mnożnik"** — a rozpiska odzyskuje kolumnę
**„Mnożnik"**, po jednej na płaszczyznę. Stawka takiej pozycji jest liczona jako `cena j.m. × mnożnik`
przy każdym odczycie, więc zmiana ceny dla inwestora przesuwa stawkę wykonawcy razem z nią — czego
kwota stała z definicji nie robi. To samo źródło dostaje katalog prac, który dziś nie umie go
wyrazić w ogóle.

Mnożnik jest **per pojedyncza praca**. Mnożnika per sekcja nie ma i nie będzie (decyzja właściciela).

## Current State Analysis

- **Trzeciego źródła nie ma w schemacie, nie tylko w UI.** `OVERRIDE_FIELDS`
  (`src/lib/kosztorys/constants.ts:5-8`) wskazuje na jedną kolumnę `numeric NULL` na płaszczyznę;
  `subcontractorPrice` (`src/lib/kosztorys/calc.ts:103-107`) rozgałęzia się wyłącznie na
  `override !== null`. Nie ma gdzie zapisać „ta liczba jest mnożnikiem".
- **Kolumny `*_override_type` skasowała migracja**
  `src/migrations/20260902_0_collapse_kosztorys_tool_overrides.ts:30-56` (EX-766). To nie jest revert
  — nie ma czego przywracać, jest co zaprojektować.
- **Powód kasacji jest wciąż aktualny.** `planGridChanges`
  (`src/lib/kosztorys/grid-change-plan.ts:40`) spłaszcza diff wiersza do **jednego wpisu na pole**,
  a `use-kosztorys-editor.ts:1169-1179` odpala `updateItemFieldAction(id, {[pole]: wartość})` osobno
  dla każdego wpisu, w osobnej ścieżce zapisu. Dwie kolumny niosące jedno pojęcie zapisują się więc
  jako dwa nieuporządkowane zapisy, a stan pośredni potrafił być trwały i **cichy**: `{type: null,
value: 500}` czytało się jako „auto", trzymając żywe 500.
- **Trzy czytniki omijają `overrideValueFor`** i muszą znać nowy kształt z osobna: `CASE` w
  `src/lib/db/kosztorys-subcontractor-due.ts:36-52`, zbiorczy `UPDATE … FROM (VALUES)` w
  `src/lib/db/kosztorys-catalogue-apply.ts:63-78` i krotka `INSERT` w
  `src/lib/kosztorys/insert-rows.ts:123`.
- **Sufit 65% ocenia dziś wyłącznie kwotę stałą** (`subcontractor-price-guard.ts:110-119`); „auto"
  jest oceniane raz, przy globalnym mnożniku inwestycji (`coeffWarning`).
- **Diagnostyka „Stawki wykonawców liczone według formuły"** (`row-conditions/registry.ts:58-93`,
  EX-708) została napisana jako „wszystko, co nie jest płaską kwotą" — jej własny komentarz mówi to
  wprost („an inherited multiplier and a hand-typed one are the same fault"). Dzisiejszy test
  `overrideValueFor(row, plane) !== null` jest z nim równoważny **tylko dlatego**, że trzecie źródło
  zniknęło.
- **Katalog prac nigdy nie miał mnożnika.** `wToolsRate` / `ownToolsRate` to `number | null`
  (`work-catalogue/types.ts:9-18`), a docblock wyklucza pojęcie wprost. Porównanie z katalogiem
  koduje rodzaj dwoma boolami `kosztorysIsAuto` / `catalogueIsAuto`
  (`build-catalogue-comparison.ts:91-109`) — to jest to, co trzecie źródło łamie.
- **Odcisk golden mastera koduje rodzaj literalnie** — `'amount:' || …` w
  `src/__tests__/financial-golden-master-db.test.ts:189-192`, pozostałość po kolumnie typu. Zmiana
  odcisku nie wywala testu na czerwono, tylko **po cichu wypisuje inwestycje z porównania**
  (`context/foundation/lessons.md`).
- **`buildCatalogueSeed` nie ma dziś wołającego** — jedynym był skasowany skrypt
  `src/scripts/seed-work-catalogue.ts` (`23bf2fc9` → `f8476290`). Moduł żyje wyłącznie w swoim
  własnym specu.

## Desired End State

W widoku wykonawcy „Źródło ceny wykonawcy" ma trzy pozycje: „auto", „własny mnożnik", „kwota stała".
Przy „własnym mnożniku" edytowalna jest kolumna „Mnożnik" (zapis dziesiętny, `0,55` — jak globalny
mnożnik inwestycji), a „Cena j.m." pokazuje wynikową kwotę na wyszarzonym, nieedytowalnym polu,
dokładnie tak jak przy „auto". Podniesienie ceny dla inwestora podnosi stawkę wykonawcy tej pozycji.

Sufit 65% ocenia taką pozycję jak każdą inną — po wynikowej stawce. Filtry rozpiski mają trzeci wpis
na płaszczyznę („z własnym mnożnikiem"). Diagnostyka „liczone według formuły" wraca do swojej
pierwotnej reguły i łapie obie procentowe postacie.

W katalogu prac praca może nosić mnożnik zamiast kwoty; wstawiona do rozpiski ląduje jako „własny
mnożnik" o tej samej wartości, a „Porównaj z katalogiem" porównuje trzy rodzaje zamiast dwóch booli.

### Key Discoveries

- **Atomowość rozstrzyga się na ścieżce zapisu, nie na liczbie kolumn.** `updateItemFieldAction`
  przyjmuje częściowy `ItemPatchT`, więc jedna zmiana pola w siatce może rozwinąć się w akcji do
  zapisu **obu** kolumn w jednym wywołaniu. To jest to, czego EX-766 nie miało.
- Bez tej normalizacji dwukolumnowy kształt ma dokładnie jedną dziurę: przejście **mnożnik → auto**
  musiałoby wyczyścić obie kolumny, a zgubiona połowa wystawiłaby z powrotem starą kwotę.
- `WORKSHOP_VISIBLE_COLUMNS` i `DEFAULT_HIDDEN_COLUMNS` (`column-config.ts:245,267`) rozsypują
  `ALL_PLANE_PRICE_KEYS`, więc dopisanie `priceCoeff` do `PLANE_PRICE_BASE_KEYS` **samo** wciąga
  kolumnę do szablonu i **samo** startuje ją jako ukrytą. `PREVIEW_VISIBLE_COLUMNS` buduje się
  z jawnych `CLIENT_VIEW_GROUPS`, więc do widoku klienta nie wejdzie — i nie wolno jej tam dopisać.
- `COLUMN_MONEY_AXIS` i `COLUMN_LAYER` zawodzą **otwarcie**: kolumna nieobecna w mapie jest neutralna
  dla osi netto/brutto i liczy się jako „praca" dla osi Praca/Postęp. Mnożnik nie jest kwotą, więc nie
  potrzebuje wpisu w żadnej z nich.
- `serializeKosztorysAsPreset` zeruje wyłącznie pola per-job i **zachowuje nadpisania**, więc mnożnik
  pojedzie do szablonu bez dodatkowego kodu.
- `EX-864` („Stawka wykonawcy »auto« zaokrąglana do pełnej złotówki") leży na tej samej ścieżce
  wyprowadzania — pozycja z mnożnikiem odziedziczy to zachowanie, jakiekolwiek ono jest.

## What We're NOT Doing

- **Nie ruszamy globalnego mnożnika inwestycji** ani jego ostrzeżeń — per-wierszowy mnożnik jest
  nadpisaniem, nie jego zamiennikiem.
- **Nie ruszamy importu z arkusza.** `deriveOverride` zachowuje dwie gałęzie: praca z formułą przy
  współczynniku arkusza → „auto", każda inna → zamrożona kwota. Formuła o innym stosunku **nie**
  staje się mnożnikiem (decyzja właściciela).
- **Nie ruszamy `buildCatalogueSeed`** — moduł jest dziś martwy, nie planujemy dla niego zachowania.
- **Nie ruszamy mnożnika per sekcja** — nie istnieje i nie powstaje.
- **Nie backfillujemy istniejących danych.** Każda dzisiejsza kwota stała zostaje kwotą stałą; nikt
  nie zgaduje wstecz, która z nich „miała być" mnożnikiem.
- **Nie dopuszczamy mnożnika do widoku klienta ani do podglądu inwestora** — to liczba wykonawcy.
- **Nie piszemy E2E w tej zmianie** — należność zapisujemy na bramce przeglądu.

## Implementation Approach

Najpierw liczba, potem zapis, potem ekran. Faza 1 daje trzecie źródło w czystej arytmetyce, gdzie
testuje się je bez renderu i bez bazy. Faza 2 domyka ścieżkę zapisu, czyli jedyne miejsce, w którym
EX-766 naprawdę się wykrwawiło — dopiero od tego momentu druga kolumna jest bezpieczna. Dalej ekran,
werdykty i katalog, każde na już atomowym fundamencie.

Faza 0 stoi przed wszystkim, bo odcisk golden mastera psuje się **cicho**: bez świeżej bazy nie widać,
czy inwestycje wypadły z porównania przez zmianę kolumny, czy przez zmianę liczby.

## Critical Implementation Details

**Pierwszeństwo źródeł.** `coeff` > `value` > globalny mnożnik. Jedna funkcja
`priceSourceOf(row, plane): 'auto' | 'coeff' | 'amount'` jest **jedynym** miejscem, które to
rozstrzyga — cztery powierzchnie (siatka, sufit, filtry, katalog) czytają ją, żeby nie dało się ich
rozjechać.

**Normalizacja pary w akcji.** `updateItemFieldAction` rozwija zapis dotykający jednej z kolumn pary
w zapis obu: ustawienie mnożnika zeruje kwotę, ustawienie kwoty zeruje mnożnik, „auto" zeruje obie.
To jest niezmiennik, którego typy nie pilnują — musi stać opisany przy akcji, bo tam go ktoś złamie.

**Zapis mnożnika.** Dziesiętnie (`0,55`), przez istniejące `formatCoeff` — tak samo jak globalny
mnożnik inwestycji. Procent jest odrzucony świadomie: ta sama decyzja zapisywana dwoma notacjami
o jeden pasek narzędzi od siebie to wklejenie pomylone o 100×.

**Sufit.** `isFixedRateOverCeiling` przestaje znaczyć „kwota stała" i zaczyna znaczyć „stawka, której
autor siedzi w tym wierszu" — czyli kwota **albo** mnożnik. „auto" dalej milczy, bo jego autorem jest
globalny mnożnik, oceniany raz we własnym polu. Czerwień wchodzi na obie komórki pozycji z mnożnikiem.

**Odcisk golden mastera.** `'amount:' || …` rozszerza się o gałąź `'coeff:' || …`. Zmiana idzie
**po** regeneracji bazowego fixture'a (faza 0) i **przed** finalną regeneracją (faza 6).

---

## Phase 0: Baseline golden mastera

### Overview

Zanim powstanie jakakolwiek kolumna — świeża baza testowa i przeliczony fixture, żeby późniejsza
zmiana odcisku była widoczna jako zmiana odcisku, a nie jako cicho zniknięte inwestycje.

### Changes Required

#### 1. Świeża baza i fixture

**Files**: `src/__tests__/fixtures/` (wygenerowany snapshot parity)

**Intent**: Ustalić punkt odniesienia na nietkniętym schemacie.

**Contract**: `pnpm db:import:test`, następnie `pnpm test:parity` przechodzi na czysto. Jeśli nie
przechodzi **przed** zmianą — zatrzymujemy się i naprawiamy to najpierw; inaczej nie da się odróżnić
naszego skutku od zastanego dryfu.

### Success Criteria

#### Automated Verification

- `pnpm db:import:test` kończy się bez błędu
- `pnpm test:parity` przechodzi na nietkniętym drzewie

---

## Phase 1: Schemat i arytmetyka

### Overview

Trzecie źródło zaczyna istnieć w bazie i w wycenie. Ekran jeszcze o nim nie wie.

### Changes Required

#### 1. Migracja

**File**: `src/migrations/20260923_0_restore_subcontractor_rate_coeff.ts` (pisana ręcznie — patrz
`@AGENTS.md`, `migrate:create` emituje fantomowy dryf)

**Intent**: Dołożyć towarzyszącą kolumnę mnożnika na płaszczyznę, w obu tabelach, w jednej migracji —
zmiana jest **addytywna**, więc trafia na produkcję **przed** wdrożeniem kodu.

**Contract**:

```sql
ALTER TABLE "kosztorys_items"
  ADD COLUMN "w_tools_override_coeff" numeric,
  ADD COLUMN "own_tools_override_coeff" numeric;
ALTER TABLE "work_catalogue_items"
  ADD COLUMN "w_tools_rate_coeff" numeric,
  ADD COLUMN "own_tools_rate_coeff" numeric;
```

Bez `NOT NULL`, bez `DEFAULT`, bez backfillu. `down` kasuje cztery kolumny. Nazwa w katalogu to
`*_rate_coeff`, a nie `*_coeff`, bo `w_tools_coeff` na `investments` to **globalny mnożnik
inwestycji** — dwie różne rzeczy nie mogą wyglądać identycznie w dumpie.

#### 2. Kolekcje Payloada

**Files**: `src/collections/kosztorys-items.ts`, `src/collections/work-catalogue-items.ts`

**Intent**: Wystawić nowe kolumny przez ORM, którym idzie autozapis komórki.

**Contract**: po dwa pola `{ type: 'number', min: 0 }`, nullable, bez `defaultValue`. Potem
`pnpm generate:types`.

#### 3. Stałe i typy

**Files**: `src/lib/kosztorys/constants.ts`, `src/lib/kosztorys/types.ts`

**Intent**: Para „płaszczyzna → pole" istnieje dziś raz; druga para musi powstać obok niej, nie
zamiast niej.

**Contract**:

- `OVERRIDE_COEFF_FIELDS` obok `OVERRIDE_FIELDS`, ten sam kształt `satisfies Record<ToolPlaneT, keyof ViewPricingT>`.
- `KosztorysItemT` i `ItemPatchT` dostają `wToolsOverrideCoeff` / `ownToolsOverrideCoeff: number | null`.
- Nowy typ `PriceSourceT = 'auto' | 'coeff' | 'amount'` — **jedno** słownictwo dla siatki, sufitu,
  filtrów i katalogu.

#### 4. Wycena

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Jedno miejsce rozstrzyga pierwszeństwo; nikt go nie powtarza.

**Contract**:

- `overrideCoeffFor(row, view): number | null` — bliźniak `overrideValueFor`.
- `priceSourceOf(row, view): PriceSourceT` — `coeff` gdy mnożnik nie-null, inaczej `amount` gdy kwota
  nie-null, inaczej `auto`.
- `subcontractorPrice` rozgałęzia się przez `priceSourceOf`: `coeff → clientPrice × mnożnik`,
  `amount → kwota`, `auto → clientPrice × effectiveCoeff`. Mnożnik mnoży cenę **przed rabatem**, tak
  jak sufit i jak „auto" — rabat jest oddaniem własnej marży, nie przeceną pracy wykonawcy.

#### 5. Ryzyko w planie testów

**File**: `context/foundation/test-plan.md`

**Intent**: Testy niżej mają się zaczepiać o ryzyko, nie o plik.

**Contract**: jedno ryzyko — „stawka wykonawcy ma trzy źródła i przełączenie między nimi może zapisać
się w połowie" — z warstwami node (arytmetyka, normalizacja) i dom (przełącznik źródła, komórka
tylko do odczytu).

### Success Criteria

#### Automated Verification

- Nowy spec wyceny przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-calc.test.ts`
- Typy się spinają: `pnpm typecheck`

#### Manual Verification

- Rozpiska otwiera się bez zmian na ekranie — nowa kolumna jeszcze nie istnieje w UI.
- Ustawienie mnożnika ręcznie w bazie daje w rozpisce wyliczoną stawkę i przesuwa ją po zmianie
  „Cena j.m." (sprawdzian, że wyprowadzenie działa, zanim powstanie ekran).

---

## Phase 2: Atomowa ścieżka zapisu

### Overview

Jedna zmiana źródła = jedno wywołanie akcji = jeden zapis. Dopiero to czyni drugą kolumnę bezpieczną.

### Changes Required

#### 1. Schemat łatki i normalizacja

**File**: `src/lib/actions/kosztorys.ts`

**Intent**: Siatka wysyła jedno pole; akcja zapisuje całe pojęcie. Niezmiennik „najwyżej jedna
z pary jest nie-null" nie jest pilnowany przez typy, więc pilnuje go to miejsce.

**Contract**:

- `itemPatchSchema` dostaje oba klucze mnożnika jako `z.coerce.number().nullable()` — `.nullable()`
  **owija** koercję, dokładnie z tego samego powodu co przy kwocie: `z.coerce.number()` zamienia
  `null` na `0`, a `0` to prawdziwa stawka zero złotych.
- Przed `payload.update` łatka przechodzi przez `normalizeOverridePatch(patch)`: zapis mnożnika
  dokłada `*OverrideValue: null`, zapis kwoty dokłada `*OverrideCoeff: null`, wyzerowanie
  któregokolwiek zeruje oba. Rozwinięcie działa per płaszczyzna — łatka na `w_tools` nie rusza
  `own_tools`.

#### 2. Czytniki omijające `overrideValueFor`

**Files**: `src/lib/db/kosztorys-subcontractor-due.ts`,
`src/lib/db/kosztorys-catalogue-apply.ts`, `src/lib/kosztorys/insert-rows.ts`

**Intent**: Trzy kopie reguły ceny muszą zgadzać się z czwartą.

**Contract**:

- `CASE` rozliczenia dostaje gałąź mnożnika **przed** gałęzią kwoty:
  `WHEN ki.w_tools_override_coeff IS NOT NULL THEN ki.client_price * ki.w_tools_override_coeff`.
  Dalej bez `coalesce` na stawce — `NULL` jest sygnałem.
- `CatalogueApplyColumnT` i `COLUMN_NAME` rosną o dwie kolumny mnożnika; rzut `::numeric` zostaje,
  bo wiodący `NULL` dalej musi się typować.
- `ITEM_INSERT_COLUMNS` i krotka `VALUES` rosną o dwie kolumny, wiązane surowo (bez `?? 0`).

#### 3. Diff, wiersz pusty, snapshot

**Files**: `src/lib/kosztorys/v2-rows.ts`, `src/lib/kosztorys/row-ops.ts`,
`src/lib/kosztorys/snapshot-format.ts`

**Intent**: Nowe pole musi być widziane przez diff, zasiane w nowym wierszu i przetrwać zapis/odczyt
szablonu.

**Contract**: oba klucze w `ITEM_FIELDS`; `buildBlankRow` zasiewa `null`; `StoredSnapshotPayloadT`
oznacza je jako tolerowane opcjonalne, a `itemWithColumnDefaults` dopełnia `?? null` — **nigdy**
`?? 0`. Stare snapshoty i presety nie znają pól i mają je odczytać jako „auto", co jest prawdą:
powstały, gdy mnożnika nie było.

### Success Criteria

#### Automated Verification

- Nowy spec normalizacji: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys.test.ts`
- Spec rozliczenia na bazie: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-subcontractor-due.test.ts`
- Roundtrip snapshotu: `pnpm exec vitest run src/__tests__/lib/kosztorys/serialize-restore-roundtrip.test.ts`

#### Manual Verification

- Ustawienie mnożnika w bazie i przeładowanie rozpiski daje tę samą stawkę w podsumowaniu rozliczenia
  wykonawcy co w siatce (dwie niezależne kopie reguły zgadzają się).

---

## Phase 3: Ekran — kolumna „Mnożnik" i trzecie źródło

### Overview

Właściciel widzi i wpisuje mnożnik.

### Changes Required

#### 1. Przestrzeń kluczy kolumn

**File**: `src/lib/kosztorys/plane-price-keys.ts`

**Intent**: Trzecia rodzina kolumn na płaszczyznę.

**Contract**: `PLANE_PRICE_BASE_KEYS = ['priceMode', 'priceCoeff', 'price']` — kolejność tablicy jest
kolejnością montażu, a mnożnik ma stać między źródłem a ceną. `ALL_PLANE_PRICE_KEYS` rośnie
automatycznie, co **samo** wciąga kolumnę do `WORKSHOP_VISIBLE_COLUMNS` i do
`DEFAULT_HIDDEN_COLUMNS`. Do `CLIENT_VIEW_GROUPS` / `PREVIEW_VISIBLE_COLUMNS` **nie wchodzi** i nie
wolno jej tam dopisać.

#### 2. Etykiety, podpowiedzi, sortowanie

**Files**: `src/lib/kosztorys/column-config.ts`, `src/lib/kosztorys/header-tips.ts`,
`src/lib/kosztorys/sort-value.ts`

**Intent**: Nowa kolumna ma nazwę, zdanie w nagłówku i sensowny porządek.

**Contract**:

- `COLUMN_LABELS.priceCoeff = 'Mnożnik'`; `columnLabelForView` doklei „— <płaszczyzna>" jak
  pozostałym.
- Podpowiedź nagłówka: mnożnik liczony od ceny dla inwestora, przesuwa się razem z nią.
- `sortValue` dla `priceMode` rośnie z 0/1 do 0/1/2 (`auto` → `coeff` → `amount`) przez
  `priceSourceOf`; `priceCoeff` sortuje się po liczbie, z pozycjami bez mnożnika na końcu.
- Wpisów w `COLUMN_MONEY_AXIS` ani `COLUMN_LAYER` **nie dodajemy** — mnożnik nie jest kwotą, a obie
  mapy zawodzą otwarcie.

#### 3. Przełącznik źródła i polityka edycji

**File**: `src/lib/kosztorys/subcontractor-price-edit.ts`

**Intent**: Trzy źródła zamiast boolowskiego „fixed".

**Contract**:

- `modeChange(row, fixed, view)` ustępuje miejsca `sourceChange(row, source: PriceSourceT, view)`:
  `amount` zasiewa aktualnie pokazywaną stawkę (jak dziś), `coeff` zasiewa **aktualny efektywny
  mnożnik** — czyli globalny inwestycji przy wejściu z „auto", albo `stawka / cena j.m.` przy wejściu
  z kwoty, żeby przełączenie źródła nie ruszało liczby na ekranie. Przy `clientPrice === 0`
  wyprowadzenie nie istnieje — wtedy zasiewa globalny mnożnik.
- `subcontractorCoeffPolicy(view)`: `snapshot`/`restore`/`applyValue` na kolumnie mnożnika,
  `clear` zwraca wiersz do „auto" (zeruje obie kolumny), `guard` to ten sam
  `checkSubcontractorPrice`, `restoredLabel` pokazuje wynikową kwotę.
- `subcontractorPolicy` (kwota) dostaje jedną zmianę: wpisanie kwoty zeruje mnożnik — lustro
  normalizacji z fazy 2, żeby optymistyczny wiersz i baza nie rozjeżdżały się na jedno odświeżenie.

#### 4. Komórki siatki

**File**: `src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`

**Intent**: Trzecia opcja w menu, nowa kolumna, „Cena j.m." przestaje być edytowalna przy mnożniku.

**Contract**:

- `SUB_MODE_OPTIONS` rośnie o `{ value: 'coeff', label: 'własny mnożnik' }`; `modeOf` przechodzi na
  `priceSourceOf`.
- Nowy `subcontractorCoeffColumn(view, titleNode)` — komórka edytowalna wyłącznie przy źródle
  `coeff`, poza nim pusta i wyszarzona. Zapis dziesiętny przez `formatCoeff`.
- `SubcontractorPriceCell` przy źródle `coeff` renderuje wynikową kwotę jako **nieedytowalną**,
  w tym samym wyszarzonym stylu co przy „auto" — inaczej dwie komórki po cichu nadpisywałyby sobie
  źródło.
- `component` obu kolumn zostaje **stabilną referencją** (EX-422) — żadnych inline'owych komponentów.

#### 5. Montaż kolumn

**File**: `src/components/kosztorys/editor/grid/kosztorys-v2-columns.tsx`

**Intent**: Trzecia kolumna na płaszczyznę, za tą samą bramką co „Źródło".

**Contract**: `subcontractorCoeffColumn` montuje się obok `subcontractorModeColumn`, pod tym samym
warunkiem `withMode` — mnożnik jest liczbą wykonawcy dokładnie tak jak źródło.

### Success Criteria

#### Automated Verification

- Specy komórek: `pnpm exec vitest run src/__tests__/components/kosztorys/editor/grid/cells`
- Specy kolumn i sortowania: `pnpm exec vitest run src/__tests__/lib/kosztorys/kosztorys-sort-value.test.ts`
- `pnpm typecheck`

#### Manual Verification

- Ustawienie „własny mnożnik" nie rusza liczby w „Cena j.m." w chwili przełączenia.
- Wpisanie `0,55` daje stawkę `cena × 0,55`; podniesienie „Cena j.m." przesuwa ją natychmiast.
- „Cena j.m." przy mnożniku jest wyszarzona i nie przyjmuje wpisu.
- Kolumna „Mnożnik" **nie** pojawia się na linku dla inwestora ani w podglądzie klienta.
- Kolumna jest domyślnie ukryta i włącza się jednym tikiem w pickerze.

---

## Phase 4: Sufit, filtry, diagnostyka

### Overview

Werdykty uczą się trzeciego źródła.

### Changes Required

#### 1. Sufit

**File**: `src/lib/kosztorys/subcontractor-price-guard.ts`

**Intent**: Stawka, której autor siedzi w tym wierszu, jest oceniana w tym wierszu — niezależnie od
tego, czy została wpisana jako kwota, czy jako mnożnik. Przepłacenie jest identyczne.

**Contract**: `isFixedRateOverCeiling` przechodzi na `priceSourceOf(row, view) !== 'auto' &&
isOverCeiling(subcontractorPrice(row, view), row)`. Nazwa i docblock idą za znaczeniem — „stawka
własna wiersza", nie „kwota stała". Docblock (`:78-86`) wprost zakazuje zawężania predykatu bez
przeniesienia orzeczenia z rejestru — więc obie strony tej pary zmieniają się w jednym kroku i obie
opisują nową regułę. `coeffWarning` (globalny mnożnik) **bez zmian**: jego zdania mówią o pozycjach ze
źródłem „auto" i to dalej jest prawda.

#### 2. Filtry i diagnostyka

**File**: `src/lib/kosztorys/row-conditions/registry.ts`

**Intent**: Trzeci wpis na płaszczyznę i powrót diagnostyki do jej pierwotnej reguły.

**Contract**:

- `manual-rate-<plane>` zawęża się do `priceSourceOf === 'amount'`, `formula-rate-<plane>` do
  `'auto'`, dochodzi `coeff-rate-<plane>` — „z własnym mnożnikiem<w widoku …>". Trzy wpisy są
  rozłączne i wyczerpujące, więc negowane bliźniaki („bez…") dalej się domykają; komentarz przy parze
  to mówi.
- `settledAtPercentRate` wraca do `priceSourceOf(row, plane) !== 'amount'` — obie procentowe postacie
  łapie, płaska kwota uchodzi. To jest reguła, którą ten guard **miał** od EX-708; dzisiejszy węższy
  test był równoważny tylko przy dwóch źródłach.
- `percentRateProblemLabel` zostaje bez zmian — zalecany ruch („ustaw »Źródło ceny wykonawcy« na
  »kwota stała«") jest poprawny także dla pozycji z mnożnikiem.
- `priceColumnsFor(plane)` odsłania teraz trzy kolumny, bo bierze je z `planePriceKeysFor`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/registry.test.ts`
- `pnpm exec vitest run src/__tests__/lib/kosztorys/subcontractor-price-guard.test.ts`

#### Manual Verification

- Pozycja z mnożnikiem ponad sufitem czerwienieje na obu komórkach i wchodzi do „Problemów".
- Na inwestycji z materiałami wliczonymi w robociznę pozycja z mnożnikiem i wykonaną pracą wchodzi do
  „Stawki wykonawców liczone według formuły".
- Menu „Filtry" pokazuje trzy wpisy źródła na płaszczyznę, a wybór każdego odsłania kolumny cenowe.

---

## Phase 5: Katalog prac

### Overview

Cennik umie trzecie źródło i przenosi je do rozpiski.

### Changes Required

#### 1. Typy i warstwa danych

**Files**: `src/lib/kosztorys/work-catalogue/types.ts`, `src/lib/db/work-catalogue.ts`

**Intent**: Wpis cennika przestaje być „kwota albo auto".

**Contract**: `WorkCatalogueItemT` rośnie o `wToolsRateCoeff` / `ownToolsRateCoeff: number | null`;
`CATALOGUE_COLUMNS` i `toCatalogueItem` o dwie kolumny przez `toRate` (a nie `Number`, bo `null` musi
przeżyć); `insertCatalogueItems` o dwie kolumny w liście i w krotce. `CatalogueSourceItemT` rośnie
o oba nadpisania mnożnika.

#### 2. Formularz i schemat

**Files**: `src/components/forms/work-catalogue-item/work-catalogue-item-form.tsx`,
`.../work-catalogue-item-schema.ts`, `src/components/dialogs/add-catalogue-item-dialog.tsx`,
`src/components/dialogs/edit-catalogue-item-dialog.tsx`,
`src/components/kosztorys/editor/dialogs/catalogue-item-from-kosztorys-dialog.tsx`

**Intent**: Checkbox „auto" niesie dwa stany; potrzebne są trzy.

**Contract**:

- `<plane>Auto: boolean` ustępuje `<plane>Source: PriceSourceT` (selektor trzech opcji). Pole kwoty
  montuje się przy `amount`, pole mnożnika przy `coeff`, przy `auto` żadne — a `listeners.onChange`
  resetuje to, które właśnie znikło (TanStack trzyma błędy na odmontowanych polach).
- `superRefine` sprawdza kwotę tylko przy `amount` i mnożnik tylko przy `coeff`, z `path` na właściwym
  polu tej płaszczyzny.
- `workCatalogueItemSchema` (warstwa domenowa) omija pola `*Source` i przyjmuje cztery `money(...)
.nullable()`.
- Dekodowanie w dialogach edycji idzie przez wspólny helper „wartości → źródło + tekst", nie przez
  trzecią kopię `rate === null`.

#### 3. Tabela katalogu

**File**: `src/components/tables/work-catalogue.tsx`

**Intent**: Wpis z mnożnikiem ma się czytać jako wpis z mnożnikiem.

**Contract**: komórka stawki renderuje kwotę, „auto" albo mnożnik dziesiętnie; kolumna „udział"
przy mnożniku **jest** mnożnikiem, więc liczy się bez dzielenia i czerwienieje po tej samej regule
(`isOverCeiling` na wyliczonej stawce). `formatPLNOrAuto` nie wyrazi trzech stanów przez
`number | null` — powstaje obok niego formatter biorący źródło.

#### 4. Przenoszenie między cennikiem a rozpiską

**Files**: `src/lib/kosztorys/work-catalogue/catalogue-rate.ts`,
`.../item-to-catalogue.ts`, `.../place-catalogue-items.ts`

**Intent**: Mnożnik jedzie w obie strony jako mnożnik — to jest cała wartość trzymania go w cenniku
globalnym.

**Contract**:

- `impliedCatalogueRate` ustępuje `impliedCatalogueRate(row, plane): { rate, coeff }` (albo parze
  funkcji): źródło `coeff` → mnożnik do cennika, `amount` → zamrożona kwota, `auto` → oba `null`.
- `asItem` w `place-catalogue-items` przepisuje mnożnik do `*OverrideCoeff`, a kwotę do
  `*OverrideValue` — nigdy obu naraz.
- Sufit przy wstawianiu (`placeCatalogueItems`) liczy się od wynikowej stawki, więc łapie także wpis
  z mnożnikiem.

#### 5. Porównanie z katalogiem

**Files**: `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts`, `.../types.ts`,
`src/components/kosztorys/editor/dialogs/catalogue-diff-table.tsx`,
`src/lib/actions/work-catalogue.ts`

**Intent**: Dwa boole nie wyrażą trzech rodzajów.

**Contract**:

- `CatalogueFigureDiffT` zamienia `kosztorysIsAuto` / `catalogueIsAuto` na `kosztorysSource` /
  `catalogueSource: PriceSourceT`.
- `figure(...)` dalej zwraca `null` tylko wtedy, gdy zgadzają się **i** kwota, **i** rodzaj — rozpiska
  z mnożnikiem kontra cennik z kwotą przy tej samej wyliczonej stawce **jest** rozjazdem, bo za
  tydzień przestanie nią być.
- `catalogueRate(...)` wyprowadza stronę cennika przez to samo pierwszeństwo co rozpiska.
- `applyCatalogueToKosztorysAction` pisze parę przez te same kolumny co faza 2; `AppliedCatalogueValueT`
  rośnie o klucze mnożnika i „wzięcie auto z katalogu" zeruje obie kolumny.
- Tabela różnic renderuje trzy rodzaje; delta jest wyszarzona, gdy którakolwiek strona jest „auto".

#### 6. „Zapisz do katalogu"

**File**: `src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx`

**Intent**: Podgląd „przed / po" musi umieć powiedzieć „mnożnik".

**Contract**: `PricesT` rośnie o mnożniki; obie listy i opis nadpisania idą przez nowy formatter
źródła. Copy dialogu wspomina trzy źródła zamiast dwóch.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue`
- `pnpm exec vitest run src/__tests__/lib/actions/work-catalogue.test.ts src/__tests__/lib/actions/work-catalogue-insert.test.ts src/__tests__/lib/actions/work-catalogue-save.test.ts`
- `pnpm exec vitest run src/__tests__/components/forms/work-catalogue-item src/__tests__/components/kosztorys/editor/dialogs/catalogue-diff-table.test.tsx`

#### Manual Verification

- Praca z mnożnikiem zapisana do cennika wraca do innej inwestycji jako mnożnik i wycenia się jej
  własną ceną.
- „Porównaj z katalogiem" pokazuje rozjazd rodzaju nawet przy zgodnej kwocie.
- Wzięcie „auto" z katalogu kasuje w rozpisce oba nadpisania.

---

## Phase 6: Domknięcie

### Overview

Odcisk golden mastera uczy się trzeciego źródła, całe drzewo przechodzi.

### Changes Required

#### 1. Odcisk parity

**File**: `src/__tests__/financial-golden-master-db.test.ts`

**Intent**: Odcisk inwestycji ma widzieć zmianę źródła, inaczej rozjazd wejścia przejdzie jako
rozjazd wyniku.

**Contract**: `CASE` odcisku rośnie o gałąź `'coeff:' || ki.w_tools_override_coeff::text`, przed
gałęzią `'amount:'`, symetrycznie na obu płaszczyznach. Fixture regenerowany na świeżo
zaimportowanej bazie (`pnpm db:import:test`), a diff liczby inwestycji w porównaniu **oglądany**, nie
przyjęty na wiarę.

#### 2. Dokumentacja

**Files**: `context/reference/kosztorys-editor-domain-notes.md`, `context/foundation/lessons.md`

**Intent**: Następna osoba ma znaleźć powód, dla którego para kolumn jest tym razem bezpieczna.

**Contract**: notatki domenowe opisują trzy źródła i pierwszeństwo; `lessons.md` dostaje dopisek przy
lekcji EX-766 — para kolumn jest atomowa wtedy i tylko wtedy, gdy **akcja** zapisuje całe pojęcie;
liczba kolumn nie jest tu zmienną rozstrzygającą.

### Success Criteria

#### Automated Verification

- `pnpm test:parity`
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`

---

## Testing Strategy

### Unit (node)

- Wycena: trzy źródła × dwie płaszczyzny; mnożnik przy `clientPrice = 0`; mnożnik `0`
  (stawka zero złotych, **nie** „auto"); mnożnik ujemny (odmowa przez sufit).
- Pierwszeństwo: wiersz z **obiema** kolumnami nie-null (stan, którego normalizacja nie dopuszcza,
  ale który surowy SQL potrafi stworzyć) wycenia się po mnożniku i nie rzuca.
- Normalizacja łatki: każde z sześciu przejść między źródłami zapisuje obie kolumny jednym
  wywołaniem; łatka na jednej płaszczyźnie nie rusza drugiej.
- Sufit: mnożnik ponad sufitem czerwienieje; „auto" ponad sufitem dalej milczy.
- Rejestr: trzy filtry źródła są rozłączne i pokrywają każdy wiersz; diagnostyka łapie `auto`
  i `coeff`, przepuszcza `amount`.
- Katalog: mnożnik jedzie do cennika i z powrotem; rozjazd rodzaju przy zgodnej kwocie;
  „auto" po obu stronach dalej milczy.
- Snapshot: stary payload bez kolumn mnożnika wczytuje się jako „auto" (`?? null`, nigdy `?? 0`).

### Component (dom)

- Przełączenie źródła na „własny mnożnik" nie rusza liczby w „Cena j.m.".
- „Cena j.m." przy mnożniku jest nieedytowalna; próba wpisu nic nie zmienia.
- Kolumna „Mnożnik" jest pusta i nieedytowalna przy „auto" i przy kwocie stałej.
- Formularz katalogu: trzy stany, pole kwoty i pole mnożnika montują się rozłącznie, a błąd
  z odmontowanego pola nie blokuje zapisu.

### Integration (db)

- `kosztorys-subcontractor-due` liczy pozycję z mnożnikiem tak samo jak `subcontractorPrice`
  w TS — dwie niezależne kopie reguły.
- Zbiorcze `applyCatalogueValues` przepisuje mnożnik i zeruje kwotę w jednym przebiegu.

### E2E

Nie w tej zmianie. Ryzyko domyka warstwa dom (przełącznik, komórka tylko do odczytu) plus warstwa db
(dwie kopie reguły ceny). Należność zapisujemy jako issue z etykietą `e2e-backlog` na bramce
przeglądu — kandydat: przełączenie źródła przeżywa przeładowanie strony.

### Manual

Zebrane raz, na końcu, do rejestru `context/foundation/manual-checks.md`.

## Migration & Rollout

Migracja jest **addytywna** — nowy kod czyta kolumny, których stary kod nie zna. Kierunek jest więc
jednoznaczny: **produkcja dostaje migrację przed wdrożeniem kodu**, uruchamia ją **człowiek** przez
`pnpm db:migrate:prod`, nigdy agent. Do tego czasu implementacja i migracja to jedno ciągłe zadanie
lokalne — nie wstrzymujemy faz „do czasu produkcji", bo nic jeszcze nie jest pushowane.

Rollback: `down` kasuje cztery kolumny. Traci tylko mnożniki wpisane po wdrożeniu; kwoty stałe
i „auto" są nietknięte, bo mieszkają w kolumnach, których ta zmiana nie rusza.

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:parity`
- `pnpm build`

## References

- Linear: **EX-865**
- Powód kasacji trzeciego źródła: `context/foundation/lessons.md` (EX-766) +
  `src/migrations/20260902_0_collapse_kosztorys_tool_overrides.ts`
- Pierwotna decyzja o dwóch opcjach: `context/archive/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/change.md`
- Historia stawek „auto" w katalogu: `context/archive/2026-08-31-katalog-prac-auto-rates/change.md`
- Ścieżka zapisu per pole: `src/lib/kosztorys/grid-change-plan.ts:40`,
  `src/components/kosztorys/editor/use-kosztorys-editor.ts:1169-1179`
- Cicha degradacja odcisku parity: `context/foundation/lessons.md`
- Sąsiadujące issue: `EX-864` (zaokrąglanie stawki „auto")

## Open Risks & Assumptions

- **Niezmiennik pary nie jest pilnowany przez typy.** Surowy SQL i `/admin` mogą ustawić obie kolumny
  naraz. Wycena jest na to odporna (pierwszeństwo mnożnika), ale nikt tego nie zgłosi jako błędu —
  świadomy koszt kształtu dwukolumnowego, wybranego zamiast tagowanej wartości, żeby trzy czytniki
  SQL zostały arytmetyką.
- **Regeneracja fixture'a parity jest ręcznym krokiem na obu końcach zmiany.** Pominięcie fazy 0
  sprawia, że faza 6 nie da się zinterpretować.
- **EX-864 nie jest naprawiane w tej zmianie**, a pozycja z mnożnikiem odziedziczy jego zachowanie.
  Jeśli faza 1 pokaże, że zaokrąglenie psuje mnożnik bardziej niż „auto" — wracamy z tym do
  właściciela, nie naprawiamy po cichu.
- **Import z arkusza dalej spłaszcza formuły do kwot** (decyzja właściciela). Prace, które w arkuszu
  są formułą o innym stosunku, trzeba przestawić na mnożnik ręcznie.
- `buildCatalogueSeed` zostaje martwym modułem — kandydat do osobnego findingu, nie do tej zmiany.

## Success Criteria

- Pozycja ustawiona na „własny mnożnik" przesuwa stawkę wykonawcy razem ze zmianą „Cena j.m.",
  a kwota stała dalej stoi w miejscu.
- Przełączenie źródła tam i z powrotem nigdy nie zostawia wiersza z martwą liczbą pod spodem —
  ani w bazie, ani po odświeżeniu.
- Praca zapisana do cennika z mnożnikiem wraca do innej inwestycji jako mnożnik.
- Sufit i „Problemy" mówią o pozycji z mnożnikiem to samo co o pozycji z kwotą stałą.
- Mnożnika nie widać nigdzie na powierzchniach klienta ani inwestora.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 0: Baseline golden mastera

#### Automated

- [x] 0.1 `pnpm db:import:test` kończy się bez błędu — 06955a98
- [x] 0.2 `pnpm test:parity` przechodzi na nietkniętym drzewie — 06955a98

### Phase 1: Schemat i arytmetyka

#### Automated

- [x] 1.1 Nowy spec wyceny przechodzi (trzy źródła, dwie płaszczyzny, przypadki brzegowe) — 62e21a93
- [ ] 1.2 `pnpm typecheck` — bramka całego drzewa, sprawdzana raz na koniec przebiegu

### Phase 2: Atomowa ścieżka zapisu

#### Automated

- [x] 2.1 Spec normalizacji łatki przechodzi (sześć przejść, rozdział płaszczyzn) — a5f3198b
- [x] 2.2 Spec rozliczenia na bazie przechodzi — a5f3198b
- [x] 2.3 Roundtrip snapshotu przechodzi — a5f3198b

### Phase 3: Ekran — kolumna „Mnożnik" i trzecie źródło

#### Automated

- [x] 3.1 Specy komórek przechodzą
- [x] 3.2 Spec sortowania przechodzi
- [ ] 3.3 `pnpm typecheck` — bramka całego drzewa, sprawdzana raz na koniec przebiegu

### Phase 4: Sufit, filtry, diagnostyka

#### Automated

- [ ] 4.1 Spec rejestru warunków wiersza przechodzi
- [ ] 4.2 Spec sufitu przechodzi

### Phase 5: Katalog prac

#### Automated

- [ ] 5.1 Specy logiki katalogu przechodzą
- [ ] 5.2 Specy akcji katalogu przechodzą
- [ ] 5.3 Specy formularza i tabeli różnic przechodzą

### Phase 6: Domknięcie

#### Automated

- [ ] 6.1 `pnpm test:parity` przechodzi na zregenerowanym fixture
- [ ] 6.2 Bramka całego drzewa przechodzi
