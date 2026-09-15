# Review-gate ledger — EX-758 katalog-sprzetu · 2026-09-03

Zakres: `d68eedea..bfeb15f5` (etapy 1–6) plus niezacommitowany `manual-checks.md`.
Krok 0.5 (przebieg weryfikacyjny w przeglądarce) **pominięty** — użytkownik ma stałą regułę: nie
uruchamiać Playwrighta ani `test:e2e` bez wyraźnej prośby w danej turze. Ręczne checki są spisane
w `context/foundation/manual-checks.md` § EX-758 i blokują `Done`.

Fan-out: `/10x-impl-review`, `/code-review`, `comment-noise-audit`, structure+cohesion,
reuse-scan + `tailwind-v4-audit`.

## Findings

**Przycięte przy archiwizacji (2026-09-15).** Zdjęte **37 findingów `fixed`** — trwałym zapisem
naprawy jest commit, który ją wprowadził, a nie linijka w ledgerze. Zostaje to, czego git nie
trzyma: decyzja, żeby czegoś NIE robić. Stan przed przycięciem: **37 fixed, 13 dismissed,
13 dropped, 1 skipped, 1 filed (EX-771) · 0 otwartych.**

<!-- [box] · [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — why -->

### Poprawność (impl-review / code-review — z natywną severity)

- [x] 🟡 WARNING · dropped · code-review · `src/lib/db/notifications.ts:128` · moment wejścia w okno (`warranty_until - 30 dni`) to północ **UTC**, a listing liczy okno od północy **warszawskiej** — te same 1–2 h rozjazdu ma bliźniak floty (`countUnreadFleetDeadlines`). Zasięg: badge inkrementuje się o dwie godziny za wcześnie, i tylko dla użytkownika, którego ostatnia wizyta wypadła w tym paśmie. Naprawa oznacza edycję wysłanego SQL-a floty dla zera widocznej różnicy
- [x] 🔵 OBSERVATION · dropped · impl-review · `src/components/equipment/where-filter-options.ts:42` · opcja „nieznane" pokazuje się tylko dla żywych sztuk, ale wybranie jej listowało też wycofane. Wartość wiersza zgadza się teraz z opcją (`WHERE_RETIRED`), sama asymetria alarmu jest zamierzona
- [x] 🔵 OBSERVATION · dismissed · impl-review · `context/reference/preview-verification-accounts.md` · przeformatowanie prettierem cudzego dokumentu w zakresie commitów — nie moja zmiana treści, zero skutku

### Struktura i reuse (bez severity)

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

- [x] 🟡 WARNING · dropped · code-review · `src/lib/actions/warehouses.ts:25` · read-then-write w guardzie case-insensitive: dwa równoczesne zapisy „Kwiatowa"/„kwiatowa" oba przechodzą, bo indeks unikalny jest case-sensitive — domknięcie wymaga migracji z indeksem na `lower(name)` i kroku produkcyjnego; przy pięciu użytkownikach i słowniku na kilka pozycji to nie jest warte drugiej migracji, a skutek naprawia się w `/admin`
      test: TDD · integration — reguła sama (nie wyścig) obudowana `src/__tests__/lib/actions/warehouses.db.test.ts`, asercja na TABELI
- [x] 🔵 dismissed · code-review · `src/app/(frontend)/sprzet/[id]/page.tsx:28` · „detal odpala całe zapytanie listy dla samych magazynów" — `fetchEquipmentOverview` idzie przez `unstable_cache`, więc detal trafia w ten sam wpis co lista; koszt jest amortyzowany, nie per wejście
- [x] 🔵 dismissed · code-review · `src/collections/equipment-events.ts:96` · `createdBy` da się podmienić przez API (tylko `admin.readOnly`, brak `access`) — dokładnie taki kształt ma `transfers.updatedBy`; to przyjęta konwencja repo, nie luka tej zmiany
- [x] 🔵 dismissed · code-review · `src/collections/equipment-events.ts:102` · `attachments` zostaje zapisywalne, a aplikacja go nie czyta — pierwsza tura bramki świadomie zdjęła ścieżkę odczytu (załączniki wchodzą i czyta się je w `/admin`); to decyzja, nie regres
- [x] 🔵 dismissed · struktura · `src/components/forms/hooks/form-hooks.ts:35` · „`FormWithFieldT` do `form-api-of.ts`, żeby import typu nie ciągnął grafu komponentów" — `form-api-of.ts` sam importuje `form-hooks`, więc przeniesienie nic nie odcina
- [x] 🔵 dropped · code-review · `src/lib/equipment/target-invariant.ts:17` · `holder: 0` przechodzi jako nazwany cel (`0 ?? undefined` to `0`) — sprzed tej tury, z formularzy nieosiągalne (pusty string blokuje wcześniej)
- [x] 🔵 dropped · impl-review · `src/lib/equipment/rows.ts:92` · `locatedAt`/`occurredAt` przez `isoOrNull`, a nie `dayOrNull` jak daty zakupu i gwarancji — dziś bez skutku (oba idą do `formatPLDate`, ta sama doba warszawska), a `occurredAt` jest kluczem sortowania historii
- [x] 🔵 dropped · struktura · `src/components/forms/form-fields/equipment-target-field.tsx` · nazwa pliku w liczbie pojedynczej przy dwóch eksportach w mnogiej — plik przeniesiono i przemianowano w pierwszej turze; druga zmiana nazwy to sam churn
- [x] 🔵 dropped · struktura · `src/components/forms/form-fields/index.ts` · barrel eksportuje 8 z 14 plików — jest realnie używany przez sześć formularzy, ale pola sprzętu i tak importują ścieżką; domykanie go to zmiana konwencji całego katalogu, nie tej zmiany
- [x] 🔵 dropped · struktura · `src/hooks/reset-bookkeeping.ts`, `src/lib/utils/days.ts` · placement hooków Payloada w korzeniu `src/hooks/` i rozpuszczenie `lib/dates/` w `lib/utils/` — jedno i drugie to wynik PIERWSZEJ tury; poza zakresem drugiej i nie wracam do zamkniętej decyzji
- [x] dismissed · comment-noise · 8 komentarzy oflagowanych jako graniczne — każdy niesie realne „dlaczego" (pułapki sterownika, sargowalność, składanie opcji filtra); zostają

## Simplify pass — druga tura

Nie odpalałem osobnego `/simplify`: fan-out zwrócił findingi cleanupowe wprost (dedup `sumKnown`,
martwe `investmentId`, zduplikowane importy, szum komentarzowy) i wszystkie są zastosowane powyżej.

## Tests & suite — druga tura

- `pnpm typecheck` — zielony
- `pnpm exec vitest run` (sprzęt, flota/costs, sum-known, where-filter-options) — 59 zielonych
- `src/__tests__/lib/actions/warehouses.db.test.ts` przeciwko 5435 — 2 zielone
- `pnpm test:e2e` — NIE uruchamiany (stała zasada użytkownika)
