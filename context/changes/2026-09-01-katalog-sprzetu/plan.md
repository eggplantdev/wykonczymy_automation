# Katalog sprzętu — plan implementacji

## Overview

Rejestr sprzętu firmy: co mamy, u kogo to jest, czy nie stoi w serwisie, kiedy kończy się gwarancja.
Encja + append-only log zdarzeń, „gdzie jest" liczone z najnowszego wpisu, gwarancja pilnowana przez
własny dzienny cron. Wzorzec domenowy jest ten sam co Flota; trzy miejsca świadomie się różnią.

## Current State Analysis

Modułu nie ma. Istnieje natomiast wszystko, na czym stanie:

- **Wzorzec encja + log**: `src/collections/vehicles.ts`, `src/collections/vehicle-inspections.ts`.
- **Pipeline przypomnień**: `api/cron/fleet-reminders/route.ts:16-42` — load → decide → send → stamp,
  gdzie `decide` jest czysty. `stampNotified` (`sweep-io.ts:23-48`) pisze **seryjnie i po wysyłce**,
  zwracając porażki zamiast rzucać — powody zapisane w komentarzu, przenoszą się 1:1.
- **Dwa rejestry powiadomień, oba wymagane**: `STREAMS` + `EPOCHS` (`lib/db/notifications.ts:5-19`,
  kursory przeczytania per user) i `RECIPIENT_LISTS` (`lib/email/recipients.ts:9`, adresy).
- **Lista odbiorców = tabela w bazie**: każde pole `array` globala Payload mapuje się na własną
  tabelę-dziecko (`20260826_0_notification_recipients.ts:19-50`). Czwarta lista = czwarta tabela.
- **Strona pracownika już istnieje** i już jest za `ADMIN_OR_OWNER_MANAGER_ROLES`
  (`app/(frontend)/pracownicy/[id]/page.tsx:17-18`).
- **`DISTINCT ON` jest w repo dokładnie raz** — `lib/db/notifications.ts:74-77`. To jest nasz idiom.
- `thresholds.ts` **miesza politykę terminów z domeną aut** (`OIL_CHANGE_INTERVAL_KM`,
  `isOilChangeOverdue`, `:47-54`), a `DeadlineCell` renderuje `bezterminowo` z pola `exempt`
  (`deadline-cell.tsx:25-27`) — oba są fleetowe, nie generyczne.

## Desired End State

W menu jest „Sprzęt". Lista pokazuje każdą sztukę, u kogo jest i kiedy kończy się gwarancja; jedno
pole wyszukiwania obejmuje nazwę, markę, model i numer seryjny, a filtr „gdzie jest" ma ludzi
i magazyny w jednym rozwijaniu. Detal sztuki pokazuje pełną historię przekazań i serwisów.
Na stronie pracownika widać, co ma na stanie. Codziennie o 6:00 wychodzi mail o gwarancjach
kończących się za 30 i za 7 dni. Weryfikacja: pełny scenariusz w „Manual Testing Steps".

### Key Discoveries:

- **Kolejność migracji to kolejność leksykalna nazw plików**, a licznik pęka na 10
  (`lessons.md:807`) — plik nazywa się `20260903_0_add_equipment.ts`.
- **`payload_locked_documents_rels` potrzebuje kolumny na KAŻDĄ nową kolekcję** — zapomniano jej przy
  `expense_categories` i kosztowało to migrację naprawczą (`20260310_fix_locked_docs_expense_categories.ts`).
- **`hasMany` ⇒ ręczna tabela `_rels`**, nie skalarny FK (`20260818_1_add_fleet.ts:73-90`).
- **Niezmiennik wiersza należy do hooka kolekcji, nie do akcji** (`lessons.md:1407-1432`) — akcja jest
  jednym z co najmniej trzech pisarzy. Wzór: `src/hooks/transfers/validate.ts`.
- **Helper walidacji czyta po OBECNOŚCI klucza, nie po prawdziwości** (`validate.ts:51-52`): jawny
  `null` to wyczyszczenie i musi dojść do sprawdzeń jako pustka.
- **Nic zależnego od daty nie wchodzi do cache'a ani do jego klucza** (`queries/fleet.ts:15-46`);
  klucz jest wersjonowany sufiksem i bumpowany przy każdym poszerzeniu kształtu.
- **Agreguj raz w CTE, nie rozwijaj per wiersz** — 2,5 ms vs 122 ms (`lessons.md:1487-1504`).
- **Odejście z firmy to dezaktywacja, nie usunięcie** — `users.ts:20-58` blokuje usunięcie czterema
  sondami `makePreventDelete`.

## What We're NOT Doing

- Potwierdzania odbioru przez pracownika (wciągnęłoby rolę `EMPLOYEE` do modułu kierownictwa).
- Ilości i materiałów eksploatacyjnych — jeden rekord to jedna sztuka, **pola „ilość" nie ma wcale**.
- Zdjęć stanu przy wydaniu/zwrocie, inwentaryzacji, kosztu sprzętu alokowanego na inwestycję,
  terminów UDT / pomiarów elektrycznych, kodów QR.
- **Osobnej strony z listą magazynów** — zawartość magazynu to filtr na liście sprzętu.
- **Serwisu bez ruchu sprzętu** („naprawa na miejscu") — patrz „Open Risks".
- Testów przeglądarkowych — do backlogu, jak przy Flocie (EX-716).

## Implementation Approach

Sześć etapów od bazy w górę: dane → odczyt → widok → akcje → strona pracownika → przypomnienia.
Każdy etap zostawia coś sprawdzalnego osobno. Trzy świadome odejścia od Floty:

1. **„Gdzie jest" liczy SQL (`DISTINCT ON`), nie JS.** Flota wczytuje wszystko i grupuje w pamięci,
   bo „to kilkadziesiąt aut" — jej własna bramka review odrzuciła tę uwagę świadomie. Nasz zakres
   mówi „skala nieznana, projektujemy na dużą", więc ten sam skrót byłby tu błędem.
2. **Z `lib/fleet/` wychodzi tylko to, co jest naprawdę wspólne** — `days.ts` i `deadline-label.ts`
   (czysta matematyka dni i jedno polskie sformułowanie „za ile"). `thresholds.ts` i `DeadlineCell`
   **zostają**, bo trzymają domenę aut; sprzęt dostaje własne progi i własną komórkę.
3. **Status wchodzi razem z UI, które umie dojść do każdej z pięciu wartości.** Flota wypuściła
   `RETIRED` bez dialogu edycji i właściciel upomniał się o niego tydzień później.

## Critical Implementation Details

**Typ zdarzenia nie jest osobnym polem — rozróżnia go cel.** Wpis z ustawionym `serviceProvider`
JEST wpisem serwisowym; wpis z `holder` albo `warehouse` jest przekazaniem. Enum `type` obok tego
byłby drugim źródłem prawdy o tym samym fakcie i pierwszą rzeczą, która się rozjedzie. Konsekwencja
dla migracji: jeden enum mniej.

**Kolejność zapisów przy dodawaniu sprzętu.** Encja i pierwszy wpis logu powstają w **jednej
transakcji** (`src/lib/db/with-payload-transaction.ts`). Bez tego przerwanie między zapisami zostawia
sprzęt bez logu — czyli dokładnie ten stan „nie wiadomo gdzie", którego wymuszenie lokalizacji
w formularzu ma nie dopuścić.

**Stempel powiadomienia siedzi na SPRZĘCIE, nie na zdarzeniu.** U Floty termin jest własnością
zdarzenia (`vehicle-inspections.ts:121-138`), u nas gwarancja jest własnością rzeczy. Wynika z tego
druga różnica: zmiana `warrantyUntil` musi **zerować** bookkeeping (wzór
`lib/fleet/reset-notification-bookkeeping.ts`), inaczej przedłużona gwarancja nigdy nie zamailuje.

**Gwarancja po terminie nie mailuje.** Przegląd po terminie trzeba nadrobić, więc Flota nudzi co 7 dni
(`should-notify.ts:14`). Gwarancji nie da się nadrobić — po jej końcu mail jest czystym szumem.
Dlatego sprzęt NIE dostaje odpowiednika `OVERDUE_RENAG_DAYS`, a reguła „mailujemy kubełek nie
szerszy niż X" nie przenosi się wprost: u nas mailowane są progi 30 i 7, a stan „po gwarancji" nigdy.

---

## Phase 1: Warstwa danych

### Overview

Trzy kolekcje, jeden enum, niezmiennik celu przekazania, jedna ręcznie pisana migracja.

### Changes Required:

#### 1. Status sprzętu

**File**: `src/lib/equipment/equipment-status.ts`

**Intent**: Pięć stanów cyklu życia sztuki, żeby „zgubiony" nie udawał „nieprzypisany".

**Contract**: Idiom trzech plików co `lib/fleet/vehicle-status.ts` — `EQUIPMENT_STATUSES` jako
`as const`, typ pochodny, `Record<StatusT, { en, pl }>`. Wartości: `IN_USE` / `RETIRED` / `SOLD` /
`LOST` / `STOLEN` → „W użyciu" / „Wycofany" / „Sprzedany" / „Zgubiony" / „Skradziony". Domyślna
`IN_USE`.

#### 2. Kolekcja sprzętu

**File**: `src/collections/equipment.ts`

**Intent**: Encja sztuki. Pola tożsamości, faktury i cyklu życia; nic o tym, gdzie rzecz jest.

**Contract**: slug `equipment`. Pola: `name` (text, required), `serialNumber` (text, **unique**,
opcjonalny), `make`, `model` (text, opcjonalne), `purchaseDate` i `warrantyUntil` (date,
`pickerAppearance: 'dayOnly'`, `displayFormat: 'dd.MM.yyyy'`), `purchasePrice` (number, `min: 0`,
opcjonalny — nieznana cena renderuje „—", nigdy „0,00 zł"), `note` (textarea), `status` (select
z `EQUIPMENT_STATUSES`, required, default `IN_USE`), plus dwa ukryte pola bookkeepingu:
`warrantyNotifiedBucket` (number) i `warrantyNotifiedAt` (date). Dostęp i hooki rewalidacji jak
`vehicles.ts:17-26`. `beforeChange`: zerowanie bookkeepingu przy zmianie `warrantyUntil`.

#### 3. Kolekcja magazynów

**File**: `src/collections/warehouses.ts`

**Intent**: Słownik zarządzany wyłącznie z panelu Payloada — dodanie magazynu ma być wpisem, nie deployem.

**Contract**: Kształt 1:1 z `other-categories.ts`: jedno pole `name` (text, required, unique),
`useAsTitle`, hooki rewalidacji, dostęp `isAdminOrOwnerOrManager` / delete `isAdminOrOwner`. Dodatkowo
sonda `makePreventDelete` na `equipment-events.warehouse` — usunięcie magazynu, do którego coś
przekazano, zerwałoby niezmiennik „dokładnie jeden cel" na historycznym wpisie.

#### 4. Kolekcja zdarzeń

**File**: `src/collections/equipment-events.ts`

**Intent**: Append-only log przekazań i serwisów. Jedno źródło odpowiedzi na „gdzie to jest"
i „kto miał to ostatni".

**Contract**: slug `equipment-events`. Pola: `equipment` (relationship, required), `occurredAt`
(date `dayOnly`, required), trzy wzajemnie wykluczające się cele — `holder` (relationship → `users`),
`warehouse` (relationship → `warehouses`), `serviceProvider` (text, nazwa warsztatu) — oraz
`investment` (relationship, opcjonalny atrybut wpisu), `cost` (number, `min: 0`, opcjonalny),
`note` (textarea), `attachments` (upload → `media`, `hasMany`). Hook `beforeValidate` z punktu 5.

#### 5. Niezmiennik „dokładnie jeden cel"

**File**: `src/hooks/equipment/validate.ts`

**Intent**: Wpis musi wskazywać dokładnie jeden cel. Niezmiennik wiersza obowiązuje każdego pisarza —
panel Payloada, akcję i skrypt — więc mieszka w hooku kolekcji, nie w akcji.

**Contract**: `CollectionBeforeValidateHook` wzorowany na `src/hooks/transfers/validate.ts`. Trzy
elementy przenoszą się dosłownie: odczyt po **obecności** klucza (`field in d ? d[field] : original?.[field]`,
`validate.ts:51-52`), akumulacja błędów i rzut z polskim komunikatem (`:97`, `:207-210`), oraz
**zerowanie pól, które nie mają prawa być ustawione** (`:124-126`). Dodatkowo: `cost` wolno ustawić
tylko na wpisie z `serviceProvider` — na przekazaniu jest zerowane. Relacje porównywane przez
`resolveId`.

#### 6. Piąta sonda na pracowniku

**File**: `src/collections/users.ts`

**Intent**: Nie da się usunąć pracownika, który trzyma sprzęt — bez tego znika odpowiedź na „kto miał
to ostatni".

**Contract**: Czwarta pozycja w `probes` (`users.ts:21-58`): kolekcja `equipment-events`,
`where: (id) => ({ holder: { equals: id } })`, `label: 'sprzęt'`.

#### 7. Migracja

**File**: `src/migrations/20260903_0_add_equipment.ts` + wpis w `src/migrations/index.ts`

**Intent**: Cała warstwa fizyczna jednym, czysto addytywnym krokiem. Pisana ręcznie —
`migrate:create` emituje fantomowy drift.

**Contract**: Wzór struktury: `20260901_0_add_work_catalogue_items.ts` (najczystszy), a dla części
złożonych `20260818_1_add_fleet.ts`. Zawartość, w tej kolejności:

1. `DO $$` tworzący `enum_equipment_status` idempotentnie (`20260818_1:16-25`).
2. `warehouses`, `equipment`, `equipment_events` — każda z `id serial`, `updated_at`, `created_at`
   i dwoma indeksami na te daty. Daty dzienne jako `timestamp(3) with time zone`, nigdy `date`.
3. `equipment_events_rels` — ręczna tabela pod `attachments` (`hasMany`), pięć statementów i cztery
   indeksy (`20260818_1:73-90`).
4. Indeks złożony `(equipment_id, occurred_at DESC)` — dominująca ścieżka odczytu.
5. FK: `equipment_id` `ON DELETE CASCADE` (historia sztuki ginie z nią), `warehouse_id` i `holder_id`
   `ON DELETE RESTRICT` (backstop dla sond `preventDelete`), `investment_id` `ON DELETE SET NULL`.
6. Trzy kolumny + trzy indeksy w `payload_locked_documents_rels`, po jednej na kolekcję
   (`20260818_1:92-103`).
7. `notification_recipients_equipment_digest` — czwarta tabela listy odbiorców, kształt 1:1
   z `20260826_0:19-28`, plus seed adresów.
8. Seed magazynów: `INSERT … ON CONFLICT (name) DO NOTHING` (`20260309_add_expense_categories.ts:19-23`).
9. `down()` odwraca dokładnie w odwrotnej kolejności, łącznie z `DROP TYPE`.

Nagłówek pliku: `// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).`

#### 8. Rejestracja

**Files**: `src/payload.config.ts`, `src/lib/cache/tags.ts`

**Intent**: Kolekcje widoczne dla Payloada i dla warstwy cache'a.

**Contract**: Import + trzy wpisy w tablicy `collections` (`Media` zostaje ostatnie). W `CACHE_TAGS`
trzy klucze: `equipment`, `equipmentEvents`, `warehouses`. **Pułapka**: `makeRevalidateAfterChange`
bierze klucz `CACHE_TAGS` (camelCase), nie slug Payloada (`hooks/revalidate-collection.ts:16-42`).

### Success Criteria:

#### Automated Verification:

- Migracja wchodzi na czysto na lokalnej bazie: `pnpm payload migrate`
- `down()` cofa się bez błędu, a ponowne `up()` przechodzi drugi raz
- `pnpm generate:types` przechodzi i zna trzy nowe kolekcje
- Spec niezmiennika celu przechodzi: `pnpm exec vitest run src/__tests__/hooks/equipment/target-invariant.db.test.ts`

#### Manual Verification:

- `/admin` otwiera każdą z trzech kolekcji bez błędu (to sprawdza kolumny w `payload_locked_documents_rels`)
- Próba usunięcia pracownika trzymającego sprzęt daje zdanie po polsku, nie 23503
- Dodanie magazynu z panelu działa i magazyn pojawia się w formularzach

---

## Phase 2: Odczyt „gdzie jest"

### Overview

Jedyna nowa logika odczytu: stan bieżący każdej sztuki wyliczony z najnowszego wpisu logu.

### Changes Required:

#### 1. Zapytanie

**File**: `src/lib/db/equipment.ts`

**Intent**: Jedna sztuka = jeden wiersz z aktualnym opiekunem, bez wczytywania całego logu do JS-a.

**Contract**: CTE `current_state` z `SELECT DISTINCT ON (e.equipment_id) … ORDER BY e.equipment_id,
e.occurred_at DESC, e.id DESC`, złączone z `equipment` i nazwami opiekunów. Wzór składni:
`lib/db/notifications.ts:71-77`. Dwie reguły przenoszone z Floty mimo zmiany mechaniki:
**„aktualne" to najnowsze po dacie ZDARZENIA, nie po dacie utworzenia wiersza**
(`deadlines.ts:18-24`) — wpis wprowadzony z opóźnieniem nie ma prawa zostać stanem bieżącym; remis
rozstrzyga `id`. I: **agregujemy raz w CTE**, nie rozwijamy per wiersz (`lessons.md:1487-1504`).
Drugie zapytanie: historia jednej sztuki. Trzecie: lista sztuk u wskazanego opiekuna
(`holder = user:N` albo `warehouse:N`) — to jest jedno zapytanie sparametryzowane, nie dwa.

#### 2. Warstwa zapytań

**File**: `src/lib/queries/equipment.ts`

**Intent**: Cache i kształt wiersza dla widoku.

**Contract**: `unstable_cache` z kluczem wersjonowanym sufiksem (`['equipment-v1']`) i tagami
z `CACHE_TAGS`. **Do klucza ani do wartości nie wchodzi żadna data** — „dziś" rozwiązuje się raz na
żądanie po stronie cache'a i jedzie w dół jako argument (`queries/fleet.ts:15-46`). Bump sufiksu przy
każdym poszerzeniu kształtu. `assertCompletePage` na każdym odczycie znaczącym „wszystkie".

### Success Criteria:

#### Automated Verification:

- Spec mapowania wierszy przechodzi: `pnpm exec vitest run src/__tests__/lib/equipment/rows.test.ts`
- Spec DB potwierdza, że stan bieżący idzie za `occurredAt`, a nie za `createdAt`:
  `pnpm exec vitest run src/__tests__/lib/db/equipment.db.test.ts`

#### Manual Verification:

- Wpis z datą wsteczną nie przejmuje stanu bieżącego, choć powstał najpóźniej

---

## Phase 3: Lista i detal

### Overview

Widok, w którym cała informacja jest widoczna bez klikania: co to, u kogo, do kiedy gwarancja.

### Changes Required:

#### 1. Kolumny

**File**: `src/components/tables/equipment.tsx`

**Intent**: Czyste `getEquipmentColumns()` zgodnie z konwencją repo (definicje kolumn oddzielone od
kompozycji ze stanem).

**Contract**: Kolumny: nazwa, marka/model, numer seryjny, „u kogo" (człowiek i magazyn renderują się
**tak samo** — to ta sama informacja), gwarancja, status. Status inny niż `IN_USE` wycisza wiersz.

#### 2. Komórka gwarancji

**File**: `src/components/equipment/warranty-cell.tsx`

**Intent**: Data plus „za ile", z kolorem rosnącym wraz z pilnością.

**Contract**: Własny komponent, **nie** `DeadlineCell` — tamten renderuje „bezterminowo" z pola
`exempt` i „brak danych" per typ przeglądu, czyli dwa pojęcia, których sprzęt nie ma. Współdzieli
z Flotą `daysLabel` (po promocji z etapu 6) i `formatPLDate`. Brak `warrantyUntil` renderuje „—",
nie alarm.

#### 3. Tabela ze stanem

**File**: `src/components/equipment/equipment-data-table.tsx`

**Intent**: Wyszukiwarka i filtr „gdzie jest" nad listą.

**Contract**: Wzór `work-catalogue-data-table.tsx:24-77`. Dwie rzeczy z niego są nośne i muszą
przejść: **opcje filtra liczy się z pełnego zbioru, nie z przefiltrowanego** (inaczej ostatni pasujący
wiersz zabiera własną opcję i nie da się jej odznaczyć), a pusta wartość dostaje własną opcję —
u nas „Nie wiadomo gdzie". `useSearchFilter` składa `foldText`, więc „szlifierka" znajdzie się bez
polskich znaków. Filtr „gdzie jest" ma ludzi i magazyny w jednym rozwijaniu — to zastępuje ekran magazynu.

#### 4. Strony

**Files**: `src/app/(frontend)/sprzet/page.tsx` + `loading.tsx`,
`src/app/(frontend)/sprzet/[id]/page.tsx` + `loading.tsx`,
`src/app/(frontend)/@investmentCrumb/sprzet/[id]/page.tsx`

**Intent**: Lista i detal sztuki z historią.

**Contract**: Każda strona zaczyna się od `requireAuth(MANAGEMENT_ROLES)` + `redirect('/')` — gating
jest **per-strona**, `src/proxy.ts:3` sprawdza wyłącznie obecność ciasteczka i brak strażnika nie
jest przez nic wychwytywany. `loading.tsx` to jednolinijkowy re-export. Detal: `PageWrapper` +
`InfoList` + historia na siatce `SummaryTable`. Okruszek: 5 linii renderujących `HistoryBackButton`
(wzór `@investmentCrumb/flota/[id]/page.tsx:1-5`).

#### 5. Menu

**File**: `src/components/nav/sidebar.tsx`

**Intent**: Wejście do modułu.

**Contract**: Jedna pozycja w `MANAGEMENT_LINKS` (`:34-44`), ikona z lucide. Zwinięty sidebar i badge
obsługują się same.

### Success Criteria:

#### Automated Verification:

- Spec grupowania opcji filtra przechodzi: `pnpm exec vitest run src/__tests__/components/equipment/where-filter-options.test.ts`

#### Manual Verification:

- Wyszukiwarka znajduje po nazwie, marce, modelu i numerze seryjnym; „szlifierka" działa bez „ł"
- Filtr „gdzie jest" pokazuje ludzi i magazyny razem; „Nie wiadomo gdzie" da się odznaczyć
- Sprzęt oznaczony jako sprzedany/zgubiony jest wizualnie wyciszony
- Detal pokazuje historię od najnowszego wpisu

---

## Phase 4: Akcje i dialogi

### Overview

Cztery operacje: dodaj, przekaż, dopisz serwis, edytuj. Wszystkie przez `protectedAction`.

### Changes Required:

#### 1. Akcje

**File**: `src/lib/actions/equipment.ts`

**Intent**: Mutacje z autoryzacją, logowaniem perf i rewalidacją.

**Contract**: `'use server'`, każda przez `protectedAction()` (`lib/actions/run-action.ts:35-66`),
zwraca `ActionResultT`, woła `updateTag()` — **nie** `revalidateTag()`, ta druga jest dla hooków
Payloada. `createEquipment` tworzy encję **i pierwszy wpis logu w jednej transakcji**
(`src/lib/db/with-payload-transaction.ts`).

#### 2. Formularze

**Files**: `src/components/forms/equipment-form/`, `src/components/forms/equipment-transfer-form/`,
wpis w `src/stores/form-stores.ts`

**Intent**: Wprowadzanie danych zgodne z łańcuchem, którego repo używa wszędzie.

**Contract**: Wzór `add-vehicle-dialog` → `vehicle-form` → `vehicleSchema` → `createVehicleAction`.
Schemat ma **dwie warstwy**: `xFormSchema` (wszystko `string`, warstwa kontrolek) i
`xSchema = xFormSchema.extend({...})` (warstwa domenowa) — druga **wyprowadzona** z pierwszej, żeby
listy pól nie mogły się rozjechać. Wartości puste to `null`, nie `undefined`: Payload czyta brak
klucza przy update jako „nie ruszaj". Picker pracownika: `EntityComboboxField` z nowym kluczem
w `VARIANT_CONFIG` (`entity-combobox-field.tsx:24-52`); ma wbudowane `activeOrSelected`, dzięki czemu
sprzęt u byłego pracownika nie gubi zaznaczenia przy kolejnym zapisie (EX-643).

#### 3. Dialogi

**Files**: `src/components/dialogs/add-equipment-dialog.tsx`, `transfer-equipment-dialog.tsx`,
`edit-equipment-dialog.tsx`

**Intent**: Jedna akcja „Przekaż" z celem do wyboru; osobne dodawanie i edycja sztuki.

**Contract**: Wzór `FormDialog` / `FormDialogShell` / `useManagedForm`. „Przekaż" ma jeden wybór celu
(pracownik | magazyn | serwis) — pary wydanie/zwrot nie ma, bo oddanie do magazynu **jest**
przekazaniem, którego celem jest magazyn. Wybór „serwis" odsłania nazwę warsztatu i koszt (koszt
opcjonalny — faktura przychodzi po fakcie i dopisuje się w `/admin` → „Zdarzenia sprzętu", bo
historia we froncie jest tylko do odczytu: wpisy są append-only). „Dodaj sprzęt" **wymaga**
wskazania pierwszego celu. Edycja sztuki daje dostęp do **wszystkich pięciu** statusów.

### Success Criteria:

#### Automated Verification:

- Spec schematu odrzuca dwa cele naraz i brak celu:
  `pnpm exec vitest run src/__tests__/components/forms/equipment-transfer-form/schema.test.ts`
- Spec DB potwierdza, że przerwane dodanie sprzętu nie zostawia encji bez wpisu:
  `pnpm exec vitest run src/__tests__/lib/actions/equipment.db.test.ts`

#### Manual Verification:

- Dodanie sprzętu bez wskazania miejsca jest niemożliwe
- Przekazanie pracownik → pracownik działa bez pośredniego magazynu
- Wpis serwisowy da się edytować i dopisać koszt tydzień później
- Sprzęt wraca z serwisu przez zwykłe „Przekaż" do pracownika lub magazynu
- Wszystkie pięć statusów da się ustawić z UI

---

## Phase 5: „Na stanie" na stronie pracownika

### Overview

Odpowiedź na „co ma Marek" tam, gdzie to pytanie realnie pada — przy zwolnieniu i rozliczeniu.

### Changes Required:

#### 1. Sekcja

**File**: `src/components/equipment/held-equipment-section.tsx`

**Intent**: Lista sprzętu jednego opiekuna, bez akcji.

**Contract**: Kolumny: nazwa, numer seryjny, data przekazania, link do detalu sztuki. Bez akcji —
przekazuje się z detalu sprzętu, żeby ta sama operacja nie miała dwóch wejść i dwóch ścieżek
walidacji. Komponent jest sparametryzowany opiekunem, więc obsłuży też magazyn, gdyby kiedyś dostał
własną stronę.

#### 2. Strona pracownika

**File**: `src/app/(frontend)/pracownicy/[id]/page.tsx`

**Intent**: Doklejenie sekcji do istniejącego ekranu.

**Contract**: Trzeci element w istniejącym `Promise.all` (`:32-35`), sekcja renderowana między
`SignedMoneyDisplay` a `TransfersSection`. **Zero nowego routingu i zero nowej bramki dostępu** —
strona już stoi za `ADMIN_OR_OWNER_MANAGER_ROLES` (`:17`).

### Success Criteria:

#### Automated Verification:

- Etap nie ma własnego sprawdzenia automatycznego: jest kompozycją istniejącego zapytania z etapu 2
  na istniejącej stronie, a zapytanie ma już swój spec. Weryfikacja jest ręczna.

#### Manual Verification:

- Strona pracownika pokazuje jego sprzęt; po przekazaniu komuś innemu pozycja znika stąd i pojawia
  się tam
- Pracownik bez sprzętu widzi pustą sekcję, nie błąd

---

## Phase 6: Przypomnienia o gwarancji

### Overview

Dzienny mail: gwarancje kończące się za 30 i za 7 dni. Po terminie cisza — gwarancji nie da się
nadrobić, więc nudzenie byłoby szumem.

### Changes Required:

#### 1. Promocja wspólnego

**Files**: `src/lib/dates/days.ts`, `src/lib/dates/deadline-label.ts` (przeniesione z `lib/fleet/`),
aktualizacja importów we Flocie

**Intent**: Matematyka dnia warszawskiego i jedno polskie sformułowanie „za ile" przestają być
własnością Floty. Jej bramka review odłożyła to explicite do „drugiej funkcji, która potrzebuje dnia
warszawskiego" — sprzęt jest tą drugą funkcją.

**Contract**: Przeniesienie bez zmiany treści. `thresholds.ts` **nie** jedzie — trzyma
`OIL_CHANGE_INTERVAL_KM` i `isOilChangeOverdue`, czyli domenę aut. `DeadlineCell` też nie — patrz
etap 3.

#### 2. Progi gwarancji

**File**: `src/lib/equipment/warranty-thresholds.ts`

**Intent**: Własna polityka terminów, bo rytm gwarancji jest inny niż przeglądu rejestracyjnego.

**Contract**: Kubełki jako liczby dni, tak jak we Flocie, żeby „który próg", „jak pilne" i „czy już
wysłano" zwijały się do jednej porównywalnej liczby, a deduplikacja do `<`. Progi: 30 i 7. Stan „po
gwarancji" istnieje do kolorowania listy, ale **nigdy nie mailuje** — i to jest miejsce, w którym
reguła Floty „mailujemy próg nie szerszy niż X" NIE przenosi się wprost. Odpowiednika
`OVERDUE_RENAG_DAYS` nie ma.

#### 3. Decyzja i digest

**Files**: `src/lib/equipment/should-notify.ts`, `src/lib/equipment/digest.ts`,
`src/lib/equipment/sweep-io.ts`, `src/lib/equipment/notify.ts`

**Intent**: Kształt pipeline'u Floty: load → decide → send → stamp, gdzie `decide` jest **czysty** —
bez zegara, bazy i wysyłki.

**Contract**: `buildEquipmentDigest(rows, today)` bierze `today` jako argument i nie czyta zegara.
Do digestu wchodzi tylko sprzęt w statusie `IN_USE` — gwarancja rzeczy sprzedanej to historia, nie
zadanie. `stampNotified` kopiuje `sweep-io.ts:23-48` **wraz z powodami**: pisze dopiero po udanej
wysyłce, **seryjnie** (równoległe zapisy Payloada zachowują jeden, resztę gubią i raportują sukces
dla wszystkich) i zwraca nieudane id zamiast rzucać (500 ściągnąłby retry crona i powtórną wysyłkę
całego digestu). Mail: ręcznie składany HTML z `escapeHtml`, wzór `lib/fleet/notify.ts` — **jedna
wiadomość do N adresów, nie N wysyłek** (`:65-70`).

#### 4. Handler i harmonogram

**Files**: `src/app/(payload)/api/cron/equipment-reminders/route.ts`, `vercel.json`

**Intent**: Własne dzienne zadanie, niezależne od floty.

**Contract**: Kopia struktury `fleet-reminders/route.ts:11-50`, w tym `isAuthorizedCronRequest`
(zero nowego kodu autoryzacji, fail-closed przy braku sekretu) i zwracanie **500 na porażkę**, bo
moduł, którego wartością jest mail, musi czytać się jako nieudany przebieg, gdy mail nie poszedł.
Czwarty wpis w `vercel.json`, godzina 6:00 — konto jest na płatnym planie, limit Hobby nie
obowiązuje (`AGENTS.md` §Stack Notes). Osobny handler izoluje awarię jednego strumienia od maila
drugiego z definicji.

#### 5. Odbiorcy i badge

**Files**: `src/globals/notification-recipients.ts`, `src/lib/email/recipients.ts`,
`src/lib/db/notifications.ts`, `src/lib/actions/notifications.ts`

**Intent**: Osobna lista odbiorców (flotą i sprzętem mogą zajmować się różni ludzie) i licznik
nieprzeczytanych w menu.

**Contract**: Czwarte pole `recipientList('equipmentDigest', …)` w globalu, czwarty wpis
w `RECIPIENT_LISTS` i w `LIST_LABELS`; tabela powstała już w etapie 1. Karta `RecipientListCard` na
stronie listy sprzętu — listy edytuje się **na stronie, której powiadomień dotyczą**, żeby czytający
widział, kto jest informowany. Do `STREAMS` dochodzi klucz `equipment`, a do `EPOCHS` jego epoka —
**dodanie klucza bez epoki jest błędem typów i to jest celowe**; epoka znaczy „wszystko sprzed
wdrożenia liczy się jako przeczytane", żeby nikt nie dostał „247 nieprzeczytanych". Zapytanie
licznika: gwarancje, które weszły w okno 30 dni po kursorze użytkownika, z `GREATEST(warranty_until -
30 dni, created_at)` — bez tego sprzęt **wpisany** dziś z gwarancją kończącą się za 5 dni wszedł
w okno, zanim zaistniał, i nigdy nie trafiłby do licznika. `today` idzie jako argument, nie jako
`now()` Postgresa (UTC), inaczej licznik i lista rozjeżdżają się przez ostatnie dwie godziny doby.

### Success Criteria:

#### Automated Verification:

- Specy progów i digestu przechodzą: `pnpm exec vitest run src/__tests__/lib/equipment/`
- Pokrycie granic: 31/30/8/7/0 dni do końca gwarancji, gwarancja po terminie nie mailuje,
  ten sam próg nie mailuje dwa razy, przedłużenie gwarancji zeruje bookkeeping
- Specy Floty przechodzą po przeniesieniu `days.ts` i `deadline-label.ts`:
  `pnpm exec vitest run src/__tests__/lib/fleet/`

#### Manual Verification:

- Ręczne wywołanie handlera z nagłówkiem `Bearer $CRON_SECRET` wysyła mail o właściwej treści
- Bez nagłówka handler zwraca 401
- Pusty digest nie wysyła maila i raportuje `sent: false`
- Badge przy „Sprzęt" znika po wejściu na stronę
- Lista odbiorców jest edytowalna ze strony sprzętu i pusta lista jest odrzucana

---

## Testing Strategy

### Unit Tests:

- `warranty-thresholds` — klasyfikacja na granicach (31/30/8/7/0/-1 dni), „po gwarancji" nigdy nie mailuje
- `should-notify` — deduplikacja przez ostry `<`; ten sam próg drugi raz milczy
- `digest` — do digestu wchodzi tylko `IN_USE`; sprzęt bez `warrantyUntil` nie wchodzi wcale
- `rows` — mapowanie wiersza stanu bieżącego, w tym „nie wiadomo gdzie"
- Schemat formularza przekazania — dwa cele naraz i zero celów są odrzucane

### Integration Tests:

- Niezmiennik celu przez `payload.create/update` **bezpośrednio**, nie przez akcję: test akcji
  sprawdziłby jedynego pisarza, który nigdy nie był zepsuty. Asercje na **zapisanym wierszu**, nie na
  wyniku akcji (wzór `__tests__/hooks/transfers/investment-write-guard.db.test.ts`)
- `DISTINCT ON` — wpis z datą wsteczną, wprowadzony najpóźniej, nie przejmuje stanu bieżącego
- Transakcyjność dodania sprzętu — przerwanie nie zostawia encji bez wpisu

### Manual Testing Steps:

1. Dodaj sprzęt z numerem seryjnym, gwarancją za 40 dni i wskazaniem magazynu
2. Przekaż go pracownikowi z inwestycją; sprawdź, że pojawił się na jego stronie
3. Przekaż go drugiemu pracownikowi bez pośredniego magazynu; sprawdź, że zniknął z pierwszej strony
4. Przekaż do serwisu bez kosztu, potem otwórz wpis i dopisz kwotę
5. Przekaż z serwisu z powrotem do magazynu
6. Cofnij `warrantyUntil` na 25 dni i odpal handler crona ręcznie — mail ma przyjść
7. Odpal handler drugi raz — mail nie ma przyjść
8. Przedłuż gwarancję o rok i odpal ponownie — mail ma znowu przyjść, gdy wpadnie w próg
9. Oznacz sztukę jako skradzioną; sprawdź, że wypada z digestu i jest wyciszona na liście
10. Sprawdź historię sztuki — cała trasa od pierwszego wpisu

## Performance Considerations

Zapytanie o stan bieżący agreguje raz w CTE i łączy hashem. Forma skorelowana per wiersz kosztowała
w tym repo 122 ms tam, gdzie CTE kosztowało 2,5 ms (`lessons.md:1487-1504`) — przy nieznanej skali
rejestru to jedyna dopuszczalna forma. Indeks `(equipment_id, occurred_at DESC)` obsługuje `DISTINCT ON`.
Cache jest tagowany i **nie zawiera daty**, więc nie wygasa co dobę bez powodu.

## Migration Notes

Migracja jest **czysto addytywna**, więc kierunek wdrożenia to: migracja na produkcję **przed**
pushem kodu. Stosuje ją człowiek przez `pnpm db:migrate:prod`, nigdy agent. Nie ma danych do
przeniesienia — rejestr startuje pusty; magazyny wchodzą seedem, resztę wpisuje właściciel.

## Whole-tree Gate

- Typy przechodzą: `pnpm typecheck`
- Lint przechodzi: `pnpm lint`
- Pełny zestaw jednostkowy przechodzi: `pnpm test`
- Build przechodzi: `pnpm build`

## References

- Zakres: `context/changes/2026-09-01-katalog-sprzetu/change.md`
- Rozpoznanie: `context/changes/2026-09-01-katalog-sprzetu/research.md`
- Wzorzec modułu: `context/archive/2026-08-18-flota-przeglady/`
- Linear: **EX-758**

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Warstwa danych

#### Automated

- [x] 1.1 Migracja wchodzi na czysto na lokalnej bazie — a15f661f
- [x] 1.2 `down()` cofa się i ponowne `up()` przechodzi — a15f661f
- [x] 1.3 `pnpm generate:types` zna trzy nowe kolekcje — a15f661f
- [x] 1.4 Spec niezmiennika celu przechodzi — a15f661f

### Phase 2: Odczyt „gdzie jest"

#### Automated

- [x] 2.1 Spec mapowania wierszy przechodzi — 5056fb8a
- [x] 2.2 Spec DB potwierdza sortowanie po `occurredAt`, nie `createdAt` — 5056fb8a

### Phase 3: Lista i detal

#### Automated

- [x] 3.1 Spec grupowania opcji filtra przechodzi — 180b820c

### Phase 4: Akcje i dialogi

#### Automated

- [x] 4.1 Spec schematu odrzuca dwa cele naraz i brak celu — 394e425c
- [x] 4.2 Spec DB potwierdza transakcyjność dodania sprzętu — 394e425c

### Phase 5: „Na stanie" na stronie pracownika

#### Automated

- [x] 5.1 Brak sprawdzenia automatycznego — weryfikacja ręczna (uzasadnienie w etapie) — 50f7903a

### Phase 6: Przypomnienia o gwarancji

#### Automated

- [x] 6.1 Specy progów i digestu przechodzą, z granicami 31/30/8/7/0 — bfeb15f5
- [x] 6.2 Specy Floty przechodzą po przeniesieniu `days.ts` i `deadline-label.ts` — bfeb15f5
