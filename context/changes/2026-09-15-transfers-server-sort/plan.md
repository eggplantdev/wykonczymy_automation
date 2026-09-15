# Sortowanie tabeli transakcji na serwerze — plan implementacji

## Overview

Klik w nagłówek tabeli transakcji ma sortować **cały przefiltrowany zbiór**, a nie tylko sto wierszy
pobranych na bieżącą stronę. Sort trafia do URL-a (`?sort=-amount`), serwer zwraca pierwszą stronę
z tej kolejności, a wydruk dociąga dane **tym samym** kluczem — więc ekran i papier fizycznie nie
mogą się rozjechać. Siedem kolumn, których wartość pochodzi z innej tabeli, traci sortowanie i
zawęża się je filtrami; brakujący filtr „Pracownik" powstaje w tym samym slice.

Źródło: EX-777, znalezione podczas przebiegu manual-checks na staging 2026-09-14.

## Current State Analysis

- `DataTable` (`src/components/ui/data-table/data-table.tsx:84`) trzyma `SortingState` w lokalnym
  `useState` i przepuszcza wiersze przez `getSortedRowModel()`. Nie ma `manualSorting`, więc
  sortowanie **nigdy nie opuszcza przeglądarki** — a tabela transakcji dostaje z serwera tylko jedną
  stronę (domyślnie 100 wierszy, `DEFAULT_LIMIT`).
- `findTransfersRaw` (`src/lib/queries/transfers.ts:20`) **już** przyjmuje `sort` i ma go w kluczu
  `unstable_cache`. Domyślna wartość to `-id`. Nikt tego parametru nie podaje.
- Wydruk (`src/components/transfers/print-transfers-button.tsx:56`) robi to poprawnie: dociąga cały
  zbiór i przesortowuje go klientowo przez `sortTransferRows` kluczem z `table.getState().sorting`.
  Stąd rozjazd — dwie różne instancje sortujące na dwóch różnych zbiorach.
- Siedem kolumn pokazuje **nazwę z innej tabeli**, a wiersz transakcji trzyma pod nimi samo `id`
  (nazwa dokleja się dopiero w `buildTransferRows`, po pobraniu strony): `investment`,
  `expenseCategory`, `otherCategory`, `sourceRegister`, `targetRegister`, `worker`, `createdBy`.
  `payload.find` z `depth: 0` nie ma po czym ich sortować.
- Pozostałe osiem sortowalnych kolumn to kolumny własne `transactions` i **id kolumny = nazwa pola
  Payloada**: `id`, `date`, `amount`, `type`, `paymentMethod`, `description`, `vatPlane`,
  `createdAt` (`src/collections/transfers.ts`).
- Filtr „Kasa źródłowa" zawęża `sourceRegister` **LUB** `targetRegister`
  (`src/lib/queries/transfer-filters.ts:100`) — etykieta obiecuje mniej, niż filtr robi.
- `where.worker` istnieje (`transfer-filters.ts:143`), ale jako `equals` i bez kontrolki w UI —
  wyłącznie cel linku `investmentTransfersHref` (`?type=PAYOUT&worker=<id>`). `worker` nie figuruje
  w `ENTITY_FILTER_KEYS`, więc „Wyczyść filtry" go nie kasuje.
- Cztery hosty tabeli, wszystkie przez `TransfersSection` → `TransferTableServer` →
  `TransferDataTable`: `/inwestycje/[id]`, `/kasa/[id]`, `/pracownicy/[id]`, dashboard managera.

## Desired End State

Klik w nagłówek jednej z ośmiu sortowalnych kolumn zmienia `?sort=` w URL-u, resetuje stronę na
pierwszą i pokazuje pierwsze sto wierszy z kolejności liczonej na **całym** przefiltrowanym zbiorze.
Trzeci klik zdejmuje sortowanie i wraca do domyślnego `-id`. Wydruk zamówiony z tego widoku ma
dokładnie tę samą kolejność, bo pobiera dane już posortowane przez bazę — w kodzie nie ma już
drugiego miejsca, które sortuje transakcje. Siedem kolumn relacyjnych nie ma klikalnego nagłówka;
każda z nich ma filtr, „Pracownik" włącznie.

### Key Discoveries

- Wszystkie osiem sortowalnych kolumn mapuje się 1:1 na pola Payloada — `?sort=` przechodzi do
  `payload.find` bez tłumaczenia. Potrzebna tylko **biała lista**, żeby `?sort=cokolwiek` nie poszło
  do bazy i nie zatruło klucza cache'a osobnym wpisem na każdą śmieciową wartość.
- `findAllTransfersForExport` (`src/lib/queries/export-transfers.ts:9`) ma `sort: '-date'` na sztywno
  — wystarczy parametr, żeby wydruk sortował się w bazie.
- `sortTransferRows` sortuje kolacją polską (`localeCompare(…, 'pl')`), Postgres własną. Po zabraniu
  siedmiu kolumn relacyjnych jedynym wolnym tekstem do sortowania zostaje `description` — tam obie
  kolacje mogą się różnić na ogonkach, i to jest dokładnie ta szczelina, którą trzeba zamknąć, a nie
  zostawić.
- `useUrlFilterParams` (`src/hooks/use-url-filter-params.ts`) robi `router.replace(url, { scroll:
false })` i **z definicji resetuje `page`** — czyli zarzut „klik w nagłówek gubi pozycję scrolla"
  nie dotyczy tej ścieżki, a reset strony jest tu pożądany.
- `buildFilterConfig` już podaje `refData.workers` (pod kluczem `users`, jako filtr „Dodał") — lista
  pracowników do nowego filtra jest pod ręką, bez dodatkowego zapytania.
- Tryb audytu anulowanych jest bezpieczny: doklejanie oryginałów nad wierszami `CANCELLATION`
  (`transfer-table-server.tsx:49`) dzieje się **po** pobraniu strony, więc para zostaje sklejona
  niezależnie od klucza sortowania.
- `investmentTransfersHref` emituje `worker=<id>` jako pojedynczą liczbę — `parseNumericIds` czyta to
  jako listę jednoelementową, więc przejście `equals` → `in` nie psuje istniejącego linku.

## What We're NOT Doing

- **Nie przepisujemy listy transakcji na surowy SQL z JOIN-ami.** To jedyna droga do sortowania po
  nazwach z innych tabel i została świadomie odrzucona (decyzja właściciela, 2026-09-15).
- Nie ruszamy sortowania w pozostałych siedmiu tabelach na `DataTable` — zmiana kontraktu jest
  opt-in, nieużyta ścieżka zachowuje się jak dziś.
- Nie dodajemy filtrów, których nie ma: „Kasa docelowa" zostaje obsłużona istniejącym filtrem kasy,
  a nie własną kontrolką.
- Nie dotykamy `netAmount` / plan brutto, cancellation audit ani pobierania faktur.
- Nie piszemy specu E2E w tym slice — ląduje jako issue z etykietą `e2e-backlog` (decyzja
  właściciela; przebieg pakietu to ~godzina).

## Implementation Approach

Jedna instancja sortuje: baza. Do niej prowadzi jeden kanał — parametr `?sort=` przepuszczony przez
białą listę, ten sam dla listy na ekranie i dla zbioru pod wydruk. `DataTable` dostaje opcjonalne
sterowanie sortowaniem z zewnątrz (`sorting` + `onSortingChange`); podanie obu przełącza tabelę w
`manualSorting`, brak — zostawia dzisiejsze zachowanie nietknięte. Kolumny, których baza nie umie
posortować, przestają udawać, że umieją.

## Critical Implementation Details

**Domyślna kolejność musi być jedna, nie dwie.** Lista domyślnie sortuje `-id`, a eksport `-date` —
czyli przy zdjętym sortowaniu ekran i wydruk **nadal** mogą się różnić (wiersz wpisany wstecznie ma
wysokie `id` i starą datę). Slice wprowadza jedną stałą `DEFAULT_TRANSFER_SORT = '-id'`, używaną po
obu stronach. To zmienia domyślną kolejność **wydruku** z „po dacie malejąco" na „po dacie wpisania
malejąco" — widoczne tylko tam, gdzie ktoś wpisywał transakcje wstecznie. Świadomy koszt: bez tego
slice zamyka rozjazd dla ośmiu kolumn i zostawia go dla stanu domyślnego, czyli najczęstszego.

## Phase 1: Sort serwerowy

### Overview

`?sort=` przechodzi z URL-a przez białą listę do `findTransfersRaw`; `DataTable` uczy się przyjmować
sortowanie z zewnątrz; siedem kolumn relacyjnych traci klikalny nagłówek w tym samym kroku — inaczej
przez jedną fazę istniałby stan, w którym klik w „Inwestycja" nie robi nic i nie mówi dlaczego.

### Changes Required:

#### 1. Biała lista sortowalnych kolumn

**File**: `src/lib/transfers/sortable-columns.ts` (nowy)

**Intent**: Jedno miejsce, które wie, po czym baza umie posortować transakcje — czytane i przez
parser `?sort=`, i przez spec pilnujący, że kolumny UI się z tym zgadzają.

**Contract**: eksportuje `SERVER_SORTABLE_TRANSFER_COLUMNS` (`readonly` krotka ośmiu id: `id`,
`date`, `amount`, `type`, `paymentMethod`, `description`, `vatPlane`, `createdAt`), typ pochodny
`ServerSortableColumnT` oraz `DEFAULT_TRANSFER_SORT = '-id'`. Bez importów z `components/**` —
konsument w `lib/queries` nie może ciągnąć za sobą drzewa Reacta.

#### 2. Konwersja `SortingState` ↔ parametr URL

**File**: `src/lib/table/sort-param.ts` (nowy)

**Intent**: Zamiana między tym, co trzyma TanStack, a tym, co rozumie Payload, w jednym miejscu —
używa jej klient (nagłówek, wydruk) i serwer (parser). Domenowo pusta, stąd `lib/table/` obok
`column-order.ts` i `column-label.ts`, a nie `lib/transfers/`.

**Contract**: `sortParamToSortingState(param: string | undefined): SortingState` i
`sortingStateToParam(sorting: SortingState): string` — format Payloada (`-amount` = malejąco,
`amount` = rosnąco). Obsługuje tylko pierwszą kolumnę sortowania; pusty `SortingState` → pusty string
(czyli „usuń parametr z URL-a", nie „wpisz wartość domyślną").

#### 3. Parser parametru na serwerze

**File**: `src/lib/queries/transfer-sort.ts` (nowy)

**Intent**: Przyjmuje `searchParams` i oddaje wartość gotową dla `payload.find`, odrzucając wszystko
spoza białej listy. Wzorzec i kształt jak `parsePagination` (`src/lib/utils/pagination.ts:18`), które
tak samo waliduje `limit` względem `ALLOWED_LIMITS`.

**Contract**: `parseTransferSort(searchParams: ResolvedSearchParamsT): string` — zwraca
`DEFAULT_TRANSFER_SORT` dla braku parametru, wartości nie-stringowej, nieznanej kolumny i pustego
stringa. Nigdy nie rzuca: śmieciowy URL ma dać listę domyślną, nie błąd 500.

#### 4. Przepuszczenie sortu przez warstwę zapytań

**Files**: `src/components/transfers/transfer-table-config.ts`,
`src/components/transfers/transfer-table-server.tsx`, oraz cztery hosty:
`src/app/(frontend)/inwestycje/[id]/page.tsx`, `src/app/(frontend)/kasa/[id]/page.tsx`,
`src/app/(frontend)/pracownicy/[id]/page.tsx`, `src/components/dashboard/manager-dashboard.tsx`

**Intent**: `sort` jedzie tą samą drogą co `page` i `limit` — host parsuje go z `searchParams` i
wkłada do `config.query`, serwer podaje dalej do `findTransfersRaw`.

**Contract**: `TransferQueryT` zyskuje `sort: string`. Każdy host woła `parseTransferSort(sp)` obok
istniejącego `parsePagination(sp)`. `TransferTableServer` przekazuje `listQuery.sort` bez zmian —
`findTransfersRaw` ma już ten parametr i ma go w kluczu cache'a, więc nic tam nie trzeba dotykać.

#### 5. `DataTable` przyjmuje sortowanie z zewnątrz

**File**: `src/components/ui/data-table/data-table.tsx`

**Intent**: Opcjonalne sterowanie sortowaniem, bez zmiany zachowania dla tabel, które go nie podają.

**Contract**: dwa nowe propsy — `sorting?: SortingState`, `onSortingChange?: (next: SortingState) =>
void`. Gdy oba są podane, stan sortowania czyta się z propsa zamiast z `useState`, a tabela dostaje
`manualSorting: true` (`getSortedRowModel` zostaje w konfiguracji — przy `manualSorting` TanStack go
pomija). Gdy ich nie ma, wszystko działa jak dziś, łącznie z `initialSorting`.

#### 6. Wpięcie tabeli transakcji w URL

**File**: `src/components/transfers/transfer-data-table.tsx`

**Intent**: Stan sortowania tabeli transakcji mieszka w URL-u — dzięki temu posortowany widok jest
linkiem, tak samo jak przefiltrowany.

**Contract**: komponent czyta `?sort=` przez `useSearchParams`, zamienia na `SortingState`
(`sortParamToSortingState`) i podaje do `DataTable`; `onSortingChange` zapisuje wynik przez
`useUrlFilterParams(baseUrl).updateParam('sort', …)`. Pusty `SortingState` zapisuje pusty string,
czyli kasuje parametr — to jest „trzeci klik wraca do domyślnej kolejności". Reset `page` przychodzi
z hooka za darmo.

#### 7. Siedem kolumn przestaje udawać sortowalne

**File**: `src/components/tables/transfers.tsx`

**Intent**: Kolumna, której baza nie posortuje, nie ma klikalnego nagłówka — zamiast sortowania jest
filtr.

**Contract**: `enableSorting: false` na `investment`, `expenseCategory`, `otherCategory`,
`sourceRegister`, `targetRegister`, `worker`, `createdBy` — wypisane wprost przy każdej kolumnie, nie
wyliczane z białej listy: przy kolumnie ma być widać jej własną decyzję, a spójność obu list pilnuje
spec.

### Success Criteria:

#### Automated Verification:

- Spec parsera odrzuca kolumny spoza białej listy i wartości nie-stringowe:
  `pnpm exec vitest run src/__tests__/lib/queries/transfer-sort.test.ts`
- Spec konwersji `SortingState` ↔ parametr (oba kierunki, pusty stan → pusty string):
  `pnpm exec vitest run src/__tests__/lib/table/sort-param.test.ts`
- Przepisany spec zgodności kolumn — każda kolumna z włączonym sortowaniem jest na białej liście i
  odwrotnie: `pnpm exec vitest run src/__tests__/components/tables/transfers-sortable-columns.test.ts`
- Spec integracyjny: zapytanie z `?sort=-amount` zwraca na pierwszej stronie największe kwoty z
  **całego** zbioru, nie z pierwszej setki wierszy (`pnpm test:integration`, spec pod
  `src/__tests__/lib/queries/`)

#### Manual Verification:

- Na `/inwestycje/26` (366 transakcji) klik w „Kwota" wyrzuca na górę `#1102` 73 656,26 zł — wiersz,
  którego dziś na pierwszej stronie nie widać
- Trzeci klik w ten sam nagłówek zdejmuje sortowanie i wraca do kolejności sprzed kliknięć
- Posortowany widok wklejony jako link otwiera się posortowany
- Nagłówki siedmiu kolumn relacyjnych nie reagują na klik i nie pokazują strzałki
- Pozostałe tabele (sprzęt, flota, kosztorysy, inwestycje, pracownicy, zgłoszenia, szablony,
  katalog prac) sortują jak przed zmianą

---

## Phase 2: Wydruk na tym samym kluczu

### Overview

Wydruk przestaje sortować u siebie i prosi bazę o dane w tej samej kolejności co ekran.
`sortTransferRows` znika — po tej fazie w repo nie ma drugiego miejsca sortującego transakcje.

### Changes Required:

#### 1. Sort w ścieżce eksportu

**Files**: `src/lib/queries/export-transfers.ts`, `src/lib/queries/fetch-transfer-rows.ts`,
`src/lib/actions/fetch-transfers-for-invoices.ts`

**Intent**: Wołający może powiedzieć, w jakiej kolejności chce cały zbiór; kto nie powie, dostaje
domyślną.

**Contract**: `findAllTransfersForExport(where, sort?)` — `sort` domyślnie
`DEFAULT_TRANSFER_SORT`, zastępując dzisiejsze `'-date'` wpisane na sztywno. `fetchAllTransferRows` i
`fetchFilteredTransfers` przepuszczają go w swoich obiektach opcji obok `skipMedia`. Ścieżka
pobierania faktur (`InvoiceDownloadButton`) nie podaje nic i nie zmienia zachowania poza samą
domyślną kolejnością.

#### 2. Przycisk wydruku przestaje sortować

**File**: `src/components/transfers/print-transfers-button.tsx`

**Intent**: Klucz sortowania jedzie do serwera zamiast być stosowany po powrocie danych.

**Contract**: `sortingStateToParam(table.getState().sorting)` trafia do
`fetchFilteredTransfers(where, { skipMedia: true, sort })`; wiersze idą do
`buildTransfersPrintHtml` w kolejności, w jakiej przyszły. Komentarz „Refetches instead of reusing
the table's rows…" zostaje — nadal tłumaczy, czemu wydruk dociąga dane — ale musi przestać sugerować,
że kolejność powstaje tutaj.

#### 3. Usunięcie martwego modułu

**Files**: `src/lib/transfers/sort-transfer-rows.ts`, `src/__tests__/lib/transfers/sort-transfer-rows.test.ts`

**Intent**: Po przepięciu wydruku nikt tego nie woła, a zostawiony moduł to zaproszenie, żeby
ktoś kiedyś znowu posortował transakcje po swojemu.

**Contract**: oba pliki usunięte. Kasowanie zagwarantowane typecheckiem, nie gresem — `pnpm
typecheck` musi przejść po usunięciu (zasada z `lessons.md`: dead code gate on typecheck).

### Success Criteria:

#### Automated Verification:

- Nie ma odwołań do usuniętego modułu — `pnpm typecheck` przechodzi po skasowaniu obu plików
- Pakiet jednostkowy przechodzi bez skasowanego specu: `pnpm test`

#### Manual Verification:

- Na `/inwestycje/26` posortowanej po „Kwota" malejąco pierwsze dziesięć wierszy wydruku to te same
  dziesięć wierszy, co na ekranie, w tej samej kolejności
- Wydruk bez aktywnego sortowania wychodzi w kolejności identycznej z ekranem bez sortowania
- Pobieranie faktur (ZIP) działa jak przed zmianą

---

## Phase 3: Filtr „Pracownik" i etykieta „Kasa"

### Overview

Kolumna „Pracownik" straciła sortowanie w fazie 1 i jako jedyna z siódemki nie miała nic w zamian —
dostaje filtr. Przy okazji etykieta filtra kasy zaczyna mówić to, co filtr robi.

### Changes Required:

#### 1. `where.worker` przyjmuje listę

**File**: `src/lib/queries/transfer-filters.ts`

**Intent**: Filtr pracownika zachowuje się jak sześć sąsiednich filtrów, nie inaczej.

**Contract**: `worker` przechodzi z `{ equals: Number(param) }` na `parseNumericIds` + `{ in: ids }`,
tym samym wzorcem co `investment` i `createdBy` — łącznie z krótkim spięciem na `NO_RESULTS` dla
parametru, z którego nie da się wyciągnąć żadnego id. Pojedyncze `?worker=3` z
`investmentTransfersHref` musi dalej filtrować do tego jednego pracownika. Komentarz przy filtrze
(dziś tłumaczący, czemu śmieć jest tolerowany zamiast zwracać pustkę) zmienia się razem z
zachowaniem.

#### 2. Kontrolka w UI

**Files**: `src/types/filters.ts`, `src/lib/utils/build-filter-config.ts`,
`src/components/transfers/transfer-filters.tsx`, `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: Wybór pracownika klikiem, wykluczony tam, gdzie pracownik jest domyślny.

**Contract**: `FilterConfigT` zyskuje `workers?: { id: number; name: string }[]`, `FilterKeyT` klucz
`'workers'`, `buildFilterConfig` wypełnia go z `refData.workers` (tego samego źródła co `users`).
`TransferFilters` renderuje `FilterMultiSelect` z etykietą „Pracownik" i ikoną z `lucide-react`
dobraną do sąsiadów, a `worker` dochodzi do `ENTITY_FILTER_KEYS`, żeby „Wyczyść filtry" go kasował.
`/pracownicy/[id]` dopisuje `'workers'` do listy wykluczeń obok `'users'`.

#### 3. Etykieta filtra kasy

**File**: `src/components/transfers/transfer-filters.tsx`

**Intent**: Filtr zawęża kasę źródłową **lub** docelową, a nazywa się „Kasa źródłowa" — po zabraniu
sortowania z kolumny „Kasa docelowa" to jedyna droga do tej kolumny i musi być odnajdywalna.

**Contract**: etykieta kontrolki z „Kasa źródłowa" na „Kasa". Klucz parametru w URL-u
(`sourceRegister`) **zostaje** — jest w `ENTITY_FILTER_KEYS`, w linkach i w specach; zmiana nazwy
parametru to osobna sprawa, nie etykieta.

### Success Criteria:

#### Automated Verification:

- Spec `buildTransferFilters`: `?worker=3` (pojedyncze id z linku) i `?worker=3,7` (multi-select)
  dają odpowiednio `{ in: [3] }` i `{ in: [3, 7] }`, a `?worker=abc` → `NO_RESULTS`:
  `pnpm exec vitest run src/__tests__/build-transfer-filters.test.ts`

#### Manual Verification:

- Filtr „Pracownik" zawęża listę do wybranych osób i da się wybrać kilka naraz
- „Wyczyść filtry" kasuje też pracownika
- Na `/pracownicy/[id]` filtra „Pracownik" nie ma (pracownik jest domyślny)
- Link „wypłaty" z karty inwestycji dalej trafia w listę zawężoną do jednego pracownika
- Filtr „Kasa" pokazuje transakcje, w których wybrana kasa jest źródłem **albo** celem

---

## Testing Strategy

### Unit Tests:

- `parseTransferSort` — brak parametru, kolumna spoza białej listy, wartość nie-stringowa, pusty
  string; każdy przypadek wraca do `DEFAULT_TRANSFER_SORT` zamiast rzucać
- `sortParamToSortingState` / `sortingStateToParam` — oba kierunki, malejąco i rosnąco, pusty stan
- Zgodność kolumn UI z białą listą, w obie strony (przepisany
  `transfers-sortable-columns.test.ts`): kolumna z włączonym sortowaniem musi być na liście, a każda
  pozycja listy musi odpowiadać realnej kolumnie. To następca dzisiejszego specu — jego inwariant
  „id kolumny trafia w klucz wiersza" zastępuje mocniejszy „id kolumny trafia w pole bazy"
- `buildTransferFilters` — `worker` jako `in`, ze wstecznym przypadkiem pojedynczego id

### Integration Tests:

- Zapytanie z sortem po kwocie na zbiorze większym niż jedna strona zwraca globalnie największe
  kwoty na pierwszej stronie — to jest ryzyko, o które chodzi w całym slice (ryzyko
  „sort widzi tylko część zbioru" z `test-plan.md`). Spec DB-owy, więc pod
  `src/__tests__/lib/queries/`, wykrywany przez `scripts/test-integration.sh`

### E2E:

Nie w tym slice. Issue z etykietą `e2e-backlog` w projekcie „Wykonczymy" — **EX-781**: *sortowanie po kwocie na
liście dłuższej niż strona → przejście na drugą stronę → wydruk; kolejność na ekranie i w oknie
wydruku musi być ta sama*. Test disposition zapisany w issue, żeby strażnik regresji pojechał razem z
ewentualną przyszłą zmianą.

### Manual Testing Steps:

1. `/inwestycje/26`, klik „Kwota" — na górze `#1102` 73 656,26 zł i `#3181` 28 400,00 zł
2. Drugi klik odwraca kolejność, trzeci ją zdejmuje
3. Wydruk z widoku posortowanego po kwocie — dziesięć pierwszych wierszy zgadza się z ekranem
4. Klik w nagłówek „Inwestycja" — nic się nie dzieje, brak strzałki
5. Filtr „Pracownik" + „Wyczyść filtry"
6. Ten sam obchód na `/kasa/[id]`, `/pracownicy/[id]` i dashboardzie managera

## Performance Considerations

Każdy klik w nagłówek to round trip zamiast przestawienia tablicy w pamięci — świadomy koszt
poprawności. Trzy rzeczy go amortyzują: `findTransfersRaw` jest w `unstable_cache` z `sort` w kluczu
(druga wizyta w tej samej kolejności nie dotyka bazy), `router.replace(…, { scroll: false })` nie
przewija strony, a `useTransition` w `useUrlFilterParams` trzyma stary widok do czasu odpowiedzi.
Sortowanie idzie po kolumnach własnych `transactions`; `date` i `amount` to najczęstsze klucze —
gdyby zapytanie zwalniało, indeks na `date` jest naturalnym następnym krokiem (nie w tym slice, bez
zmierzonego problemu).

Wydruk nie zmienia liczby zapytań — dalej jeden `findAllTransfersForExport`, tylko z innym `ORDER BY`.

## Migration Notes

Brak migracji — slice nie dotyka schematu. Stary URL bez `?sort=` zachowuje się jak dziś. Jedyna
widoczna zmiana bez działania użytkownika to domyślna kolejność **wydruku** (`-date` → `-id`, patrz
„Critical Implementation Details").

## Whole-tree Gate

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm build`

## References

- Notatka zakresowa i decyzje właściciela: `context/changes/2026-09-15-transfers-server-sort/change.md`
- EX-777 (Linear, projekt „Wykonczymy")
- Rejestr znaleziska: `context/foundation/manual-checks.md`, sekcja `transfer-print-return` →
  `### Findings — 2026-09-14`
- Wzorzec walidacji parametru URL: `src/lib/utils/pagination.ts:18` (`parsePagination`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Sort serwerowy

#### Automated

- [x] 1.1 Spec parsera `?sort=` (biała lista, wartości śmieciowe) — c909593d
- [x] 1.2 Spec konwersji `SortingState` ↔ parametr URL — c909593d
- [x] 1.3 Przepisany spec zgodności kolumn z białą listą — c909593d
- [x] 1.4 Spec integracyjny: sort obejmuje cały zbiór, nie jedną stronę — c909593d

### Phase 2: Wydruk na tym samym kluczu

#### Automated

- [x] 2.1 `pnpm typecheck` po usunięciu `sort-transfer-rows.ts` — 32e07129
- [x] 2.2 Pakiet jednostkowy przechodzi bez skasowanego specu

### Phase 3: Filtr „Pracownik" i etykieta „Kasa"

#### Automated

- [x] 3.1 Spec `buildTransferFilters` dla `worker` jako `in` (z przypadkiem pojedynczego id z linku) — 7971ac55
