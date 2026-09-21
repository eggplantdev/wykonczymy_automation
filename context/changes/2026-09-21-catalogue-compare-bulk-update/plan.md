# Hurtowa aktualizacja rozpiski z katalogu prac — Implementation Plan

## Overview

Okno „Porównaj z katalogiem prac" umie dziś pisać tylko **w jedną stronę** — do cennika („Dodaj do
katalogu", „Edytuj w katalogu"). Ta zmiana dokłada kierunek odwrotny: zaznaczanie różnic i jedno
kliknięcie, które przenosi liczby **z katalogu do rozpiski**. Po drodze naprawia próg porównania
(dwie identyczne kwoty z niezerową różnicą) i domyka drugi kierunek dla prac, których w katalogu nie
ma pod tą nazwą — akceptację podpowiedzi „może chodzi o".

## Current State Analysis

- `buildCatalogueComparison` (`src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:94`)
  klasyfikuje każdą pozycję na `matching` / `diffs` / `missing`. Ta sama funkcja karmi liczniki
  „Problemy" w pasku narzędzi i całe okno raportu — nie mogą się rozjechać, bo to jedno memo
  (`use-kosztorys-editor.ts:381-388`, zależności `[preview, rows, workCatalogue]`).
- Porównanie kwot idzie przez `Math.abs(delta) > MONEY_TOLERANCE`
  (`build-catalogue-comparison.ts:59-60`). `MONEY_TOLERANCE = 0.005` (`calc.ts:15`) jest **równe**
  połowie grosza, a porównanie jest ostre, więc różnica dokładnie pół grosza przechodzi przez sito na
  resztce zmiennoprzecinkowej: rozpiska `14.875` ↔ katalog `14.88` daje `-0.0050000000000007816` i
  raport pokazuje „14,88 zł / 14,88 zł / −0,01 zł".
- Stawka może być **„auto"** — `null` na danej płaszczyźnie znaczy „nie podaję kwoty, licz z
  globalnego współczynnika inwestycji" (`work-catalogue/types.ts:3-8`, `ItemPatchT` w
  `kosztorys/types.ts:45-51`). `0` to zamrożona kwota i nigdy nie wolno go zlać z `null` (EX-766).
  Dziś `catalogueRate` (`build-catalogue-comparison.ts:31-32`) zamienia katalogowe „auto" na kwotę i
  raport pokazuje tę kwotę — właściciel widzi liczbę, której w katalogu nie ma.
- `auto ↔ auto` jest **celowo** milczące (`rateFigure:77`) i takie zostaje: obie strony to
  `cena × ten sam współczynnik`, więc raportowanie tego robi z jednego rozjazdu trzy.
- Okno (`catalogue-compare-dialog.tsx`) renderuje trzy bloki na wspólnych komponentach z
  `sheet-report-parts.tsx`, których używają **cztery** okna (trzy arkuszowe + to). Wiersze różnic to
  `diffs.flatMap(...)` — płaska lista, bez grupowania, bez wcięcia; przycisk akcji tylko przy
  pierwszej liczbie pracy.
- Podpowiedź „może chodzi o" to **jeden** najbliższy opis (`closestDescription:44-52`), wyłącznie do
  czytania (`CatalogueMissingT.hint`, `types.ts:85-88`). Funkcja i tak przelicza wynik dla każdego
  wpisu katalogu i nigdy nie zwiera obwodu, więc top-3 nie kosztuje nic więcej.
- Rozpiska nie ma kolumny z kluczem — klucz liczy się zawsze świeżo przez `catalogueKey`. Kolumna
  `match_key` jest **wyłącznie** po stronie katalogu (UNIQUE index), więc przeniesienie świeżej
  strony na istniejący klucz to kierunek, który ta asymetria znosi bez backfillu.

### Skala zmierzona prawdziwą funkcją porównania (lokalna baza, 14 kosztorysów / 4464 pozycje / 568 wpisów katalogu)

```
różnic (wierszy raportu) łącznie:            3794
  znika po zaokrągleniu do groszy:             13  (0,3 %)
  Cena j.m.:                                 1460
  stawka: kwota ↔ kwota:                     1684
  stawka: kwota ↔ katalog „auto":              160
  stawka: rozpiska „auto" ↔ kwota:             490

pozycji „brak w katalogu":                   1220
  z podpowiedzią (score ≥ 0,55):             1130  (93 %)
  niejednoznacznych (druga w promieniu 0,05): 283  (25 % podpowiedzi)
  opis identyczny po foldzie, różni się TYLKO j.m.: 168
```

Inwestycja 151 (ta ze zrzutu): 63 prace / 138 różnic, 97 zgodnych, 42 brakujących; 1 wiersz znika po
zaokrągleniu, 6 „zamrożona ↔ katalog auto", 9 „rozpiska auto ↔ kwota". Metodyka w `research.md`.

## Desired End State

Właściciel otwiera „Porównaj z katalogiem prac", widzi pogrupowane po pracy różnice z wcięciem,
zaznacza pojedyncze liczby albo całe prace (albo wszystko), klika **„Aktualizuj kosztorys (N)"** i
zaznaczone liczby wjeżdżają do rozpiski. Okno zostaje otwarte, zaktualizowane wiersze znikają z
raportu, licznik „Pokaż N różnic" maleje na oczach. Przed zapisem powstaje automatyczna wersja, więc
całość da się cofnąć przez „Wersje".

Kolumny „Kosztorys" i „Katalog" pokazują słowo **„auto"** tam, gdzie kwoty nie ma, a nie wyliczoną
złotówkę. Rozjazdem jest też sama **różnica rodzaju** — zamrożona kwota po jednej stronie, „auto" po
drugiej, w obie strony. Aktualizacja takiego wiersza **kasuje nadpisanie**, więc praca zaczyna się
liczyć z globalnego współczynnika inwestycji. Kolumna „Różnica" zostaje kwotowa, ale wyszarzona.

W bloku „Brak w katalogu" każda praca dostaje do trzech kandydatów z ceną i j.m. plus wyjście
„inny…" do wyszukiwarki po całym katalogu. Kliknięcie kandydata od razu przepisuje pracy **opis i
j.m.**, praca znika z „Brak w katalogu" i pojawia się w „Inne liczby", gdzie osobno bierze się jej
ceny.

**Weryfikacja:** raport na inwestycji 151 nie pokazuje już wiersza „14,88 / 14,88 / −0,01"; zaznaczenie
wszystkiego i zapis zostawia blok „Inne liczby" pusty; „Wersje" zawiera wpis z chwili tuż przed
zapisem.

### Key Discoveries

- **Wzorzec naprawy pół-grosza jest w repo i jest opisany:** `src/lib/kosztorys/reconciliation.ts:36-40`
  porównuje `roundToCents(expected) !== roundToCents(actual)` z komentarzem, który wprost mówi, czemu
  nie epsilon. Ten sam chwyt w `src/components/tables/investments.tsx:205-210` i
  `settlement-groups.ts:54,68`.
- **`formatPLNOrAuto` już istnieje** (`src/lib/utils/format-currency.ts:14-16`), a
  `src/components/tables/work-catalogue.tsx:15-20` jest wzorcem renderu: „auto" jako
  `text-muted-foreground text-sm`, kwota jako `tabular-nums`.
- **`patchRows` nie wychodzi na zewnątrz hooka** (`use-kosztorys-editor.ts:1084-1092`) — jest podawany
  wyłącznie jako prop do pod-hooków (`:224`, `:343`). Wzorzec domu to **nazwany handler**:
  `handleApplyPercentDiscount` (`hooks/use-kosztorys-settings.ts:271-293`, re-eksport `:1246`), który
  łata optymistycznie, zapisuje przez `optimisticSettingSave` i cofa łatę na błędzie.
- **Wzorzec hurtowego zapisu z migawką:** `cleanItemTextsAction` (`lib/actions/kosztorys.ts:268-291`) —
  `investmentAction({ investmentId })`, odczyt, wyliczenie zmienionych, `captureAutoSnapshot(db,
investmentId, user.id)`, jedno `UPDATE`, zwrot liczby.
- **Szablon SQL na paczkę:** `src/lib/db/kosztorys-sheet-measured-qty.ts:14-34` —
  `UPDATE … FROM (VALUES …) AS v(...)` z **jawnymi rzutowaniami**, bo „a literal `NULL` has no type,
  so a batch whose first row clears the figure would leave Postgres unable to infer the column". Tu
  `NULL` to dokładnie nasz przypadek „wyczyść nadpisanie".
- **Reguła bezpieczeństwa z sąsiedniej akcji:** `insertCatalogueItemsAction`
  (`lib/actions/work-catalogue.ts:160-161`) — „The client sends ONLY ids: every number that lands in
  the rozpiska is re-read from the cennik server-side".
- **Sufit 65 % liczy się bez nowego helpera:** `isOverCeiling(price, { clientPrice })`
  (`subcontractor-price-guard.ts:35-42`) bierze `Pick<ViewPricingT, 'clientPrice'>`, więc wystarczy
  kwota stawki i cena j.m. po scaleniu zaznaczenia.
- **`SeedConflictFieldT`** (`work-catalogue/types.ts:33`) to już istniejąca maszynowa trójka
  `'clientPrice' | 'wToolsRate' | 'ownToolsRate'` — typ na drut, zamiast polskich etykiet z raportu.
- **`updateItemFieldAction(itemId, patch)`** (`lib/actions/kosztorys.ts:116-131`) przyjmuje `description`
  i `unit` w jednym `ItemPatchT`, więc akceptacja podpowiedzi nie potrzebuje własnej akcji.

## What We're NOT Doing

- **Nie ruszamy wspólnych komponentów** `sheet-report-parts.tsx` — trzy okna arkusza zostają bez
  zmian. Tabela różnic katalogu dostaje własny komponent.
- **Nie dotykamy `investments.updated_at`.** To token wejściowy zatrzasku remountu edytora
  (`kosztorys-editor-v2.tsx:29-30`); podbicie go zremountowałoby ciało edytora i skasowało sortowanie
  i filtry, które właściciel przed chwilą ustawił.
- **Nie zawijamy migawki i `UPDATE` w transakcję.** `captureAutoSnapshot` → `serializeKosztorys` →
  `getKosztorysTree` idzie przez cache'owaną warstwę odczytu z własnym połączeniem i nie jest
  transakcyjnie spójny (`lessons.md:1211-1222`) — transakcja byłaby fałszywym komfortem. Pojedynczy
  `UPDATE … FROM (VALUES …)` jest atomowy sam z siebie.
- **Nie robimy okna potwierdzenia** przed zapisem — licznik na przycisku plus automatyczna wersja.
- **Nie wyciszamy `auto ↔ auto`** i nie zmieniamy tego, że to milczy.
- **Nie backfillujemy `match_key`** po stronie rozpiski — rozpiska klucza nie przechowuje.
- **Nie ruszamy synchronizacji z arkuszem.** Zmiana opisu pracy (faza 5) rozłączy pozycję z jej
  bliźniakiem w arkuszu przy następnym „Porównaj z arkuszem" (`itemKey` nie obejmuje j.m., więc sama
  zmiana j.m. jest tam niewidoczna). To skutek uboczny wart powiedzenia właścicielowi, nie zadanie do
  naprawienia tutaj.

## Implementation Approach

Pięć faz w kolejności wartości: 1 i 2 same z siebie naprawiają raport (można je wypuścić bez reszty),
3–4 dają hurt, 5 domyka drugi kierunek dla prac spoza katalogu.

Model porównania zmienia się **przed** UI (faza 2), bo to jego kształt renderuje faza 4. Zapis
powstaje przed tabelą zaznaczania (faza 3), żeby tabela od razu miała co wywołać.

Kluczowa decyzja architektoniczna: **drut niesie wyłącznie `{ itemId, fields }`**, a każda liczba jest
doczytywana serwerowo. To nie tylko reguła bezpieczeństwa z `insertCatalogueItemsAction` — to także
poprawność. Dopasowanie jest ważne tylko dopóki opis i j.m. się zgadzają, więc serwer **odtwarza
klucz** zamiast ufać przysłanemu id wpisu katalogu. Nieaktualne okno (opis zmieniony w drugiej
karcie) kończy się wtedy komunikatem „ta praca nie jest już w katalogu", a nie ceną z niewłaściwej
pracy.

## Critical Implementation Details

**Kolejność i cykl życia.** Odświeżenie po zapisie **nie może** iść przez `router.refresh()` ani
`onTreeReplaced`: `rows` są zasiewane raz przy montażu (`useState(() => treeToRows(tree))`), więc
refresh niczego nie przesieje, a remount skasuje stan widoku. Jedyna droga to `patchRows`, które
aktualizuje **i** `rows`, **i** `prevById.current` — bez tego drugiego następny autosave wyliczyłby
różnicę względem nieaktualnego „poprzednio" i zapisał kolumnę z powrotem.

**Rosnący licznik.** Po fazie 2 rozjazdem staje się także sama różnica rodzaju, więc zamrożone
300 zł naprzeciw katalogowego „auto", które dla tej inwestycji też wychodzi 300 zł, zacznie się
zgłaszać — dziś milczy. Licznik „Problemy" może więc urosnąć. To jest zamierzone (decyzja
właściciela: rozjazd to różnica rodzaju, nie tylko kwoty), ale warto to powiedzieć przy odbiorze,
żeby nie wyglądało na regresję.

**Sufit 65 % reaguje na zaznaczenie.** Znacznik liczy się z **wiersza scalonego**: cena j.m. to
katalogowa, jeśli „Cena j.m." jest zaznaczona, inaczej obecna z rozpiski; stawka analogicznie. Dlatego
liczy się go w przeglądarce przy każdej zmianie zaznaczenia, a nie serwerowo przy zapisie.

---

## Phase 1: Próg porównania w groszach

### Overview

Raport ma porównywać dokładnie to, co wyświetla. Dziś porównuje surowe liczby zmiennoprzecinkowe
progiem równym połowie grosza, więc różnica dokładnie pół grosza przechodzi albo nie przechodzi
zależnie od resztki bitowej.

### Changes Required

#### 1. Silnik porównania

**File**: `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts`

**Intent**: `figure()` orzeka o rozjeździe na wartościach zaokrąglonych do groszy zamiast na
tolerancji zmiennoprzecinkowej — tak jak `reconciliation.ts:36-40`. `delta` zostaje surowa, bo
renderuje ją `formatPLN`, który i tak zaokrągla.

**Contract**: `figure(label, kosztorys, catalogue)` zwraca `CatalogueFigureDiffT | null`; warunek
zmienia się z `Math.abs(kosztorys - catalogue) > MONEY_TOLERANCE` na
`roundToCents(kosztorys) !== roundToCents(catalogue)`. Import `MONEY_TOLERANCE` znika, jeśli nic
innego w pliku go nie używa. Docblock `buildCatalogueComparison` (`:90-92`) tłumaczy dziś tolerancję —
trzeba go przepisać na nową regułę, bo inaczej opisuje kod, którego już nie ma.

#### 2. Spec

**File**: `src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`

**Intent**: Przypiąć regresję na dokładnie tym wierszu ze zrzutu i na sąsiedzie o grosz dalej, żeby
naprawa nie okazała się wyłączeniem porównania.

**Contract**: dwa przypadki na `Cena j.m.` — `14.875` ↔ `14.88` **nie jest** różnicą; `14.87` ↔
`14.88` **jest**. (Plik może już istnieć — wtedy dopisujemy `describe`.)

### Success Criteria

#### Automated Verification

- Specs silnika porównania przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`

#### Manual Verification

- Na inwestycji 151 w „Porównaj z katalogiem prac" nie ma już wiersza „Malowanie sufitu w kolor —
  Stawka bez narzędzi: 14,88 zł / 14,88 zł / −0,01 zł", a licznik różnic spada o jeden.

---

## Phase 2: „auto" jako rodzaj różnicy

### Overview

Katalog ma prawo nie podawać stawki (125 z 568 wpisów). Dziś raport zamienia to w wyliczoną kwotę i
kłamie, że katalog ją zna. Po tej fazie kolumna mówi „auto", a rozjazdem jest także sama różnica
rodzaju — w obie strony.

### Changes Required

#### 1. Model różnicy

**File**: `src/lib/kosztorys/work-catalogue/types.ts`

**Intent**: Różnica musi nieść **rodzaj** obu stron, a nie tylko kwoty, bo render pokazuje słowo
„auto", a kolumna „Różnica" zostaje kwotowa (właściciel zaznacza po 40 prac naraz i musi widzieć,
ile pieniędzy się rusza).

**Contract**: `CatalogueFigureDiffT` zyskuje `kosztorysIsAuto: boolean` i `catalogueIsAuto: boolean`.
`kosztorys` / `catalogue` / `delta` zostają liczbami — dla strony „auto" to kwota **implikowana**
(`cena j.m. × współczynnik`), która jest jedynym sensownym wsadem do różnicy. Booleany zamiast
`number | null` właśnie po to, żeby `delta` nie stała się nullowalna.

#### 2. Silnik porównania

**File**: `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts`

**Intent**: Zgłaszać różnicę, gdy kwoty po zaokrągleniu się różnią **albo** rodzaje się różnią.
`auto ↔ auto` nadal milczy — ten warunek (`:77`) i jego docblock zostają nietknięte.

**Contract**: `figure()` przyjmuje rodzaje obu stron (czwarty argument albo para flag) i zwraca
różnicę, gdy `roundToCents(kosztorys) !== roundToCents(catalogue) || kosztorysIsAuto !== catalogueIsAuto`.
`rateFigure` przekazuje `overrideValueFor(pricing, plane) === null` i `entryRate === null`. `Cena j.m.`
nigdy nie jest „auto" — obie flagi `false`.

#### 3. Render

**File**: `src/components/kosztorys/editor/dialogs/catalogue-compare-dialog.tsx` (tymczasowo — w fazie 4 wiersze przenoszą się do własnej tabeli)

**Intent**: Kolumny „Kosztorys" i „Katalog" pokazują „auto" zamiast kwoty, kolumna „Różnica" zostaje
kwotowa, ale wyszarzona, gdy którakolwiek strona jest „auto".

**Contract**: `formatPLNOrAuto(isAuto ? null : amount)` na obu stronach; klasa `text-muted-foreground`
na komórce różnicy, gdy `kosztorysIsAuto || catalogueIsAuto`. Wzorzec klas:
`src/components/tables/work-catalogue.tsx:15-20`.

#### 4. Specs

**File**: `src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`

**Intent**: Przypiąć cztery kombinacje rodzajów, bo to jest cała reguła tej fazy.

**Contract**: kwota↔kwota (różne) → różnica; kwota↔kwota (równe) → cisza; kwota↔auto **o tej samej
kwocie implikowanej** → różnica z `catalogueIsAuto: true` i `delta` 0; auto↔kwota → różnica z
`kosztorysIsAuto: true`; auto↔auto → cisza.

### Success Criteria

#### Automated Verification

- Specs czterech kombinacji rodzajów przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`

#### Manual Verification

- Na inwestycji 151 wiersze, gdzie katalog nie podaje stawki, pokazują w kolumnie „Katalog" słowo
  „auto", a nie złotówki; ich „Różnica" jest szara.
- Licznik „Problemy" może urosnąć o wiersze „zamrożona ↔ auto o tej samej kwocie" — sprawdzić, że
  rosną o tyle, ile takich wierszy widać w raporcie, i że żaden wiersz nie zniknął.

---

## Phase 3: Zapis po stronie serwera

### Overview

Jedna akcja bierze listę `{ pozycja, które liczby }`, doczytuje kwoty z katalogu po odtworzonym
kluczu, robi automatyczną wersję i zapisuje wszystko trzema `UPDATE`-ami.

### Changes Required

#### 1. Warstwa dostępu do danych

**File**: `src/lib/db/kosztorys-catalogue-apply.ts` (nowy)

**Intent**: Zapisać wybrane liczby paczkowo, bez round-tripu na pozycję — kosztorys potrafi mieć
1000+ pozycji.

**Contract**: trzy osobne `UPDATE kosztorys_items … FROM (VALUES …) AS v(id, value)`, po jednym na
kolumnę (`client_price`, `w_tools_override_value`, `own_tools_override_value`), każdy tylko nad
pozycjami zaznaczonymi dla tej kolumny. Każdy `WHERE kosztorys_items.investment_id = $investmentId`
— zakres inwestycji jest w `WHERE`, nie w zaufaniu do id z drutu. **Jawne rzutowania w VALUES**
(`::int`, `::numeric`), bo wiersze stawek niosą `NULL` (wyczyszczenie nadpisania), a beztypowy `NULL`
w pierwszym wierszu paczki wywraca całe `UPDATE` — wzorzec i uzasadnienie:
`src/lib/db/kosztorys-sheet-measured-qty.ts:14-34`. Statement dla kolumny bez zaznaczeń jest
pomijany, nie wysyłany pusty.

#### 2. Akcja

**File**: `src/lib/actions/work-catalogue.ts`

**Intent**: Jedno wejście dla całego hurtu, z migawką przed zapisem i doczytaniem liczb serwerowo.
Ląduje tu, a nie w `actions/kosztorys.ts`, bo źródłem prawdy jest katalog i tu już mieszka
`insertCatalogueItemsAction` z tą samą regułą „klient przysyła tylko id".

**Contract**:

```ts
applyCatalogueToKosztorysAction(
  investmentId: number,
  selections: { itemId: number; fields: SeedConflictFieldT[] }[],
): Promise<ActionResultT<AppliedCatalogueValueT[]>>
```

gdzie `AppliedCatalogueValueT = { itemId: number } & Partial<Pick<KosztorysItemT,
'clientPrice' | 'wToolsOverrideValue' | 'ownToolsOverrideValue'>>` — dokładnie to, czym klient łata
siatkę. Kroki: `investmentAction('applyCatalogueToKosztorysAction', { investmentId }, …)` → walidacja
zod → odczyt pozycji po id **w zakresie tej inwestycji** → `catalogueKey(description, unit)` na każdej
→ dopasowanie do katalogu → pozycja bez dopasowania kończy się błędem („Część zaznaczonych prac nie
jest już w katalogu."), nie cichym pominięciem → `captureAutoSnapshot(db, investmentId, user.id)` →
trzy `UPDATE` → zwrot zapisanych wartości. Rewalidacja `['kosztorysItems']`. **Bez `deferRefresh`** nie
jest potrzebne, bo klient i tak łata optymistycznie — ale `updated_at` inwestycji zostaje nietknięte.

#### 3. Spec DB

**File**: `src/__tests__/lib/db/kosztorys-catalogue-apply.test.ts`

**Intent**: Paczka mieszająca kwoty i `NULL`-e to dokładnie ten kształt, który wywraca `UPDATE …
FROM (VALUES …)` bez rzutowań — spec ma to trzymać.

**Contract**: paczka, w której pierwszy wiersz czyści nadpisanie (`NULL`), a kolejny ustawia kwotę,
zapisuje się w całości; asercja na **stanie utrwalonym** (ponowny odczyt), nie na zwrotce.

### Success Criteria

#### Automated Verification

- Spec zapisu paczkowego przechodzi: `pnpm exec vitest run src/__tests__/lib/db/kosztorys-catalogue-apply.test.ts`

#### Manual Verification

- Brak — ta faza nie ma powierzchni. Weryfikacja przy fazie 4.

---

## Phase 4: Tabela zaznaczania w oknie

### Overview

Blok „Inne liczby niż w katalogu" przestaje być płaską listą: nagłówek pracy, wcięte pod nim trzy
liczby, checkbox na każdej liczbie i na pracy, „zaznacz wszystkie" u góry, licznik na przycisku
zapisu.

### Changes Required

#### 1. Tabela różnic

**File**: `src/components/kosztorys/editor/dialogs/catalogue-diff-table.tsx` (nowy)

**Intent**: Własna tabela zamiast wspólnego `ComparisonTable`, bo doklejenie kolumny checkboxów
złamałoby regułę wyrównania w `sheet-report-parts.tsx:34-36` (indeks 0 do lewej, reszta
`pl-3 text-right`) w trzech oknach arkusza, które z tą zmianą nie mają nic wspólnego.

**Contract**: props `{ diffs, selection, onToggleFigure, onToggleItem, onToggleAll }`. Wiersz
nagłówkowy pracy niesie checkbox trójstanowy (`Checkbox` z `checked="indeterminate"`), wiersze liczb
są wcięte. Kolumny: checkbox · etykieta liczby · Kosztorys · Katalog · Różnica · znacznik sufitu.
Zaznaczenie trzymane jako `Map<number, Set<SeedConflictFieldT>>` — po `itemId`, nie po indeksie
wiersza, bo lista przesortowuje się po `maxDelta`.

#### 2. Znacznik sufitu 65 %

**File**: `src/components/kosztorys/editor/dialogs/catalogue-diff-table.tsx`

**Intent**: Ostrzec **przed** zapisem, przy wierszu, że po scaleniu zaznaczenia stawka przekroczy
65 % ceny dla inwestora — właściciel zaznacza hurtem i nie obejrzy każdej pracy osobno.

**Contract**: dla płaszczyzny liczy się wiersz scalony — stawka katalogowa, jeśli ta liczba jest
zaznaczona, inaczej obecna z rozpiski; cena j.m. analogicznie — i podaje do
`isOverCeiling(price, { clientPrice })` (`subcontractor-price-guard.ts:35-42`). Znacznik musi się
przeliczać przy każdej zmianie zaznaczenia. Reguła: `MAX_CLIENT_SHARE` mierzy się **przed rabatem**,
więc nic z rabatu tu nie wchodzi.

#### 3. Handler w hooku edytora

**File**: `src/components/kosztorys/editor/use-kosztorys-editor.ts`

**Intent**: Wystawić jedną nazwaną operację zamiast otwierać `patchRows` na zewnątrz — wzorzec
`handleApplyPercentDiscount`.

**Contract**: `handleApplyCatalogueToItems(selections): Promise<boolean>` na powierzchni zwracanej
przez hook. Zapisuje poprzednie wartości dotkniętych pól, łata optymistycznie przez `patchRows`,
woła `applyCatalogueToKosztorysAction` przez `optimisticSettingSave`
(`src/lib/kosztorys/optimistic-setting-save.ts:9-28`) i cofa łatę na błędzie. Ponieważ
`catalogueComparison` to memo z `rows` w zależnościach (`:381-388`), raport i liczniki „Problemy"
przeliczają się w tym samym renderze — stąd znikanie wierszy bez zamykania okna.

#### 4. Okno

**File**: `src/components/kosztorys/editor/dialogs/catalogue-compare-dialog.tsx`

**Intent**: Wpiąć tabelę, zaznaczenie i przycisk; przepisać docblock, którego niezmiennik ta zmiana
odwraca.

**Contract**: blok „Inne liczby" renderuje `CatalogueDiffTable` zamiast `ComparisonTable` +
`flatMap`. „Zaznacz wszystkie" u góry bloku jako checkbox trójstanowy przełączający całość
on/off — **nie** dopisujący jak w `add-items-from-catalogue-dialog.tsx` (tam lista jest filtrowalna,
tu nie). Przycisk „Aktualizuj kosztorys (N)" z liczbą zaznaczonych **liczb**, wyłączony przy zerze i
w `readOnly`, bez okna potwierdzenia. Zaznaczenie czyszczone po udanym zapisie. Docblock `:32-41`
mówi dziś „Nothing here touches the KOSZTORYS … Its writes all go the other way, into the cennik" —
to zdanie przestaje być prawdą i musi opisać oba kierunki oraz to, że hurt zostawia po sobie
automatyczną wersję.

#### 5. Spec dom

**File**: `src/__tests__/components/kosztorys/editor/dialogs/catalogue-diff-table.test.tsx`

**Intent**: Zaznaczanie to ta ryzykowna część, której spec node nie zobaczy: trójstan, propagacja
praca→liczby i licznik na przycisku.

**Contract**: zaznaczenie pracy zaznacza jej trzy liczby; odznaczenie jednej liczby robi z checkboxa
pracy stan pośredni; „zaznacz wszystkie" przełącza całość w obie strony; licznik na przycisku zgadza
się z liczbą zaznaczonych liczb.

### Success Criteria

#### Automated Verification

- Spec tabeli zaznaczania przechodzi: `pnpm exec vitest run --project dom src/__tests__/components/kosztorys/editor/dialogs/catalogue-diff-table.test.tsx`

#### Manual Verification

- Na inwestycji 151: zaznaczenie pojedynczej liczby i „Aktualizuj kosztorys (1)" zmienia dokładnie
  tę jedną liczbę w rozpiskce, wiersz znika z raportu, okno zostaje otwarte, a licznik „Pokaż N
  różnic" maleje o jeden.
- Zaznaczenie wszystkiego i zapis zostawia blok „Inne liczby niż w katalogu" pusty.
- Sortowanie i filtry ustawione w rozpiskce przed otwarciem okna przeżywają zapis (siatka się nie
  remountuje).
- W „Wersje" jest wpis z chwili tuż przed zapisem, a przywrócenie go cofa cały hurt.
- Aktualizacja wiersza, gdzie katalog mówi „auto", **kasuje** nadpisanie — praca zaczyna liczyć się
  z globalnego współczynnika inwestycji i na siatce pokazuje cenę pochodną.
- Zaznaczenie stawki, która po scaleniu przekracza 65 % ceny, pokazuje znacznik przy wierszu jeszcze
  przed zapisem; odznaczenie znacznik gasi.

---

## Phase 5: Akceptacja podpowiedzi „może chodzi o"

### Overview

93 % prac spoza katalogu ma trafną podpowiedź, ale co czwarta ma bliskiego rywala, a 168 wierszy ma
nazwę **identyczną** i różni się wyłącznie j.m. — dzisiejsze „może chodzi o «Montaż syfonów»" nad
pracą nazwaną „Montaż syfonów" czyta się jak błąd aplikacji. Ta faza zamienia jedną podpowiedź w
wybór i pozwala ten wybór przyjąć.

### Changes Required

#### 1. Model podpowiedzi

**File**: `src/lib/kosztorys/work-catalogue/types.ts`

**Intent**: Podpowiedź przestaje być stringiem do czytania — staje się kandydatem, który da się
kliknąć, a cena i j.m. przy nim są tym, co rozstrzyga między rywalami.

**Contract**: nowy `CatalogueHintT = { id: number; description: string; unit: string; clientPrice:
number; score: number }`; `CatalogueMissingT.hint: string | null` → `hints: CatalogueHintT[]` (pusta
tablica zamiast `null`). Docblock `:85-88` mówi dziś „DISPLAY ONLY — this never matches, never prices
anything" — pierwsza połowa przestaje być prawdą (kandydat jest teraz klikalny), druga zostaje
(przyjęcie przepisuje **nazwę**, nie ceny) i trzeba to rozdzielić.

#### 2. Silnik podpowiedzi

**File**: `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts`

**Intent**: Zwracać do trzech najbliższych zamiast jednego. `closestDescription` i tak liczy wynik dla
każdego wpisu katalogu i nigdy nie zwiera obwodu, więc top-3 jest praktycznie darmowe — koszt zostaje
ten sam, co dziś.

**Contract**: `closestDescription` → `closestEntries(description, candidates, limit = 3)`, zwraca
posortowane malejąco kandydaty ze `score >= HINT_THRESHOLD`. `hintCandidates` musi nieść `id`, `unit`
i `clientPrice` wpisu, nie tylko opis. `attachCatalogueHints` wypełnia `hints`. `HINT_THRESHOLD = 0.55`
i jego docblock zostają.

#### 3. Blok „Brak w katalogu"

**File**: `src/components/kosztorys/editor/dialogs/catalogue-compare-dialog.tsx`

**Intent**: Pokazać kandydatów z tym, co je rozróżnia (j.m. i cena), dać wyjście do wyszukiwarki i
zapisać wybór od razu — przyjęcie nazwy i wzięcie cen to dwie różne decyzje i widać efekt pierwszej,
zanim zapada druga.

**Contract**: przy każdej pracy do trzech kandydatów jako klikalne pozycje `„<opis>" (<j.m.>) — <cena>`
plus „inny…" otwierające wyszukiwarkę po całym katalogu. Kliknięcie woła
`updateItemFieldAction(itemId, { description, unit })` z wartościami **dokładnie jak w katalogu**
(klucz musi trafić w istniejący `match_key`), łata siatkę przez `patchRows` (handler w hooku, jak w
fazie 4) i czyści wybór. Kopia dla pracy, której opis po foldzie jest identyczny i różni się tylko
j.m., mówi o **j.m.**, a nie „może chodzi o" tę samą nazwę.

#### 4. Specs

**Files**: `src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`,
`src/__tests__/components/kosztorys/editor/dialogs/catalogue-compare-dialog.test.tsx`

**Intent**: Node przypina próg i sortowanie kandydatów; dom przypina, że kliknięcie wysyła opis
**i** j.m.

**Contract**: node — trzech kandydatów posortowanych malejąco, czwarty odcięty, kandydat poniżej
`HINT_THRESHOLD` nie wchodzi, brak kandydatów → pusta tablica. Dom — kliknięcie kandydata woła
zamockowaną `updateItemFieldAction` z `{ description, unit }` wziętymi z kandydata (moduł `'use
server'` jest stubowany i rzuca przy wywołaniu, więc mock jest obowiązkowy).

### Success Criteria

#### Automated Verification

- Specs kandydatów przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`
- Spec przyjęcia kandydata przechodzi: `pnpm exec vitest run --project dom src/__tests__/components/kosztorys/editor/dialogs/catalogue-compare-dialog.test.tsx`

#### Manual Verification

- Praca „Montaż syfonów (kpl)" pokazuje kandydata „Montaż syfonów (szt)" z komunikatem mówiącym o
  j.m., a nie o nazwie.
- Kliknięcie kandydata przepisuje pracy opis i j.m., praca znika z „Brak w katalogu" i pojawia się w
  „Inne liczby niż w katalogu" (albo w „Zgodne z katalogiem", jeśli liczby się zgadzają).
- „inny…" otwiera wyszukiwarkę po całym katalogu i wybór z niej działa tak samo.
- Ceny pracy **nie** zmieniają się przy przyjęciu nazwy.

---

## Testing Strategy

### Unit (node)

- Próg w groszach: 14,875 ↔ 14,88 milczy, 14,87 ↔ 14,88 zgłasza.
- Cztery kombinacje rodzajów stawki, w tym kwota ↔ „auto" o **tej samej** kwocie implikowanej.
- Top-3 kandydatów: sortowanie, odcięcie na czwartym, odcięcie na progu, pusta tablica.

### DOM

- Trójstan checkboxa pracy, propagacja praca→liczby, „zaznacz wszystkie" w obie strony, licznik na
  przycisku.
- Kliknięcie kandydata woła akcję z opisem **i** j.m.

### DB

- Paczka mieszająca `NULL` i kwoty zapisuje się w całości; asercja na stanie utrwalonym.

### E2E

Ta zmiana jest browser-level, więc jest winna spec E2E. Autorstwo albo odroczenie do backlogu
(Linear, etykieta `e2e-backlog`, projekt „Wykonczymy") rozstrzyga się przy bramce przeglądu, zgodnie
z `slice-review-gate` Step 3. **Nie uruchamiamy `pnpm test:e2e` w trakcie implementacji.**

### Manual

Zebrane raz, na końcu zmiany, do `context/foundation/manual-checks.md` — punkty z sekcji
`#### Manual Verification` poszczególnych faz.

## Performance Considerations

- `attachCatalogueHints` to nadal najdroższa część okna (O(pozycje × katalog), ~10,7 s przy 400
  próbkach) i nadal chodzi za `useDeferredValue(open)`. Top-3 **nie** dokłada przebiegów — punktacja
  każdego wpisu i tak się liczy; zmienia się tylko to, co zostaje po drodze zapamiętane. Nie wolno
  tego przenosić do klasyfikacji, która chodzi przy każdym zatwierdzonym naciśnięciu klawisza.
- Hurtowy zapis to **trzy** `UPDATE`-y niezależnie od liczby zaznaczonych pozycji. Kosztorys potrafi
  mieć 1000+ pozycji, więc zapis per pozycja byłby tysiącem round-tripów.
- `captureAutoSnapshot` serializuje całe drzewo — to jeden ciężki odczyt na zapis, nie na pozycję.

## Migration Notes

Brak migracji — zmiana nie dotyka schematu. Zapisywane kolumny (`client_price`,
`w_tools_override_value`, `own_tools_override_value`) już istnieją i już przyjmują `NULL`.

## Whole-tree Gate

Uruchomić **raz**, po ostatniej fazie:

- Typy: `pnpm typecheck`
- Lint: `pnpm lint`
- Pełny zestaw: `pnpm test`
- Build: `pnpm build`

## References

- Research: `context/changes/2026-09-21-catalogue-compare-bulk-update/research.md`
- Wzorzec porównania w groszach: `src/lib/kosztorys/reconciliation.ts:36-40`
- Wzorzec hurtu z migawką: `src/lib/actions/kosztorys.ts:268-291` (`cleanItemTextsAction`)
- Wzorzec paczkowego `UPDATE`: `src/lib/db/kosztorys-sheet-measured-qty.ts:14-34`
- Wzorzec nazwanego handlera nad `patchRows`: `src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts:271-293`
- Wzorzec UI zaznaczania: `src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx`
- Render „auto": `src/components/tables/work-catalogue.tsx:15-20`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Próg porównania w groszach

#### Automated

- [x] 1.1 Specs silnika porównania przechodzą — `b8dd0158`

### Phase 2: „auto" jako rodzaj różnicy

#### Automated

- [x] 2.1 Specs czterech kombinacji rodzajów przechodzą — `18092f87` (wyszarzenie „Różnicy" przeniesione do fazy 4, razem z własną tabelą)

### Phase 3: Zapis po stronie serwera

#### Automated

- [x] 3.1 Spec zapisu paczkowego przechodzi — `3d028a8b`

### Phase 4: Tabela zaznaczania w oknie

#### Automated

- [x] 4.1 Spec tabeli zaznaczania przechodzi — `fe0763d4`

### Phase 5: Akceptacja podpowiedzi „może chodzi o"

#### Automated

- [x] 5.1 Specs kandydatów przechodzą — `87f26bba`
- [x] 5.2 Spec przyjęcia kandydata przechodzi — `87f26bba`
