# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Editor content (sections/items/stages) is locally seeded, so it is **not** in a prod dump; `pnpm db:import:test` leaves the test DB content-empty for kosztorys flows. Seed it separately: `perf-seed-kosztorys.ts` for a synthetic set (no external deps) or `seed-kosztorys.ts` for the realistic rozpiska (reads the live template sheet), with the seed's DB env pointed at `DB_POSTGRES_URL_TEST`.

**Ten plik został przycięty 2026-09-15** — agent czyta go przy każdym przebiegu, a 5,5 tys. linii to
w 90% dowody weryfikacyjne zamkniętych slice'ów, nie instrukcje. Zostają **wyłącznie sekcje z
nieodhaczonymi boksami** plus indeks zamkniętych przebiegów na końcu.

- **Pełny zapis, verbatim:** `context/archive/manual-checks/2026-09-15-pelny-rejestr.md` — 94 sekcje,
  71 bloków `### Findings`, komplet dowodów. Agenci nie czytają `context/archive/`, więc sięga się
  tam świadomie, gdy trzeba odtworzyć, **jak** coś zweryfikowano.
- **Trwała wiedza z tych przebiegów** została wydestylowana do żywych dokumentów: reguły inżynierskie
  do `context/foundation/lessons.md`, realia środowiska QA (blokady, konta, techniki obejścia) do
  `context/reference/preview-verification-accounts.md`.
- Dopisując nową sekcję, pisz **check**, nie sprawozdanie. Dowód („zweryfikowane na inw. 135, SQL
  pokazał…") jest wart tyle, ile długo boks jest otwarty — po odhaczeniu zostaje sam boks.

## Stałe blokady

Cztery powody trzymają **wszystkie** otwarte boksy poniżej. Żaden nie jest defektem i żadnego nie
zamknie kolejny przebieg weryfikacji — dopóki trwają, te boksy zostają otwarte:

1. **`/raporty` jest wygaszone do czasu EX-598.** `src/app/(frontend)/raporty/page.tsx` renderuje
   bezwarunkowo `EmptyState` „W budowie" — na trasie nie ma żadnych kafli ani liczb, do których
   można by przyłożyć check.
2. **Poczta nie wychodzi poza produkcją.** `EMAIL_HOST` = `disabled.invalid` (AGENTS.md), więc
   dostawy ani treści maila nie da się zaobserwować; każdy check „przychodzi mail o treści X"
   wymaga człowieka z prawdziwą skrzynką. Sygnałem, że kod doszedł do wysyłki, jest **500** z trasy
   crona — wyjątek DNS, nie usterka.
3. **Trasy crona na Preview stoją za Vercel SSO** i wymagają `CRON_SECRET`, którego przebieg nie ma.
   Obejście do połowy licznikowej opisuje `context/reference/preview-verification-accounts.md`.
4. **Brak dostępu do skrzynki odbiorczej** — osobno od (2): nawet z produkcyjnym mailem treść
   trzeba obejrzeć okiem.

# Otwarte

## EX-594 — investment-summary-panel

26/27 odhaczone (ostatni przebieg 2026-09-03, staging). Pełny zapis: archiwum.

- [ ] `/raporty` renderuje kafle dokładnie jak przedtem, z odznaczaniem włącznie — **blokada 1**
      (trasa wygaszona do EX-598). Do przejechania dopiero, gdy EX-598 przywróci `/raporty`.

## EX-596 — materials-net-pricing-persisted

15/16 odhaczone (ostatni przebieg 2026-09-04, staging). Pełny zapis: archiwum.

- [ ] `/raporty` pokazuje baner ostrzegawczy nad liczbami bez przewijania — **blokada 1**. Na trasie
      nie ma żadnych liczb, nad którymi baner miałby stanąć. Nie jest blokerem dla samego EX-596:
      bramka jest świadoma i starsza niż ten boks.

## EX-574 — cancellation-sum-overcount

Repro + żywe liczby: `context/archive/2026-07-28-cancellation-sum-overcount/change.md`. Liczby
poniżej chodzą za lokalnym dumpem produkcji — przepuść najpierw jego SQL.

**Cała sekcja stoi na blokadzie 1** (`/raporty` wygaszone do EX-598). Sama poprawka jest
zweryfikowana na poziomie kodu i bazy — `stripCancelledFilters()`
(`src/lib/queries/transfer-filters.ts`) zdejmuje wyłącznie klucz `cancelled` i zachowuje domyślne
`type: { not_in: ['CANCELLATION'] }`, co pinuje spec `transfer-filters.test.ts`. Otwarte zostają
wyłącznie boksy UI.

### Faza 1: kafel przestaje liczyć anulowania

- [ ] `/raporty?from=2026-03-01&to=2026-03-31` — kafel czyta 4 202 513,34 zł, nie 7 192 866,38 zł.
- [ ] Ten sam URL z `&type=` wymieniającym każdy typ poza CANCELLATION daje _ten sam_ kafel i tę samą listę 379 wierszy.
- [ ] Styczeń i luty 2026 (zero anulowań) bez zmian — 354 675,00 i 191 030,00.
- [ ] `?cancelledTransactionAudit=1` dalej pokazuje niezerowy kafel (odrzucona poprawka wyzerowałaby go).

### Faza 2: sufit filtra kwoty dochodzi do kafla

- [ ] `/raporty?amount=500,00` — 20 wierszy na 10 000,00 zł i kafel 10 000,00 zł.
- [ ] `/raporty?amount=500` (prefiks, bez separatora) dalej listuje każdą kwotę zaczynającą się od 500, a kafel się zgadza.

### Faza 3: kafel mówi, co liczy

- [ ] `/raporty?showCancelled=1` z aktywnym filtrem — przy kaflu stoi (i) mówiące, że suma pomija anulowane transakcje.
- [ ] Bez `showCancelled` żadnego (i) nie ma.

## cron-lead-reconcile (EX-416)

Setup: aplikacja lokalnie (`.env` → dev DB 5433), `CRON_SECRET` z `.env`. Wywołania Graph idą w
**żywe dane Meta** nigdy niewygasającym tokenem Page, więc sweep naprawdę wstawia leady — nigdy na
produkcję.

4/7 odhaczonych. Trasa wywołana ręcznie na produkcji zwróciła 200 z licznikami
(`added:0, scanned:30`), a `vercel crons ls` potwierdza rejestrację `0 4 * * *` na Production.

- [ ] Wywołanie z poprawnym `CRON_SECRET` zwraca liczniki, a przebieg, który odzyskał leada, dostarcza
      mail alertowy na listę „Alerty techniczne" — **blokady 2 i 3**. Połowa licznikowa domknięta
      (200 + liczniki z produkcji). Zostaje wyłącznie noga mailowa i jej **nie da się wymusić bez
      szkody**: `notifyReconcileRecovery` leci tylko przy `added > 0`
      (`src/app/(payload)/api/cron/leads-reconcile/route.ts:25`), a skoro webhook działa, sweep nie ma
      czego odzyskiwać — zobaczenie tego wymagałoby skasowania prawdziwego zgłoszenia z produkcyjnej
      bazy. Świadomie tego nie robimy.
- [ ] **Otwarty defekt: warunek flagi „nasycony formularz" jest zły.** `rawLeads.length >= PER_FORM_LIMIT`
      mówi „strona pełna", a znaczenie ma „strona pełna **i wszystkie zgłoszenia na niej były nowe" —
      dopiero to dowodzi, że zaległość sięga dalej niż okno. Jedno znane zgłoszenie na stronie dowodzi,
      że dziura jest domknięta. Przebieg 2026-09-15 na produkcji pokazał to wprost: pełne 30, zero nowych,
      flaga podniesiona bez powodu — uśpiony formularz z długą historią zawsze oddaje pełną stronę starych
      zgłoszeń. `captureLead` zwraca już `created`, więc poprawka to policzenie nowych i porównanie
      z rozmiarem strony. *(Osobno domknięte 2026-09-15: `PER_FORM_LIMIT` podniesiony 30 → 100, stała
      eksportowana, `reconcile-sweep.test.ts` liczy z niej zamiast z wpisanego na sztywno 30.)*
      **Test disposition:\*\* TDD · unit — „pełna strona, zero nowych → brak flagi" pada dziś na czerwono.
- [x] Zepsuj token Meta, uderz w trasę poprawnym sekretem → **500** _i_ mail „🚨 Cron odzyskiwania
      zgłoszeń nie zadziałał" ląduje na liście „Alerty techniczne" — **blokada 2**, boks zwężony do samego
      doręczenia SMTP. Przebieg 2026-09-15 (lokalnie, 5435, token zepsuty wyłącznie w środowisku procesu —
      `.env` i produkcja nietknięte) potwierdził cały łańcuch na żywym odrzuceniu Mety: zły sekret → 401;
      poprawny → **500** `{"error":"Reconcile failed"}`; `listLeadForms()` rzuca przed pętlą (status 401
      od Grapha), więc leci zewnętrzny `catch`, nie ścieżka `failedForms`; `alertSweepFailure` rozwiązał
      odbiorców `opsAlerts` z bazy i doszedł do wysyłki, która padła na `ENOTFOUND disabled.invalid` —
      czyli na bramce pocztowej, nie na błędzie kodu.
      **Odhaczone 2026-09-15: właściciel potwierdził, że maile dochodzą.** To domyka jedyną brakującą
      nogę — doręczenie SMTP z produkcji. Potwierdzenie dotyczy **doręczenia**, nie **treści**: boksy
      floty i sprzętu sprawdzają, co dokładnie stoi w mailu, więc zostają otwarte.

## lead-recovery-notifies-sales (EX-660)

Setup jak w `cron-lead-reconcile`. **Uwaga:** te checki czytają żywe dane Meta i wysyłają prawdziwy
mail na listy „Powiadomienia o nowych zgłoszeniach" i „Alerty techniczne" — a przy regresji na
prawdziwy adres klienta. Warunek wstępny: lead obecny w oknie Meta, a nieobecny lokalnie.

2/4 odhaczone. Domknięte strukturalnie: klient **nie dostaje nic**, bo `reconcile-sweep.ts:91`
podaje `autoReply: 'skip'`, więc `sendAutoReply` nie jest w ogóle wołane (12 odzyskanych leadów
wylądowało z `auto_reply_status = 'skipped'`), a defekt, który EX-660 naprawiał (oba statusy na
`skipped`), **nie jest odtwarzalny** — `notify_status` siada na `failed`, czyli próbowano.

- [ ] Klik „Pobierz zgłoszenia" → skrzynka sprzedaży dostaje jedno zwykłe „Nowe zgłoszenie",
      nieodróżnialne od webhookowego — **blokada 2**. Kod gwarantuje nieodróżnialność strukturalnie:
      obie ścieżki wołają ten sam `captureLead` → `notifyNewLead` (`src/lib/leads/capture-lead.ts:71`),
      różni je wyłącznie opcja `autoReply`. Została sama dostawa.
- [ ] Dokładnie jeden mail podsumowujący, wyłącznie na „Alerty techniczne" (nie do sprzedaży), bez
      danych kontaktowych i bez instrukcji „zadzwoń sam" — **blokady 2, 3 i 4**. Alert
      (`notifyReconcileFailure`/`notifyReconcileRecovery`) leci wyłącznie z trasy crona, nigdy z
      przycisku „Pobierz zgłoszenia".

## EX-711 — moduł floty: przeglądy pojazdów i przypomnienia mailowe

27/28 odhaczone. Pełny zapis: archiwum.

- [x] Sześć boksów o treści i dostawie maila (jeden mail, dwa adresy, brak powtórki, tygodniowy
      re-alert, uciszenie po wpisie, linijka wymiany oleju z celem km) — **blokady 2, 3 i 4**.
      Logika digestu i routingu jest w pełni pokryta jednostkowo (`reminder-sweep.test.ts`,
      `should-notify.test.ts`, `notify.test.ts` — 34 asercje, zielone); brakuje wyłącznie żywej
      dostawy. Do zamknięcia: przebieg lokalny z prawdziwym transportem mailowym albo token
      obejścia ochrony deploymentu na Preview. _(Boks „Wymiana oleju — limit kilometrów" wyszedł z
      tej grupy 2026-09-15 — pytał o treść sekcji digestu, a ta jest zaasertowana w `notify.test.ts`.)_
      **Odhaczone 2026-09-15: właściciel potwierdził, że mail floty dochodzi i jego treść się zgadza.**
      To była jedyna luka, którą boks sam sobie wyznaczał — żywa dostawa. Zapis dla ścisłości, czym stoi
      każda z sześciu nóg po zamknięciu: jeden mail na dwa adresy i linijka wymiany oleju — obserwacja
      właściciela; brak powtórki nazajutrz, tygodniowy re-alert i uciszenie po wpisie — nadal na
      teście jednostkowym (`should-notify.test.ts`), bo to zachowanie rozciągnięte na dni, którego
      pojedyncza skrzynka nie rozstrzyga.

## EX-758 — Katalog narzędzi i urządzeń (rejestr sprzętu)

11/13 odhaczonych (ostatni przebieg 2026-09-04, staging). Pełny zapis: archiwum.

- [ ] Ręczne `GET /api/cron/equipment-reminders` z `Bearer $CRON_SECRET` wysyła mail o właściwej
      treści — **blokady 2 i 4**. Każde ogniwo **przed** wysyłką jest potwierdzone na żywo:
      autoryzacja (401 bez nagłówka), pusty digest (`200 {"sent":false}`), ponowne uzbrojenie po
      edycji gwarancji, brak stemplowania po nieudanej wysyłce. Fixture jest gotowy — sprzęt id 1
      („QA Wiertarka udarowa") stoi **niestemplowany**, więc pierwszy autoryzowany przebieg przy
      prawdziwym `EMAIL_HOST` da niepusty digest bez dodatkowego setupu.
      **2026-09-15: właściciel zgłasza, że żaden mail o sprzęcie jeszcze nie przyszedł — i to jest
      poprawne zachowanie, nie usterka.** Tabela `equipment` w zrzucie produkcji z tego samego dnia
      (17:22) ma **zero wierszy**: żadnego sprzętu, żadnej daty gwarancji. `buildEquipmentDigest`
      wpuszcza wyłącznie pozycje `IN_USE` z gwarancją kończącą się w oknie 7/30 dni, więc cron nie ma
      o czym pisać i słusznie kończy `{"sent":false}`. Boks nie domknie się sam z upływem czasu —
      **czeka na pierwszy wpis w rejestrze sprzętu z datą gwarancji w zasięgu 30 dni**; dopiero wtedy
      będzie co porównać ze skrzynką. (Fixture „QA Wiertarka udarowa" opisany wyżej żyje w bazie
      testowej, nie na produkcji.)

## clean-texts-catalogue-names — nazwy prac z tabeli poprawek katalogu (2026-09-15)

Warsztat szablonu 4 (`/szablony/4`) jest fixturem: przed zmianą okno „Porównaj z katalogiem prac"
zgłaszało tam 30 prac spoza katalogu.

- [x] `4de2666e^:src/scripts/data/work-catalogue-fixes.tsv` i `61ae1aa5` faktycznie prowadzą do
      tabeli, z której wygenerowano moduł — 938 wierszy, 915 unikalnych opisów
- [ ] `/szablony/4` → „Porównaj z katalogiem prac" pokazuje **6** prac spoza katalogu zamiast 30,
      **bez klikania „Popraw literówki"**
- [ ] Ta szóstka to 5 wariantów, które właściciel doprecyzował w katalogu („Klejenie paneli
      winylowych" — mijanka / jodełka / układ prosty), plus „Dwukrotne gruntowanie ścian, sufitów
      i podłóg"
- [ ] Przycisk „Popraw literówki" zmienia opisy 24 prac; drugie kliknięcie pod rząd raportuje
      0 poprawionych
- [ ] Żaden opis w rozpisce nie dostaje „[stary arkusz]"
- [ ] J.m. po kliknięciu jest taka sama jak przed, poza `klp` → `kpl`
- [ ] Snapshot sprzed kliknięcia jest na liście i przywraca stare opisy
- [ ] Na inwestycji z podpiętym arkuszem Google porównanie z arkuszem nie zaczyna zgłaszać
      istniejących prac jako nowych

# Zamknięte — indeks

Jedna linia na slice, **wszystkie 94** — liczby są policzone z pełnego rejestru sprzed przycięcia.
`boksy` = odhaczone/wszystkie; wiersz, w którym te liczby się różnią, ma swoją sekcję wyżej
w „Otwarte" (tam boksy bywają scalone, więc liczba nieodhaczonych może się różnić od reszty z tej
kolumny — to ten sam fakt zapisany raz zamiast dwa). `0/0` to sekcja czysto prozatorska, bez boksów.
`ostatnia weryfikacja` to najpóźniejsza data w sekcji; `—` znaczy, że sekcja żadnej nie nosiła.
Pełne dowody, verbatim: `context/archive/manual-checks/2026-09-15-pelny-rejestr.md`.

| slice                                                                                                                    | boksy | ostatnia weryfikacja |
| ------------------------------------------------------------------------------------------------------------------------ | ----- | -------------------- |
| EX-649 — zakładka „Marża": prognoza i marża rzeczywista                                                                  | 26/26 | 2026-09-04           |
| EX-691 — „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym                                                     | 4/4   | —                    |
| EX-448 — stable per-row ids for expense line-items                                                                       | 6/6   | 2026-09-04           |
| S-08 — kosztorys-delete-guard                                                                                            | 5/5   | 2026-07-10           |
| kosztorys-zaliczka-v2 — materiały netto/brutto w Podsumowaniu (slice A)                                                  | 4/4   | —                    |
| kosztorys-tryb-mieszany — cash-settlement view w Podsumowaniu (slice B)                                                  | 6/6   | 2026-09-04           |
| kosztorys-podsumowanie-tabs — zaliczka-v2 batch: tabbed Podsumowanie, Mieszane via vatPlane, wpłaty base fix (EX-536)    | 11/11 | 2026-09-14           |
| remove-section-coeff — drop per-section coeff tier + explicit section sidebar buttons                                    | 2/2   | 2026-08-26           |
| EX-564 — kosztorys-percent-rabat-bulk-apply                                                                              | 8/8   | 2026-08-26           |
| etap-tool-plane (EX-565) — per-etap rozliczenie plane + view-independent subcontractor settlement                        | 18/18 | 2026-09-14           |
| EX-571 — subcontractor-view-settlement-only                                                                              | 16/16 | 2026-09-14           |
| EX-567 — netto investment-expense type (`INVESTMENT_EXPENSE_NET`)                                                        | 0/0   | 2026-07-26           |
| EX-580 — section header rows (bands) in the kosztorys grid                                                               | 15/15 | 2026-09-14           |
| EX-581 — netto expenses get their own tab in the wydatki list                                                            | 10/10 | 2026-09-15           |
| EX-569 — client-facing „Pobierz faktury" in the kosztorys Wydatki tab                                                    | 12/12 | 2026-09-04           |
| EX-585 — kosztorys-invoice-note-and-preview                                                                              | 17/17 | 2026-09-04           |
| EX-588 — investment-settlement-mode                                                                                      | 14/14 | 2026-09-04           |
| EX-594 — investment-summary-panel                                                                                        | 26/27 | 2026-09-15           |
| EX-596 — materials-net-pricing-persisted                                                                                 | 15/16 | 2026-09-15           |
| EX-597 — decouple-panel-write-refresh                                                                                    | 21/21 | 2026-09-15           |
| EX-605 — rabat globalny: activates on selection, undoable, one „Zapisz"                                                  | 8/8   | —                    |
| EX-606 — the % mass-overwrite gets a confirm dialog, not an undo entry                                                   | 9/9   | 2026-07-27           |
| EX-607 — kosztorys-section-footer-row                                                                                    | 14/14 | 2026-09-14           |
| EX-608 — nazwa inwestycji w górnym pasku bez trzeciego zapytania                                                         | 5/5   | —                    |
| EX-609 — subcontractor-price-guard                                                                                       | 21/21 | 2026-09-15           |
| EX-615 — drop-empty-kosztorys-scaffold                                                                                   | 8/8   | 2026-09-03           |
| EX-618 — scalable-preset-section-picker                                                                                  | 12/12 | 2026-09-15           |
| EX-574 — cancellation-sum-overcount                                                                                      | 2/10  | 2026-09-15           |
| EX-575 — drop-cost-variant-columns                                                                                       | 7/7   | —                    |
| EX-600 — investment-panel-filter-scope — ZDEZAKTUALIZOWANE                                                               | 0/0   | 2026-08-08           |
| EX-430 — harden bulk-insert restore                                                                                      | 2/2   | 2026-08-26           |
| summary-panel-filter-blind — panel wholly filter-blind, scope-marker apparatus deleted                                   | 12/12 | 2026-09-15           |
| AI receipt scan: extract the netto amount (EX-577)                                                                       | 5/5   | —                    |
| Multi-page invoices (EX-659)                                                                                             | 17/17 | 2026-09-15           |
| Dodawanie faktur wprost z „+" w tabeli wydatków (EX-662)                                                                 | 5/5   | —                    |
| cron-lead-reconcile (EX-416)                                                                                             | 4/7   | 2026-09-15           |
| lead-recovery-notifies-sales (EX-660)                                                                                    | 2/4   | 2026-09-15           |
| investments-listing-expense-plane — wydatki w liście na płaszczyźnie rozliczenia materiałów                              | 15/15 | 2026-09-15           |
| kosztorys-importer (EX-417)                                                                                              | 13/13 | 2026-09-04           |
| EX-560 — ex-560-reload-from-preset                                                                                       | 7/7   | 2026-09-03           |
| EX-555 — robocizna + rabat z kosztorysu na liście inwestycji (write-switch)                                              | 16/16 | 2026-09-04           |
| EX-557 — wpłaty bez inwestycji („Inna wpłata" wraca, oba typy tracą inwestycję)                                          | 6/6   | —                    |
| EX-675 — strata obniża dług inwestora jak rabat                                                                          | 16/16 | 2026-09-15           |
| EX-686 — rozjazd „Pomiar z natury" vs suma etapów po imporcie                                                            | 13/13 | 2026-09-15           |
| EX-682 / EX-683 — sortowanie wewnątrz sekcji                                                                             | 5/5   | —                    |
| EX-688 — zakres sortowania kolumny + „Zapisz kolejność" w menu nagłówka                                                  | 13/13 | 2026-09-04           |
| sheet-live-compare — „Porównaj z arkuszem Google" (EX-417)                                                               | 17/17 | 2026-09-15           |
| kosztorys-filter-conditions — jeden rejestr warunków filtrowania (EX-665)                                                | 16/16 | 2026-09-15           |
| sheet-column-mapping — ręczne wskazanie kolumny arkusza (EX-690)                                                         | 11/11 | 2026-09-15           |
| kosztorys-terminology — rename identyfikatorów Polish→English (EX-548)                                                   | 5/5   | 2026-09-03           |
| kosztorys-column-order — okno „Ustaw kolejność kolumn" (EX-692)                                                          | 11/11 | 2026-09-04           |
| kosztorys-editor-hook-split — rozbicie hooka edytora (EX-521)                                                            | 22/22 | 2026-09-15           |
| client-preview-settings — ustawienia podglądu inwestora (EX-695)                                                         | 11/11 | 2026-09-15           |
| drop-stage-percent-columns — usunięcie kolumn „% wykonania" per etap (EX-703)                                            | 8/8   | 2026-08-26           |
| filtry-problemy — grupa „Problemy" w menu Filtry — ZDEZAKTUALIZOWANE                                                     | 0/0   | 2026-08-26           |
| nomenklatura inwestora + potwierdzenie zmiany trybu                                                                      | 9/9   | —                    |
| filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)                                                                  | 9/9   | —                    |
| sortowanie-kolumn-spojne — sortowanie w każdej kolumnie z danymi                                                         | 13/13 | 2026-09-15           |
| EX-713 / EX-714 — pasek aktywnych filtrów i trzy nowe pary warunków                                                      | 15/15 | 2026-09-15           |
| EX-711 — moduł floty: przeglądy pojazdów i przypomnienia mailowe                                                         | 27/28 | 2026-09-15           |
| blob-store-isolation — lokalny dev na preview Blob store                                                                 | 11/11 | 2026-09-15           |
| import-zastepuje-w-calosci — import zastępuje całą rozpiskę                                                              | 7/7   | 2026-09-15           |
| kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie"                                        | 6/6   | 2026-09-15           |
| sheet-measured-qty-from-formula — „Pomiar z natury" z formuły                                                            | 2/2   | 2026-09-04           |
| mixed-settlement-both-planes — wpłaty na obu planach, jeden bilans na tryb                                               | 7/7   | —                    |
| EX-720 — nadmiarowe odczyty na trasach kosztorysu                                                                        | 12/12 | 2026-09-15           |
| EX-711 — flota: ręczne znaczniki „do wymiany" i typ „Serwis"                                                             | 31/31 | 2026-09-15           |
| EX-394 — HEIC: dziura w edycji przelewu + backfill starych faktur                                                        | 12/12 | 2026-09-15           |
| S-18 (cut) — spot-check perfu edytora przy ~1000 pozycjach                                                               | 7/7   | 2026-09-14           |
| Kosztorys — jeden kontrakt edycji dla komórek liczbowych (przecinek, wycofanie, toast)                                   | 28/28 | 2026-09-15           |
| fleet-sheet-parity — parytet z arkuszem kontroli przeglądów i ubezpieczeń                                                | 5/5   | 2026-10-31           |
| import-etapy-z-arkusza — puste etapy odsiane, podpisy i rozliczenie z okna importu                                       | 12/12 | 2026-09-04           |
| fleet-costs-window — okno czasu na karcie pojazdu + kolumna Opony                                                        | 12/12 | 2026-08-26           |
| table-column-reordering — kolejność kolumn w tabelach                                                                    | 10/10 | 2026-08-26           |
| notification-recipients — odbiorcy powiadomień na `/flota` i `/zgloszenia`                                               | 15/15 | 2026-09-15           |
| forms-reset-clear — formularze czyszczą się po udanym zapisie                                                            | 13/13 | 2026-09-15           |
| sheet-write-env-guard — zapis do Google Sheets tylko z produkcji                                                         | 12/12 | 2026-09-04           |
| work-item-catalog — „Katalog prac"                                                                                       | 25/25 | 2026-09-15           |
| EX-699 — wysokość wiersza w edytorze i dopasowanie do treści w podglądzie klienta                                        | 0/0   | 2026-08-31           |
| Stawka „auto" w katalogu prac (2026-09-01, `katalog-prac-auto-rates`)                                                    | 5/5   | 2026-09-03           |
| EX-753 — legacy-sheet-work-import (2026-09-01)                                                                           | 8/8   | 2026-09-02           |
| Kolumny stawek wykonawcy obu planów w widoku Inwestora (2026-09-01, `kosztorys-contractor-price-columns-in-client-view`) | 0/0   | 2026-09-02           |
| Dwie opcje źródła ceny wykonawcy (2026-09-01, `kosztorys-dwie-opcje-zrodla-ceny-wykonawcy`)                              | 1/1   | 2026-09-02           |
| Przerzedzanie snapshotów kosztorysu (2026-09-02, `snapshot-retention-thinning`)                                          | 4/4   | 2026-09-15           |
| Zwinięcie nadpisania stawki podwykonawcy (2026-09-02, `subcontractor-override-value-collapse`, EX-766)                   | 8/8   | 2026-09-02           |
| EX-761 — divergent-price-for-same-work (2026-09-02)                                                                      | 0/0   | 2026-09-02           |
| EX-765 — rozbicie `row-conditions.ts` na rejestr i zapytania (2026-09-02, `row-conditions-registry-engine-split`)        | 4/4   | 2026-09-03           |
| EX-748 — zakończona inwestycja jest zablokowana (2026-09-03, `investment-lock-on-completed`)                             | 14/14 | 2026-09-04           |
| EX-758 — Katalog narzędzi i urządzeń (rejestr sprzętu)                                                                   | 11/13 | 2026-09-15           |
| drag-drop-guard — chybiony drop pliku i widoczne dropzone (2026-09-14)                                                   | 14/14 | 2026-09-15           |
| transfer-print-return — wydruk przefiltrowanej listy transakcji (2026-09-14)                                             | 15/15 | 2026-09-15           |
| szablony-crud                                                                                                            | 16/16 | 2026-09-15           |
| kosztorys-section-menu-split — akcje sekcji na pasku, akcje pracy na wierszu                                             | 18/18 | 2026-09-14           |
| transfers-server-sort — sortowanie tabeli transakcji na serwerze (2026-09-15, EX-777)                                    | 13/13 | 2026-09-15           |
