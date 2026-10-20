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

- [ ] Inne ekrany z loaderem (logowanie, filtry transakcji, zapis formularza) wyglądają jak dotąd —
      🚧 dalej podskakuje.

## 2026-10-15 — staging-sweep-review — siatka kosztorysu po odmowie „Ustaw kolejność” + porządki

- [ ] Kosztorys → „Importuj z arkusza” i „Ustaw kolejność” działają jak wcześniej (porządki bez
      zmiany zachowania): import podmienia pozycje, kolejność zapisuje się po odświeżeniu strony.
      _Staging 2026-10-18 (pass 10): Ustaw kolejność: zapis kolejności przetrwał przeładowanie strony (OK). Importuj z arkusza NIE zweryfikowane — #213 nie ma powiązanego arkusza, a dodanie kosztorysu v1 z kanonicznym arkuszem nie utworzyło wiersza; import podmieniłby kosztorys realnej inwestycji. HUMAN: arkusz czytelny dla staging SA._

## szablon-own-structure — szablon jako odwołania do katalogu prac

- [ ] Ładowarka kosztorysu AI na szablonie (lokalnie): pozycje w brzmieniu katalogu, bez duplikatów.
      _Staging 2026-10-18 (pass 10): needs human: wymaga lokalnego uruchomienia ładowarki AI (scripts/ai-kosztorys, repo ../wykonczymy-ai-cases) — nie przeglądarkowe, nie na staging._
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
- [ ] PDF z Safari dla kosztorysu na 2+ strony: żaden wiersz nie jest rozcięty (opis na jednej
      stronie, kwoty na drugiej) — wiersz, który się nie mieści, przechodzi w całości na następną.
      _Staging 2026-10-18 (pass 10): HUMAN: Safari/WebKit + prawdziwy podgląd wydruku_
## transfer-actions-db-spec — anulowanie i edycja kwoty zapisują się razem z wpisem w historii

- [ ] Anuluj wydatek materiałowy inwestycji podpiętej do arkusza: jego wiersz znika z arkusza jak
      dotąd.
      _Staging 2026-10-18 (pass 10): NIE do zrobienia na stagingu: zapis do arkusza właściciela jest z założenia zablokowany poza produkcją (konto Viewer, AGENTS.md → Hard Stops), więc „wiersz znika z arkusza” nie jest obserwowalny; samo anulowanie wydatku materiałowego zweryfikowano w boksie powyżej. needs human: tylko produkcja._
## 2026-10-18 — kosz-plikow — usunięte pliki trafiają do Kosza na 7 dni

Zamiatacz kasuje dopiero po siedmiu dniach, więc boksy o kasowaniu wymagają cofnięcia daty usunięcia
na bazie testowej albo powrotu za tydzień — to kształt sprawdzenia, nie blokada.

- [ ] Plik w Koszu dłużej niż 7 dni: po wywołaniu `/api/cron/cleanup` znika z Kosza i z Bloba, a
      odpowiedź niesie krok `media` z rozbiciem `{ recorded, healed, deleted, failed }`; drugie
      wywołanie pod rząd kasuje zero.
      _Staging 2026-10-18 (pass 10): needs human: niszczący cron czyszczący (/api/cron/cleanup kasuje z Bloba) — poza zakresem agenta; wymaga cofnięcia daty usunięcia na bazie testowej i uruchomienia crona przez człowieka._
- [ ] Paragon w zgłoszeniu wydatku pracownika i zdjęcie w zgłoszeniu prac przeżywają przebieg crona
      nietknięte.
      _Staging 2026-10-18 (pass 10): needs human: wymaga przebiegu crona /api/cron/cleanup (niszczący, poza zakresem agenta)._
- [ ] „Usuń na zawsze" przy inwestycji, szablonie i zgłoszeniu w Koszu wygląda i działa jak dotąd:
      ta sama notka w oknie, wymaga wpisania nazwy (przebudowa okna — bez zmiany zachowania).
      _Staging 2026-10-18 (pass 10): inwestycja (213: okno z notką o kosztorysie, przedmiarze, zdjęciach i linku dla inwestora, przycisk nieaktywny do wpisania nazwy) i szablon (okno „Kosztorysy założone z tego szablonu zostają bez zmian…”, wpis nazwy) — OK, oba usunięte; część ze zgłoszeniem (lead) niewykonana — needs human: nieodwracalne, jedyny rekord „Test Test”._
- [ ] Zgłoszenie, które wcześniej straciło plik do Kosza, usunięte na zawsze: plik znika też z
      sekcji „Pliki".

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

## 2026-10-18 — mobile-375-qa — poprawki widoków na telefonie (375 px)

- [ ] Telefon → raporty pracowników: „Skanuj raport (AI)” mieści się w ekranie na pełną szerokość;
      katalog prac → „Uzupełnij tłumaczenia (AI)” tak samo.
      _Staging 2026-10-19 (pass 11), 375 px: /zgloszenia-prac — przycisk (dziś „Wczytaj zgłoszenie z kartki (AI)”) ma 343 px od lewej 16 = pełna szerokość. „Uzupełnij tłumaczenia (AI)” w /katalog-prac nie renderuje się, bo wszystkie 582 pozycje mają tłumaczenia (count = 0) — needs human: sprawdzić na katalogu z nieprzetłumaczoną pozycją._
## 2026-10-18 — prepush-overlap — testy w hooku pre-push równolegle

- [ ] Następny prawdziwy `git push`: najpierw nagłówek „unit tests + typecheck + DB integration specs,
      parity (in parallel)”, potem trzy sekcje z wynikami („DB integration specs + parity” ostatnia)
      i zrzut bazy. Część testowa trwa ok. 70–80 s zamiast ok. 100 s (dłużej, gdy przebudowuje się
      szablon bazy testowej).
- [ ] Push z celowo zepsutym typem: hook się zatrzymuje, kończy linią „✗ pre-push FAILED at:
      typecheck”, a zrzut bazy się nie uruchamia.

## 2026-10-18 — e2e-run-speed — E2E bez zbędnego buildu, na świeżej bazie

- [ ] Następny pełny `pnpm test:e2e`: na początku „test DB: cloned from template”, potem build bez
      sprawdzania typów, i cały przebieg przechodzi.
- [ ] Drugi `pnpm test:e2e` bez zmian w `src/` (zmieniony tylko spec): w logu „e2e build: reused”,
      serwer startuje w kilka sekund, a wyniki są takie same.

## 2026-10-19 — app-audit-refactor faza 1 — przeniesione komponenty wyglądają i działają jak dotąd

Sprawdź jako ADMIN, potem jako MANAGER. Refaktor bez zmiany zachowania: nic nie ma wyglądać inaczej.

- [ ] `/pracownicy`: kolorowe plakietki ról w tabeli jak dotąd; na telefonie (390 px) plakietka roli w
      menu.
- [ ] Dowolny formularz w oknie (np. „Dodaj kasę”): otwiera się, zapis zamyka okno, a z zaznaczonym
      „Nie zamykaj po zapisaniu” zostaje otwarte; w trakcie zapisu widać pigułkę z postępem.
      _Staging 2026-10-19 (desktop-regression-audit, MANAGER): „Dodaj kasę” z zaznaczonym „Nie zamykaj…”
      — „Kasa dodana”, okno zostaje i czyści się. Zwykły zapis z pigułką — do sprawdzenia jako OWNER._
- [ ] Dowolny formularz w oknie (np. „Dodaj kasę” z właścicielem, którego nie wolno ustawić): po
      odrzuconym zapisie okno wraca z wpisanymi danymi i nadal ma „Nie zamykaj po zapisaniu”.
## 2026-10-19 — app-audit-refactor faza 2 — dostęp do kas, synchronizacja arkusza, saldo zero

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
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): pojazd: oba komunikaty (toasty) OK; sprzęt i e-mail pracownika niesprawdzone._
- [ ] Jako MANAGER: typ kasy na `/kasy`, w formularzu kasy i na wykresie sald na pulpicie brzmi tak
      samo („Główne”, „Pomocnicze”, „Wirtualne”, „Pracownicze”).
      _Staging 2026-10-19 (desktop-regression-audit): `/kasy` — „Pomocnicze”, „Pracownicze”, „Wirtualne”
      ✓. Formularz kasy MANAGER-a nie ma pola „Typ” (zamierzone) — formularz i wykres do sprawdzenia jako
      OWNER._
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): formularz kasy OWNER-a ma „Typ” z czterema nazwami; wykres na pulpicie jeszcze niesprawdzony._
- [ ] Jako ADMIN wydrukuj listę transakcji, ofertę i umowę: logo i układ jak dotąd, okno zamyka się
      po druku.
- [ ] Jako ADMIN zeskanuj paragon i papierowe zgłoszenie prac, przetłumacz opis pozycji kosztorysu —
      wynik taki jak dotąd.

## 2026-10-19 — app-audit-refactor faza 4 — zgłoszenia wydatków, raporty prac, edytor kosztorysu

- [ ] Jako ADMIN na `/zgloszenia-wydatkow`: zaakceptuj zgłoszenie, scal dwa zgłoszenia jednego
      pracownika i odrzuć paragony z trzeciego — kwoty i decyzje przy paragonach zostają po odświeżeniu.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): akceptacja i odrzucenie OK; scalenie niesprawdzone (odmowa dla niepasujących zgłoszeń działa)._
- [ ] Jako ADMIN otwórz podgląd zgłoszenia prac i stronę zgłoszenia z linku pracownika na telefonie
      (390 px) — te same pozycje, kwoty i zdjęcia co dotąd.
- [ ] Jako ADMIN i jako MANAGER w edytorze kosztorysu: dodaj, zmień nazwę i usuń dział, dodaj pozycję
      na końcu działu i pod wskazaną pozycją, zmień etap i ustawienia inwestycji, przywróć wersję —
      wszystko zostaje po odświeżeniu.
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
- [ ] Inwestycja → „Kosztorys” (przycisk arkusza), „Umowa” i Podsumowanie → „Marża” otwierają się jak wcześniej;
      `/kasa` → wykres salda kasy rysuje się.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): „Kosztorys”, „Umowa”, „Marża” otwierają się; wykres salda `/kasa` niesprawdzony._
- [ ] Raport pracownika (kosztorys) → menu kolumn: zaznaczanie pozycji nie zamyka menu.
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
- [ ] Wysokość wierszy: przeciągnięcie krawędzi wiersza, dwuklik „dopasuj do treści” i przełączenie rozmiaru tekstu
      zmieniają wysokość jak wcześniej; wiersz „do ponownego sprawdzenia” ma dwie linie.
- [ ] Jako ADMIN na 390 px edytor się wyświetla, przewija i przyjmuje edycję komórki.

## 2026-10-19 — app-audit-refactor — preview brancha vs staging (luki z listy ryzyk)

Porównanie: preview brancha `app-audit-refactor-wt` obok wdrożonego stagingu, ta sama baza preview. Boksy
faz 1–8 wyżej sprawdzasz w tym samym przebiegu; tu tylko to, czego tam nie ma.

- [ ] Edytor: wpisz liczbę, od razu wklej kilka komórek, cofnij i ponów — każda wartość ląduje w swoim wierszu,
      cofnięcie przywraca dokładnie stan sprzed wklejenia.
- [ ] Edytor otwarty w dwóch kartach: usuń pozycję w jednej, edytuj ją w drugiej — komunikat, że pozycji nie ma,
      bez błędu serwera.
- [ ] Jako OWNER spróbuj dezaktywować własne konto i ostatniego OWNER-a — odmowa; logowanie kontem
      nieaktywnym — odrzucone.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): własne konto — odmowa; ostatni OWNER i logowanie nieaktywnym kontem niesprawdzone._
- [ ] Inwestycja: oznacz jako zakończoną (pojawia się data zakończenia), odblokuj status; inwestycja w Koszu nie
      daje się edytować.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): data zakończenia i odblokowanie OK; inwestycja w Koszu niesprawdzona._
- [ ] Usunięcie pliku, który jest fakturą transakcji — odmowa.
- [ ] Listy z sortowaniem (Transakcje, Leady, Zgłoszenia): posortuj, przejdź na stronę 2 — sortowanie zostaje
      w adresie i w kolejności.
- [ ] Edycja przelewu i „Rozlicz wypłaty”: błąd walidacji pokazuje się pod polem, udany zapis zamyka okno.
      _Staging 2026-10-19 (desktop-regression-audit, MANAGER): „Rozlicz wypłaty” — błąd walidacji pod
      polem OK; edycja przelewu i udany zapis jeszcze niesprawdzone._
- [ ] Po najbliższym przebiegu crona czyszczenia wersji kosztorysu: w logach Vercela przebieg bez błędu.

## 2026-10-19 — app-audit-refactor — poprawki z bramki przeglądu

- [ ] Pusty kosztorys w edytorze: widać podpowiedź na pustej siatce; w wypełnionym wpisanie wartości i cofnięcie
      błędnej zmiany działa jak wcześniej.
## 2026-10-19 — kursor na statusie inwestycji

- [ ] „Edytuj inwestycję” i tabela inwestycji: najechanie na status („Aktywna” ze strzałką) pokazuje
      rączkę; w trakcie zapisu zmiany statusu kursor jest zablokowany.
      _Staging 2026-10-19 (desktop-regression-audit, MANAGER): rączka na statusie w tabeli i w „Edytuj
      inwestycję” ✓; kursor w trakcie zapisu niesprawdzony._

## 2026-10-19 — payout-cards — wypłaty pracownika jako karty, wspólny badge

- [ ] Jako pracownik na telefonie (390 px): karty wypłat zajmują całą szerokość, przyciski są łatwe
      do trafienia, nic nie wychodzi poza ekran.
- [ ] Badge'e wyglądają jak dotąd (refaktor na wspólny komponent): status wypłaty w tabeli transakcji,
      „Od pracownika” w kolumnie typu, status inwestycji (odrzucona — teraz czerwona zamiast różowej),
      rola na `/uzytkownicy` i w menu mobilnym, źródło na `/leady`, statusy pojazdów i sprzętu,
      postęp AI na liście inwestycji, statusy zgłoszeń wydatków i raportów pracy.
- [ ] Zielone badge'e (zaakceptowana wypłata, aktywna inwestycja, rola pracownika, aktywny pojazd)
      są teraz morskie, a nie szmaragdowe; tekst czytelny w jasnym i ciemnym motywie.
- [ ] Strona pracownika z wypłatami → „Lista wydatków / zaliczek” ma filtr „Potwierdzenie” (czeka /
      potwierdzona / odrzucona) i zawęża listę do wypłat w tym stanie; pracownik bez wypłat go nie ma.
- [ ] Karty przelewów (telefon, lista wypłat pracownika): status wypłaty stoi w tej samej linii co
      badge „Wypłata”, przy prawej krawędzi; nagłówek karty to dalej numer i data.
- [ ] `/uzytkownicy`: status „Aktywny” / „Nieaktywny” to zwykły badge (morski / szary); kliknięcie
      przełącza aktywność konta i nie otwiera strony pracownika.
- [ ] Kasy: kasę, którą możesz zmieniać, przełączasz kliknięciem w status; przy cudzej kasie status
      jest nieklikalny.
- [ ] Przycisk „Wpłata” wygląda jak dotąd (zielony obrys, wypełnia się po najechaniu).
## 2026-10-19 — rejected-payouts-table — odrzucone wypłaty na pulpicie, bez strony „Wypłaty”

- [ ] W tej tabeli ID, pracownik, inwestycja i kasa to linki: ID otwiera transakcję na liście
      inwestycji (wypłata bez inwestycji — na „Transakcje”); kasa przeniesiona do Kosza nie jest linkiem.
- [ ] „Anuluj” w tej tabeli pyta o powód i anuluje wypłatę: wiersz znika, licznik przy „Transakcje” w
      menu spada o jeden. Przy zakończonej inwestycji przycisk jest wyszarzony z podpowiedzią.
## 2026-10-19 — payout-card-buttons — przyciski karty wypłaty i warianty kolorów

- [ ] Na telefonie (390 px) „Dodaj wydatek” / „Zgłoś pracę” są niższe niż dotąd, a dłuższa etykieta
      uk/ru dalej się zawija, bez wychodzenia poza wiersz.
- [ ] Przyciski „Wpłata”, „Wydatek”, „Kasa” w pasku i „Wyczyść” w formularzu wyglądają jak dotąd
      (obramowane w swoim kolorze).

## 2026-10-19 — slice-review-gate — właściciel kasy, kolory kwot, odrzucone wypłaty

- [ ] Jako MANAGER „Dodaj kasę” z innym managerem jako właścicielem: komunikat „Brak uprawnień”, kasa
      nie pojawia się na `/kasy`. Z pracownikiem jako właścicielem kasa powstaje.
- [ ] Jako MANAGER edytuj kasę pracownika i ustaw siebie jako właściciela: zapis działa, po odświeżeniu
      właścicielem jesteś ty. Ustawienie innego managera kończy się „Brak uprawnień”.
- [ ] Pulpit → odrzucone wypłaty: przy wypłacie z zablokowanej inwestycji „Anuluj transakcję” jest
      wyszarzone z dymkiem o blokadzie; numer ID otwiera tę transakcję.
## 2026-10-19 — investment-notes-save — zapis notatki nie czyści adresu inwestycji

- [ ] Ta sama zmiana notatki z zakładki inwestycji w podsumowaniu kosztorysu: zapis działa, adres
      zostaje.

## 2026-10-19 — big-bag-order — zamówienie big bagu / kontenera z SMS-em do dostawcy

- [ ] Po restarcie `pnpm dev` `/inwestycje`, strona inwestycji i `/pracownicy` ładują się bez błędu
      „column does not exist”.
- [ ] W pierwszym kroku „Dostawca” → inny → „Zapisz jako domyślnego dostawcę” → następne zamówienie
      wybiera go od razu. Bez dostawców: krok mówi „Lista dostawców jest pusta”, SMS bez odbiorcy.
      _Staging 2026-10-19 (desktop-regression-audit, OWNER): „Zapisz jako domyślnego dostawcę” działa; stan bez dostawców niesprawdzony._
- [ ] Z telefonu (IP w sieci LAN): „Zapisz” wydatku sam otwiera Wiadomości z dostawcą i treścią.
- [ ] Inwestycja bez kierownika budowy: kontakt „— brak —”, a treść SMS-a nie ma linii „Kontakt na
      miejscu”.
- [ ] Oznacz inwestycję jako zakończoną: na jej liście transakcji, w „Tabela” i „Karty”, znaczek jest
      widoczny, ale nieklikalny.
- [ ] Jako EMPLOYEE na własnym `/pracownicy/[id]`, jeśli widać wiersz zamówienia: bez przycisku.
- [ ] Druk tabeli transakcji: kolumna „Zamówienie” drukuje „Czeka” / „Dostarczone”.
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
- [ ] Konto z językiem ukraińskim lub rosyjskim: „Wyczyść filtry” (lista i kolejka), „Nie znaleziono.”
      w wyszukiwanych selectach, dialog akceptacji zgłoszenia wydatków (tytuł, „Odrzuć”, potwierdzenie
      odrzucenia, toasty) są przetłumaczone; po polsku wyglądają jak wcześniej.
- [ ] To samo konto: w zgłoszeniu z odczytanymi paragonami przyjmij jeden paragon, potem odrzuć dwa —
      toasty („Paragon przyjęty”, „Odrzucono 2”) są przetłumaczone; zapis zwykłego formularza wydatku
      pokazuje przetłumaczone „Transakcje dodane”.
## 2026-10-19 — payout-push-unpause — push „Wypłata do potwierdzenia” włączony

- [ ] (tylko produkcja) Telefon z zainstalowaną aplikacją i włączonymi „Powiadomieniami”, aplikacja
      zamknięta: zaksięguj wypłatę na to konto z komputera → na telefonie przychodzi powiadomienie
      „Wypłata do potwierdzenia” z treścią „Potwierdź odbiór {kwota}.” (bez „albo napisz, czego
      brakuje”), a na ikonie aplikacji licznik rośnie o 1.
- [ ] Stuknięcie w to powiadomienie otwiera stronę pracownika z wypłatą do potwierdzenia; po
      potwierdzeniu licznik na ikonie znika.

## 2026-10-19 — transfers-worker-column-width — szersza kolumna „Pracownik”

- [ ] Lista transakcji (desktop), widok tabeli: imię i nazwisko w kolumnie „Pracownik” mieści się w
      jednej linii, tak jak w „Dodane przez”.

## 2026-10-19 — desktop-regression-audit — poprawki z przeklikania desktopu

- [ ] Strona inwestycji: strzałki przy „Etap AI” i „Kierownik budowy” są szare, jak przy „Notatki”,
      a nie czarne.
- [ ] Jako kierownik → „Pracownicy”: status „Aktywny/Nieaktywny” przy koncie właściciela, innego
      kierownika i przy własnym jest zwykłym znaczkiem (nie da się kliknąć); przy pracowniku przełącza
      jak dotąd. Jako właściciel: tylko własny status jest nieklikalny.

## EX-1112 — rejected-snapshot-retention — historia oferty odrzuconej znika od razu

- [ ] Inwestycja ze statusem „Odrzucona", która ma zapisane wersje kosztorysu: po najbliższym
      nocnym sprzątaniu link inwestora nie pokazuje już żadnej wersji w historii, a w edytorze
      → „Wersje" zostają wersje automatyczne i ręczne. Inwestycja „Zakończona" niedawno zachowuje
      swoją historię jak dotąd.

## EX-1115 — investments-row-badges — status i Etap AI zmieniane prosto z wiersza listy

- [ ] Lista „Inwestycje" → klik w plakietkę statusu otwiera menu samych plakietek; wybór zmienia
      status bez przechodzenia na stronę inwestycji, a wiersz zostaje na miejscu.
- [ ] Lista „Inwestycje" → klik w plakietkę „Analiza AI" otwiera menu plakietek z opisem pod
      każdą; wybór zmienia etap, opis nie pojawia się w zamkniętej plakietce.
- [ ] Lista „Inwestycje" → klik w nazwę inwestycji przenosi na jej stronę; klik w puste miejsce
      wiersza już nie przenosi.
- [ ] Lista „Inwestycje" → „Zamów" na wierszu inwestycji z kierownikiem budowy: kierownik jest
      wstępnie wybrany jak dotąd.
- [ ] Strona inwestycji → „Edytuj": pole „Kierownik budowy" pokazuje obecnego kierownika, a wybór
      innego zapisuje się od razu (widać go po zamknięciu okna). To samo z listy i z zakładki
      „Inwestycja" w kosztorysie.
- [ ] Strona inwestycji → plakietka statusu i „Etap AI" pod listą informacji działają jak wcześniej
      (menu, zmiana, brak kursora tekstowego).

## EX-1116 — kosztorys-commit-on-settle — komórki liczbowe zapisują się po Enterze

- [ ] Edytor kosztorysu z ~1000 pozycjami → wpisz liczbę w „Przedmiar ofertowy": znaki pojawiają się
      bez przycięć; „Wartość netto" wiersza i sumy w stopce zmieniają się dopiero po Enterze.
- [ ] „Etap 1" → wpisz ilość, Enter: „Pomiar z natury" i suma etapów zmieniają się raz; Cofnij
      (Ctrl+Z) przywraca poprzednią ilość jednym krokiem.
- [ ] „Rabat" → wpisz 150 przy rabacie procentowym, Enter: komunikat „…przywrócono" i rabat bez
      zmian.
- [ ] Dowolna komórka liczbowa → wpisz liczbę, Esc: wartość bez zmian, bez komunikatu, zaznaczenie
      zostaje w tej samej komórce.
- [ ] „Aktualizacja przedmiaru" → wyczyść komórkę, Enter: wartość wraca do szarej (podąża za
      „Przedmiarem ofertowym").
- [ ] Stawka podwykonawcy → mnożnik ponad sufitem, Enter: jedno ostrzeżenie, wartość zostaje.
- [ ] Z aktywnym wyszukiwaniem w pasku narzędzi: edytowany wiersz nie znika w trakcie pisania.
- [ ] Wpisz liczbę w „Przedmiar ofertowy" i od razu kliknij link w menu bocznym: po powrocie do
      kosztorysu (odświeżenie strony) wpisana wartość jest zapisana.
- [ ] Stawka podwykonawcy (kwota stała) → wpisz kwotę ponad sufitem: czerwone zdanie o przekroczeniu
      widać już w trakcie pisania; po zejściu pod sufit znika jeszcze przed Enterem.
- [ ] Telefon, raport pracownika → wpisz ilość, bez Entera przełącz się na inną aplikację i wróć:
      ilość została w szkicu.

## 2026-10-20 — investment-overview-shared — jeden blok „Inwestycja" na stronie i w kosztorysie

- [ ] Jako właściciel na dowolnej stronie: „Wpłata", „Transfer między kasami" i „Wydatek" z górnego paska
      otwierają się z tymi samymi listami kas / inwestycji / pracowników co wcześniej i zapisują.
- [ ] Strona inwestycji wygląda i działa jak wcześniej: przyciski, „Kierownik budowy", status, notatki,
      notatki AI, „Zdjęcia i pliki".
- [ ] Edytor kosztorysu → „Podsumowanie" → „Inwestycja": ten sam blok co na stronie inwestycji, bez
      „Kosztorys v2"; „Zamów" otwiera zamówienie z adresem i kierownikiem inwestycji; zmiana statusu,
      „Etap AI" i „Kierownik budowy" zostaje po odświeżeniu.
- [ ] Inwestycja zakończona pokazuje „Prośba o weryfikację" w obu widokach; inwestycja z arkuszem pokazuje
      „Arkusz".
- [ ] Inwestycja w Koszu: oba widoki pokazują baner i są tylko do odczytu.
- [ ] „Sprzęt" → „Dodaj sprzęt" i „Przekaż" na stronie sprzętu listują tych samych pracowników / inwestycje.
- [ ] „Kasy" → „Dodaj kasę" listuje pracowników; na stronie kasy „Edytuj" i „Sprawdzenie Telmak" otwierają
      się i zapisują.
- [ ] „Zgłoszenia" → filtr inwestycji listuje inwestycje; „Zgłoszenia wydatków" → akceptacja zgłoszenia
      otwiera wypełniony formularz wydatku i zapisuje.
- [ ] Lista „Inwestycje" → „Edytuj" na wierszu (z „Kierownikiem budowy") i „Zamów" działają;
      „Kosztorysy" → „Dodaj kosztorys" listuje inwestycje bez kosztorysu.
- [ ] „Pracownicy" i strona pracownika (jako właściciel) → „Edytuj" listuje kasy; „Edytuj" na wierszu
      transakcji otwiera się i zapisuje.
- [ ] Edytor kosztorysu: podział na etapy, menu „Pracownicy" i widok podwykonawcy w „Podsumowaniu"
      pokazują tych samych pracowników.
- [ ] Pracownik na telefonie: własna strona ładuje się, górny pasek nie ma okien zarządu, „Wyślij zgłoszenie
      wydatku" listuje tylko jego kasy.
- [ ] Link inwestora (`/k/...`) i „Podgląd inwestora" (w tym „Podsumowanie") bez zmian.

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
- [ ] Kosztorys → przegląd zgłoszenia prac: strzałka przy nagłówku grupy obraca się, a grupa ukrywa
      i pokazuje wiersze jak dotąd.

## EX-1110 — ds-primitive-sweep — wspólne komponenty zamiast ręcznych kopii

- [ ] Profil użytkownika z kasą, której saldo wychodzi na zero: „0,00 zł" w sekcji jego kas jest
      bez koloru (nie czerwone), także w sumie.
- [ ] Kosztorys → podsumowanie podwykonawców, pracownik rozliczony do zera: „Pozostało" pokazuje
      „0,00 zł" bez koloru i bez dopisku „nadpłacone".
- [ ] Pusty kosztorys → przycisk „Podsumowanie" jest wyszarzony, a po najechaniu pokazuje tooltip
      „Kosztorys jest pusty — nie ma czego podsumować".
- [ ] Logowanie: po kliknięciu „Zaloguj" kręci się tylko wskaźnik w przycisku („Logowanie...") —
      bez drugiego, pełnoekranowego wskaźnika na środku strony.
- [ ] Kosztorys → materiały, zestaw „Materiały rozliczane netto": „Razem" stoi pod kolumną
      „Netto", kolumna „Brutto" w stopce pusta.
- [ ] `/design`: każda sekcja się renderuje, w jasnym i ciemnym motywie; nowe warianty przycisków,
      plakietki, panel, wysuwany panel boczny i kolor ostrzeżenia są widoczne i czytelne.
- [ ] Dowolne okno potwierdzenia (np. usunięcie transakcji): tytuł tej samej wielkości co w zwykłym
      oknie formularza; na telefonie przyciski jeden pod drugim, na komputerze obok siebie.
- [ ] Okna formularzy (np. „Dodaj wydatek"): szerokość jak dotąd albo minimalnie większa, nic się
      nie zawija ani nie ucina.
- [ ] Lista transakcji → przycisk filtrów z aktywnym filtrem: zielona ramka jak dotąd; przycisk
      czyszczenia filtrów czerwony obrys, po najechaniu wypełniony.
- [ ] Menu boczne → licznik nieprzeczytanych: pełna pigułka z liczbą, „99+" powyżej 99, brak przy 0.
- [ ] Kosztorys edytor → nagłówek etapu: po najechaniu tooltip „Opcje etapu", kliknięcie otwiera
      menu, a po zamknięciu menu tooltip nie wyskakuje ponownie.
- [ ] Pola liczbowe w siatce/tabeli (wpisywanie kwoty w wierszu): tekst nie jest ucięty, wyrównany
      do prawej.
- [ ] Telefon (390px, przez LAN) → menu: logo w lewym górnym rogu, X w prawym; za panelem
      przyciemnione tło, Esc i kliknięcie w tło zamykają panel z animacją, fokus wraca na przycisk menu.
- [ ] Telefon (390px) → konto pracownika z wypłatami do potwierdzenia i strona raportu pracownika
      (link z „Udostępnij"): przyciski i pasek raportu mieszczą się w szerokości, nic się nie ucina.
- [ ] „Rozlicz wypłaty": podczas wczytywania gradientowy wskaźnik; „Brak wypłat do rozliczenia."
      wyśrodkowane; wysłanie z błędem pokazuje komunikat „formularz ma błędy".
- [ ] „Anulowanie transakcji" i odrzucenie wypłaty: okno węższe, bez X w rogu; zamyka „Anuluj" i Esc.
- [ ] „Nowy kosztorys": przycisk „Dodaj kosztorys" w stopce okna (na komputerze po prawej, nie na
      całą szerokość), etykiety pól czytelne.
- [ ] „Nowy wydatek" i „Wczytaj kartkę": przycisk wysyłki w stopce; kliknięcie etykiety otwiera
      fokus na jej polu wyboru; „Ładowanie salda..." ma wskaźnik.
- [ ] Kosztorys edytor → po kolei otwórz „Wersje kosztorysu", „Udostępnij", „Ustawienia podglądu",
      „Wyczyść kosztorys", „Wczytaj z szablonu", „Dodaj sekcję z szablonu", „Zmień kolejność",
      „Podział etapu": każde okno ma sensowną szerokość, nic się nie zawija ani nie ucina.
- [ ] Kosztorys edytor → „Podział etapu": „Główny" wybiera się jak opcję (tylko jeden naraz).
- [ ] Kosztorys edytor → „Zgłoszenia prac": przełącznik „Wg daty / Wg pracownika" działa jako
      jeden segmentowy przełącznik; pusta lista pokazuje wyśrodkowany komunikat.
- [ ] Kosztorys → „Porównaj z arkuszem", „Pobierz z arkusza", „Stawki", „Raport": ostrzeżenia
      bursztynowe, różnice czerwone, zgodności zielone — czytelne w jasnym i ciemnym motywie;
      linki „komórka X" działają.
- [ ] „Dodaj pracę z katalogu" / „Zamień pracę" bez wybranej sekcji przy zapisie: pole sekcji z
      czerwoną ramką jak inne pola formularza.
- [ ] „Manual Wykończymy", „Synchronizacja wydatków inwestycyjnych", „Sprawdź faktury Telmak",
      „Załączniki" w zgłoszeniach: okna się otwierają, wskaźnik ładowania gradientowy, treść mieści się.
- [ ] Zgłoszenia → „Dodaj" (nowa inwestycja ze zgłoszenia z plikami): odstęp między paskiem plików
      a formularzem jak w innych oknach — bez dużej przerwy.
- [ ] Flota i sprzęt: daty po terminie bursztynowe; po najechaniu na plakietkę alertu floty i na
      saldo OpenRouter pokazuje się dymek (nie systemowy podpis przeglądarki).
- [ ] Filtry listy: chip aktywnego filtra ma X, który go usuwa; po najechaniu na przyciski filtrów
      dymek z opisem.
- [ ] Logowanie, „Nie pamiętasz hasła" i reset hasła: błędny login/hasło pokazuje czerwony
      komunikat pod formularzem jak dotąd.
- [ ] Telefon (390px, przez LAN), konto kierownika → menu → „Manual Wykończymy": menu się zamyka,
      a okno Manuala zostaje otwarte z wczytanymi wpisami.
- [ ] Telefon → otwórz menu i obróć telefon poziomo (szerokość ≥ 768px): nie zostaje przyciemnione
      tło nad stroną.
- [ ] Kosztorys → „Pobierz z arkusza" → „Rozliczenie i wykonawca etapów": pole wyboru wykonawcy ma tę
      samą wysokość co pole rozliczenia obok.
- [ ] Kosztorys → „Zgłoszenia prac" → przegląd zgłoszenia: nagłówki grup wielkimi literami; dopisek
      pod polem ilości wyśrodkowany.
- [ ] Kosztorys → podsumowanie: kliknij uchwyt panelu, żeby go zwinąć, potem rozwiń — dymek uchwytu
      nie pojawia się sam.
- [ ] „Dodaj kosztorys" (link do arkusza), „Podłącz arkusz do inwestycji", „Synchronizuj wydatki
      inwestycyjne", „Dodaj do inwestycji" w załącznikach zgłoszenia i przycisk potwierdzenia w oknach
      „Anuluj / Potwierdź": w trakcie wysyłki przycisk jest wyszarzony i kręci się w nim wskaźnik.
- [ ] Komunikaty błędów pod formularzami (logowanie, „Rozlicz wypłaty", zamówienia): bez ikony
      trójkąta jak dotąd; małe błędy przy polach (plik, lista odbiorców, „Zapisz szablon") z ikoną.
- [ ] Plakietka z X (np. aktywny filtr, wybrany odbiorca): X ma ten sam rozmiar, po najechaniu
      czerwienieje, kliknięcie usuwa.

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

## 2026-10-20 — sidebar-width-animation — pasek boczny zwija się i rozwija z animacją

- [ ] Pasek boczny (desktop): klik w uchwyt na krawędzi płynnie zwęża pasek do ikon i z powrotem
      rozszerza, w tym samym tempie co rozwijanie sekcji konta; podpisy linków nie łamią się ani nie
      skaczą w trakcie, uchwyt nie jest ucięty.
- [ ] Pasek zwinięty → przeładowanie strony: pasek od razu stoi zwinięty, bez animacji zwężania.
- [ ] Edytor kosztorysu z dużym kosztorysem: zwinięcie i rozwinięcie paska nie zacina siatki.

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

