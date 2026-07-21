# Wariant kosztu podwykonawcy per etap — kaskada + widok mieszany + bramka rozliczenia

## Overview

Cena podwykonawcy „z narzędziami" / „bez narzędzi" nie jest dwiema równoległymi cenami jednej pracy —
praca jest wykonana **albo** z **albo** bez (OR, nie AND), i wariant zmienia się **per etap** (kilka
ekip na inwestycji). Dziś silnik wycenia całą wykonaną ilość po **jednym globalnym** widoku
(`PriceViewT`) i jest ślepy na etap, więc „suma wykonanej pracy" nigdy nie odda realnego miksu — stąd
rozjazd 78k (całość z narzędziami) vs ~56k (arkusz, realnie bez).

Change dokłada oś etapu do wyboru wariantu (kaskada `default sekcji → sekcja×etap → praca×etap`), liczy
koszt jako **Σ po komórkach** `(ilość_etapu × stawka rozwiązanego wariantu)`, dodaje **czwarty widok
„Mieszany"** (= rzeczywistość; z/bez zostają jako widełki-hipoteza) ustawiony **na końcu przełącznika**
(najrzadziej używany; edytor dalej startuje na Kliencie — `DEFAULT_VIEW` bez zmian), i **bramkuje** blok
„pozostało do wypłaty" (należne − realne PAYOUT) do widoku
mieszanego. Jeden slice, pełna kaskada, klikalna edycja ekip.

## Current State Analysis

**Silnik wyceny — `src/lib/kosztorys/calc.ts` (czysta warstwa cenowa, ślepa na etapy):**

- `PriceViewT = 'client' | 'w_tools' | 'own_tools'` (`calc.ts:36`) — globalny przełącznik.
- `subcontractorPrice(row, view)` (`calc.ts:45`) wybiera `wToolsOverride*` albo `ownToolsOverride*` po
  **globalnym** `view`, **ignoruje `row.costVariant`**. Pozycja trzyma **obie** ceny naraz.
- `netForQtyForView(row, qty, view)` (`calc.ts:72`) — wycenia dowolną ilość po jednej cenie widoku.

**Warstwa rozliczeniowa — `src/lib/kosztorys/settlement.ts` (zna etapy):**

- `rowTotalQtyDone(row, stages)` (`settlement.ts:84`) = Σ `row[stageKey(id)]` — pomiar.
- `rowValueForView(row, stages, view)` (`settlement.ts:100`) = `netForQtyForView(row, Σqty, view)` —
  wycenia **całą** wykonaną ilość **raz** po cenie widoku (świadomie, dla uniknięcia drobnych z
  sumowania per etap — `settlement.ts:97`). **To jest miejsce, które musi się zmienić** dla mieszanego.
- `sectionSubtotalsForView(rows, stages, view)` (`settlement.ts:179`) — akumuluje per sekcja.
- `executedWorkNetPreRabat(subtotals)` (`settlement.ts:79`) = „suma wykonanej pracy" (należne),
  pre-rabat.

**Wyliczenie należnego — `src/components/kosztorys/use-kosztorys-editor.ts`:**

- `:313` `sectionSubtotalsForView(rows, stages, view)`; `:394`
  `subcontractorDueNet = executedWorkNetPreRabat(subtotals)`. Eksport `:1096`, konsumpcja w
  `kosztorys-editor-body.tsx:76`, przekazanie do `KosztorysTotalsPanel` z `priceView={view}`.

**Blok podsumowania — `kosztorys-totals-panel.tsx`:**

- `isClientPlane = priceView === 'client'` (`:87`). Widok kliencki → `KosztorysSummary`; widoki
  podwykonawcy → `SubcontractorSummary` z `dueNet={subcontractorDueNet}` (`:177`).
- `computeSubcontractorSummary(dueNet, payouts)` (`subcontractor-summary.ts:24`) = `remaining = dueNet
− Σ payouts`. `SubcontractorSummary` renderuje „Suma wykonanej pracy" / „Zaliczki razem" / „Pozostało
  do wypłaty". **Dziś ten blok liczy `remaining` w KAŻDYM widoku podwykonawcy** — to źródło rozjazdu
  78k vs realne wypłaty.

**Przełącznik widoku:**

- Stan: `use-price-view.ts:11` `usePriceView(investmentId)` — localStorage `kosztorys-view:<id>`.
- Toolbar: `kosztorys-toolbar-view-toggles.tsx` + `VIEWS` w `kosztorys-toolbar-options.tsx:22`
  (Klient / Z narzędziami / Bez narzędzi).
- `kosztorys-view-menu.tsx:88` czyta `view` tylko po to, by ukryć oś netto/brutto w widokach
  podwykonawcy (`showMoneyAxis = view === 'client'`, EX-558).

**Builder wierszy — `src/lib/kosztorys/v2-rows.ts`:**

- `treeToRows(tree)` (`:22`) buduje `progressByItem` z `tree.progress` i spłaszcza do `stage_<id>`
  kluczy ilości; denormalizuje `sectionDefaultCostVariant`, coeffy, VAT. Po zbudowaniu `progress` nie
  jest już czytane — wartości per etap liczone z `stage_<id>` kluczy.

**Schemat (zweryfikowany w migracjach + kolekcjach):**

- `kosztorys_sections.default_cost_variant varchar NOT NULL DEFAULT 'w_tools'` — **poziom 1 kaskady
  już istnieje**.
- `kosztorys_items.cost_variant varchar` nullable — istnieje, ale to override **per praca** (bez osi
  etapu); w nowym modelu nie jest to poziom kaskady per-etap.
- `stage_progress (item_id, stage_id, qty_done)`, `UNIQUE(item_id, stage_id)` — trzyma **tylko ilość**.
  Upsert przez raw SQL `ON CONFLICT` w `setStageProgressAction`.
- `CostVariantT = 'w_tools' | 'own_tools'` (`types.ts:15`); DB trzyma jako `varchar`, walidacja Zod
  `z.enum(['w_tools','own_tools'])` (`lib/actions/kosztorys.ts:34,43`).
- Migracje ręczne (wzorzec: `20260720_0_add_kosztorys_shares.ts`); nowa kolekcja wymaga dopisu kolumny
  `<slug>_id` + index do `payload_locked_documents_rels`.

## Desired End State

- Silnik liczy koszt podwykonawcy jako **Σ po komórkach (etap × praca)**, każda komórka po **swoim**
  rozwiązanym wariancie kaskady. „Suma wykonanej pracy" = realny miks, nie hipoteza.
- Kolejność widoków w przełączniku: **Klient / Z narzędziami / Bez narzędzi / Mieszany** — Mieszany
  **na końcu** (najrzadziej używany). Edytor startuje na Kliencie (`DEFAULT_VIEW='client'` bez zmian).
  Z/bez = widełki-hipoteza (należne pokazane, **bez** bloku „pozostało do wypłaty").
- W widoku mieszanym: komórki kolorowane wariantem; klik nagłówka sekcji na kolumnie etapu ustawia
  wariant całej sekcji w tym etapie (poziom 2); klik komórki nadpisuje per praca×etap (poziom 3).
  Wiersz pokazuje kwotę wykonaną. **Żadnej kolumny nie chowamy** — „Cena j.m." pokazuje marker
  „miks / stawka" a kwotowe „Pozostało do rozliczenia" pokazuje „nie dotyczy" + powód (decyzja
  właściciela: kolumny zostają z wyraźną informacją).
- Blok „pozostało do wypłaty" (należne mieszane − Σ realnych PAYOUT) żyje **tylko** w widoku mieszanym.
- Seed Białostocka: sekcje z defaultem „bez narzędzi", mieszany == bez ≈ 56 431.

**Weryfikacja:** patrz Success Criteria per faza; test jednostkowy silnika mieszanego (przykład
malowanie 18/15: `(e1+e2)×18 + (e3+e4)×15`) daje wynik między „całość z" a „całość bez".

### Key Discoveries

- Miejsce zmiany silnika = `settlement.ts:100` (`rowValueForView`), nie `calc.ts` — mieszany zna etapy,
  a `calc.ts` jest z założenia ślepy na etapy (`calc.ts:8`).
- Poziom 1 kaskady (`default_cost_variant`) **już jest** na sekcji; dokładamy tylko poziom 2 (relacja
  sekcja×etap) i poziom 3 (kolumna na `stage_progress`).
- Bramkowanie per-widok już istnieje jako wzorzec (recon „scream" przypięty do widoku klienta,
  `kosztorys-totals-panel.tsx:87`) — mieszany-tylko robi to samo dla „pozostało do wypłaty".
- Rounding: `settlement.ts:97` świadomie wycenia całość raz, by nie sumować drobnych per etap.
  Mieszany **wymusza** sumę per etap (różne stawki) → drobne wracają; zaokrąglić na końcu sumy należnego.
- `transactions.kosztorys_stage_id` ma już FK do `kosztorys_stages` — usuwanie etapu z wariantami musi
  respektować te same reguły co dziś (blokada etapu z postępem).
- **`stageTotalsForView` („Suma transzy", `settlement.ts:150`) wycenia per-etap przez udział ilości i
  jest z założenia liczbą planu klienta** — NIE jest sumą kosztu podwykonawcy per etap. W Mieszanym nie
  używać jej jako kwoty podwykonawcy (kwota podwykonawcy = `rowMixedNet` / Σ komórek). Nota dla
  implementera, nie zmiana kodu.

## What We're NOT Doing

- **Nie usuwamy** globalnych widoków z/bez — zostają jako widełki (decyzja właściciela). Ich ewentualne
  wchłonięcie przez mieszany dopiero „jak się sprawdzi".
- **Nie budujemy** rozliczenia per pracownik z etapów („kto zrobił który etap" → konkretna ekipa).
  Wypłaty dalej idą z realnych transakcji PAYOUT; wariant per etap daje tylko poprawną **sumę kosztu**.
- **Nie dokładamy encji ani pola „ekipa" na etapie.** W realnym arkuszu nazwa ekipy siedzi w
  **etykiecie etapu** („1 etap PAWEL AES") — u nas to istniejące, edytowalne `kosztorys_stages.label`
  (decyzja właściciela 2026-07-21: „mogą zmienić label etapu"). Jedyna nowa rzecz per etap to
  **wariant z/bez**; nazwę ekipy właściciel wpisuje w label jak dotąd.
- **Nie ruszamy** panelu plan-vs-actual / marży planowanej (figura F, przyszłość).
- **Nie robimy** migracji/backfillu danych — kosztorys jest throwaway do dogfoodingu; czyste dopisy.
- **Nie zmieniamy** osi netto/brutto w widokach podwykonawcy (dalej ukryta, EX-558) — mieszany to też
  plan podwykonawcy.
- **Nie dotykamy** znaczenia `kosztorys_items.cost_variant` (istniejący per-praca override) poza
  wpięciem go jako fallback pod poziom 2 — patrz Faza 2 „Uwaga o `costVariant` na pozycji".

## Implementation Approach

Kaskada wariantu = ta sama „inheritance z override" co VAT/współczynniki, plus oś etapu. Trzy poziomy
danych rozwiązują się do jednego wariantu per komórka (praca×etap): `poziom3 ?? poziom2 ?? poziom1`.
Silnik mieszany sumuje komórki po rozwiązanym wariancie. Widok mieszany renderuje ten sam dataset,
tylko wycena przechodzi przez resolver zamiast globalnego `view`. Bramka rozliczenia to jeden warunek
`priceView === 'mixed'` na bloku „pozostało do wypłaty".

## Critical Implementation Details

**State sequencing (kaskada w drzewie).** Poziom 2 (sekcja×etap) jest keyed po **sekcji**, nie po
wierszu — nie mieści się w płaskim `KosztorysV2RowT` per praca. Musi wejść na `KosztorysTreeT` jako
osobna mapa `sectionStageVariants: Map<sectionId, Map<stageId, CostVariantT>>` i być przewleczony do
funkcji rozliczeniowych obok `rows`. Poziom 3 (praca×etap) rozszerza `StageProgressT` o opcjonalny
`costVariant` i jedzie na wierszu równolegle do `stage_<id>` ilości (nowy klucz `stagevar_<id>` albo
druga mapa) — inaczej `treeToRows` gubi go tak samo jak dziś gubi `progress` po zbudowaniu.

**Mieszany nie ma jednej ceny j.m.** `viewPrice(row, 'mixed')` nie zwraca sensownej liczby (stawka
zmienia się per etap). Widok mieszany liczy wartość **wyłącznie** na poziomie rozliczeniowym (Σ
komórek) — `calc.ts` dla `'mixed'` musi być omijany (a `viewPrice`/`subcontractorPrice` NIGDY nie
wołane z `'mixed'` — patrz „Mixed surfaces" w Fazie 2). Wiersz w mieszanym pokazuje kwotę (Σ komórek).
Kolumna „Cena j.m." **zostaje z wyraźnym oznaczeniem** (decyzja właściciela): w wierszu o mieszanych
wariantach etapów → marker „miks — stawka różna per etap" zamiast liczby; w wierszu jednorodnym → ta
jedna stawka. Sortowanie kolumny wartości → po kwocie wiersza (nie po cenie j.m.).

**Mixed dociera do WIĘCEJ niż suma — pełna lista powierzchni cenowych.** Poza `rowValueForView` /
`sectionSubtotalsForView` (suma) `'mixed'` musi być obsłużony (albo świadomie ominięty) w: komórkach
per-etap siatki (`stageValueForView`, `calc.ts:115` — to jest kolorowana kwota z UI Fazy 3, wycena
per wariant komórki), kolumnie ceny + trybie podwykonawcy siatki (`kosztorys-v2-columns.tsx:212`,
typowane `'w_tools'|'own_tools'` → dziś TS error na `'mixed'`), sortowaniu po cenie
(`sort-value.ts:28` `case 'price'` → dziś cicho `clientPrice`), panelach współczynników
(`kosztorys-global-settings.tsx:62,70`), opcjach kolumn (`kosztorys-v2-column-opts.ts`). Żaden z tych
punktów NIE jest `switch` — wszystkie to `if`/ternary z domyślnym „klient/fallback", więc failure mode
= **cicha wycena klientem**, nie wyjątek. Stąd wymóg jawnego przejścia po liście.

## Phase 1: Schemat (kaskada — poziomy 2 i 3)

### Overview

Dołożenie miejsc na wariant per etap: kolumna na komórce postępu (poziom 3) i nowa relacja sekcja×etap
(poziom 2). Poziom 1 (`default_cost_variant`) już jest.

### Changes Required

#### 1. Migracja — kolumna na `stage_progress` + tabela sekcja×etap

**File**: `src/migrations/20260721_0_add_kosztorys_cost_variant_per_stage.ts` (nowa, ręczna)

**Intent**: Dodać `cost_variant varchar` (nullable) do `stage_progress`; utworzyć tabelę
`kosztorys_section_stage_variants`; dopisać jej `<slug>_id` do `payload_locked_documents_rels`.

**Contract**: Wzorzec = `20260720_0_add_kosztorys_shares.ts`. Nowa tabela:
`id serial PK, section_id integer NOT NULL REFERENCES kosztorys_sections(id) ON DELETE CASCADE,
stage_id integer NOT NULL REFERENCES kosztorys_stages(id) ON DELETE CASCADE, cost_variant varchar NOT
NULL, created_at/updated_at timestamp(3) tz NOT NULL DEFAULT now()`, `UNIQUE(section_id, stage_id)`,
indeksy na obu FK. Idempotentne DDL (`IF NOT EXISTS`). `down` = `DROP` + `ALTER … DROP COLUMN`.
Rejestracja w `src/migrations/index.ts`.

#### 2. Nowa kolekcja Payload — sekcja×etap wariant

**File**: `src/collections/kosztorys-section-stage-variants.ts` (nowa)

**Intent**: Kolekcja lustrzana dla tabeli sekcja×etap, spójna z innymi kosztorysowymi (access
`isAdminOrOwnerOrManager`, revalidate hooks). Mutacja i tak przez raw SQL upsert (jak `stage_progress`).

**Contract**: pola `section` (rel→kosztorys-sections, required), `stage` (rel→kosztorys-stages,
required), `costVariant` (text, required). Rejestracja w `payload.config.ts`. Regeneracja typów
(`pnpm generate:types`, gitignored).

#### 3. `stage_progress` — pole `costVariant`

**File**: `src/collections/stage-progress.ts`

**Intent**: Dodać opcjonalne `costVariant` (text, nullable) — poziom 3 kaskady na komórce postępu.

**Contract**: `costVariant` text, optional. Bez zmiany `UNIQUE(item_id, stage_id)`.

### Success Criteria

#### Automated Verification

- Migracja aplikuje się czysto na lokalnej bazie (docker 5433): `pnpm payload migrate`
- Typy generują się bez błędu: `pnpm generate:types`
- Typecheck przechodzi: `pnpm typecheck`

#### Manual Verification

- Nowa tabela i kolumna widoczne w bazie; kolekcja sekcja×etap w panelu Payload.

---

## Phase 2: Silnik kosztu mieszanego (warstwa rozliczeniowa)

### Overview

Resolver wariantu komórki (kaskada) + liczenie Σ po komórkach; `PriceViewT` dostaje `'mixed'`;
przewleczenie danych wariantu przez drzewo i builder wierszy.

### Changes Required

#### 1. Typy — wariant per komórka na drzewie i wierszu

**File**: `src/lib/kosztorys/types.ts`

**Intent**: Dołożyć poziom 2 i 3 do modelu danych: mapa sekcja×etap na `KosztorysTreeT`, opcjonalny
`costVariant` na `StageProgressT`, i przewleczenie per-cell wariantu na płaski wiersz.

**Contract**: `StageProgressT` += `costVariant?: CostVariantT | null`. `KosztorysTreeT` +=
`sectionStageVariants: { sectionId: number; stageId: number; variant: CostVariantT }[]` (płaska lista,
budowana do mapy w warstwie liczącej). `KosztorysV2RowBaseT` już niesie `sectionDefaultCostVariant`
(poziom 1); per-cell wariant jedzie równolegle do `stage_<id>` (nowy `stagevar_<id>` klucz lub druga
mapa na wierszu — wybór implementera, byle `diffRow` go nie gubił).

#### 2. Resolver kaskady

**File**: `src/lib/kosztorys/settlement.ts` (albo nowy `cost-variant.ts` jeśli czytelniej)

**Intent**: Jedna czysta funkcja rozwiązująca wariant komórki (praca×etap) po kaskadzie.

**Contract**: `resolveCellVariant(row, stageId, sectionStageVariants): CostVariantT` =
`cellVariant(row, stageId) ?? sectionStageVariants.get(sectionId,stageId) ?? row.sectionDefaultCostVariant`.
Czysta, testowalna. **Uwaga o `costVariant` na pozycji:** istniejący `kosztorys_items.cost_variant`
(per-praca, bez osi etapu) wchodzi jako fallback **pod** poziom 2 a **nad** poziom 1, albo zostaje
zignorowany na rzecz per-cell — do rozstrzygnięcia w implementacji (rekomendacja: per-cell poziom 3
zastępuje go; item.cost_variant zostaje tylko jako default dla nowej komórki). Nie rozszerzać zakresu.

#### 3. Liczenie mieszane per wiersz i sekcja

**File**: `src/lib/kosztorys/settlement.ts`

**Intent**: Funkcja licząca wartość wiersza w widoku mieszanym jako Σ po etapach
`(ilość_etapu × subcontractorPrice(row, rozwiązany_wariant))`, pre-rabat; wpięcie w subtotale i w
„suma wykonanej pracy".

**Contract**: `rowMixedNet(row, stages, sectionStageVariants): number` = Σ po `stages`
`stageQty × subcontractorPrice(row, resolveCellVariant(...))`. `sectionSubtotalsForView` i
`rowValueForView` rozpoznają `view === 'mixed'` i delegują do liczenia mieszanego (zamiast
`netForQtyForView(row, Σqty, view)`). Zaokrąglenie na poziomie sumy należnego (drobne z per-etap).
`executedWorkNetPreRabat` działa bez zmian na subtotalach mieszanych.

#### 4. `PriceViewT` += `'mixed'`

**File**: `src/lib/kosztorys/calc.ts`

**Intent**: Dodać `'mixed'` do unii widoku. `calc.ts` nie umie wycenić mieszanego per-jednostkę
(stawka per etap) — mieszany liczony wyłącznie w `settlement.ts`.

**Contract**: `PriceViewT = 'client' | 'w_tools' | 'own_tools' | 'mixed'`. `viewPrice`/`subcontractorPrice`
dla `'mixed'` — poza kontraktem (nie wołane; ewentualnie guard). Zod enum widoku (jeśli istnieje) +=
`'mixed'`.

#### 5. Wpięcie danych wariantu w budowę drzewa

**File**: query budujący `KosztorysTreeT` (lib/db / loader kosztorysu) + `src/lib/kosztorys/v2-rows.ts`

**Intent**: Załadować sekcja×etap warianty i per-cell warianty do drzewa; `treeToRows` przewleka
per-cell wariant na wiersz.

**Contract**: loader dołącza `sectionStageVariants` (z nowej tabeli) i `costVariant` do wpisów
`progress`. `treeToRows` mapuje per-cell wariant na `stagevar_<id>` (lub drugą mapę); `diffRow` go nie
tłucze.

### Success Criteria

#### Automated Verification

- Test jednostkowy silnika mieszanego (przykład 18/15) przechodzi: `pnpm exec vitest run src/__tests__/lib/kosztorys/mixed-cost.test.ts`
- Istniejące testy rozliczenia zielone: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Typecheck: `pnpm typecheck`

#### Manual Verification

- Dla jednorodnej inwestycji (wszystkie komórki jeden wariant) mieszany == widok tego wariantu.

---

## Phase 3: Widok „Mieszany" + bramka rozliczenia + edycja ekip

### Overview

Czwarta opcja w toolbarze (Mieszany na końcu, najrzadziej używany), bramka „pozostało do
wypłaty" tylko w mieszanym, i klikalna powierzchnia przypisania ekip (kolorowane komórki, poziom 2/3).

### Changes Required

#### 1. Toolbar — czwarty widok, Mieszany na końcu

**File**: `src/components/kosztorys/kosztorys-toolbar-options.tsx`, `src/components/kosztorys/use-price-view.ts`

**Intent**: Dołożyć „Mieszany" do `VIEWS` i `VIEW_LEGEND`; ustawić go **na końcu** (Klient → Z
narzędziami → Bez narzędzi → Mieszany) — najrzadziej używany. Edytor startuje na Kliencie —
`DEFAULT_VIEW` bez zmian.

**Contract**: `VIEWS` += `{ value: 'mixed', label: 'Mieszany', icon: … }` na końcu listy; `VIEW_LEGEND`
analogicznie. **`VALID_VIEWS` w `use-price-view.ts` += `'mixed'`** — bez tego persystowana wartość
`'mixed'` cofa się do `'client'` (use-persisted-enum.ts:27-30). `DEFAULT_VIEW='client'` bez zmian,
brak auto-przełączania na plan podwykonawcy (nie ma dziś takiego mechanizmu — poza zakresem).

#### 2. Bramka rozliczenia w bloku podsumowania

**File**: `src/components/kosztorys/kosztorys-totals-panel.tsx`, `src/components/kosztorys/subcontractor-summary.tsx`

**Intent**: „Pozostało do wypłaty" (należne − Σ PAYOUT) renderuje się **tylko** dla `priceView ===
'mixed'`. W z/bez pokazać należne (hipoteza) bez bloku „Zaliczki / pozostało".

**Contract**: `SubcontractorSummary` dostaje flagę `showReconciliation = priceView === 'mixed'` (lub
warunek w `HeadlineSummary`). Przy `false` renderuje tylko „Suma wykonanej pracy". Kolapsowany headline
panelu: „Pozostało do wypłaty" tylko w mieszanym; w z/bez headline = należne (hipoteza).

#### 3. Wiersz w mieszanym — kolumny zostają z wyraźną informacją (decyzja właściciela)

**File**: kolumny siatki (`src/lib/kosztorys/column-config.ts` / render wiersza)

**Intent**: Żadnej kolumny NIE chowamy w Mieszanym (właściciel, 2026-07-21). Dwie kolumny bez sensownej
liczby w tym widoku pokazują **wyraźną informację zamiast kwoty**, reszta liczy się normalnie:

- **„Cena j.m."** — wiersz o mieszanych wariantach etapów → marker „miks — stawka różna per etap";
  wiersz jednorodny → ta jedna stawka. (Nie jedna cena, bo stawki mieszają się per etap.)
- **„Pozostało do rozliczenia" (kwota)** → „nie dotyczy" + krótkie wyjaśnienie: niewykonane etapy nie
  mają jeszcze przypisanej ekipy (z/bez), więc kwota do wypłaty za nie jest hipotezą, nie liczbą.
- **Wartość wiersza** = kwota wykonana `rowMixedNet` (Σ komórek po rozwiązanym wariancie).
- **Ilościowe „Pozostało"** (sztuki/m²) zostaje bez zmian — to ilość, nie kwota, więc widok-niezależne.

**Contract**: dla `view === 'mixed'` kolumny ceny j.m. i kwotowego „Pozostało do rozliczenia" renderują
tekst informacyjny zamiast liczby (marker / „nie dotyczy" + tooltip/legenda z powodem); wartość wiersza
z `rowMixedNet`. Sortowanie kolumny wartości → po kwocie wiersza (`rowMixedNet`), nie po cenie j.m.

#### 4. Powierzchnia edycji ekip (poziom 2 i 3)

**File**: siatka etapów (render komórek + nagłówków) + nowe server actions w `src/lib/actions/kosztorys.ts`

**Intent**: Komórki etapów kolorowane rozwiązanym wariantem; klik nagłówka sekcji na kolumnie etapu →
ustaw wariant sekcja×etap (poziom 2); klik komórki → override praca×etap (poziom 3). Optymistycznie.

**Contract**: dwie mutacje przez `protectedAction`:
`setSectionStageVariantAction(sectionId, stageId, variant)` (raw SQL upsert `ON CONFLICT
(section_id, stage_id)`), `setCellVariantAction(itemId, stageId, variant | null)` (upsert na
`stage_progress`, jak `setStageProgressAction`; `null` czyści poziom 3). `updateTag` + optymistyka
`useOptimisticFormStore`. Kolorowanie = mapowanie `CostVariantT → token @theme` (dwa kolory), literal
lookup (nie template string).

### Success Criteria

#### Automated Verification

- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Testy komponentu/rozliczenia zielone: `pnpm exec vitest run src/__tests__/lib/kosztorys/`

#### Manual Verification

- Toolbar pokazuje 4 widoki; zejście z „Klient" ląduje na „Mieszany".
- W mieszanym: klik nagłówka sekcji na etapie przełącza wariant całej sekcji w tym etapie, kolor
  komórek się zmienia, kwoty się przeliczają optymistycznie; klik pojedynczej komórki nadpisuje ją.
- „Pozostało do wypłaty" widoczne TYLKO w mieszanym; w z/bez widać należne bez rozliczenia.
- Wiersz w mieszanym pokazuje kwotę, nie cenę j.m.

**Implementation Note**: Po tej fazie zatrzymać się na potwierdzenie manualne właściciela (klikalna
edycja + bramka to sedno UX) przed seedem/testami.

---

## Phase 4: Seed Białostocka + testy

### Overview

Seed ustawia warianty tak, by mieszany zgadzał się z arkuszem; testy silnika mieszanego i bramki jako
regresja.

### Changes Required

#### 1. Seed — default sekcji „bez narzędzi"

**File**: `src/scripts/seed-investment-from-sheet.ts`

**Intent**: Białostocka jest jednorodnie „bez narzędzi" (arkuszowe 56 431 = Σ etapów × stawka bez), więc
sekcje dostają `defaultCostVariant = 'own_tools'`; brak override'ów sekcja×etap i per-cell. Mieszany ==
bez ≈ 56 431.

**Contract**: seed zapisuje `default_cost_variant='own_tools'` na sekcjach. Bez wpisów do nowej tabeli
sekcja×etap i bez per-cell wariantu (jednorodna inwestycja). REFETCH ścieżka bez zmian.

#### 2. Testy jednostkowe

**File**: `src/__tests__/lib/kosztorys/mixed-cost.test.ts` (nowy)

**Intent**: Zabezpieczyć rdzeń: resolver kaskady (3?2?1), Σ po komórkach, przykład 18/15 leży między
widełkami, bramka rozliczenia (należne mieszane vs z/bez).

**Contract**: przypadki — (a) jednorodna sekcja: mieszany == default sekcji; (b) sekcja×etap nadpisuje
default; (c) praca×etap nadpisuje sekcja×etap; (d) malowanie stawki 18/15, etapy 1–2 z / 3–4 bez →
`(e1+e2)×18+(e3+e4)×15`, wynik ∈ (całość bez, całość z); (e) należne mieszane pre-rabat.

**Grunt na realnych współczynnikach (arkusz Michał Malarz, patrz domain-notes):** stawka podwykonawcy
w tym arkuszu = **z narzędziami 0,65×cena_klienta, bez narzędzi 0,5525×cena_klienta** (0,65×0,85).
Dobry sanity-check dla przypadku (d): przy cenie klienta `L` mieszany dla dwóch etapów z / dwóch bez =
`(e1+e2)×0,65L + (e3+e4)×0,5525L`, i musi leżeć między „całość z" (×0,65L) a „całość bez" (×0,5525L).

### Success Criteria

#### Automated Verification

- Nowe testy przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/mixed-cost.test.ts`
- Pełny zestaw kosztorysu zielony: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- Seed przechodzi: `INV=42 REFETCH=1 node --env-file=.env --import tsx src/scripts/seed-investment-from-sheet.ts`

#### Manual Verification

- Po seedzie INV 42: widok mieszany „suma wykonanej pracy" ≈ 56 431 (== bez narzędzi, jednorodna
  inwestycja); z/bez pokazują widełki, mieszany między nimi (tu równy dolnej granicy).

---

## Testing Strategy

### Unit Tests

- Resolver kaskady: 3?2?1 dla wszystkich kombinacji ustawione/null.
- Σ po komórkach z różnymi wariantami per etap (przykład 18/15).
- Mieszany zawsze ∈ [całość bez, całość z] (własność widełek).
- Bramka: `remaining` liczone tylko dla `'mixed'`.

### Integration / Manual

- Klikalna edycja ekip (poziom 2 i 3) — optymistyczny zapis, kolory, przeliczenie kwot.
- Seed INV 42 → mieszany ≈ 56 431.

## Performance Considerations

Σ po komórkach to `liczba_prac × liczba_etapów` mnożeń per przeliczenie — przy 1000+ prac × 10 etapów
to 10k operacji, liczone w `useMemo` na `[rows, stages, view, sectionStageVariants]`. React Compiler
memoizuje; nie dokładać ręcznych `useMemo` poza istniejącymi punktami w `use-kosztorys-editor.ts`.

## Migration Notes

Bez backfillu — kosztorys throwaway do dogfoodingu. Nowa kolumna nullable + nowa tabela = czysty dopis.
Migracja prod (`pnpm db:migrate:prod`) wdrażana ręcznie przez człowieka **przed** wypchnięciem kodu,
gdy change realnie trafia do prod (dziś kosztorys nie jest w prod — patrz AGENTS.md „Kosztorys data is
throwaway").

## References

- Design (zamknięty): `context/reference/kosztorys-editor-domain-notes.md` → „Wariant z/bez narzędzi"
- Nadbudowywany slice: `context/changes/podsumowanie-podwykonawcow/` (EX-554, implemented)
- Silnik cenowy: `src/lib/kosztorys/calc.ts:36,45,72`
- Warstwa rozliczeniowa: `src/lib/kosztorys/settlement.ts:79,84,100,179`
- Wyliczenie należnego: `src/components/kosztorys/use-kosztorys-editor.ts:313,394`
- Schemat: `src/migrations/20260708_2_add_kosztorys_sections_items.ts`, `20260709_0_add_kosztorys_stages.ts`, `20260720_0_add_kosztorys_shares.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schemat (kaskada — poziomy 2 i 3)

#### Automated

- [ ] 1.1 Migracja aplikuje się czysto: `pnpm payload migrate`
- [ ] 1.2 Typy generują się bez błędu: `pnpm generate:types`
- [ ] 1.3 Typecheck przechodzi: `pnpm typecheck`

### Phase 2: Silnik kosztu mieszanego

#### Automated

- [ ] 2.1 Test silnika mieszanego (18/15): `pnpm exec vitest run src/__tests__/lib/kosztorys/mixed-cost.test.ts`
- [ ] 2.2 Istniejące testy rozliczenia zielone: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- [ ] 2.3 Typecheck: `pnpm typecheck`

### Phase 3: Widok „Mieszany" + bramka + edycja ekip

#### Automated

- [ ] 3.1 Typecheck: `pnpm typecheck`
- [ ] 3.2 Lint: `pnpm lint`
- [ ] 3.3 Testy kosztorysu zielone: `pnpm exec vitest run src/__tests__/lib/kosztorys/`

### Phase 4: Seed Białostocka + testy

#### Automated

- [ ] 4.1 Nowe testy przechodzą: `pnpm exec vitest run src/__tests__/lib/kosztorys/mixed-cost.test.ts`
- [ ] 4.2 Pełny zestaw kosztorysu zielony: `pnpm exec vitest run src/__tests__/lib/kosztorys/`
- [ ] 4.3 Seed przechodzi: `INV=42 REFETCH=1 node --env-file=.env --import tsx src/scripts/seed-investment-from-sheet.ts`
