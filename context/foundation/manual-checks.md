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

## cron-lead-reconcile (EX-416)

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

## lead-recovery-notifies-sales (EX-660)

Setup jak w `cron-lead-reconcile`. **Uwaga:** te checki czytają żywe dane Meta i wysyłają prawdziwy
mail na listy „Powiadomienia o nowych zgłoszeniach" i „Alerty techniczne" — a przy regresji na
prawdziwy adres klienta. Warunek wstępny: lead obecny w oknie Meta, a nieobecny lokalnie.

2/4 odhaczone. Domknięte strukturalnie: klient **nie dostaje nic**, bo `reconcile-sweep.ts:91`
podaje `autoReply: 'skip'`, więc `sendAutoReply` nie jest w ogóle wołane (12 odzyskanych leadów
wylądowało z `auto_reply_status = 'skipped'`), a defekt, który EX-660 naprawiał (oba statusy na
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

## EX-758 — Katalog narzędzi i urządzeń (rejestr sprzętu)

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

- [~] ~~Pasek miniatur nie przewija się w poziomie przy 375px~~ — nieaktualne: na karcie inwestycji
      nie ma już paska miniatur (patrz sekcja „EX-802 — investment-assets-dialog", która to zastępuje)
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

## catalogue-picker-virtualization — „Dodaj pracę z katalogu" rysuje tylko widoczne wiersze (EX-860, 2026-09-28)

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
addytywna — na produkcję **przed** pushem; DROP starych kolumn to EX-886, po wdrożeniu.

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

## EX-919 — worker-payout-remaining — „Pozostało do wypłaty" per pracownik i „Rozlicz wypłaty" (2026-09-29)

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

## EX-909 — szablony-plain-revalidation

- [ ] To samo w szablonie z ~1000 pozycji: zapis komórki bez widocznego opóźnienia względem małego
      szablonu.
      _Staging 2026-10-01: nie sprawdzono — na preview DB nie ma szablonu z ~1000 pozycji (są 3: 0–202 pozycji; największa inwestycja ma 379 pozycji), seedów nie wolno. Boks zostaje otwarty._
      _Nie sprawdzone 2026-10-04 (staging): bez zmian — na preview nadal brak szablonu z ~1000 pozycji (największy: 202 pozycje), seedów nie wolno._
      _Staging 2026-10-06 (batch B): bez zmian — brak szablonu z ~1000 pozycji (największy szablon 202, największy kosztorys 379), nie seeduję. Zob. Findings._
      _Zweryfikowano 2026-10-09 (lokalnie, 5435): szablon zbudowany z UI — „Zapisz jako nowy szablon” (z inw. 7, 1000 pozycji bez katalogu → szablon wyszedł pusty) + 3× „Sekcja z szablonu…” = 899 pozycji, 44 sekcje (szablon 1280). Zapis komórki „Opis prac” (edycja katalogu, EX-1017): akcja 89 ms / żądanie 135 ms, start po 460 ms debounce; w szablonie 294 pozycji (1278): akcja 61 ms / żądanie 120 ms, start po 472 ms — brak widocznej różnicy, bez przeładowania. Zmienione wpisy katalogu (130, 447) przywrócone SQL-em, szablon 1280 do usunięcia na teardown._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      _needs human: szablon ~1000 pozycji / pusty kosztorys — brak takiego fixture'a na preview, pomiar opóźnienia wymaga człowieka (pass 6)_

## EX-943 — kosztorys-stage-worker-split — kilku pracowników na etap (2026-09-30)

- [ ] Etap sprzed zmiany z jednym przypisanym pracownikiem: po wdrożeniu nagłówek pokazuje tę samą
      osobę bez „+N", a jej należne i wypłaty się nie zmieniły.
      _Staging 2026-10-01: nie sprawdzono w pełni — Etap 1 inw. 137 (jeden pracownik, Adam Orłowski) pokazywał nagłówek bez „+N” przed moimi zmianami, ale „po wdrożeniu” to porównanie ze stanem sprzed zmiany, którego nie mam. Boks zostaje otwarty._
      _Staging 2026-10-01 (batch 5): inw. 138 Etap 1 (stworzony 2026-08-30, jeden pracownik Adrian Furmańczyk, `kosztorys_stage_workers` id 1): nagłówek „Adrian Furmańczyk” bez „+N”; „Pracownicy”: wykonana praca 4290,00, wypłaty 0,00, pozostało 4290,00 — zgodne z DB (22 × 300 × 0,65 = 4290,00; brak aktywnych PAYOUT pracownika 17 na 138). Boks zamknięty._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      Staging 2026-10-15: etapy z jednym pracownikiem na inw. 210 pokazują samą osobę bez „+N", ale stanu „sprzed zmiany" nie da się odtworzyć (inw. 138 z 30.08 jest w Koszu, nagłówek tylko „Etap 1"); wymaga starego etapu z danych prod.

## EX-970 — kosz-zgloszen

Na staging najpierw `pnpm db:migrate:preview` (nowe kolumny `trashed_at` / `erased_at` w zgłoszeniach).

- [ ] „Usuń na zawsze" na zgłoszeniu, z którego utworzono inwestycję ze zdjęciami: wymaga wpisania
      nazwy; po usunięciu zgłoszenie znika z `/kosz`, a galeria inwestycji pokazuje wszystkie zdjęcia.
      _Nie sprawdzone 2026-10-03 (staging): UI nie tworzy zgłoszeń, a formularz WWW wysłałby powiadomienia na prawdziwe adresy; kasować cudzego zgłoszenia nie wolno — bloker izolacji EX-937/EX-938._
      _Nie sprawdzone 2026-10-06 (staging, batch B): bez zmian — UI nie tworzy zgłoszeń ani inwestycji z nich, nie ma jednorazowego leada do skasowania. Zob. Findings._
      _Zweryfikowano 2026-10-09 (lokalnie, 5435; lead 224 z plikiem, inwestycja 154): potwierdzenie wymaga wpisania nazwy (zła nazwa → przycisk wyłączony); po usunięciu zgłoszenie znika z `/kosz` (wiersz wymazany w miejscu, `erased_at` ustawione, `leads_rels` 0); inwestycja 154 nadal ma „Zdjęcia i pliki — Dokumentacja (1)” i `investments_rels` → media 1799. Uwaga: bajty `/api/media/file/marki-pdf-a8a01d.pdf` dają 404 także dla nietkniętego PDF-a z innego leada — preview store nie ma PDF-ów, to nie skutek usunięcia._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      _needs human: wymaga zgłoszenia (leada) z inwestycji ze zdjęciami — UI nie tworzy zgłoszeń, a kasowanie cudzego jest zabronione; część lokalna zweryfikowana 2026-10-09_
- [ ] Usunięte na zawsze zgłoszenie z Facebooka nie wraca po nocnym uzgodnieniu zgłoszeń (staging,
      następny dzień).
      _Nie sprawdzone 2026-10-03 (staging): wymaga sprawdzenia następnego dnia po przebiegu crona Facebooka — bloker izolacji EX-937/EX-938_
      _needs human: sprawdzenie następnego dnia po nocnym cronie uzgadniania Facebooka (cron + realne zgłoszenie FB)_

## 2026-10-02 — podsumowanie-pracownika-tabele

- [ ] PDF pracownika z długą listą wypłat (kilkadziesiąt) → tabela, która nie mieści się na stronie, przechodzi na następną sama, a tabele nad nią zostają na poprzedniej (bez pustej połowy strony). PDF oferty dla klienta → podsumowanie w stopce nadal stoi przy prawej krawędzi.
      _Nie sprawdzone w całości 2026-10-03 (staging): zaksięgowano 32 wypłaty po 1 zł dla QA-Premia A i otwarto „Drukuj PDF" (print zastubowany) — tabela „Wypłaty" ma 33 wiersze, 826 px wysokości, zaczyna się na 459 px (nie mieści się na jednej stronie); styl wydruku ma tylko `tr { break-inside: avoid }`, bez `break-inside` na samych tabelach. NIE da się ocenić faktycznego podziału stron — `page.pdf()` w tym Chromium zwraca „Printing failed", a prawdziwego druku nie wolno uruchamiać. PDF oferty: tabela „Razem netto" ma prawą krawędź równą prawej krawędzi tabeli głównej (1244 px) — stoi przy prawej krawędzi w układzie ekranowym, a nie w druku._
      _Lokalnie 2026-10-09: do prawdziwego HTML „Drukuj kosztorys pracownika (PDF)” (print zastubowany, inw. 184) wstrzyknięto 35 wierszy wypłat i wyrenderowano headless Chromium (`page.pdf`, A4 landscape): 4 strony — tabele „Wykonane”/„Pozostało” zostają na str. 2, tabela „Wypłaty” zaczyna się od góry str. 3 (28 wierszy), str. 4 ma resztę (7 + „Razem”); brak pustej połowy strony. Podsumowanie oferty przy prawej krawędzi: ten sam CSS `.totals` (`align-items: flex-end`); w PDF pracownika widać je przy prawej krawędzi, oferty osobno nie renderowano. Zob. Findings 2026-10-09 (pass 4)._
      _Cofnięte do `[ ]` 2026-10-14: nie zweryfikowano całego boksu (zob. notatka powyżej)._
      _needs human: PDF z kilkudziesięcioma wypłatami — brak takiego pracownika na preview; ocena układu PDF wzrokowo (pass 6)_

## EX-975 — purge-runner — nocne czyszczenie Kosza po scaleniu sześciu kopii (2026-10-05)

Refaktor bez zmiany zachowania: nocny cron czyści Kosz tak samo jak wcześniej.

- [ ] Inwestycja, kasa, pracownik, pojazd, sprzęt i zgłoszenie w `/kosz` dłużej niż okres przechowywania → po przebiegu crona `cleanup` znikają z `/kosz`, a listy (Inwestycje, Kasy, Pracownicy, Flota, Sprzęt, Zgłoszenia) pokazują stan po usunięciu bez ręcznego odświeżania pamięci podręcznej.
      _needs human: cron `cleanup` na preview DB (kopia produkcji) trwale skasowałby prawdziwe wiersze z /kosz — brak izolowanego zestawu przeterminowanych rekordów_
- [ ] Odpowiedź crona `cleanup` zawiera dla każdego rodzaju `purged` / `blocked` / `failed` (pojazdy, sprzęt i zgłoszenia mają teraz też `blocked: 0`), a inwestycje dodatkowo `skippedKosztorys`.
      _needs human: jak wyżej — odpowiedź crona `cleanup` wymaga jego uruchomienia, które na preview DB kasuje prawdziwe przeterminowane wiersze_

## EX-992 — ai-translations — AI uzupełnia tłumaczenia UA/RU i tłumaczy prace spoza rozpiski na polski (2026-10-05)

- [ ] Gdy AI było niedostępne w chwili wysyłki: przegląd pokazuje „Brak tłumaczenia" i „Przetłumacz"; po kliknięciu (z działającym AI) polski opis pojawia się bez zamykania okna. Pracownik na swoim linku nie widzi żadnego przycisku tłumaczenia.
      _Staging 2026-10-05:_ NIE sprawdzone — nie da się zasymulować niedostępności AI na stagingu. Sam przycisk „Przetłumacz" sprawdzony na zgłoszeniu z PL opisem (działa).
      _needs human: nie da się zasymulować niedostępności AI w chwili wysyłki na stagingu_

## EX-949 — worker-report-scan — zgłoszenie prac wczytane z papierowej kartki

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

## EX-1014 — media-upload-other-forms — każdy formularz z plikami na szybkiej ścieżce (2026-10-07)

Staging (albo preview brancha), konto OWNER, chyba że napisano inaczej. Zdjęcia z telefonu albo
JPEG-i ~300 KB; „duży plik" = PDF powyżej 4 MB.

- [ ] Telmak: dodaj fakturę PDF → zapisana i otwiera się.
  - POMINIĘTE 2026-10-07 (staging): okno „Sprawdź Telmak” przyjmuje tylko faktury w układzie Telmaka (parser odrzuca inne), a jedyne takie PDF-y to prawdziwe faktury z lustra produkcyjnego Bloba — nie wgrywam ich na staging. Wymaga PDF-a Telmaka od człowieka.
      _needs human: PDF faktury Telmaka (prawdziwe faktury produkcyjne nie trafiają na staging)_
- [ ] Raport ze skanu: dodaj zdjęcia → raport zapisany, zdjęcia się otwierają.
  - POMINIĘTE 2026-10-07 (staging): wymaga czytelnie wypełnionej kartki „Drukuj kartkę do zgłoszenia prac” — dwa zdjęcia z szumem skończyły się komunikatem „Na zdjęciach nie odczytano żadnej wpisanej ilości.” i raport się nie zapisuje. Potrzebne zdjęcie prawdziwej, wypełnionej kartki od człowieka.
      _needs human: zdjęcie prawdziwej, wypełnionej kartki zgłoszenia prac_
- [ ] Okno leada (zgłoszenie z Facebooka) z plikami → miniatury wyglądają jak dotąd.
      POMINIĘTE 2026-10-07 (staging): żadne z 221 zgłoszeń na preview DB nie ma plików (`leads_rels` bez media), a nowego z plikami nie da się utworzyć bez podpisanego webhooka landingu (sekret Preview niedostępny, zob. sekcja EX-802). Wymaga zgłoszenia z plikami od człowieka.
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

## EX-921 — kosztorys-przedmiar-aktualny — „Aktualizacja przedmiaru” obok „Przedmiaru ofertowego” (2026-10-07)

- [ ] Pracownik, któremu wcześniej odznaczono „Przedmiar” w ustawieniach widoku pracownika → po zmianie „Aktualizacja przedmiaru” nadal jest u niego ukryta.
      POMINIĘTE bez próby (2026-10-07): wymaga starego klucza `plannedQty` zapisanego w globalu ustawień widoku pracownika, a UI zapisuje już tylko `currentPlannedQty`; stworzenie stanu to zapis do bazy poza UI. Mapowanie klucza pokrywa `src/__tests__/lib/kosztorys/worker-view/settings.test.ts`.
      Staging 2026-10-15: wymaga starego klucza plannedQty w globalu widoku pracownika, którego UI już nie zapisuje; ścieżkę pokrywa src/__tests__/lib/kosztorys/worker-view/settings.test.ts, ręcznie tylko przez edycję JSON w bazie.

## EX-1025 — invoice-duplicate-detection — duplikaty paragonów przy akceptacji zgłoszeń wydatków (2026-10-08)

- [ ] „Dodaj wydatek" → między wierszem pliku a „Notatką" stoi wiersz z polami „Nr dokumentu", „NIP sprzedawcy" i „Data na paragonie"; „Skanuj" / „Odczytaj ponownie" wypełnia wszystkie trzy.
      _Staging 2026-10-14 (pass 3): układ OK: FV (plik) → Nr dokumentu / NIP sprzedawcy / Data na paragonie → Notatka. „Odczytaj ponownie” z fixture paragon-a.jpg dał „NIE UDAŁO SIĘ ODCZYTAĆ” (puste pola) — wypełnienie trzech pól nieweryfikowalne bez czytelnego prawdziwego paragonu. Needs human._
      _needs human: wypełnienie trzech pól przez odczyt AI wymaga czytelnego prawdziwego paragonu (fixture nie odczytuje się)_

## EX-1065 — catalogue-auto-translate — nocny cron dotłumacza katalog prac

- [ ] Katalog prac → „Uzupełnij tłumaczenia (AI)” nadal tłumaczy i zeruje licznik, jak dotąd.
- [ ] Vercel → Settings → Cron Jobs po wdrożeniu na produkcję: jest `/api/cron/translate-catalogue` o `0 2 * * *`.

## EX-1032 — company-knowledge — „Manual Wykończymy” w górnym pasku

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

- [ ] Telefon, aplikacja zainstalowana (PWA), zalogowany pracownik → na swojej stronie „Zgłoś
      pracę” → strona zgłoszenia ma strzałkę „Wstecz” po lewej od logo; dotknięcie wraca na
      stronę pracownika.
      _needs human: zainstalowana PWA na telefonie (tryb standalone)_
- [ ] To samo przez link inwestycji w „Moje inwestycje” (widok „Inwestycja”) → strzałka wraca na
      stronę pracownika.
      _needs human: zainstalowana PWA na telefonie_
- [ ] Po wysłaniu zgłoszenia ekran „wysłano” też ma strzałkę i wraca na stronę pracownika.
      _needs human: zainstalowana PWA na telefonie_
- [ ] Link zgłoszenia otwarty z SMS-a (brak historii w aplikacji) → strzałka prowadzi na stronę
      pracownika (zalogowany) albo na logowanie, nie zostawia go na pustej stronie.
      _needs human: link z SMS-a w zainstalowanej PWA na telefonie_
- [ ] Zwykła przeglądarka (nie PWA) i desktop → strzałki nie ma; przy 390px nazwa inwestycji
      i pracownika nadal czytelna (najwyżej ucięta wielokropkiem), przełącznik języka mieści się.
      _needs human: telefon/iPhone 390px na prawdziwym urządzeniu (viewport emulowany nie odtwarza dotyku, zoomu iOS ani klawiatury) (pass 6)_

## 2026-10-11 — invoice-download-date-range — „Faktury” z zakresem dat (EX-1039)

- [ ] „Drukuj” dalej drukuje bieżący zestaw filtrów tabeli, niezależnie od dialogu.
      _Staging 2026-10-14: Okno druku nie weryfikowalne w tym narzędziu._
      _needs human: natywne okno druku — nie do sterowania w automatyzacji_

## 2026-10-11 — pwa-push-notifications — powiadomienia push w zainstalowanej aplikacji (EX-1040)

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

## 2026-10-12 — investment-ai-stage — „Etap AI” na inwestycji (EX-1046)

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

## 2026-10-13 — report-line-decisions — „Przyjmij / Odrzuć” pozycja po pozycji (EX-1049)

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

## EX-1057 — kosztorys-ai-rounds — kolejne rundy AI: „Nowe informacje” i „Do ponownego sprawdzenia”

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

- [ ] Telefon 390px, raport pracownika: Mała i Średnia dają widocznie różny tekst; nazwa sekcji jest mniejsza niż dawniej i przy długiej nazwie wychodzi na sąsiednie puste komórki.
      _Staging 2026-10-14 (pass 3): 390px: Mała=12px, Średnia=14px (różny tekst), nazwa sekcji mała. NIE sprawdzono wychodzenia długiej nazwy sekcji na sąsiednie puste komórki (brak długiej nazwy w inw. 210) — box otwarty._
      _needs human: telefon/iPhone 390px na prawdziwym urządzeniu (viewport emulowany nie odtwarza dotyku, zoomu iOS ani klawiatury) (pass 6)_

## 2026-10-14 — backlog-fixes-14 — poprawki z backlogu: odrzucenie w zgłoszeniu, zapis przed podmianą rozpiski, menu etapu (EX-1052, EX-1002, EX-1036)

- [ ] EX-1052: ten sam kosztorys w dwóch kartach. W karcie A „Zgłoszenia prac” → zgłoszenie → przy
      jednej pozycji tylko „Odrzuć” → zapisz. Przejdź do karty B: **nie** pojawia się „Rozpiska
      zmieniła się w innym oknie — wczytano aktualną wersję.”, a w „Wersje” nie przybyła wersja
      automatyczna. Po ponownym otwarciu zgłoszenia pozycja jest odrzucona.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_
- [ ] EX-1052: to samo z „Przyjmij” jednej pozycji zamiast „Odrzuć” — karta B **pokazuje** ten
      komunikat i ilość w etapie.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_
- [ ] EX-1002: tak samo — świeża zmiana w komórce, od razu „Wyczyść kosztorys”, „Wczytaj z
      szablonu”, import z arkusza i „Ustaw kolejność”: każda kończy się bez komunikatu o błędzie
      i bez „Kosztorys zmienił się w innym miejscu”.
      _needs human: dwie karty z jednym kosztorysem; wspólne ciasteczko i brak bezpiecznego stanu do odrzucenia/„Wyczyść” na prawdziwej inwestycji (zasada: nie nadpisujemy kosztorysu) (pass 6)_

## EX-1021 — media-file-headers — pliki spoza dozwolonych typów pobierają się zamiast otwierać

- [ ] Plik SVG wgrany w pliki z ominięciem formularza (`/api/media/file/<nazwa>.svg`) → otwarcie
      linku pobiera plik zamiast wyświetlać obraz lub stronę.
      _Staging 2026-10-15 (pass 5): Pass 5: NIE sprawdzone — w sklepie preview nie ma SVG, a wgranie przez token route z pominięciem formularza wymaga ręcznie zbudowanego klienta; brak specu na hardenMediaFileHeaders (src/__tests__ nie ma testu). Do zrobienia ręcznie._
      _needs human: w sklepie preview nie ma SVG, a wgranie z pominięciem formularza wymaga ręcznie zbudowanego klienta; brak specu hardenMediaFileHeaders (pass 6)_

## EX-1055 — pozycja ze zgłoszenia zapamiętana przed zapisem

### Findings — 2026-10-15

- [ ] **Praca z katalogu, którą sekcja już ma, nie jest zapamiętywana** — „Dodaj do rozpiski” z katalogu
      na pracę, której pozycja już stoi w wybranej sekcji, ustawiała link tylko w szkicu; po zamknięciu
      bez „Zapisz zmiany” praca wracała do „Spoza rozpiski” (bez bliźniaka). Poprawka w drzewie, niewdrożona:
      `add-line-to-rozpiska.tsx` `swapInto` woła `pointReportLineAction` także na ścieżce istniejącej pozycji
      (gdy pozycja jest jedna). **W toku:** spec `add-line-to-rozpiska.test.tsx` napisany, jeszcze nie
      uruchomiony; po deployu powtórzyć boks 1 na pracy, którą sekcja już ma.
      **Test disposition**: test-driven-debugging · unit (dom) — `onPick` z jedną pasującą pozycją woła akcję.

## EX-950 — remount-latch-disarm — przerwane „Wyczyść” nie przebudowuje edytora przy następnej zmianie

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
      _Staging 2026-10-15 (pass 5): Pass 5 FINDING: staging (origin/staging b73d388fe) nie zawiera commita 108516943 (fix EX-1064, tylko lokalnie). Na koncie uk przycisk w galerii inw. 210 to wciąż „Oznacz do analizy AI” (reszta po ukraińsku: Видалити цей файл, Додати ще, Друк…). Do ponownego sprawdzenia po wdrożeniu poprawki. Język QA 75 przywrócony do Polski._
      _needs human: commit EX-1064 (ukraińska etykieta) nie jest jeszcze na stagingu (pass 6)_

## 2026-10-15 — expense-draft-loader — „Nowy wydatek” pracownika: loader na środku ekranu + limit zdjęć

- [ ] Telefon 390px, konto pracownika → „Nowy wydatek”: pod polem zdjęć widać „Zdjęcia lub PDF, max 8
      jednocześnie.”, zanim cokolwiek wybierzesz.
- [ ] Wybierz kilka zdjęć: na środku ekranu kręci się gradientowy pierścień (fuksja→cyjan), dopóki
      zdjęcia się przygotowują; znika, gdy pole pokazuje ich nazwy.
- [ ] „Wyślij”: ten sam pierścień kręci się na środku ekranu aż do toasta o wysłaniu.
- [ ] Wybierz 9 zdjęć: podpowiedź znika, a w jej miejscu czerwony komunikat o limicie; „Wyślij” wyłączony.
- [ ] Inne ekrany z loaderem (logowanie, filtry transakcji, zapis formularza) wyglądają jak dotąd —
      🚧 dalej podskakuje.

## 2026-10-15 — investment-status-badge — status na stronie inwestycji jako badge

- [ ] Strona inwestycji → karta z danymi: „Status” to kolorowy badge, identyczny jak w kolumnie
      Status na liście inwestycji (np. Odrzucona — różowy, Aktywna — zielony).
- [ ] Edytor kosztorysu → podsumowanie, zakładka „Inwestycja”: „Status” pokazuje ten sam badge.

## 2026-10-15 — staging-sweep-review — siatka kosztorysu po odmowie „Ustaw kolejność” + porządki

- [ ] Kosztorys otwarty w dwóch kartach: w karcie B dodaj albo usuń pozycję, w karcie A (bez
      odświeżania) „Ustaw kolejność” → odmowa z komunikatem, a siatka w A sama pokazuje stan z B;
      kolejne „Ustaw kolejność” w A przechodzi.
- [ ] Kosztorys → „Importuj z arkusza” i „Ustaw kolejność” działają jak wcześniej (porządki bez
      zmiany zachowania): import podmienia pozycje, kolejność zapisuje się po odświeżeniu strony.

## EX-1075 — szablon-own-structure — szablon jako odwołania do katalogu prac

- [ ] Szablony → otwórz szablon → menu „…” przy dowolnej pracy: nie ma „Aktualizuj pozycję w katalogu
      prac” ani „Zapisz pozycję do katalogu prac”; „Wstaw powyżej/poniżej”, „Ustaw kolejność…” i „Usuń
      pozycję” są jak dotąd.
- [ ] Inwestycja z kosztorysem → menu „…” przy pracy z katalogu: „Aktualizuj pozycję w katalogu prac”
      nadal jest i otwiera okno zapisu do katalogu.
- [ ] Szablony → „Nowy szablon”, zmiana nazwy, otwarcie: działa; nazwa już zajęta (także przez szablon
      w koszu) jest odrzucana.
- [ ] Kosztorys z pracą spoza katalogu → „Zapisz jako szablon”: zapisany, ostrzeżenie wymienia pominiętą
      pracę.
- [ ] „Nadpisz” istniejący szablon: zastąpiony; w „Wersjach” tego szablonu jest „Przed nadpisaniem: …”.
- [ ] Nowa inwestycja z szablonu (także z leada): kosztorys ma sekcje i prace szablonu, przedmiar 0.
- [ ] Kosztorys → „Wczytaj szablon…” i „Sekcja z szablonu…”: właściwe sekcje i prace.
- [ ] Katalog prac → usuń pracę, która stoi w szablonie: znika z szablonu; kolumna „Szablony” liczy
      szablony poprawnie.
- [ ] Szablon → „Zapisz wersję”, zmień coś, „Przywróć”: układ wraca, opisy w dzisiejszym brzmieniu
      katalogu.
- [ ] Usuń z katalogu pracę, przywróć wersję szablonu, która ją miała: przywrócona bez niej,
      z ostrzeżeniem.
- [ ] Szablony → „Do kosza”: znika z listy i ze wszystkich pickerów szablonu; w `/kosz` widać go jako
      szablon. Przywrócenie: wraca z pracami i wersjami. „Usuń na zawsze” pyta o nazwę.
- [ ] Lista inwestycji, filtr statusu, formularz inwestycji: brak opcji „Szablon”; reszta jak dotąd.
- [ ] Raport pracownika i pickery wypłat: bez zmian dla prawdziwych inwestycji; szablony się w nich
      nie pojawiają.
- [ ] Ładowarka kosztorysu AI na szablonie (lokalnie): pozycje w brzmieniu katalogu, bez duplikatów.
- [ ] Kosztorys i szablon → „Dodaj pracę” (z tłumaczeniem i bez): praca dodana; pusty opis lub
      jednostka odrzucone; „Zapisz wersję” bez nazwy odrzucone; „Wersje” pokazują autora i datę;
      „Sekcja z szablonu…” dokłada sekcje w kolejności wyboru (porządki po przeglądzie — bez zmian
      w zachowaniu).
- [ ] Po usunięciu starych szablonów z bazy (druga migracja): `/szablony` pokazuje te same szablony
      z tymi samymi sekcjami, pracami i „Wersjami”; lista inwestycji i filtr statusu nie mają
      szablonu; nowa inwestycja zapisuje się ze statusem „Wycena”.
- [ ] Szablon → otwórz: brak bursztynowego ostrzeżenia. Zmień opis lub cenę pracy: pod paskiem
      narzędzi pojawia się „Pozycje szablonu to wpisy z katalogu prac…”. Zmiana nazwy sekcji lub
      kolejności sama go nie pokazuje. Kosztorys inwestycji po edycji pracy: ostrzeżenia nie ma.

## 2026-10-15 — expense-draft-duplicates-per-row — duplikaty przy własnym paragonie + paragon bez zdjęcia

- [ ] Zgłoszenie pracownika z kilkoma odczytanymi paragonami, z których dwa mają możliwe duplikaty →
      „Zweryfikuj”: „Możliwe duplikaty” stoją w ramce nad polami **własnego** paragonu, nie zbiorczo
      nad listą; „Akcje” są pierwszą kolumną tabeli, widoczne bez przewijania.
- [ ] Scal dwa paragony z duplikatami w jedną pozycję: w ramce każdy ma swój nagłówek
      „Paragon: opis · kwota”; „Rozdziel” wraca do ramek przy osobnych pozycjach.
- [ ] Zgłoszenie, w którym dwa paragony pasują do siebie nawzajem: duplikat podpisany
      „Pozycja N tego zgłoszenia”; po „Odrzuć” tamtej pozycji podpowiedź znika, po „Przyjmij” zostaje.
- [ ] „OK, to nie duplikat” chowa tylko kliknięty wiersz; „Duplikat” odrzuca paragon jako duplikat.
- [ ] Odczytane zgłoszenie, którego zdjęć nie udało się pobrać: przy każdym paragonie komunikat
      „Nie udało się pobrać zdjęcia paragonu — dodaj je w polu „FV”…”, „Przyjmij” i „Przyjmij
      zaznaczone” wyłączone, „Odrzuć” działa; dodanie pliku w „FV” zdejmuje komunikat i odblokowuje
      „Przyjmij” tego paragonu.
- [ ] Nieodczytane zgłoszenie bez pobranych zdjęć: nad pozycjami stały komunikat „Nie udało się
      pobrać zdjęć — zgłoszenie można tylko odrzucić.”, „Zapisz” wyłączone.
- [ ] „Szukaj duplikatów” na liście transakcji: tabela działa jak dotąd (kolumny w nowej kolejności,
      linki do dokumentów, podgląd zdjęcia).

## 2026-10-15 — staging-sweep-review-2 — druk z PDF, scalanie paragonów, ustawienia widoków kosztorysu

- [ ] Podgląd z kilkoma plikami, wśród nich PDF (np. faktura + zdjęcie) → „Drukuj”: okno wydruku
      pokazuje wszystkie strony, z PDF-em włącznie, i otwiera się systemowe okno drukowania; po wydruku
      lub anulowaniu okno się zamyka.
- [ ] Odczytane zgłoszenie, którego zdjęć nie udało się pobrać → „Zweryfikuj”: „Połącz” i „Rozłącz”
      wyłączone; plik dodany ręcznie w „FV” zostaje przy paragonie.
- [ ] Zgłoszenie z możliwym duplikatem → „OK, to nie duplikat”, potem „Połącz” ten paragon z innym
      (i „Rozłącz”): schowana podpowiedź nie wraca.
- [ ] Zgłoszenie, w którym dwa paragony pasują do siebie nawzajem → „Połącz” je: w scalonej pozycji
      nie ma podpowiedzi „Pozycja N tego zgłoszenia”.
- [ ] Kosztorys → ustawienia „Widok dla klienta” i „Widok dla pracownika”: ukryj jedną kolumnę, pokaż
      inną, zapisz, zamknij i otwórz ponownie — oba wybory zostają, podgląd pokazuje je od razu.
- [ ] Bez zmiany zachowania (przeniesione pliki): podgląd faktury z tabeli przelewów i z galerii
      inwestycji otwiera się i przewija jak dotąd; „Nowy wydatek” z kilkoma pozycjami działa jak dotąd;
      pickery inwestycji w „Wpłata” / „Wydatek” / edycji przelewu dalej pokazują tylko Aktywne
      i Planowane.

# Zamknięte — indeks

Jedna linia na slice — liczby są policzone z pełnego rejestru sprzed przycięcia.
`boksy` = odhaczone/wszystkie; wiersz, w którym te liczby się różnią, ma swoją sekcję wyżej
w „Otwarte" (tam boksy bywają scalone, więc liczba nieodhaczonych może się różnić od reszty z tej
kolumny — to ten sam fakt zapisany raz zamiast dwa). `0/0` to sekcja czysto prozatorska, bez boksów.
`ostatnia weryfikacja` to najpóźniejsza data w sekcji; `—` znaczy, że sekcja żadnej nie nosiła.
Pełne dowody, verbatim: patrz nagłówek pliku.

| slice                                                                                                                        | boksy | ostatnia weryfikacja |
| ---------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------- |
| EX-649 — zakładka „Marża": prognoza i marża rzeczywista                                                                      | 26/26 | 2026-09-04           |
| EX-691 — „Porównaj z arkuszem Google" pod aktywnym rabatem globalnym                                                         | 4/4   | —                    |
| EX-448 — stable per-row ids for expense line-items                                                                           | 6/6   | 2026-09-04           |
| S-08 — kosztorys-delete-guard                                                                                                | 5/5   | 2026-07-10           |
| kosztorys-zaliczka-v2 — materiały netto/brutto w Podsumowaniu (slice A)                                                      | 4/4   | —                    |
| kosztorys-tryb-mieszany — cash-settlement view w Podsumowaniu (slice B)                                                      | 6/6   | 2026-09-04           |
| kosztorys-podsumowanie-tabs — zaliczka-v2 batch: tabbed Podsumowanie, Mieszane via vatPlane, wpłaty base fix (EX-536)        | 11/11 | 2026-09-14           |
| remove-section-coeff — drop per-section coeff tier + explicit section sidebar buttons                                        | 2/2   | 2026-08-26           |
| EX-564 — kosztorys-percent-rabat-bulk-apply                                                                                  | 8/8   | 2026-08-26           |
| etap-tool-plane (EX-565) — per-etap rozliczenie plane + view-independent subcontractor settlement                            | 18/18 | 2026-09-14           |
| EX-571 — subcontractor-view-settlement-only                                                                                  | 16/16 | 2026-09-14           |
| EX-567 — netto investment-expense type (`INVESTMENT_EXPENSE_NET`)                                                            | 0/0   | 2026-07-26           |
| EX-580 — section header rows (bands) in the kosztorys grid                                                                   | 15/15 | 2026-09-14           |
| EX-581 — netto expenses get their own tab in the wydatki list                                                                | 10/10 | 2026-09-15           |
| EX-569 — client-facing „Pobierz faktury" in the kosztorys Wydatki tab                                                        | 12/12 | 2026-09-04           |
| EX-585 — kosztorys-invoice-note-and-preview                                                                                  | 17/17 | 2026-09-04           |
| EX-588 — investment-settlement-mode                                                                                          | 14/14 | 2026-09-04           |
| EX-594 — investment-summary-panel                                                                                            | 26/26 | 2026-09-15           |
| EX-596 — materials-net-pricing-persisted                                                                                     | 15/15 | 2026-09-15           |
| EX-597 — decouple-panel-write-refresh                                                                                        | 21/21 | 2026-09-15           |
| EX-605 — rabat globalny: activates on selection, undoable, one „Zapisz"                                                      | 8/8   | —                    |
| EX-606 — the % mass-overwrite gets a confirm dialog, not an undo entry                                                       | 9/9   | 2026-07-27           |
| EX-607 — kosztorys-section-footer-row                                                                                        | 14/14 | 2026-09-14           |
| EX-608 — nazwa inwestycji w górnym pasku bez trzeciego zapytania                                                             | 5/5   | —                    |
| EX-609 — subcontractor-price-guard                                                                                           | 21/21 | 2026-09-15           |
| EX-615 — drop-empty-kosztorys-scaffold                                                                                       | 8/8   | 2026-09-03           |
| EX-618 — scalable-preset-section-picker                                                                                      | 12/12 | 2026-09-15           |
| EX-574 — cancellation-sum-overcount                                                                                          | 10/10 | 2026-10-14           |
| EX-575 — drop-cost-variant-columns                                                                                           | 7/7   | —                    |
| EX-600 — investment-panel-filter-scope — ZDEZAKTUALIZOWANE                                                                   | 0/0   | 2026-08-08           |
| EX-430 — harden bulk-insert restore                                                                                          | 2/2   | 2026-08-26           |
| summary-panel-filter-blind — panel wholly filter-blind, scope-marker apparatus deleted                                       | 12/12 | 2026-09-15           |
| AI receipt scan: extract the netto amount (EX-577)                                                                           | 5/5   | —                    |
| Multi-page invoices (EX-659)                                                                                                 | 17/17 | 2026-09-15           |
| Dodawanie faktur wprost z „+" w tabeli wydatków (EX-662)                                                                     | 5/5   | —                    |
| cron-lead-reconcile (EX-416)                                                                                                 | 4/7   | 2026-09-15           |
| lead-recovery-notifies-sales (EX-660)                                                                                        | 2/4   | 2026-09-15           |
| investments-listing-expense-plane — wydatki w liście na płaszczyźnie rozliczenia materiałów                                  | 15/15 | 2026-09-15           |
| kosztorys-importer (EX-417)                                                                                                  | 13/13 | 2026-09-04           |
| EX-560 — ex-560-reload-from-preset                                                                                           | 7/7   | 2026-09-03           |
| EX-555 — robocizna + rabat z kosztorysu na liście inwestycji (write-switch)                                                  | 16/16 | 2026-09-04           |
| EX-557 — wpłaty bez inwestycji („Inna wpłata" wraca, oba typy tracą inwestycję)                                              | 6/6   | —                    |
| EX-675 — strata obniża dług inwestora jak rabat                                                                              | 16/16 | 2026-09-15           |
| EX-686 — rozjazd „Pomiar z natury" vs suma etapów po imporcie                                                                | 13/13 | 2026-09-15           |
| EX-682 / EX-683 — sortowanie wewnątrz sekcji                                                                                 | 5/5   | —                    |
| EX-688 — zakres sortowania kolumny + „Zapisz kolejność" w menu nagłówka                                                      | 13/13 | 2026-09-04           |
| sheet-live-compare — „Porównaj z arkuszem Google" (EX-417)                                                                   | 17/17 | 2026-09-15           |
| kosztorys-filter-conditions — jeden rejestr warunków filtrowania (EX-665)                                                    | 16/16 | 2026-09-15           |
| sheet-column-mapping — ręczne wskazanie kolumny arkusza (EX-690)                                                             | 11/11 | 2026-09-15           |
| kosztorys-terminology — rename identyfikatorów Polish→English (EX-548)                                                       | 5/5   | 2026-09-03           |
| kosztorys-column-order — okno „Ustaw kolejność kolumn" (EX-692)                                                              | 11/11 | 2026-09-04           |
| kosztorys-editor-hook-split — rozbicie hooka edytora (EX-521)                                                                | 22/22 | 2026-09-15           |
| client-preview-settings — ustawienia podglądu inwestora (EX-695)                                                             | 11/11 | 2026-09-15           |
| drop-stage-percent-columns — usunięcie kolumn „% wykonania" per etap (EX-703)                                                | 8/8   | 2026-08-26           |
| filtry-problemy — grupa „Problemy" w menu Filtry — ZDEZAKTUALIZOWANE                                                         | 0/0   | 2026-08-26           |
| nomenklatura inwestora + potwierdzenie zmiany trybu                                                                          | 9/9   | —                    |
| filtry-problemy — osobny przycisk „Problemy" (fazy 5–7)                                                                      | 9/9   | —                    |
| sortowanie-kolumn-spojne — sortowanie w każdej kolumnie z danymi                                                             | 13/13 | 2026-09-15           |
| EX-713 / EX-714 — pasek aktywnych filtrów i trzy nowe pary warunków                                                          | 15/15 | 2026-09-15           |
| EX-711 — moduł floty: przeglądy pojazdów i przypomnienia mailowe                                                             | 28/28 | 2026-09-15           |
| blob-store-isolation — lokalny dev na preview Blob store                                                                     | 11/11 | 2026-09-15           |
| import-zastepuje-w-calosci — import zastępuje całą rozpiskę                                                                  | 7/7   | 2026-09-15           |
| kosztorys-client-view-offer-settlement-variants — warianty „Oferta / Rozliczenie" — ZDEZAKTUALIZOWANE                        | 6/6   | 2026-09-28           |
| sheet-measured-qty-from-formula — „Pomiar z natury" z formuły                                                                | 2/2   | 2026-09-04           |
| mixed-settlement-both-planes — wpłaty na obu planach, jeden bilans na tryb                                                   | 7/7   | —                    |
| EX-720 — nadmiarowe odczyty na trasach kosztorysu                                                                            | 12/12 | 2026-09-15           |
| EX-711 — flota: ręczne znaczniki „do wymiany" i typ „Serwis"                                                                 | 31/31 | 2026-09-15           |
| EX-394 — HEIC: dziura w edycji przelewu + backfill starych faktur                                                            | 12/12 | 2026-09-15           |
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
| EX-699 — wysokość wiersza w edytorze i dopasowanie do treści w podglądzie klienta                                            | 0/0   | 2026-08-31           |
| Stawka „auto" w katalogu prac (2026-09-01, `katalog-prac-auto-rates`)                                                        | 5/5   | 2026-09-03           |
| EX-753 — legacy-sheet-work-import (2026-09-01)                                                                               | 8/8   | 2026-09-02           |
| Kolumny stawek wykonawcy obu planów w widoku Inwestora (2026-09-01, `kosztorys-contractor-price-columns-in-client-view`)     | 0/0   | 2026-09-02           |
| Dwie opcje źródła ceny wykonawcy (2026-09-01, `kosztorys-dwie-opcje-zrodla-ceny-wykonawcy`)                                  | 1/1   | 2026-09-02           |
| Przerzedzanie snapshotów kosztorysu (2026-09-02, `snapshot-retention-thinning`)                                              | 4/4   | 2026-09-15           |
| Zwinięcie nadpisania stawki podwykonawcy (2026-09-02, `subcontractor-override-value-collapse`, EX-766)                       | 8/8   | 2026-09-02           |
| EX-761 — divergent-price-for-same-work (2026-09-02)                                                                          | 0/0   | 2026-09-02           |
| EX-765 — rozbicie `row-conditions.ts` na rejestr i zapytania (2026-09-02, `row-conditions-registry-engine-split`)            | 4/4   | 2026-09-03           |
| EX-748 — zakończona inwestycja jest zablokowana (2026-09-03, `investment-lock-on-completed`)                                 | 14/14 | 2026-09-04           |
| EX-758 — Katalog narzędzi i urządzeń (rejestr sprzętu)                                                                       | 11/13 | 2026-09-15           |
| drag-drop-guard — chybiony drop pliku i widoczne dropzone (2026-09-14)                                                       | 14/14 | 2026-09-15           |
| transfer-print-return — wydruk przefiltrowanej listy transakcji (2026-09-14)                                                 | 15/15 | 2026-09-15           |
| szablony-crud                                                                                                                | 16/16 | 2026-09-15           |
| kosztorys-section-menu-split — akcje sekcji na pasku, akcje pracy na wierszu                                                 | 18/18 | 2026-09-14           |
| transfers-server-sort — sortowanie tabeli transakcji na serwerze (2026-09-15, EX-777)                                        | 13/13 | 2026-09-15           |
| rwd-mobile — RWD na telefonie: nawigacja, dodawanie i pokazywanie transakcji (2026-09-16, EX-785)                            | 7/7   | 2026-09-16           |
| media-upload-serial — równoległy upload gubił pliki na Neonie; szeregowy zapis wierszy `media` (2026-09-22, EX-855)          | 4/4   | 2026-09-22           |
| empty-preset-create — pusty szablon zakładany z listy szablonów (2026-09-22)                                                 | 5/5   | 2026-09-23           |
| szablon-autosave — warsztat szablonu zapisuje się sam (2026-09-22)                                                           | 12/14 | 2026-09-29           |
| kosztorys-editor-assets — galeria assetów w edytorze kosztorysu v2 (2026-09-22)                                              | 8/8   | 2026-09-23           |
| zakladka-inwestycja-w-panelu — zakładka „Inwestycja" w panelu Podsumowanie (2026-09-22)                                      | 25/25 | 2026-09-24           |
| Nowa sekcja wprost w „Dodaj pracę z katalogu" (2026-09-22)                                                                   | 6/6   | 2026-09-23           |
| kategorie-assetow-i-kompresja — kategorie assetów i luźniejsza kompresja (2026-09-22)                                        | 13/13 | 2026-09-23           |
| EX-820 — sufit stawki wykonawcy z „Problemów" do „Filtrów" (2026-09-22)                                                      | 9/9   | 2026-09-29           |
| 2026-10-11 — raporty-removal                                                                                                 | 1/1   | 2026-10-14           |
| clean-texts-catalogue-names — nazwy prac z tabeli poprawek katalogu (2026-09-15)                                             | 13/13 | 2026-09-29           |
| EX-787 — ui/ layering refactor (staging/preview pass, 2026-09-16)                                                            | 10/10 | 2026-09-21           |
| EX-802 — investment-assets-dialog (galeria bez miniatur, 2026-09-21)                                                         | 12/12 | 2026-09-22           |
| katalog-problems — rozjazdy z katalogiem prac jako problemy edytora (2026-09-21)                                             | 9/9   | 2026-09-21           |
| catalogue-compare-bulk-update — hurtowa aktualizacja rozpiski z katalogu (2026-09-21)                                        | 14/14 | 2026-09-21           |
| EX-849 / EX-850 — tagowanie cache galerii i pojedynczy render po uploadzie (2026-09-22)                                      | 8/8   | 2026-09-23           |
| EX-856 — „Filtry" bez bramki widoku, warsztat bez przełącznika cen (2026-09-23)                                              | 8/8   | 2026-09-23           |
| EX-865 — „Własny mnożnik" jako trzecie źródło stawki wykonawcy (2026-09-23)                                                  | 15/15 | 2026-09-29           |
| wydruk-oferty — Wydruk oferty z kosztorysu (2026-09-23)                                                                      | 5/5   | 2026-09-29           |
| zamrozone-brutto-wydatku-netto                                                                                               | 4/4   | —                    |
| pokaz-wszystkie-pozycje                                                                                                      | 8/8   | 2026-09-28           |
| Kosztorys — manager udostępnia inwestorowi + wydruk oferty bez nagłówków (cdd32061, 8a6552c5) — staging 2026-09-24           | 1/1   | 2026-09-24           |
| EX-819 — wartość spoza zakresu odmawiana na głos, nie przycinana (2026-09-28)                                                | 6/6   | 2026-09-28           |
| podglad-inwestora-czytelnosc — podgląd inwestora bez szarości, z pasami kolumn (2026-09-28)                                  | 8/8   | 2026-09-28           |
| sheet-import-wartosc-pomiar — import rozpoznaje „Wartość netto pomiar z natury" (2026-09-28)                                 | 4/4   | 2026-09-28           |
| kosztorys-worker-view — widok i PDF pracownika z menu „Pracownicy" (EX-875, 2026-09-28)                                      | 14/14 | 2026-09-29           |
| kosztorys-remaining-skip-overrun — „Pozostało" bez wierszy na minusie, minus na czerwono (EX-885, 2026-09-28)                | 6/6   | 2026-09-28           |
| szablon-open-speed — „Otwórz szablon" bez przeładowania trasy (EX-876, 2026-09-28)                                           | 11/11 | 2026-09-29           |
| document-column-order — kolejność kolumn inwestora i pracownika ustawiana w ustawieniach (EX-884, 2026-09-28)                | 7/7   | 2026-09-28           |
| investor-change-history — historia zmian w widoku inwestora (EX-881, 2026-09-28)                                             | 9/9   | 2026-09-28           |
| kosztorys-column-value-single-source — sortowanie kolumn liczonych po liczbach z komórek (EX-894, 2026-09-29)                | 13/13 | 2026-09-30           |
| worker-link-revoke — link pracownika do wyłączenia przy blokadzie (EX-888, 2026-09-29)                                       | 6/6   | 2026-09-29           |
| warsztat-per-szablon — szablon jest inwestycją o statusie `szablon` (EX-893, 2026-09-29)                                     | 9/9   | 2026-09-29           |
| investments-list-payout-remaining — „Pozostało do wypłaty" na liście inwestycji (2026-09-29)                                 | 5/5   | 2026-10-02           |
| kosz-inwestycji-manager — kosz inwestycji dla kierownika (2026-09-29)                                                        | 6/6   | 2026-10-14           |
| investment-wycena-status — status inwestycji „Wycena" (2026-09-29)                                                           | 6/6   | 2026-09-29           |
| confirm-dialog-dead-pending — okno potwierdzenia bez martwego stanu „w toku" (EX-835, 2026-09-29)                            | 8/8   | 2026-10-15           |
| 2026-09-29 — pasy kolumn na wydrukach                                                                                        | 3/3   | 2026-09-29           |
| 2026-09-29 — kolumna „Wartość netto (razem etapy)" na dokumencie inwestora                                                   | 3/3   | 2026-09-29           |
| 2026-09-29 — akcja bez sieci kończy się toastem                                                                              | 19/19 | 2026-09-30           |
| EX-933 — global-rabat-on-settlement-axis — rabat kwotowy w netto albo w brutto (2026-09-29)                                  | 11/11 | 2026-09-29           |
| EX-908 — redundant-router-refresh — nieaktualne dane po zapisie, staging (2026-09-29)                                        | 75/75 | 2026-10-01           |
| 2026-09-29 — kosztorys-menu-widths                                                                                           | 3/3   | 2026-10-06           |
| 2026-09-29 — import z arkusza czyta etapy aż do „Przedmiaru"                                                                 | 2/2   | 2026-09-30           |
| 2026-09-29 — nowy etap kopiuje rozliczenie i wykonawcę ostatniego                                                            | 5/5   | 2026-10-01           |
| 2026-09-30 — import z arkusza ustawia jednego wykonawcę wszystkim etapom                                                     | 6/6   | 2026-10-15           |
| 2026-09-30 — „Rozlicz wypłaty": kwota do rozdysponowania i saldo kasy                                                        | 1/1   | 2026-09-30           |
| EX-942 — okna edycji nie gubią wpisanych danych po nieudanym zapisie (2026-09-30)                                            | 3/3   | 2026-10-01           |
| EX-917 — kosz-kas                                                                                                            | 9/9   | 2026-10-01           |
| EX-947 — worker-work-reports — pracownik zgłasza ilości, kierownik przyjmuje (2026-09-30)                                    | 35/35 | 2026-10-15           |
| EX-951 — kosztorys-new-item-dialog — „Nowa praca” jako formularz (2026-09-30)                                                | 15/15 | 2026-10-15           |
| EX-940 — request-failed-actions — zerwane połączenie kończy się polskim komunikatem (2026-09-30)                             | 16/16 | 2026-10-04           |
| 2026-10-01 — marza-v2-half-grosz — lista i strona inwestycji pokazują tę samą marżę v2                                       | 3/3   | 2026-10-01           |
| 2026-10-01 — sidebar-scroll — przy niskim oknie menu boczne się przewija                                                     | 2/2   | 2026-10-03           |
| 2026-10-01 — nazwy-zgloszen                                                                                                  | 2/2   | 2026-10-03           |
| 2026-10-01 — kosz-pod-adminem                                                                                                | 2/2   | 2026-10-03           |
| 2026-10-01 — zgloszenia-prac-pod-pracownikami                                                                                | 2/2   | 2026-10-03           |
| 2026-10-01 — kosz-inwestycji-blokady                                                                                         | 8/8   | 2026-10-03           |
| 2026-10-01 — loader-nad-pytaniem                                                                                             | 3/3   | 2026-10-03           |
| 2026-10-01 — notatki-podzialy-linii                                                                                          | 2/2   | 2026-10-03           |
| EX-918 — kosz-pracownikow                                                                                                    | 19/19 | 2026-10-06           |
| EX-915/916 — kosz-floty-i-sprzetu                                                                                            | 12/12 | 2026-10-03           |
| EX-948 — worker-report-translations-ua — link „Zgłoszenie prac" po ukraińsku i rosyjsku (2026-10-01)                         | 22/22 | 2026-10-15           |
| EX-973 — investment-review-request — prośba o opinię Google dla zakończonej inwestycji (2026-10-02)                          | 2/2   | 2026-10-02           |
| EX-965 — kosztorys-section-translations — nazwy sekcji po ukraińsku i rosyjsku na linku „Zgłoszenie prac"                    | 9/9   | 2026-10-04           |
| 2026-10-02 — investments-listing-no-kosztorys-figures — inwestycja bez kosztorysu pokazuje prawdziwe kwoty v2                | 6/6   | 2026-10-02           |
| EX-979 — premia — premia wyrównuje nadpłatę pracownika, inwestor jej nie widzi (2026-10-02)                                  | 11/11 | 2026-10-15           |
| EX-968 — worker-email-clash — pracownik z e-mailem zajętym przez pracownika z Kosza (2026-10-05)                             | 3/3   | 2026-10-05           |
| EX-960 — worker-kasy-visibility — kasy pracownika na liście i na jego stronie (2026-10-05)                                   | 11/11 | 2026-10-05           |
| 2026-10-05 — share-links-copy-and-404 — nowy link od razu w schowku, cofnięty link mówi „wygasł"                             | 4/4   | 2026-10-05           |
| 2026-10-05 — worker-report-reported-only — „Tylko zgłoszone” i szersza kolumna „Zgłaszam”                                    | 7/7   | 2026-10-14           |
| EX-966 — worker-single-view — jeden widok pracownika: „Zgłoszenie prac" z trybem „Inwestycja"                                | 1/1   | 2026-10-05           |
| 2026-10-05 — worker-view-dogfooding — link `/z/…`, tryby w stopce, liczniki                                                  | 14/14 | 2026-10-15           |
| EX-956 — stage-split-rounding — części podziału etapu sumują się do „Razem" co do grosza (2026-10-05)                        | 3/3   | 2026-10-05           |
| EX-955 — worker-reports-pagination — strony, filtry i sortowanie na liście „Zgłoszenia prac” (2026-10-05)                    | 6/6   | 2026-10-05           |
| 2026-10-05 — settlement-negative-footnote — ujemne „Pozostało do zapłaty” zamiast „Nadpłata”                                 | 3/3   | 2026-10-05           |
| 2026-10-05 — keep-date-on-keep-open — data zostaje po zapisie z „Nie zamykaj”                                                | 3/3   | 2026-10-05           |
| EX-985 — worker-account — pracownik loguje się na własną stronę: kasy, sprzęt, transfery, kosztorysy (2026-10-05)            | 13/13 | 2026-10-06           |
| EX-988 — worker-pdf-translations — j.m. i PDF pracownika w jego języku (2026-10-05)                                          | 11/11 | 2026-10-05           |
| EX-971 — worker-expenses — pracownik zgłasza wydatek z paragonem, kierownik przyjmuje go w Transakcjach (2026-10-05)         | 29/29 | 2026-10-15           |
| 2026-10-05 — pagination-limit-width — „100” mieści się w selekcie „Pokaż”                                                    | 1/1   | 2026-10-05           |
| EX-989 — worker-self-credentials — pracownik zmienia swój e-mail i hasło (2026-10-05)                                        | 10/10 | 2026-10-05           |
| EX-996 — worker-page-language — pracownik ustawia „Domyślny język”, aplikacja i raport idą za nim (2026-10-05)               | 3/3   | 2026-10-06           |
| 2026-10-05 — worker-report-figures — „Wykonano” i „Pozostało” w raporcie pracownika, przełączniki w „Opcje”                  | 8/8   | 2026-10-05           |
| 2026-10-06 — worker-report-pending-only — link pracownika pokazuje tylko zgłoszenia „do sprawdzenia”                         | 5/5   | 2026-10-06           |
| 2026-10-06 — transfers-type-column-width — szersza kolumna „Typ” w tabeli transakcji                                         | 1/1   | 2026-10-06           |
| EX-999 — kosztorys-reorder-dialog — „Ustaw kolejność” (prace i sekcje)                                                       | 18/18 | 2026-10-09           |
| kosztorys-summary-resizable                                                                                                  | 16/16 | —                    |
| EX-1001 — worker-expense-ai-prefill — zgłoszenie pracownika otwiera się z odczytanym paragonem (2026-10-06)                  | 0/0   | 2026-10-06           |
| 2026-10-06 — worker-report-ref-column — numer „Nr” w oknie akceptacji zgłoszeń                                               | 2/2   | 2026-10-06           |
| 2026-10-06 — cash-register-edit-button                                                                                       | 1/1   | 2026-10-06           |
| EX-982 — telmak-invoice-check — sprawdzanie paczki faktur Telmak na stronie kasy Telmak (2026-10-06)                         | 17/17 | 2026-10-06           |
| 2026-10-06 — worker-form-headers                                                                                             | 1/1   | 2026-10-06           |
| 2026-10-06 — nav-user-name-link                                                                                              | 2/2   | 2026-10-06           |
| 2026-10-06 — employee-access-audit — zalogowany pracownik nie widzi i nie zrobi niczego poza swoją stroną                    | 24/24 | 2026-10-06           |
| EX-1006 — kosztorys-ai-knowledge-loop — Komentarz do pracy, przegląd szkicu AI, widoki „Oferta" i „Przegląd AI" (2026-10-07) | 5/5   | 2026-10-15           |
| 2026-10-07 — worker-page-quick-actions — „Dodaj wydatek” i „Zgłoś pracę” nad „Moimi kasami”                                  | 2/2   | 2026-10-09           |
| 2026-10-07 — kosztorys-fit-all-columns — „Dopasuj wysokość do treści” mierzy każdą kolumnę                                   | 5/5   | 2026-10-07           |
| 2026-10-07 — investments-created-at-column — kolumna „Data dodania” na liście inwestycji                                     | 3/3   | 2026-10-07           |
| 2026-10-08 — investment-notes-inline-edit — edycja notatki inwestycji w miejscu                                              | 5/5   | 2026-10-08           |
| 2026-10-08 — other-expense-worker — „Inny wydatek” z opcjonalnym pracownikiem (EX-1027)                                      | 7/7   | 2026-10-08           |
| EX-1017 — template-from-catalogue — szablon jako lista prac z katalogu (2026-10-08)                                          | 14/14 | 2026-10-09           |
| 2026-10-08 — catalogue-usage-columns — kolumny „Kosztorysy” i „Szablony” w katalogu prac                                     | 7/7   | 2026-10-09           |
| 2026-10-08 — expense-draft-missing-pages — odrzucenie zgłoszenia, którego zdjęć nie da się pobrać                            | 3/3   | 2026-10-09           |
| 2026-10-08 — worker-report-columns-default — „Wykonano” i postęp widoczne domyślnie, wybór zapamiętany                       | 2/2   | 2026-10-08           |
| 2026-10-08 — przycisk „Przegląd AI" na pasku narzędzi                                                                        | 3/3   | 2026-10-08           |
| 2026-10-08 — „Komentarz" na widoku inwestora                                                                                 | 3/3   | 2026-10-08           |
| EX-1030 — ai-draft-missing-data — „Komentarz AI” w „Przeglądzie AI”                                                          | 5/5   | —                    |
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
| 2026-10-11 — worker-payout-confirmation — pracownik potwierdza albo odrzuca wypłatę (EX-1042)                                | 12/12 | 2026-10-15           |
| 2026-10-12 — install-button-phone-only — „Zainstaluj aplikację" tylko na telefonie                                           | 2/2   | 2026-10-14           |
| 2026-10-12 — szablon-column-picker — ukrywanie i przesuwanie kolumn w szablonie                                              | 6/6   | 2026-10-14           |
| 2026-10-12 — manual-naming — nazwa „Manual” i etykieta komentarza do pracy                                                   | 2/2   | 2026-10-14           |
| 2026-10-12 — investment-notes-collapsible — zwijane „Notatki” inwestycji                                                     | 4/4   | 2026-10-15           |
| 2026-10-12 — investment-notes-markdown — nagłówki, listy i pogrubienie w „Notatkach”                                         | 3/3   | 2026-10-15           |
| 2026-10-13 — planned-done-percent-red — „% wykonania (względem przedmiaru ofertowego)” na czerwono                           | 2/2   | 2026-10-14           |
| 2026-10-13 — stage-qty-sum-rename — „Pomiar z natury (etapy razem)”                                                          | 2/2   | 2026-10-15           |
| 2026-10-13 — receipt-media-ids-copy — zapis wydatku ze zgłoszenia z wieloma paragonami na jednym zdjęciu                     | 1/1   | 2026-10-15           |
| 2026-10-13 — report-review-layout — kolejność grup i stopka w „Zgłoszenia wykonanych prac”                                   | 3/3   | 2026-10-14           |
| 2026-10-13 — worker-draft-merge-receipts — „Połącz zaznaczone” / „Rozłącz” w „Przyjmij” (EX-1048)                            | 11/11 | 2026-10-15           |
| 2026-10-13 — pending-drafts-collapsible — zwijana sekcja „Wydatki zgłoszone przez pracowników”                               | 3/3   | 2026-10-14           |
| 2026-10-13 — percent-overrun-label — przekroczenie nigdy nie pokazuje „100%”                                                 | 2/2   | 2026-10-14           |
| 2026-10-13 — worker-expense-paragon-decisions — „Przyjmij / Odrzuć” paragon po paragonie, „Połącz zgłoszenia” (EX-1053)      | 19/19 | 2026-10-13           |
| 2026-10-14 — expense-duplicate-finder — „Szukaj duplikatów” na liście transakcji (EX-1026)                                   | 10/10 | 2026-10-15           |
| 2026-10-14 — review-gate-fixes-14 — poprawki z przeglądu commitów z 14.10                                                    | 3/3   | 2026-10-15           |
| 2026-10-14 — ai-stage-new-information — status AI „Nowe informacje”                                                          | 2/2   | 2026-10-14           |
| 2026-10-14 — investment-ai-notes — „Uwagi AI” przy inwestycji                                                                | 4/4   | 2026-10-14           |
| 2026-10-14 — media-plan-hint — pole „Do analizy AI” przy dodawaniu plików                                                    | 1/1   | 2026-10-14           |
| 2026-10-14 — input-shadow — delikatny cień pól tekstowych                                                                    | 1/1   | 2026-10-14           |
| EX-855 — pg-pool-adapter — transakcje na Neonie z własnym połączeniem (staging)                                              | 47/47 | 2026-10-15           |
| 2026-10-14 — komentarz-ai-odstep — odstęp między polami „Komentarza AI”                                                      | 3/3   | 2026-10-14           |
| 2026-10-14 — worker-report-sticky-wobble — nagłówek tabeli w raporcie pracownika nie drga                                    | 1/1   | 2026-10-14           |
| EX-1004 — przełącznik „Zgłoszone wydatki” w transakcjach                                                                     | 15/15 | 2026-10-15           |
| EX-1033 — document-settings-column-map — ustawienia kolumn dokumentów zapisane jako wybór per kolumna                        | 8/8   | 2026-10-15           |
| EX-862 — usun-wszystkie-ukryte — „Usuń wszystkie” schowane w dokumentacji inwestycji do czasu kosza                          | 3/3   | 2026-10-15           |
| 2026-10-15 — media-preview-pdf-preload — podgląd PDF nie kręci się bez końca + wczytywanie sąsiednich stron                  | 6/6   | 2026-10-15           |
| EX-1019 — roundtrip-audit — mniej zapytań na stronę i lżejsza strona (bez zmiany wyglądu)                                    | 10/10 | 2026-10-15           |
| 2026-10-15 — workers-menu-scan-bottom — „Wczytaj zgłoszenie z kartki (AI)” na dole menu „Pracownicy”                         | 2/2   | 2026-10-15           |
| EX-1063 — deploy-scoped-cache — cache kluczowany deploymentem zamiast ręcznych `-vN` (bez zmiany wyglądu)                    | 5/5   | 2026-10-15           |
| EX-1066 — investment-status-rejected — status „Odrzucona” + inwestycje w formularzach przelewów                              | 2/2   | 2026-10-15           |
