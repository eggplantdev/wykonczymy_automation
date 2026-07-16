# „Pomiar z natury" z sumy etapów; kotwica w Przedmiarze — Implementation Plan

> Przeplanowane od zera 2026-07-16 po rozstrzygnięciu [EX-494](https://linear.app/ex-plant/issue/EX-494).
> Poprzednia wersja (commit `848f61f`) miała poprawioną kotwicę, ale **kształt** — trzy fazy po
> warstwach — wyrósł z modelu, w którym „Pomiar z natury" był wpisywany. Ten plan kroi po **figurze**:
> każda faza dowozi jedną obserwowalną zmianę i kończy się zielono. Pełny wywód: `change.md`.
>
> Świadomie otwarte: **[EX-495](https://linear.app/ex-plant/issue/EX-495)** — czy „Pozostało" ma
> pokazywać kwotę z minusem, czy sam procent. Nie blokuje.

## Overview

Arkusz właściciela ma **dwa wejścia**: Przedmiar (wpisywany) i etapy (wpisywane). Nasz edytor ma
**trzy** — „Pomiar z natury" jest u nas czwartym niezależnym polem tam, gdzie w arkuszu jest formuła
`=SUM(D:M)`. Cała rozbieżność bierze się z tej jednej liczby.

Zmiana usuwa trzecie wejście i przestawia kotwice:

1. **„Pomiar z natury" przestaje być wpisywany** — jest sumą etapów. Kolumna zostaje, read-only.
2. **Wszystko, co mierzy postęp, kotwiczy się w Przedmiarze** — „Pozostało", licznik „Wykonano",
   „% wykonania", „%" etapu, próg czerwieni.
3. **„Wartość netto przedmiar" zaczyna obejmować rabat** — dziś go pomija, arkusz go stosuje.
4. **Trzecie wejście znika z bazy** — migracja kasuje kolumnę, blokada kasowania i kopie zapasowe
   przestają ją znać.

## Current State Analysis

| figura w UI                | dziś                                                                 | arkusz                     | wyrok                                                    |
| -------------------------- | -------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| „Wartość netto przedmiar"  | `plannedQty × cena`, **bez rabatu** (`calc.ts:72`)                   | `S = N×Q − N×Q×R`          | **rozbieżność**                                          |
| „Pomiar z natury"          | pole wpisywane (`measuredQty`)                                       | `O = SUM(D:M)`             | **rozbieżność** — źródło wszystkich pozostałych          |
| „Wartość netto" wiersza    | `measuredQty × cena − rabat`, chyba że pomiar = 0 (`v2-rows.ts:346`) | `T = O×Q − O×Q×R`          | zbiegnie się **samo**, gdy pomiar stanie się sumą etapów |
| „Pozostało do rozliczenia" | `wartość − wykonane` (`v2-rows.ts:356`)                              | `AF = T − Σ(V:AE)` ≡ **0** | arkusz ma tu skamielinę — **nie kopiujemy**              |
| licznik „Wykonano"         | `doneNet / totalNet` (`kosztorys-progress-counter.tsx:35`)           | brak odpowiednika          | mianownik → Przedmiar                                    |
| „% wykonania" wiersza      | `Σ etapów / measuredQty` (`calc.ts:128`)                             | brak odpowiednika          | mianownik → Przedmiar (patrz Key Discoveries)            |

### Key Discoveries

- **Cztery figury to ta sama operacja z inną ilością.** `rowNetForView` (`calc.ts:56`),
  `rowPlannedNetForView` (`:72`), `stageValueForView` (`:98`), `rowDiscountForView` (`:81`) robią
  `applyDiscount(qty × viewPrice)` i różnią się wyłącznie tym, skąd biorą ilość. Stąd prymityw.
- **`rowPlannedNetForView` jako jedyna nie woła `applyDiscount`** — to jest ta rozbieżność z `S`.
  Prymityw usuwa ją mimochodem: figura przestaje mieć własną arytmetykę, więc nie ma jak pominąć rabatu.
- **`rowTotalQtyDone` już istnieje** (`v2-rows.ts:328`). To jest nasze `O`.
- **Rozgałęzienie w `rowValueForView` znika samo.** Po zmianie `rowNetForView`, `rowDoneNetForView`
  i `rowValueForView` liczą **dokładnie to samo**. Trzy nazwy na jedną figurę → zostaje jedna.
- **„% wykonania" wiersza zdegeneruje do 100% na każdym wierszu, jeśli go nie przestawimy.** Dziś
  `Σ etapów / measuredQty`; po zmianie mianownik **jest** licznikiem → `Σ/Σ = 1`, zawsze. To ta sama
  degeneracja, którą właściciel rozstrzygnął dla „Pozostało" i licznika. Ta sama uwaga dotyczy „%"
  pojedynczego etapu: przy mianowniku `Σ etapów` procenty etapów zawsze sumują się do 100%, przy
  mianowniku `Przedmiar` sumują się do „% wykonania" wiersza — czyli mówią coś prawdziwego.
  Właściciel potwierdził mianownik = **Przedmiar** (2026-07-16).
- **Blokada kasowania czyta „Pomiar z natury" — i po zmianie zamurowałaby wiersze.** Serwer
  (`actions/kosztorys.ts:186`, `:297`) i klient (`v2-rows.ts:22`) blokują usunięcie, gdy
  `measured_qty <> 0` **lub** jest wpisany etap. Stara liczba zostaje w bazie, więc wiersz z zerowymi
  etapami stałby się nieusuwalny na zawsze, z komunikatem każącym wyczyścić wartość, której nie da się
  już wpisać. **Fazy 1 nie wolno zamknąć bez tej poprawki.**
- **Kopie zapasowe i szablony niosą tę liczbę osobno.** `restore-kosztorys.ts:61,65` odtwarza ją
  dosłownie z `INSERT`a, `apply-preset.ts:49,53` tak samo, `serialize-preset.ts:17` ją zeruje.
  Po zmianie odtworzona liczba kłóciłaby się z odtworzonymi etapami.
- **Read-only kolumna jest tania** — `computedColumn` (`kosztorys-v2-columns.tsx:230`) to gotowa
  fabryka (`disabled: true` + własny `component`), używana przez kilkanaście kolumn, z `fmtOrDash`
  (`:228`) renderującym `null` jako „—". Faza UI jest znacznie lżejsza, niż zakładał stary plan.
- **Ścieżka zapisu ucichnie sama.** `diffRow` (`v2-rows.ts:87`) iteruje **wyłącznie** po `ITEM_FIELDS`
  (`:35`); pole spoza tej listy jest dla zapisu niewidzialne. Usunięcie `measuredQty` z `ItemPatchT`
  - `ITEM_FIELDS` odcina zapis strukturalnie, nie przez dyscyplinę.
- **Sortowanie nie umie `null`.** `sortRows` (`v2-rows.ts:128`) przyjmuje `string | number`; `null`
  wpadłby w gałąź numeryczną i posortował się jako `0` — czyli „—" udawałoby wiersz domknięty.
  Konwencja „null → kreska" istnieje w formatowaniu i **nie ma odpowiednika w sortowaniu**.
- **Zero testów przeglądarkowych dla edytora** — `e2e/` nie zna słowa „kosztorys".
- **`measuredQty` nie ma dolnego ograniczenia w walidacji** (`actions/kosztorys.ts:21` —
  `z.coerce.number()` bez `.min(0)`, w odróżnieniu od `investmentVatSchema:56`). Ujemny pomiar
  przechodzi. Problem znika razem z polem.
- **Nic nie pisze tej liczby do arkusza Google.** Jedyny styk to jednorazowy skrypt seedujący
  (`seed-kosztorys.ts:109`) — czyta kolumnę `J` arkusza i zapisuje do bazy, w jedną stronę.

## Desired End State

```
Przedmiar        (wpisywany)     → „Wartość netto przedmiar"  = applyDiscount(Przedmiar × cena)   [= S]
etapy            (wpisywane)     → „Pomiar z natury"          = Σ etapów            (read-only)   [= O]
                                 → „Wartość netto"            = applyDiscount(Σ etapów × cena)    [= T]
                                 → „Pozostało do rozliczenia" = S − T          („—" bez Przedmiaru)
                                 → licznik „Wykonano"         = ΣT / ΣS
                                 → „% wykonania"              = Σ etapów / Przedmiar
                                 → czerwień                   = Σ etapów > Przedmiar
```

Obie kwoty istnieją **równolegle**, jak `S456` i `T456` w stopce arkusza — nic nie trzeba wybierać.

Weryfikacja na wierszu — Przedmiar 100, etapy 95, cena 50, bez rabatu:
„Wartość netto przedmiar" = 5000, „Pomiar z natury" = 95 (read-only), „Wartość netto" = 4750,
„Pozostało" = 250, „Wykonano" = 95%. Przy etapach 105: „Pozostało" = −250, „Wykonano" = 105%,
wiersz **czerwony**.

## What We're NOT Doing

- **Nie kopiujemy skamieliny `AF`** — w arkuszu „pozostało do rozliczenia" jest tożsamościowo zerem,
  bo kotwiczy w `T`. Nasza kotwiczy w `S` i dlatego żyje. Świadome zerwanie parytetu, w jedną stronę.
- **Nie piszemy testu przeglądarkowego** — siatka nie ma dziś żadnego, a budowanie pierwszego przy
  okazji zmiany obliczeniowej to osobna robota. Do backlogu (`e2e-backlog`).
- **Nie ratujemy starych kopii zapasowych ani szablonów** — dane kosztorysu są throwaway do czasu
  wejścia dogfoodingu na `main` (`AGENTS.md` → „Databases And Live Data"). Kasujemy wpisy, nie piszemy
  dla nich ścieżki zgodności.
- **Nie ruszamy globalnego rabatu** (`kosztorys-global-discount`) ani roadmap 12(b) („suma etapu").
- **Nie poprawiamy błędu `Z8` w arkuszu** — to nie nasz plik; port go nie odtwarza i o to chodzi.
- **Nie dodajemy walidacji ujemnych ilości** — problem znika razem z polem; etapy to osobne zadanie.

## Implementation Approach

**Kroimy po figurze, nie po warstwie.** Każda faza bierze jedną obserwowalną zmianę, zaczyna od testu,
który **pod dzisiejszą regułą pada**, i kończy zielono — typecheck włącznie. To jest jedyna różnica
kształtu wobec poprzedniej wersji planu, i jest celowa: podział na warstwy wymuszał kilka faz czerwonej
kompilacji, bo sygnatury w warstwie cenowej łamią wołających do czasu przestawienia UI.

Rdzeń architektoniczny zostaje: wyciągnąć z `calc.ts` prymityw `netForQtyForView(row, qty, view)`
= `applyDiscount(qty × cena)` i przestawić wszystkie figury tak, żeby **ilość przychodziła z zewnątrz**.
`calc.ts` przestaje mieć zdanie o tym, która ilość jest prawdą — decyzja przenosi się do `v2-rows.ts`,
jedynej warstwy znającej etapy. Granica z EX-489 się przez to **zacieśnia, nie rozmywa**.

## Critical Implementation Details

**Test musi być falsyfikujący, inaczej nie jest testem.** Dzisiejsza suita zostanie zielona po zmianie
— sonda to potwierdziła i **rozszerzyła**: blok `kosztorys-v2-rows.test.ts:329-357`, który istnieje
_specjalnie_ po to, żeby pilnować licznika przed regresją 150% z EX-489, ma etapy równe pomiarowi, więc
po zmianie liczy `1/1` i jest **tautologią** — nie potrafi wykryć reguły, której miał bronić. Cały
`kosztorys-calc.test.ts` jest odporny **typem** (`ViewPricingT` nie zna etapów). Nowe fixture'y **muszą**
mieć `Σ etapów ≠ Przedmiar`, a licznik musi być testowany na kosztorysie **nie-domkniętym**.

**Dzielenie przez zero.** Udział etapu dzieli przez `Σ etapów`. Guard **musi być `> 0`, nie `!== 0`** —
wyczyszczona komórka zapisuje `null`, który strict equality przepuszcza w dzielenie (`calc.ts:106`).

**Blokada kasowania jest sprzężona z fazą 1**, nie z fazą 4. Faza 1 tworzy nieusuwalne wiersze; faza 1
je naprawia. Żadna faza nie zostawia edytora w stanie gorszym niż zastała.

---

## Phase 1: „Pomiar z natury" staje się sumą etapów

### Overview

Trzecie wejście przestaje istnieć jako wejście. Prymityw, ilość z zewnątrz, kolumna read-only, zapis
odcięty strukturalnie, blokada kasowania przestawiona na etapy.

### Changes Required:

#### 1. Czerwone testy — najpierw

**File**: `src/__tests__/kosztorys-v2-rows.test.ts`, `src/__tests__/kosztorys-calc.test.ts`

**Intent**: Test, który przechodzi pod obiema regułami, nie jest dowodem, że zmiana weszła. Zaczynamy
od asercji, które **dziś padają**.

**Contract**:

- Fixture z `measuredQty` **sprzecznym** z sumą etapów (np. `measuredQty: 999`, etapy `[4, 0]`,
  Przedmiar 10, cena 100) → „Wartość netto" = `400`. Dziś zwróci `99 900`. _Ten test jest rusztowaniem
  — umiera razem z polem w fazie 4; wtedy jego rolę przejmuje typ._
- Niezmiennik udziału: `Σ stageValueForView(row, qtyᵢ, Σqty, view) === netForQtyForView(row, Σqty, view)`
  dla rabatu **procentowego i kwotowego**, na **trzech** widokach ceny. Fixture: `Σ etapów ≠ Przedmiar`.
- Guard: `Σ etapów = 0` → wartość etapu `0`, bez `NaN`/`Infinity`. Osobno `Σ etapów = null`.
- Blokada kasowania: wiersz z zerowymi etapami i **niezerowym** `measuredQty` → **da się skasować**.

#### 2. Prymityw ilości

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Wydzielić operację „ile warta jest dowolna ilość tego wiersza, po rabacie" — dziś zaszytą
kilkakrotnie, raz z `measuredQty` na sztywno, raz (w figurze przedmiaru) **bez rabatu w ogóle**.

**Contract**: `export function netForQtyForView(row: ViewPricingT, qty: number, view: PriceViewT): number`
= `applyDiscount(qty * viewPrice(row, view), row)`.

`rowNetForView` (`:56`) **znika** — czytała `row.measuredQty`, a ta ilość przestaje istnieć jako
niezależne wejście. `rowDiscountForView` (`:81`) dostaje ilość parametrem:
`rowDiscountForView(row, qty, view)` = `qty * viewPrice(row, view) - netForQtyForView(row, qty, view)`.
Kolumna „Rabat wart." musi iść za etapami — inaczej pokaże rabat naliczony od ilości, której nikt nie użył.

Docstring `:5-15` przepisać: warstwa cenowa przestaje wiedzieć cokolwiek o pomiarze. Zdanie
„never treat rowNetForView as the row's value" traci desygnat — funkcji nie ma.

#### 3. `stageValueForView` — udział od sumy etapów

**File**: `src/lib/kosztorys/calc.ts:98`

**Intent**: Mianownik udziału przestaje być polem, staje się sumą etapów. Mechanizm udziału (rabat
kwotowy nie może się odjąć raz na etap) zostaje — zmienia się tylko to, względem czego liczymy.

**Contract**: `stageValueForView(row, qtyInStage: number, totalQty: number, view): number`
= `netForQtyForView(row, totalQty, view) * (qtyInStage / totalQty)`, guard `if (!(totalQty > 0)) return 0`.

Guard zwraca **`0`, nie `qtyInStage × cena`** jak dziś, i to jest właściwa zmiana, nie uproszczenie:
gałąź „brak pomiaru → etap stoi na własnej ilości" (`:107`) istniała **wyłącznie** dlatego, że pomiar
i etapy mogły się rozjechać. Skoro `totalQty` **jest** sumą etapów, to `totalQty = 0` znaczy, że każdy
etap jest zerowy — łącznie z tym. Gałąź znika razem ze swoją przyczyną.

Docstring `:85-97`: rationale o rabacie kwotowym **zostaje w mocy**. „Not sheet parity" też — arkusz
nigdy nie znał rabatu kwotowego.

#### 4. `rowValueForView` — koniec gałęzi, koniec duplikatów

**File**: `src/lib/kosztorys/v2-rows.ts:346`

**Intent**: Usunąć `if (row.measuredQty > 0)`. „Pomiar z natury" **jest** sumą etapów, więc gałąź nie ma
czego wybierać.

**Contract**: `rowValueForView(row, stages, view)` = `netForQtyForView(row, rowTotalQtyDone(row, stages), view)`.
Liczone **wprost z prymitywu, nie przez `Σ stageValueForView`** — udziały sumują się do 1, więc reduce
po etapach dałby ten sam wynik drożej i z błędem zaokrągleń.

`rowDoneNetForView` (`:317`) staje się **identyczna** → usunąć, przekierować wołających (`:361`, `:417`,
`:428`, `use-kosztorys-editor.ts:84`) na `rowValueForView`. Docstring `:332-345` przepisać — opisuje
regułę „wiersz bez pomiaru", której nie będzie.

#### 5. Kolumna read-only + odcięcie zapisu

**File**: `src/lib/tables/kosztorys-v2-columns.tsx:603`, `src/types/kosztorys.ts:53`,
`src/lib/kosztorys/v2-rows.ts:39`

**Intent**: Sedno decyzji właściciela. Kolumna zostaje widoczna (pokazuje łączną ilość — użyteczne),
ale przestaje przyjmować wpisy.

**Contract**: `keyCol('measuredQty', floatColumnLeft, …)` → `computedColumn('measuredQty', …, (r) => rowTotalQtyDone(r, stages))`.
`stages` muszą być w zasięgu — są (`:630`). Tooltip w `HEADER_TIPS` (`:154`) mówi dziś
„Netto = Pomiar × Cena − Rabat"; przepisać: liczone automatycznie z sumy etapów.

Zapis odcinamy **strukturalnie**: usunąć `measuredQty` z `ItemPatchT` (`types/kosztorys.ts:53`),
z `ITEM_FIELDS` (`v2-rows.ts:39`) i z `itemPatchSchema` (`actions/kosztorys.ts:21`). `diffRow` iteruje
wyłącznie po `ITEM_FIELDS`, więc po tym usunięciu żadna edycja nie ma jak trafić do zapisu — to
gwarancja typu, nie dyscyplina. Pole zostaje na `KosztorysItemT` do fazy 4 (kolumna jeszcze w bazie).

#### 6. Blokada kasowania — tylko etapy

**File**: `src/lib/actions/kosztorys.ts:186,297`, `src/lib/kosztorys/v2-rows.ts:21`

**Intent**: Bez tego faza 1 tworzy wiersze nieusuwalne na zawsze: stara liczba zostaje w bazie, blokuje
kasowanie, a komunikat każe wyczyścić wartość, której nie da się już ani wpisać, ani skasować. Ślepy
zaułek. Decyzja właściciela: **„zajęty" znaczy „ma wpisany etap"**.

**Contract**: z obu predykatów SQL (`removeSectionAction:186`, `removeItemAction:297`) wypada człon
`i.measured_qty <> 0`; zostaje wyłącznie sprawdzenie postępu etapów. `isRowPopulated` (`v2-rows.ts:21`)
— klienckie lustro tego predykatu — traci `if (row.measuredQty !== 0) return true`. **Oba muszą zmienić
się razem**; komentarz `:17-20` mówi wprost, że lustro ma się zgadzać z serwerem.

Skutek uboczny do przyjęcia: wiersz z wpisanym Przedmiarem i zerowymi etapami skasujesz jednym
kliknięciem, razem z przedmiarem. Właściciel wybrał to świadomie (2026-07-16) — alternatywa (blokada
też na Przedmiarze) łapałaby niemal każdy wiersz w gotowym kosztorysie.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe przechodzą: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts src/__tests__/kosztorys-v2-rows.test.ts`
- Testy blokady kasowania przechodzą: `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-delete-guard.test.ts`
- Typecheck przechodzi: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`

#### Manual Verification:

- „Pomiar z natury" nie przyjmuje wpisu; edycja etapu zmienia go natychmiast
- Wiersz z zerowymi etapami da się skasować, nawet jeśli ma za sobą historię pomiaru

---

## Phase 2: Kotwica w Przedmiarze

### Overview

Wszystko, co mierzy postęp, przestaje dzielić liczbę przez siebie. „Pozostało", licznik, „% wykonania",
„%" etapu, próg czerwieni — jeden mianownik: Przedmiar.

### Changes Required:

#### 1. Czerwone testy — najpierw

**File**: `src/__tests__/kosztorys-v2-rows.test.ts`

**Intent**: Ta faza usuwa pięć degeneracji naraz; każda ma paść osobno, zanim ją naprawimy.

**Contract**: przy Przedmiar 100 / etapy 95 / cena 50, bez rabatu:

- „Pozostało" = `250`; przy etapach `105` → `−250`. Dziś oba zwrócą `0`.
- „Pozostało" = `null` przy Przedmiarze `0` i `null`.
- Sortowanie po „Pozostało": wiersze z `null` **na końcu**, w obu kierunkach.
- „% wykonania" = `0.95`, nie `1`. Przy etapach `105` → `1.05`, **nieucięte**.
- Czerwień zapala się przy `Σ etapów > Przedmiar`, **nie** zapala przy braku Przedmiaru.
- Licznik na kosztorysie **nie-domkniętym**: `Σ etapów ≠ Przedmiar` w każdym wierszu. Blok
  `:329-357` ma dziś `Σ etapów == measuredQty` i po zmianie liczyłby `1/1` — **przepisać fixture**,
  nie dopisywać obok. To jest test, który miał bronić przed regresją 150% i po cichu przestałby cokolwiek robić.

#### 2. „Pozostało" — kotwica, kreska, sortowanie

**File**: `src/lib/kosztorys/v2-rows.ts:356`, `:128`, `src/components/kosztorys/use-kosztorys-editor.ts:72-90`

**Intent**: „Pozostało" przestaje zależeć od „Wartość netto" (co dałoby `x − x = 0` na każdym wierszu —
dokładnie skamielina `AF` z arkusza) i kotwiczy się w Przedmiarze. Znaczenie: _ile z oferty zostało_.
Ujemna wartość jest poprawna i niesie informację („zrobiono więcej, niż oferowano").

**Contract**: `rowRemainingForView(row, stages, view): number | null` =
`rowPlannedNetForView(row, view) - rowValueForView(row, stages, view)`; `null` gdy `!(row.plannedQty > 0)`.

Zmiana typu dotyka sortowania. `sortRows` (`:128`) przyjmuje dziś `string | number`; `null` wpadłby
w gałąź numeryczną i posortował się jako `0` — „—" udawałoby wiersz domknięty. **Rozszerzyć `sortRows`
o `null` i zawsze spychać je na koniec, niezależnie od kierunku** — kreska nie ma miejsca w porządku,
więc nie może go udawać. Konwencja „null → kreska" istnieje dziś w formatowaniu (`fmtOrDash`) i nie ma
odpowiednika w sortowaniu; to ją domyka.

#### 3. Podsumy sekcji — druga figura w tym samym przejściu

**File**: `src/lib/kosztorys/v2-rows.ts:383`

**Intent**: Arkusz trzyma **oba** totale naraz (`S456` przedmiar, `T456` wykonano) — potrzebujemy tego
samego: licznik i „%" sekcji dzielą przez Przedmiar. Dokładamy figurę do akumulatora, który i tak
chodzi po tych samych wierszach.

**Contract**: `SectionSubtotalT` zyskuje `plannedNet: number`; pętla (`:401`) akumuluje
`acc.plannedNet += rowPlannedNetForView(row, view)`. `net` zostaje (= `Σ rowValueForView`). `share`
(`:405`) liczy się dalej z `net` — udział sekcji w tym, co wykonano.

`sectionDoneNetForView` (`:421`) i `kosztorysDoneNetForView` (`:412`) liczą teraz to samo co
`subtotals.net` / `Σ subtotals.net` → usunąć. **Gate: `pnpm typecheck`, nie grep.**

#### 4. „% wykonania" i „%" etapu — mianownik z Przedmiaru

**File**: `src/lib/kosztorys/calc.ts:123-140`

**Intent**: Bez tego „% wykonania" pokazuje `100%` na **każdym** wierszu — mianownik jest licznikiem.
Ta sama degeneracja co `AF`, o jedną kolumnę dalej. Przy „%" etapu skutek jest subtelniejszy: procenty
etapów zawsze sumowałyby się do 100%, czyli mówiłyby „jaki udział roboty przypadł na ten etap" zamiast
„ile z oferty ten etap dowiózł". Właściciel potwierdził mianownik = **Przedmiar** (2026-07-16).

**Contract**: `doneFraction` (`:137`) dzieli przez `row.plannedQty`, nie `row.measuredQty`; guard
`> 0` zostaje bez zmian (`null` → kreska). `stageDoneFraction` i `rowDoneFraction` zachowują sygnatury.
Docstring `:111-122` twierdzi „View-independent by construction… stageValue/rowNet reduces to
qtyDone/measuredQty" — po zmianie mianowniki się rozjeżdżają, więc **skrócenie już nie zachodzi**;
niezależność od widoku ceny zostaje (ilości nie zależą od ceny), ale uzasadnienie jest inne. Przepisać.

#### 5. Licznik „Wykonano" i „%" sekcji

**File**: `src/components/kosztorys/use-kosztorys-editor.ts:174-186`, `src/components/kosztorys/kosztorys-progress-counter.tsx:35`

**Contract**: `totalPlannedNet = Σ subtotals.plannedNet` obok istniejącego `totalNet`; licznik dostaje
go jako dzielnik. **`totalNet` zostaje** — napędza wyświetlaną kwotę wykonania. Guard `totalNet > 0`
przenosi się na `totalPlannedNet` — kosztorys bez Przedmiaru nie ma mianownika i licznik pokazuje „—",
nie `0%`. `formatPercentPrecise` nie tnie > 100% (potwierdzone) — **nie dodawać clampu**. Analogicznie
„%" sekcji: `subtotals.net / subtotals.plannedNet`.

#### 6. Próg czerwieni

**File**: `src/lib/kosztorys/v2-rows.ts:373`

**Intent**: Dzisiejsze `qtyDone > row.measuredQty` porównuje sumę etapów z pomiarem — po zmianie liczbę
z samą sobą, zawsze fałsz. Sygnał umarłby **po cichu**. Właściciel (2026-07-16): czerwień znaczy
„suma etapów przekroczyła Przedmiar".

**Contract**: `rowTotalQtyDone(row, stages) > row.plannedQty`. Obie dzisiejsze gałęzie (`:375-376`)
zwijają się w to jedno wyrażenie: „robota bez oferty" to przypadek `Przedmiar = 0`. Nazwa
`hasMeasurementMismatch` traci sens („measurement" nie jest już wejściem) → `hasStagesOverPlanned`.
Docstring `:364-372` twierdzi „Both settle at 100% by construction now" — po zmianie to fałsz.

### Success Criteria:

#### Automated Verification:

- Cała suita jednostkowa przechodzi: `pnpm test`
- Typecheck przechodzi: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`
- `sectionDoneNetForView` / `kosztorysDoneNetForView` usunięte, typecheck zielony

#### Manual Verification:

- Wiersz z etapami przekraczającymi Przedmiar: „Pozostało" ujemne, komórka czerwona, licznik > 100%
- Wiersz bez Przedmiaru: „Pozostało" = „—", brak czerwieni, sortowanie spycha go na koniec
- Przełączanie widoku ceny nie zmienia żadnego procentu

---

## Phase 3: Rabat w wartości przedmiaru

### Overview

Ostatnia rozbieżność z arkuszem, i jedyna decyzja właściciela ze znakiem zapytania. Osobna faza właśnie
dlatego — cofnięcie ma być jednym commitem, nie archeologią.

### Changes Required:

#### 1. Czerwony test — najpierw

**File**: `src/__tests__/kosztorys-calc.test.ts`

**Contract**: `rowPlannedNetForView` przy Przedmiar 100 / cena 50 / rabat 10% → **4500**, nie 5000.
Osobno rabat kwotowy 300 → **4700**. Dziś oba zwrócą 5000. Ten test jest **jedynym strażnikiem
decyzji** — ma być jawnie asertowany, nie wyprowadzony z niezmiennika.

#### 2. Figura przedmiaru przez prymityw

**File**: `src/lib/kosztorys/calc.ts:72`

**Intent**: `S5 = =N5*Q5-(Q5*R5)*N5` — arkusz stosuje rabat. Dziś zwracamy `plannedQty × cena` i go
pomijamy. Prymityw zamyka to mimochodem: figura przestaje mieć własną arytmetykę.

**Contract**: `rowPlannedNetForView(row, view)` = `netForQtyForView(row, row.plannedQty, view)`.
Docstring `:60-71` w całości do przepisania — cały jego wywód („NO discount by design (owner,
2026-07-15)… przedmiar is the pre-negotiation valuation") jest po tej decyzji **nieaktualny**, łącznie
z akapitem „Not sheet parity", który tłumaczy rozbieżność, której już nie będzie.

> ⚠ Właściciel oznaczył tę decyzję jako **„mały znak zapytania, może się jeszcze zmienić"** (2026-07-16).
> Nie budować na niej niczego dalej.

#### 3. Tooltip

**File**: `src/lib/tables/kosztorys-v2-columns.tsx` (`HEADER_TIPS`, `:147-190`)

**Intent**: Bez tego zmiana jest cicha — kwota po prostu spada i nikt nie wie dlaczego.

**Contract**: tooltip nagłówka „Wartość netto przedmiar" mówi wprost, że rabat jest w kwocie zawarty
(jak w arkuszu). Polski UI, wzorzec `withTip` / `title(…, { tip })` już istnieje.

### Success Criteria:

#### Automated Verification:

- Cała suita jednostkowa przechodzi: `pnpm test`
- Typecheck przechodzi: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`

#### Manual Verification:

- „Wartość netto przedmiar" przy rabacie 10% jest o 10% niższa niż `Przedmiar × cena`, a tooltip mówi dlaczego

---

## Phase 4: Sprzątanie martwego modelu

### Overview

Trzecie wejście znika z bazy, z kopii, z szablonów i z seeda. Do tej pory kolumna żyła jako martwa —
teraz przestaje istnieć.

### Changes Required:

#### 1. Migracja kasująca kolumnę

**File**: `src/migrations/<nowa>.ts`, `src/collections/kosztorys-items.ts:38`, `src/types/kosztorys.ts:31`,
`src/lib/queries/kosztorys.ts:76`

**Intent**: Kolumna jest po fazie 1 redundantna (zawsze `= Σ etapów`) i **kłamie** — trzyma wartości
z czasów, gdy była wpisywana. Zostawienie jej to skamielina tej samej klasy co `AF`.

**Contract**: `ALTER TABLE kosztorys_items DROP COLUMN measured_qty`. **Migrację napisać ręcznie** —
`pnpm migrate:create` emituje fantomowy drift (`AGENTS.md` → Migrations). Skopiować strukturę
najświeższego pliku w `src/migrations/` (`20260711_0_add_kosztorys_presets.ts`). Kolekcja **nie ma
włączonego wersjonowania** (zweryfikowane 2026-07-16), więc nie istnieje bliźniacza tabela Payloada
`_kosztorys_items_v` — migracja to jeden `DROP COLUMN`, bez tabel wewnętrznych. Zdjąć pole z kolekcji
(`:38`), z `KosztorysItemT` (`:31`) i z odczytu w
`getKosztorysTree` (`:76`), przegenerować typy (`pnpm generate:types` — plik jest gitignorowany,
**nie commitować**).

Ten krok kasuje też rusztowanie z fazy 1: test z „`measuredQty` sprzecznym z etapami" przestaje się
kompilować. To poprawnie — rolę dowodu przejmuje typ, który już nie zna tego pola. **Usunąć test, nie
obchodzić typu.**

Prod: dane kosztorysu są throwaway do wejścia dogfoodingu na `main`, więc **nie ma czego backfillować**.
Migrację na produkcji stosuje **człowiek** (`pnpm db:migrate:prod`), przed wypchnięciem kodu — i dopiero
wtedy, gdy to faktycznie wyjeżdża.

#### 2. Kopie zapasowe i szablony

**File**: `src/lib/kosztorys/restore-kosztorys.ts:61,65`, `src/lib/kosztorys/apply-preset.ts:49,53`,
`src/lib/kosztorys/serialize-preset.ts:17`

**Intent**: Format kopii niesie tę liczbę osobno, a etapy i tak są w kopii. Po zmianie odtworzona liczba
kłóciłaby się z odtworzonymi etapami — dwa źródła jednej prawdy, znowu.

**Contract**: `measured_qty` wypada z obu surowych `INSERT`ów; zerowanie w `serialize-preset.ts:17`
znika razem z polem. `serialize-kosztorys.ts:9-16` rozsypuje całe `KosztorysItemT`, więc pole odpada
samo po kroku 1 — **sprawdzić, nie zakładać**. Istniejące wpisy kopii i szablonów w lokalnej bazie
**skasować** (throwaway) zamiast pisać dla nich ścieżkę zgodności.

Testy `serialize-apply-preset.test.ts:127,144,161,236` asertują zerowanie pomiaru w szablonie
(`expect(item.measuredQty).toBe(0)`) — asercja traci desygnat, usunąć. `serialize-restore-roundtrip.test.ts:124,140,157`
tak samo.

#### 3. Skrypty seedujące

**File**: `src/scripts/seed-kosztorys.ts:109,123`, `src/scripts/perf-seed-kosztorys.ts:71`

**Intent**: Seed czyta kolumnę `J` arkusza do pomiaru i nie zapisuje etapów. Po zmianie zaseedowany
kosztorys pokazałby „Pomiar z natury" = 0 w każdym wierszu — **dataset do dogfoodingu straciłby całą
wykonaną robotę**, i to po cichu.

**Contract**: seed przestaje pisać pomiar; wartość odczytaną z arkusza **zapisać jako postęp
pierwszego etapu**, żeby „Pomiar z natury" policzył się na tę samą liczbę. Dataset zachowuje sens,
a `Σ etapów ≠ Przedmiar` zostaje — czyli seed sam w sobie jest realistycznym przypadkiem testowym.
`perf-seed-kosztorys.ts:71` analogicznie: `(i % 13) + 1` idzie w etap, nie w pomiar.

#### 4. Notatka domenowa

**File**: `context/reference/kosztorys-editor-domain-notes.md:227-233`

**Intent**: `:227` („**Wartość liczy się z pomiaru.**") jest po zmianie fałszem. `:229-233`
(„Pomiar ≠ etapy to stan normalny") traci desygnat — pomiar **nie może** różnić się od etapów. Reguła
żyła w dwóch miejscach naraz; zostawienie notatki odtworzy stary model przy następnym czytaniu.

**Contract**: opisać model arkusza (dwa wejścia; pomiar = suma etapów; oferta i wykonanie jako dwie
równoległe kwoty). Wskaźnik do `AGENTS.md` → „The Owner's Reference Sheet".

### Success Criteria:

#### Automated Verification:

- Migracja stosuje się lokalnie: `pnpm payload migrate`
- Typecheck po `pnpm generate:types` przechodzi: `pnpm typecheck`
- Cała suita jednostkowa przechodzi: `pnpm test`
- Lint przechodzi: `pnpm lint`
- Build przechodzi: `pnpm build`
- `grep -rn "measuredQty\|measured_qty" src/` nic nie zwraca

#### Manual Verification:

- Po `INV=6 … seed-kosztorys.ts` zaseedowany kosztorys ma niezerowy „Pomiar z natury" w wierszach z robotą
- Odtworzenie kopii zapasowej przywraca etapy, a „Pomiar z natury" liczy się z nich

---

## Testing Strategy

### Unit Tests:

Cała suita `kosztorys-calc.test.ts` jest **odporna na tę zmianę typem** — `ViewPricingT` nie zna etapów.
To jest w porządku i celowe (granica warstw z EX-489), ale znaczy, że **dowód zmiany żyje wyłącznie
w `kosztorys-v2-rows.test.ts`**. Sonda policzyła: dziś regułę widzi **6 asercji**, wszystkie w tym
jednym pliku, i każda przechodzi tylko dlatego, że fixture przypadkiem ma `Σ etapów ≠ measuredQty`.

Trzy skupiska nie-falsyfikujące, do przepisania:

1. **`:329-357` — blok „most"** (bridge EX-489). Zbudowany tak, że wiersz 2 ma `Σ etapów == measuredQty`,
   a wiersz 1 `measuredQty == 0`. Blok, który miał pilnować licznika przed 150%, po zmianie liczy `1/1`
   dla **każdego** wejścia — tautologia. To jest najważniejsze miejsce w całej suicie.
2. **`:362-397` — `subtotalRows`**. Wszystkie trzy wiersze mają etapy `= 0` przy niezerowym pomiarze:
   silnie falsyfikujące dla _tej_ mutacji, ale ścieżka podsum nie jest **nigdy** przećwiczona na
   mieszanych, prawdziwych danych etapowych. Dołożyć taki fixture.
3. **`:419` — wyczyszczony pomiar** (`measuredQty: null`). Przechodzi pod obiema regułami.

Brak wspólnej fabryki fixture'ów — siedem lokalnych, dwie w jednym pliku nie zgadzają się ze sobą
(`:31` pomiar 5/cena 20 vs `:268` pomiar 10/cena 100). **Nie unifikować w tej zmianie** (osobna robota),
ale nie dokładać ósmej.

### Integration Tests:

`kosztorys-delete-guard.test.ts` chodzi po prawdziwej bazie i jest jedynym miejscem, gdzie zmiana
predykatu blokady jest sprawdzalna. Nowy przypadek: wiersz z zerowymi etapami i niezerowym pomiarem
**da się skasować** — dopóki kolumna istnieje (fazy 1-3). W fazie 4 ten przypadek znika razem z kolumną.

### E2E:

Read-only „Pomiar z natury" jest ryzykiem **browser-level** — kolumna datasheet-grid przestaje
przyjmować wpis, a unit tego nie dosięgnie (sprawdzi najwyżej deklarację kolumny, nie zachowanie siatki).
Edytor nie ma dziś **żadnego** testu przeglądarkowego, więc pierwszy oznacza harness + fixture'y +
logowanie — osobna robota, większa niż sama zmiana.

**Decyzja właściciela: do backlogu.** Założyć zadanie w Linear (projekt „Wykonczymy", etykieta
`e2e-backlog`) i zapisać jego id przy bramce review — sam commit tego nie zamyka.

### Manual Testing Steps:

1. `INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`, otworzyć edytor v2
2. Spróbować wpisać coś w „Pomiar z natury" → nie da się; zmienić etap → pomiar zmienia się sam
3. Wpisać etapy przekraczające Przedmiar → „Pozostało" ujemne, komórka czerwona, licznik > 100%
4. Wyczyścić Przedmiar → „Pozostało" = „—", czerwień gaśnie, sortowanie spycha wiersz na koniec
5. Ustawić rabat 10% → „Wartość netto przedmiar" spada; tooltip tłumaczy dlaczego
6. Rabat kwotowy → suma kolumn wartości etapów = „Wartość netto" wiersza co do grosza
7. Przełączyć widoki ceny (klient / z narzędziami / własne narzędzia) i powtórzyć 6
8. Skasować wiersz z Przedmiarem i zerowymi etapami → udaje się; z wpisanym etapem → blokada

## Performance Considerations

`rowValueForView` przechodzi z `Σ stageValueForView` (O(etapów) z dzieleniem na etap) na jedno wywołanie
prymitywu po `rowTotalQtyDone` (O(etapów), same dodawania) — taniej, nie drożej. Sortowanie (`v2-rows.ts:126`)
stosuje decorate-sort-undecorate właśnie z powodu kosztu klucza „Pozostało"; koszt spada. Podsumy zyskują
drugą figurę **w tym samym przejściu** po wierszach, nie w drugim. Perf-dataset, jeśli coś zwolni:
`INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts` (~1000 wierszy).

## Migration Notes

**Faza 4 zawiera migrację** kasującą `kosztorys_items.measured_qty`. Napisać ręcznie (`migrate:create`
emituje fantomowy drift), sprawdzić tabele wewnętrzne Payloada. Dane kosztorysu są throwaway do wejścia
dogfoodingu na `main`, więc **backfill nie jest potrzebny** — stare kopie i szablony kasujemy.

Na produkcji migrację stosuje **człowiek** (`pnpm db:migrate:prod`), **przed** wypchnięciem kodu, który
jej wymaga — i dopiero wtedy, gdy zmiana faktycznie wyjeżdża. To bramka **deploy-time**, nie bramka fazy:
fazy 1–4 są jedną ciągłą robotą lokalną.

**Dane widzialne dla użytkownika zmienią się bez żadnej edycji:**

- każdy wiersz z `measuredQty ≠ Σ etapów` pokaże inną „Wartość netto",
- każdy kosztorys z niezerowym rabatem pokaże **niższą** „Wartość netto przedmiar",
- „% wykonania" przestanie pokazywać 100% tam, gdzie robota nie jest skończona.

To jest cel, nie skutek uboczny — ale właściciel ma wiedzieć, kiedy to wejdzie.

## Open Questions

- **Decyzja o rabacie w figurze przedmiaru ma znak zapytania** od właściciela. Faza 3 jest osobna
  właśnie po to, żeby cofnięcie było jednym commitem.

## References

- **Arkusz właściciela (autorytet domenowy)**: `AGENTS.md` → „The Owner's Reference Sheet"
- Rozstrzygnięcie: [EX-494](https://linear.app/ex-plant/issue/EX-494) · otwarte: [EX-495](https://linear.app/ex-plant/issue/EX-495)
- Change: `context/changes/kosztorys-stages-source-of-truth/change.md`
- Poprzednia wersja tego planu (inny kształt, ta sama kotwica): commit `848f61f`
- Warstwy i rationale EX-489: `src/lib/kosztorys/calc.ts:9-12`, `src/lib/kosztorys/v2-rows.ts:334-345`
- Kontekst domenowy: `context/reference/kosztorys-editor-domain-notes.md:227-233`
- Zmiana następna, sekwencyjnie: `context/changes/kosztorys-global-discount/change.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: „Pomiar z natury" staje się sumą etapów

#### Automated

- [x] 1.1 Czerwone testy napisane i **padają** przed implementacją (wartość za etapami przy sprzecznym pomiarze; niezmiennik udziału; guard `Σ = 0`; kasowalność wiersza)
- [x] 1.2 Testy jednostkowe przechodzą: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts src/__tests__/kosztorys-v2-rows.test.ts`
- [x] 1.3 Blokada kasowania przechodzi — uruchomione przez `pnpm test:integration` (30/30); podany w planie `pnpm exec vitest run src/__tests__/lib/actions/kosztorys-delete-guard.test.ts` ten spec **pomija** (`describe.skipIf(!ENV_READY)`), więc nie daje sygnału
- [x] 1.4 Typecheck przechodzi: `pnpm typecheck`
- [x] 1.5 Lint przechodzi: `pnpm lint`

Commit fazy 1: `c8dea6f`

### Phase 2: Kotwica w Przedmiarze

#### Automated

- [x] 2.1 Czerwone testy napisane i **padają** przed implementacją (Pozostało 250/−250/null; sortowanie null na końcu; % wykonania 0.95; czerwień; licznik na nie-domkniętym kosztorysie)
- [x] 2.2 Blok `kosztorys-v2-rows.test.ts:329-357` **przepisany** na fixture z `Σ etapów ≠ Przedmiar`
- [x] 2.3 Cała suita jednostkowa przechodzi: `pnpm test`
- [x] 2.4 `sectionDoneNetForView` / `kosztorysDoneNetForView` usunięte, typecheck zielony
- [x] 2.5 Typecheck przechodzi: `pnpm typecheck`
- [x] 2.6 Lint przechodzi: `pnpm lint`

### Phase 3: Rabat w wartości przedmiaru

#### Automated

- [ ] 3.1 Czerwony test napisany i **pada** przed implementacją (rabat 10% → 4500; rabat kwotowy 300 → 4700)
- [ ] 3.2 Cała suita jednostkowa przechodzi: `pnpm test`
- [ ] 3.3 Typecheck przechodzi: `pnpm typecheck`
- [ ] 3.4 Lint przechodzi: `pnpm lint`

### Phase 4: Sprzątanie martwego modelu

#### Automated

- [ ] 4.1 Migracja stosuje się lokalnie: `pnpm payload migrate`
- [ ] 4.2 Typecheck po `pnpm generate:types` przechodzi: `pnpm typecheck`
- [ ] 4.3 Cała suita jednostkowa przechodzi: `pnpm test`
- [ ] 4.4 Lint przechodzi: `pnpm lint`
- [ ] 4.5 Build przechodzi: `pnpm build`
- [ ] 4.6 `grep -rn "measuredQty\|measured_qty" src/` nic nie zwraca
