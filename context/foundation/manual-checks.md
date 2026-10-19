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
- [ ] Dokładnie jeden mail podsumowujący, wyłącznie na „Alerty techniczne" (nie do sprzedaży), bez
      Mail poza produkcją nie wychodzi — z założenia nie do sprawdzenia tu (`context/reference/outgoing-effects-isolation.md` § Poczta).
      danych kontaktowych i bez instrukcji „zadzwoń sam" — **blokady 2, 3 i 4**. Alert
      (`notifyReconcileFailure`/`notifyReconcileRecovery`) leci z trasy crona, która jest dziś
      jedynym wołającym sweepa — ręczny przycisk „Pobierz z Facebooka" został usunięty.
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — blokady 2 i 4 (mail nie wychodzi poza produkcją, brak dostępu do skrzynki)._
      _needs human: mail alertowy „Alerty techniczne” — poczta tylko z produkcji, brak dostępu do skrzynki_

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
- [ ] Ten sam request powtórzony nie tworzy niczego i nie wysyła maila
      Nie do sprawdzenia na stagingu — agent nie zna sekretu `LANDING_WEBHOOK_SECRET` z Preview.
      _2026-09-30: jak wyżej — brak sekretu Preview (403 na poprawnie podpisany request z sekretem z `.env`)._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
      _needs human: podpisany webhook landingu — sekret LANDING_WEBHOOK_SECRET z Preview niedostępny_
- [ ] Request z `assets[].url` spoza hosta z allowlisty jest odrzucony i alertuje
      Nie do sprawdzenia na stagingu — agent nie zna sekretu `LANDING_WEBHOOK_SECRET` z Preview.
      _2026-09-30: jak wyżej — brak sekretu Preview; bez ważnego podpisu request nie dochodzi do walidacji hosta._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
      _needs human: podpisany webhook landingu — sekret LANDING_WEBHOOK_SECRET z Preview niedostępny_
- [ ] Request z podmienionym body jest odrzucony (403)
      Nie do sprawdzenia na stagingu — agent nie zna sekretu `LANDING_WEBHOOK_SECRET` z Preview.
      _2026-09-30: 403 obserwowane, ale nie do zaliczenia — poprawnie podpisany request też dostał 403 (zły sekret), więc odrzucenie nie dowodzi kontroli podpisu._
      _Zweryfikowano 2026-09-29 (staging): NIE ZWERYFIKOWANO — wymaga podpisu HMAC z LANDING_WEBHOOK_SECRET (Secret na Preview, niedostępny) i realnego bloba landingu; brak izolacji, by podpisać żądanie._
      _needs human: podpisany webhook landingu — sekret LANDING_WEBHOOK_SECRET z Preview niedostępny (403 nie dowodzi kontroli podpisu)_

## materialy-inwestora-brutto

### Phase 3: E2E

- [ ] `pnpm test:e2e e2e/client-share.spec.ts` na świeżo zaseedowanym db-test przechodzi.
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._
      _Nie sprawdzone 2026-10-04 (staging): spec E2E uruchamia człowiek (nie uruchamiam `pnpm test:e2e`)._
      _needs human: spec E2E (`pnpm test:e2e`) uruchamia wyłącznie człowiek_

## catalogue-picker-virtualization — „Dodaj pracę z katalogu" rysuje tylko widoczne wiersze (2026-09-28)

Lista w oknie rysuje tylko to, co widać; zmiana we wspólnej tabeli dotyka też dwóch tabel
podsumowania kosztorysu. Pierwsze cztery sprawdzone lokalnie (build produkcyjny, inw. 157) — do
powtórzenia na stagingu.

- [ ] `pnpm exec playwright test e2e/work-catalogue.spec.ts` na bazie E2E — uruchamia człowiek
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._
      _needs human: spec E2E uruchamia wyłącznie człowiek_

## protokol-odbioru — protokół odbioru prac z menu „Inwestor" (2026-09-28)

### Phase 3: Dialog, menu item and print wiring

- [ ] „Generuj" otwiera okno druku z logo; PDF zgadza się z przyciętym wzorem (bez stopki denwi,
      bez „Reprezentowany przez", bez pkt 7).
      _Zweryfikowano 2026-09-29 (staging): CZĘŚCIOWO — inw. 137, „Generuj” z zaślepką `print` (druk się nie odpalił) otwiera okno z logo (img 360 px), tytułem „PROTOKÓŁ ODBIORU PRAC” i punktami 1–6; w treści brak „denwi”, „Reprezentowany przez” i pkt 7. Porównanie z przyciętym wzorem właściciela (wzór PDF niedostępny w repo) wymaga człowieka._
      _Staging 2026-10-06 (pass 4):_ CZĘŚCIOWO — „Generuj” (inw. 137, `window.open` + `print` zaślepione, druk się nie odpalił): HTML w oknie ma `<img src=…/logo-wykonczymy.png>` (URL zwraca 200 image/png), tytuł „Protokół odbioru prac — testowe inwestycje”, brak „denwi”, „Reprezentowany przez” i pkt 7. Obraz w popupie about:blank nie załadował się w automatyzacji (complete=false) — NEEDS-HUMAN: logo na wydruku i zgodność PDF z przyciętym wzorem.
      _needs human: prawdziwe okno druku / PDF i porównanie z przyciętym wzorem właściciela (wzór poza repo)_

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

### E2E

- [ ] `pnpm test:e2e e2e/client-share.spec.ts` przechodzi — uruchamia człowiek
      _Zweryfikowano 2026-09-29 (staging): pominięto — E2E uruchamia wyłącznie człowiek._
      _Nie sprawdzone 2026-10-04 (staging): spec E2E uruchamia człowiek (nie uruchamiam `pnpm test:e2e`)._
      _needs human: spec E2E uruchamia wyłącznie człowiek_

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
- [ ] Usunięte na zawsze zgłoszenie z Facebooka nie wraca po nocnym uzgodnieniu zgłoszeń (staging,
      następny dzień).
      _Nie sprawdzone 2026-10-03 (staging): wymaga sprawdzenia następnego dnia po przebiegu crona Facebooka — bloker izolacji_
      _needs human: sprawdzenie następnego dnia po nocnym cronie uzgadniania Facebooka (cron + realne zgłoszenie FB)_

## 2026-10-02 — podsumowanie-pracownika-tabele

- [ ] PDF pracownika z długą listą wypłat (kilkadziesiąt) → tabela, która nie mieści się na stronie, przechodzi na następną sama, a tabele nad nią zostają na poprzedniej (bez pustej połowy strony). PDF oferty dla klienta → podsumowanie w stopce nadal stoi przy prawej krawędzi.
      _Nie sprawdzone w całości 2026-10-03 (staging): zaksięgowano 32 wypłaty po 1 zł dla QA-Premia A i otwarto „Drukuj PDF" (print zastubowany) — tabela „Wypłaty" ma 33 wiersze, 826 px wysokości, zaczyna się na 459 px (nie mieści się na jednej stronie); styl wydruku ma tylko `tr { break-inside: avoid }`, bez `break-inside` na samych tabelach. NIE da się ocenić faktycznego podziału stron — `page.pdf()` w tym Chromium zwraca „Printing failed", a prawdziwego druku nie wolno uruchamiać. PDF oferty: tabela „Razem netto" ma prawą krawędź równą prawej krawędzi tabeli głównej (1244 px) — stoi przy prawej krawędzi w układzie ekranowym, a nie w druku._
      _Lokalnie 2026-10-09: do prawdziwego HTML „Drukuj kosztorys pracownika (PDF)” (print zastubowany, inw. 184) wstrzyknięto 35 wierszy wypłat i wyrenderowano headless Chromium (`page.pdf`, A4 landscape): 4 strony — tabele „Wykonane”/„Pozostało” zostają na str. 2, tabela „Wypłaty” zaczyna się od góry str. 3 (28 wierszy), str. 4 ma resztę (7 + „Razem”); brak pustej połowy strony. Podsumowanie oferty przy prawej krawędzi: ten sam CSS `.totals` (`align-items: flex-end`); w PDF pracownika widać je przy prawej krawędzi, oferty osobno nie renderowano. Zob. Findings 2026-10-09 (pass 4)._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      _needs human: PDF z kilkudziesięcioma wypłatami — brak takiego pracownika na preview; ocena układu PDF wzrokowo (pass 6)_

## purge-runner — nocne czyszczenie Kosza po scaleniu sześciu kopii (2026-10-05)

Refaktor bez zmiany zachowania: nocny cron czyści Kosz tak samo jak wcześniej.

- [ ] Inwestycja, kasa, pracownik, pojazd, sprzęt i zgłoszenie w `/kosz` dłużej niż okres przechowywania → po przebiegu crona `cleanup` znikają z `/kosz`, a listy (Inwestycje, Kasy, Pracownicy, Flota, Sprzęt, Zgłoszenia) pokazują stan po usunięciu bez ręcznego odświeżania pamięci podręcznej.
      _needs human: cron `cleanup` na preview DB (kopia produkcji) trwale skasowałby prawdziwe wiersze z /kosz — brak izolowanego zestawu przeterminowanych rekordów_
- [ ] Odpowiedź crona `cleanup` zawiera dla każdego rodzaju `purged` / `blocked` / `failed` (pojazdy, sprzęt i zgłoszenia mają teraz też `blocked: 0`), a inwestycje dodatkowo `skippedKosztorys`.
      _needs human: jak wyżej — odpowiedź crona `cleanup` wymaga jego uruchomienia, które na preview DB kasuje prawdziwe przeterminowane wiersze_

## ai-translations — AI uzupełnia tłumaczenia UA/RU i tłumaczy prace spoza rozpiski na polski (2026-10-05)

- [ ] Gdy AI było niedostępne w chwili wysyłki: przegląd pokazuje „Brak tłumaczenia" i „Przetłumacz"; po kliknięciu (z działającym AI) polski opis pojawia się bez zamykania okna. Pracownik na swoim linku nie widzi żadnego przycisku tłumaczenia.
      _Staging 2026-10-05:_ NIE sprawdzone — nie da się zasymulować niedostępności AI na stagingu. Sam przycisk „Przetłumacz" sprawdzony na zgłoszeniu z PL opisem (działa).
      _needs human: nie da się zasymulować niedostępności AI w chwili wysyłki na stagingu_

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

## 2026-10-06 — worker-form-mirrors-link — kartka do wypełnienia jak „Zgłaszam pracę”, czytelny wydruk

- [ ] Ta sama kartka wydrukowana na papierze: linie tabeli, nagłówki kolumn i jednostki są wyraźnie widoczne; szare tło mają tylko Nr, Wykonano i Postęp — Opis prac i Zgłaszam są białe.
      _needs human: wydruk kartki na papierze (prawdziwa drukarka)_
- [ ] Wydrukuj kosztorys dla klienta i PDF pracownika: linie i szare podpisy też są widoczne na papierze, kolumny dalej w paski jak wcześniej.
      _needs human: wydruk na papierze (prawdziwa drukarka)_
- [ ] Wypełnij kartkę ręcznie (kilka ilości w „Zgłaszam”), wczytaj ją przez „Wczytaj zgłoszenie z kartki (AI)”: w zgłoszeniu są dokładnie wpisane ilości, a nie liczby z kolumn „Wykonano” / „Postęp”.
      _needs human: ręcznie wypełniona papierowa kartka + zdjęcie z telefonu_

## 2026-10-07 — reorder-dialog-safari — lista „Ustaw kolejność” nie zapada się w Safari

- [ ] Safari (desktop) → kosztorys z kilkoma sekcjami → „Akcje sekcji” → „Ustaw kolejność…”: lista sekcji i prac jest widoczna, przewija się w środku okna, „Zapisz kolejność” działa po przeciągnięciu.
      _needs human: prawdziwe Safari desktop (WebKit)_

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
- [ ] Zgłoszenie z formularza na stronie (landing) ze zdjęciem z telefonu i PDF-em → oba pliki są przy zgłoszeniu, miniatura zdjęcia się wyświetla.
      POMINIĘTE 2026-10-07 (staging): to wymaga prawdziwego formularza na stronie landingu i podpisanego webhooka (`LANDING_WEBHOOK_SECRET` Preview niedostępny, pliki leżą w blobie landingu). Nie da się zrobić z tej sesji.
      _needs human: prawdziwy formularz landingu + podpisany webhook (sekret Preview niedostępny)_

## 2026-10-07 — worker-pwa-install-and-long-session — ikona aplikacji na telefonie i logowanie na 90 dni

- [ ] Build produkcyjny, Chrome DevTools → Application → Manifest: nazwa „Wykończymy”, trzy ikony (maskowalna z podglądem strefy bezpiecznej), brak błędów instalowalności.
      _Staging 2026-10-14 (pass 3): /manifest.webmanifest: name i short_name „Wykończymy”, trzy ikony (192, 512, maskable 512), display standalone. Podgląd strefy bezpiecznej i błędy instalowalności z DevTools — Needs human._
- [ ] Android Chrome, prawdziwy telefon, staging, 390px: na własnej stronie pracownika pod „Zmień e-mail lub hasło” jest przycisk instalacji — najpierw w stanie ładowania, potem aktywny; dotknięcie pokazuje systemowe okno instalacji, a ikona trafia na ekran główny.
      _needs human: prawdziwy telefon z Androidem (instalacja PWA)_
- [ ] Ta ikona otwiera aplikację na pełnym ekranie na stronie pracownika, już zalogowaną, i przycisk instalacji nie jest tam pokazany.
      _needs human: zainstalowana PWA na prawdziwym telefonie_
- [ ] iPhone Safari, prawdziwy telefon, staging, 390px: przycisk otwiera instrukcję w trzech krokach; po jej wykonaniu ikona jest na ekranie głównym i otwiera aplikację na pełnym ekranie na `/zaloguj`; po zalogowaniu przycisku nie ma.
      _needs human: prawdziwy iPhone Safari (dodanie do ekranu głównego)_
- [ ] Android z już zainstalowaną aplikacją, strona otwarta w karcie Chrome: przycisk jest ukryty albo po 60 s zmienia się w podpowiedź o menu przeglądarki — nigdy nie zostaje w ładowaniu.
      _needs human: prawdziwy Android z zainstalowaną aplikacją_
- [ ] iPhone, ikona na ekranie głównym: logo jest wyśrodkowane, z marginesem dookoła, nie dotyka krawędzi kafelka.
      _needs human: ikona na ekranie głównym prawdziwego iPhone'a_
- [ ] Aplikacja zainstalowana (Android i iPhone): obok hamburgera jest strzałka wstecz na każdej stronie; cofa do poprzedniej strony, a przy pierwszej stronie po otwarciu prowadzi na stronę główną. W zwykłej karcie przeglądarki strzałki nie ma.
      _needs human: zainstalowana aplikacja na Androidzie i iPhonie (tryb standalone)_

## kosztorys-przedmiar-aktualny — „Aktualizacja przedmiaru” obok „Przedmiaru ofertowego” (2026-10-07)

- [ ] Pracownik, któremu wcześniej odznaczono „Przedmiar” w ustawieniach widoku pracownika → po zmianie „Aktualizacja przedmiaru” nadal jest u niego ukryta.
      POMINIĘTE bez próby (2026-10-07): wymaga starego klucza `plannedQty` zapisanego w globalu ustawień widoku pracownika, a UI zapisuje już tylko `currentPlannedQty`; stworzenie stanu to zapis do bazy poza UI. Mapowanie klucza pokrywa `src/__tests__/lib/kosztorys/worker-view/settings.test.ts`.
      Staging 2026-10-15: wymaga starego klucza plannedQty w globalu widoku pracownika, którego UI już nie zapisuje; ścieżkę pokrywa src/__tests__/lib/kosztorys/worker-view/settings.test.ts, ręcznie tylko przez edycję JSON w bazie.

## invoice-duplicate-detection — duplikaty paragonów przy akceptacji zgłoszeń wydatków (2026-10-08)

- [ ] „Dodaj wydatek" → między wierszem pliku a „Notatką" stoi wiersz z polami „Nr dokumentu", „NIP sprzedawcy" i „Data na paragonie"; „Skanuj" / „Odczytaj ponownie" wypełnia wszystkie trzy.
      _Staging 2026-10-14 (pass 3): układ OK: FV (plik) → Nr dokumentu / NIP sprzedawcy / Data na paragonie → Notatka. „Odczytaj ponownie” z fixture paragon-a.jpg dał „NIE UDAŁO SIĘ ODCZYTAĆ” (puste pola) — wypełnienie trzech pól nieweryfikowalne bez czytelnego prawdziwego paragonu. Needs human._
      _needs human: wypełnienie trzech pól przez odczyt AI wymaga czytelnego prawdziwego paragonu (fixture nie odczytuje się)_

## EX-1065 — catalogue-auto-translate — nocny cron dotłumacza katalog prac

- [x] Katalog prac → „Uzupełnij tłumaczenia (AI)” nadal tłumaczy i zeruje licznik, jak dotąd.
      _Staging 2026-10-18 (pass 8): dodana praca bez tłumaczeń (checkbox AI wyłączony) → przycisk „· 1” → klik → uk/ru wypełnione w DB, przycisk znika._
- [x] Vercel → Settings → Cron Jobs po wdrożeniu na produkcję: jest `/api/cron/translate-catalogue` o `0 2 * * *`.
      _Prod 2026-10-18: logi Vercela — przebiegi 2026-10-17 i 2026-10-18 o 02:00:08 UTC, status 200; praca 970 przetłumaczona przez przebieg 2026-10-17 (02:00:13 UTC)._

## company-knowledge — „Manual Wykończymy” w górnym pasku

- [ ] `dump-knowledge-prod.ts` dla przypadku (sesja produkcyjna): `inputs/manual-i-komentarze-do-prac.md` ma
      każdy wpis z okna w tej samej kolejności i każdy Komentarz do pracy z katalogu. Wpis dodany w
      oknie pojawia się po kolejnym uruchomieniu.
      _needs human: skrypt `dump-knowledge-prod.ts` — sesja produkcyjna, tylko produkcja_
- [ ] Po migracji na świeżej bazie (produkcja): wpisy „Wysokość pomieszczeń…”, „Otwory w glazurze…”,
      „Glazura…”, „Malowanie i gładź” i „Szlifowanie płytek na 45°” wyświetlają się w punktach,
      każdy punkt w osobnej linii.
      _needs human: migracja na świeżej bazie produkcyjnej — tylko produkcja_

## 2026-10-09 — ui-scale — rozmiar interfejsu na telefonie

- [ ] Przy 70% na iPhonie: dotknięcie pola (np. kwota w „Dodaj transakcję”) nie przybliża strony, a wpisywany tekst mieści się w polu.
      _needs human: prawdziwy iPhone (zoom iOS przy fokusie pola)_

## 2026-10-11 — worker-report-back-button — „Wstecz” na stronie zgłoszenia pracy w aplikacji

- [x] Telefon, aplikacja zainstalowana (PWA), zalogowany pracownik → na swojej stronie „Zgłoś
      pracę” → strona zgłoszenia ma strzałkę „Wstecz” po lewej od logo; dotknięcie wraca na
      stronę pracownika.
      _Staging 2026-10-19 (pass 11), 390 px, QA worker 77. display-mode: standalone nie da się wymusić w Chromium MCP, więc reguły @media (display-mode: standalone) zostały w DOM sklonowane jako zawsze aktywne (strzałka i jej onClick to prawdziwy kod); prawdziwa zainstalowana PWA nie testowana. Strona pracownika → „Zgłoś pracę”: strzałka „Wstecz” (44 px) na lewo od logo, klik → /pracownicy/77._
- [x] To samo przez link inwestycji w „Moje inwestycje” (widok „Inwestycja”) → strzałka wraca na
      stronę pracownika.
      _Staging 2026-10-19 (pass 11), 390 px, QA worker 77. display-mode: standalone nie da się wymusić w Chromium MCP, więc reguły @media (display-mode: standalone) zostały w DOM sklonowane jako zawsze aktywne (strzałka i jej onClick to prawdziwy kod); prawdziwa zainstalowana PWA nie testowana. Link „QA EX-855 Inwestycja” (?view=summary) → strzałka wraca na /pracownicy/77._
- [x] Po wysłaniu zgłoszenia ekran „wysłano” też ma strzałkę i wraca na stronę pracownika.
      _Staging 2026-10-19 (pass 11), 390 px, QA worker 77. display-mode: standalone nie da się wymusić w Chromium MCP, więc reguły @media (display-mode: standalone) zostały w DOM sklonowane jako zawsze aktywne (strzałka i jej onClick to prawdziwy kod); prawdziwa zainstalowana PWA nie testowana. Wysłane 1 pozycję: ekran „Wysłano do weryfikacji” ma strzałkę, klik → /pracownicy/77 (zgłoszenie testowe do posprzątania)._
- [x] Link zgłoszenia otwarty z SMS-a (brak historii w aplikacji) → strzałka prowadzi na stronę
      pracownika (zalogowany) albo na logowanie, nie zostawia go na pustej stronie.
      _Staging 2026-10-19 (pass 11), 390 px, QA worker 77. display-mode: standalone nie da się wymusić w Chromium MCP, więc reguły @media (display-mode: standalone) zostały w DOM sklonowane jako zawsze aktywne (strzałka i jej onClick to prawdziwy kod); prawdziwa zainstalowana PWA nie testowana. Świeża karta (history.length 2, brak historii aplikacji), strzałka → router.push('/') → /pracownicy/77 dla zalogowanego; ścieżka niezalogowanego (logowanie) nie testowana._
- [x] Zwykła przeglądarka (nie PWA) i desktop → strzałki nie ma; przy 390px nazwa inwestycji
      i pracownika nadal czytelna (najwyżej ucięta wielokropkiem), przełącznik języka mieści się.
      _Staging 2026-10-19 (pass 11), 390 px w zwykłej przeglądarce: strzałka display:none; nazwa inwestycji i pracownika ucięte wielokropkiem, przełącznik języka (308–374 px) w ekranie, scrollWidth = 390. Desktop nie sprawdzany osobno (klasa standalone:max-sm: wymaga obu warunków)._

## 2026-10-11 — invoice-download-date-range — „Faktury” z zakresem dat

- [ ] „Drukuj” dalej drukuje bieżący zestaw filtrów tabeli, niezależnie od dialogu.
      _Staging 2026-10-14: Okno druku nie weryfikowalne w tym narzędziu._
      _needs human: natywne okno druku — nie do sterowania w automatyzacji_

## 2026-10-11 — pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji

Sprawdzalne tylko na produkcji — klucze VAPID są wyłącznie tam (blokada środowiskowa, nie defekt).

- [ ] Produkcja, Android, zainstalowana aplikacja → menu mobilne → „Włącz powiadomienia” → zgoda w systemie → toast „Powiadomienia włączone”, przycisk zmienia się na „Wyłącz powiadomienia”; jako ADMIN otwórz `/api/test-push` → przychodzi powiadomienie z jednobarwną ikoną na pasku stanu; dotknięcie otwiera aplikację.
      _needs human: produkcja, prawdziwy Android, push_
- [ ] Produkcja, iPhone (iOS 16.4+) → w karcie Safari przełącznika nie ma; w aplikacji z ekranu początkowego jest, włączenie pokazuje pytanie o zgodę, a testowe powiadomienie dociera.
      _needs human: produkcja, prawdziwy iPhone, push_
- [ ] Odmowa zgody na powiadomienia → zamiast przycisku napis „Powiadomienia są zablokowane — włącz je w ustawieniach telefonu.”
      _needs human: odmowa zgody systemowej na powiadomienia w prawdziwej przeglądarce/telefonie_
- [ ] „Wyłącz powiadomienia” → `/api/test-push` zwraca `sent: 0` i na telefon nic nie przychodzi; to samo po wylogowaniu się na telefonie.
      _needs human: push na prawdziwym telefonie_
- [ ] Pracownik z włączonymi powiadomieniami zdezaktywowany („Aktywny” wyłączone) albo przeniesiony do kosza → nie dostaje już żadnego powiadomienia.
      _needs human: push na prawdziwym telefonie_
- [ ] 390px → przełącznik na własnej stronie `/pracownicy/[id]` (obok „Zainstaluj aplikację”) i w stopce menu mobilnego nie rozjeżdża układu.
      _needs human: przełącznik powiadomień jest widoczny tylko w zainstalowanej aplikacji na telefonie_
- [ ] Produkcja, iPhone pracownika z włączonymi powiadomieniami → zarząd księguje mu wypłatę → przychodzi „Wypłata do potwierdzenia” z kwotą, a ikona aplikacji pokazuje 1; dotknięcie otwiera jego stronę z blokiem „Wypłaty do potwierdzenia”.
      _needs human: produkcja, iPhone, push + odznaka ikony_
- [ ] Ten sam pracownik „Potwierdzam” albo „Odrzuć” → liczba na ikonie znika od razu, bez zamykania aplikacji.
      _needs human: odznaka ikony aplikacji na iPhonie_
- [ ] Produkcja, Android → po zaksięgowaniu wypłaty powiadomienie dociera.
      _needs human: produkcja, Android, push_
- [ ] „Rozlicz wypłaty” dla jednego pracownika na dwóch inwestycjach → przychodzi jedno powiadomienie z sumą kwot, a ikona pokazuje 2.
      _needs human: push na prawdziwym telefonie_

## 2026-10-12 — investment-ai-stage — „Etap AI” na inwestycji

- [ ] Po deployu i migracji produkcji: ustaw „Recenzja zakończona” na jednej inwestycji, uruchom `collect-reasons-prod.ts` bez `INVESTMENTS` → listuje Powody zmiany dokładnie tej inwestycji.
      _needs human: po deployu i migracji produkcji — skrypt `collect-reasons-prod.ts` na produkcji_

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
- [ ] Nagłówki kolumn liczbowych w „Z rozpiski” (Zgłoszono, Przyjmuję, Etap, oba „Pomiar z natury”, Aktualizacja przedmiaru, Pomiar z natury / Aktualizacja przedmiaru) czytają się pionowo od dołu do góry, przyklejone do dołu wiersza nagłówka i wycentrowane w poziomie w swojej kolumnie; wszystkie kolumny poza opisami (Opis prac, Opis w języku pracownika, Może chodzi o) mają nagłówek i komórki wyśrodkowane — checkbox, Nr, Sekcja, Akcje, pole „Przyjmuję”, liczby, „0,5 → 1”, „0,5 / 1” z „przekroczono”; opisy zostają do lewej; długie zawijają się w 2 pionowe linie zamiast przekraczać ~192px wysokości; dopisek stoi jako mniejsza pionowa linia obok tytułu; strzałka sortowania na końcu napisu i klik w nagłówek dalej sortuje. Chrome i Safari.
      _Staging 2026-10-14 (pass 3): Chrome: wszystkie nagłówki liczbowe vertical-rl, vertical-align bottom, text-align center; Nr/Sekcja/Akcje/checkbox/liczby wyśrodkowane, Opis prac start; dopiski 10px pionowe. Safari — Needs human (brak Safari)._

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
- [ ] Safari 18.x → dowolne inne pole wielolinijkowe (np. powód anulowania, notatka pozycji
      w katalogu prac): puste ma tę samą wysokość co wcześniej, po wpisaniu kilku linii rośnie.
      _Blokada: wymaga Safari 18.x._
      _needs human: prawdziwe Safari (WebKit) — tego nie ma w środowisku MCP (pass 6)_

## 2026-10-14 — kosztorys-editor-text-size — wielkość czcionki w edytorze kosztorysu

- [ ] Pusty kosztorys (bez pozycji) przy „Bardzo mała”, potem dodanie pozycji z długim opisem przy
      włączonym „Dopasuj wysokość do treści”: wiersz od razu ma wysokość pasującą do małej czcionki.
      _Niezweryfikowane: wymaga pustego kosztorysu (nie zakładano)._
      _Staging 2026-10-14 (pass 3): nie wykonano: wymaga pustego kosztorysu (czyszczenie inw. 210 zniszczyłoby fixture AI; nowa inwestycja z pustym kosztorysem poza zakresem tego przebiegu)._
      _needs human: szablon ~1000 pozycji / pusty kosztorys — brak takiego fixture'a na preview, pomiar opóźnienia wymaga człowieka (pass 6)_
- [ ] Telefon (390px), kosztorys: wejście w edycję komórki nie powiększa strony (brak zoomu iOS).
      _Blokada: zoom iOS wymaga prawdziwego iPhone._
      _needs human: telefon/iPhone 390px na prawdziwym urządzeniu (viewport emulowany nie odtwarza dotyku, zoomu iOS ani klawiatury) (pass 6)_

## 2026-10-14 — vertical-header-safari — pionowe nagłówki w Safari

Stan: kosztorys ze zgłoszeniem pracy od pracownika czekającym na przyjęcie.

- [ ] **Safari** → okno przyjmowania zgłoszenia, tabela „Z rozpiski”: nagłówki „Pomiar z natury”
      z dopiskami („ile jest aktualnie zgłoszone”, „po przyjęciu zgłoszenia”) mieszczą się w swojej
      kolumnie — żaden tekst nie wchodzi na sąsiednią kolumnę (np. „Przedmiar ofertowy”).
      _needs human: prawdziwe Safari (WebKit) — tego nie ma w środowisku MCP (pass 6)_
- [ ] Safari, to samo okno zwężone: nagłówek, który zawija się do dwóch linii, nadal mieści się
      w swojej kolumnie.
      _needs human: prawdziwe Safari (WebKit) — tego nie ma w środowisku MCP (pass 6)_

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

## 2026-10-14 — worker-report-text-size — wielkość czcionki i wąskie kolumny w raporcie pracownika

- [x] Telefon 390px, raport pracownika: Mała i Średnia dają widocznie różny tekst; nazwa sekcji jest mniejsza niż dawniej i przy długiej nazwie wychodzi na sąsiednie puste komórki.
      _Staging 2026-10-14 (pass 3): 390px: Mała=12px, Średnia=14px (różny tekst), nazwa sekcji mała. NIE sprawdzono wychodzenia długiej nazwy sekcji na sąsiednie puste komórki (brak długiej nazwy w inw. 210) — box otwarty._
      _Staging 2026-10-19 (pass 11), 390 px, /z/…/QA-EX-855: nazwa sekcji (12 px, półgrube) z DOM podmienioną na 90 znaków wychodzi poza własną komórkę na sąsiednie puste komórki paska i jest ucięta dopiero krawędzią ekranu (strona scrollWidth 390); Mała 12 px / Średnia 14 px — z pass 3._

## 2026-10-14 — backlog-fixes-14 — poprawki z backlogu: odrzucenie w zgłoszeniu, zapis przed podmianą rozpiski, menu etapu

- [ ] ten sam kosztorys w dwóch kartach. W karcie A „Zgłoszenia prac” → zgłoszenie → przy
      jednej pozycji tylko „Odrzuć” → zapisz. Przejdź do karty B: **nie** pojawia się „Rozpiska
      zmieniła się w innym oknie — wczytano aktualną wersję.”, a w „Wersje” nie przybyła wersja
      automatyczna. Po ponownym otwarciu zgłoszenia pozycja jest odrzucona.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_
- [ ] to samo z „Przyjmij” jednej pozycji zamiast „Odrzuć” — karta B **pokazuje** ten
      komunikat i ilość w etapie.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_
- [ ] tak samo — świeża zmiana w komórce, od razu „Wyczyść kosztorys”, „Wczytaj z
      szablonu”, import z arkusza i „Ustaw kolejność”: każda kończy się bez komunikatu o błędzie
      i bez „Kosztorys zmienił się w innym miejscu”.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_

## media-file-headers — pliki spoza dozwolonych typów pobierają się zamiast otwierać

- [ ] Plik SVG wgrany w pliki z ominięciem formularza (`/api/media/file/<nazwa>.svg`) → otwarcie
      linku pobiera plik zamiast wyświetlać obraz lub stronę.
      _Staging 2026-10-15 (pass 5): Pass 5: NIE sprawdzone — w sklepie preview nie ma SVG, a wgranie przez token route z pominięciem formularza wymaga ręcznie zbudowanego klienta; brak specu na hardenMediaFileHeaders (src/__tests__ nie ma testu). Do zrobienia ręcznie._
      _needs human: w sklepie preview nie ma SVG, a wgranie z pominięciem formularza wymaga ręcznie zbudowanego klienta; brak specu hardenMediaFileHeaders (pass 6)_

## pozycja ze zgłoszenia zapamiętana przed zapisem

### Findings — 2026-10-15

- [ ] **Praca z katalogu, którą sekcja już ma, nie jest zapamiętywana** — „Dodaj do rozpiski” z katalogu
      na pracę, której pozycja już stoi w wybranej sekcji, ustawiała link tylko w szkicu; po zamknięciu
      bez „Zapisz zmiany” praca wracała do „Spoza rozpiski” (bez bliźniaka). Poprawka w HEAD i na stagingu
      (2026-10-19): `add-line-to-rozpiska.tsx` `swapInto` woła `rememberItem` także na ścieżce istniejącej
      pozycji, spec `add-line-to-rozpiska.test.tsx` w repo. **W toku:** powtórzyć boks 1 na stagingu na
      pracy, którą sekcja już ma.
      **Test disposition**: test-driven-debugging · unit (dom) — `onPick` z jedną pasującą pozycją woła akcję.

## remount-latch-disarm — przerwane „Wyczyść” nie przebudowuje edytora przy następnej zmianie

- [ ] Jak wyżej, ale po powrocie Online od razu wpisz wartość w komórkę i w ciągu pół sekundy dodaj
      pozycję: wpisana wartość zostaje po odświeżeniu strony.
      _Staging 2026-10-15 (pass 5): nie sprawdzone: wymaga mutowania treści inw. 186 w oknie pół sekundy; zostawione dla człowieka_
      _needs human: offline/przywracanie wersji nadpisuje cały kosztorys prawdziwej inwestycji — poza zasadami przebiegu (pass 6)_
- [ ] „Wersje” → przywróć wcześniejszą wersję (z siecią): siatka przebudowuje się na przywróconą
      wersję, jak dotąd.
      _Staging 2026-10-15 (pass 5): nie sprawdzone: przywrócenie wersji nadpisałoby kosztorys inw. 186 na współdzielonej preview DB; zostawione dla człowieka_
      _needs human: offline/przywracanie wersji nadpisuje cały kosztorys prawdziwej inwestycji — poza zasadami przebiegu (pass 6)_

## 2026-10-15 — ungated-commits-review — „Do analizy AI” w galerii + cień pola wieloliniowego

- [ ] To samo na koncie z językiem Українська: przycisk „Позначити для аналізу AI”, toast
      „Файл позначено для аналізу AI”, po kliknięciu „Позначено для аналізу AI” — bez polskich napisów.
      _Staging 2026-10-15 (pass 5): Pass 5 FINDING: staging (origin/staging b73d388fe) nie zawiera commita 108516943 (fix ukraińskiej etykiety, tylko lokalnie). Na koncie uk przycisk w galerii inw. 210 to wciąż „Oznacz do analizy AI” (reszta po ukraińsku: Видалити цей файл, Додати ще, Друк…). Do ponownego sprawdzenia po wdrożeniu poprawki. Język QA 75 przywrócony do Polski._
      _needs human: commit z ukraińską etykietą nie jest jeszcze na stagingu (pass 6)_

## 2026-10-15 — expense-draft-loader — „Nowy wydatek” pracownika: loader na środku ekranu + limit zdjęć

- [x] Telefon 390px, konto pracownika → „Nowy wydatek”: pod polem zdjęć widać „Zdjęcia lub PDF, max 8
      jednocześnie.”, zanim cokolwiek wybierzesz.
      _Staging 2026-10-19 (pass 11), 390 px, QA worker 77 → Wydatek: podpowiedź „Zdjęcia lub PDF, max 8 jednocześnie.” widoczna przed wyborem plików._
- [x] Wybierz kilka zdjęć: na środku ekranu kręci się gradientowy pierścień (fuksja→cyjan), dopóki
      zdjęcia się przygotowują; znika, gdy pole pokazuje ich nazwy.
      _Staging 2026-10-19 (pass 11), 390 px, 3 PNG po 4,3 MB: gradientowy pierścień (size-12) wyśrodkowany w (195, 422) = środek 390×844, widoczny ok. 180 ms, potem pole pokazuje „qa0.png, qa1.png, qa2.png”._
- [x] „Wyślij”: ten sam pierścień kręci się na środku ekranu aż do toasta o wysłaniu.
      _Staging 2026-10-19 (pass 11), 390 px: po „Wyślij” pierścień w (195, 422) przez ok. 3,8 s, potem dialog się zamknął (wysłane jako szkic 81 inw. 210; toast nie złapany w oknie pomiaru, szkic w bazie istnieje)._
- [x] Wybierz 9 zdjęć: podpowiedź znika, a w jej miejscu czerwony komunikat o limicie; „Wyślij” wyłączony.
      _Staging 2026-10-19 (pass 11), 390 px, 9 PNG: podpowiedź zastąpiona czerwonym „Najwyżej 8 zdjęć w jednym wydatku — wyślij resztę osobno.”, „Wyślij” wyłączony._
- [ ] Inne ekrany z loaderem (logowanie, filtry transakcji, zapis formularza) wyglądają jak dotąd —
      🚧 dalej podskakuje.

## 2026-10-15 — investment-status-badge — status na stronie inwestycji jako badge

- [x] Strona inwestycji → karta z danymi: „Status” to kolorowy badge, identyczny jak w kolumnie
      Status na liście inwestycji (np. Odrzucona — różowy, Aktywna — zielony).
      _Staging 2026-10-18 (pass 8): inw. 210 „Aktywna” — te same klasy (emerald) co w liście; Wycena/Planowana też badge._
- [x] Edytor kosztorysu → podsumowanie, zakładka „Inwestycja”: „Status” pokazuje ten sam badge.
      _Staging 2026-10-18 (pass 8): inw. 210, zakładka Inwestycja: badge „Aktywna” (zielony)._

## 2026-10-15 — staging-sweep-review — siatka kosztorysu po odmowie „Ustaw kolejność” + porządki

- [x] Kosztorys otwarty w dwóch kartach: w karcie B dodaj albo usuń pozycję, w karcie A (bez
      odświeżania) „Ustaw kolejność” → odmowa z komunikatem, a siatka w A sama pokazuje stan z B;
      kolejne „Ustaw kolejność” w A przechodzi.
      _Staging 2026-10-18 (pass 10): Tab B dodał pracę; w tab A (bez odświeżenia) Zapisz kolejność dał toast „Układ się zmienił w międzyczasie — odśwież i spróbuj ponownie.”, siatka w A zsynchronizowała się (13 poz.); drugie podejście przeszło, kolejność zapisana._
- [ ] Kosztorys → „Importuj z arkusza” i „Ustaw kolejność” działają jak wcześniej (porządki bez
      zmiany zachowania): import podmienia pozycje, kolejność zapisuje się po odświeżeniu strony.
      _Staging 2026-10-18 (pass 10): Ustaw kolejność: zapis kolejności przetrwał przeładowanie strony (OK). Importuj z arkusza NIE zweryfikowane — #213 nie ma powiązanego arkusza, a dodanie kosztorysu v1 z kanonicznym arkuszem nie utworzyło wiersza; import podmieniłby kosztorys realnej inwestycji. HUMAN: arkusz czytelny dla staging SA._

## szablon-own-structure — szablon jako odwołania do katalogu prac

- [x] Inwestycja z kosztorysem → menu „…” przy pracy z katalogu: „Aktualizuj pozycję w katalogu prac”
      nadal jest i otwiera okno zapisu do katalogu.
      _Staging 2026-10-18 (pass 10): inw. 213, menu „…” przy pracy: „Aktualizuj pozycję w katalogu prac” jest i otwiera okno „W katalogu / Po zapisie” (z listą szablonów, w których zmieni cenę); anulowano bez zapisu._
- [x] Szablony → „Nowy szablon”, zmiana nazwy, otwarcie: działa; nazwa już zajęta (także przez szablon
      w koszu) jest odrzucana.
      _Staging 2026-10-18 (pass 9): Zweryfikowane (nowy szablon założony i otwarty, zmiana nazwy działa, nazwa zajęta — także przez szablon w koszu — odrzucona z komunikatem; szablon testowy usunięty na zawsze)._
- [x] Kosztorys z pracą spoza katalogu → „Zapisz jako szablon”: zapisany, ostrzeżenie podaje liczbę
      pominiętych prac.
      _Staging 2026-10-18 (pass 10): inw. 210 (jedna praca spoza katalogu) → Nowy szablon „QA pass10 z kosztorysu”: „Zapisano szablon” + „Pominięto 1 pracę spoza katalogu — najpierw zapisz je do katalogu.” (ostrzeżenie podaje liczbę pominiętych, nie nazwę — tak w kodzie, catalogued-preset-items.ts)._
- [x] „Nadpisz” istniejący szablon: zastąpiony; w „Wersjach” tego szablonu jest „Przed nadpisaniem: …”.
      _Staging 2026-10-18 (pass 10): inw. 210 → Nadpisz „QA pass10 szablon”: szablon ma teraz 8 poz.; w „Wersje” nazwany punkt „Przed nadpisaniem: QA EX-855 Inwestycja” (autor Staging QA, data)._
- [x] Nowa inwestycja z szablonu (także z leada): kosztorys ma sekcje i prace szablonu, przedmiar 0.
      _Staging 2026-10-18 (pass 10): nowa inwestycja „QA pass10 inwestycja” (#213, status Wycena) z szablonu „QA pass10 szablon”: 326 pozycji, wszystkie z przedmiarem 0 (sprawdzone psql). Ścieżki „z leada” nie przejechano (nowej wersji formularza leada nie da się wywołać bez realnego zapytania z formularza) — ta sama akcja, inny punkt wejścia._
- [x] Kosztorys → „Wczytaj szablon…” i „Sekcja z szablonu…”: właściwe sekcje i prace.
      _Staging 2026-10-18 (pass 10): inw. 213: „Wczytaj szablon…” → „Kosztorys 2026 kolory” (okno: Zniknie 12 sekcji · 326 prac / Wejdzie 11 sekcji · 302 prace; po wczytaniu pierwsze sekcje 6 i 12 poz. jak w szablonie); „Sekcja z szablonu…” → zaznaczone Podłogi + Klimatyzacja z „QA pass10 z kosztorysu”: dołożone 2 sekcje (kolejność jak w szablonie: Klimatyzacja, potem Podłogi — kod dokłada w kolejności listy od początku, nie w kolejności klikania; to nie zmiana)._
- [x] Katalog prac → usuń pracę, która stoi w szablonie: znika z szablonu; kolumna „Szablony” liczy
      szablony poprawnie.
      _Staging 2026-10-18 (pass 10): „QA pass10 praca A2”: kolumna Szablony = 1, Kosztorysy = 0; potwierdzenie usunięcia wymienia „Zniknie natomiast z szablonów: QA pass10 szablon”; po usunięciu szablon ma 0 poz., lista szablonów pokazuje 1 sekcję / 0 pozycji._
- [x] Szablon → „Zapisz wersję”, zmień coś, „Przywróć”: układ wraca, opisy w dzisiejszym brzmieniu
      katalogu.
      _Staging 2026-10-18 (pass 10): QA szablon: wersja „QA v1” (1 praca), dodano 2 prace + zmiana nazwy sekcji, „Przywróć” → układ wrócił do 1 pracy, opis w dzisiejszym brzmieniu katalogu („praca A2”, zmieniony po zapisie wersji); lista wersji pokazuje autora i datę._
- [x] Usuń z katalogu pracę, przywróć wersję szablonu, która ją miała: przywrócona bez niej,
      z ostrzeżeniem.
      _Staging 2026-10-18 (pass 10): przywrócenie „QA v1” (miała usuniętą pracę) → szablon 0 poz., komunikat „Przywrócono wersję bez 1 pracy — usunięto je z katalogu.”_
- [x] Szablony → „Do kosza”: znika z listy i ze wszystkich pickerów szablonu; w `/kosz` widać go jako
      szablon. Przywrócenie: wraca z pracami i wersjami. „Usuń na zawsze” pyta o nazwę.
      _Staging 2026-10-18 (pass 10): „QA pass10 z kosztorysu”: po „Przenieś do kosza” zniknął z /szablony i z „Sekcja z szablonu…”; w /kosz sekcja Szablony z wpisem; Przywróć → wrócił do listy (326 poz., trashed_at NULL, wersje nietknięte); ponowne do kosza → „Usuń na zawsze” prosi o wpisanie nazwy (przycisk nieaktywny do czasu zgodności), po potwierdzeniu szablon usunięty z bazy._
- [x] Lista inwestycji, filtr statusu, formularz inwestycji: brak opcji „Szablon”; reszta jak dotąd.
      _Staging 2026-10-18 (pass 9): Zweryfikowane (filtr statusu: Wycena/Planowana/Aktywna/Zakończona/Odrzucona; formularz „Edytuj inwestycję” — te same pozycje, brak „Szablon”)._
- [x] Raport pracownika i pickery wypłat: bez zmian dla prawdziwych inwestycji; szablony się w nich
      nie pojawiają.
      _Staging 2026-10-18 (pass 10): /wyplaty: filtr „Inwestycja” (lista prawdziwych inwestycji) i pozostałe pickery nie zawierają szablonów „QA pass10 szablon” / „Kosztorys 2026 kolory”; strona ładuje się bez zmian. Raport pracownika korzysta z tej samej listy inwestycji (szablony nie są już inwestycjami po drugiej migracji)._
- [ ] Ładowarka kosztorysu AI na szablonie (lokalnie): pozycje w brzmieniu katalogu, bez duplikatów.
      _Staging 2026-10-18 (pass 10): needs human: wymaga lokalnego uruchomienia ładowarki AI (scripts/ai-kosztorys, repo ../wykonczymy-ai-cases) — nie przeglądarkowe, nie na staging._
- [x] Kosztorys i szablon → „Dodaj pracę” (z tłumaczeniem i bez): praca dodana; pusty opis lub
      jednostka odrzucone; „Zapisz wersję” bez nazwy odrzucone; „Wersje” pokazują autora i datę;
      „Sekcja z szablonu…” dokłada sekcje w kolejności listy szablonu (porządki po przeglądzie — bez zmian
      w zachowaniu).
      _Staging 2026-10-18 (pass 10): szablon /szablony/3: pusty opis i brak jednostki/ceny odrzucone (komunikaty „wymagany/wymagana”, dialog zostaje); z „Tłumacz automatycznie przy pomocy AI” praca dodana z tłumaczeniem UA+RU w kolumnach; bez tłumaczenia (A2) dodana wcześniej; Wersje/Zapisz wersję bez nazwy — patrz wyżej; „Sekcja z szablonu…” dokłada w kolejności listy szablonu, nie kolejności klików (zgodne z kodem od początku — słownictwo pola, nie defekt)._
- [x] Po usunięciu starych szablonów z bazy (druga migracja): `/szablony` pokazuje te same szablony
      z tymi samymi sekcjami, pracami i „Wersjami”; lista inwestycji i filtr statusu nie mają
      szablonu; nowa inwestycja zapisuje się ze statusem „Wycena”.
      _Staging 2026-10-18 (pass 10): /szablony pokazuje 3 szablony z sekcjami/pozycjami (302/326/327 poz.) i Wersjami (template_snapshots); filtr statusu i formularz bez „Szablon” (pass 9); nowa inwestycja #213 zapisana ze statusem „Wycena”._
- [x] Szablon → otwórz: brak bursztynowego ostrzeżenia. Zmień opis lub cenę pracy: pod paskiem
      narzędzi pojawia się „Pozycje szablonu to wpisy z katalogu prac…”. Zmiana nazwy sekcji lub
      kolejności sama go nie pokazuje. Kosztorys inwestycji po edycji pracy: ostrzeżenia nie ma.
      _Staging 2026-10-18 (pass 10): szablon QA (/szablony/3): po otwarciu brak „Pozycje szablonu to wpisy…”; zmiana nazwy sekcji — brak; zmiana opisu pracy → pojawia się „Pozycje szablonu to wpisy z katalogu prac. Edycja pozycji tutaj zmienia ją w katalogu prac i w każdym innym szablonie z tą pracą. Kosztorysy inwestycji się nie zmieniają.”; edycja opisu pracy w kosztorysie inw. 210 — bez ostrzeżenia (opis przywrócony). Uwaga: oglądanie bez bursztynowego ostrzeżenia = brak „bursztynowego” bannera przy otwarciu._

## 2026-10-15 — expense-draft-duplicates-per-row — duplikaty przy własnym paragonie + paragon bez zdjęcia

- [x] Zgłoszenie pracownika z kilkoma odczytanymi paragonami, z których dwa mają możliwe duplikaty →
      „Zweryfikuj”: „Możliwe duplikaty” stoją w ramce nad polami **własnego** paragonu, nie zbiorczo
      nad listą; „Akcje” są pierwszą kolumną tabeli, widoczne bez przewijania.
      _Staging 2026-10-18 (pass 10): zgłoszenie 78: ramki „Możliwe duplikaty” przy własnym paragonie (poz. 1 i 2), „Akcje” pierwszą kolumną, widoczne bez przewijania_
- [x] Scal dwa paragony z duplikatami w jedną pozycję: w ramce każdy ma swój nagłówek
      „Paragon: opis · kwota”; „Rozdziel” wraca do ramek przy osobnych pozycjach.
      _Staging 2026-10-18 (pass 10): Połącz 1+2: nagłówki „Paragon: Zabka Polska 22.06.2024 · 16,90 zł” ×2; Rozłącz wraca do 2 ramek per pozycja_
- [x] Zgłoszenie, w którym dwa paragony pasują do siebie nawzajem: duplikat podpisany
      „Pozycja N tego zgłoszenia”; po „Odrzuć” tamtej pozycji podpowiedź znika, po „Przyjmij” zostaje.
      _Staging 2026-10-18 (pass 10): podpis „Pozycja 2 tego zgłoszenia”/„Pozycja 1…”; po Odrzuć pozycji 2 podpowiedź znika, po Cofnij wraca, po Przyjmij zostaje (utworzono transakcję 5959 — do anulowania)_
- [x] „OK, to nie duplikat” chowa tylko kliknięty wiersz; „Duplikat” odrzuca paragon jako duplikat.
      _Staging 2026-10-18 (pass 10): 3→2 wiersze po jednym kliknięciu; „Duplikat” odrzuca paragon (skipped_receipts z duplicate_of #5875), Cofnij przywraca_
- [x] Odczytane zgłoszenie, którego zdjęć nie udało się pobrać: przy każdym paragonie komunikat
      „Nie udało się pobrać zdjęcia paragonu — dodaj je w polu „FV”…”, „Przyjmij” i „Przyjmij
      zaznaczone” wyłączone, „Odrzuć” działa; dodanie pliku w „FV” zdejmuje komunikat i odblokowuje
      „Przyjmij” tego paragonu.
      _Staging 2026-10-18 (pass 10): zablokowano /api/media/file/** (route abort): komunikat przy paragonie, Przyjmij i Przyjmij zaznaczone wyłączone, Odrzuć działa; plik w FV zdejmuje komunikat i odblokowuje Przyjmij_
- [ ] Nieodczytane zgłoszenie bez pobranych zdjęć: nad pozycjami stały komunikat „Nie udało się
      pobrać zdjęć — zgłoszenie można tylko odrzucić.”, „Zapisz” wyłączone.
      _Staging 2026-10-18 (pass 10): NIE DA SIĘ NA STAGINGU: odczyt AI idzie przy wysyłce (draft 80 dostał ai_read), a stan „brak odczytu” wymaga ai_read=NULL, czyli awarii samego odczytu; nie zapisuję do bazy poza UI. Pokrywa to test jednostkowy pending-expense-drafts.test.tsx_
- [x] „Szukaj duplikatów” na liście transakcji: tabela działa jak dotąd (kolumny w nowej kolejności,
      linki do dokumentów, podgląd zdjęcia).
      _Staging 2026-10-18 (pass 10): „Analizuj” → grupy z kolumną Status pierwszą, linki „Transakcja #…/Zgłoszenie #…”, ikona Podglądu otwiera zdjęcie paragonu (z Drukuj/Pobierz)_

## 2026-10-15 — staging-sweep-review-2 — druk z PDF, scalanie paragonów, ustawienia widoków kosztorysu

- [ ] Podgląd z kilkoma plikami, wśród nich PDF (np. faktura + zdjęcie) → „Drukuj”: okno wydruku
      pokazuje wszystkie strony, z PDF-em włącznie, i otwiera się systemowe okno drukowania; po wydruku
      lub anulowaniu okno się zamyka.
      _Staging 2026-10-18 (pass 10): tx 5314 (2 pliki, PDF): Drukuj otworzył okno z 2 iframe'ami (obie strony, PDF włącznie), okno zamknęło się samo; natywne okno drukowania = HUMAN (print stub)_
- [x] Odczytane zgłoszenie, którego zdjęć nie udało się pobrać → „Zweryfikuj”: „Połącz” i „Rozłącz”
      wyłączone; plik dodany ręcznie w „FV” zostaje przy paragonie.
      _Staging 2026-10-18 (pass 10): zdjęcia zablokowane (route abort), 2 zaznaczone pozycje: „Połącz zaznaczone” wyłączone; plik dodany w FV zostaje przy paragonie po przełączaniu zaznaczeń_
- [x] Zgłoszenie z możliwym duplikatem → „OK, to nie duplikat”, potem „Połącz” ten paragon z innym
      (i „Rozłącz”): schowana podpowiedź nie wraca.
      _Staging 2026-10-18 (pass 10): schowany wiersz nie wrócił po Połącz ani po Rozłącz (poz. 1+3 zgłoszenia 78)_
- [x] Zgłoszenie, w którym dwa paragony pasują do siebie nawzajem → „Połącz” je: w scalonej pozycji
      nie ma podpowiedzi „Pozycja N tego zgłoszenia”.
      _Staging 2026-10-18 (pass 10): po Połącz 1+2 brak „Pozycja N tego zgłoszenia” (zostały tylko Transakcja #5875/#5959)_
- [x] Kosztorys → ustawienia „Widok dla klienta” i „Widok dla pracownika”: ukryj jedną kolumnę, pokaż
      inną, zapisz, zamknij i otwórz ponownie — oba wybory zostają, podgląd pokazuje je od razu.
      _Staging 2026-10-18 (pass 10): #213: klient — ukryto Jednostkę miary, pokazano Komentarz; pracownik — ukryto j.m. i Stawkę j.m.; po Zapisz i ponownym otwarciu oba wybory zostają, podgląd inwestora od razu miał kolumnę Komentarz bez j.m._
- [x] Bez zmiany zachowania (przeniesione pliki): podgląd faktury z tabeli przelewów i z galerii
      inwestycji otwiera się i przewija jak dotąd; „Nowy wydatek” z kilkoma pozycjami działa jak dotąd;
      pickery inwestycji w „Wpłata” / „Wydatek” / edycji przelewu dalej pokazują tylko Aktywne
      i Planowane.
      _Staging 2026-10-18 (pass 10): podgląd faktury z tabeli transakcji (zoom/przewijanie, Drukuj/Pobierz) i galeria Dokumentacja inw. 160 (otwiera się, 1/60; przewijanie strzałką klawiatury nie przesunęło — nie sprawdzone dalej) działają; „Wydatek” z „Dodaj pozycję” daje 2 pozycje; picker Inwestycja w „Wydatek” ma 52 opcje = 45 aktywnych + 7 planowanych (bez quote/completed). Pickery w „Wpłata” i edycji przelewu nie sprawdzone osobno._

## 2026-10-16 — investment-billing-data — adres inwestycji rozbity na pola + „Dane do umowy / faktury”

- [x] „Nowa inwestycja” z samą nazwą (wszystkie nowe pola puste) → zapis przechodzi, strona inwestycji
      nie pokazuje wierszy „Zamawiający” ani „Adres do umowy”.
      _Staging 2026-10-18 (pass 8): inw. 212 created name-only; no Zamawiający/Adres do umowy rows._
- [x] Edycja inwestycji → wypełnij „Ulica i numer”, „Kod pocztowy”, „Miejscowość”, „Kraj” → „Adres” na
      stronie inwestycji to jedna linia: „ulica, kod miejscowość, kraj”.
      _Staging 2026-10-18 (pass 8): Adres row: "Testowa 1/2, 00-001 Warszawa, Polska"._
- [x] Edycja → „Typ klienta: Firma”, nazwa firmy, NIP, osoba reprezentująca, „taki sam jak adres
      inwestycji” zaznaczone → „Zamawiający” pokazuje firmę z NIP i reprezentantem; brak „Adres do umowy”.
      _Staging 2026-10-18 (pass 8): Zamawiający "QA Firma Sp. z o.o., NIP …, repr. Adam Testowy", no Adres do umowy._
- [x] Przełącz na „Osoba prywatna”, odznacz „taki sam…”, wpisz adres → „Zamawiający” to imię i nazwisko,
      „Adres do umowy” pokazuje wpisany adres; pola firmy nie wracają po ponownym otwarciu edycji.
      _Staging 2026-10-18 (pass 8): Zamawiający Jan Prywatny + Adres do umowy; reopened edit shows no firm fields._
- [x] Edycja z listy „Inwestycje” (ikona edycji w wierszu) → nowe pola są wypełnione jak na stronie
      inwestycji, a zapis bez zmian ich nie czyści.
      _Staging 2026-10-18 (pass 8): List edit prefilled all fields; save unchanged kept billing + address intact._
- [x] Inwestycja z „Dane do umowy” i pełnym adresem → kosztorys → Protokół odbioru: „Zamawiający” to
      osoba/firma z danych do umowy, adres to „ulica, kod miejscowość, kraj”, „Miejscowość” z adresu.
      Bez danych do umowy „Zamawiający” to osoba kontaktowa, a bez niej nazwa inwestycji.
      _Staging 2026-10-18 (pass 8): Protokół: Zamawiający from billing, adres one line, Miejscowość=Warszawa; fallback contact person then investment name verified (inw. 212, empty kosztorys)._
- [x] Protokół odbioru → „Edytuj dane inwestycji” otwiera formularz inwestycji; po zapisie protokół
      pokazuje nowego Zamawiającego i adres bez zamykania okna.
      _Staging 2026-10-18 (pass 8): Form opens over the protocol; after save clientName refreshed with window still open._

## 2026-10-16 — investment-form-layout-status-select — nowy układ formularza inwestycji + status z listy

- [x] „Nowa inwestycja” / „Edytuj inwestycję” / „Dodaj” przy leadzie na desktopie: okno jest szersze niż
      dotąd; poniżej 768px nadal zajmuje cały ekran.
      _Staging 2026-10-18 (pass 8): Nowa + Edytuj dialog 750px at 1200, fullscreen at 700; lead Dodaj uses same sm:max-w-dialog-md FormDialog + form (no live lead driven)._
- [x] Formularz inwestycji: kolejność to status (sam badge z listą, bez etykiety), „Nazwa”, „Notatki”,
      zdjęcia (przycisk na szerokość treści, bez nagłówka), „Prośba o opinię wysłana”, sekcja „Kontakt”,
      „Adres inwestycji”, „Dane do umowy / faktury”.
      _Staging 2026-10-18 (pass 8): DOM order: status select, name, notes, photos, reviewRequested, Kontakt, Adres, Dane do umowy._
- [x] Formularz → wpisz „Osoba kontaktowa” „Jan Kowalski”, „Typ klienta: Osoba prywatna” przy pustych
      „Imię”/„Nazwisko” → wypełniają się „Jan” / „Kowalski”; gdy były już wpisane, zostają bez zmian.
      _Staging 2026-10-18 (pass 8): Autofill Jan/Kowalski on switch to Osoba prywatna with empty names; with firstName filled it stays._
- [x] Edycja → zmień status na „Zakończona” i zapisz → pyta „Zakończyć inwestycję?” jak dotąd.
      _Staging 2026-10-18 (pass 8): Confirm "Zakończyć inwestycję?" shown; Anuluj kept edit open._
- [x] Strona aktywnej inwestycji → status nad listą danych to lista z badge'em; wiersza „Status”
      w liście nie ma. Zmiana na inny status zapisuje się od razu i zostaje po odświeżeniu.
      _Staging 2026-10-18 (pass 8): Badge select above data list, no Status row; Planowana/Aktywna persisted after reload._
- [x] Strona inwestycji → wybierz „Zakończona” → okno „Zakończyć inwestycję?”; „Anuluj” zostawia stary
      status, „Zakończ” zapisuje i (gdy prośba o opinię nie była wysłana) proponuje jej wysłanie.
      _Staging 2026-10-18 (pass 8): Anuluj kept Aktywna; Zakończ saved and offered "Poproś o opinię" (dismissed, no mail)._
- [x] Zakończona inwestycja jako kierownik → zmiana statusu na „Aktywna” kończy się komunikatem błędu,
      a lista wraca do „Zakończona”; jako właściciel — przechodzi.
      _Staging 2026-10-18 (pass 8): MANAGER: toast "Zakończoną inwestycję może odblokować tylko właściciel lub administrator", list back to Zakończona; OWNER passed to Aktywna._
- [x] Inwestycja w koszu → brak listy statusu, wiersz „Status” w liście danych jest jak dotąd.
      _Staging 2026-10-18 (pass 8): Trashed 212: banner read-only, Status row text, no combobox._

## 2026-10-16 — filters-tick-to-show — „Filtry” zaznaczasz to, co chcesz widzieć

- [x] Kosztorys → „Filtry”: bez nagłówka „Pokaż tylko”; nic nie zaznaczone, przycisk bez licznika —
      widać wszystkie pozycje.
      _Staging 2026-10-18 (pass 8): inw. 210: menu bez nagłówka, nic zaznaczone, przycisk „Filtry” bez licznika; liczniki grup sumują się do 327._
- [x] Kosztorys → „Filtry” → „Przedmiar” → zaznacz „Z przedmiarem”: zostają pozycje, które mają liczbę
      w kolumnie „Aktualizacja przedmiaru” — także te, gdzie to tylko szary przedmiar ofertowy; chip nad
      siatką „Tylko: …”, jego „×” zdejmuje filtr. „Bez przedmiaru” + „Z przedmiarem” = wszystkie pozycje.
      _Staging 2026-10-18 (pass 8): chip „Tylko: pozycje z przedmiarem (7)” = SQL (7 pozycji z liczbą w Aktualizacji); „×” zdejmuje chip i licznik; Bez (320) + Z (7) = 327._
- [x] Kosztorys z pozycją dodaną po ofercie (ofertowy 0, aktualizacja > 0) i drugą z aktualizacją do 0 →
      „Filtry” → „Aktualizacja przedmiaru” → „Inna niż w ofercie”: widać obie; pozycje z szarą
      aktualizacją (przejętą z oferty) są tylko w „Jak w ofercie”. Liczby obu opcji sumują się do
      wszystkich pozycji.
      _Staging 2026-10-18 (pass 8): inw. 210: dodane „QA EX-855 spoza rozpiski B” (0 → 5) i „Transport…” (aktualizacja → 0): „Inna niż w ofercie (3)” + „Jak w ofercie (324)” = 327; filtr pokazuje wiersze 3, 5, 9 (5 = istniejąca 21→30). (Edytowane pozycje 63789, 63795 do cofnięcia.)_
- [x] Kosztorys → zaznacz dwie opcje z tej samej grupy (np. w „Przedmiar”: „Bez przedmiaru” i
      „Z przedmiarem”): widać pozycje jednej LUB drugiej.
      _Staging 2026-10-18 (pass 8): wyszukiwanie „Wynoszenie” (wiersze 4,5,6): Z przedmiarem → 4,5,6; + Bez przedmiaru → nadal 4,5,6 (OR; AND dałby 0)._
- [x] Kosztorys → zaznacz opcje z dwóch różnych grup (np. „Z przedmiarem” i „Z wykonaną
      pracą”): widać tylko pozycje spełniające obie naraz.
      _Staging 2026-10-18 (pass 8): to samo zawężenie: Z przedmiarem + Z wykonaną pracą → 4,5 (z 4,5,6); + Bez wykonanej pracy → znów 4,5,6._
- [x] Kosztorys → „Filtry” → „Puste pozycje” → zaznacz „Z przedmiarem lub wykonaną pracą”: widać
      każdą pozycję z przedmiarem ofertowym, aktualizacją przedmiaru albo wykonaną pracą — także te z
      wykonaną pracą bez przedmiaru; znikają tylko pozycje puste na wszystkich trzech.
      _Staging 2026-10-18 (pass 8): chip (11) = 327−316; w sekcji „Prace dodatkowe” widać też wiersze z przedmiarem 0 (7,8,9), a puste znikają._
- [x] Kosztorys, Katalog prac, Pracownicy → „Filtry”: między grupami opcji jest linia oddzielająca, jak
      między sekcjami w „Kolumny”.
      _Staging 2026-10-18 (pass 8): separatory w menu: Pracownicy 2, Katalog prac 3, Kosztorys 3 (liczba grup − 1), jak w „Kolumny” (7)._
- [x] Kosztorys → „Kolumny”: sekcja „Etapy” stoi pod „Warstwy”, nad listą kolumn. Etapy działają jak
      kolumny — domyślnie wszystkie zaznaczone i
      widoczne; odznacz „Etap 2” → jego kolumny znikają, „Kolumny (n)” rośnie; zaznacz → wracają.
      _Staging 2026-10-18 (pass 8): inw. 210: Etapy pod „Warstwy”, nad „Widoczne kolumny”; odznaczenie Etapu 2 → Kolumny (20→21), ponowne zaznaczenie → 20._
- [x] Kosztorys → „Kolumny” → „Etapy” → odznacz „Zakończone”: znikają wszystkie zakończone etapy, ich
      wiersze się odznaczają; zaznacz → wracają. Odznaczenie jednego zakończonego etapu odznacza też
      „Zakończone”. „Aktywne” tak samo dla niezakończonych. Bez zakończonych etapów nie ma wiersza
      „Zakończone”. Przy obu wierszach liczba etapów w nawiasie, np. „Aktywne (4)”.
      _Staging 2026-10-18 (pass 8): oznaczono Etap 1,2 jako zakończone: „Zakończone (2)”/„Aktywne (3)”; odznaczenie Zakończone → 20→22 i etapy 1,2 odznaczone; Etap 1 samodzielnie → Zakończone się odznacza; Aktywne analogicznie (20→23); przed oznaczeniem (0 zakończonych) był tylko „Aktywne (5)”. (Zakończone etapy 1,2 do cofnięcia na teardown.)_
- [x] Kosztorys w widoku podwykonawcy → odznacz „Zakończone”: chowają się tylko etapy tej ekipy; w drugim
      widoku etapy drugiej ekipy zostają.
      _Staging 2026-10-18 (pass 8): inw. 97 (etap własny + etap z narzędziami, oba oznaczone jako zakończone i potem cofnięte): widok z narzędziami → „Zakończone (1)” = Etap 2, odznaczenie chowa tylko jego; widok bez narzędzi → „Zakończone (1)” = Etap 1, chowa tylko jego; inwestor → (2)._
- [x] Kosztorys → zaznacz opcję, której nie spełnia żadna pozycja: pusty stan „Brak pozycji spełniających
      filtry” z opisem „Filtry pokazują tylko pozycje …”.
      _Staging 2026-10-18 (pass 8): sprzeczne opcje (Puste + Z przedmiarem): „Brak pozycji spełniających filtry” + „Filtry pokazują tylko pozycje z przedmiarem i bez przedmiaru i bez wykonanej pracy.” + „Wyczyść filtry”._
- [x] Kosztorys przy włączonym rabacie globalnym → „Filtry” nie pokazują opcji rabatu pozycji, siatka nie
      jest pusta.
      _Staging 2026-10-18 (pass 8): inw. 126 (rabat globalny 3703,70 kwotowo): „Filtry” tylko Przedmiar / Wykonana praca / Puste pozycje, brak grup rabatu (210 bez rabatu globalnego ma opcje); „Sekcje” bez „bez rabatu”; siatka niepusta._
- [ ] Szablon → „Filtry” działają tak samo jak w kosztorysie (nic zaznaczone = wszystko).
      _Staging 2026-10-18 (pass 10): szablon 3 nie ma przycisku „Filtry” w ogóle (pasek: Dodaj, Opcje, Problemy, Sekcje, Kolumny); `KosztorysFiltersMenu` zwraca null przy pustej liście opcji — szablon nie ma przedmiaru ani pracy wykonanej. Do decyzji właściciela: czy „Filtry” w szablonie mają istnieć (finding pass 10)._
- [x] Kosztorys → „Sekcje”: zaznaczona sekcja = rozwinięta; odznacz jedną → zwija się tylko ona;
      „Zwiń wszystkie sekcje” / „Rozwiń wszystkie sekcje” działają; „Resetuj” rozwija wszystko.
      _Staging 2026-10-18 (pass 8): inw. 210: odznaczenie „Prace dodatkowe” zwija tylko ją (menu przełącza się na „Rozwiń wszystkie sekcje”); Zwiń/Rozwiń wszystkie przełączają 14/0; przycisk „Resetuj” nazywa się teraz „Wyczyść filtry” i rozwija wszystko._
- [x] Katalog prac → „Filtry”: nic zaznaczone = wszystkie prace; „Udział wykonawcy w cenie” ma trzy
      opcje („Ponad 65% ceny”, „W granicy 65% ceny”, „Nie dotyczy (auto lub bez ceny j.m.)”), każda
      praca wpada w dokładnie jedną; chip „Tylko: prace …”.
      _Staging 2026-10-18 (pass 8): Katalog prac: bez filtra 581/581; sumy grup 11+417+153 = 581 (z narzędziami) i 12+419+150 = 581 (bez narzędzi), progi 65% / 55,25%; „Ponad 65%” → 11/581, chip „Tylko: prace ponad 65% ceny — z narzędziami (podwykonawca)”._
- [x] Kosztorys i Katalog prac → „Filtry”: grupy nazywają się tak samo („Źródło stawki wykonawcy”,
      „Udział wykonawcy w cenie”, z dopiskiem płaszczyzny). W kosztorysie „Udział wykonawcy w cenie” ma
      „Ponad 65% ceny”, „W granicy 65% ceny” i „Nie dotyczy (auto)”: pozycja ze stawką „auto” jest
      tylko w „Nie dotyczy”, nawet przy mnożniku inwestycji ponad 65%; pozycja z własną stawką — w
      „Ponad” albo „W granicy”.
      _Staging 2026-10-18 (pass 8): inw. 210 (widok z/bez narzędzi): „Źródło stawki wykonawcy — …” i „Udział wykonawcy w cenie — …” (Ponad 65% / W granicy / Nie dotyczy (auto)); Auto (59) = Nie dotyczy (59), 10+258+59 = 327; katalog ma te same nazwy z „(auto lub bez ceny j.m.)”._
- [x] Katalog prac → „Filtry”: bez „Pokaż tylko” i bez „Wyczyść filtry”. Przy czymkolwiek zaznaczonym
      na górze jest „Wyczyść” — odhacza tylko opcje tego menu („Kategoria”, „j.m.”, „Problemy” i
      „Szukaj…” zostają), po czym znika. „Wyczyść filtry” dla całej strony zostaje w pasku nad tabelą.
      _Staging 2026-10-18 (pass 8): menu: „Wyczyść” na górze, brak „Pokaż tylko”/„Wyczyść filtry”; po kliknięciu zostają „Szukaj…” (a) i „Problemy” (20/581), „Wyczyść” znika; „Wyczyść filtry” zostaje w pasku nad tabelą._
- [x] Katalog prac → nad paskiem „Widoczne prace X / Y” (bez ikony ⓘ): X = wiersze po filtrach i
      wyszukiwaniu, Y = wszystkie prace; bez filtrów X = Y.
      _Staging 2026-10-18 (pass 8): „Widoczne prace 581 / 581” bez ikony ⓘ (0 svg); z filtrem 11/581, z filtrem+szukaniem+problemem 20/581 → 0/581 zmienia się od razu._
- [x] Transakcje → dowolny filtr z listą (typ, kasa, inwestycja…): nic zaznaczone = wszystkie wiersze,
      zaznacz jeden → tylko on; pojawia się „Wyczyść”, które zdejmuje zaznaczenie. Brak „Zaznacz
      wszystkie”.
      _Staging 2026-10-18 (pass 8): filtr „Typ”: nic zaznaczone = wszystkie; „Korekta” → tylko korekty (49) + „Wyczyść” na górze, brak „Zaznacz wszystkie”; „Wyczyść” zdejmuje zaznaczenie (URL wraca do /)._
- [x] Inwestycje → filtr statusu: odznacz wszystkie statusy → widać wszystkie inwestycje (nie pusta
      lista), przycisk bez licznika.
      _Staging 2026-10-18 (pass 8): Status: po „Wyczyść” 178/178, przycisk „Status” bez licznika; Aktywna → 45/178 „Status (1)”, + Zakończona → 137/178 „Status (2)”._
- [x] Użytkownicy → odznacz zarówno „Aktywni”, jak i „Nieaktywni” → widać wszystkich (nie pusta lista).
      _Staging 2026-10-18 (pass 8): /pracownicy: odznaczenie Aktywni (Nieaktywni też off) → 63/63 (nie pusta lista), „Filtry (1)” → bez licznika po odznaczeniu obu grup._
- [x] Pracownicy → jeden przycisk „Filtry” z grupami „Pracownicy” i „Pozostało do wypłaty”; bez „Pokaż
      tylko”, „Zresetuj filtry” i „Zaznacz wszystkie”. Przy czymkolwiek zaznaczonym na górze jest
      „Wyczyść” — odhacza obie grupy naraz (widać wszystkich pracowników i obie kwoty), po czym znika.
      Licznik na przycisku liczy zaznaczone opcje.
      _Staging 2026-10-18 (pass 8): menu: „Wyczyść” na górze, grupy „Pracownicy” (Aktywni/Nieaktywni) i „Pozostało do wypłaty”, brak „Pokaż tylko”/„Zresetuj filtry”/„Zaznacz wszystkie”; „Wyczyść” odhacza obie grupy: 63/63, przycisk „Filtry” bez licznika, „Wyczyść” znika; licznik 2 → 1 → 0 zgodny z liczbą zaznaczonych._
- [x] Pracownicy → pod tytułem „Widoczni pracownicy X / Y” (bez ikony ⓘ): X = wiersze widoczne w
      tabeli, Y = wszyscy; zmienia się od razu przy „Filtry” i wpisywaniu w „Szukaj…”.
      _Staging 2026-10-18 (pass 8): „Widoczni pracownicy 48 / 63” (domyślnie) → 63/63 po odznaczeniu Aktywni; bez ikony ⓘ (tytuł tekstowy); wpisywanie w „Szukaj…” — niesprawdzone osobno, ten sam mechanizm co Inwestycje (1/178 dla „QA”)._
- [x] Pracownicy → „Filtry” → odznacz oba „Pozostało do wypłaty” → kwoty z aktywnych i zakończonych
      inwestycji naraz (nie 0 zł); samo „Zakończone inwestycje” → tylko zakończone.
      _Staging 2026-10-18 (pass 8): oba odznaczone: widać „nadpłata zakończone (…)” i „do zapłaty aktywne (…)” (17 zak. + 22 akt. wiersze, nie 0 zł); samo „Zakończone” → 17 zak./0 akt.; samo „Aktywne” → 0/22._
- [x] Inwestycje → „Status”: przy zaznaczonym statusie jest „Wyczyść” (brak „Zaznacz wszystkie”);
      kliknięcie zdejmuje wszystkie zaznaczenia — widać wszystkie inwestycje, a „Wyczyść” znika.
      _Staging 2026-10-18 (pass 8): przy zaznaczonym statusie „Wyczyść” na górze (brak „Zaznacz wszystkie”); klik zdejmuje wszystko → 178/178, „Wyczyść” znika._
- [x] Inwestycje → pod tytułem „Widoczne inwestycje X / Y” (bez ikony ⓘ): X = wiersze widoczne w
      tabeli, Y = wszystkie inwestycje; zmienia się od razu przy „Status”, „Analiza AI” i wpisywaniu w „Szukaj…” (bez
      filtrów X = Y). Nie ma już „N aktywnych”.
      _Staging 2026-10-18 (pass 8): „Widoczne inwestycje 178 / 178” bez ikony ⓘ i bez „N aktywnych”; Status → 45/178, szukaj „QA” → 1/178, Analiza AI → 161/178._
- [x] Inwestycje → obok filtrów nie ma już przycisku „Kolumny v2”; w menu „Kolumny” na górze jest
      sekcja „Warstwy” z „v1” i „v2”, oddzielona kreską od „Widoczne kolumny” (jak w kosztorysie).
      „v1” chowa/pokazuje „Bilans netto v1”, „Marża v1”, „Robocizna v1”; „v2” — „Bilans netto v2”,
      „Bilans brutto v2”, „Marża v2”, „Robocizna v2” i kolumnę pozostałej kwoty podwykonawców. Każda
      kombinacja działa, także obie odznaczone; menu zostaje otwarte, licznik na „Kolumny” się zgadza.
      _Staging 2026-10-18 (pass 8): brak „Kolumny v2”; menu „Kolumny”: Warstwy v1/v2 nad „Widoczne kolumny”; v1 off → „Kolumny (3)”, v2 off → v2 + Pozostało znika, obie off → „Kolumny (8)” (zostaje Kosztorys_v2), obie on → „Kolumny”; menu zostaje otwarte._
- [ ] Kosztorys, szablon → „Filtry”: bez „Wyczyść filtry”. Przy czymkolwiek zaznaczonym na górze jest
      „Wyczyść” — odhacza tylko opcje tego menu („Problemy”, zwinięte sekcje i „Szukaj…” zostają), po
      czym znika. Przewinięte w dół — „Wyczyść” odjeżdża razem z listą.
      _Staging 2026-10-18 (pass 10): kosztorys #213: menu bez „Wyczyść filtry”; po zaznaczeniu „Z przedmiarem” na górze „Wyczyść”; klik odhacza opcję, „Szukaj: Montaż” zostaje, „Wyczyść” znika, przycisk bez licznika. Szablon: brak „Filtry” (patrz wyżej); przewijanie menu niesprawdzone (menu mieści się bez przewijania)._
- [x] Kosztorys → „Sekcje”, pusty stan siatki i pasek nad siatką (Katalog prac — sam pasek): przycisk
      czyszczący wszystko nazywa się wszędzie „Wyczyść filtry” (nie „Zresetuj filtry” / „Wyczyść
      wszystko”) i zdejmuje filtry, zwinięte sekcje i wyszukiwanie.
      _Staging 2026-10-18 (pass 8): inw. 210: „Wyczyść filtry” w „Sekcje”, w pustym stanie siatki i w pasku; z filtrem+wyszukiwaniem+zwiniętą sekcją klik w pasku zdejmuje wszystkie trzy; katalog prac: „Wyczyść filtry” w pasku._
- [x] Kosztorys, Katalog prac → „Problemy” z wybranym problemem: brak „Zresetuj filtry”; ponowne
      kliknięcie wybranego problemu zdejmuje zawężenie.
      _Staging 2026-10-18 (pass 8): kosztorys inw. 210: problem „z wykonaną pracą bez przedmiaru” → 4 pozycje, ponowne kliknięcie → wszystkie, brak „Zresetuj filtry”; katalog prac: to samo (problem + wyczyszczenie), menu bez „Zresetuj”._
- [x] Kosztorys → „Problemy” → wybierz problem, popraw jedną pozycję: zostaje w siatce do czasu, aż
      znów otworzysz „Problemy” — wtedy znika. W menu nie ma już „Zawężenie” ani „Odśwież — ukryj
      poprawione”.
      _Staging 2026-10-18 (pass 8): inw. 210 problem "wykonana praca bez przedmiaru" (4): after fixing Transport row stays, count (3) and row gone after reopening Problemy; no Zawężenie/Odśwież in menu. Left: item 63789 current_planned_qty=1._
- [x] Kasy, Sprzęt, „Dodaj z katalogu” w kosztorysie → filtry z listą: nic zaznaczone = wszystko,
      zaznaczone = tylko one.
      _Staging 2026-10-18 (pass 8): Kasy Typ: Główne→1/40, off→40; Sprzęt Status: W użyciu→2, Wycofany→Brak danych, off→2; Dodaj pracę Kategorie: Glazura→1, off→276._

## 2026-10-16 — transfer-view-switch-mobile — przełącznik tabela/karty na telefonie

- [x] Telefon (390px) → Transakcje: przełącznik tabela/karty stoi sam w pierwszym rzędzie, pod nim
      „Szukaj duplikatów” i „Kolumny” obok siebie; nic nie wystaje poza ekran.
      _Staging 2026-10-18 (pass 8): 390px: przełącznik Tabela/Karty sam w rzędzie (y=2601), „Szukaj duplikatów” (16–191) i „Kolumny” (199–374) obok siebie pod nim, brak poziomego przewijania._
- [x] Desktop → Transakcje: przełącznik, „Szukaj duplikatów” i „Kolumny” w jednym rzędzie po prawej,
      jak dotąd.
      _Staging 2026-10-18 (pass 8): 1280px: Tabela/Karty (908–980), Szukaj duplikatów, Kolumny w jednym rzędzie po prawej (y≈2495)._

## enter-escape-keydown — Enter/Escape w polu komórki nie trafia już do siatki

Edytor kosztorysu, desktop. Wygląd się nie zmienia; Enter/Escape w trakcie wpisywania obsługuje teraz
tylko komórka, a siatka ich nie widzi.

- [x] Komórka liczbowa (Przedmiar, Cena j.m., rabat, kolumna etapu): wpisz wartość, **Enter** —
      wartość się zapisuje, edycja się zamyka, zaznaczenie schodzi **dokładnie o jeden wiersz** niżej.
      _Staging 2026-10-18 (pass 8): Enter zapisuje i schodzi o jeden wiersz._
- [x] Ta sama komórka: wpisz inną wartość, **Escape** — wraca poprzednia wartość, zaznaczenie zostaje
      na tej samej komórce, nic się nie zapisuje.
      _Staging 2026-10-18 (pass 8): Escape cofa wartość, zaznaczenie zostaje._
- [ ] Nazwa sekcji: zmień ją i **Enter** — zapis i zejście o wiersz; zmień ponownie i **Escape** —
      stara nazwa wraca, zaznaczenie zostaje w miejscu.
      __Staging 2026-10-19 (pass 11): needs human: na inw. 210 komórka nazwy sekcji zaznacza się (klik/dwuklik), ale Enter ani wpisywanie nie otwiera edycji w sterowaniu myszą/klawiaturą z Playwrighta (pole input w nagłówku istnieje, fokus zostaje na body); przewijanie siatki zamiast edycji. Wymaga ręcznego sprawdzenia w realnej przeglądarce.__
- [x] Widok podwykonawcy, komórki ceny i współczynnika: Enter i Escape jak w pierwszych dwóch boksach.
      _Staging 2026-10-18 (pass 8): Cena j.m. w widoku podwykonawcy: Enter schodzi, Escape zostaje; Mnożnik jest tylko do odczytu (wyliczany)._
- [x] Nagłówek etapu: kliknij zwykłą komórkę, potem z menu etapu zmień nazwę i **Enter** — nazwa się
      zapisuje, a zaznaczona komórka **nie** wchodzi w edycję. To samo z **Escape** — zmiana nazwy
      anulowana, komórka dalej zaznaczona.
      _Staging 2026-10-18 (pass 8): Zweryfikowane._
- [x] Komórka zaznaczona bez wpisywania: **Enter** otwiera edycję, **Escape** zdejmuje zaznaczenie.
      _Staging 2026-10-18 (pass 8): Zweryfikowane._
- [x] W trakcie edycji Tab i strzałki góra/dół dalej przechodzą między komórkami.
      _Staging 2026-10-18 (pass 8): Zweryfikowane._

## 2026-10-16 — umowa-dialog — „Umowa” generowana z widoku inwestycji

- [x] Inwestycja z „Dane do umowy” = Osoba prywatna i „taki sam” włączonym → „Umowa”: Zamawiający
      to imię i nazwisko, adres w „Dane Zamawiającego” = adres inwestycji, Miejsce zawarcia „Warszawie”, data =
      dziś, Osoby odpowiedzialne „Bartosz Antonik, Yuri Abramenko”, Kwota netto = „Wartość netto
      przedmiar” ze stopki kosztorysu.
      _Staging 2026-10-18 (pass 9): Zweryfikowane (inw. 210: imię/nazwisko, adres inwestycji, Warszawie, data 18.10.2026, nadzór, Kwota netto 95 652,00 = Σ przedmiar×cena z bazy)._
- [x] „Dane do umowy” = Firma → Zamawiający to firma + NIP + repr., pola PESEL nie ma.
      _Staging 2026-10-18 (pass 9): Zweryfikowane (inw. 210: firma + NIP + repr., brak pola PESEL; dane przywrócone)._
- [x] „taki sam” wyłączony, adres do umowy wpisany → adres w „Dane Zamawiającego” to ten adres, a Adres
      inwestycji dalej adres inwestycji.
      _Staging 2026-10-18 (pass 9): Zweryfikowane (adres do umowy ≠ adres inwestycji w oknie i na wydruku)._
- [x] Oba adresy w oknie mają osobne pola Ulica i numer / Kod pocztowy / Miejscowość / Kraj; po
      poprawce kodu w Adresie inwestycji i „Generuj” wydruk pokazuje adres w jednej linii, z nowym
      kodem, w §1 ust. 2.
      _Staging 2026-10-18 (pass 9): Zweryfikowane na przechwyconym HTML wydruku (§1 ust. 2 z nowym kodem 22-222)._
- [x] Inwestycja bez kosztorysu → Kwota pusta, okno działa normalnie.
      _Staging 2026-10-18 (pass 9): Zweryfikowane (inw. 209: Kwota pusta, Generuj działa)._
- [ ] „Generuj” w Chrome z „Marginesy: Brak”, a potem z „Domyślne” → w obu przypadkach strona 2 i
      kolejne mają taki sam margines u góry i u dołu jak strona 1. To samo dla „Protokół odbioru” i
      w Safari.
      __Staging 2026-10-19 (pass 11): needs human: margines stron 2+ widać tylko w prawdziwym podglądzie wydruku (Chrome „Marginesy: Brak/Domyślne”, Safari); przechwycony HTML ma tylko regułę @page, nie wynik renderu.__
- [x] W oknie „Umowa” → „Edytuj dane inwestycji” → zmień imię klienta i zapisz → pola umowy
      wypełniają się nowymi danymi.
      _Staging 2026-10-18 (pass 9): Zweryfikowane (zapis → pola umowy wypełnione nowymi danymi)._
- [ ] „Generuj” z pustym Numerem, PESEL-em i terminami → podgląd wydruku: kropkowane puste miejsca,
      „zwanym dalej (Zamawiającym)”, „Wykończymy sp. z o.o.”, linia „8% VAT”, podpisy na końcu;
      „Zapisz jako PDF” proponuje nazwę „Umowa nr … — …”. Sprawdź w Chrome i Safari.
      __Staging 2026-10-19 (pass 11), Chrome, window.open stubbed (HTML captured, 1 print call): inw. 210 empty form -> „UMOWA nr” + fill spans, „zwanym dalej (Zamawiającym)”, „Wykończymy sp. z o.o.”, „8% VAT” line, „Zamawiający / Przyjmujący zamówienie” signature block at the end; <title> = „Umowa — QA EX-855 Inwestycja” (number omitted when empty, per build-contract-html.ts, so „nr …” is not proposed). Dotted look of the blanks and the Safari half not seen — needs human (real print preview + Safari).__
- [x] Inwestycja w koszu → brak przycisku „Umowa”.
      _Staging 2026-10-18 (pass 9): Zweryfikowane (inw. 138 w koszu: brak przycisku)._

## 2026-10-16 — worker-drafts-in-type-filter — „Zgłoszone wydatki” w „Typ” + szersza kolumna pracowników

- [x] Kasa (lub pulpit kierownika) → „Typ”: na liście jest „Zgłoszone wydatki”, osobnego przycisku obok
      filtrów już nie ma. Zaznacz → zostają tylko zgłoszone wydatki, „Typ (1)”; „Wyczyść” w liście zdejmuje.
      _Staging 2026-10-18 (pass 10): /kasa/41: „Zgłoszone wydatki” na liście Typ, brak osobnego przycisku; po zaznaczeniu „Typ (1)”, ?workerDrafts=1, 8 transferów powstałych ze zgłoszeń (zgodne z worker_expense_draft_transfers); „Wyczyść” w liście zdejmuje filtr_
- [x] „Typ” → „Zgłoszone wydatki” + „Wpłata od inwestora”: widać oba rodzaje wierszy — wpłaty i zgłoszone
      wydatki (opcje w „Typ” sumują się, nie zawężają).
      _Staging 2026-10-18 (pass 10): /transakcje: samo workerDrafts = 0 wpłat, 58 wydatków; z INVESTOR_DEPOSIT = wpłaty + zgłoszone, „Typ (2)”_
- [x] Pracownicy → kolumna „Imię i nazwisko” jest szersza; typowe imię z nazwiskiem mieści się w jednej
      linii.
      _Staging 2026-10-18 (pass 10): kolumna 299 px, wszystkie widoczne imiona w jednej linii (screenshot)_

## 2026-10-16 — catalogue-filters-and-stage-latch — katalog prac, filtry trzymają edytowaną pozycję, etap zakończony

- [x] Katalog prac → „Kolumny” jest tak szerokie jak „Kolumny” w edytorze kosztorysu; długie nazwy
      („Źródło z narzędziami (podwykonawca)”) mieszczą się w jednej linii.
      _Staging 2026-10-18 (pass 10): menu 448 px (jak w edytorze), wszystkie etykiety wiersza 32 px wysokości = jedna linia_
- [x] Katalog prac → „Kategoria”: lista jest szersza, a przy każdej kategorii stoi liczba prac, np.
      „Łazienka (40)”; liczby nie zmieniają się przy wyszukiwaniu ani innych filtrach.
      _Staging 2026-10-18 (pass 10): lista 448 px, „Łazienka (137)”, „Podłogi (71)”; liczby bez zmian po wpisaniu „bruzdowanie”_
- [x] Katalog prac → włącz filtr z „Filtry”: pasek z aktywnymi filtrami stoi pod filtrami, nad
      „Nowa praca” / „Kolumny”. Inne tabele (Kasa, Pracownicy) wyglądają jak wcześniej.
      _Staging 2026-10-18 (pass 10): pasek „Tylko: …” pod rzędem filtrów; Kasa/Pracownicy bez porównania z poprzednim stanem (brak wzorca)_
- [x] Kosztorys → „Filtry” → „Tylko: pozycje bez przedmiaru” → wpisz cyfrę w „Aktualizacja przedmiaru”:
      pozycja zostaje w tabeli, zaznaczenie zostaje na niej, kolejne cyfry trafiają do tej samej pozycji.
      _Staging 2026-10-18 (pass 10): wpisano 1,2,3 w jednej pozycji: wiersz został, wartość 123 w jednej komórce, licznik 351→350_
- [x] Ten sam kosztorys → otwórz menu „Filtry”: poprawiona pozycja znika z tabeli.
      _Staging 2026-10-18 (pass 10): po Enter i otwarciu menu Filtry wiersz zniknął z tabeli_
- [x] Kosztorys → etap oznaczony jako zakończony: kolumny etapu są w kolorze morskim, ✓ stoi w drugiej
      linii nagłówka przed imieniem pracownika (bez pracownika — sam ✓), pierwsza linia się nie rozjeżdża.
      _Staging 2026-10-18 (pass 10): kolumny etapu morskie, ✓ w drugiej linii: sam ✓ bez pracownika, ✓ przed „Adam Orłowski” z pracownikiem; stage usunięty po teście_

## 2026-10-16 — offer-planned-discount-amount — „Rabat kwota netto (przedmiar)” + „— po rabacie” w ofercie

- [x] Kosztorys z rabatem 5 % na części pozycji → „Kolumny”: zaznacz „Rabat kwota netto (przedmiar)”.
      Przy pozycji z rabatem stoi przedmiar × cena − „Wartość przedmiaru netto” (np. 30 × 45 zł → 67,50),
      suma w stopce się zgadza; nagłówek „Wartość przedmiaru netto — po rabacie”.
      _Staging 2026-10-18 (pass 10): inw. 213: 2×1500 / 30×80 / 10×200 przy 5 % daje 150 / 120 / 100; stopka 150, 220; nagłówek „Wartość przedmiaru netto — po rabacie”_
- [x] Ten sam kosztorys, tryb brutto: zamiast netto stoi „Rabat kwota brutto (przedmiar)”.
      _Staging 2026-10-18 (pass 10): po wyłączeniu Netto zostaje tylko „Rabat kwota brutto (przedmiar)” (162,00 / 129,60 / 108,00)_
- [x] Ta sama inwestycja → „Opcje” → „Ceny i rabat”: „Rabat kwota netto (przedmiar)” jest odznaczona.
      Zaznacz → podgląd i link dla inwestora pokazują ją obok „Rabat”; „Drukuj PDF” drukuje ją, a nad
      wartością stoi „Wartość netto — po rabacie”.
      _Staging 2026-10-18 (pass 10): domyślnie odznaczona; po zaznaczeniu podgląd (150/120/100, razem 370) i HTML PDF (stub print) mają kolumnę, nagłówek „Wartość netto — po rabacie”_
- [x] Inwestycja bez żadnego rabatu: nagłówki bez „— po rabacie”; zaznaczona w „Opcje” kolumna nie
      pojawia się ani na podglądzie, ani w PDF.
      _Staging 2026-10-18 (pass 10): pozycje ustawione na „Bez rabatu” przy zaznaczonej kolumnie: podgląd i PDF bez „— po rabacie” i bez kolumny_
- [x] Inwestycja z rabatem globalnym: nowych kolumn nie ma ani w „Kolumny” edytora, ani na dokumencie
      dla inwestora.
      _Staging 2026-10-18 (pass 10): rabat globalny kwotowy 100 zł: brak kolumn Rabat w „Kolumny” (16→14) i na podglądzie inwestora; przywrócono Wyłączony_
- [x] Kosztorys z rabatem na pozycjach w dwóch sekcjach, „Rabat kwota netto (przedmiar)” zaznaczona w
      „Opcje” → „Drukuj PDF”: każdy wiersz „Razem — <sekcja>” ma sumę także pod kwotą rabatu, a pod
      „Razem netto” stoi „W tym rabat” z sumą kolumny. Odznacz kolumnę → „W tym rabat” znika z PDF.
      _Staging 2026-10-18 (pass 10): PDF (stub): Razem — Prace dodatkowe 150 zł, Razem — Klimatyzacja 220 zł, „W tym rabat” 370 zł; po odznaczeniu kolumny „W tym rabat” znika_

## 2026-10-16 — worker-pdf-totals — sumy kolumn i łamanie stron w PDF pracownika

- [x] Kosztorys → „Pracownik” → „Drukuj kosztorys pracownika (PDF)” dla pracownika bez wpisów w
      etapach: pod „Wartość netto aktualizacji przedmiaru” (i „Pozostało netto”, gdy włączona) jest suma w każdym
      „Razem — <sekcja>” oraz wiersz „Razem” z sumą całości na końcu tabeli.
      _Staging 2026-10-18 (pass 10): HTML z stubu print: „Razem — <sekcja>” (1657,50 / 1840,00) i „Razem” 3497,50 pod „Wartość netto aktualizacji przedmiaru”; kolumna „Pozostało netto” nie jest w domyślnym widoku pracownika, więc jej nie było do sprawdzenia_
- [x] Ten sam PDF dla pracownika z wpisami w etapach: sumy są też pod kolumnami netto etapów i
      „Suma etapów … netto”; pod stawką i ilościami komórka sumy jest pusta.
      _Staging 2026-10-18 (pass 10): wpisy 1 i 5: sumy pod „Etap 1 netto” i „Suma etapów … netto” (828,75 / 140,00 / razem 968,75); w wierszach sum brak komórek pod stawką i ilościami_
- [ ] PDF zapisany z Safari: ostatnia litera „zł” w skrajnej prawej kolumnie nie jest obcięta, a
      kwota w wierszu „Razem” nie nachodzi na sąsiednią kolumnę.
      _Staging 2026-10-18 (pass 10): HUMAN: Safari/WebKit nie do sterowania z desktopowego Chromium_
- [ ] PDF z Safari dla kosztorysu na 2+ strony: żaden wiersz nie jest rozcięty (opis na jednej
      stronie, kwoty na drugiej) — wiersz, który się nie mieści, przechodzi w całości na następną.
      _Staging 2026-10-18 (pass 10): HUMAN: Safari/WebKit + prawdziwy podgląd wydruku_
- [x] Ten sam PDF z Chrome: wydruk poziomy, nagłówki kolumn powtarzają się na każdej stronie.
      _Staging 2026-10-18 (pass 10): CSS w HTML wydruku: @page { size: A4 landscape } i thead { display: table-header-group }; sam podgląd wydruku nie do obejrzenia w stubie (print-preview = człowiek), ale asercja na HTML przeszła_
- [x] „Drukuj PDF” oferty dla inwestora i formularz pracownika do wypełnienia wyglądają jak dotąd.
      _Staging 2026-10-18 (pass 10): HTML oferty (kolumny, sekcje, Razem netto) i kartki „Do wypełnienia” (Nr, Opis, Wykonano, Zgłaszam, Postęp, j.m. + Prace spoza rozpiski) renderują się poprawnie; wygląd wizualny w wydruku = podgląd człowieka_

## 2026-10-18 — dead-code-cleanup — usunięty martwy kod, zachowanie bez zmian

- [x] Lista z więcej niż jedną stroną (np. „Wypłaty”): strzałki poprzednia/następna strona i „…”
      w paginacji wyświetlają się i działają jak dotąd.
      _Staging 2026-10-18 (pass 10): strona główna (42 strony): strzałki „Przeskocz 5 stron” (3→8) i „Cofnij 5 stron” (8→3) z ikoną svg działają, „…” widoczne w trakcie przejścia, numery 1…42 renderują się._
- [x] Pole wyszukiwanego wyboru w formularzu (np. inwestycja w „Dodaj transakcję”): strzałka
      rozwijania jest widoczna, lista się otwiera.
      _Staging 2026-10-18 (pass 10): w „Nowa wpłata” select inwestycji ma chevron (svg 16x16), lista otwiera się (52 opcje)._
- [x] Kosztorys z rabatem kwotowym: „Do zapłaty” = suma netto − rabat, tak jak przed zmianą;
      to samo na widoku inwestycji (robocizna i rabat z kosztorysu).
      _Staging 2026-10-18 (pass 10): inw. Sowińskiego 49b (rabat kwotowy 3703,70 netto): robocizna wykonana 65 676,00 netto; podsumowanie kosztorysu: Robocizna 70 930,08 − Rabat 4000,00 (=3703,70×1,08) + Materiały 27 928,79 = Łącznie 94 858,87, wpłaty 89 858,40, Pozostało 5000,47 (suma się zgadza); widok inwestycji pokazuje te same liczby (Robocizna 70 930,08 / Rabat −4000,00 / Łącznie 94 858,87)._
- [x] Kosztorys inwestycji z materiałami wliczonymi w robociznę → „Problemy”: pozycja o stawkach
      wykonawców liczonych według formuły pokazuje ten sam opis z liczbą wierszy.
      _Staging 2026-10-18 (pass 10): inw. 114 (1 wydatek rozliczony), Problemy → „Stawki wykonawców — z narzędziami”: „Stawki wykonawców liczone według formuły — ta inwestycja ma materiały wliczone w robociznę, więc stawki liczone ze współczynnika będą zawyżone; ustaw „Źródło ceny wykonawcy” na „kwota stała” (42)” (opis + liczba wierszy)._
- [x] „Transfer między kasami” z tą samą kasą źródłową i docelową: zapis jest odrzucony z
      komunikatem jak dotąd.
      _Staging 2026-10-18 (pass 10): źródło=cel „Adrian Gotówka”, Dodaj → pole „Kasa docelowa musi być inna niż kasa źródłowa”, „Formularz zawiera błędy”, nic nie zapisane._

## 2026-10-18 — test-suite-audit faza 1 — zapytanie o wpłaty inwestora uproszczone, zachowanie bez zmian

- [x] Inwestycja z kilkoma wpłatami inwestora, w tym jedną anulowaną → kosztorys (rozliczenie)
      oraz panel podsumowania inwestycji: widać te same wpłaty co przed zmianą, bez anulowanej,
      najnowsze na górze; wpłaty innej inwestycji się nie pojawiają.
      _Staging 2026-10-18 (pass 10): Żupnicza 10/83: Lista wpłat = 05.06 (4882,50), 24.04 (43 942,50), 18.03 (65 647,00) newest first, anulowana 1077 nieobecna, panel Wpłaty -114 472,00 = suma żywych; brak wpłat innych inwestycji._

## EX-1033 — document-settings-column-map — odczyt starego formatu ustawień kolumn usunięty

- [x] Kosztorys → ustawienia widoku dla inwestora oraz widoku pracownika: odznacz jedną kolumnę,
      zaznacz inną ukrytą domyślnie, zapisz i odśwież stronę — wybór się utrzymuje; podgląd i PDF
      pokazują dokładnie te kolumny (odczyt starego formatu usunięty, zachowanie bez zmian).
      _Staging 2026-10-18 (pass 10): ten sam test #213: po przeładowaniu strony wybory obu widoków się utrzymują; podgląd inwestora pokazuje dokładnie wybrane kolumny. PDF (okno druku) = HUMAN, niezweryfikowany._

## transfer-actions-db-spec — anulowanie i edycja kwoty zapisują się razem z wpisem w historii

- [x] Transakcje → anuluj wydatek z kasy, podając powód: wiersz jest oznaczony jako anulowany,
      pojawia się wiersz anulowania z tym powodem, saldo kasy i bilans inwestycji wracają do stanu
      sprzed wydatku.
      _Staging 2026-10-18 (pass 10): tx 5952 (100 zł): po anulowaniu tx 5952 cancelled=true, nowy wiersz CANCELLATION 5953 z powodem „QA pass10 powód”, saldo kasy 48 876,91 (jak przed), Materiały inwestycji 86,90 (jak przed)._
- [ ] Anuluj wydatek materiałowy inwestycji podpiętej do arkusza: jego wiersz znika z arkusza jak
      dotąd.
      _Staging 2026-10-18 (pass 10): NIE do zrobienia na stagingu: zapis do arkusza właściciela jest z założenia zablokowany poza produkcją (konto Viewer, AGENTS.md → Hard Stops), więc „wiersz znika z arkusza” nie jest obserwowalny; samo anulowanie wydatku materiałowego zweryfikowano w boksie powyżej. needs human: tylko produkcja._
- [x] Zmień kwotę robocizny na inwestycji: lista pokazuje nową kwotę, historia zmian kwoty ma wpis
      stara → nowa, bilans przesuwa się o różnicę.
      _Staging 2026-10-18 (pass 10): tx 5954 (robocizna 100 → 150 przez „Edytuj”): lista pokazuje 150,00, amount_edits ma wiersz 100 → 150 (user 75), „Bilans netto v1” 764,10; edycja 150 → 100: 814,10 (przesunięcie o 50 = różnica), Robocizna v1 100,00. Transakcja anulowana na koniec._

## 2026-10-18 — kosz-plikow — usunięte pliki trafiają do Kosza na 7 dni

Zamiatacz kasuje dopiero po siedmiu dniach, więc boksy o kasowaniu wymagają cofnięcia daty usunięcia
na bazie testowej albo powrotu za tydzień — to kształt sprawdzenia, nie blokada.

- [x] Usunięcie pliku z galerii inwestycji, faktury z transakcji i pliku ze zgłoszenia pyta o
      potwierdzenie zdaniem o Koszu i 7 dniach — nigdzie nie pada „bezpowrotnie".
      _Staging 2026-10-18 (pass 10): inw. 213 (plik i „Usuń wszystkie”): „Usunięte pliki trafią do Kosza na 7 dni — do tego czasu można je przywrócić.”; faktura transakcji (inw. 210 / kasa główna): „Czy na pewno chcesz usunąć fakturę? Usunięte pliki trafią do Kosza na 7 dni…”; plik zgłoszenia (/zgloszenia, „Usuń plik ze zgłoszenia”): to samo zdanie. Nigdzie „bezpowrotnie”._
- [x] Galeria inwestycji z kilkoma plikami znów ma „Usuń wszystkie"; przy jednym pliku go nie ma.
      _Staging 2026-10-18 (pass 10): inw. 213: 3 pliki → w galerii „Usuń wszystkie” + „Usuń ten plik”; po usunięciu dwóch zostaje 1 plik i przycisk „Usuń wszystkie” znika._
- [x] Usunięty plik pojawia się w Koszu w sekcji „Pliki": nazwa pliku, skąd zszedł (np.
      „Inwestycja … · pliki", „Wydatek inwestycyjny z … · faktura") i „usunie się samo za 7 dni";
      nie ma przy nim „Usuń na zawsze".
      _Staging 2026-10-18 (pass 10): /kosz → Pliki: „qa-pass10-2….png / Inwestycja QA pass10 inwestycja · pliki”, „… / Koszty robocizny z 18.10.2026 · faktura”, „… / Zgłoszenie Test Test · pliki”, każdy „W koszu od 18.10.2026 · usunie się samo za 7 dni”, tylko „Przywróć”, bez „Usuń na zawsze”._
- [x] „Przywróć" przy pliku wraca go do galerii inwestycji / faktur transakcji / plików zgłoszenia,
      a wiersz znika z sekcji „Pliki".
      _Staging 2026-10-18 (pass 10): inw. 213: po Przywróć „Dokumentacja (2)” → galeria ma plik, wiersz zniknął; faktura 5956: FV znów na karcie transakcji; plik zgłoszenia (Test Test): wiersz zniknął z Pliki._
- [x] Plik usunięty z inwestycji, którą potem przeniesiono do Kosza: wiersz jest, „Przywróć" jest
      wyłączone, pod wierszem „Najpierw przywróć inwestycję z Kosza."; po przywróceniu inwestycji
      plik da się przywrócić.
      _Staging 2026-10-18 (pass 10): inw. 213: plik w koszu, inwestycja do kosza → wiersz „Pliki” ma „Przywróć” wyłączone i „Najpierw przywróć inwestycję z Kosza.”; po przywróceniu inwestycji „Przywróć” aktywne, plik wrócił do galerii._
- [x] Jako MANAGER: faktura usunięta z transakcji kasy głównej nie pokazuje się w sekcji „Pliki";
      jako OWNER — pokazuje się.
      _Staging 2026-10-18 (pass 10): tx 5957 (Inny wydatek, Kasa główna Bartek, FV): po usunięciu FV jako OWNER wiersz w /kosz → Pliki („Inny wydatek z 18.10.2026 · faktura”); jako MANAGER (qa-staging-manager) /kosz bez wiersza i bez sekcji Pliki; potem OWNER → Przywróć OK._
- [x] Pliki inwestycji usuniętej na zawsze nie pojawiają się w sekcji „Pliki".
      _Staging 2026-10-18 (pass 10): inw. 213 (3 pliki Dokumentacji) usunięta na zawsze z Kosza (wpis nazwy) → /kosz bez sekcji „Pliki”, brak qa-pass10-*.png; rekordy media 2784–2786 zostają w bazie bez referencji (do crona)._
- [ ] Plik w Koszu dłużej niż 7 dni: po wywołaniu `/api/cron/cleanup` znika z Kosza i z Bloba, a
      odpowiedź niesie krok `media` z rozbiciem `{ recorded, healed, deleted, failed }`; drugie
      wywołanie pod rząd kasuje zero.
      _Staging 2026-10-18 (pass 10): needs human: niszczący cron czyszczący (/api/cron/cleanup kasuje z Bloba) — poza zakresem agenta; wymaga cofnięcia daty usunięcia na bazie testowej i uruchomienia crona przez człowieka._
- [ ] Paragon w zgłoszeniu wydatku pracownika i zdjęcie w zgłoszeniu prac przeżywają przebieg crona
      nietknięte.
      _Staging 2026-10-18 (pass 10): needs human: wymaga przebiegu crona /api/cron/cleanup (niszczący, poza zakresem agenta)._
- [x] Skasowanie transakcji z fakturą kasuje fakturę od razu, bez Kosza (świadomy wyjątek).
      _Staging 2026-10-19 (pass 11, 74197b427): tx 5966 z FV (media 2795) skasowana przez REST DELETE (200) → po kilku sekundach brak wiersza media, plik w Blobie 404. OK._
      _Staging 2026-10-18 (pass 10): NIE ZGADZA SIĘ: tx 5957 i 5958 (Inny wydatek z FV, kasa główna) skasowane przez REST DELETE /api/transactions/:id (200, wiersz transakcji znika, brak w kasie) — rekord media (2788/2789) ZOSTAJE w bazie (i plik w Blobie) po usunięciu transakcji; dotyczy też FV bez wcześniejszego Kosza (5958). Przyczyna z kodu: deleteInvoiceMediaAfterDelete → deleteUnreferencedMedia skanuje referencje przez getDb(payload) bez req, czyli poza transakcją Payloada, w której delete jeszcze się nie zatwierdził → wiersz transactions_rels nadal widoczny → media uznane za „użyte”, nic nie kasuje (cichy return, bez błędu). Finding opisany w ### Findings. Osierocone media posprzątałem przez DELETE /api/media._
- [ ] „Usuń na zawsze" przy inwestycji, szablonie i zgłoszeniu w Koszu wygląda i działa jak dotąd:
      ta sama notka w oknie, wymaga wpisania nazwy (przebudowa okna — bez zmiany zachowania).
      _Staging 2026-10-18 (pass 10): inwestycja (213: okno z notką o kosztorysie, przedmiarze, zdjęciach i linku dla inwestora, przycisk nieaktywny do wpisania nazwy) i szablon (okno „Kosztorysy założone z tego szablonu zostają bez zmian…”, wpis nazwy) — OK, oba usunięte; część ze zgłoszeniem (lead) niewykonana — needs human: nieodwracalne, jedyny rekord „Test Test”._
- [ ] Zgłoszenie, które wcześniej straciło plik do Kosza, usunięte na zawsze: plik znika też z
      sekcji „Pliki".

## EX-1078 — drop-scan-mode — zgłoszenia wydatków bez martwej kolumny, zachowanie bez zmian

- [x] Jako pracownik wyślij zgłoszenie wydatku ze zdjęciem paragonu: zgłoszenie pojawia się
      u kierownika jako oczekujące, a „Nowy wydatek" otwiera się z kwotą odczytaną przez AI.
      __Staging 2026-10-19 (pass 11): worker 77 draft 82 shown pending at manager; Nowy wydatek dialog opened with AI amount 100,5.__
- [x] Zgłoszenie przyjęte z pominiętym paragonem → przywróć paragon: komunikat „Paragon
      przywrócony", a paragon wraca jako osobne oczekujące zgłoszenie z tą samą notatką i
      odczytem AI.
      __Staging 2026-10-19 (pass 11): draft 83 (2 receipts): rejected #2, accepted #1 (40 zł), Przywróć → toast „Paragon przywrócony”, new pending draft same note „QA pass11 dwa paragony” with AI read (Market Testowy 3, 15,00 zł).__

## EX-1080 — restore-lock-first — „Przywróć wersję" zapisuje stan sprzed przywrócenia

- [x] Kosztorys z zapisaną wersją → zmień opis pozycji → „Wersje" → przywróć tę wersję: rozpiska
      wraca do stanu wersji (łącznie z VAT i współczynnikami), a na liście wersji pojawia się nowa
      automatyczna wersja z opisem sprzed przywrócenia; przywrócenie jej oddaje zmieniony opis.
      __Staging 2026-10-19 (pass 11): inw. 210: edited a description (→ „Q”), Opcje → Wczytaj → named version restored the original text; new Auto entry appeared in the history; restoring it returned the edited text; at the end the pre-test state (9 poz.) was restored from the newest Auto entry and the description retyped. VAT/współczynniki not compared (no per-row diff run).__

## EX-1079 — worker-account-scope — „Edytuj pracownika" trzyma zasady kont

- [x] Jako Manager otwórz stronę Właściciela w „Pracownicy": brak przycisku „Edytuj pracownika".
      _Staging 2026-10-18 (pass 9): MANAGER 76 on OWNER page /pracownicy/16: no „Edytuj pracownika" (button present on own page, so the probe is valid)._
- [x] Jako Manager na stronie pracownika → „Edytuj pracownika": lista „Rola" ma tylko „Pracownik";
      zmiana e-maila i zapis działa.
      _Staging 2026-10-18 (pass 9): MANAGER 76 on EMPLOYEE 77: Rola lists only „Pracownik"; email change saved (DB confirmed, reverted)._
- [x] Jako Manager na własnej stronie → „Edytuj pracownika": „Rola" pokazuje tylko „Manager", zmiana
      e-maila zapisuje się; odznaczenie „Aktywny" kończy się komunikatem „Nie można wyłączyć…
      własnego konta", konto zostaje aktywne.
      _Staging 2026-10-18 (pass 9): Rola offers only „Manager"; email change saved (DB confirmed, then reverted); unchecking „Aktywny" → „Nie można wyłączyć, przenieść do kosza ani usunąć własnego konta.", DB active stays true._
- [x] Jako Manager „Pracownicy" → „Dodaj": lista „Rola" ma tylko „Pracownik".
      _Staging 2026-10-18 (pass 9): MANAGER 76: Rola lists only „Pracownik"._
- [x] Jako Właściciel „Edytuj pracownika" u pracownika zalogowanego na telefonie → odznacz „Aktywny"
      i zapisz: telefon przy następnym kliknięciu zostaje wylogowany.
      __Staging 2026-10-19 (pass 11): worker 77 session token saved, OWNER unticked Aktywny and saved (DB active=f), saved token put back as payload-token and /pracownicy/77 opened -> redirected to /zaloguj. Reactivated afterwards (DB active=t). Browser stand-in for the phone.__

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

## EX-1089 — cache-tag-epoch — po zapisie odczyt nie wraca do stanu sprzed zmiany

- [x] Inwestycja → zmień nazwę lub status i zapisz, od razu odśwież stronę, potem przejdź na
      „Inwestycje" i z powrotem: wszędzie widać nową wartość, także po kolejnym odświeżeniu — bez
      klikania „Odśwież dane".
      _Staging 2026-10-18 (pass 9): Renamed QA inv. 210, immediate reload, list, back, reload ×3: new name everywhere (no „Odśwież dane"). Reverted._
- [x] Dodaj wydatek do inwestycji i od razu odśwież jej stronę oraz listę „Inwestycje": kwoty
      (bilans, marża) uwzględniają wydatek za pierwszym razem i nie cofają się przy kolejnym
      odświeżeniu.
      _Staging 2026-10-18 (pass 10): inw. 210: wydatek 100 zł (kasa QA EX-855): po zapisie i reloadzie Materiały 86,90 → 186,90 / Łącznie 41 090,90, ta sama wartość po przejściu na listę Inwestycje (lista: 186,90) i z powrotem oraz po kolejnym reloadzie. Wydatek anulowany (patrz transfer-actions-db-spec)._

## 2026-10-18 — media-holders-one-list — pliki ze zgłoszeń dalej chronione

- [x] Zgłoszenie prac lub zgłoszenie wydatku pracownika ze zdjęciem/paragonem: plik nie pojawia się
      w „Koszu plików" jako nieprzypięty, a próba jego usunięcia kończy się komunikatem „Nie można
      usunąć pliku — jest używany w innych miejscach (zgłoszenia prac / zgłoszenia wydatków)".
      Zdjęcie dalej widać w zgłoszeniu (refaktor listy tabel — zachowanie bez zmian).
      __Staging 2026-10-19 (pass 11): /kosz as OWNER has no „Pliki” section listing draft/report files; REST DELETE /api/media/2791 (draft 81 file) → 400 „…jest używany w innych miejscach (zgłoszenia wydatków: 1)…”, /api/media/2120 (work report file) → 400 „(zgłoszenia prac: 1)”; media rows intact; draft dialog still shows the receipts.__

## 2026-10-18 — mobile-375-qa — poprawki widoków na telefonie (375 px)

- [x] Telefon (375 px) → podgląd zdjęcia z załącznika: przyciski akcji chowają się pod „Więcej
      akcji” (⋯), a zdjęcie zajmuje większość ekranu.
      _Staging 2026-10-19 (pass 11), 375 px, inw. 210 galeria: „Więcej akcji” (⋯) zawiera Usuń ten plik / Usuń wszystkie / Oznacz do analizy AI / Dodaj kolejne / Drukuj / Pobierz wszystkie; zdjęcie 343 px szer. na całą szerokość._
- [x] Na desktopie ten sam podgląd zdjęcia wygląda jak dotąd — przyciski w rzędzie, bez „⋯”.
      _Staging 2026-10-19 (pass 11), 1280 px: wszystkie przyciski w rzędzie pod zdjęciem, bez „⋯”._
- [x] Telefon → „Rozlicz wypłaty”: „Kasa”, „Do rozdysponowania” i „Data” stoją jedna pod drugą
      i nie nachodzą na siebie; na desktopie dalej w jednym rzędzie.
      _Staging 2026-10-19 (pass 11), inw. 210 → Podsumowanie → Podwykonawcy → Rozlicz wypłaty: 375 px — Kasa / Do rozdysponowania / Data jedna pod drugą, bez nakładania; 1280 px — Kasa obok Do rozdysponowania i Daty w jednym rzędzie._
- [x] Telefon → inwestycja z długą nazwą: nazwa w górnym pasku skraca się, a przyciski po prawej
      zostają na ekranie.
      _Staging 2026-10-19 (pass 11), 375 px, inw. 153 (długa nazwa) /kosztorys_v2: nazwa w górnym pasku skrócona wielokropkiem („Zabkowska Pan k…”), trzy przyciski po prawej w ekranie, scrollWidth = 375._
- [x] Telefon → dialog z długim tytułem bez spacji (np. nazwa pliku): tytuł łamie się, nie wychodzi
      za ekran ani pod ✕.
      _Staging 2026-10-19 (pass 11), 375 px, dialog „Nowa praca” z tytułem podmienionym w DOM na 88-znakową nazwę pliku bez spacji: tytuł łamie się na 3 linie (16–263 px), ✕ zaczyna się w 319 px, brak przewijania poziomego dialogu (sw = cw = 375)._
- [ ] Telefon → raporty pracowników: „Skanuj raport (AI)” mieści się w ekranie na pełną szerokość;
      katalog prac → „Uzupełnij tłumaczenia (AI)” tak samo.
      _Staging 2026-10-19 (pass 11), 375 px: /zgloszenia-prac — przycisk (dziś „Wczytaj zgłoszenie z kartki (AI)”) ma 343 px od lewej 16 = pełna szerokość. „Uzupełnij tłumaczenia (AI)” w /katalog-prac nie renderuje się, bo wszystkie 582 pozycje mają tłumaczenia (count = 0) — needs human: sprawdzić na katalogu z nieprzetłumaczoną pozycją._
- [x] Telefon → kosztorys: „Opcje” ma tę samą szerokość co sąsiednie przyciski, a długa nazwa
      inwestycji w nagłówku łamie się na dwie linie zamiast wypychać przyciski.
      _Staging 2026-10-19 (pass 11), 375 px, /podglad-inwestora/153: Opcje i Podsumowanie po 168 px; h1 (59 znaków) w dwóch liniach (48 px = 2×24), scrollWidth = 375._
- [x] Telefon → link kosztorysu dla klienta i podgląd inwestora: „Opis prac” łamie się w ekranie,
      a kolumna „Przedmiar” wystaje z prawej (tabela przewija się w bok). Na desktopie bez zmian.
      _Staging 2026-10-19 (pass 11), 375 px, /podglad-inwestora/153: nagłówek „Opis prac” zajmuje ok. 280 px, kolumna „Przedmiar” zaczyna się przy prawej krawędzi i wystaje (przewijanie w bok wewnątrz tabeli, strona scrollWidth = 375). Kosztorys inw. 153 jest pusty, więc łamanie długiego opisu pozycji nie było widoczne na danych._
- [x] Telefon → raport pracownika (`/z/…`): kolumny tabeli wyglądają jak dotąd.
      _Staging 2026-10-19 (pass 11), 375 px, /z/210/… (QA worker 77): cztery kolumny Opis prac / Wykonano / Zgłaszam (podświetlona) / Postęp w ekranie, opisy łamią się, brak przewijania poziomego strony._

## 2026-10-18 — prepush-overlap — testy w hooku pre-push równolegle

- [ ] Następny prawdziwy `git push`: najpierw nagłówek „unit tests + typecheck + DB integration specs,
      parity (in parallel)”, potem trzy sekcje z wynikami („DB integration specs + parity” ostatnia)
      i zrzut bazy. Część testowa trwa ok. 70–80 s zamiast ok. 100 s (dłużej, gdy przebudowuje się
      szablon bazy testowej).
- [ ] Push z celowo zepsutym typem: hook się zatrzymuje, kończy linią „✗ pre-push FAILED at:
      typecheck”, a zrzut bazy się nie uruchamia.

## pass 9 — staging 2026-10-18 (zbiorcze findings)

### Findings — 2026-10-18

- [x] **Boksy wymagające człowieka** — dropped: zbiorczy wpis bez własnej treści; każdy z tych boksów
      ma przy sobie notatkę „needs human” i zostaje otwarty w swojej sekcji.
- [x] **Sekcje tylko-lokalne** (`prepush-overlap`, `e2e-run-speed`, `test-suite-audit`) — dropped:
      nie defekt; boksy zostają otwarte w swoich sekcjach do najbliższego `git push` / pełnego `pnpm test:e2e`.
- [x] **Edytor szablonu nie pokazuje „Filtry”** — dropped: zamierzone (puste menu nie renderuje
      wyzwalacza, przypięte w `kosztorys-filters-menu.test.tsx`); boks sprawdzać na inwestycji.
- [x] **Pass 9 — niewykonane z braku czasu** — dropped: zastąpione przebiegami 10 i 11; co zostało,
      to otwarte boksy w swoich sekcjach.

### Findings — 2026-10-18 (pass 10)

- [x] 🟡 **Skasowanie transakcji z fakturą nie kasuje faktury od razu** — `src/hooks/transfers/delete-invoice-media.ts`: fixed (380b54550), re-checked on staging 2026-10-19.
      **Test disposition:** TDD · integration.
- [x] 🔵 **„Sekcja z szablonu…” dodaje w kolejności listy** — dropped: kod tak działa od początku; box poprawiony.
- [x] 🔵 **Ostrzeżenie o pominiętej pracy to licznik** — dropped: zamierzone (`catalogued-preset-items.ts`); box poprawiony.
- [x] 🔵 **worker-pdf-totals: „Pozostało netto” poza domyślnym widokiem** — dropped: brzmienie boksu; poprawione.
- [x] 🔵 **Stan `ai_read` NULL niedostępny na stagingu** — dropped: pokrywa go `pending-expense-drafts.test.tsx`.
- [x] 🔵 **Edytor szablonu nie ma „Filtry”** — dropped: duplikat wpisu z pass 9.
- [x] 🔵 **„Importuj z arkusza” niezweryfikowane** — dropped jako defekt (akcja zwraca widoczne błędy);
      boks zostaje otwarty — potrzebny arkusz czytelny dla konta serwisowego stagingu.
- [x] 🔵 **Przejście z 404 do listy (React #310)** — **Linear: EX-1097.**
- [x] Test-suite-audit faza 1 (lista wpłat inwestora) zweryfikowana: 3 wpłaty, najnowsza na górze, bez anulowanej.
- [x] Po przebiegu: dane QA posprzątane (transakcje 5952/5954/5956/5959 anulowane, inw. 213 i szablon 3 usunięte na zawsze, szkic 80 odrzucony; media 2784–2786 bez referencji zostają do crona).

## EX-1097 — unknown-route-nav — z 404 da się wyjść linkiem z menu

- [x] Wpisz nieistniejący adres (np. `/szablony-kosztorysow`): widać „Nie znaleziono” w ramce aplikacji
      (menu, górny pasek).
- [x] Na tej stronie kliknij w menu „Szablony kosztorysów”: otwiera się lista szablonów, bez „Application error”.
- [x] To samo z adresu pod istniejącą sekcją (np. `/kasy/zzz`) → klik „Flota”: otwiera się Flota.
- [x] Nieistniejąca inwestycja (`/inwestycje/99999999`) dalej pokazuje „Nie znaleziono” i link z menu działa.

## 2026-10-18 — e2e-run-speed — E2E bez zbędnego buildu, na świeżej bazie

- [ ] Następny pełny `pnpm test:e2e`: na początku „test DB: cloned from template”, potem build bez
      sprawdzania typów, i cały przebieg przechodzi.
- [ ] Drugi `pnpm test:e2e` bez zmian w `src/` (zmieniony tylko spec): w logu „e2e build: reused”,
      serwer startuje w kilka sekund, a wyniki są takie same.

## 2026-10-19 — app-audit-refactor faza 1 — przeniesione komponenty wyglądają i działają jak dotąd

Sprawdź jako ADMIN, potem jako MANAGER. Refaktor bez zmiany zachowania: nic nie ma wyglądać inaczej.

- [ ] `/pracownicy`: kolorowe plakietki ról w tabeli jak dotąd; na telefonie (390 px) plakietka roli w
      menu.
- [ ] Inwestycja z kosztorysem → podsumowanie kosztorysu: wykresy kołowe (koszty i „Udział sekcji w
      kosztach robocizny”) pokazują procenty w legendzie i w dymku po najechaniu, jak dotąd.
- [ ] Dowolny formularz w oknie (np. „Dodaj kasę”): otwiera się, zapis zamyka okno, a z zaznaczonym
      „Nie zamykaj po zapisaniu” zostaje otwarte; w trakcie zapisu widać pigułkę z postępem.
- [ ] Strona inwestycji wejściem z listy → „Wróć” wraca na listę; ta sama strona otwarta z adresu →
      „Wróć” prowadzi na listę inwestycji.
- [ ] `/transakcje` → menu kolumn: ukrywanie i pokazywanie kolumn działa, okno kolejności kolumn
      przestawia kolumny.

## 2026-10-19 — app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, saldo zero

- [ ] Jako MANAGER na `/kasy`: przy kasie pracownika i swojej status („Aktywna” / „Nieaktywna”) da się
      przełączyć i zostaje po odświeżeniu; przy kasie innego managera, ownera i admina status widać,
      ale kliknięcie go nie przełącza.
- [ ] Jako MANAGER na `/kasy`: kosz w kolumnie „Akcje” jest przy kasie pracownika i swojej, przy kasie
      innego managera, ownera i admina go nie ma. W `/kosz` widać tylko kasy pracowników i swoje.
- [ ] Jako OWNER na `/kasy`: przełącz kasę na „Nieaktywna” i z powrotem — stan zostaje po odświeżeniu.
- [ ] Jako pracownik (EMPLOYEE) wpisz adres `/kasa/1`: trafiasz na swoją stronę pracownika, nie na
      „Nie znaleziono”.
- [ ] Jako MANAGER otwórz adres kasy głównej: „Nie znaleziono” jak dotąd.
- [ ] Jako ADMIN dodaj wydatek na inwestycji z podpiętym arkuszem: w logu serwera widać próbę
      synchronizacji arkusza (lokalnie konto tylko do odczytu ją odrzuca), bez błędu brakującego modułu.
- [ ] Jako ADMIN na `/pracownicy` kliknij kwotę wypłat przy pracowniku („Rozlicz wypłaty”): kwota
      „Pozostało”, która zaokrągla się do zera, pokazuje „0,00 zł” bez czerwonego koloru.

## 2026-10-19 — app-audit-refactor faza 3 — sortowanie, duplikaty, etykiety kas, druk, odczyt AI

- [ ] Jako ADMIN na Transakcjach, Leadach, Zgłoszeniach wydatków i Zgłoszeniach prac: posortuj po
      każdej sortowalnej kolumnie i odśwież — kolejność i adres zostają.
- [ ] Jako ADMIN dodaj sprzęt z numerem seryjnym, pojazd z rejestracją i pracownika z e-mailem, które
      ma już pozycja w Koszu — komunikat „… jest w Koszu — przywróć go stamtąd.”; z wartością żywej
      pozycji — „… już istnieje.”
- [ ] Jako MANAGER: typ kasy na `/kasy`, w formularzu kasy i na wykresie sald na pulpicie brzmi tak
      samo („Główne”, „Pomocnicze”, „Wirtualne”, „Pracownicze”).
- [ ] Jako ADMIN wydrukuj listę transakcji, ofertę i umowę: logo i układ jak dotąd, okno zamyka się
      po druku.
- [ ] Jako ADMIN zeskanuj paragon i papierowe zgłoszenie prac, przetłumacz opis pozycji kosztorysu —
      wynik taki jak dotąd.

## 2026-10-19 — app-audit-refactor faza 4 — zgłoszenia wydatków, raporty prac, edytor kosztorysu

- [ ] Jako ADMIN na `/zgloszenia-wydatkow`: zaakceptuj zgłoszenie, scal dwa zgłoszenia jednego
      pracownika i odrzuć paragony z trzeciego — kwoty i decyzje przy paragonach zostają po odświeżeniu.
- [ ] Jako ADMIN otwórz podgląd zgłoszenia prac i stronę zgłoszenia z linku pracownika na telefonie
      (390 px) — te same pozycje, kwoty i zdjęcia co dotąd.
- [ ] Jako ADMIN i jako MANAGER w edytorze kosztorysu: dodaj, zmień nazwę i usuń dział, dodaj pozycję
      na końcu działu i pod wskazaną pozycją, zmień etap i ustawienia inwestycji, przywróć wersję —
      wszystko zostaje po odświeżeniu.
- [ ] Jako ADMIN w Szablonie: dodaj dział i pozycję pod wskazaną pozycją — zostają po odświeżeniu.
- [ ] Jako ADMIN w edytorze kosztorysu: podgląd importu z arkusza i podgląd synchronizacji materiałów
      pokazują to samo co dotąd.

## 2026-10-19 — app-audit-refactor faza 5 — reguły kolekcji w nowym miejscu

- [ ] Jako ADMIN dodaj, edytuj i anuluj transakcję — salda kas zmieniają się bez odświeżania.
- [ ] Jako ADMIN usuń wydatek z fakturą — faktura znika z listy plików.
- [ ] Jako ADMIN spróbuj usunąć kasę, która ma transakcje — odmowa jak dotąd.

## 2026-10-19 — app-audit-refactor faza 6 — porządki w komponentach

Refaktor bez zmiany zachowania, chyba że box mówi inaczej.

- [ ] Jako EMPLOYEE na telefonie (390 px) → „Zgłoszenia wydatków”: filtry „Status” i „Inwestycja” zawężają
      listę i wracają na stronę 1; zmiana „na stronę” też wraca na 1; po wysłaniu nowego zgłoszenia lista
      pokazuje stronę 1 z tym zgłoszeniem.
- [ ] Jako EMPLOYEE na swojej stronie pracownika → historia raportów: te same filtry i paginacja działają jak
      wcześniej.
- [ ] Jako ADMIN dodaj przelew z pozycjami ze zeskanowanej faktury (przycisk skanu i przeciągnięcie pliku na
      oba tryby): pozycje powstają, suma pod listą się zgadza, wybór kategorii/pracownika w wierszu działa.
- [ ] Jako ADMIN w trybie paragonów: suma zaznaczonych pozycji w stopce zgadza się z zaznaczeniem.
- [ ] Jako ADMIN edytuj przelew i wyczyść formularz przyciskiem resetu; „Rozlicz wypłaty” zapisuje się jak
      wcześniej (oba formularze mają teraz wspólną obudowę).
- [ ] Na koncie z językiem ukraińskim/rosyjskim → „Zgłoszenia wydatków”: daty wysłania i decyzji w formacie
      tego języka (wcześniej zawsze polskim).
- [ ] Przełącznik lista/karty przelewów i skala UI działają jak wcześniej.
- [ ] Bez logowania: logowanie i „Nie pamiętam hasła” działają.
- [ ] Inwestycja → „Kosztorys” (przycisk arkusza), „Umowa” i Podsumowanie → „Marża” otwierają się jak wcześniej;
      `/kasa` → wykres salda kasy rysuje się.
- [ ] Leady → zaznaczanie zdjęć w „Zdjęcia” i przy przenoszeniu do inwestycji, zaznaczanie wierszy listy leadów.
- [ ] Raport pracownika (kosztorys) → menu kolumn: zaznaczanie pozycji nie zamyka menu.
- [ ] Nowy pracownik dodany przez „Dodaj pracownika” ma język polski.

## 2026-10-19 — app-audit-refactor faza 7 — bez ręcznych memo w tabelach i hookach

Refaktor bez zmiany zachowania.

- [ ] Jako ADMIN w tabelach „Katalog prac”, „Sprzęt”, „Flota”, „Pracownicy”, „Inwestycje” i „Kasy”: wyszukiwanie
      i filtry zawężają listę jak wcześniej, pisanie w polu wyszukiwania nie zacina się (zwłaszcza w „Katalogu prac”).
- [ ] Jako ADMIN przełącz aktywność pracownika i kasy: przełącznik zmienia się od razu, bez mignięcia, a
      ustawione filtry zostają.
- [ ] Jako ADMIN ustaw filtr statusu w „Inwestycjach” i warunki w „Katalogu prac”, zwiń pasek boczny i odśwież
      stronę: filtry i zwinięty pasek zostają.
- [ ] Formularz przelewu → pole „Kasa”: „tylko aktywne” przełącza listę, wybrana nieaktywna kasa dalej widoczna;
      błąd walidacji pod polem pokazuje się jak wcześniej.
- [ ] Arkusze → „Kosztorysy” i „Inwestycje bez arkusza” wyświetlają się i wyszukują; kosztorys → „Porównaj z
      katalogiem prac” pokazuje podpowiedzi „może chodzi o…”, import z arkusza otwiera podgląd.

## 2026-10-19 — app-audit-refactor faza 8 — edytor kosztorysu rozbity na części

Refaktor bez zmiany zachowania; edytor wcześniej nie był optymalizowany przez kompilator Reacta, teraz jest.

- [ ] Jako ADMIN na dużym kosztorysie (~1000 pozycji): pisanie w komórce, cofnij/ponów wklejenie kilku komórek
      i przewijanie działają bez widocznego przycinania w porównaniu ze stagingiem sprzed zmiany.
- [ ] Jako ADMIN: dodaj, przesuń i usuń sekcję, dodaj pozycję z katalogu, zmień ilości w etapach i ustaw rabat
      globalny — sumy i „Pozostało” aktualizują się i zostają po odświeżeniu.
- [ ] Jako ADMIN przełącz na historię, widok raportu pracownika i podgląd oferty, a potem wróć — nagłówek podglądu
      (logo, nazwa inwestycji, przyciski) wygląda jak wcześniej.
- [ ] Pusty kosztorys pokazuje „Kosztorys jest pusty” z przyciskiem „Pobierz z arkusza Google…”; wyszukiwanie bez
      wyników pokazuje „Wyczyść wyszukiwanie”, a filtr ukrywający wszystko — „Wyczyść filtry”.
- [ ] Menu akcji kosztorysu: zapis presetu, porównanie z arkuszem, skan raportu, uzupełnienie tłumaczeń, czyszczenie
      tekstów pozycji, akcje pracownika i inwestora oraz „Zmień kolejność” i „Dodaj z katalogu” otwierają się jak wcześniej.
- [ ] Wysokość wierszy: przeciągnięcie krawędzi wiersza, dwuklik „dopasuj do treści” i przełączenie rozmiaru tekstu
      zmieniają wysokość jak wcześniej; wiersz „do ponownego sprawdzenia” ma dwie linie.
- [ ] Jako MANAGER ten sam edytor nie pokazuje kwot.
- [ ] Jako ADMIN na 390 px edytor się wyświetla, przewija i przyjmuje edycję komórki.

## 2026-10-19 — app-audit-refactor — preview brancha vs staging (luki z listy ryzyk)

Porównanie: preview brancha `app-audit-refactor-wt` obok wdrożonego stagingu, ta sama baza preview. Boksy
faz 1–8 wyżej sprawdzasz w tym samym przebiegu; tu tylko to, czego tam nie ma.

- [x] Duży kosztorys (~1000 pozycji), ta sama inwestycja na obu: seria wpisów w Przedmiar, Pomiar i etap —
      czas od klawisza do odmalowania nie gorszy niż na stagingu (pomiar w przeglądarce, nie na oko).
      _Zweryfikowano 2026-10-19 (aa1da3b6d, inw. 7, 1000 pozycji): 3 pary staging/preview na przemian, 27
      klawiszy na kolumnę, czas do drugiej klatki. Mediana Przedmiar 48,8–49,0 ms na obu, Etap 1 48,7–49,1 ms
      preview / 48,8–62,2 ms staging; p90 65–83 ms na obu. Pomiar z natury to suma etapów, więc wpis w etap
      sprawdza też jego przeliczenie. Wartości przywrócone._
- [x] `/katalog-prac` i listy (sprzęt, flota, inwestycje, użytkownicy): szybkie wpisywanie w wyszukiwarkę —
      znaki pojawiają się bez opóźnienia, tak samo jak na stagingu.
      _Zweryfikowano 2026-10-19 (aa1da3b6d): 27 klawiszy na przebieg, czas do drugiej klatki, staging/preview
      na przemian. Mediany: sprzęt 32,0–32,4 / 32,4, flota 32,1–32,3 / 32,6–37,4, inwestycje 32,6–32,9 /
      32,5–32,9, pracownicy 31,8–32,2 / 32,3–32,7 ms (staging / preview). Katalog: przy kolejności S→P
      preview wychodził ~4 ms wolniej; przy odwróconej kolejności różnica znika (preview 39–64, staging
      37–58 ms, p90 preview niższy w 3 z 4 par) — efekt kolejności, ścieżka katalogu poza importami bez
      zmian._
- [ ] Edytor: wpisz liczbę, od razu wklej kilka komórek, cofnij i ponów — każda wartość ląduje w swoim wierszu,
      cofnięcie przywraca dokładnie stan sprzed wklejenia.
- [ ] Edytor otwarty w dwóch kartach: usuń pozycję w jednej, edytuj ją w drugiej — komunikat, że pozycji nie ma,
      bez błędu serwera.
- [ ] Jako OWNER spróbuj dezaktywować własne konto i ostatniego OWNER-a — odmowa; logowanie kontem
      nieaktywnym — odrzucone.
- [ ] Inwestycja: oznacz jako zakończoną (pojawia się data zakończenia), odblokuj status; inwestycja w Koszu nie
      daje się edytować.
- [ ] Usunięcie pliku, który jest fakturą transakcji — odmowa.
- [ ] Jako ADMIN na `/zgloszenia-wydatkow`: otwórz ponownie odrzucone zgłoszenie — wraca do decyzji, licznik
      w menu zmienia się bez odświeżania.
- [ ] Listy z sortowaniem (Transakcje, Leady, Zgłoszenia): posortuj, przejdź na stronę 2 — sortowanie zostaje
      w adresie i w kolejności.
- [ ] Tabele z fazy 7 i pole „Kasa” w formularzu przelewu: w zakładce sieci nie ma powtarzających się w kółko
      zapytań, strona nie miga sama z siebie.
- [ ] Edycja przelewu i „Rozlicz wypłaty”: błąd walidacji pokazuje się pod polem, udany zapis zamyka okno.
- [ ] Po najbliższym przebiegu crona czyszczenia wersji kosztorysu: w logach Vercela przebieg bez błędu.

## 2026-10-19 — app-audit-refactor — poprawki z bramki przeglądu

- [ ] Formularz wydatków z kilkoma pozycjami: przy pozycji wybierz kategorię „Inne” i pracownika — drugi rząd
      wyboru pojawia się i zapisuje jak wcześniej (przeniesienie kodu, bez zmiany działania).
- [ ] Pusty kosztorys w edytorze: widać podpowiedź na pustej siatce; w wypełnionym wpisanie wartości i cofnięcie
      błędnej zmiany działa jak wcześniej.
- [ ] Jako EMPLOYEE otwórz `/kasa/{id}` swojej kasy — trafiasz na swoją stronę pracownika, nie na 404.

## 2026-10-19 — kursor na statusie inwestycji

- [ ] „Edytuj inwestycję” i tabela inwestycji: najechanie na status („Aktywna” ze strzałką) pokazuje
      rączkę; w trakcie zapisu zmiany statusu kursor jest zablokowany.

## 2026-10-19 — szerszy dialog „Szczegóły" leada

- [ ] Leady → „Szczegóły" przy zgłoszeniu z długą wiadomością: okno jest szerokie, etykiety w wąskiej
      kolumnie po lewej, wiadomość zajmuje resztę szerokości; podziały linii z formularza zostają.
- [ ] To samo zgłoszenie z załącznikami: miniatury są ostre, nie rozmyte.

## 2026-10-19 — payout-cards — wypłaty pracownika jako karty, wspólny badge

- [ ] Jako pracownik (EMPLOYEE) na swojej stronie z wypłatą czekającą na potwierdzenie: sekcja
      „Wypłaty do potwierdzenia” jest zwijana, domyślnie rozwinięta i stoi pod przyciskami szybkich
      akcji. Karta ma u góry nazwę inwestycji po lewej i datę po prawej, w drugim wierszu kwotę po
      lewej i status po prawej (bez pustej przerwy pod nagłówkiem), niżej opis, na dole
      „Potwierdzam” i czerwone „Odrzuć” równej szerokości.
- [ ] Jako pracownik odrzuć wypłatę z powodem: znika z „Wypłat do potwierdzenia” i pojawia się w
      osobnej sekcji „Odrzucone wypłaty” z opisem o wyjaśnieniu z kierownikiem i twoim powodem; ma
      tylko „Potwierdzam”, które dalej działa.
- [ ] Jako pracownik na telefonie (390 px): karty wypłat zajmują całą szerokość, przyciski są łatwe
      do trafienia, nic nie wychodzi poza ekran.
- [ ] Badge'e wyglądają jak dotąd (refaktor na wspólny komponent): status wypłaty w tabeli transakcji,
      „Od pracownika” w kolumnie typu, status inwestycji (odrzucona — teraz czerwona zamiast różowej),
      rola na `/uzytkownicy` i w menu mobilnym, źródło na `/leady`, statusy pojazdów i sprzętu,
      postęp AI na liście inwestycji, statusy zgłoszeń wydatków i raportów pracy.
- [ ] Zielone badge'e (zaakceptowana wypłata, aktywna inwestycja, rola pracownika, aktywny pojazd)
      są teraz morskie, a nie szmaragdowe; tekst czytelny w jasnym i ciemnym motywie.
- [ ] Strona inwestycji → select etapu AI: obrys i kolor tekstu dalej zmieniają się z etapem (jak
      kolor badge'a tego etapu na liście inwestycji); „Uzupełnianie informacji” ma zwykły szary obrys.
- [ ] Karty przelewów: chipy „Kasa:”, „Pracownik:”, „Kategoria:” itd. wyglądają jak dotąd —
      kolorowy obrys, zwykła grubość tekstu, długa wartość ucina się wielokropkiem.
- [ ] Anuluj odrzuconą wypłatę pracownika: na jego stronie znika z kart „Odrzucone wypłaty”, a w
      „Liście wydatków / zaliczek” jest (przekreślona, wyszarzona) bez żadnego przełącznika; to samo
      widzi menedżer na tej stronie. Suma przy filtrze nie dolicza anulowanych.
- [ ] Strona pracownika z wypłatami → „Lista wydatków / zaliczek” ma filtr „Potwierdzenie” (czeka /
      potwierdzona / odrzucona) i zawęża listę do wypłat w tym stanie; pracownik bez wypłat go nie ma.
- [ ] Karty przelewów (telefon, lista wypłat pracownika): status wypłaty stoi w tej samej linii co
      badge „Wypłata”, przy prawej krawędzi; nagłówek karty to dalej numer i data.
- [ ] `/uzytkownicy`: status „Aktywny” / „Nieaktywny” to zwykły badge (morski / szary); kliknięcie
      przełącza aktywność konta i nie otwiera strony pracownika.
- [ ] `/leady`: „Skontaktowano” / „Oczekuje” przełącza się kliknięciem jak dotąd.
- [ ] Kasy: kasę, którą możesz zmieniać, przełączasz kliknięciem w status; przy cudzej kasie status
      jest nieklikalny.
- [ ] Przycisk „Wpłata” wygląda jak dotąd (zielony obrys, wypełnia się po najechaniu).
- [ ] Typ przelewu w tabeli i na kartach przelewów: obrys i kropka w kolorze typu, nazwa ucina się
      wielokropkiem; rozliczony przelew ma kolor rozliczenia.
- [ ] Raport pracy: nazwa sekcji obok kolorowego paska ma tło i tekst w kolorze tej sekcji, czytelne
      w jasnym i ciemnym motywie.
- [ ] Filtr statusów linii (zaakceptowane / odrzucone / oczekujące) w zgłoszeniu wydatku: kliknięcie
      chowa i pokazuje linie, ukryty status jest przekreślony.

## 2026-10-19 — rejected-payouts-table — odrzucone wypłaty na pulpicie, bez strony „Wypłaty”

- [ ] Jako OWNER na „Transakcje”, gdy pracownik odrzucił wypłatę: sekcja „Wypłaty odrzucone przez
      pracowników” jest zwijana, pod tytułem ma „Takie wypłaty trzeba wyjaśnić z pracownikiem lub
      anulować.”, tabela zaczyna się kolumną „Anuluj”, a nagłówki i komórki są wyrównane do lewej.
- [ ] W tej tabeli ID, pracownik, inwestycja i kasa to linki: ID otwiera transakcję na liście
      inwestycji (wypłata bez inwestycji — na „Transakcje”); kasa przeniesiona do Kosza nie jest linkiem.
- [ ] „Anuluj” w tej tabeli pyta o powód i anuluje wypłatę: wiersz znika, licznik przy „Transakcje” w
      menu spada o jeden. Przy zakończonej inwestycji przycisk jest wyszarzony z podpowiedzią.
- [ ] W menu nie ma pozycji „Wypłaty”, a adres `/wyplaty` pokazuje „Nie znaleziono”. Na „Transakcje”
      filtr statusu potwierdzenia zawęża listę do wypłat o wybranym statusie.

## 2026-10-19 — cancel-rejected-payout — odrzuconą wypłatę anuluje każdy z zarządu

- [ ] Jako MANAGER: wypłata zaksięgowana przez innego kierownika albo właściciela i odrzucona przez
      pracownika → „Anuluj” na pulpicie anuluje ją bez „Nie masz uprawnień do anulowania tej
      transakcji.”, a saldo kasy wraca o tę kwotę.
- [ ] Jako MANAGER na „Transakcje”: przy cudzej wypłacie oczekującej lub przyjętej i przy cudzym
      wydatku nie ma „Anuluj”; przy swoich transakcjach i przy cudzej robociźnie jest.
- [ ] Jako MANAGER przy cudzej odrzuconej wypłacie edycja dalej jest niedostępna.

## 2026-10-19 — payout-card-buttons — przyciski karty wypłaty i warianty kolorów

- [ ] Pracownik, `/pracownicy/[id]` z wypłatą oczekującą: „Potwierdzam” jest zielony obramowany z
      ptaszkiem, „Odrzuć” czerwony obramowany z koszem; po najechaniu oba wypełniają się kolorem.
- [ ] Odrzucona wypłata na karcie pracownika pokazuje „Powód odrzucenia: …” (uk/ru: przetłumaczone).
- [ ] Na telefonie (390 px) „Dodaj wydatek” / „Zgłoś pracę” są niższe niż dotąd, a dłuższa etykieta
      uk/ru dalej się zawija, bez wychodzenia poza wiersz.
- [ ] Przyciski „Wpłata”, „Wydatek”, „Kasa” w pasku i „Wyczyść” w formularzu wyglądają jak dotąd
      (obramowane w swoim kolorze).

## 2026-10-19 — cards-hide-table-controls — „Kolumny” i „Szukaj duplikatów” tylko w widoku tabeli

- [ ] Transakcje → widok kart: nie ma przycisków „Kolumny” ani „Szukaj duplikatów”; po powrocie do
      widoku tabeli oba są na miejscu.
- [ ] Ukryj w tabeli kolumnę „Kasa źródłowa”, przełącz na karty: karty dalej pokazują „Kasa źródłowa: …”.
- [ ] Strona pracownika w widoku kart: brak etykiety „Pracownik”, jak dotąd.

## 2026-10-19 — slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty

- [ ] Jako MANAGER „Dodaj kasę” z innym managerem jako właścicielem: komunikat „Brak uprawnień”, kasa
      nie pojawia się na `/kasy`. Z pracownikiem jako właścicielem kasa powstaje.
- [ ] Jako MANAGER edytuj kasę pracownika i ustaw siebie jako właściciela: zapis działa, po odświeżeniu
      właścicielem jesteś ty. Ustawienie innego managera kończy się „Brak uprawnień”.
- [ ] Jako OWNER „Dodaj kasę” i edycja kasy z dowolnym właścicielem działają jak dotąd.
- [ ] `/transakcje` w tabeli i na kartach: kwoty mają te same kolory co dotąd (wydatek, wpływ,
      wypłata), anulowane są szare.
- [ ] Kosztorys → nagłówek sekcji: kropka ma kolor paska sekcji.
- [ ] Pulpit → odrzucone wypłaty: przy wypłacie z zablokowanej inwestycji „Anuluj transakcję” jest
      wyszarzone z dymkiem o blokadzie; numer ID otwiera tę transakcję.
- [ ] Jako pracownik (EMPLOYEE) wpisz adres `/warianty-badge`: strona się nie otwiera.

## 2026-10-19 — investment-notes-save — zapis notatki nie czyści adresu inwestycji

- [ ] Inwestycja z wpisanym kodem pocztowym, miastem i krajem → „Edytuj notatkę”, zmień tekst,
      „Zapisz”: notatka się zmienia, a po odświeżeniu „Edytuj inwestycję” wciąż pokazuje kod
      pocztowy, miasto i kraj.
- [ ] Ta sama zmiana notatki z zakładki inwestycji w podsumowaniu kosztorysu: zapis działa, adres
      zostaje.

## 2026-10-19 — big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy

- [ ] Po restarcie `pnpm dev` `/inwestycje`, strona inwestycji i `/pracownicy` ładują się bez błędu
      „column does not exist”.
- [ ] „Edytuj pracownika” → wpisz „Telefon” → otwórz ponownie: numer zostaje.
- [ ] Strona inwestycji → „Kierownik budowy” → wybierz konto → odśwież: wybór zostaje, a adres, kod
      pocztowy i miasto bez zmian.
- [ ] Jako OWNER w dialogu zamówienia: zębatka (prawy dolny róg, obok „Dalej”) → „Ustawienia zamówień”
      → dodaj dwóch dostawców, zmień cenę → zapisz (przycisk „Zapisz” po prawej, bez „Wyczyść
      formularz”). Cena w dialogu zamówienia od razu się zmienia. Jako MANAGER zębatki nie ma.
      `/inwestycje` i sidebar nie mają już ustawień zamówień.
- [ ] Strona inwestycji → „Kontener” → kontener × 2 → „Dalej”: formularz pokazuje „2 × kontener”,
      3000 zł, „Materiały budowlane” / „kontener”. Zapisz — bez pytania o brak faktury → otwiera się
      SMS z adresem bez kraju oraz kontaktem wybranym w pierwszym kroku.
- [ ] Dialog zamówienia: tytuł ma pod spodem nazwę inwestycji; zmiana „Cena za sztukę” przelicza
      „Kwota”, a przełączenie big bag / kontener wraca do ceny z ustawień. Przełącznik, pola, „Dalej”
      i zębatka mają jedną wysokość.
- [ ] Dialog zamówienia → ilość 3, wybierz kontakt → zębatka → zmień cenę big bagu → „Zapisz”: cena
      w dialogu się zmienia, ilość i kontakt zostają.
- [ ] Dialog zamówienia → „Cena za sztukę” `0,001` albo `1e3`: „Dalej” nieaktywne.
- [ ] Dialog zamówienia → „Kontakt na miejscu” → wybierz inną osobę → gwiazdka „Ustaw jako kierownika
      budowy” → strona inwestycji po odświeżeniu pokazuje ją jako „Kierownik budowy”.
- [ ] Wydatek big bag / kontener dodany ręcznie (zwykły formularz wydatku, bez faktury) nadal pyta o
      brak faktury.
- [ ] W kroku SMS „Zapisz jako domyślnego dostawcę” przy innym dostawcy → następne zamówienie wybiera
      go od razu.
- [ ] Z telefonu (IP w sieci LAN): „Wyślij SMS” otwiera Wiadomości z domyślnym dostawcą i treścią.
- [ ] `/inwestycje` → „Akcje” przy aktywnej inwestycji ma przycisk zamówienia; zakończona go nie ma.
- [ ] Inwestycja bez kierownika budowy: kontakt „— brak —”, a treść SMS-a nie ma linii „Kontakt na
      miejscu”.
- [ ] Transakcje inwestycji → wiersz zamówienia pokazuje „Czeka” → klik → „Dostarczone” → odśwież:
      zostaje. Klik ponownie → „Czeka”.
- [ ] Anuluj transakcję zamówienia: znaczek jest wyszarzony i nieklikalny.
- [ ] Oznacz inwestycję jako zakończoną: na jej liście transakcji, w „Tabela” i „Karty”, znaczek jest
      widoczny, ale nieklikalny.
- [ ] Jako EMPLOYEE na własnym `/pracownicy/[id]`, jeśli widać wiersz zamówienia: bez przycisku.
- [ ] Druk tabeli transakcji: kolumna „Zamówienie” drukuje „Czeka” / „Dostarczone”.
- [ ] Karty list odbiorców powiadomień (np. w „Zgłoszenia”, „Sprzęt”, „Flota”) wyglądają jak wcześniej, a „Edytuj
      listę” dalej zapisuje adresy (wspólna obudowa karty z kartą zamówień — bez zmiany wyglądu).
- [ ] Zamówienie 3 big bagów przy cenie z groszami (np. 799,99 zł): „Kwota” to dokładnie 2399,97.
- [ ] Ekran „Transakcje” (konto zarządu): nie ma już przycisku „Wyślij wiadomość (test)”.
- [ ] Strona inwestycji: w nagłówku nie ma „Dodaj” (kosztorys v1); przycisk v2 nazywa się „Kosztorys
      v2”. Inwestycja bez kosztorysu v1 nadal da się go dodać z `/kosztorysy` → „Dodaj kosztorys”.
- [ ] Strona inwestycji: Adres, Osoba kontaktowa, Etap AI, Kierownik budowy, status, Notatki, Uwagi AI
      i Zdjęcia i pliki stoją w jednym bloku z równymi odstępami; etykiety są wyśrodkowane względem
      selectów. Strony sprzętu, kasy, pracownika i floty — listy informacji wyglądają porządnie.
- [ ] Dowolny select w aplikacji: strzałka ma ten sam szary co strzałka „Notatki”.

## EX-1118 — user-register-stats — „Moje Kasy” po właścicielu kasy, nie po imieniu

- [ ] Panel kierownika: „Moje Kasy” / „Saldo moich kas” pokazuje dokładnie kasy, których zalogowany
      jest właścicielem — także gdy inne konto ma takie samo imię i nazwisko (jego kasy się nie pojawiają).
- [ ] Edytor kosztorysu → podsumowanie → „Podwykonawcy” (inwestycja z wypłatą dla podwykonawcy): sekcja
      nad tabelą wypłat nazywa się „Lista wypłat”.
- [ ] Lista transakcji: kasa źródłowa i docelowa linkują do `/kasa/[id]`; kasa w koszu i „—” nie są
      linkami (zachowanie jak przed refaktorem).
- [ ] Konto z językiem ukraińskim lub rosyjskim: „Wyczyść filtry” (lista i kolejka), „Nie znaleziono.”
      w wyszukiwanych selectach, dialog akceptacji zgłoszenia wydatków (tytuł, „Odrzuć”, potwierdzenie
      odrzucenia, toasty) są przetłumaczone; po polsku wyglądają jak wcześniej.
- [ ] To samo konto: w zgłoszeniu z odczytanymi paragonami przyjmij jeden paragon, potem odrzuć dwa —
      toasty („Paragon przyjęty”, „Odrzucono 2”) są przetłumaczone; zapis zwykłego formularza wydatku
      pokazuje przetłumaczone „Transakcje dodane”.
- [ ] Lista transakcji: inwestycja linkuje do `/inwestycje/[id]`, pracownik do `/pracownicy/[id]`; „—”
      nie jest linkiem. „Wyczyść filtry” nad listą transakcji działa i (uk/ru) jest przetłumaczone.

## 2026-10-19 — payout-push-unpause — push „Wypłata do potwierdzenia” włączony

- [ ] (tylko produkcja) Telefon z zainstalowaną aplikacją i włączonymi „Powiadomieniami”, aplikacja
      zamknięta: zaksięguj wypłatę na to konto z komputera → na telefonie przychodzi powiadomienie
      „Wypłata do potwierdzenia” z kwotą, a na ikonie aplikacji licznik rośnie o 1.
- [ ] Stuknięcie w to powiadomienie otwiera stronę pracownika z wypłatą do potwierdzenia; po
      potwierdzeniu licznik na ikonie znika.

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
