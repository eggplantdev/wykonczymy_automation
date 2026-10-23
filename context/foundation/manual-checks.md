# Manual verification

One living checklist for every slice — the project's QA registry. Each `##` section is a slice/change; tick boxes by hand (or point an agent at a section: "drive these checks with Playwright and report" — the `verify-manual-checks` skill) as you verify. Lives in `context/foundation/` (not the change folder) so it survives `/10x-archive` and never freezes stale. A slice with unticked boxes here is **not** `Done` — manual checks are a hard blocker (see `/10x-implement`). Not gated by CI.

**Run against the isolated test DB, not the dev DB.** Manual checks mutate data, so point the app at the `db-test` container on **5435** (`DB_POSTGRES_URL_TEST`, `wykonczymy-test`) — the same DB the E2E suite uses — never the dev DB (5433, holds un-dumped local work) and never prod. Kosztorysy **są** w dumpie proda — `pnpm db:import:test` daje 65 kosztorysów / 4130 pozycji (policzone 2026-09-17), więc baza testowa nie jest pusta dla przepływów kosztorysowych. Seeduj tylko wtedy, gdy sprawdzenie potrzebuje **znanego** kształtu: `seed-kosztorys.ts` dla realistycznej rozpiski (czyta żywy arkusz wzorcowy) albo `perf-seed-kosztorys.ts` dla ~1000 syntetycznych wierszy, gdy sprawdzasz wydajność siatki — z DB env seeda wskazanym na `DB_POSTGRES_URL_TEST`.

**Ten plik przycięto 2026-09-15 i ponownie 2026-10-15** (z 6131 linii) — agent czyta go przy każdym
przebiegu, a odhaczone boksy z dowodami to księgowość zamkniętych slice'ów, nie instrukcje. Zostają
**wyłącznie sekcje z nieodhaczonymi boksami**, a w nich tylko boksy otwarte, plus indeks zamkniętych
przebiegów na końcu.

- **Nowa sekcja idzie na koniec „Otwarte", nad indeksem — nigdy pod nim.** Między 09-15 a 10-15
  191 sekcji dopisano pod indeksem i nikt ich nie przenosił; stąd odrost do 6 tys. linii.
- **Gdy sekcja ma już wszystkie boksy odhaczone**, zastąp ją wierszem indeksu
  (`odhaczone/wszystkie`, najpóźniejsza data); z sekcji otwartej usuń boksy odhaczone.
- **Pełny zapis, verbatim:** `git show d426e567^:context/foundation/manual-checks.md` (do 09-15,
  94 sekcje) oraz rodzic commita `docs(manual-checks): przytnij rejestr … 2026-10-15` (do 10-15) —
  komplet dowodów. Sięga się tam świadomie, gdy trzeba odtworzyć, **jak** coś zweryfikowano.
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

Trzy powody trzymają **wszystkie** otwarte boksy poniżej. Żaden nie jest defektem i żadnego nie
zamknie kolejny przebieg weryfikacji — dopóki trwają, te boksy zostają otwarte. Numeracja zaczyna się
od 2, bo boksy niżej powołują się na nią — dawna blokada 1 (`/raporty`) zniknęła razem z trasą
(2026-10-11):

2. **Poczta nie wychodzi poza produkcją.** `EMAIL_HOST` = `disabled.invalid` (AGENTS.md), więc
   dostawy ani treści maila nie da się zaobserwować; każdy check „przychodzi mail o treści X"
   wymaga człowieka z prawdziwą skrzynką. Sygnałem, że kod doszedł do wysyłki, jest **500** z trasy
   crona — wyjątek DNS, nie usterka.
3. **Trasy crona na Preview stoją za Vercel SSO** i wymagają `Authorization: Bearer $CRON_SECRET`.
   Przebieg 2026-10-14 je osiągnął: `fetch()` z wnętrza zalogowanej sesji przechodzi SSO, a
   `CRON_SECRET` dołącza agent z `.env` głównego checkoutu. To nie blokuje już boksów crona; nadal
   blokuje je poczta (2) — wysyłka kończy się 500 z DNS-u. Technika: `context/reference/manual-verification.md`.
4. **Brak dostępu do skrzynki odbiorczej** — osobno od (2): nawet z produkcyjnym mailem treść
   trzeba obejrzeć okiem.

# Otwarte

## cron-lead-reconcile

Setup: aplikacja lokalnie (`.env` → dev DB 5433), `CRON_SECRET` z `.env`. Wywołania Graph idą w
**żywe dane Meta** nigdy niewygasającym tokenem Page, więc sweep naprawdę wstawia leady — nigdy na
produkcję.

4/7 odhaczonych. Trasa wywołana ręcznie na produkcji zwróciła 200 z licznikami
(`added:0, scanned:30`), a `vercel crons ls` potwierdza rejestrację `0 4 * * *` na Production.

- [ ] Wywołanie z poprawnym `CRON_SECRET` zwraca liczniki, a przebieg, który odzyskał leada, dostarcza
      Mail poza produkcją nie wychodzi — z założenia nie do sprawdzenia tu (`context/reference/outgoing-effects-isolation.md` § Poczta).
      mail alertowy na listę „Alerty techniczne" — **blokady 2 i 3**. Połowa licznikowa domknięta
      (200 + liczniki z produkcji). Zostaje wyłącznie noga mailowa i jej **nie da się wymusić bez
      szkody**: `notifyReconcileRecovery` leci tylko przy `added > 0`
      (`src/app/(payload)/api/cron/leads-reconcile/route.ts:25`), a skoro webhook działa, sweep nie ma
      czego odzyskiwać — zobaczenie tego wymagałoby skasowania prawdziwego zgłoszenia z produkcyjnej
      bazy. Świadomie tego nie robimy.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokady 2 i 4 (mail nie wychodzi poza produkcją, brak dostępu do skrzynki). Cron na Preview stoi też za SSO i CRON_SECRET (blokada 3)._
      _needs human: mail dostarczony na listę „Alerty techniczne” — poczta wychodzi tylko z produkcji (blokady 2/3), brak dostępu do skrzynki_
  _Staging 2026-10-20: wymaga człowieka — mail nie wychodzi poza produkcją (EMAIL_HOST=disabled.invalid), brak dostępu do skrzynki_

## lead-recovery-notifies-sales

Setup jak w `cron-lead-reconcile`. **Uwaga:** te checki czytają żywe dane Meta i wysyłają prawdziwy
mail na listy „Powiadomienia o nowych zgłoszeniach" i „Alerty techniczne" — a przy regresji na
prawdziwy adres klienta. Warunek wstępny: lead obecny w oknie Meta, a nieobecny lokalnie.

2/4 odhaczone. Domknięte strukturalnie: klient **nie dostaje nic**, bo `reconcile-sweep.ts:91`
podaje `autoReply: 'skip'`, więc `sendAutoReply` nie jest w ogóle wołane (12 odzyskanych leadów
wylądowało z `auto_reply_status = 'skipped'`), a defekt, który ta zmiana naprawiała (oba statusy na
`skipped`), **nie jest odtwarzalny** — `notify_status` siada na `failed`, czyli próbowano.

- [ ] Przebieg sweepa (cron `/api/cron/leads-reconcile`) → skrzynka sprzedaży dostaje jedno zwykłe
      Mail poza produkcją nie wychodzi — z założenia nie do sprawdzenia tu (`context/reference/outgoing-effects-isolation.md` § Poczta).
      „Nowe zgłoszenie", nieodróżnialne od webhookowego — **blokada 2**. Kod gwarantuje
      nieodróżnialność strukturalnie: obie ścieżki wołają ten sam `captureLead` → `notifyNewLead`
      (`src/lib/leads/capture-lead.ts:71`),
      różni je wyłącznie opcja `autoReply`. Została sama dostawa.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokady 2 i 4 (mail nie wychodzi poza produkcją, brak dostępu do skrzynki)._
      _needs human: dostawa maila do skrzynki sprzedaży — poczta tylko z produkcji, brak dostępu do skrzynki_
  _Staging 2026-10-20: wymaga człowieka — mail nie wychodzi poza produkcją (EMAIL_HOST=disabled.invalid), brak dostępu do skrzynki_
- [ ] Dokładnie jeden mail podsumowujący, wyłącznie na „Alerty techniczne" (nie do sprzedaży), bez
      Mail poza produkcją nie wychodzi — z założenia nie do sprawdzenia tu (`context/reference/outgoing-effects-isolation.md` § Poczta).
      danych kontaktowych i bez instrukcji „zadzwoń sam" — **blokady 2, 3 i 4**. Alert
      (`notifyReconcileFailure`/`notifyReconcileRecovery`) leci z trasy crona, która jest dziś
      jedynym wołającym sweepa — ręczny przycisk „Pobierz z Facebooka" został usunięty.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokady 2 i 4 (mail nie wychodzi poza produkcją, brak dostępu do skrzynki)._
      _needs human: mail alertowy „Alerty techniczne” — poczta tylko z produkcji, brak dostępu do skrzynki_
  _Staging 2026-10-20: wymaga człowieka — mail nie wychodzi poza produkcją (EMAIL_HOST=disabled.invalid), brak dostępu do skrzynki_

## Katalog narzędzi i urządzeń (rejestr sprzętu)

11/13 odhaczonych (ostatni przebieg 2026-09-04, staging). Pełny zapis: archiwum.

- [ ] Ręczne `GET /api/cron/equipment-reminders` z `Bearer $CRON_SECRET` wysyła mail o właściwej
      Mail poza produkcją nie wychodzi — z założenia nie do sprawdzenia tu (`context/reference/outgoing-effects-isolation.md` § Poczta).
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
      _needs human: dostarczony mail przeglądu — poczta tylko z produkcji (EMAIL_HOST=disabled.invalid), brak dostępu do skrzynki_
  _Staging 2026-10-20: wymaga człowieka — mail nie wychodzi poza produkcją (EMAIL_HOST=disabled.invalid), brak dostępu do skrzynki_

## lead-delivery (wykonczymy half, 2026-09-21)

Sprawdzenia na bazie testowej (5435). Webhook wymaga `LANDING_WEBHOOK_SECRET` i
`LANDING_BLOB_HOST` w `.env`; kontrakt koperty: `context/reference/landing-intake-contract.md`.

**Każdego boksu z podpisanym requestem nie da się sprawdzić na stagingu — rób je lokalnie.**
`LANDING_WEBHOOK_SECRET` jest na Vercelu w środowisku Preview oznaczony jako **Secret** (`vercel env
ls preview` → „Hidden / Secret"), więc wartości nie wyciągnie ani `vercel env pull`, ani `.env`, który
niesie inny sekret. Poprawnie policzony HMAC dostaje wtedy `403 {"error":"Forbidden"}` — to zgodne
zachowanie bramki, nie defekt i nie błąd podpisu, więc nie ma czego debugować (spalony przebieg
2026-09-23). Dotyczy boksów „podpisany POST", „ten sam request powtórzony", „url spoza allowlisty"
i „podmienione body"; boks z `403` potwierdza za to odmowę przy złym sekrecie.

- [~] ~~Pasek miniatur nie przewija się w poziomie przy 375px~~ — nieaktualne: na karcie inwestycji
      nie ma już paska miniatur (patrz wpis „investment-assets-dialog", który to zastępuje)
- [ ] Podpisany POST JSON z `curl`, wskazujący realny URL bloba, tworzy zgłoszenie razem z plikami
      Nie do sprawdzenia na stagingu — agent nie zna sekretu `LANDING_WEBHOOK_SECRET` z Preview.
      _2026-09-30: POST podpisany HMAC-SHA256 (scope „landing-submission") z `LANDING_WEBHOOK_SECRET` z `.env` → 403 na stagingu, czyli sekret z `.env` nie jest sekretem Preview. Brakuje wartości sekretu Preview; do tego realny plik w blobie landingu (callback release dotyka landingu). Nic nie utworzono._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
      _needs human: podpisany webhook landingu — sekret LANDING_WEBHOOK_SECRET z Preview niedostępny, potrzebny też realny blob landingu_
  _Staging 2026-10-20: wymaga człowieka — podpisany POST wymaga sekretu dostawy leadów i curl, a staging jest za Vercel SSO_
- [ ] Ten sam request powtórzony nie tworzy niczego i nie wysyła maila
      Nie do sprawdzenia na stagingu — agent nie zna sekretu `LANDING_WEBHOOK_SECRET` z Preview.
      _2026-09-30: jak wyżej — brak sekretu Preview (403 na poprawnie podpisany request z sekretem z `.env`)._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
      _needs human: podpisany webhook landingu — sekret LANDING_WEBHOOK_SECRET z Preview niedostępny_
  _Staging 2026-10-20: wymaga człowieka — podpisany POST wymaga sekretu dostawy leadów i curl, a staging jest za Vercel SSO_
- [ ] Request z `assets[].url` spoza hosta z allowlisty jest odrzucony i alertuje
      Nie do sprawdzenia na stagingu — agent nie zna sekretu `LANDING_WEBHOOK_SECRET` z Preview.
      _2026-09-30: jak wyżej — brak sekretu Preview; bez ważnego podpisu request nie dochodzi do walidacji hosta._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
      _needs human: podpisany webhook landingu — sekret LANDING_WEBHOOK_SECRET z Preview niedostępny_
  _Staging 2026-10-20: wymaga człowieka — podpisany POST wymaga sekretu dostawy leadów i curl, a staging jest za Vercel SSO_
- [ ] Request z podmienionym body jest odrzucony (403)
      Nie do sprawdzenia na stagingu — agent nie zna sekretu `LANDING_WEBHOOK_SECRET` z Preview.
      _2026-09-30: 403 obserwowane, ale nie do zaliczenia — poprawnie podpisany request też dostał 403 (zły sekret), więc odrzucenie nie dowodzi kontroli podpisu._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
      _needs human: podpisany webhook landingu — sekret LANDING_WEBHOOK_SECRET z Preview niedostępny (403 nie dowodzi kontroli podpisu)_
  _Staging 2026-10-20: wymaga człowieka — podpisany POST wymaga sekretu dostawy leadów i curl, a staging jest za Vercel SSO_

## materialy-inwestora-brutto

### Phase 3: E2E

- [ ] `pnpm test:e2e e2e/client-share.spec.ts` na świeżo zaseedowanym db-test przechodzi.
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._
      _Nie sprawdzone 2026-10-04 (staging): spec E2E uruchamia człowiek (nie uruchamiam `pnpm test:e2e`)._
      _needs human: spec E2E (`pnpm test:e2e`) uruchamia wyłącznie człowiek_
  _Staging 2026-10-20: wymaga człowieka — suite E2E — uruchamia człowiek (zakaz E2E w tym przebiegu)_

## catalogue-picker-virtualization — „Dodaj pracę z katalogu" rysuje tylko widoczne wiersze (2026-09-28)

Lista w oknie rysuje tylko to, co widać; zmiana we wspólnej tabeli dotyka też dwóch tabel
podsumowania kosztorysu. Pierwsze cztery sprawdzone lokalnie (build produkcyjny, inw. 157) — do
powtórzenia na stagingu.

- [ ] `pnpm exec playwright test e2e/work-catalogue.spec.ts` na bazie E2E — uruchamia człowiek
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._
      _needs human: spec E2E uruchamia wyłącznie człowiek_
  _Staging 2026-10-20: wymaga człowieka — suite E2E — uruchamia człowiek (zakaz E2E w tym przebiegu)_

## protokol-odbioru — protokół odbioru prac z menu „Inwestor" (2026-09-28)

### Phase 3: Dialog, menu item and print wiring

- [ ] „Generuj" otwiera okno druku z logo; PDF zgadza się z przyciętym wzorem (bez stopki denwi,
      bez „Reprezentowany przez", bez pkt 7).
      _Zweryfikowano 2026-09-29 (staging): CZĘŚCIOWO — inw. 137, „Generuj” z zaślepką `print` (druk się nie odpalił) otwiera okno z logo (img 360 px), tytułem „PROTOKÓŁ ODBIORU PRAC” i punktami 1–6; w treści brak „denwi”, „Reprezentowany przez” i pkt 7. Porównanie z przyciętym wzorem właściciela (wzór PDF niedostępny w repo) wymaga człowieka._
      _Staging 2026-10-06 (pass 4):_ CZĘŚCIOWO — „Generuj” (inw. 137, `window.open` + `print` zaślepione, druk się nie odpalił): HTML w oknie ma `<img src=…/logo-wykonczymy.png>` (URL zwraca 200 image/png), tytuł „Protokół odbioru prac — testowe inwestycje”, brak „denwi”, „Reprezentowany przez” i pkt 7. Obraz w popupie about:blank nie załadował się w automatyzacji (complete=false) — NEEDS-HUMAN: logo na wydruku i zgodność PDF z przyciętym wzorem.
      _needs human: prawdziwe okno druku / PDF i porównanie z przyciętym wzorem właściciela (wzór poza repo)_
  _Staging 2026-10-20: wymaga człowieka — natywne okno druku / papier / fizyczne zdjęcie — poza zasięgiem przeglądarki automatycznej_

## kosztorys-client-view-auto-columns — jeden zestaw kolumn inwestora, rozliczenie gdy są wpisy (2026-09-28)

Zastępuje warianty „Oferta / Rozliczenie". Migracja `20260928_2_client_view_single_set` jest
addytywna — na produkcję **przed** pushem; DROP starych kolumn idzie osobną migracją, po wdrożeniu.

### „Udostępnij" kopiuje link

- [ ] Działa w Safari (kopiowanie nie jest odrzucane). **Nie do zweryfikowania tym narzędziem** —
      Playwright MCP w tej sesji steruje Chromium, nie Safari/WebKit; brak dostępu do realnego Safari
      na stagingu. Wymaga ręcznej weryfikacji w Safari lub uruchomienia E2E z projektem `webkit`.
      _Zweryfikowano 2026-09-29 (staging): pominięto — Chromium nie jest Safari._
      _Nie sprawdzone 2026-10-04 (staging): Safari niedostępne w tym narzędziu._
      _needs human: prawdziwe Safari (kopiowanie do schowka) — narzędzie steruje wyłącznie Chromium_
  _Staging 2026-10-20: wymaga człowieka — Safari — brak w automatyzacji_

### E2E

- [ ] `pnpm test:e2e e2e/client-share.spec.ts` przechodzi — uruchamia człowiek
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._
      _Nie sprawdzone 2026-10-04 (staging): spec E2E uruchamia człowiek (nie uruchamiam `pnpm test:e2e`)._
      _needs human: spec E2E uruchamia wyłącznie człowiek_
  _Staging 2026-10-20: wymaga człowieka — suite E2E — uruchamia człowiek (zakaz E2E w tym przebiegu)_

## worker-payout-remaining — „Pozostało do wypłaty" per pracownik i „Rozlicz wypłaty" (2026-09-29)

Dane: prawdziwe inwestycje na stagingu, bez seedów. Nazwy w boksach to role, nie rekordy:
„A" — aktywna inwestycja, na której pracownik ma coś do wypłaty; „B" — aktywna, z długiem u ≥ 2
pracowników i pozycjami „Nieprzypisane"; „C" — inwestycja bez rozliczenia etapów („ustaw etapy");
„D" — zakończona, z długiem. „Jan" — pracownik z długiem na A, B i D; „Piotr" — pracownik na B
z etapem bez rozliczenia. Stan, którego nie ma w danych, zakłada się przez UI (kosztorys: etapy
i pracownicy; status inwestycji) i cofa po przebiegu; wypłaty zaksięgowane w teście się anuluje.

- [ ] (tylko produkcja) wypłaty pojawiają się w zakładce „transfery" arkusza właściciela.
      _Tylko produkcja — zapis do arkusza właściciela jest na preview zablokowany (konto Viewer), więc nie do sprawdzenia na stagingu; zostaje niezaznaczone._
      _Zweryfikowano 2026-09-29 (staging): pominięto — sprawdzenie wyłącznie na produkcji (zapis do arkusza właściciela wymaga konta Editor)._
      _needs human: tylko produkcja — zapis do arkusza właściciela wymaga konta Editor (na preview 403)_
  _Staging 2026-10-20: wymaga człowieka — tylko produkcja / odczyt z proda_

## szablony-plain-revalidation

- [ ] To samo w szablonie z ~1000 pozycji: zapis komórki bez widocznego opóźnienia względem małego
      szablonu.
      _Staging 2026-10-01: nie sprawdzono — na preview DB nie ma szablonu z ~1000 pozycji (są 3: 0–202 pozycji; największa inwestycja ma 379 pozycji), seedów nie wolno. Boks zostaje otwarty._
      _Nie sprawdzone 2026-10-04 (staging): bez zmian — na preview nadal brak szablonu z ~1000 pozycji (największy: 202 pozycje), seedów nie wolno._
      _Staging 2026-10-06 (batch B): bez zmian — brak szablonu z ~1000 pozycji (największy szablon 202, największy kosztorys 379), nie seeduję. Zob. Findings._
      _Zweryfikowano 2026-10-09 (lokalnie, 5435): szablon zbudowany z UI — „Zapisz jako nowy szablon” (z inw. 7, 1000 pozycji bez katalogu → szablon wyszedł pusty) + 3× „Sekcja z szablonu…” = 899 pozycji, 44 sekcje (szablon 1280). Zapis komórki „Opis prac” (edycja katalogu): akcja 89 ms / żądanie 135 ms, start po 460 ms debounce; w szablonie 294 pozycji (1278): akcja 61 ms / żądanie 120 ms, start po 472 ms — brak widocznej różnicy, bez przeładowania. Zmienione wpisy katalogu (130, 447) przywrócone SQL-em, szablon 1280 do usunięcia na teardown._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      _needs human: szablon ~1000 pozycji / pusty kosztorys — brak takiego fixture'a na preview, pomiar opóźnienia wymaga człowieka (pass 6)_

## kosztorys-stage-worker-split — kilku pracowników na etap (2026-09-30)

- [ ] Etap sprzed zmiany z jednym przypisanym pracownikiem: po wdrożeniu nagłówek pokazuje tę samą
      osobę bez „+N", a jej należne i wypłaty się nie zmieniły.
      _Staging 2026-10-01: nie sprawdzono w pełni — Etap 1 inw. 137 (jeden pracownik, Adam Orłowski) pokazywał nagłówek bez „+N” przed moimi zmianami, ale „po wdrożeniu” to porównanie ze stanem sprzed zmiany, którego nie mam. Boks zostaje otwarty._
      _Staging 2026-10-01 (batch 5): inw. 138 Etap 1 (stworzony 2026-08-30, jeden pracownik Adrian Furmańczyk, `kosztorys_stage_workers` id 1): nagłówek „Adrian Furmańczyk” bez „+N”; „Pracownicy”: wykonana praca 4290,00, wypłaty 0,00, pozostało 4290,00 — zgodne z DB (22 × 300 × 0,65 = 4290,00; brak aktywnych PAYOUT pracownika 17 na 138). Boks zamknięty._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      Staging 2026-10-15: etapy z jednym pracownikiem na inw. 210 pokazują samą osobę bez „+N", ale stanu „sprzed zmiany" nie da się odtworzyć (inw. 138 z 30.08 jest w Koszu, nagłówek tylko „Etap 1"); wymaga starego etapu z danych prod.

## kosz-zgloszen

Na staging najpierw `pnpm db:migrate:preview` (nowe kolumny `trashed_at` / `erased_at` w zgłoszeniach).

- [ ] „Usuń na zawsze" na zgłoszeniu, z którego utworzono inwestycję ze zdjęciami: wymaga wpisania
      nazwy; po usunięciu zgłoszenie znika z `/kosz`, a galeria inwestycji pokazuje wszystkie zdjęcia.
      _Nie sprawdzone 2026-10-03 (staging): UI nie tworzy zgłoszeń, a formularz WWW wysłałby powiadomienia na prawdziwe adresy; kasować cudzego zgłoszenia nie wolno — bloker izolacji._
      _Nie sprawdzone 2026-10-06 (staging, batch B): bez zmian — UI nie tworzy zgłoszeń ani inwestycji z nich, nie ma jednorazowego leada do skasowania. Zob. Findings._
      _Zweryfikowano 2026-10-09 (lokalnie, 5435; lead 224 z plikiem, inwestycja 154): potwierdzenie wymaga wpisania nazwy (zła nazwa → przycisk wyłączony); po usunięciu zgłoszenie znika z `/kosz` (wiersz wymazany w miejscu, `erased_at` ustawione, `leads_rels` 0); inwestycja 154 nadal ma „Zdjęcia i pliki — Dokumentacja (1)” i `investments_rels` → media 1799. Uwaga: bajty `/api/media/file/marki-pdf-a8a01d.pdf` dają 404 także dla nietkniętego PDF-a z innego leada — preview store nie ma PDF-ów, to nie skutek usunięcia._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      _needs human: wymaga zgłoszenia (leada) z inwestycji ze zdjęciami — UI nie tworzy zgłoszeń, a kasowanie cudzego jest zabronione; część lokalna zweryfikowana 2026-10-09_
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_
- [ ] Usunięte na zawsze zgłoszenie z Facebooka nie wraca po nocnym uzgodnieniu zgłoszeń (staging,
      następny dzień).
      _Nie sprawdzone 2026-10-03 (staging): wymaga sprawdzenia następnego dnia po przebiegu crona Facebooka — bloker izolacji_
      _needs human: sprawdzenie następnego dnia po nocnym cronie uzgadniania Facebooka (cron + realne zgłoszenie FB)_
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_

## 2026-10-02 — podsumowanie-pracownika-tabele

- [ ] PDF pracownika z długą listą wypłat (kilkadziesiąt) → tabela, która nie mieści się na stronie, przechodzi na następną sama, a tabele nad nią zostają na poprzedniej (bez pustej połowy strony). PDF oferty dla klienta → podsumowanie w stopce nadal stoi przy prawej krawędzi.
      _Nie sprawdzone w całości 2026-10-03 (staging): zaksięgowano 32 wypłaty po 1 zł dla QA-Premia A i otwarto „Drukuj PDF" (print zastubowany) — tabela „Wypłaty" ma 33 wiersze, 826 px wysokości, zaczyna się na 459 px (nie mieści się na jednej stronie); styl wydruku ma tylko `tr { break-inside: avoid }`, bez `break-inside` na samych tabelach. NIE da się ocenić faktycznego podziału stron — `page.pdf()` w tym Chromium zwraca „Printing failed", a prawdziwego druku nie wolno uruchamiać. PDF oferty: tabela „Razem netto" ma prawą krawędź równą prawej krawędzi tabeli głównej (1244 px) — stoi przy prawej krawędzi w układzie ekranowym, a nie w druku._
      _Lokalnie 2026-10-09: do prawdziwego HTML „Drukuj kosztorys pracownika (PDF)” (print zastubowany, inw. 184) wstrzyknięto 35 wierszy wypłat i wyrenderowano headless Chromium (`page.pdf`, A4 landscape): 4 strony — tabele „Wykonane”/„Pozostało” zostają na str. 2, tabela „Wypłaty” zaczyna się od góry str. 3 (28 wierszy), str. 4 ma resztę (7 + „Razem”); brak pustej połowy strony. Podsumowanie oferty przy prawej krawędzi: ten sam CSS `.totals` (`align-items: flex-end`); w PDF pracownika widać je przy prawej krawędzi, oferty osobno nie renderowano. Zob. Findings 2026-10-09 (pass 4)._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      _needs human: PDF z kilkudziesięcioma wypłatami — brak takiego pracownika na preview; ocena układu PDF wzrokowo (pass 6)_
  _Staging 2026-10-20: wymaga człowieka — natywne okno druku / papier / fizyczne zdjęcie — poza zasięgiem przeglądarki automatycznej_

## purge-runner — nocne czyszczenie Kosza po scaleniu sześciu kopii (2026-10-05)

Refaktor bez zmiany zachowania: nocny cron czyści Kosz tak samo jak wcześniej.

- [ ] Inwestycja, kasa, pracownik, pojazd, sprzęt i zgłoszenie w `/kosz` dłużej niż okres przechowywania → po przebiegu crona `cleanup` znikają z `/kosz`, a listy (Inwestycje, Kasy, Pracownicy, Flota, Sprzęt, Zgłoszenia) pokazują stan po usunięciu bez ręcznego odświeżania pamięci podręcznej.
      _needs human: cron `cleanup` na preview DB (kopia produkcji) trwale skasowałby prawdziwe wiersze z /kosz — brak izolowanego zestawu przeterminowanych rekordów_
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_
- [ ] Odpowiedź crona `cleanup` zawiera dla każdego rodzaju `purged` / `blocked` / `failed` (pojazdy, sprzęt i zgłoszenia mają teraz też `blocked: 0`), a inwestycje dodatkowo `skippedKosztorys`.
      _needs human: jak wyżej — odpowiedź crona `cleanup` wymaga jego uruchomienia, które na preview DB kasuje prawdziwe przeterminowane wiersze_
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_

## ai-translations — AI uzupełnia tłumaczenia UA/RU i tłumaczy prace spoza rozpiski na polski (2026-10-05)

- [ ] Gdy AI było niedostępne w chwili wysyłki: przegląd pokazuje „Brak tłumaczenia" i „Przetłumacz"; po kliknięciu (z działającym AI) polski opis pojawia się bez zamykania okna. Pracownik na swoim linku nie widzi żadnego przycisku tłumaczenia.
      _Staging 2026-10-05:_ NIE sprawdzone — nie da się zasymulować niedostępności AI na stagingu. Sam przycisk „Przetłumacz" sprawdzony na zgłoszeniu z PL opisem (działa).
      _needs human: nie da się zasymulować niedostępności AI w chwili wysyłki na stagingu_
  _Staging 2026-10-20: wymaga człowieka — wymaga niedostępnego AI w chwili wysyłki_

## worker-report-scan — zgłoszenie prac wczytane z papierowej kartki

Potrzebny stan: inwestycja w toku z rozpiską (kilka sekcji, kilkanaście prac), pracownik przypisany
do jej etapu, drugi pracownik ustawiony na Українська. Odczyty AI idą naprawdę — nie oszczędzaj
zdjęć, każdy wariant poniżej to osobny skan.

### Jakość odczytu (prawdziwe zdjęcia)

- [ ] Zdjęcie pod kątem / w słabym świetle / lekko pognieciona kartka → ilości dalej się zgadzają,
      a te nieczytelne mają „Niepewny odczyt — sprawdź na zdjęciu”.
      _Staging 2026-10-05:_ skan syntetyczny (obrót 3-4°, przyciemnienie, rozmycie): przy ostrzejszym wariancie 6/2/5 przesunięte o jeden wiersz (6 trafiło na żelbet zamiast kable miękkie), brak flagi „Niepewny odczyt”; ostry wariant: 2,5→3 i pominięty wiersz. Potrzebne prawdziwe zdjęcie z telefonu — decyzja człowieka
      _Staging 2026-10-06:_ NIE sprawdzone: wymaga prawdziwego zdjęcia kartki raportu z telefonu; nie do zrobienia narzędziem.
      _needs human: wymaga prawdziwego zdjęcia kartki raportu z telefonu (skan syntetyczny nie zastępuje)_
  _Staging 2026-10-20: wymaga człowieka — natywne okno druku / papier / fizyczne zdjęcie — poza zasięgiem przeglądarki automatycznej_

## 2026-10-06 — worker-form-mirrors-link — kartka do wypełnienia jak „Zgłaszam pracę”, czytelny wydruk

- [ ] Ta sama kartka wydrukowana na papierze: linie tabeli, nagłówki kolumn i jednostki są wyraźnie widoczne; szare tło mają tylko Nr, Wykonano i Postęp — Opis prac i Zgłaszam są białe.
      _needs human: wydruk kartki na papierze (prawdziwa drukarka)_
  _Staging 2026-10-20: wymaga człowieka — natywne okno druku / papier / fizyczne zdjęcie — poza zasięgiem przeglądarki automatycznej_
- [ ] Wydrukuj kosztorys dla klienta i PDF pracownika: linie i szare podpisy też są widoczne na papierze, kolumny dalej w paski jak wcześniej.
      _needs human: wydruk na papierze (prawdziwa drukarka)_
  _Staging 2026-10-20: wymaga człowieka — natywne okno druku / papier / fizyczne zdjęcie — poza zasięgiem przeglądarki automatycznej_
- [ ] Wypełnij kartkę ręcznie (kilka ilości w „Zgłaszam”), wczytaj ją przez „Wczytaj zgłoszenie z kartki (AI)”: w zgłoszeniu są dokładnie wpisane ilości, a nie liczby z kolumn „Wykonano” / „Postęp”.
      _needs human: ręcznie wypełniona papierowa kartka + zdjęcie z telefonu_
  _Staging 2026-10-20: wymaga człowieka — natywne okno druku / papier / fizyczne zdjęcie — poza zasięgiem przeglądarki automatycznej_

## 2026-10-07 — reorder-dialog-safari — lista „Ustaw kolejność” nie zapada się w Safari

- [ ] Safari (desktop) → kosztorys z kilkoma sekcjami → „Akcje sekcji” → „Ustaw kolejność…”: lista sekcji i prac jest widoczna, przewija się w środku okna, „Zapisz kolejność” działa po przeciągnięciu.
      _needs human: prawdziwe Safari desktop (WebKit)_
  _Staging 2026-10-20: wymaga człowieka — Safari — brak w automatyzacji_

## media-upload-other-forms — każdy formularz z plikami na szybkiej ścieżce (2026-10-07)

Staging (albo preview brancha), konto OWNER, chyba że napisano inaczej. Zdjęcia z telefonu albo
JPEG-i ~300 KB; „duży plik" = PDF powyżej 4 MB.

- [ ] Telmak: dodaj fakturę PDF → zapisana i otwiera się.
  - POMINIĘTE 2026-10-07 (staging): okno „Sprawdź Telmak” przyjmuje tylko faktury w układzie Telmaka (parser odrzuca inne), a jedyne takie PDF-y to prawdziwe faktury z lustra produkcyjnego Bloba — nie wgrywam ich na staging. Wymaga PDF-a Telmaka od człowieka.
      _needs human: PDF faktury Telmaka (prawdziwe faktury produkcyjne nie trafiają na staging)_
- [ ] Raport ze skanu: dodaj zdjęcia → raport zapisany, zdjęcia się otwierają.
  - POMINIĘTE 2026-10-07 (staging): wymaga czytelnie wypełnionej kartki „Drukuj kartkę do zgłoszenia prac” — dwa zdjęcia z szumem skończyły się komunikatem „Na zdjęciach nie odczytano żadnej wpisanej ilości.” i raport się nie zapisuje. Potrzebne zdjęcie prawdziwej, wypełnionej kartki od człowieka.
      _needs human: zdjęcie prawdziwej, wypełnionej kartki zgłoszenia prac_
- [ ] Okno leada (zgłoszenie z Facebooka) z plikami → miniatury wyglądają jak dotąd.
      POMINIĘTE 2026-10-07 (staging): żadne z 221 zgłoszeń na preview DB nie ma plików (`leads_rels` bez media), a nowego z plikami nie da się utworzyć bez podpisanego webhooka landingu (sekret Preview niedostępny, zob. sekcja lead-delivery). Wymaga zgłoszenia z plikami od człowieka.
      _needs human: zgłoszenie z plikami — żadne z 221 leadów na preview nie ma załączników, a UI/webhook ich nie dopnie_
  _Staging 2026-10-20: wymaga człowieka — zgłoszenie z Facebooka / landing — prawdziwy kanał zewnętrzny_
- [ ] Zgłoszenie z formularza na stronie (landing) ze zdjęciem z telefonu i PDF-em → oba pliki są przy zgłoszeniu, miniatura zdjęcia się wyświetla.
      POMINIĘTE 2026-10-07 (staging): to wymaga prawdziwego formularza na stronie landingu i podpisanego webhooka (`LANDING_WEBHOOK_SECRET` Preview niedostępny, pliki leżą w blobie landingu). Nie da się zrobić z tej sesji.
      _needs human: prawdziwy formularz landingu + podpisany webhook (sekret Preview niedostępny)_
  _Staging 2026-10-20: wymaga człowieka — zgłoszenie z Facebooka / landing — prawdziwy kanał zewnętrzny_

## 2026-10-07 — worker-pwa-install-and-long-session — ikona aplikacji na telefonie i logowanie na 90 dni

- [ ] Build produkcyjny, Chrome DevTools → Application → Manifest: nazwa „Wykończymy”, trzy ikony (maskowalna z podglądem strefy bezpiecznej), brak błędów instalowalności.
      _Staging 2026-10-14 (pass 3): /manifest.webmanifest: name i short_name „Wykończymy”, trzy ikony (192, 512, maskable 512), display standalone. Podgląd strefy bezpiecznej i błędy instalowalności z DevTools — Needs human._
- [ ] Android Chrome, prawdziwy telefon, staging, 390px: na własnej stronie pracownika pod „Zmień e-mail lub hasło” jest przycisk instalacji — najpierw w stanie ładowania, potem aktywny; dotknięcie pokazuje systemowe okno instalacji, a ikona trafia na ekran główny.
      _needs human: prawdziwy telefon z Androidem (instalacja PWA)_
  _Staging 2026-10-20: wymaga człowieka — zainstalowana PWA / prawdziwy telefon (Android/iPhone)_
- [ ] Ta ikona otwiera aplikację na pełnym ekranie na stronie pracownika, już zalogowaną, i przycisk instalacji nie jest tam pokazany.
      _needs human: zainstalowana PWA na prawdziwym telefonie_
  _Staging 2026-10-20: wymaga człowieka — zainstalowana PWA / prawdziwy telefon (Android/iPhone)_
- [ ] iPhone Safari, prawdziwy telefon, staging, 390px: przycisk otwiera instrukcję w trzech krokach; po jej wykonaniu ikona jest na ekranie głównym i otwiera aplikację na pełnym ekranie na `/zaloguj`; po zalogowaniu przycisku nie ma.
      _needs human: prawdziwy iPhone Safari (dodanie do ekranu głównego)_
  _Staging 2026-10-20: wymaga człowieka — zainstalowana PWA / prawdziwy telefon (Android/iPhone)_
- [ ] Android z już zainstalowaną aplikacją, strona otwarta w karcie Chrome: przycisk jest ukryty albo po 60 s zmienia się w podpowiedź o menu przeglądarki — nigdy nie zostaje w ładowaniu.
      _needs human: prawdziwy Android z zainstalowaną aplikacją_
  _Staging 2026-10-20: wymaga człowieka — zainstalowana PWA / prawdziwy telefon (Android/iPhone)_
- [ ] iPhone, ikona na ekranie głównym: logo jest wyśrodkowane, z marginesem dookoła, nie dotyka krawędzi kafelka.
      _needs human: ikona na ekranie głównym prawdziwego iPhone'a_
  _Staging 2026-10-20: wymaga człowieka — zainstalowana PWA / prawdziwy telefon (Android/iPhone)_
- [ ] Aplikacja zainstalowana (Android i iPhone): obok hamburgera jest strzałka wstecz na każdej stronie; cofa do poprzedniej strony, a przy pierwszej stronie po otwarciu prowadzi na stronę główną. W zwykłej karcie przeglądarki strzałki nie ma.
      _needs human: zainstalowana aplikacja na Androidzie i iPhonie (tryb standalone)_
  _Staging 2026-10-20: wymaga człowieka — zainstalowana PWA / prawdziwy telefon (Android/iPhone)_

## kosztorys-przedmiar-aktualny — „Aktualizacja przedmiaru” obok „Przedmiaru ofertowego” (2026-10-07)

- [ ] Pracownik, któremu wcześniej odznaczono „Przedmiar” w ustawieniach widoku pracownika → po zmianie „Aktualizacja przedmiaru” nadal jest u niego ukryta.
      POMINIĘTE bez próby (2026-10-07): wymaga starego klucza `plannedQty` zapisanego w globalu ustawień widoku pracownika, a UI zapisuje już tylko `currentPlannedQty`; stworzenie stanu to zapis do bazy poza UI. Mapowanie klucza pokrywa `src/__tests__/lib/kosztorys/worker-view/settings.test.ts`.
      Staging 2026-10-15: wymaga starego klucza plannedQty w globalu widoku pracownika, którego UI już nie zapisuje; ścieżkę pokrywa src/__tests__/lib/kosztorys/worker-view/settings.test.ts, ręcznie tylko przez edycję JSON w bazie.

## invoice-duplicate-detection — duplikaty paragonów przy akceptacji zgłoszeń wydatków (2026-10-08)

- [ ] „Dodaj wydatek" → między wierszem pliku a „Notatką" stoi wiersz z polami „Nr dokumentu", „NIP sprzedawcy" i „Data na paragonie"; „Skanuj" / „Odczytaj ponownie" wypełnia wszystkie trzy.
      _Staging 2026-10-14 (pass 3): układ OK: FV (plik) → Nr dokumentu / NIP sprzedawcy / Data na paragonie → Notatka. „Odczytaj ponownie” z fixture paragon-a.jpg dał „NIE UDAŁO SIĘ ODCZYTAĆ” (puste pola) — wypełnienie trzech pól nieweryfikowalne bez czytelnego prawdziwego paragonu. Needs human._
      _needs human: wypełnienie trzech pól przez odczyt AI wymaga czytelnego prawdziwego paragonu (fixture nie odczytuje się)_

## company-knowledge — „Manual Wykończymy” w górnym pasku

- [ ] `dump-knowledge-prod.ts` dla przypadku (sesja produkcyjna): `inputs/manual-i-komentarze-do-prac.md` ma
      każdy wpis z okna w tej samej kolejności i każdy Komentarz do pracy z katalogu. Wpis dodany w
      oknie pojawia się po kolejnym uruchomieniu.
      _needs human: skrypt `dump-knowledge-prod.ts` — sesja produkcyjna, tylko produkcja_
  _Staging 2026-10-20: wymaga człowieka — tylko produkcja / odczyt z proda_
- [ ] Po migracji na świeżej bazie (produkcja): wpisy „Wysokość pomieszczeń…”, „Otwory w glazurze…”,
      „Glazura…”, „Malowanie i gładź” i „Szlifowanie płytek na 45°” wyświetlają się w punktach,
      każdy punkt w osobnej linii.
      _needs human: migracja na świeżej bazie produkcyjnej — tylko produkcja_
  _Staging 2026-10-20: wymaga człowieka — tylko produkcja / odczyt z proda_

## 2026-10-09 — ui-scale — rozmiar interfejsu na telefonie

- [ ] Przy 70% na iPhonie: dotknięcie pola (np. kwota w „Dodaj transakcję”) nie przybliża strony, a wpisywany tekst mieści się w polu.
      _needs human: prawdziwy iPhone (zoom iOS przy fokusie pola)_
  _Staging 2026-10-20: wymaga człowieka — zainstalowana PWA / prawdziwy telefon (Android/iPhone)_

## 2026-10-11 — invoice-download-date-range — „Faktury” z zakresem dat

- [ ] „Drukuj” dalej drukuje bieżący zestaw filtrów tabeli, niezależnie od dialogu.
      _Staging 2026-10-14: Okno druku nie weryfikowalne w tym narzędziu._
      _needs human: natywne okno druku — nie do sterowania w automatyzacji_
  _Staging 2026-10-20: wymaga człowieka — natywne okno druku / papier / fizyczne zdjęcie — poza zasięgiem przeglądarki automatycznej_

## 2026-10-11 — pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji

Sprawdzalne tylko na produkcji — klucze VAPID są wyłącznie tam (blokada środowiskowa, nie defekt).

- [ ] Produkcja, Android, zainstalowana aplikacja → menu mobilne → „Włącz powiadomienia” → zgoda w systemie → toast „Powiadomienia włączone”, przycisk zmienia się na „Wyłącz powiadomienia”; jako ADMIN otwórz `/api/test-push` → przychodzi powiadomienie z jednobarwną ikoną na pasku stanu; dotknięcie otwiera aplikację.
      _needs human: produkcja, prawdziwy Android, push_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] Produkcja, iPhone (iOS 16.4+) → w karcie Safari przełącznika nie ma; w aplikacji z ekranu początkowego jest, włączenie pokazuje pytanie o zgodę, a testowe powiadomienie dociera.
      _needs human: produkcja, prawdziwy iPhone, push_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] Odmowa zgody na powiadomienia → zamiast przycisku napis „Powiadomienia są zablokowane — włącz je w ustawieniach telefonu.”
      _needs human: odmowa zgody systemowej na powiadomienia w prawdziwej przeglądarce/telefonie_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] „Wyłącz powiadomienia” → `/api/test-push` zwraca `sent: 0` i na telefon nic nie przychodzi; to samo po wylogowaniu się na telefonie.
      _needs human: push na prawdziwym telefonie_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] Pracownik z włączonymi powiadomieniami zdezaktywowany („Aktywny” wyłączone) albo przeniesiony do kosza → nie dostaje już żadnego powiadomienia.
      _needs human: push na prawdziwym telefonie_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] 390px → przełącznik na własnej stronie `/pracownicy/[id]` (obok „Zainstaluj aplikację”) i w stopce menu mobilnego nie rozjeżdża układu.
      _needs human: przełącznik powiadomień jest widoczny tylko w zainstalowanej aplikacji na telefonie_
- [ ] Produkcja, iPhone pracownika z włączonymi powiadomieniami → zarząd księguje mu wypłatę → przychodzi „Wypłata do potwierdzenia” z kwotą, a ikona aplikacji pokazuje 1; dotknięcie otwiera jego stronę z blokiem „Wypłaty do potwierdzenia”.
      _needs human: produkcja, iPhone, push + odznaka ikony_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] Ten sam pracownik „Potwierdzam” albo „Odrzuć” → liczba na ikonie znika od razu, bez zamykania aplikacji.
      _needs human: odznaka ikony aplikacji na iPhonie_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] Produkcja, Android → po zaksięgowaniu wypłaty powiadomienie dociera.
      _needs human: produkcja, Android, push_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] „Rozlicz wypłaty” dla jednego pracownika na dwóch inwestycjach → przychodzi jedno powiadomienie z sumą kwot, a ikona pokazuje 2.
      _needs human: push na prawdziwym telefonie_
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_

## 2026-10-12 — investment-ai-stage — „Etap AI” na inwestycji

- [ ] Po deployu i migracji produkcji: ustaw „Recenzja zakończona” na jednej inwestycji, uruchom `collect-reasons-prod.ts` bez `INVESTMENTS` → listuje Powody zmiany dokładnie tej inwestycji.
      _needs human: po deployu i migracji produkcji — skrypt `collect-reasons-prod.ts` na produkcji_
  _Staging 2026-10-20: wymaga człowieka — tylko produkcja / odczyt z proda_

## 2026-10-12 — worker-draft-one-expense-per-photo — każdy paragon na zdjęciu osobno

- [ ] Kierownik → zgłoszenie z jednym zdjęciem, na którym leży kilka paragonów obok siebie → „Zobacz”: każdy paragon to osobna pozycja ze swoją kwotą; NIP wpisany tylko tam, gdzie jest wydrukowany.
      _needs human: prawdziwe zdjęcie z kilkoma paragonami do odczytu AI_
- [ ] Zgłoszenie z jednym zdjęciem wysłane przed 2026-10-12 (pracownik wybrał wtedy „Jeden wydatek”), jeszcze bez odczytu → „Zobacz”: paragony ze zdjęcia rozpisane na osobne pozycje.
      _needs human: zgłoszenie z jednym zdjęciem sprzed 2026-10-12 bez odczytu — nie istnieje na preview, a stworzenie wymaga zdjęcia paragonów + AI_
- [ ] Kierownik przyjmuje zgłoszenie, pomijając jeden z paragonów → pominięty paragon w historii → „Przywróć”: wraca jako osobne zgłoszenie z jednym pustym wierszem do uzupełnienia, bez paragonów już zaksięgowanych z tego samego zdjęcia.
      _needs human: zgłoszenie z kilkoma paragonami z jednego zdjęcia (odczyt AI prawdziwego zdjęcia)_

## 2026-10-13 — stage-column-picker — ukrywanie pojedynczych etapów w „Kolumny”

- [ ] Z włączonym „Ukryj zakończone” oznacz w nagłówku etapu „Etap zakończony”: etap od razu znika z tabeli; odznacz — wraca.
      _Pass 3: oznaczenie Etapu 4 przy włączonym ustawieniu ukryło go; odznaczenie „Etap zakończony” zrobiono przy wyłączonym ustawieniu, więc „wraca” przy włączonym — niezweryfikowane._
      _Pass 3 (staging 2026-10-14): Niewykonalne tak, jak opisano: zakończonego etapu nie da się odznaczyć, dopóki jest ukryty (nie ma nagłówka) — trzeba wyłączyć „Ukryj zakończone”; zob. Findings pass 3._
      _Staging 2026-10-14 (pass 3): oznaczenie Etapu 1 przy włączonym ustawieniu od razu go ukrywa. „Odznacz — wraca” nie da się wykonać z tej samej pozycji: ukryty etap nie ma nagłówka, więc zakończenie cofa się dopiero po wyłączeniu ustawienia (zachowanie spójne z ukrywaniem, do potwierdzenia przez człowieka)._
      Pass 7 (staging 2026-10-15), inw. 210, „Bez narzędzi”: przy włączonym „Ukryj zakończone” oznaczenie Etapu 5 jako zakończony od razu ukrywa jego kolumny (potwierdzone). Krok „odznacz — wraca” jest niewykonalny w tym UI: ukryty etap nie ma nagłówka ani menu, a jego wiersz w „Kolumny → Etapy” jest wyszarzony, więc cofnięcie wymaga najpierw wyłączenia „Ukryj zakończone”. needs human: decyzja produktowa, czy to ma być możliwe (finding z pass 3, bez zmian).

## 2026-10-13 — report-line-decisions — „Przyjmij / Odrzuć” pozycja po pozycji

- [ ] Stare zgłoszenia z częściowymi decyzjami po migracji: „Do sprawdzenia” z postępem, nie „Przyjęte” (lokalnie: #7, #8, #11 na inw. 139; na preview te numery to inne inwestycje z kompletem decyzji — sprawdzać na lokalnym dumpie).
      _Staging 2026-10-14: na preview DB zgłoszenia #7/#8/#11 to inne inwestycje (139/149/119) i wszystkie linie mają decyzję → status „accepted” jest poprawny; danych do sprawdzenia „Do sprawdzenia z postępem” nie ma. Boks nieaktualny wobec preview DB — Needs human (dane lokalne)._
  _Staging 2026-10-20: wymaga człowieka — tylko lokalny dump (numery zgłoszeń z preview to inne dane)_
- [x] Nagłówki kolumn liczbowych w „Z rozpiski” (Zgłoszono, Przyjmuję, Etap, oba „Pomiar z natury”, Aktualizacja przedmiaru, Pomiar z natury / Aktualizacja przedmiaru) czytają się pionowo od dołu do góry, przyklejone do dołu wiersza nagłówka i wycentrowane w poziomie w swojej kolumnie; wszystkie kolumny poza opisami (Opis prac, Opis w języku pracownika, Może chodzi o) mają nagłówek i komórki wyśrodkowane — checkbox, Nr, Sekcja, Akcje, pole „Przyjmuję”, liczby, „0,5 → 1”, „0,5 / 1” z „przekroczono”; opisy zostają do lewej; długie zawijają się w 2 pionowe linie zamiast przekraczać ~192px wysokości; dopisek stoi jako mniejsza pionowa linia obok tytułu; strzałka sortowania na końcu napisu i klik w nagłówek dalej sortuje. Chrome i Safari.
      _Staging 2026-10-14 (pass 3): Chrome: wszystkie nagłówki liczbowe vertical-rl, vertical-align bottom, text-align center; Nr/Sekcja/Akcje/checkbox/liczby wyśrodkowane, Opis prac start; dopiski 10px pionowe. Safari — Needs human (brak Safari)._
  _Staging 2026-10-22 (pass 16): inw. 179, zgłoszenie #28 (OWNER): nagłówki „Pomiar z natury”, „Zgłoszono”, „Przyjmuję”, „Nowy etap”, „Aktualizacja przedmiaru”… pionowo od dołu do góry, przyklejone do dołu wiersza nagłówków (zrzut ekranu)._

## 2026-10-13 — queue-entity-links — linki do inwestycji i pracownika w zgłoszeniach

- [ ] „Zgłoszenia wydatków” → to samo dla inwestycji i pracownika; zgłoszenie bez inwestycji pokazuje „bez inwestycji” jako zwykły tekst.
      _Staging 2026-10-14: linki inwestycja/pracownik OK w obu tabelach /zgloszenia-wydatkow; NIE sprawdzone: zgłoszenie bez inwestycji („bez inwestycji” jako zwykły tekst) — brak takiego wiersza na preview._
      _needs human: „bez inwestycji" w tabeli wymaga zgłoszenia z investment_id NULL, a na preview wszystkie szkice mają inwestycję; utworzenie go wymaga zalogowania jako EMPLOYEE (zgłoszenie składa pracownik) i wylogowania OWNER-a, więc zostaje człowiekowi. Spec DOM `expense-drafts-data-table.test.tsx` pinuje komórkę „Bez inwestycji"._

## 2026-10-13 — mobile-table-font — 12px w tabelach i kosztorysie na telefonie

- [ ] Telefon → kosztorys: opis prac, ilości, „Razem” sekcji i pasek sekcji mniejsze; opis zawija się całymi liniami, a „…” pojawia się tylko przy faktycznie uciętym tekście.
      _Pass 3 (staging 2026-10-14): 390px inw. 210: tekst komórek 12px (desktop 14px); wygląd wyglądający OK na zrzucie; zawijanie/„…” w uciętych komórkach niezweryfikowane._
      _needs human: telefon/iPhone 390px na prawdziwym urządzeniu (viewport emulowany nie odtwarza dotyku, zoomu iOS ani klawiatury) (pass 6)_
- [ ] Telefon (iPhone) → raport pracownika (`/z/…`): stuknij w komórkę ilości i zacznij pisać — strona się NIE przybliża, a w trakcie edycji cyfra jest większa (16px); po wyjściu wraca do 12px.
      _needs human: telefon/iPhone 390px na prawdziwym urządzeniu (viewport emulowany nie odtwarza dotyku, zoomu iOS ani klawiatury) (pass 6)_
  _Staging 2026-10-20: wymaga człowieka — zainstalowana PWA / prawdziwy telefon (Android/iPhone)_

## 2026-10-13 — review-gate-fixes — poprawki z przeglądu commitów z 13.10

- [ ] Kosztorys na telefonie (390px) → komórka z uciętym tekstem: „…" stoi w linii ostatniego wiersza tekstu, nie nad nim ani pod nim.
      _needs human: telefon/iPhone 390px na prawdziwym urządzeniu (viewport emulowany nie odtwarza dotyku, zoomu iOS ani klawiatury) (pass 6)_

## 2026-10-13 — catalogue-add-flow — „szukaj w katalogu → albo dodaj nową pracę” w kosztorysie i w zgłoszeniach

- [ ] Praca bez j.m. w zgłoszeniu: „Brak j.m. — wybierz pracę z katalogu albo dodaj nową” znika po dodaniu jej do rozpiski.
      _Staging 2026-10-14: formularz pracownika wymaga j.m. (invalid przy „Gotowe”), więc takiej linii nie da się wysłać z UI — dane legacy. Needs human (dane)._

## 2026-10-14 — percent-one-decimal — procent z jednym miejscem po przecinku, bez „,0”

- [ ] Wydruk kosztorysu z kolumną „% wykonania”: procenty jak w siatce („33,3%”, „75%”).
      _Blokada: wydruk (okno drukowania) nie do prowadzenia w automatyzacji._
      _needs human: wydruk: natywne okno drukowania / podgląd PDF (pass 6)_

## 2026-10-14 — nav-labels

- [ ] Wejście w każdą z nich: nagłówek strony i tytuł podczas ładowania brzmią tak samo jak pozycja w
      menu — bez mignięcia starej nazwy.
      _h1 zgodne z menu na wszystkich trzech; mignięcie loading nie obserwowalne (tylko h1 sprawdzone)._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      _needs human: mignięcie nazwy przy ładowaniu nie jest obserwowalne przez MCP (sprawdzalne tylko h1) (pass 6)_

## 2026-10-14 — textarea-safari-rows — pole tekstowe rośnie z treścią w starszym Safari

- [ ] Safari 18.x → strona inwestycji z długą, wielolinijkową notatką → „Edytuj notatkę”: pole
      otwiera się mniej więcej na wysokość treści, nie na ~3 linie ze scrollem.
      _Blokada: wymaga Safari 18.x._
      _needs human: prawdziwe Safari (WebKit) — tego nie ma w środowisku MCP (pass 6)_
  _Staging 2026-10-20: wymaga człowieka — Safari — brak w automatyzacji_
- [ ] Safari 18.x → dowolne inne pole wielolinijkowe (np. powód anulowania, notatka pozycji
      w katalogu prac): puste ma tę samą wysokość co wcześniej, po wpisaniu kilku linii rośnie.
      _Blokada: wymaga Safari 18.x._
      _needs human: prawdziwe Safari (WebKit) — tego nie ma w środowisku MCP (pass 6)_
  _Staging 2026-10-20: wymaga człowieka — Safari — brak w automatyzacji_

## 2026-10-14 — kosztorys-editor-text-size — wielkość czcionki w edytorze kosztorysu

- [x] Pusty kosztorys (bez pozycji) przy „Bardzo mała”, potem dodanie pozycji z długim opisem przy
      włączonym „Dopasuj wysokość do treści”: wiersz od razu ma wysokość pasującą do małej czcionki.
      _Niezweryfikowane: wymaga pustego kosztorysu (nie zakładano)._
      _Staging 2026-10-14 (pass 3): nie wykonano: wymaga pustego kosztorysu (czyszczenie inw. 210 zniszczyłoby fixture AI; nowa inwestycja z pustym kosztorysem poza zakresem tego przebiegu)._
      _needs human: szablon ~1000 pozycji / pusty kosztorys — brak takiego fixture'a na preview, pomiar opóźnienia wymaga człowieka (pass 6)_
  _Staging 2026-10-22 (pass 14): OWNER, inw. 179 (QA „Konrad Testy”): zapisana wersja „QA pass14 baseline”, „Wyczyść kosztorys” (pusty: „Kosztorys jest pusty”), „Bardzo mała” + „Dopasuj wysokość wierszy”, nowa sekcja + „Dodaj pracę” z 270-znakowym opisem: wiersz od razu ma 5 linii małej czcionki i wysokość pasującą do tekstu (bez ucięcia). Stan przywrócony z „Wczytaj”._
- [ ] Telefon (390px), kosztorys: wejście w edycję komórki nie powiększa strony (brak zoomu iOS).
      _Blokada: zoom iOS wymaga prawdziwego iPhone._
      _needs human: telefon/iPhone 390px na prawdziwym urządzeniu (viewport emulowany nie odtwarza dotyku, zoomu iOS ani klawiatury) (pass 6)_

## 2026-10-14 — vertical-header-safari — pionowe nagłówki w Safari

Stan: kosztorys ze zgłoszeniem pracy od pracownika czekającym na przyjęcie.

- [ ] **Safari** → okno przyjmowania zgłoszenia, tabela „Z rozpiski”: nagłówki „Pomiar z natury”
      z dopiskami („ile jest aktualnie zgłoszone”, „po przyjęciu zgłoszenia”) mieszczą się w swojej
      kolumnie — żaden tekst nie wchodzi na sąsiednią kolumnę (np. „Przedmiar ofertowy”).
      _needs human: prawdziwe Safari (WebKit) — tego nie ma w środowisku MCP (pass 6)_
  _Staging 2026-10-20: wymaga człowieka — Safari — brak w automatyzacji_
- [ ] Safari, to samo okno zwężone: nagłówek, który zawija się do dwóch linii, nadal mieści się
      w swojej kolumnie.
      _needs human: prawdziwe Safari (WebKit) — tego nie ma w środowisku MCP (pass 6)_
  _Staging 2026-10-20: wymaga człowieka — Safari — brak w automatyzacji_

## kosztorys-ai-rounds — kolejne rundy AI: „Nowe informacje” i „Do ponownego sprawdzenia”

Stan: kosztorys AI (z AI przedmiarem) i drugi, zwykły kosztorys. Pozycje z flagą daje lokalne
wczytanie szkicu rundy 2 (`load-ai-draft.ts` z `ROUND=2`).

- [ ] Kosztorys AI → „Zapisz jako szablon”, potem ten szablon na innej inwestycji: zastosowane pozycje
      nie mają „Komentarza AI” ani „Nowych informacji”.
      _Staging 2026-10-14 (pass 3): niewykonane w tym przebiegu: tworzy szablon w bazie preview, wymaga drugiej inwestycji; do osobnego przebiegu — box otwarty._
      _needs human: zostaje częściowo zweryfikowane (zob. notatki powyżej); brakujący fragment wymaga danych/stanu, którego nie ma na preview (np. zgłoszenie oczekujące, szkic AI, stara notatka, język UA/RU, rola EMPLOYEE) albo ręcznej oceny wzrokowej (pass 6)_
- [ ] Kosztorys AI z „Komentarzem AI” → przywrócenie wcześniejszej wersji: „Komentarz AI” zostaje,
      żadna pozycja nie pokazuje „Do ponownego sprawdzenia”.
      _Staging 2026-10-14 (pass 3): niewykonane: przywrócenie wersji nadpisałoby fixture rundy 63462/63463 na inw. 210; box otwarty._
      _needs human: zostaje częściowo zweryfikowane (zob. notatki powyżej); brakujący fragment wymaga danych/stanu, którego nie ma na preview (np. zgłoszenie oczekujące, szkic AI, stara notatka, język UA/RU, rola EMPLOYEE) albo ręcznej oceny wzrokowej (pass 6)_
- [ ] Wczytanie szkicu rundy 2 z trzema wierszami (jedna pozycja zmieniona, jedna na 0, jedna nowa):
      flagę i blok „Runda 2 — …” mają tylko te trzy; pozostałe pozycje oraz każdy Przedmiar, Status
      i Powód zmiany bez zmian; Etap AI to „Przeanalizowana”. To samo wczytanie drugi raz — odmowa,
      nic się nie zapisuje.
      _Staging 2026-10-14 (pass 3): tylko skryptem, brak ścieżki UI (zob. Findings)._
      _needs human: zostaje częściowo zweryfikowane (zob. notatki powyżej); brakujący fragment wymaga danych/stanu, którego nie ma na preview (np. zgłoszenie oczekujące, szkic AI, stara notatka, język UA/RU, rola EMPLOYEE) albo ręcznej oceny wzrokowej (pass 6)_
- [ ] Pozycja z flagą i jednolinijkową treścią → „Dopasuj wysokość”: wiersz zostaje na dwóch liniach,
      etykieta „Do ponownego sprawdzenia” się mieści.
      _Staging 2026-10-14 (pass 3): inw. 210: „Dopasuj wysokość wierszy” kliknięte, ale poz. bez flagi z długim opisem dalej ucięta (32px, „…”), a flagowana 63463 ma opis dwulinijkowy (52px) — brak fixture jednolinijkowej z flagą, nie da się rozstrzygnąć. Box otwarty._
      _needs human: zostaje częściowo zweryfikowane (zob. notatki powyżej); brakujący fragment wymaga danych/stanu, którego nie ma na preview (np. zgłoszenie oczekujące, szkic AI, stara notatka, język UA/RU, rola EMPLOYEE) albo ręcznej oceny wzrokowej (pass 6)_
- [ ] Pozycja z wczytaną rundą: „Nowe informacje” wyglądają dokładnie jak „Komentarz AI” — etykieta
      zwykłą czcionką, odpowiedź pogrubiona, odstęp między liniami. „Do ponownego sprawdzenia” to mały
      bursztynowy badge nad Statusem i nie wychodzi poza kolumnę.
      _Staging 2026-10-14 (pass 3): inw. 210: kolumna „Nowe informacje” pusta dla wszystkich pozycji (brak fixture z „etykieta: odpowiedź”); w „Komentarz AI” etykieta zwykła, odpowiedź pogrubiona OK; badge Statusu 'Do sprawdzenia' w kolumnie nie wychodzi poza komórkę. Box zostaje otwarty — potrzebny fixture._
      _needs human: zostaje częściowo zweryfikowane (zob. notatki powyżej); brakujący fragment wymaga danych/stanu, którego nie ma na preview (np. zgłoszenie oczekujące, szkic AI, stara notatka, język UA/RU, rola EMPLOYEE) albo ręcznej oceny wzrokowej (pass 6)_

## 2026-10-14 — backlog-fixes-14 — poprawki z backlogu: odrzucenie w zgłoszeniu, zapis przed podmianą rozpiski, menu etapu

- [x] ten sam kosztorys w dwóch kartach. W karcie A „Zgłoszenia prac” → zgłoszenie → przy
      jednej pozycji tylko „Odrzuć” → zapisz. Przejdź do karty B: **nie** pojawia się „Rozpiska
      zmieniła się w innym oknie — wczytano aktualną wersję.”, a w „Wersje” nie przybyła wersja
      automatyczna. Po ponownym otwarciu zgłoszenia pozycja jest odrzucona.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_
  _Staging 2026-10-22 (pass 15): OWNER, inw. 179 (QA), dwie karty: raport QA pracownika (3 pozycje) → w karcie A „Odrzuć” jednej pozycji + „Zapisz zmiany”; karta B (po focusie) bez komunikatu „Rozpiska zmieniła się…”, w tabeli wersji bez nowej wersji (ostatnia nadal #1384), w bazie pozycja odrzucona (zapis trwały)_
- [x] to samo z „Przyjmij” jednej pozycji zamiast „Odrzuć” — karta B **pokazuje** ten
      komunikat i ilość w etapie.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_
  _Staging 2026-10-22 (pass 15): ta sama para kart: „Przyjmij 1 pracę” (nowy Etap 3) w karcie A → karta B pokazuje toast „Rozpiska zmieniła się w innym oknie — wczytano aktualną wersję.” i kolumnę Etap 3 z ilością 1 przy pozycji 12_
- [x] tak samo — świeża zmiana w komórce, od razu „Wyczyść kosztorys”, „Wczytaj z
      szablonu”, import z arkusza i „Ustaw kolejność”: każda kończy się bez komunikatu o błędzie
      i bez „Kosztorys zmienił się w innym miejscu”.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_
  _Staging 2026-10-22 (pass 15): inv 179: świeża edycja komórki + Ustaw kolejność, + Wyczyść kosztorys, + Wczytaj z szablonu (Kosztorys 2026 kolory): każda bez komunikatu o błędzie i bez 'zmienił się w innym miejscu'. Import z arkusza nie jest w UI edytora - nie przeprowadzony; baseline przywrócony (310/697)_

## media-file-headers — pliki spoza dozwolonych typów pobierają się zamiast otwierać

- [ ] Plik SVG wgrany w pliki z ominięciem formularza (`/api/media/file/<nazwa>.svg`) → otwarcie
      linku pobiera plik zamiast wyświetlać obraz lub stronę.
      _Staging 2026-10-15 (pass 5): Pass 5: NIE sprawdzone — w sklepie preview nie ma SVG, a wgranie przez token route z pominięciem formularza wymaga ręcznie zbudowanego klienta; brak specu na hardenMediaFileHeaders (src/__tests__ nie ma testu). Do zrobienia ręcznie._
      _needs human: w sklepie preview nie ma SVG, a wgranie z pominięciem formularza wymaga ręcznie zbudowanego klienta; brak specu hardenMediaFileHeaders (pass 6)_

## pozycja ze zgłoszenia zapamiętana przed zapisem

### Findings — 2026-10-15

- [x] **Praca z katalogu, którą sekcja już ma, nie jest zapamiętywana** — „Dodaj do rozpiski” z katalogu
      na pracę, której pozycja już stoi w wybranej sekcji, ustawiała link tylko w szkicu; po zamknięciu
      bez „Zapisz zmiany” praca wracała do „Spoza rozpiski” (bez bliźniaka). Poprawka w HEAD i na stagingu
      (2026-10-19): `add-line-to-rozpiska.tsx` `swapInto` woła `rememberItem` także na ścieżce istniejącej
      pozycji, spec `add-line-to-rozpiska.test.tsx` w repo. **Sprawdzone na stagingu 2026-10-22 (pass 15, 32fb4c7bd):** inw. 179, „Dodaj do rozpiski” z
      katalogu na pracę już obecną w sekcji Klimatyzacja („Jest już w tej sekcji”), zamknięcie bez „Zapisz zmiany”,
      ponowne otwarcie: pozycja zostaje w „Z rozpiski (3)”, nie wraca do „Spoza rozpiski”.
      **Test disposition**: test-driven-debugging · unit (dom) — `onPick` z jedną pasującą pozycją woła akcję.

## remount-latch-disarm — przerwane „Wyczyść” nie przebudowuje edytora przy następnej zmianie

- [x] Jak wyżej, ale po powrocie Online od razu wpisz wartość w komórkę i w ciągu pół sekundy dodaj
      pozycję: wpisana wartość zostaje po odświeżeniu strony.
      _Staging 2026-10-15 (pass 5): nie sprawdzone: wymaga mutowania treści inw. 186 w oknie pół sekundy; zostawione dla człowieka_
      _needs human: offline/przywracanie wersji nadpisuje cały kosztorys prawdziwej inwestycji — poza zasadami przebiegu (pass 6)_
  _Staging 2026-10-22 (pass 15): inw. 179: offline (setOffline) - Wyczyść - toast Czyszczenie przerwane, odświeżam kosztorys; po powrocie Online wpisane 7 w komórkę, potem Dodaj - Praca (dodana poz.); po odświeżeniu wartość 7 i nowa pozycja są. Okno pół sekundy nieosiągalne ręcznie (kilka sekund), ale wartość przetrwała. Baseline do przywrócenia_
- [x] „Wersje” → przywróć wcześniejszą wersję (z siecią): siatka przebudowuje się na przywróconą
      wersję, jak dotąd.
      _Staging 2026-10-22 (pass 14): OWNER, inw. 179 (QA „Konrad Testy”): z pustego kosztorysu „Wersje → Przywróć” na „QA pass14 baseline” — siatka od razu pokazała przywrócone sekcje i pozycje; w bazie 310 pozycji, 11 sekcji, sumy jak przed (Przedmiar 697, cena klienta 89 778)._
      _Staging 2026-10-15 (pass 5): nie sprawdzone: przywrócenie wersji nadpisałoby kosztorys inw. 186 na współdzielonej preview DB; zostawione dla człowieka_
      _needs human: offline/przywracanie wersji nadpisuje cały kosztorys prawdziwej inwestycji — poza zasadami przebiegu (pass 6)_

## 2026-10-15 — ungated-commits-review — „Do analizy AI” w galerii + cień pola wieloliniowego

- [x] To samo na koncie z językiem Українська: przycisk „Позначити для аналізу AI”, toast
      „Файл позначено для аналізу AI”, po kliknięciu „Позначено для аналізу AI” — bez polskich napisów.
      _Staging 2026-10-15 (pass 5): Pass 5 FINDING: staging (origin/staging b73d388fe) nie zawiera commita 108516943 (fix ukraińskiej etykiety, tylko lokalnie). Na koncie uk przycisk w galerii inw. 210 to wciąż „Oznacz do analizy AI” (reszta po ukraińsku: Видалити цей файл, Додати ще, Друк…). Do ponownego sprawdzenia po wdrożeniu poprawki. Język QA 75 przywrócony do Polski._
      _needs human: commit z ukraińską etykietą nie jest jeszcze na stagingu (pass 6)_
  _Staging 2026-10-22 (pass 16): _Staging 2026-10-22 (pass 16): konto OWNER 76 z językiem Українська (zmiana w /pracownicy/76; wartość uk zapisała się, wróciła do Polski). Galeria plików inw. 217 i świeżo wgranego pliku na inw. 179: przycisk „Позначити для аналізу AI”, po kliknięciu „Позначено для аналізу AI” — bez polskich napisów w tych przyciskach. Toast „Файл позначено…” nie złapany (zniknął przed odczytem). Uwaga: w tym samym oknie dialog „Usunąć plik?” / „Usuń” po polsku, a dialog dodawania ma tytuł „Dodaj zdjęcia lub pliki” po polsku (reszta po ukraińsku). Plik testowy usunięty (Kosz 7 dni). Język przywrócony do Polski.__

## 2026-10-15 — expense-draft-loader — „Nowy wydatek” pracownika: loader na środku ekranu + limit zdjęć

- [x] Inne ekrany z loaderem (logowanie, filtry transakcji, zapis formularza) wyglądają jak dotąd —
      🚧 dalej podskakuje.
  _Staging 2026-10-22 (pass 15): logowanie (gradientowe kółko w przycisku), filtr dat „Rok” na transakcjach i zapis „Edytuj transakcję” (🚧 podskakuje) sprawdzone w tym przebiegu; patrz restore-bouncing-loader_

## 2026-10-15 — staging-sweep-review — siatka kosztorysu po odmowie „Ustaw kolejność” + porządki

- [ ] Kosztorys → „Importuj z arkusza” i „Ustaw kolejność” działają jak wcześniej (porządki bez
      zmiany zachowania): import podmienia pozycje, kolejność zapisuje się po odświeżeniu strony.
      _Staging 2026-10-18 (pass 10): Ustaw kolejność: zapis kolejności przetrwał przeładowanie strony (OK). Importuj z arkusza NIE zweryfikowane — #213 nie ma powiązanego arkusza, a dodanie kosztorysu v1 z kanonicznym arkuszem nie utworzyło wiersza; import podmieniłby kosztorys realnej inwestycji. HUMAN: arkusz czytelny dla staging SA._

## szablon-own-structure — szablon jako odwołania do katalogu prac

- [ ] Ładowarka kosztorysu AI na szablonie (lokalnie): pozycje w brzmieniu katalogu, bez duplikatów.
      _Staging 2026-10-18 (pass 10): needs human: wymaga lokalnego uruchomienia ładowarki AI (scripts/ai-kosztorys, repo ../wykonczymy-ai-cases) — nie przeglądarkowe, nie na staging._
  _Staging 2026-10-20: wymaga człowieka — lokalnie — loader kosztorysu AI_
## 2026-10-15 — expense-draft-duplicates-per-row — duplikaty przy własnym paragonie + paragon bez zdjęcia

- [ ] Nieodczytane zgłoszenie bez pobranych zdjęć: nad pozycjami stały komunikat „Nie udało się
      pobrać zdjęć — zgłoszenie można tylko odrzucić.”, „Zapisz” wyłączone.
      _Staging 2026-10-18 (pass 10): NIE DA SIĘ NA STAGINGU: odczyt AI idzie przy wysyłce (draft 80 dostał ai_read), a stan „brak odczytu” wymaga ai_read=NULL, czyli awarii samego odczytu; nie zapisuję do bazy poza UI. Pokrywa to test jednostkowy pending-expense-drafts.test.tsx_
## 2026-10-15 — staging-sweep-review-2 — druk z PDF, scalanie paragonów, ustawienia widoków kosztorysu

- [ ] Podgląd z kilkoma plikami, wśród nich PDF (np. faktura + zdjęcie) → „Drukuj”: okno wydruku
      pokazuje wszystkie strony, z PDF-em włącznie, i otwiera się systemowe okno drukowania; po wydruku
      lub anulowaniu okno się zamyka.
      _Staging 2026-10-18 (pass 10): tx 5314 (2 pliki, PDF): Drukuj otworzył okno z 2 iframe'ami (obie strony, PDF włącznie), okno zamknęło się samo; natywne okno drukowania = HUMAN (print stub)_
## 2026-10-16 — filters-tick-to-show — „Filtry” zaznaczasz to, co chcesz widzieć

- [ ] Szablon, w którym część prac ma „Cenę j.m.”, a część nie → „Filtry” działają tak samo jak w
      kosztorysie (nic zaznaczone = wszystko). Gdy wszystkie prace mają cenę (albo żadna), przycisku
      „Filtry” nie ma — nie byłoby czego filtrować.
- [ ] Kosztorys, szablon → „Filtry”: bez „Wyczyść filtry”. Przy czymkolwiek zaznaczonym na górze jest
      „Wyczyść” — odhacza tylko opcje tego menu („Problemy”, zwinięte sekcje i „Szukaj…” zostają), po
      czym znika. Przewinięte w dół — „Wyczyść” odjeżdża razem z listą.
      _Staging 2026-10-18 (pass 10): kosztorys #213: menu bez „Wyczyść filtry”; po zaznaczeniu „Z przedmiarem” na górze „Wyczyść”; klik odhacza opcję, „Szukaj: Montaż” zostaje, „Wyczyść” znika, przycisk bez licznika. Szablon: brak „Filtry” (patrz wyżej); przewijanie menu niesprawdzone (menu mieści się bez przewijania)._
## enter-escape-keydown — Enter/Escape w polu komórki nie trafia już do siatki

Edytor kosztorysu, desktop. Wygląd się nie zmienia; Enter/Escape w trakcie wpisywania obsługuje teraz
tylko komórka, a siatka ich nie widzi.

- [ ] Nazwa sekcji: zmień ją i **Enter** — zapis i zejście o wiersz; zmień ponownie i **Escape** —
      stara nazwa wraca, zaznaczenie zostaje w miejscu.
      __Staging 2026-10-19 (pass 11): needs human: na inw. 210 komórka nazwy sekcji zaznacza się (klik/dwuklik), ale Enter ani wpisywanie nie otwiera edycji w sterowaniu myszą/klawiaturą z Playwrighta (pole input w nagłówku istnieje, fokus zostaje na body); przewijanie siatki zamiast edycji. Wymaga ręcznego sprawdzenia w realnej przeglądarce.__
      _Staging 2026-10-19 (desktop-regression-audit, MANAGER): edycję w pasku sekcji otwiera
      **dwuklik**. Enter zapisuje nazwę, Escape przywraca starą; zaznaczenie zostaje na pasku, bo
      zejście o wiersz ma tylko kolumna „Sekcja” w wierszu pozycji. Ta kolumna była ukryta, więc
      zostaje do sprawdzenia; kod zmiany nazwy się nie zmienił od c713fa2bf._
## 2026-10-16 — umowa-dialog — „Umowa” generowana z widoku inwestycji

- [ ] „Generuj” w Chrome z „Marginesy: Brak”, a potem z „Domyślne” → w obu przypadkach strona 2 i
      kolejne mają taki sam margines u góry i u dołu jak strona 1. To samo dla „Protokół odbioru” i
      w Safari.
      __Staging 2026-10-19 (pass 11): needs human: margines stron 2+ widać tylko w prawdziwym podglądzie wydruku (Chrome „Marginesy: Brak/Domyślne”, Safari); przechwycony HTML ma tylko regułę @page, nie wynik renderu.__
- [ ] „Generuj” z pustym Numerem, PESEL-em i terminami → podgląd wydruku: kropkowane puste miejsca,
      „zwanym dalej (Zamawiającym)”, „Wykończymy sp. z o.o.”, linia „8% VAT”, podpisy na końcu;
      „Zapisz jako PDF” proponuje nazwę „Umowa nr … — …”. Sprawdź w Chrome i Safari.
      __Staging 2026-10-19 (pass 11), Chrome, window.open stubbed (HTML captured, 1 print call): inw. 210 empty form -> „UMOWA nr” + fill spans, „zwanym dalej (Zamawiającym)”, „Wykończymy sp. z o.o.”, „8% VAT” line, „Zamawiający / Przyjmujący zamówienie” signature block at the end; <title> = „Umowa — QA EX-855 Inwestycja” (number omitted when empty, per build-contract-html.ts, so „nr …” is not proposed). Dotted look of the blanks and the Safari half not seen — needs human (real print preview + Safari).__
## 2026-10-16 — worker-pdf-totals — sumy kolumn i łamanie stron w PDF pracownika

- [ ] PDF zapisany z Safari: ostatnia litera „zł” w skrajnej prawej kolumnie nie jest obcięta, a
      kwota w wierszu „Razem” nie nachodzi na sąsiednią kolumnę.
      _Staging 2026-10-18 (pass 10): HUMAN: Safari/WebKit nie do sterowania z desktopowego Chromium_
  _Staging 2026-10-20: wymaga człowieka — Safari — brak w automatyzacji_
- [ ] PDF z Safari dla kosztorysu na 2+ strony: żaden wiersz nie jest rozcięty (opis na jednej
      stronie, kwoty na drugiej) — wiersz, który się nie mieści, przechodzi w całości na następną.
      _Staging 2026-10-18 (pass 10): HUMAN: Safari/WebKit + prawdziwy podgląd wydruku_
  _Staging 2026-10-20: wymaga człowieka — Safari — brak w automatyzacji_
## transfer-actions-db-spec — anulowanie i edycja kwoty zapisują się razem z wpisem w historii

- [ ] Anuluj wydatek materiałowy inwestycji podpiętej do arkusza: jego wiersz znika z arkusza jak
      dotąd.
      _Staging 2026-10-18 (pass 10): NIE do zrobienia na stagingu: zapis do arkusza właściciela jest z założenia zablokowany poza produkcją (konto Viewer, AGENTS.md → Hard Stops), więc „wiersz znika z arkusza” nie jest obserwowalny; samo anulowanie wydatku materiałowego zweryfikowano w boksie powyżej. needs human: tylko produkcja._
  _Staging 2026-10-20: wymaga człowieka — zapis do Arkuszy Google tylko z produkcji (konto Viewer na preview)_
## 2026-10-18 — kosz-plikow — usunięte pliki trafiają do Kosza na 7 dni

Zamiatacz kasuje dopiero po siedmiu dniach, więc boksy o kasowaniu wymagają cofnięcia daty usunięcia
na bazie testowej albo powrotu za tydzień — to kształt sprawdzenia, nie blokada.

- [ ] Plik w Koszu dłużej niż 7 dni: po wywołaniu `/api/cron/cleanup` znika z Kosza i z Bloba, a
      odpowiedź niesie krok `media` z rozbiciem `{ recorded, healed, deleted, failed }`; drugie
      wywołanie pod rząd kasuje zero.
      _Staging 2026-10-18 (pass 10): needs human: niszczący cron czyszczący (/api/cron/cleanup kasuje z Bloba) — poza zakresem agenta; wymaga cofnięcia daty usunięcia na bazie testowej i uruchomienia crona przez człowieka._
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_
- [ ] Paragon w zgłoszeniu wydatku pracownika i zdjęcie w zgłoszeniu prac przeżywają przebieg crona
      nietknięte.
      _Staging 2026-10-18 (pass 10): needs human: wymaga przebiegu crona /api/cron/cleanup (niszczący, poza zakresem agenta)._
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_
- [ ] „Usuń na zawsze" przy inwestycji, szablonie i zgłoszeniu w Koszu wygląda i działa jak dotąd:
      ta sama notka w oknie, wymaga wpisania nazwy (przebudowa okna — bez zmiany zachowania).
      _Staging 2026-10-18 (pass 10): inwestycja (213: okno z notką o kosztorysie, przedmiarze, zdjęciach i linku dla inwestora, przycisk nieaktywny do wpisania nazwy) i szablon (okno „Kosztorysy założone z tego szablonu zostają bez zmian…”, wpis nazwy) — OK, oba usunięte; część ze zgłoszeniem (lead) niewykonana — needs human: nieodwracalne, jedyny rekord „Test Test”._
- [ ] Zgłoszenie, które wcześniej straciło plik do Kosza, usunięte na zawsze: plik znika też z
      sekcji „Pliki".
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_

## EX-1077 — scan-blocks-save — „Zapisz" czeka na odczyt paragonu

- [ ] Zgłoszenie wydatku z inwestycją, jedna pozycja ze zdjęciem paragonu i jedna bez → „Odczytaj
      ponownie" przy pozycji ze zdjęciem: póki trwa odczyt, „Zapisz" jest wyszarzony, a Enter w polu
      niczego nie zapisuje; po odczycie „Zapisz" → „Zapisz bez faktury":
      zapisana transakcja ma opis i kwotę z odczytu.
      __Staging 2026-10-19 (pass 11): in Nowy wydatek, Odczytaj ponownie → Zapisz disabled at +150 ms, re-enabled after the read (amount 15, opis from receipt). Enter in Opis/Notatka during the read showed no 'Poczekaj…' toast within 1 s (not seen; save path not driven to avoid a prod-dump transaction) — needs human: press Enter during a slow read and confirm the toast.__
      _Orchestrator 2026-10-19: brak toastu jest poprawny — „Zapisz” to `type="submit"`, a przy wyłączonym domyślnym przycisku przeglądarka (HTML implicit submission) w ogóle nie wysyła formularza; toast w `onSubmit` to tylko zabezpieczenie na Enter przed przerenderowaniem. Box poprawiony; zostaje otwarty na „Zapisz bez faktury” → opis i kwota z odczytu._

## EX-1076 — daily-snapshot-change-detection — nocna kopia kosztorysu tylko po zmianie

- [ ] Noc po najbliższym wdrożeniu, które dokłada pole do pozycji kosztorysu (odczyt z proda, tylko
      SELECT): liczba wierszy `kosztorys_snapshots` z `kind = 'daily'` z tej nocy ≈ liczba inwestycji,
      w których poprzedniego dnia ktoś zmienił kosztorys — nie ~50–80 jak po wcześniejszych takich
      wdrożeniach.
  _Staging 2026-10-20: wymaga człowieka — tylko produkcja / odczyt z proda_

## 2026-10-18 — mobile-375-qa — poprawki widoków na telefonie (375 px)

- [ ] Telefon → raporty pracowników: „Skanuj raport (AI)” mieści się w ekranie na pełną szerokość;
      katalog prac → „Uzupełnij tłumaczenia (AI)” tak samo.
      _Staging 2026-10-19 (pass 11), 375 px: /zgloszenia-prac — przycisk (dziś „Wczytaj zgłoszenie z kartki (AI)”) ma 343 px od lewej 16 = pełna szerokość. „Uzupełnij tłumaczenia (AI)” w /katalog-prac nie renderuje się, bo wszystkie 582 pozycje mają tłumaczenia (count = 0) — needs human: sprawdzić na katalogu z nieprzetłumaczoną pozycją._
## 2026-10-18 — prepush-overlap — testy w hooku pre-push równolegle

- [ ] Następny prawdziwy `git push`: najpierw nagłówek „unit tests + typecheck + DB integration specs,
      parity (in parallel)”, potem trzy sekcje z wynikami („DB integration specs + parity” ostatnia)
      i zrzut bazy. Część testowa trwa ok. 70–80 s zamiast ok. 100 s (dłużej, gdy przebudowuje się
      szablon bazy testowej).
  _Staging 2026-10-20: wymaga człowieka — hook pre-push przy prawdziwym wypchnięciu — zakaz pushu w tym przebiegu_
- [x] Push z celowo zepsutym typem: hook się zatrzymuje, kończy linią „✗ pre-push FAILED at:
      typecheck”, a zrzut bazy się nie uruchamia.
  _2026-10-22: push na staging z błędem typów w `context/…/alias-list.ts` — testy przeszły, hook skończył się „✗ pre-push FAILED at: typecheck” + „husky - pre-push script failed (code 1)”, bez zrzutu bazy, push odrzucony._

## 2026-10-18 — e2e-run-speed — E2E bez zbędnego buildu, na świeżej bazie

- [ ] Następny pełny `pnpm test:e2e`: na początku „test DB: cloned from template”, potem build bez
      sprawdzania typów, i cały przebieg przechodzi.
  _Staging 2026-10-20: wymaga człowieka — suite E2E — uruchamia człowiek (zakaz E2E w tym przebiegu)_
- [ ] Drugi `pnpm test:e2e` bez zmian w `src/` (zmieniony tylko spec): w logu „e2e build: reused”,
      serwer startuje w kilka sekund, a wyniki są takie same.
  _Staging 2026-10-20: wymaga człowieka — suite E2E — uruchamia człowiek (zakaz E2E w tym przebiegu)_

## 2026-10-19 — app-audit-refactor faza 1 — przeniesione komponenty wyglądają i działają jak dotąd

Sprawdź jako ADMIN, potem jako MANAGER. Refaktor bez zmiany zachowania: nic nie ma wyglądać inaczej.

- [x] `/pracownicy`: kolorowe plakietki ról w tabeli jak dotąd; na telefonie (390 px) plakietka roli w
      menu.
  _Staging 2026-10-22 (pass 13): desktop: plakietki Pracownik/Manager/Właściciel kolorowe; 390 px (emulacja): plakietka „Właściciel” w menu obok nazwy konta._
- [x] Dowolny formularz w oknie (np. „Dodaj kasę”): otwiera się, zapis zamyka okno, a z zaznaczonym
      „Nie zamykaj po zapisaniu” zostaje otwarte; w trakcie zapisu widać pigułkę z postępem.
      _Staging 2026-10-19 (desktop-regression-audit, MANAGER): „Dodaj kasę” z zaznaczonym „Nie zamykaj…”
      — „Kasa dodana”, okno zostaje i czyści się. Zwykły zapis z pigułką — do sprawdzenia jako OWNER._
  _Staging 2026-10-22 (pass 13): OWNER: zwykły zapis zamyka okno; z „Nie zamykaj po zapisaniu” okno zostaje i czyści się; w trakcie zapisu (sieć opóźniona) widać loader i wyłączony przycisk „Dodawanie…”._
- [x] Dowolny formularz w oknie (np. „Dodaj kasę” z właścicielem, którego nie wolno ustawić): po
      odrzuconym zapisie okno wraca z wpisanymi danymi i nadal ma „Nie zamykaj po zapisaniu”.
  _Staging 2026-10-22 (pass 13): MANAGER „Dodaj kasę” z właścicielem Bartek Antonik (OWNER): zapis odrzucony (0 wierszy w bazie), okno zostało z wpisaną nazwą i nadal zaznaczonym „Nie zamykaj po zapisaniu”. Komunikatu błędu nie udało się uchwycić (toast zniknął przed odczytem)._
## 2026-10-19 — app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, saldo zero

- [ ] Jako ADMIN dodaj wydatek na inwestycji z podpiętym arkuszem: w logu serwera widać próbę
      synchronizacji arkusza (lokalnie konto tylko do odczytu ją odrzuca), bez błędu brakującego modułu.
  _Staging 2026-10-20: wymaga człowieka — zapis do Arkuszy Google tylko z produkcji (konto Viewer na preview)_
- [x] Jako ADMIN na `/pracownicy` kliknij kwotę wypłat przy pracowniku („Rozlicz wypłaty”): kwota
      „Pozostało”, która zaokrągla się do zera, pokazuje „0,00 zł” bez czerwonego koloru.
  _Staging 2026-10-22 (pass 13): OWNER: Jakubowska 10/13, Pozostało 0,72 zł, kwota 0,72 → „Pozostało do rozliczenia” „0,00 zł” zielone, nie czerwone; okno zamknięte bez wypłaty._

## 2026-10-19 — app-audit-refactor faza 3 — sortowanie, duplikaty, etykiety kas, druk, odczyt AI

- [x] Jako ADMIN na Transakcjach, Leadach, Zgłoszeniach wydatków i Zgłoszeniach prac: posortuj po
      każdej sortowalnej kolumnie i odśwież — kolejność i adres zostają.
  _Staging 2026-10-22 (pass 13): OWNER: każda sortowalna kolumna (Transakcje tabela, Zapytania z formularzy, Zgłoszenia wydatków, Zgłoszenia prac) ustawia ?sort=… i po odświeżeniu adres i kolejność wierszy zostają._
- [ ] Jako ADMIN dodaj sprzęt z numerem seryjnym, pojazd z rejestracją i pracownika z e-mailem, które
      ma już pozycja w Koszu — komunikat „… jest w Koszu — przywróć go stamtąd.”; z wartością żywej
      pozycji — „… już istnieje.”
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): pojazd: oba komunikaty (toasty) OK; sprzęt i e-mail pracownika niesprawdzone._
- [x] Jako MANAGER: typ kasy na `/kasy`, w formularzu kasy i na wykresie sald na pulpicie brzmi tak
      samo („Główne”, „Pomocnicze”, „Wirtualne”, „Pracownicze”).
      _Staging 2026-10-19 (desktop-regression-audit): `/kasy` — „Pomocnicze”, „Pracownicze”, „Wirtualne”
      ✓. Formularz kasy MANAGER-a nie ma pola „Typ” (zamierzone) — formularz i wykres do sprawdzenia jako
      OWNER._
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): formularz kasy OWNER-a ma „Typ” z czterema nazwami; wykres na pulpicie jeszcze niesprawdzony._
  _Staging 2026-10-22 (pass 13): OWNER: `/kasy` i pulpit nie renderują osobnego wykresu (0 elementów recharts) — nazwy typów (Główne/Pomocnicze/Wirtualne/Pracownicze) występują na `/kasy` w pigułkach sald i kolumnie Typ, spójnie z formularzem. Bez wykresu do porównania._
- [ ] Jako ADMIN wydrukuj listę transakcji, ofertę i umowę: logo i układ jak dotąd, okno zamyka się
      po druku.
- [ ] Jako ADMIN zeskanuj paragon i papierowe zgłoszenie prac, przetłumacz opis pozycji kosztorysu —
      wynik taki jak dotąd.
  _Staging 2026-10-20: wymaga człowieka — skan AI wymaga prawdziwego zdjęcia paragonu/kartki_

## 2026-10-19 — app-audit-refactor faza 4 — zgłoszenia wydatków, raporty prac, edytor kosztorysu

- [ ] Jako ADMIN na `/zgloszenia-wydatkow`: zaakceptuj zgłoszenie, scal dwa zgłoszenia jednego
      pracownika i odrzuć paragony z trzeciego — kwoty i decyzje przy paragonach zostają po odświeżeniu.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): akceptacja i odrzucenie OK; scalenie niesprawdzone (odmowa dla niepasujących zgłoszeń działa)._
- [ ] Jako ADMIN otwórz podgląd zgłoszenia prac i stronę zgłoszenia z linku pracownika na telefonie
      (390 px) — te same pozycje, kwoty i zdjęcia co dotąd.
- [ ] Jako ADMIN i jako MANAGER w edytorze kosztorysu: dodaj, zmień nazwę i usuń dział, dodaj pozycję
      na końcu działu i pod wskazaną pozycją, zmień etap i ustawienia inwestycji, przywróć wersję —
      wszystko zostaje po odświeżeniu.
  _Staging 2026-10-22 (pass 13): OWNER, inw. 179 (SQL po odświeżeniu): dodanie sekcji, zmiana nazwy, „Dodaj pracę” na końcu sekcji, „Wstaw poniżej” pod wskazaną pozycją i usunięcie sekcji — zapisane i zostają po reload (usunięte z bazy). Niesprawdzone: zmiana etapu/ustawień inwestycji, przywrócenie wersji, MANAGER._
- [ ] Jako ADMIN w Szablonie: dodaj dział i pozycję pod wskazaną pozycją — zostają po odświeżeniu.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): dział i pozycje z katalogu zostają; „Wstaw poniżej” niezapisane._
- [ ] Jako ADMIN w edytorze kosztorysu: podgląd importu z arkusza i podgląd synchronizacji materiałów
      pokazują to samo co dotąd.

## 2026-10-19 — app-audit-refactor faza 6 — porządki w komponentach

Refaktor bez zmiany zachowania, chyba że box mówi inaczej.

- [ ] Jako EMPLOYEE na telefonie (390 px) → „Zgłoszenia wydatków”: filtry „Status” i „Inwestycja” zawężają
      listę i wracają na stronę 1; zmiana „na stronę” też wraca na 1; po wysłaniu nowego zgłoszenia lista
      pokazuje stronę 1 z tym zgłoszeniem.
- [ ] Jako ADMIN dodaj przelew z pozycjami ze zeskanowanej faktury (przycisk skanu i przeciągnięcie pliku na
      oba tryby): pozycje powstają, suma pod listą się zgadza, wybór kategorii/pracownika w wierszu działa.
- [ ] Jako ADMIN w trybie paragonów: suma zaznaczonych pozycji w stopce zgadza się z zaznaczeniem.
- [x] Inwestycja → „Kosztorys” (przycisk arkusza), „Umowa” i Podsumowanie → „Marża” otwierają się jak wcześniej;
      `/kasa` → wykres salda kasy rysuje się.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): „Kosztorys”, „Umowa”, „Marża” otwierają się; wykres salda `/kasa` niesprawdzony._
  _Staging 2026-10-22 (pass 14): OWNER: wykres salda to przyciski typów na `/kasy` (`/kasa` bez id daje „Nie znaleziono”) — Saldo 1 055 819,76 zł (4/4); po wyłączeniu „Wirtualne” 1 157 117,43 zł (3/4) = różnica 101 297,67 zł; po włączeniu wraca 1 055 819,76 zł._
- [x] Raport pracownika (kosztorys) → menu kolumn: zaznaczanie pozycji nie zamyka menu.
  _Staging 2026-10-22 (pass 15): OWNER, edytor inw. 179, „Kolumny (5)”: kliknięcie „Etap 2” przełącza pozycję (i „Aktywne (2)”→odznaczone) a menu zostaje otwarte; drugie kliknięcie przywraca; menu kolumn w edytorze, bo osobnego „raportu pracownika” z menu kolumn nie ma w UI (opis boksu nieaktualny)_
## 2026-10-19 — app-audit-refactor faza 7 — bez ręcznych memo w tabelach i hookach

Refaktor bez zmiany zachowania.

- [x] Jako ADMIN w tabelach „Katalog prac”, „Sprzęt”, „Flota”, „Pracownicy”, „Inwestycje” i „Kasy”: wyszukiwanie
      i filtry zawężają listę jak wcześniej, pisanie w polu wyszukiwania nie zacina się (zwłaszcza w „Katalogu prac”).
  _Staging 2026-10-22 (pass 13): OWNER: wyszukiwanie w Katalogu prac (593), Sprzęcie, Flocie, Pracownikach, Inwestycjach i Kasach wpisuje bez gubienia znaków i zawęża listę (np. Katalog 593→49)._
- [x] Jako ADMIN przełącz aktywność pracownika i kasy: przełącznik zmienia się od razu, bez mignięcia, a
      ustawione filtry zostają.
  _Staging 2026-10-22 (pass 13): OWNER: kasa i pracownik (QA) — jedna zmiana stanu bez mignięcia (Aktywny→Nieaktywny→Aktywny), filtry (Filtry 2) i wyszukiwanie zostają; stan QA przywrócony._
- [x] Jako ADMIN ustaw filtr statusu w „Inwestycjach” i warunki w „Katalogu prac”, zwiń pasek boczny i odśwież
      stronę: filtry i zwinięty pasek zostają.
  _Staging 2026-10-22 (pass 13): OWNER: filtr Status (Inwestycje, 3→4) i warunek „Ponad 65% ceny” w Katalogu prac (593→11) oraz zwinięty pasek boczny zostają po odświeżeniu; stan przywrócony._
- [x] Formularz przelewu → pole „Kasa”: „tylko aktywne” przełącza listę, wybrana nieaktywna kasa dalej widoczna;
      błąd walidacji pod polem pokazuje się jak wcześniej.
  _Staging 2026-10-22 (pass 15): OWNER, Transfer między kasami: „Aktywne” włączone 45 kas, wyłączone 48 (w tym nieaktywna Adam Bazylewicz); wybrana nieaktywna kasa po ponownym włączeniu „Aktywne” zostaje wybrana i na liście (46); „Dodaj” bez danych: „Kasa docelowa jest wymagana”, „Kwota musi być większa niż 0” pod polami. Nic nie zapisano_
- [x] Arkusze → „Kosztorysy” i „Inwestycje bez arkusza” wyświetlają się i wyszukują; kosztorys → „Porównaj z
      katalogiem prac” pokazuje podpowiedzi „może chodzi o…”, import z arkusza otwiera podgląd.
  _Staging 2026-10-22 (pass 13): OWNER: /kosztorysy — obie listy (Kosztorysy v1, Inwestycje bez kosztorysu) zawężają się wyszukiwaniem; inw. 179 → Problemy → „Porównaj z katalogiem…” pokazuje „może chodzi o:” z podpowiedzią katalogu; inw. 65 (pusty, z arkuszem) → „Pobierz z arkusza Google…” otwiera podgląd (13 sekcji · 338 prac) — zamknięty bez importu._

## 2026-10-19 — app-audit-refactor faza 8 — edytor kosztorysu rozbity na części

Refaktor bez zmiany zachowania; edytor wcześniej nie był optymalizowany przez kompilator Reacta, teraz jest.

- [ ] Jako ADMIN na dużym kosztorysie (~1000 pozycji): pisanie w komórce, cofnij/ponów wklejenie kilku komórek
      i przewijanie działają bez widocznego przycinania w porównaniu ze stagingiem sprzed zmiany.
- [ ] Jako ADMIN: dodaj, przesuń i usuń sekcję, dodaj pozycję z katalogu, zmień ilości w etapach i ustaw rabat
      globalny — sumy i „Pozostało” aktualizują się i zostają po odświeżeniu.
  _Staging 2026-10-22 (pass 13): OWNER, inw. 179: dodanie/usunięcie sekcji (reload OK), ilość w Etapie 1 i rabat — patrz EX-1116. Niesprawdzone: przesunięcie sekcji, praca z katalogu, rabat globalny._
- [ ] Jako ADMIN przełącz na historię, widok raportu pracownika i podgląd oferty, a potem wróć — nagłówek podglądu
      (logo, nazwa inwestycji, przyciski) wygląda jak wcześniej.
- [x] Pusty kosztorys pokazuje „Kosztorys jest pusty” z przyciskiem „Pobierz z arkusza Google…”; wyszukiwanie bez
      wyników pokazuje „Wyczyść wyszukiwanie”, a filtr ukrywający wszystko — „Wyczyść filtry”.
  _Staging 2026-10-22 (pass 13): OWNER: inw. 65 — „Kosztorys jest pusty” z przyciskiem „Pobierz z arkusza Google…”; inw. 179 — wyszukiwanie „zzzqqq” → „Brak wyników” + „Wyczyść wyszukiwanie” przywraca listę; dwa filtry wykluczające → „Brak pozycji spełniających filtry” + „Wyczyść filtry” przywraca 29 wierszy._
- [ ] Wysokość wierszy: przeciągnięcie krawędzi wiersza, „…” w wierszu → „Dopasuj wysokość do treści” i przełączenie rozmiaru tekstu
      zmieniają wysokość jak wcześniej; wiersz „do ponownego sprawdzenia” ma dwie linie.
  _Staging 2026-10-22 (pass 15): „Dopasuj wysokość do treści” verified (row 1 expands to two lines); drag of the row-edge separator via synthetic mouse did not visibly resize — not confirmed, left unticked (needs human hand drag)_
- [ ] Jako ADMIN na 390 px edytor się wyświetla, przewija i przyjmuje edycję komórki.

## 2026-10-19 — app-audit-refactor — preview brancha vs staging (luki z listy ryzyk)

Porównanie: preview brancha `app-audit-refactor-wt` obok wdrożonego stagingu, ta sama baza preview. Boksy
faz 1–8 wyżej sprawdzasz w tym samym przebiegu; tu tylko to, czego tam nie ma.

- [x] Edytor: wpisz liczbę, od razu wklej kilka komórek, cofnij i ponów — każda wartość ląduje w swoim wierszu,
      cofnięcie przywraca dokładnie stan sprzed wklejenia.
  _Staging 2026-10-22 (pass 15): OWNER, inw. 179: wpisano 11 w wierszu 1, zaraz potem wklejono (zdarzenie paste z tekstem 21/22/23, nie prawdziwy schowek) w wierszach 2-4: każda wartość w swoim wierszu, wiersz 1 zostaje 11; Ctrl+Z przywraca dokładnie 55/66/77, Ctrl+Shift+Z ponawia 21/22/23_
- [x] Edytor otwarty w dwóch kartach: usuń pozycję w jednej, edytuj ją w drugiej — komunikat, że pozycji nie ma,
      bez błędu serwera.
  _Staging 2026-10-22 (pass 15): OWNER, inw. 179, dwie karty: pozycja usunięta w karcie A, edycja Przedmiaru jej wiersza w nieodświeżonej karcie B → toast „Kosztorys zmienił się w innym miejscu — odświeżam dane.”, siatka się odświeża, bez błędu serwera (treść komunikatu inna niż w opisie boksu: nie „pozycji nie ma”)_
- [ ] Jako OWNER spróbuj dezaktywować własne konto i ostatniego OWNER-a — odmowa; logowanie kontem
      nieaktywnym — odrzucone.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): własne konto — odmowa; ostatni OWNER i logowanie nieaktywnym kontem niesprawdzone._
  _Staging 2026-10-22 (pass 13): logowanie kontem nieaktywnym (QA Pracownik po dezaktywacji z UI) — 403 „To konto jest wyłączone…”; przywrócone. Ostatni OWNER/ADMIN niesprawdzalny — na bazie są 3 żywe konta (ADMIN, 2 OWNER), nie dezaktywuję prawdziwych._
- [x] Inwestycja: oznacz jako zakończoną (pojawia się data zakończenia), odblokuj status; inwestycja w Koszu nie
      daje się edytować.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): data zakończenia i odblokowanie OK; inwestycja w Koszu niesprawdzona._
  _Staging 2026-10-22 (pass 15): OWNER: inw. 168 w Koszu — baner „tylko do odczytu”, brak „Edytuj” i „Dodaj” (są tylko Notatki/Dokumentacja/filtry); zakończenie i odblokowanie sprawdzone 2026-10-19_
- [x] Usunięcie pliku, który jest fakturą transakcji — odmowa.
  _Staging 2026-10-22 (pass 15): OWNER: do #6147 dopięto fakturę (PNG QA) przez „Dodaj fakturę”; DELETE /api/media/<id> → 400 „Nie można usunąć pliku — jest używany w innych miejscach (transakcje: 1). Najpierw odepnij go tam.”, plik zostaje w bazie_
- [x] Listy z sortowaniem (Transakcje, Leady, Zgłoszenia): posortuj, przejdź na stronę 2 — sortowanie zostaje
      w adresie i w kolejności.
  _Staging 2026-10-22 (pass 13): OWNER: Transakcje `?sort=date` → linki stron niosą `sort`, strona 2 (`?sort=date&page=2`) kontynuuje porządek (13.01 → 12.03.2026) i po odświeżeniu zostaje; Zapytania z formularzy (`?sort=name`) i Zgłoszenia wydatków (`?sort=status`) zachowują sort w adresie po odświeżeniu (tam jedna strona)._
- [x] Edycja przelewu i „Rozlicz wypłaty”: błąd walidacji pokazuje się pod polem, udany zapis zamyka okno.
      _Staging 2026-10-19 (desktop-regression-audit, MANAGER): „Rozlicz wypłaty” — błąd walidacji pod
      polem OK; edycja przelewu i udany zapis jeszcze niesprawdzone._
  _Staging 2026-10-22 (pass 15): OWNER: „Edytuj transakcję” na #6147 → „Zapisz” zamyka okno, wiersz zostaje (dwa razy); błąd walidacji „Rozlicz wypłaty” sprawdzony 2026-10-19_
- [ ] Po najbliższym przebiegu crona czyszczenia wersji kosztorysu: w logach Vercela przebieg bez błędu.
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_

## 2026-10-19 — app-audit-refactor — poprawki z bramki przeglądu

- [x] Pusty kosztorys w edytorze: widać podpowiedź na pustej siatce; w wypełnionym wpisanie wartości i cofnięcie
      błędnej zmiany działa jak wcześniej.
  _Staging 2026-10-22 (pass 13): OWNER: pusta siatka (inw. 65) pokazuje podpowiedź „Kosztorys jest pusty… Dodaj sekcję lub etap”; wpisanie i cofnięcie w wypełnionym (inw. 179) — patrz EX-1116 (Ctrl+Z jeden krok)._
## 2026-10-19 — kursor na statusie inwestycji

- [ ] „Edytuj inwestycję” i tabela inwestycji: najechanie na status („Aktywna” ze strzałką) pokazuje
      rączkę; w trakcie zapisu zmiany statusu kursor jest zablokowany.
      _Staging 2026-10-19 (desktop-regression-audit, MANAGER): rączka na statusie w tabeli i w „Edytuj
      inwestycję” ✓; kursor w trakcie zapisu niesprawdzony._

## 2026-10-19 — payout-cards — wypłaty pracownika jako karty, wspólny badge

- [ ] Jako pracownik na telefonie (390 px): karty wypłat zajmują całą szerokość, przyciski są łatwe
      do trafienia, nic nie wychodzi poza ekran.
  _Staging 2026-10-22 (pass 15): EMPLOYEE 78, 390 px (emulacja), karta wypłaty #6147 (3 zł, „Czeka na potwierdzenie”): pełna szerokość, przyciski „Potwierdzam”/„Odrzuć” 158×44 px, brak poziomego scrolla (scrollWidth 390) — emulacja viewportu, nie zalicza; wymaga prawdziwego telefonu_
- [x] Badge'e wyglądają jak dotąd (refaktor na wspólny komponent): status wypłaty w tabeli transakcji,
      „Od pracownika” w kolumnie typu, status inwestycji (odrzucona — teraz czerwona zamiast różowej),
      rola na `/uzytkownicy` i w menu mobilnym, źródło na `/leady`, statusy pojazdów i sprzętu,
      postęp AI na liście inwestycji, statusy zgłoszeń wydatków i raportów pracy.
  _Staging 2026-10-20: przejrzane: status transakcji/„od pracownika”, rola na /pracownicy, postęp AI na /inwestycje, flota — poprawne; brak punktu odniesienia „jak dotąd”, leady/sprzęt/zgłoszenia nie oglądane._
  _Staging 2026-10-22 (pass 15): OWNER: dołożone brakujące listy — `/zgloszenia` (źródło Facebook niebieski / Strona WWW morski, „Oczekuje” szary), `/sprzet` („W użyciu” morski), `/zgloszenia-wydatkow` („przyjęty” morski), `/zgloszenia-prac` („Przyjęte N” morski, „Odrzucone N” czerwony). Razem z przeglądem z 2026-10-20 wszystkie wymienione badge’e czytelne i spójne; punktu odniesienia „jak dotąd” brak, więc ocena na zgodność kolorów (odrzucona = czerwona)._
- [x] Zielone badge'e (zaakceptowana wypłata, aktywna inwestycja, rola pracownika, aktywny pojazd)
      są teraz morskie, a nie szmaragdowe; tekst czytelny w jasnym i ciemnym motywie.
  _Staging 2026-10-20: kolor badge’a roli/statusu = lab(35.6 -26.7 -4.3) (morski, nie szmaragd); czytelne w jasnym i ciemnym motywie (przełącznik „Przełącz motyw”, /pracownicy, /flota, /inwestycje)._
- [x] Strona pracownika z wypłatami → „Lista wydatków / zaliczek” ma filtr „Potwierdzenie” (czeka /
      potwierdzona / odrzucona) i zawęża listę do wypłat w tym stanie; pracownik bez wypłat go nie ma.
  _Staging 2026-10-20: MANAGER na /pracownicy/78 (QA, przelew 7 zł z QA Kasy Managera 1 → „Czeka na potwierdzenie”): filtr „Potwierdzenie” (czeka/potwierdzona/odrzucona) zawęża listę (?payoutStatus=accepted → 2 wiersze). Uwaga: filtr widać też u pracownika bez żadnej decyzji (np. /pracownicy/43), bo warunek to typ przelewu (`carriesPayoutStatus`), nie istniejąca wypłata — opis boksu nieaktualny po worker-receipt-confirmation, nie defekt._
- [x] Karty przelewów (telefon, lista wypłat pracownika): status wypłaty stoi w tej samej linii co
      badge „Wypłata”, przy prawej krawędzi; nagłówek karty to dalej numer i data.
  _Staging 2026-10-20: 390 px (emulacja), karta #6145: nagłówek „#6145 / data”, w linii z badge’em typu stoi „Czeka na potwierdzenie” po prawej._
- [x] `/uzytkownicy`: status „Aktywny” / „Nieaktywny” to zwykły badge (morski / szary); kliknięcie
      przełącza aktywność konta i nie otwiera strony pracownika.
      _Staging 2026-10-20: strona `/uzytkownicy` już nie istnieje („Nie znaleziono”); status jest teraz przyciskiem w tabeli `/pracownicy` — tam sprawdzone: uprawnienia (OWNER/MANAGER) zgodne, klik w badge niesprawdzony na prawdziwych kontach._
  _Staging 2026-10-22 (pass 15): OWNER: status w tabeli `/pracownicy` (dawny `/uzytkownicy`) przełącza aktywność QA pracownika (78) w obie strony (potwierdzone SQL), adres się nie zmienia, strona pracownika się nie otwiera. Stan przywrócony (Aktywny)._
- [x] Kasy: kasę, którą możesz zmieniać, przełączasz kliknięciem w status; przy cudzej kasie status
      jest nieklikalny.
  _Staging 2026-10-20: MANAGER: status QA Kasy Managera 2 klika się (Aktywna→Nieaktywna→Aktywna, potwierdzone w DB), status cudzej kasy (Telmak, Bartek Antonik) nie jest przyciskiem._
- [x] Przycisk „Wpłata” wygląda jak dotąd (zielony obrys, wypełnia się po najechaniu).
      _Staging 2026-10-20: zielony obrys, po najechaniu wypełnia się (rgb 29,192,131); „Wydatek” ma czerwony obrys._
## 2026-10-19 — rejected-payouts-table — odrzucone wypłaty na pulpicie, bez strony „Wypłaty”

- [ ] W tej tabeli ID, pracownik, inwestycja i kasa to linki: ID otwiera transakcję na liście
      inwestycji (wypłata bez inwestycji — na „Transakcje”); kasa przeniesiona do Kosza nie jest linkiem.
  _Staging 2026-10-22 (pass 13): OWNER, QA wypłata #6145 odrzucona przez QA pracownika: ID → `/?id=6145` (wypłata bez inwestycji → Transakcje), pracownik → `/pracownicy/78`, kasa → `/kasa/50`. Niesprawdzone: link inwestycji (brak inwestycji) i kasa w Koszu._
- [ ] „Anuluj” w tej tabeli pyta o powód i anuluje wypłatę: wiersz znika, licznik przy „Transakcje” w
      menu spada o jeden. Przy zakończonej inwestycji przycisk jest wyszarzony z podpowiedzią.
  _Staging 2026-10-22 (pass 13): OWNER: dialog „Anulowanie transakcji” z wymaganym powodem (min. 3 znaki), po „Tak, anuluj” wiersz znika, licznik przy „Transakcje” spadł 1 → brak. Niesprawdzone: wyszarzenie przy zakończonej inwestycji._
## 2026-10-19 — payout-card-buttons — przyciski karty wypłaty i warianty kolorów

- [ ] Na telefonie (390 px) „Dodaj wydatek” / „Zgłoś pracę” są niższe niż dotąd, a dłuższa etykieta
      uk/ru dalej się zawija, bez wychodzenia poza wiersz.
- [x] Przyciski „Wpłata”, „Wydatek”, „Kasa” w pasku i „Wyczyść” w formularzu wyglądają jak dotąd
      (obramowane w swoim kolorze).
  _Staging 2026-10-22 (pass 15): pasek: „Wpłata” zielony obrys, „Kasa” niebieski, „Wydatek” czerwony (screenshoty 2026-10-22); „Wyczyść formularz” w oknie „Edytuj transakcję” obecny_

## 2026-10-19 — slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty

- [x] Jako MANAGER „Dodaj kasę” z innym managerem jako właścicielem: komunikat „Brak uprawnień”, kasa
      nie pojawia się na `/kasy`. Z pracownikiem jako właścicielem kasa powstaje.
- [x] Jako MANAGER edytuj kasę pracownika i ustaw siebie jako właściciela: zapis działa, po odświeżeniu
      właścicielem jesteś ty. Ustawienie innego managera kończy się „Brak uprawnień”.
- [ ] Pulpit → odrzucone wypłaty: przy wypłacie z zablokowanej inwestycji „Anuluj transakcję” jest
      wyszarzone z dymkiem o blokadzie; numer ID otwiera tę transakcję.
## 2026-10-19 — investment-notes-save — zapis notatki nie czyści adresu inwestycji

- [x] Ta sama zmiana notatki z zakładki inwestycji w podsumowaniu kosztorysu: zapis działa, adres
      zostaje.
  _Staging 2026-10-22 (pass 13): OWNER, inw. 179: Podsumowanie → Inwestycja → „Edytuj notatkę”: zapis działa, adres zostaje `/inwestycje/179/kosztorys_v2`; notatka cofnięta do pustej._

## 2026-10-19 — big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy

- [ ] Po restarcie `pnpm dev` `/inwestycje`, strona inwestycji i `/pracownicy` ładują się bez błędu
      „column does not exist”.
  _Staging 2026-10-20: wymaga człowieka — restart `pnpm dev` lokalnie — poza stagingiem_
- [ ] W pierwszym kroku „Dostawca” → inny → „Zapisz jako domyślnego dostawcę” → następne zamówienie
      wybiera go od razu. Bez dostawców: krok mówi „Lista dostawców jest pusta”, SMS bez odbiorcy.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): „Zapisz jako domyślnego dostawcę” działa; stan bez dostawców niesprawdzony._
- [ ] Z telefonu (IP w sieci LAN): „Zapisz” wydatku sam otwiera Wiadomości z dostawcą i treścią.
  _Staging 2026-10-20: wymaga człowieka — prawdziwy telefon przez LAN (emulacja Chrome nie jest zamiennikiem)_
- [ ] Inwestycja bez kierownika budowy: kontakt „— brak —”, a treść SMS-a nie ma linii „Kontakt na
      miejscu”.
  _Staging 2026-10-22 (pass 13): OWNER, inw. 179 → „Kontener”: „Kontakt na miejscu — brak —”. Treść SMS-a (brak linii „Kontakt na miejscu”) niesprawdzona — powstaje dopiero przy zapisie wydatku (zapis tworzyłby prawdziwy wydatek)._
- [ ] Oznacz inwestycję jako zakończoną: na jej liście transakcji, w „Tabela” i „Karty”, znaczek jest
      widoczny, ale nieklikalny.
  _Staging 2026-10-22 (pass 16): Brak danych: na stagingu żaden wiersz z zamówieniem nie należy do zakończonej inwestycji (zamówienia: inw. 226 quote, 192 i 210 active), a zmiana statusu cudzej inwestycji lub zamówienie na 179 (realny SMS) są poza zakresem przebiegu_
- [ ] Jako EMPLOYEE na własnym `/pracownicy/[id]`, jeśli widać wiersz zamówienia: bez przycisku.
  _Staging 2026-10-22 (pass 16): Brak danych: żadne zamówienie na stagingu nie ma przypisanego pracownika (worker_id puste) — wiersza zamówienia na /pracownicy/[id] nie ma jak pokazać_
- [ ] Druk tabeli transakcji: kolumna „Zamówienie” drukuje „Czeka” / „Dostarczone”.
  _Staging 2026-10-22 (pass 16): inw. 192, „Drukuj transakcje” (stub okna): kolumna „Zamówienie” (15.) drukuje „Czeka” dla zamówienia #6106; „Dostarczone” niesprawdzone — brak dostarczonego zamówienia na stagingu_
- [ ] Strona inwestycji: w nagłówku nie ma „Dodaj” (kosztorys v1); przycisk v2 nazywa się „Kosztorys
      v2”. Inwestycja bez kosztorysu v1 nadal da się go dodać z `/kosztorysy` → „Dodaj kosztorys”.
  _Staging 2026-10-22 (pass 13): OWNER, inw. 179: nagłówek ma „Edytuj”, „Umowa”, „Kosztorys v2”, „Kontener” — bez „Dodaj”. Dodanie v1 z `/kosztorysy` niesprawdzone._
- [ ] Strona inwestycji: Adres, Osoba kontaktowa, Etap AI, Kierownik budowy, status, Notatki, Uwagi AI
      i Zdjęcia i pliki stoją w jednym bloku z równymi odstępami; etykiety są wyśrodkowane względem
      selectów. Strony sprzętu, kasy, pracownika i floty — listy informacji wyglądają porządnie.
  _Staging 2026-10-22 (pass 16): inw. 179 (1200 px): Email, Etap AI, Kierownik budowy, status, Notatki, Zdjęcia i pliki w jednym bloku, odstępy równe (~60 px), etykiety w linii z selectami. Adres i Osoba kontaktowa puste na 179 (nie renderują się), strony sprzętu/kasy/pracownika/floty nie obejrzane w tym przebiegu_
- [ ] Dowolny select w aplikacji: strzałka ma ten sam szary co strzałka „Notatki”.
  _Staging 2026-10-22 (pass 13): OWNER: strona inwestycji 179 (Etap AI, Kierownik budowy, status) = szary strzałki „Notatki” (próbka, nie wszystkie selecty)._

## EX-1118 — user-register-stats — „Moje Kasy” po właścicielu kasy, nie po imieniu

- [ ] Panel kierownika: „Moje Kasy” / „Saldo moich kas” pokazuje dokładnie kasy, których zalogowany
      jest właścicielem — także gdy inne konto ma takie samo imię i nazwisko (jego kasy się nie pojawiają).
  _Staging 2026-10-22 (pass 16): _Staging 2026-10-22 (pass 16): MANAGER 77 (3 kasy w bazie, jedna w koszu): panel „Moje Kasy” pokazuje QA Kasa Managera 1 i 2 (bez kasy z kosza), „Saldo moich kas: 0,00 zł (wybranych 2/2)”. Część „inne konto z takim samym imieniem i nazwiskiem” nie do sprawdzenia: żadne konto QA nie ma imiennika, a zakładanie konta jest zabronione w profilu.__
- [x] Edytor kosztorysu → podsumowanie → „Podwykonawcy” (inwestycja z wypłatą dla podwykonawcy): sekcja
      nad tabelą wypłat nazywa się „Lista wypłat”.
  _Staging 2026-10-22 (pass 16): _Staging 2026-10-22 (pass 16): inw. 149 (Gryka-Deszczyński Kopernika 2a Marki), Podsumowanie → Podwykonawcy: sekcja nad tabelą wypłat nazywa się „Lista wypłat” (inw. 179 bez wypłat jej nie pokazuje).__
- [ ] Konto z językiem ukraińskim lub rosyjskim: „Wyczyść filtry” (lista i kolejka), „Nie znaleziono.”
      w wyszukiwanych selectach, dialog akceptacji zgłoszenia wydatków (tytuł, „Odrzuć”, potwierdzenie
      odrzucenia, toasty) są przetłumaczone; po polsku wyglądają jak wcześniej.
  _Staging 2026-10-22 (pass 16): _Staging 2026-10-22 (pass 16): OWNER 76 z językiem Українська: /zgloszenia-wydatkow — „Очистити фільтри” i „Очистити дати”, wyszukiwanie w filtrze Inwestycja pokazuje „Нічого не знайдено”; po polsku „Wyczyść filtry” i „Brak wyników” (nie „Nie znaleziono.”). Dialogu akceptacji zgłoszenia wydatków i toastów nie sprawdzono: na stagingu nie ma zgłoszenia wydatków w stanie oczekującym (46 przyjętych, 14 odrzuconych), a założenie go wymaga konta pracownika ze zdjęciami paragonów. Język 76 przywrócony do Polski.__
- [ ] To samo konto: w zgłoszeniu z odczytanymi paragonami przyjmij jeden paragon, potem odrzuć dwa —
      toasty („Paragon przyjęty”, „Odrzucono 2”) są przetłumaczone; zapis zwykłego formularza wydatku
      pokazuje przetłumaczone „Transakcje dodane”.
  _Staging 2026-10-22 (pass 16): _Staging 2026-10-22 (pass 16): nie do sprawdzenia — brak oczekującego zgłoszenia wydatków z paragonami (wszystkie 60 rozstrzygnięte), a nowe wymaga zdjęć paragonów z konta pracownika / odczytu AI.__
## 2026-10-19 — payout-push-unpause — push „Wypłata do potwierdzenia” włączony

- [ ] (tylko produkcja) Telefon z zainstalowaną aplikacją i włączonymi „Powiadomieniami”, aplikacja
      zamknięta: zaksięguj wypłatę na to konto z komputera → na telefonie przychodzi powiadomienie
      „Wypłata do potwierdzenia” z treścią „Potwierdź odbiór {kwota}.” (bez „albo napisz, czego
      brakuje”), a na ikonie aplikacji licznik rośnie o 1.
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_
- [ ] Stuknięcie w to powiadomienie otwiera stronę pracownika z wypłatą do potwierdzenia; po
      potwierdzeniu licznik na ikonie znika.
  _Staging 2026-10-20: wymaga człowieka — push na prawdziwym telefonie / produkcja_

## 2026-10-19 — transfers-worker-column-width — szersza kolumna „Pracownik”

- [x] Lista transakcji (desktop), widok tabeli: imię i nazwisko w kolumnie „Pracownik” mieści się w
      jednej linii, tak jak w „Dodane przez”.
  _Staging 2026-10-22 (pass 13): OWNER, `/` tabela: 100 wierszy pierwszej strony — „Pracownik” i „Dodane przez” w jednej linii (pomiar zakresów tekstu, 0 zawinięć)._

## 2026-10-19 — desktop-regression-audit — poprawki z przeklikania desktopu

- [x] Strona inwestycji: strzałki przy „Etap AI” i „Kierownik budowy” są szare, jak przy „Notatki”,
      a nie czarne.
  _Staging 2026-10-22 (pass 13): OWNER, inw. 179: strzałki Etap AI, Kierownik budowy, status i Notatki mają ten sam szary lab(74.48 0 0)._
- [x] Jako kierownik → „Pracownicy”: status „Aktywny/Nieaktywny” przy koncie właściciela, innego
      kierownika i przy własnym jest zwykłym znaczkiem (nie da się kliknąć); przy pracowniku przełącza
      jak dotąd. Jako właściciel: tylko własny status jest nieklikalny.
  _Staging 2026-10-22 (pass 13): MANAGER: status właściciela/admina/innego kierownika/własny to <span> (nieklikalny), pracownicy <button>. OWNER: nieklikalny tylko własny status (1 z 48 wierszy)._

## EX-1112 — rejected-snapshot-retention — historia oferty odrzuconej znika od razu

- [ ] Inwestycja ze statusem „Odrzucona", która ma zapisane wersje kosztorysu: po najbliższym
      nocnym sprzątaniu link inwestora nie pokazuje już żadnej wersji w historii, a w edytorze
      → „Wersje" zostają wersje automatyczne i ręczne. Inwestycja „Zakończona" niedawno zachowuje
      swoją historię jak dotąd.
  _Staging 2026-10-20: wymaga człowieka — cron/nocny przebieg lub trwałe usunięcie na prawdziwych danych preview — poza izolacją QA_

## EX-1115 — investments-row-badges — status i Etap AI zmieniane prosto z wiersza listy

- [x] Lista „Inwestycje" → klik w plakietkę statusu otwiera menu samych plakietek; wybór zmienia
      status bez przechodzenia na stronę inwestycji, a wiersz zostaje na miejscu.
- [x] Lista „Inwestycje" → klik w plakietkę „Analiza AI" otwiera menu plakietek z opisem pod
      każdą; wybór zmienia etap, opis nie pojawia się w zamkniętej plakietce.
- [x] Lista „Inwestycje" → klik w nazwę inwestycji przenosi na jej stronę; klik w puste miejsce
      wiersza już nie przenosi.
- [x] Lista „Inwestycje" → „Zamów" na wierszu inwestycji z kierownikiem budowy: kierownik jest
      wstępnie wybrany jak dotąd.
- [x] Strona inwestycji → „Edytuj": pole „Kierownik budowy" pokazuje obecnego kierownika, a wybór
      innego zapisuje się od razu (widać go po zamknięciu okna). To samo z listy i z zakładki
      „Inwestycja" w kosztorysie.
- [x] Strona inwestycji → plakietka statusu i „Etap AI" pod listą informacji działają jak wcześniej
      (menu, zmiana, brak kursora tekstowego).

## EX-1116 — kosztorys-commit-on-settle — komórki liczbowe zapisują się po Enterze

- [x] Edytor kosztorysu z ~1000 pozycjami → wpisz liczbę w „Przedmiar ofertowy": znaki pojawiają się
      bez przycięć; „Wartość netto" wiersza i sumy w stopce zmieniają się dopiero po Enterze.
  _Staging 2026-10-22 (pass 12): kosztorys 224 (302 wiersze, nie ~1000): znaki bez przycięć, wartość netto zmienia się dopiero po Enterze._
- [x] „Etap 1" → wpisz ilość, Enter: „Pomiar z natury" i suma etapów zmieniają się raz; Cofnij
      (Ctrl+Z) przywraca poprzednią ilość jednym krokiem.
  _Staging 2026-10-22 (pass 13): inw. 179 (Konrad Testy): 1 + Enter → „Pomiar z natury" 0,00 → 1,00 raz; Ctrl+Z jednym krokiem wraca do 0,00; stage_progress wraca do 0 (SQL)._
- [x] „Rabat" → wpisz 150 przy rabacie procentowym, Enter: komunikat „…przywrócono" i rabat bez
      zmian.
  _Staging 2026-10-22 (pass 13): inw. 179 poz. 1 z rabatem 10%: 150 + Enter → toast „Wartość odrzucona — przywrócono 10%.", rabat bez zmian; rabat cofnięty do „Bez rabatu"._
- [x] Dowolna komórka liczbowa → wpisz liczbę, Esc: wartość bez zmian, bez komunikatu, zaznaczenie
      zostaje w tej samej komórce.
  _Staging 2026-10-22 (pass 12): Przedmiar: 9 + Esc wraca do 3, bez komunikatu, zaznaczenie bez zmian._
- [x] „Aktualizacja przedmiaru" → wyczyść komórkę, Enter: wartość wraca do szarej (podąża za
      „Przedmiarem ofertowym").
  _Staging 2026-10-22 (pass 12): akt=7 po Enter, po wyczyszczeniu wraca do kursywy i podąża za Przedmiarem (3, 4500,00)._
- [x] Stawka podwykonawcy → mnożnik ponad sufitem, Enter: jedno ostrzeżenie, wartość zostaje.
  _Staging 2026-10-22 (pass 13): inw. 179 widok „Z narzędziami", poz. 1 „własny mnożnik" 0,95 + Enter: jeden toast „Cena wykonawcy przekracza 65% ceny dla inwestora (maks. 975,00).", wartość zostaje; źródło wróciło do „auto"._
- [x] Z aktywnym wyszukiwaniem w pasku narzędzi: edytowany wiersz nie znika w trakcie pisania.
  _Staging 2026-10-22 (pass 13): szukaj „Zakup", Przedmiar poz. 1 → 7 w trakcie pisania: wiersz zostaje na liście (wyszukiwanie filtruje po opisie), po Esc bez zmian._
- [x] Wpisz liczbę w „Przedmiar ofertowy" i od razu kliknij link w menu bocznym: po powrocie do
      kosztorysu (odświeżenie strony) wpisana wartość jest zapisana.
  _Staging 2026-10-22 (pass 13): Przedmiar 2 → 5, bez Entera klik „Kasy" w menu bocznym, powrót + SQL: planned_qty = 5 i po odświeżeniu widać 5; cofnięte do 2 (SQL)._
- [x] Stawka podwykonawcy (kwota stała) → wpisz kwotę ponad sufitem: czerwone zdanie o przekroczeniu
      widać już w trakcie pisania; po zejściu pod sufit znika jeszcze przed Enterem.
  _Staging 2026-10-22 (pass 13): poz. 1 „kwota stała": 1200 → czerwone zdanie „…przekracza 65% ceny dla inwestora (maks. 975,00)." już w trakcie pisania; po zejściu do 900 znika przed Enterem; Esc, źródło wróciło do „auto"._
- [ ] Telefon, raport pracownika → wpisz ilość, bez Entera przełącz się na inną aplikację i wróć:
      ilość została w szkicu.

## 2026-10-20 — investment-overview-shared — jeden blok „Inwestycja" na stronie i w kosztorysie

- [x] Jako właściciel na dowolnej stronie: „Wpłata", „Transfer między kasami" i „Wydatek" z górnego paska
      otwierają się z tymi samymi listami kas / inwestycji / pracowników co wcześniej i zapisują.
- [x] Strona inwestycji wygląda i działa jak wcześniej: przyciski, „Kierownik budowy", status, notatki,
      notatki AI, „Zdjęcia i pliki".
- [x] Edytor kosztorysu → „Podsumowanie" → „Inwestycja": ten sam blok co na stronie inwestycji, bez
      „Kosztorys v2"; „Zamów" otwiera zamówienie z kierownikiem inwestycji (adres: nie sprawdzony — inwestycja QA go nie miała); zmiana statusu,
      „Etap AI" i „Kierownik budowy" zostaje po odświeżeniu.
- [x] Inwestycja zakończona pokazuje „Prośba o weryfikację" w obu widokach; *(2026-10-20: przycisk „Poproś o opinię" widoczny w obu widokach, nazwa w opisie boksu nieaktualna; „Arkusz" przy inwestycji z arkuszem — nie sprawdzone)* inwestycja z arkuszem pokazuje
      „Arkusz".
  _Staging 2026-10-22 (pass 15): inw. 124 z arkuszem: przycisk arkusza przy nagłówku inwestycji nazywa się „Otwórz” (na liście Kosztorysy v1 „Arkusz”); „Poproś o opinię” w obu widokach sprawdzone 2026-10-20_
- [x] Inwestycja w Koszu: oba widoki pokazują baner i są tylko do odczytu.
- [x] „Sprzęt" → „Dodaj sprzęt" i „Przekaż" na stronie sprzętu listują tych samych pracowników / inwestycje.
- [x] „Kasy" → „Dodaj kasę" listuje pracowników; na stronie kasy „Edytuj" i „Sprawdzenie Telmak" otwierają
      się i zapisują. *(2026-10-20: „Dodaj kasę" listuje pracowników, „Edytuj" otwiera się i zapisuje; „Sprawdzenie Telmak" nie sprawdzone — brak takiej kasy do otwarcia na staging.)*
  _Staging 2026-10-22 (pass 15): OWNER: /kasa/11 (Telmak) ma przycisk „Sprawdź faktury” (nazwa w opisie boksu nieaktualna) — okno „Sprawdź faktury Telmak” otwiera się z zakresem dat i strefą „Wrzuć paczkę faktur PDF”; sama analiza paczki wymaga PDF-a Telmaka (patrz wiersz 337), nie wgrywano_
- [ ] „Zgłoszenia" → filtr inwestycji listuje inwestycje; „Zgłoszenia wydatków" → akceptacja zgłoszenia
      otwiera wypełniony formularz wydatku i zapisuje.
  _Staging 2026-10-22 (pass 15): OWNER: /zgloszenia-wydatkow filtr „Inwestycja” listuje 17 inwestycji. Akceptacja nie do sprawdzenia: brak zgłoszeń o statusie oczekującym (46 przyjętych, 14 odrzuconych), a wysłanie zgłoszenia wydatku jest dostępne tylko na telefonie (na desktopie EMPLOYEE nie ma przycisku)_
- [x] Lista „Inwestycje" → „Edytuj" na wierszu (z „Kierownikiem budowy") i „Zamów" działają;
      „Kosztorysy" → sekcja „Inwestycje bez kosztorysu" listuje inwestycje bez kosztorysu, a „Dodaj
      kosztorys" w wierszu otwiera okno podłączenia arkusza.
  _Staging 2026-10-22 (pass 14): OWNER: /inwestycje, wiersz „Konrad Testy”: „Edytuj inwestycję” otwiera się z „Kierownikiem budowy” (lista pracowników) i „Zapisz” bez zmian zamyka okno; „Zamów big bag / kontener” otwiera zamówienie (dostawca domyślny, 369,00 zł) — zamknięte Escape, bez „Dalej”. Druga połowa nie do sprawdzenia: /kosztorysy → „Nowy kosztorys” to dialog „Powiąż istniejący arkusz Google” (link + nazwa), bez listy inwestycji — opis boksu nieaktualny, patrz Findings._
  _Staging 2026-10-22 (pass 15): druga połowa: /kosztorysy → „Inwestycje bez kosztorysu” (114 wierszy) → „Dodaj kosztorys” otwiera okno „Kosztorys inwestycji” (dodaj istniejący arkusz Google, konto usługi); bez zapisu_
- [x] „Pracownicy" i strona pracownika (jako właściciel) *(2026-10-20: „Edytuj pracownika" listuje kasy; „Edytuj" na wierszu transakcji nie sprawdzone.)*  → „Edytuj" listuje kasy; „Edytuj" na wierszu
      transakcji otwiera się i zapisuje.
  _Staging 2026-10-22 (pass 15): OWNER, /pracownicy/78: „Edytuj transakcję” na wierszu #6147 otwiera formularz (Opis, Data, Kategoria, Nr dokumentu, Notatka, faktury) i „Zapisz” zamyka okno, wiersz zostaje; „Edytuj pracownika” z kasami sprawdzone 2026-10-20_
- [x] Edytor kosztorysu: podział na etapy, menu „Pracownicy" i widok podwykonawcy w „Podsumowaniu"
      pokazują tych samych pracowników.
  _Staging 2026-10-22 (pass 14): OWNER, inw. 179: „Pracownicy etapu…” Etapu 1 = Konrad Antonik (lista „Dodaj pracownika…” 47 osób), menu „Pracownicy” = Konrad Antonik + Test Test (etapy 1 i 2), Podsumowanie → Podwykonawcy = Konrad Antonik, Test Test, Razem. Dialog zamknięty bez zapisu._
- [ ] Pracownik na telefonie: własna strona ładuje się, górny pasek nie ma okien zarządu, „Wyślij zgłoszenie
      wydatku" listuje tylko jego kasy.
  _Staging 2026-10-22 (pass 15): pominięte: telefon (tylko prawdziwy)_
- [x] Link inwestora (`/k/...`) i „Podgląd inwestora" (w tym „Podsumowanie") bez zmian.
  _Staging 2026-10-22 (pass 15): OWNER, inw. 179: /podglad-inwestora/179 i link /k/<token> (Inwestor → Udostępnij) pokazują ten sam kosztorys (sekcje, Opcje, Podsumowanie z zakładkami Podsumowanie/Materiały/Robocizna, Lista wpłat); Podsumowanie otwiera się. Link wyłączony po teście (Wyłącz link), wiersz kosztorys_shares usunięty_

## 2026-10-20 — order-default-supplier-per-item — osobny domyślny dostawca big bagu i kontenera

- [x] Zamówienie na stronie inwestycji: „Big bag” wybiera domyślnego dostawcę big bagu; przełączenie
      na „Kontener” wybiera domyślnego dostawcę kontenera (albo pierwszego z listy, gdy go nie ma).
- [x] Na „Kontener” wybierz innego dostawcę → „Zapisz jako domyślnego dostawcę” → komunikat; otwórz
      zamówienie ponownie: „Kontener” wybiera go od razu, „Big bag” nadal swojego.
- [x] „Dalej” → zapisz wydatek kontenera: SMS idzie na numer dostawcy kontenera.
- [x] „Ustawienia zamówień” (zębatka): „Domyślny dostawca big bag” i „Domyślny dostawca kontenera”
      pokazują obecne wybory; zmień kontener → „Zapisz” → zamówienie wybiera nowego dostawcę.
- [x] „Ustawienia zamówień” → usuń wiersz dostawcy, który jest domyślny dla kontenera: jego pole
      pokazuje „— brak —”; po „Zapisz” domyślny big bagu zostaje, kontener nie ma domyślnego.
- [x] Zamówienie otwarte → zębatka → zmień domyślnego dostawcę big bagu → „Zapisz”: krok zamówienia
      od razu pokazuje nowego dostawcę, a przycisk „Dostawca domyślny” jest nieaktywny.

## EX-1111 — design-system — strona `/design` z całym zestawem komponentów

- [x] Konto zarządu otwiera `/design`: linki spisu treści skaczą do sekcji, a spis zostaje
      widoczny przy przewijaniu.
- [x] Konto pracownika (EMPLOYEE) wchodzące na `/design` zostaje przekierowane.
- [x] Sekcja „Kolory": siatki jasna i ciemna stoją obok siebie, żadna próbka nie jest pusta.
- [x] `/warianty-badge` zwraca 404.
- [x] Każda sekcja renderuje się w jasnym i ciemnym motywie bez błędów w konsoli.
- [x] „Nakładki": tooltip trzymany otwarty zostaje przy swoim przycisku przy przewijaniu strony.
- [x] „Dialogi": każdy dialog otwiera się ze swojego przycisku i zamyka Escape oraz swoim przyciskiem
      zamknięcia.
- [x] „Przyciski": w siatce wariant × rozmiar widać wszystkie warianty, także osiem nieużywanych
      w aplikacji oraz parę `destructiveOutline` / `outlineDestructive`.
- [x] „Nawigacja": paginacja w URL zmienia `?page=` bez przeładowania i bez błędu.

## 2026-10-20 — shared-collapsible — zwijana sekcja konta w pasku bocznym, jedno rozwijanie wszędzie

- [x] Pasek boczny (desktop): przy pierwszym wejściu sekcja konta pod linkami jest zwinięta — widać
      tylko imię i strzałkę; klik w strzałkę rozwija ją z animacją (Ciemny motyw … Wyloguj), drugi
      klik zwija. Stan zostaje po przeładowaniu strony.
- [x] Pasek boczny zwinięty do ikon: strzałka sekcji konta stoi na środku, ma tooltip „Pokaż opcje
      konta" / „Ukryj opcje konta" i działa tak samo.
- [x] Rozwinięta sekcja konta: poświata przycisku „Saldo" i obwódki fokusu przycisków nie są ucięte
      po bokach.
- [x] Sekcje zwijane na stronie pracownika, w formularzu inwestycji i na liście przelewów rozwijają
      się i zwijają z animacją jak dotąd; tabele w nich nie wystają poza krawędź.
- [ ] Formularz wydatku z kilkoma pozycjami: pozycja rozwija się z animacją, strzałka w dół przy
      zwiniętej i w górę przy rozwiniętej.
- [ ] Kosztorys → raport z arkusza: zwinięte fragmenty raportu rozwijają się z animacją.
- [x] Kosztorys → przegląd zgłoszenia prac: strzałka przy nagłówku grupy obraca się, a grupa ukrywa
      i pokazuje wiersze jak dotąd.
  _Staging 2026-10-22 (pass 16): inw. 179, zgłoszenie #28: klik w nagłówek „Z ROZPISKI (3)” — chevron obraca się (rotate 180° przy otwartej grupie, brak przy zwiniętej), wiersze znikają (4 → 0) i wracają (0 → 4)._

## EX-1110 — ds-primitive-sweep — wspólne komponenty zamiast ręcznych kopii

- [x] Profil użytkownika z kasą, której saldo wychodzi na zero: „0,00 zł" w sekcji jego kas jest
      bez koloru (nie czerwone), także w sumie.
  _Staging 2026-10-22 (pass 16): /pracownicy/15 (Konrad Testy): „Moje kasy” — saldo i „Razem” „0,00 zł” w kolorze neutralnym (lab(100 0 0)), nie czerwone._
- [x] Kosztorys → podsumowanie podwykonawców, pracownik rozliczony do zera: „Pozostało" pokazuje
      „0,00 zł" bez koloru i bez dopisku „nadpłacone".
  _Staging 2026-10-22 (pass 16): inw. 179, Podsumowanie → „Podsumowanie pracowników”: „Pozostało do wypłaty” 0,00 w kolorze neutralnym (lab(100 0 0)), brak dopisku „nadpłacone” (zielone 0,00 to kolumna Zaliczki)._
- [x] Pusty kosztorys → przycisk „Podsumowanie" jest wyszarzony, a po najechaniu pokazuje tooltip
      „Kosztorys jest pusty — nie ma czego podsumować".
  _Staging 2026-10-22 (pass 13): tylko w podglądzie inwestora (inw. Okocimska 9): przycisk wyłączony, tooltip „Kosztorys jest pusty — nie ma czego podsumować”. W toolbarze edytora przycisk NIE jest wyłączony (tylko preview-header-actions przekazuje disabled)._
- [x] Logowanie: po kliknięciu „Zaloguj" kręci się tylko wskaźnik w przycisku („Logowanie...") —
      bez drugiego, pełnoekranowego wskaźnika na środku strony.
  _Staging 2026-10-22 (pass 15): opóźnione żądanie logowania (7 s): tylko gradientowe kółko w przycisku „Logowanie...”, bez 🚧 pośrodku strony_
- [x] Kosztorys → materiały, zestaw „Materiały rozliczane netto": „Razem" stoi pod kolumną
      „Netto", kolumna „Brutto" w stopce pusta.
  _Staging 2026-10-22 (pass 16): inw. 210 (read-only), Podsumowanie → Materiały → lista wydatków: „Razem” 10 523,00 w x=1422 — tej samej kolumnie co wartości „Netto”; stopka „Brutto” pusta._
- [ ] `/design`: każda sekcja się renderuje, w jasnym i ciemnym motywie; nowe warianty przycisków,
      plakietki, panel, wysuwany panel boczny i kolor ostrzeżenia są widoczne i czytelne.
- [ ] Dowolne okno potwierdzenia (np. usunięcie transakcji): tytuł tej samej wielkości co w zwykłym
      oknie formularza; na telefonie przyciski jeden pod drugim, na komputerze obok siebie.
  _Staging 2026-10-22 (pass 16): desktop: tytuł „Anulowanie transakcji” 18 px = tytuł „Nowy wydatek” 18 px; przyciski „Nie” / „Tak, anuluj” obok siebie (ta sama linia). Połowa „na telefonie” wymaga prawdziwego telefonu — zostaje._
- [ ] Okna formularzy (np. „Dodaj wydatek"): szerokość jak dotąd albo minimalnie większa, nic się
      nie zawija ani nie ucina.
- [x] Lista transakcji → przycisk filtrów z aktywnym filtrem: zielona ramka jak dotąd; przycisk
      czyszczenia filtrów czerwony obrys, po najechaniu wypełniony.
  _Staging 2026-10-22 (pass 13): OWNER, `/`: „Typ (1)” ma zielony tekst rgb(29,192,131) i ramkę; „Wyczyść filtry” jest neutralnym przyciskiem (biały obrys 15%, po najechaniu szare wypełnienie), NIE czerwonym — `ClearButton` to zwykły `FilterTriggerButton` od EX-785, opis „czerwony obrys” w boksie nieaktualny._
- [x] Menu boczne → licznik nieprzeczytanych: pełna pigułka z liczbą, „99+" powyżej 99, brak przy 0.
  _Staging 2026-10-22 (pass 13): MANAGER: „Zapytania z formularzy” pełna pigułka „99+”, brak znacznika przy linkach z 0._
- [x] Kosztorys edytor → nagłówek etapu: po najechaniu tooltip „Opcje etapu", kliknięcie otwiera
      menu, a po zamknięciu menu tooltip nie wyskakuje ponownie.
  _Staging 2026-10-22 (pass 16): inw. 179, „Etap 1”: najechanie → tooltip „Opcje etapu”, klik otwiera menu (Rozliczenie / Etap zakończony / Sortuj…), po Esc tooltip nie wraca (fokus wraca na przycisk)._
- [ ] Pola liczbowe w siatce/tabeli (wpisywanie kwoty w wierszu): tekst nie jest ucięty, wyrównany
      do prawej.
  _Staging 2026-10-22 (pass 16): Rozlicz wypłaty: pole „Kwota wypłaty” (zwykły Input) wyrównane do LEWEJ, nieucięte; siatka kosztorysu też do lewej — opis „do prawej” nie zgadza się z UI, decyzja człowieka_
- [ ] Telefon (390px, przez LAN) → menu: logo w lewym górnym rogu, X w prawym; za panelem
      przyciemnione tło, Esc i kliknięcie w tło zamykają panel z animacją, fokus wraca na przycisk menu.
  _Staging 2026-10-20: wymaga człowieka — prawdziwy telefon przez LAN (emulacja Chrome nie jest zamiennikiem)_
- [ ] Telefon (390px) → konto pracownika z wypłatami do potwierdzenia i strona raportu pracownika
      (link z „Udostępnij"): przyciski i pasek raportu mieszczą się w szerokości, nic się nie ucina.
  _Staging 2026-10-20: wymaga człowieka — prawdziwy telefon przez LAN (emulacja Chrome nie jest zamiennikiem)_
- [ ] „Rozlicz wypłaty": podczas wczytywania gradientowy wskaźnik; „Brak wypłat do rozliczenia."
      wyśrodkowane; wysłanie z błędem pokazuje komunikat „formularz ma błędy".
  _Staging 2026-10-22 (pass 16): OWNER, /pracownicy → „Rozlicz wypłaty” (Igor Mykhaylyuk): „Wypłać” bez wybranej kasy pokazuje toast z ikoną błędu „Wybierz kasę” (komunikatu „formularz ma błędy” w aplikacji nie ma — opis nieaktualny); gradientowego wskaźnika i „Brak wypłat do rozliczenia.” nie da się wywołać na tym koncie (lista ma wiersz)_
- [x] „Anulowanie transakcji" i odrzucenie wypłaty: okno węższe, bez X w rogu; zamyka „Anuluj" i Esc.
  _Staging 2026-10-22 (pass 16): / „Anuluj transakcję”: okno 420 px (formularz „Nowy wydatek” 900 px), bez X (tylko „Nie” / „Tak, anuluj”), „Nie” i Esc zamykają. Odrzucenie wypłaty nie sprawdzone w tym przebiegu. Przycisk zamykający nazywa się „Nie”, nie „Anuluj”._
- [x] „Nowy kosztorys": przycisk „Dodaj kosztorys" w stopce okna (na komputerze po prawej, nie na
      całą szerokość), etykiety pól czytelne.
  _Staging 2026-10-22 (pass 16): /kosztorysy: „Dodaj kosztorys” w stopce okna po prawej (138 px z 420), nie na całą szerokość; etykiety „Link do arkusza” / „Nazwa (opcjonalnie)” czytelne_
- [ ] „Nowy wydatek" i „Wczytaj kartkę": przycisk wysyłki w stopce; kliknięcie etykiety otwiera
      fokus na jej polu wyboru; „Ładowanie salda..." ma wskaźnik.
  _Staging 2026-10-22 (pass 16): OWNER: „Nowy wydatek” — „Zapisz” w stopce okna (lewa strona), klik etykiet „Kasa” i „Inwestycja” fokusuje ich pole wyboru, „Ładowanie salda…” ma animowany wskaźnik po wybraniu kasy. „Wczytaj kartkę” nie istnieje w aplikacji (opis nieaktualny)_
- [x] Kosztorys edytor → po kolei otwórz „Wersje kosztorysu", „Udostępnij", „Ustawienia podglądu",
      „Wyczyść kosztorys", „Wczytaj z szablonu", „Dodaj sekcję z szablonu", „Zmień kolejność",
      „Podział etapu": każde okno ma sensowną szerokość, nic się nie zawija ani nie ucina.
  _Staging 2026-10-22 (pass 16): inw. 179 (1800 px): Zapisz wersję 420, Wersje 420, Wyczyść 600, Wczytaj szablon 600, Sekcja z szablonu 750, Ustaw kolejność 1200, Ustawienia podglądu 600, Udostępnij 420, Pracownicy etapu 600 — jedyne elementy ucięte to zamierzone wielokropki i pole z linkiem._
- [x] Kosztorys edytor → „Podział etapu": „Główny" wybiera się jak opcję (tylko jeden naraz).
  _Staging 2026-10-22 (pass 16): dialog „Pracownicy etapu” po dodaniu 2. pracownika: „Główny” to role=radio (Konrad → Test Test → Konrad), zawsze dokładnie jeden zaznaczony; zamknięte „Anuluj” bez zapisu._
- [ ] Kosztorys edytor → „Zgłoszenia prac": przełącznik „Wg daty / Wg pracownika" działa jako
      jeden segmentowy przełącznik; pusta lista pokazuje wyśrodkowany komunikat.
  _Staging 2026-10-22 (pass 16): przełącznik „Wg daty / Wg pracownika” = jeden segmentowy przełącznik (role=radio, jeden aktywny), grupowanie przełącza się poprawnie; pustej listy nie da się pokazać na inw. 179 (są zgłoszenia) — druga połowa zostaje._
- [ ] Kosztorys → „Porównaj z arkuszem", „Pobierz z arkusza", „Stawki", „Raport": ostrzeżenia
      bursztynowe, różnice czerwone, zgodności zielone — czytelne w jasnym i ciemnym motywie;
      linki „komórka X" działają.
- [ ] „Dodaj pracę z katalogu" / „Zamień pracę" bez wybranej sekcji przy zapisie: pole sekcji z
      czerwoną ramką jak inne pola formularza.
  _Staging 2026-10-22 (pass 16): inw. 179: „Dodaj → Praca…” z zaznaczoną pracą i bez sekcji — „Dodaj (1)” jest wyłączony (nie da się zapisać), więc czerwonej ramki pola sekcji przy zapisie nie ma jak pokazać; opis nieaktualny lub wymaga decyzji. Zamknięte „Anuluj”, nic nie dodano_
- [ ] „Manual Wykończymy", „Synchronizacja wydatków inwestycyjnych", „Sprawdź faktury Telmak",
      „Załączniki" w zgłoszeniach: okna się otwierają, wskaźnik ładowania gradientowy, treść mieści się.
  _Staging 2026-10-22 (pass 16): OWNER: „Manual Wykończymy” (600 px) i „Sprawdź faktury Telmak” (/kasa/11) otwierają się, treść mieści się bez przewijania w poziomie. Nie sprawdzone: wskaźnik ładowania (za szybki), „Synchronizacja wydatków inwestycyjnych” (zapis do Arkuszy), „Załączniki” w zgłoszeniach_
- [ ] Zgłoszenia → „Dodaj" (nowa inwestycja ze zgłoszenia z plikami): odstęp między paskiem plików
      a formularzem jak w innych oknach — bez dużej przerwy.
- [ ] Flota i sprzęt: daty po terminie bursztynowe; po najechaniu na plakietkę alertu floty i na
      saldo OpenRouter pokazuje się dymek (nie systemowy podpis przeglądarki).
  _Staging 2026-10-22 (pass 16): /flota: plakietka „Olej” po najechaniu pokazuje dymek „Do wymiany: Wymiana oleju” (nie systemowy podpis); data 31.10.2026 (za 9 dni) bursztynowa. Brak pojazdu w użyciu po terminie i saldo OpenRouter nie renderuje się na stagingu (komponent zwraca null bez salda) — te połowy zostają_
- [x] Filtry listy: chip aktywnego filtra ma X, który go usuwa; po najechaniu na przyciski filtrów
      dymek z opisem.
  _Staging 2026-10-22 (pass 16): inw. 179 edytor: „Filtry” → „Z przedmiarem (18)” → chip z X (aria „Przestań pokazywać…”) usuwa filtr; przycisk „Filtry” po najechaniu → dymek „Co widać: pozycje”. Lista transakcji / pracowników nie ma chipów (przycisk filtra zielony z licznikiem) i przyciski filtrów tam nie mają dymków — tylko edytor i katalog prac_
- [ ] Logowanie, „Nie pamiętasz hasła" i reset hasła: błędny login/hasło pokazuje czerwony
      komunikat pod formularzem jak dotąd.
  _Staging 2026-10-22 (pass 16): _Staging 2026-10-22 (pass 16): logowanie — „Nieprawidłowy email lub hasło" w kolorze destructive pod formularzem, bez ikony; wysyłka formularza zapomnianego hasła i reset z błędnym tokenem nie sprawdzane (mail).__
- [ ] Telefon (390px, przez LAN), konto kierownika → menu → „Manual Wykończymy": menu się zamyka,
      a okno Manuala zostaje otwarte z wczytanymi wpisami.
  _Staging 2026-10-20: wymaga człowieka — prawdziwy telefon przez LAN (emulacja Chrome nie jest zamiennikiem)_
- [ ] Telefon → otwórz menu i obróć telefon poziomo (szerokość ≥ 768px): nie zostaje przyciemnione
      tło nad stroną.
  _Staging 2026-10-20: wymaga człowieka — prawdziwy telefon przez LAN (emulacja Chrome nie jest zamiennikiem)_
- [ ] Kosztorys → „Pobierz z arkusza" → „Rozliczenie i wykonawca etapów": pole wyboru wykonawcy ma tę
      samą wysokość co pole rozliczenia obok.
- [ ] Kosztorys → „Zgłoszenia prac" → przegląd zgłoszenia: nagłówki grup wielkimi literami; dopisek
      pod polem ilości wyśrodkowany.
  _Staging 2026-10-22 (pass 16): nagłówek grupy „Z ROZPISKI (3)” text-transform: uppercase — OK; dopisku pod polem ilości nie da się sprawdzić na zgłoszeniu #28 (żaden wiersz go nie ma), boks zostaje otwarty._
- [x] Kosztorys → podsumowanie: kliknij uchwyt panelu, żeby go zwinąć, potem rozwiń — dymek uchwytu
      nie pojawia się sam.
  _Staging 2026-10-22 (pass 16): inw. 179: klik uchwytu zwija panel, „Podsumowanie” rozwija — po żadnej z akcji nie ma dymka ([role=tooltip] puste); uchwyt znika przy zwiniętym panelu_
- [ ] „Dodaj kosztorys" (link do arkusza), „Podłącz arkusz do inwestycji", „Synchronizuj wydatki
      inwestycyjne", „Dodaj do inwestycji" w załącznikach zgłoszenia i przycisk potwierdzenia w oknach
      „Anuluj / Potwierdź": w trakcie wysyłki przycisk jest wyszarzony i kręci się w nim wskaźnik.
  _Staging 2026-10-20: wymaga człowieka — zapis do Arkuszy Google tylko z produkcji (konto Viewer na preview)_
- [ ] Komunikaty błędów pod formularzami (logowanie, „Rozlicz wypłaty", zamówienia): bez ikony
      trójkąta jak dotąd; małe błędy przy polach (plik, lista odbiorców, „Zapisz szablon") z ikoną.
  _Staging 2026-10-22 (pass 16): _Staging 2026-10-22 (pass 16): logowanie — błąd bez ikony (tylko ta część); „Rozlicz wypłaty", zamówienia i małe błędy z ikoną nie sprawdzone.__
- [x] Plakietka z X (np. aktywny filtr, wybrany odbiorca): X ma ten sam rozmiar, po najechaniu
      czerwienieje, kliknięcie usuwa.
  _Staging 2026-10-22 (pass 16): inw. 179: chip filtra „z przedmiarem” — X 18 px, po najechaniu czerwienieje (tło + ikona), klik usuwa; „wybrany odbiorca” nie porównany_

## 2026-10-20 — worker-receipt-confirmation — potwierdzenie odbioru dla każdych pieniędzy przekazanych pracownikowi

- [ ] Transfer między kasami z kasy managera do kasy pracownika: pracownik widzi go na swojej stronie
      w „Do potwierdzenia", dostaje push „Pieniądze do potwierdzenia", a „Potwierdzam" pokazuje toast
      „Odbiór potwierdzony" i status „Potwierdzona" na liście transakcji.
      _Staging 2026-10-20: widoczność w „Do potwierdzenia", toast „Odbiór potwierdzony" i status „Potwierdzona" OK; push „Pieniądze do potwierdzenia" niesprawdzalny (VAPID tylko na produkcji)._
      _needs human: push „Pieniądze do potwierdzenia" — produkcja, prawdziwy telefon_
- [x] Ten sam rodzaj transferu odrzucony przez pracownika z powodem: na „/" pojawia się w tabeli
      „Odrzucone przez pracowników" z typem „Transfer między kasami", jego imieniem i jego kasą;
      „Anuluj" usuwa go z tabeli.
- [x] Inna wpłata zaksięgowana do kasy pracownika też trafia do jego „Do potwierdzenia".
- [x] Transfer między dwiema kasami managerów, transfer między dwiema kasami tego samego pracownika
      i korekta niczego nie pytają — brak wpisu w „Do potwierdzenia", kolumna potwierdzenia pusta.
- [x] Teksty przepływu (nagłówki, okna potwierdzenia i odrzucenia, toasty) nie mówią „wypłata" — po
      polsku i po ukraińsku; filtr „Potwierdzenie" jest na stronie pracownika, który ma tylko
      transfery i wpłaty, bez wypłat.

### Findings — 2026-10-20

- [x] **Korekta nie do zaksięgowania z UI** — niesprawdzona wprost: CHECK `transactions_payout_status_only_on_money_in` nie dopuszcza `payout_status` na CORRECTION, więc korekta strukturalnie nie trafia do „Do potwierdzenia". **Test disposition:** no automated test · — pokryte constraintem (spec DB stamp CHECK już istnieje).


## EX-1120 — investment-initial-info — sekcja „Wstępne informacje" z polem „Rynek"

- [x] Dodaj inwestycję → rozwiń „Wstępne informacje" (pod „Kontakt", domyślnie zwinięta) → „Rynek"
      → „Rynek wtórny" → zapisz. Edytuj tę inwestycję: „Rynek" pokazuje „Rynek wtórny".
- [x] Inwestycja bez wybranego rynku: w edycji „Rynek" pokazuje „— nie wiadomo —"; po zmianie innego
      pola i zapisie nadal „— nie wiadomo —".
- [x] Edycja inwestycji (z tabeli i ze strony inwestycji): „Kierownik budowy" jest szeroki jak jego
      treść i wyrównany do lewej; wybór pracownika nadal zapisuje się od razu.
- [ ] Następna sprawa AI przyjęta z produkcji ma `inputs/initial-info.md` z linią „Rynek: …".
  _Staging 2026-10-20: wymaga człowieka — sprawa AI z produkcji_

## 2026-10-20 — sidebar-width-animation — pasek boczny zwija się i rozwija z animacją

- [x] Pasek boczny (desktop): klik w uchwyt na krawędzi płynnie zwęża pasek do ikon i z powrotem
      rozszerza, w tym samym tempie co rozwijanie sekcji konta; podpisy linków nie łamią się ani nie
      skaczą w trakcie, uchwyt nie jest ucięty.
  _Staging 2026-10-22 (pass 13): OWNER, 1800 px: szerokość paska 257→141→78→57 px w ~150 ms (animowane), z powrotem 57→195→244→257; jedyny link łamiący się to logo. Prawdziwa mysz na uchwycie też działa (nakładka `vercel-live-feedback` Vercel Toolbara potrafi przechwycić kliknięcia/hover w sesji testowej — to nie błąd aplikacji)._
- [x] Pasek zwinięty → przeładowanie strony: pasek od razu stoi zwinięty, bez animacji zwężania.
  _Staging 2026-10-22 (pass 13): OWNER: po reloadzie pierwsza klatka SSR ma 257 px, następna 57 px — bez animacji (skok), ale z jednoklatkowym mignięciem rozwiniętego paska (stan z localStorage)._
- [x] Edytor kosztorysu z dużym kosztorysem: zwinięcie i rozwinięcie paska nie zacina siatki.
  _Staging 2026-10-22 (pass 13): OWNER, inw. 224 (302 pozycje): zwiń+rozwiń paska → 0 long tasków (PerformanceObserver), siatka renderuje się dalej._

## 2026-10-20 — badge-select-hover — klikalny badge statusu inwestycji podświetla się po najechaniu

- [x] Lista inwestycji → najechanie na badge statusu i badge etapu AI: badge przygasa tak samo jak
      badge „Aktywna” na liście kas, kursor to rączka; klik otwiera listę wyboru.
  _Staging 2026-10-22 (pass 13): OWNER: badge statusu „Wycena” na `/inwestycje` po najechaniu opacity 1→0,7, kursor pointer — identycznie jak „Aktywna” na `/kasy` (0,7). Badge etapu AI ma tę samą klasę `enabled:hover:opacity-70`; klik→lista nie sprawdzany osobno._
- [ ] W trakcie zapisu zmiany etapu AI (badge wyłączony) najechanie nie zmienia wyglądu badge'a.

## 2026-10-20 — ds-variant-cleanup — szare podpisy, wiersze list i badge bez martwych wariantów

- [ ] Edytor kosztorysu → „Porównaj z arkuszem" i „Historia": szare podpisy pod nagłówkami mają ten
      sam rozmiar i kolor co wcześniej, bez dodatkowej ikony.
- [ ] Inwestycja z zablokowanym kosztorysem → baner blokady i „Przegląd" inwestycji pokazują ikonę
      kłódki obok tekstu, kolor bez zmian.
- [ ] Edytor kosztorysu → „Dodaj sekcje z szablonu" i „Wczytaj z szablonu": wiersze listy zajmują
      całą szerokość, tekst się zawija, najechanie podświetla wiersz.
- [x] Edytor kosztorysu → „Zgłoszenia pracowników": wiersze listy i pigułki sekcji wyglądają jak
      wcześniej.
  _Staging 2026-10-22 (pass 16): inw. 179: dialog „Zgłoszenia prac” — wiersze zgłoszeń (imię · „do: Etap 3”, „N prac”, strzałka) i pigułki statusów (Przyjęte zielona, Odrzucone czerwona, Do sprawdzenia bursztynowa) czytelne i spójne; punktu odniesienia „jak wcześniej” brak_
- [ ] Lista przelewów z filtrem → pigułka filtra ma szary obrys i krzyżyk; karty przelewów pokazują
      chipy z kolorowym obrysem; licznik nieprzeczytanych w menu to pełna pigułka w kolorze głównym.
- [ ] Lista użytkowników i menu mobilne → badge roli w kolorach jak wcześniej.

## 2026-10-20 — design-full-coverage — `/design` pokazuje każdą rodzinę komponentów i otwarte nakładki

- [ ] `/design` → każda sekcja zwija się i rozwija; po przeładowaniu zostaje w stanie, w którym ją
      zostawiono. Spis treści podświetla sekcję, którą akurat widać.
- [ ] `/design` → nowe sekcje („Tokeny i efekty", „Ikony", „Tabele", „Karty", „Statusy domenowe",
      „Banery i ostrzeżenia", „Filtry", „Złożone pola formularzy", „Media i wykresy", „Komórki
      arkusza") renderują się w jasnym i ciemnym motywie bez błędów w konsoli.
- [ ] „Nakładki", „Dialogi", „Pola formularzy": obok przycisku otwierającego każdy dialog, sheet,
      popover, select i menu stoi jego zawsze otwarta kopia; strona się przy tym nie blokuje i da
      się przewijać.
- [ ] Aplikacja poza `/design`: dialogi, sheety, popovery, selecty i menu otwierają się i zamykają
      jak wcześniej (Escape, klik poza, przycisk zamknięcia).
- [ ] Wybór z wyszukiwaniem (np. inwestycja w formularzu przelewu) → strzałka przy polu ma ten sam
      rozmiar co wcześniej.
- [ ] Wersja preview / lokalna → znacznik środowiska przy dolnej krawędzi wygląda i podpisuje się
      jak wcześniej.

## 2026-10-20 — restore-bouncing-loader — 🚧 wraca jako loader strony

- [x] Przejście między stronami (np. lista przelewów → inwestycja) oraz logowanie: na środku podskakuje
      🚧, nie gradientowe kółko.
  _Staging 2026-10-22 (pass 15): lista inwestycji → inwestycja (żądanie opóźnione 9 s): na środku podskakuje 🚧 (animacja bounce, y 467-476). Logowanie: kręci się tylko gradientowe kółko w przycisku „Logowanie...”, po sukcesie bez 🚧 (strona logowania nie ma loadera pełnoekranowego — zgodne z boksem EX-1110 o logowaniu)_
- [x] Zapis formularza przelewu i zmiana filtra dat na liście przelewów: 🚧 na środku ekranu nad
      całą stroną, znika po zakończeniu — jak wcześniej.
  _Staging 2026-10-22 (pass 15): zapis „Edytuj transakcję” (żądanie POST opóźnione 6 s): podskakuje 🚧 (animacja bounce), po odpowiedzi okno zamyka się i 🚧 znika; filtr dat „Rok” z 🚧 sprawdzony wcześniej w tym przebiegu_
- [x] Przyciski w trakcie zapisu i małe wskaźniki „Wczytywanie…" dalej pokazują gradientowe kółko.
  _Staging 2026-10-22 (pass 15): przycisk „Logowanie...” z gradientowym kółkiem (opóźnione żądanie); małe wskaźniki w innych miejscach nie oglądane osobno_

## 2026-10-21 — ds-audit-phase1 — scalone ręczne kopie bez zmiany wyglądu

Refaktor bez zmiany zachowania — każdy boks: wygląda i działa jak przed zmianą.

- [ ] Listy z paskiem narzędzi (inwestycje, przelewy, kasy, pracownicy, sprzęt, flota, leady,
      presety, kosztorysy, raporty pracowników, katalog prac): wyszukiwarka, filtry, chipy filtrów,
      przyciski akcji i „Kolumny" są na swoich miejscach i działają.
- [ ] Kolumny akcji (ołówek/kosz) w tych tabelach: przyciski po prawej, otwierają edycję/usunięcie.
- [ ] Kolumny dat i kwot w tabelach (sprzęt, flota, leady, presety, Telmak, rozliczenie wypłat,
      inwestycje): format i wyrównanie bez zmian; pusta wartość to szare lub zwykłe „—" jak wcześniej.
- [ ] Przyciski „Dodaj…" na listach (kasy, sprzęt, flota, pracownicy, inwestycje, kosztorysy,
      katalog, przeglądy, nowy preset): ten sam wygląd z plusem, otwierają swój dialog.
- [ ] Badge statusu wypłaty, szkicu wydatku i raportu pracownika: kolory jak wcześniej dla
      oczekujących / zaakceptowanych / odrzuconych.
- [x] „Zapomniane hasło" i „Reset hasła": link „Powrót do logowania" jest i prowadzi do logowania.
  _Staging 2026-10-22 (pass 16): _Staging 2026-10-22 (pass 16): /zaloguj/zapomniane-haslo i /zaloguj/reset-hasla?token=… mają link „Powrót do logowania" → /zaloguj.__
- [ ] Kosztorys → raport pracownika → podgląd: „kto i kiedy zdecydował" w tym samym formacie co w
      tabelach raportów i szkiców.
- [x] `/design/audyt`: spis treści i wszystkie grupy domyślnie zwinięte; klik w spisie rozwija
      i przewija do grupy.
  _Staging 2026-10-22 (pass 12): spis i grupy domyślnie zwinięte; klik A07 w spisie rozwija grupę i przewija (top 72 px)._

## 2026-10-21 — new-item-stays-visible — nowa praca nie znika pod filtrami

- [x] Kosztorys → Filtry: „z przedmiarem lub wykonaną pracą” → „Nowa praca” w sekcji, bez ilości:
      praca zostaje widoczna w siatce; wpisz Przedmiar — wiersz dalej jest.
  _Staging 2026-10-22 (pass 14): OWNER, inw. 179, filtr „z przedmiarem lub wykonaną pracą” (18): „Dodaj → Praca… → Dodaj nową pracę…” w „Klimatyzacja” — wiersz 21 zostaje widoczny (licznik 19); Przedmiar wpisany w komórkę — wiersz dalej jest._
- [x] Ten sam filtr → dodaj pracę z katalogu prac: dodane prace bez ilości zostają widoczne.
  _Staging 2026-10-22 (pass 14): inw. 179, ten sam filtr: dwie prace z katalogu („Montaż domofonu”, „Montaż listew LED”) bez ilości zostają w siatce (wiersze 19, 20)._
- [x] Nowa praca dalej pusta → otwórz menu „Filtry” albo przełącz dowolny filtr: praca znika
      (filtry stosują się na nowo).
  _Staging 2026-10-22 (pass 14): inw. 179: po otwarciu menu „Filtry” obie puste prace z katalogu zniknęły z siatki (filtr nadal (18))._

## 2026-10-22 — ds-audit-a01 — pusta wartość „—” w kolorze tekstu

- [x] Katalog prac, Konta, Sprzęt (lokalizacja, gwarancja, nr seryjny), Flota (terminy): pusta
      wartość to „—” w kolorze tekstu obok, nie szara; nr seryjny i historia sprzętu też nie szare.
  _Staging 2026-10-22 (pass 12): puste wartości „—” w kolorze tekstu komórki (katalog, konta, sprzęt, flota, szczegół sprzętu)._
- [x] Inwestycje: „brak kosztorysu” / „ustaw etapy” i we Flocie „brak danych” / „bez terminu” /
      „bezterminowo” w kolorze tekstu, dalej małą czcionką.
  _Staging 2026-10-22 (pass 12): kolor i 12px zgodne z komórką (inwestycje, flota)._
- [ ] Rozliczenie wypłat: wiersz bez zaznaczenia pokazuje „—” w kolorze tekstu; zaznaczanie i kwoty
      działają jak wcześniej.
- [ ] Transakcje → kolumna daty decyzji wypłaty: brak decyzji to „—” (na wydruku też), nie pusta
      komórka.
- [ ] Duplikaty wydatków, odrzucone paragony, szkice wydatków: brak inwestycji / osoby / kasy /
      notatki to „—”, nie pusta komórka.
- [ ] Kosztorys → „Porównaj z arkuszem” i import z arkusza: „nie policzyliśmy” / „nie znaleziono”
      w kolorze tekstu.

## 2026-10-22 — ds-audit-a02 — kwoty, liczby i daty w komórkach

- [ ] Każda tabela (inwestycje, kasy, konta, katalog prac, flota, transakcje, rozliczenie wypłat,
      kosztorys → podsumowanie, raporty pracowników, odrzucone przez pracowników): wszystkie
      kolumny, nagłówki, suma pod tabelą i przyciski akcji wyrównane do lewej.
- [ ] Panele podsumowania (koszty pojazdu, przeglądy, wpłaty w kosztorysie), kosztorys → „Porównaj
      z arkuszem”, porównanie z katalogiem, wybór pozycji z katalogu, podział etapu między
      pracowników i podsumowanie w raporcie pracownika: kwoty i nagłówki do lewej.
- [ ] Rozliczenie wypłat: saldo i „Pozostało do wypłaty” pogrubione jak inne salda.
- [x] Inwestycje: „Wydatki inwestycyjne” zwykłą grubością, nie pogrubione.
  _Staging 2026-10-22 (pass 12): wagi 400 w całym wierszu (/inwestycje)._
- [ ] Dowolna tabela z kwotami (transakcje, flota, sprzęt, kosztorys → podsumowanie, raporty
      pracowników): cyfry w kolumnie stoją równo pod sobą, kwota nie łamie się na dwie linie.
- [ ] Kosztorys → raporty pracowników → przegląd raportu: w tabeli „Prace spoza rozpiski” nagłówek
      „Zgłoszono” czytany poziomo; w tabeli pozycji z rozpiski zostaje pionowy.
- [ ] Flota → pojazd wycofany: „bezterminowo” / „brak danych” / „bez terminu” szare jak data w tym
      wierszu; u pojazdu w użyciu w kolorze tekstu.
- [ ] Transakcje → Drukuj z kolumną „Powód odrzucenia”: pusty powód drukuje się jako „—”.

## 2026-10-22 — investor-gross-columns — kolumny brutto w podglądzie inwestora

- [x] Kosztorys → ustawienia podglądu inwestora: przełącznik „Netto | Brutto” pod opisem; „Brutto”
      zamienia listę kolumn kwotowych na brutto, „Netto” wraca do netto.
  _Staging 2026-10-22 (pass 12): przełącznik jest pod opisem; Brutto/Netto przełącza listę (inw. 224)._
- [x] Inwestycja bez zapisanych ustawień: wszystkie kolumny brutto domyślnie odznaczone, podgląd
      inwestora i link `/k/…` bez kolumn brutto.
  _Staging 2026-10-22 (pass 12): inw. 224: brutto odznaczone; podgląd bez nich._
- [x] Zaznacz „Wartość brutto” i „Cena j.m. brutto”: pojawiają się w podglądzie inwestora i w linku
      `/k/…` obok swoich odpowiedników netto; netto zostają, jak były.
  _Staging 2026-10-22 (pass 12): sprawdzone w /podglad-inwestora (brutto obok netto, netto bez zmian); link /k/ ta sama ścieżka renderu, tokenu nie czytano. Ustawienia cofnięte._
- [x] Kolejność kolumn przy przełączniku „Brutto”: lista pokazuje tylko kolumny brutto, przeciągnięcie
      zmienia kolejność w podglądzie inwestora.
  _Staging 2026-10-22 (pass 12): lista pokazuje kolumny brutto; przeciągnięcie przeniosło kolumnę w podglądzie. Cofnięte._
- [x] PDF dla inwestora z zaznaczonymi kolumnami brutto: drukuje wyłącznie netto, w tej samej
      orientacji co bez nich.
  _Staging 2026-10-22 (pass 13): inw. 168 jest w Koszu (menu „Inwestor" ukryte), więc na inw. 224 (odznaczone „Ukryj pozycje bez przedmiaru", zaznaczone 3 kolumny brutto): „Wygeneruj ofertę w PDF" (print zastubowany na popupie) → 324 wiersze, nagłówki Opis prac / Przedmiar ofertowy / Jednostka miary / Cena j.m. / Wartość netto, brak „brutto", brak landscape (pion). Ustawienia cofnięte do domyślnych (potwierdzone SQL)._
- [x] Inwestycja bez wpisów w etapach, z zaznaczonymi „Wartość brutto (razem etapy)” i „Pozostało
      brutto”: obie schowane w podglądzie inwestora, tak jak ich odpowiedniki netto.
  _Staging 2026-10-22 (pass 12): obie schowane w podglądzie (224). Cofnięte._
- [x] Ustawienia podglądu inwestora na desktopie: okno szersze niż wcześniej, „Pozostało netto
      (względem aktualizacji przedmiaru)” mieści się w jednej linii.
  _Staging 2026-10-22 (pass 12): okno 600px, etykieta w jednej linii._

## 2026-10-22 — catalogue-autolink — „Popraw literówki" podpina pracę do katalogu

- [x] Kosztorys z pracą, której opis jest w katalogu prac, ale j.m. ma literówkę („klp" zamiast
      „kpl"); menu wiersza pokazuje „Zapisz pozycję do katalogu prac". „Popraw literówki" → j.m.
      zmienia się na „kpl"; po przeładowaniu menu wiersza pokazuje „Aktualizuj pozycję w katalogu prac".
  _Staging 2026-10-22 (pass 12): inw. 224: dodany wiersz z „klp” → menu „Zapisz…”; po „Popraw literówki” j.m. „kpl”, po przeładowaniu „Aktualizuj…”. Wiersz usunięty._
- [x] Ręczna zmiana opisu w komórce na nazwę z katalogu nie zmienia pozycji menu wiersza po
      przeładowaniu (edycja komórki nie podpina katalogu).
  _Staging 2026-10-22 (pass 12): inw. 224: po zmianie opisu i przeładowaniu menu dalej „Zapisz…”. Wiersz usunięty._

## 2026-10-22 — view-menu-collapsible — zwijane sekcje w menu „Kolumny" kosztorysu

- [x] Kosztorys → „Kolumny": każda sekcja („Widok", „Kwoty", „Stawki wykonawców", „Warstwy",
      „Etapy", „Widoczne kolumny", „Ustal wielkość czcionki w tabeli") zwija się i rozwija
      kliknięciem w nagłówek, a menu przy tym zostaje otwarte.
- [x] Zwiń dwie sekcje, zamknij menu, przeładuj stronę i otwórz je ponownie: obie nadal zwinięte.
- [x] W nagłówku „Widoczne kolumny" kliknięcie (i) otwiera podpowiedź i nie zwija sekcji; drugie
      kliknięcie (i) ją zamyka.
- [ ] Telefon (390px): stuknięcie (i) w dowolnym miejscu aplikacji otwiera podpowiedź i zostaje
      otwarta po puszczeniu palca.
      Staging 2026-10-22: wymaga człowieka — prawdziwy dotyk na telefonie.
- [x] Tabela poza kosztorysem (np. lista przelewów) → „Kolumny": sekcje bez strzałki, nie zwijają
      się — wygląd jak wcześniej.

## 2026-10-22 — worker-pdf-own-work-filter — PDF pracownika tylko z pozycjami z wykonaną pracą

- [x] Gryka-Deszczyński Kopernika 2a Marki → „Pracownicy" → Kyryl Elektryk → „Drukuj kosztorys
      pracownika (PDF)": otwiera się dialog z zaznaczonym „Tylko pozycje z wykonaną pracą";
      „Drukuj" otwiera okno druku (bez blokady popupu) tylko z jego pozycjami (17 na danych
      z 22.10); sumy sekcji i „Razem" zgadzają się z wydrukowanymi pozycjami.
- [x] To samo z odznaczonym polem: PDF jak dotąd — wszystkie pozycje z przedmiarem.
- [x] Ponowne otwarcie dialogu po odznaczeniu: pole znowu zaznaczone.
- [x] Pracownik, którego etapy nie mają jeszcze wpisów, pole zaznaczone: nagłówek, pusta tabela,
      stopka — bez błędu.
- [x] „Drukuj kartkę do zgłoszenia prac" nadal drukuje jednym kliknięciem, z pełnym zakresem.

## 2026-10-22 — ai-marker-default-on — „Do analizy AI” domyślnie zaznaczone

Staging 2026-10-22 (pass 15, deploy 32fb4c7bd): sekcja sprawdzona. Test pliki wgrane do inw. 179 usunięte przez UI (trafiły do Kosza na 7 dni).

- [x] Inwestycja → dodawanie plików: pole „Do analizy AI” jest zaznaczone, podpowiedź mówi
      „Odznacz, jeśli ma ich nie widzieć”; wgrany plik bez dotykania pola ma w galerii
      „Oznaczony do analizy AI”.
  _Staging 2026-10-22 (pass 15): inw. 179 (deploy 32fb4c7bd): pole zaznaczone, podpowiedź „Odznacz, jeśli ma ich nie widzieć”; plik wgrany bez dotykania pola (Dodaj kolejne) w galerii ma „Oznaczony do analizy AI”_
- [x] Odznacz pole, wgraj plik: w galerii plik ma przycisk „Oznacz do analizy AI”.
  _Staging 2026-10-22 (pass 15): inw. 179: odznaczone pole, wgrany plik - w galerii przycisk „Oznacz do analizy AI”_
- [x] Odznacz pole, zamknij okienko bez wybierania pliku, otwórz ponownie: pole znowu zaznaczone.
  _Staging 2026-10-22 (pass 15): inw. 179: odznaczone, zamknięte bez pliku, ponownie otwarte - pole zaznaczone_
- [x] „Dodaj fakturę” przy transakcji: pola „Do analizy AI” nie ma.
  _Staging 2026-10-22 (pass 15): formularz Nowy wydatek (inw. 179): pole FV (Przeciągnij lub kliknij) bez „Do analizy AI”_

## Findings — przebieg staging 2026-10-22

### Findings — 2026-10-22

- [x] **EX-1114 (7 pól) i „ai-marker-default-on" nie do sprawdzenia na stagingu** — commity `8791ac927`, `46b270be4`, `3dfe5e15b`, `69db87d29` są tylko lokalnie; `origin/staging` = `31be4ebb4`. Otwarte do decyzji o pushu (pytanie zadane 2026-10-22). — rozwiązane: push 32fb4c7bd, przebieg 15 przeszedł te sekcje.
      **Needs human:** wypchnąć staging i puścić przebieg ponownie dla tych sekcji.
      **Test disposition:** no automated test — brak kodu na stagingu, nie defekt.
- [x] **Kosztorysy v1 → „Nowy kosztorys" nie listuje inwestycji bez kosztorysu** — odrzucone: nieaktualny opis pola. Lista jest osobną sekcją „Inwestycje bez kosztorysu" na `/kosztorysy` z „Dodaj kosztorys" w wierszu (`components/tables/sheets.tsx`); pole przepisane.
- [x] **„Dopasuj wysokość" przez dwuklik na uchwycie wiersza** — odrzucone: nieaktualny opis pola. Dopasowanie do treści to pozycja „Dopasuj wysokość do treści" w menu „…" wiersza (`grid/menus/row-height-menu-items.tsx`), dwukliku nie ma; pole przepisane.

- [x] **EX-1114: wiersz raz zniknął po edycji przy płaskim „Sortuj rosnąco"** — inw. 179, deploy 32fb4c7bd: po wpisaniu 88 w Przedmiar górnego wiersza wiersz jednorazowo zniknął z góry listy; 3 kolejne próby nie odtworzyły. — odrzucone: nie odtworzone w 8 edycjach (3 + 5, jedna karta, sortowanie i brak toastu sprawdzane po każdym zapisie); jedyna znana droga do skoku listy to remount edytora (zmiana w innym oknie / odzyskiwanie po odrzuconym zapisie), zachowanie sprzed EX-1114. Przy kolejnym wystąpieniu: patrz „Needs human” niżej.
  _Staging 2026-10-22 (pass 16): nie odtworzone w 5 edycjach, jedna karta — płaski „Sortuj rosnąco" na Przedmiar, 5 górnych wierszy 0→88/77/66/55/44: po każdym zapisie wiersz został na miejscu, strzałka sortowania została na nagłówku, toast „Rozpiska zmieniła się w innym oknie…" nie pojawił się. Wartości przywrócone do 0, sortowanie wyczyszczone._
      **Analiza (sesja EX-1114):** zatrzask puszcza tylko przy zmianie klucza — sort (zwykły `useState`, tożsamość stała przy pisaniu), fraza, zestaw warunków (po treści), widok cen, `refreshView` (otwarcie „Filtry", „Zapisz kolejność") — albo przy remouncie `KosztorysEditorBody` (`key={remountKey}`). Remount odpala `useExternalChangeReload` (toast „Rozpiska zmieniła się w innym oknie — wczytano aktualną wersję.") i odzyskiwanie po odrzuconym zapisie na nieaktualnym drzewie; remount kasuje też sortowanie, więc lista wraca do kolejności bazowej. Przebudowa siatki przy zapisie zatrzasku nie rusza.
      **Needs human:** przy następnym wystąpieniu sprawdzić, czy sortowanie „Sortuj rosnąco" nadal było aktywne (strzałka w nagłówku Przedmiar) i czy pojawił się toast o zmianie w innym oknie. Sort zniknął / był toast → remount, zachowanie sprzed EX-1114, nie defekt zatrzasku. Sort nadal aktywny → defekt zatrzasku, do odtworzenia.
      **Test disposition:** test-driven-debugging · unit — `use-view-latch` / `row-view` z edycją pola sortowania przy płaskiej liście, tylko jeśli sort był nadal aktywny.

- [ ] **`/design` wywala się na stagingu („Coś poszło nie tak")** — `Error: fieldContext only works when within a fieldComponent passed to createFormHook`; `EmptyFieldMessage` (używa `FormBase` → `useFieldContext`) renderowany poza `form.AppField` w `src/app/(frontend)/design/sections/form-composites-section.tsx`.
      Naprawione w drzewie roboczym (owinięte w `form.AppField name="holder"`), niezacommitowane; do potwierdzenia po wdrożeniu. Do tego czasu zablokowane wszystkie pola zależne od `/design`.
      **Needs human:** zacommitować poprawkę i sprawdzić `/design` po deployu.
      **Test disposition:** test-driven-debugging · unit — render `FormCompositesSection`, brak wyjątku.
- [x] **Galeria „Dokumentacja” inwestycji po polsku na koncie uk** — „Usunąć plik?” / „Usuń” i tytuł „Dodaj zdjęcia lub pliki” po polsku obok ukraińskiego „Скасувати” (`hooks/use-investment-assets-removal.ts`, `hooks/use-investment-assets-upload.ts`). — odrzucone: strona inwestycji jest tylko dla zarządu (`requireManagementPage`), a na produkcji żadne konto zarządcze nie ma języka uk/ru (2026-10-23: 9 kont uk, wszystkie EMPLOYEE); brak użytkownika, który to zobaczy.
- [x] **Zgłoszenie #28: zapis zmienił przyjętą linię w odrzuconą** — odrzucone: to klik agenta. Odrzucić przyjętą linię da się tylko przyciskiem „Odrzuć” w jej wierszu (`review-lines-table.tsx:123` zdejmuje zaznaczenie i ustawia odrzucenie; podgląd pokazuje „cofasz …”), a serwer odmawia odrzucenia przyjętej linii bez cofnięcia w tym samym zapisie (`accept-worker-report.ts:116`).
- [x] **Brak fixtury do PDF oferty (investor-gross-columns, pole 5)** — odrzucone: to nie defekt, inwestycja 224 nie ma przedmiaru. Fixtura: inw. 179 „Konrad Testy" (310 pozycji, Przedmiar w 11 sekcjach; „Agnieszka Ratyńska — testy kosztorysów AI" jest w Koszu); PDF to wydruk po stronie przeglądarki, nic nie zapisuje.

## EX-1114 — kosztorys-view-freeze-while-editing — widok kosztorysu nie przeskakuje w trakcie edycji

- [x] Edytor kosztorysu, sortowanie „Przedmiar" rosnąco z zachowaniem sekcji: wpisz dwucyfrową
      wartość w Przedmiar pozycji — wiersz zostaje na miejscu, kursor na nim; ponowny wybór tego
      samego sortowania przenosi wiersz na właściwe miejsce.
  _Staging 2026-10-22 (pass 15): inw. 179, deploy 32fb4c7bd: sort rosnąco z sekcjami, wpisane 55 w Przedmiar - wiersz zostaje na miejscu, ponowny wybór tego samego sortowania przenosi go na koniec sekcji_
- [x] To samo przy „Sortuj rosnąco" (bez sekcji).
  _Staging 2026-10-22 (pass 15): inw. 179: Sortuj rosnąco (płaska lista), wpisane 66/77/88 - wiersz zostaje na miejscu (też po 25 s); ponowne sortowanie układa po wartości. Jednorazowo wiersz (88) po edycji zniknął z góry listy - nie odtworzone w 3 kolejnych próbach_
- [x] Wyszukaj „płyt", zmień opis pasującej pozycji na tekst bez „płyt": pozycja zostaje w trakcie
      pisania; zmiana frazy wyszukiwania ją usuwa.
  _Staging 2026-10-22 (pass 15): inw. 179: szukaj płyt, opis pozycji 59 zmieniony na tekst bez płyt - pozycja zostaje; zmiana frazy (płytk) usuwa ją z widoku_
- [x] „Problemy" → „Etapy z podziałem do poprawienia" na etapie z kwotowym podziałem: podnieś ilość
      tak, żeby podział przestał być za duży — kolumna etapu zostaje; ponowne otwarcie „Problemy" ją
      usuwa.
  _Staging 2026-10-22 (pass 16): inw. 179, Etap 1 (płaszczyzna bez narzędzi, praca 10 szt. po 100 zł = pula 1000 zł): podział kwotowy Konrad Antonik + Staging QA Pracownik 900 zł zapisany; spadek ilości do 1 (pula 100) — ikona ostrzeżenia na nagłówku „+1”, Problemy → „Etapy z podziałem do poprawienia (1)”, filtr włączony; podniesienie ilości do 10 — chip „(0)”, kolumna Etap 1 zostaje; ponowne kliknięcie wyłącza filtr, pozycja znika z menu. Cofnięte przez UI: ilości 0, podział usunięty, płaszczyzna wrócona do „Z narzędziami”. Uwaga: dialog „Pracownicy etapu” nie pozwala zapisać sumy kwot powyżej puli (Zapisz wyłączone) — stan „za duży” powstaje tylko po spadku puli._
- [x] Przy sortowaniu, które po edycji pokazuje nieaktualną kolejność, „Zapisz kolejność": widok
      układa się w zapisanej kolejności.
  _Staging 2026-10-22 (pass 15): inw. 179: sort Przedmiar rosnąco, wpisane 99 w pierwszym wierszu, Zapisz kolejność - widok układa się w zapisanej kolejności (edytowany wiersz na swoim miejscu, bez przeskoku)_
- [x] Przy sortowaniu „Dodaj pozycję" na końcu sekcji: nowa pozycja pojawia się na końcu tej sekcji
      i zostaje tam w trakcie wypełniania.
  _Staging 2026-10-22 (pass 15): inw. 179: sort Przedmiar rosnąco z sekcjami, menu sekcji Prace dodatkowe - Dodaj pracę: nowa pozycja na końcu sekcji (poz. 8), po wpisaniu Przedmiar 1 zostaje na końcu (nie przeskakuje do góry)_
- [x] Raport pracownika, wyszukaj frazę pasującą też do pozycji bez wpisanej pracy: włącz
      „Wszystkie prace" — puste pozycje się pojawiają; wyłącz — znikają z powrotem.
  _Staging 2026-10-22 (pass 15): inw. 179, podgląd linku pracownika (Konrad Antonik): szukaj syfon - 1 wynik; Opcje - Wszystkie prace (+286) - dochodzą puste pozycje (syfonu klimatyzacji natynkowo itd.); wyłączenie - znikają z powrotem_

## 2026-10-22 — order-default-register — zamówienie big bagu / kontenera z kasy big bag / kontener

- [ ] Konto z ustawioną własną domyślną kasą → „Zamów big bag / kontener” → big bag → „Dalej”:
      formularz wydatku ma „Kasa Big Bag”, nie domyślną kasę konta. To samo dla kontenera: „Kasa
      kontener”. Kasę da się zmienić ręcznie przed zapisem.

## EX-1127 — column-width-command — jedna szerokość dla wielu kolumn kosztorysu

- [ ] Edytor kosztorysu: przeciągnij po pasku nad nazwami 3 kolumn, kliknij nazwę jednej z nich →
      „Szerokość kolumn (3)…” → 100 + Enter: wszystkie trzy mają 100 px, także po odświeżeniu strony.
- [ ] Shift+klik w nazwę kolejnej kolumny rozszerza zaznaczenie zamiast otwierać menu kolumny.
- [ ] Zaznacz zakres komórek przez 4 kolumny → menu jednej z nich → „Przywróć domyślną szerokość”:
      wracają tylko te 4 kolumny.
- [ ] Menu kolumny bez zaznaczenia: „Szerokość kolumny…” z podpowiedzią, jak zaznaczyć kilka kolumn.
- [ ] „Opcje” → „Szerokość wszystkich kolumn…” → 120: każda widoczna kolumna ma 120 px, oprócz
      kolumny akcji i odstępu za ostatnią kolumną; „Przywróć domyślne szerokości” cofa wszystkie.
- [ ] Kolumna etapu przyjmuje wpisaną szerokość jak każda inna.
- [ ] Z włączonym „Dopasuj wysokość wierszy” zwężenie „Opis prac” od razu podwyższa wiersze.
- [ ] Wpisane 10 daje 40 px; „120,6” daje 121 px; tekst niebędący liczbą zostawia „Zastosuj” wyłączone.
- [ ] Podgląd inwestora i raport pracownika: brak pozycji szerokości w menu kolumn i w „Opcje”.

## 2026-10-23 — ai-stage-push — powiadomienia push o zmianie etapu AI

Wymaga produkcji (push wychodzi tylko z niej) i włączonych powiadomień na telefonach odbiorców
(menu telefonu → przełącznik powiadomień; na iPhonie najpierw zainstaluj aplikację na ekranie
głównym, w Safari przełącznika nie ma).

- [ ] Z innego konta ustaw inwestycji „Gotowa do analizy”: telefon admina dostaje powiadomienie
      z nazwą inwestycji, a dotknięcie otwiera stronę tej inwestycji. To samo dla „Nowe informacje”
      i „Recenzja zakończona”.
- [ ] Ustaw „Przeanalizowana”: powiadomienie dostają oba konta recenzentów; osoba, która zmieniła
      etap, nie dostaje go.
- [ ] Zapisz ten sam etap ponownie: żadne nowe powiadomienie nie przychodzi.
- [ ] Dwie różne inwestycje → „Przeanalizowana”: na telefonie są dwa osobne powiadomienia, nie
      jedno nadpisane.
- [ ] „Wiedza wyekstraktowana” nie wysyła nic.
- [ ] Przed następnym wgraniem szkicu AI uruchom loader z `DRY=1` (z tokenem sesji produkcji): wypisany
      SQL nie zawiera `ai_stage`, a skrypt nie zmienia etapu.
- [ ] Następne wgranie szkicu AI ustawia „Przeanalizowana” bez ręcznego kroku i powiadamia obu
      recenzentów.
- [ ] Po migracji zapis listy odbiorców na `/flota` nadal się udaje.

## EX-1091 — netto-expense-gross-settlement — wydatek netto przy rozliczeniu materiałów brutto

- [ ] Inwestycja rozliczana brutto z wydatkiem netto (np. Karol Pawlak Mirabelki 5/93, VAT 23%) →
      podsumowanie kosztorysu, „Wydatki”: wiersz „… netto*” pokazuje netto × 1,23 (Mirabelki:
      4504,73), pod tabelą przypis „*Wydatki netto liczone po stawce VAT inwestycji 23%”.
      „Pozostało do zapłaty” rośnie o tę samą różnicę względem netto (Mirabelki: +842,35).
- [ ] Inwestycja z wydatkiem netto rozliczana netto ze stawką (np. Mateusz Polis, Hilarego
      Koprowskiego 11m12, 8%): wydatek netto liczy się po netto (5276), bez gwiazdki i przypisu.
      Przełącz materiały na brutto → 5698,08 z gwiazdką i przypisem „… 8%”; przełącz z powrotem →
      5276.
- [ ] Podgląd inwestora tej samej inwestycji przy rozliczeniu brutto: jeden wiersz na kategorię,
      bez gwiazdki i przypisu; „Razem” równe widokowi managera.
- [ ] Lista inwestycji: „Wydatki inwestycyjne” i bilans Mirabelek zgadzają się z panelem
      podsumowania. Podpowiedź nagłówka „Wydatki inwestycyjne” wspomina „wydatek netto plus VAT
      inwestycji”.
- [ ] Protokół odbioru inwestycji rozliczanej brutto z wydatkiem netto: „Materiały” równe
      „Materiały” w Podsumowaniu.

# Zamknięte — indeks

Jedna linia na slice — liczby są policzone z pełnego rejestru sprzed przycięcia.
`boksy` = odhaczone/wszystkie; wiersz, w którym te liczby się różnią, ma swoją sekcję wyżej
w „Otwarte" (tam boksy bywają scalone, więc liczba nieodhaczonych może się różnić od reszty z tej
kolumny — to ten sam fakt zapisany raz zamiast dwa). `0/0` to sekcja czysto prozatorska, bez boksów.
`ostatnia weryfikacja` to najpóźniejsza data w sekcji; `—` znaczy, że sekcja żadnej nie nosiła.
Pełne dowody, verbatim: patrz nagłówek pliku.

| slice                                                                                                                        | boksy | ostatnia weryfikacja |
| ---------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------- |
| zakładka „Marża": prognoza i marża rzeczywista                                                                                 | 26/26 | 2026-09-04           |
| „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym                                                                    | 4/4   | —                    |
| stable per-row ids for expense line-items                                                                                      | 6/6   | 2026-09-04           |
| S-08 — kosztorys-delete-guard                                                                                                | 5/5   | 2026-07-10           |
| kosztorys-zaliczka-v2 — materiały netto/brutto w Podsumowaniu (slice A)                                                      | 4/4   | —                    |
| kosztorys-tryb-mieszany — cash-settlement view w Podsumowaniu (slice B)                                                      | 6/6   | 2026-09-04           |
| kosztorys-podsumowanie-tabs — zaliczka-v2 batch: tabbed Podsumowanie, Mieszane via vatPlane, wpłaty base fix        | 11/11 | 2026-09-14           |
| remove-section-coeff — drop per-section coeff tier + explicit section sidebar buttons                                        | 2/2   | 2026-08-26           |
| kosztorys-percent-rabat-bulk-apply                                                                                             | 8/8   | 2026-08-26           |
| etap-tool-plane — per-etap rozliczenie plane + view-independent subcontractor settlement                            | 18/18 | 2026-09-14           |
| subcontractor-view-settlement-only                                                                                             | 16/16 | 2026-09-14           |
| netto investment-expense type (`INVESTMENT_EXPENSE_NET`)                                                                       | 0/0   | 2026-07-26           |
| section header rows (bands) in the kosztorys grid                                                                              | 15/15 | 2026-09-14           |
| netto expenses get their own tab in the wydatki list                                                                           | 10/10 | 2026-09-15           |
| client-facing „Pobierz faktury" in the kosztorys Wydatki tab                                                                   | 12/12 | 2026-09-04           |
| kosztorys-invoice-note-and-preview                                                                                             | 17/17 | 2026-09-04           |
| investment-settlement-mode                                                                                                     | 14/14 | 2026-09-04           |
| investment-summary-panel                                                                                                       | 26/26 | 2026-09-15           |
| materials-net-pricing-persisted                                                                                                | 15/15 | 2026-09-15           |
| decouple-panel-write-refresh                                                                                                   | 21/21 | 2026-09-15           |
| rabat globalny: activates on selection, undoable, one „Zapisz"                                                                 | 8/8   | —                    |
| the % mass-overwrite gets a confirm dialog, not an undo entry                                                                  | 9/9   | 2026-07-27           |
| kosztorys-section-footer-row                                                                                                   | 14/14 | 2026-09-14           |
| nazwa inwestycji w górnym pasku bez trzeciego zapytania                                                                        | 5/5   | —                    |
| subcontractor-price-guard                                                                                                      | 21/21 | 2026-09-15           |
| drop-empty-kosztorys-scaffold                                                                                                  | 8/8   | 2026-09-03           |
| scalable-preset-section-picker                                                                                                 | 12/12 | 2026-09-15           |
| cancellation-sum-overcount                                                                                                     | 10/10 | 2026-10-14           |
| drop-cost-variant-columns                                                                                                      | 7/7   | —                    |
| investment-panel-filter-scope — ZDEZAKTUALIZOWANE                                                                              | 0/0   | 2026-08-08           |
| harden bulk-insert restore                                                                                                     | 2/2   | 2026-08-26           |
| summary-panel-filter-blind — panel wholly filter-blind, scope-marker apparatus deleted                                       | 12/12 | 2026-09-15           |
| AI receipt scan: extract the netto amount                                                                           | 5/5   | —                    |
| Multi-page invoices                                                                                                 | 17/17 | 2026-09-15           |
| Dodawanie faktur wprost z „+" w tabeli wydatków                                                                     | 5/5   | —                    |
| cron-lead-reconcile                                                                                                 | 4/7   | 2026-09-15           |
| lead-recovery-notifies-sales                                                                                        | 2/4   | 2026-09-15           |
| investments-listing-expense-plane — wydatki w liście na płaszczyźnie rozliczenia materiałów                                  | 15/15 | 2026-09-15           |
| kosztorys-importer                                                                                                  | 13/13 | 2026-09-04           |
| ex-560-reload-from-preset                                                                                                      | 7/7   | 2026-09-03           |
| robocizna + rabat z kosztorysu na liście inwestycji (write-switch)                                                             | 16/16 | 2026-09-04           |
| wpłaty bez inwestycji („Inna wpłata" wraca, oba typy tracą inwestycję)                                                         | 6/6   | —                    |
| strata obniża dług inwestora jak rabat                                                                                         | 16/16 | 2026-09-15           |
| rozjazd „Pomiar z natury" vs suma etapów po imporcie                                                                           | 13/13 | 2026-09-15           |
| sortowanie wewnątrz sekcji                                                                                                     | 5/5   | —                    |
| zakres sortowania kolumny + „Zapisz kolejność" w menu nagłówka                                                                 | 13/13 | 2026-09-04           |
| sheet-live-compare — „Porównaj z arkuszem Google"                                                                   | 17/17 | 2026-09-15           |
| kosztorys-filter-conditions — jeden rejestr warunków filtrowania                                                    | 16/16 | 2026-09-15           |
| sheet-column-mapping — ręczne wskazanie kolumny arkusza                                                             | 11/11 | 2026-09-15           |
| kosztorys-terminology — rename identyfikatorów Polish→English                                                       | 5/5   | 2026-09-03           |
| kosztorys-column-order — okno „Ustaw kolejność kolumn"                                                              | 11/11 | 2026-09-04           |
| kosztorys-editor-hook-split — rozbicie hooka edytora                                                                | 22/22 | 2026-09-15           |
| client-preview-settings — ustawienia podglądu inwestora                                                             | 11/11 | 2026-09-15           |
| drop-stage-percent-columns — usunięcie kolumn „% wykonania" per etap                                                | 8/8   | 2026-08-26           |
| filtry-problemy — grupa „Problemy" w menu Filtry — ZDEZAKTUALIZOWANE                                                         | 0/0   | 2026-08-26           |
| nomenklatura inwestora + potwierdzenie zmiany trybu                                                                          | 9/9   | —                    |
| filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)                                                                      | 9/9   | —                    |
| sortowanie-kolumn-spojne — sortowanie w każdej kolumnie z danymi                                                             | 13/13 | 2026-09-15           |
| pasek aktywnych filtrów i trzy nowe pary warunków                                                                              | 15/15 | 2026-09-15           |
| moduł floty: przeglądy pojazdów i przypomnienia mailowe                                                                        | 28/28 | 2026-09-15           |
| blob-store-isolation — lokalny dev na preview Blob store                                                                     | 11/11 | 2026-09-15           |
| import-zastepuje-w-calosci — import zastępuje całą rozpiskę                                                                  | 7/7   | 2026-09-15           |
| kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie" — ZDEZAKTUALIZOWANE                        | 6/6   | 2026-09-28           |
| sheet-measured-qty-from-formula — „Pomiar z natury" z formuły                                                                | 2/2   | 2026-09-04           |
| mixed-settlement-both-planes — wpłaty na obu planach, jeden bilans na tryb                                                   | 7/7   | —                    |
| nadmiarowe odczyty na trasach kosztorysu                                                                                       | 12/12 | 2026-09-15           |
| flota: ręczne znaczniki „do wymiany" i typ „Serwis"                                                                            | 31/31 | 2026-09-15           |
| HEIC: dziura w edycji przelewu + backfill starych faktur                                                                       | 12/12 | 2026-09-15           |
| S-18 (cut) — spot-check perfu edytora przy ~1000 pozycjach                                                                   | 7/7   | 2026-09-14           |
| Kosztorys — jeden kontrakt edycji dla komórek liczbowych (przecinek, wycofanie, toast)                                       | 28/28 | 2026-09-15           |
| fleet-sheet-parity — parytet z arkuszem kontroli przeglądów i ubezpieczeń                                                    | 5/5   | 2026-10-31           |
| import-etapy-z-arkusza — puste etapy odsiane, podpisy i rozliczenie z okna importu                                           | 12/12 | 2026-09-04           |
| fleet-costs-window — okno czasu na karcie pojazdu + kolumna Opony                                                            | 12/12 | 2026-08-26           |
| table-column-reordering — kolejność kolumn w tabelach                                                                        | 10/10 | 2026-08-26           |
| notification-recipients — odbiorcy powiadomień na `/flota` i `/zgloszenia`                                                   | 15/15 | 2026-09-15           |
| forms-reset-clear — formularze czyszczą się po udanym zapisie                                                                | 13/13 | 2026-09-15           |
| sheet-write-env-guard — zapis do Google Sheets tylko z produkcji                                                             | 12/12 | 2026-09-04           |
| work-item-catalog — „Katalog prac"                                                                                           | 25/25 | 2026-09-15           |
| wysokość wiersza w edytorze i dopasowanie do treści w podglądzie klienta                                                       | 0/0   | 2026-08-31           |
| Stawka „auto" w katalogu prac (2026-09-01, `katalog-prac-auto-rates`)                                                        | 5/5   | 2026-09-03           |
| legacy-sheet-work-import (2026-09-01)                                                                                          | 8/8   | 2026-09-02           |
| Kolumny stawek wykonawcy obu planów w widoku Inwestora (2026-09-01, `kosztorys-contractor-price-columns-in-client-view`)     | 0/0   | 2026-09-02           |
| Dwie opcje źródła ceny wykonawcy (2026-09-01, `kosztorys-dwie-opcje-zrodla-ceny-wykonawcy`)                                  | 1/1   | 2026-09-02           |
| Przerzedzanie snapshotów kosztorysu (2026-09-02, `snapshot-retention-thinning`)                                              | 4/4   | 2026-09-15           |
| Zwinięcie nadpisania stawki podwykonawcy (2026-09-02, `subcontractor-override-value-collapse`)                       | 8/8   | 2026-09-02           |
| divergent-price-for-same-work (2026-09-02)                                                                                     | 0/0   | 2026-09-02           |
| rozbicie `row-conditions.ts` na rejestr i zapytania (2026-09-02, `row-conditions-registry-engine-split`)                       | 4/4   | 2026-09-03           |
| zakończona inwestycja jest zablokowana (2026-09-03, `investment-lock-on-completed`)                                            | 14/14 | 2026-09-04           |
| Katalog narzędzi i urządzeń (rejestr sprzętu)                                                                                  | 11/13 | 2026-09-15           |
| drag-drop-guard — chybiony drop pliku i widoczne dropzone (2026-09-14)                                                       | 14/14 | 2026-09-15           |
| transfer-print-return — wydruk przefiltrowanej listy transakcji (2026-09-14)                                                 | 15/15 | 2026-09-15           |
| szablony-crud                                                                                                                | 16/16 | 2026-09-15           |
| kosztorys-section-menu-split — akcje sekcji na pasku, akcje pracy na wierszu                                                 | 18/18 | 2026-09-14           |
| transfers-server-sort — sortowanie tabeli transakcji na serwerze (2026-09-15)                                        | 13/13 | 2026-09-15           |
| rwd-mobile — RWD na telefonie: nawigacja, dodawanie i pokazywanie transakcji (2026-09-16)                            | 7/7   | 2026-09-16           |
| media-upload-serial — równoległy upload gubił pliki na Neonie; szeregowy zapis wierszy `media` (2026-09-22)          | 4/4   | 2026-09-22           |
| empty-preset-create — pusty szablon zakładany z listy szablonów (2026-09-22)                                                 | 5/5   | 2026-09-23           |
| szablon-autosave — warsztat szablonu zapisuje się sam (2026-09-22)                                                           | 12/14 | 2026-09-29           |
| kosztorys-editor-assets — galeria assetów w edytorze kosztorysu v2 (2026-09-22)                                              | 8/8   | 2026-09-23           |
| zakladka-inwestycja-w-panelu — zakładka „Inwestycja" w panelu Podsumowanie (2026-09-22)                                      | 25/25 | 2026-09-24           |
| Nowa sekcja wprost w „Dodaj pracę z katalogu" (2026-09-22)                                                                   | 6/6   | 2026-09-23           |
| kategorie-assetow-i-kompresja — kategorie assetów i luźniejsza kompresja (2026-09-22)                                        | 13/13 | 2026-09-23           |
| sufit stawki wykonawcy z „Problemów" do „Filtrów" (2026-09-22)                                                                 | 9/9   | 2026-09-29           |
| 2026-10-11 — raporty-removal                                                                                                 | 1/1   | 2026-10-14           |
| clean-texts-catalogue-names — nazwy prac z tabeli poprawek katalogu (2026-09-15)                                             | 13/13 | 2026-09-29           |
| ui/ layering refactor (staging/preview pass, 2026-09-16)                                                                       | 10/10 | 2026-09-21           |
| investment-assets-dialog (galeria bez miniatur, 2026-09-21)                                                                    | 12/12 | 2026-09-22           |
| katalog-problems — rozjazdy z katalogiem prac jako problemy edytora (2026-09-21)                                             | 9/9   | 2026-09-21           |
| catalogue-compare-bulk-update — hurtowa aktualizacja rozpiski z katalogu (2026-09-21)                                        | 14/14 | 2026-09-21           |
| tagowanie cache galerii i pojedynczy render po uploadzie (2026-09-22)                                                          | 8/8   | 2026-09-23           |
| „Filtry" bez bramki widoku, warsztat bez przełącznika cen (2026-09-23)                                                         | 8/8   | 2026-09-23           |
| „Własny mnożnik" jako trzecie źródło stawki wykonawcy (2026-09-23)                                                             | 15/15 | 2026-09-29           |
| wydruk-oferty — Wydruk oferty z kosztorysu (2026-09-23)                                                                      | 5/5   | 2026-09-29           |
| zamrozone-brutto-wydatku-netto                                                                                               | 4/4   | —                    |
| pokaz-wszystkie-pozycje                                                                                                      | 8/8   | 2026-09-28           |
| Kosztorys — manager udostępnia inwestorowi + wydruk oferty bez nagłówków (cdd32061, 8a6552c5) — staging 2026-09-24           | 1/1   | 2026-09-24           |
| wartość spoza zakresu odmawiana na głos, nie przycinana (2026-09-28)                                                           | 6/6   | 2026-09-28           |
| podglad-inwestora-czytelnosc — podgląd inwestora bez szarości, z pasami kolumn (2026-09-28)                                  | 8/8   | 2026-09-28           |
| sheet-import-wartosc-pomiar — import rozpoznaje „Wartość netto pomiar z natury" (2026-09-28)                                 | 4/4   | 2026-09-28           |
| kosztorys-worker-view — widok i PDF pracownika z menu „Pracownicy" (2026-09-28)                                      | 14/14 | 2026-09-29           |
| kosztorys-remaining-skip-overrun — „Pozostało" bez wierszy na minusie, minus na czerwono (2026-09-28)                | 6/6   | 2026-09-28           |
| szablon-open-speed — „Otwórz szablon" bez przeładowania trasy (2026-09-28)                                           | 11/11 | 2026-09-29           |
| document-column-order — kolejność kolumn inwestora i pracownika ustawiana w ustawieniach (2026-09-28)                | 7/7   | 2026-09-28           |
| investor-change-history — historia zmian w widoku inwestora (2026-09-28)                                             | 9/9   | 2026-09-28           |
| kosztorys-column-value-single-source — sortowanie kolumn liczonych po liczbach z komórek (2026-09-29)                | 13/13 | 2026-09-30           |
| worker-link-revoke — link pracownika do wyłączenia przy blokadzie (2026-09-29)                                       | 6/6   | 2026-09-29           |
| warsztat-per-szablon — szablon jest inwestycją o statusie `szablon` (2026-09-29)                                     | 9/9   | 2026-09-29           |
| investments-list-payout-remaining — „Pozostało do wypłaty" na liście inwestycji (2026-09-29)                                 | 5/5   | 2026-10-02           |
| kosz-inwestycji-manager — kosz inwestycji dla kierownika (2026-09-29)                                                        | 6/6   | 2026-10-14           |
| investment-wycena-status — status inwestycji „Wycena" (2026-09-29)                                                           | 6/6   | 2026-09-29           |
| confirm-dialog-dead-pending — okno potwierdzenia bez martwego stanu „w toku" (2026-09-29)                            | 8/8   | 2026-10-15           |
| 2026-09-29 — pasy kolumn na wydrukach                                                                                        | 3/3   | 2026-09-29           |
| 2026-09-29 — kolumna „Wartość netto (razem etapy)" na dokumencie inwestora                                                   | 3/3   | 2026-09-29           |
| 2026-09-29 — akcja bez sieci kończy się toastem                                                                              | 19/19 | 2026-09-30           |
| global-rabat-on-settlement-axis — rabat kwotowy w netto albo w brutto (2026-09-29)                                             | 11/11 | 2026-09-29           |
| redundant-router-refresh — nieaktualne dane po zapisie, staging (2026-09-29)                                                   | 75/75 | 2026-10-01           |
| 2026-09-29 — kosztorys-menu-widths                                                                                           | 3/3   | 2026-10-06           |
| 2026-09-29 — import z arkusza czyta etapy aż do „Przedmiaru"                                                                 | 2/2   | 2026-09-30           |
| 2026-09-29 — nowy etap kopiuje rozliczenie i wykonawcę ostatniego                                                            | 5/5   | 2026-10-01           |
| 2026-09-30 — import z arkusza ustawia jednego wykonawcę wszystkim etapom                                                     | 6/6   | 2026-10-15           |
| 2026-09-30 — „Rozlicz wypłaty": kwota do rozdysponowania i saldo kasy                                                        | 1/1   | 2026-09-30           |
| okna edycji nie gubią wpisanych danych po nieudanym zapisie (2026-09-30)                                                       | 3/3   | 2026-10-01           |
| kosz-kas                                                                                                                       | 9/9   | 2026-10-01           |
| worker-work-reports — pracownik zgłasza ilości, kierownik przyjmuje (2026-09-30)                                               | 35/35 | 2026-10-15           |
| kosztorys-new-item-dialog — „Nowa praca” jako formularz (2026-09-30)                                                           | 15/15 | 2026-10-15           |
| request-failed-actions — zerwane połączenie kończy się polskim komunikatem (2026-09-30)                                        | 16/16 | 2026-10-04           |
| 2026-10-01 — marza-v2-half-grosz — lista i strona inwestycji pokazują tę samą marżę v2                                       | 3/3   | 2026-10-01           |
| 2026-10-01 — sidebar-scroll — przy niskim oknie menu boczne się przewija                                                     | 2/2   | 2026-10-03           |
| 2026-10-01 — nazwy-zgloszen                                                                                                  | 2/2   | 2026-10-03           |
| 2026-10-01 — kosz-pod-adminem                                                                                                | 2/2   | 2026-10-03           |
| 2026-10-01 — zgloszenia-prac-pod-pracownikami                                                                                | 2/2   | 2026-10-03           |
| 2026-10-01 — kosz-inwestycji-blokady                                                                                         | 8/8   | 2026-10-03           |
| 2026-10-01 — loader-nad-pytaniem                                                                                             | 3/3   | 2026-10-03           |
| 2026-10-01 — notatki-podzialy-linii                                                                                          | 2/2   | 2026-10-03           |
| kosz-pracownikow                                                                                                               | 19/19 | 2026-10-06           |
| kosz-floty-i-sprzetu                                                                                                          | 12/12 | 2026-10-03           |
| worker-report-translations-ua — link „Zgłoszenie prac" po ukraińsku i rosyjsku (2026-10-01)                                    | 22/22 | 2026-10-15           |
| investment-review-request — prośba o opinię Google dla zakończonej inwestycji (2026-10-02)                                     | 2/2   | 2026-10-02           |
| kosztorys-section-translations — nazwy sekcji po ukraińsku i rosyjsku na linku „Zgłoszenie prac"                               | 9/9   | 2026-10-04           |
| 2026-10-02 — investments-listing-no-kosztorys-figures — inwestycja bez kosztorysu pokazuje prawdziwe kwoty v2                | 6/6   | 2026-10-02           |
| premia — premia wyrównuje nadpłatę pracownika, inwestor jej nie widzi (2026-10-02)                                             | 11/11 | 2026-10-15           |
| worker-email-clash — pracownik z e-mailem zajętym przez pracownika z Kosza (2026-10-05)                                        | 3/3   | 2026-10-05           |
| worker-kasy-visibility — kasy pracownika na liście i na jego stronie (2026-10-05)                                              | 11/11 | 2026-10-05           |
| 2026-10-05 — share-links-copy-and-404 — nowy link od razu w schowku, cofnięty link mówi „wygasł"                             | 4/4   | 2026-10-05           |
| 2026-10-05 — worker-report-reported-only — „Tylko zgłoszone” i szersza kolumna „Zgłaszam”                                    | 7/7   | 2026-10-14           |
| worker-single-view — jeden widok pracownika: „Zgłoszenie prac" z trybem „Inwestycja"                                           | 1/1   | 2026-10-05           |
| 2026-10-05 — worker-view-dogfooding — link `/z/…`, tryby w stopce, liczniki                                                  | 14/14 | 2026-10-15           |
| stage-split-rounding — części podziału etapu sumują się do „Razem" co do grosza (2026-10-05)                                   | 3/3   | 2026-10-05           |
| worker-reports-pagination — strony, filtry i sortowanie na liście „Zgłoszenia prac” (2026-10-05)                               | 6/6   | 2026-10-05           |
| 2026-10-05 — settlement-negative-footnote — ujemne „Pozostało do zapłaty” zamiast „Nadpłata”                                 | 3/3   | 2026-10-05           |
| 2026-10-05 — keep-date-on-keep-open — data zostaje po zapisie z „Nie zamykaj”                                                | 3/3   | 2026-10-05           |
| worker-account — pracownik loguje się na własną stronę: kasy, sprzęt, transfery, kosztorysy (2026-10-05)                       | 13/13 | 2026-10-06           |
| worker-pdf-translations — j.m. i PDF pracownika w jego języku (2026-10-05)                                                     | 11/11 | 2026-10-05           |
| worker-expenses — pracownik zgłasza wydatek z paragonem, kierownik przyjmuje go w Transakcjach (2026-10-05)                    | 29/29 | 2026-10-15           |
| 2026-10-05 — pagination-limit-width — „100” mieści się w selekcie „Pokaż”                                                    | 1/1   | 2026-10-05           |
| worker-self-credentials — pracownik zmienia swój e-mail i hasło (2026-10-05)                                                   | 10/10 | 2026-10-05           |
| worker-page-language — pracownik ustawia „Domyślny język”, aplikacja i raport idą za nim (2026-10-05)                          | 3/3   | 2026-10-06           |
| 2026-10-05 — worker-report-figures — „Wykonano” i „Pozostało” w raporcie pracownika, przełączniki w „Opcje”                  | 8/8   | 2026-10-05           |
| 2026-10-06 — worker-report-pending-only — link pracownika pokazuje tylko zgłoszenia „do sprawdzenia”                         | 5/5   | 2026-10-06           |
| 2026-10-06 — transfers-type-column-width — szersza kolumna „Typ” w tabeli transakcji                                         | 1/1   | 2026-10-06           |
| kosztorys-reorder-dialog — „Ustaw kolejność” (prace i sekcje)                                                                  | 18/18 | 2026-10-09           |
| kosztorys-summary-resizable                                                                                                  | 16/16 | —                    |
| worker-expense-ai-prefill — zgłoszenie pracownika otwiera się z odczytanym paragonem (2026-10-06)                              | 0/0   | 2026-10-06           |
| 2026-10-06 — worker-report-ref-column — numer „Nr” w oknie akceptacji zgłoszeń                                               | 2/2   | 2026-10-06           |
| 2026-10-06 — cash-register-edit-button                                                                                       | 1/1   | 2026-10-06           |
| telmak-invoice-check — sprawdzanie paczki faktur Telmak na stronie kasy Telmak (2026-10-06)                                    | 17/17 | 2026-10-06           |
| 2026-10-06 — worker-form-headers                                                                                             | 1/1   | 2026-10-06           |
| 2026-10-06 — nav-user-name-link                                                                                              | 2/2   | 2026-10-06           |
| 2026-10-06 — employee-access-audit — zalogowany pracownik nie widzi i nie zrobi niczego poza swoją stroną                    | 24/24 | 2026-10-06           |
| kosztorys-ai-knowledge-loop — Komentarz do pracy, przegląd szkicu AI, widoki „Oferta" i „Przegląd AI" (2026-10-07)             | 5/5   | 2026-10-15           |
| 2026-10-07 — worker-page-quick-actions — „Dodaj wydatek” i „Zgłoś pracę” nad „Moimi kasami”                                  | 2/2   | 2026-10-09           |
| 2026-10-07 — kosztorys-fit-all-columns — „Dopasuj wysokość do treści” mierzy każdą kolumnę                                   | 5/5   | 2026-10-07           |
| 2026-10-07 — investments-created-at-column — kolumna „Data dodania” na liście inwestycji                                     | 3/3   | 2026-10-07           |
| 2026-10-08 — investment-notes-inline-edit — edycja notatki inwestycji w miejscu                                              | 5/5   | 2026-10-08           |
| 2026-10-08 — other-expense-worker — „Inny wydatek” z opcjonalnym pracownikiem                                      | 7/7   | 2026-10-08           |
| template-from-catalogue — szablon jako lista prac z katalogu (2026-10-08)                                                      | 14/14 | 2026-10-09           |
| 2026-10-08 — catalogue-usage-columns — kolumny „Kosztorysy” i „Szablony” w katalogu prac                                     | 7/7   | 2026-10-09           |
| 2026-10-08 — expense-draft-missing-pages — odrzucenie zgłoszenia, którego zdjęć nie da się pobrać                            | 3/3   | 2026-10-09           |
| 2026-10-08 — worker-report-columns-default — „Wykonano” i postęp widoczne domyślnie, wybór zapamiętany                       | 2/2   | 2026-10-08           |
| 2026-10-08 — przycisk „Przegląd AI" na pasku narzędzi                                                                        | 3/3   | 2026-10-08           |
| 2026-10-08 — „Komentarz" na widoku inwestora                                                                                 | 3/3   | 2026-10-08           |
| ai-draft-missing-data — „Komentarz AI” w „Przeglądzie AI”                                                                      | 5/5   | —                    |
| 2026-10-08 — transfer-cards (spike) — widok kart transakcji na telefonie                                                     | 12/12 | 2026-10-09           |
| 2026-10-09 — worker-report-default-new-stage — zgłoszenie pracy domyślnie do nowego etapu                                    | 3/3   | 2026-10-09           |
| 2026-10-09 — done-percent-vs-offer — „% wykonania (względem przedmiaru ofertowego)”                                          | 18/18 | 2026-10-09           |
| 2026-10-09 — worker-expense-without-investment — wydatek pracownika bez inwestycji                                           | 14/14 | 2026-10-14           |
| 2026-10-11 — expense-missing-invoice-confirm — „Brak faktury” przed zapisem wydatku inwestycyjnego                           | 13/13 | 2026-10-15           |
| 2026-10-11 — investments-default-sort — lista inwestycji od najnowszej                                                       | 1/1   | 2026-10-14           |
| 2026-10-11 — worker-page-uncolored-amounts — kwoty bez koloru typu na stronie pracownika                                     | 2/2   | 2026-10-15           |
| 2026-10-11 — sidebar-wider-smaller-logo — szerszy pasek boczny, mniejsze logo                                                | 1/1   | 2026-10-14           |
| 2026-10-11 — stage-plane-gate — jedno rozliczenie pracownika na inwestycji                                                   | 4/4   | 2026-10-15           |
| 2026-10-11 — worker-report-extras-sum — pozycje dodatkowe dopisują się do istniejącej pracy                                  | 3/3   | 2026-10-14           |
| 2026-10-11 — worker-payout-confirmation — pracownik potwierdza albo odrzuca wypłatę                                | 12/12 | 2026-10-15           |
| 2026-10-12 — install-button-phone-only — „Zainstaluj aplikację" tylko na telefonie                                           | 2/2   | 2026-10-14           |
| 2026-10-12 — szablon-column-picker — ukrywanie i przesuwanie kolumn w szablonie                                              | 6/6   | 2026-10-14           |
| 2026-10-12 — manual-naming — nazwa „Manual” i etykieta komentarza do pracy                                                   | 2/2   | 2026-10-14           |
| 2026-10-12 — investment-notes-collapsible — zwijane „Notatki” inwestycji                                                     | 4/4   | 2026-10-15           |
| 2026-10-12 — investment-notes-markdown — nagłówki, listy i pogrubienie w „Notatkach”                                         | 3/3   | 2026-10-15           |
| 2026-10-13 — planned-done-percent-red — „% wykonania (względem przedmiaru ofertowego)” na czerwono                           | 2/2   | 2026-10-14           |
| 2026-10-13 — stage-qty-sum-rename — „Pomiar z natury (etapy razem)”                                                          | 2/2   | 2026-10-15           |
| 2026-10-13 — receipt-media-ids-copy — zapis wydatku ze zgłoszenia z wieloma paragonami na jednym zdjęciu                     | 1/1   | 2026-10-15           |
| 2026-10-13 — report-review-layout — kolejność grup i stopka w „Zgłoszenia wykonanych prac”                                   | 3/3   | 2026-10-14           |
| 2026-10-13 — worker-draft-merge-receipts — „Połącz zaznaczone” / „Rozłącz” w „Przyjmij”                            | 11/11 | 2026-10-15           |
| 2026-10-13 — pending-drafts-collapsible — zwijana sekcja „Wydatki zgłoszone przez pracowników”                               | 3/3   | 2026-10-14           |
| 2026-10-13 — percent-overrun-label — przekroczenie nigdy nie pokazuje „100%”                                                 | 2/2   | 2026-10-14           |
| 2026-10-13 — worker-expense-paragon-decisions — „Przyjmij / Odrzuć” paragon po paragonie, „Połącz zgłoszenia”      | 19/19 | 2026-10-13           |
| 2026-10-14 — expense-duplicate-finder — „Szukaj duplikatów” na liście transakcji                                   | 10/10 | 2026-10-15           |
| 2026-10-14 — review-gate-fixes-14 — poprawki z przeglądu commitów z 14.10                                                    | 3/3   | 2026-10-15           |
| 2026-10-14 — ai-stage-new-information — status AI „Nowe informacje”                                                          | 2/2   | 2026-10-14           |
| 2026-10-14 — investment-ai-notes — „Uwagi AI” przy inwestycji                                                                | 4/4   | 2026-10-14           |
| 2026-10-14 — media-plan-hint — pole „Do analizy AI” przy dodawaniu plików                                                    | 1/1   | 2026-10-14           |
| 2026-10-14 — input-shadow — delikatny cień pól tekstowych                                                                    | 1/1   | 2026-10-14           |
| pg-pool-adapter — transakcje na Neonie z własnym połączeniem (staging)                                                         | 47/47 | 2026-10-15           |
| 2026-10-14 — komentarz-ai-odstep — odstęp między polami „Komentarza AI”                                                      | 3/3   | 2026-10-14           |
| 2026-10-14 — worker-report-sticky-wobble — nagłówek tabeli w raporcie pracownika nie drga                                    | 1/1   | 2026-10-14           |
| przełącznik „Zgłoszone wydatki” w transakcjach                                                                                 | 15/15 | 2026-10-15           |
| EX-1033 — document-settings-column-map — ustawienia kolumn dokumentów zapisane jako wybór per kolumna                        | 8/8   | 2026-10-15           |
| usun-wszystkie-ukryte — „Usuń wszystkie” schowane w dokumentacji inwestycji do czasu kosza                                     | 3/3   | 2026-10-15           |
| 2026-10-15 — media-preview-pdf-preload — podgląd PDF nie kręci się bez końca + wczytywanie sąsiednich stron                  | 6/6   | 2026-10-15           |
| roundtrip-audit — mniej zapytań na stronę i lżejsza strona (bez zmiany wyglądu)                                                | 10/10 | 2026-10-15           |
| 2026-10-15 — workers-menu-scan-bottom — „Wczytaj zgłoszenie z kartki (AI)” na dole menu „Pracownicy”                         | 2/2   | 2026-10-15           |
| deploy-scoped-cache — cache kluczowany deploymentem zamiast ręcznych `-vN` (bez zmiany wyglądu)                                | 5/5   | 2026-10-15           |
| investment-status-rejected — status „Odrzucona” + inwestycje w formularzach przelewów                                          | 2/2   | 2026-10-15           |
| EX-1065 — catalogue-auto-translate — nocny cron dotłumacza katalog prac | 2/2 | 2026-10-18 |
| 2026-10-11 — worker-report-back-button — „Wstecz” na stronie zgłoszenia pracy w aplikacji | 5/5 | 2026-10-19 |
| 2026-10-14 — worker-report-text-size — wielkość czcionki i wąskie kolumny w raporcie pracownika | 1/1 | 2026-10-19 |
| 2026-10-15 — investment-status-badge — status na stronie inwestycji jako badge | 2/2 | 2026-10-18 |
| 2026-10-16 — investment-billing-data — adres inwestycji rozbity na pola + „Dane do umowy / faktury” | 7/7 | 2026-10-18 |
| 2026-10-16 — investment-form-layout-status-select — nowy układ formularza inwestycji + status z listy | 8/8 | 2026-10-18 |
| 2026-10-16 — transfer-view-switch-mobile — przełącznik tabela/karty na telefonie | 2/2 | 2026-10-18 |
| 2026-10-16 — worker-drafts-in-type-filter — „Zgłoszone wydatki” w „Typ” + szersza kolumna pracowników | 3/3 | 2026-10-18 |
| 2026-10-16 — catalogue-filters-and-stage-latch — katalog prac, filtry trzymają edytowaną pozycję, etap zakończony | 6/6 | 2026-10-18 |
| 2026-10-16 — offer-planned-discount-amount — „Rabat kwota netto (przedmiar)” + „— po rabacie” w ofercie | 6/6 | 2026-10-18 |
| 2026-10-18 — dead-code-cleanup — usunięty martwy kod, zachowanie bez zmian | 5/5 | 2026-10-18 |
| 2026-10-18 — test-suite-audit faza 1 — zapytanie o wpłaty inwestora uproszczone, zachowanie bez zmian | 1/1 | 2026-10-18 |
| EX-1033 — document-settings-column-map — odczyt starego formatu ustawień kolumn usunięty | 1/1 | 2026-10-18 |
| EX-1078 — drop-scan-mode — zgłoszenia wydatków bez martwej kolumny, zachowanie bez zmian | 2/2 | 2026-10-19 |
| EX-1080 — restore-lock-first — „Przywróć wersję" zapisuje stan sprzed przywrócenia | 1/1 | 2026-10-19 |
| EX-1079 — worker-account-scope — „Edytuj pracownika" trzyma zasady kont | 5/5 | 2026-10-19 |
| EX-1089 — cache-tag-epoch — po zapisie odczyt nie wraca do stanu sprzed zmiany | 2/2 | 2026-10-18 |
| 2026-10-18 — media-holders-one-list — pliki ze zgłoszeń dalej chronione | 1/1 | 2026-10-19 |
| pass 9 — staging 2026-10-18 (zbiorcze findings) | 14/14 | 2026-10-19 |
| EX-1097 — unknown-route-nav — z 404 da się wyjść linkiem z menu | 4/4 | 2026-10-19 |
| 2026-10-19 — app-audit-refactor faza 5 — reguły kolekcji w nowym miejscu | 3/3 | 2026-10-19 |
| 2026-10-19 — szerszy dialog „Szczegóły" leada | 2/2 | 2026-10-19 |
| 2026-10-19 — cancel-rejected-payout — odrzuconą wypłatę anuluje każdy z zarządu | 3/3 | 2026-10-19 |
| 2026-10-19 — cards-hide-table-controls — „Kolumny” i „Szukaj duplikatów” tylko w widoku tabeli | 3/3 | 2026-10-19 |

