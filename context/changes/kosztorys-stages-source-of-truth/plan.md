# „Pomiar z natury" z sumy etapów; „Pozostało" na Przedmiarze — Implementation Plan

> ## ✅ ODBLOKOWANY 2026-07-16 — [EX-494](https://linear.app/ex-plant/issue/EX-494) rozstrzygnięte
>
> Poprzednia wersja tego planu stała na przesłance „wartość wiersza idzie z etapów, a »Pozostało«
> kotwiczy w pomiarze". **Kotwica była zła.** Arkusz właściciela pokazuje, że „Pomiar z natury"
> **jest** sumą etapów (`O = =SUM(D:M)`), więc nie mogą ze sobą konkurować — a rolę planu pełni
> **Przedmiar**. Szkielet planu (prymityw w warstwie cenowej, ilość z zewnątrz) zostaje; kotwica,
> mianownik licznika i zakres się zmieniają. Pełny wywód: `change.md`.
>
> Świadomie otwarte: **[EX-495](https://linear.app/ex-plant/issue/EX-495)** — czy „Pozostało" ma
> pokazywać kwotę z minusem, czy sam procent. Nie blokuje: faza 3 dowozi minus, zmiana jest lokalna.

## Overview

Trzy rzeczy naraz, bo to jedna decyzja rozłożona na kolumny:

1. **„Pomiar z natury" przestaje być wpisywany** — jest sumą etapów, jak w arkuszu. Kolumna w siatce
   zostaje, ale **read-only**.
2. **„Pozostało do rozliczenia" kotwiczy się w Przedmiarze** — `Przedmiar − suma etapów`. Tak samo
   mianownik licznika „Wykonano".
3. **„Wartość netto przedmiar" zaczyna obejmować rabat** — dziś go pomija, arkusz go stosuje.

Model docelowy = model arkusza: **dwa wejścia** (Przedmiar wpisywany, etapy wpisywane), reszta
pochodna. Dziś mamy trzy — „Pomiar z natury" jest u nas trzecim, niezależnym polem, i to jest cała
rozbieżność.

## Current State Analysis

| figura w UI                | dziś                                                                               | arkusz                     | wyrok                                                    |
| -------------------------- | ---------------------------------------------------------------------------------- | -------------------------- | -------------------------------------------------------- |
| „Wartość netto przedmiar"  | `plannedQty × cena`, **bez rabatu** (`calc.ts:72`)                                 | `S = N×Q − N×Q×R`          | **rozbieżność**                                          |
| „Pomiar z natury"          | pole wpisywane (`measuredQty`)                                                     | `O = SUM(D:M)`             | **rozbieżność**                                          |
| „Wartość netto" wiersza    | `measuredQty × cena − rabat`, chyba że pomiar = 0 → wtedy etapy (`v2-rows.ts:346`) | `T = O×Q − O×Q×R`          | zbiegnie się **samo**, gdy pomiar stanie się sumą etapów |
| „Pozostało do rozliczenia" | `wartość − wykonane` (`v2-rows.ts:356`)                                            | `AF = T − Σ(V:AE)` ≡ **0** | arkusz ma tu skamielinę — **nie kopiujemy**              |
| licznik „Wykonano"         | `doneNet / totalNet` (`kosztorys-progress-counter.tsx:35`)                         | brak odpowiednika          | mianownik → Przedmiar                                    |

### Key Discoveries

- **Rozgałęzienie w `rowValueForView` (`v2-rows.ts:346`) znika samo z siebie.** Skoro „Pomiar z natury"
  **jest** sumą etapów, to `rowNetForView`, `rowDoneNetForView` i `rowValueForView` liczą po zmianie
  **dokładnie to samo**. Trzy nazwy na jedną figurę (`T`) to dług — zostaje jedna.
- **Cztery figury to ta sama operacja z inną ilością.** `rowNetForView` (`calc.ts:56`),
  `rowPlannedNetForView` (`calc.ts:72`), `stageValueForView` (`calc.ts:98`), `rowDiscountForView`
  (`calc.ts:81`) robią `applyDiscount(qty × viewPrice)` i różnią się wyłącznie tym, skąd biorą `qty`.
  Stąd prymityw.
- **`rowPlannedNetForView` jako jedyna nie woła `applyDiscount`** — i to jest ta rozbieżność z `S`.
  Prymityw usuwa ją mimochodem: figura przestaje mieć własną arytmetykę.
- **`rowTotalQtyDone` już istnieje** (`v2-rows.ts:328`) — `Σ row[stageKey(st.id)]`. To jest nasze `O`.
- **`kosztorys-calc.test.ts:57-104` broni starego niezmiennika i NIE pęknie sam.** Asercje „etapy
  sumują się do `rowNetForView`" przy `Σ qtyDone == measuredQty` przechodzą z **obu** reguł. Zielona
  suita pilnowałaby nieaktualnej zasady. To jest właściwe ryzyko fazy 1.
- **Rabat procentowy nie wymaga niczego** — `applyDiscount` (`calc.ts:18`) mnoży przez `1−p`, więc
  rozkłada się proporcjonalnie sam. Decyzje o udziale dotyczą wyłącznie rabatu kwotowego.
- **`measuredQty` zostaje w bazie, ale przestaje być czytana.** Kolumna jest po zmianie redundantna
  (zawsze = `Σ etapów`). Migracja kasująca ją to osobna decyzja — patrz „Migration Notes".

## Desired End State

```
Przedmiar        (wpisywany)     → „Wartość netto przedmiar"  = applyDiscount(Przedmiar × cena)   [= S]
etapy            (wpisywane)     → „Pomiar z natury"          = Σ etapów                          [= O]
                                 → „Wartość netto"            = applyDiscount(Σ etapów × cena)    [= T]
                                 → „Pozostało do rozliczenia" = S − T
                                 → licznik „Wykonano"         = T / S
```

Weryfikacja na wierszu — Przedmiar 100, etapy 95, cena 50, bez rabatu:
„Wartość netto przedmiar" = 5000, „Pomiar z natury" = 95 (read-only), „Wartość netto" = 4750,
„Pozostało" = 250, „Wykonano" = 95%. Przy etapach 105: „Pozostało" = −250, „Wykonano" = 105%,
wiersz **czerwony**.

## What We're NOT Doing

- **Nie kasujemy `measuredQty` z bazy** — kolumna zostaje, przestaje być czytana. Osobna decyzja.
- **Nie kopiujemy skamieliny `AF`** — w arkuszu „pozostało do rozliczenia" jest tożsamościowo zerem,
  bo kotwiczy w `T`. Nasza kotwiczy w `S` i dlatego żyje. Świadome zerwanie parytetu, w jedną stronę.
- **Nie ruszamy globalnego rabatu** (`kosztorys-global-discount`) ani roadmap 12(b) („suma etapu").
- **Nie poprawiamy błędu `Z8` w arkuszu** — to nie nasz plik; port go nie odtwarza i o to chodzi.

## Implementation Approach

Wyciągnąć z `calc.ts` jeden prymityw `netForQtyForView(row, qty, view)` = `applyDiscount(qty × cena)`
i przestawić wszystkie figury tak, żeby **ilość przychodziła z zewnątrz**. `calc.ts` przestaje mieć
zdanie o tym, która ilość jest prawdą — decyzja przenosi się do `v2-rows.ts`, jedynej warstwy znającej
etapy. Granica warstw z EX-489 się przez to **zacieśnia**.

Rozdzielenie kotwic jest sednem: „Wartość netto" czyta `Σ etapów`, „Pozostało" i licznik czytają
`plannedQty`. Dwie figury, dwa źródła, jeden prymityw.

## Critical Implementation Details

**Kolejność faz jest wiążąca.** Faza 1 zmienia sygnatury w `calc.ts` i łamie kompilację `v2-rows.ts`
oraz `kosztorys-v2-columns.tsx` do czasu faz 2–3. **Typecheck jest celowo czerwony między fazą 1 a 3**
— to nie regres. Testy jednostkowe `calc.ts` przechodzą już po fazie 1.

**Dzielenie przez zero.** `stageValueForView` dzieli przez `Σ etapów`. Gdy suma = 0, każdy etap ma 0
→ zwrócić 0 przed dzieleniem. Guard **musi być `> 0`, nie `!== 0`** — wyczyszczona komórka zapisuje
`null`, który strict equality przepuszcza w dzielenie (`calc.ts:106`).

---

## Phase 1: `calc.ts` — ilość przychodzi z zewnątrz

### Overview

Warstwa cenowa przestaje czytać `row.measuredQty`. Jeden prymityw, wszystkie figury na parametrze.

### Changes Required:

#### 1. Prymityw ilości

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Wydzielić operację „ile warta jest dowolna ilość tego wiersza, po rabacie" — dziś zaszytą
kilkakrotnie, raz z `measuredQty` na sztywno, raz (w figurze przedmiaru) **bez rabatu w ogóle**.

**Contract**: `export function netForQtyForView(row: ViewPricingT, qty: number, view: PriceViewT): number`
= `applyDiscount(qty * viewPrice(row, view), row)`.

`rowNetForView(row, view)` (`:56`) **znika** — czytała `row.measuredQty`, a ta ilość przestaje istnieć
jako niezależne wejście. Wołający dostają ilość z `v2-rows.ts` (faza 2).

#### 2. `rowPlannedNetForView` — dochodzi rabat

**File**: `src/lib/kosztorys/calc.ts:72`

**Intent**: Figura ofertowa („Wartość netto przedmiar") ma odpowiadać `S` z arkusza:
`S5 = =N5*Q5-(Q5*R5)*N5` — rabat **jest** stosowany. Dziś zwracamy `plannedQty × cena` i pomijamy go
(decyzja właściciela 2026-07-16: rabat ma wejść, z wyraźnym tooltipem).

**Contract**: `rowPlannedNetForView(row, view)` = `netForQtyForView(row, row.plannedQty, view)`.
Docstring `:7` („feeds only rowPlannedNetForView, the offer figure") wymaga aktualizacji — przestaje
być prawdą, że ta figura jest bezrabatowa.

> ⚠ Właściciel oznaczył tę decyzję jako **„mały znak zapytania, może się jeszcze zmienić"**. Zmiana
> jest jednolinijkowa i odwracalna — nie budować na niej niczego dalej.

#### 3. `stageValueForView` — udział liczony od sumy etapów

**File**: `src/lib/kosztorys/calc.ts:98`

**Intent**: Udział etapu przestaje być liczony względem pomiaru-jako-pola, a zaczyna względem sumy
etapów. Mechanizm udziału (rabat kwotowy nie może się odjąć raz na etap) zostaje — zmienia się
mianownik.

**Contract**: `stageValueForView(row, qtyInStage: number, totalQty: number, view): number`
= `netForQtyForView(row, totalQty, view) * (qtyInStage / totalQty)`, z guardem
`if (!(totalQty > 0)) return 0`.

Guard zwraca **0, nie `qtyInStage × cena`** jak dziś: `totalQty = 0` znaczy, że wszystkie etapy są
zerowe, więc i ten. Dzisiejszy fallback istniał dla wiersza bez pomiaru — ta gałąź znika razem
z zależnością od pomiaru.

Docstring `:85-97`: rationale o rabacie kwotowym **zostaje w mocy**. Zdanie „Not sheet parity" też —
arkusz nigdy nie znał rabatu kwotowego.

#### 4. `rowDiscountForView` — rabat wobec podanej ilości

**File**: `src/lib/kosztorys/calc.ts:81`

**Intent**: Kolumna „Rabat wart." pokazuje kwotę **faktycznie odjętą** od „Wartość netto". Skoro ta
idzie z etapów, kolumna też musi — inaczej pokaże rabat naliczony od ilości, której nikt nie użył.

**Contract**: `rowDiscountForView(row, qty: number, view): number`
= `qty * viewPrice(row, view) - netForQtyForView(row, qty, view)`.

#### 5. Niezmiennik w testach

**File**: `src/__tests__/kosztorys-calc.test.ts`

**Intent**: Przepisać suitę udziału (`:57-104`). **To jest właściwe ryzyko fazy** — te testy nie pękną
same: asercje przy nowej sygnaturze nadal się kompilują i przechodzą dla danych, gdzie
`Σ etapów == measuredQty`.

**Contract**: nowy niezmiennik — `Σ stageValueForView(row, qtyᵢ, Σqty, view) === netForQtyForView(row, Σqty, view)`
dla obu typów rabatu i wszystkich trzech widoków. Fixture'y **muszą** mieć `Σ etapów ≠ plannedQty`.
Dołożyć: `Σ etapów = 0` (guard), oraz **nowy test na rabat w figurze przedmiaru** —
`rowPlannedNetForView` przy rabacie 10% na `plannedQty=100, cena=50` = **4500**, nie 5000.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe `calc.ts` przechodzą: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`
- Lint przechodzi: `pnpm lint`
- Niezmiennik udziału asertowany na fixture z `Σ etapów ≠ plannedQty`, oba typy rabatu
- `rowPlannedNetForView` asertowana **z rabatem** (procentowym i kwotowym)

#### Manual Verification:

- (brak — faza czysto obliczeniowa; typecheck celowo czerwony do fazy 3)

---

## Phase 2: `v2-rows.ts` — „Pomiar z natury" staje się pochodną

### Overview

Tu ląduje decyzja „pomiar = suma etapów" i rozdzielenie kotwic „Wartość netto" ↔ „Pozostało".

### Changes Required:

#### 1. `rowValueForView` — koniec gałęzi, koniec duplikatów

**File**: `src/lib/kosztorys/v2-rows.ts:346`

**Intent**: Usunąć warunek `if (row.measuredQty > 0)`. „Pomiar z natury" **jest** sumą etapów, więc
gałąź nie ma czego wybierać.

**Contract**: `rowValueForView(row, stages, view)` = `netForQtyForView(row, rowTotalQtyDone(row, stages), view)`.
Liczone **wprost z prymitywu, nie przez `Σ stageValueForView`** — udziały sumują się do 1, więc reduce
po etapach dałby ten sam wynik drożej i z błędem zaokrągleń.

`rowDoneNetForView` (`:317`) staje się **identyczna** → usunąć, przekierować wołających (`:361`, `:417`,
`:428`, `use-kosztorys-editor.ts:84`) na `rowValueForView`. Docstring `:334-345` przepisać: to już nie
wyjątek dla wiersza bez pomiaru, tylko reguła.

#### 2. `rowRemainingForView` — kotwica na Przedmiarze

**File**: `src/lib/kosztorys/v2-rows.ts:356`

**Intent**: „Pozostało" przestaje zależeć od „Wartość netto" (co dałoby `x − x = 0` na każdym wierszu —
dokładnie skamielina `AF` z arkusza) i kotwiczy się w **Przedmiarze**. Znaczenie: _ile z oferty
zostało_. Ujemna wartość jest poprawna i niesie informację („zrobiono więcej, niż oferowano").

**Contract**: `rowRemainingForView(row, stages, view): number | null` =
`rowPlannedNetForView(row, view) - rowValueForView(row, stages, view)`; zwraca `null` gdy
`!(row.plannedQty > 0)` — brak Przedmiaru = brak oferty = pytanie bezprzedmiotowe. Zmiana typu dotyka
sortowania (`:126`, klucz `remaining`) — `null` musi mieć zdefiniowaną pozycję, nie wpaść
w porównanie z `number`.

#### 3. Podsumy sekcji — druga figura w tym samym przejściu

**File**: `src/lib/kosztorys/v2-rows.ts:383`

**Intent**: Arkusz trzyma **oba** totale naraz (`S456` przedmiar, `T456` wykonano) — my potrzebujemy
tego samego: licznik i `%` sekcji dzielą przez Przedmiar. Dokładamy figurę do akumulatora, który i tak
chodzi po tych samych wierszach.

**Contract**: `SectionSubtotalT` zyskuje `plannedNet: number`; pętla (`:401`) akumuluje
`acc.plannedNet += rowPlannedNetForView(row, view)`. `net` zostaje (= `Σ rowValueForView`) — napędza
„Wartość netto" sekcji. `share` (`:405`) liczy się dalej z `net`: udział sekcji w tym, co wykonano.

`sectionDoneNetForView` (`:421`) i `kosztorysDoneNetForView` (`:412`) liczą teraz to samo co
`subtotals.net` / `Σ subtotals.net` — usunąć, jeśli martwe. **Gate: `pnpm typecheck`, nie grep.**

#### 4. `hasMeasurementMismatch` — nowy próg

**File**: `src/lib/kosztorys/v2-rows.ts:373`

**Intent**: Dzisiejsze `qtyDone > row.measuredQty` porównuje sumę etapów z pomiarem — czyli po zmianie
liczbę z samą sobą, zawsze fałsz. Sygnał umiera po cichu. Właściciel (2026-07-16): czerwień ma znaczyć
**„suma etapów przekroczyła Przedmiar"**.

**Contract**: `hasMeasurementMismatch(row, stages)` = `rowTotalQtyDone(row, stages) > row.plannedQty`;
gałąź `!(row.plannedQty > 0)` → `false` (bez oferty nie ma czego przekroczyć — inaczej każdy świeży
wiersz z etapami zapala się na czerwono). Nazwa przestaje pasować („measurement" już nie istnieje jako
wejście) — przemianować na `hasStagesOverPlanned`. Docstring `:365-372` twierdzi „Both settle at 100%
by construction now" — po tej zmianie to fałsz.

### Success Criteria:

#### Automated Verification:

- Testy `v2-rows` przechodzą: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`
- Nowy test: „Wartość netto" = `Σ etapów × cena − rabat`, gdy `measuredQty` jest **sprzeczna** z etapami (dowód, że przestała być czytana)
- Nowy test: „Pozostało" = 250 przy Przedmiar 100 / etapy 95 / cena 50; **−250** przy etapach 105
- Nowy test: „Pozostało" = `null`, gdy `plannedQty` jest `0`/`null`
- Nowy test: czerwień zapala się przy `Σ etapów > Przedmiar` i **nie** zapala przy braku Przedmiaru
- Lint przechodzi: `pnpm lint`

#### Manual Verification:

- (brak — warstwa obliczeniowa; weryfikacja UI w fazie 3)

---

## Phase 3: UI — kolumna read-only, tooltip, licznik

### Overview

Domknięcie: „Pomiar z natury" przestaje być edytowalny, „Wartość netto przedmiar" dostaje tooltip
o rabacie, licznik przechodzi na Przedmiar. Po tej fazie typecheck wraca na zielono.

### Changes Required:

#### 1. „Pomiar z natury" — kolumna read-only, liczona

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Sedno decyzji #1 właściciela. Kolumna zostaje widoczna (jest użyteczna — pokazuje łączną
ilość), ale przestaje przyjmować wpisy: jej wartość to `Σ etapów`.

**Contract**: kolumna przechodzi z edytowalnej na `computedColumn`-owy wzorzec (jak inne pochodne),
źródło = `rowTotalQtyDone(r, stages)`. **Sprawdzić ścieżkę zapisu** — po odcięciu edycji nic nie
powinno już pisać `measuredQty`; jeśli jakaś mutacja to robi, ma przestać (kolumna w bazie zostaje,
patrz „Migration Notes"). Tooltip: „liczone automatycznie z sumy etapów".

#### 2. „Wartość netto przedmiar" — tooltip o rabacie

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Decyzja #2 właściciela wymaga **wyraźnego** zaznaczenia, że rabat jest w tej kwocie
zawarty. Bez tego zmiana z fazy 1 jest cicha: kwota po prostu spada i nikt nie wie dlaczego.

**Contract**: tooltip nagłówka mówi wprost, że figura zawiera rabat (jak w arkuszu). Polski UI.

#### 3. Kolumny wartości etapów i rabatu

**File**: `src/lib/tables/kosztorys-v2-columns.tsx:621,626,652,661`

**Intent**: Podać nowym sygnaturom ilość. `stages` są w zasięgu (`:706`).

**Contract**: `stageValueForView(r, r[qtyKey] ?? 0, rowTotalQtyDone(r, stages), view)` w `:652`/`:661`;
`rowDiscountForView(r, rowTotalQtyDone(r, stages), view)` w `:621`/`:626`. Kolumny
`stageValuePercentCols` (`:668+`) korzystają z tego samego wywołania — sprawdzić.

#### 4. „Pozostało" — render kreski

**File**: `src/lib/tables/kosztorys-v2-columns.tsx:714`

**Intent**: `rowRemainingForView` zwraca `number | null`; `null` ma się pokazać jako „—", nie `0`
ani `NaN`. Dotyczy obu kolumn (`remaining`, `remainingGross`) — `toGross(null)` musi być przechwycone
przed mnożeniem.

**Contract**: `computedColumn` przepuszcza `null` do formattera; formatter renderuje „—". Wzorzec
istnieje (`formatPercentPrecise` przyjmuje `null`).

#### 5. Licznik „Wykonano" i `%` sekcji — mianownik z Przedmiaru

**File**: `src/components/kosztorys/use-kosztorys-editor.ts:175`, `src/components/kosztorys/kosztorys-progress-counter.tsx:35`

**Intent**: Bez tego licznik dzieli liczbę przez siebie i pokazuje `100%` zawsze — ta sama degeneracja
co `AF` w arkuszu.

**Contract**: `totalPlannedNet = Σ subtotals.plannedNet` obok istniejącego `totalNet`; licznik dostaje
go jako dzielnik. **`totalNet` zostaje** — napędza wyświetlaną kwotę wykonania. Licznik pokazuje
`wykonane / oferowane` i **może przekroczyć 100%** — `formatPercentPrecise` nie może tego uciąć.
Analogicznie `%` sekcji: `subtotals.net / subtotals.plannedNet`.

Guard `totalNet > 0` przenosi się na `totalPlannedNet` — kosztorys bez Przedmiaru nie ma mianownika
i licznik pokazuje „—", nie `0%`.

#### 6. Domknięcie dokumentacji domenowej

**File**: `context/reference/kosztorys-editor-domain-notes.md:227`

**Intent**: Linia 227 („**Wartość liczy się z pomiaru.**") jest po zmianie myląca — pomiar przestaje
być wejściem. Reguła żyła w dwóch miejscach naraz; zostawienie notatki odtworzy stary model przy
następnym czytaniu.

**Contract**: `:227` opisuje model arkusza (dwa wejścia: Przedmiar + etapy; pomiar = ich suma; oferta
vs wykonanie jako dwie równoległe kwoty). `:229-233` („Pomiar ≠ etapy to stan normalny") — **usunąć
lub przepisać**: po zmianie pomiar nie może różnić się od etapów, więc zdanie przestaje mieć desygnat.
Dopisać wskaźnik do arkusza (`AGENTS.md` → „The Owner's Reference Sheet").

### Success Criteria:

#### Automated Verification:

- Typecheck przechodzi: `pnpm typecheck`
- Cała suita jednostkowa przechodzi: `pnpm test`
- Lint przechodzi: `pnpm lint`
- Build przechodzi: `pnpm build`

#### Manual Verification:

- Na zaseedowanym kosztorysie (`INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`):
  „Pomiar z natury" **nie przyjmuje wpisu** i zmienia się sam po edycji etapu
- Wiersz z etapami przekraczającymi Przedmiar: „Pozostało" ujemne, komórka czerwona, licznik > 100% (nieucięty)
- Wiersz bez Przedmiaru: „Pozostało" = „—", brak czerwieni
- „Wartość netto przedmiar" z rabatem 10% pokazuje kwotę **niższą** niż `Przedmiar × cena`, a tooltip mówi dlaczego
- Rabat kwotowy: suma kolumn wartości etapów = „Wartość netto" wiersza co do grosza
- „Rabat wart." = `Σ etapów × cena − Wartość netto`
- Sortowanie po „Pozostało" nie wyrzuca błędu przy wierszach z „—"
- Przełączanie widoku ceny (klient / z narzędziami / własne narzędzia) nie łamie żadnej z powyższych zgodności

---

## Testing Strategy

### Unit Tests:

- **Niezmiennik udziału** (`kosztorys-calc.test.ts`): `Σ stageValueForView === netForQtyForView(row, Σqty, view)`
  dla `percent` i `amount`, na trzech widokach. **Fixture musi mieć `Σ etapów ≠ plannedQty`.**
- **Rabat w figurze przedmiaru**: `rowPlannedNetForView` z rabatem 10% → 4500, nie 5000. Ten test jest
  jedynym strażnikiem decyzji #2 — właściciel oznaczył ją jako możliwą do cofnięcia, więc ma być
  jawnie asertowana, nie wyprowadzona.
- **Guard dzielenia**: `Σ etapów = 0` → wartość etapu `0`, bez `NaN`/`Infinity`.
- **Pomiar przestał być czytany**: fixture z `measuredQty` **sprzecznym** z sumą etapów — „Wartość
  netto" ma iść za etapami. To jest test tej zmiany; fixture zgodny nic nie dowodzi.
- **Rozdzielenie kotwic** (`kosztorys-v2-rows.test.ts`): przy `Przedmiar ≠ Σ etapów` „Wartość netto"
  idzie za etapami, a „Pozostało" za Przedmiarem — jeden fixture, dwie różne odpowiedzi.
- **„Pozostało" ujemne** i **`null`** (brak Przedmiaru); **czerwień** na progu Przedmiaru.

### Integration Tests:

Brak — zmiana czysto obliczeniowa, bez granicy DB/API.

### E2E:

Read-only „Pomiar z natury" jest ryzykiem **browser-level** (kolumna datasheet-grid przestaje
przyjmować wpis) — nie da się go pokryć unitem. Do autoryzacji przy bramce review (`/10x-e2e`) albo
odłożenia do backlogu `e2e-backlog`. Reszta zmian jest obliczeniowa i unit ją pokrywa.

### Manual Testing Steps:

1. `INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`, otworzyć edytor v2
2. Spróbować wpisać coś w „Pomiar z natury" → nie da się; zmienić etap → pomiar zmienia się sam
3. Wpisać etapy przekraczające Przedmiar → „Pozostało" ujemne, komórka czerwona, licznik > 100%
4. Wyczyścić Przedmiar → „Pozostało" = „—", czerwień gaśnie
5. Ustawić rabat 10% → „Wartość netto przedmiar" spada; tooltip tłumaczy dlaczego
6. Rabat kwotowy → suma kolumn etapów = „Wartość netto"; „Rabat wart." = różnica
7. Przełączyć widoki ceny i powtórzyć 6

## Performance Considerations

`rowValueForView` przechodzi z `Σ stageValueForView` (O(stages) z dzieleniem na etap) na jedno
wywołanie prymitywu po `rowTotalQtyDone` (O(stages), same dodawania) — taniej, nie drożej. Sortowanie
(`v2-rows.ts:126`) stosuje decorate-sort-undecorate właśnie z powodu kosztu klucza `remaining`; koszt
spada. Perf-dataset, jeśli coś zwolni:
`INV=7 node --env-file=.env --import tsx src/scripts/perf-seed-kosztorys.ts` (~1000 wierszy).

## Migration Notes

**Brak migracji w tej zmianie.** Wszystkie figury są liczone w locie. `measuredQty` zostaje w bazie
jako kolumna, którą nikt nie czyta i nikt nie zapisuje.

Otwarte na później: skasować ją migracją czy zostawić? Właściciel odpowiadał o **kolumnie w siatce**
(read-only), nie o schemacie. Zostawienie jest bezpieczne i odwracalne — kasowanie wymaga migracji
prod (człowiek, `pnpm db:migrate:prod`), a decyzja #2 wciąż ma znak zapytania. **Nie kasować w tej
zmianie.**

**Dane widzialne dla użytkownika zmienią się bez żadnej edycji:**

- każdy wiersz z `measuredQty ≠ Σ etapów` pokaże inną „Wartość netto",
- każdy kosztorys z niezerowym rabatem pokaże **niższą** „Wartość netto przedmiar".

To jest cel, nie skutek uboczny — ale właściciel ma wiedzieć, kiedy to wejdzie.

## References

- **Arkusz właściciela (autorytet domenowy)**: `AGENTS.md` → „The Owner's Reference Sheet"
- Rozstrzygnięcie: [EX-494](https://linear.app/ex-plant/issue/EX-494) · otwarte: [EX-495](https://linear.app/ex-plant/issue/EX-495)
- Change: `context/changes/kosztorys-stages-source-of-truth/change.md`
- Warstwy i rationale EX-489: `src/lib/kosztorys/calc.ts:9-12`, `src/lib/kosztorys/v2-rows.ts:334-345`
- Kontekst domenowy: `context/reference/kosztorys-editor-domain-notes.md:227-233`
- Zmiana następna, sekwencyjnie: `context/changes/kosztorys-global-discount/change.md`
- Precedens „sequence, don't bundle": `context/changes/kosztorys-stage-values/frame.md:114`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: `calc.ts` — ilość przychodzi z zewnątrz

#### Automated

- [ ] 1.1 Testy jednostkowe `calc.ts` przechodzą: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`
- [ ] 1.2 Lint przechodzi: `pnpm lint`
- [ ] 1.3 Niezmiennik udziału asertowany na fixture z `Σ etapów ≠ plannedQty`, oba typy rabatu
- [ ] 1.4 `rowPlannedNetForView` asertowana z rabatem procentowym i kwotowym

### Phase 2: `v2-rows.ts` — „Pomiar z natury" staje się pochodną

#### Automated

- [ ] 2.1 Testy `v2-rows` przechodzą: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`
- [ ] 2.2 Nowy test: „Wartość netto" idzie za etapami przy `measuredQty` sprzecznym z sumą etapów
- [ ] 2.3 Nowy test: „Pozostało" = 250 / −250 wobec Przedmiaru
- [ ] 2.4 Nowy test: „Pozostało" = `null` bez Przedmiaru
- [ ] 2.5 Nowy test: czerwień przy `Σ etapów > Przedmiar`, brak czerwieni bez Przedmiaru
- [ ] 2.6 Lint przechodzi: `pnpm lint`

### Phase 3: UI — kolumna read-only, tooltip, licznik

#### Automated

- [ ] 3.1 Typecheck przechodzi: `pnpm typecheck`
- [ ] 3.2 Cała suita jednostkowa przechodzi: `pnpm test`
- [ ] 3.3 Lint przechodzi: `pnpm lint`
- [ ] 3.4 Build przechodzi: `pnpm build`
