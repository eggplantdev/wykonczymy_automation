---
date: 2026-09-03T12:12:48+0200
researcher: Claude (Opus 5)
git_commit: 39eaea4b72a0425670024415ebe3c24bcabec2c0
branch: staging
repository: wykonczymy
topic: 'Katalog sprzętu — jak zbudować moduł na wzorcu Floty, przy zakresie ustalonym 2026-09-03'
tags: [research, codebase, equipment, fleet, payload, migrations, notifications]
status: complete
last_updated: 2026-09-03
last_updated_by: Claude (Opus 5)
---

# Research: katalog sprzętu

**Data**: 2026-09-03 · **Commit**: `39eaea4b` · **Branch**: `staging` · **Repo**: wykonczymy

Dokument ma dwie części:

- **Część I — repo (2026-09-03)**: co dokładnie trzeba napisać, co wziąć gotowe, gdzie są pułapki.
  To jest wejście do `/10x-plan`.
- **Część II — rynek (2026-09-01)**: pierwotne rozpoznanie, zachowane jako materiał źródłowy.
  **Nie jest zakresem** — zakres obowiązujący stoi w `change.md` §„Ustalony zakres (2026-09-03)".

---

# CZĘŚĆ I — repo

## Pytanie badawcze

Zakres jest domknięty (`change.md`). Pytanie brzmi: które istniejące prymitywy pokrywają go bez
pisania kodu, co trzeba napisać od zera, i w których miejscach nowy moduł **nie powinien** kopiować
Floty.

## Streszczenie

Front to w ~80% konfiguracja istniejących prymitywów — tabela, wyszukiwarka, filtr, cały łańcuch
formularza i dialogu, picker pracownika, badge nieprzeczytanych i karta odbiorców maila są gotowe
i generyczne. Nowe jest: warstwa danych (dwie kolekcje + słownik magazynów + migracja pisana ręcznie),
zapytanie liczące „gdzie jest" z ostatniego wpisu, definicje kolumn i historii, oraz doklejenie
drugiego strumienia przypomnień.

**Trzy rzeczy, w których świadomie odchodzimy od Floty**, każda z powodem:

1. **Zapytanie o aktualny stan idzie w SQL (`DISTINCT ON`), nie w JS.** Flota wczytuje wszystkie
   zdarzenia i grupuje w pamięci, bo „to kilkadziesiąt aut" — i tak stoi w jej review gate jako
   świadomie odrzucona uwaga. `change.md` mówi „skala nieznana, więc projektujemy na dużą", więc
   ten sam skrót byłby tu błędem. Idiom już jest w repo: `src/lib/db/notifications.ts:71-77`.
2. **Trzy pliki Floty przestają być własnością Floty.** `days.ts`, `thresholds.ts` i `DeadlineCell`
   są bezużyteczne dla samochodów w szczególności — review gate Floty zapisał wprost, że promocja
   `days.ts` jest przedwczesna i wraca „przy drugiej funkcji, która potrzebuje dnia warszawskiego".
   Sprzęt jest tą drugą funkcją.
3. **Pole statusu wchodzi razem z UI, które umie dojść do każdej z pięciu wartości.** Flota wypuściła
   `RETIRED` bez dialogu edycji i właściciel upomniał się o niego tydzień później.

## Szczegółowe ustalenia

### 1. Warstwa danych — co powstaje

#### 1.1 Kolekcje

Trzy nowe: **sprzęt**, **log zdarzeń**, **magazyny** (słownik).

Wzorzec encji + logu jest 1:1 z `src/collections/vehicles.ts` (94 linie) i
`src/collections/vehicle-inspections.ts` (140 linii). Do skopiowania bez zmian:

- kształt `labels` / `admin.group` z `{ en, pl }` — `vehicles.ts:7-16`
- `access`: read/create/update `isAdminOrOwnerOrManager`, delete `isAdminOrOwner` — `vehicles.ts:21-26`
- hooki rewalidacji: `makeRevalidateAfterChange('equipment')`,
  `makeRevalidateAfterDelete('equipment', 'equipmentEvents')` — `vehicles.ts:17-20`.
  **Pułapka**: helpery biorą klucz z `CACHE_TAGS` (camelCase), nie slug Payloada, i ten sam klucz
  wchodzi do `entityTag` — `src/hooks/revalidate-collection.ts:16-42`.
- daty z `pickerAppearance: 'dayOnly'` + `displayFormat: 'dd.MM.yyyy'` — `vehicle-inspections.ts:52-74`
- rejestracja w `src/payload.config.ts` — import + wpis w tablicy `collections` (`:79-99`);
  kolejność to tylko układ w `/admin`, `Media` zostaje ostatnie

#### 1.2 Status — idiom trzech plików

Dokładnie ten sam kształt, co `vehicle-status.ts`:

1. `src/lib/equipment/equipment-status.ts` — `const STATUSES = [...] as const`, typ pochodny,
   `Record<StatusT, { en, pl }>` z etykietami (wzór: `src/lib/fleet/vehicle-status.ts`, 8 linii;
   `ACTIVE → 'W użyciu'` i `RETIRED → 'Wycofany'` są tam już dosłownie)
2. pole `select` w kolekcji z `options: STATUSES.map(...)` — `vehicles.ts:82-92`
3. enum w migracji, nazwany `enum_<tabela>_<pole>`, tworzony idempotentnym blokiem `DO $$` —
   `src/migrations/20260818_1_add_fleet.ts:16-25`

Ten sam idiom obsługuje enum typu zdarzenia (przekazanie / serwis) — wzór `INSPECTION_TYPES`.

#### 1.3 Migracja — trzynaście rzeczy, które nowy moduł psuje

Ręcznie pisana (`migrate:create` emituje fantomowy drift). Najczystszy wzorzec:
`src/migrations/20260901_0_add_work_catalogue_items.ts` (50 linii, czysto addytywna, symetryczne `down`).

1. **`payload_locked_documents_rels` — kolumna na KAŻDĄ nową kolekcję.** Payload SELECT-uje ją przy
   każdym żądaniu do panelu i bez niej rzuca. `20260818_1_add_fleet.ts:92-103`. Zapomniano jej przy
   `expense_categories` i trzeba było migracji naprawczej (`20260310_fix_locked_docs_expense_categories.ts`).
   Trzy nowe kolekcje = trzy kolumny + trzy indeksy + ich drop w `down`.
2. **`hasMany` (upload/relacja) ⇒ ręczna tabela `<table>_rels`**, nie skalarny FK — pięć statementów,
   cztery indeksy, `20260818_1:73-90`. Dotyczy nas, jeśli zdarzenie serwisowe niesie załączniki.
3. **`updated_at` / `created_at` + ich dwa indeksy są obowiązkowe** na każdej tabeli Payloada.
4. **Daty to `timestamp(3) with time zone` przypięte do północy UTC, nigdy `date`** — jedyny kształt,
   jaki adapter Payloada modeluje dla pola `date`; porównania dni robi JS (`lib/fleet/days.ts`).
5. **`unique: true` w Payloadzie jest jednokolumnowe** — pasuje do numeru seryjnego, nie pasowałoby
   do klucza złożonego (`20260901_0:24-26`, `lessons.md:854`).
6. Nazwa pliku `YYYYMMDD_N_snake_case`; **kolejność leksykalna nazw JEST kolejnością wykonania**,
   licznik nie jest zerowany-paddowany i pęka na 10 (`lessons.md:807`). Tabela musi sortować się
   przed czymkolwiek, co ją referuje.
7. Rejestracja ręczna w `src/migrations/index.ts` (import + wpis).
8. Indeks złożony pod dominującą ścieżkę dostępu — Flota ma `(vehicle_id, type, performed_at DESC)`
   (`20260818_1:62-65`). Nasz odpowiednik: `(equipment_id, occurred_at DESC)`.
9. FK do słownika magazynów: **`ON DELETE RESTRICT` + sonda `makePreventDelete`** (decyzja
   2026-09-03, odwrócenie wcześniejszej rekomendacji `ON DELETE SET NULL` z `expense_categories`,
   `20260309_add_expense_categories.ts:27-29`). Kategoria wydatku jest opisem i wpis bez niej dalej
   ma sens; magazyn jest **celem przekazania**, więc wyzerowanie referencji zostawia historyczny wpis
   bez żadnego celu — złamany niezmiennik „dokładnie jeden z trzech" i fałszywy alarm
   „nie wiadomo gdzie".
10. Kierunek wdrożenia: czysto addytywna ⇒ migracja na prod **przed** pushem (`AGENTS.md`).
11. Seed słownika magazynów w migracji, `INSERT … ON CONFLICT (name) DO NOTHING` — wzór
    `20260309_add_expense_categories.ts:19-23`.
12. `down()` odwraca w dokładnie odwrotnej kolejności, łącznie z `DROP TYPE`.
13. Nagłówek pliku: `// Hand-written (migrate:create's snapshot baseline is stale — see AGENTS.md).`

#### 1.4 Słownik magazynów — wzorzec potwierdzony

`expense-categories.ts` i `other-categories.ts` są co do bajtu tym samym kształtem: jedno pole `name`
(text, required, unique), `useAsTitle`, hooki rewalidacji, dostęp `isAdminOrOwnerOrManager`.
**Zarządzanie wyłącznie z panelu Payloada jest tu ustaloną praktyką** — grep po `src/app/(frontend)`
nie znajduje żadnego routingu dla obu słowników, a wszystkie trafienia w kodzie to konsumenci.

Ładowanie opcji do formularza — dwie drogi, obie istnieją:

- `fetchExpenseCategories` (`src/lib/queries/reference-data.ts:27-39`) — osobny, mały
  `unstable_cache`, surowy SQL. Stoi osobno **celowo**: `fetchReferenceData` zwraca wszystkich
  użytkowników, czyli firmowe PII, które nie może być jeden identyfikator od publicznej ścieżki
  udostępniania (`:24-26`).
- `fetchReferenceData` (`:46-167`) — pięć równoległych `db.execute()` w jednym `Promise.all`.
  Magazyny dołożone tu byłyby szóstym zapytaniem i **wymagają bumpu klucza** `['reference-data-v2']` → `v3`.
  Jest test-strażnik driftu: `src/__tests__/reference-data-sql-drift.test.ts:23`.

Rekomendacja: magazyny do `fetchReferenceData` (moduł i tak jest za `MANAGEMENT_ROLES`, więc powód
rozdzielenia nie działa), z bumpem klucza i wpisem w teście driftu.

#### 1.5 Walidacja „dokładnie jedno z trzech"

Żywy idiom to `src/hooks/transfers/validate.ts` — `CollectionBeforeValidateHook`, nie akcja serwerowa.
Uzasadnienie stoi w `lessons.md:1407-1432`: **niezmiennik samego wiersza musi trzymać dla każdego
piszącego**, a akcja to tylko jeden z co najmniej trzech (panel Payloada, akcja, skrypt).

Trzy elementy do skopiowania:

- **helper czytający po OBECNOŚCI klucza, nie po prawdziwości** — `validate.ts:51-52`:
  `field in d ? d[field] : original?.[field]`. Jawny `null` to **wyczyszczenie** (tak zapisuje panel
  Payloada), i musi dojść do sprawdzeń jako pustka, a nie po cichu wczytać starą wartość.
- **akumulacja błędów + rzut** — `validate.ts:97` i `:207-210`; treść `Error` trafia do użytkownika.
- **zerowanie pól, które nie mają prawa być ustawione** — `:124-126` i cztery analogiczne miejsca.
  To jest właśnie kształt „dokładnie jedno": wymagaj tego, które pasuje, `null`-uj resztę.

Relacje porównuje się przez `resolveId` (`src/lib/utils/resolve-id.ts:2-8`) — obsługuje `depth: 0`
(number) i `depth ≥ 1` (obiekt).

**W bazie CHECK-a nie będzie.** W całym `src/migrations/**` nie ma ani jednego `CHECK (`; stanowisko
repo brzmi „enum JEST constraintem" (`20260721_1:7`), a `lessons.md:1324` mówi wprost, że niezmiennik
w dwóch płaszczyznach lepiej skasować niż testować most. Niezmiennik żyje w hooku, kropka.

Dom testu: `src/__tests__/hooks/transfers/investment-write-guard.db.test.ts` — jedzie
`payload.create/update` bezpośrednio (bo test akcji sprawdza jedynego pisarza, który nigdy nie był
zepsuty) i asercje idą na **zapisany wiersz**, nie na wynik akcji.

#### 1.6 Pracownicy

- `EMPLOYEE` to pracownik terenowy; kolekcja `users` jest wprost etykietowana „Pracownik"
  (`users.ts:82-85`). Flaga `active` istnieje (`users.ts:124-133`), zapis tylko ADMIN/OWNER.
- **Odejście z firmy = dezaktywacja, nigdy usunięcie** — `users.ts:14-61` blokuje twarde usunięcie
  czterema sondami `makePreventDelete`, gdy osobę nazywa jakakolwiek figura lub ślad audytowy.
  **Nasz log przekazań musi dołożyć piątą sondę** — inaczej da się usunąć pracownika trzymającego sprzęt.
- Reguła dla sprzętu u byłego pracownika jest już napisana: `src/lib/utils/is-active-ref.ts` —
  `isActiveRef` testuje `!== false` (brak flagi znaczy aktywny), a `activeOrSelected` zostawia
  **aktualnie wybraną** pozycję mimo filtra. Bez tego picker renderuje się bez zaznaczenia i
  następny zapis po cichu wpisuje pustkę (EX-643).

### 2. Zapytanie o „gdzie jest" — jedyna nowa logika odczytu

Flota liczy aktualny termin **w pamięci**: dwa odczyty ORM (`limit: 500` / `5000`,
`sort: '-performedAt'`), grupowanie `groupByVehicle` i `latestByType`
(`src/lib/fleet/dataset.ts:27-77`, `deadlines.ts:18-24`). Działa, bo aut jest kilkadziesiąt.

Idiom SQL, który tu bierzemy zamiast tego — `src/lib/db/notifications.ts:71-77`:

```sql
current_state AS (
  SELECT DISTINCT ON (e.equipment_id) e.equipment_id, e.holder_id, e.warehouse_id, ...
  FROM equipment_events e
  ORDER BY e.equipment_id, e.occurred_at DESC
)
```

To jedyny „latest row per parent" w repo pisany w SQL i jest dokładnie naszym przypadkiem.

Dwie reguły do przeniesienia z Floty mimo zmiany mechaniki:

- **„Aktualne" to najnowsze zdarzenie po dacie ZDARZENIA, nie po dacie utworzenia wiersza**
  (`deadlines.ts:18-24`): wpis wprowadzony z opóźnieniem, ale opisujący wcześniejsze przekazanie,
  nie ma prawa zostać stanem bieżącym. Sortujemy po `occurred_at`, a przy remisie po `id`.
- **Nic zależnego od daty nie wchodzi do cache'a ani do jego klucza** — `queries/fleet.ts:15-46`.
  Cache trzyma surowe fakty, „dziś" rozwiązuje się raz na żądanie po stronie cache'a i jest
  przekazywane w dół. Klucz `unstable_cache` **wersjonujemy sufiksem i bumpujemy przy każdym
  poszerzeniu kształtu** — tag oznacza wpis jako nieświeży, ale jedno żądanie i tak dostaje starą
  odpowiedź, co przy nowym polu wywala stronę (`fleet.ts:27-32`).

Lekcja wydajnościowa, którą trzeba uszanować przy pisaniu tego zapytania —
`lessons.md:1487-1504`: skorelowana forma per-wiersz kosztowała 122 ms (423 ms z JIT) tam, gdzie
CTE zagregowane raz i złączone hashem kosztowało 2,5 ms. **Agreguj raz w CTE, nie rozwijaj per wiersz.**

`assertCompletePage` (`src/lib/queries/assert-complete-page.ts:10-19`) obowiązuje na każdym odczycie,
który znaczy „wszystkie" — Payload ucina stronę po cichu.

### 3. Warstwa UI — co jest gotowe

**Bierzemy bez zmian**: `PageWrapper`, `Description`, `InfoList`, `loading.tsx` jako jednolinijkowy
re-export, `DataTable` (z sortowaniem, klikalnym wierszem, prefetchem, pamięcią widoczności kolumn),
`SearchFilterInput` + `useSearchFilter`, `useClientMultiFilter` + `FilterMultiSelect`, `ColumnToggle`,
`DateRangePicker`, `ToggleGroup`, siatka `SummaryTable`, `FormDialog`, `FormDialogShell`,
`ConfirmDialog`, `useManagedForm` / `useAppForm` / `FormShell` / `FormFooter`, `EntityComboboxField`,
`UnreadStreamBadge`, `RecipientListCard`, `protectedAction` / `validateAction`.

Punkty wpięcia:

- **Nawigacja**: jedna linia w `MANAGEMENT_LINKS` (`src/components/nav/sidebar.tsx:34-44`).
  Ikona z lucide; zwinięty sidebar i badge obsługują się same.
- **Gating roli jest per-strona, nie w middleware.** `src/proxy.ts:3` sprawdza tylko obecność
  ciasteczka. Każda strona modułu zaczyna się od `requireAuth(MANAGEMENT_ROLES)` +
  `if (!session.success) redirect('/')`. **Brak strażnika na którejkolwiek stronie nie jest przez
  nic wychwytywany.**
- **Okruszek w górnym pasku**: jeden plik `@investmentCrumb/<segment>/[id]/page.tsx`,
  5 linii, renderujący `HistoryBackButton` (wzór: `@investmentCrumb/flota/[id]/page.tsx:1-5`).
  Nazwa slotu jest już myląca — to generyczny slot okruszka.
- **Wyszukiwarka i filtr**: najlepszy świeży precedens to
  `src/components/work-catalogue/work-catalogue-data-table.tsx:24-77` (commit `a5032247`).
  Dwie rzeczy w nim są nośne: opcje filtra liczy się z **pełnego** zbioru, nie z przefiltrowanego
  (inaczej ostatni pasujący wiersz zabiera własną opcję i nie da się jej odznaczyć), a pusta wartość
  dostaje własną opcję („Bez kategorii"). `useSearchFilter` składa `foldText`, więc zapytanie bez
  polskich znaków trafia w „ł/ą".
- **Picker pracownika**: `EntityComboboxField` z `VARIANT_CONFIG`
  (`src/components/forms/form-fields/entity-combobox-field.tsx:24-52`) — nowy wariant to jeden klucz
  w mapie. Ma wbudowany przełącznik „tylko aktywne" na `activeOrSelected`.
- **Podział plików tabeli jest konwencją repo**: `components/tables/<x>.tsx` eksportuje czyste
  `get<X>Columns()`, a `components/<feature>/<x>-data-table.tsx` jest kliencką kompozycją ze stanem.

**Do napisania**: strona listy, strona detalu, plik okruszka, `getEquipmentColumns()`,
`EquipmentDataTable`, dialogi (dodaj sprzęt / edytuj / przekaż / dodaj serwis), formularze z
dwuwarstwowym schematem Zod, linia w `src/stores/form-stores.ts`, akcje serwerowe, historia zdarzeń
na siatce `SummaryTable`.

Kształt formularza (pełny łańcuch, wzór `add-vehicle-dialog` → `vehicle-form` → `vehicleSchema` →
`createVehicleAction`): schemat ma **dwie warstwy** — `xFormSchema` (wszystko `string`, warstwa
kontrolek) i `xSchema = xFormSchema.extend({...})` (warstwa domenowa, którą waliduje akcja), przy
czym druga jest **wyprowadzona** z pierwszej, żeby listy pól nie mogły się rozjechać. Wartości puste
to `null`, nie `undefined` — Payload czyta brak klucza przy update jako „nie ruszaj".

### 4. Przypomnienia o gwarancji — 12 miejsc

Analiza wskazała dokładnie 12 punktów dotknięcia (pełna lista w sekcji „Do zrobienia" niżej).
Rzeczy, o których trzeba wiedzieć przed planem:

- **Bramka crona jest współdzielona** — `isAuthorizedCronRequest`
  (`src/lib/cron/verify-cron-request.ts:13-18`), `Bearer $CRON_SECRET`, **fail-closed** przy braku
  sekretu. Zero nowego kodu autoryzacji.
- **Kształt pipeline'u: load → decide → send → stamp**, gdzie `decide` jest funkcją **czystą** (bez
  zegara, bazy i wysyłki) — `route.ts:16-42`. Stąd 11 specyfikacji jednostkowych w
  `src/__tests__/lib/fleet/` i zero `renderHook` w repo.
- **Stempel „powiadomiono" pisze się PO udanej wysyłce**, seryjnie, nie `Promise.all`
  (`sweep-io.ts:9-21`) — wdrożona baza przy równoległych zapisach Payloada zachowuje jeden, resztę
  gubi i raportuje sukces dla wszystkich. `stampNotified` zwraca nieudane id zamiast rzucać, bo 500
  ściągnąłby retry crona i **powtórną wysyłkę całego digestu**.
- **Kubełki to liczby dni** (`[0,1,7,30]`, `OVERDUE = 0`), więc „który kubełek", „jak pilne" i „czy
  już wysłano" zwijają się do jednej porównywalnej liczby, a deduplikacja to `<`
  (`thresholds.ts:8-40`). Mailowany jest tylko próg ≤ 7 (decyzja właściciela 2026-08-26);
  30 koloruje listę i karmi badge.
- **Nowy strumień nie wymaga migracji** — `notification_reads` to `(user_id, stream text, seen_at)`
  z unikalnym indeksem, `stream` jest wolnym tekstem. Ale `EPOCHS` jest `Record<StreamT, string>`,
  więc dodanie klucza do `STREAMS` **jest błędem typów, dopóki nie dopiszesz epoki** — celowo.
  Epoka to „wszystko sprzed wdrożenia liczy się jako przeczytane", żeby nikt nie dostał „247 nieprzeczytanych".
- **Dwa rejestry o podobnym kształcie to nie to samo**: `STREAMS` (kursory przeczytania, per user)
  i `RECIPIENT_LISTS` (listy adresów, global). Nowy moduł potrzebuje **obu**.
- **Nowa lista odbiorców WYMAGA migracji** — `notification_recipients` ma jedną tabelę-dziecko na
  listę (`20260826_0_notification_recipients.ts:19-50`), więc czwarta lista to czwarta tabela + dwa
  indeksy + seed.
- **Maile to ręcznie składane stringi HTML kolokowane z funkcją**, nie React Email
  (`src/lib/fleet/notify.ts`, 86 linii). Prymityw `section(title, entries, tag, row)` (`:15-27`) —
  pusty na wejściu, pusty na wyjściu — jest realnym kandydatem do wyniesienia do `lib/email/`.
  Wszystko przechodzi przez `escapeHtml`. **Jedna wiadomość do N adresów, nie N wysyłek** (`:65-70`).
- **Nowa bramka izolacji nie jest potrzebna.** Reguła z
  `context/reference/outgoing-effects-isolation.md:103-107`: bramka siedzi w poświadczeniu, nigdy we
  fladze, i należy się efektom nieodwracalnym albo dotykającym osób z zewnątrz. Digest sprzętu to
  wewnętrzny mail przez `payload.sendEmail`, więc dziedziczy stojącą bramkę `EMAIL_HOST`, a cron i
  tak odpala się wyłącznie na produkcji.

### 5. Co Flota już rozstrzygnęła — dziedziczymy bez ponownej dyskusji

Z `context/archive/2026-08-18-flota-przeglady/change.md` i `review-gate.md`:

- **Żadnych pól „ostatni/następny" na encji** — zawsze pochodna najnowszego zdarzenia. „To już
  zrobione" jest wtedy darmowe: wpisanie zdarzenia samo przesuwa termin, więc nie ma flagi „potwierdzone".
- **Termin jest wpisywany ręcznie, podpowiadany z interwału**, nie wyliczany autorytatywnie —
  prawda o dacie stoi na dokumencie. Dla nas: **koniec gwarancji przepisuje się z faktury**.
- **Jeden digest dziennie, sekcjonowany**, nigdy mail na zdarzenie.
- **Znana dziura, załatwiona świadomie**: rzecz bez zdarzenia danego typu nie ma terminu i jest
  niewidoczna dla crona — Flota pokryła to sekcją „brak danych" w digeście. **To jest dokładnie nasz
  alarm „brak przypisania"** i ta sama mechanika go obsłuży.
- **Dostęp jak przy kasach**: odczyt/zapis OWNER/ADMIN/MANAGER, usuwanie OWNER/ADMIN.
- Adresaci digestu **nie są relacją do `users`** — ktoś, kto ma dostawać maila, nie musi mieć konta
  w aplikacji (`globals/notification-recipients.ts:4-5`).

### 6. Nazewnictwo

`AGENTS.md` §„Naming a financial figure" nie dotyczy tego modułu wprost (nie ma tu figur
finansowych ani arkusza), ale reguła bazowa obowiązuje: **UI po polsku, kod po angielsku, jeden
identyfikator to jeden język.** Czyli `equipment` / `equipmentEvents` / `warehouses`, nie `sprzet`.

**Pułapka**: `wToolsCoeff` / `ownToolsCoeff` na inwestycji to model **cenowy** robocizny
(z narzędziami / bez narzędzi), nie inwentarz — wspólne słowo „narzędzia" nie oznacza wspólnej domeny.

## Odniesienia do kodu

| Ścieżka | Rola |
| --- | --- |
| `src/collections/vehicles.ts:1-94` | wzorzec encji |
| `src/collections/vehicle-inspections.ts:1-140` | wzorzec logu zdarzeń + pola księgowania powiadomień (`:121-138`) |
| `src/collections/expense-categories.ts:1-35` | wzorzec słownika |
| `src/hooks/transfers/validate.ts:29-210` | idiom walidacji krzyżowej („dokładnie jedno z N") |
| `src/lib/utils/resolve-id.ts:2-8` | porównanie relacji niezależne od `depth` |
| `src/lib/db/notifications.ts:71-77` | `DISTINCT ON` — „najnowszy wiersz na rodzica" w SQL |
| `src/lib/db/notifications.ts:5-19` | `STREAMS` + `EPOCHS` |
| `src/lib/fleet/dataset.ts:19-77` | dwa odczyty + grupowanie (świadomie NIE kopiujemy) |
| `src/lib/fleet/deadlines.ts:18-24` | „aktualne = najnowsze po dacie zdarzenia" |
| `src/lib/fleet/thresholds.ts:8-54` | kubełki jako liczby dni |
| `src/lib/fleet/days.ts` | dzień warszawski — kandydat do promocji |
| `src/lib/queries/fleet.ts:15-57` | cache bez daty w kluczu, „dziś" wstrzykiwane per żądanie |
| `src/lib/queries/reference-data.ts:27-167` | ładowanie słowników do formularzy |
| `src/lib/queries/assert-complete-page.ts:10-19` | głośny błąd zamiast cichego ucięcia strony |
| `src/lib/actions/run-action.ts:35-66` | `protectedAction` |
| `src/lib/utils/is-active-ref.ts` | wybrana pozycja przeżywa filtr „tylko aktywni" |
| `src/components/work-catalogue/work-catalogue-data-table.tsx:24-77` | wyszukiwarka + filtr nad tabelą |
| `src/components/forms/form-fields/entity-combobox-field.tsx:24-95` | picker pracownika / inwestycji |
| `src/components/nav/sidebar.tsx:34-44` | rejestracja w nawigacji |
| `src/app/(frontend)/flota/page.tsx:17-45` | szablon strony listy |
| `src/app/(payload)/api/cron/fleet-reminders/route.ts:12-49` | pipeline load → decide → send → stamp |
| `src/migrations/20260901_0_add_work_catalogue_items.ts` | najczystszy wzorzec migracji |
| `src/migrations/20260818_1_add_fleet.ts` | migracja modułu dwóch kolekcji |

## Wnioski architektoniczne

1. **Log jest tańszy niż pole, gdy stan i tak trzeba wyprowadzić.** Flota nie trzyma terminu na aucie
   i to jedna decyzja usuwa trzy inne: flagę „potwierdzone", zapisy wsteczne i rozjazd między
   statusem a rzeczywistością. Ten sam ruch obsługuje u nas „gdzie jest".
2. **Czysta decyzja, brudne krańce.** Wszystko w `lib/fleet/` poza `dataset` / `sweep-io` / `notify`
   jest czystą funkcją argumentów — bez zegara, bazy i Payloada. Dlatego moduł ma 11 specyfikacji
   jednostkowych i repo nie potrzebuje `renderHook` (`lessons.md:389`, `:999`).
3. **Niezmiennik wiersza należy do hooka kolekcji, efekt uboczny do akcji.** To nie sprzeczność z
   regułą „nowy efekt idzie do akcji" — to jej druga połowa.
4. **Cache trzyma fakty, nie oceny.** Data wchodzi po stronie żądania, nigdy do klucza ani do wartości.
5. **Enum jest constraintem.** Repo nie ma ani jednego `CHECK` i to jest stanowisko, nie zaniedbanie.

## Kontekst historyczny

- `context/archive/2026-08-18-flota-przeglady/` — `change.md` + `review-gate.md`; źródło sekcji 5.
- `context/archive/2026-08-19-fleet-manual-flags-and-service-type/` — dlaczego `flags` to mapa
  „typ → dzień oznaczenia", a nie boolean: znacznik kasuje się sam, gdy zdarzenie tego typu wpłynie.
- `context/archive/2026-08-24-fleet-costs-column/`, `2026-08-26-fleet-costs-window/` — okno kosztowe
  i to, że `null ≠ 0` dla pieniędzy (nieznany koszt renderuje „—", nie „0,00 zł").
- `context/reference/outgoing-effects-isolation.md` — obowiązkowa lektura przed nową integracją wychodzącą.
- `context/foundation/lessons.md` — pozycje istotne tutaj: `:807` (licznik migracji pęka na 10),
  `:854` (`unique` jest jednokolumnowe), `:1324` i `:40` (niezmiennik w dwóch płaszczyznach),
  `:1407` (walidacja krzyżowa w hooku), `:1468` (`unstable_cache` nie deduplikuje w jednym renderze),
  `:1487` (skorelowany podzapyt vs CTE — 122 ms vs 2,5 ms).

## Otwarte pytania

1. ~~Cron: czwarty wpis czy rozszerzenie istniejącego?~~ **Rozstrzygnięte 2026-09-03: konto jest na
   płatnym planie Vercela, więc limit cronów Hobby (2 zadania, raz dziennie) nie obowiązuje.**
   Czwarty wpis w `vercel.json` + własny handler `api/cron/equipment-reminders`, bez ruszania
   ścieżki floty. Autoryzacja i tak jest współdzielona (`isAuthorizedCronRequest`), a osobny handler
   z definicji izoluje awarię jednego strumienia od maila drugiego — czego wariant „dwie gałęzie
   try/catch w jednym handlerze" musiałby pilnować ręcznie.
2. **Promocja `days.ts` / `thresholds.ts` / `DeadlineCell` z `lib/fleet/` do wspólnego domu.**
   Review gate Floty odłożył to explicite do „drugiej funkcji, która potrzebuje dnia warszawskiego".
   Do rozstrzygnięcia w planie: czy kubełki `[0,1,7,30]` i `MAILED_BUCKET_MAX = 7` są polityką
   wspólną, czy sprzęt zasługuje na własną skalę (gwarancja to inny rytm niż przegląd rejestracyjny).
   Od tego zależy, czy promujemy trzy pliki, czy tylko `days.ts`.
3. ~~Załączniki?~~ **Rozstrzygnięte 2026-09-03: wchodzą od pierwszej wersji.** Migracja musi zawierać
   ręczną tabelę `_rels` (pięć statementów, cztery indeksy) — patrz `20260818_1_add_fleet.ts:73-90`.
4. ~~Serwis jako słownik?~~ **Rozstrzygnięte 2026-09-03: wolny tekst z nazwą warsztatu.**
5. **E2E.** Flota wypuściła slice bez specyfikacji Playwrighta i odłożyła ją jako `EX-716` z etykietą
   `e2e-backlog`. Ten moduł zaciąga ten sam obowiązek — do zaadresowania na bramce review, nie w commicie.

## Do zrobienia — mapa dotknięć

**Nowe pliki (~20)**: trzy kolekcje, migracja, `src/lib/equipment/{status,event-types,thresholds?,
should-notify,reminder-sweep,sweep-io,notify,rows,types}.ts`, zapytanie `src/lib/db/equipment.ts` +
`src/lib/queries/equipment.ts`, akcje `src/lib/actions/equipment.ts`, strona listy + detalu +
`loading.tsx` do każdej + plik okruszka, `EquipmentDataTable`,
`getEquipmentColumns()`, `HeldEquipmentSection` (sparametryzowana opiekunem), własna komórka
gwarancji,
dialogi i formularze, badge (3 linie), specyfikacje pod `src/__tests__/lib/equipment/`
i `src/__tests__/hooks/`.

**Edycje istniejących plików (9)**: `src/payload.config.ts` (rejestracja kolekcji),
`src/migrations/index.ts`, `src/lib/cache/tags.ts` (trzy tagi), `src/lib/db/notifications.ts`
(`STREAMS` + `EPOCHS` + zapytanie licznika), `src/lib/actions/notifications.ts`,
`src/components/nav/sidebar.tsx`, `src/globals/notification-recipients.ts`,
`src/lib/email/recipients.ts`, `src/stores/form-stores.ts`,
`src/app/(frontend)/pracownicy/[id]/page.tsx` (sekcja „na stanie" — patrz niżej).
Plus `src/collections/users.ts`
(piąta sonda `makePreventDelete`) i `src/lib/queries/reference-data.ts` + jego test driftu, jeśli
magazyny idą tą drogą.

**„Co ma Marek" nie jest nowym ekranem.** `src/app/(frontend)/pracownicy/[id]/page.tsx` już
istnieje i już jest za `ADMIN_OR_OWNER_MANAGER_ROLES`, więc sekcja dokleja się tam obok
`SignedMoneyDisplay` i `TransfersSection` — jedno `Promise.all` szersze, zero nowego routingu
i zero nowej bramki dostępu. **Magazyn nie dostaje strony wcale** (decyzja 2026-09-03) — „co leży
na Kwiatowej" to filtr „gdzie jest" na liście sprzętu, czyli o jedną trasę mniej. Zapytanie i tak
jest sparametryzowane opiekunem (`holder = user:N` / `warehouse:N`), więc karta magazynu zostaje
możliwa bez żadnej przeróbki danych, gdyby kiedyś była potrzebna.

**Nietknięte**: `verify-cron-request.ts`, `unread-stream-badge.tsx`, `count-badge.tsx`,
`recipient-list-card.tsx`, akcja i zapytanie odbiorców, schemat `notification_reads`, blok
mailowy w `payload.config.ts`. Żadnej nowej bramki efektów wychodzących.

---

# CZĘŚĆ II — rynek (2026-09-01)

Status: **materiał wejściowy, historyczny.** Opisuje pełny model rynkowy, nie zakres. Wszędzie, gdzie
mówi coś innego niż `change.md` §„Ustalony zakres (2026-09-03)", obowiązuje `change.md`. Zachowane,
bo trzyma uzasadnienia rzeczy świadomie odrzuconych — a odrzucenie bez zapisanego powodu wraca.

## 1. Co już jest w repo i przekleja się wprost

Flota to ten sam kształt domenowy: rzecz + terminy + koszty + historia zdarzeń.

| Warstwa       | Flota                                                                              | Co przejmujemy                                                                           |
| ------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Encja         | `src/collections/vehicles.ts`                                                      | status, `note`, `flags` (JSON „do wymiany"), `exemptions`                                |
| Zdarzenia     | `src/collections/vehicle-inspections.ts`                                           | `performedAt` / `nextDueAt` / `cost` / `attachments` / bookkeeping powiadomień           |
| Listing       | `components/fleet/fleet-data-table.tsx`, `components/tables/fleet.tsx`             | `DeadlineCell`, bucket 7/30 dni (`lib/fleet/thresholds.ts`), kolumna kosztów w oknie dat |
| Detal         | `app/(frontend)/flota/[id]`, `vehicle-detail-tabs`, `inspection-history`           | taby + historia per typ                                                                  |
| Dialogi/formy | `dialogs/add-vehicle-dialog`, `forms/vehicle-form/`                                | TanStack + `form-dialog-shell`                                                           |
| Query/cache   | `lib/queries/fleet.ts`, `lib/fleet/dataset.ts`                                     | dataset bez daty w kluczu cache, „dziś" wstrzykiwane per request                         |
| Powiadomienia | `api/cron/fleet-reminders`, `STREAMS.fleet`, `notification-recipients.fleetDigest` | digest mailowy + badge nieprzeczytanych                                                  |

Generyki gotowe do użycia: `ui/data-table`, `ui/form-dialog`, `ui/confirm-dialog`, `ui/combobox`,
`ui/page-wrapper`, `lib/utils/parse-date-range`.

Wniosek: front to w większości konfiguracja istniejących prymitywów. Nowa jest warstwa danych.

**Pułapka nazewnicza.** `wToolsCoeff` / `ownToolsCoeff` na inwestycji to model CENOWY robocizny
(z narzędziami / bez narzędzi), nie inwentarz. Mimo wspólnego słowa „narzędzia" te dwie rzeczy nie
mają ze sobą nic wspólnego.

## 2. Trzy decyzje modelowe

### 2.1 „Gdzie jest" jako pochodna, nie pole

Pole `currentInvestment` na encji nie odpowie za pół roku na pytanie „kto zgubił szlifierkę".
Dojrzałe systemy trzymają niemodyfikowalny log przekazań (chain of custody) i liczą aktualne
miejsce z ostatniego wpisu. To ten sam ruch, co w kosztorysie (pomiar = suma etapów) i we flocie
(termin = ostatni przegląd).

Kształt: `equipment` + `equipment-assignments` (log) + `equipment-services` (log).

### 2.2 Przypisanie jest dwuwymiarowe

Rynek rozdziela „kto odpowiada" (pracownik) od „gdzie fizycznie jest" (inwestycja / magazyn /
pojazd). Wiertarka jest u pracownika, a pracownik jest na inwestycji. Jedno pole „przypisane do"
gubi jedną z tych osi przy każdym wydaniu.

Wpis w logu: `holder` (user, nullable), `investment` (nullable), `location` (magazyn / pojazd).
Payload umie relację polimorficzną (`relationTo: ['investments', 'users']`), ale to są dwie różne
osie — lepiej dwa nullable relationship + walidacja.

### 2.3 Egzemplarz vs model

Osiem identycznych wiertarek to osiem rekordów z numerami seryjnymi, nie jeden z `quantity: 8`.
Wiertła, tarcze, przedłużacze to materiał, nie sprzęt. Najczęstsza przyczyna śmierci takich
rejestrów: wciągnięcie rzeczy zużywalnych. Trzeba ustalić próg (wartość albo „ma numer seryjny").

## 3. Czego właściciel nie wymienił, a rynek to ma

- **Potwierdzenie odbioru** (accept / decline przez pracownika) — sedno ShareMyToolbox. Bez tego
  przy zgubieniu zawsze pada „ja tego nie brałem". Jedno pole `acceptedAt` na wpisie logu.
- **Transfer w terenie, pracownik → pracownik**, bez powrotu do magazynu. W praktyce większość ruchów.
- **Zdjęcie + stan przy wydaniu i zwrocie** — `media` / `attachments` już są, więc to darmowe.
  Rozstrzyga spory o uszkodzenia.
- **Inwentaryzacja / audyt** — przejście po magazynie, odhaczanie, raport braków. W EZO i Asset
  Panda osobny tryb.
- **Pełny cykl życia**: zakup → dostępne → wydane → serwis → zgubione / skradzione / wycofane /
  sprzedane. „Zgubione" to inny stan niż „nieprzypisane" — i to on trafia do raportu.
- **Koszt sprzętu na inwestycję** (godziny pracy maszyny alokowane na projekt — busybusy, EZO).
  Naturalnie zaczepiłoby się o inwestycję, ale to osobny krok.
- **Terminy inne niż gwarancja**: przeglądy elektronarzędzi, pomiary elektryczne, UDT dla
  podnośników i rusztowań. W PL realne obowiązki terminowe, mechanika identyczna z `nextDueAt` —
  jeden typ zdarzenia więcej, zero nowego kodu.
- **QR / kod kreskowy** — nalepka z ID prowadząca na stronę sprzętu. Tanie, a bez tego wydanie
  narzędzia to szukanie po nazwie na liście kilkuset pozycji.

## 4. Szkic pierwszej wersji (do przycięcia)

Trzy kolekcje (`equipment`, `equipment-assignments`, `equipment-services`), listing + detal na wzór
floty, dwa dialogi („Wydaj / przekaż", „Dodaj serwis"), gwarancja i terminy wpięte w istniejący
`DeadlineCell` i w cron-digest jako drugi strumień obok `fleetDigest`. Migracja pisana ręcznie
(reguła repo).

## 5. Otwarte pytania przed planem — ZAMKNIĘTE 2026-09-03

Odpowiedzi w `change.md`. Zostawione dla śladu, czym były.

1. Czy magazyn to byt w systemie, czy po prostu „brak przypisania"?
2. Czy potwierdzenie odbioru wchodzi od razu? Pociąga za sobą dostęp roli `EMPLOYEE` do modułu,
   którego Flota nie ma (`MANAGEMENT_ROLES`).
3. Gdzie leży próg „to jest sprzęt, a to materiał"?
4. Czy log przekazań jest potrzebny od początku, czy przy tej skali wystarczy pole „gdzie jest"
   plus prosta historia? (Kluczowa decyzja przycinająca — patrz 2.1.)

## Źródła

- https://www.sharemytoolbox.com/construction-tool-tracking/tool-tracking-system/
- https://www.assetpanda.com/solutions/tool-tracking/
- https://ezo.io/ezofficeinventory/industries/construction-asset-tracking-software/
- https://www.gigatrak.com/tool-tracking/tool-check-out-system/
- https://www.panatrack.com/construction-equipment-management-software/
- https://oxmaint.com/blog/post/how-to-build-equipment-asset-register-from-scratch
- https://oxmaint.com/blog/post/track-equipment-warranty-service-contracts-cmms
- https://bulbthings.com/blog/asset-panda-vs-ezofficeinventory
