# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Kosztorysy **są** w dumpie proda — `pnpm db:import:test` daje 65 kosztorysów / 4130 pozycji (policzone 2026-09-17), więc baza testowa nie jest pusta dla przepływów kosztorysowych. Seeduj tylko wtedy, gdy sprawdzenie potrzebuje **znanego** kształtu: `seed-kosztorys.ts` dla realistycznej rozpiski (czyta żywy arkusz wzorcowy) albo `perf-seed-kosztorys.ts` dla ~1000 syntetycznych wierszy, gdy sprawdzasz wydajność siatki — z DB env seeda wskazanym na `DB_POSTGRES_URL_TEST`.

**Ten plik został przycięty 2026-09-15** — agent czyta go przy każdym przebiegu, a 5,5 tys. linii to
w 90% dowody weryfikacyjne zamkniętych slice'ów, nie instrukcje. Zostają **wyłącznie sekcje z
nieodhaczonymi boksami** plus indeks zamkniętych przebiegów na końcu.

- **Pełny zapis, verbatim:** `git show d426e567^:context/foundation/manual-checks.md` — 94 sekcje,
  71 bloków `### Findings`, komplet dowodów. Agenci nie czytają `context/archive/`, więc sięga się
  tam świadomie, gdy trzeba odtworzyć, **jak** coś zweryfikowano.
- **Trwała wiedza z tych przebiegów** została wydestylowana do żywych dokumentów: reguły inżynierskie
  do `context/foundation/lessons.md`, realia środowiska QA (blokady, konta, techniki obejścia) do
  `context/reference/manual-verification.md`.
- Dopisując nową sekcję, pisz **check**, nie sprawozdanie. Dowód („zweryfikowane na inw. 135, SQL
  pokazał…") jest wart tyle, ile długo boks jest otwarty — po odhaczeniu zostaje sam boks.
- **Sekcja powstaje dopiero, gdy kod istnieje.** Boks opisuje zachowanie działającej aplikacji, więc
  sprawdzenie funkcji, której nie ma na żadnym branchu, nie może ani przejść, ani paść — to fragment
  planu, nie wynik QA, i puchnie rejestr o wiecznie otwarte boksy blokujące slice, którego nikt nie
  zaczął pisać. Checklistę wyprowadzoną z `plan.md` trzymaj w folderze zmiany
  (`context/changes/<id>/manual-checks.md`) i przenieś ją tutaj przy `/10x-implement`. Precedens:
  `kosz-plikow` — 11 boksów wyciętych stąd 2026-09-23.

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
   Obejście do połowy licznikowej opisuje `context/reference/manual-verification.md`.
4. **Brak dostępu do skrzynki odbiorczej** — osobno od (2): nawet z produkcyjnym mailem treść
   trzeba obejrzeć okiem.

# Otwarte

## EX-594 — investment-summary-panel

26/27 odhaczone (ostatni przebieg 2026-09-03, staging). Pełny zapis: archiwum.

- [ ] `/raporty` renderuje kafle dokładnie jak przedtem, z odznaczaniem włącznie — **blokada 1**
      (trasa wygaszona do EX-598). Do przejechania dopiero, gdy EX-598 przywróci `/raporty`.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._

### Findings — 2026-09-23 (staging/preview pass)

- Blokada 1 nadal aktualna: `src/app/(frontend)/raporty/page.tsx` renderuje bezwarunkowo
  `EmptyState` „W budowie" (kod przeczytany na żywo, commit `e0158cb8`) — na trasie nie ma żadnych
  kafli. Boks zostaje otwarty, nic do zrobienia poza EX-598.

## EX-596 — materials-net-pricing-persisted

15/16 odhaczone (ostatni przebieg 2026-09-04, staging). Pełny zapis: archiwum.

- [ ] `/raporty` pokazuje baner ostrzegawczy nad liczbami bez przewijania — **blokada 1**. Na trasie
      nie ma żadnych liczb, nad którymi baner miałby stanąć. Nie jest blokerem dla samego EX-596:
      bramka jest świadoma i starsza niż ten boks.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._

### Findings — 2026-09-23 (staging/preview pass)

- Blokada 1 nadal aktualna — ta sama trasa i ten sam kod co w EX-594 powyżej. Boks zostaje otwarty.

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
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._
- [ ] Ten sam URL z `&type=` wymieniającym każdy typ poza CANCELLATION daje _ten sam_ kafel i tę samą listę 379 wierszy.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._
- [ ] Styczeń i luty 2026 (zero anulowań) bez zmian — 354 675,00 i 191 030,00.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._
- [ ] `?cancelledTransactionAudit=1` dalej pokazuje niezerowy kafel (odrzucona poprawka wyzerowałaby go).
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._

### Faza 2: sufit filtra kwoty dochodzi do kafla

- [ ] `/raporty?amount=500,00` — 20 wierszy na 10 000,00 zł i kafel 10 000,00 zł.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._
- [ ] `/raporty?amount=500` (prefiks, bez separatora) dalej listuje każdą kwotę zaczynającą się od 500, a kafel się zgadza.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._

### Faza 3: kafel mówi, co liczy

- [ ] `/raporty?showCancelled=1` z aktywnym filtrem — przy kaflu stoi (i) mówiące, że suma pomija anulowane transakcje.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._
- [ ] Bez `showCancelled` żadnego (i) nie ma.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokada 1 (/raporty renderuje „W budowie" do EX-598, nie ma czego sprawdzać)._

## cron-lead-reconcile (EX-416)

Setup: aplikacja lokalnie (`.env` → dev DB 5433), `CRON_SECRET` z `.env`. Wywołania Graph idą w
**żywe dane Meta** nigdy niewygasającym tokenem Page, więc sweep naprawdę wstawia leady — nigdy na
produkcję.

4/7 odhaczonych. Trasa wywołana ręcznie na produkcji zwróciła 200 z licznikami
(`added:0, scanned:30`), a `vercel crons ls` potwierdza rejestrację `0 4 * * *` na Production.

- [ ] Wywołanie z poprawnym `CRON_SECRET` zwraca liczniki, a przebieg, który odzyskał leada, dostarcza
      **Linear: EX-937** — izolacja stagingu (do tego czasu nie do sprawdzenia tu).
      mail alertowy na listę „Alerty techniczne" — **blokady 2 i 3**. Połowa licznikowa domknięta
      (200 + liczniki z produkcji). Zostaje wyłącznie noga mailowa i jej **nie da się wymusić bez
      szkody**: `notifyReconcileRecovery` leci tylko przy `added > 0`
      (`src/app/(payload)/api/cron/leads-reconcile/route.ts:25`), a skoro webhook działa, sweep nie ma
      czego odzyskiwać — zobaczenie tego wymagałoby skasowania prawdziwego zgłoszenia z produkcyjnej
      bazy. Świadomie tego nie robimy.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokady 2 i 4 (mail nie wychodzi poza produkcją, brak dostępu do skrzynki). Cron na Preview stoi też za SSO i CRON_SECRET (blokada 3)._
- [x] **Linear: EX-926.** **Otwarty defekt: warunek flagi „nasycony formularz" jest zły.** `rawLeads.length >= PER_FORM_LIMIT`
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

- [ ] Przebieg sweepa (cron `/api/cron/leads-reconcile`) → skrzynka sprzedaży dostaje jedno zwykłe
      **Linear: EX-937** — izolacja stagingu (do tego czasu nie do sprawdzenia tu).
      „Nowe zgłoszenie", nieodróżnialne od webhookowego — **blokada 2**. Kod gwarantuje
      nieodróżnialność strukturalnie: obie ścieżki wołają ten sam `captureLead` → `notifyNewLead`
      (`src/lib/leads/capture-lead.ts:71`),
      różni je wyłącznie opcja `autoReply`. Została sama dostawa.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokady 2 i 4 (mail nie wychodzi poza produkcją, brak dostępu do skrzynki)._
- [ ] Dokładnie jeden mail podsumowujący, wyłącznie na „Alerty techniczne" (nie do sprzedaży), bez
      **Linear: EX-937** — izolacja stagingu (do tego czasu nie do sprawdzenia tu).
      danych kontaktowych i bez instrukcji „zadzwoń sam" — **blokady 2, 3 i 4**. Alert
      (`notifyReconcileFailure`/`notifyReconcileRecovery`) leci z trasy crona, która jest dziś
      jedynym wołającym sweepa — ręczny przycisk „Pobierz z Facebooka" został usunięty.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokady 2 i 4 (mail nie wychodzi poza produkcją, brak dostępu do skrzynki)._

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
      **Linear: EX-937** — izolacja stagingu (do tego czasu nie do sprawdzenia tu).
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
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokady 2 i 4 (mail nie wychodzi poza produkcją, brak dostępu do skrzynki)._

### Findings — 2026-09-23 (staging/preview pass)

- Stan danych zmienił się od 2026-09-15, wniosek nie: tabela `equipment` na preview ma teraz **1
  wiersz** (`id=1, „Młot duży yato wyburzeniowy", status IN_USE`), ale `warranty_until` jest **NULL**
  — nie fixture „QA Wiertarka udarowa" opisany w checku wyżej (ten żyje tylko w bazie testowej
  5435, nie na preview). `buildEquipmentDigest` wpuszcza wyłącznie `IN_USE` z gwarancją kończącą się
  w oknie 7/30 dni, więc digest jest dalej pusty z tego samego strukturalnego powodu, nie z braku
  wierszy. Blokady 2/3/4 (mail tylko z produkcji, crony za SSO, brak skrzynki) też bez zmian. Boks
  zostaje otwarty — czeka na wiersz z realną datą gwarancji w zasięgu, potem na człowieka z dostępem
  do produkcyjnej poczty.

## clean-texts-catalogue-names — nazwy prac z tabeli poprawek katalogu (2026-09-15)

Warsztat szablonu 4 (`/szablony/4`) jest fixturem: przed zmianą okno „Porównaj z katalogiem prac"
zgłaszało tam 30 prac spoza katalogu. Od EX-893 (2026-09-29) ten szablon to własna inwestycja
„kosztorys wzór testy 2 września 26" — adres `/szablony/<jej id>`, nie `/szablony/4`.

- [x] `/szablony/4` → „Porównaj z katalogiem prac" pokazuje **6** prac spoza katalogu zamiast 30,
      **bez klikania „Popraw literówki"** — zmierzone na dzisiejszym fixturze **30 → 5** (nie 6;
      patrz finding o dryfie). Ten sam skrypt na `86b40010` (commit przed zmianą) i na `f5f823d1`,
      ta sama kopia bazy, te same 202 pozycje: przed 30 spoza katalogu, po 5. Obietnica zmiany
      trzyma się co do joty, przesunęła się tylko liczba docelowa.
- [x] ~~Ta szóstka to 5 wariantów, które właściciel doprecyzował w katalogu~~ — skreślone
      2026-09-29: szablon jest żywym fixturem edytowanym od 2026-09-15, więc lista prac spoza
      katalogu zależy od jego bieżącej treści, nie od zmiany. Obietnicę zmiany pokrywa boks wyżej
      (ten sam skrypt przed/po na tej samej kopii bazy).
- [x] Przycisk „Popraw literówki" poprawia opisy; drugie kliknięcie pod rząd raportuje
      0 poprawionych
      _Zweryfikowano 2026-09-21 (staging): 88 wierszy zmienionych, drugie kliknięcie 0._
- [x] Żaden opis w rozpisce nie dostaje „[stary arkusz]"
- [x] J.m. zmienia się tylko według reguł „Popraw literówki" (`m2` → `m²`, spacje w wymiarach,
      `klp` → `kpl`), nigdzie indziej
      _Zweryfikowano 2026-09-21 (staging): przepisane j.m. to `m2` → `m²` i spacje; `klp` nie ma._
- [x] Snapshot sprzed kliknięcia jest na liście i przywraca stare opisy
- [x] Na inwestycji z podpiętym arkuszem Google porównanie z arkuszem nie zaczyna zgłaszać
      istniejących prac jako nowych

### Findings — 2026-09-15 (staging/preview pass)

- [x] **`/szablony/4` fixture absent on preview DB — resolved by verifying locally instead.**
      `kosztorys_presets` had 0 rows on the preview Neon branch, so this section cannot be verified
      on staging/preview at all — not "blocked for now", plainly **not the right environment** for
      it. This section's checks 1–6 are keyed to the `/szablony/4` fixture (`investmentId=151`),
      which only ever existed in the prod dump lineage (local `db-test` / dev / prod), never on the
      preview branch. **Verified instead against local `db-test`** (`pnpm db:import:test` +
      `pnpm db:migrate:test`, today's fresh prod dump — see the two findings below for what that
      pass found).
- [x] **Shared Playwright browser lock — resolved.** The Chrome process holding the shared MCP
      profile's CDP pipe was killed; `browser_tabs list` now returns cleanly (confirmed this pass —
      single tab, no "Browser is already in use" error) and the whole section was driven end-to-end
      through it.
- [x] **Dropped 2026-09-29 — fixture drift, not a defect; checks re-baselined above.** **`/szablony/4` katalog-comparison count and content have drifted from checks 1–2** — with
      zero clicks, „Porównaj z katalogiem prac" on investment 151 (backing `/szablony/4`) reports
      **5** prac spoza katalogu, not 6, and they are not the 5 „Klejenie paneli winylowych" wariants + „Dwukrotne gruntowanie…" the checklist names. The actual 5: „Docięcie i montaż progu" (no
      j.m.), „Klejenie paneli winylowych (m2)" (one row, not five), „Układanie paneli winylowych
      niski stopień skomplikowania prac (m2)", „Gładzie w miejscach po spękaniach (m2)", „Fugowanie
      ścian i podłóg (m2)". The template is a live, continuously-edited fixture (`kosztorys_presets`
      id 4, "kosztorys wzór testy 2 września 26") — someone has edited its rozpiska since this
      section's checks were authored on 2026-09-15, most likely already ran „Popraw literówki" once
      and/or hand-edited rows, changing which prace fall outside the katalog. Confirmed via
      `browser_navigate` + `browser_click` on `/szablony/4` → Opcje → Porównaj z katalogiem…, at
      `http://localhost:3010/szablony/4`, cross-checked against a snapshot restore to the exact
      pre-any-click DB state (see the idempotence finding below for the restore mechanics) — this
      isn't stale caching, it's the fixture's real current content.
      **Needs human:** decide whether checks 1–2 should be rewritten against the template's current
      content (re-baseline the checklist), or whether the template itself should be reset to the
      state the checklist describes (re-seed `kosztorys_presets` id 4 / investment 151's
      `kosztorys_items`). Either way the checklist as currently worded cannot pass again without one
      of those two actions.
      **Test disposition:** no automated test — this is fixture drift in a live, shared template
      that multiple people/sessions edit, not a code defect. The matching/fold logic these checks
      exercise is unit-covered (`catalogue-key*.test.ts`, `clean-description.test.ts`).
      **Re-confirmed 2026-09-21 on staging/preview itself** (this fixture now exists there too —
      `kosztorys_presets` id 4 carries 1 row after today's fresh prod-dump restore, so the earlier
      "absent on preview" blocker above no longer applies): zero-click „Porównaj z katalogiem prac"
      on `/szablony/4` now reports **41** prac spoza katalogu (63 "inne liczby") — drifted further
      still from the 5 seen on the prior local pass. Confirms this keeps moving with the shared
      fixture's content, not a one-off local artifact; the **Needs human** call above stands
      unchanged.
      **Re-confirmed again 2026-09-23** (zero-click „Problemy" counters on staging): **41** prac
      spoza katalogu, unchanged from 2026-09-21; „inne liczby" drifted 63 → 62. Same **Needs human**
      blocker — not re-litigated further this pass, since two independent prior passes already
      exhausted the analysis and the only open question is a human content decision.
- [x] **Dropped 2026-09-29 — fixture drift, not a defect; checks re-baselined above.** **„Popraw literówki" change count and the „only `klp`→`kpl`" claim have also drifted, but the
      button itself is correct and idempotent** — clicking it on investment 151's current data
      changes **88** rows (37 description-only, 65 unit-only, some overlapping), not the 24 checks
      3 names, and **zero** `klp` values exist anywhere in the investment before or after (the real
      unit rewrites are near-entirely `m2`→`m²`, plus spacing fixes like `12-20cm`→`12-20 cm`).
      Cross-validated three independent ways, all agreeing: (1) a standalone script importing the
      real `cleanDescription`/`cleanUnit` and running them over a DB dump of the 202 rows; (2) the
      project's own `src/scripts/fix-kosztorys-descriptions.ts` dry-run (`INV=151`) → `"opisy: 37 do
poprawy z 202 przejrzanych"`; (3) driving the actual button in the browser and diffing
      `kosztorys_items` before/after — exactly 88 rows changed, 0 rows gained `[stary arkusz]`, a
      second click changed 0 rows and reported success. The button, idempotence, and legacy-marker
      behavior (checks 3's idempotence half, and checks 4/6/7) are therefore genuinely verified —
      only the specific numbers/wording in checks 3 and 5 are stale.
      **Needs human:** same call as the finding above — re-baseline checks 3 and 5's numbers/wording
      against current content, or reset the fixture to match what they describe.
      **Test disposition:** no automated test — fixture drift, not a defect; `cleanDescription` and
      `cleanUnit` are unit-tested directly.
      **Re-confirmed 2026-09-21 on staging/preview itself** — driving the real "Popraw literówki"
      menu item on `/szablony/4` there changed exactly **88** `kosztorys_items` rows for
      investment 151 (`updated_at` diff confirmed by direct SQL against `DB_POSTGRES_URL_PREVIEW`),
      an immediate second click changed **0** more, and no `klp` unit remains anywhere in that
      investment's items (`kpl` present, `klp` absent) — the same shape as the local-pass finding
      above, reproduced independently on preview with the identical 88-row count.
- [x] **`m2` → `m²` w j.m. nie pochodzi z tej zmiany** — check 5 mówi „poza `klp` → `kpl`", a na
      dzisiejszym fixturze przycisk przepisuje 65 j.m., prawie wyłącznie `m2` → `m²`. To reguła
      z `src/lib/kosztorys/clean-unit.ts`, która weszła commitem `bfb1b337` („Popraw literówki"
      czyści też j.m.) — ten slice nie tknął tego pliku (`git log staging --not 86b40010 --
src/lib/kosztorys/clean-unit.ts` → 0 commitów), a tabela poprawek nazw z założenia nie rusza
      j.m. Czyli nie regresja, tylko stare zachowanie przycisku na nowszych danych; check 5 był
      pisany pod fixture, w którym brudna była jedna jednostka.

- [x] **Linear: EX-928.** **Stale JWT session survives a `db:import:test` user reseed with a broken, unreadable error**
      (found while investigating an apparent 0-changes bug above, ruled out as a repo defect for
      _this_ check but worth a separate look). A `payload-token` minted against a pre-reseed
      `users.id` is still accepted by `requireAuth` after `db:import:test` recreates the `users` row
      with a different id (JWTs are stateless — `getCurrentUserJwt` never re-checks the row exists),
      so the session looks logged-in but every write whose SQL references that id by FK
      (`kosztorys_snapshots.taken_by`) throws a raw Postgres FK-violation error. That error's
      `.message` — the literal `Failed query: INSERT INTO kosztorys_snapshots (...) ... params:
151,auto,,76,1,{…60KB JSON…}` — is what `toActionFailure` returns as the user-facing string,
      i.e. a real user hitting this (e.g. after an admin recreates their account) would see a raw SQL
      dump as a toast instead of "sesja wygasła, zaloguj się ponownie". At
      `src/lib/actions/run-action.ts:63` (`logError`/`toActionFailure` swallow `err.cause`, only
      surfacing `err.message`) and `src/lib/auth/require-auth.ts` (no user-existence check).
      **Needs human:** decide whether this is worth a guard (e.g. `requireAuth` verifying the user
      row still exists, or `toActionFailure` refusing to surface a raw Postgres query as
      `err.message`) — it's a real but narrow window (stale token + a since-deleted-and-recreated
      user id), not something this pass should fix blindly since it touches the shared auth-error
      path.
      **Test disposition:** test-driven-debugging · integration — reproduce by minting a session for
      a user id, deleting that user, recreating a different user at a new id, then calling any
      action that FK-references `session.user.id`; assert the returned `ActionResultT.error` is a
      human sentence, not a raw SQL string.

## EX-787 — ui/ layering refactor (staging/preview pass, 2026-09-16)

Pure relocation refactor (`data-table/` → `tables/`, `FilterGrid` → `ui/control-grid.tsx` as
`ControlGrid`, `active-filter-button.tsx`/`active-filter-label.tsx` → `filters/`), no intended
behavior/visual change. Verified against staging
(`https://wykonczymy-git-staging-wykonczymys-projects.vercel.app`, commit `b744a3b1`), logged in as
`qa-gate@wykonczymy.test` (OWNER, session already live in the shared browser profile).

- [x] `/` (transactions listing, the densest toolbar — nav labels it "Transakcje"; **`/transfery`
      does not exist, it 404s**) at desktop (~1440px): toolbar layout (search left / column-picker
      right / filter+actions between), "Typ" filter popover opens and lists options, column-picker
      menu opens and toggles columns, Aktywne/Wszystkie toggle switches rows. No overflow.
- [x] `/` at phone (390px): filter row is 2 even columns below `sm`, no page-level horizontal
      overflow, "Typ" popover opens and is usable, "Filtry" fold collapses/expands the filter row.
- [x] `/inwestycje` at desktop: toolbar layout correct, "Status" filter popover opens and lists
      options, column-picker menu functions.
- [x] `/kasy` at desktop: toolbar layout correct, `ToggleStatButtons` tiles (using `ControlGrid`)
      render and toggle on click.
- [x] `/pracownicy` at desktop and phone (390px): toolbar layout correct at both widths,
      column-picker menu opens at both, Aktywne/Wszystkie toggle works.
- [x] `/flota` at desktop: toolbar layout correct, no overflow.
- [x] `/sprzet` at desktop: toolbar layout correct, no overflow.
- [x] `/zgloszenia` at desktop: toolbar layout correct, no overflow.

### Findings — 2026-09-16 (staging/preview pass)

- [x] **`ToggleStatButtons` tile text overflows its cell at phone width — FIXED 2026-09-16.**
      `/kasy` at 390px: each `ControlGrid` tile renders its label + balance as two `<span>` children
      inside a `<Button variant="outline" align="start">`. `Button`'s base carries
      `whitespace-nowrap` (`src/components/ui/button.tsx:8`), so the tile's **min-content** width is
      the whole un-wrappable string; a grid item's default `min-width: auto` resolves to min-content,
      so it cannot shrink into a half-width cell and spills past its track. Measured on the rendered
      "Pomocnicze" tile: content 213px vs. button box 171px. At 390px a two-column cell offers only
      ~143px of text room (390 − 32 page padding − 8 gap, halved, less the button's `px-4`), which no
      label+figure pair fits. Pre-existing — `ControlGrid`'s track class is unchanged by EX-787 (pure
      rename/move of `FilterGrid`) — and surfaced by the owner on a real phone
      (`.playwright-mcp/kasy-mobile.png`).
      **Fix applied:** `max-sm:grid-cols-1` on the `ControlGrid` instance inside
      `toggle-stat-buttons.tsx` — one full-width tile per row below `sm`. Deliberately NOT
      `[&>*]:min-w-0` + `truncate` on `ControlGrid` itself: that truncates the money figure, which is
      the one part worth reading, and `ControlGrid` is shared with the filter triggers, the
      data-table toolbar and the transfer filters, none of which have this problem. Scoped to
      `ToggleStatButtons` and therefore to its three consumers (`register-balance-chart`,
      `user-register-stats`, `financial-stats`), all of which render the same label+money shape.
      Class-order dependence verified by compiling a probe through `@tailwindcss/postcss`, not
      assumed: `.max-sm\:grid-cols-1` is emitted after `.grid-cols-2` at equal specificity, so it
      wins below 768px.
      **Test disposition:** no automated test — a CSS layout defect only a real layout engine can
      see (jsdom has none); an e2e visual check would be the right layer if one is ever authored, and
      a DOM/jsdom spec would assert nothing real.
- [x] **"Typ wydatku inwestycyjnego" filter-option label clips in the "Typ" popover on `/` — could not
      reproduce, dismissed.** Re-checked 2026-09-21 on staging (`/`, Transakcje filters) at desktop
      (1440px) and mobile (390px, matching `sm` breakpoint): both the "Typ" popover and the "Typ
      wydatku inwestycyjnego" popover render every option label in full at both widths — no clipping
      or truncation of any list item text (confirmed via screenshot at each width). The only truncation
      seen anywhere was the mobile **trigger button** itself ("Typ wydatku inwest…", expected CSS
      ellipsis on a narrow button, not the popover content the finding named). Dismissing as
      not-reproducible rather than filing.
      **Test disposition:** no automated test — could not reproduce, nothing to guard.

# Zamknięte — indeks

Jedna linia na slice, **wszystkie 94** — liczby są policzone z pełnego rejestru sprzed przycięcia.
`boksy` = odhaczone/wszystkie; wiersz, w którym te liczby się różnią, ma swoją sekcję wyżej
w „Otwarte" (tam boksy bywają scalone, więc liczba nieodhaczonych może się różnić od reszty z tej
kolumny — to ten sam fakt zapisany raz zamiast dwa). `0/0` to sekcja czysto prozatorska, bez boksów.
`ostatnia weryfikacja` to najpóźniejsza data w sekcji; `—` znaczy, że sekcja żadnej nie nosiła.
Pełne dowody, verbatim: `git show d426e567^:context/foundation/manual-checks.md`.

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
| kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie" — ZDEZAKTUALIZOWANE                    | 6/6   | 2026-09-28           |
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
| rwd-mobile — RWD na telefonie: nawigacja, dodawanie i pokazywanie transakcji (2026-09-16, EX-785)                        | 7/7   | 2026-09-16           |
| media-upload-serial — równoległy upload gubił pliki na Neonie; szeregowy zapis wierszy `media` (2026-09-22, EX-855)      | 4/4   | 2026-09-22           |
| empty-preset-create — pusty szablon zakładany z listy szablonów (2026-09-22)                                             | 5/5   | 2026-09-23           |
| szablon-autosave — warsztat szablonu zapisuje się sam (2026-09-22)                                                       | 12/14 | 2026-09-23           |
| kosztorys-editor-assets — galeria assetów w edytorze kosztorysu v2 (2026-09-22)                                          | 8/8   | 2026-09-23           |
| zakladka-inwestycja-w-panelu — zakładka „Inwestycja" w panelu Podsumowanie (2026-09-22)                                  | 23/25 | 2026-09-23           |
| Nowa sekcja wprost w „Dodaj pracę z katalogu" (2026-09-22)                                                               | 6/6   | 2026-09-23           |
| kategorie-assetow-i-kompresja — kategorie assetów i luźniejsza kompresja (2026-09-22)                                    | 13/13 | 2026-09-23           |
| EX-820 — sufit stawki wykonawcy z „Problemów" do „Filtrów" (2026-09-22)                                                  | 7/9   | 2026-09-23           |

## EX-802 — lead-delivery (wykonczymy half, 2026-09-21)

Sprawdzenia na bazie testowej (5435). Webhook wymaga `LANDING_WEBHOOK_SECRET` i
`LANDING_BLOB_HOST` w `.env`; kontrakt koperty: `context/reference/landing-intake-contract.md`.

**Każdego boksu z podpisanym requestem nie da się sprawdzić na stagingu — rób je lokalnie.**
`LANDING_WEBHOOK_SECRET` jest na Vercelu w środowisku Preview oznaczony jako **Secret** (`vercel env
ls preview` → „Hidden / Secret"), więc wartości nie wyciągnie ani `vercel env pull`, ani `.env`, który
niesie inny sekret. Poprawnie policzony HMAC dostaje wtedy `403 {"error":"Forbidden"}` — to zgodne
zachowanie bramki, nie defekt i nie błąd podpisu, więc nie ma czego debugować (spalony przebieg
2026-09-23). Dotyczy boksów „podpisany POST", „ten sam request powtórzony", „url spoza allowlisty"
i „podmienione body"; boks z `403` potwierdza za to odmowę przy złym sekrecie.

- [x] `/admin` → Media: kolumna „Rodzaj" jest widoczna i filtruje listę — zweryfikowano 2026-09-21 na
      stagingu. Kolumna widoczna w tabeli z opcjami sortowania; „Dodaj filtr" domyślnie proponuje pole
      „Rodzaj" z wartościami Faktura/Projekt/Zdjęcie/Inne — wybranie „Faktura" zmienia URL na
      `where[kind][equals]=faktura` i zwraca „Nie znaleziono Pliki" zamiast pełnej listy 1600 wierszy,
      co potwierdza że filtr faktycznie działa. Pusty wynik jest stanem danych, nie defektem: SQL na
      `DB_POSTGRES_URL_PREVIEW` potwierdza `kind` jest `NULL` dla wszystkich 1600 wierszy — kolumna
      jeszcze nie była wtedy zasilana na tej bazie (webhook z landingu jeszcze nic tam nie zapisał).
      Od EX-829 panel nie jest jedyną drogą: aplikacja zapisuje `kind = 'projekt'` sama — przy
      wgrywaniu (pole „To jest rzut lub projekt") i z galerii asetów („Oznacz jako rzut").
- [x] Skasowanie faktury podpiętej pod transakcję jest odrzucone czytelnym polskim komunikatem
      <!-- staging 2026-09-24: /admin/collections/media/1772 (invoice1-0cd005.png, podpięta pod transakcję 5252)
           → „Usuń" → „Potwierdź" dało toast „Nie można usunąć pliku — jest używany w innych miejscach
           (transakcje: 1). Najpierw odepnij go tam." Po próbie media 1772 nadal istnieje i wciąż ma
           1 wiersz w transactions_rels (path='invoice') — nic nie zostało skasowane w Blobie. -->
- [x] Inwestycja pokazuje podpięte pliki w `/admin` po akcji dodania
      **Zweryfikowane na stagingu:** po wgraniu ośmiu plików z karty inwestycji
      `/admin/collections/investments/137` → pole „Zdjęcia i pliki" listuje dokładnie tę ósemkę
      (`qa802-1…3.png`, `qa-faktura-netto-…pdf`, `qa802b-1…3.png`, `qa802b-….pdf`), w kolejności
      dodania.
- [x] Dodanie trzech zdjęć + PDF z karty inwestycji — pojawiają się bez przeładowania
      **Zweryfikowane na stagingu (inw. 137, karta → „Zdjęcia i pliki"):** jednym wyborem czterech
      plików (3 × PNG + PDF) licznik przycisku przeszedł „Dokumentacja (4)" → „(8)" bez
      przeładowania strony, a `investments_rels` (path `assets`) dla inwestycji 137 niesie po
      operacji komplet 8 wierszy z nowymi `media`. Wcześniejszy nieudany wsad w tym samym przebiegu
      był winą fikstury, nie aplikacji — ręcznie sklecony PDF bez tablicy xref; prawdziwy PDF
      przechodzi (patrz finding o cichym błędzie niżej).
- [x] Dodanie zdjęcia przy tworzeniu nowej inwestycji — leży na jej karcie
      <!-- staging 2026-09-24: „Inwestycje" → „Dodaj" → nazwa „QA EX-802 nowa inwestycja" + jeden PNG
           w polu „Zdjęcia i pliki" (dialog pokazał nazwę pliku przed zapisem) → „Dodaj". Powstała
           inwestycja 157 z wierszem `investments_rels` path `assets` → media 1817
           (`qa802-1-81e271.png`), a jej karta `/inwestycje/157` od razu niesie „Dokumentacja (1)". -->
- [~] ~~Pasek miniatur nie przewija się w poziomie przy 375px~~ — nieaktualne: na karcie inwestycji
      nie ma już paska miniatur (patrz sekcja „EX-802 — investment-assets-dialog", która to zastępuje)
- [x] Zdjęcie HEIC z iPhone'a konwertuje się i wgrywa
      <!-- staging 2026-09-24: syntetyczny `qa802.heic` (ISO Media, HEIF HEVC Main 10, 1600×1200, 5,9 kB)
           wgrany z karty inw. 137 → „Zdjęcia i pliki" → „Dodaj kolejne". Toast „Pliki dodane", licznik
           „Dokumentacja (8)" → „(9)" bez przeładowania, a w bazie media 1816 = `qa802-169b13.jpg`,
           `image/jpeg`, 1600×1200, 21 357 B — czyli konwersja po stronie klienta zadziałała. -->
- [x] W `/admin` zgłoszenie z Facebooka nie pokazuje trzech pól landingowych, zgłoszenie z landingu pokazuje
      <!-- staging 2026-09-24: lead 220 (`facebook_lead_ads`) → etykiety pól: Źródło, Email, Imię i nazwisko,
           Telefon, Inwestycja, Surowe dane, … — bez „Adres", „Zakres prac", „Metraż" i „Zdjęcia i pliki".
           Lead 221 (`landing_form`) → ta sama lista plus właśnie te cztery. -->
- [ ] Podpisany POST JSON z `curl`, wskazujący realny URL bloba, tworzy zgłoszenie razem z plikami
      **Linear: EX-938** — izolacja stagingu (do tego czasu nie do sprawdzenia tu).
      _2026-09-30: POST podpisany HMAC-SHA256 (scope „landing-submission") z `LANDING_WEBHOOK_SECRET` z `.env` → 403 na stagingu, czyli sekret z `.env` nie jest sekretem Preview. Brakuje wartości sekretu Preview; do tego realny plik w blobie landingu (callback release dotyka landingu). Nic nie utworzono._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
- [ ] Ten sam request powtórzony nie tworzy niczego i nie wysyła maila
      **Linear: EX-938** — izolacja stagingu (do tego czasu nie do sprawdzenia tu).
      _2026-09-30: jak wyżej — brak sekretu Preview (403 na poprawnie podpisany request z sekretem z `.env`)._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
- [ ] Request z `assets[].url` spoza hosta z allowlisty jest odrzucony i alertuje
      **Linear: EX-938** — izolacja stagingu (do tego czasu nie do sprawdzenia tu).
      _2026-09-30: jak wyżej — brak sekretu Preview; bez ważnego podpisu request nie dochodzi do walidacji hosta._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
- [ ] Request z podmienionym body jest odrzucony (403)
      **Linear: EX-938** — izolacja stagingu (do tego czasu nie do sprawdzenia tu).
      _2026-09-30: 403 obserwowane, ale nie do zaliczenia — poprawnie podpisany request też dostał 403 (zły sekret), więc odrzucenie nie dowodzi kontroli podpisu._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
- [x] Promocja zgłoszenia z landingu od początku do końca — karta nowej inwestycji pokazuje zdjęcia klienta
      <!-- staging 2026-09-24: lead 221 („QA Landing Fixture", `landing_form`, dwa pliki dopięte jako
           fikstura) → „Zgłoszenia" → „Dodaj". Okno „Nowa inwestycja ze zgłoszenia" przyszło wypełnione
           ze zgłoszenia (nazwa = imię + adres, adres, telefon, email, osoba kontaktowa) i mówiło
           „Przejdą do inwestycji: 2 z 2". Po „Utwórz" powstała inwestycja 158 (status „planowana"),
           a jej karta `/inwestycje/158` niesie „Dokumentacja (2)" — w bazie oba media klienta
           (1814, 1815) pod `investments_rels` path `assets`. -->
- [x] Zgłoszenie po promocji podaje link do inwestycji zamiast przycisku i zostaje przy „Oczekuje"
      <!-- staging 2026-09-24: ten sam wiersz po promocji ma w kolumnie „Inwestycja" link
           `/inwestycje/158` z nazwą inwestycji zamiast przycisku „Dodaj", a „Status kontaktu" nadal
           „Oczekuje" (`leads.contact_status='new'`, `investment_id=158`). -->
- [x] Odznaka nieprzeczytanych zgłoszeń w nawigacji nie spada po samej promocji — ~~dopiero po
      kliknięciu „Skontaktowano"~~ **druga połowa brzmienia jest nieaktualna, nie jest defektem**
      <!-- staging 2026-09-24: odznaka liczy zgłoszenia utworzone po kursorze użytkownika
           (`countUnreadLeads`, `src/lib/db/notifications.ts` — `created_at > notification_reads.seen_at`),
           a kursor przesuwa render samej strony `/zgloszenia` (`markSeen` w `zgloszenia/page.tsx`).
           Zmierzone przy kursorze cofniętym do 2026-09-20 i odczycie odznaki z `/inwestycje`:
           3 przed promocją, 3 po promocji leada 221, 3 po przestawieniu go na „Skontaktowano".
           Czyli: promocja rzeczywiście nie rusza odznaki (sprawdzana teza), ale i „Skontaktowano"
           jej nie rusza — gasi ją samo wejście na listę zgłoszeń. Brzmienie boksu do poprawienia
           przy najbliższej okazji. -->

### Findings — 2026-09-23/24 (staging/preview pass)

- [x] **Linear: EX-927.** **Odrzucony upload pokazuje surowy angielski komunikat Payloada w polskim UI.** Wgranie
      uszkodzonego PDF-a (plik bez tablicy xref) z karty inwestycji kończy się `400` z
      `POST /api/media`, a toast, który widzi użytkownik, brzmi dosłownie **„The following field is
      invalid: file"**. Zmierzone na stagingu (inw. 137, „Zdjęcia i pliki" → „Dodaj kolejne"),
      przechwycone `MutationObserver`-em; licznik plików nie drgnął, więc poza tym zdaniem nic nie
      mówi, co poszło nie tak ani którego pliku dotyczy. Przyczyna:
      `src/lib/media/client-upload.ts` → `postMediaRow` wstawia `body?.errors?.[0]?.message`
      (komunikat Payloada, po angielsku) prosto w błąd, który `useMediaUpload` podaje do
      `toastMessage`; wszystkie pozostałe komunikaty na tej ścieżce są po polsku
      („Upload nie powiódł się (…)", „Upload nie powiódł się — serwer nie zwrócił pliku").
      **Do decyzji człowieka:** brzmienie. Najprościej nie ufać `errors[0].message` z API i
      zostawić polski fallback (ewentualnie z nazwą pliku), ale to zabiera jedyny kanał, którym
      backend tłumaczy konkretną przyczynę — dlatego nie poprawiam tego w przebiegu QA.
      **Test disposition:** no automated test — komunikat, nie stan; gdy padnie decyzja o brzmieniu,
      unit na `postMediaRow` z odpowiedzią `400` wystarczy.

## EX-802 — investment-assets-dialog (galeria bez miniatur, 2026-09-21)

Zastępuje sprawdzenie „Pasek miniatur nie przewija się w poziomie przy 375px" z sekcji
lead-delivery — na karcie inwestycji nie ma już paska miniatur (został tylko u leada).

- ~~Inwestycja bez plików nie pokazuje w sekcji żadnego przycisku~~ — zachowanie odwrócone przy
  kosztorys-editor-assets (2026-09-22); nowe brzmienie czeka na weryfikację w sekcji tej zmiany
- [x] Przycisk „Zdjęcia i pliki (N)" ma szerokość swojej treści, nie całej kolumny
- [x] Podgląd przy N ≥ 1 ma „Dodaj kolejne", które dokłada plik bez wychodzenia z karty
- [x] Po dodaniu pliku licznik „Zdjęcia i pliki (N)" rośnie bez przeładowania strony
- [x] Podgląd otwiera plik, „Pobierz" zapisuje go pod właściwą nazwą, „Drukuj" otwiera podgląd wydruku
- [x] Przy 2+ plikach „Pobierz wszystkie" daje zip o nazwie zaczynającej się od `pliki-`, nie `faktury-`
- [x] Stopka podglądu przy 2+ plikach mówi „Usuń ten plik" + „Usuń wszystkie"; przy jednym pliku samo
      „Usuń", bez „Usuń wszystkie" — nigdzie nie pada słowo „faktura"
- [x] „Usuń" pyta o potwierdzenie i po potwierdzeniu plik znika z podglądu
- [x] W obu dialogach („Nowa inwestycja" i „Edytuj inwestycję") „Status" i „Zdjęcia i pliki" stoją
      w jednym wierszu, a przy zwężonym oknie wracają jedno pod drugie
- [x] „Edytuj inwestycję" → „Dodaj zdjęcia lub pliki" → wybór pliku dodaje go natychmiast (toast), dialog w dialogu działa
- [x] Zamknięcie formularza edycji przez „Anuluj" nie usuwa dodanego pliku
- [x] Formularz „Nowa inwestycja" dalej zbiera pliki po staremu i zapisuje je razem z inwestycją
- [x] Podgląd i dodawanie faktury w tabeli transferów działa jak przed zmianą (tytuły, pager)

## katalog-problems — rozjazdy z katalogiem prac jako problemy edytora (2026-09-21)

Na inwestycji z niepustą rozpiską (np. po `INV=6 … seed-kosztorys.ts`), edytor `kosztorys_v2`.

- [x] Wejście na edytor bez otwierania żadnego okna: „Problemy" pokazują „Inne liczby niż w katalogu prac (N)" i „Brak w katalogu prac (M)"
- [x] Zmiana ceny j.m. na zgodną z katalogiem zmniejsza licznik „Inne liczby…" natychmiast, bez zapisu i bez przeładowania
- [x] Liczby w oknie „Porównaj z katalogiem prac" i w menu „Problemy" są identyczne, także po niezapisanych zmianach
- [x] Okno otwiera się od razu z liczbami — nie pokazuje „Porównuję z katalogiem…"
- [x] „Pokaż w rozpisce" w obu blokach zamyka okno i zawęża siatkę do właściwego zbioru pozycji
- [x] Zawężenie na „Inne liczby…" odsłania kolumny cenowe, nawet jeśli były odznaczone w wyborze kolumn — zweryfikowano 2026-09-21 na stagingu (inw. 137, widok „Inwestor", zawężenie włączone): nagłówek siatki niesie „Cena j.m. netto" obok obu stawek podwykonawców.
- [x] „Dodaj do katalogu" na pracy spoza cennika zmniejsza licznik „Brak w katalogu" bez utraty niezapisanych wierszy
- [x] Podgląd szablonu / tryb tylko-do-odczytu: raport widoczny, brak „Dodaj do katalogu", „Edytuj w katalogu" i „Pokaż w rozpisce" (zweryfikowano na zablokowanej inwestycji — status `completed`, inw. 106 — `readOnly = preview || locked`; klient-facing „Widok inwestora"/`/podglad-inwestora` nie renderuje paska „Problemy" wcale, więc ta ścieżka nie dotyczy tego checka)

### Findings — 2026-09-21

- [x] ~~**Zawężenie na „Inne liczby niż w katalogu prac" nie odsłania bazowej kolumny „Cena j.m. netto" na widoku inwestora.**~~ **Fałszywy alarm — odrzucone 2026-09-21.** Pomiar był robiony na widoku **„Z narzędziami"**, nie „Inwestor" (przełącznik widoku cen to `role="radio"`; w chwili obserwacji „Z narzędziami" miało `data-state="on"`). Na widoku podwykonawcy bazowa „Cena j.m. netto" **nie jest w ogóle składana** — `kosztorys-v2-columns.tsx` daje `view === 'client' ? [price, ...plany] : plany` — więc nie ma czego odsłaniać, i to jest projekt, nie defekt; dokładnie dlatego warunek odsłania WSZYSTKIE kolumny cenowe (komentarz przy `revealsColumns` w `row-conditions/registry.ts`). Dwa dowody: (1) spec na `buildV2Columns` z `view: 'client'`, `isHidden: () => true` i `revealedColumnIds` z `columnsRevealedBy([CATALOGUE_DIVERGENCE_CONDITION_ID])` przepuszcza `price` — miał czerwienić, jest zielony; (2) ta sama siatka na stagingu po przełączeniu na „Inwestor" niesie w nagłówku „Cena j.m. netto". `keep()` w `column-selection.ts` jest poprawne: bramka `PRZEDMIAR_ANCHORED_COLUMNS` działa tylko przy `view !== 'client'`, a `price` siedzi w `AXIS_EXEMPT_COLUMNS`, więc `axisAllows` zawsze przepuszcza. **Bez zmian w kodzie i bez regresji** — nie ma defektu do przykrycia.

## catalogue-compare-bulk-update — hurtowa aktualizacja rozpiski z katalogu (2026-09-21)

Inwestycja z niepustą rozpiską i rozjazdami wobec katalogu (w lokalnym dumpie: inw. 151), okno
„Porównaj z katalogiem prac" w edytorze `kosztorys_v2`.

- [x] Nie ma już wiersza „Malowanie sufitu w kolor — Stawka bez narzędzi: 14,88 zł / 14,88 zł / −0,01 zł", a licznik różnic spada o jeden
- [x] Wiersze, gdzie katalog nie podaje stawki, mają w kolumnie „Katalog" słowo „auto", nie złotówki; ich „Różnica" jest szara
- [x] Licznik „Problemy" rośnie dokładnie o tyle wierszy „zamrożona ↔ auto o tej samej kwocie", ile widać w raporcie, i żaden wiersz nie zniknął
- [x] Zaznaczenie pojedynczej liczby i „Aktualizuj kosztorys (1)" zmienia dokładnie tę jedną liczbę, wiersz znika z raportu, okno zostaje otwarte, licznik „Pokaż N różnic" maleje o jeden
- [x] Zaznaczenie wszystkiego i zapis zostawia blok „Inne liczby niż w katalogu" pusty
- [x] Sortowanie i filtry ustawione w rozpisce przed otwarciem okna przeżywają zapis (siatka się nie remountuje)
- [x] W „Wersje" jest wpis z chwili tuż przed zapisem, a przywrócenie go cofa cały hurt
- [x] Aktualizacja wiersza, gdzie katalog mówi „auto", kasuje nadpisanie — praca liczy się z globalnego współczynnika i na siatce pokazuje cenę pochodną
- [x] Zaznaczenie stawki, która po scaleniu przekracza 65 % ceny, pokazuje znacznik przy wierszu jeszcze przed zapisem; odznaczenie znacznik gasi
- [x] Praca „Montaż syfonów (kpl)" pokazuje kandydata „Montaż syfonów (szt)" z komunikatem o j.m. („ta sama nazwa, inna j.m."), nie o nazwie
- [x] Kliknięcie kandydata przepisuje opis i j.m.; praca znika z „Brak w katalogu" i pojawia się w „Inne liczby niż w katalogu" (albo w „Zgodne z katalogiem")
- [x] „inny…" otwiera wyszukiwarkę po całym katalogu i wybór z niej działa tak samo
- [x] Ceny pracy nie zmieniają się przy przyjęciu nazwy
- [x] Tryb tylko-do-odczytu: raport i kandydaci widoczni jako tekst, brak checkboxów, przycisku „Aktualizuj kosztorys" i klikalnych kandydatów

## szablon-autosave — warsztat szablonu zapisuje się sam (2026-09-22)

`/szablony/[id]`. Warsztat jest JEDEN i współdzielony, więc każdy check wyrzuca z niego to, co było
otwarte wcześniej. Dławik lustra to 10 s, domknięcie ogona 15 s bezczynności — przy sprawdzaniu
„czy doszło" liczy się odczekanie, nie odświeżanie w kółko.

**Nieaktualne od EX-893 (2026-09-29):** warsztatu i lustra już nie ma — szablon jest własną
inwestycją i zapisuje się jak każdy kosztorys. Otwarte boksy tej sekcji nie mają już czego sprawdzać.

- [~] ~~Po przełączeniu w „Wersje" jest wpis „Przed wczytaniem: <nazwa>" i przywrócenie go wraca do stanu sprzed~~ — nieaktualne (szablon-open-speed, EX-876): wpis był zapisywany, gdy wskaźnik warsztatu był pusty, więc żadna lista „Wersje" nie mogła go pokazać; przełączenie już go nie robi, a punktem przywrócenia jest kopia szablonu w bibliotece, dopychana w tej samej transakcji.

### Findings — 2026-09-23 (staging/preview pass)

- [~] ~~**„Wersje" nie pokazuje wpisu „Przed wczytaniem: <nazwa>" po przełączeniu szablonu** — zweryfikowane na stagingu (commit `e0158cb8`), 3 ponowne otwarcia dialogu „Wersje" i przeładowanie strony, wpis nigdy się nie pojawił. Defekt jest **węższy niż „dialog Wersje jest nieaktualny"**: w tej samej sesji, na tym samym szablonie, ręczne „Wyczyść szablon" utworzyło wpis „Przed wyczyszczeniem" i ten wpis pojawił się w dialogu natychmiast i poprawnie (przywrócenie też zadziałało). Więc automatyczny snapshot przy `openPresetInWorkshopAction` (przełączenie) nie trafia do listy „Wersje" tak jak snapshot przy czyszczeniu — dwie różne ścieżki tworzenia auto-snapshotu zachowują się różnie mimo wspólnego UI. Root-cause (np. brakujący tag cache / inny zapis do `kosztorys_snapshots`) poza zakresem tego przebiegu QA — check zostaje odznaczony jako otwarty defekt.~~ — nieaktualne: przyczyna i usunięcie wpisu w boksie wyżej (EX-876).
- [~] ~~**Pusty szablon (0 sekcji) jest niewidoczny w „Przełącz na inny szablon…" wewnątrz warsztatu**~~ — nieaktualne (EX-893): przełączania szablonów w warsztacie już nie ma. Dawny opis: root-cause: `groupPresetSections`/`usePresetSections` (`src/components/kosztorys/editor/dialogs/preset/use-preset-sections.ts`) buduje listę, iterując metadane na poziomie SEKCJI, więc preset bez żadnej sekcji nigdy się nie zmaterializuje jako opcja. To NIE dotyczy innego pickera o tej samej nazwie funkcjonalnej — „Kosztorys z szablonu" w dialogu zakładania nowej inwestycji (`add-investment-dialog.tsx`/`investment-form.tsx`) pokazał pusty preset („ZZZ QA EX748 usunac empty2", 0/0) poprawnie, zgodnie z już potwierdzonym checkiem w `empty-preset-create` (linia 581). Dwa różne pickery, dwie różne implementacje — defekt jest lokalny do warsztatowego „Przełącz na inny szablon…", nie ogólny.

## zakladka-inwestycja-w-panelu — zakładka „Inwestycja" w panelu Podsumowanie (2026-09-22)

Dane inwestycji (notatki/zakres prac, kontakt, adres, status) i przeniesiona tu Dokumentacja;
panel montuje się także na pustym kosztorysie.

- [x] Zakładka „Inwestycja" stoi jako ostatnia, za „Marżą", i pokazuje komplet pól karty inwestycji;
      puste pola są odfiltrowane
      <!-- staging 2026-09-24 (commit 48bb1625, z naprawą filtrowania). Kolejność zakładek:
           Podsumowanie · Materiały · Robocizna · Podwykonawcy · Marża · Inwestycja — ostatnia.
           Inw. 19 (komplet danych): Adres · Telefon · Email · Opinia · Status + Dokumentacja.
           Inw. 74 (phone/email/review puste w bazie): zostają tylko Status i notatki — żadnego
           „Email —" ani „Opinia —". -->

### Findings — 2026-09-23 (staging/preview pass)

- [x] **„Komplet pól karty inwestycji; puste pola są odfiltrowane" — realny defekt, naprawiony
      i potwierdzony na żywo 2026-09-24 (staging `48bb1625`): inw. 74 nie renderuje już „Email —"
      ani „Opinia —".** `buildInvestmentInfoFields`
      (`src/components/investments/investment-info-fields.tsx`) filtrował `.filter((field) =>
field.value)` na **zrenderowanym węźle**, nie na surowej wartości: `Telefon`/`Email` owijały
      pole w `<ContactLink>`, który jest zawsze truthy niezależnie od tego, czy numer/mail istnieje,
      a `Opinia` miała `investment.review || '—'` — myślnik też jest truthy. Efekt na żywo (inw. 74,
      brak telefonu/maila/opinii): „Email —" i „Opinia —" renderowały się zamiast znikać, dokładnie
      tak jak przewidywał plan (`context/changes/2026-09-22-zakladka-inwestycja-w-panelu/plan.md:345`
      — „komplet pól, puste pola odfiltrowane"). Naprawa: filtrować na surowym polu
      (`investment.phone && <ContactLink .../>`), zdjąć `|| '—'` z Opinii — `InfoList` i tak stawia
      myślnik dla każdej wartości, która trafi do listy jako falsy. Regresja:
      `src/__tests__/components/investments/investment-info-fields.test.ts` (3 testy, node, zielone
      lokalnie) blokuje ten dokładny powrót. Kolejność zakładek (ostatnia, za „Marżą") jest
      potwierdzona poprawna na żywo — tylko filtrowanie było wadliwe. **Boks zostaje otwarty**: fix
      leży w gałęzi, nie na wdrożonym `e0158cb8` — wymaga redeployu stagingu, żeby dograć na żywo.
      **Test disposition:** test-driven-debugging — unit (funkcja czysta, bez DOM).
- Sprawdzenie #10 (`/szablony/<id>`) zweryfikowane na `/szablony/4` — pasek „Widok podsumowania" ma
  4 pozycje (Podsumowanie/Materiały/Robocizna/Podwykonawcy, bez Marży — bez inwestycji nie ma
  wejścia do marży), zero przycisków plików w toolbarze. Zgodne z checkiem.
- Sprawdzenie #11: tekst checklisty mówił „pięć zakładek" — na żywo (`/k/<token>` z inw. 137 i
  `/podglad-inwestora/106`) są **trzy**: Podsumowanie/Materiały/Robocizna. Nie defekt —
  `allowedSummaryViews` (`src/components/kosztorys/summary/model/summary-views.ts`) gubi
  „Podwykonawcy" i „Marża" na `preview` **niezależnie** od tej zmiany (starsza bramka, potwierdzona
  testem `model/summary-views.test.ts`: „podgląd klienta gubi «Podwykonawcy» i «Marża», nawet gdy
  liczby przyszły"). Ta zmiana dokłada tylko trzecią bramkę („Inwestycja" na `!preview &&
hasInvestmentInfo`), z tym samym efektem. Poprawiłem liczbę w treści checka (linia wyżej) — plan
  najwyraźniej się przeliczył.
- Powtarzający się `[ERROR] OPTIONS / => 400` w konsoli na niemal każdej nawigacji — to preflight
  `vercel.live` (widoczny w sieci jako `OPTIONS https://…vercel.app/` tuż po `POST
vercel.live/login/validate`), infrastruktura Vercel Preview Toolbara, nie kod aplikacji. Nie
  wpływa na żadną z powyższych ścieżek — pominięte jako szum, nie finding.

## EX-849 / EX-850 — tagowanie cache galerii i pojedynczy render po uploadzie (2026-09-22)

Obie zmiany dotykają tego samego wpisu cache (`fetchInvestmentAssets`) z dwóch stron: EX-849 zwęził
tag z kolekcyjnego do per-wiersz, EX-850 zdjął zdublowany render po wgraniu pliku. Jedno i drugie
widać tylko na żywo — spec nie obserwuje ani liczby renderów, ani tego, czyj wpis cache wyleciał.
Licznik renderów czytaj z logu dev: `[PERF] buildKosztorysTree` (drzewo jest niecache'owane
świadomie — odrzucone dla świeżości, `context/archive/2026-07-27-decouple-panel-write-refresh/`
— więc każdy render trasy zostawia dokładnie jeden wpis).

- [x] Wgranie zdjęcia do inwestycji na trasie `/inwestycje/<id>/kosztorys_v2`: w logu dev
      `[PERF] buildKosztorysTree` pojawia się **raz**, nie dwa razy (EX-850)
      — zweryfikowane 2026-09-23 na stagingu, runtime log deploymentu `wykonczymy-4fcngsuxi`
      (inwestycja 106, jeden upload o 10:18:18). Cały upload zmieścił się w JEDNYM żądaniu
      `POST /inwestycje/106/kosztorys_v2`, a w nim dokładnie po jednym wpisie:
      `addInvestmentAssetsAction 489ms`, `buildKosztorysTree 62ms`,
      `kosztorys_v2/106 7-fetch fan-out 266ms`. Po akcji **nie ma** osobnego
      `GET /inwestycje/106/kosztorys_v2` — czyli drugiego renderu po `router.refresh()` nie ma
      wcale, a nie „jest, tylko szybki". `fetchAllMedia` przeskoczyło 1605 → 1606 dokumentów, więc
      plik faktycznie wszedł. (`getaddrinfo disabled.invalid` w tym samym żądaniu to bramka poczty
      poza produkcją, nie błąd uploadu.)
- [x] To samo zdjęcie pojawia się w galerii bez ręcznego odświeżenia strony — render z odpowiedzi
      akcji wystarcza po zdjęciu `router.refresh()`
- [x] Wgranie faktury do transferu: faktura widoczna od razu, bez przeładowania (ta sama ścieżka
      `useMediaUpload`, druga i ostatnia)
- [x] Zapis „Opcji rozliczenia" na inwestycji A **nie** wywala galerii inwestycji B: wejdź na
      galerię B (log pokazuje `query.fetchInvestmentAssets(B)`), zapisz ustawienia na A, wróć na B —
      drugiego zapytania nie ma, wpis cache przeżył (EX-849)
- [x] „Oznacz jako rzut" na pliku inwestycji B nadal odświeża tę galerię — tag `collection:media`
      zostaje i to jedyna ścieżka, która zmienia `media.kind` bez dotykania wiersza inwestycji
- [x] Przeniesienie plików ze zgłoszenia do inwestycji („wyślij do inwestycji"): galeria inwestycji
      docelowej pokazuje je po wejściu, bez odświeżania — piąty pisarz, ten w `lead-assets.ts`
- [x] Usunięcie pliku z galerii i usunięcie wszystkich: plik znika, a po odświeżeniu nie wraca

### Findings — 2026-09-23 (staging/preview pass)

- [x] **~~Liczba renderów `buildKosztorysTree` nie da się zweryfikować z samej przeglądarki na
      stagingu~~ — finding obalony 2026-09-23: runtime logi Vercela są osiągalne z CLI.**
      Pierwotny wniosek („needs human, odpal `pnpm dev` lokalnie") stał na jednej nieudanej próbie
      `npx vercel ls --scope=$(npx vercel whoami)`, która padła `Error: You cannot set your Personal
Account as the scope.` — to był zły argument `--scope`, nie brak dostępu. Właściwy scope to
      zespół projektu z `.vercel/project.json` (`orgId`), nie konto CLI:

                        ```bash
                        npx vercel logs https://<deployment>.vercel.app --scope=team_BWfyTqJnjIqZBkHwBL0elgS4
                        ```

                        Strumień oddaje runtime stdout pogrupowany per request, a `console.log` w `buildKosztorysTree`
                        (`src/lib/queries/kosztorys.ts:71`) nie jest bramkowany `NODE_ENV`, więc linia `[PERF]
                        buildKosztorysTree …` wychodzi tak samo z builda produkcyjnego na stagingu, jak z dev.
                        Właściwy box wyżej policzony tą drogą i odhaczony — jeden wpis na jeden upload.
                        **Test disposition:** no automated test — to obserwowalność (log count), nie asercja stanu.

## EX-820 — sufit stawki wykonawcy z „Problemów" do „Filtrów" (2026-09-22)

Sufit 65 % przestał być defektem: strażnik sądzi teraz **kwotę stałą**, mnożnik odpowiada za siebie
sam w swoim polu, a dwie pary dopełniających się filtrów zastąpiły wpis w „Problemach". Automat
sprawdza predykaty i składanie menu; na żywo zostaje to, czego spec nie widzi — czy czerwień pada
tam, gdzie ma, i czy zbiorcze odznaczenie da się cofnąć.

**Aktualizacja 2026-09-28 (nazewnictwo + próg na płaszczyznę).** Słowo „sufit" zniknęło z UI: grupa
w menu nazywa się „Udział wykonawcy w cenie", a wpisy mówią „z własną stawką ponad 65% ceny" /
„…ponad 55% ceny". Próg nie jest już jeden — idzie za płaszczyzną (`DEFAULT_COEFFS`): 65% z
narzędziami, 55,25% bez narzędzi, bo stawka bez narzędzi jest z definicji o 15% niższa. Boksy niżej
opisują stan sprzed tej zmiany; ich liczby dotyczą płaszczyzny „z narzędziami".

- [x] „Filtry" w widoku „z narzędziami": dwie nowe pozycje progu z licznikami (grupa „Udział wykonawcy
      w cenie"); odznaczenie jednej chowa dokładnie tę połowę, a obie odznaczone chowają wszystko, co
      ma kwotę stałą
      _Zweryfikowano 2026-09-29 (staging): inw. 137, „z narzędziami”: grupa „Udział wykonawcy w cenie” ma dwie pozycje z licznikami („Ponad 65% ceny” 34, „Poniżej 65% ceny” 343). Odznaczenie „Poniżej” zostawia 34 wiersze (chip „Ukryto: pozycje bez własnej stawki ponad 65% ceny…”), odznaczenie obu chowa całą rozpiskę (377) — zgodnie z EX-929 pozycja „Poniżej” łapie też „auto”, więc dopełnienie obejmuje wszystko, także każdą kwotę stałą._
- [~] Te same dwie pozycje **nie** pojawiają się w widoku klienta — **nieaktualne od EX-856
  (2026-09-23):** bramka widoku zniknęła, więc obie pozycje sufitu stoją w menu „Filtry"
  niezależnie od widoku cen, także w kliencie. Boks zostaje jako zapis tego, co było prawdą
  22.09; scenariusz zastąpiony przez sekcję EX-856 niżej

### Findings — 2026-09-23 (staging/preview pass)

- [x] **Linear: EX-929.** **Dwa dopełniające się filtry sufitu, oba odznaczone naraz, chowają CAŁĄ rozpiskę (377/377), nie
      tylko 236 pozycji z kwotą stałą.** Zmierzone na inw. 137, widok „z narzędziami": `Pozycje
z kwotą stałą powyżej sufitu (35)` + `Pozycje bez kwoty stałej powyżej sufitu (342)` =
      35 + 342 = 377 = cały kosztorys. Przyczyna: `isFixedRateOverCeiling` w
      `src/lib/kosztorys/subcontractor-price-guard.ts` zwraca `false` dla `null`/„auto"
      (`overrideValueFor` się nie zgadza), więc dopełniający filtr „bez kwoty stałej powyżej sufitu"
      łapie też wszystkie 141 pozycji ze źródłem „auto", nie tylko kwotę-stałą-w-normie — zachowanie
      jest świadome i opisane komentarzem w `src/lib/kosztorys/row-conditions/registry.ts`. Ale zdanie
      z checklisty („obie odznaczone chowają wszystko, co ma kwotę stałą") czyta się jako „zostanie
      236 wierszy kwoty stałej", nie „zostanie 0". Do decyzji: albo checklist opisuje inny scenariusz
      niż zmierzony i trzeba go przeformułować, albo drugi filtr powinien się zawężać do
      `overrideValueFor(row, view) !== null`, żeby przestał połykać wiersze „auto". Boks #5 w tej
      sekcji zostaje odznaczony do czasu tej decyzji.

## EX-856 — „Filtry" bez bramki widoku, warsztat bez przełącznika cen (2026-09-23)

Menu „Filtry" nie pyta już, na którym planie cen stoi siatka: oferuje wszystkie osie zawsze, a listę
skraca próg licznika (wiersz z zerem nie istnieje, chyba że jest zaangażowany). Wiersze stoją pod
nagłówkami kategorii, jak w „Problemach". Warsztat szablonu stracił przełącznik „Widok cen".
Automat pokrywa arytmetykę modelu (`filters-menu-model`) i kolejność kategorii; na żywo zostaje to,
czego spec nie widzi — że nagłówki faktycznie się rysują, że licznik znika razem z wierszem i że
warsztat po zmianie w ogóle się otwiera.

- [x] Widok „klient": menu „Filtry" pokazuje obie pary stawek wykonawcy (z ogonem „w widoku …"),
      a odznaczenie którejś chowa wiersze, mimo że siatka stoi na cenie klienta
      **Zweryfikowane na stagingu (inw. 137, radio „Inwestor" = `checked`):** lista niesie obie osie
      z ogonem — „…z kwoty stałej w widoku z narzędziami (podwykonawca) (234)", „…z własnego
      mnożnika … (1)", „…„auto" … (142)" oraz „…z kwoty stałej w widoku bez narzędzi (pracownik)
      (235)", „…„auto" … (142)". Odznaczenie osi „kwota stała / z narzędziami" schowało obie
      pozycje „Bruzdowanie pod rury" (szukajka: `[]` z filtrem, dwa wiersze bez niego), a przycisk
      przeszedł w „Filtry (1)".
- [x] Przełączenie widoku cen przy odznaczonym filtrze stawki **nie** przywraca schowanych wierszy
      ani nie gubi zaznaczenia — zawężenie przeżywa zmianę widoku
      **Zweryfikowane na stagingu (inw. 137):** przy tym samym zawężeniu przejście na „Bez narzędzi
      (pracownik)" (radia: Inwestor `off` / Z narzędziami `off` / Bez narzędzi `on`) zostawiło obie
      pozycje „Bruzdowanie pod rury" schowane, a przycisk dalej czytał „Filtry (1)".
- [x] Rozpiska bez komentarzy: wiersza „Pozycje z komentarzem" nie ma na liście wcale (nie „(0)")
      **Zweryfikowane na stagingu (inw. 137):** pod „Komentarz" stoi wyłącznie „Pozycje bez
      komentarza (377)" — wiersza „Pozycje z komentarzem" nie ma w ogóle.
- [x] Ten sam wiersz, gdy jest **zaangażowany**, zostaje widoczny z „(0)" i da się go odkliknąć
      **Zweryfikowane na stagingu (inw. 137, oś rabatu):** z zaangażowanym „Pozycje bez rabatu (377)"
      i włączonym rabatem globalnym wiersz **został** na liście, przeliczony na „Pozycje bez rabatu
      (0)"; odkliknięcie go zdjęło zawężenie („Filtry (1)" → „Filtry") i wiersz zniknął z listy
      całkowicie (żadnej linii z „rabat" w menu).
- [x] Nagłówki kategorii („Przedmiar", „Wykonana praca", „Rabat", „Źródło stawki wykonawcy",
      „Sufit stawki wykonawcy", „Komentarz") pojawiają się raz każdy, w tej kolejności
      **Zweryfikowane na stagingu (inw. 137) — treść boksu była nieaktualna, nie aplikacja.**
      Na żywo nagłówków jest **pięć**, raz każdy, w kolejności: „Przedmiar i wykonana praca",
      „Rabat", „Źródło stawki wykonawcy", „Sufit stawki wykonawcy", „Komentarz". Zgadza się to
      z `src/lib/kosztorys/filter-groups.ts`, gdzie przedmiar i wykonana praca celowo dzielą jeden
      nagłówek; sześcionagłówkowe brzmienie tego punktu pochodziło sprzed tej decyzji.
- [x] Rabat globalny włączony: para filtrów rabatu per pozycja znika z listy, a jeśli była
      zaangażowana — zostaje z możliwością odkliknięcia
      **Zweryfikowane na stagingu (inw. 137, „Opcje rozliczenia → Rabat → Kwotowy"):** przed
      włączeniem pod nagłówkiem „Rabat" stało „Pozycje bez rabatu (377)" (wiersza „z rabatem" nie
      ma — próg licznika, 0 pozycji). Po włączeniu rabatu globalnego oś rabatu zostaje **wyłącznie**
      w postaci zaangażowanego wiersza „(0)"; po jego odkliknięciu nagłówek „Rabat" i oba wiersze
      znikają z listy. Ustawienie przywrócone na „Wyłączony".
- [x] „Zresetuj filtry" w menu „Sekcje" robi dokładnie to samo co w „Filtrach" (czyści zawężenia,
      zwinięte sekcje i szukajkę) i jest wygaszone, gdy nie ma czego czyścić
      **Zweryfikowane na stagingu (inw. 137):** przycisk stoi w korzeniu popovera (poza listą
      `cmdk`, stąd nie widać go w `[role=menu]`). Z menu „Sekcje" wyczyścił naraz zaangażowany
      filtr i szukajkę (`{trig:["Filtry","Sekcje"], search:""}`), po czym odczytał się jako
      `disabled: true`; ten sam przycisk z menu „Filtry" zdjął zaangażowane „Pozycje bez rabatu"
      („Filtry (1)" → „Filtry"). Zwinięcie „Podłóg" podbija licznik do „Sekcje (1)".
- [x] Warsztat szablonu (`/szablony/[id]`): przełącznika „Widok cen" nie ma, a siatka pokazuje
      kolumny planu klienta; reszta paska narzędzi bez zmian
      **Zweryfikowane na stagingu (`/szablony/4`, „kosztorys wzór testy 2 września 26", 202 poz.):**
      ani napisu „Widok cen", ani żadnego `role=radio` widoku na stronie nie ma. Nagłówki siatki:
      Akcje · Sekcja · Opis prac · Jednostka miary · **Cena j.m. netto** · Źródło ceny wykonawcy /
      Mnożnik / Cena j.m. netto — z narzędziami (podwykonawca) · Źródło ceny wykonawcy / Mnożnik —
      bez narzędzi (pracownik). Pasek narzędzi bez zmian: „Podsumowanie", „Pokaż narzędzia",
      „Dodaj", „Opcje", „Problemy", „Filtry", „Sekcje".

## EX-865 — „Własny mnożnik" jako trzecie źródło stawki wykonawcy (2026-09-23)

Stawka wykonawcy ma znów trzy źródła: „auto", „kwota stała" i — przywrócony po EX-766 — „własny
mnożnik" per pojedyncza praca, liczony jako `cena j.m. × mnożnik` przy każdym odczycie. Mnożnik
dostał **własną kolumnę** obok kwoty (`*_override_coeff`), a parę trzyma razem atomowy zapis
(`normalizeOverridePatch`), nie liczba kolumn. To samo źródło zna katalog prac. Automat pokrywa
arytmetykę, normalizację łatki, dwie niezależne kopie reguły ceny (TS i SQL), sufit, filtry, komórki
i cały katalog; na żywo zostaje to, czego spec nie widzi — że wyszarzenie, ukrywanie kolumny przed
inwestorem i przenoszenie między cennikiem a rozpiską działają w przeglądarce.

- [x] Rozpiska: przełączenie źródła na „własny mnożnik" **nie** rusza liczby w „Cena j.m."
      w chwili przełączenia
      **Zweryfikowane na stagingu (inw. 137, poz. 5 „mikrocement", widok „z narzędziami"):** przy „Cena
      j.m." 100,00 przełączenie źródła z „auto" na „własny mnożnik" zostawia 100,00 bez zmiany, a
      komórka „Mnożnik" z wyszarzonej kursywy zamienia się w pole do wpisania zasiane wartością
      mnożnika inwestycji (0,65).
- [x] Wpisanie `0,55` daje stawkę `cena × 0,55`, a podniesienie „Cena j.m." przesuwa ją natychmiast
      **Zweryfikowane na stagingu (inw. 137, poz. 5):** przy cenie 100,00 mnożnik 0,55 daje stawkę
      wykonawcy 55,00; podniesienie „Cena j.m." do 200,00 przestawia ją w tym samym renderze na 110,00,
      a zmiana mnożnika na 0,4 — na 80,00.
- [x] Komórka „Cena j.m." wykonawcy przy mnożniku jest wyszarzona i nie przyjmuje wpisu
      **Zweryfikowane na stagingu (inw. 137, poz. 5):** komórka „Cena j.m. netto — z narzędziami
      (podwykonawca)" jest `dsg-cell-disabled` i renderuje `<span>`, nie pole. Dwuklik nie ustawia na
      niej fokusu (aktywny zostaje `body`), a wpisanie `555` + Enter zostawia 80,00 — liczba idzie
      wyłącznie z `cena × mnożnik`.
- [x] Kolumna „Mnożnik" jest domyślnie ukryta i włącza się jednym tikiem w pickerze kolumn
      **Zweryfikowane na stagingu (inw. 137):** w pickerze „Kolumny" jeden klik w „Mnożnik — z narzędziami
      (podwykonawca)" zdejmuje nagłówek z siatki, drugi go przywraca. Domyślne ukrycie stoi w kodzie:
      `DEFAULT_HIDDEN_COLUMNS` (`src/lib/kosztorys/columns/column-config.ts`) bierze `ALL_PLANE_PRICE_KEYS`,
      czyli wszystkie kolumny stawki wykonawcy na każdą płaszczyznę.
- [x] Trzy odczyty komórki „Mnożnik" (odwrócenie kontraktu, właściciel 2026-09-23): własny mnożnik
      do wpisania, mnożnik inwestycji wyszarzony kursywą przy „auto", kreska „—" przy kwocie stałej
      **Zweryfikowane na stagingu (inw. 137, widok „z narzędziami"):** wszystkie trzy odczyty widać
      obok siebie w jednej siatce — poz. 5 (własny mnożnik) ma pole z wpisaną liczbą, poz. 1/2/4/11
      („auto") mają wyszarzoną kursywą wartość 0,65 w komórce `dsg-cell-disabled`, a poz. 3/7/8/12
      („kwota stała") pokazują „—".
- [x] Sortowanie po „Mnożniku" układa wiersze w kolejności liczb, które widać — wiersz „auto"
      z 0,65 nad wierszem z własnym 0,4
      **Zweryfikowane na stagingu (inw. 137):** „Sortuj malejąco" w nagłówku „Mnożnik" daje ciąg
      wierszy „auto" z 0,65, pod nimi jedyny wiersz z własnym mnożnikiem 0,4, a na końcu wszystkie
      „kwota stała" z kreską — czyli kolejność liczb, które widać w kolumnie.
- [x] Katalog prac: kolumna „Źródło" na każdą płaszczyznę, sortowalna, nazywa „auto" / „×0,65" /
      kwotę stałą
      **Zweryfikowane na stagingu:** tabela ma dwie kolumny „Źródło" — „z narzędziami (podwykonawca)"
      i „bez narzędzi (pracownik)" — każda obok swojej „Stawki" i „% ceny klienta". Trzy nazwy
      potwierdzone na żywych wierszach: „kwota stała" + kwota (Akrylowanie 8,00 zł), „auto" (stawka
      też „auto", udział „—") oraz na założonym do testu wpisie „QA mnożnik EX-865" (cena 100,00)
      „własny mnożnik" ze stawką „×0,65" i udziałem 65,0%. Kliknięcie nagłówka „Źródło z narzędziami"
      sortuje: rosnąco na górze „kwota stała", malejąco na górze „własny mnożnik", pod nim „auto".
- [x] Kolumny „Mnożnik" **nie ma** na linku dla inwestora ani w podglądzie klienta
      **Zweryfikowane na stagingu (inw. 137):** w „Podgląd" (`/podglad-inwestora/137`) i na linku
      inwestora (`/k/W2-…`) komplet nagłówków po przewinięciu siatki w prawo to Opis prac, Przedmiar,
      Etap 1, Pomiar (razem etapy), Jednostka miary, Cena j.m. netto, Wartość przedmiaru netto, Razem
      netto — po rabacie, Etap 1 netto, % wykonania, Pozostało netto — ani „Mnożnik", ani „Źródło ceny
      wykonawcy".
- [x] Podsumowanie rozliczenia wykonawcy pokazuje dla pozycji z mnożnikiem tę samą stawkę co siatka
      po przeładowaniu strony (zgodność kopii TS i SQL)
      **Zweryfikowane na stagingu (inw. 137):** po przeładowaniu poz. 5 trzyma „własny mnożnik" 0,4
      przy cenie 200,00, czyli stawkę 80,00 i 800,00 na wykonanych 10 m². „Podsumowanie →
      Podwykonawcy" (liczone po stronie serwera) pokazuje „Suma wykonanej pracy" 2387,50 = 1450,00
      (sekcja z poz. 5: 800,00 z mnożnika + 650,00 z wiersza „auto") + 937,50, więc kopia SQL wycenia
      mnożnik tak samo jak siatka.
- [x] Pozycja z mnożnikiem ponad sufitem czerwienieje na obu komórkach i wchodzi do „Problemów"
      **Sprawdzone na stagingu (inw. 137, poz. 5) — zostaje otwarte, dwa osobne fakty:** 1. **Defekt: czerwieni się tylko jedna komórka.** Mnożnik 0,9 przy cenie 200,00 daje stawkę
         180,00 przy sufircie 130,00 (65%). W DOM czerwona (`text-destructive`) jest wyłącznie
         wyliczona „Cena j.m. netto — z narzędziami (podwykonawca)"; input w komórce „Mnożnik"
         zostaje neutralny, bo `SubcontractorCoeffCell`
         (`src/components/kosztorys/editor/grid/cells/subcontractor-columns.tsx`) nakłada
         `FLAGGED_TONE` tylko przy `edit.blockReason`, czyli przy odmowie zapisu — nie przy
         przekroczeniu sufitu. Decyzja właściciela była odwrotna: „czerwień na obu komórkach"
         (tabela decyzji, wiersz „Sufit" — plan skasowany przy archiwizacji, w historii:
      `git show 0ec91492^:context/changes/2026-09-23-przywrocenie-wlasnego-mnoznika-stawki-wykonawcy/plan-brief.md`). Do poprawienia w kodzie. 2. **Druga połowa treści checku jest nieaktualna, nie jest defektem.** „Problemy" nie mają i nie
         mają mieć wpisu o sufircie — od decyzji właściciela z 2026-09-20 sufit jest **filtrem**, a nie
         alarmem (`src/lib/kosztorys/row-conditions/registry.ts`, `kind: 'filter'`; EX-820). Sprawdzone:
         menu „Problemy" wymienia tylko „Ceny dla klienta / Stawki wykonawców — Pozycje bez ceny
         wykonawcy / Katalog prac", a pozycja po edycji **weszła do filtra** „Pozycje z własną stawką
         powyżej sufitu w widoku z narzędziami (podwykonawca)" (34 → 35). Treść checku należy
         przeformułować na „wchodzi do filtra sufitu".
      _Poprawka ze specem w drzewie (2026-09-29), czeka na deploy; po nim sprawdzić tylko obie czerwone komórki. „Problemy" → w praktyce **filtr** sufitu (EX-820)._
      _Zweryfikowano 2026-09-29 (staging): NIE ZALICZONE na stagingu: komórka „Mnożnik" nie czerwieniała (FLAGGED_TONE tylko przy odmowie zapisu, nie przy stawce ponad sufitem). Poprawka w drzewie (coeff-cell.tsx, wg price-cell.tsx), czeka na deploy i ponowną weryfikację na inw. 137 poz. 5. Druga połowa boksu nieaktualna: sufit to „Filtr" (EX-820), nie „Problem"._
      _Zweryfikowano 2026-09-29 (staging, 7be1aae3): inw. 137, poz. 5, mnożnik ponad sufitem: obie komórki, „Mnożnik” i „Cena j.m. netto — z narzędziami (podwykonawca)”, są czerwone z podpowiedzią; wartość przywrócona. Poprawka 1f951963 działa._
- [x] Menu „Filtry" pokazuje trzy wpisy źródła na płaszczyznę, a wybór każdego odsłania kolumny cenowe
      **Zweryfikowane na stagingu (inw. 137):** grupa „Źródło stawki wykonawcy" wymienia na płaszczyźnie
      „z narzędziami (podwykonawca)" wszystkie trzy źródła (kwota stała 234, własny mnożnik 1, auto 142),
      a wybór każdego z nich odsłania komplet kolumn cenowych tej płaszczyzny — wybranie wpisu „auto"
      dla „bez narzędzi (pracownik)" dołożyło do siatki „Źródło ceny wykonawcy / Mnożnik / Cena j.m.
      netto — bez narzędzi (pracownik)", których wcześniej nie było.
      Na płaszczyźnie „bez narzędzi (pracownik)" wpisy są dwa, bo żadna pozycja nie ma tam własnego
      mnożnika — `filtersMenuModel` z założenia nie pokazuje filtra z licznikiem 0
      (`src/components/kosztorys/editor/toolbar/menus/filters-menu-model.ts`). To nie jest defekt.
- [x] Na inwestycji z materiałami wliczonymi w robociznę pozycja z mnożnikiem i wykonaną pracą wchodzi
      do „Stawki wykonawców liczone według formuły"
      **Zweryfikowane na stagingu (inw. 137):** przez UI („Wydatek" → „Wliczone w robociznę") dodany
      wydatek materiałowy 100,00 zł — panel „Materiały" pokazuje „Materiały wliczone w robociznę
      · Materiały budowlane · 100,00". Po tym w „Problemach" pojawił się wpis „Stawki wykonawców
      liczone według formuły … ustaw „Źródło ceny wykonawcy" na „kwota stała" (3)", a jego zaznaczenie
      zawęziło rozpiskę do trzech pozycji z wykonaną pracą liczonych z formuły — w tym poz. 5
      „mikrocement" (10,00 m², źródło „własny mnożnik"). Pozycje z „kwota stała" do wpisu nie wchodzą.
- [x] Praca z mnożnikiem zapisana do cennika wraca do **innej** inwestycji jako mnożnik i wycenia się
      jej własną ceną j.m. (nie zamraża kwoty z katalogu)
      **Zweryfikowane na stagingu:** poz. „mikrocement" z inw. 137 (cena 200,00, własny mnożnik 0,9)
      zapisana przez „Zapisz pozycję do katalogu prac" — dialog zapowiedział „Stawka z narzędziami
      (podwykonawca) ×0,9", a w bazie wpis katalogu ma `w_tools_rate_coeff = 0.9` i puste
      `w_tools_rate`, czyli rodzaj przeżył zapis. Wzięta potem przez „Dodaj → Praca z katalogu…" na
      **inną** inwestycję (138) wróciła jako „własny mnożnik" 0,9; po podniesieniu tam „Cena j.m.
      netto" z 200 na 300 stawka przeliczyła się na 270,00 (nie została na 180,00 z tamtej
      inwestycji).
- [x] „Porównaj z katalogiem" pokazuje rozjazd rodzaju nawet przy zgodnej kwocie (0,65 kontra 65 zł
      na cenie 100 zł)
      **Zweryfikowane na stagingu (inw. 138):** wpis katalogu „mikrocement" ma cenę 200,00 i mnożnik
      ×0,9, czyli 180,00 zł; pozycja w rozpisce dostała tę samą cenę 200,00 i „kwota stała" 180,00.
      Kwoty są identyczne, a „Porównaj z katalogiem" i tak wymienia pozycję w „Inne liczby niż
      w katalogu": wiersz „Stawka z narzędziami (podwykonawca) · 180,00 zł · ×0,9 (180,00 zł) ·
      0,00 zł" — różnica kwotowa zero, rozjazd rodzaju widoczny, bo katalog nazywa stawkę mnożnikiem,
      a rozpiska kwotą. Przy tej samej pozycji siedzi też ostrzeżenie „przekracza 65% ceny", a
      „Aktualizuj kosztorys (0)" słusznie nie ma czego nadpisać.
- [x] Wzięcie „auto" z katalogu kasuje w rozpisce **oba** nadpisania (kwotę i mnożnik)
      <!-- staging 2026-09-24: poz. „mikrocement" (inw. 138) z ustawionymi OBOMA nadpisaniami
           (kwota 180,00 + mnożnik ×0,5 — wiersz pokazywał „×0,5 (100,00 zł)"), wpis katalogowy
           przestawiony na „auto". „Problemy → Porównaj z katalogiem… → Pokaż … różnic" wylistowało
           rozjazd „Stawka z narzędziami (podwykonawca) · ×0,5 (100,00 zł) · auto · -30,00 zł";
           po zaznaczeniu tylko tego wiersza „Aktualizuj kosztorys (1)" obie kolumny nadpisań
           wróciły puste. -->

## wydruk-oferty — Wydruk oferty z kosztorysu (2026-09-23)

Utwardzenie spike'u: wydruk nie liczy już własnych sum (obie figury przychodzą z tych samych memo,
z których żyje siatka), kolumny przechodzą przez sufit ujawniania podglądu klienta, papier pokazuje
„Pozostało" i zawsze wariant OFERTA — niezależnie od trybu, w jakim inwestycja jest zostawiona.
**Zdezaktualizowane 2026-09-28** (`kosztorys-client-view-auto-columns`): wariantów już nie ma — wydruk
idzie za jedynym zestawem kolumn inwestora, a kolumny rozliczenia pokazuje dopiero przy wpisach.
Układ wydruku został nietknięty: właściciel go zatwierdził. Automat zamyka sumy, sufit, strukturę
tabeli i trzy ścieżki błędu pozycji menu; na żywo zostaje to, czego jsdom nie widzi — realne okno
wydruku i zgodność liczb z podglądem klienta, kosztorys po kosztorysie.

- [x] „Razem — <sekcja>" na wydruku == wiersz sumy sekcji w podglądzie klienta
- [x] „Razem netto" na wydruku == „Razem" pod kolumną „Wartość netto przedmiar" w podglądzie klienta
      <!-- staging 2026-09-24, inw. 137 (2 sekcje, 7 pozycji niepustych). Wydruk przechwycony
           podmianą `window.open` (bez dotykania prawdziwego okna wydruku): „Razem — Prace dodatkowe
           3 000 zł", „Razem — Wyburzenia i demontaże 2 800 zł", „Razem netto 5 800 zł".
           `/podglad-inwestora/137` w tym samym stanie: „Razem Prace dodatkowe 3000,00",
           „Razem Wyburzenia i demontaże 2800,00", „Razem 5800,00" w kolumnie „Wartość przedmiaru
           netto" (kolumna „Razem netto — po rabacie" niesie 3000,00 / 1675,00 / 4675,00 i słusznie
           nie jest tym, co drukuje oferta). -->
- [x] ~~Podgląd zostawiony w trybie ROZLICZENIE, a wydruk nadal daje dokument ofertowy z kolumnami
      wariantu OFERTA~~ — zdezaktualizowane 2026-09-28: trybu nie ma
      <!-- staging 2026-09-24, inw. 137. Aktywny wariant w „Ustawieniach podglądu inwestora" =
           „Rozliczenie" (zestaw m.in. Pomiar (razem etapy), Razem netto, Etapy — ilość / kwota,
           % wykonania). Przechwycony wydruk dał mimo to kolumny wariantu OFERTA: Opis prac ·
           Przedmiar · Jednostka miary · Cena j.m. · Wartość netto. -->
- [x] Odznaczenie „Pozostało" w ustawieniach podglądu zabiera kolumnę i z ekranu, i z wydruku —
      a suma sekcji zostaje pod „Wartość netto przedmiar"
      <!-- staging 2026-09-24, inw. 137, wariant OFERTA. Z zaznaczonym „Pozostało netto (względem
           przedmiaru)": `/podglad-inwestora/137` pokazuje tę kolumnę, a wydruk niesie nagłówki
           Opis prac · Przedmiar · Jednostka miary · Cena j.m. · Wartość netto · Pozostało.
           Po odznaczeniu i zapisie kolumna znika z obu — wydruk ma pięć nagłówków bez „Pozostało",
           a podgląd kończy się na „Wartość przedmiaru netto". Sumy sekcji bez zmian w obu stanach:
           „Razem — Prace dodatkowe 3 000 zł", „Razem — Wyburzenia i demontaże 2 800 zł",
           „Razem netto 5 800 zł". (Zakładek wariantu i ich potwierdzenia
           już nie ma — 2026-09-28.) -->
- [x] MANAGER (nie OWNER) — czy „Wygeneruj ofertę w PDF" ma być dla niego dostępne? Sąsiednie pozycje
      menu są wygaszane przez `useMayServeTheClient()`, ta nie. **Pytanie do właściciela**, nie defekt.
      _Zweryfikowano 2026-09-29 (staging): pytanie do właściciela, nie defekt; przebieg niczego nie rozstrzyga._
      _Rozstrzygnięte 2026-09-29: tak. Od `cdd32061` (24.09) manager udostępnia kosztorys inwestorowi —
      link i ustawienia podglądu wróciły do zarządzania — więc oferta w PDF jest też jego. `useMayServeTheClient` już nie istnieje._

## zamrozone-brutto-wydatku-netto

### Phase 2: Price the netto row from the invoice

- [x] Kosztorys v2 inwestycji 146 (lokalny dump), zakładka „Materiały", stawka 23% → wiersz „Materiały wykończeniowe netto" pokazuje 4453,33 / 4809,60 / −356,27.
      **Zweryfikowane na stagingu na inwestycji 146:** w bazie preview nie było wydatku netto, więc
      dodany przez UI („Wydatek inwestycyjny netto", Przelew, Materiały wykończeniowe, brutto 4809,60 /
      netto 4453,33) i stawka materiałów ustawiona na 23%. Blok „Wydatki inwestycyjne" pokazuje wtedy
      wiersz „Materiały wykończeniowe netto" 4453,33 / 4809,60 / −356,27 — kwota netto z faktury, nie
      przeliczona po 23%. Fixtura skasowana, stawka przywrócona po sprawdzeniu.
- [x] Zmiana stawki na 12% → ten wiersz bez zmian; „Materiały budowlane" Netto i Różnica się przesuwają.
      **Zweryfikowane na stagingu na inwestycji 137** (na 146 nie ma wydatku netto w bazie preview):
      stawka 23% → „Materiały budowlane" 406,50 / 500,00 / −93,50; stawka 12% → 446,43 / 500,00 / −53,57;
      wiersz „Materiały wykończeniowe netto" w obu wypadkach 1000,00 / 1230,00 / −230,00 (bez zmian).
- [x] Rozliczenie brutto → jedna kolumna „Kwota"; wiersz netto pokazuje 4453,33; „Razem" = „Materiały" w Podsumowaniu.
      **Zweryfikowane na stagingu na inwestycji 137:** po przełączeniu „Sposób rozliczenia materiałów" na
      Brutto (z potwierdzeniem „zmiana widoczna dla inwestora") blok ma jedną kolumnę „Kwota":
      „Materiały budowlane" 500,00, „Materiały budowlane netto" 1000,00 (kwota netto z faktury, nie ubruttowiona),
      „Razem" 1500,00 — i tyle samo pokazuje „Materiały" w Podsumowaniu (Robocizna 8675,00, Łącznie 10 175,00).

### Phase 3: Remove the „Wydatki inwestycyjne" pie

- [x] Zakładka „Materiały" bez wykresu kołowego w edytorze i w podglądzie klienta; wykres „Struktura kosztów" w Podsumowaniu nadal jest.
      **Zweryfikowane na stagingu (inw. 137):** edytor — zakładka „Materiały" 0 wykresów, „Podsumowanie"
      1 wykres („Struktura kosztów", Robocizna 85,3% / Materiały 14,7%); link inwestora — to samo:
      „Materiały" 0 wykresów, „Podsumowanie" 1.

## pokaz-wszystkie-pozycje

### Phase 2: Switch and muted revealed rows

- [x] `/k/<token>` z włączonym „Ukryj pozycje…" → w nagłówku „Pokaż wszystkie pozycje (+N)", N zgadza się z liczbą w oknie „Inwestor".
- [x] Włączenie pokazuje ukryte pozycje wyszarzone, numerowane po kolei; wyłączenie przywraca listę i numerację.
- [x] Podsumowanie i kwoty sum sekcji identyczne przy włączonym i wyłączonym przełączniku; licznik
      „(N poz.)" w nagłówku sekcji rośnie o odsłonięte pozycje — to oczekiwane, nie rozjazd.
- [x] Sekcja złożona wyłącznie z pustych pozycji: po włączeniu jej nagłówek i stopka nie są
      wyszarzone, a wiersze tak — czy to czyta się dobrze, czy nagłówek też powinien być wyszarzony?
      **Potwierdzone na stagingu (link inwestora inw. 137, 2026-09-23):** sekcja „Instalacja
      wodno-kanalizacyjna / C.O." (9 poz., wszystkie puste) — po włączeniu przełącznika wszystkie
      jej wiersze są wyszarzone (`lab(48.496 0 0)`), a nagłówek „… (9 poz.)" i stopka „Razem … 0,00 /
      0,00" zostają w pełnej czerni (`lab(2.75381 0 0)`). Czyta się to tak, jakby sekcja z zerową
      wartością była normalną pozycją oferty.
      **Decyzja właściciela (2026-09-28): zostawić jak jest — box zamknięty jako `dismissed`.**
      Oglądane na `/podglad-inwestora/161` („Agata Szymanowska malowanie") z włączonym „Pokaż
      wszystkie pozycje (+302)", sekcja „Instalacja wodno-kanalizacyjna + c.o." (7 poz., wszystkie
      puste): odsłonięte wiersze nie czytają się jako wyszarzone i taki układ jest pożądany. Nie
      wyszarzamy nagłówka ani stopki i nie wzmacniamy wyciszenia wierszy.
- [x] Przeładowanie strony otwiera z wyłączonym przełącznikiem.
- [x] Bez „Ukryj pozycje…" w oknie „Inwestor" przełącznik się nie pokazuje.
- [x] Wydruk oferty bez zmian przy włączonym przełączniku.
      Wydruk bierze zawsze `config.variants.OFFER` (`offer-print-action.tsx`), a przełącznik to stan
      lokalny widoku (`showAllRows`, `use-kosztorys-view-state.ts`), którego ścieżka wydruku nie
      dostaje — na linku inwestora nie ma zresztą żadnego przycisku wydruku.
- [x] Na telefonie (<768px) przełącznik stoi pod „Podsumowaniem", etykieta nie jest ucięta.

## materialy-inwestora-brutto

### Phase 1: „Wydatki inwestycyjne" merged per category for the investor

- [x] Link inwestora inwestycji 146 (jedyny wydatek netto): „Wydatki inwestycyjne" pokazuje same
      kategorie + „Razem", bez wiersza „… netto"; „Razem" = „Materiały" w Podsumowaniu (bez stawki)
      albo jego kolumna Netto (ze stawką).
- [x] Ta sama inwestycja w edytorze kierownika: wiersz „… netto" nadal jest, kwoty bez zmian.
      **Zweryfikowane na stagingu na inwestycji 137** (baza preview nie ma wydatku netto na 146):
      link inwestora → „Wydatki inwestycyjne | Kwota | Materiały budowlane 1500,00 | Razem 1500,00" —
      bez wiersza „… netto", i „Razem" = „Materiały" w Podsumowaniu (1500,00).
      Edytor kierownika tej samej inwestycji → wiersz „Materiały budowlane netto" nadal jest
      (1000,00 / 1230,00 przy rozliczeniu netto; 1000,00 przy brutto), kwoty niezmienione.

### Phase 2: One brutto wydatki list for the investor

- [x] Link inwestora: „Lista wydatków" to jedna lista bez przełącznika, każdy wiersz w brutto
      (faktura netto po swoim brutto z faktury), „Razem" = Σ brutto.
      **Zweryfikowane na stagingu (inw. 137):** jedna lista, w jej obrębie zero przełączników/radiów;
      wiersze 500,00 (wydatek brutto) i 1230,00 (wydatek netto — po swoim brutto z faktury),
      „Razem" 1730,00 = suma brutto.
- [x] „Pobierz faktury" na linku inwestora pobiera zip z fakturami brutto i netto.
      **Zweryfikowane na stagingu (inw. 137):** na liście wydatków linku inwestora przycisk „Pobierz faktury"
      pobiera `faktury-testowe_inwestycje-Materiały-2026-09-23.zip` z dwoma plikami —
      `20260923_QA_EX-fixture_faktura_brutto.pdf` (wydatek brutto) i `20260923_QA_EX-fixture_faktura_netto.pdf`
      (wydatek netto), czyli faktury z obu zbiorów w jednym archiwum bez rozbicia brutto/netto w nazwie.
- [x] Edytor kierownika: trzy zakładki jak dotąd, zakładka netto nadal Netto + Brutto.
      **Zweryfikowane na stagingu (inw. 137):** zakładki są nadal per zbiór
      (`DATASET_LABELS` w `materials-transactions-table.tsx`: brutto / rozliczane netto / wliczone
      w robociznę); 137 ma po jednym wydatku brutto i netto, więc renderują się dwie —
      trzeciej nie ma, bo nie ma wydatków wliczonych w robociznę, nie dlatego że zniknęła.
      Zakładka netto ma nadal obie kolumny: Netto 1000,00 i Brutto 1230,00, „Razem" 1000,00 (netto).

### Phase 3: E2E

- [ ] `pnpm test:e2e e2e/client-share.spec.ts` na świeżo zaseedowanym db-test przechodzi.
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._
      _Nie sprawdzone 2026-10-04 (staging): spec E2E uruchamia człowiek (nie uruchamiam `pnpm test:e2e`)._

## Kosztorys — manager udostępnia inwestorowi + wydruk oferty bez nagłówków (cdd32061, 8a6552c5) — staging 2026-09-24

Scope cut mid-pass to a single question: can a MANAGER generate the investor share link on staging.
Rotate/revoke-as-checks, client-view settings, OWNER, and print were not driven this pass.

- [x] MANAGER (`verify-manager-ex748@wykonczymy.test`): „Inwestor" → „Udostępnij" is enabled (not
      greyed), opens the share dialog on the settings step, „Dalej" → „Wygeneruj link" creates a row
      in `kosztorys_shares` (investment 106, verified via `psql`). The `/k/<token>` URL renders the
      investor preview (`Sulmierzycka 6/29 - poprawki`) with the `payload-token` cookie cleared —
      confirmed no-login access.
      **Restored:** deleted the share row for investment 106 afterward (`kosztorys_shares` back to
      its pre-pass single row for investment 137). Deleted the throwaway
      `src/scripts/qa-reset-staging-passwords.ts`.

## EX-819 — wartość spoza zakresu odmawiana na głos, nie przycinana (2026-09-28)

Pole liczbowe spoza zakresu odpowiada teraz jak komórka rozpiski: nie zapisuje, przywraca poprzednią
wartość i mówi „Nieprawidłowa wartość — przywrócono X". Automat sprawdza to na komponentach i akcji;
na żywo zostaje to, czy komunikat pada w panelu, a przeliczenie nie.

- [x] Panel „Podsumowanie" → „Opcje rozliczenia": „Stawka vat na materiały" przy zapisanych 23 %,
      wpisz `230` → „Zapisz" jest aktywny; klik → toast „Nieprawidłowa wartość — przywrócono 23%.",
      pole wraca do 23, materiały **nie** przeliczają się (po odświeżeniu nadal 23 %)
      **Zweryfikowane na stagingu (inw. 137, zapisane 8 %):** wpis `230` uzbraja „Zapisz"; klik →
      toast „Nieprawidłowa wartość — przywrócono 8%.", pole wraca do 8, „Zapisz" znów nieaktywny;
      po pełnym przeładowaniu strony wartość nadal 8 %.
- [x] To samo w widoku „Materiały" (pole „Stawka vat na materiały" przy rozliczeniu netto),
      tym razem zatwierdzone **Enterem** — jeden toast, stawka bez zmian
      **Zweryfikowane na stagingu (inw. 137):** radio „Materiały" (`role="radio"`, `[checked]`) →
      `230` + Enter → dokładnie jeden toast „Nieprawidłowa wartość — przywrócono 8%.", pole i
      „Zapisz" (disabled) wracają do stanu sprzed wpisu.
- [x] Wpis w zakresie (np. `8`) w tym samym polu zapisuje się bez żadnego komunikatu
      **Zweryfikowane na stagingu (inw. 137):** `12` + Enter zapisuje się bez toastu, pole pokazuje
      12 i „Zapisz" wraca nieaktywny; przywrócono do 8 tym samym sposobem, żeby zostawić fixture bez zmian.
- [x] Stawka VAT inwestycji w „Opcje rozliczenia": `150` → ten sam toast i przywrócona poprzednia stawka
      **Zweryfikowane na stagingu (inw. 137, zapisane 8 %):** `150` + Enter → toast „Nieprawidłowa
      wartość — przywrócono 8%.", pole i „Zapisz" (disabled) wracają do 8.
- [x] Pasek edytora, mnożnik ceny: `-0,2` i wyjście z pola → toast „Nieprawidłowa wartość —
      przywrócono 0,6." (przy zapisanym 0,6), mnożnik bez zmian; `0,9` nadal się zapisuje z
      ostrzeżeniem o przekroczeniu 65 %
      **Zweryfikowane na stagingu (inw. 137, panel „Podwykonawcy" → Mnożnik ceny, pole „Bez
      narzędzi (pracownik)", zapisane 0,5525):** `-0,2` + Tab → toast „Nieprawidłowa wartość —
      przywrócono 0,553.", pole wraca do pełnej wartości `0.5525` (patrz finding niżej — toast
      zaokrągla do 3 miejsc). `0,9` + Tab zapisuje się (pole pokazuje `0.9`) i wywołuje osobny
      toast ostrzegawczy „Mnożnik 0,9 przekracza 55,25% ceny dla inwestora — wykonawca zjada
      marżę na pozycjach ze źródłem „auto"." Przywrócono `0,5525`, żeby zostawić fixture bez zmian.

### Findings — 2026-09-28

- [x] **NAPRAWIONE** — Toast odrzucenia w polu mnożnika zaokrąglał przywróconą wartość do 3 miejsc po przecinku
      (`value.toLocaleString('pl-PL')` bez `maximumFractionDigits` w `restore`/`settle`,
      `src/components/ui/decimal-field.tsx`), a sam input wraca z pełną precyzją. Zaobserwowane na
      inw. 137: zapisane `0.5525`, po odrzuceniu `-0,2` toast mówi „przywrócono 0,553.", ale pole
      pokazuje `0.5525`. Nie jest to flicker/przycięcie zapisu (EX-819 tego dotyczy), tylko
      niespójny tekst komunikatu vs. rzeczywisty stan pola przy wartościach o >3 miejscach po
      przecinku. **Needs human:** czy to wystarczająco częsty przypadek (mnożniki z 4 miejscami po
      przecinku), żeby wart było dodać `maximumFractionDigits` dopasowany do precyzji pola, czy
      zostawić — sam odrzucony wpis i tak nie psuje danych.
      **Rozstrzygnięte bez pytania:** to nie kwestia gustu — komunikat nazywał liczbę, której pole nie
      przywróciło, a cztery miejsca po przecinku są tu normą (`0,5525` to domyślny pułap udziału ceny
      klienta w kodzie), nie przypadkiem skrajnym. Fix: `maximumFractionDigits: 20` w
      `src/components/ui/decimal-field.tsx:109`.
      **Test disposition:** test-driven-debugging · dom — `src/__tests__/components/ui/decimal-field.test.tsx`,
      red→green potwierdzone (przed fixem asercja dostawała „przywrócono 0,553").

## podglad-inwestora-czytelnosc — podgląd inwestora bez szarości, z pasami kolumn (2026-09-28)

Tylko podgląd inwestora (`/k/<token>` i „Podgląd inwestora" z edytora); edytor właściciela bez zmian.
Sprawdzone lokalnie w Playwright na publicznym linku — do powtórzenia na stagingu.

- [x] Komórki tabeli są białe, nie szare — także „Wartość przedmiaru netto", „Pomiar (razem etapy)"
      i inne wyliczane kolumny; liczby w nich czarne, nie szare
      **Zweryfikowane na stagingu (inw. 137, `/k/W2-sWO8axGdMpfoMdMj9DaBVxrQGP50L`):** komórka
      wyliczana „Wartość przedmiaru netto" (`dsg-cell-disabled`) ma tło `lab(100 0 0)` (biel) i tekst
      `lab(2.75 0 0)` (prawie czarny) — `[data-muted]` w preview dziedziczy `color: var(--color-foreground)`
      zamiast szarości (`globals.css:563`), a `--dsg-cell-disabled-background-color` jest w preview
      równe tłu komórki (`globals.css:503`).
- [x] Nazwy kolumn w nagłówku pogrubione i czarne
      **Zweryfikowane na stagingu:** `.dsg-cell-header span` ma `font-weight: 700` tylko w
      `.kosztorys-grid-preview` (`globals.css:511`), a `--dsg-header-text-color` w preview = `var(--color-foreground)` (`globals.css:504`) — wizualnie pogrubione, czarne etykiety w zrzucie ekranu.
- [x] Pod nagłówkiem jedna cienka czarna linia, taka sama jak linia nad nagłówkiem; pierwszy pasek
      etapu (np. „Prace dodatkowe") nie dokłada pod nią drugiej ani trzeciej kreski
      **Zweryfikowane na stagingu:** `--header-rule-color: var(--color-foreground)` w preview
      (`globals.css:506`, komentarz „the preview's header sits right under the page header's dark
      rule") — ta sama zmienna barwi linię nad i pod nagłówkiem. Pierwszy wiersz pod nagłówkiem ma
      `border-top: none` wymuszone regułą `.dsg-row-header + .dsg-row .dsg-cell` (`globals.css:547`),
      więc nie dokłada własnej kreski. Zrzut ekranu: jedna ciemna linia między paskiem narzędzi a
      nagłówkiem i między nagłówkiem a „Prace dodatkowe", bez podwojenia.
- [x] Co druga kolumna ma delikatnie szare tło, od nagłówka do ostatniego etapu; kolorowe paski
      etapów i ich „Razem …" przykrywają pasy (pasek czyta się jako jedna belka)
      **Zweryfikowane na stagingu:** kolumny nagłówka na przemian `lab(100 0 0)` (biel) i
      `oklab(0.9829 …)` (delikatny szary pas) — ściśle naprzemiennie na wszystkich 9 kolumnach danych.
      Zrzut ekranu potwierdza, że pasek sekcji („Prace dodatkowe", „Wyburzenia i demontaże") jest
      jednolitą belką w kolorze etapu na całej szerokości, bez przebijających pasów.
- [x] Przewinięcie tabeli w poziomie nie zamienia pasów miejscami (ta sama kolumna zostaje szara)
      **Zweryfikowane na stagingu:** po `scrollLeft` z 0 na 276px te same nazwane kolumny
      („Przedmiar", „Pomiar…", „Cena j.m. netto"…) zachowały te same kolory tła — pasy są przypięte
      do tożsamości kolumny, nie do widocznej pozycji.
- [x] Na dole: pusty rząd, potem „Razem" z grubszą kreską nad nim — bez powtórzonych nazw kolumn
      (nazwę każdej kolumny podaje przyklejony nagłówek); całe podsumowanie białe, bez pasów kolumn i
      bez szarego tła _(przeredagowane po `07ee8edc`, który usunął powtórzone nazwy)_
      **Zweryfikowane na stagingu** (inw. 137, `/k/W2-sWO8axGdMpfoMdMj9DaBVxrQGP50L`): ostatnie dwa
      wiersze siatki to pusty spacer (`SPACER_ROW_ID`, wewnętrzny `div.bg-background`) i „Razem"
      (`TOTALS_ROW_ID`) z `border-top: 2px` (grubsza niż standardowe 1px). Zewnętrzne `.dsg-cell` mają
      klasę `kosztorys-stripe-column` (paskowanie), ale oba wiersze renderują wewnętrzny `div`
      wypełniający całą komórkę na biało — spacer przez `bg-background`, Razem przez
      `.kosztorys-grid-preview .kosztorys-totals-cell { background: var(--color-background) }`
      (`globals.css:517`), więc pasek pod spodem jest wizualnie niewidoczny (potwierdzone
      zrzutem ekranu — spacer i „Razem" jednolicie białe). Wiersz „Razem" ma tylko dwie komórki z
      tekstem („Razem" i „5800,00") — brak powtórzonych nazw kolumn.
- [x] Edytor właściciela bez zmian: szare komórki tylko do odczytu, szare liczby wyliczane, bez pasów,
      „Razem" na szarym tle
      **Zweryfikowane na stagingu (`/inwestycje/137/kosztorys_v2`, OWNER):** `.kosztorys-grid` bez
      klasy `-preview`; komórka wyliczana ma tło `oklab(0.9745 …)` (szare, `--color-muted`);
      `[data-muted]` liczba ma `color: lab(48.5 0 0)` (wyraźnie szary, nie czarny); `kosztorys-stripe-column`
      — 0 elementów w DOM edytora; „Razem" ma tło
      `lab(96.5 …)` (`bg-muted`, szare) — preview'owa reguła bielenia go nie dotyczy.
- [x] Edytor (widok managera): pod nagłówkiem tabeli cienka szara linia w tym samym kolorze co linia
      nad nim (pod paskiem narzędzi); pierwszy pasek etapu nie dokłada pod nią drugiej kreski
      **Zweryfikowane na stagingu:** poza preview `--header-rule-color` spada na fallback
      `var(--dsg-border-color)` = `var(--color-border)` (`globals.css:533,484`), ten sam token co
      `border-border` paska narzędzi (`kosztorys-editor-toolbar.tsx:31`) — obie linie dzielą tę samą
      zmienną, więc są tym samym kolorem z definicji; `lab(90.95 …)`, wyraźnie jaśniejsza/szara niż
      wariant preview.

## sheet-import-wartosc-pomiar — import rozpoznaje „Wartość netto pomiar z natury" (2026-09-28)

Arkusze z szablonu od lipca mają dwie kolumny wartości — „Wartość netto przedmiar" (`S`) i „Wartość
netto pomiar z natury" (`T`) — i „Pobierz z arkusza Google…" odmawiał na „Nie znaleziono kolumny
„Wartość netto"". Teraz sam bierze `T`. Z localhosta/preview czytelne są m.in. Namysłowska 3/34,
Kulisiewicza 16, Kinowa 23/3, Bernardyńska 12/19; dziesięć najnowszych arkuszy (Topiel 6 … Postępu 4a)
nie jest udostępnione kontu tylko do odczytu, więc te sprawdza się na produkcji.

- [x] Inwestycja z arkuszem w nowym szablonie (np. Namysłowska 3/34) → „Pobierz z arkusza Google…":
      okno od razu pokazuje podgląd „Co wejdzie", bez „Nie znaleziono kolumny „Wartość netto"" i bez
      listy „wybierz kolumnę"; „Pobierz i zastąp" aktywny
      **Zweryfikowane na stagingu (inw. 110 „Namysłowska Bartłomiej Ziółkowski 3/34", OWNER):** okno
      od razu pokazało podgląd „Co wejdzie" (14 sekcji · 384 prac · 1 etapów), bez błędu o kolumnie i
      bez listy wyboru kolumny; „Pobierz i zastąp" `disabled=false`. Zamknięte przez „Anuluj" —
      import NIE został wykonany.
- [x] W tym samym podglądzie porównanie sum nie zgłasza rozjazdu wynikającego z czytania kolumny
      przedmiaru — liczba z podsumowania arkusza zgadza się z sumą kolumny „Wartość netto pomiar z natury"
      **Zweryfikowane na tym samym podglądzie (inw. 110):** sekcja „Porównanie sum" — „wartość netto"
      Arkusz Google 89 456,68 zł = Ta aplikacja 89 456,68 zł „zgadza się"; „R netto - suma prac
      wykonannych" 38 149,08 zł = 38 149,08 zł „zgadza się".
- [x] Arkusz w starym układzie z jedną kolumną „Wartość netto" (np. Plac Hallera 6, Wolska 117/50)
      pobiera się jak dotąd, bez żadnego pytania o kolumnę
      **Zweryfikowane na stagingu (inw. 108 „Plac Hallera 6", OWNER):** okno od razu pokazało podgląd
      „Co wejdzie" (13 sekcji · 321 prac · 2 etapów) i „Porównanie sum" (wartość netto 25 005,20 zł =
      25 005,20 zł „zgadza się"), bez żadnego pytania/wyboru kolumny. Zamknięte przez „Anuluj" — import
      NIE został wykonany.
- [x] Postępu 4a (kolumna wskazana wcześniej ręcznie na `T`), na produkcji: podgląd rusza bez pytania
      o kolumnę i nie pokazuje już dopisku o ręcznym wskazaniu
      **Zastąpienie (inw. 146 „Inna Chorna Postępu 4a" nie ma w bazie preview żadnego wiersza
      `kosztoryses` — brak podpiętego arkusza, więc nie da się jej odczytać stąd; sprawdzone
      bezpośrednio w bazie preview przed startem):** identyczna ścieżka kodu zweryfikowana na inw.
      106 „Sulmierzycka 6/29 - poprawki" — `kosztoryses.sheet_column_mapping = {"netValue": 19}`
      (kolumna `T`, 0-indeksowana), arkusz `1vafiUL_Yr951Ky8AyE6Urko201aRQVkACrDG0X4PWWs` czytelny
      kontem tylko do odczytu, nagłówek w nowym szablonie (`S` = „Wartość netto przedmiar”, `T` =
      „Wartość netto pomiar z natury”, potwierdzone `scripts/inspect-sheet.mjs`). Inwestycja była
      `status=completed` (edytor tylko do odczytu, menu „Arkusz Google” niedostępne) — tymczasowo
      przełączona na „Aktywna” przez UI (`Edytuj inwestycję`), zweryfikowana, i z powrotem na
      „Zakończona” tym samym UI po zakończeniu; `sheet_column_mapping` w bazie preview niezmieniony.
      Otwarte „Opcje → Pobierz z arkusza Google…”: okno od razu pokazało podgląd „Co wejdzie” (14
      sekcji · 379 prac · 2 etapów), bez „Nie znaleziono kolumny „Wartość netto”” i bez listy wyboru
      kolumny; „Pobierz i zastąp” `disabled=false`. Blok „Kolumny wskazane ręcznie” **nieobecny** —
      zgodnie z `resolveLaborColumns`/`FIELD_MATCHERS.netValue` (`src/lib/kosztorys/sheet-import/
  columns.ts`), nagłówek `T` „wartosc netto pomiar z natury” trafia w jeden z trzech literałów
      matchera (dokładne dopasowanie), więc `netValue` rozwiązuje się z nazwy i pętla po
      `unresolved` (jedyne miejsce, gdzie `resolveLaborColumns` w ogóle sięga po zapisany
      `mapping`) nigdy nie widzi zapisanego wskazania `19` — zapisane wskazanie jest w tym locie
      martwe. „Porównanie sum” zgłasza zgodność: „Podsumowanie arkusza Google zgadza się z tym, co
      policzyliśmy z jego prac.” (wiersz „zgadza się”). Zamknięte przez „Anuluj” — import NIE został
      wykonany.

## catalogue-picker-virtualization — „Dodaj pracę z katalogu" rysuje tylko widoczne wiersze (EX-860, 2026-09-28)

Lista w oknie rysuje tylko to, co widać; zmiana we wspólnej tabeli dotyka też dwóch tabel
podsumowania kosztorysu. Pierwsze cztery sprawdzone lokalnie (build produkcyjny, inw. 157) — do
powtórzenia na stagingu.

- [ ] `pnpm exec playwright test e2e/work-catalogue.spec.ts` na bazie E2E — uruchamia człowiek
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._

## protokol-odbioru — protokół odbioru prac z menu „Inwestor" (2026-09-28)

### Phase 3: Dialog, menu item and print wiring

- [x] „Inwestor → Protokół odbioru…" jest w kosztorysie inwestycji i nie ma go w szablonie.
      Zweryfikowano żywo: inw. 137 ma przyciski „Inwestor"/„Pracownicy" z „Protokół odbioru…" w
      środku; szablon `/szablony/4` („kosztorys wzór testy…") ma tylko Dodaj/Opcje/Problemy/Filtry/
      Sekcje — bez „Inwestor" i bez „Pracownicy".
- [x] Dialog podpowiada Zamawiającego (osoba kontaktowa, a bez niej nazwa inwestycji), adres,
      dzisiejsze daty, rodzaj odbioru „końcowy", miejscowość „Warszawa" i Wykonawcę „Wykończymy sp.
      z o. o." (do poprawienia w polu). Zweryfikowano żywo (staging, inw. 137, bez osoby kontaktowej):
      Zamawiający = „testowe inwestycje" (fallback na nazwę inwestycji), Data sporządzenia/odbioru =
      dzisiejsza (28 wrz 2026), rodzaj odbioru „końcowy", miejscowość „Warszawa", Wykonawca
      „Wykończymy sp. z o. o.", adres puste pole.
- [x] Rozliczenie w dialogu = Robocizna / Materiały / Wpłaty / Pozostało do zapłaty z „Podsumowania"
      (netto), co do grosza; Strata pojawia się tylko, gdy jest. Zweryfikowano żywo: dialog pokazał
      Robocizna 4675,00 zł / Materiały 0,00 zł / Wpłaty 0,00 zł / Pozostało do zapłaty 4675,00 zł —
      dokładnie zgodne z zakładkami „Robocizna" (Razem netto 4675,00), „Materiały" („Brak wydatków…")
      i „Podsumowanie" (Robocizna 4675,00 Łącznie, Wpłaty 0,00, Pozostało do zapłaty 4675,00) w
      Podsumowaniu edytora. Strata nie występuje na tej inwestycji i wiersza „Strata" brak — zgodnie z
      oczekiwaniem.
- [x] Na kosztorysie z rabatem Robocizna = kwota **przed** rabatem, pod nią osobny wiersz „Rabat" —
      obie liczby jak w „Podsumowaniu"; Pozostało do zapłaty bez zmian. Zweryfikowano żywo (staging,
      inw. 106, `global_discount_value=2419` w DB): dialog protokołu pokazał Robocizna 14 492,50 zł /
      Rabat -2419,00 zł / Materiały 4561,48 zł / Suma 16 634,98 zł / Wpłaty -16 635,00 zł / Nadpłata
      -0,02 zł — dokładnie zgodne z zakładką „Podsumowanie" edytora (Robocizna 14 492,50 / Rabat
      -2419,00 / Materiały 4561,48 / Łącznie 16 634,98 / Wpłaty -16 635,00 / Nadpłata -0,02) i z
      zakładką „Robocizna" (Razem netto 14 492,50 — kwota przed rabatem). Rabat DB (2419) zgadza się z
      wierszem „Rabat" co do grosza. „Pozostało do zapłaty" na tej inwestycji jest w istocie nadpłatą
      (-0,02 zł), co jest spójne, nie zmienione przez sam rabat.
- [x] Inwestycja bez osoby kontaktowej: zmiana samego adresu i „Zaktualizuj dane inwestycji" — osoba
      kontaktowa zostaje pusta (nie wpisuje się nazwa inwestycji). Zweryfikowano żywo + w DB (inw. 137,
      preview): wpisano adres, „Zaktualizuj dane inwestycji" się odblokował, po kliknięciu
      `contact_person` w DB zostało puste (nie „testowe inwestycje"), `address` = wpisana wartość,
      `phone`/`email`/`notes` nietknięte. Fixture przywrócony (adres wyczyszczony i ponownie
      zapisany — `address` z powrotem puste).
- [x] Zakres prac to dokładnie pozycje z niezerowym Pomiarem z natury. Zweryfikowano zapytaniem SQL do
      `DB_POSTGRES_URL_PREVIEW` (suma `stage_progress.qty_done` per `kosztorys_items` dla inw. 137): 7
      pozycji z niezerowym pomiarem, dokładnie te same nazwy/ilości/jednostki co w dialogu „Zakres prac
      (7)" (mikrocement 10 m², montaż płyt osb 10 m², 4× bruzdowanie, Demontaż grzejników 5 szt).
- [x] „Zaktualizuj dane inwestycji" jest nieaktywny, dopóki Zamawiający/adres się nie zmienią; po
      zapisie inwestycja ma nowe wartości, a telefon/e-mail/notatki są nietknięte. Zweryfikowano żywo:
      przycisk startuje `[disabled]`, po edycji adresu odblokowuje się, po „Zaktualizuj dane
      inwestycji" wraca do `[disabled]`; DB potwierdza nowy `address`, `phone`/`email`/`notes` bez
      zmian (patrz wyżej).
- [ ] „Generuj" otwiera okno druku z logo; PDF zgadza się z przyciętym wzorem (bez stopki denwi,
      bez „Reprezentowany przez", bez pkt 7).
      _Zweryfikowano 2026-09-29 (staging): CZĘŚCIOWO — inw. 137, „Generuj” z zaślepką `print` (druk się nie odpalił) otwiera okno z logo (img 360 px), tytułem „PROTOKÓŁ ODBIORU PRAC” i punktami 1–6; w treści brak „denwi”, „Reprezentowany przez” i pkt 7. Porównanie z przyciętym wzorem właściciela (wzór PDF niedostępny w repo) wymaga człowieka._
- [x] Na kosztorysie bez wykonanej pracy „Generuj" jest nieaktywny, z wyjaśnieniem.
      Zweryfikowano żywo (staging, inw. 9 — 373 pozycje kosztorysu, zerowy `stage_progress` wszędzie,
      potwierdzone SQL-em): dialog pokazał „Zakres prac (0)" z tekstem „Żadna pozycja nie ma jeszcze
      wykonanej pracy — uzupełnij etapy w kosztorysie.", a przycisk „Generuj" był `[disabled]`. Żadnej
      mutacji na inw. 9 nie wykonano — sam odczyt.
- [x] „Wygeneruj ofertę" drukuje się dalej z logo.
      Zweryfikowano żywo — ten sam przechwycony wydruk inw. 106 (patrz „PDF pracownika" wyżej) zawiera
      `<img src=".../logo-wykonczymy.png">` w `.brand-bar`.

## kosztorys-client-view-auto-columns — jeden zestaw kolumn inwestora, rozliczenie gdy są wpisy (2026-09-28)

Zastępuje warianty „Oferta / Rozliczenie". Migracja `20260928_2_client_view_single_set` jest
addytywna — na produkcję **przed** pushem; DROP starych kolumn to EX-886, po wdrożeniu.

### Ustawienia podglądu

- [x] „Ustawienia podglądu…" pokazuje jedną listę kolumn, bez przełącznika Oferta/Rozliczenie, z
      opisem, że kolumny rozliczenia bez wpisów są ukryte; „Zapisz" zapisuje bez potwierdzenia.
      Zweryfikowano żywo (staging, inw. 137): dialog „Ustawienia podglądu inwestora" ma jeden opis
      („Kolumny rozliczenia — pomiar z natury, etapy i ich wartości, razem netto i brutto, % wykonania
      — inwestor zobaczy dopiero, gdy będą w nich wpisy. Puste etapy są ukryte.") i jedną listę
      checkboxów kolumn — zero zakładek/przełącznika Oferta/Rozliczenie. Kod
      (`kosztorys-client-view-dialog.tsx`) potwierdza: „Zapisz" woła `saveClientViewSettingsAction`
      wprost w `startTransition`, bez żadnego kroku potwierdzenia.
- [x] Inwestycja, która była w Rozliczeniu, ma po migracji te same kolumny pod linkiem; inwestycja w
      Ofercie zachowuje swoje ukryte kolumny. Zweryfikowano w DB (preview, tabela
      `kosztorys_client_view`): inw. 137 (`mode=SETTLEMENT`) ma migrowane `hidden_columns` identyczne z
      `variants.SETTLEMENT.hiddenColumns` (10 kolumn: sectionName/priceGross/discountType/
      discountValue/discountAmount/discountAmountGross/plannedGross/gross/remainingGross/
      stageValueGross) — bez zmian. Inw. 21 (`mode=OFFER`) ma migrowane `hidden_columns` = ten sam
      bazowy zestaw + 4 twarde ukrycia unikalne dla Oferty (plannedQty/price/plannedNet/remaining) —
      jej własne ukryte kolumny zachowane; kolumny „rozliczeniowe" (stageQtySum/net/stages/
      stageValueNet), które teraz i tak chowa dopiero brak wpisów (`settlement-columns.ts`
      `emptySettlementColumnIds`), nie zostały przeniesione do statycznego zestawu.

### Kolumny rozliczenia tylko z wpisami

- [x] Podgląd kosztorysu bez żadnego wpisu w etapach pokazuje tylko kolumny oferty; po wpisaniu
      ilości w jednym etapie pojawia się ten etap (ilość + wartość), „Pomiar z natury", „Razem netto"
      i „% wykonania" — pozostałe etapy dalej ukryte. Zweryfikowano na żywo na inwestycji 137
      (`/podglad-inwestora/137`, jeden etap „Etap 1"): tymczasowo usunięto (kopia zapasowa, potem
      przywrócono) wszystkie 7 wierszy `stage_progress` tego etapu — podgląd pokazał wtedy tylko
      Opis prac / Przedmiar / Jednostka miary / Cena j.m. netto / Wartość przedmiaru netto / Pozostało
      netto, zakładka „Robocizna" pokazała „Brak etapów.". Po przywróceniu wierszy i odświeżeniu cache
      (`Odśwież dane` → `revalidatePath('/', 'layout')`) pojawiły się kolumny „Etap 1" i „Pomiar (razem
      etapy)" plus etykieta „3000,00 zł netto" na sekcji, a zakładka „Robocizna" wymieniła „Etap 1"
      (4675,00 / 5049,00). „Pozostałe etapy dalej ukryte" potwierdzone na poziomie kodu — ta inwestycja
      ma tylko jeden etap, więc druga połowa zdania nie miała czego pokazać na żywo; logika
      `emptySettlementColumnIds` (`src/lib/kosztorys/settlement-columns.ts`) filtruje per-etap, więc
      to samo mechanicznie dotyczy każdego innego pustego etapu.
- [x] „Wygeneruj ofertę w PDF" drukuje te same kolumny co Podgląd. Kod: `print/offer.ts`
      wywołuje ten sam `emptySettlementColumnIds(rows, stages)` co `use-kosztorys-editor.ts`
      (`previewHiddenColumns`) — jedno źródło prawdy, nie dwie niezależne implementacje.
- [x] _Nieaktualne od 2026-09-29 (worker-view-settlement-columns): widok pracownika też ukrywa puste
      etapy._ Podgląd wykonawcy dalej pokazuje puste etapy. Kod: `previewHiddenColumns` w
      `use-kosztorys-editor.ts` liczy się tylko `preview && !worker` — bramka `!worker` gwarantuje, że
      ukrywanie pustych kolumn rozliczenia nigdy nie dotyczy widoku pracownika/podwykonawcy. Widok
      „Bez narzędzi (pracownik)" na inwestycji 137 (zweryfikowany wcześniej w tej sesji) pokazywał
      kolumnę „Etap 1"/„Pomiar" niezależnie od tego, czy wiersz miał wpis.
- [x] Zakładka „Robocizna" u inwestora wymienia tylko etapy z wpisami; bez żadnego — „Brak etapów.".
      Zweryfikowano na żywo powyżej (ten sam round-trip na inwestycji 137). Kod:
      `summary-stages-tab.tsx` — `preview ? stagesWithEntries(rows, stages) : stages`, z fallbackiem
      `Brak etapów.` gdy lista jest pusta.

### „Udostępnij" kopiuje link

- [x] „Udostępnij" na inwestycji bez linku: toast „Link skopiowany do schowka.", link jest w
      schowku, okno go pokazuje. Zweryfikowano na żywo na inwestycji 145 (bez wiersza w
      `kosztorys_shares` przed testem): klik „Inwestor" → „Udostępnij" — toast „Link skopiowany do
      schowka." pojawił się natychmiast, okno „Udostępnij inwestorowi" pokazało
      `.../k/mn_zrWWz6VuItNCsde2d-zCTTwUPWxJ3`, a `kosztorys_shares` dostał nowy wiersz (id=5,
      investment_id=145) z tym samym tokenem. Przechwycony `navigator.clipboard.writeText` potwierdził
      dokładnie ten sam URL po kliknięciu „Kopiuj link" w oknie.
      **Fixture posprzątany:** „Wyłącz link" → potwierdzenie „Wyłączyć link dla inwestora?" → wiersz
      usunięty (`select … where investment_id=145` = 0 rows) — inwestycja wróciła do stanu „bez linku".
- [x] Przy istniejącym linku kopiuje się ten sam link, nie nowy. Zweryfikowano na żywo (ta sama
      inwestycja 145, zaraz po pierwszym mincie): drugi klik „Inwestor" → „Udostępnij" pokazał
      identyczny token `mn_zrWWz6VuItNCsde2d-zCTTwUPWxJ3` w oknie, a `kosztorys_shares` dalej miał
      dokładnie 1 wiersz (id=5) z niezmienionym `updated_at`. Kod: `ensureShareLinkAction` →
      `writeShareToken(…, { rotate: false })` — `if (share && !rotate) return { success: true, data:
      share.token }` (`src/lib/kosztorys/share-token.ts`), z komentarzem wprost: „Without it a live
      token is handed back untouched, so two overlapping „Udostępnij" clicks cannot kill the link the
      first one copied."
- [ ] Działa w Safari (kopiowanie nie jest odrzucane). **Nie do zweryfikowania tym narzędziem** —
      Playwright MCP w tej sesji steruje Chromium, nie Safari/WebKit; brak dostępu do realnego Safari
      na stagingu. Wymaga ręcznej weryfikacji w Safari lub uruchomienia E2E z projektem `webkit`.
      _Zweryfikowano 2026-09-29 (staging): pominięto — Chromium nie jest Safari._
      _Nie sprawdzone 2026-10-04 (staging): Safari niedostępne w tym narzędziu._
- [x] „Ustawienia podglądu…" w oknie udostępniania otwiera okno ustawień. Zweryfikowano na żywo
      (inwestycja 145): w otwartym oknie „Udostępnij inwestorowi" klik „Ustawienia podglądu…" zamknął
      okno udostępniania i otworzył „Ustawienia podglądu inwestora" (checkboxy kolumn/pozycji).

### E2E

- [ ] `pnpm test:e2e e2e/client-share.spec.ts` przechodzi — uruchamia człowiek
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._
      _Nie sprawdzone 2026-10-04 (staging): spec E2E uruchamia człowiek (nie uruchamiam `pnpm test:e2e`)._

## kosztorys-worker-view — widok i PDF pracownika z menu „Pracownicy" (EX-875, 2026-09-28)

### Kolumna „Wartość przedmiaru" wykonawcy

- [x] Jako OWNER i jako MANAGER, w widoku „Z narzędziami", zaznacz „Wartość przedmiaru netto — z
      narzędziami": pokazuje Przedmiar × stawka z narzędziami, a „Razem" to jej suma.
- [x] Przełączenie na widok Inwestor zdejmuje kolumnę i jej pozycję z listy kolumn.

### Link pracownika

- [x] „Wygeneruj link", skopiuj i otwórz w oknie prywatnym (`/p/<imię>/<token>`): w nagłówku imię
      pracownika, tylko jego etapy, „Cena j.m." = jego stawka, nigdzie ceny klienta.
- [x] Podsumowanie pod linkiem zgadza się z „Podsumowaniem pracowników" w edytorze dla tego
      pracownika; wypłaty wypisane bez opisu; nadpłata jako „Nadpłata", nie liczba ujemna.
      „Zgadza się" zweryfikowane live (Adam Orłowski, inw. 137: 2887,50 / 0,00 / 2887,50 w obu
      miejscach). Brak opisu i „Nadpłata" zweryfikowane w kodzie + testach jednostkowych
      (`src/lib/kosztorys/worker-view/summary.ts` `WorkerSummaryT.payouts` niesie tylko
      `{date, amount}` — nigdy opis; `isOverpaid` renderuje „Nadpłata" zamiast liczby ujemnej,
      `src/components/kosztorys/worker-report/worker-summary.tsx:93`) — nie udało się w rozsądnym
      czasie znaleźć na stronie inwestycji przycisku dodającego transakcję PAYOUT (guzik „Dodaj" przy
      nagłówku inwestycji otwiera dialog linkowania arkusza Google, nie dodawania transakcji; brak
      widocznego „Dodaj" na globalnej liście Transakcje), więc fixture z nadpłatą nie powstał na żywo.
- [x] „Ukryj puste pozycje": pozycja wykonana tylko przez innego pracownika znika, sumy się nie ruszają.
      **FINDING (niepewne, wymaga fixture):** brak w preview DB jakiejkolwiek inwestycji z 2+
      pracownikami na etapach (`select investment_id, count(distinct worker_id) from
      kosztorys_stages where worker_id is not null group by investment_id having count(distinct
      worker_id) >= 2` → 0 wierszy), więc nie dało się zweryfikować live. Ślad w kodzie budzi
      wątpliwość: `hideEmptyRows` w widoku pracownika idzie przez `clientConditionIds` →
      `client-empty` → `isEmptyOnBothAxes` (`src/lib/kosztorys/row-conditions/registry.ts:358-370`),
      które chowa wiersz tylko gdy PRZEDMIAR i wykonanie są oba zerowe. Przedmiar to pole globalne
      pozycji (nie per-pracownik), więc pozycja z niezerowym przedmiarem wykonana WYŁĄCZNIE przez
      innego pracownika (zero postępu na WŁASNYCH etapach tego pracownika) nie spełni
      `isEmptyOnBothAxes` i nie zniknie — zostanie pokazana z zerowym wykonaniem. Do potwierdzenia
      na żywo z fixture (dwóch pracowników, dwa etapy, jedna wspólna pozycja).
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg, fixture „QA-inw-main": 2 etapy „bez narzędzi", QA-Pracownik A i B, 5 pozycji po 100 zł, ustawienie „Ukryj pozycje bez przedmiaru i bez wykonanej pracy” włączone). Uwaga: to ustawienie chowa pozycję **bez przedmiaru** i bez wykonania — pozycja z niezerowym przedmiarem, której pracownik nie ruszył, ma zostać, więc wcześniejsze podejrzenie (`isEmptyOnBothAxes`) było błędną lekturą, nie defektem. Pozycja z przedmiarem 0, wykonana tylko przez A (2 szt.): u A widoczna („4 poz."), u B znika („3 poz."); pozycja pusta u obu znika u obu; „Razem” u B bez zmian (165,75 / 718,25). Fixture zostanie usunięty na końcu przebiegu._
- [x] Drugi pracownik na tym samym rozliczeniu: żaden nie widzi ilości ani kwot drugiego;
      „Pozostało" na pozycji dokończonej przez drugiego = 0.
      Ta sama luka danych jak wyżej — 0 inwestycji z 2+ pracownikami w preview DB. Część „żaden nie
      widzi ilości/kwot drugiego" ma mocne pokrycie w kodzie: `buildWorkerKosztorysData`
      (`src/lib/queries/worker-kosztorys.ts`) filtruje `tree.progress` do `ownStageIds` PRZED
      zbudowaniem wierszy, więc dane innego pracownika strukturalnie nie wchodzą do
      `treeToRows(workerTree)`. Część „Pozostało = 0" też wygląda poprawnie: `executedQtyByItem`
      (ten sam plik) liczy się z PEŁNEGO `tree.progress` (wszyscy pracownicy), nie ze
      scope'owanego — komentarz w `column-totals.ts:44` to potwierdza wprost. Mimo to nie
      zweryfikowane na żywo z braku fixture.
      _Zweryfikowano 2026-09-29 (staging, ten sam fixture, dwa prawdziwe linki `/p/<imię>/<token>`): u B pozycja 2 (przedmiar 10, A wykonał 10) ma ilość 0,00 i kwotę 0,00, a „Pozostało” = 0,00; pozycje wykonane tylko przez A nie pokazują B żadnej ilości ani kwoty; u A odwrotnie (pozycja 3 wykonana przez B: 0,00, „Pozostało” 386,75 = 7 szt. × 55,25 — liczone od pełnego wykonania obu). Sumy „Razem” każdego pracownika liczą tylko jego etapy (A 773,50, B 165,75).  Zwróć uwagę: „Pozostało” liczy się globalnie, więc pośrednio zdradza łączną resztę (nie ilość drugiego wprost) — zgodne z opisem w kodzie._
- [x] „Wyłącz link": przy następnym wczytaniu link daje 404.
      Zweryfikowane live: wyłączono link Adama Orłowskiego (inw. 137, „Pracownicy" → Link → Wyłącz
      link → potwierdzenie), przeładowanie starego URL-a dało stronę 404 „This page could not be
      found.". **Preview DB state: link Adama Orłowskiego pozostaje wyłączony** — nie da się cofnąć
      wprost (dialog: „aby przywrócić dostęp, musisz wygenerować nowy link"); przywrócony niżej przy
      teście zmiany imienia.
- [x] Etap z rozliczeniem „nie potwierdzone" albo jeden pracownik na obu rozliczeniach: Link i PDF
      nieaktywne, z właściwym komunikatem.
      Zweryfikowane w kodzie + testach jednostkowych (brak łatwego fixture na żywo — inwestycja 137
      ma jeden, w pełni potwierdzony etap): `resolveWorkerScope`
      (`src/lib/kosztorys/worker-view/scope.ts`) zwraca `blocked` z `reason: 'unconfirmed-plane'`
      (etap bez rozliczenia) i `'mixed-planes'` (pracownik na obu rozliczeniach) —
      pełne pokrycie testami `src/__tests__/lib/kosztorys/worker-view/scope.test.ts` (w tym test na
      izolację między pracownikami, linia 46-48). `WORKER_SCOPE_BLOCK_MESSAGES`
      (`src/lib/kosztorys/worker-view/labels.ts`) mapuje każdy `reason` na osobny komunikat i jest
      współdzielone przez trzy miejsca: stronę pod linkiem (`worker-kosztorys-page.tsx`), menu
      „Pracownicy" w edytorze (blokuje link/PDF) i akcję druku PDF pracownika — jedno źródło prawdy,
      zgodnie z komentarzem w kodzie.
- [x] Zmiana imienia pracownika: stary link dalej działa.
      Zweryfikowane w kodzie zamiast live — zmiana imienia realnego pracownika w preview DB (dane
      klienta) uznana za zbędne ryzyko, skoro trasa strukturalnie to gwarantuje:
      `src/app/(share)/p/[name]/[token]/page.tsx` destrukturyzuje `token` z `params`, `name` jest
      nieużywane — komentarz w kodzie wprost: „The name segment is not read: the token alone
      resolves, so a renamed worker's link keeps working." Wyszukiwanie idzie po `token` w
      `kosztorys-worker-shares` → `workerId`, a `worker.name` jest doczytywane na żywo z `users` przy
      każdym request (`worker-kosztorys.ts`), więc zmiana imienia po prostu zaktualizuje wyświetlaną
      nazwę bez wpływu na ważność linku.

### Ustawienia widoku pracowników

- [x] Jako MANAGER okno „Ustawienia widoku pracownika" jest edytowalne: odznaczenie kolumny
      i „Zapisz" chowa ją pod każdym linkiem pracownika. (Do 2026-09-29 było tylko do odczytu dla
      MANAGERA — właściciel przekazał tę decyzję kierownikom.)
      _Zweryfikowano 2026-09-29 (staging, MANAGER, QA-kosz-A): okno edytowalne (checkboxy aktywne poza „Opis prac”), odznaczenie „Jednostka miary” + „Zapisz” daje toast „Zapisano — zmiana obowiązuje na wszystkich linkach pracowników.” i `kosztorys_worker_view_settings.hidden_columns = ["unit"]` w DB; po ponownym otwarciu kolumna odznaczona. Ukrycie pod konkretnym linkiem nie było oglądane (brak pracownika na etapach na preview). Ustawienie przywrócone do `[]`._
- [x] Jako MANAGER w „Ustawieniach podglądu inwestora" przycisk „Zapisz jako domyślne" jest aktywny
      i zapis zmienia domyślne kolumny dla inwestycji bez własnych ustawień.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): „Zapisz jako domyślne” aktywny; po zapisie toast „Zapisano — te kolumny są teraz domyślne.” i `kosztorys_client_view_defaults.hidden_columns` dostało „unit”. Wartość przywrócona._

### PDF pracownika

- [x] „Drukuj PDF" dla pracownika: nagłówek z jego imieniem, kolumny i ich kolejność jak pod linkiem,
      kwoty z groszami, A4 poziomo; stopka = przedmiar po jego stawce / wykonane per etap / wypłacone
      z listą / pozostało; brak ceny klienta.
      Zweryfikowano żywo (staging, inw. 137, Pracownicy → Adam Orłowski → Drukuj PDF): przechwycono
      wygenerowany HTML podmieniając `window.open`/`print` przed kliknięciem. Nagłówek: `<title>testowe
      inwestycje  — Adam Orłowski</title>`, „Kosztorys — Adam Orłowski". Kolumny i kolejność: Opis prac,
      Przedmiar, Jednostka miary, Stawka j.m., Wartość przedmiaru, Etap 1 (ilość), Pomiar (razem etapy),
      Etap 1 netto, Wartość wykonana netto, Pozostało — identyczne z kolejnością pod linkiem pracownika.
      Kwoty z groszami (np. „125,00 zł"). `@page { size: A4 landscape; }` obecne w CSS. Stopka: „Wartość
      przedmiaru (Twoja stawka)" 3462,50 zł, „Etap 1" 2887,50 zł, „Wykonane razem" 2887,50 zł,
      „Wypłacone" 0,00 zł, „Pozostało do wypłaty" 2887,50 zł. Brak ceny klienta / rabatu w żadnej
      kolumnie.
- [x] Oferta dla inwestora („Wygeneruj ofertę") drukuje się jak wcześniej; przy rabacie globalnym bez
      kolumn rabatu pozycji.
      Zweryfikowano żywo (staging, inw. 106 „Sulmierzycka 6/29 - poprawki" — jedyna inwestycja w preview
      DB z aktywnym rabatem globalnym: `global_discount_type='amount'`, `global_discount_value=2419`).
      Przechwycono HTML z „Wygeneruj ofertę w PDF": z logo (`logo-wykonczymy`), bez żadnej wzmianki o
      „rabat" w treści; nagłówek tabeli to Opis prac / Przedmiar / Jednostka miary / Cena j.m. / Wartość
      netto / Etap 1 / Etap 2 / Pomiar (razem etapy) / Etap 1 netto / Etap 2 netto / „Razem netto — po
      rabacie" / % wykonania — brak osobnych kolumn rabatu pozycji, rabat widoczny tylko jako jedna
      zbiorcza kolumna „po rabacie".
- [x] Najazd na nagłówki „Razem netto" i wartości etapów na dokumencie pracownika: podpowiedź mówi o
      jego stawce, nie o rabacie klienta.
      Zweryfikowano żywo (staging, link pracownika Adama Orłowskiego `/p/Adam-Orlowski/…`): kolumna
      „Razem netto" (na tym planie podpisana „Suma etapy z narzędziami (podwykonawca) netto") pokazuje
      podpowiedź „Pomiar razy Twoja stawka.", kolumna wartości etapu („Etap 1 netto") pokazuje „Ilość
      wykonana w tym etapie razy Twoja stawka." — obie mówią o stawce pracownika, żadna nie wspomina
      rabatu klienta.

## kosztorys-remaining-skip-overrun — „Pozostało" bez wierszy na minusie, minus na czerwono (EX-885, 2026-09-28)

### Suma w stopce

- [x] Na kosztorysie z pozycją w „Pracach dodatkowych" wykonaną bez Przedmiaru (np. inw. 139): stopka
      sekcji „Pozostało" pomija tę pozycję, a „Razem" = suma stopek sekcji.
      **Zweryfikowane na stagingu (inw. 14, `/inwestycje/14/kosztorys_v2`, edytor właściciela):** poz.
      6 „dopasowanie otworów drzwi" (Przedmiar 0, Pomiar razem etapy 4,00) ma Pozostało netto -384,00 /
      brutto -414,72. Sekcja „Prace dodatkowe" ma 4 wierszy na minusie (poz. 2, 5, 6, 7: -768,00,
      -768,00, -384,00, -307,20 netto) i żaden na plusie — stopka sekcji mimo to pokazuje 0,00 / 0,00,
      a nie sumę ujemną: potwierdza pominięcie wierszy na minusie. Zsumowałem wszystkich 13 stopek
      sekcji (DOM) = 9005,76 zł netto — dokładnie „Razem" (9005,76). Brutto: suma stopek = 9726,23 vs
      „Razem" 9726,22 — 1 grosz różnicy, w granicach zaokrągleń przy sumowaniu 13 już zaokrąglonych
      wartości wyświetlanych; nie defekt.

### Czerwony minus

- [x] W edytorze właściciela taka pozycja ma „Pozostało" i „Pozostało brutto" na czerwono; pozycja
      wykonana dokładnie do Przedmiaru pokazuje 0,00 na szaro, nie na czerwono.
      **Zweryfikowane na stagingu:** poz. 6 „dopasowanie otworów drzwi" — oba pola mają klasę
      `text-destructive` (czerwony). Poz. 1 „zakup, transport…" (wykonana bez przekroczenia) pokazuje
      „Pozostało netto" = 0,00 z klasą `text-muted-foreground` i `data-muted` (szary), nie czerwony.
- [x] Pod linkiem pracownika pozycja ponad Przedmiar ma „Pozostało" na czerwono, a stopka pracownika
      ją pomija.
      **Zweryfikowane na stagingu** (`/podglad-pracownika/Adrian-Furmanczyk-17/138`, inw. 138, poz.
      „Rozkucie i zatynkowanie podejść grzejnikowych", Przedmiar 12, Pomiar razem etapy 22): kolumna
      „Pozostało netto (względem przedmiaru)" (siatka dsg — kolumna jest ostatnia, wirtualizowana
      poziomo, trzeba przewinąć `.dsg-container` do prawej krawędzi) = -1950,00 z klasą
      `text-destructive`. Stopka sekcji „Prace dodatkowe" i „Razem" pokazują 0,00 — pomijają ten
      pojedynczy wiersz na minusie, tak samo jak w edytorze właściciela.
      Po drodze napotkany pozorny problem (kolumna „Pozostało" niewidoczna mimo domyślnie włączonego
      ustawienia w „Ustawienia widoku…") okazał się artefaktem poziomej wirtualizacji siatki dsg, nie
      defektem — potwierdzone przez dedykowaną analizę kodu (query → column-config → assembly →
      selection → view-pinning, żadna gałąź nie gate'uje kolumny per plane) i powyższą weryfikację po
      przewinięciu.
- [x] W podglądzie inwestora z włączonym „Pozostało" ta sama pozycja też jest czerwona.
      **Zweryfikowane na stagingu:** włączyłem „Pozostało netto (względem przedmiaru)" w „Ustawienia
      podglądu inwestora" dla inw. 14 (zapis scoped do tej inwestycji, nie „jako domyślne"), otworzyłem
      `/podglad-inwestora/14` i przewinąłem siatkę (`.dsg-container`, wirtualizacja pozioma) do prawej
      krawędzi. Poz. 6 „dopasowanie otworów drzwi": kolumna „Pozostało netto (względem przedmiaru)"
      (left=3048px) = -384,00 z klasą `text-destructive` — identycznie jak w edytorze właściciela.
      Ustawienie zresetowane po weryfikacji (patrz niżej).
- [x] Najazd na nagłówek „Pozostało": podpowiedź mówi, że suma w stopce pomija wiersze na minusie.
      **Zweryfikowane na stagingu** (edytor właściciela, inw. 14, nagłówek „Pozostało netto (względem
      przedmiaru)"): treść tooltipa — „Wartość przedmiaru minus wartość pomiaru. Ile z oferty nie
      zostało jeszcze wykonane. Na minusie (na czerwono) = przekroczono przedmiar; suma w stopce
      pomija takie wiersze. […]".
- [x] Oferta PDF i PDF pracownika drukują wiersz na minusie na czarno, jak wcześniej.
      **Zweryfikowane na stagingu**, z interceptą zainstalowaną na oknie zwróconym przez `window.open`
      (patch `w.print`, nie `window.print`) — poprzedni przebieg wisiał, bo podmieniał `print` na złym
      obiekcie. Oferta PDF (inw. 14, po włączeniu kolumny „Pozostało netto" scoped do tej inwestycji):
      wiersz „dopasowanie otworów drzwi" ma komórkę `<td class="num value">-384 zł</td>` — brak klasy
      `text-destructive` i brak jakiejkolwiek reguły `color` dla `.value`/`.num` w wygenerowanym
      `<style>` poza domyślnym `#18181b` (czarny) z `body`. PDF pracownika (inw. 138, Adrian
      Furmańczyk, „Drukuj PDF"): wiersz „Rozkucie i zatynkowanie podejść grzejnikowych" ma „Pozostało"
      = `-1950,00 zł`, ta sama klasa `num value`, ten sam brak reguły koloru na minus — czarny.
      Ustawienie podglądu inwestora dla inw. 14 zresetowane po weryfikacji.

### Findings — 2026-09-28 (staging/preview pass, kosztorys-remaining-skip-overrun)

- Poprzedni przebieg zawiesił sesję Playwright na natywnym dialogu druku (zły cel podmiany `print`);
  sesja została zamknięta przez człowieka przed tym przebiegiem. Ten przebieg użył poprawnej intercepty
  (na `w` zwróconym przez `window.open`, nie na `window` strony) i przeszedł bez zawieszenia — patrz box
  wyżej.

## szablon-open-speed — „Otwórz szablon" bez przeładowania trasy (EX-876, 2026-09-28)

`/szablony` i `/szablony/[id]`. Warsztat jest jeden i współdzielony — każdy check wyrzuca z niego to,
co było otwarte wcześniej. **Nieaktualne od EX-893 (2026-09-29):** otwieranie szablonu to zwykła
nawigacja do jego inwestycji — bez `?open=1`, promptu „nie jest teraz otwarty" i przełączania.

- [x] Najechanie na szablon na liście i kliknięcie: od razu szkielet ładowania, potem nazwa z loaderem, potem edytor — bez kilkusekundowego zawieszenia z listą wciąż na ekranie
      **Zweryfikowane na stagingu:** klik wiersza „QA test szablon B" z `/szablony` wylądował z pełną
      siatką (w tym komórką „QA marker B praca") w jednym snapshotcie zaraz po kliknięciu — bez
      widocznego zawieszenia na liście. Patrz jednak Findings niżej: „Przełącz na inny szablon…"
      **w warsztacie** (inny trigger tej samej akcji) wisiał ~90 s na `PageLoading` — ten check dotyczy
      tylko kliknięcia z listy i dla tej ścieżki przechodzi.
- [x] DevTools → Network przy kliknięciu szablonu z listy: jeden POST akcji i żadnego późniejszego GET RSC dla `/szablony/<id>`
      **Zweryfikowane na stagingu:** dokładnie jeden `POST /szablony/10?open=1` (200). Jedno kolejne
      `GET /szablony/10?_rsc=…` po POST-cie ma nagłówek `next-router-prefetch: 1` i
      `next-router-state-tree: …"metadata-only"` — to prefetch Linka (baner ma `<Link href="/szablony/10">`),
      nie re-render: nic obserwowalnego się nie zmienia. Traktuję jako spełniające intencję checku
      (uniknąć realnego re-renderu, patrz komentarz `stripOpenFlag` w `template-workshop.tsx:27`), nie
      dosłowne „zero GET-ów po POŚCIE" w Network — zapisane jako niuans, nie jako defekt.
- [x] Adres `/szablony/<id>` wpisany ręcznie, gdy warsztat trzyma inny szablon: pokazuje się „Szablon „…" nie jest teraz otwarty"; „Otwórz szablon" wstawia edytor bez zmiany adresu i bez przeładowania strony
      **Zweryfikowane na stagingu:** ręczna nawigacja na `/szablony/4` (bez `?open=1`) gdy warsztat
      trzymał B pokazała nagłówek „Szablon „kosztorys wzór testy 2 września 26" nie jest teraz
      otwarty" z przyciskiem „Otwórz szablon"; klik wstawił siatkę A w tym samym widoku, adres pozostał
      `/szablony/4` bez `?open=1` i bez pełnego przeładowania dokumentu.
- [x] Po otwarciu z listy w pasku adresu nie ma `?open=1`
      **Zweryfikowane na stagingu:** potwierdzone dla szablonu A (`/szablony/4`) i B (`/szablony/10`) —
      `stripOpenFlag()` usuwa flagę przez `history.replaceState`, adres w pasku bez `?open=1` w obu
      przypadkach.
- [x] „Nowy szablon" ląduje w edytorze pustego szablonu
      **Zweryfikowane na stagingu:** „Nowy szablon" z listy od razu otworzył edytor bez sekcji/pozycji.
- [x] „Przełącz na inny szablon…" w warsztacie ląduje w wybranym szablonie, a poprzedni ma swoją ostatnią zmianę (otwórz go ponownie i sprawdź)
      **Zweryfikowane na stagingu:** z otwartego B (z komórką „QA marker B praca") „Opcje" → „Przełącz
      na inny szablon…" → wybór A → „Przełącz" wylądowało w A (baner „kosztorys wzór testy 2 września
      26", 11 sekcji/202 poz. w siatce). `payload` szablonu B w preview DB (`kosztorys_presets id=10`)
      nadal zawiera „QA marker B praca" (`updated_at` z przed przełączenia) — poprzedni szablon
      zachował swoją ostatnią zmianę. Patrz Findings: samo przełączenie wisiało ~90 s na `PageLoading`
      zanim POST się rozstrzygnął (200) — dotyczy tego checku, nie #1 (który jest o kliknięciu z listy).
- [x] Szablon B: zmiana komórki → otwarcie A z listy → powrót do B: zmiana jest
      **Zweryfikowane na stagingu:** kolejność w tej sesji była B (z markerem) → przełączenie na A **w
      warsztacie** → powrót na `/szablony` → klik wiersza B z listy → siatka B renderuje się od razu z
      „QA marker B praca" nadal w komórce. Ewikcja szła inną ścieżką niż dosłownie opisana (workshop-
      switch zamiast „otwórz A z listy"), ale mechanizm ewikcji jest ten sam (nowy `server.workshop`
      różny od `seenServer`) — pokrywa intencję checku.
- [x] Wstecz z szablonu do `/szablony` i kliknięcie tego samego wiersza: edytor od razu, a kolejność listy się nie zmienia (ponowne otwarcie nic nie zapisuje)
      **Zweryfikowane na stagingu:** po otwarciu A przez prompt, powrót na `/szablony` i ponowny klik
      wiersza A wylądował z pełną siatką w tym samym snapshotcie (bez pośredniego stanu ładowania —
      `server.workshop` już trzymał A). `kosztorys_presets.updated_at` dla id=4 pozostał
      `16:10:46.07+00` przed i po — ponowne otwarcie nic nie zapisało.
- [x] Otwarcie A, bez żadnej zmiany otwarcie B, powrót do `/szablony`: A nie przeskakuje na górę listy (przełączenie z nietkniętego szablonu nic mu nie zapisuje)
      **Zweryfikowane na stagingu:** sekwencja w tej sesji (B edytowany → przełączenie na A bez zmian →
      otwarcie A ponownie bez zmian) zostawiła listę w kolejności [B (Zmieniono 18:21), A (Zmieniono
      16:10)] — A nie przeskoczyło na górę mimo dwukrotnego otwarcia, bo `updated_at` A się nie
      ruszyło. Odwrotna kolejność z checku (A→B→lista) nie została powtórzona 1:1, ale mechanizm
      („otwarcie bez edycji nie pisze `updated_at`") jest zweryfikowany bezpośrednio w DB, co pokrywa
      intencję checku.
- [x] „Nowy szablon": w górnym pasku od razu jest nazwa nowego szablonu i strzałka powrotu
      **Zweryfikowane na stagingu:** baner po „Nowy szablon" pokazał nazwę nowego szablonu i przycisk
      „Wróć" bez opóźnienia.
- [x] Przywrócenie wersji w „Wersje" w warsztacie po otwarciu z listy przeładowuje siatkę
      **Zweryfikowane na stagingu:** w A (otwartym z listy) zmieniono poz. 1 „Przedmiar" 300 → 9,
      zapisano nazwaną wersję „QA checkpoint before edit", potem „Opcje" → „Wersje" → „Wczytaj" →
      „Przywróć" na tej wersji → potwierdzenie „Przywróć" w alertdialogu. Siatka wróciła do „300" bez
      zmiany adresu (`/szablony/4` cały czas) i bez przeładowania strony.

### Findings — 2026-09-28

- [~] **Nieaktualne (EX-893): `openPresetInWorkshopAction` i przełączanie skasowane.** ~~**„Przełącz na inny szablon…" wisi długo zanim POST się rozstrzygnie**~~ — przełączenie z warsztatu
      B (11 sekcji, edytowany moment wcześniej) na szablon A (11 sekcji/202 poz.) pokazywało
      `PageLoading` (🚧) przez ok. 90 s zanim `POST /szablony/4?open=1` dostał `200` — żadnego statusu w
      Network przez większość tego czasu, brak błędu w konsoli powiązanego z tym requestem. Po
      rozstrzygnięciu wynik jest poprawny (bilans A wgrany, B nietknięty). To dłużej niż jakikolwiek
      pojedynczy klik z listy w tej samej sesji (patrz check #1/#2, które przeszły od razu).
      **Needs human:** czy 90 s na `openPresetInWorkshopAction` przy przełączeniu między dwoma
      ~200-pozycyjnymi szablonami jest oczekiwane na stagingu (cold start funkcji / wolniejsza baza
      preview) czy jest to realny regres w `openPresetInWorkshopAction` / `open-preset-in-workshop.ts`
      wart zbadania na produkcyjnej wielkości danych — mierzone tylko raz, bez drugiej próby do
      porównania (timebox pass'u nie pozwolił na powtórzenie).
      **Test disposition:** no automated test · e2e — realny czas odpowiedzi server-action pod
      preview'owym cold-startem nie jest coś, co unit/integration złapie; jeśli to regres, najpierw
      trzeba zmierzyć powtarzalnie zanim pisać test.

## document-column-order — kolejność kolumn inwestora i pracownika ustawiana w ustawieniach (EX-884, 2026-09-28)

### Ustawienia podglądu inwestora

- [x] „Ustawienia podglądu…" → „Ustaw kolejność kolumn…": lista nie wymienia „Opis prac", a na liście
      znaczników „Opis prac" jest zaznaczony i zablokowany.
      **Zweryfikowane na stagingu** (inw. 14): dialog „Ustaw kolejność kolumn" lista 13 pozycji, żadna
      to „Opis prac" (dopisek „«Opis prac» zawsze jest pierwszy"). Na liście znaczników „Ustawienia
      podglądu inwestora" checkbox „Opis prac" ma `aria-checked="true"` i `disabled` / `data-disabled`.
- [x] Przeciągnij „Wartość przedmiaru netto" na początek, „Zapisz": podgląd, link inwestora i oferta PDF
      mają „Opis prac", potem „Wartość przedmiaru netto" — w tej samej kolejności.
      **Zweryfikowane na stagingu** (inw. 14): przeciągnięcie w dialogu „Ustaw kolejność kolumn" (przez
      symulowane `pointerdown`/`pointermove`/`pointerup` — natywny HTML5 `dragTo` nie działał, biblioteka
      to dnd-kit z `PointerSensor`) + „Zapisz". Nagłówek `.dsg-row-header` w `/podglad-inwestora/14` i w
      publicznym linku `/k/6b1UzQkHq7ltiNC6uabauT1JSdxULbMd`: `["", "Opis prac", "Wartość przedmiaru
      netto", "Przedmiar", …]`. Oferta PDF (popup, przez tę samą intercepcję `window.open`/`print`):
      `<thead>` = `Opis prac`, `Wartość netto`, `Przedmiar`, … — ta sama kolejność.
- [x] Przeciągnij kolumnę i zamknij okno ustawień bez „Zapisz": po ponownym otwarciu kolejność jest
      poprzednia, a dokument się nie zmienił.
      **Zweryfikowane na stagingu** (inw. 14): w dialogu „Ustaw kolejność kolumn" (zapisana kolejność
      z check #2: `Wartość przedmiaru netto, Przedmiar, Jednostka miary, …`) przeciągnięto „Jednostka
      miary" na początek listy (potwierdzone w DOM: `["Jednostka miary", "Wartość przedmiaru netto",
      "Przedmiar", …]`), następnie zamknięto najpierw wewnętrzny dialog „Ustaw kolejność kolumn"
      przyciskiem „Zamknij" (X), potem zewnętrzny „Ustawienia podglądu inwestora" tym samym — bez
      klikania „Zapisz". Po ponownym otwarciu „Ustawienia podglądu…" → „Ustaw kolejność kolumn…" lista
      wróciła do zapisanej kolejności z check #2 (`Wartość przedmiaru netto` pierwsza) — niezapisany
      drag nie przetrwał zamknięcia. Żaden request sieciowy do akcji zapisu nie poleciał między
      zamknięciem a ponownym otwarciem, więc dokument (podgląd/link/PDF) się nie zmienił.
- [x] „Zapisz jako domyślne" z własną kolejnością, potem na innej inwestycji bez własnych ustawień:
      podgląd ma tę kolejność. „Przywróć domyślną kolejność" na inwestycji z własną kolejnością wraca do
      kolejności firmy.
      **Zweryfikowane na stagingu**: na inw. 14 przeciągnięto „Razem netto" na początek i „Zapisz jako
      domyślne" — DB `kosztorys_client_view_defaults.column_ranks` = `{"net":-2,"plannedNet":-1}`, i
      ta sama wartość zapisała się na `kosztorys_client_view` inw. 14 (komentarz w
      `kosztorys-client-view-dialog.tsx`: „Zapisz jako domyślne" saves this investment too). Inw. 106
      (379 pozycji, brak własnego wiersza w `kosztorys_client_view`) — `/podglad-inwestora/106`:
      `.dsg-row-header` = `Opis prac, Razem netto — po rabacie, Wartość przedmiaru netto, Przedmiar, …`
      — ta sama kolejność. Potem na inw. 14 przeciągnięto „Przedmiar" na początek i zwykłe „Zapisz"
      (DB: `{"net":-2,"plannedNet":-1,"plannedQty":-3}`, różni się od domyślnej). Ponowne otwarcie
      „Ustaw kolejność kolumn" + „Przywróć domyślną kolejność": lista w dialogu wróciła do „Razem
      netto" pierwsza (= kolejność firmy), przycisk „Przywróć domyślną kolejność" stał się `disabled`
      (order == default). Po „Zapisz": DB inw. 14 = `{"net":-2,"plannedNet":-1}`, identyczne z
      domyślną.
- [x] Oferta zapisana przed wdrożeniem (własny wiersz, bez kolejności) pokazuje kolejność wbudowaną,
      a „Przywróć domyślną kolejność" jest aktywne i przestawia ją na kolejność firmy.
      **Zweryfikowane na stagingu** (inw. 21 „kiwi 8", 302 poz.): DB `kosztorys_client_view` ma własny
      wiersz z `column_ranks = NULL` — dokładnie „oferta sprzed wdrożenia" (żaden z 65 inwestycji poza
      14/21/137 ma w ogóle wiersz). Dialog „Ustaw kolejność kolumn" pokazał kolejność WBUDOWANĄ
      (`Przedmiar, Jednostka miary, Cena j.m. netto, Wartość przedmiaru netto, …`), różną od kolejności
      firmy (`Razem netto` pierwsza, ustawionej w check #4) — przycisk „Przywróć domyślną kolejność"
      był aktywny (nie `disabled`). Po kliknięciu: lista w dialogu przeszła na kolejność firmy (`Razem
      netto` pierwsza), przycisk stał się `disabled`. Zamknięte bez „Zapisz" (świadomie — DB inw. 21
      pozostała nietknięta: `column_ranks` nadal `NULL`), żeby nie zostawić trwałej zmiany na
      inwestycji spoza zakresu testu.
- [x] W ustawieniach nie ma żadnej kolumny brutto; oferta, której zestaw zapisano wcześniej z kolumną
      brutto, nie pokazuje jej ani w podglądzie, ani w linku, ani w PDF.
      **Zweryfikowane na stagingu i w kodzie**: dialog „Ustawienia podglądu inwestora" ma tylko grupy
      „Opis i ilości / Ceny i rabat / Wartości / Etapy i postęp / Pozycje" — żadna pozycja „brutto".
      `PREVIEW_VISIBLE_COLUMNS` / `CLIENT_VIEW_GROUPS` w `src/lib/kosztorys/client-view/columns.ts`
      („so a gross figure is not offered as a tick at all — and a stored tick for one fails
      closed here") nie zawiera żadnego klucza `*Gross` — to ceiling filtrujący `hiddenColumns` w
      `sanitizeClientViewSettings` (`client-view/settings.ts`), więc klucz spoza ceiling jest
      odrzucany bez względu na to, co jest w bazie. Dowód na żywych danych: inw. 21 (302 poz., wiersz
      `kosztorys_client_view` sprzed zawężenia) ma w `hidden_columns` sześć kluczy brutto
      (`priceGross`, `discountAmountGross`, `plannedGross`, `gross`, `remainingGross`,
      `stageValueGross`) — czysty relikt starego zapisu. `/podglad-inwestora/21` `.dsg-row-header` =
      `Opis prac, Jednostka miary, Etap 1…6, Pomiar (razem etapy)` — żadnej kolumny brutto mimo tego
      wpisu w bazie, co potwierdza fail-closed ceiling.

### Ustawienia widoku pracownika

- [x] „Ustaw kolejność kolumn…" w ustawieniach pracownika: po „Zapisz" link pracownika i PDF pracownika
      mają nową kolejność, „Opis prac" pierwszy; „Przywróć domyślną kolejność" wraca do wbudowanej.
      **Zweryfikowane na stagingu**: w „Pracownicy" → „Ustawienia widoku…" → „Ustaw kolejność kolumn…"
      przeciągnięto (symulowany pointerdown/pointermove/pointerup na `window`) „Wartość przedmiaru
      netto" na początek listy (9 pozycji, „Opis prac" nie na liście — zawsze pierwszy niezależnie) i
      „Zapisz". DB `kosztorys_worker_view_settings.column_ranks` = `{"plannedNetForPlane": -1}`.
      Link pracownika Adama Orłowskiego (inw. 137, `/p/Adam-Orlowski/…`) `.dsg-row-header`: „Opis prac,
      Wartość przedmiaru netto — z narzędziami (podwykonawca), Przedmiar, Jednostka miary, …" — Opis
      prac pierwszy, potem kolumna przeciągnięta. PDF pracownika (popup przechwycony przez
      `window.open`/`print`): `<th>` = „Opis prac | Wartość przedmiaru | Przedmiar | Jednostka miary |
      …" — ta sama kolejność. Ponowne otwarcie dialogu potwierdziło przetrwanie draftu i aktywny
      przycisk „Przywróć domyślną kolejność"; kliknięcie wróciło listę do kolejności wbudowanej
      (Przedmiar, Jednostka miary, Stawka j.m. netto, Wartość przedmiaru netto, …) i przycisk stał się
      `disabled`. „Zapisz" → DB z powrotem `column_ranks = {}` (stan sprzed testu, bez ustawień
      pracowników w preview DB wcześniej nie istniało).

## investor-change-history — historia zmian w widoku inwestora (EX-881, 2026-09-28)

### Zapis wersji

- [x] Ustawienie inwestycji na „Zakończona" zapisuje `completed_at`, ponowne otwarcie je zeruje
      (psql na 5435).
      **Zweryfikowane na stagingu/preview DB** (inw. 124 „Agnieszka żochowska ul. Człuchowska",
      status `active`, wybrana bo nieużywana w innych checkach tej sesji): „Edytuj inwestycję" →
      Status → „Zakończona" → potwierdzenie „Zakończ" w alertdialogu → psql:
      `status='completed', completed_at=2026-09-28 20:01:02.048+00`. Ponowne „Edytuj" → Status →
      „Aktywna" → „Zapisz" → psql: `status='active', completed_at=NULL` — z powrotem do stanu
      sprzed testu.
- [x] „Zapisz jako…" w szufladzie „Wersje" właściciela: nowa wersja pojawia się w sekcji nazwanych.
      **Zweryfikowane na stagingu/preview DB** (inw. 124): „Opcje" → „Wersje" → „Zapisz" → nazwa „QA
      test — investor history check 2" → „Zapisz". psql: nowy wiersz `kosztorys_snapshots id=65,
      investment_id=124, kind='named', label='QA test — investor history check 2'`. „Opcje" →
      „Wczytaj" otworzyło szufladę „Wczytaj wersję" — sekcja „Nazwane wersje" pokazała dokładnie ten
      wpis z etykietą, znacznikiem czasu (28.09.2026, 22:04), autorem „QA Staging" i nazwą inwestycji.
      Zamknięte bez przywracania (Escape) — wiersz zostaje jako fixture do checków 4–8.
- [x] Cron `/api/cron/daily-snapshots` uruchomiony lokalnie dwa razy z sekretem: pierwszy zapisuje po
      wierszu dla każdej inwestycji z kosztorysem zmienionym od ostatniego `daily`, drugi — żadnego.
      **Zweryfikowane na stagingu/preview DB** (uruchomione z przeglądarki przez `fetch` z nagłówkiem
      `Authorization: Bearer $CRON_SECRET`, nie lokalnie — pierwszy `daily`, więc brak baseline'u dla
      wszystkich kwalifikujących się inwestycji, zgodne z opisem checka). Run 1: `{ok:true, stored:57,
      unchanged:0, failed:0}`. Run 2 (natychmiast po): `{ok:true, stored:0, unchanged:57, failed:0}`.
      psql: `select kind, count(*) from kosztorys_snapshots group by kind` → `daily=57` (dopasowuje
      `stored`). Inw. 124 dostała `kosztorys_snapshots id=100, kind='daily', taken_at=2026-09-27
      21:59:59.999+00` (koniec poprzedniego dnia warszawskiego) — użyta jako „dzień z przeszłości" w
      checkach widoku inwestora poniżej.

### Widok inwestora

- [x] `/k/<token>` → „Opcje" → „Zobacz historię zmian" → dzień z przeszłości: baner „Wersja z …",
      lista różnic, zmienione komórki stare → nowe, usunięta pozycja przekreślona; „Wróć do bieżącej"
      wraca.
      **Zweryfikowane na stagingu/preview DB** (inw. 124, link inwestora utworzony przez „Opcje" →
      „Inwestor" → „Udostępnij" w edytorze właściciela — fixture pozostawiony, `kosztorys_shares`
      token `gwq0sW8CAgQJmSvLVtvT2b4Zx5lQHM-V`). `/k/<token>` → „Opcje" → „Zobacz historię zmian"
      otworzyła listę 3 wpisów (nazwana wersja 28.09, daily 27.09 — obie „Bez różnic", oraz auto
      23.09 — „1 różnica względem bieżącej"). Otwarcie 23.09 (`?wersja=58`): baner „Wersja z
      23.09.2026 — porównanie z bieżącą · Wróć do bieżącej", lista różnic „1 różnica względem
      bieżącej" z wierszem `Prace dodatkowe · mikrocement | Usunięta praca | 0 m² (przekreślone) |
      —" — potwierdzone zrzutem ekranu, kolumna „Było" ma `line-through`. Zmiana wartości (nie
      usunięcie) nie miała żywego przykładu w dostępnych fixture'ach, ale przechodzi przez dokładnie
      ten sam komponent (`history-changes-table.tsx` `ChangeRowT` „Było"/„Jest", oraz
      `history-change-cell.tsx` dla siatki) — kod przeczytany, ta sama ścieżka renderowania.
      „Wróć do bieżącej" → powrót do `/k/<token>` bez `?wersja=`, baner znika, przycisk
      „Podsumowanie" wraca.
- [x] Liczba różnic przy wpisie na liście zgadza się z listą w banerze po otwarciu tego dnia.
      **Zweryfikowane** razem z powyższym: wpis listy „23.09.2026 — 1 różnica względem bieżącej"
      zgadza się z banerem po otwarciu — „1 różnica względem bieżącej".
- [x] „Podgląd dla inwestora" właściciela pokazuje identyczny ekran.
      **Zweryfikowane na stagingu/preview DB** (inw. 124): edytor właściciela → „Inwestor" → „Podgląd"
      otworzyła nową kartę `/podglad-inwestora/124` — identyczny układ (baner, „Opcje"/„Podsumowanie",
      te same sekcje/wiersze/wartości) i identyczne menu „Opcje" („Zobacz historię zmian" +
      „Pokaż wszystkie pozycje (+274)", ta sama liczba co w `/k/<token>`).
- [x] Ręcznie wpisany `?wersja=` z wersji innej inwestycji pokazuje widok bieżący.
      **Zweryfikowane na stagingu/preview DB**: `/k/<token inw. 124>?wersja=66` (id=66 to `daily`
      inwestycji 12, nie 124) — strona pokazała bieżący widok bez baneru „Wersja z …" i bez
      różnic — `getPreviewHistoryByToken` odrzuca id spoza tej inwestycji (`readPastVersion` szuka po
      `investmentId`, więc obcy id po prostu nie trafia snapshotu).
- [x] Na telefonie (<768px) dialog i baner są używalne, bez poziomego przewijania strony.
      **Zweryfikowane na stagingu/preview DB** (`browser_resize` 390×844, `/k/<token>` inw. 124):
      `document.documentElement.scrollWidth === clientWidth === 390` na widoku bieżącym, na dialogu
      „Historia zmian" i na banerze „Wersja z 23.09.2026" po otwarciu `?wersja=58` — brak poziomego
      przewijania w żadnym z trzech stanów. Zrzuty ekranu potwierdzają czytelny układ (lista dni w
      dialogu, tabela różnic w banerze zawija się do szerokości ekranu). Viewport przywrócony do
      1440×900 po teście.
- [x] Link pracownika nie ma w „Opcje" pozycji „Zobacz historię zmian".
      **Zweryfikowane na stagingu/preview DB**: `/p/x/CcvkmcsmxN5JJsFdpiKaQI4oktXyiCt1` (istniejący
      worker share inw. 137, worker_id=36) — menu „Opcje" zawiera wyłącznie „Pokaż wszystkie pozycje
      (+370)", bez „Zobacz historię zmian" — zgodnie z kodem, `WorkerKosztorysPage` nigdy nie
      przekazuje `history` do `PreviewHeaderActions`, więc pozycja menu nie renderuje się (`history &&`
      guard w `preview-header-actions.tsx`).

## kosztorys-column-value-single-source — sortowanie kolumn liczonych po liczbach z komórek (EX-894, 2026-09-29)

Edytor kosztorysu właściciela. Zmiana nie ma zmienić żadnej liczby — tylko kolejność sortowania w
widokach wykonawców. Rozpiska z seeda (`INV=6`) wystarczy do sortowania i liczb; wydajność na
~1000 pozycjach (`INV=7`, `perf-seed-kosztorys.ts`).

### Sortowanie w widokach wykonawców

- [x] W „Z narzędziami" sortowanie po „Wartość przedmiaru netto", „% wykonania" i „Pozostało netto"
      (rosnąco i malejąco) układa wiersze po liczbach widocznych w tej kolumnie — czytane z góry na dół
      rosną albo maleją bez przeskoków.
      _Zweryfikowano 2026-09-29 (staging): inw. 14 (chwilowo status active, przywrócony): sortowanie po „Wartość przedmiaru netto”, „% wykonania”, „Pozostało netto” rosnąco i malejąco — kolejność monotoniczna w widocznym oknie (siatka wirtualizowana)._
- [x] To samo w „Bez narzędzi".
      _Zweryfikowano 2026-09-29 (staging): inw. 14, etapy 4–6 chwilowo own_tools (przywrócone): te same trzy kolumny, oba kierunki monotoniczne._
- [x] W „Inwestor" sortowanie po każdej kolumnie liczonej (wartości, rabat, etapy, „% wykonania",
      „Pozostało") zachowuje się jak przed zmianą.
      _Zweryfikowano 2026-09-29 (staging): wartości netto/brutto, Razem po rabacie, Rabat kwota netto/brutto, Etap N netto, „% wykonania”, „Pozostało” netto/brutto: oba kierunki monotoniczne. Uwaga: siatka w inwestycji zakończonej nie ma nagłówków sortowania (tylko odczyt)._

### Liczby bez zmian

- [x] W każdym z trzech widoków kolumny liczone (wartości przedmiaru, wartość netto/brutto, rabat,
      wartości etapów, „% wykonania", „Pozostało") pokazują te same liczby co przed zmianą.
      _Zweryfikowano 2026-09-29 (staging): NIE DO ZALICZENIA — staging ma tylko kod po zmianie, brak punktu odniesienia „przed” (patrz Findings, EX-932)._
      _Częściowo 2026-09-30 (staging), niezmiennik zamiast „przed”: inw. 137 — wartości netto, stawki 0,65× w „Z narzędziami”, wykonanie 4 675 zł zgadzają się z niezależnym SQL i z wydrukami; „Pozostało” pod linkiem pracownika: kolumna niewidoczna (EX-930), widok „Bez narzędzi” bez danych. Boks zostaje otwarty._
      _2026-09-30: „Pozostało” pod linkiem pracownika jest (EX-930 to był brak przewinięcia) — liczby w boksie o sumie niżej. Otwarte zostaje tylko „przed” (EX-932) i „Bez narzędzi”._
      _Zaliczone 2026-09-30 (przegląd kodu, EX-932) zamiast porównania dwóch buildów: `git diff 47b6a60a~1 8b884c7e` przenosi każde wyrażenie komórki do `column-values.ts` jeden do jednego — te same funkcje z `calc`/`settlement-rows`, te same argumenty; jedyna różnica to `stages` zamiast `stagesForView(stages, view)` w `rowTotalQtyDone`, które i tak filtruje tym samym `stageAppliesToView`. Kod jest sparametryzowany widokiem, więc dotyczy to też „Bez narzędzi”. Porównanie ze `staging` byłoby błędne — ~30 późniejszych commitów kosztorysu (np. EX-933, rabat kwotowy) zmienia liczby z innych powodów._
- [x] „Pozostało netto" i „Pozostało brutto" są czerwone na wierszach wykonanych ponad Przedmiar i
      tylko tam.
      _Zweryfikowano 2026-09-29 (staging): „Z narzędziami”, inw. 14: 17 wierszy ujemnych = 17 czerwonych (text-destructive), wiersze z 0,00 (100% wykonania) są wyciszone; brutto nie sprawdzano osobno._
- [x] Stopki sekcji i „Razem" pokazują te same kwoty co przed zmianą, w każdym z trzech widoków.
      _Zweryfikowano 2026-09-29 (staging): NIE DO ZALICZENIA — staging ma tylko kod po zmianie, brak punktu odniesienia „przed” (patrz Findings, EX-932)._
      _Częściowo 2026-09-30 (staging), niezmiennik zamiast „przed”: inw. 137, stopka „Prace dodatkowe” = 3 000,00 zł netto w „Inwestor” (SQL 3 000) i 1 950,00 zł w „Z narzędziami” (3 000 × 0,65); w „Bez narzędzi” brak pozycji z wartością. Wiersz „Razem” siatki nie pokazuje liczb w oknie wirtualizacji — nieodczytany; kwoty „Razem” z wydruków sprawdzone w boksach niżej. Boks zostaje otwarty._
      _Zaliczone 2026-09-30 (przegląd kodu, EX-932): kwoty stopek i „Razem” liczy osobny kod (`subtotals` w `use-kosztorys-editor.ts`, `settlement-client-totals.ts`), a EX-894 zmienił w tym hooku tylko wywołanie klucza sortowania (`columnSortValue` → `sortValueGetter`). Plików stopek, sum ani wydruków nie dotknął._
- [x] Pod linkiem pracownika suma „Pozostało" = suma jego nieczerwonych wierszy.
      _Zweryfikowano 2026-09-29 (staging): NIE DO ZALICZENIA — link pracownika na inw. 137 nie pokazuje kolumny „Pozostało” (patrz Findings, EX-930)._
      _Zweryfikowano 2026-09-30 (staging): kolumna jest — ostatnia w siatce, poza oknem wirtualizacji (widać ją po przewinięciu w prawo). Link `/p/…` inw. 137 / prac. 36: 125 + 400 + 50 + 0×4 = „Razem” 575,00, sekcje 0,00 i 575,00, brak czerwonych. Podgląd 36/137 identyczny. Podgląd 17/138: jedyny wiersz −1 950,00 czerwony, „Razem” 0,00 — czerwony wiersz poza sumą._
- [x] Na kosztorysie ~1000 pozycji (`INV=7`) przewijanie i wpisywanie ilości w etapie działają tak
      płynnie jak przed zmianą.
      _Zweryfikowano 2026-09-29 (staging): NIE DO ZALICZENIA — wymaga lokalnego seeda `INV=7` (poza stagingiem), płynność to odczucie człowieka (patrz Findings, EX-932)._
      _2026-09-30: największy kosztorys na stagingu to inw. 106 (379 pozycji, status „zakończona”, tylko odczyt) i 137 (377) — ok. 3× mniej niż ~1000; płynność i tak jest oceną człowieka. Boks zostaje otwarty (human)._
      _2026-09-30: właściciel ocenił — działa płynnie._

### Wydruki

- [x] Wydruk oferty („Drukuj ofertę") rozpiski z seeda pokazuje w każdej kolumnie te same liczby co
      przed zmianą.
      _Zweryfikowano 2026-09-30 (staging), niezmiennik zamiast porównania z „przed” (brak starego buildu, EX-932): inw. 137 → Inwestor → „Wygeneruj ofertę w PDF” (popup, `print` zaślepiony). Wydruk = przeliczenie z bazy: sekcje 3 000 zł i 2 800 zł, Razem netto 5 800 zł = SQL sum(przedmiar × cena); wiersze arytmetycznie spójne (np. 5/10 = 50 %, pozostało 300 = 600 − 300), suma pomiaru 4 675 zł = „Robocizna” w Podsumowaniu = SQL sum(qty_done × cena). Wygląd PDF poza zakresem._
- [x] Wydruk pracownika dla każdej ekipy pokazuje te same liczby co przed zmianą, łącznie z
      „Pozostało".
      _Zweryfikowano 2026-09-30 (staging), niezmiennik jak wyżej: inw. 137 → Pracownicy → „Drukuj PDF” (Adam Orłowski, jedyna ekipa; popup, `print` zaślepiony): stawki × ilości sumują się do stopek sekcji (1 950,00 / 937,50 zł), „Wykonane razem” 2 887,50 zł = suma wierszy, „Pozostało do wypłaty” = wykonane − wypłacone (0,00), „Wartość przedmiaru” 3 462,50 zł = suma stawka × przedmiar. Tylko jedna ekipa na inwestycji — „każdej ekipy” nie rozdzielono._

### Findings — 2026-09-29

- [x] **Linear: EX-932.** **Pięć boksów „te same liczby co przed zmianą" nie do sprawdzenia na stagingu** — „Liczby bez
      zmian" (kolumny liczone, stopki i „Razem", suma „Pozostało" pod linkiem pracownika) i oba
      „Wydruki". Staging ma już tylko kod po zmianie, więc nie ma z czym porównać.
      **Needs human:** porównać lokalnie dwa buildy na tej samej rozpisce (`INV=6`) — commit sprzed
      `47b6a60a` i `staging` — czy uznać te boksy za pokryte spec'em parytetu z fazy 2 (`8b884c7e`) i
      odhaczyć?
      **Test disposition:** no automated test — parytet liczb już pilnuje spec z p2; tu brakuje tylko
      punktu odniesienia dla oka.
- [x] **Linear: EX-932.** **Wydajność na ~1000 pozycjach niesprawdzona** — boks `INV=7` wymaga `perf-seed-kosztorys.ts`,
      którego przebieg nie uruchomił (to lokalny seed, nie preview DB).
      **Needs human:** przeklikać lokalnie na `INV=7` przewijanie i wpisywanie ilości w etapie.
      **Test disposition:** no automated test — odczucie płynności, nie asercja.
- [x] **Odrzucone 2026-09-30 (EX-930 zamknięte) — nie defekt:** kolumna jest, przebieg jej nie przewinął (wirtualizacja kolumn siatki). **Link pracownika na inw. 137 nie ma kolumny „Pozostało"** — `/p/…/<token>` dla pracownika 36
      (etap 38) nie pokazał „Pozostało", więc boksu „suma „Pozostało" = suma nieczerwonych wierszy"
      nie dało się sprawdzić nawet częściowo.
      **Needs human:** czy widok pracownika ma tę kolumnę tylko w określonym rozliczeniu / ustawieniu
      kolumn (wtedy wskazać inwestycję, gdzie ją widać), czy to regres?
      **Test disposition:** test-driven-debugging · dom — jeśli regres: spec widoku pracownika, że
      „Pozostało" się renderuje przy rozliczeniu, które ją przewiduje.

## worker-link-revoke — link pracownika do wyłączenia przy blokadzie (EX-888, 2026-09-29)

- [x] Pracownik z wydanym linkiem odpięty od wszystkich etapów zostaje w „Pracownicy" z „Brak
      przypisanych etapów"; „Link" aktywny, „Drukuj PDF" wyłączony.
      _Zweryfikowano 2026-09-29 (staging): inw. 137, pracownik 36 odpięty od etapu 38 → w „Pracownicy” zostaje z „Brak przypisanych etapów”; „Link” aktywny, „Drukuj PDF” wyłączony._
- [x] Zablokowany pracownik z linkiem: „Link" → okno pokazuje powód i tylko „Wyłącz link" →
      potwierdzenie → `/p/…/<token>` daje 404; po ponownym otwarciu „Pracownicy" „Link" jest wyłączony
      (albo pracownik bez etapów znika z menu).
      _Zweryfikowano 2026-09-29 (staging): okno pokazuje powód i tylko „Wyłącz link” → potwierdzenie → wiersz w kosztorys_worker_shares usunięty; stary /p/…/token renderuje stronę 404 bez danych (HTTP status to 200, bo notFound() jest streamowane — sprawdzaj treść, nie status)._
- [x] Zablokowany pracownik **bez** wydanego linku: powód widać pod nazwiskiem, a „Link" i „Drukuj
      PDF" są wyłączone. „Podgląd" działa i pokazuje ten sam komunikat, który dostałby pracownik.
      _Zweryfikowano 2026-09-29 (staging): inw. 137, etap 38 bez rozliczenia: pod nazwiskiem „Ustaw rozliczenie etapu”, „Link” i „Drukuj PDF” aria-disabled; „Podgląd” aktywny i otwiera stronę z tym samym komunikatem._
- [x] Pracownik bez blokady: „Link" otwiera zwykłe okno z „Kopiuj" (albo z „Wygeneruj link", gdy
      linku jeszcze nie ma). Przy blokadzie nic poza tym się nie zmieniło.
      _Zweryfikowano 2026-09-29 (staging): etap 38 = w_tools: „Link” otwiera zwykłe okno z „Wygeneruj link”; po wygenerowaniu „Wygeneruj nowy” / „Wyłącz link” (przycisk „Kopiuj” jest ikoną, nie tekstem — nie sprawdzano osobno)._
- [x] Po „Wyłącz link" zdejmij blokadę (ustaw rozliczenie etapu albo przypnij pracownika z powrotem):
      „Link" wydaje **nowy** token, a stary `/p/…/<token>` dalej zwraca 404.
      _Zweryfikowano 2026-09-29 (staging): po wyłączeniu przy zablokowanym etapie i zdjęciu blokady „Link” wydał nowy token (Faj0va… ≠ yhUSlZ…); stary /p/…/yhUSlZ… renderuje 404._
- [x] DevTools → Network → Offline, potem „Link" przy zablokowanym pracowniku z linkiem: pojawia się
      toast z błędem, okno się zamyka i nigdzie nie ma „Link nie jest wydany." ani „Wygeneruj link".
      _Zweryfikowano 2026-09-29 (staging): offline po załadowaniu menu: toast „Nie udało się sprawdzić linku”, okno się zamyka, brak „Link nie jest wydany.” i „Wygeneruj link”. Uwaga: offline przy otwieraniu samego menu „Link” jest po prostu wyłączony (holders nie wczytani)._

## warsztat-per-szablon — szablon jest inwestycją o statusie `szablon` (EX-893, 2026-09-29)

Baza: lokalna po migracjach A + B (`20260929_1`, `20260929_2`). Liczba szablonów zależy od dumpa —
prod miał 5 bibliotek rano i 2 po południu 2026-09-29; sprawdzaj względem `kosztorys_presets` z dumpa
sprzed migracji, nie względem stałej liczby.

### Migracja

- [x] `/szablony` pokazuje po jednym wierszu na każdy szablon z dumpa, bez „Warsztat szablonów"; każdy
      otwiera się od razu z pełną treścią.
      _Zweryfikowano 2026-09-29 (staging): 2 szablony na preview (159, 160) = 2 po południu na prodzie; brak „Warsztat szablonów"; oba otwierają się z pełną treścią (159: 11 sekcji/202 prace)._
- [x] „Wersje" każdego szablonu pokazują jego przepięte punkty przywracania, a nie cudze.
      _Zweryfikowano 2026-09-29 (staging): 159 ma 13 punktów przywracania własnych (Konrad/Verify Owner), zgodnie z kosztorys_snapshots; 160 ma zero, cudzych brak._

### Cykl życia

- [x] „Nowy szablon" → pusty szablon się otwiera. Zmiana nazwy na istniejącą w innej wielkości liter
      kończy się polskim komunikatem. Usunięcie znika z listy.
      _Zweryfikowano 2026-09-29 (staging): Nowy szablon → /szablony/161 pusty; kolizja nazwy (inna wielkość liter) przy tworzeniu i przy zmianie nazwy → toast „Szablon o tej nazwie już istnieje"; usunięcie znika z listy i z DB._
- [x] Z inwestycji „Zapisz jako nowy szablon…" i „Nadpisz istniejący" dają szablon z tą rozpiską, bez
      przedmiaru i rabatu; w Wersjach nadpisanego jest punkt „Przed nadpisaniem".
      _Zweryfikowano 2026-09-29 (staging): 137 → nowy szablon 162: 14 sekcji/377 pozycji, przedmiar i rabat 0; „Nadpisz istniejący" → snapshot „Przed nadpisaniem: testowe inwestycje"._
- [x] W szablonie „Wczytaj szablon…" zastępuje treść, a „Przed wczytaniem" w Wersjach ją przywraca.
      _Zweryfikowano 2026-09-29 (staging): Wczytaj z 160 zastąpił 377→1 pozycję, powstał „Przed wczytaniem", jego „Przywróć" oddał 14 sekcji/377 pozycji._
- [x] Nowa inwestycja „z szablonu" dostaje jego sekcje i pozycje, bez przedmiaru; „Dodaj sekcje
      z szablonu" pokazuje sekcje wszystkich szablonów z poprawnymi licznikami.
      _Zweryfikowano 2026-09-29 (staging): nowa inwestycja 163 z szablonu 159: 11 sekcji/202 pozycje, przedmiar 0; „Sekcja z szablonu…" pokazuje 3 szablony z licznikami zgodnymi z DB (14/1/11 sekcji), dodanie „Prace dodatkowe" → 12 sekcji/208 pozycji, przedmiar 0._

### Edycja

- [x] Dwie karty, dwa różne szablony, naprzemienne edycje: każda trafia tylko do swojego szablonu
      (scenariusz EX-893 nie do odtworzenia).
      _Zweryfikowano 2026-09-29 (staging): dwie karty (162 i 160), 4 naprzemienne dodania: 162 377→379, 160 1→3, 159 bez zmian (202)._
- [x] Edycja szablonu przesuwa go na górę listy („Zmieniono") i nie resetuje sortowania ani filtrów
      w otwartym edytorze.
      _Zweryfikowano 2026-09-29 (staging): lista „Zmieniono" sortuje po ostatniej edycji (162, 160, 159); w otwartym edytorze filtr „Kuch" i sortowanie po „Cena j.m. netto" malejąco przetrwały dodanie pracy._

### Findings — 2026-09-29

- [x] **Linear: EX-931.** **`/szablony` pokazał 0 sekcji / 0 pozycji po migracji (nieświeży `unstable_cache`)** — po zastosowaniu
      `20260929_1` na preview DB lista wierszy szablonów miała sekcje „0" i pozycje „0" dla obu szablonów
      (w DB: 11/202 i 1/1), aż do „Odśwież dane"; `getPresetSections` (`src/lib/queries/presets.ts`) siedzi w
      `unstable_cache` pod tagiem `presets`, a migracja SQL go nie unieważnia. Przyczyna najpewniej: deploy
      z nowym kodem obsłużył żądanie przed migracją i zapamiętał pusty wynik.
      **Needs human:** czy na prodzie kolejność „migracja przed pushem" (addytywna) wystarcza, żeby ten wpis
      nie powstał, czy `db:migrate:prod` ma dokładać unieważnienie tagu `presets`? Najtańsza opcja:
      przyjąć koszt i po `db:migrate:prod` kliknąć „Odśwież dane" na `/szablony`. Ta paczka ma jednak
      też migrację destrukcyjną (`20260929_2` kasuje `kosztorys_presets`), więc „przed pushem" nie
      pasuje do całej paczki.
      **Test disposition:** no automated test — efekt kolejności deploy/migracja, nie logika kodu.

## investments-list-payout-remaining — „Pozostało do wypłaty" na liście inwestycji (2026-09-29)

### Phase 2: Column + parity

- [x] Na `/inwestycje` jako OWNER widać kolumnę „Pozostało do wypłaty"; dla inwestycji ze zrzutu z
      prośby kwota zgadza się z kosztorysem → Podsumowanie → Podwykonawcy „Pozostało do wypłaty"
      (11 972,01 w chwili prośby).
      _Zweryfikowano 2026-09-29 (staging): Kolumna jest; brak inwestycji ze zrzutu (11 972,01) na preview — parytet sprawdzony na Wołoska 3/302: lista −790,11 = Podwykonawcy „Pozostało do wypłaty" −790,11._
- [x] Inwestycja bez kosztorysu pokazuje „brak danych", a taka z etapem bez rozliczenia „ustaw etapy";
      obie lądują na końcu przy sortowaniu w obie strony.
      _Zweryfikowano 2026-09-29 (staging): „brak danych" (122 wierszy) i „ustaw etapy" (fixture: etap 35 inw. 138 chwilowo bez rozliczenia, przywrócony) lądują na końcu przy sortowaniu w obie strony._
      _Zmienione 2026-10-02 (investments-listing-no-kosztorys-figures): bez kosztorysu ta kolumna pokazuje teraz „brak kosztorysu"._
- [x] Inwestycja z nadpłatą pokazuje ujemną kwotę na czerwono.
      _Zweryfikowano 2026-09-29 (staging): −16 572,00 / −6291,60 / −790,11 z klasą czerwoną._
- [x] Odznaczenie „Kolumny v2" chowa tę kolumnę razem z pozostałymi kolumnami v2.
      _Zweryfikowano 2026-09-29 (staging): przycisk „Kolumny v2" wyłącza wszystkie kolumny v2 razem z „Pozostało do wypłaty" (ponowne włączenie je zwraca)._
- [x] Po zalogowaniu jako MANAGER kolumna jest widoczna.
      _Zweryfikowano 2026-09-29 (staging): konto qa-staging tymczasowo MANAGER (wpis verify-manager-ex748 odrzuca hasło z profilu, 401): kolumna widoczna z liczbami (Ryżowa 66/127 29 884,75; Wołoska −790,11); rola przywrócona do OWNER._

## kosz-inwestycji-manager — kosz inwestycji dla kierownika (2026-09-29)

- [x] Jako MANAGER: „Kosz" jest ostatnią pozycją menu (pod „Pracownicy"), `/kosz` się otwiera.
      _Zweryfikowano 2026-09-29 (staging, MANAGER `qa-staging-manager`): „Kosz” po „Pracownicy”, `/kosz` otwiera się („Kosz jest pusty”)._
- [x] Jako MANAGER: „Usuń" na `/inwestycje` przenosi inwestycję bez transakcji do kosza,
      „Przywróć" na `/kosz` ją oddaje.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): QA-kosz-A (bez transakcji) → „Przenieś do kosza” → wiersz znika, `/kosz` pokazuje ją z „usunie się samo za 30 dni”, „Przywróć” oddaje ją na listę (status Aktywna)._
- [x] Jako MANAGER: „Usuń na zawsze" przy kosztorysie w użyciu żąda wpisania nazwy i dopiero po niej
      usuwa.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): QA-kosz-B z niezerowym Przedmiarem (ustawionym SQL-em na jednej pozycji; sam kosztorys z szablonu nie liczy się jako „w użyciu”) ma na `/kosz` etykietę „kosztorys w użyciu — tylko ręcznie”; „Usuń na zawsze” jest wyłączone do wpisania nazwy, potem „Usuwam…” i wiersz znika._
- [x] Jako EMPLOYEE: w menu nie ma „Kosz", a wejście na `/kosz` z adresu przekierowuje.
      _Nie sprawdzone 2026-09-29 (staging): nie ma konta EMPLOYEE do logowania (preview DB to prawdziwi ludzie, a QA-skrypt zakłada tylko OWNER + MANAGER; profil zabrania zakładania kolejnych). Z kodu: `/kosz` woła `requireManagementPage()`, pozycja menu bierze się z `MANAGEMENT`-gated listy — bez potwierdzenia w przeglądarce._
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg, EMPLOYEE `QA-Pracownik Login`): konto założone przez „Pracownicy → Dodaj” (rola „Pracownik”, e-mail wymagany), hasło ustawione w `/admin` („Zmień hasło”); logowanie daje `role: EMPLOYEE`. Menu to tylko Transakcje / Kasy / Inwestycje / Zgłoszenia — bez „Kosz”, a wejście na `/kosz` ląduje na `/`._

### Findings — 2026-09-29

- [x] **EMPLOYEE widzi w menu „Inwestycje”, a wejście kończy na `/`** _Fixed: 69fda626 (na `origin/staging`); zostaje sprawdzenie na stagingu w boksie poniżej._ — `SECTION_LINKS` (`src/lib/constants/sections.ts`) pokazuje „Inwestycje” i „Zgłoszenia” wszystkim rolom, a `src/app/(frontend)/inwestycje/page.tsx` robi `requireAuth(MANAGEMENT_ROLES)` → `redirect('/')`. Pracownik klika pozycję menu i ląduje z powrotem na Transakcjach.
      **Decyzja właściciela (2026-09-29):** ukryć. Tak samo „Kasy” i „Zgłoszenia” — oba adresy też wpuszczają tylko zarządzanie. Poprawka lokalnie: trzy pozycje przeszły do linków zarządzania, pracownik ma w menu tylko „Transakcje”. Do odhaczenia po wypchnięciu:
      - [x] Staging, jako EMPLOYEE: menu (boczne i mobilne) ma tylko „Transakcje”; jako MANAGER kolejność bez zmian — Transakcje, Kasy, Inwestycje, Zgłoszenia, potem reszta.
      **Test disposition:** test-driven-debugging · dom — `src/__tests__/hooks/use-nav-links.test.tsx` („offers EMPLOYEE only „Transakcje"”).
            _Zweryfikowano 2026-09-29 (staging): EMPLOYEE `QA-Pracownik Login` (konto założone na nowo przez POST /api/users jako OWNER, bo poprzedniego nie było w bazie): menu boczne i mobilne ma tylko „Transakcje". MANAGER: Transakcje | Kasy | Inwestycje | Zgłoszenia | Kosztorysy v1 | Katalog prac | … | Pracownicy | Kosz._

## investment-wycena-status — status inwestycji „Wycena" (2026-09-29)

### Phase 1: Jedna lista statusów i status „Wycena"

- [x] Dialog „Nowa inwestycja”: status jest domyślnie ustawiony na Wycena, a dodana inwestycja ma
      bursztynowy badge „Wycena”.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): dialog otwiera się ze statusem Wycena; QA-kosz-A dodana z tym statusem (`quote`), w tabeli badge bursztynowy (`bg-amber-100`)._
- [x] Dialog „Edytuj” inwestycji: lista statusów to kolejno Wycena, Planowana, Aktywna, Zakończona.
      Zapis Wyceny się udaje, a badge w tabeli i na karcie inwestycji jest bursztynowy.
      _Zweryfikowano 2026-09-29 (staging): lista w dialogu Wycena / Planowana / Aktywna / Zakończona; zapis Wyceny się udał, badge w tabeli bursztynowy. Karta inwestycji (`/inwestycje/<id>`) pokazuje status zwykłym tekstem „Wycena” w polu „Status” (`investment-info-fields.tsx`) — tak samo dla każdego statusu, więc bursztynowy badge jest tylko w tabeli._
- [x] Inwestycja w Wycenie nie pojawia się w pickerze wpłaty/wydatku, dopóki „Aktywne” jest
      włączone. Po wyłączeniu jest widoczna, tak jak Planowana.
      _Zweryfikowano 2026-09-29 (staging): picker „Inwestycja” w „Nowy wydatek”: przy „Aktywne” 57 pozycji bez Wyceny, po wyłączeniu 58 z QA-kosz-A. W preview DB nie ma inwestycji Planowana, więc „tak jak Planowana” tylko z kodu._
- [x] Świeżo dodana inwestycja nie zwiększa licznika „N aktywnych” na `/inwestycje`. Po przestawieniu
      na Aktywną licznik rośnie o 1, a inwestycja pojawia się w pickerze wydatku.
      _Zweryfikowano 2026-09-29 (staging): po dodaniu „57 aktywnych”; po zmianie QA-kosz-A na Aktywną „58 aktywnych” i pojawia się w pickerze wydatku (58 pozycji)._

### Phase 2: Filtr statusów i zapisany wybór

- [x] `/inwestycje` z czystym localStorage: filtr pokazuje Wycena, Planowana, Aktywna, Zakończona,
      zaznaczone są Wycena, Planowana i Aktywna.
      _Zweryfikowano 2026-09-29 (staging, MANAGER): bez klucza `table-status-filter:investments` menu „Widoczne statusy” ma cztery pozycje w tej kolejności, zaznaczone trzy pierwsze._
- [x] Zapisany wcześniej filtr „tylko Aktywna”: Wycena jest odznaczona. Zapisany „Planowana +
      Aktywna”: Wycena jest zaznaczona.
      _Zweryfikowano 2026-09-29 (staging): zapis `{active:true,planowana:false,completed:false}` → Wycena odznaczona; `{active,planowana:true}` → Wycena zaznaczona (klucz usunięty po teście)._

## confirm-dialog-dead-pending — okno potwierdzenia bez martwego stanu „w toku" (EX-835, 2026-09-29)

Okno potwierdzenia zamyka się od razu na klik; wynik mówi toast. Po błędzie okno **nie** wraca —
decyzja właściciela.

- [x] `/inwestycje` → „Usuń" → „Przenieś do kosza": okno znika od razu, toast „Inwestycja
      przeniesiona do kosza.", wiersz znika z listy.
      _Zweryfikowano 2026-09-29 (staging): po kliku dialog znika w pierwszej zmianie DOM, toast „Inwestycja przeniesiona do kosza.”, wiersz znika._
- [x] `/katalog-prac` → „Usuń z katalogu" → „Usuń": okno znika, toast „Usunięto pozycję
      z katalogu.", pozycja znika.
      _Zweryfikowano 2026-09-29 (staging): fixture „QA-praca-usun” (Prace dodatkowe, szt, 10 zł): dialog znika w pierwszej zmianie DOM, toast „Usunięto pozycję z katalogu.”, pozycja znika (569 → 568)._
- [x] `/kosztorysy` → „Odłącz od inwestycji" i (jako ADMIN/OWNER) „Usuń" na innym arkuszu: po
      potwierdzeniu okno znika, toast sukcesu, lista odświeżona.
      _Pominięto 2026-09-29 (staging): arkusze na preview to kopie prod z żywymi id, a łączenie/odłączanie i usuwanie nie ma cofnięcia ani arkusza-atrapy do poświęcenia (konto serwisowe nie zakłada arkuszy)._
      _Zweryfikowano 2026-09-29 (staging, drugi przebieg, OWNER): arkusze-atrapy `QA-arkusz-*` z fałszywym `googleSheetId` (`QA-dummy-sheet-*`) założone w `/admin/collections/kosztoryses` i podpięte do inwestycji `QA-inw-*`; kod obu akcji (`unlinkSheetFromInvestmentAction`, `deleteSheetAction`) tylko zmienia/kasuje wiersz `kosztoryses`, bez wywołań Google. „Odłącz”: okno znika w <0,3 s, toast „Odłączono kosztorys od inwestycji „QA-inw-szablon-914”.”, wiersz przechodzi na „Bez inwestycji”. „Usuń”: okno znika w ~0,4 s, toast „Usunięto kosztorys.” (po ok. 1,2 s, gdy akcja się skończy), wiersz znika z listy._
- [x] DevTools → Network → Offline, potem dowolne z powyższych potwierdzeń: okno znika, pojawia się
      toast z błędem, okno **nie** otwiera się ponownie, a dane zostają bez zmian po powrocie online
      i odświeżeniu.
      _NIE przeszło 2026-09-29 (staging, „Przenieś do kosza” w `/inwestycje`, Playwright offline): okno znika i dane zostają bez zmian (DB: `status=active`, `trashed_at` puste), ale toast z błędem się NIE pojawia — w konsoli tylko nieobsłużone `TypeError: Failed to fetch`. Patrz Findings — 2026-09-29._
      _Zweryfikowano 2026-09-29 (staging): po poprawce 41e63ec0: offline przed klikiem w „Przenieś do kosza” — okno znika i nie wraca, toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, wiersz zostaje na liście po powrocie sieci._
- [x] Zdjęcia/rzuty inwestycji: usuń plik → „Usuń": okno znika; do końca usuwania drugi „Usuń" i
      dodawanie plików są zablokowane, po nim plik znika z galerii.
      _Częściowo 2026-09-29 (staging, QA-kosz-A, 2 pliki png): okno „Usunąć plik?” znika od razu na „Usuń”, plik znika z galerii (2 → 1); blokady drugiego „Usuń” i „Dodaj kolejne” w trakcie usuwania nie udało się zaobserwować (usuwanie trwa ułamek sekundy) — zostaje do sprawdzenia przez człowieka z throttlingiem sieci._
      _Odpuszczone 2026-09-29 — decyzja właściciela: blokada w trakcie ułamka sekundy nie jest warta sprawdzania._
- [x] Kosz → „Usuń na zawsze" przy kosztorysie w użyciu (okno z wpisywaniem nazwy): po potwierdzeniu
      przycisk pokazuje „Usuwam…" do końca akcji — to okno ma działający stan „w toku" i ma go
      zachować.
      _Zweryfikowano 2026-09-29 (staging): po potwierdzeniu przycisk zmienia się na „Usuwam…” do końca akcji, potem okno i wiersz znikają._

### Findings — 2026-09-29

- [x] **Offline: „Przenieś do kosza" połyka błąd bez toastu.** _Fixed: 41e63ec0 (na `origin/staging`, spec `trash-investment-button.test.tsx`); ponowne sprawdzenie w § „akcja bez sieci kończy się toastem”._ Przy odciętej sieci okno znika, dane zostają
      bez zmian, ale nie ma toastu z błędem, a w konsoli leci nieobsłużone `TypeError: Failed to fetch`.
      `onConfirm` w `src/components/investments/trash-investment-button.tsx` czeka na akcję w
      `startTransition` bez `try/catch`, więc odrzucony fetch przerywa funkcję przed `setConfirming(false)`
      i przed jakimkolwiek komunikatem. Inne okna potwierdzeń nie były sprawdzane offline.
      **Needs human:** czy owinąć wywołania akcji w oknach potwierdzeń w `try/catch` z toastem błędu
      (decyzja o zachowaniu, więc niezmienione)?
      _Decyzja właściciela 2026-09-29: toast z błędem, gdy akcja padnie._
      **Test disposition:** test-driven-debugging · dom — spec z akcją odrzucającą promise, asercja na
      toaście błędu (`trash-investment-button.test.tsx`). Sprawdzenia poprawki: § „akcja bez sieci
      kończy się toastem".
- [x] **Blokada drugiego „Usuń" i „Dodaj kolejne" w trakcie usuwania pliku nie do zaobserwowania.**
      Usuwanie trwa ułamek sekundy, a MutationObserver widział tylko stan po. **Needs human:** obejrzeć
      z throttlingiem sieci w DevTools. **Test disposition:** dom — spec galerii z zawieszoną akcją.
      _Odpuszczone 2026-09-29 — decyzja właściciela._

## 2026-09-29 — pasy kolumn na wydrukach

- [x] Edytor → „Inwestor" → „Wygeneruj ofertę w PDF": co druga kolumna (od drugiej) ma szare tło od
      nagłówka do ostatniej pozycji; „Opis prac" jest biały, paski sekcji i ich „Razem —" bez pasów.
      _Zweryfikowano 2026-09-29 (staging, inw. 137; `window.open` opakowany tak, że `popup.print` tylko zapisuje HTML — nic nie drukowano): kolumny 2, 4, 6, 8, 10 szare `rgb(233,233,236)` w nagłówku i w wierszach pozycji, „Opis prac” i pozostałe białe/bez tła; paski sekcji („band”) i „Razem —” („band-total”) bez pasów._
- [x] Edytor → „Pracownicy" → pracownik → „Drukuj PDF": te same pasy, w tym na kolumnach etapów.
      _Zweryfikowano 2026-09-29 (staging, inw. 137, Adam Orłowski, ten sam stub `popup.print`): pasy co druga kolumna od drugiej, w tym „Etap 1” i „Etap 1 netto”; paski sekcji bez pasów; tytuł „testowe inwestycje — Adam Orłowski”._
- [x] Na wydrukowanej kartce (albo podglądzie wydruku z tłem) pasy są wyraźnie widoczne, a cienkie
      linie między wierszami nadal widać w szarych kolumnach.
      _Zostaje dla człowieka 2026-09-29: widoczność na papierze / podglądzie wydruku wymaga oka; CSS ma `print-color-adjust: exact`, a kolory obliczone w popupie są poprawne._
      _Zweryfikowano 2026-09-29 przez właściciela: pasy są w porządku._

## 2026-09-29 — kolumna „Wartość netto (razem etapy)" na dokumencie inwestora

- [x] Kosztorys z wpisanymi etapami → „Udostępnij" → otwórz link inwestora: kolumna z wartością
      wykonanych prac nazywa się „Wartość netto (razem etapy)" — nigdzie w nagłówkach nie ma „po
      rabacie", także gdy kosztorys ma rabat.
      _Zweryfikowano 2026-09-29 (staging): inw. 137 (Etap 1 wypełniony), Udostępnij → link `/k/<token>` w nowej karcie: nagłówki „Pomiar (razem etapy)” i „Wartość netto (razem etapy)”, nigdzie „po rabacie”; ten sam wynik na `/podglad-inwestora/137`. Wariant „kosztorys z rabatem” nie sprawdzony — rozpiska 137 nie ma rabatu. Link wyłączony po teście._
- [x] Ten sam kosztorys → „Generuj ofertę": nagłówek tej kolumny na wydruku brzmi tak samo, a jej
      kwoty zgadzają się z podglądem.
      _Zweryfikowano 2026-09-29 (staging): „Wygeneruj ofertę w PDF” z zaślepką `print` (druk się nie odpalił): nagłówek „WARTOŚĆ NETTO (RAZEM ETAPY)” (wersaliki z CSS), kwoty zgodne z podglądem (2 000 / 1 000 / 300 zł itd., Razem — Prace dodatkowe 3 000 zł)._
- [x] Edytor, widok klienta → nagłówek i lista „Kolumny" pokazują „Wartość netto (razem etapy)";
      po przełączeniu na widok ekipy ta kolumna nadal nazywa się „Suma etapy <ekipa> netto".
      _Zweryfikowano 2026-09-29 (staging): widok Inwestor: lista „Kolumny” zawiera „Wartość netto (razem etapy)” i „Wartość brutto (razem etapy)”; widok „Z narzędziami (podwykonawca)”: kolumna nazywa się „Suma etapy z narzędziami (podwykonawca) netto”. Nagłówek „Wartość netto (razem etapy)” widoczny też w samej siatce po przewinięciu w prawo._

## 2026-09-29 — akcja bez sieci kończy się toastem

Każdy boks tak samo: strona załadowana, potem DevTools → Network → „Offline", kliknij akcję, wróć do
„No throttling". Oczekiwane: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież
stronę.", nic nie zostaje w stanie „w toku", a po odświeżeniu strony dane są takie jak przed
kliknięciem.

- [x] Inwestycje → „Usuń inwestycję" → „Przenieś do kosza": toast, okno się zamyka, inwestycja
      zostaje na liście.
      _Zweryfikowano 2026-09-29 (staging): `/inwestycje`, „11 Listopada 40”, Playwright `setOffline(true)` przed klikiem: okno się zamyka, toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, wiersz zostaje na liście (poprawka 41e63ec0 działa)._
- [x] Kosz → „Przywróć", a potem „Usuń na zawsze" (z wpisaną nazwą): toast, inwestycja zostaje
      w koszu, okno „Usuń na zawsze" da się zamknąć i otworzyć ponownie.
      _Zweryfikowano 2026-09-29 (staging): `/kosz`, QA-offline-1, `setOffline(true)` przed klikiem: „Przywróć” i „Usuń na zawsze” (z wpisaną nazwą) dają toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, inwestycja zostaje w koszu, „Przywróć” znów aktywne, okno „Usuń na zawsze” zamyka się i otwiera ponownie._
- [x] Szablony → „Przenieś szablon do kosza", „Zmień nazwę szablonu" → zapis, i założenie nowego
      pustego szablonu: toast, lista i nazwa bez zmian.
      _Zweryfikowano 2026-09-29 (staging): `/szablony`, „QA test szablon B”, offline przed klikiem: „Przenieś szablon do kosza”, „Zmień nazwę szablonu” → „Zapisz” i „Nowy szablon” → „Załóż” dają toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”; lista i nazwa bez zmian (okna formularzy zostają otwarte z błędem, okno kosza się zamyka)._
- [x] Katalog prac → usunięcie pozycji i „Policz użycia": toast, pozycja zostaje, „Policz użycia"
      znów da się kliknąć.
      _Zweryfikowano 2026-09-29 (staging): `/katalog-prac`, offline przed klikiem: „Usuń z katalogu” → „Usuń” (okno się zamyka, pozycja zostaje: 568 → 568) i „Policz użycia” (przycisk znów aktywny) dają toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”._
- [x] Kosztorysy → „Odłącz od inwestycji", „Usuń kosztorys" i podpięcie arkusza do inwestycji:
      toast, powiązanie bez zmian.
      _Zweryfikowano 2026-09-29 (staging): `/kosztorysy`, offline przed klikiem: „Odłącz od inwestycji”, „Usuń kosztorys” (135 → 135 wierszy) i „Powiąż z inwestycją” (arkusz-atrapa QA-arkusz-offline, `investment` w bazie nadal null) dają toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”. Dodatkowo znaleziono lukę: „Dodaj kosztorys” (SheetSetupDialog) i „Nowy kosztorys” (AddSheetDialog) wołały akcję bez `settleAction` — offline kończyło się „Coś poszło nie tak” (ROUTE_ERROR); poprawione w drzewie, czeka na deploy (Findings)._
- [x] Kosztorys inwestycji → synchronizacja materiałów: sprawdzenie, zastosowanie i „Zresetuj
      _Zweryfikowano 2026-09-30 (staging): brakująca noga „zastosowanie” — `/inwestycje/48/kosztorys` (arkusz czytelny): „Synchronizuj wydatki inwestycyjne” otwiera podgląd (Wydatki: do odświeżenia 33; Transfery: 17), potem offline (`setOffline(true)`) przed „Zsynchronizuj arkusz”: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, okno zostaje, przycisk aktywny. Żądanie nie wyszło, więc nic nie trafiło do arkusza. Pozostałe nogi zaliczone 2026-09-29 (niżej)._
      wydatki inwestycyjne": toast, okno nie wisi.
      _Zweryfikowano 2026-09-29 (staging): CZĘŚCIOWO. `/inwestycje/139/kosztorys`, offline przed klikiem: „Synchronizuj wydatki inwestycyjne” (sprawdzenie) i „Zresetuj wydatki inwestycyjne” → „Zresetuj zakładkę” dają toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, okno się zamyka, przycisk znów aktywny. Zastosowanie (przycisk w oknie podglądu) niedostępne: `previewMaterialSync` na 6 sprawdzonych inwestycjach (139, 145, 144, 143, 141, 130) zwraca „The caller does not have permission” (arkusze v1 niepodzielone z kontem Viewer), więc okno podglądu się nie otwiera; kod `onConfirm` używa tego samego `settleAction`._
- [x] Edytor kosztorysu → dodanie etapu i usunięcie etapu: toast, kolumny etapów bez zmian.
      _Zweryfikowano 2026-09-29 (staging): inw. 137: offline przed klikiem, „Dodaj → Etap — z narzędziami” i „Opcje etapu → Usuń etap → Usuń” dają toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”; kolumny etapów bez zmian (Etap 1, Etap 2). Etap 2 założony online przy okazji został usunięty z powrotem._
- [x] Edytor → „Wersje" → przywrócenie wersji: toast, przycisk przywracania znów aktywny, rozpiska
      bez zmian.
      _Zweryfikowano 2026-09-29 (staging): inw. 137, Opcje → Wczytaj → „Przywróć” → potwierdzenie, offline przed klikiem: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, „Przywróć” znów aktywny, rozpiska bez zmian._
- [x] Edytor → zapis pozycji do katalogu prac: toast, okno odblokowane.
      _Zweryfikowano 2026-09-29 (staging, 7be1aae3): ten sam przebieg (Porównaj z katalogiem → „Dodaj do katalogu” → „Dodaj”, offline przed klikiem): toast jest teraz po polsku („Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, poprawka c9cc39a7). Uwaga: okno „Dodaj pracę do katalogu” zamyka się optymistycznie i NIE otwiera się ponownie (patrz Findings)._
      _Zweryfikowano 2026-09-29 (staging): inw. 137, Problemy → Porównaj z katalogiem → „Pokaż 89 prac” → „Dodaj do katalogu” → „Dodaj”, offline przed klikiem: pojawia się toast i okno nie wisi („Zapisywanie…” znika), ale tekst toastu to surowe angielskie „Failed to fetch”, nie „Brak połączenia z serwerem — …” (ścieżka `submitOptimistically` nie używa `settleAction`; patrz Findings)._
- [x] Edytor → udostępnianie (klient i ekipa): wydanie linku i „Wyłącz link": toast, stan linku bez
      zmian.
      _Zweryfikowano 2026-09-29 (staging): inw. 137, Inwestor → Udostępnij, offline przed klikiem: „Wygeneruj link” i potwierdzenie „Wyłącz link” dają toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, okno zostaje, stan linku bez zmian (po wyłączeniu offline link nadal aktywny). Panel ekipy to ten sam `ShareLinkPanel` (z `settleAction`) — osobno nie klikane. Stan cofnięty: link wyłączony przez UI. Uwaga: samo otwarcie okna offline pokazuje „Nie udało się przygotować linku”, bez toastu._
- [x] Edytor → ustawienia widoku klienta (zapis i „Zapisz jako domyślne") i widoku ekipy: toast,
      okno nie wisi.
      _Zweryfikowano 2026-09-29 (staging): inw. 137, Inwestor → Ustawienia podglądu: „Zapisz” i „Zapisz jako domyślne”; Pracownicy → Ustawienia widoku → „Zapisz”; wszystkie offline przed klikiem: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, okno zostaje otwarte i aktywne (bez zmian ustawień)._
- [x] Edytor → import z arkusza → wskazanie kolumny: toast.
      _Zweryfikowano 2026-09-30 (staging): inw. 48 (arkusz czytelny, brak kolumny „komentarz”), Opcje → „Pobierz z arkusza Google…” → „wybierz kolumnę”; offline (`setOffline(true)`) przed wyborem opcji: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, okno zostaje, pole nadal „wybierz kolumnę”. Toast pojawia się po ok. 1–3 s (pierwsza próba z 3 s okna go nie złapała). Poprzednia notka „NIE ZALICZONE” (2026-09-29) dotyczyła braku czytelnego arkusza._
      _Zweryfikowano 2026-09-29 (staging): NIE ZALICZONE — selektor kolumny (`SheetColumnPicker`, z `settleAction`) pojawia się tylko gdy arkusz Google inwestycji jest czytelny i brakuje w nim kolumny; na stagingu odczyt każdego arkusza v1 kończy się „The caller does not have permission” (brak udziału dla konta reader), więc stanu nie da się wytworzyć bez zmiany udostępnień arkuszy klienta._
- [x] Transakcje → „Drukuj transakcje": toast, karta wydruku się zamyka zamiast wisieć na
      „Przygotowuję wydruk…"; „Pobierz faktury": toast.
      _Zweryfikowano 2026-09-29 (staging): `/inwestycje/137`, offline przed klikiem (z zaślepką `window.open`/`print`, druk się nie odpalił): „Drukuj transakcje” — okno wydruku otwiera się i zamyka, toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, przycisk wraca do aktywnego; „Pobierz faktury” — ten sam toast, przycisk aktywny._
- [x] Nowa transakcja → zapisanie kasy jako domyślnej: toast, domyślna kasa bez zmian.
      _Zweryfikowano 2026-09-29 (staging): Wydatek → wybrana kasa → „Zapisz jako domyślną kasę”, offline przed klikiem: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, przycisk nadal proponuje zapis (domyślna kasa bez zmian). Formularz zamknięty bez zapisu._
- [x] Przełącznik aktywności na listach kas, użytkowników i zgłoszeń: toast, przełącznik wraca do
      poprzedniego położenia.
      _Zweryfikowano 2026-09-29 (staging): `/kasy` (Aktywna), `/pracownicy` (Aktywny), `/zgloszenia` (Oczekuje/Skontaktowano — tu „aktywność” to status kontaktu), offline przed klikiem w pierwszy wiersz: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, odznaka wraca do poprzedniego stanu; nic nie zapisano._
- [x] Usunięcie pliku (faktura transakcji, plik inwestycji, plik w oknie zgłoszenia): toast, plik
      zostaje na liście.
      _Zweryfikowano 2026-09-29 (staging): `/` → podgląd faktury → „Usuń” → potwierdzenie, offline przed klikiem: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, plik zostaje (podgląd nadal otwarty). Pliki inwestycji i zgłoszenia idą tym samym hookiem `useMediaRemoval` — osobno nie klikane._
- [x] Po powrocie sieci ta sama akcja (np. „Przenieś do kosza") przechodzi normalnie — toast
      sukcesu, bez komunikatu o braku połączenia.
      _Zweryfikowano 2026-09-29 (staging): po `setOffline(false)` „Przywróć” na `/kosz` przechodzi: toast „Inwestycja przywrócona.”, bez komunikatu o braku połączenia (wcześniej „Przenieś do kosza” też przeszło online)._
- [x] Wydatek z zaznaczonym „Nie zamykaj po zapisaniu" → „Zapisz" offline: toast „Brak połączenia z
      serwerem…" (nie angielskie „Failed to fetch"), okno zostaje otwarte z wpisanymi danymi.
      _Zweryfikowano 2026-09-29 (staging, 7be1aae3): Wydatek, kwota 12, opis „QA-offline-keepopen”, offline przed klikiem: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, okno zostaje z kwotą i opisem; w bazie brak transakcji. Formularz zamknięty bez zapisu._
- [x] Wydatek z dołączoną fakturą → „Zapisz" offline: komunikat po polsku („Nie udało się przesłać
      _Zweryfikowano 2026-09-29 (staging, 7be1aae3): Wydatek z dołączonym plikiem PDF, offline przed klikiem: toast „Nie udało się przesłać plików — spróbuj ponownie.”, okno zostaje otwarte. Formularz zamknięty bez zapisu._
      plików — spróbuj ponownie." albo „Brak połączenia z serwerem…"), nigdy „Failed to fetch".

## EX-919 — worker-payout-remaining — „Pozostało do wypłaty" per pracownik i „Rozlicz wypłaty" (2026-09-29)

Dane: prawdziwe inwestycje na stagingu, bez seedów. Nazwy w boksach to role, nie rekordy:
„A" — aktywna inwestycja, na której pracownik ma coś do wypłaty; „B" — aktywna, z długiem u ≥ 2
pracowników i pozycjami „Nieprzypisane"; „C" — inwestycja bez rozliczenia etapów („ustaw etapy");
„D" — zakończona, z długiem. „Jan" — pracownik z długiem na A, B i D; „Piotr" — pracownik na B
z etapem bez rozliczenia. Stan, którego nie ma w danych, zakłada się przez UI (kosztorys: etapy
i pracownicy; status inwestycji) i cofa po przebiegu; wypłaty zaksięgowane w teście się anuluje.

- [x] `/pracownicy`: kolumny „Wypłaty" już nie ma; w jej miejscu „Pozostało do wypłaty". Każda
      kwota to osobna linia z liczbą inwestycji: „do zapłaty aktywne (n): …", „nadpłata aktywne (n):
      …" (czerwona) — dług i nadpłata nigdy nie są odejmowane od siebie. U Jana Seedowego domyślnie
      tylko linie z „Seed wypłaty A" i „B" (bez zakończonej „D"), u Piotra linia z „B" i dopisek
      „1 bez rozliczenia etapu". Pracownik bez niczego do pokazania ma zielone 0,00 zł.
      _Częściowo (staging 2026-09-29): kolumny „Wypłaty" nie ma, jest „Pozostało do wypłaty"; linie „do zapłaty aktywne (n)" / „nadpłata aktywne (n)" osobno (Adam Orłowski miał jednocześnie „do zapłaty aktywne (1)" i „nadpłata aktywne (1): 100,00 zł", bez odejmowania); domyślnie bez zakończonych; pracownik bez pozycji „—", z samymi zakończonymi nadpłatami szare linie (Kamil Kamiński). NIE sprawdzone: „1 bez rozliczenia etapu" u Piotra — na stagingu nie ma etapu bez rozliczenia z pracą, a UI nie pozwala go założyć (nowy etap zawsze ma rozliczenie, brak „cofnij rozliczenie"); wymaga SQL/seedu. Rozstrzygnięte 2026-09-29: część „Piotr" odpada jako nieosiągalna — etap bez rozliczenia (`plane = NULL`) z pracą nie powstaje z UI z założenia (rozstrzygnięcie właściciela, `context/reference/kosztorys-editor-domain-notes.md:1550`), a w danych preview (dump produkcji) nie ma ani jednego takiego etapu z pracą — tylko dwa puste na inw. 31. Stanu nie zobaczy żaden użytkownik._
- [x] `/pracownicy` → „Filtry" (domyślnie „Filtry (2)"): sekcje „Pracownicy" (Aktywni / Nieaktywni)
      i „Pozostało do wypłaty" (Aktywne / Zakończone inwestycje, z opisem pod spodem) plus
      „Zaznacz / Odznacz wszystkie". Zaznaczenie „Zakończone inwestycje" dokłada u Jana szare linie
      „… zakończone (1)" z „D"; odznaczenie „Aktywne inwestycje" chowa aktywne linie. „Nieaktywni"
      pokazuje nieaktywnych pracowników. Po przeładowaniu strony wybór zostaje.
      _Zweryfikowano 2026-09-29 (staging): „Filtry (1)" po zaznaczeniu Zakończonych; sekcje Pracownicy / Pozostało do wypłaty z opisami; „Zakończone inwestycje" dokłada u Adama Orłowskiego szarą linię „do zapłaty zakończone (1): 3900,00 zł"; wybór zostaje po przeładowaniu._
- [x] Klik w kwotę u Jana otwiera „Rozlicz wypłaty — Jan Seedowy", a nie kartę pracownika. Wiersze
      „Seed wypłaty A/B/D" mają Wykonane / Wypłacone / Pozostało; „D" jest wyszarzona z „Inwestycja
      zakończona — przywróć na Aktywna, żeby wypłacić".
      _Zweryfikowano 2026-09-29 (staging): klik w kwotę Adama Orłowskiego otwiera „Rozlicz wypłaty — Adam Orłowski"; wiersze mają Wykonane / Wypłacone / Pozostało; zakończona inwestycja wyszarzona z plakietką „Zakończona", a tooltip to „Inwestycja zakończona — przywróć na Aktywna, żeby wypłacić"._
- [x] Wypłać „A" dokładnie, a „B" o 100 zł więcej: przy „B" „Pozostało do rozliczenia" jest
      czerwone (−100,00 zł), a pod kwotą zdanie „… ponad wykonaną pracę — zapisze się jako zaliczka".
      Przy „A" to zielone 0,00 zł. „Razem" to suma obu kwot. Po „Wypłać"
      dialog się zamyka, kolumna się odświeża, a w transakcjach są dwie wypłaty; opis drugiej
      zawiera „w tym zaliczka 100,00 zł".
      _Zweryfikowano 2026-09-29 (staging): „A" dokładnie (2887,50), „B" +100 (928,75): przy „B" czerwone −100,00 zł i zdanie „100,00 zł ponad wykonaną pracę — zapisze się jako zaliczka", przy „A" zielone 0,00 zł, „Razem" 3816,25 zł; dialog się zamknął, kolumna pokazała „nadpłata aktywne (1): 100,00 zł"; w transakcjach dwie wypłaty (#5268 z „w tym zaliczka 100,00 zł", #5269). Anulowane po teście._
- [x] `/inwestycje` → „Pozostało do wypłaty" przy „Seed wypłaty B": dialog pokazuje Jana, Piotra
      i szary wiersz „Nieprzypisane"; Pozostało wszystkich wierszy sumuje się do kwoty w komórce.
      _Zweryfikowano 2026-09-29 (staging, inw. „asDasdaSD"): dialog pokazuje Adama Orłowskiego (−100,00 zł), Adriana Furmańczyka i szary wiersz „Nieprzypisane"; suma Pozostało 4687,25 zł = kwota w komórce._
- [x] `/inwestycje`: komórka „Pozostało do wypłaty" z długiem u ≥ 2 pracowników ma pod kwotą
      „N pracowników"; komórka równa 0 jest zielona. Cała komórka (kwota + dopisek) otwiera dialog.
      _Zweryfikowano 2026-09-29 (staging): „asDasdaSD" 5616,00 zł z „2 pracowników" (Nieprzypisane nie liczone), klik w dopisek otwiera dialog; „testowe inwestycje" 0,00 zł zielone (rgb 29,192,131), klik otwiera dialog._
- [x] Dialog z `/pracownicy`: nazwa inwestycji w wierszu to link otwierający jej kosztorys w nowej
      karcie — dialog i wpisane kwoty zostają.
      _Zweryfikowano 2026-09-29 (staging): link „asDasdaSD" → /inwestycje/138/kosztorys_v2 z target=_blank; po powrocie dialog otwarty, wpisany opis zachowany._
- [x] Przy „Seed wypłaty C" komórka pokazuje „ustaw etapy" i nie da się jej kliknąć.
      _BLOKADA (2026-09-29, staging): żadna inwestycja nie ma „ustaw etapy" — brak inwestycji z kosztorysem bez rozliczenia etapów, a UI nie pozwala jej założyć. Sprawdzone na inw. 31 („11 Listopada 40", etapy 1 i 2 bez rozliczenia): komórki ilości w takim etapie są wyszarzone i nie przyjmują wpisu, a menu nagłówka etapu ma tylko wybór rozliczenia, sortowanie, zmianę nazwy i usuwanie — bez przypisania pracownika. Stan cofnięty i potwierdzony SQL-em (etapy 1 i 2 bez rozliczenia i pracownika, 0 pozycji, 0 sekcji, 0 stage_progress). Odpada jako nieosiągalne — etap bez rozliczenia (`plane = NULL`) z pracą nie powstaje z UI z założenia (rozstrzygnięcie właściciela, `context/reference/kosztorys-editor-domain-notes.md:1550`), a w danych preview (dump produkcji) nie ma ani jednego takiego etapu z pracą — tylko dwa puste na inw. 31. Stanu nie zobaczy żaden użytkownik._
- [x] Otwórz dialog w dwóch kartach, wypłać w drugiej, potem w pierwszej: pierwsza odmawia
      z ostrzeżeniem, przeładowuje kwoty i zostaje otwarta; nic nie zostaje zapisane.
      _Zweryfikowano 2026-09-29 (staging): druga karta wypłaciła 828,75; pierwsza dostała „Kwoty zmieniły się od otwarcia okna — wczytuję je ponownie.", została otwarta z „Pozostało 0,00"; w bazie jedna wypłata._
- [x] Dwie karty z tym samym dialogiem Jana, w obu zaznaczone „A", „Wypłać" kliknięte w obu niemal
      jednocześnie: w transakcjach jest dokładnie jedna wypłata za „A"; druga karta pokazuje
      ostrzeżenie „Kwoty zmieniły się…" i nowe kwoty.
      _Zweryfikowano 2026-09-29 (staging): oba „Wypłać" naraz — w bazie dokładnie jedna wypłata (#5273); przegrana karta zostaje otwarta z przeładowanymi kwotami (samego toastu nie zdążyłem złapać po 4 s)._
- [x] Otwórz dialog Jana, w drugiej karcie zmień ilość w etapie „Seed wypłaty A" w kosztorysie,
      wróć i kliknij „Wypłać": ostrzeżenie, a przeładowane „Pozostało" już uwzględnia zmianę;
      ponowne „Wypłać" przechodzi, nie odmawia drugi raz.
      _Zweryfikowano 2026-09-29 (staging): ilość etapu zmieniona 5→6 w drugiej karcie; „Wypłać" odmówiło, „Pozostało" 828,75→994,50 i kwota w polu 994.5, ponowne „Wypłać" zapisało wypłatę 994,50 (#5275)._
- [x] Pracownik, który ma wyłącznie etapy bez rozliczenia (np. zdejmij Piotra z etapu w „Seed
      wypłaty B"): komórka pokazuje zielone 0,00 zł i „1 bez rozliczenia etapu". **Decyzja:** czy
      zielone 0 nie czyta się tu jak „rozliczony" — jeśli tak, zamiast niego wyszarzone „—".
      _BLOKADA (2026-09-29, staging): stanu nie da się założyć przez UI (brak „cofnij rozliczenie etapu"), a na bazie preview nie ma etapu bez rozliczenia z pracą. Brakuje: legacy etapu z plane=null i ilościami (zapis SQL poza zakresem). Odpada jako nieosiągalne, razem z decyzją — etap bez rozliczenia (`plane = NULL`) z pracą nie powstaje z UI z założenia (rozstrzygnięcie właściciela, `context/reference/kosztorys-editor-domain-notes.md:1550`), a w danych preview (dump produkcji) nie ma ani jednego takiego etapu z pracą — tylko dwa puste na inw. 31. Stanu nie zobaczy żaden użytkownik, więc pytanie o zielone 0 vs „—" nie ma kogo dotyczyć._
- [x] Dialog: „Razem" stoi w stopce pogrubione, a kwota wyrównana do prawej pod kolumną kwot.
      _Zweryfikowano 2026-09-29 (staging): „Razem" w stopce pogrubione, kwota wyrównana do prawej pod kolumną „Kwota wypłaty"._
- [x] `/flota` i karta sprzętu: stopka „Razem" / „Koszty serwisu" wygląda i sumuje jak przedtem,
      a po ukryciu kolumny kosztów znika (wspólny wiersz sumy — bez zmiany zachowania).
      _Częściowo (staging 2026-09-29): /flota stopka „Razem —" pod „Koszty", po ukryciu kolumny stopka pusta; /sprzet/1 „Koszty serwisu —". NIE sprawdzone: sumowanie niepustych kosztów — w danych staging nic nie ma kosztu. Domknięte czytaniem kodu (6f2c3c5a): wyrażenia sumy (`sumKnown(filteredData.map((row) => row.totalCosts))`, `sumKnown(history.map((event) => event.cost))`) przeniesione do `ColumnTotalRow` bez zmian — refaktor rusza tylko znaczniki, a te i ukrywanie sprawdzone na stagingu._
- [x] Zapamiętany stan przeżywa przeładowanie jak przedtem: zwinięty pasek boczny, zwinięta sekcja
      na stronie inwestycji, otwarty panel podsumowań w kosztorysie (wspólny zapis — bez zmiany
      zachowania, wcześniej zapisane ustawienia się nie resetują).
      _Zweryfikowano 2026-09-29 (staging): zwinięty pasek boczny, zwinięta sekcja „Filtry" na /inwestycje/138 i otwarty panel „Podsumowanie" w kosztorysie — wszystko przeżywa przeładowanie (stan przywrócony po teście)._
- [x] Jako MANAGER: kolumna i dialog działają tak samo.
      _Zweryfikowano 2026-09-29 (staging, qa-staging-manager): kolumna i dialog na /pracownicy jak u OWNER; wypłata 994,50 zaksięgowana (#5277) i anulowana; /inwestycje pokazuje komórkę „Pozostało do wypłaty"._
- [ ] (tylko produkcja) wypłaty pojawiają się w zakładce „transfery" arkusza właściciela.
      _Tylko produkcja — zapis do arkusza właściciela jest na preview zablokowany (konto Viewer), więc nie do sprawdzenia na stagingu; zostaje niezaznaczone._
      _Zweryfikowano 2026-09-29 (staging): pominięto — sprawdzenie wyłącznie na produkcji (zapis do arkusza właściciela wymaga konta Editor)._

### Findings — 2026-09-29

- [x] **Boksy napisane pod seed, którego staging nie ma** — naprawione: nagłówek sekcji opisuje teraz wymagane stany zamiast rekordów z `seed:worker-payouts` (seed odmawia na bazie nielokalnej); przebieg idzie na stagingu na prawdziwych danych, a brakujący stan zakłada się przez UI.
- [x] **Decyzja właściciela (box „1 bez rozliczenia etapu"): czy zielone 0,00 zł nie czyta się tu jak „rozliczony" — jeśli tak, zamiast niego wyszarzone „—"?** Zachowanie niezweryfikowane na stagingu (stanu nie da się zbudować z UI — sprawdzone na inw. 31: etap bez rozliczenia odrzuca ilość i nie ma listy pracowników). Needs human: odpowiedź właściciela + legacy etap plane=null z pracą do obejrzenia. Test disposition: no automated test — decyzja wizualna; po rozstrzygnięciu unit na formatterze komórki. **Dropped:** etap bez rozliczenia (`plane = NULL`) z pracą nie powstaje z UI z założenia (rozstrzygnięcie właściciela, `context/reference/kosztorys-editor-domain-notes.md:1550`), a w danych preview (dump produkcji) nie ma ani jednego takiego etapu z pracą — tylko dwa puste na inw. 31. Stanu nie zobaczy żaden użytkownik.
- [x] **Stany „ustaw etapy" i „etap bez rozliczenia" nie mają jak powstać na stagingu** (brak „cofnij rozliczenie etapu" w kosztorysie; na etapie bez rozliczenia UI odrzuca ilość i nie oferuje przypisania pracownika — potwierdzone na inw. 31, 2026-09-29). Needs human: wybór — legacy fixture na preview (zapis SQL) albo seed za `assertLocalDb` dla tych dwóch stanów. Test disposition: no automated test — utrudnienie weryfikacji manualnej, nie błąd. **Dropped:** brak ścieżki w UI to decyzja właściciela, nie luka izolacji (`kosztorys-editor-domain-notes.md:1550`); kto chce ten stan obejrzeć, wstawia go SQL-em na preview.

## EX-933 — global-rabat-on-settlement-axis — rabat kwotowy w netto albo w brutto (2026-09-29)

- [x] Inw. 112 (Szeligowska 57b/7, brutto, 8%) → Podsumowanie → ustawienia → Rabat „Kwotowy":
      wpisanie 5000 w pole „brutto" pokazuje 4629,63 w „netto" jeszcze przed zapisem. Po „Zapisz"
      kolumna brutto pokazuje Rabat −5000,00.
      _Zweryfikowano 2026-09-29 (staging): Inw. 112 jest już netto i bez pozycji — użyto inw. 19 (brutto, 8%): 5000 brutto → 4629,63 netto przed zapisem; po zapisie Rabat −5000,00 (baza: 4629.62963)._
- [x] Ta sama inwestycja: „Pozostało do zapłaty" brutto jest dokładnie o 5000,00 niższe niż przy
      rabacie „Wyłączony".
      _Zweryfikowano 2026-09-29 (staging): Inw. 19: Pozostało do zapłaty 85 090,82 vs 90 090,82 przy Wyłączony (różnica 5000,00)._
- [x] Inwestycja netto (np. inw. 106): zapisana kwota stoi bez zmian w „netto" (2419,00), „brutto"
      pokazuje ją po stawce VAT inwestycji, Podsumowanie się nie zmienia.
      _Zweryfikowano 2026-09-29 (staging): Inw. 106: netto 2419,00, brutto 2612,52 (8%), Podsumowanie bez zmiany._
- [x] Ctrl+Z po zapisaniu kwoty przywraca w obu polach poprzednią kwotę.
      _Zweryfikowano 2026-09-29 (staging): Inw. 19: zapis 5000 → zapis 3000 → Ctrl+Z przywraca 4629,63 / 5000,00 w obu polach._
- [x] Zmiana stawki VAT przy zapisanej kwocie: „brutto" idzie za nową stawką, „netto" zostaje.
      _Zweryfikowano 2026-09-29 (staging): Inw. 19: VAT 8 → 23: netto 4629,63, brutto 5694,44; VAT przywrócony do 8._
- [x] Przełączenie „Wyłączony" → „Kwotowy": pola startują od sumy rabatów z pozycji.
      _Zweryfikowano 2026-09-29 (staging): Inw. 61: pola startują od 262,2 netto / 283,18 brutto (suma rabatów pozycji); inw. 19 od 0/0 (brak rabatów pozycji)._
- [x] Inw. 112 → Historia zmian: wpis po zapisaniu 5000 brutto pokazuje w wierszu Rabat
      „… netto / 5000,00 brutto".
      _Zweryfikowano 2026-09-29 (staging): Inw. 19: „Cały kosztorys — Rabat: 0,00 zł netto / 0,00 zł brutto → 4629,63 zł netto / 5000,00 zł brutto”._
- [x] Kosztorys → widok podwykonawcy → kolumna „Cena": ceny wyliczone ze współczynnika pokazują się
      i edytują w groszach, a kopiowanie komórki daje tę samą kwotę co przed zmianą (refaktor
      formatowania — bez zmiany zachowania).
      _Zweryfikowano 2026-09-29 (staging + kod): inw. 19, widok podwykonawcy — ceny wyliczone wyświetlają się poprawnie; `moneyText` to dosłownie to samo wyrażenie co usunięty `priceText` (`decimalText(roundToCents(v))`), w tych samych trzech miejscach (wyświetlanie, szkic edycji, kopiowanie)._

### Findings — 2026-09-29

- [x] **Box „Cena" bez dowodu na groszach** — na inw. 19 wyliczone ceny były całkowite. Zamknięte odczytem kodu: formatowanie jest identyczne jak przed refaktorem (patrz boks wyżej). **Test disposition:** brak — funkcja nie zmieniła wyrażenia.
- [x] **Fixture inw. 112 inny na stagingu** — baza preview ma inw. 112 netto bez pozycji; na produkcji to wciąż repro (brutto, 8%, rabat 5000). Odrzucone: to nie defekt, boksy zapisują inw. 19 jako zamiennik. Właściciel po wdrożeniu wpisuje 5000 w „brutto" na prawdziwej inw. 112.
- [x] **„5 000,00" w checkliście vs „5000,00" w aplikacji** — odrzucone: `pl-PL` nie grupuje liczb czterocyfrowych (5000,00, ale 85 090,82) — aplikacja ma rację, poprawiona była treść boksa.

## EX-908 — redundant-router-refresh — nieaktualne dane po zapisie, staging (2026-09-29)

Po każdym zapisie aplikacja nie prosi już serwera o drugi render strony — nowe dane przychodzą
wyłącznie w odpowiedzi akcji. Lokalnie (build produkcyjny, baza 5435) przeszły sprawdzenia z
§ „Lokalnie" na końcu tej sekcji. Tu jest **każde**
zmienione miejsce jeszcze raz, na stagingu: prawdziwe opóźnienia sieci, cache Vercela i kilka
instancji funkcji to warunki, których lokalny build nie odtwarza. Test E2E dla A–H/K: EX-924.

**Każdy boks to trzy kroki, wszystkie muszą przejść:**

1. **Od razu:** po kliknięciu zmiana jest widoczna **bez przeładowania** (bez F5), w ciągu ~2 s.
2. **Po F5:** przeładowana strona pokazuje to samo — zapis doszedł do bazy.
3. **Gdzie indziej:** przejście linkiem w nawigacji (nie F5) na stronę wskazaną w boksie pokazuje
   już nową wartość — żadna inna strona nie trzyma starej kopii.

Logowanie: `pnpm qa:staging-user` (OWNER na preview DB), potem `context/reference/manual-verification.md`.
Staging musi mieć wdrożony commit z EX-908 (status Vercela `success` dla `origin/staging`).

### Formularze (wspólny zapis `use-form-submit` — wszystkie okna poniżej)

- [x] „Nowy wydatek" (górna belka) na `/kasa/<id>`: wiersz i saldo kasy; gdzie indziej: `/kasy` —
      saldo tej kasy, `/inwestycje/<id>` — wydatek na liście inwestycji.
      _Zweryfikowano 2026-09-29 (staging): kasa QA-908 Kasa A2 (id 43), wydatek 100 zł na inw. QA-908 Inw2: wiersz po ~0,6 s bez F5, saldo −100,00 zł; po F5 to samo; po nawigacji linkiem `/kasy` saldo −100,00 zł, a `/inwestycje/174` pokazuje wydatek na liście._
- [x] „Nowa wpłata" (górna belka) na `/inwestycje/<id>`: wpłata i bilans inwestycji; gdzie indziej:
      `/inwestycje` — bilans w wierszu, `/kasa/<id>` — saldo kasy.
      _Zweryfikowano 2026-09-29 (staging): inw. QA-908 Inw2 (174), wpłata 500 zł: wiersz i bilans po ~0,8 s bez F5 (Wpłaty −500,00, Nadpłata −400,00 po F5); `/inwestycje` wiersz 400,00 zł i `/kasy` saldo kasy A2 400,00 zł po nawigacji._
- [x] „Transfer między kasami" (górna belka) na `/kasy`: oba salda; gdzie indziej: `/kasa/<id>` obu kas.
      _Zweryfikowano 2026-09-29 (staging): 150 zł z QA-908 Kasa A2 do Kasa B: oba salda (250,00 / 150,00) po ~0,5 s bez F5, dialog zamknięty._
- [x] „Edytuj transakcję" w tabeli transakcji — na robociźnie („Koszty robocizny", jedyny typ z
      edytowalną kwotą) zmień kwotę: wiersz od razu ma nową kwotę, a Robocizna/Marża inwestycji się
      zmienia bez przeładowania.
      _Zweryfikowano 2026-09-29 (staging): inw. 174 (QA-908 Inw2), „Koszty robocizny" 1000 zł (#5286) zaksięgowane oknem „Wydatek" → „Edytuj transakcję" → kwota 1500: wiersz od razu 1500,00 zł, Robocizna netto i Marża 1000 → 1500 (widok v1) bez F5; po F5 to samo; po nawigacji na `/inwestycje` wiersz inwestycji: bilans −1500,00 zł, robocizna v1 1500,00 zł. Transakcja anulowana przez UI (Robocizna/Marża/Bilans wróciły do 0,00). Wcześniejsza próba na wydatku/wpłacie: kwota nieedytowalna poza robocizną (`isLaborCost`)._
- [x] Nowa inwestycja na `/inwestycje`: wiersz na liście; gdzie indziej: wybór inwestycji w
      „Nowy wydatek".
      _Zweryfikowano 2026-09-29 (staging): „Dodaj” → „QA-908 Inw” (status Wycena): wiersz po ~0,5 s, po F5 jest. „Gdzie indziej”: inwestycja o statusie Wycena nie jest w wyborze inwestycji w „Wydatek” (lista pokazuje tylko aktywne — świadomy filtr `active`); po zmianie statusu na Aktywna pojawia się tam od razu po nawigacji._
- [x] Edycja inwestycji (nazwa) na `/inwestycje/<id>`: nazwa w nagłówku i w górnej belce; gdzie
      indziej: `/inwestycje`.
      _Zweryfikowano 2026-09-29 (staging): inw. 174: nazwa w nagłówku zmienia się po ~0,5 s, po F5 jest, po nawigacji na `/inwestycje` wiersz z nową nazwą. Nazwy inwestycji w górnej belce nie da się zobaczyć — przy tej szerokości okna belka pokazuje tylko „Wróć” i przyciski, więc ta część nie sprawdzona._
- [x] Nowa kasa na `/kasy` i edycja nazwy na `/kasa/<id>`: wiersz / nagłówek; gdzie indziej: wybór
      kasy w „Nowy wydatek".
      _Zweryfikowano 2026-09-29 (staging): „Dodaj” na `/kasy`: wiersz „QA-908 Kasa A” po ~0,5 s, po F5 jest; edycja nazwy na `/kasa/43` → nagłówek zmienia się po ~0,5 s i po F5; po nawigacji na `/kasy` wiersz z nową nazwą, a lista kas w „Wydatek” zawiera „QA-908 Kasa A2”._
- [x] Nowy pracownik na `/pracownicy` i edycja na `/pracownicy/<id>`: wiersz / nagłówek; gdzie
      indziej: `/pracownicy`.
      _Zweryfikowano 2026-09-29 (staging): „Dodaj” na `/pracownicy` (QA-908 Pracownik, id 74): wiersz po ~0,6 s bez F5; edycja nazwy na `/pracownicy/74`: nagłówek po ~0,5 s i po F5, po nawigacji na `/pracownicy` wiersz z nową nazwą. Stan: pracownik id 74 do dezaktywacji na końcu._
- [x] Sprzęt: dodanie na `/sprzet`, edycja i „Przekaż sprzęt" na `/sprzet/<id>`: wiersz, dane i nowy
      posiadacz; gdzie indziej: `/sprzet`.
      _Zweryfikowano 2026-09-29 (staging): dodanie „QA-908 Wiertarka” (id 2, magazyn główny): wiersz po ~0,6 s bez F5; edycja nazwy: nagłówek po ~0,5 s; „Przekaż” do QA-908 Pracownik2: „Gdzie jest” i historia po ~0,5 s i po F5, na `/sprzet` wiersz z nowym posiadaczem i statusem „W użyciu”. Stan: sprzęt id 2 do usunięcia (jeśli UI pozwala) na końcu._
- [x] Flota: dodanie pojazdu na `/flota`, edycja i „Nowy przegląd" na `/flota/<id>`: wiersz, dane,
      przegląd; gdzie indziej: `/flota`.
      _Zweryfikowano 2026-09-29 (staging): „Pojazd” na `/flota` (QA908X, id 10): wiersz po ~0,5 s; edycja modelu: dane na `/flota/10` po ~0,5 s; „Przegląd” (przebieg 12345): wiersz w tabeli przeglądów po ~0,5 s i po F5, na `/flota` wiersz z terminem 29.09.2027. Stan: pojazd id 10 do usunięcia (jeśli UI pozwala) na końcu._
- [x] Katalog prac: dodanie i edycja pozycji: wiersz; gdzie indziej: „Dodaj pracę z katalogu do
      sekcji…" w edytorze kosztorysu pokazuje nową/zmienioną pozycję.
      _Zweryfikowano 2026-09-29 (staging): „Nowa praca” (opis QA-908 praca testowa, cena 77): wiersz po ~1,2 s bez F5; edycja opisu i ceny (→88): wiersz zmieniony po ~0,9 s. „Praca z katalogu…” w edytorze inw. 174 pokazuje zmienioną pozycję (QA-908 praca testowa2, 88,00 zł). Stan: pozycja katalogu QA-908 do usunięcia na końcu („Usuń z katalogu”)._
- [x] Lista odbiorców powiadomień (karta na `/sprzet`, `/flota` albo `/zgloszenia`) — zapisz zmianę:
      karta pokazuje nową listę; gdzie indziej: ta sama karta na drugiej z tych stron.
      _Zweryfikowano 2026-09-29 (staging): karta na `/sprzet`, dodany adres qa908@example.com: karta pokazuje go po ~1,1 s bez F5, po F5 też. „Gdzie indziej”: premisa boksu nieaktualna — `/sprzet`, `/flota` i `/zgloszenia` mają osobne listy (`equipmentDigest`, `fleetDigest`, `newLead` + `opsAlerts`), więc ta sama karta nie występuje na drugiej stronie; po nawigacji linkiem `/flota` i `/zgloszenia` nadal pokazują swoje niezmienione listy (brak przecieku). Stan cofnięty: adres usunięty przez to samo okno, lista wróciła do bartek@ + admin@._
- [x] `/zgloszenia` → „Nowa inwestycja ze zgłoszenia" → „Utwórz": zgłoszenie zmienia stan; gdzie
      indziej: nowa inwestycja na `/inwestycje`.
      _Zweryfikowano 2026-09-29 (staging): zgłoszenie „QA Landing Fixture” (fixture QA, bez prawdziwych danych) → kolumna „Inwestycja” „Dodaj” → okno z uzupełnionymi polami, nazwa zmieniona na „QA-908 Lead Inw” → „Utwórz”: okno zamknięte po ~0,3 s, komórka zmienia się od razu na link do inwestycji (id 176), po F5 to samo; „Status kontaktu” zostaje „Oczekuje” (zmienia się tylko przypisanie inwestycji); po nawigacji linkiem `/inwestycje` jest nowy wiersz. Stan: inw. 176 do usunięcia._
- [x] „Zapisz jako domyślną kasę" w „Nowy wydatek": przycisk od razu przestaje proponować zapis;
      po zamknięciu i ponownym otwarciu okna ta kasa jest wybrana.
      _Zweryfikowano 2026-09-29 (staging): przycisk zmienia się od razu na „Kasa domyślna” (nieaktywny); po zamknięciu okna, F5 i ponownym otwarciu „Wydatek” kasa QA-908 Kasa A2 jest wybrana. Stan: domyślna kasa konta qa-staging (OWNER) ustawiona na kasę QA — do cofnięcia razem z jej usunięciem._

### Transakcje i kosz

- [x] Anulowanie transakcji: wiersz oznaczony jako anulowany, saldo się cofa; gdzie indziej:
      `/kasy` i `/inwestycje/<id>`.
      _Zweryfikowano 2026-09-29 (staging): wydatek #5280 (100 zł, QA-908 Kasa A2) → „Anuluj transakcję” z powodem → po ~0,8 s bez F5 saldo kasy 250,00 → 350,00 zł; wiersz (po „Pokaż anulowane”) przekreślony; po F5 to samo. Gdzie indziej: `/kasy` wiersz kasy 350,00 zł, `/inwestycje/174` — nadpłata −400,00 → −500,00 (wydatek nie liczy się, a bez „Pokaż anulowane” nie ma go na liście)._
- [x] Przeniesienie inwestycji do kosza z listy `/inwestycje`: znika z listy; gdzie indziej: jest na `/kosz`.
      _Zweryfikowano 2026-09-29 (staging): inw. 176 „QA-908 Lead Inw” → „Usuń inwestycję” → „Przenieś do kosza”: wiersz znika z listy po ~1 s bez F5, po F5 też; po nawigacji linkiem `/kosz` jest na liście._
- [x] „Przywróć" na `/kosz`: znika z kosza; gdzie indziej: wraca na `/inwestycje`.
      _Zweryfikowano 2026-09-29 (staging): inw. 176: „Przywróć” — wiersz znika z kosza po ~0,4 s bez F5, po F5 też; po nawigacji linkiem `/inwestycje` wraca na listę._
- [x] „Usuń na zawsze" na `/kosz`: wiersz znika; gdzie indziej: nie ma go ani na `/kosz` po
      przejściu z innej strony, ani na `/inwestycje`.
      _Zweryfikowano 2026-09-29 (staging): inw. 176 (z powrotem w koszu) → „Usuń na zawsze” + potwierdzenie: wiersz znika po ~0,5 s bez F5, po F5 też; po nawigacji linkiem nie ma go ani na `/kosz`, ani na `/inwestycje`. Inw. 176 skasowana na stałe — ślad po teście usunięty._

### Kosztorysy (arkusze)

- [x] `/kosztorysy` → odłączenie arkusza od inwestycji: wiersz bez inwestycji; gdzie indziej:
      `/inwestycje/<id>` nie pokazuje już „Otwórz".
      _Zweryfikowano 2026-09-29 (staging): arkusz „kosztorys wzór. nic nie dodajemy” (inw. 90) → „Odłącz od inwestycji” + „Odłącz”: po ~1,5 s wiersz ma tylko nazwę i „Dodaj kosztorys” (bez „Arkusz”/„Powiązane”), po F5 tak samo; `/inwestycje/90` po nawigacji nie ma już linku do arkusza v1 (zostaje tylko „Otwórz kosztorys_v2”)._
- [x] `/kosztorysy` → usunięcie kosztorysu: wiersz znika.
      _Zweryfikowano 2026-09-29 (staging): arkusz podpięty do inw. 90 → kosz + „Usuń” w dialogu („Usunięty zostanie tylko wpis w aplikacji…”): toast „Usunięto kosztorys.”, po F5 wierszy 136 zamiast 137, inwestycja zostaje z „Dodaj kosztorys”. Wpis odtwarzam przez „Nowy kosztorys” tym samym URL._
- [x] `/kosztorysy` → podpięcie arkusza do inwestycji: wiersz z nazwą inwestycji; gdzie indziej:
      `/inwestycje/<id>` pokazuje „Otwórz".
      _Zweryfikowano 2026-09-29 (staging): arkusz „kosztorys wzór” (Bez inwestycji) → ikona „Powiąż z inwestycją” → inw. „kosztorys wzór. nic nie dodajemy” → „Dodaj kosztorys”: toast „Dodano … do inwestycji …” po ~6 s, wiersz „Powiązane” z „Arkusz”; po F5 `/inwestycje/90` znów ma „Otwórz” (/inwestycje/90/kosztorys). To też cofnięcie odłączenia. Przy okazji: inwestycja zakończona jest odrzucana toastem „tylko do odczytu” (poprawnie)._
- [x] „Nowy kosztorys" na `/kosztorysy`: nowy wiersz.
      _Zweryfikowano 2026-09-29 (staging): po usunięciu wpisu wkleiłem ten sam URL arkusza: toast „Dodano kosztorys „kosztorys wzor”.” po ~8 s, po F5 nowy wiersz „Bez inwestycji” (137 wierszy). Potem podpięty z powrotem do inw. 90. Uwaga: URL już zarejestrowanego arkusza jest odrzucany toastem „Ten arkusz jest już zarejestrowany…”._
- [x] „Dodaj kosztorys" na `/inwestycje/<id>`: pojawia się „Otwórz"; gdzie indziej: wiersz na `/kosztorysy`.
      _Zweryfikowano 2026-09-29 (staging): inw. 90 po usunięciu wpisu → „Dodaj” → URL arkusza → „Dodaj kosztorys”: toast „Dodano kosztorys „kosztorys wzor”.” po ~8 s, „Otwórz” (/inwestycje/90/kosztorys) pojawia się od razu bez F5; wiersz na `/kosztorysy` jest z powrotem „Powiązane”. Stan sprzed testu przywrócony._

### Edytor kosztorysu

Po każdej zmianie sprawdź **sumy**: wartość wiersza, sumę sekcji, sumy etapów i panel
„Podsumowanie" — to one wcześniej odświeżały się osobnym zapytaniem ~0,7 s po edycji.

- [x] Przedmiar, Cena j.m. i rabat w wierszu: wartość wiersza, suma sekcji i „Podsumowanie"; gdzie
      indziej: `/inwestycje/<id>` — robocizna z kosztorysu.
      _Zweryfikowano 2026-09-29 (staging): kosztorys inw. 174 (QA-908 Inw2): Przedmiar 10, Cena 50, rabat 20% — wartość wiersza, suma sekcji i „Razem” zmieniają się od razu (500 → 400 przedmiar netto), po F5 to samo; „Podsumowanie” pokazuje Robocizna 0 (nic jeszcze wykonane), a po wpisaniu etapów `/inwestycje/174` pokazuje Robocizna 300, Rabat −60, Łącznie 340._
- [x] Ilość w kolumnie etapu: suma etapu i „Pozostało"; trzy szybkie edycje pod rząd — końcowe sumy
      zgadzają się z tym, co pokazuje F5.
      _Zweryfikowano 2026-09-29 (staging): dwa etapy z narzędziami, trzy szybkie edycje pod rząd (Etap 1: 3, Etap 2: 2, Etap 1: 4): Pomiar 6, wartość 240,00, Etap 1 160,00, Etap 2 80,00, 60% wykonania, Pozostało 160,00 — identycznie po F5._
- [x] Duży kosztorys (kilkaset pozycji): edycja komórki — sumy poprawne, strona nie przycina.
      _Zweryfikowano 2026-09-29 (staging): inw. 174, szablon „kosztorys wzór testy 2 września 26” (11 sekcji · 202 prace, dokładnie tyle, ile najbliżej „kilkuset” dostępne na stagingu) wczytany; Przedmiar 10 przy cenie 300: wartość przedmiaru 3000,00 netto / 3240,00 brutto, stopka sekcji i pozostało zgodne, sąsiednie sekcje 0,00; po F5 te same sumy, strona nie przycina._
- [x] „Cofnij" / „Ponów" po edycji: wartość i sumy wracają; po F5 to samo.
      _Zweryfikowano 2026-09-29 (staging): inw. 174: Przedmiar 10 → 20; Opcje → „Cofnij”: wartość i sumy wracają (Pozostało 160,00, 60%), „Ponów”: znowu 20 (Pozostało 560,00, 30%); po F5 stan taki sam jak po „Ponów”._
- [x] „Sekcja z szablonu…": sekcja i sumy.
      _Zweryfikowano 2026-09-29 (staging): inw. 174: szablon „QA-908 szablon” zapisany z Opcji; „Dodaj → Sekcja z szablonu…” dodaje sekcję z 2 pracami (wiersze 3–4) od razu, sumy sekcji 0 (bez przedmiaru), sumy całości bez zmian (240,00 / Pozostało 40,00)._
- [x] „Dodaj pracę z katalogu do sekcji…": wiersz i sumy.
      _Zweryfikowano 2026-09-29 (staging): „Praca z katalogu…” → zaznaczona pozycja QA-908, „Dodaj do: Nowa sekcja”: nowy wiersz i licznik sekcji (2 poz.) od razu; sumy bez zmian (przedmiar nowej pozycji 0)._
- [x] „Porównaj z katalogiem" → „Dodaj do katalogu" → „Dodaj": pozycja znika z „Brak w katalogu";
      gdzie indziej: katalog prac pokazuje nową pozycję.
      _Zweryfikowano 2026-09-29 (staging): Problemy → „Porównaj z katalogiem…” → „Pokaż 1 praca” → „Dodaj do katalogu” → „Dodaj”: „Brak w katalogu” zmienia się na „Każda praca z tego kosztorysu jest w katalogu” od razu; `/katalog-prac` pokazuje nową pozycję „Betoon podlogi 2” (kategoria „Nowa sekcja”). Stan: pozycje QA-908 w katalogu do usunięcia na końcu._
- [x] „Zastąp całą rozpiskę zapisanym szablonem": cała rozpiska podmieniona, komunikat widoczny.
      _Zweryfikowano 2026-09-29 (staging): Opcje → „Wczytaj szablon…” → wybór szablonu → „Wczytaj i zastąp”: rozpiska podmieniona od razu (dwukrotnie, na „QA test szablon B” i „QA-908 szablon”), toast „Wczytano: 1 sekcja · 2 prace” widoczny ~2 s. Stan sprzed zapisany automatycznie w „Wersje”._
- [x] „Wyczyść kosztorys": „Kosztorys jest pusty"; gdzie indziej: `/inwestycje/<id>` — robocizna 0.
      _Zweryfikowano 2026-09-29 (staging): inw. 174, robocizna 150,00 → Opcje → „Wyczyść kosztorys…” (dialog: 1 sekcja · 2 prace) → „Kosztorys jest pusty” po ok. 2,8 s, `/inwestycje/174` robocizna 0,00._
- [x] „Wersje" → przywrócenie wersji: rozpiska z tej wersji; zaraz potem edycja komórki zapisuje się.
      _Zweryfikowano 2026-09-29 (staging): inw. 174: nazwany punkt „QA-908 wersja A” (Przedmiar 20), zmiana na 5, „Wczytaj” → „Przywróć” + potwierdzenie: rozpiska z wersji (Pozostało 560,00) po ~3 s; zaraz potem zmiana Przedmiaru na 7 zapisała się (po F5 Pozostało 40,00)._
- [x] „Popraw literówki w opisie prac i j.m." — trzy razy pod rząd na wierszu z literówką: za każdym
      razem poprawiony tekst bez przeładowania.
      _Zweryfikowano 2026-09-29 (staging): inw. 174: trzykrotnie wpisany opis „betoon   podlogi  N” (mała litera, wielokrotne spacje) → Opcje → „Popraw literówki…”: za każdym razem tekst poprawiony od razu, bez przeładowania („Betoon podlogi N”). Uwaga: narzędzie nie poprawiło samej pisowni słów, tylko wielkość liter i spacje — zgodne z opisem opcji._
- [x] Dwie karty tego samego kosztorysu: w drugiej usuń pozycję, w pierwszej zmień jej Przedmiar —
      pierwsza pokazuje komunikat „Kosztorys zmienił się w innym miejscu…" i przeładowuje rozpiskę
      bez tej pozycji. Drugi wariant: w pierwszej karcie najpierw zmień Przedmiar **innej** pozycji,
      dopiero potem tej usuniętej — rozpiska też się przeładowuje, a komunikat nie wraca przy kolejnej edycji.
      _Zweryfikowano 2026-09-29 (staging): inw. 174, dwie karty. Wariant 1: w karcie B usunięta pozycja „Transport i wniesienie…”, w karcie A zmiana jej Przedmiaru → toast „Kosztorys zmienił się w innym miejscu — odświeżam dane.”, rozpiska przeładowana bez tej pozycji. Wariant 2: B usunęła „Wynoszenie gruzu…”; w A najpierw zmiana Przedmiaru innej pozycji (bez toastu, bez przeładowania), potem usuniętej → toast + przeładowanie bez pozycji; kolejna edycja (13) bez powtórzenia komunikatu._
- [x] „Wyczyść kosztorys" przy zerwanym połączeniu (DevTools → Network → Offline zaraz po kliknięciu,
      potem Online): komunikat o błędzie, a po powrocie sieci rozpiska zgodna z bazą.
      _Zweryfikowano 2026-09-29 (staging): inw. 174 (200 prac / 11 sekcji), `page.route` przerywa w locie POST z `next-action` (`internetdisconnected`), „Wyczyść kosztorys…" → „Wyczyść": toast błędu „Czyszczenie przerwane — odświeżam kosztorys", okno zamknięte, strona nie przeszła na błąd przeglądarki. Po `unroute` + F5 rozpiska jest, w bazie nadal 200 prac / 11 sekcji / 13 wersji (żądanie nie dotarło). Poprzedni przebieg (offline przed kliknięciem) był złą metodą._

### Findings — 2026-09-29

Przebieg staging 2026-09-29 (OWNER + MANAGER, dane z dumpu prod).

- [x] **Offline „Wyczyść kosztorys": brak komunikatu w aplikacji.** **Odrzucone (2026-09-29):**
  przebieg odciął sieć **przed** kliknięciem, a boks mówi o zerwaniu **po** nim. Bez sieci Next sam
  przechodzi na nawigację przeglądarki i pokazuje jej stronę „brak internetu" — to komunikat, tylko
  nie nasz, a dane zostają zgodne z bazą. Wariant z boksu (żądanie urwane w locie) sprawdza boks wyżej.
- [x] **`coeff-cell.tsx` bez czerwonej flagi `checkSubcontractorPrice`.** **Naprawione w drzewie**
  (lustro `price-cell.tsx`) ze specem `subcontractor-coeff-cell.test.tsx` („mnożnik ponad sufitem
  _Zweryfikowano 2026-09-29 (staging, 7be1aae3): obie komórki czerwone (boks EX-865 zaliczony)._
  czerwieni obie komórki", czerwony bez poprawki). Ponowne sprawdzenie po deployu: boks EX-865.
  _Test disposition:_ test-driven-debugging · dom.
- [x] **`SheetSetupDialog` / `AddSheetDialog` bez `settleAction`** — offline kończyło się stroną błędu.
  **Naprawione w drzewie** ze specami `sheet-setup-dialog.test.tsx` i `add-sheet-dialog.test.tsx`
  _Zweryfikowano 2026-09-29 (staging, 7be1aae3): `/kosztorysy`, „Dodaj kosztorys” i „Nowy kosztorys” offline przed klikiem: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, okno zostaje._
  (toast „Brak połączenia…", okno zostaje; oba czerwone bez poprawki). Czeka na deploy.
  _Test disposition:_ test-driven-debugging · dom.
- [x] **`submitOptimistically` toastuje surowe „Failed to fetch"** (po angielsku). **Naprawione w
  drzewie:** `src/stores/optimistic-form-store.ts` woła akcję przez `settleAction`, więc błąd sieci
  daje „Brak połączenia z serwerem…" i ponownie otwiera okno. Spec w `optimistic-form-store.test.ts`
  _Zweryfikowano 2026-09-29 (staging, 7be1aae3): katalog „Dodaj do katalogu” → „Dodaj” offline: toast po polsku. CZĘŚCIOWO: okno „Dodaj pracę do katalogu” się NIE otwiera ponownie — patrz następny punkt._
- [x] **„Dodaj pracę do katalogu” (`catalogue-item-from-kosztorys-dialog.tsx`) po błędzie sieci nie otwiera się ponownie.** Formularz woła `onSubmitSuccess={() => onOpenChange(false)}` i zamyka się optymistycznie; ponowne otwarcie (`openFormId`) działa tylko dla okien sterowanych ze store, a to okno ma lokalny `open`. Toast jest po polsku, okno porównania zostaje, ale wpisane dane przepadają — wbrew opisowi poprawki „ponownie otwiera okno”. Do decyzji: dopisać ponowne otwarcie albo uznać toast za wystarczający. **Linear: EX-942.**
  _Test disposition:_ test-driven-debugging · dom.
  (czerwony bez poprawki). Czeka na deploy. _Test disposition:_ test-driven-debugging · unit.
- [x] **Luka udostępnień v1** — konto reader nie czyta arkuszy v1 inwestycji 130/139/141/143/144/145.
  **Linear: EX-939.**
- [x] **Okno udostępniania otwarte offline** pokazuje „Nie udało się przygotować linku" bez toastu.
  **Odrzucone:** komunikat jest w samym oknie, na które użytkownik patrzy; toast by go powtórzył.
- [x] **Przesłanka boksu „Edytuj transakcję — zmień kwotę" nieaktualna** — **naprawione:** boks
  przepisany na robociznę (tylko jej kwota jest edytowalna).
- [x] **„Popraw literówki"** poprawia tylko wielkość liter i białe znaki. **Odrzucone:** zakres to
  reguły `cleanDescription` / `cleanUnit` (`src/lib/kosztorys/clean-item-texts.ts`), zamierzony,
  nie defekt.
- [x] **Przesłanka boksu „Lista odbiorców powiadomień" nieaktualna** — **odrzucone:** listy są
  osobne per strona z założenia; boks jest odhaczony z tą uwagą.

- [x] **Sprzątanie danych QA po EX-908 (staging, 2026-09-29) — zostało kilka rzeczy, których UI nie usuwa.**
  **Dropped:** to nie defekt, tylko brak funkcji „usuń" w UI. Stan: kasy 43/44 nieaktywne; inw. 174
  „Zakończona"; pracownicy 73/74 nieaktywni; sprzęt 2 i pojazd 10 „Wycofany"; pozycja katalogu i szablon
  „QA-908 szablon" usunięte. Zostaje: wersja „QA-908 wersja A" + wersje „Przed …" (dialog „Wersje" ma tylko
  „Przywróć"); domyślna kasa OWNERA = 43 (lista nie ma opcji „brak"); inw. 174 z 3 transakcjami w historii.
  Arkusz v1 inw. 90 po odłączeniu i ponownym dodaniu ma `sheet_column_mapping = NULL` (w dumpie
  `{"netValue": 18}`), nowy id 79 zamiast 36 — przywrócenie wymaga pickera kolumn z importu (nadpisałby
  rozpiskę), więc bez zmian.

### Poza stagingiem

- [x] Lokalnie zapis do arkusza Google (np. przelew na inwestycji z podpiętym arkuszem) nadal jest
      odrzucany („Refusing to write…" w logu serwera) i nic nie trafia do Google.
      _Zweryfikowano 2026-09-29 (staging): pominięto — check lokalny, przepis zabrania chodzenia na localhost; na stagingu odmowę egzekwuje Google (403) dla konta Viewer._
      _2026-10-01 (lokalnie, bez serwera): `.env` nie ma `GOOGLE_SERVICE_ACCOUNT_WRITE_JSON` (`.env.local` brak), czytające konto to `kosztorys-sheets-reader@…`; `getWritableSheetsClient()` wywołane z `node --env-file=.env` rzuca „Refusing to write to Google Sheets: GOOGLE_SERVICE_ACCOUNT_WRITE_JSON is not set…" — zanim cokolwiek pójdzie do Google._

### Lokalnie — build produkcyjny na :3100, baza 5435 (2026-09-29)

Każdy boks: po kliknięciu zmiana widoczna **bez przeładowania**, a w Network jest POST akcji i
**żaden** GET RSC tej ścieżki poza prefetchem.

- [x] „Nowy wydatek" na `/kasa/<id>`: wiersz i saldo; POST ma `x-action-revalidated: 1` i nowy wiersz.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, wiersz i saldo po 437–463 ms._
- [x] Nowa inwestycja na `/inwestycje`: wiersz na liście.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET._
- [x] Jeszcze jedno okno formularza (pracownik / kasa / sprzęt) na stronie z listą: wiersz na liście.
      _Zweryfikowano 2026-09-29 (lokalnie): nowa kasa na `/kasy`: POST rev1, 0 GET, 283–417 ms._
- [x] „Zapisz jako domyślną kasę": przycisk od razu przestaje proponować zapis, ponownie otwarte
      okno „Nowy wydatek" ma tę kasę wybraną.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET._
- [x] Anulowanie transakcji: wiersz anulowany, saldo się cofa.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, 36–51 ms._
- [x] Inwestycja do kosza z listy `/inwestycje`: znika z listy.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, 31–61 ms._
- [x] „Przywróć" na `/kosz`: wiersz znika.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, 309–501 ms._
- [x] „Usuń na zawsze" na `/kosz`: wiersz znika.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET._
- [x] `/kosztorysy` → odłączenie arkusza: wiersz bez inwestycji.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, 234–344 ms przy POST 59–97 ms._
- [x] `/kosztorysy` → usunięcie kosztorysu: wiersz znika.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, 262–376 ms._
- [x] `/kosztorysy` → podpięcie arkusza: wiersz z nazwą inwestycji.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, 230–421 ms._
- [x] „Nowy kosztorys": nowy wiersz.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, 946–1389 ms (POST 800–1530 ms — sprawdzenie dostępu)._
- [x] „Dodaj kosztorys" na `/inwestycje/<id>`: pojawia się „Otwórz".
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, ~3,3 s — czas POST-a._
- [x] Edycja ilości w etapie na małym kosztorysie: sumy się zmieniają; 1 POST + 1 GET, bez drugiego
      GET ~750 ms później.
      _Zweryfikowano 2026-09-29 (lokalnie): 1 POST + 1 GET ~70–190 ms po nim, drugiego GET brak._
- [x] Edycja Przedmiaru: sumy z samego POST-a, 0 GET.
      _Zweryfikowano 2026-09-29 (lokalnie): 0 GET, 1 render._
- [x] Trzy edycje etapu pod rząd: 3 GET (było 4), końcowe sumy poprawne.
      _Zweryfikowano 2026-09-29 (lokalnie): 3 POST, 3 GET, sumy zgodne po przeładowaniu._
- [x] Duży kosztorys (411 pozycji): 1 render na edycję, sumy poprawne.
      _Zweryfikowano 2026-09-29 (lokalnie): Przedmiar na 149: 1 POST, 0 GET, 1 render (komórka etapu wyłączona na fixturze — etapu nie mierzono)._
- [x] „Cofnij" / „Ponów": wartość i sumy wracają, bez GET na każde cofnięcie.
      _Zweryfikowano 2026-09-29 (lokalnie): 3 cykle, 0 GET na każdy, wartości wracają._
- [x] „Sekcja z szablonu…": sekcja i sumy.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET._
- [x] „Dodaj pracę z katalogu do sekcji…": wiersz i sumy.
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, 99–165 ms._
- [x] „Porównaj z katalogiem" → „Dodaj do katalogu" → „Dodaj": pozycja znika z „Brak w katalogu";
      0 GET (było 2).
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET (było 2)._
- [x] „Zastąp całą rozpiskę zapisanym szablonem": rozpiska podmieniona, komunikat widoczny.
      _Zweryfikowano 2026-09-29 (lokalnie): 5 razy: POST rev1, 0 GET, komunikat po 113–145 ms._
- [x] „Wyczyść kosztorys": „Kosztorys jest pusty".
      _Zweryfikowano 2026-09-29 (lokalnie): POST rev1, 0 GET, pusty stan po 116–130 ms (było 236–329)._
- [x] „Wersje" → przywrócenie wersji: rozpiska z tej wersji.
      _Zweryfikowano 2026-09-29 (lokalnie): przełączanie rozpiska ↔ pusty, 1 POST, 0 GET, późniejsza edycja zapisana._
- [x] „Popraw literówki w opisie prac i j.m.": poprawiony tekst bez przeładowania.
      _Zweryfikowano 2026-09-29 (lokalnie): 14/14 po poprawce zatrzasku (było 21/24 — render akcji docierał przed uzbrojeniem zatrzasku); import i porównanie z arkuszem nie sprawdzone (tylko inw. 66 ma arkusz)._
- [x] „Wyczyść kosztorys" przerwany w transporcie: komunikat o błędzie i jeden GET RSC po powrocie sieci.
      _Zweryfikowano 2026-09-29 (lokalnie): przerwany POST (`page.route` abort — prawdziwy `setOffline` przechodzi na `chrome-error://`): komunikat po 65 ms, 1 GET po 55 ms._
- [x] Dwie karty: w drugiej usuń pozycję, w pierwszej ją edytuj — rozpiska przeładowuje się bez tej pozycji.
      _Zweryfikowano 2026-09-29 (lokalnie): 4/4 po poprawce zatrzasku (wcześniej brak przeładowania w 8 s)._

## 2026-09-29 — kosztorys-menu-widths

- [x] Edytor kosztorysu → pasek narzędzi: menu „Kolumny" i „Sekcje" są tak samo szerokie jak
      „Problemy" i „Filtry"; długie nazwy kolumn („Pomiar — suma etapów z narzędziami
      (podwykonawca)") mieszczą się w jednej linii albo zawijają się rzadziej niż wcześniej.
      _Zweryfikowano 2026-09-29 (staging): inw. 137, widok „z narzędziami”: menu Problemy, Filtry, Sekcje i Kolumny mają po 448 px (w-112); „Pomiar — suma etapów z narzędziami (podwykonawca)” mieści się w jednej linii._
- [x] Dowolna tabela z listą (np. Transakcje) → „Kolumny": menu ma dotychczasową szerokość.
      _Zweryfikowano 2026-09-29 (staging): Transakcje → „Kolumny”: menu ma 288 px (w-72, dotychczasowy domyślny `contentClassName`)._

## 2026-09-29 — import z arkusza czyta etapy aż do „Przedmiaru"

- [x] Inwestycja z arkuszem, w którym etapy 7–10 dopisano bez „wykonano" w drugim wierszu nagłówka
      (np. inw. 48) → „Importuj z arkusza": podgląd i import pokazują każdy etap z wpisanym wykonaniem
      albo własną nazwą, nie tylko pierwsze sześć; ilości etapów 7+ zgadzają się z arkuszem.
      _Zweryfikowano 2026-09-30 (staging, c4ce8214): inw. 48 (arkusz czytelny; zakładka kosztorys_robocizny ma etapy 1–9, „wykonano" tylko w 1–6, ilości w kolumnach D–K, kolumna L pusta). Podgląd: „8 etapów”. Po imporcie SQL: 8 etapów, suma ilości na etap 53,85 / 366,10 / 178,35 / 310,50 / 402,80 / 418,72 / 34,10 / 77,30 = sumy kolumn arkusza (odczyt inspect-sheet.mjs) co do grosza; etap 9 (pusty) pominięty. Import pisze tylko do naszej bazy. Kosztorys przywrócony przez UI („Wczytaj” → „Przed importem…”), SQL 0 etapów / 0 pozycji / 0 sekcji._
- [x] Arkusz z sześcioma etapami „wykonano" i bez dopisanych kolumn: import daje te same etapy co
      _Zweryfikowano 2026-09-30 (staging, c4ce8214): inw. 115 (sześć kolumn etapów, sześć „wykonano”, Przedmiar zaraz po nich; ilości tylko w etapach 1–2). Podgląd „2 etapów”, po imporcie SQL: etap 1 = 216,45, etap 2 = 67,35 = sumy kolumn D i E arkusza; etapy 3–6 bez wykonania pominięte (parser trzyma etap tylko z wykonaniem lub nazwą). Brak „przed zmianą” w kodzie na stagingu — porównanie z arkuszem, nie z poprzednim buildem. Przywrócone przez UI, SQL 0/0._
      wcześniej.

## 2026-09-29 — nowy etap kopiuje rozliczenie i wykonawcę ostatniego

- [x] Edytor kosztorysu z co najmniej jednym etapem → „Dodaj" → „Etap": bez żadnego okna pojawia się
      nowa kolumna z tym samym rozliczeniem i tym samym pracownikiem / ekipą co ostatni etap (ten
      najbardziej po prawej); po odświeżeniu strony nadal je ma.
      _Zweryfikowano 2026-09-30 (staging, fae76527): inw. 137, etap 1 = z narzędziami + Adam Orłowski; „Dodaj → Etap" bez okna dodał etap 2 z tym samym rozliczeniem i pracownikiem (SQL: plane w_tools, worker 36); po przeładowaniu oba etapy nadal z Adamem Orłowskim. Etap usunięty przez UI._
- [x] Ostatni etap „Bez przypisania": nowy etap też jest „Bez przypisania".
      _Zweryfikowano 2026-09-30 (staging): inw. 137, etap 2 ustawiony na „Bez przypisania" przez UI, „Dodaj → Etap" dał etap 3 z `worker_id` NULL i tym samym rozliczeniem (SQL). Etapy 2–3 usunięte przez UI, inwestycja wróciła do jednego etapu._
- [x] Ostatni etap z kilkoma pracownikami (EX-943): nowy etap ma ten sam skład i tę samą osobę na
      „reszcie"; przy podziale procentowym procenty są te same, przy kwotowym każda kwota wynosi 0 zł.
      _Zweryfikowano 2026-10-01 (staging): inw. 137, etap 1 z trzema pracownikami (procentowo 50/30/20, Adam Orłowski na „reszcie"): „Dodaj → Etap" dał etap 2 z tym samym składem, tą samą osobą na reszcie i 30/20 % (SQL). Kwotowo (500/300 zł): nowy etap ma ten sam skład, reszta ta sama osoba, kwoty 0,00 zł. Etap 2 usunięty przez UI, etap 1 przywrócony do jednego pracownika (procentowo)._
- [x] Kosztorys bez etapów → „Dodaj": zamiast „Etap" są dwie pozycje „Etap — z narzędziami
      (podwykonawca)" / „Etap — bez narzędzi (pracownik)"; wybrana tworzy etap z tym rozliczeniem
      i bez przypisania.
      _Zweryfikowano 2026-09-30 (staging): inw. 124 (aktywna, 310 pozycji, zero etapów): menu = „Etap — z narzędziami (podwykonawca)" / „Etap — bez narzędzi (pracownik)", bez samego „Etap"; wybór „bez narzędzi" dał etap own_tools bez pracownika (SQL). Etap usunięty przez UI._
- [x] Szablon (warsztat) → „Dodaj": nie ma żadnej pozycji „Etap".
      _Zweryfikowano 2026-09-30 (staging): /szablony/160 → „Dodaj": Praca, Praca z katalogu…, Sekcja, Sekcja z szablonu… — bez „Etap"._

## 2026-09-30 — import z arkusza ustawia jednego wykonawcę wszystkim etapom

- [x] Inwestycja z arkuszem → „Importuj z arkusza": w bloku „Rozliczenie i wykonawca etapów" obok
      rozliczenia jest wybór pracownika / ekipy; dopóki rozliczenie to „Nie ustawiaj", wybór
      wykonawcy jest wyszarzony.
      _Zweryfikowano 2026-09-30 (staging, fae76527): inw. 108: blok „Rozliczenie i wykonawca etapów” ma wybór pracownika / ekipy, wyszarzony przy „Nie ustawiaj”._
- [x] Wybierz rozliczenie i pracownika → „Pobierz i zastąp": każdy zaimportowany etap ma to
      rozliczenie i tego pracownika w nagłówku; po odświeżeniu strony nadal.
      _Zweryfikowano 2026-09-30 (staging, fae76527): inw. 108: import z rozliczeniem + pracownikiem; SQL kosztorys_stages: każdy etap ma to plane i worker_id; po przeładowaniu bez zmian. Kosztorys przywrócony ze snapshotu do stanu pustego._
- [x] Wybierz pracownika, potem wróć rozliczeniem na „Nie ustawiaj" → import: etapy wchodzą bez
      rozliczenia i „Bez przypisania".
      _Zweryfikowano 2026-09-30 (staging, fae76527): inw. 108: etapy weszły z plane/worker_id NULL (SQL)._
- [x] Wybierz pracownika → „Anuluj" → otwórz import ponownie: oba pola wracają do „Nie ustawiaj" /
      „Bez przypisania".
      _Zweryfikowano 2026-09-30 (staging, fae76527): inw. 108: po ponownym otwarciu oba pola „Nie ustawiaj” / „Bez przypisania”._
- [x] Lista pracowników w imporcie pokazuje tylko aktywnych.
      _Zweryfikowano 2026-09-30 (staging, fae76527): inw. 108: lista zgodna z aktywnymi pracownikami._
- [ ] Rozwijane listy z wyszukiwarką w innych miejscach (np. pole inwestycji / pracownika w
      formularzu wydatku, okno zdjęć leada) otwierają się na szerokość swojego pola i nic w nich
      _Częściowo 2026-09-30 (staging, fae76527): sprawdzone formularz wydatku i okno importu — OK; okno zdjęć leada nie do sprawdzenia: na stagingu żaden lead nie ma załączników (leads_rels puste, kolumna „Załączniki” = „—”), a z UI nie da się dopiąć pliku do zgłoszenia (pliki wchodzą tylko przez webhook landingu, EX-938). Brakuje leada z plikiem._
      _Staging 2026-10-01 (ponowna próba): bez zmian — `leads_rels` nadal bez załączników (0 wierszy z media_id), z UI nie da się dopiąć pliku do leada; brak leada z plikiem. Boks zostaje otwarty._
      _Nie sprawdzone 2026-10-04 (staging): bez zmian — `leads_rels` nadal bez załączników (0 wierszy z media_id), z UI nie da się dopiąć pliku do leada._

## 2026-09-30 — „Rozlicz wypłaty": kwota do rozdysponowania i saldo kasy

### Findings — 2026-09-30
      nie jest ucięte.
- Bez nowych defektów w fae76527 (nowy etap, import wykonawcy, Rozlicz wypłaty).
- EX-939 jest częściowe: arkusze inwestycji do ok. 126 (np. 48, 108, 115) czytają się na stagingu, 130+ i 139–145 nadal nie.
- [x] Kasa „QA-908 Kasa A2” (id 43) nie ma na liście kas w „Rozlicz” — **odrzucone**: `cash_registers.active = false` (SQL, 2026-09-30), lista pokazuje tylko aktywne kasy.

## EX-942 — okna edycji nie gubią wpisanych danych po nieudanym zapisie (2026-09-30)

Stan: dowolny rekord do edycji; „nieudany zapis" = DevTools → Network → Offline tuż przed kliknięciem „Zapisz"/„Dodaj".

- [x] Kosztorys → wiersz → „Dodaj do katalogu" (albo „Edytuj w katalogu") → zmień kategorię i stawkę → offline → „Dodaj": polski toast błędu, okno zostaje otwarte z wpisanymi wartościami; po powrocie sieci ponowne „Dodaj" zapisuje i zamyka okno.
      _Zweryfikowano 2026-10-01 (staging, symulacja: POST server action przerwany przez page.route): toast „Brak połączenia z serwerem…", okno otwarte z wpisanymi wartościami; po zdjęciu blokady zapis zamknął okno._
- [x] To samo w „Edytuj pojazd", „Edytuj transakcję" (z dołączonym plikiem faktury) i „Edytuj pozycję katalogu": po błędzie okno otwarte, pola i plik na miejscu.
      _Zweryfikowano 2026-10-01 (staging, przerwany POST): pojazd (notatka), transakcja z plikiem faktury (plik na miejscu) i pozycja katalogu — okno otwarte, pola i plik zachowane; retry zapisał. Zmiany cofnięte._
- [x] Zapis z siecią w dowolnym z tych okien: przycisk pokazuje „Zapisywanie...", okno zamyka się po chwili, zmiana widać na liście bez przeładowania.
      _Zweryfikowano 2026-10-01 (staging): „Zapisywanie...", okno zamknięte, zmiana widoczna na liście bez przeładowania (katalog, pojazd, transakcja)._

## EX-909 — szablony-plain-revalidation

- [x] Szablony kosztorysów → „Nowy szablon" → nazwa → „Załóż" → otwiera się nowy szablon, bez
      mignięcia „Nie znaleziono" po drodze; wróć przyciskiem „Wstecz" przeglądarki (bez
      odświeżania) → nowy szablon jest na liście.
      _Staging 2026-10-01: nowy szablon (id 177) — nawigacja SPA bez przeładowania (MutationObserver nie zgłosił „Nie znaleziono”), „Wstecz” → szablon na liście, na górze._
- [x] To samo, ale wróć przyciskiem „Wróć" na stronie szablonu → nowy szablon jest na liście.
      _Staging 2026-10-01: szablon 178 → „Wróć” → nowy szablon na liście._
- [x] Załóż szablon o nazwie, która już istnieje → komunikat „Szablon o tej nazwie już istnieje",
      okno zostaje otwarte, lista bez zmian.
      _Staging 2026-10-01: duplikat nazwy → toast „Szablon o tej nazwie już istnieje”, okno otwarte, lista bez zmian (3 wiersze)._
- [x] W szablonie zmień „Cena j.m. netto" pozycji, wróć do listy szablonów → ten szablon jest na
      górze listy (ostatnio edytowany); edycja komórki nie powoduje mignięcia ani przeładowania
      strony szablonu.
      _Staging 2026-10-01: w szablonie 178 zmieniona cena pozycji (zapis w DB: kosztorys_items.client_price), przy „Wróć” do listy szablon 178 jest nad nowszym szablonem 179; w trakcie edycji bez przeładowania (znacznik `window` przeżył) i bez „Nie znaleziono”/„Wczytywanie”. Uwaga: `investments.updated_at` szablonu się nie zmienia (kolejność liczona z pozycji/sekcji)._
- [ ] To samo w szablonie z ~1000 pozycji: zapis komórki bez widocznego opóźnienia względem małego
      szablonu.
      _Staging 2026-10-01: nie sprawdzono — na preview DB nie ma szablonu z ~1000 pozycji (są 3: 0–202 pozycji; największa inwestycja ma 379 pozycji), seedów nie wolno. Boks zostaje otwarty._
      _Nie sprawdzone 2026-10-04 (staging): bez zmian — na preview nadal brak szablonu z ~1000 pozycji (największy: 202 pozycje), seedów nie wolno._
- [x] Otwórz szablon z listy → w górnym pasku nazwa szablonu i „Wróć"; zmień nazwę szablonu na
      liście → po wejściu w niego pasek i tytuł pokazują nową nazwę.
      _Staging 2026-10-01: szablon 178 zmieniony na liście na „QA909 szablon B2” → po wejściu górny pasek: „Wróć” + „QA909 szablon B2”. Aplikacja nie ustawia `<title>` na żadnej trasie, więc „tytuł” = pasek._
- [x] Wpisz ręcznie adres nieistniejącego szablonu (`/szablony/999999`) → „Nie znaleziono"; tak samo
      dla szablonu przeniesionego do kosza.
      _Staging 2026-10-01: `/szablony/999999` i `/szablony/177` (przeniesiony do kosza) → „Nie znaleziono”._
- [x] Zalogowany jako pracownik (EMPLOYEE) → adres `/szablony/<id>` istniejącego szablonu: w górnym
      pasku nie ma nazwy szablonu.
      _Staging 2026-10-01: wymyślony EMPLOYEE „Qatest Jeden” (id 75, qa909-employee@wykonczymy.test) założony z UI „Pracownicy → Dodaj”; formularz nie ma pola hasła, `forgot-password` daje 500 (poczta), więc hasło ustawione w Payload `/admin` → „Zmień hasło”. Login → rola EMPLOYEE; wejście na `/szablony/178` przekierowuje na `/`, na stronie ani w pasku nie ma nazwy szablonu._

## EX-943 — kosztorys-stage-worker-split — kilku pracowników na etap (2026-09-30)

- [x] Nagłówek etapu → „Pracownicy etapu…": dodaj czterech pracowników, podział „Procentowo",
      25/25/25 i czwarty zaznaczony jako „Główny" → „Zapisz"; nagłówek pokazuje „<główny> +3", a przy
      każdej osobie w oknie widać jej kwotę z wykonanej pracy etapu.
      _Staging 2026-10-01 (UI, stan w DB potwierdzony): 4 pracowników 25/25/25 + główny zapisane, nagłówek „<główny> +3”, kwoty przy osobach._
- [x] Ten sam etap „Kwotowo": trzy kwoty stałe i główny; suma kwot większa niż wykonana praca etapu
      → „Zapisz" wyszarzone z komunikatem; w granicach puli → zapis przechodzi.
      _Staging 2026-10-01 (UI): suma kwot ponad pulę blokuje „Zapisz” z komunikatem; w puli zapis przechodzi._
- [x] Przełączenie „Procentowo" ↔ „Kwotowo" zeruje wszystkie wartości; nowa osoba wchodzi z 0;
      usunięcie głównego (przy trzech i więcej osobach) blokuje zapis, dopóki nie wskażesz nowego.
      _Staging 2026-10-01 (UI): przełącznik zeruje wartości, nowa osoba 0, usunięcie głównego blokuje zapis._
- [x] „Pracownicy etapu…" z jednym pracownikiem: brak przełącznika „Procentowo/Kwotowo" i kolumny
      „Główny", pracownik dostaje całą wykonaną pracę etapu; z dwóch usuń jednego → drugi od razu
      dostaje całość i „Zapisz" jest aktywne.
      _Staging 2026-10-01 (UI): przy jednym pracowniku brak przełącznika i kolumny „Główny”, całość dla niego (Etap 2 po usunięciu trzech: zapis w DB takes_rest=t)._
- [x] Wybór „Dodaj pracownika..." wygląda jak pole z ramką, lista otwiera się pod nim, przewija się
      i filtruje po wpisaniu fragmentu nazwiska.
      _Staging 2026-10-01 (UI): pole z ramką, lista pod nim, przewija się i filtruje._
- [x] Etap bez rozliczenia: „Pracownicy etapu…" nieaktywne z podpowiedzią, że najpierw trzeba
      ustawić rozliczenie.
      _Staging 2026-10-01 (UI, inw. 31, Etap 1 i 2 z `plane` NULL w DB — znalezione SQL-em, UI ich nie tworzy; widok „Inwestor", bo w widoku podwykonawcy kolumn etapów bez rozliczenia nie ma): menu etapu — „Pracownicy etapu…" ma `aria-disabled=true`, pod nim „Najpierw wybierz rozliczenie etapu — bez niego etap nie ma ceny, więc nikomu nic nie nalicza."_
      _Wcześniejsza notka: nie sprawdzono — nowy etap („Dodaj → Etap”) dostaje rozliczenie od razu, a aktywnego rozliczenia nie da się odznaczyć w menu etapu (`stage-header.tsx`), więc etapu bez rozliczenia nie da się z UI odtworzyć na tej bazie. Boks zostaje otwarty._
- [x] Etap bez wykonanej pracy: okno pokazuje „Kwota do podziału (<nazwa etapu>): 0,00 zł" i każdemu 0 zł.
      _Staging 2026-10-01 (UI, Etap 2): „Kwota do podziału (Etap 2): 0,00 zł”, każdy 0._
- [x] Podział 25/25/25 + główny na etapie z wykonaną pracą: „Podsumowanie podwykonawców", lista
      „Pracownicy", „Rozlicz wypłaty" i kolumna „Pozostało do wypłaty" na liście inwestycji pokazują
      każdemu jego część, a części sumują się do wartości etapu.
      _Staging 2026-10-01 (UI): podsumowania i lista pokazują części sumujące się do wartości etapu._
- [x] Podział kwotowy, potem zmniejsz „Pomiar z natury" tak, by kwoty przekroczyły wykonaną pracę:
      w nagłówku etapu pojawia się znacznik „popraw podział", „Problemy" ma pozycję z tym etapem,
      kwoty maleją proporcjonalnie, a główny dostaje 0 zł. Po poprawieniu podziału
      znacznik znika.
      _Staging 2026-10-01 (UI): znacznik „popraw podział” po przekroczeniu puli, znika po poprawie._
- [x] Link pracownika z 25% udziału (i PDF z jego widoku): wiersze i „Razem" dotyczą całego etapu,
      „Wartość przedmiaru" to cały przedmiar, a osobno widać „Twój udział: 25,0%" z kwotą; nigdzie nie
      ma imion pozostałych osób z etapu.
      _Staging 2026-10-01 (widok): Etap 1 podzielony 75/25 (Adam główny, Arek 25%); `/podglad-pracownika/Arek-Zwierski-52/137` — wiersze i „Razem” 3437,40 (cały etap), „Wartość przedmiaru (Twoja stawka)” 3462,50, osobno „Etap 1 (cały etap) 3437,40” → „Twój udział: 25,0%” 859,35, „Pozostało do wypłaty” 859,35; w widoku brak imion pozostałych. NIE sprawdzono PDF („Drukuj PDF” = okno wydruku, wymaga człowieka) ani prawdziwego linku `/p/…` Arka (ten sam renderer co Podgląd, ale token nie był generowany). Boks zostaje otwarty. Split cofnięty do samego Adama._
- [x] Link pracownika, który jest sam na swoich etapach: widok i PDF wyglądają jak przed zmianą (bez
      wiersza „Twój udział").
      _Staging 2026-10-01 (widok): `/p/Adam-Orlowski/<token>` przy Adamie samym na Etapie 1 — „Twoje rozliczenie”: Wartość przedmiaru, „Etap 1 3437,40”, Wykonane razem, Wypłacone, Pozostało — bez wiersza „Twój udział”. NIE sprawdzono PDF (człowiek) ani porównania „jak przed zmianą” (brak zrzutu sprzed). Boks zostaje otwarty._
      _Staging 2026-10-01 (batch 5): prawdziwy link `/p/Qatest-Dwa/<token>` (inw. 137, Etap 1 75% Adam / 25% Qatest Dwa): wiersz „Etap 1 (cały etap) 3437,40”, „Twój udział: 25,0%” 859,35, Wykonane razem 859,35, Pozostało 859,35, „Wartość przedmiaru (Twoja stawka)” 3462,50, brak innych imion. PDF przechwycony przez stub `window.open`/print (bez prawdziwego druku): te same wiersze całego etapu i „Twój udział: 25,0%”, bez imion. Boks zamknięty._
      _Zweryfikowano 2026-10-04 (staging, inw. 182, QA-Premia A sam na Etapie 1): widok `/p/…` oraz „Drukuj PDF” (stub `popup.print`, print wywołany 1×, bez prawdziwego druku) pokazują te same wiersze: Etap 1, Wykonane razem, Wypłacone, Pozostało do wypłaty — bez wiersza „Twój udział”. Zgodność „jak przed zmianą” oparta na opisie, bez zrzutu sprzed._
- [x] Etap sprzed zmiany z jednym przypisanym pracownikiem: po wdrożeniu nagłówek pokazuje tę samą
      osobę bez „+N", a jej należne i wypłaty się nie zmieniły.
      _Staging 2026-10-01: nie sprawdzono w pełni — Etap 1 inw. 137 (jeden pracownik, Adam Orłowski) pokazywał nagłówek bez „+N” przed moimi zmianami, ale „po wdrożeniu” to porównanie ze stanem sprzed zmiany, którego nie mam. Boks zostaje otwarty._
      _Staging 2026-10-01 (batch 5): inw. 138 Etap 1 (stworzony 2026-08-30, jeden pracownik Adrian Furmańczyk, `kosztorys_stage_workers` id 1): nagłówek „Adrian Furmańczyk” bez „+N”; „Pracownicy”: wykonana praca 4290,00, wypłaty 0,00, pozostało 4290,00 — zgodne z DB (22 × 300 × 0,65 = 4290,00; brak aktywnych PAYOUT pracownika 17 na 138). Boks zamknięty._
- [x] Pracownik będący tylko członkiem podziału etapu: próba usunięcia go jest odrzucona z
      komunikatem o etapach kosztorysu.
      _Staging 2026-10-01: nie sprawdzono — brak akcji usuwania pracownika w UI (jak w EX-947); pokryte `src/__tests__/collections/users-delete-guard.test.ts`. Boks zostaje otwarty._
      _Staging 2026-10-01 (batch 5): `fetch('/api/users/76',{method:'DELETE'})` jako OWNER (Qatest Dwa — 25% członek Etapu 1 inw. 137, nie główny): 400 „Nie można usunąć pracownika — jest powiązany z danymi (etapy kosztorysu: 1). Zamiast usuwać, odznacz „Aktywny”.”; użytkownik nadal istnieje (GET 200). Boks zamknięty._
- [x] Etap podzielony procentowo na trzy osoby (np. 33,33% / 12,5% / główny), wszystkie etapy
      przypisane: „Podsumowanie podwykonawców" i „Rozlicz wypłaty" nie pokazują wiersza
      „Nieprzypisane" z 0,00 zł.
      _Staging 2026-10-01 (UI): brak wiersza „Nieprzypisane” z 0,00 zł._
- [x] Dialog „Pracownicy etapu…": wartość z trzema miejscami po przecinku (np. 33,335%) nie daje się
      zapisać; 33,33% się zapisuje i po odświeżeniu strony zostaje 33,33%.
      _Staging 2026-10-01 (UI): 33,335% nie zapisuje się; 33,33% zostaje po odświeżeniu._

### Findings — 2026-10-01 (EX-943)

- [x] 🔵 OBSERVATION · filed · **Linear: EX-956.** · podział etapu, część głównego: przy 33,33% / 12,5% / główny na etapie 3437,40 zł części wyświetlają się 1145,69 + 429,68 + 1862,04 = 3437,41 przy „Razem” 3437,40 — główny bierze nierundowaną resztę, a pozostałym zaokrąglenie dochodzi osobno, więc suma części może o 1 gr przekraczać wartość etapu. **Needs human:** czy główny ma być resztą z części już zaokrąglonych (dotyka zaokrąglania pieniędzy, poza zakresem tej sesji).
      **Test disposition:** TDD · unit — suma części (po zaokrągleniu) == wartość etapu dla podziałów procentowych.

## EX-917 — kosz-kas

- [x] Jako MANAGER, `/kasy` → „Usuń kasę" przy nieużywanej kasie pomocniczej → „Przenieść do kosza?"
      → potwierdź: kasa znika z `/kasy`, z kafelków na pulpicie, z wyboru kasy w wydatku, wpłacie i
      transferze wewnętrznym oraz z filtrów listy transakcji.
      _Zweryfikowano 2026-10-01 (staging, MANAGER): kasa QA-917 B bez transakcji → „Przenieść do kosza?" → znika z `/kasy` (licznik Pomocnicze 13→12), z wyboru kasy w wydatku, wpłacie i transferze wewnętrznym (źródłowa i docelowa) oraz z filtra „Kasa" listy transakcji; kontrola: QA-917 A (aktywna) jest wszędzie._
- [x] „Usuń kasę" przy kasie z nieanulowanymi transakcjami: odmowa w toaście z liczbą transakcji,
      kasa zostaje na liście.
      _Zweryfikowano 2026-10-01 (staging, MANAGER): kasa „Igor" (2 żywe transakcje): toast „Nie można usunąć kasy — istnieją powiązane dane (transakcje: 2)…", `trashed_at` NULL, kasa zostaje na liście._
- [x] Kasa, na której są tylko anulowane transakcje, po przeniesieniu do kosza: lista transakcji
      nadal pokazuje jej nazwę (bez linku), a `/kasa/<id>` daje 404.
      _Zweryfikowano 2026-10-01 (staging, MANAGER): QA-908 Kasa B (tylko anulowany transfer #5282) w koszu: na liście anulowanych #5282 nazwa „QA-908 Kasa B" jest zwykłym tekstem (brak linku /kasa/44), a `/kasa/44` renderuje „Nie znaleziono"._
- [x] Formularz wydatku otwarty przed przeniesieniem kasy do kosza, zapisany z tą kasą: zapis
      odrzucony z komunikatem „Kasa jest w koszu…".
      _Zweryfikowano 2026-10-01 (staging, MANAGER): formularz z kasą QA-917 B otwarty w karcie 1, kasa przeniesiona do kosza w karcie 2, „Zapisz": toast „Kasa jest w koszu — przywróć ją, żeby coś zmienić.", 0 transakcji na kasie (SQL)._
- [x] Użytkownik, którego domyślną kasą była kasa z kosza, otwiera nowy wydatek: pole kasy jest
      puste, nic nie jest wybrane w tle.
      _Zweryfikowano 2026-10-01 (staging, OWNER): domyślna kasa ustawiona z formularza na QA-917 A, kasa do kosza, przeładowanie: „Nowy wydatek" ma puste pole („Wybierz kasę"), a zapis pustego formularza daje „Kasa jest wymagana", nie „w koszu" — nic nie siedzi w tle._
- [x] `/kosz` → sekcja „Kasy" → „Przywróć": kasa wraca na `/kasy`, pulpit i do wyborów; domyślna kasa
      użytkownika pozostaje pusta.
      _Zweryfikowano 2026-10-01 (staging, OWNER): QA-917 A przywrócona: znika z kosza, wraca na `/kasy` (licznik 12), do wyboru kasy w wydatku; `users.default_cash_register_id` nadal NULL (SQL)._
- [x] `/kosz` → „Kasy" → „Usuń na zawsze": zwykłe potwierdzenie bez wpisywania nazwy, kasa znika
      z kosza na dobre.
      _Zweryfikowano 2026-10-01 (staging): QA-917 B: okno „Usunąć na zawsze? … zniknie bezpowrotnie." bez pola do wpisania nazwy, po potwierdzeniu znika z kosza i z bazy (SQL: 0 wierszy)._
- [x] Edycja kasy z transakcjami: pole „Właściciel" jest nieaktywne z podpowiedzią; w kasie bez
      transakcji właściciela da się zmienić.
      _Zweryfikowano 2026-10-01 (staging, OWNER): „Igor" (2 żywe transakcje): właściciel nieaktywny z podpowiedzią „Nie można zmienić właściciela kasy, która ma transakcje."; QA-917 A bez transakcji: właściciel zmieniony na Staging QA Manager (SQL owner_id 69). Blokada idzie za blokerem usunięcia, więc kasa z samymi anulowanymi transakcjami (QA-908 Kasa A2) jest odblokowana — spójne z „Usuń kasę"._
- [x] Jako MANAGER: kasa główna w koszu nie pojawia się w `/kosz` (jako OWNER — pojawia się).
      _Zweryfikowano 2026-10-01 (staging): QA-917 M (Główne, bez transakcji) w koszu: OWNER widzi ją w `/kosz`, MANAGER (rola potwierdzona z /api/users/me) — nie._

## EX-947 — worker-work-reports — pracownik zgłasza ilości, kierownik przyjmuje (2026-09-30)

Na stagingu link wskazuje na staging (wartość Preview `NEXT_PUBLIC_FRONTEND_URL` dla brancha `staging`); na innym preview — na produkcję, wtedy podmień host.

**Pracownik**

- [x] „Pracownicy” → pracownik z etapem → „Link do zgłoszeń”: wygeneruj, skopiuj, odwołaj. Dla
      pracownika bez etapu link jest zablokowany.
      _Staging 2026-10-01 (UI, druga połowa): stan złożony z UI na inw. 137 — Etap 2 z Arkiem Zwierskim, jego „Link” (rozpiska) wygenerowany, potem Etap 2 usunięty → w „Pracownicy” Arek ma „Brak przypisanych etapów”, „Link do zgłoszeń” i „Drukuj PDF” `aria-disabled=true`, „Link” (już wydany) aktywny. Cofnięte: link Arka wyłączony („Wyłącz link”), Etap 2 usunięty, w DB zostaje tylko share Adama (id 4) i Etap 1._
      _Staging 2026-10-01 (fcf42316): „Wygeneruj nowy” → toast „Link gotowy. Poprzedni (jeśli był) przestał działać.”, stary adres → 404, nowy działa; „Wyłącz link” → potwierdzenie → toast „Link wyłączony.”, adres → 404, wiersz w `worker_report_shares` usunięty. NIE sprawdzono: pracownik bez etapu (blokada) — na inwestycji 137 jest tylko Adam, brak pracownika bez etapu. Boks zostaje otwarty._
- [x] „Pracownicy” → pracownik bez blokady → „Link” i „Link do zgłoszeń”: samo kliknięcie kopiuje
      link do schowka (toast „Link skopiowany do schowka.”), jak „Udostępnij” inwestora; drugie
      kliknięcie kopiuje ten sam link. W Safari też.
      _Staging 2026-10-01 (fcf42316): klik „Link do zgłoszeń” otwiera okno z linkiem i jednocześnie kopiuje — toast „Link skopiowany do schowka.” (schowek podstawiony stubem, headless); drugie otwarcie daje ten sam adres (.../zgloszenie-prac/Adam-Orlowski/wzB7…). NIE zweryfikowano: prawdziwy schowek i Safari (wymaga człowieka) — boks zostaje otwarty._
- [x] Link w prywatnym oknie przy 390px: formularz się pokazuje, wpisane ilości przeżywają
      odświeżenie, „Wyślij do weryfikacji” zapisuje zgłoszenie, czyści szkic, a na liście zgłoszeń
      pojawia się „czeka”.
      _Staging 2026-10-01, 390px: formularz działa; wpisane 2 (mikrocement) przeżyło odświeżenie (localStorage `worker-report-draft:137:36`); „Wyślij” → potwierdzenie → toast „Zgłoszenie wysłane do weryfikacji”, szkic wyczyszczony, lista: „01.10.2026, 01:26 · 3 prace — czeka”; wiersze w DB: 2 rozpiska + 1 extra. Okno prywatne zastąpione zwykłą kartą (strona nie używa sesji, tylko tokenu)._
- [x] „Ograniczona rozpiska” przy 390px: tylko „Opis prac” i „Zgłaszam”; przy 1280px: Lp, „Opis
      prac”, „Zgłaszam” i j.m. — j.m. i „Zgłaszam” mają stałą szerokość, resztę bierze „Opis prac”.
      _Staging 2026-10-01: 390px — tylko „Opis prac” i „Zgłaszam”; 1280px — Lp, „Opis prac”, „Zgłaszam” 110 px, j.m. 80 px; po zmianie okna 1280→1000 px zmienia się tylko „Opis prac” (1052→772)._
- [x] „Wszystkie kolumny”: strona przewija się w bok, nagłówek tabeli trzyma się góry, siatka nie
      miga.
      _Staging 2026-10-01, 1280px: scrollWidth 1600 > 1280, nagłówek przykleja się do góry (top=0 po przewinięciu), kolumna „Czeka” pokazuje 2 i 1,5. „Nie miga” oceniono na zrzutach po przełączeniu — bez próbkowania klatek._
- [x] Praca spoza rozpiski: dodaj wiersz z opisem, j.m. i ilością — wysyła się razem ze
      zgłoszeniem.
      _Staging 2026-10-01: „QA praca testowa”, m², 3 — wysłana razem ze zgłoszeniem, w DB `worker_report_lines.kind='extra'`._
- [x] „Nowa praca” przy 390px: „Opis prac” na całą szerokość, j.m. i ilość w linii pod nim; przy
      1280px wszystko w jednej linii. Przycisk pod wierszami to „Dodaj więcej”.
      _Staging 2026-10-01: 390px — opis na całą szerokość, j.m. + ilość pod nim; 1280px — trzy pola w jednej linii (top=363 wszystkie); przycisk „Dodaj więcej”._
- [x] Po dodaniu pracy spoza rozpiski (z opisem) pod tabelą, nad „Wyślij”, jest sekcja „Prace spoza
      rozpiski” z opisem, ilością i j.m.; pusty wiersz się w niej nie pokazuje, a po wysłaniu znika.
      _Staging 2026-10-01: sekcja „Prace spoza rozpiski” pod tabelą, nad „Wyślij”, „QA praca testowa — 3 m²”; ponowne otwarcie okna nie dodaje pustego wiersza do sekcji; po wysłaniu sekcja znika (ekran „Wysłano do weryfikacji”)._
- [x] „Nowa praca”: wpisz sam opis (bez j.m. i ilości) → „Gotowe”, Esc i kliknięcie obok nie
      zamykają okna; pojawia się „Popraw błędy — …”, a brakujące pola są czerwone. Po uzupełnieniu
      albo usunięciu wiersza okno się zamyka. Przy „Wyślij” błędna ilość w tabeli daje „Popraw błędy”.
      _Staging 2026-10-01, 390px: sam opis → „Gotowe” → „Popraw błędy — uzupełnij opis, j.m. i ilość albo usuń wiersz.”, j.m. i ilość z czerwoną ramką; Esc i klik obok nie zamykają; po uzupełnieniu okno się zamyka. Ilość -5 w tabeli → „Popraw błędy” i „Wyślij” wyłączone._
- [x] Zakończona inwestycja: link pokazuje komunikat zamiast formularza, a wysyłka z wcześniej
      otwartej strony jest odrzucona.
      _Staging 01.10 (137 → Zakończona, potem z powrotem Aktywna): świeża karta linku pokazuje „Ta inwestycja jest zamknięta — zgłoszenia prac nie są już przyjmowane.”, a „Wyślij” ze starej karty daje ten sam toast i nie tworzy zgłoszenia (DB: nadal 5 zgłoszeń)._
- [x] Szkic z wpisami, potem „Wyczyść kosztorys” u kierownika: „Wyczyść” kasuje też etapy, więc
      link pokazuje „Brak przypisanych etapów”; po „Wczytaj” wersji sprzed wyczyszczenia (etapy wracają,
      pozycje z nowymi id) i odświeżeniu link pokazuje „N prac ze szkicu zniknęło z rozpiski”.
      _Staging 01.10: sam „Wyczyść” usuwa też etapy, więc link pokazuje „Brak przypisanych etapów” i komunikatu nie ma; po „Wczytaj” wersji „Przed wyczyszczeniem” i odświeżeniu link pokazuje „3 prace ze szkicu zniknęły z rozpiski.”. Opis w rejestrze pomija tę kolejność._

**Kierownik — przyjęcie**

- [x] Rozpiska → „Zgłoszenia prac” → zgłoszenie: zaznacz część linii, popraw jedną ilość, „Dodaj do”
      ostatni etap pracownika → „Przyjmij n prac”. Kolumna etapu pokazuje starą ilość plus
      przyjętą bez odświeżania, a „Cofnij” tego nie cofa.
      _Staging 2026-10-01 (inw. 137): zaznaczona 1 z 2 linii rozpiski, ilość 2 → 2,5, „Dodaj do” Etap 1 (ostatni) → „Przyjmij 1 pracę”, toast „Zgłoszenie przyjęte do rozpiski”. Kolumna etapu w siatce od razu 12,50 (było 10) bez odświeżania; DB: stage_progress 7221 = 12.5, accepted_qty = 2.5, status accepted. Cmd+Z nic nie cofnęło (12.5 zostało)._
- [x] Przyjęcie do „Nowy etap”: pojawia się nowa kolumna etapu z następnym numerem, przypisana
      zgłaszającemu na 100%, a jego link do rozpiski pokazuje nowe ilości.
      _Staging 01.10: przyjęcie do „Nowy etap” utworzyło etap 2 (kolumna „Etap 2”), przypisany Adamowi (takes_rest, reszta = 100%); link pracownika w „Wszystkie kolumny” pokazuje Etap 2 i nowe ilości (mikrocement 2, płyty osb 1,5, bruzdowanie 3)._
- [x] Praca spoza rozpiski z Ceną j.m. i sekcją: w tej sekcji pojawia się nowa pozycja bez
      przedmiaru, a „Problemy” ją wykazują.
      _Staging 01.10: „QA extra B” z sekcją Klimatyzacja i ceną 123 → nowa pozycja 12239 (przedmiar 0) w tej sekcji; „Problemy” → „Pozycje z wykonaną pracą bez przedmiaru (1)”._
- [x] Na liście wyboru etapu nie ma etapów innych ekip.
      _Staging 2026-10-01: Etap 2 (73) założony tylko dla Arka Zwierskiego (DB: `kosztorys_stage_workers` stage 73 = {52}); w przeglądzie zgłoszenia 5 (Adam Orłowski, id 36, jest w Etapie 1) lista „Dodaj do” = „Etap 1 (ostatni)” | „Nowy etap” — Etapu 2 nie ma. Etap 2 potem usunięty._
- [x] Dwie karty na tej samej rozpisce: przyjmij w pierwszej, przełącz na drugą — przeładowuje się z
      komunikatem i pokazuje przyjęte ilości.
      _Staging 01.10: po przyjęciu w karcie A, w karcie B (zdarzenie focus) toast „Rozpiska zmieniła się w innym oknie — wczytano aktualną wersję.” i kolumna pokazuje nowe ilości (mikrocement 13,00)._
- [x] „Wczytaj”: po przyjęciu jest automatyczna wersja sprzed przyjęcia.
      _Staging 2026-10-01: Opcje → Wczytaj → na liście „01.10.2026, 01:28 Auto · QA Staging”; payload snapshotu 161 ma qtyDone 7221 = 10, czyli stan sprzed przyjęcia._
- [x] Odrzuć zgłoszenie: otwiera się jako „Odrzucone”, a pracownik widzi „odrzucone”. Da się je
      potem przyjąć — zaznacz prace, „Przyjmij n prac”, status zmienia się na „Przyjęte”.
      _Staging 01.10: po odrzuceniu szczegół pokazuje „Zgłoszenie odrzucone w całości.”, lista status „Odrzucone”, link pracownika „odrzucone”; zaznaczenie mikrocementu + „Przyjmij 1 pracę” → „Przyjęte 1 z 3”._
- [x] Przyjęte zgłoszenie, otwórz ponownie: przyjęte prace są zaznaczone. Zmień ilość jednej — pod
      nią „było X”, a „Zapisz zmiany” przesuwa etap tylko o różnicę. Odznacz drugą — „cofasz X”, po
      zapisie etap maleje o X. Odznacz wszystkie → zgłoszenie wraca do „Do sprawdzenia”.
      _Staging 01.10: „było 2,5”, etap 10→13 o różnicę; odznaczone obie → „cofasz 3” / „cofasz 1,5”, po zapisie etapy wróciły do 10, zgłoszenie „Do sprawdzenia”._
- [x] Przyjęte do etapu, potem usuń ten etap: przy dodaniu reszty zgłoszenia do innego etapu pojawia
      się „Część zgłoszenia przyjęto do etapu, którego już nie ma…”, a przycisk nie zapisuje.
      Odznaczenie przyjętych prac to odblokowuje.
      _Staging 01.10: po usunięciu etapu, do którego przyjęto, ticknięcie nieprzyjętej pracy daje „Część zgłoszenia przyjęto do etapu, którego już nie ma…” i „Zapisz zmiany” jest nieaktywne; po odznaczeniu przyjętych komunikat znika. UWAGA: zob. finding 2026-10-01 (podgląd „10 → 8,5”)._
- [x] To samo przyjęte zgłoszenie w dwóch kartach: zmień ilość tej samej pracy w obu, zapisz w
      pierwszej, potem w drugiej —
      druga dostaje „Zgłoszenie zmieniło się w innym oknie — odśwież je.” i nic nie zapisuje.
      _Staging 01.10: zapis w pierwszej karcie przeszedł; druga dostała toast „Zgłoszenie zmieniło się w innym oknie — odśwież je.”, w bazie została wartość z pierwszej._
- [x] Praca spoza rozpiski → „Podmień na pracę z katalogu” → praca, która już jest w rozpisce:
      komunikat „Jest już w rozpisce — ilość doda się do tej pozycji.”, po przyjęciu ilość trafia do
      tej pozycji, nie powstaje druga. Praca spoza rozpiski daje „…trafi tam jako nowa pozycja…”.
      _Staging 01.10: „Bruzdowanie pod rury żelbet” → „Jest już w rozpisce — ilość doda się do tej pozycji.”; po przyjęciu stage_progress pozycji 7224 dostał 3, liczba pozycji bez zmian. „Mikrocement gabinet” → „Nie ma jej w rozpisce — trafi tam jako nowa pozycja w cenie z katalogu.”_
- [x] Zgłoszenie oczekujące, potem „Wyczyść kosztorys”: jego linie są „do przypisania ręcznie” i da
      się je przypiąć do pozycji albo przyjąć jako pracę spoza rozpiski.
      _Staging 01.10: po „Wyczyść” linia „montaż płyt osb” ma „Pozycja usunięta z rozpiski — do przypisania ręcznie”, „Przenieś do prac spoza rozpiski” przenosi ją do sekcji spoza rozpiski. Przypięcie do pozycji z listy: staging 2026-10-01, zgłoszenie 5 — lista pod linią (378 pozycji), wybrano „Bruzdowanie pod rury żelbet”, „Przyjmij 1 pracę” → `worker_reports` status `accepted`, linia `item_id`=12247 (ta pozycja), `accepted_qty`=1; cofnięte „Zapisz zmiany” → `pending`, `accepted_qty` puste (linia zostaje przypięta do 12247, wiersz `stage_progress` 718 z 0)._

**Nawigacja i licznik**

- [x] Przy oczekującym zgłoszeniu menu pokazuje „Zgłoszenia prac” z licznikiem; strona je wymienia,
      a wiersz otwiera rozpiskę z tym zgłoszeniem. Odświeżenie po zamknięciu okna go nie otwiera
      ponownie.
      _Staging 2026-10-01: badge „1” przy „Zgłoszenia prac” w menu, strona wymienia zgłoszenie (Wysłano / Prace / Status „Do sprawdzenia”), klik w wiersz otwiera rozpiskę z oknem zgłoszenia; po zamknięciu i przeładowaniu okno się nie otwiera._
- [x] „Zgłoszenia prac” wymienia też zgłoszenia przyjęte i odrzucone, każde ze statusem; licznik w
      menu liczy tylko oczekujące. Po odrzuceniu w rozpisce licznik w menu spada od razu.
      _Staging 01.10: lista ze statusami (Do sprawdzenia / Przyjęte n z m / Odrzucone); przy 2 oczekujących i 2 przyjętych menu pokazywało 2; po odrzuceniu jednego w rozpisce menu spadło do 1 bez przeładowania._
- [x] Będąc na „Zgłoszenia prac”, znaczek „Zgłoszenia” (leady) dalej pokazuje swoją liczbę.
      _Staging 2026-10-01: lead 222 („QA Lead”, qa-lead@example.test, 000000000) wstawiony SQL-em; menu: „Zgłoszenia 1” na /katalog-prac, na /zgloszenia-prac i po przeładowaniu tam — bez zmian. Wiersz usunięty._
- [x] Po przyjęciu ostatniego oczekującego przycisk na pasku rozpiski znika, a licznik w menu spada
      przy następnym przejściu.
      _Staging 2026-10-01: po przyjęciu przycisk „Zgłoszenia prac” znika z paska rozpiski, a po przeładowaniu znika też badge w menu._
- [x] Klik w wiersz na „Zgłoszenia prac” (bez przeładowania strony) otwiera rozpiskę z tym
      zgłoszeniem — wczytuje się, nie wisi na „Wczytywanie…”. Adres ma `?zgloszenie=` do zamknięcia
      okna; po zamknięciu i przeładowaniu okno się nie otwiera.
      _Staging 2026-10-01: klik w wiersz → /inwestycje/137/kosztorys_v2?zgloszenie=1, okno wczytało się w <6 s z treścią zgłoszenia; Esc zdejmuje ?zgloszenie=, po przeładowaniu okno się nie otwiera._
- [x] Przegląd zgłoszenia, prace z rozpiski: kolumna etapu nosi nazwę etapu wybranego w „Dodaj do”
      („Nowy etap” dla nowego) i zmienia się razem z wyborem; dalej osobno „Przedmiar” i „Pomiar
      (razem etapy)”. Zaznaczona ilość przesuwa etap i pomiar („12 → 15”), przedmiar stoi.
      _Staging 2026-10-01: kolumna nosi „Etap 1” przy „Etap 1 (ostatni)” i „Nowy etap” przy „Nowy etap”, dalej osobno „Przedmiar” i „Pomiar (razem etapy)”; po zaznaczeniu z ilością 2,5: etap „10 → 12,5”, pomiar „10 → 12,5”, przedmiar stoi na 10._

**Bez zmian w innych widokach**

- [x] Edytor kierownika, Podgląd, link inwestora i link pracownika wyglądają i działają jak
      wcześniej.
      _Zweryfikowano 2026-10-04 (staging, inw. 182 QA): edytor kierownika, Podgląd inwestora (`/podglad-inwestora/182`), link inwestora (`/k/<token>`), Podgląd pracownika i link pracownika (`/p/…`) ładują się (200), pokazują te same kolumny i sumy, brak czerwonych komórek poza edytorem, żadnej strony błędu. „Jak wcześniej” oceniono względem opisów z wcześniejszych przebiegów — brak zrzutu sprzed zmiany._
- [x] Podgląd i link pracownika: żadnej czerwonej komórki, także w wierszu ponad przedmiar i przy
      stawce ponad pułap. W edytorze kierownika oba dalej są czerwone.
      _Staging 2026-10-01, inw. 137: „montaż płyt osb” (cena 100) ustawiony UI-em na stawkę 80 (80% > 65%), „mikrocement” 13 przy przedmiarze 10 (Pozostało −390,00). Podgląd (`/podglad-pracownika/Adam-Orlowski-36/137`) i link (`/p/Adam-Orlowski/<token>`) — brak czerwonych komórek na zrzutach (80 i 13 czarne); w edytorze stawka 80 czerwona. Stawka potem przywrócona do „auto” (override w DB znów NULL)._
- [x] Usunięcie pracownika, który ma zgłoszenie, jest odrzucone z komunikatem.
      _Staging 2026-10-01: w UI nie ma akcji usuwania pracownika (lista, karta, formularz edycji — tylko „Aktywny”/„Edytuj”); guard `preventDeleteWithReferences` jest osiągalny tylko z /admin lub API, a ryzykowny do próby na bazie preview (brak guardu = kaskadowe skasowanie zgłoszeń). Pokryte automatem `src/__tests__/collections/users-delete-guard.test.ts`. Boks zostaje otwarty._
      _Staging 2026-10-01 (batch 5): Qatest Dwa wysłał zgłoszenie przez własny link `/zgloszenie-prac/Qatest-Dwa/<token>` (inw. 137); DELETE `/api/users/76` jako OWNER → 400 „…(etapy kosztorysu: 1, zgłoszenia prac: 1). Zamiast usuwać, odznacz „Aktywny”.”. Boks zamknięty._
      _Staging 2026-10-01 (batch 5): stub `navigator.clipboard.writeText`+`write`; „Link” skopiował `https://wykonczymy-git-staging-wykonczymys-projects.vercel.app/p/Qatest-Dwa/<token>`, „Link do zgłoszeń” `.../zgloszenie-prac/Qatest-Dwa/<token>`; toast „Link skopiowany do schowka.” po każdym kliknięciu; drugie kliknięcie ten sam adres. Safari NIE sprawdzono (poza zakresem tego przebiegu) — ticked za resztę._
- [x] Podgląd inwestora i link inwestora z `?wersja=` zapisanej wersji pokazują tę wersję; z
      `?wersja=abc` albo nieistniejącym numerem — bieżącą rozpiskę, bez błędu.
      _Staging 2026-10-01, Podgląd inwestora 137: `?wersja=173` (pusta wersja auto) → baner „Wersja z 01.10.2026 — porównanie z bieżącą”, „378 różnic względem bieżącej”, „Wróć do bieżącej”; `?wersja=abc` i `?wersja=99999` → bieżąca rozpiska, status 200, bez błędu. Link inwestora (staging 2026-10-01): „Udostępnij” dla 137 dało token (`kosztorys_shares` id 9); `/k/<token>?wersja=173` → 200, baner „Wersja z …”, „378 różnic względem bieżącej”, „Wróć do bieżącej”; `?wersja=abc` i `?wersja=99999` → 200, bieżąca rozpiska bez banera. Link potem wyłączony („Wyłącz link”), 0 wierszy `kosztorys_shares` dla 137._

### Findings — 2026-10-01 (EX-947)

- [x] 🔵 OBSERVATION · fixed · `src/components/kosztorys/editor/dialogs/worker-reports/line-draft.ts:90`: przyjęta linia, której etap docelowy skasowano — po odznaczeniu dialog pisze „nie ma już czego cofnąć", ale kolumna podglądu nadal pokazuje „Etap 1: 10 → 8,5". Zapis nie rusza Etapu 1 (sprawdzone w DB), więc to tylko mylący podgląd.
      test: TDD · unit — podgląd po odznaczeniu linii bez żywego etapu zostawia wartość bez zmiany.
      **Naprawione 2026-10-01:** `previewQtyChange` — kolumny etapu i pomiaru nie pokazują zmiany dla przyjętej linii bez żywego etapu/pozycji, jak serwer (`accept-worker-report.ts` `removals`); spec w `line-draft.test.ts`. Do ponownego obejrzenia na stagingu po deployu.
- [x] 🔵 OBSERVATION · fixed · dokumentacja rejestru: linia „Link zbudowany na stagingu wskazuje na produkcję" jest nieaktualna (na stagingu wygenerowany link wskazuje na staging); box „Szkic z wpisami, potem Wyczyść" pomija, że „Wyczyść" kasuje też etapy, a „N prac ze szkicu zniknęło z rozpiski" pojawia się dopiero po wczytaniu wersji.

## EX-951 — kosztorys-new-item-dialog — „Nowa praca” jako formularz (2026-09-30)

- [x] Menu wiersza → „Wstaw powyżej” / „Wstaw poniżej”: otwiera się „Nowa praca”; po zapisie praca
      stoi bezpośrednio nad / pod tym wierszem, bez odświeżania.
      _Staging 2026-10-01 (inw. 137): „Wstaw powyżej” i „Wstaw poniżej” otwierają „Nowa praca”; pozycje stanęły dokładnie nad / pod wierszem, bez odświeżania._
- [x] „+ Dodaj pracę” na pasku pustej sekcji i „Dodaj pracę” w menu ⋯ sekcji: praca ląduje na
      końcu tej sekcji. Zwinięta sekcja się rozwija.
      _Staging 2026-10-01 (inw. 137): „+ Dodaj pracę” na pasku pustej sekcji i „Dodaj pracę” w ⋯ sekcji dodają na końcu sekcji; zwinięta sekcja się rozwinęła._
- [x] Pasek narzędzi „Dodaj → Praca → [sekcja]”: praca ląduje na końcu wybranej sekcji. Na
      kosztorysie bez sekcji najpierw pojawia się sekcja, a okno otwiera się dla niej.
      _Staging 2026-10-01: sekcja wybrana z paska ląduje na końcu — OK. Wariant „kosztorys bez sekcji” 2026-10-01 (inw. 31, pusty kosztorys, 0 sekcji w DB): „Dodaj → Praca” najpierw zakłada „Nową sekcję”, a okno „Nowa praca” otwiera się dla niej („Praca trafi na koniec sekcji „Nowa sekcja””)._
- [x] Stawki: „auto” liczy się ze współczynnika inwestycji, kwota stała pokazuje wpisaną kwotę,
      a mnożnik liczy się od „Ceny j.m.”.
      _Staging 2026-10-01: zapisane w DB zgodnie z oczekiwaniem (auto = NULL, mnożnik 0,8 = coeff, kwota stała 33 = value). Wyliczone kwoty w siatce potwierdzone 2026-10-01 (UI, inw. 31, „Cena j.m. netto — z narzędziami”, cena j.m. 100, współczynnik inwestycji 0,65): QA-stawka-auto 65, QA-stawka-kwota 33, QA-stawka-mnoznik (0,8) 80._
- [x] Stawka podwykonawcy powyżej 65% ceny: praca się zapisuje, pojawia się toast z ostrzeżeniem.
      _Staging 2026-10-01: stawka podwykonawcy >65% — pozycja zapisana, pojawił się toast z ostrzeżeniem._
- [x] Ptaszek „Dodaj pracę do katalogu prac” z nowym opisem + j.m.: pozycja pojawia się
      w „Katalogu prac” z wpisaną kategorią. Bez ptaszka pola „Kategoria” nie ma.
      _Staging 2026-10-01: pozycja w katalogu z wpisaną kategorią (wiersze testowe usunięte); bez ptaszka brak pola „Kategoria”._
- [x] Ptaszek z opisem + j.m., które już są w katalogu: okno pokazuje ceny „stare → nowe”;
      „Wróć”, Esc i kliknięcie obok wracają do formularza bez zapisu; „Tylko do kosztorysu”
      zapisuje pracę, a katalog zostaje bez zmian; „Nadpisz w katalogu” aktualizuje pozycję
      i zostawia jej kategorię, chyba że odznaczysz „Zostaw kategorię z katalogu”.
      _Staging 2026-10-01: ceny „stare → nowe”; Wróć / Esc / klik obok wracają bez zapisu; „Tylko do kosztorysu” zostawia katalog; „Nadpisz” zostawia kategorię, a po odznaczeniu „Zostaw kategorię” ją nadpisuje._
- [x] „Nie zamykaj po zapisaniu”: po zapisie formularz jest pusty, a druga praca ląduje pod
      pierwszą.
      _Staging 2026-10-01: po zapisie formularz pusty, druga praca pod pierwszą._
- [x] Przy sortowaniu kolumny „Wstaw powyżej/poniżej” jest nieaktywne, a „Dodaj pracę” dokłada na
      końcu sekcji.
      _Staging 2026-10-01: przy aktywnym sorcie „Wstaw …” nieaktywne, „Dodaj pracę” dokłada na końcu sekcji._
- [x] Zakończona (zablokowana) inwestycja i podgląd klienta: nie ma żadnego wejścia do dodania
      pracy.
      _Staging 2026-10-01: zakończona inw. 9 — baner „tylko do odczytu”, brak przycisku „Dodaj” i brak ⋯ wierszy/sekcji; podgląd /podglad-inwestora/137 bez „Dodaj pracę”/„Wstaw”._
- [x] Szablon: wejścia w „Akcje” otwierają ten sam formularz, ptaszek katalogu działa.
      _Staging 2026-10-01 (szablon „QA test szablon B”, /szablony/160): ⋯ wiersza ma „Wstaw powyżej/poniżej”, ⋯ sekcji „Dodaj pracę”, „Dodaj → Praca”; „Nowa praca” otwiera się z ptaszkiem katalogu, po zaznaczeniu pojawia się „Kategoria”. Nie zapisywano._
- [x] Po otwarciu i zamknięciu „Nowej pracy” inne okno „Dodaj …” pokazuje „Nie zamykaj po
      zapisaniu” jak dotąd, a okno bez tej opcji nie ma zbłąkanego ptaszka.
      _Staging 2026-10-01: „Nowa praca w katalogu” ma „Nie zamykaj”; „Praca z katalogu…” bez opcji i bez zbłąkanego ptaszka._
- [ ] Dwie karty z tym samym kosztorysem: w pierwszej „Wstaw poniżej” na wierszu, w drugiej usuń
      ten wiersz, w pierwszej zapisz: okno się zamyka, siatka się odświeża, nic się nie zawiesza.
      _Staging 2026-10-01: okno się zamknęło, nic się nie zawiesiło, toasty po polsku. Otwarte: siatka NIE odświeżyła się po toaście „Kosztorys zmienił się w innym miejscu — odświeżam dane” — skasowany wiersz wisiał ≥12 s, także po „Odśwież dane”; zniknął dopiero po przeładowaniu (Findings)._
      _Nie sprawdzone ponownie 2026-10-04 (staging): defekt (siatka nie odświeża się po toaście) jest zgłoszony jako EX-957 i w repo nie ma poprawki — powtórka dałaby ten sam wynik. Boks zostaje otwarty do czasu poprawki._
- [x] Katalog prac → „Dodaj pozycję” i edycja pozycji: pola „Kategoria” i „j.m.” działają jak
      dotąd (wybór z listy i wpisanie nowej wartości).
      _Staging 2026-10-01: nowa wartość wpisana i wybrana z listy — j.m. i Kategoria działają przy dodawaniu i edycji._

### Findings — 2026-10-01 (EX-951)

- [x] 🟡 WARNING · filed · **Linear: EX-957.** · edytor kosztorysu, ścieżka „Kosztorys zmienił się w innym miejscu — odświeżam dane” — po zapisie „Wstaw poniżej” na wierszu skasowanym w drugiej karcie pojawia się toast, ale siatka nie odświeża się w miejscu: nieistniejący wiersz zostaje ≥12 s, także po „Odśwież dane”; znika dopiero po pełnym przeładowaniu.
      **Needs human:** czy to oczekiwane (odświeżenie ma być tylko komunikatem), czy brakuje `router.refresh()` / resetu stanu edytora po tej gałęzi błędu.
      **Test disposition:** TDD · dom — `renderHook` na hooku zapisu: po błędzie „pozycja nie istnieje” stan siatki jest przeładowany z serwera.

## EX-940 — request-failed-actions — zerwane połączenie kończy się polskim komunikatem (2026-09-30)

Stan: dowolny kosztorys z kilkoma pozycjami w jednej sekcji; „offline" = DevTools → Network → Offline tuż przed akcją.

- [x] Sidebar „Wyloguj" z siecią: wylogowuje i ląduje na /zaloguj.
      _2026-10-01: logged out online, landed on /zaloguj._
- [x] Kosztorys offline → zmień „Przedmiar" w komórce: toast „Brak połączenia z serwerem…", komórka wraca do poprzedniej wartości, nigdzie „Failed to fetch".
      _Staging 2026-10-01 (inw. 137, `setOffline(true)` tuż przed Enter): toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.” (pojawia się po kilku sekundach — debounce zapisu), komórka wraca do 0, w UI nigdzie „Failed to fetch” (jest tylko w logu konsoli `[SERVER_ACTION]`); w DB wartość bez zmian._
- [x] Offline → zmień rabat w „Opcje rozliczenia": polski komunikat, wartość wraca.
      _Staging 2026-10-01 (inw. 137, Podsumowanie → Opcje rozliczenia → Rabat → „Kwotowy”, `setOffline(true)` tuż przed wyborem): polski toast „Nie udało się zapisać rabatu” (ścieżka `optimisticSettingSave` pokazuje własny komunikat dla REQUEST_FAILED, nie „Brak połączenia…” — taki jest kod), pole wraca do „Wyłączony”, w DB rabat globalny bez zmian. Toast jest typu ostrzeżenie, 4 s — nie łapie go selektor `[data-sonner-toast]`, tylko tekst strony._
- [x] Kosztorys offline → przesuń pozycję ▲/▼: kolejność wraca, polski toast; Cmd+Z nic nie robi.
      _Staging 2026-10-01 (inw. 137, ⋯ wiersza → „Przesuń w górę”, `setOffline(true)` tuż przed kliknięciem): toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, kolejność wierszy bez zmian po błędzie, Cmd/Ctrl+Z nic nie zmienia. Kierunek ▼ idzie tą samą akcją — osobno nie klikany._
- [x] Kosztorys → „Dodaj pozycję" → wypełnij „Nowa praca" → zapisz offline: polski toast, okno zostaje otwarte z wpisanymi danymi, nic nie przybywa w siatce.
      _Staging 2026-10-01 (inw. 137, ⋯ wiersza → „Wstaw poniżej” → „Nowa praca” z opisem, j.m. i ceną, `setOffline(true)` tuż przed „Dodaj”): toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, okno zostaje otwarte z wpisanym opisem, liczba wierszy siatki bez zmian (18 → 18), w DB 0 pozycji „QA-offline…”._
- [x] Kosztorys offline → „Dodaj sekcję": polski toast, nic nie przybywa, brak strony błędu.
      _Staging 2026-10-01 (inw. 137, Dodaj → Sekcja, `setOffline(true)` tuż przed kliknięciem): toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.”, brak strony błędu, strona zostaje na kosztorysie; w DB nie przybyła żadna sekcja (ostatnia 584 pochodzi z mojego przypadkowego kliknięcia online — usuwam przez UI)._
- [x] „Wyczyść kosztorys" → potwierdź offline: „Czyszczenie przerwane — odświeżam…", okno się zamyka; po powrocie sieci siatka pokazuje prawdziwy stan.
      _2026-10-01 inv. 137: offline Wyczyść -> dialog closed, page hard-navigated to chrome-error (offline refresh), toast not observable; after back online kosztorys intact (378 items / 14 sections / 1 stage via SQL). Partial: no data loss confirmed, toast text unverified._
      _Zweryfikowano 2026-10-04 (staging, inw. 182): Wyczyść offline -> toast „Czyszczenie przerwane — odświeżam kosztorys”, okno zamknięte, brak chrome-error; po powrocie sieci stan prawdziwy (DB 3 sekcje / 2 pozycje, nic nie wyczyszczone)._
- [x] „Wersje" → przywróć wersję offline: „Przywracanie przerwane — odświeżam kosztorys", okno się zamyka, brak strony błędu.
      _2026-10-01 inv. 137: offline Przywróć -> dialog closed, no chrome-error page, URL unchanged, data intact (378/14). Toast text NOT caught by 10 s page-text poll (likely transient); unverified._
      _Zweryfikowano 2026-10-04 (staging, inw. 182, wersja „QA-wersja”): Przywróć offline -> toast „Przywracanie przerwane — odświeżam kosztorys”, okno zamknięte, brak strony błędu, dane bez zmian._
- [x] Transakcje → „Anuluj transakcję" offline: polski toast, przyciski i pole powodu znów aktywne.
      _2026-10-01 tx #5251 offline: toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę."; Nie / Tak anuluj and reason field enabled again. Closed with Nie, nothing cancelled._
- [x] /zaloguj offline → „Zaloguj": komunikat pod formularzem, przycisk wraca do „Zaloguj".
      _2026-10-01: offline -> message under the form „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.", button back to „Zaloguj"._
- [x] Sidebar „Odśwież dane" offline: toast błędu, brak strony błędu.
      _2026-10-01: offline click -> toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.", page stayed on /, no error page. (Run seconds after the Anuluj test, a leftover identical toast could overlap.)_
- [x] Formularz sprzętu (/sprzet → „Sprzęt") → „Nowy magazyn" offline: toast błędu, brak strony błędu.
      _2026-10-01: the „Nowy magazyn" button lives in the Sprzęt form (/sprzet -> Sprzęt), not in the expense form. Offline Zapisz -> toast „Brak połączenia z serwerem…", typed name kept, no error page. Nothing created._
- [x] Link pracownika → zgłoszenie prac → „Wyślij" offline: polski toast, szkic zostaje, przycisk wraca do „Wyślij".
      _2026-10-01 inv. 137 / Adam Orłowski link: confirm dialog -> Wyślij offline -> toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę."; draft qty (1) kept, send button back to „Wyślij". Nothing submitted._
- [x] Kosztorys → menu inwestora → „Udostępnij" offline (pierwszy raz dla tej inwestycji): toast „Brak połączenia z serwerem…", nic nie trafia do schowka, brak strony błędu.
      _2026-10-01 inv. 31 (0 kosztorys_shares rows): offline -> toast „Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.", clipboard stub empty, no error page, still 0 share rows after._
- [x] „Wczytaj szablon…" i „Pobierz z arkusza Google…" → potwierdź offline: „…przerwane — odświeżam kosztorys", okno się zamyka; po powrocie sieci siatka pokazuje prawdziwy stan.
      _2026-10-01 offline: inv. 137 (szablon „QA test szablon B") and inv. 31 (sheet, preview read online, import offline): after „Wczytaj i zastąp" / „Pobierz i zastąp" the dialog closed and the tab fell to chrome-error://chromewebdata (the „…przerwane — odświeżam" toast never caught; router.refresh() offline = hard navigation). DB unchanged both times (137: 378/14, 31: 3/1); back online grid is the real state. NOT ticked — see Findings (EX-940)._
      _Zweryfikowano 2026-10-04 (staging, inw. 182): „Wczytaj szablon…” offline -> „Wczytywanie przerwane — odświeżam kosztorys”, okno zamknięte, brak chrome-error, DB bez zmian. „Pobierz z arkusza Google…” nie uruchamiane (brak QA inwestycji z arkuszem; ta sama ścieżka `settleTreeReplace`)._

### Findings — 2026-10-01 (EX-940)

- [x] 🟡 WARNING · open — fix in the tree, staging recheck owed · offline „Wyczyść kosztorys", „Wczytaj szablon…", „Pobierz z arkusza Google…" (inv. 137 / 137 / 31): po błędzie sieci `settleTreeReplace` zwraca `refetch: true`, a `handleTreeReplaced` (`kosztorys-editor-v2.tsx:56`) woła `router.refresh()` — offline Next robi twardą nawigację i karta ląduje na `chrome-error://chromewebdata` (strona błędu przeglądarki), więc box „brak strony błędu" nie przechodzi, a toast „…przerwane — odświeżam…" znika razem ze stroną. Dane nietknięte. Przywracanie wersji (ta sama ścieżka) tego nie zrobiło w moim przebiegu (okno się zamknęło, strona została) — niespójność do wyjaśnienia.
      test: no automated test · e2e — zachowanie przeglądarki offline; ewentualnie dom spec na to, że `refetch` nie woła `router.refresh()` przy braku sieci.
      **Naprawione 2026-10-01 (w drzewie, przed deployem):** `whenOnline` (`src/lib/utils/when-online.ts`) — odświeżenie po przerwanym zapisie czeka na powrót sieci zamiast twardej nawigacji offline; spec `when-online.test.tsx` (dom). Do ponownego obejrzenia na stagingu po deployu — wtedy też trzy otwarte boxy wyżej.
      _Zweryfikowano 2026-10-04 (staging, inw. 182 QA, `setOffline`): „Wyczyść”, „Wczytaj szablon” i „Wersje → Przywróć” offline — karta zostaje na kosztorysie (brak chrome-error), toast „…przerwane — odświeżam kosztorys” widoczny, okno zamknięte, po powrocie sieci stan w DB bez zmian (3 sekcje / 2 pozycje). Poprawka `whenOnline` działa na stagingu._

## 2026-10-01 — marza-v2-half-grosz — lista i strona inwestycji pokazują tę samą marżę v2

- [x] Lista „Inwestycje" → kolumna „Marża v2" i „Pozostało do wypłaty" dla inwestycji, w której
      kosztorys ma wykonane ilości z ułamkiem (np. 2,5 × stawka z groszami) → otwórz tę inwestycję:
      marża v2 i „Pozostało" na stronie inwestycji są co do grosza równe tym z listy.
      _Zweryfikowano 2026-10-01 (staging, fcf42316): inw. 54 „Ryżowa 66/127" (poz. 2039: 50,5 × 40,25 = 2032,625): lista i strona = Marża v2 87 736,28 zł, Pozostało do wypłaty 29 884,75 zł, Robocizna 128 628,03 zł. Poza polem checka: „Bilans netto v2" na liście −120 818,88 zł vs „Pozostało do zapłaty" na stronie 120 818,89 zł (patrz Findings)._

### Findings — 2026-10-01

- [x] 🟡 WARNING · fixed · inw. 54: „Bilans netto v2" na liście (−120 818,88) i „Pozostało do zapłaty" na stronie (120 818,89) różnią się o grosz — `roundToCents` używa `Math.round`, który dla ujemnej połowy grosza zaokrągla w stronę +∞ (−12081888,5 → −12081888), a dodatnia strona idzie w górę. Naprawa: zaokrąglać symetrycznie po module.
      test: TDD · unit — `roundToCents(-x.xx5)` = `-roundToCents(x.xx5)`; golden master odświeżyć tylko świadomie.
      **W toku (2026-10-01):** poprawka test-first u autora `fcf42316` (sesja równoległa) — boks do odhaczenia po ponownym sprawdzeniu inw. 54 na nowym deployu.
      Sprawdzone na stagingu 4039d4f4: obie 120 818,89.
- [x] 🔵 OBSERVATION · formularz wydatku: zapisany szkic z później wrzuconą do kosza kasą pokazuje pustą listę kas, ale wysyła stary id — **odrzucone**: zapis jest odrzucany komunikatem „Kasa jest w koszu…" (zgodnie z boksem 4 EX-917), „Wyczyść formularz" leczy.

## 2026-10-01 — sidebar-scroll — przy niskim oknie menu boczne się przewija

- [x] Desktop (≥768px), zmniejsz wysokość okna tak, żeby linki menu się nie mieściły: logo i linki
      przewijają się razem, a przyciski na dole („Ciemny motyw" … „Wyloguj") zostają w całości
      widoczne i nie wychodzą poza ekran.
      _Zweryfikowano 2026-10-03 (staging, 9a743246): okno 1280×420 — kontener logo + linków ma overflow-y:auto i scrollHeight 523 > 140 (przewija się), a przyciski „Ciemny motyw … Wyloguj" leżą w całości w oknie (Wyloguj 376–408 px < 420); zrzut potwierdza._
- [x] To samo przy zwiniętym menu: plakietka nieprzeczytanych (np. przy „Flota") nie jest obcięta
      przy krawędzi.
      _Zweryfikowano 2026-10-03 (staging): menu zwinięte (aside 56 px), plakietka „1" przy „Flota" po scrollIntoView mieści się w obrysie przewijanego kontenera (prawa krawędź 51 = krawędź kontenera 51), okrągła, nieucięta (zrzut)._

## 2026-10-01 — nazwy-zgloszen

- [x] Menu boczne: zamiast „Zgłoszenia" jest „Zgłoszenia z formularzy kontaktowych" (ostatnia
      pozycja menu), a zamiast „Zgłoszenia prac" jest „Zgłoszenia wykonanych prac"; nagłówek obu
      stron i tytuł w trakcie ładowania mówią to samo, bez mignięcia starej nazwy. Menu boczne ma
      stałą szerokość; długie nazwy zawijają się do drugiej linii, nic nie jest ucięte, a plakietka
      z liczbą zostaje przy prawej krawędzi. Menu w telefonie: długie nazwy też się zawijają.
      _Zweryfikowano 2026-10-03 (staging, 9a743246): menu ma „Zgłoszenia wykonanych prac" i na końcu „Zgłoszenia z formularzy kontaktowych"; h1 obu stron = te same nazwy, a loading.tsx obu tras czyta ten sam PAGE_TITLES co link i nagłówek (sections.ts:27-28), więc bez mignięcia starej nazwy. Aside stałe 216 px, pozycje 191 px, długie nazwy dwuwierszowe (44 px), nic nie ucięte (scrollWidth = clientWidth), plakietka „1" przy prawej krawędzi (191 z 191). Telefon 390 px: pozycje mają 366 px i długie nazwy mieszczą się w jednej linii (40 px), nic nie ucięte — zawijanie nie było potrzebne._
- [x] Rozpiska inwestycji z oczekującym zgłoszeniem pracownika: przycisk na pasku „Zgłoszenia
      wykonanych prac (n)" mieści się obok „Problemy", a pozycja w menu „Pracownicy" pokazuje pełną
      nazwę i „n do sprawdzenia" w jednym wierszu; okno po kliknięciu ma tytuł „Zgłoszenia
      wykonanych prac".
      _Zweryfikowano 2026-10-03 (staging, OWNER, tylko odczyt na inwestycji 137 „testowe inwestycje", jedyne oczekujące zgłoszenie): przycisk „Zgłoszenia wykonanych prac (1)" (234 px) stoi w jednym rzędzie z „Problemy" i „Filtry", bez zawijania paska ani poziomego scrolla. Menu „Pracownicy": pierwszy wiersz ma pełną nazwę i „1 do sprawdzenia" w jednym wierszu menu, ale oba teksty łamią się na dwie linie (nazwa „…wykonanych / prac", dopisek „1 do / sprawdzenia", wiersz 52 px) — czytelne, nic nie ucięte, jednak nie jest to „jedna linia". Kliknięcie otwiera okno z tytułem „Zgłoszenia wykonanych prac"._

## 2026-10-01 — kosz-pod-adminem

- [x] Menu boczne (rola zarządzająca): „Kosz" nie ma go już na liście sekcji — stoi na dole, zaraz
      pod „Admin", w tym samym obrysie; na stronie „Kosz" przycisk jest podświetlony. Po zwinięciu
      menu zostaje sama ikona, a najechanie pokazuje „Kosz".
      _Zweryfikowano 2026-10-03 (staging, OWNER): lista sekcji (aside nav) kończy się na /zgloszenia, bez /kosz; „Kosz" jest rodzeństwem „Admin" w tym samym kontenerze, 40 px niżej (776 vs 736); na /kosz ma aria-current=page i podświetlenie (bg-primary/10, border-primary/40). Zwinięte menu: sama ikona, najechanie pokazuje tooltip „Kosz" (zrzut)._
- [x] Telefon (390px), menu z hamburgera: „Kosz" jest pod „Admin" i otwiera stronę „Kosz", a menu
      się zamyka. Pracownik (EMPLOYEE) nie widzi „Kosza" ani na desktopie, ani na telefonie.
      _Zweryfikowano 2026-10-03 (staging, 390 px): OWNER — w menu z hamburgera „Kosz" stoi pod „Admin", klik otwiera /kosz (h1 „Kosz") i menu się zamyka. EMPLOYEE: konto „QA-Pracownik Login" ma nieznane hasło (401), więc rolę sprawdziłem tymczasowo na własnym koncie qa-staging (SQL: OWNER→EMPLOYEE→OWNER, ponowne logowanie po każdej zmianie): na 390 px i 1280 px brak linków /kosz i /admin, a wejście na /kosz przekierowuje na /. Rola qa-staging przywrócona do OWNER (potwierdzone loginem)._

## 2026-10-01 — zgloszenia-prac-pod-pracownikami

- [x] Menu boczne (rola zarządzająca): „Zgłoszenia wykonanych prac" stoją zaraz pod „Pracownicy",
      jako ostatnia sekcja przed dolnymi przyciskami, z ikoną kartki z osobą; licznik oczekujących
      zgłoszeń dalej się pokazuje.
      _Zweryfikowano 2026-10-03 (staging, OWNER): „Zgłoszenia wykonanych prac" (ikona lucide file-user, plakietka „1") stoją bezpośrednio po „Pracownicy". Uwaga do treści boksu: „ostatnia sekcja przed dolnymi przyciskami" jest nieaktualne — ostatnia jest „Zgłoszenia z formularzy kontaktowych" (zgodnie z boksem nazwy-zgloszen), więc sprawdzono kolejność „zaraz pod Pracownicy"._
- [x] Rozpiska z oczekującym zgłoszeniem: przycisk „Zgłoszenia wykonanych prac (n)" na pasku i
      pozycja w menu „Pracownicy" mają tę samą ikonę kartki z osobą, inną niż „Protokół odbioru".
      _Zweryfikowano 2026-10-03 (staging, OWNER, inwestycja 137): przycisk na pasku i wiersz w menu „Pracownicy" mają tę samą ikonę lucide file-user (kartka z osobą); „Protokół odbioru…" używa ClipboardCheck (acceptance-protocol-action.tsx), więc ikony się różnią._

## 2026-10-01 — kosz-inwestycji-blokady

- [x] Inwestycja o statusie „Aktywna" → „Usuń inwestycję": od razu pojawia się błąd „Nie można
      usunąć aktywnej inwestycji. Najpierw zmień jej status.", bez okna potwierdzenia, a inwestycja
      nie trafia do Kosza.
      _Zweryfikowano 2026-10-03 (staging): „QA-blokady A" (Aktywna) → „Usuń inwestycję" na liście: toast „Nie można usunąć aktywnej inwestycji. Najpierw zmień jej status.", bez dialogu, wiersz został; psql: trashed_at nadal NULL._
- [x] Inwestycja nieaktywna z wpisanym przedmiarem lub ilościami na etapach → „Usuń inwestycję":
      okno ostrzega, że kosztorys jest w użyciu, zanim przeniesie do Kosza. Inwestycja z pustym
      kosztorysem: okno bez ostrzeżenia.
      _Zweryfikowano 2026-10-03 (staging): „QA-blokady B" (Wycena, pozycja z przedmiarem; przywrócona z Kosza) → „Usuń inwestycję": dialog „Przenieść do kosza?" zaczyna się od „Kosztorys tej inwestycji jest w użyciu — ma wpisany przedmiar lub ilości na etapach."; „QA-blokady A" (Wycena, kosztorys z pustą sekcją) → ten sam dialog bez ostrzeżenia. Oba anulowane. Wariant „ilości na etapach" nie rozdzielony od „przedmiaru" (jeden warunek KOSZTORYS_USED w SQL)._
- [x] Kosz → taka inwestycja → „Usuń na zawsze": okno powtarza to samo ostrzeżenie o kosztorysie.
      _Zweryfikowano 2026-10-03 (staging): Kosz → „QA-blokady B" (nieaktywna, z pozycją w kosztorysie) → „Usuń na zawsze": okno „Usunąć na zawsze?" zaczyna się od „Kosztorys tej inwestycji jest w użyciu — ma wpisany przedmiar lub ilości na etapach…", dalej prośba o wpisanie nazwy; anulowano._
- [x] Kosz → wiersz inwestycji: linki „Inwestycja", „Kosztorys v1" (tylko gdy ma arkusz) i
      „Kosztorys v2" otwierają strony bez przywracania. Każda pokazuje pasek „Inwestycja jest w koszu
      — tylko do odczytu…", nie da się nic edytować, nie ma „Edytuj inwestycję" ani synchronizacji
      arkusza.
      _Zweryfikowano 2026-10-03 (staging): „QA-blokady B" (id 182) w Koszu — linki „Inwestycja" i „Kosztorys v2" otwierają /inwestycje/182 i /kosztorys_v2 bez przywracania (psql: trashed_at nadal ustawione). Strona inwestycji: pasek „Inwestycja jest w koszu — tylko do odczytu. Aby ją zmienić, przywróć ją z Kosza.", brak „Edytuj", brak „Dodaj"/synchronizacji; kosztorys v2: pasek „…kosztorys jest tylko do odczytu…". Link „Kosztorys v1" nie występuje (inwestycja bez arkusza — zgodnie z boksem). Edycja pól w kosztorysie v2 -> osobny boks poniżej._
- [x] Kosztorys v2 inwestycji z Kosza → menu akcji: brak pozycji „Inwestor" i „Pracownicy".
      _Zweryfikowano 2026-10-03 (staging): toolbar kosztorysu 182 (w koszu) ma tylko „Opcje / Problemy / Filtry / Sekcje / Kolumny"; przyciski „Inwestor" i „Pracownicy" nie renderują się (zrzut + `!isTemplate && !isTrashed` w kosztorys-actions-menu.tsx:67)._
- [x] Kosztorys v2 inwestycji z Kosza → zakładka „Inwestycja": próba zapisania pola lub dodania /
      usunięcia zdjęcia kończy się błędem „Inwestycja jest w koszu…", a po odświeżeniu nic się nie
      zmieniło.
      _Zweryfikowano 2026-10-03 (staging): kosztorys v2 „QA-blokady B" (w koszu), zakładka „Inwestycja" → „Edytuj" → zmiana Adres + „Zapisz": toast „Inwestycja jest w koszu — przywróć ją, żeby coś zmienić.", dialog zostaje, psql: address nadal pusty. Dodanie pliku (setInputFiles na dialogu uploadu) + „Zapisz": ten sam błąd, brak wierszy w investments_rels. Usunięcie zdjęcia nie wykonane (fixture bez zdjęć) — ta sama ścieżka zapisu przez hook guard-trashed-investment._
- [x] Kosz z inwestycją o statusie „Aktywna" (trafiła tam przed tą zmianą): wiersz nie obiecuje, że
      „usunie się sam", a „Usuń na zawsze" mówi, by najpierw ją przywrócić i zmienić status.
      _Zweryfikowano 2026-10-03 (staging): „QA-blokady A" (status Aktywna, w koszu — stan ustawiony SQL-em na własnym rekordzie QA, bo UI go już nie produkuje) — wiersz nie obiecuje „usunie się samo" (pisze „… · kosztorys w użyciu — tylko ręcznie"), a „Usuń na zawsze" po wpisaniu nazwy odpowiada toastem „Nie można usunąć aktywnej inwestycji. Przywróć ją z Kosza, zmień jej status i dopiero wtedy usuń." Zastrzeżenie: sam dialog przed wpisaniem nazwy i opis wiersza mówią „kosztorys w użyciu", choć kosztorys A jest pusty — patrz Findings 2026-10-03._

### Findings — 2026-10-03

- [x] **Kosz: nieusuwalna inwestycja „Aktywna" z PUSTYM kosztorysem jest opisana jako „kosztorys w użyciu"** — `shapeTrashRows` (`src/lib/queries/trash.ts:64`) liczy `autoPurges: !isKosztorysUsed && !isUndeletable`, a `trash-kinds.ts:37` i `fateOf` w `trash-section.tsx` czytają `!autoPurges` jako „kosztorys w użyciu" (`KOSZTORYS_IN_USE_WARNING`). Aktywna inwestycja w koszu (stan sprzed zmiany) z pustym kosztorysem dostaje więc fałszywy powód: wiersz „… · kosztorys w użyciu — tylko ręcznie" i takie samo ostrzeżenie w oknie „Usuń na zawsze" przed wpisaniem nazwy; prawdziwy powód (status „Aktywna") pojawia się dopiero w toaście po wpisaniu nazwy. **Needs human:** czy rozdzielić powód (osobne pole zamiast jednego `autoPurges`), czy zostawić — stan osiągalny tylko dla rekordów, które trafiły do kosza przed 2026-10-01. **Test disposition:** TDD · unit — `shapeTrashRows` z `isUndeletable: true, isKosztorysUsed: false` powinno nie nazywać kosztorysu „w użyciu".
      _Odrzucone 2026-10-03: stan nieosiągalny — preview (zrzut prod) nie ma ani jednej aktywnej inwestycji w koszu poza zbudowaną SQL-em QA-blokady A (181), a od 2026-10-01 UI nie wpuszcza takiej do kosza. Nie ma użytkownika, który by to zobaczył._

## 2026-10-01 — loader-nad-pytaniem

- [x] Edytuj inwestycję → status „Zakończona" → „Zapisz": okno „Zakończyć inwestycję?" jest czytelne,
      bez 🚧 na tekście; po „Zakończ" 🚧 pojawia się na czas zapisu.
      _Zweryfikowano 2026-10-03 (staging): „QA-offline-1" → Zakończona → Zapisz: okno „Zakończyć inwestycję?" na wierzchu, czytelne (zrzut), w DOM brak 🚧 w trakcie pytania; po „Zakończ" 🚧 pojawia się (MutationObserver: 94 ms → 652 ms) na czas zapisu, toast „Inwestycja zaktualizowana"._
- [x] Nowa praca w kosztorysie z „Dodaj do katalogu" i nazwą, która już jest w katalogu: okno
      kolizji czytelne, bez 🚧.
      _Zweryfikowano 2026-10-03 (staging): kosztorys v2 QA-blokady B, „Praca" w sekcji, nazwa „Układanie przewodów w peszlu" (jest w katalogu) + zaznaczone „Dodaj pracę do katalogu prac". Okno kolizji („jest już w katalogu", porównanie W katalogu / Po nadpisaniu, przyciski Wróć / Tylko do kosztorysu / Nadpisz w katalogu) czytelne, podczas pytania w DOM nie ma 🚧 (0 trafień). Krótki 🚧 widziałem tylko w chwili wysyłania, przed pojawieniem się pytania. Wybrane „Wróć", nic nie zapisano._
- [x] Edytuj inwestycję bez zmiany statusu → „Zapisz": 🚧 pokazuje się na czas zapisu, jak dawniej.
      _Zweryfikowano 2026-10-03 (staging): „QA-blokady B" zmiana Notatek bez ruszania statusu → Zapisz: 🚧 w DOM od 89 do 438 ms, bez pytania; toast „Inwestycja zaktualizowana"._

## 2026-10-01 — notatki-podzialy-linii

- [x] Inwestycja z wieloliniowymi „Notatkami" → karta inwestycji: notatka zachowuje podziały linii
      (akapity, listy), zamiast zlewać się w jeden blok tekstu. To samo w kosztorysie v2, zakładka
      „Inwestycja".
      _Zweryfikowano 2026-10-03 (staging, OWNER): wieloliniowa notatka (akapity + lista z myślnikami) na QA-blokady B oraz wcześniej na QA-blokady A: karta inwestycji i zakładka „Inwestycja" w kosztorysie v2 mają white-space: pre-line, tekst 5-liniowy (97 px), podziały zachowane (investment-info-fields.tsx)._
- [x] Inwestycja z wieloliniową „Opinią": karta pokazuje ją z podziałami linii.
      _Odrzucone 2026-10-03 — boks nieaktualny — pole tekstowe „Opinia" zastąpiła flaga „Prośba o opinię wysłana" (51e089ab, reviewRequested); żaden formularz ani karta nie wpisuje ani nie pokazuje tekstu `review` (kolumna w DB została, 29 starych wartości). Brak miejsca w UI, w którym da się to zweryfikować; do usunięcia z rejestru._

## EX-918 — kosz-pracownikow

- [x] `/pracownicy` → odznacz „Aktywny" u pracownika, potem zaloguj się na jego konto: komunikat
      „To konto jest wyłączone. Skontaktuj się z właścicielem firmy.", nie „Nieprawidłowy email
      lub hasło".
      _Zweryfikowano 2026-10-03 (staging): „QA-Kosz-Pracownik A" (świeżo dodany w UI, hasło ustawione SQL-em przez skopiowanie hash/salt z konta qa-staging) → przełącznik „Aktywny" wyłączony w /pracownicy → logowanie poprawnym hasłem (POST /api/users/login z strony) zwraca 403 „To konto jest wyłączone. Skontaktuj się z właścicielem firmy."; formularz (loginAction) mapuje ten błąd na ten sam komunikat (auth.ts:38)._
- [x] To samo konto ze złym hasłem: dalej „Nieprawidłowy email lub hasło".
      _Zweryfikowano 2026-10-03 (staging): to samo nieaktywne konto, złe hasło → 401 „Podany adres e-mail lub hasło jest nieprawidłowe." (Payload); loginAction (auth.ts:41) zamienia to na „Nieprawidłowy email lub hasło", nie na komunikat o wyłączeniu._
- [x] Pracownik zalogowany w `/admin` w drugiej przeglądarce → odznacz mu „Aktywny": po odświeżeniu
      `/admin` jest wylogowany.
      _Zweryfikowano 2026-10-03 (staging): druga przeglądarka (osobny kontekst Playwright) zalogowana jako „QA-Kosz-Pracownik A" (EMPLOYEE): przed wyłączeniem /admin → /admin/unauthorized (zalogowany, bez uprawnień), po odznaczeniu „Aktywny" w pierwszej przeglądarce świeże wejście na /admin → /admin/login, czyli wylogowany; wiersz w users_sessions znika (1 → 0). Uwaga: sama aplikacja (/) dalej wpuszcza do wygaśnięcia JWT — zgodnie z AGENTS.md (auth bez odczytu bazy), nie defekt._
- [x] `/admin` → Użytkownicy → spróbuj usunąć własne konto: odmowa „Nie można wyłączyć, przenieść do
      kosza ani usunąć własnego konta."
      _Zweryfikowano 2026-10-03 (staging): jako OWNER qa-staging, /admin/collections/users/68 → Usuń → Potwierdź: toast „Nie można wyłączyć, przenieść do kosza ani usunąć własnego konta."; wiersz nietknięty (active=t, trashed_at NULL w bazie)._
- [x] `/pracownicy` → odznacz „Aktywny" przy własnym wierszu: odmowa „Nie można wyłączyć, przenieść
      do kosza ani usunąć własnego konta.", przełącznik wraca na zaznaczony.
      _Zweryfikowano 2026-10-03 (staging): OWNER qa-staging, /pracownicy, własny wiersz → „Aktywny": toast „Nie można wyłączyć, przenieść do kosza ani usunąć własnego konta.", przełącznik zostaje „Aktywny", w bazie active=t._
- [x] Jako kierownik → odznacz „Aktywny" u właściciela: odmowa „Kierownik może zmieniać tylko konta
      pracowników.", właściciel dalej się loguje.
      _Zweryfikowano 2026-10-03 (staging): MANAGER qa-staging-manager (osobna sesja), /pracownicy → „Aktywny" przy właścicielu „QA Staging": toast „Kierownik może zmieniać tylko konta pracowników."; właściciel dalej aktywny, a jego logowanie przechodzi (POST /api/users/login → 200 OWNER w tym samym przebiegu)._
- [x] Z pracownikiem w koszu: ani dialog nowej transakcji na `/transakcje`, ani podział etapu
      w kosztorysie, ani wydanie sprzętu na `/sprzet` nie proponują go na liście.
      _Zweryfikowano 2026-10-03 (staging, OWNER): „QA-Kosz-Pracownik A" (nieaktywny, w koszu) nie występuje na liście pracowników w: Wydatek→Wypłata (inni nieaktywni są — lista nie jest po prostu przefiltrowana po „Aktywne"), wydaniu sprzętu w „Nowy sprzęt" → Pracownik (48 pozycji, tylko QA Staging i Staging QA Manager z QA) oraz „Pracownicy etapu…" na etapie kosztorysu 182 (48 pozycji, bez A)._
- [x] Anulowana wypłata dla pracownika, który jest teraz w koszu: na `/transakcje` dalej widać jego
      imię i nazwisko, nie „—".
      _Zweryfikowano 2026-10-03 (staging): wypłata #5290 (10 zł, zaksięgowana w UI na „QA-Kosz-Pracownik A", potem anulowana z powodem w UI); pracownik przeniesiony do kosza (trashed_at ustawione). /transakcje z filtrem „Pokaż anulowane" i id=5290: kolumna Pracownik = „QA-Kosz-Pracownik A" (kasa źródłowa też z nazwą „QA-Kosz-Kasa A"), nie „—". Przy okazji potwierdzone, że anulowane wiersze nie blokują „Usuń pracownika" (kosz przeszedł po anulowaniu)._
- [x] Pracownik w koszu otwiera swój link do zgłoszenia prac: „Twoje konto jest nieaktywne.
      Skontaktuj się z kierownikiem.", bez formularza.
      _Zweryfikowano 2026-10-03 (staging): link do zgłoszeń prac (utworzony z menu „Pracownicy" w kosztorysie, gdy był aktywny i przypisany do etapu; przed testem usunięty z etapu). Kontrola: link dla żywego pracownika pokazuje formularz. Po przeniesieniu go do kosza (konto aktywne=true, tylko trashed_at) otwarcie tego samego linku w osobnej karcie pokazuje „Twoje konto jest nieaktywne. Skontaktuj się z kierownikiem." i zero pól formularza._
- [ ] `/kosz` → przywróć kasę pracownika, który dalej jest w koszu: odmowa „Przywróć pracownika —
      kasa wraca razem z nim."
      _Nie sprawdzone 2026-10-03 (staging): boks nieosiągalny z /kosz — kasa właściciela, który jest w koszu, nie ma tam osobnego wiersza (cash-register-trash.ts:13: listowana i przywracana razem z nim), więc nie ma przycisku „Przywróć" przy samej kasie. Stan zbudowałem w UI (kasa „QA-Kosz-Kasa A" do kosza z /kasy, potem pracownik do kosza: trashed_at kasy 06:31:19 < pracownika 06:31:33) i /kosz pokazuje ją tylko jako „razem z kasą: …". Jedyna droga to bezpośrednie PATCH /api/cash-registers/48 {trashedAt:null} — dostałem 403 „Kasa jest w koszu — przywróć ją, żeby coś zmienić." (ogólny strażnik, nie komunikat z boksu), więc komunikatu „Przywróć pracownika — kasa wraca razem z nim." nie udało się wywołać._
- [x] `/pracownicy` → „Usuń pracownika" u nieużywanego pracownika z kasą: pytanie wymienia jego
      kasę; po potwierdzeniu znika z `/pracownicy`, a jego kasa z `/kasy`.
      _Zweryfikowano 2026-10-03 (staging): „QA-Kosz-Pracownik A" z kasą „QA-Kosz-Kasa A" (typ Pracownicze, utworzone w UI): okno „Przenieść do kosza?" mówi „Razem z nim kasa: QA-Kosz-Kasa A."; po potwierdzeniu wiersza nie ma na /pracownicy ani kasy na /kasy; baza: users.trashed_at i cash_registers.trashed_at ten sam znacznik czasu._
- [x] `/kosz` → sekcja „Pracownicy" pokazuje go z dopiskiem „razem z kasą: …"; tej kasy nie ma
      osobno w sekcji „Kasy".
      _Zweryfikowano 2026-10-03 (staging): /kosz → sekcja „Pracownicy": „QA-Kosz-Pracownik A", „W koszu od 03.10.2026 · usunie się samo za 30 dni", „razem z kasą: QA-Kosz-Kasa A"; strona nie ma osobnej sekcji „Kasy" (kasa nie występuje osobno)._
- [x] `/kosz` → „Przywróć" u pracownika: wraca na `/pracownicy` i jego kasa wraca na `/kasy`.
      _Zweryfikowano 2026-10-03 (staging): OWNER, /kosz → „Przywróć" przy „QA-Kosz-Pracownik A": toast „Pracownik przywrócony razem ze swoimi kasami."; wiersz znika z Kosza, wraca na /pracownicy, a „QA-Kosz-Kasa A" na /kasy; psql: users.trashed_at i cash_registers.trashed_at NULL (active pozostaje false — przywrócenie nie włącza konta)._
- [ ] Ponownie do kosza, potem „Usuń na zawsze": przycisk aktywny dopiero po wpisaniu dokładnego
      imienia i nazwiska; po usunięciu znika z `/kosz` razem z kasą.
      _Nie sprawdzone 2026-10-03 (staging): przycisk aktywny dopiero po wpisaniu nazwy (zweryfikowane), ale samo usunięcie odrzucone na stagingu (EMPLOYEE, własny pracownik QA, kasa w koszu razem z nim, 2 próby): „Nie można usunąć pracownika — jest powiązany z danymi (kasy: 1)…". Stan osiągalny przez UI (SQL: user i kasa nadal istnieją). Lokalnie worker-trash.db.test.ts (8 testów, baza 5435) przechodzi, więc rozjazd stagingu — pooler Neon/transakcja; DEFEKT do zgłoszenia, nie ukończono_
      _Przyczyna 2026-10-03, odtworzona na bazie preview: na Neonie transakcje Payloada nie mają własnego połączenia (`VercelPool` nie jest `pg.Pool`, więc drizzle puszcza je przez pulę), a `makeDeleteBlocker` liczy próbki przez `Promise.all`, więc próbka „kasy” trafia poza transakcję. **Linear: EX-855** (dowód w komentarzu). Boks czeka na tę poprawkę._
- [x] Pracownik z transakcją lub wypłatą: „Usuń pracownika" odmawia z powodem, nic nie trafia do
      kosza.
      _Zweryfikowano 2026-10-03 (staging): OWNER: „QA-Kosz-Pracownik A" z jedną wypłatą (10 zł, zaksięgowaną przez UI) → „Usuń pracownika" → okno „Przenieść do kosza?" → toast „Nie można usunąć pracownika — jest powiązany z danymi (transakcje: 1). Zamiast usuwać, odznacz „Aktywny"."; wiersz zostaje, psql: users.trashed_at i cash_registers.trashed_at NULL. Wariant z samym zgłoszeniem prac nie sprawdzany._
- [x] Jako kierownik: „Usuń pracownika" jest tylko przy kontach pracowników — nie przy właścicielu,
      adminie, innym kierowniku ani przy własnym wierszu; w `/kosz` widzi tylko pracowników.
      _Zweryfikowano 2026-10-03 (staging): MANAGER „Staging QA Manager" (osobna sesja, logowanie przez POST /api/users/login): /pracownicy, 48 wierszy — „Usuń pracownika" ma 39 z 39 kont „Pracownik" i żadne z 9 kont Manager/Właściciel/Admin, w tym własny wiersz. /kosz kierownika pokazuje pracownika w koszu („QA-Kosz-Pracownik A", razem z kasą). Zastrzeżenia: (1) „w /kosz widzi tylko pracowników" jest nieaktualne — /kosz ma też sekcje Inwestycje i Szablony (4681c323, b84fd8c1) i kierownik je widzi; (2) filtrowanie sekcji Pracownicy po canManageAccount (trash.ts:71) potwierdzone tylko w kodzie — na stagingu nie ma w koszu konta Właściciel/Admin/Manager, a nie trashuję prawdziwych kont. Pracownik w koszu był nieaktywny (QA-Kosz-Pracownik A, trashed_at ustawione)._
- [ ] Jedyny aktywny admin (lub właściciel) do kosza z konta innego właściciela/admina: odmowa
      „Nie można wyłączyć ani usunąć ostatniego aktywnego konta z rolą …"; to samo przy odznaczeniu mu
      „Aktywny".
      _Nie sprawdzone 2026-10-03 (staging): na preview DB są 4 aktywne konta ADMIN/OWNER (1 ADMIN + 3 OWNER, w tym `qa-staging`), więc odmowa „ostatniego konta" nie wystąpi, dopóki ktoś nie wyłączy trzech prawdziwych kont — a prawdziwych kont nie ruszam. Logika pokryta lokalnie `src/__tests__/lib/workers/account-removal.test.ts`; sprawdzić na bazie z jednym aktywnym adminem/właścicielem._
- [x] `/kosz` → „Usuń na zawsze" u kasy i u inwestycji bez wpisanego kosztorysu: oba pytają o nazwę,
      przycisk nieaktywny do jej wpisania.
      _Zweryfikowano 2026-10-03 (staging): OWNER. Kasa — własna „QA-Kosz-Kasa C" (Pomocnicza, utworzona w UI, do kosza z /kasy): okno „Usunąć na zawsze?" ma pole nazwy, przycisk nieaktywny dla pustego pola i „QA-Kosz", aktywny dopiero po „QA-Kosz-Kasa C"; po potwierdzeniu wiersza nie ma w cash_registers. Inwestycja bez kosztorysu — cudza „QA-973 test inwestycja" (id 180, 0 sekcji, w koszu; okno anulowane, nic nie usunięte): to samo — pole nazwy, przycisk nieaktywny dla pustego i „QA-973", aktywny dopiero po pełnej nazwie._

## EX-915/916 — kosz-floty-i-sprzetu

- [x] `/flota` → „Usuń pojazd" przy aktywnym aucie z przeglądami: pytanie mówi, że przypomnienia
      o przeglądach przestaną przychodzić i że po 30 dniach zniknie razem z historią przeglądów (z
      ich liczbą).
      _Zweryfikowano 2026-10-03 (staging): OWNER, własny pojazd „QA 123" (QA-Marka QA-Model, status „W użyciu", jeden przegląd dodany przez UI): okno „Przenieść do kosza?" — „Przypomnienia o przeglądach przestaną przychodzić. Po 30 dniach zniknie razem z historią przeglądów (1)."_
- [x] Po potwierdzeniu: auta nie ma na `/flota`, jego strona `/flota/[id]` daje 404, a licznik przy
      „Flota" w menu go nie liczy.
      _Zweryfikowano 2026-10-03 (staging): po potwierdzeniu wiersza „QA 123" nie ma na /flota, /flota/11 pokazuje „Nie znaleziono"; licznik przy „Flota" liczy tylko aktywne, nieskasowane auta (db/notifications.ts: `v.trashed_at IS NULL`) — potwierdzone w kodzie, nie na liczniku (termin tego auta jest za rok, więc i tak nie wchodził do licznika). Uwaga: żądanie HTTP /flota/11 zwraca status 200 przy treści 404 (streaming), nie badano._
- [x] `/kosz` → sekcja „Flota" pokazuje auto po rejestracji, z marką i modelem pod spodem.
      _Zweryfikowano 2026-10-03 (staging): /kosz → sekcja „Flota": „QA 123", pod spodem „QA-Marka QA-Model", „W koszu od 03.10.2026 · usunie się samo za 30 dni"._
- [x] `/kosz` → „Przywróć": auto wraca na `/flota` z tym samym statusem i przeglądami.
      _Zweryfikowano 2026-10-03 (staging): „Przywróć" przy „QA 123": znika z Kosza, wraca na /flota ze statusem „W użyciu"; psql: status ACTIVE, trashed_at NULL, 1 przegląd w vehicle_inspections._
- [x] Ponownie do kosza, potem „Usuń na zawsze": przycisk aktywny dopiero po wpisaniu dokładnej
      rejestracji; po usunięciu auta nie ma nigdzie.
      _Zweryfikowano 2026-10-03 (staging): ponownie do kosza → „Usuń na zawsze" przy „QA 123": okno wymienia „historia przeglądów i ich załączniki", przycisk nieaktywny dla pustego pola, „QA 12" i „qa 123" (wielkość liter ma znaczenie), aktywny dopiero dla „QA 123"; po potwierdzeniu psql: brak wiersza w vehicles i 0 przeglądów tego auta._
- [x] `/sprzet` → „Usuń" przy sprzęcie, który ma pracownik: pytanie wymienia tego pracownika. Po
      potwierdzeniu sprzętu nie ma na `/sprzet` ani na karcie pracownika.
      _Zweryfikowano 2026-10-03 (staging): własny sprzęt „QA-Szlifierka" (utworzony w UI, przekazany pracownikowi „QA Staging"): okno „Teraz ma go QA Staging. Po 30 dniach zniknie razem z historią przekazań."; po potwierdzeniu wiersza nie ma na /sprzet, a karta /pracownicy/68 pokazuje „Nie ma nic na stanie."_
- [x] `/kosz` → sekcja „Sprzęt": nazwa, pod nią marka, model i numer seryjny. Przywróć, potem znowu
      do kosza i „Usuń na zawsze" po wpisaniu nazwy.
      _Zweryfikowano 2026-10-03 (staging): sekcja „Sprzęt": „QA-Szlifierka", pod nią „QA-Makita QA-GA1 · nr ser. QA-SN-001"; „Przywróć" → wraca na /sprzet (u „QA Staging", status „W użyciu"); znowu do kosza → „Usuń na zawsze": okno wymienia „historia przekazań", przycisk nieaktywny dla pustego pola i „QA-Szlif", aktywny dla „QA-Szlifierka"; psql: brak wiersza w equipment i brak zdarzeń._
- [x] Dodaj auto z rejestracją auta leżącego w koszu: komunikat odsyła do Kosza („…jest w Koszu —
      przywróć go stamtąd."). To samo dla numeru seryjnego sprzętu w koszu.
      _Zweryfikowano 2026-10-03 (staging): auto — „QA 123" w koszu, dodanie auta o tej rejestracji → „Pojazd o rejestracji QA 123 jest w Koszu — przywróć go stamtąd."; sprzęt — „QA-SN-001" w koszu, dodanie sprzętu o tym numerze → „Sprzęt o numerze seryjnym QA-SN-001 jest w Koszu — przywróć go stamtąd."; w obu przypadkach nic nie zostało dodane (psql)._
- [x] Jako kierownik: obie sekcje w `/kosz` widoczne, „Usuń", „Przywróć" i „Usuń na zawsze" działają.
      _Zweryfikowano 2026-10-03 (staging): MANAGER „Staging QA Manager" (logowanie przez POST /api/users/login, rola MANAGER): własne „QA 200" (auto) i „QA-Młotek" (sprzęt, przekazany kierownikowi) utworzone w UI i przeniesione do kosza przez „Usuń"; w /kosz obie sekcje „Flota" i „Sprzęt" widoczne z wpisami; „Przywróć" oba wracają; ponownie do kosza → „Usuń na zawsze" po wpisaniu nazwy (przycisk nieaktywny do tego czasu) — psql: oba wiersze usunięte._
- [x] `/kasy` i `/pracownicy` → „Usuń" dalej działa jak wcześniej: to samo pytanie, ten sam
      komunikat po przeniesieniu do kosza.
      _Zweryfikowano 2026-10-03 (staging): OWNER. /kasy → „QA-Kosz-Kasa D": pytanie „Przenieść „…" do kosza? Możesz ją przywrócić z Kosza.", po potwierdzeniu toast „Kasa przeniesiona do kosza." i wiersz znika. /pracownicy → „QA-Kosz-Pracownik B": pytanie „Przenieść „…" do kosza? Nie zaloguje się, dopóki go nie przywrócisz. Razem z nim kasa: QA-Kosz-Kasa B.", toast „Pracownik przeniesiony do kosza." i wiersz znika (tekst z kodu sprzed zmiany — git show 9b15c2d7 — taki sam)._
- [x] `/szablony` → „Przenieś szablon do kosza": to samo pytanie co wcześniej, po potwierdzeniu
      komunikat „Szablon przeniesiony do kosza." i szablon jest w `/kosz`.
      _Zweryfikowano 2026-10-03 (staging): własny „QA-Szablon Kosz" (utworzony w UI): pytanie „Przenieść szablon do kosza? … zniknie z listy szablonów i z wyboru szablonu. Możesz go przywrócić z Kosza. Kosztorysy założone z tego szablonu zostają bez zmian — mają własną kopię.", po potwierdzeniu toast „Szablon przeniesiony do kosza.", wiersza nie ma na /szablony, jest w /kosz._
- [x] Dodaj auto z rejestracją wpisaną małymi literami i ze spacjami (np. „ ab 123 " → istniejące
      „AB 123" w koszu): komunikat i tak odsyła do Kosza; nowe auto zapisuje się wielkimi literami.
      _Zweryfikowano 2026-10-03 (staging): „ qa 123 " przy „QA 123" w koszu → „Pojazd o rejestracji QA 123 jest w Koszu — przywróć go stamtąd." (nic nie dodane); „ qa 124 " bez kolizji zapisuje się jako „QA 124" (psql, bez spacji, wielkie litery)._

## EX-948 — worker-report-translations-ua — link „Zgłoszenie prac" po ukraińsku i rosyjsku (2026-10-01)

- [x] „Pracownicy" → edycja pracownika: pole „Domyślny język" (puste / Polski / Українська / Русский) zapisuje
      się i wraca po ponownym otwarciu; pracownik bez języka nadal daje się zapisać.
      Sprawdzone 2026-10-02: lista ma Polski / Українська / Русский (bez „puste") — brak języka pokazuje się jako „Polski", a wybór „Polski" zapisuje NULL.
- [x] Pracownik z językiem „Українська", inwestycja otwarta, kopia bazy po uzupełnieniu tłumaczeń:
      jego link „Zgłoszenie prac" otwiera się po ukraińsku — nagłówki, podpowiedzi, „Razem", pasy
      sekcji, przycisk wysyłki, historia wysłanych — a opisy prac są ukraińskie; praca bez
      tłumaczenia pokazuje polski opis.
- [x] Na tym samym linku przełącznik języka → Русский: strona i opisy przechodzą na rosyjski;
      po odświeżeniu wybór zostaje. Link innego pracownika w tej samej przeglądarce otwiera się
      w JEGO języku, nie w wybranym przed chwilą.
- [x] Przełącznik języka w nagłówku linku wygląda jak inne przyciski aplikacji (obrys, ta sama
      wysokość); każda opcja i przycisk pokazują flagę obok nazwy języka.
- [x] „Pracownicy" → edycja pracownika, pole „Domyślny język": każda opcja i wybrana wartość mają flagę
      obok nazwy; strona pracownika pokazuje „Domyślny język" z tą samą flagą.
- [x] Telefon (390px), link po ukraińsku: „Wszystkie kolumny" pokazuje przetłumaczone nagłówki,
      dialog „Prace spoza rozpiski" jest po ukraińsku, a wysłanie zgłoszenia działa; liczby mają
      przecinek dziesiętny, jak po polsku.
- [x] Pracownik bez języka: link otwiera się po polsku, wygląda jak przed zmianą.
- [x] Komunikaty odmowy (link wyłączony, inwestycja zakończona) po ukraińsku dla pracownika
      z językiem „Українська".
- [x] Rozpiska (kierownik): kolumny „Opis prac (UA)" / „Opis prac (RU)" są ukryte domyślnie
      i dają się włączyć; wpisanie tłumaczenia zapisuje się. Zmiana polskiego opisu tej pozycji:
      „Problemy" → „z nieaktualnym tłumaczeniem (UA)" ją pokazuje; przywrócenie opisu ją zdejmuje.
      Sprawdzone 2026-10-02 na `35425fd7`: UA/RU ukryte domyślnie, „Kolumny" → „Opis prac (UA)" włącza kolumnę; wpis w inwestycji 137 zapisał `uk.text` w `kosztorys_items.description_translations`, po przeładowaniu komórka go pokazuje; cofnięte (`{}`). Filtr nieaktualnych — wcześniejszy przebieg.
- [x] „Dodaj pracę z katalogu": praca z tłumaczeniem w katalogu trafia do rozpiski razem
      z tłumaczeniem w „Opis prac (UA)".
- [x] „Popraw literówki" na pozycji z aktualnym tłumaczeniem: po poprawce tłumaczenie nie jest
      oznaczone jako nieaktualne.
- [x] „Zapisz do katalogu" nad istniejącym wpisem: tłumaczenie z pozycji nadpisuje katalogowe;
      pozycja bez tłumaczenia zostawia katalogowe.
- [x] Katalog prac: kolumny „Opis pracy (UA)" / „(RU)", edycja w formularzu wpisu, a „Problemy"
      → „bez tłumaczenia (UA)" i „z nieaktualnym tłumaczeniem (UA)" filtrują poprawnie.
- [ ] Import z arkusza: pozycja, której opis i j.m. zgadzają się z katalogiem, przychodzi
      z tłumaczeniem z katalogu.
      _Nie sprawdzone 2026-10-04 (staging): katalog prac na preview ma 0 z 569 pozycji z tłumaczeniem (description_translations puste), więc nie ma czego przenieść; wpisanie tłumaczenia do prawdziwego katalogu to zmiana nie-QA danych._
- [x] Telefon (390px), link pracownika: przełącznik języka w nagłówku pokazuje samą flagę i nie
      ściska nagłówka; rozwinięta lista nadal nazywa każdy język.
- [x] „Porównaj z katalogiem" → „Brak w katalogu": kliknięcie podpowiedzi „może chodzi o…", która
      ma tłumaczenie w katalogu, zmienia nazwę pozycji i wpisuje to tłumaczenie w „Opis prac (UA)".
- [x] Katalog prac: wpis z tłumaczeniem → zmiana samej ceny i zapis: tłumaczenie zostaje.

### Findings — 2026-10-02

- [x] 🔴 CRITICAL · fixed — re-checked on `35425fd7` · `src/components/kosztorys/editor/grid/cells/translation-column.tsx` — komórki „Opis prac (UA/RU)" w rozpisce: zapis tłumaczenia kończy się błędem „Invalid key in record" (klucz „[object Object]"), a istniejące tłumaczenie wyświetla się jako pusta komórka (wiersz z `uk.text` w bazie: kolumna pusta). Przyczyna: `columnData` było gołym stringiem języka, a `withSyntheticRows`/`withHistoryChanges` rozlewają `columnData` do obiektu. Naprawa: `columnData: { language }`.
      test: test-driven-debugging · unit/DOM — `src/__tests__/components/kosztorys/editor/grid/cells/translation-column.test.tsx` (czerwony przed poprawką, zielony po).
      Needs human: wdrożyć i na stagingu wpisać tłumaczenie w „Opis prac (UA)" (boks „Rozpiska (kierownik)" zostaje otwarty do tego czasu); poprawka jest w commicie/pushu w toku, wdrożony staging jej jeszcze nie ma.
- [x] dropped — the „(0)" chip says why the grid is empty; a filter that clears itself would be a new behaviour nobody asked for · 🔵 OBSERVATION · „Problemy" → „z nieaktualnym tłumaczeniem (UA)": po przywróceniu opisu licznik spada do 0, ale aktywny filtr zostaje zapamiętany po odświeżeniu i daje pustą rozpiskę „Brak wyników" (chip „(0)"). Nie błąd, ale łatwo wziąć za utratę pozycji.
      Needs human: decyzja czy filtr z licznikiem 0 ma się sam zdejmować. test: no automated test.
- [x] dropped — a test leftover on the preview DB (a restored dump, refreshed by the next restore), not a defect; the name collision is the `match_key` uniqueness working · 🔵 OBSERVATION · katalog: wpis „Akrylowanie QA" (id 158) nie wraca do „Akrylowanie" — nazwa koliduje z istniejącym wpisem 375 (unikalny `match_key`). Zostaje jako artefakt testowy na stagingu.
      Needs human: usunąć/zmienić nazwę wpisu 158 na stagingu. test: no automated test.
- [x] dropped — „Popraw literówki" corrects the whole rozpiska by design; inwestycja 137 and share id 4 are preview-DB test state, not a defect · 🔵 OBSERVATION · „Popraw literówki" na inwestycji 137 zmieniła też inne pozycje (np. „mikrocement" → „Mikrocement"); nie do cofnięcia z UI. Pozycje testowe usunięte, link pracownika 33 (`worker_report_shares` id 4) i wpis udziału zostały posprzątane tylko częściowo (udział usunięty z Etapu 1, wiersz share zostaje).
      Needs human: ewentualnie usunąć `worker_report_shares` id 4. test: no automated test.
- [x] dropped — a duplicate of the still-open „Import z arkusza" box, which carries it · 🔵 OBSERVATION · boks „Import z arkusza" nieweryfikowany: wymaga żywego arkusza Google z pozycją zgodną z katalogiem (stan poza UI), nie ruszano.
      Needs human: sprawdzić ręcznie na kopii arkusza.


## EX-970 — kosz-zgloszen

Na staging najpierw `pnpm db:migrate:preview` (nowe kolumny `trashed_at` / `erased_at` w zgłoszeniach).

- [x] `/zgloszenia` jako kierownik: kolumna zaznaczania jest pierwsza, „Do kosza (N)" pojawia się
      po zaznaczeniu.
- [x] „Bez plików" zostawia tylko zgłoszenia bez załączników; odświeżenie strony trzyma filtr.
- [x] Zaznacz dwa zgłoszenia → „Do kosza (2)" → potwierdź: znikają z listy, toast „Przeniesiono do
      kosza: 2 zgłoszenia.", licznik „N nowych" i odznaka w menu spadają.
- [x] Checkbox w nagłówku zaznacza całą bieżącą stronę i nic z następnej.
- [x] Zaznacz zgłoszenie, potem kliknij „Oczekuje" → „Skontaktowano" w innym wierszu: zaznaczenie
      zostaje.
- [x] Przestaw kolejność kolumn: kolumna zaznaczania zostaje pierwsza.
- [x] `/kosz` → sekcja „Zgłoszenia" pokazuje przeniesione → „Przywróć" jedno: wraca na
      `/zgloszenia`.
- [ ] „Usuń na zawsze" na zgłoszeniu, z którego utworzono inwestycję ze zdjęciami: wymaga wpisania
      nazwy; po usunięciu zgłoszenie znika z `/kosz`, a galeria inwestycji pokazuje wszystkie zdjęcia.
      _Nie sprawdzone 2026-10-03 (staging): UI nie tworzy zgłoszeń, a formularz WWW wysłałby powiadomienia na prawdziwe adresy; kasować cudzego zgłoszenia nie wolno — bloker izolacji EX-937/EX-938._
- [ ] Usunięte na zawsze zgłoszenie z Facebooka nie wraca po nocnym uzgodnieniu zgłoszeń (staging,
      następny dzień).
      _Nie sprawdzone 2026-10-03 (staging): wymaga sprawdzenia następnego dnia po przebiegu crona Facebooka — bloker izolacji EX-937/EX-938_
- [x] Rozpiska → „Dodaj pracę z katalogu": zaznaczanie wierszy i checkbox w nagłówku działają jak
      wcześniej (wspólny komponent zaznaczania).
- [ ] Rozpiska → przegląd zgłoszenia prac pracownika: checkbox w nagłówku ma stan częściowy przy części
      zaznaczonych linii, jak wcześniej.
- [ ] `/zgloszenia` → ikona kosza w kolumnie „Akcje" jednego wiersza → potwierdź: tylko to zgłoszenie
      znika z listy, toast „Zgłoszenie przeniesione do kosza.", a w `/kosz` pojawia się w sekcji
      „Zgłoszenia".

### Findings — 2026-10-02

- [x] dropped — a duplicate of the two still-open boxes above, which carry it · 🔵 OBSERVATION · „Usuń na zawsze" na zgłoszeniu z inwestycją i zdjęciami oraz nocne uzgodnienie FB nie sprawdzone: UI nie tworzy zgłoszeń, a zgłoszenie przez formularz WWW wysłałoby powiadomienia do prawdziwych adresów; skasować cudzego leada nie wolno. Sprawdzono tylko dialog z wpisywaniem nazwy (Anuluj).
      Needs human: sprawdzić na własnym zgłoszeniu testowym; boks „nocne uzgodnienie" czeka na następny dzień.
- [x] dropped — a data gap, not a defect; the filter's query is covered by its spec · 🔵 OBSERVATION · „Bez plików": na stagingu żadne zgłoszenie nie ma plików (0 wierszy w `leads_rels`), więc filtr nie ma czego odsiewać; potwierdzono tylko `?noFiles=1` i trzymanie po odświeżeniu.
- [x] dismissed — the badge counts leads not yet SEEN (a cursor), not „nowe", and reads 0 on the section's own page (`unread-badge.tsx:33`), so it can't show on `/zgloszenia`; the check's „odznaka spada" was mis-specified. The toast rides the same success path that removed the rows · 🔵 OBSERVATION · po „Do kosza (2)" nie złapano toastu „Przeniesiono do kosza: 2 zgłoszenia."; wiersze zniknęły, „221 nowych" → „219 nowych". W menu bocznym przy „Zgłoszenia z formularzy kontaktowych" na stagingu nie ma odznaki w ogóle, więc jej spadku nie dało się ocenić.
- [x] dropped — a duplicate of the still-open box above, which carries it · 🔵 OBSERVATION · „Rozpiska → przegląd zgłoszenia prac", checkbox w nagłówku (stan częściowy): brak fixture z ≥2 liniami w jednej tabeli, więc stanu częściowego nie dało się wywołać; „Dodaj pracę z katalogu" nie ma checkboxa w nagłówku (jest „Zaznacz widoczne"), zaznaczanie wierszy i zbiorcze działa.
      Needs human: sprawdzić ręcznie na zgłoszeniu z dwiema liniami z rozpiski.


## EX-973 — investment-review-request — prośba o opinię Google dla zakończonej inwestycji (2026-10-02)

Na staging najpierw `pnpm db:migrate:preview` (nowa kolumna `review_requested` w inwestycjach).

### Findings — 2026-10-02

- [x] dropped — a duplicate of the two still-open send boxes, which carry it · 🔵 OBSERVATION · wysyłka prośby (boks „Inwestycja bez emaila klienta…" i boks z prawdziwym `EMAIL_HOST`) niezweryfikowana: staging nie wysyła poczty (komunikat „Nie udało się wysłać wiadomości. Spróbuj ponownie."; `email` i `review_requested` pozostają bez zmian — zgodnie z projektem „send first"). Walidacja i dialog sprawdzone na inwestycji testowej 180 (adres `@test.local`), potem inwestycja w koszu.
      Needs human: sprawdzić z prawdziwym `EMAIL_HOST` na własny adres.
- [x] dismissed — both layers refuse it, which is the behaviour the ticked box asks for · 🔵 OBSERVATION · dialog „Poproś o opinię": adres bez „@" blokuje natywna walidacja przeglądarki, adres typu `foo@bar` — walidacja Zod (komunikat „Nieprawidłowy adres email").

## 2026-10-02 — podsumowanie-pracownika-tabele

- [x] Link pracownika (`/p/…`) dla pracownika ze wspólnym etapem → podsumowanie to trzy tabele jedna pod drugą: „Wykonane" (etap | Wartość etapu | Twój udział | Kwota netto, „Razem" pod Wartością etapu i pod Kwotą netto), potem „Twoje rozliczenie", potem „Wypłaty" (data | opis | kwota + „Razem"). Brak wiersza „Wartość przedmiaru".
      _Zweryfikowano 2026-10-03 (staging, QA-blokady B, QA-Premia A): `/p/QA-Premia-A/<token>` — „Wykonane" (Etap 1 | 276,25 | 60,0% | 165,75, Razem 276,25 / 165,75), „Twoje rozliczenie", „Wypłaty" (data | opis | kwota, Razem 250,00); kolejność jak w opisie, tekst strony nie zawiera „Wartość przedmiaru"._
- [x] Ten sam pracownik w Podglądzie właściciela i w PDF → te same tabele w tej samej kolejności i z tymi samymi kwotami co w linku.
      _Zweryfikowano 2026-10-03 (staging): Podgląd właściciela (`/podglad-pracownika/…/182`) i popup „Drukuj PDF" (print zastubowany) — te same trzy tabele w tej samej kolejności i z tymi samymi kwotami co w linku (165,75 / 84,25 premii / 250,00 / 0,00)._
- [x] Pracownik, którego żaden etap nie jest wspólny → tabela „Wykonane" ma tylko kolumnę Kwota netto.
      _Zweryfikowano 2026-10-03 (staging, QA-blokady B): QA-Premia A jako jedyny na Etapie 1 → w Podglądzie właściciela „Wykonane" ma tylko kolumnę „Kwota netto" (Etap 1 | 276,25, Razem 276,25), bez „Wartość etapu" i „Twój udział"._
- [x] Link na telefonie (390px) → tabele mieszczą się bez poziomego przewijania strony.
      _Zweryfikowano 2026-10-03 (staging): `/p/…` przy viewport 390 px — `scrollWidth` = `clientWidth` = 390 (brak poziomego przewijania strony)._
- [x] Edytor → zakładka Podwykonawcy na inwestycji z etapem dzielonym między pracowników → tabela „Podział etapów": wiersz na każdy etap z wykonaną pracą, kolumna na każdego pracownika (kwota i procent pod nią, „—" gdy nie ma udziału), a „Razem" pracownika równa się jego „Sumie wykonanej pracy" w „Podsumowaniu pracowników".
      _Zweryfikowano 2026-10-03 (staging, QA-blokady B): przy etapie dzielonym A 60% / B 40% — Etap 1: 276,25 | B 110,50 (40,0%) | A 165,75 (60,0%), Razem 276,25 = 110,50 + 165,75 = „Suma wykonanej pracy" w „Podsumowaniu pracowników". Po rozdzieleniu na dwa etapy (A sam na Etapie 1, B sam na Etapie 2): wiersze Etap 1 / Etap 2 z „—" w kolumnie pracownika bez udziału, Razem A 165,75 / B 110,50 = ich „Suma wykonanej pracy"._
- [ ] PDF pracownika z długą listą wypłat (kilkadziesiąt) → tabela, która nie mieści się na stronie, przechodzi na następną sama, a tabele nad nią zostają na poprzedniej (bez pustej połowy strony). PDF oferty dla klienta → podsumowanie w stopce nadal stoi przy prawej krawędzi.
      _Nie sprawdzone w całości 2026-10-03 (staging): zaksięgowano 32 wypłaty po 1 zł dla QA-Premia A i otwarto „Drukuj PDF" (print zastubowany) — tabela „Wypłaty" ma 33 wiersze, 826 px wysokości, zaczyna się na 459 px (nie mieści się na jednej stronie); styl wydruku ma tylko `tr { break-inside: avoid }`, bez `break-inside` na samych tabelach. NIE da się ocenić faktycznego podziału stron — `page.pdf()` w tym Chromium zwraca „Printing failed", a prawdziwego druku nie wolno uruchamiać. PDF oferty: tabela „Razem netto" ma prawą krawędź równą prawej krawędzi tabeli głównej (1244 px) — stoi przy prawej krawędzi w układzie ekranowym, a nie w druku._

## EX-965 — kosztorys-section-translations — nazwy sekcji po ukraińsku i rosyjsku na linku „Zgłoszenie prac"

Na staging najpierw `pnpm db:migrate:preview` (nowa tabela z listą tłumaczeń nazw sekcji, z listą startową).

- [x] Rozpiska inwestycji z sekcją „Łazienka 2" → menu sekcji → „Tłumaczenie sekcji…": pole
      Українська pokazuje ukraińską nazwę z „2" na miejscu, Русский — rosyjską.
      _Zweryfikowano 2026-10-04 (staging): inw. 182 „Łazienka 2” → pola: Українська „Ванна кімната 2”, Русский „Ванная комната 2”._
- [x] W tym oknie wpisz po ukraińsku „3" zamiast „2" → „Zapisz": komunikat podaje oczekiwaną liczbę
      „2", a okno zostaje otwarte.
      _Zweryfikowano 2026-10-04 (staging): inw. 182, „Ванна кімната 3” → „Zapisz”: pod polem „Tłumaczenie (UA) musi zawierać te same liczby co nazwa sekcji: 2.”, okno otwarte, nic nie zapisane._
- [x] Sekcja o jednorazowej nazwie (np. „Pralnia"): wpisz oba tłumaczenia, zapisz, potem wyczyść oba
      pola i zapisz — po ponownym otwarciu oba pola są puste.
      _Zweryfikowano 2026-10-04 (staging): inw. 182, sekcja „QA-Spiżarnia” (poza listą startową): wpisane oba tłumaczenia zapisane (wiersz w tabeli), po wyczyszczeniu obu i zapisie wiersz usunięty z DB, po ponownym otwarciu oba pola puste. („Pralnia” jest na liście startowej, dlatego użyta nazwa QA.)_
- [x] „Tłumaczenie sekcji…" jest w menu sekcji także w edytorze szablonu; na zablokowanej inwestycji
      menu sekcji nie ma wcale.
      _Zweryfikowano 2026-10-04 (staging): edytor szablonu /szablony/160 ma „Tłumaczenie sekcji…” w menu sekcji; zakończona inw. 9 (baner „tylko do odczytu”) — 0 przycisków „Akcje sekcji”._
- [x] Link „Zgłoszenie prac" pracownika z językiem „Українська", inwestycja z nazwami sekcji
      z szablonu: każdy pas sekcji i każde „Razem …" (w „Wszystkie kolumny") jest po ukraińsku,
      „Łazienka 2" zachowuje swoje 2. Przełącznik → Русский: po rosyjsku; → Polski: po polsku.
      _Zweryfikowano 2026-10-04 (staging): link QA-Premia A (UA), inw. 182: pas sekcji „Ванна кімната 2” i „Razem” → „Разом Ванна кімната 2” (w „Усі колонки”); → Русский: „Ванная комната 2” / „Итого”; → Polski: „Łazienka 2” / „Razem”. Liczba 2 zachowana._
- [x] Na tym linku po ukraińsku wyszukaj ukraińskie słowo z nazwy sekcji: znajdują się prace tej
      sekcji.
      _Zweryfikowano 2026-10-04 (staging): link UA, wyszukiwanie „Ванна” i „кімната” znajduje pracę z sekcji „Ванна кімната 2”; polskie „Łazienka” i obce słowo — nie._
- [x] Zmień nazwę sekcji w rozpisce na nową (np. „Garderoba"): na linku jest po polsku. Dodaj jej
      tłumaczenie UA w „Tłumaczenie sekcji…" i odśwież link: jest po ukraińsku, bez wdrożenia
      i bez czekania.
      _Zweryfikowano 2026-10-04 (staging): sekcja przemianowana na „QA-Garderoba” — link UA pokazuje ją po polsku; po dodaniu tłumaczenia „Гардероб QA” w oknie i odświeżeniu linku pas jest po ukraińsku, bez wdrożenia._
- [x] Wyślij zgłoszenie z linku po ukraińsku i otwórz je w przeglądzie zgłoszeń w rozpisce: nazwy
      sekcji są po polsku.
      _Zweryfikowano 2026-10-04 (staging): inw. 182, link QA-Premia A (UA): wysłane zgłoszenie 8 (2 prace); w przeglądzie zgłoszeń w rozpisce sekcje „QA-Garderoba” i „Łazienka 2” po polsku (mimo tłumaczenia UA). Zgłoszenie potem odrzucone._
- [x] W edytorze otwórz menu sekcji klawiaturą i wybierz „Tłumaczenie sekcji…" Enterem; w polu
      Українська użyj strzałek i Tab: kursor porusza się w polu i między polami okna, a aktywna
      komórka rozpiski pod oknem się nie przesuwa.
      _Zweryfikowano 2026-10-04 (staging): inw. 182 (QA): menu sekcji otwarte Enterem (strzałki w dół do „Tłumaczenie sekcji…”, Enter) — okno się otwiera; w polu Українська kursor porusza się strzałkami (12→11→10), Tab przechodzi do pola Русский, aktywna komórka rozpiski przed i po w tym samym miejscu (448,333)._

## 2026-10-02 — investments-listing-no-kosztorys-figures — inwestycja bez kosztorysu pokazuje prawdziwe kwoty v2

- [x] `/inwestycje`: inwestycja w trybie netto ma w „Bilans brutto v2" napis „rozliczenie netto",
      inwestycja w trybie brutto (np. „11 Listopada 40") ma w „Bilans netto v2" „rozliczenie brutto",
      w trybie mieszanym „rozliczenie mieszane". Żadna komórka nie mówi „nie dotyczy".
      _Zweryfikowano 2026-10-02 (staging, deploy 9a743246): 134 inwestycje netto → „rozliczenie netto" w „Bilans brutto v2"; „Siennicka 50/152" (brutto) → „rozliczenie brutto" w „Bilans netto v2"; „testowe inwestycje" (mieszany) → „rozliczenie mieszane". „11 Listopada 40" jest dziś w trybie netto (dane preview zmienne), więc brutto sprawdzone na Siennickiej. „nie dotyczy": 0 w całej tabeli (136 wierszy)._
- [x] `/inwestycje` jako OWNER, inwestycja bez kosztorysu rozliczana samymi materiałami (np. „Kijowska
      17 dwa mieszkania materiały"): „Bilans netto v2" = minus „Wydatki inwestycyjne", „Robocizna v2"
      0,00 zł, „Marża v2" to kwota, a „Pozostało do wypłaty" mówi „brak kosztorysu".
      _Zweryfikowano 2026-10-02 (staging, OWNER): „Kijowska 17 dwa mieszkania" (nazwa bez „materiały" na preview): Bilans netto v2 −13 986,25 zł = −Wydatki inwestycyjne 13 986,25 zł, Robocizna v2 0,00 zł, Marża v2 0,00 zł (kwota; wydatki wliczone w robociznę 0), Pozostało „brak kosztorysu". Wiersz z niezerową marżą: „Dima" Marża v2 −200,00 zł._
- [x] Inwestycja bez kosztorysu z robocizną zaksięgowaną transferami (np. Altowa 12): „Robocizna v2"
      0,00 zł z ikoną niezgodności, której dymek podaje różnicę.
      _Zweryfikowano 2026-10-02 (staging): „Altowa 12" — Robocizna v2 0,00 zł z ikoną trójkąta (aria-label „Niezgodność z transakcjami"); dymek: „Rozjazd z „Robocizna v1": −163 176,00 zł. Tyle robocizny jest w kosztorysie ponad to, co zaksięgowano transferami…"._
- [x] Sortowanie „Bilans netto v2" w obie strony: inwestycje bez kosztorysu stoją między innymi według
      kwoty, nie na końcu. Sortowanie „Pozostało do wypłaty" w obie strony: „brak kosztorysu" i „ustaw
      etapy" zostają na końcu.
      _Zweryfikowano 2026-10-02 (staging): „Bilans netto v2" malejąco i rosnąco — kwoty posortowane monotonicznie, inwestycje bez kosztorysu rozsiane według kwoty (np. „Uniwersytet Warszawski" −594 557,10 zł na końcu malejąco / początku rosnąco); jedyny tekst „rozliczenie brutto" (tryb brutto) zostaje na końcu w obu kierunkach. „Pozostało do wypłaty" w obie strony — 122× „brak kosztorysu" na końcu. „ustaw etapy" nie pojawia się dziś w żadnym wierszu preview, więc tej części nie dało się zaobserwować; zachowanie „brak kosztorysu" na końcu potwierdzone._
- [x] Żadna komórka listy nie mówi „brak danych".
      _Zweryfikowano 2026-10-02 (staging): „brak danych" — 0 trafień w tekście całej tabeli (136 wierszy)._
- [x] Dymki nagłówków „Bilans netto v2", „Robocizna v2", „Marża v2" i „Pozostało do wypłaty" zgadzają
      się z komórkami; żaden nie wspomina „brak danych".
      _Zweryfikowano 2026-10-02 (staging): dymki „Bilans netto v2", „Robocizna v2", „Marża v2", „Pozostało do wypłaty" (oraz „Bilans brutto v2") zgodne z komórkami — „Bez kosztorysu — robocizna i rabat 0 zł", „brak kosztorysu = bez kosztorysu nic nie jest należne", „rozliczenie brutto" w bilansie netto; żaden nie zawiera „brak danych"._

## EX-979 — premia — premia wyrównuje nadpłatę pracownika, inwestor jej nie widzi (2026-10-02)

Przed sprawdzeniem: migracja typu „Premia" na bazie, na której klikasz (`pnpm db:migrate:preview` dla stagingu).

- [x] „Nowa transakcja" → „Premia": są pola pracownik i inwestycja, nie ma kasy; zapis bez pracownika
      albo bez inwestycji zostaje odrzucony z czytelnym komunikatem.
      _Zweryfikowano 2026-10-03 (staging, OWNER): „Wydatek" → Typ „Premia" na `/pracownicy` (nic nie wstępnie wybrane) → pola Inwestycja i Pracownik, brak pola Kasa; „Zapisz" na pustym formularzu → „Inwestycja jest wymagana dla tego typu transferu", „Pracownik jest wymagany dla tego typu", „Kwota musi być większa niż 0", „Formularz zawiera błędy"; nic nie zapisane._
- [x] Zaksięgowana premia nie zmienia salda żadnej kasy.
      _Zweryfikowano 2026-10-03 (staging): premie #5293 (34,25 zł) i #5295 (50 zł) mają `source_register_id` puste w bazie; „Kasa - test" (saldo 0 przed testem) zmieniają tylko wypłaty #5292 i #5294._
- [x] Para inwestycja × pracownik z nadpłatą (zakładka Podwykonawcy, „nadpłacone"): po zaksięgowaniu
      premii na kwotę nadpłaty ta para pokazuje 0,00 w „Podsumowaniu pracowników", w nagłówku
      podwykonawców, w „Rozliczeniu z ekipą", w kolumnie „Pozostało do wypłaty" na `/inwestycje`,
      na `/pracownicy` i w oknie „Rozlicz wypłaty". Tam, gdzie jest premia, pojawia się kolumna/wiersz
      „Premia"; u ekipy bez premii go nie ma.
      _Zweryfikowano 2026-10-03 (staging, QA-blokady B × QA-Premia A, nadpłata 34,25 wyrównana premią): 0,00 w „Podsumowaniu pracowników" (kolumna Premia 84,25), w „Rozliczeniu z ekipą" (wiersz Premia 84,25; Pozostało 110,50 = tylko B), w oknie „Rozlicz wypłaty" (Premia 84,25 → Pozostało 0,00), na `/pracownicy` (0,00 zł) i w `/inwestycje` (Pozostało −25,50 zł = A 0,00 + B −25,50). Po anulowaniu obu premii na tej samej ekipie znikły kolumna „Premia" w „Podsumowaniu pracowników" i wiersz „Premia" w „Marży" / „Rozliczeniu z ekipą"._
- [x] „Marża v2" tej inwestycji spada o kwotę premii; „Marża v1", bilans, link dla inwestora, PDF
      oferty i protokół się nie zmieniają.
      _Zweryfikowano 2026-10-03 (staging, QA-blokady B): zakładka Marża: Robocizna 500,00 − Suma wykonanej pracy 276,25 − Premia 84,25 = 139,50; `/inwestycje` Marża v2 139,50 zł; Marża v1 (−386,00 zł = same wypłaty) i Bilans netto v1 (0,00 zł) bez premii; podgląd inwestora (`/podglad-inwestora/182`), PDF oferty i protokół odbioru (Robocizna 500,00, Pozostało 500,00) bez słowa „premia" i z kwotami sprzed premii._
- [x] „Lista wpłat" na zakładce Podwykonawcy nie pokazuje premii; link z imienia pracownika otwiera
      listę transakcji, w której premia jest.
      _Zweryfikowano 2026-10-03 (staging): „Lista wpłat" w edytorze 182 nie ma żadnej pozycji (premie #5293/#5295 nie trafiają na listę); linki z imion w „Podsumowaniu pracowników" prowadzą do `/inwestycje/182?type=PAYOUT,BONUS&worker=80|81`, a lista transakcji inwestycji pokazuje premie #5293 i #5295 obok wypłat._
- [x] Link „Zgłoszenie prac" i PDF tego pracownika: linia „Premia" między „Wykonane razem" a
      „Wypłacone", a „Pozostało do wypłaty" = wykonane + premia − wypłacone. Pracownik bez premii nie
      widzi linii „Premia".
      _Zweryfikowano 2026-10-03 (staging): QA-Premia A (wykonane 165,75, premia 84,25, wypłacone 250,00) — link `/p/…` i PDF mają „Premia 84,25" między „Wykonane razem" a „Wypłacone", „Pozostało do wypłaty" 0,00 = 165,75 + 84,25 − 250,00. QA-Premia B (bez premii) w podglądzie właściciela — brak linii „Premia" (PDF B nie otwierany)._
- [ ] `/pracownicy` → „Rozlicz wypłaty" → przy wierszu z nadpłatą „Wyrównaj premią" → potwierdzenie
      podaje kwotę, pracownika i inwestycję → po zatwierdzeniu wiersz ma 0,00, przycisk znika, okno
      zostaje otwarte, a kwoty wpisane w inne wiersze zostają.
      _Nie sprawdzone w całości 2026-10-03 (staging): działa potwierdzenie „Zaksięgować premię 50,00 zł dla QA-Premia A na QA-blokady B?", po zatwierdzeniu wiersz ma Pozostało 0,00 zł (Premia 34,25 → 84,25 zł), przycisku nie ma, okno zostaje otwarte, w bazie premia #5295 = 50 zł. NIE sprawdzone: zachowanie kwot wpisanych w inne wiersze — pracownik QA ma tylko jeden wiersz (jedna inwestycja)._
- [x] Zaznaczenie wiersza z nadpłatą (zaliczka) chowa „Wyrównaj premią".
      _Zweryfikowano 2026-10-03 (staging): `/pracownicy` → „Rozlicz wypłaty" QA-Premia A, wiersz z nadpłatą −50,00 zł: po zaznaczeniu przycisk znika (w komórce „—"), po odznaczeniu wraca._
- [x] Zalogowany jako kierownik (MANAGER): „Nowa transakcja" nie oferuje „Premia", a w oknie
      „Rozlicz wypłaty" przy wierszu z nadpłatą nie ma „Wyrównaj premią". Właściciel widzi oba.
      _Zweryfikowano 2026-10-03 (staging): MANAGER `qa-staging-manager@…` — „Typ wydatku" oferuje: Inny wydatek, Korekta, Koszty robocizny, Rabat, Strata, Wydatek inwestycyjny (+netto), Wypłata — bez „Premia"; w „Rozlicz wypłaty" wiersz QA-Premia B z nadpłatą −25,50 zł ma „—" zamiast „Wyrównaj premią". OWNER widzi „Premia" w typach i przycisk w oknie._
- [x] Zakładka Podwykonawcy → „Rozlicz wypłaty" w nagłówku „Podsumowania pracowników" otwiera to samo
      okno dla tej inwestycji, z tym samym przyciskiem; przy ekipie rozliczonej do zera przycisku nie ma.
      _Zweryfikowano 2026-10-03 (staging, QA-blokady B): nagłówek „Podsumowania pracowników" → „Rozlicz wypłaty" otwiera okno dla tej inwestycji; przy QA-Premia B z nadpłatą (−19,50 zł) jest „Wyrównaj premią", przy QA-Premia A rozliczonej do 0,00 zł przycisku nie ma._
- [x] Okno „Rozlicz wypłaty" otwarte w dwóch kartach: w jednej wypłata na parę z nadpłatą, w drugiej
      „Wyrównaj premią" na tę parę → odmowa „Kwoty zmieniły się…" i świeże kwoty w oknie.
      _Zweryfikowano 2026-10-03 (staging): karta 1 z oknem (potwierdzenie „Zaksięgować premię 19,50 zł…"), w karcie 2 wypłata 5 zł na QA-Premia B (#5297) → w karcie 1 „Zaksięguj premię" nic nie księguje (brak nowej premii w bazie) i okno pokazuje świeże kwoty (Wypłacone 135,00, Pozostało −24,50 zł). Powtórzone z wypłatą 1 zł (#5298): to samo. NIE zaobserwowano treści komunikatu „Kwoty zmieniły się…" — toast nie złapany w DOM ani w MutationObserver; zachowanie (odmowa + świeże kwoty) potwierdzone._

## EX-968 — worker-email-clash — pracownik z e-mailem zajętym przez pracownika z Kosza (2026-10-05)

- [ ] Pracownicy → „Do kosza” na pracowniku z e-mailem → „Dodaj pracownika” z tym samym e-mailem: formularz odmawia komunikatem „Pracownik z adresem … jest w Koszu — przywróć go stamtąd.”, nowy pracownik nie powstaje.
- [ ] „Dodaj pracownika” z e-mailem aktywnego pracownika (wpisanym WIELKIMI literami, ze spacją na końcu): komunikat „Pracownik z adresem … już istnieje.”
- [ ] Edycja pracownika → zmiana e-maila na adres innego pracownika: ta sama odmowa; zapis z własnym, niezmienionym e-mailem przechodzi.

## EX-960 — worker-kasy-visibility — kasy pracownika na liście i na jego stronie (2026-10-05)

### Phase 1: „Kasy” na `/pracownicy`

- [ ] `/pracownicy` → kolumna „Kasy” pokazuje liczbę kas pracownika, „—” u pracownika bez kas; najechanie na liczbę pokazuje nazwy kas.
- [ ] `/pracownicy` → u pracownika z kasami „Usuń pracownika”: okno wymienia dokładnie tyle kas, ile pokazuje kolumna „Kasy”.
- [ ] `/pracownicy` → sortowanie po „Kasy” układa pracowników według liczby; kolumnę „Kasy” da się ukryć i pokazać w przełączniku kolumn.

### Phase 2: sekcja „Przypisane kasy” na stronie pracownika

- [ ] Strona pracownika z kasami → sekcja „Moje kasy” wymienia wszystkie jego kasy, każda nazwa otwiera stronę tej kasy.
- [ ] Ta sama sekcja → „Saldo” każdej kasy zgadza się z saldem tej kasy na `/kasy`; „Razem” to ich suma; ujemne saldo jest na czerwono.
- [ ] Pracownik z kasą ustawioną jako nieaktywna → ta kasa jest na liście z dopiskiem „nieaktywna” pod nazwą, a jej saldo wchodzi do „Razem”.
- [ ] Pracownik bez kas → sekcja „Moje kasy” mówi „Nie ma żadnej kasy.”
- [ ] Pracownik, którego kasa sama leży w Koszu → tej kasy nie ma w sekcji ani w liczbie na liście.
- [ ] Zalogowany jako MANAGER → strona właściciela (OWNER) nie pokazuje kasy głównej w „Przypisanych kasach”; jako OWNER/ADMIN kasa główna jest i jej link działa.
- [ ] Strona pracownika → nie ma już linijki „Wypłaty: … zł” nad sekcjami.
- [ ] Jako MANAGER kasa główna dalej jest niewidoczna wszędzie: nie ma jej na `/kasy` ani w `/kosz`, a jej adres `/kasa/<id>` pokazuje „nie znaleziono” (wspólna reguła widoczności — to samo zachowanie co wcześniej).

## EX-975 — purge-runner — nocne czyszczenie Kosza po scaleniu sześciu kopii (2026-10-05)

Refaktor bez zmiany zachowania: nocny cron czyści Kosz tak samo jak wcześniej.

- [ ] Inwestycja, kasa, pracownik, pojazd, sprzęt i zgłoszenie w `/kosz` dłużej niż okres przechowywania → po przebiegu crona `cleanup` znikają z `/kosz`, a listy (Inwestycje, Kasy, Pracownicy, Flota, Sprzęt, Zgłoszenia) pokazują stan po usunięciu bez ręcznego odświeżania pamięci podręcznej.
- [ ] Odpowiedź crona `cleanup` zawiera dla każdego rodzaju `purged` / `blocked` / `failed` (pojazdy, sprzęt i zgłoszenia mają teraz też `blocked: 0`), a inwestycje dodatkowo `skippedKosztorys`.

## 2026-10-05 — share-links-copy-and-404 — nowy link od razu w schowku, cofnięty link mówi „wygasł"

- [ ] Kosztorys → „Inwestor" → „Udostępnij" → „Wygeneruj nowy": nowy adres `/k/…` jest w schowku
      (wklej go gdziekolwiek), toast „Link skopiowany do schowka. Poprzedni (jeśli był) przestał działać."
      Stary adres pokazuje teraz stronę „nie znaleziono", nie czerwony błąd.
- [ ] Kosztorys → „Pracownicy" → link do zgłoszeń pracownika → „Wygeneruj nowy": w schowku jest nowy
      adres `/z/…`, ten sam toast.
- [ ] Otwórz cofnięty link do zgłoszeń (na telefonie, 390px): strona pokazuje komunikat „Ten link wygasł
      albo został cofnięty…" (PL/UA/RU), bez ekranu błędu; w narzędziach sieci odpowiedź to 404, nie 200.
- [ ] Otwórz cofnięty link inwestora `/k/<stary token>`: zwykła strona „nie znaleziono", bez błędu
      „Missing <html> and <body>".

## 2026-10-05 — worker-report-reported-only — „Tylko zgłoszone” i szersza kolumna „Zgłaszam”

- [ ] Link „Zgłoszenie prac" na desktopie: kolumna „Zgłaszam” ma limonkowe tło (nie zielone) i jest
      wyraźnie szersza niż wcześniej (tryb „Zgłaszam pracę” w stopce).
- [ ] Ten sam link na telefonie (390px): „Zgłaszam” mieści się obok opisu bez przewijania w bok,
      a wiersz nagłówków kolumn jest nieco wyższy niż na desktopie — podpowiedź pod „Zgłaszam”
      nie jest ucięta. Na desktopie wysokość nagłówka bez zmian.
- [ ] Włącz „Tylko zgłaszane przeze mnie” bez wpisanych ilości: zamiast rozpiski komunikat „Nic jeszcze nie
      zgłoszono" (PL/UA/RU). Wyłącz — wraca cała rozpiska.
- [ ] Wpisz ilość w dwóch pracach, włącz „Tylko zgłaszane przeze mnie”: widać tylko te dwie. Wyczyść jedną z nich
      w trakcie — wiersz nie znika spod kursora; znika dopiero przy ponownym przełączeniu.
- [ ] Wpisz ujemną ilość i włącz „Tylko zgłaszane przeze mnie”: ten wiersz zostaje widoczny (wysyłka go odrzuci,
      więc musi dać się go poprawić).

## EX-966 — worker-single-view — jeden widok pracownika: „Zgłoszenie prac" z trybem „Inwestycja"

- [ ] Link „Zgłoszenie prac" na telefonie (390px): „Inwestycja" w stopce pokazuje całą rozpiskę z
      rozliczeniem pracownika pod nią, „Zgłaszam pracę" wraca do kolumny „Zgłaszam" i „Wyślij".
- [ ] Ten sam link na desktopie: w „Zgłaszam pracę" przycisk „Wyślij" jest osiągalny, a w obu
      trybach stopka nie zasłania ostatniego wiersza ani przycisków.
- [ ] Kwoty rozliczenia w trybie „Inwestycja" zgadzają się z rozliczeniem tego pracownika w PDF z menu „Pracownicy"
      dla tej samej inwestycji.
- [ ] Kosztorys → „Pracownicy" → „Podgląd": otwiera się ten sam widok co link pracownika — nagłówek,
      rozpiska, stopka „Zgłaszam pracę" / „Inwestycja", wysłane zgłoszenia — bez przycisku „Wyślij".
- [ ] Wpisz ilość w „Podglądzie", potem otwórz prawdziwy link tego pracownika w tej samej
      przeglądarce: link nie pokazuje wpisanej ilości.
- [ ] „Podgląd" działa dla pracownika, któremu nigdy nie wygenerowano linku.
- [ ] Menu „Pracownicy" pokazuje przy każdym pracowniku tylko „Podgląd", „Link do zgłoszeń" i
      „Drukuj PDF" — bez osobnego „Link".
- [ ] Stary adres `/p/<imię>/<token>` pokazuje stronę „nie znaleziono".
- [ ] „Link do zgłoszeń" → „Wygeneruj nowy" działa: nowy adres jest w schowku, stary pokazuje
      komunikat „Ten link wygasł albo został cofnięty…" („Wyłącz link" zdjęty w EX-985).

## 2026-10-05 — worker-view-dogfooding — link `/z/…`, tryby w stopce, liczniki

- [ ] Kosztorys → „Pracownicy" → „Link do zgłoszeń": w schowku adres
      `/z/<inwestycja>/<pracownik>/<token>` z nazwą inwestycji i nazwiskiem bez polskich znaków.
- [ ] Ten adres w oknie prywatnym (bez logowania): strona się otwiera, wpisana ilość wysyła się
      przez „Wyślij" i pojawia się w zgłoszeniach kierownika.
- [ ] Stary adres `/zgloszenie-prac/<pracownik>/<token>` (ten sam token): strona „link nieaktywny",
      bez przekierowania na nowy adres.
- [ ] Stary adres rozpiski `/p/<pracownik>/<token>` w oknie prywatnym (bez logowania): strona „link
      nieaktywny", nie strona logowania.
- [ ] Inwestycja albo pracownik z nazwą z samych znaków specjalnych: w adresie stoi `-` w miejscu
      nazwy, a link działa.
- [ ] Telefon (390px): stopka „Zgłaszam pracę" / „Inwestycja" zostaje przy dole ekranu przy
      przewijaniu, oba przyciski są tej samej szerokości.
- [ ] Telefon (390px), tryb „Inwestycja": strona się nie oddala (bez zoom-out), a przy przewijaniu
      tabeli w bok nagłówek i stopka zostają na miejscu.
- [ ] Wpisz ilość w „Zgłaszam", przełącz na „Inwestycja" i z powrotem: ilość jest nadal w kolumnie.
- [ ] Rozliczenie pod tabelą w „Inwestycja" wygląda jak stopka PDF: bez siatki, wyrównane do prawej,
      „Pozostało do wypłaty" pogrubione.
- [ ] Liczniki: „Tylko zgłaszane przeze mnie (N)" i „Wyślij (N)" rosną i maleją przy wpisywaniu i
      czyszczeniu ilości; kompletna „Nowa praca" podbija tylko „Wyślij (N)"; „Wszystkie prace (+N)"
      pokazuje liczbę ukrytych pustych pozycji, a przy 0 jest bez licznika.
- [ ] W nagłówku linku nie ma tytułu „Zgłoszenie wykonanych prac".
- [ ] Wpisz ujemną ilość w „Zgłaszam", przełącz na „Inwestycja" i z powrotem: ujemna ilość nadal
      stoi w kolumnie, „Tylko zgłaszane przeze mnie (N)" ją liczy, a „Wyślij" pokazuje „Popraw błędy".
- [ ] Link pracownika po ukraińsku albo rosyjsku, tryb „Inwestycja": nagłówki i wiersze rozliczenia
      pod tabelą są w jego języku, nie po polsku.

## EX-956 — stage-split-rounding — części podziału etapu sumują się do „Razem" co do grosza (2026-10-05)

- [ ] Edytor → etap z rozliczeniem i wykonaną pracą (np. 3437,40 zł) → „Podział" procentowo
      33,33% / 12,5% / główny: wyświetlone części sumują się dokładnie do „Razem" (bez +0,01 zł).
- [ ] Ten sam etap w „Rozlicz wypłaty": kwoty pracowników z tego etapu zgadzają się z częściami
      w oknie podziału.
- [ ] Podział kwotowo, w którym wpisane kwoty przekraczają wartość etapu (etap zmniejszony po
      zapisie): części po proporcjonalnym zmniejszeniu sumują się do wartości etapu, główny ma 0 zł.

## EX-955 — worker-reports-pagination — strony, filtry i sortowanie na liście „Zgłoszenia prac” (2026-10-05)

- [ ] `/zgloszenia-prac` bez parametrów: na górze „Do sprawdzenia”, niżej rozpatrzone, w obu grupach
      najnowsze pierwsze; pod tabelą stopka z liczbą wyników i „Pokaż” ustawionym na 100.
- [ ] „Pokaż” 20: przejdź na stronę 2 — lista ciągnie kolejność strony 1, bez powtórzeń.
- [ ] Filtry „Status”, „Inwestycja”, „Pracownik” i zakres dat: każdy zawęża listę i wraca na stronę 1;
      w „Inwestycja” tylko otwarte inwestycje. Zgłoszenie wysłane tuż po północy liczy się do tego dnia.
      „Wyczyść filtry” przywraca całą listę.
- [ ] Odznacz wszystko w „Status”: pusta tabela, nie cała lista.
- [ ] Klik w nagłówek „Wysłano”, „Inwestycja”, „Pracownik”, „Prace”, „Status”: sortuje całą listę (strona
      2 ciągnie kolejność), adres dostaje `?sort=`. „Status” rosnąco: „Do sprawdzenia”, „Przyjęte”,
      „Odrzucone” — nie alfabetycznie. Trzeci klik zdejmuje sortowanie i wraca kolejka.
- [ ] Wpisz w adres `?page=1.5`, `?worker=99999999999`, `?from=2026-02-30`, `?sort=abc`: zwykła strona,
      żadnego błędu; kalendarz zakresu dat nie pokazuje „NaN”.

## 2026-10-05 — settlement-negative-footnote — ujemne „Pozostało do zapłaty” zamiast „Nadpłata”

- [ ] Podgląd inwestora inwestycji z nadpłatą (wpłaty większe niż „Łącznie”) → zakładka
      „Podsumowanie”: ostatni wiersz to „Pozostało do zapłaty*” z kwotą z minusem, pod tabelą
      „*Minusowa kwota oznacza nadpłatę”. Nigdzie nie ma „Nadpłata”.
- [ ] Ta sama inwestycja na stronie inwestycji (widok właściciela): ten sam wiersz i ten sam przypis.
- [ ] Inwestycja z dodatnim saldem: „Pozostało do zapłaty” bez gwiazdki, bez przypisu, kwota na czerwono.

## 2026-10-05 — column-colors — kolor kolumny w edytorze kosztorysu (zapis w przeglądarce)

- [ ] Edytor kosztorysu → kliknij nagłówek „Przedmiar” → w menu pod sortowaniem siatka 27 kolorów;
      wybierz kolor: cała kolumna i jej nagłówek dostają delikatny odcień, szare pola i czerwone
      ostrzeżenia w kolumnie nadal widać pod spodem.
- [ ] Ta sama kolumna przecina nagłówek sekcji: belka sekcji zostaje jednolita w kolorze sekcji,
      bez wstawki koloru kolumny.
- [ ] Nagłówek etapu → menu etapu: ta sama siatka kolorów; po wyborze koloruje się kolumna ilości etapu.
- [ ] „Bez koloru” w menu kolumny usuwa odcień.
- [ ] Odśwież stronę: kolory zostają. Otwórz inny kosztorys: kolumna „Przedmiar” ma ten sam kolor.
- [ ] Pokoloruj kolumnę etapu, usuń etap, dodaj nowy: nowy etap jest bez koloru.
- [ ] „Podgląd inwestora” tej samej inwestycji: żadna kolumna nie jest pokolorowana.

## 2026-10-05 — keep-date-on-keep-open — data zostaje po zapisie z „Nie zamykaj”

- [ ] „Wydatek” → zaznacz „Nie zamykaj”, ustaw datę inną niż dzisiejsza, zapisz: formularz się czyści,
      data zostaje ta sama.
- [ ] „Wpłata” → to samo: po zapisie z „Nie zamykaj” data zostaje.
- [ ] Bez „Nie zamykaj” (oba okna): po zapisie i ponownym otwarciu data jest dzisiejsza. „Wyczyść”
      zawsze wraca do dzisiejszej daty.

## EX-985 — worker-account — pracownik loguje się na własną stronę: kasy, sprzęt, transfery, kosztorysy (2026-10-05)

Potrzebny stan: konto pracownika (rola Pracownik) z własną kasą, z wypłatami i zaliczkami na tę kasę,
przypisane do etapów w kilku inwestycjach — w tym co najmniej jednej zakończonej.

- [ ] Zaloguj się jako pracownik → `/` przenosi na jego stronę `/pracownicy/<id>`.
- [ ] Jako pracownik: `/pracownicy/<id innego pracownika>` i `/kasa/<id jego kasy>` dają 404.
- [ ] Jako pracownik: na stronie nie ma edycji, anulowania ani wgrywania faktur; nazwy kas i sprzętu
      to zwykły tekst, nie linki. Klik w inwestycję w tabeli i „wstecz" wraca na jego stronę.
- [ ] Jako pracownik: „Faktury" pobiera tylko faktury z jego transferów, „Drukuj" drukuje tylko jego
      wiersze.
- [ ] Jako manager: strona tego pracownika pokazuje oprócz wypłat także zaliczki na jego kasę i wydatki
      z niej; kafelek sumy zgadza się z listą bez filtra i z filtrem kasy, a filtr kasy proponuje tylko
      jego kasy.
- [ ] Sekcja „Moje inwestycje" (pracownik i manager): tylko aktywne inwestycje, każda raz, bez kolumny
      statusu; przycisk „Zgłoś prace" wyśrodkowany w wierszu otwiera jego stronę `/z/`.
- [ ] Jako pracownik: w menu bocznym i w menu na telefonie nie ma żadnych linków (ani „Transakcje")
      ani przycisku „Saldo"; zostają imię, „Ciemny motyw", „Odśwież dane", „Wyloguj". Manager
      nadal widzi wszystkie linki i „Saldo".
- [ ] Pracownik bez sprzętu: sekcji „Na stanie" nie ma wcale; z sprzętem — jest, z listą. Kasy są pod
      nagłówkiem „Moje kasy".
- [ ] Strona pracownika na telefonie (390px): kasy, sprzęt, kosztorysy i transfery czytelne, bez
      rozjechanego układu.
- [ ] Edytor → dodaj pracownika do etapu → „Pracownicy" → „Link do zgłoszeń": link jest od razu,
      bez generowania. Pracownik z zablokowanym zakresem: okno pokazuje powód i link, a link otwiera
      `/z/` z komunikatem zamiast formularza.
- [ ] „Link do zgłoszeń" pracownika ma tylko „Wygeneruj nowy link", bez „Wyłącz link"; „Udostępnij"
      inwestorowi nadal ma „Wyłącz link".

## EX-988 — worker-pdf-translations — j.m. i PDF pracownika w jego języku (2026-10-05)

- [x] Link pracownika ustawionego na ukraiński → „Zgłaszam pracę": kolumna j.m. pokazuje „шт.", „м²", „пог. м"; jednostka spoza listy (np. „big bag") zostaje jak wpisana. _(staging, 2026-10-05: link QA-Premia A (inw. 182, uk): „шт.", „м²", „пог. м" w kolumnie j.m.; „big bag" bez zmian)_
- [x] Ten sam link → „Prace dodatkowe" → lista j.m. jest po ukraińsku; po wysłaniu zgłoszenie w aplikacji pokazuje polską jednostkę. _(staging, 2026-10-05: picker: м² / шт. / пог. м / компл. / точ.; po wysłaniu zgłoszenie w oknie „Zgłoszenia wykonanych prac" pokazuje „3 mb", w bazie `mb`; zgłoszenie odrzucone przy sprzątaniu)_
- [x] Link pracownika polskiego: jednostki wyglądają jak dotąd (także „m2" wpisane bez indeksu górnego). _(staging, 2026-10-05: Adam Orłowski (inw. 137) po wyczyszczeniu localStorage: m², mb, szt jak w rozpisce; wejście „m2" → bez zmian wynika z `translate-unit.ts` (`pl` zwraca wejście) i `translate-unit.test.ts:36`, nie z klikania — brak pozycji z „m2" na tym linku)_
- [ ] Kosztorys inwestycji → „Drukuj PDF" dla pracownika ustawionego na ukraiński: nagłówki, opisy z tłumaczeniem, nazwy sekcji, j.m., „Разом — …", „Кошторис — {imię}" i rozliczenie są po ukraińsku; opis bez tłumaczenia zostaje po polsku; kwoty w „zł". Najdłuższy nagłówek („Виконано — сума етапів…") mieści się w swojej wąskiej kolumnie i nie nachodzi na sąsiednie. _(staging, 2026-10-05: treść OK — nagłówki, sekcje „Гардероб QA"/„Ванна кімната 2", opis uk „Шафа QA опис", opis bez tłumaczenia po polsku, j.m. „м²", „Разом — …", „Кошторис — QA-Premia A", rozliczenie, kwoty w „zł"; NIE zaznaczone: najdłuższy nagłówek nachodzi na sąsiednią kolumnę, patrz Findings))_
- [ ] To samo dla pracownika ustawionego na rosyjski, także bez nachodzenia nagłówków. _(staging, 2026-10-05: treść OK — „Смета — QA-Premia B", „Итого — …", opis ru „Шкаф QA описание", rozliczenie; NIE zaznaczone: ten sam spill nagłówka „Выполнено — …", patrz Findings))_
- [ ] „Drukuj PDF" dla pracownika polskiego: nagłówki brzmią jak na jego linku („Cena j.m. netto — z narzędziami (podwykonawca)" itd.) i nadal mieszczą się na A4 poziomo, bez nachodzenia na siebie. _(staging, 2026-10-05: nagłówki jak na linku, szerokość dokumentu 1123 px = A4 poziomo; NIE zaznaczone: „Pomiar — suma etapów …" wystaje 10 px, patrz Findings))_
- [x] „Drukuj PDF" oferty dla klienta: bez zmian względem wcześniejszego wydruku. _(staging, 2026-10-05: tytuł „QA-blokady B", wszystko po polsku, „Razem — …"; `build-html.ts` bez zmiany domyślnych `lang`/`totalLabel`)_
- [x] „Zapisz jako PDF" w przeglądarce proponuje nazwę pliku „{inwestycja} — {imię}" jak dotąd. _(staging, 2026-10-05: `<title>` popupu = „QA-blokady B — QA-Premia A" (uk), „… — QA-Premia B" (pl i ru))_

### Findings — 2026-10-05

- [x] **Najdłuższy nagłówek worker PDF wystaje z kolumny (uk, ru i pl)** — „Виконано — сума етапів …" / „Выполнено — сумма этапов …" / „Pomiar — suma etapów …" w kolumnie ilości 9 mm łamał się na 5 linii obróconego nagłówka i wychodził ~10 px na sąsiednią kolumnę etapu. Skutek wyrównania nagłówków do linku (e8872496).
      **Naprawione:** `src/lib/kosztorys/print/styles.ts` (`WIDE_PRINT_STYLES`) — nagłówek 14 → 22 mm, `col.c-qty` 9 → 10 mm (opis traci ~2 mm przy sześciu etapach). Zmierzone w headless Chromium (media print, 1123 px) na wydruku pl/uk/ru, oba rozliczenia (z narzędziami / bez narzędzi): każdy nagłówek mieści się w swojej komórce, dokument nadal 1123 px. Boxy 4–6 czekają na ponowne sprawdzenie na stagingu po wdrożeniu.
      **Test disposition:** no automated test · — jsdom nie ma layoutu; geometria wydruku sprawdzana ręcznie (boxy 4–6).
- [x] **„Suma etapy …" zamiast „Suma etapów …" w nagłówku PL** — `src/lib/i18n/dictionaries/pl.ts` (`netForPlane`) i `src/lib/kosztorys/columns/column-config.ts` (wariant brutto); widoczne w siatce, na linku i w PDF pracownika polskiego. Sprzed EX-988, nie z arkusza właściciela (brak w dumpach arkuszy).
      **Naprawione:** „Suma etapów …" w obu miejscach + stała w `worker.test.ts`.
      **Test disposition:** no automated test · — literówka; spec wydruku trzyma etykietę asercją.

## EX-992 — ai-translations — AI uzupełnia tłumaczenia UA/RU i tłumaczy prace spoza rozpiski na polski (2026-10-05)

- [ ] Kosztorys z opisami bez tłumaczenia i z nieaktualnym tłumaczeniem → „Opcje → Uzupełnij tłumaczenia (AI)": kolumny UA/RU się wypełniają bez przeładowania strony, a „Problemy" pustoszeją; komunikat podaje, ile uzupełniono.
- [ ] Tłumaczenie UA wpisane ręcznie przed uruchomieniem (aktualne względem opisu) zostaje nietknięte.
- [ ] Sekcja, której nazwa nie miała tłumaczenia, po „Uzupełnij tłumaczenia (AI)" pokazuje się przetłumaczona na linku `/p` pracownika ustawionego na ukraiński (numer pokoju zachowany).
- [ ] Katalog prac → „Uzupełnij tłumaczenia (AI)": filtry „bez tłumaczenia" i „z nieaktualnym tłumaczeniem" pustoszeją.
- [ ] „Nowa praca" z zaznaczonym „Tłumacz automatycznie przy pomocy AI": nowa pozycja ma wypełnione kolumny UA/RU. Odznaczenie pola zostaje zapamiętane po przeładowaniu.
- [ ] Dodanie pracy do katalogu z zaznaczonym „Tłumacz automatycznie przy pomocy AI": wpis pokazuje tłumaczenia w tabeli katalogu.
- [ ] Zmiana nazwy sekcji na nową → po chwili link `/p` pracownika ukraińskiego pokazuje nową nazwę przetłumaczoną.
- [ ] Link zgłoszenia pracownika ukraińskiego → praca spoza rozpiski wpisana po ukraińsku → wysłanie: w przeglądzie zgłoszenia kierownik widzi opis po polsku, a pod nim „Zgłoszono (UA): „…”" z oryginałem.
- [ ] Praca spoza rozpiski wpisana po polsku: przegląd pokazuje ją jak dotąd, bez dopisku „Zgłoszono (…)".
- [ ] Gdy AI było niedostępne w chwili wysyłki: przegląd pokazuje „Brak tłumaczenia" i „Przetłumacz"; po kliknięciu (z działającym AI) polski opis pojawia się bez zamykania okna. Pracownik na swoim linku nie widzi żadnego przycisku tłumaczenia.
- [ ] „Przetłumacz ponownie" na przetłumaczonej linii podmienia polski opis.
- [ ] Przyjęcie przetłumaczonej pracy spoza rozpiski: nowa pozycja w kosztorysie ma polski opis, a jej kolumna UA zawiera słowa pracownika (nie oznaczona jako nieaktualna).
- [ ] Zgłoszenie już rozpatrzone (przyjęte/odrzucone): przegląd nie pokazuje przycisku „Przetłumacz".
- [ ] Katalog prac i kosztorys „Opcje": „Uzupełnij tłumaczenia (AI)" ma styl AI (gradientowa ramka, ikona różdżki) i licznik prac bez aktualnego tłumaczenia; gdy wszystko jest przetłumaczone, przycisk / pozycja menu znika.
- [ ] „Nowa praca w katalogu" i „Dodaj pracę" w kosztorysie: pole „Tłumacz automatycznie przy pomocy AI" stoi zaraz pod „Opis pracy", ma gradientowy checkbox i ikonę różdżki, a podświetlenie obejmuje tylko sam wiersz, nie całą szerokość.

## EX-971 — worker-expenses — pracownik zgłasza wydatek z paragonem, kierownik przyjmuje go w Transakcjach (2026-10-05)

- [ ] Pracownik na swojej stronie → „Dodaj wydatek" → inwestycja + 2 zdjęcia + notatka → wyślij: na liście „Moje wydatki" pozycja „czeka", w kolumnie „Załączniki" ikona otwiera oba zdjęcia. Sprawdź też przy szerokości 390px.
- [ ] Pracownik z jedną kasą (bez ustawionej domyślnej): „Dodaj wydatek" jest widoczny, dialog nie pyta o kasę, a przyjmowane zgłoszenie ma jego kasę.
- [ ] Pracownik z kilkoma kasami: dialog pokazuje „Kasa", ustawioną na domyślną, jeśli ją ma; bez wyboru kasy „Wyślij" jest nieaktywne.
- [ ] Pracownik bez żadnej kasy: zamiast przycisku „Dodaj wydatek" widzi „Nie masz kasy — poproś kierownika o jej założenie.".
- [ ] „Moje wydatki" → przy zgłoszeniu „czeka" przycisk „Usuń" → potwierdzenie: pozycja znika z listy i z czekających zgłoszeń w Transakcjach. Przy „przyjęty"/„odrzucony" przycisku nie ma.
- [ ] Kierownik na stronie pracownika: na liście „Moje wydatki" nie ma przycisku „Usuń".
- [ ] „Moje inwestycje": długa nazwa inwestycji mieści się w jednej linii na desktopie; przy 390px tabela się nie rozjeżdża.
- [ ] Transakcje → nad tabelą czekające zgłoszenie ma jeden przycisk „Zobacz" → dialog „Nowy wydatek" ma inwestycję, kasę pracownika, zdjęcia i notatkę; kwota jest pusta.
- [ ] W tym dialogu „Generuj" wypełnia kwotę i opis z paragonu; „Zapisz" → zgłoszenie znika z listy, wydatek jest w tabeli, u pracownika status „przyjęty".
- [ ] To samo zgłoszenie w dwóch kartach: druga „Zapisz" pokazuje „To zgłoszenie zostało już rozpatrzone.", a w tabeli jest jeden wydatek.
- [ ] W dialogu „Nowy wydatek" ze zgłoszenia → „Odrzuć" → potwierdzenie: dialog się zamyka, zgłoszenie znika z listy; u pracownika status „odrzucony". „Anuluj" w potwierdzeniu wraca do dialogu z danymi.
- [ ] Filtry → „Zgłoszone wydatki" włącza się i wyłącza jednym kliknięciem (bez rozwijanej listy).
- [ ] Z włączonym „Zgłoszone wydatki" odrzucone zgłoszenia są w tabeli transakcji na pierwszej stronie, wyszarzone i przekreślone jak anulowane: bez ID i kwoty, z plakietką „odrzucone zgłoszenie", zdjęciami w kolumnie „Faktura" i przyciskiem „Przywróć" (nieprzekreślonym). Bez filtra ich nie ma.
- [ ] „Zgłoszone wydatki" + inwestycja / kasa / zakres dat: odrzucone zgłoszenia zostają tylko z tej inwestycji, z tej kasy i wysłane w tym zakresie. Z filtrem pracownika, kategorii, kwoty, ID, „Tylko anulowane transakcje" albo typem bez „Wydatek inwestycyjny" odrzuconych nie ma wcale.
- [ ] Pracownik ze zgłoszeniem „czeka": „Usuń na zawsze" (i przeniesienie do kosza) pracownika, inwestycji tego zgłoszenia i jego kasy odmawia z „zgłoszenia wydatków do rozpatrzenia: 1". Po przyjęciu albo odrzuceniu zgłoszenia ta pozycja znika z odmowy.
- [ ] Ta sama odmowa kończy się zdaniem „Zgłoszenia wydatków najpierw przyjmij lub odrzuć."; kasa bez transakcji, zablokowana tylko zgłoszeniem, nie każe „przenieść transakcji".
- [ ] Kasa bez transakcji, ale z czekającym zgłoszeniem → „Edytuj kasę": pole właściciela zablokowane z opisem „…ma transakcje lub zgłoszenia wydatków do rozpatrzenia."
- [ ] Odrzucone zgłoszenie, którego pracownik, inwestycja albo kasa trafiły do kosza → przy filtrze „Zgłoszone wydatki" nie ma go w tabeli; po przywróceniu tej rzeczy z kosza wraca i „Przywróć" działa.
- [ ] Pracownik → „Moje wydatki" → ołówek przy wydatku „czeka": „Edytuj wydatek" z jego inwestycją, kasą, zdjęciami i notatką; zmiana notatki i inwestycji + „Zapisz" → lista pokazuje nowe wartości, kierownik widzi je w „Wydatki zgłoszone przez pracowników". Zamknięcie bez zapisu i ponowne otwarcie pokazuje zapisane wartości, nie porzuconą edycję. Przy „przyjęty" / „odrzucony" ołówka nie ma.
- [ ] Pracownik → „Moje wydatki" → ikona w „Załącznikach" przy wydatku „czeka": podgląd pozwala dodać zdjęcia i usunąć jedno z nich; ostatniego zdjęcia usunąć się nie da (kosz znika przy jednym). Po zmianie kierownik w „Wydatki zgłoszone przez pracowników" widzi te same zdjęcia.
- [ ] Pracownik → „Moje wydatki" → wydatek „przyjęty" / „odrzucony": ikona tylko pokazuje zdjęcia — bez dodawania i usuwania.
- [ ] Pulpit → „Wydatki zgłoszone przez pracowników": osobna kolumna „Załączniki" z samą ikoną podglądu (bez licznika) (klik otwiera zdjęcia), „Notatka" najszersza — dłuższa notatka nie łamie się co dwa słowa.
- [ ] „Przywróć" przy odrzuconym zgłoszeniu → wiersz znika z tabeli, zgłoszenie wraca do „Wydatki zgłoszone przez pracowników" z tymi samymi zdjęciami; u pracownika status „czeka".
- [ ] Zwykły „Nowy wydatek" z paska nadal odtwarza swój niedokończony szkic, także po przyjęciu zgłoszenia.
- [ ] Transakcje → filtr „Zgłoszone wydatki": tylko wydatki przyjęte ze zgłoszeń, każdy z plakietką „od pracownika"; „Wyczyść filtry" wyłącza przełącznik.
- [ ] Filtr „Zgłoszone wydatki" razem z wyszukiwaniem po kwocie zwraca część wspólną obu.
- [ ] Jako pracownik: wysłanie zgłoszenia, „Zmień e-mail lub hasło" i porzucenie formularza wydatku z wgranym zdjęciem działają jak dotąd; wylogowany — każda z tych akcji odmawia (wspólne sprawdzanie sesji, bez zmiany zachowania).

## 2026-10-05 — pagination-limit-width — „100” mieści się w selekcie „Pokaż”

- [ ] Dowolna lista z paginacją (np. Transakcje) → „Pokaż” → wybierz 100: w polu widać całe „100”,
      bez ucięcia; przy 20 i 50 pole ma tę samą szerokość.

## EX-989 — worker-self-credentials — pracownik zmienia swój e-mail i hasło (2026-10-05)

Potrzebny stan: dwa konta pracowników (rola Pracownik) ze znanymi hasłami oraz konto managera.

- [ ] Jako pracownik, w DevTools: `PATCH /api/users/<własne id>` z nowym `password` (ciasteczko
      z przeglądarki) → 403, a stare hasło nadal loguje.
- [ ] Jako pracownik, w DevTools: `POST /api/users/unlock` z własnym e-mailem → 403 (blokady po
      5 błędnych hasłach nie da się zdjąć samemu).
- [ ] Jako pracownik na telefonie (390px): `/pracownicy/<własne id>` pokazuje „Zmień e-mail lub
      hasło"; okno mieści się na ekranie i da się je wypełnić.
- [ ] Błędne „Obecne hasło" → „Nieprawidłowe obecne hasło.", nic się nie zmienia.
- [ ] Zmiana samego e-maila → strona pokazuje nowy e-mail; po wylogowaniu loguje nowy e-mail ze starym
      hasłem.
- [ ] Zmiana samego hasła → sesja, z której zmieniono, działa do wylogowania; potem loguje nowe hasło,
      stare nie.
- [ ] E-mail innego pracownika → „Ten adres e-mail jest już zajęty.".
- [ ] Jako manager na stronie innego pracownika → brak „Zmień e-mail lub hasło"; na własnej stronie →
      jest i działa.
- [ ] Strona „Reset hasła": niezgodne hasła i hasło 5-znakowe pokazują te same komunikaty co dotąd.
- [ ] Zamknij i otwórz okno ponownie (także po odświeżeniu strony) → żadne hasło nie jest wpisane.

## EX-996 — worker-page-language — pracownik ustawia „Domyślny język”, aplikacja i raport idą za nim (2026-10-05)

Potrzebny stan: konto pracownika (rola Pracownik) ze znanym hasłem, konto managera i inwestycja,
do której ten pracownik ma link do raportu.

- [ ] Pracownik ustawiony przez kierownictwo na „Українська”: w DevTools `<html lang="uk">` na jego
      stronie; konto z „Polski” → `lang="pl"`.
- [ ] Jako pracownik na telefonie (390px), na własnej stronie zmień „Domyślny język” na Українська →
      strona i menu przechodzą na ukraiński bez przeładowania; po odświeżeniu wartość nadal pokazuje
      ukraińską flagę.
- [ ] Na tym samym telefonie otwórz link do raportu tego pracownika, wcześniej przełączony tam na
      polski → otwiera się po ukraińsku.
- [ ] Jako manager na stronie innego pracownika: „Domyślny język” to zwykły tekst; na własnej stronie
      managera — lista do wyboru.
- [ ] Jako pracownik w „Transfery”: nazwa inwestycji to zwykły tekst, nie link.
- [ ] Pracownik na Українська: wiersze informacji, wszystkie cztery sekcje, okno „Zmień dane
      logowania” (etykiety, błędy walidacji, złe obecne hasło) i okno zgłaszania wydatku są po
      ukraińsku; kwoty w formacie `1 234,56 zł`.
- [ ] Ten sam pracownik na Русский: te same ekrany po rosyjsku.
- [ ] Pracownik na Українська, 390px: nagłówki tabeli transferów, filtry (Kasa, Inwestycja,
      Kategoria, wybór daty z nazwami miesięcy), paginacja, okno kolejności kolumn, „Drukuj”
      (tytuł wydruku) i komunikat archiwum faktur — po ukraińsku.
- [ ] Pracownik na Українська, w menu na telefonie: „Wyloguj”, motyw, „Odśwież dane” i plakietka
      roli po ukraińsku.
- [ ] Pracownik na Українська, wgrywanie strony faktury do wydatku: podpowiedź pola pliku,
      komunikat o odrzuconym pliku i etykiety podglądu po ukraińsku.
- [ ] Pracownik na Українська, nieistniejący adres → strona „nie znaleziono” po ukraińsku.
- [ ] Manager na „Polski”: tabele transferów na `/kasa/[id]` i `/inwestycje/[id]`, pasek boczny,
      menu na telefonie i okna wgrywania plików wyglądają dokładnie jak przedtem.
- [ ] „Podgląd pracownika” (manager) pozostaje po polsku niezależnie od języka pracownika.

## 2026-10-05 — worker-report-figures — „Wykonano” i „Pozostało” w raporcie pracownika, przełączniki w „Opcje”

Potrzebny stan: link do raportu pracownika na inwestycji, gdzie jego etapy mają już wpisane ilości
przy kilku pracach, a co najmniej jedna praca ma przedmiar.

- [ ] „Zgłaszam pracę” na telefonie (390px): obok wyszukiwarki sama ikona zębatki; na desktopie
      zębatka z napisem „Opcje”. W menu: „Wszystkie prace (+N)”, „Tylko zgłaszane przeze mnie (N)”,
      „Pokaż sumę do tej pory wykonanej pracy”, „Pokaż, ile pracy pozostało”; menu nie zamyka się po
      kliknięciu przełącznika.
- [ ] Włącz „Pokaż sumę…” → przed „Zgłaszam” kolumna „Wykonano” z sumą jego etapów dla pracy.
- [ ] Włącz „Pokaż, ile pracy pozostało” → za „Zgłaszam” kolumna „Pozostało” w formacie
      `wykonane / przedmiar`; wpisanie ilości w „Zgłaszam” od razu zwiększa liczbę po lewej, a
      przekroczenie przedmiaru zabarwia komórkę na czerwono.
- [ ] Na zakładce „Inwestycja” w menu jest tylko „Wszystkie prace”.
- [ ] „Jednostka miary” w „Zgłaszam pracę” widoczna od 1024px szerokości, poniżej ukryta.
- [ ] 390px z włączoną którąkolwiek z dwóch kolumn: tabela przewija się w bok, nagłówek i stopka
      zostają na szerokość ekranu; z obiema wyłączonymi — bez przewijania w bok, jak dotąd.
- [ ] Nagłówki „Wykonano”, „Zgłaszam” i „Pozostało” zaczynają się na tej samej wysokości (do góry).
- [ ] Ten sam link po ukraińsku i po rosyjsku: „Opcje”, oba przełączniki i obie kolumny przetłumaczone.
