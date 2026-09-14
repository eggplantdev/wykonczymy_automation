# Review-gate ledger — EX-758 katalog-sprzetu · 2026-09-03

Zakres: `d68eedea..bfeb15f5` (etapy 1–6) plus niezacommitowany `manual-checks.md`.
Krok 0.5 (przebieg weryfikacyjny w przeglądarce) **pominięty** — użytkownik ma stałą regułę: nie
uruchamiać Playwrighta ani `test:e2e` bez wyraźnej prośby w danej turze. Ręczne checki są spisane
w `context/foundation/manual-checks.md` § EX-758 i blokują `Done`.

Fan-out: `/10x-impl-review`, `/code-review`, `comment-noise-audit`, structure+cohesion,
reuse-scan + `tailwind-v4-audit`.

## Findings

<!-- [box] · [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — why -->

### Poprawność (impl-review / code-review — z natywną severity)

- [x] 🔴 CRITICAL · fixed · code-review + impl-review · `src/lib/equipment/rows.ts:24` · „Edytuj sprzęt" otwierał się z pustą datą zakupu i pustą gwarancją: Postgres oddaje kolumnę dzienną jako `Date` o północy UTC, a pełny timestamp ISO to dokładnie to, czego `FormDatePicker` nie parsuje. Skutek uboczny był gorszy niż puste pole — żeby zapisać, trzeba było przeklikać datę gwarancji, a to zeruje `warrantyNotifiedBucket` i uzbraja mail od nowa. Mapper dostał `dayOrNull` (`toWarsawDay`)
      test: test-driven-debugging · unit — `src/__tests__/lib/equipment/rows.test.ts`, `Date('2026-12-01T00:00:00Z')` → `'2026-12-01'`
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/db/equipment.ts:86` · „Na stanie" na stronie pracownika nie filtrowało statusu — sztuka SOLD/LOST/STOLEN, której ostatnie zdarzenie wskazuje na Marka, dalej u niego wisiała. To jest liczba czytana przy rozliczeniu końcowym. Doszła bramka `LIVE_EQUIPMENT_STATUSES`, a `CASE` w `WHERE` rozbity na sargable gałąź per rodzaj celu
      test: test-driven-debugging · integration — `equipment.db.test.ts` „leaves a retired item off the list of who is holding equipment"; **złapał regresję w samej poprawce** (`= ANY($n)` z tablicą JS → `malformed array literal`, driver rozbija tablicę na parametr per element; jest lista literalna przez `sql.join`)
- [x] 🟡 WARNING · fixed · impl-review · `src/migrations/20260903_1_equipment_digest_recipients.ts` · `notification_recipients_equipment_digest` tworzone i seedowane w DWÓCH migracjach; `_1.down` zdejmowałby tabelę, której właścicielem jest `_0`. Migracja skasowana wraz z wpisem w `index.ts` — żadna nie poszła na prod, więc okno na tani fix było otwarte
      test: no automated test — jednorazowy artefakt migracyjny, weryfikacja przez `payload migrate` na czystej bazie
- [x] 🟡 WARNING · fixed · code-review · `src/lib/equipment/sweep-io.ts:14` · `loadWarrantyRows` czytało CAŁY rejestr z `limit: 2000`, a `assertCompletePage` **rzuca** zamiast obciąć — czyli 2001. sztuka wywala cały digest zamiast go zawęzić. Zapytanie zawężone do `status: IN_USE` + `warrantyUntil: exists`, czyli do jedynych wierszy, które sweep może ogłosić
      test: no automated test — sufit paginacji; zawężenie jest własnością zapytania, nie zachowania klasyfikatora
- [x] 🟡 WARNING · fixed · code-review · `src/collections/equipment.ts:26` · unikalny indeks traktuje `''` jak wartość, więc druga sztuka zapisana z `/admin` z pustym numerem seryjnym leciała na `equipment_serial_number_idx`. Formularz wysyła `null`, `/admin` wysyła `''` — normalizacja w `beforeValidate`
      test: test-driven-debugging · integration — `equipment.db.test.ts` „lets two items be saved with the serial number left blank"
- [x] 🟡 WARNING · fixed · impl-review · `change.md:37` · załączniki miały pole, tabelę `equipment_events_rels` i martwą ścieżkę odczytu (`array_agg` + `attachmentIds`), ale żaden ekran ich nie wgrywał ani nie pokazywał. Odczyt usunięty, schemat i tabela zostają (o to szło — druga migracja byłaby droższa), `change.md` mówi teraz, co naprawdę jest w v1
      test: no automated test — zakres UI, nie regresja
- [x] 🟡 WARNING · fixed · impl-review · `plan.md:407` · plan mówił, że koszt serwisu „dopisuje się edycją wpisu"; historia jest read-only, bo wpisy są append-only. Plan zapisuje odwrócenie: koszt wchodzi przez `/admin` → „Zdarzenia sprzętu"
      test: no automated test — rozstrzygnięcie zakresu
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/equipment/sweep-io.ts:46` · czterdzieści stempli unieważniało cache rejestru czterdzieści razy dla jednego digestu — stemple idą z `skipRevalidation`, a cron woła `revalidateTag` raz po pętli
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/queries/equipment.ts` · `fetchEquipmentDetail` skanowało cały cache'owany dataset, żeby znaleźć jedną sztukę — jest `loadEquipmentById` czytające tą samą regułą „current" co listing, plus `Promise.all` z historią
      test: test-driven-debugging · integration — `equipment.db.test.ts` „reads one item by id through the same rule as the listing" + `null` dla nieistniejącego id
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/schemas/equipment-target.ts:18`, `equipment-schema.ts:16` · daty przechodziły jako gołe `z.string()`, a tę samą schemę parsuje server action — wartość niebędąca dniem lądowała w Postgresie jako Invalid Date zamiast zostać odrzucona. Są `requiredDay` / `optionalDay`
- [x] 🔵 OBSERVATION · fixed · code-review · `src/hooks/equipment/validate.ts:28` · dopisany zamiar: PATCH nazywający INNY cel niż wiersz ma dwa cele i jest odrzucany — bo historia jest append-only, więc przeniesienie to nowe zdarzenie, nie edycja starego
- [x] 🟡 WARNING · dropped · code-review · `src/lib/db/notifications.ts:128` · moment wejścia w okno (`warranty_until - 30 dni`) to północ **UTC**, a listing liczy okno od północy **warszawskiej** — te same 1–2 h rozjazdu ma bliźniak floty (`countUnreadFleetDeadlines`). Zasięg: badge inkrementuje się o dwie godziny za wcześnie, i tylko dla użytkownika, którego ostatnia wizyta wypadła w tym paśmie. Naprawa oznacza edycję wysłanego SQL-a floty dla zera widocznej różnicy
- [x] 🔵 OBSERVATION · dropped · impl-review · `src/components/equipment/where-filter-options.ts:42` · opcja „nieznane" pokazuje się tylko dla żywych sztuk, ale wybranie jej listowało też wycofane. Wartość wiersza zgadza się teraz z opcją (`WHERE_RETIRED`), sama asymetria alarmu jest zamierzona
- [x] 🔵 OBSERVATION · dismissed · impl-review · `context/reference/preview-verification-accounts.md` · przeformatowanie prettierem cudzego dokumentu w zakresie commitów — nie moja zmiana treści, zero skutku

### Struktura i reuse (bez severity)

- [x] fixed · structure · `src/lib/utils/days.ts`, `src/lib/utils/deadline-label.ts` · nowy `lib/dates/` konkurował z `lib/utils/` (`date.ts`, `date-range.ts`, `format-date.ts`, `parse-date-range.ts`). Przeniesione do `lib/utils/` — kierunek wybrany świadomie: przeniesienie czwórki w drugą stronę ruszyłoby 36 obcych importerów, ten dotyka 30, które etap 6 i tak już ruszył
- [x] fixed · structure+reuse · `src/lib/utils/urgency-buckets.ts` · `classifyBucket` + `isMoreUrgent` w jednym module; `fleet/thresholds.ts` i `equipment/warranty-thresholds.ts` to teraz cienkie wrappery nad wspólną algebrą kubełków
- [x] fixed · reuse · `src/lib/email/digest-section.ts` · generyczny `section<T>(title, entries, tag, row)` wyciągnięty z `fleet/notify.ts`; oba digesty go wołają
- [x] fixed · reuse · `src/lib/db/stamp-sequentially.ts` · sekwencyjna pętla zapisu wraz z całym uzasadnieniem („baza gubi równoległe zapisy Payloada i raportuje sukces dla wszystkich") mieszka raz; oba sweepy mapują swoje stemple na `{id, data}`
- [x] fixed · structure · `src/lib/equipment/types.ts` · `WarehouseOptionT` czytany przez 6 komponentów z 4 katalogów — kontrakt publiczny, wyprowadzony z `lib/queries/`
- [x] fixed · structure · `src/lib/schemas/equipment-target.ts`, `src/components/forms/form-fields/equipment-target-field.tsx` · jedyny w repo import w poprzek katalogów formularzy zlikwidowany
- [x] fixed · reuse · `src/hooks/reset-bookkeeping.ts` · `makeResetBookkeeping(reset)` obok `makeRevalidateAfterChange`; `equipment.ts` i `vehicle-inspections.ts` mają po jednej linii
- [x] fixed · reuse · `src/lib/db/row-coerce.ts` · `text` i `isoOrNull` dołożone obok `numOrNull`; `equipment/rows.ts` przestał je re-deklarować
- [x] fixed · reuse · `src/components/forms/form-fields/entity-combobox-field.tsx` · `WORKER_COPY` + spread zamiast szóstki identycznych stringów w wariancie `holder`
- [x] fixed · reuse · `src/components/ui/badge.tsx` · `BADGE_TONE` (`positive` / `muted`); trzy kopie literału emerald czytają jedno źródło
- [x] fixed · reuse · `src/lib/equipment/rows.ts` · `makeModel()` i `targetLabel()` zamiast trzech kopii `[make, model].filter(Boolean).join(' ')` i dwóch etykiet „Serwis: …"
- [x] fixed · reuse · `src/lib/utils/validation.ts` · `optionalNonNegativeAmount(message)` używane przez `purchasePrice` i `cost`
- [x] fixed · comment-noise · `src/lib/utils/days.ts` · skasowana narracja nad `addMonthsToDay`
- [x] fixed · comment-noise · `src/lib/queries/equipment.ts` · skasowana glosa „Na stanie…", ucięty restatement nad `fetchEquipmentDetail`
- [x] fixed · comment-noise · `src/components/forms/equipment-form/equipment-item-fields.tsx:27` · ucięte „The item's own attributes", zostało sprzężenie („shared by …")
- [x] dismissed · reuse · `src/lib/kosztorys/sheet-import/formula-health.ts:42`, `parse-labor-tab.ts:39` · prywatne `text()` **nie są** tym samym co `row-coerce.text` — te trymują, tamto nie. Repointowanie zmieniłoby zachowanie parserów arkusza

### Zamknięte w triażu

- [x] dismissed · comment-noise · `api/cron/equipment-reminders/route.ts:10`, `lib/actions/notifications.ts:32`, `components/nav/unread-equipment-badge.tsx:6` · flagi audytu — zdanie nośne w każdym z nich (rozdział strumieni maila, postawa „non-success → 0", semantyka okna 30 dni), zostają
- [x] dismissed · comment-noise · 4× „koszt należy do serwisu" (`collections/equipment-events.ts:81`, `equipment-transfer-schema.ts:14`, `hooks/equipment/validate.ts:53`, `equipment-transfer-form.tsx:78`) · każdy nośny w swoim miejscu; ryzyko rozjazdu odnotowane, nie kasujemy
- [x] dismissed · tailwind · cały diff · 0 trafień w trzech grupach (`var(--token)` w klasach arbitralnych, `style={{}}`, wartości w nawiasach); `text-chart-orange` zweryfikowany jako realny token `@theme`
- [x] dismissed · structure · `components/equipment/where-filter-options.ts`, `components/dialogs/`, `hooks/equipment/validate.ts`, rozmieszczenie 7 nowych speców · zgodne z ustaloną konwencją repo (odpowiedniki we flocie / kosztorysie)
- [x] dismissed · reuse · `components/equipment/warranty-cell.tsx:23` · **nie** duplikat `fleet/deadline-cell.tsx` — inna liczba stanów i odwrócona reguła pilności (wygasła gwarancja jest wyszarzona, przeterminowany przegląd czerwony); część wspólna (`daysLabel`) już współdzielona
- [x] dismissed · reuse · `src/lib/db/equipment.ts:16` · `CURRENT_STATE` / `OVERVIEW_*` to fragmenty SQL współdzielone przez zapytania w pliku — wzorzec działa (`loadEquipmentById` dołożone jako czwarty konsument)
- [x] skipped · reuse · `api/cron/equipment-reminders/route.ts:11` · szkielet handlera jak we flocie; zwinięcie wymaga runnera na 4 callbackach, a rozdział jest świadomy („awaria jednej strony nie może zjeść maila drugiej") — refaktor na własny przegląd, nie mechaniczny dedup
- [x] dropped · reuse · `lib/equipment/reset-warranty-bookkeeping.ts:27` · inline `changed(field)` zamiast helpera z floty — 2 linie, jedno pole; ekstrakcja to więcej pośrednictwa niż zysku
- [x] dropped · reuse · `components/equipment/equipment-history.tsx:36` · `<div className="contents">` zamiast `<Fragment>` jak we flocie — kosmetyka, identyczny render
- [x] dropped · reuse · `components/equipment/held-equipment-section.tsx:22` · nagłówek `mb-2 text-sm font-semibold` w 2. kopii — poniżej progu ekstrakcji
- [x] dropped · structure · `src/lib/utils/date.ts:2` `today()` (UTC) vs `warsawToday()` (Warszawa) · realna kolizja nazw z 6 konsumentami, ale **zastana** i poza zakresem tej zmiany
- [x] dropped · structure · `src/lib/queries/assert-complete-page.ts` · generyczny strażnik paginacji w warstwie zapytań, importowany też z `lib/fleet`, `lib/google`, `lib/actions`; zmiana dołożyła 1 konsumenta do zastanego wzorca — jego dom to osobna decyzja

### E2E

- [x] filed · gate · cała ścieżka przeglądarkowa (dodanie ze wskazaniem celu, przekazanie unieważniające poprzednie miejsce, dialog edycji z wypełnionymi datami, filtr „Gdzie jest") — **EX-771**, etykieta `e2e-backlog`. Odroczone, bo reguła sesji zabrania uruchamiania Playwrighta bez wyraźnej prośby, a spec bez przebiegu to spec niesprawdzony

## Simplify pass

`/simplify` nie jest wywoływalne jako skill z tej sesji (to komenda wbudowana). Jego rolę pełni
agent `reuse-scan` z fan-outu — ten sam zakres (reuse / dedup / uproszczenia) — a wszystkie jego
otwarte findingi zostały zastosowane w tym przebiegu i są wyliczone wyżej z tagiem `reuse` /
`structure`. Żadnego osobnego raportu nie ma; ta lista jest jedynym źródłem.

## Tests & suite

- `pnpm typecheck` — zielony
- `pnpm exec vitest run` (lib/equipment, lib/utils, lib/fleet, lib/email, components/equipment) — 31 plików / 246 testów zielonych
- DB @ 5435: `equipment.db.test.ts` (9, w tym 3 nowe) + `target-invariant.db.test.ts` — zielone
- `pnpm test:e2e` — **nie uruchamiane** (reguła sesji), obowiązek przeniesiony do EX-771
- `pnpm lint` — 4 błędy zastane, niezwiązane ze zmianą (3× `@next/next/no-html-link-for-pages` w `src/app/(legal)/…`, 1× `no-undef` na `console` w `test.js`)

---

# Druga tura — 2026-09-04

Zakres: zmiany wprowadzone PO pierwszym przejściu bramki (niezacommitowany working tree ponad
`bfeb15f5`, 24 pliki): przebudowa „Dodaj sprzęt", przycisk edycji w kolumnie akcji, historia sprzętu
na `DataTable` (kolumny Data / Gdzie trafił / Inwestycja / Notatka / Wpisał / Koszt + stopka z sumą
kosztów), `createdBy` na `equipment-events` + migracja `20260904_0`, inwestycja przeniesiona ze
zdarzenia na listę i kartę, filtr statusu, nowe pole magazynu + `createWarehouseAction`.

Step 0.5 (przejście w przeglądarce) — **pominięty** ze stałej zasady użytkownika (żadnego
Playwrighta / `test:e2e` bez wyraźnej prośby w danej turze).

## Findings — druga tura

<!-- Format: [box] · [severity, tylko checki szukające bugów] · dispozycja · `źródło` · `plik:linia` · co — dlaczego -->

- [x] 🟡 WARNING · fixed · impl-review · `src/lib/queries/equipment.ts:60` · klucz `equipment-dataset-v1` nie podbity mimo poszerzenia wiersza o `investmentName` — wpis zapisany pod starym kształtem to nadal poprawny JSON, więc po deployu lista serwowałaby „—" w kolumnie Inwestycja do najbliższego zapisu; podbity na `-v2`
      test: brak testu automatycznego · — · reguła jest komentarzem nad kluczem, nie kodem; test na literał klucza pilnowałby implementacji, nie zachowania
- [x] 🟡 WARNING · fixed · code-review · `src/components/forms/form-fields/warehouse-field.tsx:32` · Enter zapisywał magazyn bez sprawdzenia `saving` (przycisk sprawdzał) — dwa szybkie Entery to dwie akcje, druga wpada w unikalny indeks z generycznym toastem; guard wyrównany do przycisku
      test: brak testu automatycznego · — · double-submit w handlerze klawiatury, próg wejścia (RTL + transition) wyższy niż wartość
- [x] 🟡 WARNING · dropped · code-review · `src/lib/actions/warehouses.ts:25` · read-then-write w guardzie case-insensitive: dwa równoczesne zapisy „Kwiatowa"/„kwiatowa" oba przechodzą, bo indeks unikalny jest case-sensitive — domknięcie wymaga migracji z indeksem na `lower(name)` i kroku produkcyjnego; przy pięciu użytkownikach i słowniku na kilka pozycji to nie jest warte drugiej migracji, a skutek naprawia się w `/admin`
      test: TDD · integration — reguła sama (nie wyścig) obudowana `src/__tests__/lib/actions/warehouses.db.test.ts`, asercja na TABELI
- [x] 🟡 fixed · impl-review · `src/hooks/equipment/validate.ts:55` · „inwestycja tylko pod pracownikiem" żyła wyłącznie w UI — hook zerował `cost` bez serwisu, ale nie `investment` bez pracownika, więc zapis z `/admin` robił „sprzęt w magazynie na inwestycji X"; wyniesione do hooka po decyzji właściciela (`if (holder === undefined && 'investment' in d) d.investment = null`)
      test: TDD · integration — dwa testy w `hooks/equipment/target-invariant.db.test.ts` (zrzuca inwestycję przy celu innym niż pracownik / zachowuje ją przy przekazaniu osobie), asercja na PERSISTED ROW; **jeszcze nie wykonane** — kontener `db-test` na 5435 przyjmuje TCP, ale backend Postgresa nie odpowiada (psql wisi), a `docker` CLI też wisi → wymaga restartu Docker Desktop
      test: TDD · integration — razem z ewentualnym niezmiennikiem, na wierszu w bazie
- [x] 🟡 fixed · impl-review · `change.md` · dwie cofnięte decyzje (rozbicie „u kogo" na dwie kolumny, zakładanie magazynu z formularza) i cały dołożony zakres nie były nigdzie zapisane — dopisana sekcja „Korekty po drugiej turze bramki"
- [x] 🟡 fixed · impl-review · `change.md` · plan mówi o JEDNEJ migracji addytywnej; `20260904_0_equipment_event_author` jest drugą — zapisane, że na produkcji idą dwie, przed pushem
- [x] 🔵 fixed · impl-review · `src/components/equipment/equipment-history.tsx:6` · sprzęt importował `sumKnown` z `@/lib/fleet/costs` — drugi konsument z innej domeny to próg promocji, którego pierwsza tura użyła dla `days.ts`; przeniesione do `src/lib/utils/sum-known.ts` wraz ze specyfikacją
- [x] 🔵 fixed · code-review · `src/lib/equipment/types.ts:40` · `investmentId` mapowane i typowane, nieczytane przez nikogo (kolumna czyta `investmentName`) — martwe pole zdjęte z kształtu wiersza, typecheck zielony
- [x] 🔵 fixed · code-review · `src/lib/actions/warehouses.ts:7` · nazwa magazynu bez `.max()` — dodany limit 120 znaków
- [x] 🔵 fixed · struktura · `src/components/tables/equipment.tsx:12`, `equipment-data-table.tsx:20` · dwa osobne `import type` z tego samego modułu — scalone
- [x] 🔵 dismissed · code-review · `src/app/(frontend)/sprzet/[id]/page.tsx:28` · „detal odpala całe zapytanie listy dla samych magazynów" — `fetchEquipmentOverview` idzie przez `unstable_cache`, więc detal trafia w ten sam wpis co lista; koszt jest amortyzowany, nie per wejście
- [x] 🔵 dismissed · code-review · `src/collections/equipment-events.ts:96` · `createdBy` da się podmienić przez API (tylko `admin.readOnly`, brak `access`) — dokładnie taki kształt ma `transfers.updatedBy`; to przyjęta konwencja repo, nie luka tej zmiany
- [x] 🔵 dismissed · code-review · `src/collections/equipment-events.ts:102` · `attachments` zostaje zapisywalne, a aplikacja go nie czyta — pierwsza tura bramki świadomie zdjęła ścieżkę odczytu (załączniki wchodzą i czyta się je w `/admin`); to decyzja, nie regres
- [x] 🔵 dismissed · struktura · `src/components/forms/hooks/form-hooks.ts:35` · „`FormWithFieldT` do `form-api-of.ts`, żeby import typu nie ciągnął grafu komponentów" — `form-api-of.ts` sam importuje `form-hooks`, więc przeniesienie nic nie odcina
- [x] 🔵 dropped · code-review · `src/lib/equipment/target-invariant.ts:17` · `holder: 0` przechodzi jako nazwany cel (`0 ?? undefined` to `0`) — sprzed tej tury, z formularzy nieosiągalne (pusty string blokuje wcześniej)
- [x] 🔵 dropped · impl-review · `src/lib/equipment/rows.ts:92` · `locatedAt`/`occurredAt` przez `isoOrNull`, a nie `dayOrNull` jak daty zakupu i gwarancji — dziś bez skutku (oba idą do `formatPLDate`, ta sama doba warszawska), a `occurredAt` jest kluczem sortowania historii
- [x] 🔵 dropped · struktura · `src/components/forms/form-fields/equipment-target-field.tsx` · nazwa pliku w liczbie pojedynczej przy dwóch eksportach w mnogiej — plik przeniesiono i przemianowano w pierwszej turze; druga zmiana nazwy to sam churn
- [x] 🔵 dropped · struktura · `src/components/forms/form-fields/index.ts` · barrel eksportuje 8 z 14 plików — jest realnie używany przez sześć formularzy, ale pola sprzętu i tak importują ścieżką; domykanie go to zmiana konwencji całego katalogu, nie tej zmiany
- [x] 🔵 dropped · struktura · `src/hooks/reset-bookkeeping.ts`, `src/lib/utils/days.ts` · placement hooków Payloada w korzeniu `src/hooks/` i rozpuszczenie `lib/dates/` w `lib/utils/` — jedno i drugie to wynik PIERWSZEJ tury; poza zakresem drugiej i nie wracam do zamkniętej decyzji
- [x] fixed · comment-noise · `src/lib/db/equipment.ts:46,60,78,118`, `rows.ts:96,100`, `types.ts:48`, `actions/equipment.ts:72` · nagłówki powtarzające nazwę symbolu skasowane, narracyjne leady przycięte do samego „dlaczego"; zduplikowany fakt domenowy o braku pary wydanie/zwrot został tylko w kolekcji
- [x] dismissed · comment-noise · 8 komentarzy oflagowanych jako graniczne — każdy niesie realne „dlaczego" (pułapki sterownika, sargowalność, składanie opcji filtra); zostają
- [x] fixed · impl-review · `src/__tests__/lib/actions/warehouses.db.test.ts` · reguła „jeden magazyn na jedno miejsce" nie miała żadnego testu — dopisany spec integracyjny, asercja na wierszach w tabeli
      test: TDD · integration — zielony na bazie 5435

## Simplify pass — druga tura

Nie odpalałem osobnego `/simplify`: fan-out zwrócił findingi cleanupowe wprost (dedup `sumKnown`,
martwe `investmentId`, zduplikowane importy, szum komentarzowy) i wszystkie są zastosowane powyżej.

## Tests & suite — druga tura

- `pnpm typecheck` — zielony
- `pnpm exec vitest run` (sprzęt, flota/costs, sum-known, where-filter-options) — 59 zielonych
- `src/__tests__/lib/actions/warehouses.db.test.ts` przeciwko 5435 — 2 zielone
- `pnpm test:e2e` — NIE uruchamiany (stała zasada użytkownika)
