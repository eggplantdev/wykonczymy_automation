# EX-765 — rozbicie `row-conditions.ts` na rejestr i warstwę zapytań

## Overview

`src/lib/kosztorys/row-conditions.ts` (625 linii) trzyma naraz cztery rodzaje: kontrakt typów,
22-wpisowy rejestr `ROW_CONDITIONS` z prywatnymi predykatami, oraz 11 eksportowanych mechanizmów
czytających ten rejestr. Rozdzielamy je na trzy pliki w podkatalogu `row-conditions/`, **bez zmiany
zachowania**. Wszystko zostaje w `src/lib/kosztorys/`.

## Current State Analysis

Pełna analiza: `research.md`. Trzy fakty, na których stoi ten plan:

- **Zbiory zależności obu połówek są rozłączne.** Komplet sześciu domenowych importów
  (`row-conditions.ts:1-6`) obsługuje wyłącznie rejestr; warstwa zapytań nie importuje z
  `lib/kosztorys` niczego poza typem. Zależność jest jednokierunkowa (rejestr → zapytania), cykl
  niemożliwy.
- **Rośnie tylko rejestr.** 21 commitów od 2026-08-14; żaden po `650aecd2` (08-17) nie dodaje
  mechanizmu. Trzy skoki rejestru (`b2a2aba7` +111, `acf21753` +93, `c09a275d`+`650aecd2` +108) to
  ~50% pliku.
- **Siatka bezpieczeństwa istnieje**: `src/__tests__/lib/kosztorys/row-conditions.test.ts` — 666
  linii, 66 testów, 123 asercje, plus 5 speców zależnych.

Konsumenci: **13 plików**, wszystkie przez alias `@/`, wszystkie importy nazwane (brak `import *`,
brak importów relatywnych, dynamicznych i re-eksportów).

## Desired End State

```
src/lib/kosztorys/row-conditions/types.ts      ~60   RowConditionCtxT, RowConditionKindT, RowConditionT
src/lib/kosztorys/row-conditions/registry.ts   ~395  ROW_CONDITIONS + 5 prywatnych helperów + 2 stałe id
                                                     + clientConditionIds z dwoma mrożonymi zbiorami
src/lib/kosztorys/row-conditions/queries.ts    ~180  BY_ID, isHider, liftsToSections + 9 funkcji
```

`src/lib/kosztorys/row-conditions.ts` **nie istnieje** — konsumenci importują głęboko, tak jak
robią to konsumenci `sheet-import/` i `work-catalogue/`. Spec rozdzielony na dwa pliki lustrzane pod
`src/__tests__/lib/kosztorys/row-conditions/`, ze wspólnymi fiksturami obok. Liczba asercji bez
zmian, zachowanie bez zmian.

### Key Discoveries:

- `row-conditions.ts:91-94` — `DISCOUNT_CONDITION_IDS` jest „kept beside the entries … so adding a
  third rabat condition cannot leave the two lists disagreeing"; `:87-89` to samo dla
  `MEASURE_DIVERGED_CONDITION_ID`. **Obie stałe idą do rejestru**, mimo że czyta je grid.
- `row-conditions.ts:441-448` — `clientConditionIds` mieszka przy rejestrze, bo to fakt domenowy
  „które warunki mogą dotrzeć do klienta", a **raz już zniknął po cichu przy refaktorze hooka**
  (commit `6a7c8f17`: split EX-521 skasował mapowanie, 2336 testów zostało zielonych). Idzie do
  rejestru, razem ze swoimi dwoma mrożonymi zbiorami.
- `row-conditions.ts:130-136` + `active-filters-model.ts:64` — **kolejność tablicy JEST kolejnością
  wyświetlania**. Rejestr zostaje jedną tablicą; nie dzielimy go po `kind`.
- `row-conditions.test.ts:60` — helper `matches()`, używany przez 40 z 66 testów, dobija się do
  predykatów rejestru **przez** `countMatching` (funkcję zapytań). Spec rejestru będzie importował
  zapytania — to zależność testowa, nie produkcyjna.
- `row-conditions.test.ts:536` — pilnuje **referencyjnej stabilności** zbiorów z `clientConditionIds`
  (memo edytora). To jedyne realne ryzyko semantyczne przenosin i jest już zabramkowane.
- `row-conditions.ts:593-608` — **dwa spiętrzone docblocki; pierwszy opisuje
  `sectionIdsWhereAllMatch`, nie `liftsToSections`**. Usterka do naprawienia przy przenosinach.
- Brak w `src/` precedensu `X.ts` obok `X/`; `sheet-import/` i `work-catalogue/` nie mają `index.ts`.
  `lib/kosztorys/` to 78 płaskich plików i zero barreli.

## What We're NOT Doing

- **Żadnej fasady `row-conditions.ts`.** Opis EX-765 ją proponuje jako środek na to, żeby call-site'y
  nie ruszyły się w tym kroku. Kosztem jest 13 mechanicznych linii importu w pełni bramkowanych przez
  `tsc`; zyskiem byłby wzorzec bez precedensu w repo, fałszywe „unused export" w knipie i drugi krok
  „zdejmij fasadę". Nie warto — powtarzalny kształt naprawy cohesion w tym repo (4/4 findingi EX-515)
  to rodzeństwo plików bez barrela.
- **Żadnej fabryki generującej id warunków.**
  `context/archive/2026-08-17-filtry-problemy/review-gate.md:61` odrzuca to wprost („the ids are the
  one thing in this feature that is grepped from four places"), a mapa zaangażowanych id leży
  w localStorage **bez wersjonowania** — zmiana id po cichu przeinterpretowuje zapisany klucz.
- **Żadnych zmian sygnatur ani zachowania.** W szczególności `countMatching` zostaje jak jest —
  przekształca ją niezgłoszony finding perf (niżej), który jest osobną zmianą.
- **Nie ruszamy `stage-conditions.ts`** (62 linie, ta sama zrośnięta forma) ani `problem-conditions.ts`
  poza linią importu.
- **Nie naprawiamy perfu.** `context/archive/2026-08-17-filtry-problemy/review-gate.md:22-28` opisuje,
  że liczniki robią jeden pełny przebieg **na warunek** przy każdym naciśnięciu klawisza (1000+
  pozycji). Naprawa odwraca pętlę i przekształca `countMatching` wraz ze specem — czyli dotyka
  dokładnie `queries.ts`. Ten split ma iść **pierwszy**, żeby tamta zmiana dostała mały plik; równolegle
  będą konfliktować.

## Implementation Approach

Dwie fazy, każda zostawia drzewo zielone.

**Faza 1** przenosi kod i przepina wszystkie importy — musi być atomowa, bo skasowanie
`row-conditions.ts` psuje 13 plików naraz. Spece zostają w miejscu, dostają tylko nowe ścieżki
importu; dzięki temu 123 asercje sprawdzają przeniesiony kod **zanim** ktokolwiek ruszy spec.

**Faza 2** przenosi i rozcina spec pod regułę lustrzaną z AGENTS.md. Rozdzielenie idzie po tej samej
linii co kod, bo bloki `describe` dzielą się czysto: `:63`, `:304`, `:327` opisują zachowanie
rejestru, `:410`+ to bloki per-eksport zapytań.

Kolejność jest istotna: gdyby spec szedł pierwszy, przenosiny kodu odbywałyby się bez zielonej siatki.

## Critical Implementation Details

**Kolejność w fazie 1 jest jednym krokiem, nie trzema.** `row-conditions.ts` znika w tym samym
commicie, w którym powstają trzy nowe pliki i przepięte zostaje 13 importów — stan pośredni nie
przechodzi `tsc`. Nie da się tego rozbić na „najpierw dodaj, potem przepnij".

**Pięć eksportów nie ma pokrycia specem po nazwie**: `listLabels`, `engagedHiders`,
`liftsToSections`, `MEASURE_DIVERGED_CONDITION_ID`, `DISCOUNT_CONDITION_IDS`. Zgubienie któregoś
w przenosinach wybuchnie dopiero na `pnpm typecheck`, nie w vitest — dlatego typecheck jest w bramce,
a nie dopiero w review.

## Phase 1: Przeniesienie kodu i przepięcie importów

### Overview

Trzy nowe pliki, skasowany stary, 13 przepiętych plików konsumentów. Zero zmian w treści funkcji,
predykatów i komentarzy — poza jedną naprawą docblocka.

### Changes Required:

#### 1. Kontrakt typów

**File**: `src/lib/kosztorys/row-conditions/types.ts` (nowy)

**Intent**: Wydzielić kontrakt, który dziś czyta się raz i przewija — 37 linii samego
`RowConditionT` to dokumentacja całego mechanizmu (co znaczą `kind`, `tone`, `revealsColumns`,
`sectionLabel`, `problemLabel`). `RowConditionCtxT` jest dodatkowo kontraktem **hosta**:
`use-kosztorys-editor.ts:407,513` składa ten obiekt.

**Contract**: Eksportuje `RowConditionCtxT`, `RowConditionKindT`, `RowConditionT` — dosłowne
przeniesienie `row-conditions.ts:9-65` wraz z komentarzami. Importuje typy z `@/lib/kosztorys/types`.
Precedens w folderze: `work-catalogue/types.ts`.

#### 2. Rejestr

**File**: `src/lib/kosztorys/row-conditions/registry.ts` (nowy)

**Intent**: Dane i wszystko, co je wytwarza — rosnąca połowa modułu.

**Contract**: Przejmuje **komplet sześciu domenowych importów** z `row-conditions.ts:1-6`. Eksportuje
`ROW_CONDITIONS` (`:137-431`, jedna tablica, kolejność bez zmian), `MEASURE_DIVERGED_CONDITION_ID`,
`DISCOUNT_CONDITION_IDS` (`:87-94`) oraz `clientConditionIds` (`:441-452`). Prywatne, nieeksportowane:
`hasItemDiscount`, `priceColumnsFor`, `ALL_PRICE_COLUMNS`, `settledAtPercentRate`,
`percentRateProblemLabel`, `CLIENT_EMPTY_CONDITION_IDS`, `NO_CONDITION_IDS` — każdy z nich jest dziś
wołany wyłącznie spomiędzy linii 137–452.

**Krytyczne**: dwa mrożone zbiory muszą zostać modułowymi `const`-ami przeniesionymi razem
z `clientConditionIds`; odtworzenie ich per wywołanie łamie referencyjną stabilność, której pilnuje
`row-conditions.test.ts:536`.

#### 3. Warstwa zapytań

**File**: `src/lib/kosztorys/row-conditions/queries.ts` (nowy)

**Intent**: Mechanizmy czytające rejestr. Nazwa idzie za tym, jak nazwała je bramka review, która
finding zgłosiła („the file is both the registry (the data) and **its query layer**" —
`context/archive/2026-08-18-kosztorys-filters-visible-and-extended/review-gate.md:33`), a nie za
roboczym „engine" z opisu issue.

**Contract**: Importuje `ROW_CONDITIONS` z `./registry` i typy z `./types` — **i nic więcej
z `lib/kosztorys`**. Prywatne: `BY_ID` (`:433`, indeks pochodny, rejestr go nie używa), `isHider`
(`:472`). Eksportuje: `applyRowConditions`, `listLabels`, `engagedConditionsOfKind`,
`columnsRevealedBy`, `engagedPlane`, `engagedHiders`, `isFoldSuppressed`, `countMatching`,
`liftsToSections`, `sectionIdsWhereAllMatch`.

`liftsToSections` ląduje tutaj, nie w typach: to **polityka** („tylko filtr z etykietą się podnosi"),
ta sama kategoria co `isHider`, i para predykatów polityki czyta się razem.

**Przy okazji**: naprawić spiętrzone docblocki z `:593-608` — pierwszy z nich opisuje
`sectionIdsWhereAllMatch`, więc ma stanąć nad nią, a nie nad `liftsToSections`.

#### 4. Kasacja starego modułu

**File**: `src/lib/kosztorys/row-conditions.ts` (usunięty)

**Intent**: Bez fasady — patrz „What We're NOT Doing".

**Contract**: Po kasacji `rg "kosztorys/row-conditions'" src/` nie może dać ani jednego trafienia
(zostają wyłącznie ścieżki `/registry`, `/queries`, `/types`).

#### 5. Przepięcie konsumentów produkcyjnych (7 plików)

**Files**:

| Plik                                                                            | Z rejestru                                        | Z zapytań                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/components/kosztorys/editor/use-kosztorys-editor.ts:60-68`                 | `ROW_CONDITIONS`, `MEASURE_DIVERGED_CONDITION_ID` | `applyRowConditions`, `columnsRevealedBy`, `countMatching`, `liftsToSections`, `sectionIdsWhereAllMatch` |
| `src/components/kosztorys/editor/kosztorys-editor-body.tsx:33`                  | —                                                 | `engagedConditionsOfKind`, `engagedHiders`, `listLabels`                                                 |
| `src/components/kosztorys/editor/hooks/use-kosztorys-view-state.ts:8`           | `clientConditionIds`                              | `engagedPlane`, `isFoldSuppressed`                                                                       |
| `src/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu.tsx:7-11` | `ROW_CONDITIONS`, `DISCOUNT_CONDITION_IDS`        | `liftsToSections`                                                                                        |
| `src/components/kosztorys/editor/toolbar/active-filters-model.ts:2`             | `ROW_CONDITIONS`                                  | —                                                                                                        |
| `src/lib/kosztorys/row-view.ts:3`                                               | —                                                 | `applyRowConditions`                                                                                     |
| `src/lib/kosztorys/problem-conditions.ts:1`                                     | `ROW_CONDITIONS`                                  | —                                                                                                        |

**Intent**: Wyłącznie linie importu. Żadne ciało funkcji ani JSX się nie zmienia.

**Contract**: Strzałka `editor/grid` → `lib` zostaje nienaruszona (AGENTS.md:276);
`MEASURE_DIVERGED_CONDITION_ID` nadal jedzie z `lib` do gridu, nie odwrotnie.

#### 6. Przepięcie speców (6 plików, bez ruszania treści testów)

**Files**: `src/__tests__/lib/kosztorys/row-conditions.test.ts:2-15` (oba źródła),
`client-document-subtotals.test.ts:2` (`applyRowConditions` z zapytań + `clientConditionIds`
z rejestru), `kosztorys-empty-sections.test.ts:2` (zapytania), `measure-discrepancy.test.ts:2`
(zapytania), `stage-conditions.test.ts:2` (rejestr),
`src/__tests__/components/kosztorys/editor/toolbar/active-filters-model.test.ts:4` (rejestr).

**Intent**: Tylko ścieżki importu, żeby 123 asercje zweryfikowały przeniesiony kod **przed** tym, jak
faza 2 ruszy sam spec. `row-conditions.test.ts` zostaje na razie w starym miejscu — reguła lustrzana
domyka się w fazie 2.

### Success Criteria:

#### Automated Verification:

- Spec modułu przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions.test.ts`
- Spece zależne przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/client-document-subtotals.test.ts src/__tests__/lib/kosztorys/kosztorys-empty-sections.test.ts src/__tests__/lib/kosztorys/measure-discrepancy.test.ts src/__tests__/lib/kosztorys/stage-conditions.test.ts src/__tests__/components/kosztorys/editor/toolbar/active-filters-model.test.ts`
- Stara ścieżka nie ma konsumentów: `rg -c "kosztorys/row-conditions'" src/` zwraca 0 trafień
- Stary plik nie istnieje: `test ! -f src/lib/kosztorys/row-conditions.ts`
- Zapytania nie ciągną domeny: `rg "^import" src/lib/kosztorys/row-conditions/queries.ts` pokazuje
  wyłącznie `./registry` i `./types`

#### Manual Verification:

- Menu „Filtry" listuje te same wiersze co przed zmianą, z sekcjami („Sekcje bez przedmiaru" itd.)
  i z parą rabatową znikającą pod globalnym rabatem
- „Problemy" pokazuje te same liczniki, a kliknięcie diagnostyki nadal odsłania jej kolumny
  i przełącza widok na właściwy plan
- Podgląd klienta z zaznaczonym „ukryj puste wiersze" nadal chudnie dokument (to jest dokładnie ta
  ścieżka, którą poprzedni refaktor zgubił po cichu — commit `6a7c8f17`)
- Zwinięte sekcje nadal stają się nieaktywne przy wyszukiwaniu i przy zaangażowanym filtrze

**Implementation Note**: Po przejściu weryfikacji automatycznej commituj i idź dalej — manualna
zbiera się raz, na końcu zmiany, do rejestru `context/foundation/manual-checks.md`.

---

## Phase 2: Rozcięcie speca pod regułę lustrzaną

### Overview

666-liniowy spec rozchodzi się na dwa pliki lustrzane wobec nowych źródeł, ze wspólnymi fiksturami
w trzecim. Zero nowych asercji, zero skasowanych.

### Changes Required:

#### 1. Wspólne fikstury

**File**: `src/__tests__/lib/kosztorys/row-conditions/fixtures.ts` (nowy)

**Intent**: `STAGES`, `CTX`, `priceCells()`, fabryka `row()` są używane przez oba przyszłe spece;
duplikacja fabryki wierszy to dwie szanse na rozjechanie jej z `KosztorysV2RowT`.

**Contract**: Przenosi `row-conditions.test.ts:17-58` bez zmian. Rozszerzenie `.ts`, nie `.test.ts` —
inaczej vitest potraktuje plik jako spec bez testów, a `scripts/test-integration.sh` zobaczy go w
swoim grepie.

#### 2. Spec rejestru

**File**: `src/__tests__/lib/kosztorys/row-conditions/registry.test.ts` (nowy)

**Intent**: Zachowanie predykatów — granice 22 warunków — plus fakt domenowy `clientConditionIds`.

**Contract**: Przejmuje bloki `:63` („the conditions, each on its boundary", 17 testów), `:304` („the
rate-source pair"), `:327` (strażnik EX-708) i `:524` (`clientConditionIds`, w tym asercja
referencyjnej stabilności z `:536`). Importuje helper `matches()` idący przez `countMatching`
z `../row-conditions/queries` — zależność testowa, świadoma.

#### 3. Spec zapytań

**File**: `src/__tests__/lib/kosztorys/row-conditions/queries.test.ts` (nowy)

**Contract**: Przejmuje bloki per-eksport `:410` (`applyRowConditions`), `:486` (`countMatching`),
`:498` (`sectionIdsWhereAllMatch`), `:544` (`columnsRevealedBy`), `:614` (`engagedPlane`), `:637`
(`isFoldSuppressed`).

#### 4. Kasacja starego speca

**File**: `src/__tests__/lib/kosztorys/row-conditions.test.ts` (usunięty)

**Contract**: Suma testów w dwóch nowych plikach = **66**, suma asercji = **123**. Rozbieżność znaczy,
że coś wypadło po drodze.

### Success Criteria:

#### Automated Verification:

- Oba nowe spece przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/row-conditions/`
- Bilans się zgadza — 66 testów w podsumowaniu vitest dla tego katalogu
- Stary spec nie istnieje: `test ! -f src/__tests__/lib/kosztorys/row-conditions.test.ts`

#### Manual Verification:

Brak — faza dotyka wyłącznie plików testowych.

---

## Testing Strategy

Refaktor zachowujący zachowanie: **nie piszemy nowych testów**. Istniejące 123 asercje są siatką,
a nie przedmiotem zmiany — dlatego faza 1 przepina tylko ich importy i uruchamia je na przeniesionym
kodzie, zanim faza 2 tknie ich treść.

Pięć eksportów bez pokrycia po nazwie (`listLabels`, `engagedHiders`, `liftsToSections`,
`MEASURE_DIVERGED_CONDITION_ID`, `DISCOUNT_CONDITION_IDS`) jest pilnowanych przez `pnpm typecheck`,
nie przez vitest. To wystarcza dla przenosin — każdy z nich ma konsumenta produkcyjnego, który
przestanie się kompilować.

## Performance Considerations

Bez zmian. `BY_ID` zostaje modułowym `const`-em (jedno wyliczenie na import), dwa mrożone zbiory
`clientConditionIds` zostają modułowymi `const`-ami — obie rzeczy karmią memo edytora i utrata
referencyjnej stabilności byłaby regresją renderów.

Znany, **nietykany** hotspot: liczniki warunków robią jeden pełny przebieg na warunek przy każdym
naciśnięciu klawisza. Osobna zmiana, patrz „What We're NOT Doing".

## Whole-tree Gate

- Typy przechodzą: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`
- Pełny pakiet unit przechodzi: `pnpm test`
- Build przechodzi: `pnpm build`

## References

- Research: `context/changes/2026-09-02-row-conditions-registry-engine-split/research.md`
- Zgłoszenie: `context/archive/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/review-gate.md:32`
- Precedens kształtu naprawy (EX-515, 4/4 findingi):
  `context/archive/2026-07-11-kosztorys-editor-ux/review-gate-staging-merge.md:62-72`
- Incydent, przed którym broni `clientConditionIds`: commit `6a7c8f17`
- Odrzucenie fabryki id: `context/archive/2026-08-17-filtry-problemy/review-gate.md:61`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Przeniesienie kodu i przepięcie importów

#### Automated

- [x] 1.1 Spec modułu przechodzi — e00ba41a
- [x] 1.2 Pięć speców zależnych przechodzi — e00ba41a
- [x] 1.3 Stara ścieżka importu ma zero konsumentów — e00ba41a
- [x] 1.4 `src/lib/kosztorys/row-conditions.ts` nie istnieje — e00ba41a
- [x] 1.5 `queries.ts` importuje wyłącznie `./registry` i `./types` — e00ba41a

### Phase 2: Rozcięcie speca pod regułę lustrzaną

#### Automated

- [x] 2.1 Oba nowe spece przechodzą — 16b84b99
- [x] 2.2 Bilans 66 testów się zgadza — 16b84b99
- [x] 2.3 Stary spec nie istnieje — 16b84b99
