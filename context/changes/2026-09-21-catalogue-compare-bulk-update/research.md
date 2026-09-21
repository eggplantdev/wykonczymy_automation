---
date: 2026-09-21T19:31:08+02:00
researcher: ex-Plant
git_commit: 7b5b9e2643b00ed4a64435c328db8448c08965d4
branch: staging
repository: wykonczymy
topic: 'Hurtowa aktualizacja rozpiski z katalogu prac w oknie „Porównaj z katalogiem"'
tags: [research, codebase, work-catalogue, kosztorys-editor, bulk-write, money-rounding]
status: complete
last_updated: 2026-09-21
last_updated_by: ex-Plant
---

# Research: Hurtowa aktualizacja rozpiski z katalogu prac

**Date**: 2026-09-21T19:31:08+02:00
**Researcher**: ex-Plant
**Git Commit**: `7b5b9e2643b00ed4a64435c328db8448c08965d4`
**Branch**: `staging`
**Repository**: wykonczymy

## Research Question

Co musi się zmienić, żeby okno „Porównaj z katalogiem prac" zyskało drugi kierunek zapisu —
z katalogu **do** rozpiski — w trzech kawałkach z `change.md`: (1) fix pół-grosza w progu
porównania, (2) hurtowa aktualizacja z checkboxami per liczba / per praca i jawnym „auto",
(3) akceptacja podpowiedzi „może chodzi o" z wyborem kandydata.

## Summary

Zmiana jest mniejsza, niż wygląda, bo **nic poniżej okna nie czyta liczb z porównania**. Cała reszta
aplikacji redukuje raport do dwóch zbiorów `itemId` (liczniki „Problemy", warunki wierszy), więc
dołożenie pól do `CatalogueFigureDiffT` ma zerowy zasięg poza samym oknem i jednym literałem w
teście okna. Trzy realne obszary ryzyka to: **wspólne komponenty tabeli raportu** (cztery okna
korzystają z tych samych sześciu części — dodanie kolumny checkboxa dotyka trzech obcych okien),
**ścieżka zapisu** (jedno `UPDATE … FROM (VALUES …)` z jawnymi castami, bo `null` = „auto" i batch
bez castu potrafi wywalić całe zapytanie), i **odświeżenie siatki** (`patchRows`, nie
`onTreeReplaced` — ten drugi kasuje sortowanie, filtr „Problemy" i stos cofania, czyli dokładnie to,
co owner przed chwilą ustawił klikając „Pokaż w rozpisce").

Dwie rzeczy zmierzone na danych, nie zgadnięte:

- **Fix pół-grosza jest mały ilościowo i duży wiarygodnościowo.** 13 z 3794 różnic (0,3 %) znika po
  zaokrągleniu do groszy. To nie jest sprzątanie hałasu — to jedyne wiersze, w których raport
  pokazuje dwie identyczne liczby i niezerową różnicę, czyli jedyne, które podważają cały raport.
- **Oś „auto" to ćwierć wszystkich różnic stawek.** 650 z 2334 różnic stawek (27,8 %) ma „auto" po
  dokładnie jednej stronie — dziś każda z nich renderuje w którejś kolumnie wyliczoną złotówkę,
  której w żadnym rekordzie nie ma.

Czwarty wniosek, którego nie było w założeniach: **podpowiedź „może chodzi o" jest niejednoznaczna
w 25 % przypadków**, a w 168 wierszach wskazuje wpis, którego opis po foldzie jest **identyczny** —
różni się tylko j.m. To przesądza kształt kawałka (3): wybór spośród kandydatów, przenoszący opis
**i** jednostkę.

## Detailed Findings

### 1. Silnik porównania i jego konsumenci

`buildCatalogueComparison` ([build-catalogue-comparison.ts:94](../../../src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts)) ma **jedno** miejsce
wywołania — ręczny `useMemo` w [use-kosztorys-editor.ts:383](../../../src/components/kosztorys/editor/use-kosztorys-editor.ts) z zależnościami
`[preview, rows, workCatalogue]`. Ręczny, bo React Compiler kapituluje w tym pliku (EX-496).

Konsumenci wyniku:

| Konsument                                               | Co czyta                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `catalogueRowIds` (`use-kosztorys-editor.ts:389-398`)   | **wyłącznie** `diffs[].itemId` i `missing[].itemId` → dwa `Set<number>`                                    |
| Warunki wierszy (`row-conditions/registry.ts:281-303`)  | te same zbiory id                                                                                          |
| Liczniki „Problemy" (`use-kosztorys-editor.ts:412-426`) | te same zbiory id                                                                                          |
| Okno (`catalogue-compare-dialog.tsx:93-182`)            | `matching`, `diffs[].itemId/.description/.figures[]`, `missing[].section/.description/.unit/.hint/.itemId` |

**`maxDelta` nie jest czytane przez UI w ogóle** — służy tylko sortowaniu (`:158`).

Wniosek dla planu: **rozszerzenie `CatalogueFigureDiffT` o oś „auto" jest bezpieczne**. Jedyny plik
poza oknem, który trzeba ruszyć, to literał `COMPARISON` w
`src/__tests__/components/kosztorys/editor/dialogs/catalogue-compare-dialog.test.tsx:31-42`.

#### Budżet wydajności (z `katalog-problems`, zmierzony)

- memo klasyfikacji: cel ~2 ms przy 1000 pozycji; sąsiednie memo razem ~5 ms na commitnięty
  keystroke;
- `foldDescription` ×1000 = 10,8 ms — dlatego `keyCache` (`:103-113`); największa realna rozpiska to
  379 pozycji / 198 par (opis, j.m.);
- podpowiedzi: **401 ms przy 42 próbach, 10,7 s przy 400** — dlatego nigdy nie wchodzą do memo, tylko
  `useDeferredValue(open)` w oknie (`catalogue-compare-dialog.tsx:64-72`);
- **nie istnieje żaden strażnik regresji wydajności na te memo.**

### 2. Fix pół-grosza — dom stylu już jest

`MONEY_TOLERANCE = 0.005` ([calc.ts:15](../../../src/lib/kosztorys/calc.ts)) ma **11 miejsc użycia**; nasze
`figure()` (`build-catalogue-comparison.ts:60`) to jedyne, gdzie problem się objawił, bo `formatPLN`
sam zaokrągla ([format-currency.ts:8](../../../src/lib/utils/format-currency.ts)) — stąd dwie identyczne liczby przy
niezerowej różnicy.

Repo ma już **dwa precedensy „zaokrąglij, potem porównaj"**, oba na dokładnej równości, nie na
epsilonie:

```ts
// src/lib/kosztorys/reconciliation.ts:36-40
// Exact grosz equality on rounded values, not a fuzzy epsilon: a hand-entered transfer can differ
// sub-grosz from the derived figure, and that must NOT fire — only a real ≥1-grosz gap is a mismatch.
const mismatch = roundToCents(expected) !== roundToCents(actual)
```

```ts
// src/components/tables/investments.tsx:205-210
const gap = roundToCents(a - b) // „both sides are independent float folds"
```

`roundToCents` ([round-to-cents.ts:8](../../../src/lib/utils/round-to-cents.ts)) mówi to wprost w docbloku:
_„Round before COMPARING two such figures… Never round mid-calculation."_ Trzeci precedens:
`settlement-groups.ts:54,68`.

`QTY_TOLERANCE` (`settlement-rows.ts:91`) to osobna oś i jej docblok wprost zabrania przenoszenia
reguły pieniężnej — fix nie może tam sięgnąć.

**Zmierzony zasięg** (metodyka w §7): 13 z 3794 różnic znika. Na inwestycji 151 — tej ze
zrzutu — dokładnie 1 wiersz, ten z „Malowanie sufitu w kolor".

### 3. Model „auto" — słownictwo i cztery przypadki

Strona rozpiski: `overrideValueFor` ([calc.ts:79-85](../../../src/lib/kosztorys/calc.ts)) — _„`null` is the
load-bearing answer… `0` is not that: it is a kwota someone set to zero."_
Strona katalogu: `WorkCatalogueItemT` ([work-catalogue/types.ts:3-8](../../../src/lib/kosztorys/work-catalogue/types.ts)) — _„a frozen
ZŁOTÓWKA… or `null` = „auto", meaning the katalog declines to name one."_

Cztery przypadki na jedną stawkę:

| #   | Rozpiska | Katalog  | Dziś raportowane?      | Co naprawdę stoi w kolumnie                                                          |
| --- | -------- | -------- | ---------------------- | ------------------------------------------------------------------------------------ |
| 1   | kwota    | kwota    | tak, gdy \|Δ\| > 0,005 | dwie prawdziwe liczby                                                                |
| 2   | kwota    | **auto** | tak                    | „Katalog" = `cena katalogu × współczynnik` — **liczba, której nie ma w katalogu**    |
| 3   | **auto** | kwota    | tak                    | „Kosztorys" = `cena pozycji × współczynnik` — symetrycznie zmyślona                  |
| 4   | **auto** | **auto** | **nie** (`:77`)        | — obie byłyby `cena × ten sam współczynnik`, czyli różnica ceny w trzech kapeluszach |

`figure('Cena j.m.', …)` (`:139`) to zawsze kwota przeciw kwocie — osi „auto" tam nie ma.

**Słownictwo jest ustalone i trzeba je powtórzyć, nie wymyślać:** słowo to `auto`, małą literą, bez
cudzysłowu w renderze. Kanoniczny formater już istnieje —
`formatPLNOrAuto(amount: number | null)` ([format-currency.ts:14-16](../../../src/lib/utils/format-currency.ts)), używany w
`save-item-to-catalogue-dialog.tsx:183` i `catalogue-item-from-kosztorys-dialog.tsx:108`. Render
komórki katalogu: `work-catalogue.tsx:15-20` (`text-muted-foreground text-sm` dla „auto",
`tabular-nums` dla kwoty). Wyliczona (nienadpisana) cena w siatce jest `text-muted-foreground
italic` (`subcontractor-columns.tsx:110,120`) — to gotowy wzór na „wyszarzoną kwotę różnicy".

Nazewnictwo flagi: warstwa formularzy już paruje stawkę z booleanem `wToolsAuto` / `ownToolsAuto`
(`work-catalogue-item-schema.ts:18`), więc `kosztorysAuto` / `catalogueAuto` na
`CatalogueFigureDiffT` pasuje i do tego, i do istniejących nazw stron `kosztorys` / `catalogue`.

**Maszynowa trójka pól już istnieje** — `SeedConflictFieldT = 'clientPrice' | 'wToolsRate' |
'ownToolsRate'` (`work-catalogue/types.ts:33`). `CatalogueFigureDiffT.label` to polski napis do
wyświetlenia; **przez drut ma iść `SeedConflictFieldT`, nie label.**

### 4. Ścieżka zapisu

#### Kształt akcji

`investmentAction` ([investment-action.ts:27-71](../../../src/lib/actions/investment-action.ts)) opakowuje
`protectedAction` (`run-action.ts:35-66`): `requireAuth(MANAGEMENT_ROLES)`, odmowa zapisu na
zakończonej inwestycji, `code: 'NOT_FOUND'` dla znikniętego celu (to napędza reseed przy zwietrzałym
drzewie), `revalidateCollections` **tylko przy sukcesie**.

**Nie istnieje dziś żadna akcja przyjmująca listę id pozycji z wartościami per pozycja** — i to jest
celowe. Reguła stoi w komentarzu `insertCatalogueItemsAction`
([work-catalogue.ts:160-161](../../../src/lib/actions/work-catalogue.ts)):

> _The client sends ONLY ids: every number that lands in the rozpiska is re-read from the cennik
> server-side, so a tampered payload cannot price a praca._

Czyli po drucie leci `{ itemId, fields: SeedConflictFieldT[] }[]`, a wartości serwer odczytuje sam z
katalogu. `renumberKosztorysOrderAction` (`kosztorys.ts:570`) i `cleanItemTextsAction` (`:269`)
trzymają tę samą zasadę.

#### SQL

Wzór to `setItemTexts` ([kosztorys-item-texts.ts:24-45](../../../src/lib/db/kosztorys-item-texts.ts)) i
`setSheetMeasuredQty` ([kosztorys-sheet-measured-qty.ts:14-34](../../../src/lib/db/kosztorys-sheet-measured-qty.ts)): jedno
`UPDATE … FROM (VALUES …) AS v(…)` z **jawnymi castami** i `WHERE i.id = v.id AND i.investment_id =
${investmentId}`. Docblok drugiego mówi, czemu casty są obowiązkowe:

> _a literal `NULL` has no type, so a batch whose first row clears the figure would leave Postgres
> unable to infer the column and reject the whole update._

**To jest dokładnie nasz przypadek** — `w_tools_override_value` / `own_tools_override_value` są
nullowalne, a „weź auto z katalogu" znaczy „wpisz `NULL`".

#### Migawka

Precedens jest jednoznaczny: **każdy częściowy destrukcyjny zapis hurtowy bierze
`captureAutoSnapshot`, nie `manual`** — `applyPercentDiscountToAllItemsAction` (`kosztorys.ts:254`),
`cleanItemTextsAction` (`:285`), `removeSectionAction` (`:363`), `removeItemAction` (`:527`),
`removeStageAction` (`:699`). `manual` jest zarezerwowany dla wymiany całego drzewa
(`replace-tree-with-snapshot.ts:100`), bo tylko wtedy owner musi móc w nią celować z nazwy.

Retencja (`snapshots.ts:17-28`): 0–30 dni wszystko, 30–120 jedna dziennie, 120–365 jedna tygodniowo,
powyżej 365 nic — pasma dzienne i tygodniowe filtrują `WHERE kind = 'auto'`, sufit 365 dni jest
ślepy na rodzaj.

**Pułapka, udokumentowana** (`lessons.md:1211-1222`): `captureAutoSnapshot` → `serializeKosztorys` →
`getKosztorysTree` idzie przez **cache'owaną warstwę zapytań, która otwiera własne połączenie**. Z
wnętrza `withPayloadTransaction` przeczyta więc to, co warstwa zapytań zwraca teraz, a nie wiersze,
które transakcja właśnie ma nadpisać. Nic w miejscu wywołania tego nie sygnalizuje.

#### Transakcja — nie jest potrzebna

Jedno `UPDATE … FROM (VALUES …)` jest atomowe samo z siebie, a cały precedens tego kształtu
(`applyPercentDiscountToAllItemsAction`, `setItemTexts`, `setSheetMeasuredQty`) chodzi **bez**
transakcji. INSERT migawki to drugie zdanie, ale awaria między nimi zostawia osieroconą migawkę
opisującą stan, który i tak obowiązuje — odwrotność groźnej kolejności. Owinięcie obu w transakcję
byłoby zresztą tą właśnie fałszywą pociechą, przed którą ostrzega `lessons.md:1211`, bo odczyt
migawki i tak nie jest transakcyjnie spójny.

Warunek: **zapis musi być jednym zdaniem**. Jeśli plan wyjdzie na „odczytaj wiersze → policz →
zapisz", to jest właśnie przypadek „reads a state and then acts on it", którego
`with-payload-transaction.ts:19-22` zabrania pod READ COMMITTED. Rozwiązanie: złączyć
`kosztorys_items` z `work_catalogue_items` po `match_key` wewnątrz zdania, bez rundy do klienta.

#### Sufit 65 %

`checkSubcontractorPrice` ([subcontractor-price-guard.ts:80-94](../../../src/lib/kosztorys/subcontractor-price-guard.ts)):
ujemna cena → `refuse`, powyżej `MAX_CLIENT_SHARE = 0.65` → `warn` z polskim zdaniem. Docblok:
_„A stawka above the ceiling is a bad deal, not an impossible one… the write lands, the cell goes
red and the „Problemy" filter picks the row up."_

Ścieżka wstawiania zbiera ostrzeżenia do `warnings: string[]`
(`append-catalogue-items.ts:67-74`) i okno pokazuje maksymalnie trzy tosty plus
`…i ${n} dalszych ostrzeżeń o cenie` (`add-items-from-catalogue-dialog.tsx:53,170-177`).

**Przy nadpisaniu sufit jest ostrzejszy niż przy wstawianiu**, z dwóch powodów:

- sprawdzać trzeba **wiersz po scaleniu**, nie wpis katalogu — częściowe zaznaczenie (sama stawka,
  bez ceny j.m.) potrafi przekroczyć sufit w sposób, którego ścieżka wstawiania nigdy nie wytwarza;
- i z **prawdziwymi współczynnikami inwestycji**, bo częściowe zaznaczenie zostawia jedną płaszczyznę
  na „auto", a wtedy implikowana stawka naprawdę czyta współczynnik. Skrót ze ścieżki wstawiania
  (`asViewPricing(item)` z zerowymi globalami, `calc.ts:91-101`) zaniżyłby wynik.

Tier `refuse` jest tu praktycznie nieosiągalny — katalog nie utrzyma ujemnej liczby.

### 5. Powrót zapisu na siatkę

`patchRows` ([use-kosztorys-editor.ts:1084-1092](../../../src/components/kosztorys/editor/use-kosztorys-editor.ts)) aktualizuje
**i `rows`, i `prevById`** (bazę porównania dla `onChange`), więc podmieniona wartość nie odpali
ponownie jako edycja użytkownika. `rows` to zamrożony przy montowaniu seed
(`useState(() => treeToRows(tree))`, `:160`), więc sam `router.refresh()` nigdy go nie ruszy
(`lessons.md:165-168`).

**`patchRows` nie jest dziś na powierzchni zwrotnej hooka** — leci tylko w dół jako prop do
`useKosztorysStageOps` (`:224`) i `useKosztorysSettings` (`:343`). Wzorzec domu to **wystawić nazwany
handler**, dokładnie jak `handleApplyPercentDiscount` (`use-kosztorys-settings.ts:132-154`,
zwracany `:166`, reeksport `use-kosztorys-editor.ts:1246`): zdejmij `prev` per id → `patchRows`
optymistycznie → `optimisticSettingSave(akcja, rollback, komunikat)`
([optimistic-setting-save.ts:9-28](../../../src/lib/kosztorys/optimistic-setting-save.ts)).

`onTreeReplaced` (`kosztorys-editor-v2.tsx:42-50`) jest tu **zły**: `router.refresh()` +
`triggerRestore()` + `undoRedo.reset()` remontuje ciało edytora przez `key={remountKey}` i kasuje
widok, szukajkę, **zaangażowane warunki „Problemy"**, sortowanie, zwinięte sekcje i stos cofania.
Owner właśnie kliknął „Pokaż w rozpisce" (`catalogue-compare-dialog.tsx:77-80`), żeby to zawęzić.

Konsekwencja: **nie wolno bumpnąć `investments.updated_at`** w tym zapisie (co robią
`setItemTexts:42` i `setSheetMeasuredQty:31`) — ten token jest wejściem zatrzasku remontu
(`kosztorys-editor-v2.tsx:29-30`).

Bonus: `catalogueComparison` to memo po `rows`, więc `patchRows` **przelicza raport i liczniki
„Problemy" w tym samym renderze** — bez ponownego pobrania czegokolwiek.

### 6. Podpowiedź „może chodzi o" — kandydaci zamiast jednego strzału

`closestDescription` (`build-catalogue-comparison.ts:44-52`) **już liczy każdy wynik i nigdzie nie
skraca pętli** — trzyma tylko najlepszy. Top-N jest więc praktycznie darmowe: koszt dominuje
`diceSimilarity` (`string-similarity.ts:13-28`), już zapłacony dla każdego kandydata.

Luka w typie: `CatalogueMissingT.hint` to `string | null` (`work-catalogue/types.ts:80-88`) — **sam
opis**. Żeby przyjąć podpowiedź, potrzebne są `id`, `description` **i** `unit` wpisu.

#### Identyczność: co jest składowane, a co liczone świeżo

`kosztorys_items` **nie ma kolumny klucza** (migracja `20260708_2…:24`, kolekcja
`kosztorys-items.ts:41-42` — zwykły `text`). Klucz liczy się świeżo przy każdym odczycie.
`work_catalogue_items.match_key` **jest składowany**, `NOT NULL`, UNIQUE
(`20260901_0_add_work_catalogue_items.ts:19,27`), pisany w jednym miejscu (`work-catalogue.ts:35-45`).

Lekcja „składowany klucz to zobowiązanie do backfillu" (`lessons.md:1741-1745`) mówi, że aplikacja
porównuje **świeży klucz ze składowanym**. Strona składowana to katalog; strona rozpiski jest zawsze
świeża. **Dla kawałka (3) nie ma więc zobowiązania do backfillu** — przesuwamy świeżą stronę na
istniejący klucz, czyli w kierunku, który ta asymetria toleruje. Twardy warunek: zapisać
`description` i `unit` wpisu **dokładnie tak, jak są składowane**, wtedy
`catalogueKey(nowyOpis, nowaJm) === entry.matchKey` z konstrukcji.

Ścieżka zapisu istnieje i bierze oba pola w jednym wywołaniu — `updateItemFieldAction(itemId, patch)`
(`kosztorys.ts:116-131`), `ItemPatchT` (`types.ts:56`) obejmuje `description` i `unit`. Serwer nie
normalizuje nic przy zapisie (brak `.trim()` w schemacie, brak `beforeChange`).

**Pułapka: „Popraw literówki".** `cleanDescription` (`clean-description.ts:196`) ma tablicę
`TYPO_FIXES`, której reguły potrafią przesunąć `foldDescription` — czyli jeśli wpis katalogu sam nie
jest czysty, kolejne „Popraw literówki" zepsuje dopasowanie, które właśnie utworzyliśmy.
`cleanUnit` (`clean-unit.ts:23`) jest bezpieczny, bo `foldUnit('m²') === foldUnit('m2')`.
Istnieje skrypt czyszczący katalog **z przeliczeniem `match_key`**
(`src/scripts/fix-kosztorys-descriptions.ts:86-96`, `CATALOGUE=1`).

Osobny efekt uboczny, wart wypisania ownerowi: `itemKey` po stronie arkusza
(`sheet-import/item-key.ts:47`) **nie zawiera j.m.**, więc zmiana samej jednostki jest dla importu
niewidoczna, ale zmiana opisu rozłącza pozycję od jej bliźniaka w arkuszu przy najbliższym
„Porównaj z arkuszem". To własność samej zmiany nazwy, nie naszej funkcji.

I jeszcze jedno: katalog **odmawia** zapisania pracy bez j.m. (`work-catalogue.ts:194-196`,
`EMPTY_UNIT_ERROR`), więc przyjęcie podpowiedzi zawsze nadaje pozycji niepustą jednostkę — dla
wiersza „(bez j.m.)" to realna zmiana zachowania i powinna być widoczna w kopii UI.

#### Prior art na wybór wpisu

`add-items-from-catalogue-dialog.tsx:91,97-121` — `SearchFilterInput` + `useSearchFilter` +
`FilterMultiSelect` + `DataTable`. Ale **fetch nie jest potrzebny**: `workCatalogue` jest już na
kontekście edytora i okno je destrukturyzuje (`catalogue-compare-dialog.tsx:47`).
`src/components/ui/combobox.tsx:29-31` jawnie **nie** jest szukajką („quick-picks — NOT a
search/filter box") — do „znajdź właściwy wpis" idzie `command.tsx` (cmdk).

### 7. Pomiar na prawdziwych danych

Poprzednia próba (join SQL po `lower(trim(description))`) zwróciła **zero wierszy przy znanym
trafieniu** — instrument był zepsuty, bo prawdziwe dopasowanie idzie przez `foldDescription`, a
opisy różnią się pisownią („Malowanie sufitu w kolor" ↔ „…w kolorze"). Poniższe liczby pochodzą z
uruchomienia **prawdziwego `buildCatalogueComparison`** na zrzucie lokalnej bazy (14 kosztorysów,
4464 pozycje, 568 wpisów katalogu, z czego 125 z „auto" na którejś płaszczyźnie).

```
różnic (wierszy raportu) łącznie:            3794
  znika po zaokrągleniu do groszy:             13  (0,3 %)
  Cena j.m.:                                 1460
  stawka: kwota ↔ kwota:                     1684
  stawka: kwota ↔ katalog auto:                160
  stawka: rozpiska auto ↔ kwota:               490
```

Inwestycja 151 (ta ze zrzutu): **63 prace / 138 różnic**, 97 zgodnych, 42 brak w katalogu;
1 wiersz znika po zaokrągleniu, 6 to „rozpiska zamrożona ↔ katalog auto", 9 to „rozpiska auto ↔
katalog kwota".

Jakość podpowiedzi (próg 0,55, cała lokalna baza):

```
pozycji „brak w katalogu":                   1220
  z podpowiedzią:                            1130  (93 %)
  niejednoznacznych (druga w promieniu 0,05): 283  (25 % podpowiedzi)
  opis identyczny po foldzie, różni się TYLKO j.m.: 168
  opis podobny i j.m. też inna:                126
```

Przykłady z ostatniej kategorii (score 1,00 — czyli nazwa jest **ta sama**):

```
„Montaż syfonów" (kpl)                  →  „Montaż syfonów" (szt)
„Wylewka betonowa ok 3-5cm" (kpl)       →  „Wylewka betonowa ok. 3-5 cm" (m2)
„Montaż listew led + taśm ledowych" (mb) → „Montaż listew LED + taśm LED" (kpl)
```

Trzy rzeczy z tego wynikają wprost:

1. akceptacja **musi** przenosić j.m., inaczej 168 wierszy nigdy się nie dopasuje;
2. akceptacja **musi** być wyborem spośród kandydatów — 25 % podpowiedzi ma bliskiego rywala;
3. dzisiejsza kopia „może chodzi o «Montaż syfonów»" nad wierszem „Montaż syfonów" czyta się jak
   błąd aplikacji. To odrębna, tania poprawka kopii: gdy różni się tylko j.m., zdanie ma o tym
   mówić.

### 8. Wspólne komponenty raportu — gdzie jest tarcie

Wszystkie sześć części żyje w `sheet-report-parts.tsx` i **żadna nie jest wyłączna dla naszego okna**:

| Komponent                           | katalog | arkusz-porównanie | arkusz-import | stawki arkusza |
| ----------------------------------- | ------- | ----------------- | ------------- | -------------- |
| `ComparisonTable` / `ComparisonRow` | ✓       | ✓                 | ✓             | —              |
| `ItemList`                          | ✓       | ✓                 | ✓             | —              |
| `ReportFold`                        | ✓       | ✓                 | ✓             | ✓              |
| `ReportTable` / `ReportRow`         | —       | —                 | ✓             | ✓              |

Istniejący szew rozszerzeń to `ComparisonTable.withAction` (`:89-92`, deklarowany **na tabeli**, nie
wnioskowany z wierszy) + `ComparisonRow.action` (`:114-117`) — dokładnie kształt „opcjonalna kolumna
z tyłu", jakiego chce kolumna checkboxa. Ale checkbox idzie **z przodu**, a reguła wyrównania
nagłówków `ReportTable` (`:34-36`: indeks 0 do lewej, reszta `pl-3 text-right`) jest tym, co
dołożenie kolumny na początku zepsuje trzem obcym oknom. Grupowanie i wcięcie trzech liczb jednej
pracy to drugi taki przypadek.

`SheetReportBlock` i `SheetReportDialog` też są wspólne z oknami arkusza.

### 9. Precedens UI wyboru

`add-items-from-catalogue-dialog.tsx`: `Checkbox` z `@/components/ui/checkbox`, **uporządkowany**
`useState<number[]>`, „zaznacz wszystkie" które **dokłada** (nie zastępuje), `SelectedIdsContext`
zamiast propa (bo `DataTable` memoizuje komórki), `MAX_WARNING_TOASTS = 3`.

Nasz przypadek jest o jeden poziom głębszy — zaznaczenie to `(itemId, pole)`, nie samo `itemId` —
więc nośnikiem stanu jest `Map<number, Set<SeedConflictFieldT>>` albo zbiór kluczy złożonych.
Checkbox pracy jest **skrótem** na trzy liczby, więc ma stan `indeterminate`.

### 10. Testy

Pełny obraz w wynikach agenta; to, co przesądza plan:

| Kawałek                      | Warstwa                  | Plik                                                                                                                                                 |
| ---------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| (1) zaokrąglenie             | node, czysty             | **rozszerzyć** `src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts` — sąsiadem jest istniejący przypadek progu (`:51-56`) |
| (2) akcja hurtowa            | node, **prawdziwa baza** | nowy spec pod `src/__tests__/lib/actions/`, wzór `kosztorys-bulk-discount-snapshot.test.ts`                                                          |
| (2) UI zaznaczania           | dom                      | **rozszerzyć** `catalogue-compare-dialog.test.tsx`; idiom z `lead-assets-dialog.test.tsx`                                                            |
| (3) przepisanie opisu + j.m. | dom + baza               | asercja na **utrwalonym** `description`/`unit`, nie na wyniku akcji                                                                                  |

Doktryna specu akcji, cytat z nagłówka `kosztorys-bulk-discount-snapshot.test.ts`:

> _We run the REAL action against the REAL DB and assert PERSISTED STATE — the snapshot rose AND the
> rows were overwritten — not the return value._

Mockowane są tylko `requireAuth`, `server-only` i `revalidate`; **pisarz jest prawdziwy**. Spec z
zamockowanym `payload` jest tu konkretnie zakazany przez `lessons.md:1153-1164` — `transfer-actions.test.ts`
zamockował `payload.create`, `beforeValidate` nigdy nie wstał i dwa testy **świeciły się na zielono
przypinając zakazany kształt jako akceptowany**.

`stubServerActions` (`vitest.config.ts:33-49`) przepisuje każdy moduł `'use server'` na **rzucający**
stub, więc okno statycznie importujące nową akcję wybuchnie, jeśli spec jej jawnie nie zamockuje.
Zastrzeżenie (`:40-42`): łapie tylko `export function` / `export async function` — akcja jako
`export const` przeleci przez sito.

`test-plan.md` ma jedno ryzyko na styku — **#10** (`:61`): _„licznik rozjazdu z katalogiem kłamie
albo zamraża edytor"_. Pokrywa kawałek (1). Kawałki (2) i (3) — hurtowe nadpisanie cen i przepisanie
opisu — **nie mają wpisu**; ryzyko #10 nie ma też wiersza w tabeli odpowiedzi (`:65-74`) ani
w rozkładzie faz (`:82-88`). `§6.4 „Adding a test for a new server action"` jest wciąż `TBD`.

E2E: `e2e/work-catalogue.spec.ts` trzyma dwa testy i wylicza w nagłówku, czego świadomie nie
pokrywa. **Okno porównania nie ma żadnego pokrycia Playwrightem.** Zgodnie z AGENTS.md slice
przeglądarkowy jest to winien: albo spec przy bramce przeglądu, albo issue z etykietą
`e2e-backlog`.

## Code References

- `src/lib/kosztorys/work-catalogue/build-catalogue-comparison.ts:54-83` — `figure` i `rateFigure`, oba miejsca zmiany dla (1) i osi „auto"
- `src/lib/kosztorys/work-catalogue/types.ts:33` — `SeedConflictFieldT`, gotowa trójka pól na drut
- `src/lib/utils/format-currency.ts:14-16` — `formatPLNOrAuto`, kanoniczny render „auto"
- `src/lib/kosztorys/reconciliation.ts:36-40` — precedens „zaokrąglij, potem porównaj"
- `src/lib/db/kosztorys-sheet-measured-qty.ts:14-34` — wzór `UPDATE … FROM (VALUES …)` z castami i nullem
- `src/lib/actions/work-catalogue.ts:160-192` — „klient wysyła tylko id"
- `src/lib/actions/kosztorys.ts:244-292` — `applyPercentDiscountToAllItemsAction` + `cleanItemTextsAction`
- `src/components/kosztorys/editor/hooks/use-kosztorys-settings.ts:132-166` — wzór optymistycznego handlera z rollbackiem
- `src/components/kosztorys/editor/use-kosztorys-editor.ts:1084-1092` — `patchRows`
- `src/components/kosztorys/editor/dialogs/sheet-report-parts.tsx:84-129` — szew `withAction` / `action`
- `src/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.tsx:53,97-177` — precedens zaznaczania + tosty ostrzeżeń
- `src/lib/kosztorys/subcontractor-price-guard.ts:80-94` — sufit 65 %, dwa poziomy werdyktu

## Architecture Insights

- **Raport jest cienki w dół, gruby w bok.** Wszystko poza oknem widzi go jako dwa zbiory id, więc
  rozbudowa typu figury jest tania, a rozbudowa wspólnych komponentów tabeli — droga. Odwrotnie,
  niż podpowiada intuicja.
- **Asymetria kluczy jest celowa i działa na naszą korzyść.** Świeży klucz po stronie rozpiski,
  składowany po stronie katalogu — przesunięcie rozpiski na istniejący klucz nie tworzy długu.
- **„Klient wysyła tylko id" to reguła bezpieczeństwa, nie oszczędność bajtów.** Trzy akcje już ją
  trzymają; czwarta, która wysłałaby kwoty, byłaby regresją.
- **Migawka `auto` ≠ migawka `manual`** — ta pierwsza to tło historii, ta druga cel do klikania.
  Częściowy zapis hurtowy bierze `auto` i tak robi pięć istniejących akcji.
- **`patchRows` kontra `onTreeReplaced` to wybór między poprawką a przeładowaniem.** Remont ciała
  edytora kasuje stan widoku, który owner sam ustawił — wzór z `lessons.md`: „never remount on a
  routine tree change".

## Historical Context (from prior changes)

- `context/changes/2026-09-21-katalog-problems/` (`status: implemented`, ten sam dzień) — bezpośredni
  poprzednik: przeniósł porównanie do memo po stronie przeglądarki, naprawił „raportowanie 3×
  jednej różnicy", skasował serwerową akcję porównania. Stamtąd pochodzą wszystkie liczby budżetu
  wydajności w §1.
- `context/changes/2026-09-20-subcontractor-ceiling-warn/` — sufit 65 % jako ostrzeżenie, nie odmowa.
- `context/foundation/lessons.md:165-168` (zamrożony seed `rows`), `:259-263` (destrukcyjna wymiana
  drzewa owi migawkę `manual`), `:1153-1164` (spec z zamockowanym pisarzem przypina zakazany
  kształt), `:1211-1222` (`captureAutoSnapshot` nie jest spójny transakcyjnie), `:1594-1595` i
  `:1741-1745` (składowany klucz dopasowania).

## Open Questions

1. **Gdzie ląduje nowa akcja** — `src/lib/actions/kosztorys.ts` (pisze do rozpiski) czy
   `work-catalogue.ts` (czyta katalog, i tam już siedzi `insertCatalogueItemsAction`)? Ciąży na
   `work-catalogue.ts`, bo SQL i tak złącza obie tabele.
2. **Czy kolumna checkboxa rozgałęzia `ComparisonTable`, czy dostaje własny wariant** w oknie
   katalogu. Rozgałęzienie dotyka trzech obcych okien; własny wariant duplikuje wyrównania.
3. **Czy „zaznacz wszystkie" dokłada, czy zastępuje.** Precedens katalogu **dokłada**
   (`add-items-from-catalogue-dialog.tsx`), ale tam lista jest filtrowalna, a tu nie.
4. **Czy kawałek (3) w ogóle wchodzi w ten slice**, czy jest osobnym — owner powiedział „kolejne
   tematy osobno", a §6 pokazuje, że ma własny model danych (kandydaci zamiast `hint: string`),
   własne ryzyko (klucz arkusza) i własną kopię UI.
5. **Czy raport ma przestać mówić „brak w katalogu" na 168 wierszach**, których opis jest
   identyczny i różni się tylko j.m. — to nie jest część żadnego z trzech kawałków, ale jest tanią
   poprawką kopii i wychodzi z tego samego pomiaru.
