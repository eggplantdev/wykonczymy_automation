# Audyt backlogu `e2e-backlog` — 71 issue, 2026-09-15

Zlecenie: (1) wyrzucić nieaktualne, (2) przepuścić resztę przez próbę „koszt testu vs. to, co ten
test daje". Pewne przypadki anulowane od razu; reszta czeka na Twoją decyzję w tym pliku.

## Wnioski w trzech zdaniach

1. **Backlog nie jest za duży — jest na złej warstwie.** Repo ma 330 specek jednostkowych (czysty
   node) i 14 testów Playwrighta, a **pomiędzy nimi nie ma nic**: brak `@testing-library/react`,
   brak `jsdom`. Każde ryzyko renderowe ma więc dziś tylko dwie ceny — test czystej logiki albo
   pełny przebieg `build` + serwer + baza. Stąd 71 wpisów: to nie jest lista rzeczy wartych
   przeglądarki, tylko lista wszystkiego, co nie dało się policzyć funkcją.
2. **~25 pozycji to nie są „pierdoły do wywalenia" — to prawdziwe ryzyka na złym poziomie.**
   Rozjazd nagłówka z danymi (EX-743), draft komórki z przecinkiem (EX-738), pigułka gasnąca przy
   równoległych zapisach (EX-656) — każde z nich test komponentowy łapie w ~50 ms. Kasowanie ich
   wyrzuca sygnał; przeniesienie go zachowuje przy 1/1000 kosztu.
3. **Czerwony spec nie zawsze znaczy „napraw".** `kosztorys-reconciliation.spec.ts` (EX-676) palił
   ~8 min każdego przebiegu od 2026-08-07 na martwym lokatorze — ale ryzyko, którego pilnował
   (dwie powierzchnie rozjeżdżające się po cichu), zostało zaprojektowane na niebyt: obie wołają
   dziś tę samą funkcję i karmią ten sam komponent. **Skasowany, nie naprawiony.** To jest próba,
   którą przechodzi każda pozycja w tym audycie: nie „czy da się to naprawić", tylko „czy to
   ryzyko jeszcze istnieje".

## Ile naprawdę kosztuje jeden spec E2E (liczby, nie odczucia)

| Pozycja                        | Wartość                                         | Skąd                                                    |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------- |
| Przebieg całej suity           | ~1 h                                            | decyzja właściciela zapisana w EX-781                   |
| Testy w suicie dziś            | 14 w 10 plikach                                 | `e2e/`                                                  |
| Rozruch przed pierwszą asercją | pełny `pnpm build` + `pnpm start`, budżet 600 s | `playwright.config.ts` → `webServer`                    |
| Równoległość                   | `workers: 1`, `fullyParallel: false`            | jw. — cała suita szeregowo                              |
| Timeout testu / asercji        | 120 s / 20 s                                    | jw. — **czerwony spec kosztuje 2 min, nie 2 s**         |
| Seed per spec                  | podproces `pnpm seed:*` w `beforeAll`           | `kosztorys-share-link`, `…-global-discount-failed-save` |
| Reset bazy testowej            | 3 komendy, nie jedna                            | `AGENTS.md` → Databases                                 |

Wniosek arytmetyczny: koszt krańcowy specu to jego własny czas **plus** udział w tym, że nikt nie
odpala godzinnej suity przed pushem. Suita, której się nie uruchamia, ma wartość zero niezależnie
od tego, ile testów zawiera — a każdy dołożony spec przybliża do tego progu.

## Rekomendacja nadrzędna — postawić warstwę komponentową

Zanim dopiszesz **którykolwiek** spec z tej listy: `vitest` + `jsdom` + `@testing-library/react`.
Jeden dzień pracy, który zdejmuje ~25 pozycji z godzinnej suity do milisekundowej. Dowód, że to nie
jest teoria: EX-677 został założony **wprost dlatego**, że „repo nie ma harnessu do renderowania
Reacta", a EX-550 Ryzyko 2 pisze to samo („no unit test can reach it — node-env harness, no jsdom").
Backlog sam od miesięcy nazywa tę lukę i za każdym razem odbija ryzyko do Playwrighta.

Kolejność, którą proponuję:

1. **Napraw suitę** (EX-473; EX-676 domknięty kasacją) — bez tego reszta jest bez znaczenia.
2. **Postaw harness komponentowy** i przenieś na niego grupę „ZDEGRADUJ".
3. **Dopisz 8 speców z grupy „ZOSTAJE / priorytet"** — i tylko tyle w E2E.
4. Reszta „ZOSTAJE" czeka, aż ruszysz dany obszar.

---

## Findings

Legenda: `[x]` — sprawa domknięta w Linearze (anulowana) · `[ ]` — czeka na Twoją decyzję.

### Anulowane od razu (pewne — 4)

- [x] · **ANULOWANE** · `EX-412` · Harness Phase 2, czerwone specy transferów — notatka STOP POINT
      z 2026-07-08 z odhaczoną listą: `playwright.warm.config.ts` + `test:e2e:warm` istnieją,
      helper utwardzony w `5c86ad29` tego samego dnia, faza 3 (token 24 h → 7 dni) stoi w
      `AGENTS.md`. Żywa reszta = EX-473, opisana aktualniej. Podwójna księgowość jednego objawu.
- [x] · **ANULOWANE** · `EX-544` · Parytet rekoncyliacji na dwóch powierzchniach — **już
      napisane**: `kosztorys-reconciliation.spec.ts` ma `cross-surface parity`, `mismatch: both
  surfaces scream` i `match: neither surface screams`. Te asercje odeszły razem z EX-676, ale
      nie zostawiły luki: werdykt ma 14 testów jednostkowych. Resztka (filtr URL nie może wywołać
      fałszywego krzyku) jest punktem 4 w EX-634.
- [x] · **ANULOWANE** · `EX-676` · `kosztorys-reconciliation.spec.ts` — 4 testy × 120 s timeoutu
      (~8 min na przebieg) od 2026-08-07. **Spec skasowany, nie naprawiony.** Powstał, gdy
      uzgodnienie renderowały dwie niezależne powierzchnie; dziś
      `kosztorys-editor-body.tsx:339` i `investment-summary-panel.tsx:96` wołają tę samą
      `buildKosztorysReconciliation` i karmią ten sam `SettlementSummary`. Werdykt: 14 testów
      jednostkowych w `lib/kosztorys/reconciliation.test.ts`; wejścia od strony zapytań:
      `financial-golden-master-db`, `investment-render-parity-db`, `investment-financial-fields`.
      Seed `seed:kosztorys-recon` zostaje — używa go `investments-listing-kosztorys.spec.ts`.
- [x] · **ANULOWANE** · `EX-582` · „Odpal spec pasm z głównego drzewa" — spec siedzi w `e2e/` od
      `c1829a2a` (2026-07-26) i został od tego czasu ruszony czterema refaktorami; każdy pełny
      przebieg suity (a takie były — EX-676 opisuje pomiary z sierpnia) go wykonał. Zadanie
      jednorazowe, które zdarzyło się samo.

### Do naprawy natychmiast — to nie jest backlog, to zepsute narzędzie (1, zrobione)

- [x] · **NAPRAWIONE** · `EX-473` · `transfer-create` / `transfer-cancel` — **to nie był flake, tylko
      martwy fixture.** `EXPENSE_INVESTMENT = 'Plac Hellera 3'` nie istnieje w bazie na 5435; jest
      `Plac Hallera 6` (id 108, active). Brakująca opcja → nieudany klik → popover zostaje otwarty
      → następna iteracja wisi na `popper.waitFor({ state: 'detached' })` do timeoutu testu. Stąd
      raportowane „143× locator resolved to visible". Po tej poprawce wyszła druga martwa rzecz:
      przycisk zatwierdzający nazywa się dziś **„Zapisz"**, nie „Dodaj" — czyli „dryf punktu
      awarii" z raportu to były dwa zgniłe lokatory jeden za drugim, nie jeden kruchy helper.
      **Potwierdzone przebiegiem 2026-09-15: oba zielone** (6,1 s i 5,2 s; 1,8 min całości to
      `pnpm build`).

      Oba specy zostają w E2E bez dyskusji: saldo kasy nie jest przechowywane, tylko liczone przy
      odczycie przez funkcje cache'owane, a hooki transferów jedynie unieważniają tagi — żadna
      warstwa niżej tego szwu nie widzi.

### ZOSTAJE — przeglądarka jest jedynym przyrządem (28)

Kryterium: ryzyko żyje wyłącznie na styku zapis → tag cache → render RSC, na trasie bez sesji, na
ingescie pliku albo na czymś, co kasuje dane. Żadna warstwa niżej tego nie widzi.

**Priorytet — te osiem bym napisał:**

- [ ] · ZOSTAJE · `EX-731` · Zaksięgowany transfer rusza figurami inwestycji. Czysty tag cache;
      figura z przemianowanej kolumny „wygląda jak zero, nie jak błąd". Helper już istnieje.
- [ ] · ZOSTAJE · `EX-550` · **Ryzyko 2 zostaje, Ryzyko 1 jest już pokryte** przez
      `kosztorys-share-link.spec.ts` (kontekst bez ciasteczka, 200, treść). Ryzyko 2 to blokada
      ujawnienia: podstawiony `localStorage['kosztorys-view:<id>']='w_tools'` nie może odsłonić
      klientowi bazy kosztowej podwykonawcy. Ryzyko 3 (zero `a[href]` na stronie publicznej) to
      jedna asercja — dołożyć do istniejącego specu, nie do nowego.
- [ ] · ZOSTAJE · `EX-634` · Panel v2 ślepy na filtry. Cztery ryzyka, same odczyty strony, zero
      mutacji → najtańszy wartościowy spec na całej liście.
- [ ] · ZOSTAJE · `EX-741` · Listy odbiorców powiadomień. Stawka: **wysyłka maila do prawdziwych
      adresów pracowników**, które `db:import` rozsypuje po wszystkich środowiskach.
- [ ] · ZOSTAJE · `EX-723` · Gotówka na inwestycji brutto — ostrzeżenie → „Zapisz mimo to" →
      czerwony wiersz. Pieniądze przez wszystkie granice naraz.
- [ ] · ZOSTAJE · `EX-684` · Strata obniża dług klienta. Trzy niezależne mechanizmy liczą ten sam
      dług i muszą się zgodzić.
- [ ] · ZOSTAJE · `EX-769` · Zamek na zakończonej inwestycji. Read-only na trzech płaszczyznach;
      dziura tutaj to zapis do zamkniętej księgi.

**Destrukcyjne — kasują dane, więc brak strażnika jest najdroższy (5):**

- [ ] · ZOSTAJE · `EX-719` · „Wyczyść kosztorys" + import zastępujący całą rozpiskę.
- [ ] · ZOSTAJE · `EX-674` · „Wczytaj szablon…" — dialog wyciera całą rozpiskę.
- [ ] · ZOSTAJE · `EX-520` · Usunięcie pozycji/sekcji/etapu za potwierdzeniem, ze snapshotem.
- [ ] · ZOSTAJE · `EX-428` · Szuflada „Wersje" + przywrócenie snapshotu.
- [ ] · ZOSTAJE · `EX-510` · Blokada usunięcia pozycji z wykonaną pracą.

**Ingest plików — Playwright jest jedyną drogą (5, ale jako JEDEN plik specu):**

- [ ] · ZOSTAJE · `EX-732` · HEIC z pickera edycji przelewu ląduje jako `image/jpeg`.
- [ ] · ZOSTAJE · `EX-661` · Faktury wielostronicowe.
- [ ] · ZOSTAJE · `EX-663` · Doklejanie stron z pickera w tabeli.
- [ ] · ZOSTAJE · `EX-460` · HEIC paragon — miniatura + strażniki w trakcie ingestu.
- [ ] · ZOSTAJE · `EX-444` · Wypełnianie z paragonów (kręgosłup indeksów pozycyjnych).
      → **Scal w jeden `e2e/invoice-ingest.spec.ts`.** Pięć osobnych plików to pięć osobnych
      seedów i pięć razy ten sam rozruch dialogu; jeden plik z pięcioma `test()` płaci to raz.

**Trasa publiczna / ujawnienie danych (3):**

- [ ] · ZOSTAJE · `EX-696` · Ustawienia podglądu klienta faktycznie docierają do linku.
- [ ] · ZOSTAJE · `EX-721` · Warianty „Oferta / Rozliczenie".
- [ ] · ZOSTAJE · `EX-570` · `/k/[token]` — lista wydatków i pobieranie faktur.
      → Wszystkie trzy + EX-550 + EX-681 dotykają tej samej trasy. **Scal w jeden
      `e2e/client-share.spec.ts`**, budowany na istniejącym `kosztorys-share-link.spec.ts`.

**Reszta „zostaje", bez pilności (10):**

- [ ] · ZOSTAJE · `EX-681` · Share pokazuje listę wpłat (renderował pustą — realna klasa błędu).
- [ ] · ZOSTAJE · `EX-604` · `deferRefresh` bez strażnika end-to-end.
- [ ] · ZOSTAJE · `EX-671` · Import z arkusza: preview → confirm → apply.
- [ ] · ZOSTAJE · `EX-687` · „Porównaj z arkuszem" / „Zaciągnij pomiary".
- [ ] · ZOSTAJE · `EX-497` · „Pomiar z natury" read-only i równy sumie etapów — rdzeń domeny.
- [ ] · ZOSTAJE · `EX-679` · Bramka roli w oknie wpłaty (uprawnienia).
- [ ] · ZOSTAJE · `EX-576` · Wydatek netto — bramkowanie formularza i linia netto.
- [ ] · ZOSTAJE · `EX-668` · Kolumny wydatków i bilansów na liście inwestycji.
- [ ] · ZOSTAJE · `EX-728` · 404 dla nieistniejącej inwestycji + zakładka „Wydatki". Dwa
      wczytania strony, zero mutacji — tanie, więc zostaje mimo niskiej stawki.
- [ ] · ZOSTAJE · `EX-771` · Rejestr sprzętu (dodanie → przekazanie → „gdzie jest").

### ZDEGRADUJ — prawdziwe ryzyko, zła warstwa (23)

Nie kasować. Przepiąć na harness komponentowy — **stoi od 2026-09-15**, opis niżej. Każde z nich to
fakt o wyrenderowanym DOM-ie albo o przejściu stanu w hooku — rzeczy, które `jsdom` rozstrzyga
w milisekundach, a Playwright kupuje za pełny `build` + bazę.

- [ ] · ZDEGRADUJ · `EX-743` · Przełącznik kolumn gubi `<th>`, zostawia `<td>` — wartości pod cudzym
      nagłówkiem. Najwyższa wartość w całej tej grupie i najczystszy przykład: to jest asercja o
      liczbie komórek w wierszu.
- [ ] · ZDEGRADUJ · `EX-656` · Równoległe zapisy „Opcji rozliczenia" gaszą sobie pigułkę — wyścig na
      jednym module-level kluczu. Test hooka.
- [ ] · ZDEGRADUJ · `EX-655` · Nieudany skan paragonu zakleszcza formularz — `.finally()` rzuca
      dalej. Test hooka, wręcz podręcznikowy.
- [ ] · ZDEGRADUJ · `EX-677` · Zakładka Marża czyta tę samą płaszczyznę. **Issue samo pisze, że
      blokadą jest brak harnessu Reacta** — dowód na tezę tego audytu.
- [ ] · ZDEGRADUJ · `EX-738` · Kontrakt edycji komórek liczbowych (przecinek, wycofanie, toast).
- [ ] · ZDEGRADUJ · `EX-767` · „Źródło ceny wykonawcy" — auto vs. jawne 0 zł.
- [ ] · ZDEGRADUJ · `EX-742` · Wybór rozliczenia nie przenosi się między otwarciami dialogu.
- [ ] · ZDEGRADUJ · `EX-762` · Reset kwoty przy „auto" (druga połowa — filtrowanie 950 wierszy — to
      pomiar wydajności, nie strażnik regresji; odciąć ją).
- [ ] · ZDEGRADUJ · `EX-657` · Nakładka długiego tekstu w komórce.
- [ ] · ZDEGRADUJ · `EX-757` · Wysokość wiersza / zawijanie opisu.
- [ ] · ZDEGRADUJ · `EX-610` · Wiersz stopki sekcji — figury pod swoimi kolumnami.
- [ ] · ZDEGRADUJ · `EX-484` · Kolumny wartości per etap — render, domyślne ukrycie.
- [ ] · ZDEGRADUJ · `EX-689` · Zakres sortowania w menu kolumny.
- [ ] · ZDEGRADUJ · `EX-614` · Edycja ceny podwykonawcy — Escape, Enter, wirtualizacja.
- [ ] · ZDEGRADUJ · `EX-511` · Inline rename sekcji (+ brak zapisu przy no-op).
- [x] · ANULOWANE · `EX-617` · Pusty kosztorys — podpowiedź zamiast dialogu. Zob. „Kasacje i
      scalenia" niżej.
- [ ] · ZDEGRADUJ · `EX-563` · Picker „Gotówka/Przelew" w trzech formularzach.
- [ ] · ZDEGRADUJ · `EX-715` · Pasek chipów aktywnych filtrów (połowa o linku inwestora → dołączyć
      do `client-share.spec.ts`).
- [ ] · ZDEGRADUJ · `EX-651` · Blok rozliczenia w panelu Podsumowania.
- [ ] · ZDEGRADUJ · `EX-559` · „Podsumowanie podwykonawców" (widoki Z/Bez narzędzi).
- [ ] · ZDEGRADUJ · `EX-637` · Atrybucja per pracownik w tym samym bloku. **Scalić z EX-559** — ten
      sam blok, dwa issue.
- [ ] · ZDEGRADUJ · `EX-638` · Zablokowany spinner salda + dezaktywowany przypisany pracownik.
      Punkt 1 (wyścig `requestRef` w `use-saldo.ts`) to wzorcowy test hooka.
- [ ] · ZDEGRADUJ · `EX-568` · Wybór płaszczyzny narzędziowej etapu → przebudowa podsumowania.
- [ ] · ZDEGRADUJ · `EX-740` · Przestawianie kolumn przetrwa przeładowanie. Sam drag przez
      `framer-motion` jest przeglądarkowy, ale algebra rang i localStorage są już unitowane —
      zostaje asercja o kolejności po remount, czyli jsdom.

### Kasacje i scalenia — wykonane po zgodzie 2026-09-15 (5)

- [x] · **ANULOWANE** · `EX-456` · „Drukuj" dla faktury. Issue samo przyznaje, że trzeba
      podstawić `window.print`, bo natywnego okna nie da się asertować — więc test sprawdza, że w
      popupie jest `<img>` z właściwym `src`. Regresja zdarzyła się raz, przy „modernizacji", i
      pilnuje jej dziś komentarz nośny w kodzie. Obsługa popupów w Playwrighcie jest krucha.
      Koszt wysoki, sygnał niski.
- [x] · **POŁOWA WYCIĘTA** · `EX-762` (sekcja o filtrowaniu ~950 wierszy) · Pomiar wydajności
      przebrany za test. W szeregowej suicie z `workers: 1` liczba czasowa jest szumem. Issue
      zostaje z samą sekcją 1 (reset kwoty przy „auto"), przetytułowane.
- [x] · **ANULOWANE** · `EX-617` · Pusta rozpiska pokazuje podpowiedź, a nie dialog. To
      jest asercja „pusty stan renderuje pusty stan". Jeśli nie wejdzie na harness komponentowy,
      nie jest warta niczego więcej.
- [x] · **SCALONE w `EX-472`** · `EX-505` i `EX-752` anulowane, ich scenariusze wpisane do
      EX-472. Jedna rzecz: struktura rozpiski zmienia się przez menu i utrwala. Jeden spec,
      ~4 `test()`. Przy okazji wycięte: podział dwupanelowy po szerokości (layout) i klawiatura
      na pasku sekcji (test DOM-owy).
- [x] · **SCALONE w `EX-442`** · `EX-674` anulowane, scenariusz „Wczytaj szablon…" wpisany do
      EX-442. Jeden dialog, jedna granica, jeden spec.

### Bez zmian — zostają jak są (4)

- [ ] · ZOSTAJE · `EX-781` · Kolejność na ekranie = kolejność na wydruku. Świeże (2026-09-15),
      opisane pod dzisiejszy stan, ryzyko realne (sort serwerowy vs. wydruk).
- [ ] · ZOSTAJE · `EX-502` · Rabat globalny. **Wymaga przepisania przed napisaniem**: nowy
      `kosztorys-global-discount-failed-save.spec.ts` pokrywa inne ryzyko (rollback nieudanego
      zapisu), a nazwy trybów zjechały („Kwotowy/Procentowy/Wyłączony", nie „kwota zł/procent/brak")
      i kolumny rabatu są dziś **bezczynne** (`perItemDiscountInert`), a nie usuwane z siatki.
- [ ] · ZOSTAJE · `EX-627` · Kafelek „Suma wybranych transakcji" = suma wierszy. `/raporty` nie ma
      dziś żadnego pokrycia, a błąd zawyżał o 71 %.
- [ ] · ZOSTAJE · `EX-528` · Status „Planowana". Zweryfikowane ręcznie, więc niska pilność, ale
      przepływ promocji dotyka bazy.
- [ ] · ZOSTAJE · `EX-756` · Katalog prac — cała powierzchnia zmiany jest przeglądarkowa i nie ma
      ani jednego specu.
- [ ] · ZOSTAJE · `EX-716` · Flota — przeglądy (moduł z wysyłką maili).

---

## Bilans

| Werdykt                                     | Ile |
| ------------------------------------------- | --- |
| Anulowane od razu                           | 4   |
| Anulowane / scalone po zgodzie              | 5   |
| Naprawione (zepsute narzędzie, nie backlog) | 1   |
| Zostaje w E2E                               | 27  |
| Do zdegradowania na warstwę komponentową    | 23  |
| Zostaje bez zmian                           | 6   |

Po wykonaniu: **~29 pozycji w E2E zamiast 71**, a po scaleniach (ingest faktur → 1 plik, trasa
klienta → 1 plik, struktura rozpiski → 1 plik, szablon → 1 plik) to **~20 plików specu**, nie 30.

## Czego nauczyły obie naprawione pozycje

Timeout w tej suicie prawie nigdy nie znaczy „wolna maszyna". EX-676 i EX-473 zgłaszały się
identycznie — testem wiszącym 120 s — a przyczyną w obu był lokator, który przestał opisywać UI.
Playwright czeka na to, czego nie ma, więc gnicie specu i obciążenie maszyny mają ten sam objaw.
Zanim przypiszesz coś flakowi: sprawdź, czy tekst, na który spec czeka, w ogóle istnieje w `src/`,
a fixture — w bazie na 5435.

## Harness komponentowy — postawiony 2026-09-15

Decyzja zapadła i warstwa istnieje. Kształt, bo to nie jest samo „dodaj jsdom":

- **Rozszerzenie wybiera runner.** `vitest.config.ts` ma dwa projekty: `node` bierze
  `src/__tests__/**/*.test.ts`, `dom` bierze `**/*.test.tsx` w jsdom. Spec nie da się przypadkiem
  wylądować na złym silniku, a `scripts/test-integration.sh` dalej wyławia specy bazodanowe
  grepem, nie wciągając przy tym żadnego DOM-owego. Oba projekty jadą pod jednym `pnpm test`,
  czyli pod istniejącą nogą pre-push — bez zmian w hooku.
- **Moduł `'use server'` jest podmieniany, nie importowany.** Next podstawia za niego stub RPC,
  zanim kod trafi do przeglądarki; Vitest nie robi nic, więc **jeden** statycznie zaimportowany
  server action wciągał do jsdom-owego specu Payloada, klienta bazy i żywe gniazdo Nodemailera do
  `EMAIL_HOST` (widziałem to na własne oczy przy pierwszym uruchomieniu: `connect ECONNREFUSED
127.0.0.1:465`). `stubServerActions` w configu robi to, co framework. Każdy stub **rzuca** przy
  wywołaniu — spec komponentowy asertuje UI po drodze do akcji, a jeśli naprawdę potrzebuje, żeby
  akcja się rozwiązała, mówi to wprost przez `vi.mock`.
- **jsdom nie ma silnika layoutu**, więc `matchMedia`, `ResizeObserver` i `scrollIntoView` są
  zaślepione w `src/__tests__/setup/dom.ts`. Radix i cmdk bramkują się na nich; bez zaślepek
  popover montuje się i natychmiast znika, a błąd czyta się jako „zły selektor" — czyli wysyła
  czytelnika w złą stronę.

**Pierwszy spec jest dowodem, nie przykładem zabawkowym.**
`src/__tests__/components/kosztorys/editor/grid/cells/section-header-cell.test.tsx` (6 testów,
**150 ms**) pokrywa dokładnie tę pozycję, którą przy scalaniu wyciąłem z EX-472 jako „nie-E2E":
pasek sekcji jest `role="button"`, a input do zmiany nazwy siedzi w środku, więc każdy klawisz
wpisywany w nazwę dociera też do handlera paska. Ta kolizja weszła na produkcję 2026-09-14 —
spacja zwijała sekcję zamiast wpisać odstęp — i przeszła bez testu z jednego powodu: repo nie
miało renderera DOM. Teraz ma.

Dla porównania: ten sam fakt w Playwrighcie to pełny `pnpm build`, wstanie serwera, baza na 5435
i logowanie — kilka minut na asercję, którą jsdom rozstrzyga w 150 ms.

## Co dalej

Zostało przepięcie 23 pozycji z grupy „ZDEGRADUJ" na nową warstwę. Nie ma już powodu, żeby
którakolwiek z nich czekała na Playwrighta.
