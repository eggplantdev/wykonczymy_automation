# „Popraw literówki" przejmuje nazwy z tabeli poprawek katalogu prac — plan wdrożenia

## Overview

938 ręcznie przygotowanych poprawek nazw prac trafiło w 2026-09-14 **wyłącznie** do
`work_catalogue_items` i nigdy nie stało się kodem. Ten plan przywraca je jako dane produktowe
i wpina w **dwa** miejsca, które muszą mówić o pracy to samo: w klucz tożsamości (czyli dopasowanie —
import z arkusza Google, okno „Porównaj z katalogiem prac") oraz w przycisk „Popraw literówki"
(czyli tekst, który widzi klient w ofercie).

Kolejność jest odwrotna niż w pierwotnych notatkach: **najpierw tożsamość, potem przycisk.** Przycisk
przepisuje litery, a `itemKey` musi je absorbować, żeby porównanie z arkuszem dalej działało — gdyby
przycisk wszedł pierwszy, przez ten czas rozjeżdżałby rozpiskę z arkuszem. Fold nie zapisuje niczego
do bazy, więc idzie przodem.

## Current State Analysis

- `src/scripts/fix-work-catalogue-texts.ts` i `src/scripts/data/work-catalogue-fixes.tsv`
  zostały skasowane przez `4de2666e` (drive-by w commicie z epilogiem **innej** zmiany). Żyją
  w historii pod `4de2666e^`. Katalog `src/scripts/data/` przestał wtedy istnieć w całości.
- Nagłówek skasowanego skryptu mówi wprost: _„the corrections are data, not code"_. Żadna linia
  kodu nie łączy tabeli z `cleanItemTextsAction` (`src/lib/actions/kosztorys.ts:284`), który wciąż
  woła wyłącznie `cleanDescription` + `cleanUnit`.
- `src/lib/kosztorys/sheet-import/item-key.ts:26` już realizuje dokładnie ten wzorzec dla reguł
  literowych: `TYPO_FIXES` idą do `cleanDescription` w pełni, a ich przefiltrowana pochodna
  `FOLDED_TYPO_FIXES` idzie do `foldDescription`. Tabela nazw wchodzi w ten sam podział.
- `src/lib/kosztorys/sheet-import/columns.ts` nie ma **żadnych** importów (liść grafu), więc
  `clean-description.ts` może zaimportować z niego `fold` bez cyklu.
- `catalogueKey` (`work-catalogue/catalogue-key.ts:21`) i `itemKey` (`item-key.ts:39`) obie stoją na
  `foldDescription` — jedna zmiana w foldzie zbiega obie strony naraz.

### Pomiary na danych (inw. 151 = warsztat szablonu 4, katalog 843 poz., tabela 938 linii)

| pomiar                                                                           | wynik                       |
| -------------------------------------------------------------------------------- | --------------------------- |
| unikalnych kluczy `opis\|j.m.` w tabeli                                          | 938 / 938                   |
| unikalnych **samych opisów** po zdjęciu „[stary arkusz]"                         | 915, **zero** dwuznaczności |
| wpisów, gdzie poprawka to tylko ogonki/wielkość liter (`fold` już je zrównuje)   | 662                         |
| reguł realnie wchodzących do `foldDescription`                                   | **253**                     |
| łańcuchów (`wartość` jest też `kluczem`) po odfiltrowaniu wpisów tożsamościowych | **0**                       |
| kolizji `catalogueKey` na 843 wierszach katalogu pod nowym foldem                | **0**                       |
| unikalnych braków szablonu 4                                                     | 30                          |
| z tego: tabela trafia w nazwę istniejącą dziś w katalogu                         | **24**                      |
| z tego: wpis tożsamościowy (właściciel doprecyzował nazwę w katalogu)            | 5                           |
| z tego: brak wpisu w tabeli                                                      | 1                           |

Kluczowe odkrycie, które zmieniło projekt: **dwuznaczność 16 opisów brała się wyłącznie ze znacznika
„[stary arkusz]", nie z j.m.** Po jego zdjęciu tabela jest jednoznaczna po samym opisie, więc mieści
się w `foldDescription` — funkcji, która j.m. w ogóle nie widzi.

### Key Discoveries:

- `src/lib/kosztorys/sheet-import/item-key.ts:23` — `foldRule` doskleja skrajne spacje z powrotem po
  `fold()`, bo ` parc` → ` prac` jest regułą granicy słowa. Tabela nazw jest **całonazwowa**, więc
  tego problemu nie ma i nie potrzebuje tej obsługi.
- `src/lib/kosztorys/work-catalogue/legacy-marker.ts` — „[stary arkusz]" niesie **750 z 938** celów
  w tabeli. To artefakt przeglądu katalogu, nie część nazwy; do opisu pracy w rozpisce nie może
  trafić i musi zniknąć już na etapie generowania modułu.
- `src/lib/db/work-catalogue.ts:67` — `listCatalogueMatchKeys` istnieje, ale **nie jest tu
  potrzebny**: strażnik „nazwa musi istnieć dziś w katalogu" został świadomie odrzucony (patrz
  „What We're NOT Doing").
- `4de2666e^:src/scripts/fix-work-catalogue-texts.ts` — `resolveCollisions` rozstrzygało kolizje
  `UNIQUE` przy zapisie do katalogu. Tutaj niepotrzebne: ten plan **nie pisze do katalogu**, a fold
  daje 0 kolizji na dzisiejszych danych.

## Desired End State

1. Tabela poprawek nazw żyje w repo jako moduł TypeScript obok `clean-description.ts`, z pełnymi
   915 wpisami dla ścieżki tekstowej i przefiltrowaną pochodną dla ścieżki tożsamości.
2. Okno „Porównaj z katalogiem prac" na `/szablony/4` zgłasza **6** prac spoza katalogu zamiast 30,
   **bez klikania czegokolwiek** — 24 dopasowują się samym foldem.
3. Przycisk „Popraw literówki" poprawia w rozpisce widoczny tekst tych nazw (ogonki, „taśm LED",
   „w kolorze"), a porównanie z arkuszem Google działa po nim tak samo jak przed.
4. Ani jedna kolizja `match_key` w katalogu; `pnpm test:parity` bez zmian.

Weryfikacja: `catalogueKey` po wszystkich wierszach katalogu daje zbiór o liczności równej liczbie
wierszy; komparator na szablonie 4 zwraca 6 braków; przycisk przebiegnięty dwa razy z rzędu daje za
drugim razem 0 zmienionych wierszy.

## What We're NOT Doing

- **Nie ma strażnika „nazwa musi istnieć dziś w katalogu".** Tabela zasila też `foldDescription`,
  która jest funkcją czystą i nigdy nie zajrzy do bazy. Gdyby przycisk pytał katalog, a fold nie,
  oba rozjechałyby się na tych samych danych — a to klasa błędu, dla której `item-key.ts` powstał.
  Na danych szablonu 4 strażnik nie zmienia ani jednej pozycji.
- **Nie ruszamy j.m.** Tabela niesie kanoniczną jednostkę, ale zmiana `szt` → `m2` to nie literówka,
  tylko inna podstawa wyceny. J.m. zostaje przy `cleanUnit` (notacja, `klp` → `kpl`).
- **Nie ma przebiegu hurtowego** po istniejących rozpiskach. Każdy zapis idzie przez snapshot i lock
  inwestycji w `cleanItemTextsAction`, czyli jest odwracalny i widoczny w historii.
- **Nie piszemy do `work_catalogue_items`.** Katalog jest już poprawiony; to rozpiski za nim nie
  nadążyły.
- **Nie dotykamy tych 5 doprecyzowanych prac** („Klejenie paneli winylowych" → _mijanka_ / _jodełka_
  / _układ prosty_). Ich wpisy w tabeli są tożsamościowe, więc wypadną same. Wybór wariantu wymaga
  decyzji człowieka — osobna akcja „przyjmij nazwę z katalogu" w oknie porównania, poza tą zmianą.
- Nie przywracamy `src/scripts/fix-work-catalogue-texts.ts` ani katalogu `src/scripts/data/`.

## Implementation Approach

Tabela wchodzi **dokładnie tym samym wzorcem**, którym dziś wchodzą `TYPO_FIXES` — nowy mechanizm nie
powstaje, rozszerza się istniejący:

```
catalogue-name-fixes.ts   915 par: fold(stara nazwa) → poprawiona nazwa (bez znacznika)
        │
        ├─► clean-description.ts ─► cleanDescription ─► cleanItemTextsAction   (widoczny tekst)
        │                                                   [faza 3]
        └─► item-key.ts (filtr: klucz ≠ wartość, 253) ─► foldDescription
                                                             │
                                          ┌──────────────────┴──────────────────┐
                                     itemKey                              catalogueKey
                              (porównanie z arkuszem)              (okno „Porównaj z katalogiem")
                                                  [faza 2]
```

Różnica wobec `TYPO_FIXES` jest jedna i jest po stronie danych, nie mechanizmu: tamte to podmianki
**fragmentów** (`split/join` po każdej regule, stąd ostrożność typu ` parc` → ` prac`), te to
podstawienia **całej nazwy** — jedno `Map.get`, niezależnie od tego, czy wpisów jest 50 czy 915.

## Critical Implementation Details

**Kolejność faz jest wiążąca.** Faza 3 przed fazą 2 to okno, w którym przycisk przepisuje litery,
których `itemKey` jeszcze nie absorbuje — czyli rozjazd rozpiski z arkuszem Google przy najbliższym
imporcie. Faza 2 sama z siebie nie zapisuje niczego do bazy, więc jest bezpieczna do wypuszczenia
osobno; faza 3 bez niej nie jest.

**Wpisy tożsamościowe muszą zostać w module, a wypaść dopiero w pochodnej.** 662 z 915 poprawek to
same ogonki — `fold` je zrównuje, więc dla tożsamości są szumem, ale dla klienta czytającego ofertę
to właśnie one („farba silikonowa" → „farbą silikonową"). Filtr `klucz !== wartość` należy do
pochodnej w `item-key.ts`, nigdy do samej tabeli. Ten sam podział, ta sama linia:
`item-key.ts:28`.

**Idempotencja stoi na tym filtrze.** W surowej tabeli jest 8 łańcuchów (`motnaz tv` → `montaz tv`,
gdzie `montaz tv` jest osobnym kluczem o wartości równej sobie). Wszystkie znikają po odfiltrowaniu
wpisów tożsamościowych — ale to jest własność **dzisiejszych danych**, nie gwarancja konstrukcji,
więc pilnuje jej test, nie komentarz.

## Phase 1: Tabela poprawek jako moduł produktowy

### Overview

Odzyskanie TSV z historii i wygenerowanie z niego modułu TypeScript. Faza bez zmian zachowania —
moduł powstaje, nikt go jeszcze nie woła.

### Changes Required:

#### 1. Moduł tabeli

**File**: `src/lib/kosztorys/catalogue-name-fixes.ts` (nowy)

**Intent**: Przenieść 938 ręcznie przygotowanych poprawek nazw z historii gita do repo jako dane
produktowe. Dziś są nieosiągalne dla kodu — leżą w skasowanym pliku wejściowym skryptu
jednorazowego.

**Contract**: Eksportuje `CATALOGUE_NAME_FIXES: ReadonlyMap<string, string>`, gdzie kluczem jest
`fold()` starej nazwy (część opisowa klucza z TSV, bez członu j.m.), a wartością poprawiona nazwa
**z usuniętym znacznikiem „[stary arkusz]"**. 915 wpisów. Nagłówek pliku wskazuje pochodzenie:
`4de2666e^:src/scripts/data/work-catalogue-fixes.tsv` oraz commit `61ae1aa5`, który tabelę wprowadził.

Generowanie jest **jednorazowym aktem implementacji**, nie krokiem builda — TSV zostaje w historii,
do repo wraca gotowy moduł. Transformacja: `cut -f1` → odetnij ostatni człon po `|` → klucz;
`cut -f4` → zdejmij „[stary arkusz]" → wartość; deduplikuj (16 opisów ma dwa wiersze różniące się
wyłącznie znacznikiem, po jego zdjęciu zbiegają się na tę samą wartość).

#### 2. Test kształtu tabeli

**File**: `src/__tests__/lib/kosztorys/catalogue-name-fixes.test.ts` (nowy)

**Intent**: Tabela jest danymi wklejonymi hurtem, więc jej niezmienniki muszą być sprawdzalne
maszynowo, a nie opisane w komentarzu. Trzy z nich są nośne dla faz 2 i 3.

**Contract**: Asercje na `CATALOGUE_NAME_FIXES`:

- klucze są **stabilne pod `fold`** (`fold(klucz) === klucz`) — inaczej `foldDescription` nigdy w nie
  nie trafi;
- żadna wartość nie niesie „[stary arkusz]" (`hasLegacyMarker` z `work-catalogue/legacy-marker.ts`);
- pochodna przefiltrowana `klucz !== fold(wartość)` **nie zawiera łańcuchów** — żadna jej wartość nie
  jest jej kluczem. To jest własność, na której stoi idempotencja folda w fazie 2.

### Success Criteria:

#### Automated Verification:

- Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/catalogue-name-fixes.test.ts`
- Tabela ma 915 wpisów (asercja w tym samym specu)

#### Manual Verification:

- Nagłówek modułu pozwala odtworzyć pochodzenie: podane SHA-e faktycznie prowadzą do TSV i do
  commita, który tabelę wprowadził

---

## Phase 2: Tożsamość — fold absorbuje poprawki nazw

### Overview

`foldDescription` wciąga przefiltrowaną tabelę, przez co `itemKey` i `catalogueKey` zbiegają się
naraz. Faza bez zapisu do bazy: zmienia się wyłącznie sposób liczenia kluczy w pamięci.

### Changes Required:

#### 1. Pochodna tabeli w foldzie

**File**: `src/lib/kosztorys/sheet-import/item-key.ts`

**Intent**: Doprowadzić do tego, żeby praca zapisana starą nazwą i ta sama praca zapisana nazwą
poprawioną liczyły się na ten sam klucz — tak samo, jak `FOLDED_TYPO_FIXES` robi to dziś dla reguł
literowych. To jest ten warunek, bez którego przycisk z fazy 3 zrywa porównanie z arkuszem Google.

**Contract**: Obok `FOLDED_TYPO_FIXES` powstaje przefiltrowana pochodna `CATALOGUE_NAME_FIXES`
(`fold(wartość)`, odrzuć wpisy gdzie klucz === wartość — 253 z 915). `foldDescription` po dotychczasowym
`reduce` po `FOLDED_TYPO_FIXES` wykonuje **jedno** podstawienie całonazwowe z tej mapy.

Kolejność jest istotna: reguły fragmentowe idą **pierwsze**, bo klucze tabeli zostały wyliczone
`foldDescription`-em z commita `61ae1aa5`, czyli po ich zastosowaniu.

#### 2. Kontrola kolizji na dzisiejszym katalogu

**File**: `src/__tests__/lib/db/work-catalogue-key-collisions.test.ts` (nowy, DB-backed)

**Intent**: Zmiana folda przesuwa `catalogueKey` **każdego** wiersza katalogu. Dwa wiersze, które
dotąd różniły się tylko literówką, mogą teraz liczyć się identycznie — a `match_key` ma `UNIQUE`,
więc ponowny seed albo wstawka z katalogu padłaby na produkcji, nie w teście. Pomiar mówi 0 kolizji
na 843 wierszach, ale to własność danych, nie kodu, więc pilnuje jej test.

**Contract**: Spec pod `scripts/test-integration.sh` (baza `db-test` na 5435, przywrócona z dumpa
produkcji). Czyta `listCatalogueItems(db)`, liczy `catalogueKey(description, unit)` dla każdego
wiersza i asertuje, że zbiór kluczy ma liczność równą liczbie wierszy. Przy kolizji wypisuje
kolidujące pary — sam licznik nie powiedziałby, co naprawić.

#### 3. Uzupełnienie speców klucza

**File**: `src/__tests__/lib/kosztorys/sheet-import/item-key.test.ts`,
`src/__tests__/lib/kosztorys/work-catalogue/catalogue-key.test.ts`

**Intent**: Przypiąć zbieżność obu stron do konkretnego przypadku z produkcji, żeby regresja nie
przeszła jako „test dalej zielony, tylko okno znowu zgłasza braki".

**Contract**: Po jednym przypadku na stronę, na realnych danych: „Lutowanie taśm ledowych" i
„Lutowanie taśm LED" dają ten sam `itemKey` w tej samej sekcji, i ten sam `catalogueKey` przy
`pkt`. Plus dowód idempotencji: `foldDescription(foldDescription(x)) === foldDescription(x)` dla
przypadku, który w surowej tabeli tworzył łańcuch („motnaz tv").

### Success Criteria:

#### Automated Verification:

- Specy klucza przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/item-key.test.ts src/__tests__/lib/kosztorys/work-catalogue/catalogue-key.test.ts`
- Spec kolizji przechodzi przeciw `db-test`: `pnpm test:integration`
- Komparator katalogu bez regresji: `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/build-catalogue-comparison.test.ts`
- Porównanie z arkuszem bez regresji: `pnpm exec vitest run src/__tests__/lib/kosztorys/sheet-import/build-sheet-comparison.test.ts src/__tests__/lib/kosztorys/sheet-import/build-import-plan.test.ts`

#### Manual Verification:

- `/szablony/4` → „Porównaj z katalogiem prac" pokazuje 6 prac spoza katalogu zamiast 30, **bez
  klikania „Popraw literówki"**
- Pozostała szóstka to te 5 doprecyzowanych wariantów plus „Dwukrotne gruntowanie ścian, sufitów
  i podłóg"
- Import z arkusza Google na inwestycji z podpiętym arkuszem nie zaczyna zgłaszać prac jako nowych

---

## Phase 3: Przycisk podnosi poprawioną nazwę

### Overview

`cleanDescription` dostaje pełną tabelę (915 wpisów, z tożsamościowymi włącznie), więc przycisk
poprawia to, co widzi klient — nie tylko to, co dopasowuje system.

### Changes Required:

#### 1. Krok całonazwowy w cleanDescription

**File**: `src/lib/kosztorys/clean-description.ts`

**Intent**: Dołożyć do przycisku te poprawki, których reguła fragmentowa nie jest w stanie wyrazić —
brakujące ogonki, przeniesienia wierszy z KNR, „taśm ledowych" → „taśm LED". Na szablonie 4 same
reguły literowe poprawiają **0 z 30** opisów; tabela poprawia 24.

**Contract**: `cleanDescription` po `TYPO_FIXES`, a **przed** `unshout`/`sentenceCase`, podnosi
`CATALOGUE_NAME_FIXES.get(fold(tekst))`; przy trafieniu zwraca wartość z tabeli, w przeciwnym razie
idzie dalej dotychczasową ścieżką. Wymaga importu `fold` z `sheet-import/columns` —
`columns.ts` nie ma żadnych importów, więc cyklu nie ma.

Podstawienie idzie **przed** `unshout`, bo wartości w tabeli są już zapisane docelową wielkością
liter i to one mają wygrać. Funkcja zostaje idempotentna: wartości nie są kluczami (asercja
z fazy 1).

#### 2. Spec przycisku

**File**: `src/__tests__/lib/kosztorys/clean-description.test.ts` (nowy)

**Intent**: `clean-description.ts` nie ma dziś ani jednego specu (jest tylko `clean-unit.test.ts`),
a właśnie dostaje drugie źródło prawdy. Ryzyko jest konkretne: podstawienie całonazwowe zjadające
przypadek, który dotąd obsługiwał `unshout` albo `sentenceCase`.

**Contract**: Trafienie w tabelę („lutowanie tasm ledowych" → „Lutowanie taśm LED"); pudło
przechodzące starą ścieżką („TRANSPORT I WNIESIENIE MATERIAŁÓW…" → sentence case); idempotencja
(`cleanDescription(cleanDescription(x)) === cleanDescription(x)` dla obu); brak „[stary arkusz]"
w wyniku dla nazwy, której wpis w tabeli ten znacznik niósł.

### Success Criteria:

#### Automated Verification:

- Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/clean-description.test.ts`
- J.m. bez zmian: `pnpm exec vitest run src/__tests__/lib/kosztorys/clean-unit.test.ts`

#### Manual Verification:

- Na `/szablony/4` przycisk „Popraw literówki" zmienia opisy 24 prac; w oknie porównania zostaje 6
- Drugie kliknięcie pod rząd raportuje 0 poprawionych pozycji
- Snapshot sprzed kliknięcia jest na liście i przywraca stare opisy
- Żaden opis w rozpisce nie dostaje „[stary arkusz]"
- J.m. po kliknięciu jest taka sama jak przed, poza `klp` → `kpl`

---

## Testing Strategy

### Unit Tests:

- Kształt tabeli: liczność, stabilność kluczy pod `fold`, brak znacznika w wartościach, brak
  łańcuchów w pochodnej (faza 1)
- Zbieżność `itemKey` / `catalogueKey` na parze stara/nowa nazwa; idempotencja `foldDescription`
  (faza 2)
- `cleanDescription`: trafienie, pudło, idempotencja, brak znacznika (faza 3)

### Integration Tests:

- Unikalność `catalogueKey` po 843 wierszach katalogu przeciw `db-test` — jedyny test, który może
  złapać kolizję `UNIQUE` **zanim** trafi w produkcję (faza 2)

### Manual Testing Steps:

1. `/szablony/4` → „Porównaj z katalogiem prac" — policzyć braki przed i po fazie 2 (30 → 6)
2. Kliknąć „Popraw literówki", sprawdzić opisy 24 prac i ponownie okno porównania
3. Kliknąć drugi raz — musi zgłosić 0 poprawionych
4. Przywrócić snapshot sprzed kliknięcia, sprawdzić że stare opisy wracają
5. Na inwestycji z podpiętym arkuszem Google uruchomić porównanie z arkuszem — nic nie może zacząć
   się zgłaszać jako nowa praca

## Performance Considerations

915 wpisów jako `Map` to jedno `get` na opis, niezależnie od rozmiaru tabeli — w odróżnieniu od
`TYPO_FIXES`, gdzie każda reguła to osobne `split/join` po całym tekście. Przy rozpisce 1000+ pozycji
(zwykły rozmiar, patrz `context/foundation/lessons.md`) to 1000 odczytów z mapy zamiast 1000 × 253
przebiegów po stringu. Moduł jest server-only; nie trafia do bundla klienta.

## Migration Notes

Brak migracji — plan nie zmienia schematu ani nie pisze do `work_catalogue_items`. Kolumna
`match_key` przechowuje klucze **wyliczone przy zapisie**, więc zmiana folda nie unieważnia istniejących
wierszy; ryzyko dotyczy wyłącznie **nowych** zapisów (seed katalogu, wstawka pracy z katalogu,
`item-to-catalogue`) i jest przykryte specem kolizji z fazy 2.

Jeśli spec kolizji kiedyś zapali się na innej bazie niż lokalna: `resolveCollisions`
w `4de2666e^:src/scripts/fix-work-catalogue-texts.ts` ma gotową regułę rozstrzygania (wygrywa wiersz
bez „[stary arkusz]", przy remisie niższe id).

## Whole-tree Gate

- Typecheck przechodzi: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`
- Pełny zestaw przechodzi: `pnpm test`
- Golden master bez zmian: `pnpm test:parity`
- Build przechodzi: `pnpm build`

## References

- Notatki i diagnoza: `context/changes/2026-09-15-clean-texts-catalogue-names/change.md`
- Tabela źródłowa: `4de2666e^:src/scripts/data/work-catalogue-fixes.tsv`
- Skrypt, który tabelę zastosował do katalogu: `4de2666e^:src/scripts/fix-work-catalogue-texts.ts`
- Commit wprowadzający poprawki katalogu: `61ae1aa5`
- Commit kasujący oba pliki (drive-by): `4de2666e`; odnotowane w
  `context/archive/2026-09-14-drag-drop-guard/review-gate.md`
- Wzorzec, który ta zmiana powtarza: `src/lib/kosztorys/sheet-import/item-key.ts:26`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Tabela poprawek jako moduł produktowy

#### Automated

— ae010767

- [x] 1.1 Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/catalogue-name-fixes.test.ts` — ae010767
- [x] 1.2 Tabela ma 915 wpisów (asercja w tym samym specu)

### Phase 2: Tożsamość — fold absorbuje poprawki nazw

#### Automated

- [ ] 2.1 Specy klucza przechodzą (`item-key.test.ts`, `catalogue-key.test.ts`)
- [ ] 2.2 Spec kolizji przechodzi przeciw `db-test`: `pnpm test:integration`
- [ ] 2.3 Komparator katalogu bez regresji: `build-catalogue-comparison.test.ts`
- [ ] 2.4 Porównanie z arkuszem bez regresji: `build-sheet-comparison.test.ts`, `build-import-plan.test.ts`

### Phase 3: Przycisk podnosi poprawioną nazwę

#### Automated

- [ ] 3.1 Nowy spec przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/clean-description.test.ts`
- [ ] 3.2 J.m. bez zmian: `pnpm exec vitest run src/__tests__/lib/kosztorys/clean-unit.test.ts`
