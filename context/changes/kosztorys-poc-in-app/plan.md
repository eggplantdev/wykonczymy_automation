# Kosztorys robocizny w aplikacji (POC) — Implementation Plan

## Overview

Edytowalna rozpiska robocizny per inwestycja, w aplikacji, jako dowód że appka
może w pełni zastąpić ręczny arkusz Google Sheets w tej części, której dziś nie
obejmuje. Czysty start (zero importu arkuszy), baza aplikacji = źródło prawdy.
Nowa trasa współistnieje z istniejącą zakładką „Arkusz". Jakość POC — wolno iść
skrótami, ale wzorce repo (collections / migracje / `protectedAction` / cache /
TanStack Table / druk przez iframe) trzymamy 1:1.

## Current State Analysis

- **Robocizna w appce dziś = kwota zbiorcza.** Jedna transakcja `LABOR_COST`
  (`src/collections/transfers.ts:8-24`). Rozpiska (sekcje → pozycje → ceny →
  etapy) żyje wyłącznie w arkuszu. Edytor przejmuje rozpiskę.
- **Actuals są już w pełni queryowalne.** `deriveFinancials()`
  (`src/lib/db/sum-transfers.ts:303-322`) zwraca `totalLaborCosts`,
  `totalPayouts`, `totalRabat`, `totalLoss`, materiały; `calculateMargin()`
  (`src/lib/calculate-margin.ts:13-14`) liczy marżę rzeczywistą. Panel
  plan-vs-actual czyta to, nic nie re-deriwuje.
- **Detale inwestycji są route-based, nie taby.** „Arkusz" to osobna trasa
  `/inwestycje/[id]/kosztorys` (`src/app/(frontend)/inwestycje/[id]/kosztorys/page.tsx`).
  Nowy edytor = nowa trasa równoległa.
- **Inline-edit nie istnieje w repo.** TanStack Table jest, ale wszystkie edycje
  idą przez dialogi (`src/lib/tables/transfers.tsx:183-394`,
  `EditTransferDialog`). Edytowalna siatka + autosave per pole to NOWY wzorzec.
- **`useOptimisticFormStore` jest single-flight, dialog-owy**
  (`src/stores/optimistic-form-store.ts`): jeden `openFormId`, jedno
  `submission`. Nie obsłuży wielu komórek edytowanych równolegle — Phase 3 buduje
  lekki per-cell wzorzec optymistyczny (patrz Critical Implementation Details).
- **Migracje pisane ręcznie** (`migrate:create` zepsuty od marca); wzorzec
  tworzenia tabeli + FK + rejestracji w `payload_locked_documents_rels`:
  `src/migrations/20260528_move_sheet_id_to_kosztoryses.ts`,
  `src/migrations/20260407_add_amount_edit_audit.ts`. Rejestr:
  `src/migrations/index.ts`.
- **Druk bez zależności:** `buildPrintHtml` (`src/lib/export/print.tsx:95-107`) +
  `printViaIframe` (`src/lib/export/print-iframe.ts`) — `renderToStaticMarkup` →
  iframe → `window.print()`. Reuse 1:1.

## Desired End State

Po zakończeniu planu OWNER/ADMIN/MANAGER wchodzi w inwestycję, otwiera „Kosztorys
(edytor)", widzi i edytuje pełną rozpiskę robocizny jak arkusz (sekcje, pozycje,
3 ceny, przedmiar/pomiar, rabat, VAT, dynamiczne etapy z postępem) z natychmiastowym
zapisem per pole, czyta panel plan-vs-actual z marżą planowaną i rzeczywistą,
prowadzi kalkulator metrażu pokoi i generuje konfigurowalny PDF-ofertę dla klienta.
EMPLOYEE nie widzi kosztorysu w ogóle. Zakładka „Arkusz" działa bez zmian.

Weryfikacja: `pnpm build` (migracja + typy + next build) przechodzi; ręczne
przejście pełnego cyklu na lokalnej bazie `wykonczymy-poc`.

### Key Discoveries:

- Wzorzec migracji + rejestracji collection: `src/migrations/index.ts`,
  `src/payload.config.ts:59-69`, `src/lib/cache/tags.ts`.
- `protectedAction()` (`src/lib/actions/utils.ts:44-74`) + `revalidateCollections`
  (`src/lib/cache/revalidate.ts`) = gotowy szkielet każdej mutacji.
- Actuals do panelu: `deriveFinancials` + `calculateMargin`; zbieranie danych jak
  w `src/app/(frontend)/inwestycje/[id]/page.tsx:44-58`.
- Gate ról: `MANAGEMENT_ROLES` (`src/lib/auth/roles.ts`), `isAdminOrOwnerOrManager`
  (`src/access/index.ts`).

## What We're NOT Doing

- Import arkuszy, teardown Sheets, synchronizacja dwukierunkowa.
- **Sprzężenie sumy rozpiski z `LABOR_COST`** — rozpiska stoi obok jako plan;
  `LABOR_COST` pozostaje osobną ręczną transakcją (decyzja P5).
- Schemat cen wariant B (dynamiczna tabela `price_variants`/`item_prices`) —
  bierzemy **wariant A** (3 sztywne kolumny); migracja A→B później mechaniczna.
- `work_catalogue`, multi-waluta, drag-reorder (tylko strzałki), szablony /
  auto-tworzenie kosztorysu, auto-link pokój→pozycja, ukrywanie komórek przed
  MANAGEREM (follow-on P10).

## Implementation Approach

Pionowo, fazami. Fazy 1–3 to rdzeń (dowodzi tezy POC: appka zastępuje arkusz).
Fazy 4–6 czytają gotowe dane i można je dostarczać przyrostowo. Zapisujemy wyłącznie
inputy; wszystkie wartości/sumy/marża/brutto/V liczone na żywo czystymi funkcjami.

### Decyzje domknięte (defaulty POC)

- **VAT default = 8%** (remont mieszkań); kaskada: globalny default → `vat_rate`
  na sekcji → pozycja dziedziczy, opcjonalny override per pozycja.
- **default_cost_variant = `w_tools`** na sekcji; pozycja dziedziczy, override per
  pozycja (P11).
- **Eksport domyślnie ukrywa wiersze zerowe/puste** (`measured_qty=0` lub brak
  ceny klienta) → `hidden_in_export` ustawiane wg reguły, owner nadpisuje (P12).
- **Oferta drukuje przedmiar**, z przełącznikiem na pomiar (P13).
- PLN, hard-delete, etapy zmienne (zwykle 6), reorder strzałkami.

## Critical Implementation Details

- **Per-cell optymistyka (Phase 3) — NIE używać `useOptimisticFormStore`.** Ten
  store jest single-flight i dialog-owy; siatka edytuje wiele komórek naraz.
  Wzorzec: lokalny stan komórki aktualizuje UI natychmiast → akcja `protectedAction`
  strzela debounced (teksty/liczby) lub od razu (add/remove/checkbox) →
  na sukces zostawiamy stan (zgodny z bazą), na błąd revert lokalny + toast.
  Po udanym zapisie wołamy `router.refresh()` żeby pociągnąć przeliczone sumy z
  serwera (lekcja: fire-and-forget bez `router.refresh` nie odświeża widoku —
  `context/foundation/lessons.md`). Sumy/marża liczone serwerowo z odświeżonych
  inputów; lokalnie liczymy je też optymistycznie, by nie mrugało.
- **Usunięcie etapu z wpisanym postępem → BLOKADA** po stronie akcji: jeśli
  istnieje `stage_progress` z `qty_done > 0` dla tego `stage_id`, akcja zwraca
  `{ success:false, error:'Najpierw wyczyść ilości w tym etapie' }`.
- **Kolumny etapów renderowane z danych** (`kosztorys_stages` posortowane po
  `ordinal`), nie statycznie — liczba kolumn zmienna per inwestycja.
- **Wartość liczona z pomiaru (`measured_qty`)**, nie przedmiaru. W szablonie/przy
  dodaniu pozycji pomiar startuje skopiowany z przedmiaru (jedyna „magia").
- **FK `ON DELETE CASCADE`** do `investments` na wszystkich tabelach + kaskady
  wewnętrzne (section→items, item→stage_progress, stage→stage_progress), bo
  hard-delete i brak osieroconych wierszy.

---

## Phase 1: Schemat danych

### Overview

Pięć tabel, pięć kolekcji Payload, rejestracja, cache tagi, ręczna migracja,
regeneracja typów. Po tej fazie schemat istnieje na `wykonczymy-poc` i typy są
dostępne, choć nic jeszcze nie czyta/pisze z UI.

### Changes Required:

#### 1. Migracja tabel

**File**: `src/migrations/20260620_add_kosztorys_tables.ts` (nowy)

**Intent**: Utworzyć 5 tabel POC z FK i indeksami; zarejestrować każdą edytowalną
tabelę w `payload_locked_documents_rels`. Ręcznie, wzorem
`20260528_move_sheet_id_to_kosztoryses.ts`.

**Contract**: kolumny (PLN jako `numeric`, snake_case, `id serial PK`, `created_at`/
`updated_at timestamptz default now()`):

- `kosztorys_sections`: `investment_id integer REFERENCES investments(id) ON DELETE CASCADE NOT NULL`, `name varchar NOT NULL`, `display_order integer NOT NULL DEFAULT 0`, `vat_rate numeric NOT NULL DEFAULT 0.08`, `default_cost_variant varchar NOT NULL DEFAULT 'w_tools'`.
- `kosztorys_items`: `investment_id` (FK CASCADE, NOT NULL), `section_id integer REFERENCES kosztorys_sections(id) ON DELETE CASCADE NOT NULL`, `display_order integer NOT NULL DEFAULT 0`, `description varchar`, `unit varchar`, `planned_qty numeric NOT NULL DEFAULT 0`, `measured_qty numeric NOT NULL DEFAULT 0`, `discount_type varchar` (`'percent'|'amount'`, nullable), `discount_value numeric NOT NULL DEFAULT 0`, `client_price numeric NOT NULL DEFAULT 0`, `subcontractor_w_tools_price numeric NOT NULL DEFAULT 0`, `subcontractor_own_tools_price numeric NOT NULL DEFAULT 0`, `cost_variant varchar` (nullable, dziedziczy z sekcji), `vat_rate numeric` (nullable, override sekcji), `hidden_in_export boolean NOT NULL DEFAULT false`, `note varchar`.
- `kosztorys_stages`: `investment_id` (FK CASCADE, NOT NULL), `ordinal integer NOT NULL`, `label varchar`. `UNIQUE(investment_id, ordinal)`.
- `stage_progress`: `item_id integer REFERENCES kosztorys_items(id) ON DELETE CASCADE NOT NULL`, `stage_id integer REFERENCES kosztorys_stages(id) ON DELETE CASCADE NOT NULL`, `qty_done numeric NOT NULL DEFAULT 0`. `UNIQUE(item_id, stage_id)`.
- `kosztorys_rooms`: `investment_id` (FK CASCADE, NOT NULL), `name varchar`, `floor_m2 numeric`, `perimeter numeric`, `height numeric`, `wall_m2 numeric`, `ceiling_decor_m2 numeric`, `baseboard_m numeric`.

Indeksy: `created_at`/`updated_at` na każdej tabeli, FK kolumny (`investment_id`,
`section_id`, `item_id`, `stage_id`). `down()` w odwrotnej kolejności: usuń kolumny

- indeksy z `payload_locked_documents_rels`, potem `DROP TABLE` (kolejność:
  stage_progress → kosztorys_items → kosztorys_stages → kosztorys_rooms →
  kosztorys_sections, ze względu na FK).

#### 2. Rejestracja migracji

**File**: `src/migrations/index.ts`

**Intent**: Dodać import nowej migracji do tablicy `migrations` (up/down/name; name
== nazwa pliku).

**Contract**: nowy wpis na końcu tablicy.

#### 3. Kolekcje Payload

**File**: `src/collections/kosztorys-sections.ts`, `kosztorys-items.ts`,
`kosztorys-stages.ts`, `stage-progress.ts`, `kosztorys-rooms.ts` (nowe)

**Intent**: Definicje collection 1:1 z kolumnami migracji, wzorem
`src/collections/expense-categories.ts` (proste) i `transfers.ts` (relacje,
const-enum dla `cost_variant`/`discount_type`). Access: wszystkie CRUD przez
`isAdminOrOwnerOrManager`. Hooki `afterChange`/`afterDelete` przez
`makeRevalidateAfterChange/Delete` z własnym slugiem (+ bump `investments`).

**Contract**: slugi `kosztorys-sections`, `kosztorys-items`, `kosztorys-stages`,
`stage-progress`, `kosztorys-rooms`. Pola relacji: `investment`
(relationTo `investments`), `section` (relationTo `kosztorys-sections`),
`item`/`stage` w `stage-progress`. Enumy jako const arrays (`cost_variant`:
`w_tools|own_tools`; `discount_type`: `percent|amount`).

#### 4. Rejestracja w configu + cache tagi

**File**: `src/payload.config.ts`, `src/lib/cache/tags.ts`

**Intent**: Dodać 5 kolekcji do tablicy `collections`. Dodać klucze do
`CACHE_TAGS` dla nowych slugów.

**Contract**: `CACHE_TAGS.kosztorysSections = 'collection:kosztorys-sections'`
(analogicznie dla pozostałych czterech).

#### 5. Regeneracja typów

**File**: `src/payload-types.ts` (generowany, gitignored)

**Intent**: `pnpm generate:types` po zdefiniowaniu kolekcji. Nigdy `git add`.

### Success Criteria:

#### Automated Verification:

- Migracja aplikuje się czysto na `wykonczymy-poc`: `pnpm payload migrate`
- Typy generują się bez błędu: `pnpm generate:types`
- Typecheck przechodzi: `pnpm exec tsc --noEmit` (lub `pnpm typecheck`)
- Build przechodzi: `pnpm build`

#### Manual Verification:

- Panel admin Payload pokazuje 5 nowych kolekcji i pozwala dodać rekord ręcznie
- FK CASCADE działa: usunięcie inwestycji kasuje powiązane wiersze (sprawdzić na
  testowej inwestycji w `wykonczymy-poc`)
- `down()` migracji czysto cofa (test lokalny migrate down/up)

**Implementation Note**: Po przejściu automatycznej weryfikacji zatrzymaj się na
potwierdzenie manualne przed Phase 2.

---

## Phase 2: Ścieżka odczytu + trasa + warstwa liczona

### Overview

Nowa trasa edytora z bramką dostępu, query całego drzewa kosztorysu per inwestycja,
czyste funkcje liczące i **read-only** siatka (TanStack, grupowanie po sekcji,
dynamiczne kolumny etapów). Po tej fazie widać rozpiskę (jeśli dodana ręcznie w
adminie), ale jeszcze się jej nie edytuje z UI.

### Changes Required:

#### 1. Warstwa liczona (czyste funkcje)

**File**: `src/lib/kosztorys/calc.ts` (nowy)

**Intent**: Jedyne źródło formuł. Bez stanu, łatwe do testów. Liczy z `measured_qty`.

**Contract**: funkcje (czyste, wejście = inputy z §schematu):
`effectiveVat(item, section)`, `effectiveCostVariant(item, section)`,
`rowNet(item)` (pomiar × `client_price` minus rabat: percent `×(1−v)`, kwota `−v`),
`rowNetForVariant(item, section)` (pomiar × cena wariantu kosztu, z rabatem),
`rowGross(item, section)`, `stageValue(item, stageId, progress)`
(`qty_done × client_price` z rabatem), `rowRemaining(item, progress)`
(`rowNet − Σ stageValue` = „pozostało do wykonania"), `sectionTotals(...)`,
`grandTotals(...)`. Uwaga: nie odwzorowujemy błędów copy-paste z arkusza.

#### 2. Query drzewa kosztorysu

**File**: `src/lib/queries/kosztorys.ts` (nowy)

**Intent**: Pobrać sekcje + pozycje + etapy + postęp dla inwestycji jednym
spójnym odczytem (cache `unstable_cache` + tagi nowych kolekcji), zwrócić ułożone
drzewo gotowe do renderu.

**Contract**: `getKosztorysTree(investmentId): Promise<KosztorysTreeT>` —
`{ sections: (Section & { items: Item[] })[], stages: Stage[], progress: StageProgress[] }`,
posortowane po `display_order`/`ordinal`. Typ `KosztorysTreeT` w `src/types/`.

#### 3. Trasa edytora + bramka dostępu

**File**: `src/app/(frontend)/inwestycje/[id]/kosztorys-edytor/page.tsx` (nowy)

**Intent**: Server component: `requireAuth(MANAGEMENT_ROLES)` (EMPLOYEE odpada),
pobiera drzewo, renderuje siatkę read-only. Wzór trasy:
`inwestycje/[id]/kosztorys/page.tsx`.

**Contract**: trasa `/inwestycje/[id]/kosztorys-edytor`. Link wejścia obok
istniejącego `SheetButton` na stronie detalu inwestycji
(`src/app/(frontend)/inwestycje/[id]/page.tsx`).

#### 4. Read-only siatka

**File**: `src/components/kosztorys/kosztorys-grid.tsx` (nowy) + kolumny w
`src/lib/tables/kosztorys.tsx` (nowy)

**Intent**: TanStack Table, grupowanie wierszy po sekcji (nagłówek sekcji + suma),
kolumny stałe (opis, jednostka, przedmiar, pomiar, 3 ceny, rabat, VAT, netto,
brutto, pozostało) + dynamiczne kolumny etapów z `stages`. Przełącznik
netto/brutto i wariantu ceny. Wzór: `src/lib/tables/transfers.tsx`.

**Contract**: `createColumnHelper<KosztorysRowT>()`; kolumny etapów budowane w pętli
z `stages`. Render przez istniejący `DataTable`
(`src/components/ui/data-table/data-table.tsx`) lub własny wrapper jeśli grupowanie
sekcji tego wymaga.

### Success Criteria:

#### Automated Verification:

- Testy jednostkowe warstwy liczonej: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`
- Typecheck przechodzi: `pnpm typecheck`
- Build przechodzi: `pnpm build`

#### Manual Verification:

- EMPLOYEE dostaje odmowę/redirect na `/inwestycje/[id]/kosztorys-edytor`;
  ADMIN/OWNER/MANAGER widzą siatkę
- Rekord dodany ręcznie w adminie pojawia się w siatce z poprawnymi sumami i
  brutto/pozostało
- Dynamiczne kolumny etapów odpowiadają liczbie wierszy `kosztorys_stages`

**Implementation Note**: Zatrzymaj się na potwierdzenie manualne przed Phase 3.

---

## Phase 3: Edytowalna siatka + optymistyczny autosave (RDZEŃ)

### Overview

Sednem POC. Akcje mutujące każdy input, per-cell optymistyka z debounce, blokada
usunięcia etapu z postępem, reorder strzałkami. Po tej fazie rozpiska jest w pełni
edytowalna jak arkusz, bez przycisku „Zapisz".

### Changes Required:

#### 1. Akcje mutujące

**File**: `src/lib/actions/kosztorys.ts` (nowy)

**Intent**: Komplet mutacji przez `protectedAction` + `revalidateCollections`.
Wzór: `src/lib/actions/transfers.ts` (walidacja Zod, `perfStart`, `ActionResultT`).

**Contract** (każda waliduje wejście Zod, gate `MANAGEMENT_ROLES`):
`updateItemFieldAction(itemId, patch)`, `updateSectionAction(sectionId, patch)`,
`addItemAction(sectionId)` (pomiar startuje = przedmiar),
`removeItemAction(itemId)`, `addSectionAction(investmentId)`,
`removeSectionAction(sectionId)`, `addStageAction(investmentId)` (kolejny `ordinal`),
`removeStageAction(stageId)` (**BLOKADA** gdy istnieje `qty_done>0`),
`setStageProgressAction(itemId, stageId, qtyDone)` (upsert, `qty_done=0` może
usuwać wiersz), `reorderAction(entity, id, direction)` (swap `display_order`/
`ordinal`). Revalidate odpowiednie nowe tagi + `investments`.

#### 2. Per-cell optymistyka

**File**: `src/components/kosztorys/use-cell-autosave.ts` (nowy) +
rozbudowa `kosztorys-grid.tsx`

**Intent**: Hook: lokalny stan komórki → UI natychmiast → akcja debounced (teksty/
liczby) / od razu (checkbox, add/remove) → sukces: zostaw stan + `router.refresh()`;
błąd: revert + toast. NIE używać `useOptimisticFormStore` (single-flight). Lokalnie
liczymy sumy/marżę optymistycznie, by nie mrugało; serwer jest źródłem prawdy po
refreshu.

**Contract**: `useCellAutosave({ value, action, debounceMs })` →
`{ value, onChange, isSaving, error }`. Edytowalne komórki = `<input>`/`<select>`
inline w cellach TanStack.

#### 3. Sterowanie strukturą w UI

**File**: `kosztorys-grid.tsx` + `src/components/kosztorys/` (przyciski/akcje)

**Intent**: Dodaj/usuń pozycję i sekcję, dodaj/usuń etap (kolumnę), strzałki
reorder, edycja nazwy sekcji i `label` etapu inline. Usunięcie etapu z postępem
pokazuje komunikat blokady (z akcji).

**Contract**: przyciski wołają akcje z §1 przez wzorzec optymistyczny z §2.

### Success Criteria:

#### Automated Verification:

- Testy akcji (blokada usunięcia etapu, upsert postępu, reorder swap):
  `pnpm exec vitest run src/__tests__/kosztorys-actions.test.ts`
- Typecheck przechodzi: `pnpm typecheck`
- Build przechodzi: `pnpm build`

#### Manual Verification:

- Edycja komórki (pomiar/cena/rabat) zapisuje się bez przycisku; po odświeżeniu
  wartość trwała; sumy/brutto/pozostało przeliczone
- Dodanie/usunięcie pozycji, sekcji, etapu działa optymistycznie
- Usunięcie etapu z wpisanym postępem jest zablokowane z komunikatem
- Reorder strzałkami zmienia kolejność trwale
- 1000+ wierszy: edycja jednego pola zapisuje tylko to pole (sprawdzić w logach
  `[PERF]` że nie ma zapisu całego arkusza)

**Implementation Note**: Zatrzymaj się na potwierdzenie manualne przed Phase 4.

---

## Phase 4: Panel plan-vs-actual

### Overview

Read-only panel per inwestycja: plan z rozpiski obok actuals z transakcji, marża
planowana vs rzeczywista. Niezależny od linkage `LABOR_COST` (stoi obok).

### Changes Required:

#### 1. Obliczenie planu z rozpiski

**File**: `src/lib/kosztorys/plan-vs-actual.ts` (nowy)

**Intent**: Złożyć wiersze panelu z warstwy liczonej (plan) i `deriveFinancials`
(actuals). Bez nowych zapytań do ledgera — reuse istniejących.

**Contract**: `buildPlanVsActual(tree, financials): PlanVsActualT` z wierszami:
plan robocizny (Σ pomiar×`client_price`), wykonano (Σ wartości odhaczonych etapów +
% planu), zafakturowano (`totalLaborCosts`), wypłacono (`totalPayouts`), plan kosztu
podwykonawcy (Σ pomiar×cena wariantu kosztu pozycji), marża planowana (plan klient
− plan podwykonawcy), marża rzeczywista (`calculateMargin(financials)`), materiały
(`totalMaterialCosts`).

#### 2. Komponent panelu + zebranie actuals

**File**: `src/components/kosztorys/plan-vs-actual-panel.tsx` (nowy); spięcie w
`kosztorys-edytor/page.tsx`

**Intent**: Zebrać financials jak `inwestycje/[id]/page.tsx:44-58`
(`fetchFilteredByType` + `fetchCategoryBreakdowns` → `deriveFinancials`), policzyć
panel, wyrenderować. Wzór wizualny: `financial-stats.tsx`.

**Contract**: panel czysto na odczyt, per inwestycja; widoczność cen podwykonawcy/
marży zostaje (follow-on P10 nie w POC).

### Success Criteria:

#### Automated Verification:

- Test `buildPlanVsActual` (marża planowana, % wykonania):
  `pnpm exec vitest run src/__tests__/kosztorys-plan-vs-actual.test.ts`
- Typecheck + build przechodzą

#### Manual Verification:

- Wartości planu zgadzają się z sumami siatki; actuals zgadzają się z panelem
  finansowym na stronie detalu inwestycji
- Marża planowana = plan klient − plan podwykonawcy; marża rzeczywista = wzór appki

**Implementation Note**: Zatrzymaj się na potwierdzenie manualne przed Phase 5.

---

## Phase 5: Pokoje (kalkulator metrażu)

### Overview

Luźny kalkulator metrażu (`kosztorys_rooms`), bez powiązania z pozycjami — 1:1 z
zakładką „pokoje" w arkuszu. Edytowalna tabela wzorem siatki z Phase 3.

### Changes Required:

#### 1. Formuły pokoi

**File**: `src/lib/kosztorys/rooms.ts` (nowy)

**Intent**: Czyste funkcje metrażu z arkusza.

**Contract**: `perimeter=(a+b)×2`, `wall_m2=perimeter×height`,
`baseboard_m=perimeter`, `paintArea=Σ wall_m2 − ściany pomieszczeń mokrych`.
Wysokość domyślna konfigurowalna (arkusz: 2,58 m), edytowalna per pokój.

#### 2. Akcje + tabela pokoi

**File**: `src/lib/actions/kosztorys-rooms.ts` (nowy),
`src/components/kosztorys/rooms-table.tsx` (nowy)

**Intent**: CRUD pokoi przez `protectedAction`, edytowalna tabela z autosave
(reuse `use-cell-autosave`). Sekcja na trasie edytora.

**Contract**: `addRoomAction`, `updateRoomFieldAction`, `removeRoomAction`.

### Success Criteria:

#### Automated Verification:

- Test formuł pokoi: `pnpm exec vitest run src/__tests__/kosztorys-rooms.test.ts`
- Typecheck + build przechodzą

#### Manual Verification:

- Dodanie pokoju, edycja boków → obwód/ściany/malowanie liczą się poprawnie
- Wartości metrażu można ręcznie przepisać do przedmiaru pozycji

**Implementation Note**: Zatrzymaj się na potwierdzenie manualne przed Phase 6.

---

## Phase 6: Konfigurowalny eksport PDF

### Overview

Krok „przygotuj eksport": toggle widoczności per pozycja (`hidden_in_export`),
potem PDF-oferta dla klienta (tylko ceny klienta) przez druk przeglądarki.

### Changes Required:

#### 1. Reguła domyślnej widoczności + toggle

**File**: `src/components/kosztorys/export-step.tsx` (nowy)

**Intent**: Widok kosztorysu z togglami `hidden_in_export` per pozycja; domyślnie
ukryte wiersze zerowe/puste (reguła P12); owner odkrywa/ukrywa. Zapis flagi przez
`updateItemFieldAction`.

**Contract**: domyślna reguła: `measured_qty=0` lub brak `client_price` →
`hidden_in_export=true` przy pierwszym wejściu (jednorazowo, nie nadpisuje ręcznych).

#### 2. Budowa HTML oferty + druk

**File**: `src/lib/kosztorys/print.tsx` (nowy)

**Intent**: `buildKosztorysPrintHtml` wzorem `src/lib/export/print.tsx`:
`renderToStaticMarkup` → HTML; druk przez `printViaIframe`
(`src/lib/export/print-iframe.ts`). Tylko ceny klienta (netto/VAT/brutto); bez cen
podwykonawcy, marży, postępu, „pozostało". Ilość = przedmiar, przełącznik na pomiar
(P13).

**Contract**: `buildKosztorysPrintHtml(tree, { quantityMode, visibleOnly }): string`.
Zero nowych zależności.

### Success Criteria:

#### Automated Verification:

- Test budowy HTML (wykluczenie `hidden_in_export`, brak kolumn kosztu/marży):
  `pnpm exec vitest run src/__tests__/kosztorys-print.test.ts`
- Typecheck + build przechodzą

#### Manual Verification:

- Krok eksportu domyślnie ukrywa wiersze zerowe; toggle działa
- PDF (print) pokazuje tylko ceny klienta; brak cen podwykonawcy/marży/postępu
- Przełącznik przedmiar/pomiar zmienia drukowaną ilość

**Implementation Note**: Po tej fazie POC kompletny — zatrzymaj się na finalne
potwierdzenie manualne i bramkę zamknięcia slice'u.

---

## Testing Strategy

### Unit Tests:

- Warstwa liczona (`calc.ts`): rabat procent vs kwota, brutto z kaskady VAT,
  „pozostało" = netto − Σ etapów, dziedziczenie `cost_variant`.
- Akcje (`kosztorys.ts`): blokada usunięcia etapu z postępem, upsert
  `stage_progress`, swap `display_order`.
- `plan-vs-actual.ts`: marża planowana, % wykonania, zgodność actuals z
  `deriveFinancials`.
- Formuły pokoi i budowa HTML oferty (wykluczenie ukrytych/kosztowych kolumn).

Anchor na ryzyku (zgodnie z AGENTS.md): asercje na obserwowalnym wyniku
(zapisane wiersze, zwrócony `ActionResultT`, policzone sumy), nie na implementacji.

### Integration Tests:

- Brak harnessu E2E w repo — pomijamy; ścieżki cross-boundary weryfikowane
  manualnie na `wykonczymy-poc`.

### Manual Testing Steps:

1. Jako OWNER: nowy kosztorys od zera (sekcja → pozycje → 3 ceny → etapy → postęp).
2. Edycja inline kilku pól; odświeżenie; trwałość + przeliczone sumy.
3. Usunięcie etapu z postępem → blokada.
4. Panel plan-vs-actual vs panel finansowy na detalu inwestycji.
5. Kalkulator pokoi → przepisanie metrażu do przedmiaru.
6. Eksport PDF — tylko ceny klienta, ukryte wiersze zerowe.
7. Jako EMPLOYEE: brak dostępu do trasy.

## Performance Considerations

- Autosave per pole (nie cały arkusz) — kluczowe przy 1000+ wierszach. Debounce
  tekstów/liczb. Sprawdzić logi `[PERF]` że zapis dotyczy jednego rekordu.
- Query drzewa przez `unstable_cache` z tagami; invalidacja per akcja.

## Migration Notes

- Migracja działa wyłącznie na `wykonczymy-poc` (worktree `.env`). Zero kontaktu z
  Neon/prod. Hand-written (`migrate:create` zepsuty). `pnpm build` odpala
  `payload migrate`.

## References

- Spec: `docs/superpowers/specs/2026-06-19-kosztorys-poc-in-app-design.md`
- Brain dump: `docs/superpowers/specs/2026-06-19-kosztorys-poc-in-app-notes.md`
- Wzór migracji: `src/migrations/20260528_move_sheet_id_to_kosztoryses.ts`
- Wzór akcji: `src/lib/actions/transfers.ts`, `src/lib/actions/utils.ts:44-74`
- Actuals: `src/lib/db/sum-transfers.ts:303-322`, `src/lib/calculate-margin.ts:13-14`
- Druk: `src/lib/export/print.tsx:95-107`, `src/lib/export/print-iframe.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schemat danych

#### Automated

- [ ] 1.1 Migracja aplikuje się czysto: `pnpm payload migrate`
- [ ] 1.2 Typy generują się: `pnpm generate:types`
- [ ] 1.3 Typecheck przechodzi: `pnpm typecheck`
- [ ] 1.4 Build przechodzi: `pnpm build`

#### Manual

- [ ] 1.5 Admin Payload pokazuje 5 kolekcji i pozwala dodać rekord
- [ ] 1.6 FK CASCADE kasuje powiązane wiersze przy usunięciu inwestycji
- [ ] 1.7 `down()` migracji czysto cofa

### Phase 2: Ścieżka odczytu + trasa + warstwa liczona

#### Automated

- [ ] 2.1 Testy warstwy liczonej przechodzą
- [ ] 2.2 Typecheck przechodzi
- [ ] 2.3 Build przechodzi

#### Manual

- [ ] 2.4 EMPLOYEE odmowa; ADMIN/OWNER/MANAGER widzą siatkę
- [ ] 2.5 Rekord z admina widoczny w siatce z poprawnymi sumami/brutto/pozostało
- [ ] 2.6 Liczba kolumn etapów = liczba wierszy `kosztorys_stages`

### Phase 3: Edytowalna siatka + optymistyczny autosave

#### Automated

- [ ] 3.1 Testy akcji (blokada etapu, upsert postępu, reorder) przechodzą
- [ ] 3.2 Typecheck przechodzi
- [ ] 3.3 Build przechodzi

#### Manual

- [ ] 3.4 Edycja komórki zapisuje bez przycisku; trwała po odświeżeniu; sumy przeliczone
- [ ] 3.5 Add/remove pozycji, sekcji, etapu działa optymistycznie
- [ ] 3.6 Usunięcie etapu z postępem zablokowane z komunikatem
- [ ] 3.7 Reorder strzałkami trwały
- [ ] 3.8 Edycja jednego pola przy 1000+ wierszach zapisuje tylko to pole (`[PERF]`)

### Phase 4: Panel plan-vs-actual

#### Automated

- [ ] 4.1 Test `buildPlanVsActual` przechodzi
- [ ] 4.2 Typecheck + build przechodzą

#### Manual

- [ ] 4.3 Plan zgodny z sumami siatki; actuals zgodne z panelem finansowym detalu
- [ ] 4.4 Marża planowana i rzeczywista liczone wg definicji

### Phase 5: Pokoje (kalkulator metrażu)

#### Automated

- [ ] 5.1 Test formuł pokoi przechodzi
- [ ] 5.2 Typecheck + build przechodzą

#### Manual

- [ ] 5.3 Obwód/ściany/malowanie liczą się poprawnie
- [ ] 5.4 Metraż możliwy do przepisania do przedmiaru

### Phase 6: Konfigurowalny eksport PDF

#### Automated

- [ ] 6.1 Test budowy HTML (ukryte/kosztowe kolumny) przechodzi
- [ ] 6.2 Typecheck + build przechodzą

#### Manual

- [ ] 6.3 Krok eksportu domyślnie ukrywa wiersze zerowe; toggle działa
- [ ] 6.4 PDF tylko ceny klienta; bez cen podwykonawcy/marży/postępu
- [ ] 6.5 Przełącznik przedmiar/pomiar zmienia drukowaną ilość
