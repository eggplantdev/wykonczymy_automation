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

- [x] · ZOSTAJE · `EX-731` · Zaksięgowany transfer rusza figurami inwestycji. Czysty tag cache;
      figura z przemianowanej kolumny „wygląda jak zero, nie jak błąd". Helper już istnieje.
      **Napisane:** `e2e/investment-expense-figures.spec.ts` (1 test) na `createInvestmentExpense()`
      i istniejącej inwestycji z dumpu — bez seeda. Jedno zaksięgowanie, trzy odczyty: kafel
      kategorii v1 rośnie o kwotę co do grosza, „Bilans inwestora" spada o tyle samo, a panel v2
      ruszył się i pokazuje tę transakcję po opisie w zakładce „Materiały". Kwota z groszami, żeby
      delty nie dało się spełnić przypadkową transakcją obok. Zero klików w „Odśwież dane" między
      zapisem a odczytem — dyscyplina przepisana z `investments-listing-kosztorys.spec.ts`.
      Odczyt figur panelu przeniesiony do `e2e/helpers.ts` (`readSummaryFigures`, `openPanelView`),
      wspólny z `investment-panel-filters.spec.ts`.
- [x] · ZOSTAJE · `EX-550` · **Ryzyko 2 zostaje, Ryzyko 1 jest już pokryte** przez
      `kosztorys-share-link.spec.ts` (kontekst bez ciasteczka, 200, treść). Ryzyko 2 to blokada
      ujawnienia: podstawiony `localStorage['kosztorys-view:<id>']='w_tools'` nie może odsłonić
      klientowi bazy kosztowej podwykonawcy. Ryzyko 3 (zero `a[href]` na stronie publicznej) to
      jedna asercja — dołożyć do istniejącego specu, nie do nowego. **Dopisane** do
      `kosztorys-share-link.spec.ts`: Ryzyko 3 to jedna linia w istniejącym teście (po asercjach
      treści, żeby nie przeszło na pustym renderze), Ryzyko 2 to drugi test — anonimowy kontekst z
      `addInitScript` wstawiającym klucz planu, potem kontrola, że klucz naprawdę siedzi w
      `localStorage` (bez niej literówka w kluczu daje zielono i zero dowodu), i porównanie „Cena
      j.m.": w treści strony musi być cena klienta i nie może być jej odpowiednika × 0,65. Mincowanie
      tokenu wyciągnięte do `mintShareToken`, żeby oba testy stały samodzielnie; `bare()` przeniesione
      do `e2e/helpers.ts` (duplikat z `investment-panel-filters.spec.ts`), a seed band emituje teraz
      `clientPrice`. **Świadomie niepokryte:** allowlista kolumn (druga połowa blokady) — idzie razem
      z klastrem `client-share` (EX-696 / EX-721 / EX-570 / EX-681).
- [x] · ZOSTAJE · `EX-634` · Panel v2 ślepy na filtry. Cztery ryzyka, same odczyty strony, zero
      mutacji → najtańszy wartościowy spec na całej liście. **Napisane:**
      `e2e/investment-panel-filters.spec.ts` (3 testy) na własnym seedzie
      `pnpm seed:panel-filter-blind` — po jednej transakcji każdego typu, więc `?type=<T>` zostawia
      dokładnie jeden wiersz w tabeli, a panel musi stać. Czyta figury z siatek podsumowania
      (jedyne miejsce w apce z `grid-template-columns` w `style`) i porównuje całe rekordy
      etykieta → wartość, więc błąd nazywa figurę. Pokryte: równość figur pod dwoma rozłącznymi
      filtrami + „Suma wybranych transakcji" idąca za filtrem (kontrola, że strona w ogóle
      filtruje), brak przypisów EX-600, parytet „Wpłaty" ze stroną `kosztorys_v2`, krzyk
      niezgodności przeżywający filtr. **Świadomie niepokryte:** `SettlementPlaneWarning`
      i supresja krzyku w `preview` — idą z klastrem `client-share`, bo tam żyje trasa publiczna.
- [x] · ZOSTAJE · `EX-741` · Listy odbiorców powiadomień. Stawka: **wysyłka maila do prawdziwych
      adresów pracowników**, które `db:import` rozsypuje po wszystkich środowiskach. **Napisane:**
      `e2e/notification-recipients.spec.ts` (2 testy, bez seedu — czyta listy zastane w bazie i
      porównuje względem nich). Test 1: dodanie adresu na `/flota` przeżywa reload, a pozostałe trzy
      strumienie czytane z własnych stron (`/sprzet`, `/zgloszenia` ×2) stoją — to jest ta jedna
      rzecz, po którą istnieje read-modify-write w `saveRecipientListAction`; potem usunięcie tego
      samego adresu, co zarazem przywraca fixture. Test 2: ten sam adres wpisany dwa razy ląduje
      jako jeden wiersz, a sąsiednia karta na tej samej stronie się nie rusza. **Zeszło poniżej
      przeglądarki** (dwa spece DOM, 6 testów, zielone): „pusta lista odrzucona" jest przez UI
      nieosiągalna — przy jednym wierszu „Usuń odbiorcę" jest `disabled`, więc to jeden render
      (`recipient-list-form.test.tsx`), nie E2E; bramka MANAGER-a to `canEdit={false}`, czyli brak
      przycisku (`recipient-list-card.test.tsx`) — odmowa samej akcji jest już unit-testowana, a
      drugi zalogowany użytkownik kosztowałby osobny seed i osobny `storageState`.
- [x] · ZOSTAJE · `EX-723` · Gotówka na inwestycji brutto — ostrzeżenie → „Zapisz mimo to" →
      czerwony wiersz. Pieniądze przez wszystkie granice naraz.
      → `e2e/deposit-settlement-plane.spec.ts` (3 testy): „Zapisz mimo to" → wiersz odczytany po
      przeładowaniu, brutto „×", forma „Gotówka", czerwony + zdanie o trybie mieszanym; „Popraw" →
      brak wiersza, formularz zostaje z wpisaną kwotą; przelew na inwestycji netto → żadnego
      pytania, ale wiersz i tak oznaczony. Tryb ustawiany przez UI (`Rozliczenie robocizny`), nie
      seedem — `kosztorys_v2` rozwiązuje inwestycję z `fetchReferenceData`, więc świeżo zasiana
      inwestycja daje tam 404, a formularz wpłaty czyta `settlementMode` z tego samego cache.
      Inwestycje z dumpu: 64 „Wyszogrodzka 7" (brutto) i 119 „Kulisiewicza 16" (netto).
- [x] · ZOSTAJE · `EX-684` · Strata obniża dług klienta. Trzy niezależne mechanizmy liczą ten sam
      dług i muszą się zgodzić.
      → `e2e/investment-loss.spec.ts` (3 testy): jedna strata zaksięgowana prawdziwym dialogiem
      „Wydatek" → „Bilans netto v1" na liście i „Bilans inwestora" na stronie inwestycji rosną o
      dokładnie tę kwotę i zgadzają się ze sobą, a odznaczenie kafelka „Strata" zdejmuje go z sumy
      (ten trzeci mechanizm istnieje wyłącznie w przeglądarce); na v2 w trybie mieszanym
      „Pozostało do zapłaty" spada o tę samą kwotę na netto i na brutto — wartość nominalna, nie
      1,23×, czyli cała różnica między stratą a rabatem; inwestycja bez straty nie drukuje kroku
      0 zł. Nigdzie „Odśwież dane". Inwestycje z dumpu: 137 „testowe inwestycje" (mieszane, 377
      pozycji, zero transferów) i 134 „Foksal 12/14" jako kontrola braku straty.
- [x] · ZOSTAJE · `EX-769` · Zamek na zakończonej inwestycji. Read-only na trzech płaszczyznach;
      dziura tutaj to zapis do zamkniętej księgi.
      → `e2e/investment-lock.spec.ts` (1 test, cykl życia): status ustawiany prawdziwym dialogiem
      „Edytuj inwestycję" (z asercją ostrzeżenia „tylko do odczytu" przed zapisem), bo to jedyna
      droga, która unieważnia `fetchReferenceData` — a z tego jednego cache czytają wszystkie trzy
      powierzchnie. Po zamknięciu: baner read-only, znika „Dodaj", klik w komórkę nie otwiera
      edycji, „Opcje" trzyma „Zapisz jako szablon…" i gubi „Wyczyść kosztorys…", „Wczytaj
      szablon…" i „Arkusz Google" (asercja asymetrii, nie „menu puste"), a dialog „Wydatek"
      otwarty ze strony tej inwestycji ani jej nie podstawia, ani nie pokazuje jej na liście;
      kartoteka („Nazwa") zostaje edytowalna. Potem otwarcie z powrotem oddaje wszystko. Nigdzie
      „Odśwież dane". Inwestycja z dumpu 124 (ma kosztorys **i** podpięty arkusz, więc asercja o
      „Arkusz Google" nie jest pusta), `afterAll` zawsze oddaje ją jako „Aktywna". Odmowy serwera
      **nie** są tu powtarzane — mają już pokrycie jednostkowe; noga „MANAGER nie odblokuje"
      zostaje pod przeglądarką, bo wymaga drugiego `storageState`, a bramka roli jest
      przetestowana jednostkowo.

**Destrukcyjne — kasują dane, więc brak strażnika jest najdroższy (5):**

- [x] · ZOSTAJE · `EX-719` · „Wyczyść kosztorys" + import zastępujący całą rozpiskę.
      → `e2e/kosztorys-versions.spec.ts`, test 1 (cały obieg): dialog liczy to, co zniknie, z
      **renderowanego** drzewa („1 sekcja · 1 praca"), po potwierdzeniu siatka pokazuje „Kosztorys
      jest pusty" bez przeładowania, przeładowanie potwierdza, że to był zapis, ponowne otwarcie
      dialogu ma „Wyczyść" nieaktywne (pusta rozpiska), a w „Wczytaj" stoi **dokładnie jeden**
      punkt „Przed wyczyszczeniem", którego potwierdzenie mówi wprost, że rabat globalny nie
      wraca — i po przywróceniu rozpiska jest z powrotem, też bez przeładowania. Fikstura
      z `seed:kosztorys-recon` (jedna sekcja, jedna praca), bo spec kasuje rozpiskę: inwestycja
      z dumpu zostałaby pusta dla kolejnych specków, gdyby noga przywracania kiedyś padła.
      Seed + rozgrzanie cache wyciągnięte do `seedReconInvestments` w `e2e/helpers.ts` (wspólne
      z `investments-listing-kosztorys.spec.ts`).
      **Noga 3 (import z arkusza) świadomie nie tutaj:** plan importu ma komplet testów
      jednostkowych (`build-import-plan`: „dokładnie prace z arkusza", „upuszcza pracę, której
      arkusz już nie ma"), akcja ma test DB-owy ze snapshotem „Przed importem", dialog ma spec
      DOM-owy, a przeglądarkowa reszta to ta sama ścieżka `replaceTreeWithSnapshot` →
      `onTreeReplaced`, którą ten spec już przechodzi — za cenę żywej zależności od Google. Sam
      przebieg preview → confirm → apply zostaje przy `EX-671`.
- [x] · **ANULOWANE wyżej** · `EX-674` · scenariusz „Wczytaj szablon…" wpisany do `EX-442` (patrz
      „Kasacje i scalenia") — ta linia została tu tylko jako ślad.
- [x] · ZOSTAJE · `EX-520` · Usunięcie pozycji/sekcji/etapu za potwierdzeniem, ze snapshotem.
      → `e2e/kosztorys-deletes.spec.ts`, trzy testy — po jednym na cel kasowania, bo każdy niszczy
      kawałek rozpiski i na wspólnej fiksturze drugi test zastawałby wrak pierwszego. Nowy seed
      `seed:kosztorys-deletes` robi **trzy** świeże inwestycje o tym samym kształcie: dwie sekcje
      (alfa: dwie prace, beta: jedna) na dwóch etapach, każda praca z wpisanymi ilościami na obu.
      Asercje trzymają się tego, czego nie widać poniżej przeglądarki: (1) **„Anuluj" naprawdę
      blokuje** — dialog, po którym wiersz i tak znika, to utrata danych, której żaden test
      jednostkowy nie zobaczy; (2) kaskada **przemalowuje się w prawdziwym gridzie** — sekcja
      zabiera swoje prace, etap zabiera kolumnę i wszystkie ilości w niej, a sąsiad zostaje (samo
      „siatka jest pusta" przeszłoby też, gdyby zniknęło nie to); (3) snapshot, który akcja wymusza
      przed kasowaniem, jest **osiągalny z szuflady, którą właściciel faktycznie otworzy** — jeden
      punkt „Historii automatycznej", z którego praca wraca. Każda noga czytana dwa razy: bez
      przeładowania i po nim, bo grid jest zasiewany do `useState` przy montażu.
      **Punkt 4 z issue („kasowanie bez postępu nie pyta") jest nieaktualny:** dziś potwierdzenie
      jest bezwarunkowe — `KosztorysRowActionsMenu`, `KosztorysSectionActionsMenu` i `StageHeader`
      otwierają `ConfirmDialog` zawsze, bez patrzenia na postęp. Nie ma czego testować; zapisane w
      komentarzu do issue.
      **Świadomie niepokryte:** same odmowy i zapis snapshotu — `kosztorys-delete-guard` uruchamia
      prawdziwe akcje na prawdziwej bazie dla obu przypadków.
- [x] · ZOSTAJE · `EX-428` · Szuflada „Wersje" + przywrócenie snapshotu.
      → `e2e/kosztorys-versions.spec.ts`, test 2 — **ta sama powierzchnia co EX-719, więc ten sam
      plik**: dzielenie ich znaczyłoby dwa razy ten sam seed i dwa razy ta sama szuflada. Nazwana
      wersja („Zapisz") ląduje pod „Nazwane wersje" — samo wyrenderowanie wiersza jest dowodem, że
      lista **doczytała się** (szuflada otwiera się programowo i kiedyś umiała zostać na
      „Wczytywanie…" na zawsze). Przed przywróceniem nie ma ani jednej „Historii automatycznej",
      po przywróceniu jest — czyli przywrócenie zapisało stan, który nadpisało, i pomyłka też jest
      odwracalna. Liczone, nie oglądane: 1 punkt przed, 2 po.
      **Świadomie niepokryte:** rollback nieudanego przywrócenia — ma własny test DB-owy
      (`restore-rollback`), a w przeglądarce trzeba by go udawać.
- [x] · **ANULOWANE** · `EX-510` · „Blokada usunięcia pozycji z wykonaną pracą" — **tej blokady już
      nie ma**. `EX-477` odwróciła politykę S-08: pozycja z wpisanymi ilościami kasuje się za
      potwierdzeniem, a nie odmawia (`delete-policy.ts` nie zna żadnego progu, a
      `kosztorys-delete-guard` ma osobny przypadek „kasuje pozycję z postępem"). Issue prosi więc o
      strażnika nieistniejącego zachowania; druga połowa — „praca bez postępu kasuje się i zostawia
      snapshot" — to dokładnie nogi `EX-520`. Scalone tam, skasowane tutaj.

**Ingest plików — Playwright jest jedyną drogą (5, ale jako JEDEN plik specu):**

- [x] · ZOSTAJE · `EX-732` · HEIC z pickera edycji przelewu ląduje jako `image/jpeg`.
- [x] · ZOSTAJE · `EX-661` · Faktury wielostronicowe.
- [x] · ZOSTAJE · `EX-663` · Doklejanie stron z pickera w tabeli.
- [x] · ZOSTAJE · `EX-460` · HEIC paragon — strażniki w trakcie ingestu.
- [x] · ZOSTAJE · `EX-444` · Wypełnianie z paragonów (kręgosłup indeksów pozycyjnych).
      → **Scalone w jeden `e2e/invoice-ingest.spec.ts` (5 testów).** Pięć osobnych plików to pięć
      osobnych seedów i pięć razy ten sam rozruch dialogu; jeden plik płaci to raz.
      Nic poniżej przeglądarki tego nie dosięga: dekodowanie HEIC to canvas/WASM, kompresja to
      CompressorJS, próg 4 MB mierzy bajty PO kompresji, a sparowanie zdjęcia z wierszem żyje
      wyłącznie w stanie Reacta.
      **EX-732** — po „Zapisz" komórka faktury pokazuje `paragon.jpg`, nie `paragon.heic`: picker
      wyświetla nazwy, które dostał, a nie te, które przeżyły, więc jedynym uczciwym odczytem
      konwersji jest nazwa ZAPISANEJ faktury. Fixture to prawdziwy HEVC-still 1,5 kB.
      **EX-460** — dwie odmowy, każda z własnym komunikatem, i za każdym razem picker wraca do
      „Przeciągnij lub kliknij"; na końcu zapis zostawia przelew bez faktury zamiast ze wskaźnikiem
      na bajty, które nigdy nie doszły.
      **EX-663** — okno „Dodaj fakturę" **wróciło** (`invoice-cell.tsx`), więc ryzyko jest żywe; to
      jedyna powierzchnia, gdzie wybór pliku JEST zatwierdzeniem (brak „Zapisz").
      **EX-444 / EX-661** — te same trzy zdjęcia, dwa różne kształty wyniku, rozstrzygane wyłącznie
      przełącznikiem „Kilka wydatków" / „Jeden wydatek". Odpowiedź skanu jest różna dla każdego
      pliku, więc rozjechanie się wiersza z jego zdjęciem widać jako złą WARTOŚĆ, nie jako brak.
      **Nieaktualne przesłanki w issue (poprawione w komentarzach):** `EX-663` pisał, że dialog
      został usunięty — jest; `EX-444`/`EX-661` mówią o „Dodaj paragony" / „Wypełnij z paragonów" —
      dziś to jeden przycisk „Wygeneruj z paragonów" plus przełącznik trybu.
      **Świadomie niepokryte:** `/api/extract-receipt` jest zaślepione (`page.route`) — model i
      OpenRouter to nie jest ryzyko przeglądarkowe, a ich odpowiedź nie jest deterministyczna.
      **Uwaga infrastrukturalna:** dwa z tych testów zapisują prawdziwe bajty do **preview**
      Vercel Blob (brak fallbacku na dysk w `payload.config.ts`) — magazyn scratch, świadomie.

**Trasa publiczna / ujawnienie danych (4):**

- [x] · ZOSTAJE · `EX-696` · Ustawienia podglądu klienta faktycznie docierają do linku.
- [x] · ZOSTAJE · `EX-721` · Warianty „Oferta / Rozliczenie".
- [x] · ZOSTAJE · `EX-570` · `/k/[token]` — lista wydatków i pobieranie faktur.
- [x] · ZOSTAJE · `EX-681` · Share pokazuje listę wpłat (renderował pustą — realna klasa błędu).
      → **Scalone w jeden `e2e/client-share.spec.ts` (4 testy)**, na wspólnym fixture
      `src/scripts/seed-client-share.ts` (`pnpm seed:client-share`). Mincowanie tokenu wyjęte z
      `kosztorys-share-link.spec.ts` do `e2e/share-link.ts`, żeby oba speki szły tą samą drogą co
      właściciel — spek, który wstawiłby token po cichu do bazy, sprawdzałby trasę, której nikt nie
      chodzi.
      Trasa publiczna to jedyna powierzchnia, na której błąd jest **ujawnieniem danych**, a nie złą
      liczbą: `(share)/layout.tsx` nie montuje `CurrentUserProvider`, więc nie ma tu żadnej bramki
      roli — jedyną granicą są dwie niezależne połowy: allowlista kolumn `PREVIEW_VISIBLE_COLUMNS`
      i przypięcie planu cenowego do `client`. Poniżej przeglądarki nie da się tego sprawdzić:
      pytanie brzmi „co widzi obcy człowiek pod tym adresem", a nie „co zwraca funkcja".
      **EX-721** — różnicę wariantów bierzemy z ich domyślnych zestawów, nie z odklikiwania kolumn:
      „Pomiar (razem etapy)" jest tylko w Rozliczeniu. Test zmienia więc dokładnie JEDNĄ decyzję i
      czyta ją pod TYM SAMYM tokenem. Po drodze łapie też bramkę: przełączenie trybu pyta
      `ConfirmDialog` o potwierdzenie, a „Anuluj" zostawia link nietknięty.
      **EX-696** — odklikanie „Jednostka miary" i pokazanie pustych pozycji dociera do linku, a
      `formatNet(300)` (wykonana robocizna) stoi w obu stanach — czyli ukrycie wiersza nie rusza
      ANI JEDNEJ kwoty. To ta druga połowa ryzyka: filtr widoku nie może być filtrem rachunku.
      **EX-681** — wpłaty mają być czystym tekstem: sprawdzamy obie kwoty na swoich torach
      („Gotówka"/„Przelew") plus podsumy trybu MIESZANEGO, i osobno zero linków w „Liście wpłat" —
      inwestor nie ma dokąd kliknąć, bo za linkiem stoi strona firmy.
      **Nieaktualna przesłanka `EX-570` (poprawiona w komentarzu):** na stronie udostępnionej nie ma
      i nie może być zakładki „Materiały wliczone w robociznę" — `clientVisibleExpenseRows` wycina
      kubełek `settled` w całości. Realne zbiory to „Materiały brutto" i „Materiały rozliczane
      netto", a przycisk nazywa się „Pobierz faktury". Test pilnuje jednego i drugiego: wiersze
      zmieniają się razem ze zbiorem, wydatek rozliczony nie pojawia się nigdzie, a ZIP schodzi z
      nazwą `faktury-*.zip`.
      **Uwaga infrastrukturalna:** seed zapisuje prawdziwą stronę faktury do **preview** Vercel
      Blob (magazyn scratch) i tworzy transakcje z `skipSheetSync`, więc fixture nie ma jak dotknąć
      arkusza właściciela.

**Siatka kosztorysu — zapis i odczyt (2):**

- [x] · ZOSTAJE · `EX-497` · „Pomiar" read-only i równy sumie etapów — rdzeń domeny.
- [x] · ZOSTAJE · `EX-604` · `deferRefresh` bez strażnika end-to-end.
      → **Scalone w jeden `e2e/kosztorys-grid-writes.spec.ts` (2 testy)**, na wspólnym fixture
      `src/scripts/seed-kosztorys-grid.ts` (`pnpm seed:kosztorys-grid`) — dwie świeże inwestycje
      tego samego kształtu, żeby test zapisu pisał po rozpisce, na której test odczytu sprawdza
      dokładne kwoty.
      **Dlaczego razem:** oba issues opisują ten sam gest — wpisanie liczby w komórkę etapu. Jedno
      pyta, co ta liczba robi na ekranie (`EX-497`), drugie — co robi pod spodem (`EX-604`).
      **Nieaktualna przesłanka `EX-497`:** kolumna nie nazywa się już „Pomiar z natury", tylko
      **„Pomiar (razem etapy)"** — nazwa mówi wprost, że to suma, a nie wpis. Sama arytmetyka
      (`O = SUM(D:M)`) jest pokryta jednostkowo; nietknięte zostaje **okablowanie**: że kolumna
      renderuje się jako zablokowana komórka wyliczana w prawdziwej siatce i przelicza się po
      edycji etapu bez przeładowania. Test sprawdza jedno i drugie: w komórce „Pomiar" nie ma
      żadnego `<input>` (kontrolą jest „Przedmiar" w tym samym wierszu, który go ma), wpisanie „99"
      nie rusza figury, a po wpisaniu 5 w „Etap 2" suma i „Pozostało netto" jadą razem, podczas gdy
      wiersz sąsiedni stoi — czyli przeliczenie jest per wiersz, a nie przemalowaniem kolumny.
      **`EX-604`:** zepsuty zapis jest niewidoczny w sesji, która go zrobiła — siatka rysuje wpisaną
      wartość ze swojego stanu bez względu na to, czy cokolwiek doszło do Postgresa. Jedynym
      uczciwym odczytem „zapisało się" jest więc przeładowanie, i to ono stoi na końcu testu; przed
      nim panel „Podsumowanie" czeka na kwotę policzoną po stronie serwera, żeby nie przeładować
      strony przed wylądowaniem zapisu. Sklejanie odświeżeń liczymy na drucie (żądania `RSC` do
      tej trasy, bez prefetchów) i wymagamy **mniej niż jednego na edycję**, a nie dokładnie
      jednego — dokładna liczba byłaby asercją o szybkości pisania Playwrighta, nie o debounsie.
      **Ryzyko 3 z `EX-604`** (inna trasa widzi unieważnienie) jest już pilnowane przez
      `investments-listing-kosztorys.spec.ts` — marża rusza się na `/inwestycje` bez „Odśwież
      dane". Druga kopia nic by nie kupiła.

**Ścieżka arkusza Google — przepięte na warstwę komponentową (2):**

- [x] · ZDEGRADUJ · `EX-671` · Import z arkusza: preview → confirm → apply.
- [x] · ZDEGRADUJ · `EX-687` · „Porównaj z arkuszem" / „Zaciągnij pomiary".
      **Blokada jest w cenie, nie w ryzyku.** Oba działania czytają arkusz **po stronie serwera**,
      więc przeglądarka nie ma jak tego przechwycić — `page.route()` nie widzi wywołania, które
      robi proces Next. Jedyny sposób na test E2E to wpuścić do `getReadonlySheetsClient()` gałąź
      włączaną zmienną środowiskową i podstawić fixture. To znaczy: **dopisać do kodu produkcyjnego
      furtkę, która istnieje wyłącznie dla testu**, na ścieżce czytającej cudze arkusze. Samo
      `EX-687` nazywa to wprost („harness jest większy niż funkcja"); to nie jest powód do odłożenia,
      tylko odpowiedź — ta warstwa jest zła.
      **Co z ryzyk zostaje niepokryte po odjęciu tego, co już stoi:** parser, rozpoznawanie kolumn,
      stawki, porównanie stopki i budowa planu mają ~80 testów jednostkowych; okno importu ma
      `sheet-import-dialog.test.tsx` i `sheet-import-gate.ts`; zapis pomiarów pilnuje test na bazie
      `src/__tests__/lib/actions/kosztorys-import.test.ts`; awarię odczytu — `classify-sheet-failure`.
      Zostawało **jedno**: że po zaimportowaniu edytor faktycznie **przesiewa się na nowy kosztorys**.
      To ryzyko cyklu życia Reacta, nie sieci — `router.refresh()` samo nic nie remontuje, a zatrzask
      `useRestoreRemount` ma dwie ciche awarie w przeciwne strony (remount bez powodu kasuje
      sortowanie i filtry użytkownika; brak remountu zostawia na ekranie kosztorys, którego już nie
      ma).
      → **Dopisane `src/__tests__/components/kosztorys/editor/hooks/use-restore-remount.test.tsx`
      (4 testy, `renderHook`):** świeże drzewo bez uzbrojenia nie remontuje; uzbrojony zatrzask
      czeka, aż token naprawdę się zmieni; strzela raz, nie przy każdym kolejnym odświeżeniu; i daje
      się uzbroić ponownie. Zielone.
      **`EX-686`** (rozjazd „pomiar vs suma etapów"), dopisany do `EX-687` jako „też należne", idzie
      tą samą drogą — czerwony znacznik i filtr „tylko rozjechane" to fakty o wyrenderowanym DOM-ie.

**Wydatek netto i okno wpłaty (2):**

- [x] · ZOSTAJE · `EX-576` · Wydatek netto — bramkowanie formularza i linia netto.
      → **`e2e/investment-expense-netto.spec.ts` (2 testy).** „Wydatek inwestycyjny netto" to jedyny
      typ, w którym dwie kwoty się rozjeżdżają: z kasy schodzi **brutto** (bo to wyszło z rejestru
      i to się tam spina), a inwestora obciąża **netto**. Arytmetyka i kubełkowanie są pokryte
      jednostkowo; przeglądarka odpowiada na jedno — czy formularz oddaje tę parę w całości i czy
      obie kwoty lądują potem każda po swojej stronie.
      Test 1: netto ponad brutto (jedyna kombinacja, której księga nie utrzyma) daje polski błąd
      przy polu i **nie przepuszcza zapisu** — okno zostaje otwarte; po przełączeniu z powrotem na
      wariant brutto pole „Netto" znika, a etykieta wraca do „Kwota" (to etykieta mówi
      użytkownikowi, na której płaszczyźnie pisze).
      Test 2: saldo kasy spada **o brutto**, co do grosza; wiersz w tabeli niesie brutto jako figurę
      główną i „netto …" pod spodem; a księgowanie widać na zakładce „Materiały" panelu.
      **Ryzyko 2 z issue (niezmienność `amount`/`netAmount`/`type`) nie idzie do przeglądarki** —
      `access: { update: () => false }` to reguła Payloada i sprawdza się ją tam, gdzie mieszka, a
      nie klikając w nią.
- [x] · ZDEGRADUJ · `EX-679` · Bramka roli w oknie wpłaty (uprawnienia).
      Z dwóch ryzyk issue jedno jest pokryte **trzy razy**, drugie nie należy do przeglądarki
      z innego powodu.
      Ryzyko 2 (pole inwestycji per typ, zapisany wiersz z „—") stoi na: `clear-fields-for-type`
      (`investmentForType`), `investment-write-guard.test.ts` i bazodanowym
      `investment-write-guard.db.test.ts`, który sprawdza **trwały** wiersz. Spec przeglądarkowy
      przepisałby te same fakty drożej.
      Ryzyko 1 (MANAGER nie widzi „Zasilenia z konta firmowego") jest **świadomie tylko po stronie
      klienta** — czyli nie ma odmowy serwera, którą można by sprawdzić, a jedynym obserwowalnym
      miejscem reguły jest wyrenderowana lista opcji. To fakt o DOM-ie, nie o przejściu granic.
      → **`src/__tests__/components/forms/deposit-form/deposit-type-role-gate.test.tsx` (3 testy):**
      kierownik dostaje dwa typy bez zasilenia, właściciel i admin wszystkie trzy. Zielone.

**Reszta „zostaje", bez pilności (3):**

- [x] · ZDEGRADUJ · `EX-668` · Kolumny wydatków i bilansów na liście inwestycji.
      Połowa to-do jest nieaktualna: lista nie ma dziś ani kolumn per kategoria wydatku, ani kolumny
      „Korekta (bez kategorii)" — `CORRECTION_LABEL` mieszka w kafelkach strony inwestycji, nie na
      liście. Arytmetykę, o którą chodzi, pilnuje już `investment-render-parity-db.test.ts`, i to dla
      **każdej** inwestycji, składając obie strony prawdziwymi ścieżkami renderu — spec
      przeglądarkowy na jednej zasianej inwestycji byłby węższy i droższy.
      Prawdziwa luka to ta, którą issue nazwało blokadą: w bazie testowej było **0** wierszy
      `INVESTMENT_EXPENSE_NET`, więc `materialsNetBilled` i ulga „wszystko netto" stały zamrożone na
      zerze u wszystkich, a oba specy bazodanowe świeciły zielono, nie porównawszy tam niczego.
      → **`src/scripts/seed-materials-net.ts` + `pnpm seed:materials-net:test`** (nowa inwestycja pod
      stałym id, tryb „Mieszane" ze stawką, wydatek brutto + dwa netto + jeden wliczony w robociznę;
      nowa, a nie doklejona do istniejącej, żeby nie wymuszać regeneracji golden mastera)
      i **próg zbioru danych w `investment-render-parity-db.test.ts`**, liczony w porównanym
      zbiorze, nie w bazie. Zweryfikowane w obie strony: z fixture'em zielone, po skasowaniu jego
      wierszy ten sam spec pada na progu.
      Osobno: odcisk inwestycji w golden masterze nie hashuje `materials_net_rate` /
      `settlement_mode` / `vat_rate` — edycja ustawień przychodzi przebrana za dryf kodu. `EX-784`.
- [x] · ZOSTAJE · `EX-728` · 404 dla nieistniejącej inwestycji + zakładka „Wydatki". Dwa
      wczytania strony, zero mutacji — tanie, więc zostaje mimo niskiej stawki.
      → **`e2e/kosztorys-route-guards.spec.ts` (2 testy).**
      Test 1 mierzy **kod odpowiedzi**, nie widok: regresja renderowała wiarygodną stronę pod 200,
      więc sam DOM nie odróżniłby jej od poprawnego 404. Do tego rozstrzygnięcie „Nie znaleziono"
      (not-found) kontra „Coś poszło nie tak" (granica błędu) — to były dwa różne błędy.
      Test 2: zakładka materiałowa renderuje rozbicie „Wydatki inwestycyjne" i zgadza się z wierszem
      „Materiały" z „Podsumowania". Siatkę scope'uje po podpisie — drugie rozbicie („wliczone
      w robociznę") ma własny wiersz „Razem" i bez tego kolidowały.
      Etykieta zakładki to dziś **„Materiały"**, nie „Wydatki" — tekst issue był nieaktualny.
- [x] · ZOSTAJE · `EX-771` · Rejestr sprzętu (dodanie → przekazanie → „gdzie jest").
      `e2e/equipment-registry.spec.ts` — jeden przebieg przez trzy granice, których nie widać niżej:
      „Dodaj sprzęt" zapisuje przedmiot i pierwsze zdarzenie jednym submitem (brak zdarzenia = nowy
      zakup rodzi się w stanie alarmowym „Nie wiadomo gdzie"); „Przekaż" nie przenosi wiersza, tylko
      dopisuje zdarzenie, więc poprzednie miejsce ma zgasnąć samo (`DISTINCT ON`) — na liście i na
      karcie „Na stanie" pracownika; „Edytuj sprzęt" otwiera się na tych samych dniach, które
      zapisano (runda przez `Date` w Postgresie). Magazyn zakładany z wnętrza formularza, więc filtr
      „Gdzie jest" ma opcję trzymającą dokładnie jeden wiersz — to dowód zgody opcji z wierszem.
      Dni nie są wpisane w spec: porównuje to, co wybrał picker, z tym, co odtwarza edycja.
      Poza zakresem (już pokryte niżej): reguła „gdzie jest"
      (`src/__tests__/lib/db/equipment.db.test.ts`), gramatyka opcji filtra
      (`where-filter-options.test.ts`), progi gwarancji (`warranty-digest.test.ts`).

### ZDEGRADUJ — prawdziwe ryzyko, zła warstwa (23)

Nie kasować. Przepiąć na harness komponentowy — **stoi od 2026-09-15**, opis niżej. Każde z nich to
fakt o wyrenderowanym DOM-ie albo o przejściu stanu w hooku — rzeczy, które `jsdom` rozstrzyga
w milisekundach, a Playwright kupuje za pełny `build` + bazę.

- [x] · ZDEGRADUJ · `EX-743` · Przełącznik kolumn gubi `<th>`, zostawia `<td>` — wartości pod cudzym
      nagłówkiem. **Korekta wcześniejszej oceny w tym audycie: to nie jest „asercja o liczbie komórek
      w wierszu".** Objaw powstaje wyłącznie w zbudowanej aplikacji, bo bierze się z pamięci podręcznej
      React Compilera, a ta jest wtyczką Babela działającą tylko w buildzie — pod vitest/esbuild jej
      nie ma, więc samo liczenie komórek przechodzi tak samo z poprawką i bez niej. To, co `jsdom`
      rozstrzyga niepusto, to mechanizm poprawki: zestaw widocznych kolumn jest częścią klucza
      wiersza, więc przełączenie kolumny **wymienia** węzeł `<tr>` zamiast oddać zapamiętany.
      Spec: `src/__tests__/components/ui/data-table/data-table.test.tsx` (5 testów, ~230 ms) —
      zweryfikowany na zepsutym kluczu, pada bez poprawki.
- [x] · ZDEGRADUJ · `EX-656` · Równoległe zapisy „Opcji rozliczenia" gaszą sobie pigułkę — wyścig na
      jednym module-level kluczu. Spec:
      `src/__tests__/components/kosztorys/editor/hooks/use-kosztorys-settings.test.tsx`
      (5 testów, ~25 ms) — zweryfikowany na wspólnym kluczu, pada.
- [x] · ZDEGRADUJ · `EX-655` · Nieudany skan paragonu zakleszcza formularz — `.finally()` rzuca
      dalej. Spec: `src/__tests__/components/forms/expense-form/use-receipt-generation.test.tsx`
      (5 testów, ~50 ms) — zweryfikowany na cofniętym sprzątaniu, padają dwa testy przerwania.
- [x] · ZDEGRADUJ · `EX-677` · Zakładka Marża czyta tę samą płaszczyznę. **Issue samo pisze, że
      blokadą jest brak harnessu Reacta** — dowód na tezę tego audytu. Spec:
      `src/__tests__/components/kosztorys/summary/summary-panel-content.test.tsx` (2 testy, ~170 ms)
      — panel renderowany na celowo rozjechanych płaszczyznach; zweryfikowany na odpiętych propsach.
- [x] · ZDEGRADUJ · `EX-738` · Kontrakt edycji komórek liczbowych (przecinek, wycofanie, toast).
      Spec: `src/__tests__/components/kosztorys/editor/grid/cells/decimal-cell.test.tsx`
      (7 testów, ~220 ms) — zweryfikowany dwoma zepsuciami: komórka wpięta w wiersz zamiast w draft
      (padają oba testy separatora) i wyłączony settle na odmontowaniu (pada strażnik EX-735).
      **Poza specem zostaje reszta zakresu issue**: wklejanie „1 234,5" trzema drogami, Delete na
      zaznaczeniu wielu komórek i sufit „Ceny j.m." podwykonawcy — `cellPaste` / `deleteValue` są
      czystymi funkcjami i należą do specu node'owego, sufit do `EX-767`.
- [x] · ZDEGRADUJ · `EX-767` · „Źródło ceny wykonawcy" — auto vs. jawne 0 zł. Spec:
      `src/__tests__/components/kosztorys/editor/grid/cells/subcontractor-columns.test.tsx`
      (6 testów, ~390 ms) — „Źródło" nie ma własnego pola, etykieta wyprowadza się z tej samej
      kolumny, do której pisze cena, więc para jest obserwowalna na jednym wierszu w jsdom.
      Zweryfikowany testem prawdziwościowym w `modeOf` i `clear` piszącym 0 zamiast `null`.
      **Czwarty punkt issue był fałszywy**: stawki podwykonawcy są w podglądzie klienta zablokowane
      przez allowlistę (`preview-columns.test.ts`), więc E2E asertowałoby render, który ma nie
      nastąpić. Blokada „czeka na staging" znika razem z degradacją.
- [x] · ZDEGRADUJ · `EX-742` · Wybór rozliczenia nie przenosi się między otwarciami dialogu. Spec:
      `src/__tests__/components/kosztorys/editor/dialogs/sheet-import-dialog.test.tsx`
      (4 testy, ~500 ms) — issue samo pisało, że blokadą jest brak harnessu hooków. Host trzyma
      `open`, więc cykl życia niezdemontowywanego dialogu jest w jsdom widoczny wprost.
      Zweryfikowany na usuniętym resecie — padają oba testy, dwa pozostałe zostają zielone.
- [x] · ZDEGRADUJ · `EX-762` · Reset kwoty przy „auto" (druga połowa — filtrowanie 950 wierszy — to
      pomiar wydajności, nie strażnik regresji; odcięta). Spec:
      `src/__tests__/components/forms/work-catalogue-item/work-catalogue-item-form.test.tsx`
      (3 testy, ~300 ms) — cały scenariusz mieści się w jednym formularzu, bez bazy i routingu.
      Zweryfikowany na usuniętym `resetField` — pada dokładnie test odblokowania zapisu.
- [x] · ZDEGRADUJ · `EX-657` · Nakładka długiego tekstu w komórce. Spec:
      `src/__tests__/components/ui/datasheet-grid/long-text-cell.test.tsx` (12 testów, ~290 ms) —
      `LongTextCell` jest domain-free i eksportowany, więc renderuje się bez siatki i bez edytora.
      Zweryfikowany na `swallow` zamienionym w no-op (padają cztery testy przecieków) i na
      `normalize` zwracającym surowy tekst. Przeglądarce zostaje wyłącznie „nic nie prześwituje
      przez nakładkę" — to wygląd, nie zachowanie; zostaje w rejestrze ręcznym.
- [x] · ZDEGRADUJ · `EX-757` · Wysokość wiersza / zawijanie opisu. Spec:
      `src/__tests__/components/kosztorys/editor/hooks/use-wrap-column-widths.test.tsx` (5 testów,
      ~410 ms) — ryzykiem jest pomiar szerokości kolumny, nie sam gest: „Dopasuj wysokość do treści"
      liczy linie z zapamiętanych szerokości, więc pomiar zgubiony przy przewinięciu w bok spłaszcza
      wiersz do jednej linii i to zapisuje. Spec trzyma: wyszukanie komórki nagłówka po KLASIE (a nie
      po pozycji — siatka wirtualizuje kolumny poziomo), zachowanie ostatniej szerokości gdy komórka
      wyszła z DOM, skasowanie szerokości kolumny której widok w ogóle nie renderuje, remeasure na
      resize i stabilną tożsamość obiektu (klucz unieważniania cache wysokości). Zweryfikowany na
      `delete widths[id]` przy braku komórki (pada test przewinięcia) i na pomiarze po indeksie
      (padają wszystkie pięć). Przeglądarce zostają dwa punkty z EX-699, oba czysto kaskadowe:
      nakładka edycji „Opis prac" przycinana przez `overflow: hidden` i uchwyt szerokości kolumny
      przycięty o połowę — to hit-target i wygląd, zostają w rejestrze ręcznym (wiersz EX-699).
- [x] · ZDEGRADUJ · `EX-610` · Wiersz stopki sekcji — figury pod swoimi kolumnami. Spec:
      `src/__tests__/components/kosztorys/editor/grid/kosztorys-synthetic-rows.test.tsx` (7 testów,
      ~30 ms). „Pod właściwą kolumną" nie wymaga siatki: dsg renderuje komórkę KAŻDEJ kolumny na
      każdym wierszu, a tożsamość kolumny niesie `columnData.columnId` — spec odtwarza ten rozstrzał
      i czyta figury po id kolumny. Trzyma: figury sekcji pod swoimi kolumnami i PUSTO pod resztą
      (żadnej osieroconej liczby po ukryciu osi), figury czytane z sekcji tego wiersza, „Razem
      <nazwa>" w „Opis prac" i przeskok na „Sekcja", gdy „Opis prac" ukryty, sumy „Razem" pod
      swoimi kolumnami oraz pierwszeństwo figury nad słowem w kolumnie etykiety, a na realnej
      pozycji delegację do własnej komórki kolumny. Zweryfikowany na `columnId: undefined` (padają
      cztery testy stopki) i na odwróconym pierwszeństwie `slot === 'label'` (pada test
      etykiety-z-figurą). Zwijanie sekcji, sortowanie gaszące bandy i Σ stopek = „Razem" są już
      pokryte node'owo (`section-band-rows.test.ts`, `column-totals.test.ts`); unikalność lokatora
      „Razem" umiera razem ze specem Playwrighta.
- [x] · ZDEGRADUJ · `EX-484` · Kolumny wartości per etap — render, domyślne ukrycie. Dwa specy.
      `src/__tests__/components/kosztorys/editor/grid/stage-value-headers.test.tsx` (5 testów,
      ~40 ms) — nagłówki są `ReactNode`, więc renderują się bez siatki: trzy kolumny etapu noszą jego
      nazwę, rename przesuwa wszystkie trzy, pusta nazwa spada na „Etap N", a kasacja etapu zabiera
      dokładnie jego trzy kolumny i nie rusza nazw sąsiada (klasa off-by-one z issue).
      `src/__tests__/components/kosztorys/editor/hooks/use-hidden-columns.test.tsx` (6 testów,
      ~17 ms) — świeży profil chowa oś brutto i pokazuje netto, przed pierwszym tiknięciem nie pisze
      NIC (rzadka mapa), tik zapisuje jawny `false` i przeżywa remount (= reload), odtiknięcie
      kolumny domyślnie widocznej też, `setAllColumns` idzie jednym zapisem, a zepsuty JSON wraca do
      zadeklarowanych domyślnych zamiast wygasić siatkę. Zweryfikowane odwrotnie: nagłówki wartości
      przestające lustrzeć nazwę (padają 3/5), „pokazanie kolumny = skasowanie klucza" (pada test
      przeżycia reloadu) i `isHidden` bez `DEFAULT_HIDDEN_COLUMNS` (padają 2/6). Punkt 4 z issue
      (migotanie przy zmianie widoku cen, utrata scrolla) to wygląd — rejestr ręczny; punkt 5
      (arytmetyka etapów z rabatem zł) jest już node'owy (`kosztorys-calc.test.ts`).
- [x] · ZDEGRADUJ CZĘŚCIOWO · `EX-689` · Zakres sortowania w menu kolumny. Spec:
      `src/__tests__/components/kosztorys/editor/grid/sort-menu-items.test.tsx` (8 testów) oraz
      `src/__tests__/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.test.tsx`
      (2 testy), łącznie ~470 ms — punkty 1 i 3 z issue: cztery komendy zamawiają dokładnie swój kierunek
      i zakres (jeden gest, żaden zakres nie działa niezauważony), „Zapisz kolejność" jest w menu
      przy zakresie globalnym i znika tam, gdzie nikt nie może pisać, „Wyczyść sortowanie" martwe
      bez sortowania i zdejmujące je, gdy jest, a w menu wiersza wstawianie i przesuwanie gasną przy
      aktywnym sortowaniu i wracają po jego zdjęciu. Zweryfikowany na zdjętym `disabled={sortActive}`
      (pada test wyszarzenia) i na zakresie globalnym po cichu zamienionym na sekcyjny (padają dwa).
      Punkt 2 jest już node'owy (`section-band-rows.test.ts` — bandy gasną przy sortowaniu).
      **Punkty 4–6 zostają E2E** i issue zostaje w backlogu z etykietą: pieką kolejność do bazy i
      pytanie brzmi „co przeżywa reload" (plus undo i to, że zapis przy wpisanej frazie porządkuje
      cały kosztorys, nie tylko widoczne wiersze) — to przecina klient → akcja → DB → reload, czyli
      dokładnie ten przypadek, dla którego Playwright istnieje.
- [x] · ZDEGRADUJ · `EX-614` · Edycja ceny podwykonawcy — Escape, Enter, wirtualizacja. Spec:
      `src/__tests__/components/kosztorys/editor/grid/cells/subcontractor-price-edit.test.tsx`
      (8 testów, ~400 ms) — wszystkie sześć ryzyk z issue zeszło do DOM-u: odrzucona cena wraca do
      stanu sprzed edycji z komunikatem (a zatwierdzony prefiks nie zostaje na wierszu), zdanie
      odmowy staje pod palcami bez najeżdżania myszą, cena dokładnie na suficie przechodzi, Escape
      porzuca edycję i późniejszy blur nie rozlicza jej drugi raz, Enter zatwierdza dokładnie raz i
      oddaje komórkę siatce, szkic nie schodzi na wiersz podmieniony pod kursorem (wirtualizacja),
      input nie przemontowuje się w chwili pojawienia się werdyktu (EX-422), a stojący werdykt
      odsłania się, gdy siatka wchodzi w odrzuconą komórkę.
      Zweryfikowany odwrotnie: zdjęta strażnica `closed.rowId === rowData.id` w `useCellDraft`
      wywraca test wirtualizacji, a `CellTooltip` zwracający gołe dzieci przy braku komunikatu
      wywraca test przemontowania.
      Ryzyko 1 mówiło też o kolumnie „Mnożnik" — ta kolumna już nie istnieje: EX-766 zwinął parę
      kolumn w jedno nullowalne pole ceny plus „Źródło", więc ta połowa ryzyka jest nieaktualna, a
      parę cena/źródło trzyma `subcontractor-columns.test.tsx`.
- [x] · ZDEGRADUJ · `EX-511` · Inline rename sekcji (+ brak zapisu przy no-op). Spec:
      `src/__tests__/components/kosztorys/editor/grid/cells/section-name-cell.test.tsx`
      (8 testów, ~280 ms) — nazwa zapisuje się na wyjściu z komórki i idzie na sekcję, nie na wiersz;
      Enter zatwierdza dokładnie raz; samo przejechanie tabulatorem przez komórkę nie zapisuje nic i
      tak samo nazwa wpisana z powrotem na tę samą (strażnica no-op, po którą issue było napisane);
      Escape porzuca edycję i pokazuje z powrotem nazwę sekcji; poza edycją komórka pokazuje nazwę
      nadaną z panelu, nie porzucony szkic; w trybie do czytania nie ma w ogóle pola do pisania, a
      `deleteValue` oddaje wiersz nietknięty, więc Delete na zaznaczonej komórce nie czyści sekcji.
      Zweryfikowany odwrotnie: zdjęta strażnica `draft !== startedWith` wywraca oba testy no-opu,
      a komórka pokazująca szkic także poza edycją wywraca pięć z ośmiu.
      „Widać bez przeładowania" nie jest ryzykiem dla E2E: to optymistyczny patch wierszy po stronie
      klienta, a sam zapis to sześciolinijkowa `updateSectionFieldAction` na wspólnym torze
      `investmentAction` (auth, blokada, rewalidacja), który ma własne specy.
- [x] · ANULOWANE · `EX-617` · Pusty kosztorys — podpowiedź zamiast dialogu. Zob. „Kasacje i
      scalenia" niżej.
- [x] · ZDEGRADUJ · `EX-563` · Picker „Gotówka/Przelew". Spec:
      `src/__tests__/components/forms/deposit-form/deposit-payment-method.test.tsx`
      (4 testy, ~2,3 s) — odpowiedź pickera dociera do zapisu (gotówka, gdy nikt nie ruszył pola;
      przelew, gdy wybrano przelew), metoda przestawia płaszczyznę kwoty (gotówka pyta o jedną
      kwotę, przelew o parę brutto/netto) i brutto idzie jako kwota, a netto z faktury obok — nie
      odwrotnie.
      Zweryfikowany odwrotnie: zakodowana na sztywno metoda `CASH` w `toData` wywraca trzy z
      czterech testów.
      Jedna trzecia zakresu issue jest nieaktualna: formularz przesunięcia międzykasowego
      (`internal-transfer-form/`) nie niesie w ogóle `paymentMethod`, a `carriesPaymentMethod`
      obejmuje wyłącznie `INVESTOR_DEPOSIT` i `INVESTMENT_EXPENSE_NET` — więc „trzy formularze" to
      dziś dwa, i to ten jeden, w którym metoda JEST płaszczyzną VAT, niesie całe ryzyko. W
      formularzu wydatku metoda jest jednolinijkowym przepisaniem wartości bez żadnego rozgałęzienia
      — nie ma tam czego zepsuć osobno.
- [x] · ZDEGRADUJ CZĘŚCIOWO · `EX-715` · Pasek aktywnych filtrów + zwijanie sekcji. Trzy z czterech
      punktów zeszły do DOM-u, trzema specami:
      `src/__tests__/components/filters/search-filter-input.test.tsx` (5 testów, ~780 ms) —
      wyścig debounce'a z punktu 2, czyli realny błąd z bramki 2026-08-18 naprawiony wtedy bez testu:
      wyczyszczenie frazy w trakcie odliczania nie przywraca jej pół sekundy później, po odmontowaniu
      pole już nie odpytuje, a bez opóźnienia każdy znak idzie od razu. Pole stoi w czternastu
      miejscach aplikacji, więc to najtańsza dźwignia w całym audycie.
      `src/__tests__/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar.test.tsx`
      (8 testów, ~130 ms) — punkt 1: pasek wymienia wszystkie cztery źródła naraz, X przy chipie
      zdejmuje dokładnie swoje (problem przez wybór wyłączny, nie zwykłe przełączenie), sekcje
      rozwijają się jednym X, „Wyczyść wszystko" nie staje obok jednego chipa, a przy zerze chipów
      paska nie ma w ogóle.
      `src/__tests__/components/kosztorys/editor/grid/cells/section-header-cell.test.tsx`
      (7 testów, ~140 ms) — punkt 4: strzałka i tytuł belki zgadzają się ze zbiorem, który dostaje
      siatka; belka zwija się kliknięciem w dowolne miejsce, Enterem i spacją, ale nie łapie klawiszy
      wychodzących z pola nazwy ani kliknięcia w nazwę; komórka „Akcje" jako jedyna nie zwija.
      Zweryfikowane odwrotnie: zdjęta adopcja wartości z zewnątrz w `SearchFilterInput` wywraca oba
      testy wyścigu, chip problemu podpięty pod zwykłe `toggleCondition` wywraca test wyboru
      wyłącznego, a zdjęta strażnica `event.target !== event.currentTarget` wywraca test klawiszy z
      pola nazwy.
      Punkt 4 miał też drugą połowę — „także gdy włączony filtr rozłożył zwinięcie". Ta jest już
      pokryta: `collapsedSectionIds` wychodzące z `use-kosztorys-view-state` JEST zbiorem po
      wygaszeniu, a `isFoldSuppressed` ma własny spec node'owy; belka i pasek czytają ten sam zbiór,
      więc nie mają jak się rozminąć.
      **Punkt 3 zostaje E2E** i issue zostaje w backlogu z etykietą: sekcje zwinięte przed
      udostępnieniem mają przyjść zwinięte na linku dla inwestora, co przecina edytor → zapis →
      publiczny link. Reguła (`isFoldSuppressed` kontra schowek klienta) jest unitowana, samo
      przejście nie — i to jest dokładnie ten przypadek, dla którego Playwright istnieje. Dołączyć do
      `client-share.spec.ts`.
- [x] · ZDEGRADUJ · `EX-651` · Blok rozliczenia w panelu Podsumowania. Zeszedł w całości do DOM-u:
      `src/__tests__/components/kosztorys/summary/settlement-block.test.tsx` (7 testów, ~1,2 s).
      Tryb przestawia kolumnę kwot — netto pokazuje netto, brutto przestawia CAŁĄ kolumnę (Łącznie
      61 500,00, wpłata przelewem 12 300,00 brutto, Pozostało 49 200,00), więc widać płaszczyznę, a
      nie sam nagłówek. Blok czyta się w dół: wpłata gotówką 10 000 netto plus netto z faktury
      10 000 to 20 000 zdjęte z 50 000 i Pozostało 30 000. Wiersz wpłat prowadzi na listę wpłat
      inwestycji. Stawka na materiały pod trybem brutto jest wyszarzona z powodem, a pole stawki
      znika; w trybie netto wraca jedno i drugie.
      Zweryfikowane odwrotnie: `GROSS → 'net'` w `MONEY_AXIS_BY_MODE` wywraca test brutto, a zdjęty
      `pricingLockedReason` wywraca test wygaszonej stawki materiałów.
      **Ryzyko 1 było nieaktualne w połowie**: „dwa tory („Rozliczenie netto" / „Rozliczenie
      fakturą") dla trybu Mieszane" już nie istnieją — `buildSettlementGroups` zwraca JEDNĄ grupę, a
      Mieszane rozlicza się na netto (ruling właściciela 2026-08-20, commit `c7b62b64`). Zostało to
      przekute w test broniący obecnego kształtu: jedno „Pozostało do zapłaty", żadnego „Rozliczenie
      fakturą".
- [x] · ZDEGRADUJ · `EX-559` + `EX-637` · „Podsumowanie podwykonawców" i atrybucja per pracownik —
      jeden blok, więc jeden spec:
      `src/__tests__/components/kosztorys/summary/blocks/subcontractor-summary.test.tsx`
      (7 testów, ~250 ms). Cała arytmetyka jest już unitowana (`subcontractor-summary.test.ts` ma
      nawet trzy rodzaje czerwieni i kolejność wierszy), więc DOM broni tego, czego node nie widzi:
      wiersz prowadzi na wypłaty tej JEDNEJ osoby, reszta nieprzypisana zostaje bez linku i bez
      żadnego z trzech zdań o człowieku, nadpłata mówi „Wypłacono więcej niż wykonano" plus
      „nadpłacone" przy kwocie, a zaliczka na nierozpoczęty etap mówi „Przypisane etapy bez
      wykonanych prac" i NIE krzyczy jak nadpłata. „Razem" domyka wiersze tą samą trójką kwot, którą
      podaje nagłówek obok. Host kompaktowy (strona inwestycji) zostawia trzy kwoty i zdejmuje
      rozbicie na płaszczyzny, tabelę pracowników i listę wypłat.
      Druga połowa EX-637 — potwierdzenie przepisania etapu — poszła osobno, bo to inny plik:
      `src/__tests__/components/kosztorys/editor/grid/reassign-worker-confirm-dialog.test.tsx`
      (6 testów, ~130 ms): pytanie nazywa kwotę, poprzednią osobę i nową, „Bez przypisania" jest
      pełnoprawnym celem (a nie „nieznaną osobą"), brak poprzedniej osoby czyta się jako „nieznana
      osoba", nic nie stoi na ekranie dopóki nic nie jest w toku, a potwierdzenie oddaje wybraną
      osobę (i `null` przy zdjęciu przypisania), nie samo „tak".
      Zweryfikowane odwrotnie: `no_executed_work` przepięty na tekst i ton nadpłaty wywraca test
      zaliczki, a „Bez przypisania" podmienione na „nieznana osoba" wywraca test zdjęcia przypisania.
      **Nieaktualne w EX-559**: „przełączenie widoku cen na Z narzędziami / Bez narzędzi podmienia
      klienckie Podsumowanie na blok podwykonawców" — blok stoi dziś na własnej zakładce
      „Podwykonawcy" (`SummaryViewT`), a widok cen go nie przełącza. Z tej samej przyczyny odpada
      punkt o braku kontrolki netto/brutto „w widokach podwykonawczych": bramką zakładek jest
      `allowedSummaryViews`, który ma własny spec node'owy.
      **Nieaktualne w EX-637**: warunek wstępny „wyeksportuj `pickComboOption` z `e2e/helpers.ts`"
      jest bezprzedmiotowy — nie powstaje żaden spec Playwrighta.
- [x] · ZDEGRADUJ · `EX-638` · Zablokowany spinner salda + dezaktywowany przypisany pracownik.
      Dwa spece DOM-owe, po jednym na ryzyko:
      `src/__tests__/components/forms/hooks/use-register-balance.test.tsx` (6 testów, ~20 ms,
      `renderHook` z ręcznie rozstrzyganą odpowiedzią) — saldo wchodzi, gdy nic go nie wyprzedziło;
      spóźniona odpowiedź nie wpisuje salda kasy, którą w międzyczasie wyczyszczono; czyszczenie gasi
      spinner OD RAZU, nie czekając na odpowiedź (to jest ta regresja: wyparte zapytanie ma własne
      `finally` bezsilne, więc reset musi zgasić flagę sam); nowsza kasa zostaje na ekranie, choćby
      starsza wróciła później; przewrócone zapytanie nie toastuje; pusta kasa czyści zamiast
      odpytywać.
      `src/__tests__/components/kosztorys/editor/grid/stage-worker-section.test.tsx` (4 testy,
      ~250 ms) — osoba trzymająca etap zostaje na liście, choć już tu nie pracuje; wygaszona osoba
      bez etapu wraca dopiero po rozszerzeniu listy; „Bez przypisania" stoi poza wyszukiwaniem, więc
      etap da się uwolnić bez czyszczenia frazy; wybór oddaje id osoby.
      Zweryfikowane odwrotnie: zdjęte `setIsRegisterBalanceLoading(false)` z resetu wywraca test
      spinnera, a `activeOrSelected` podmienione na zwykły filtr aktywnych wywraca test osoby
      trzymającej etap.
      **Nieaktualne w opisie**: `use-saldo.ts` i `requestRef` już nie istnieją — od `f4086127` to
      `use-register-balance.ts` nad `createLatestRequest` (`src/lib/utils/latest-request.ts`), który
      ma własny spec node'owy; sam wybór „aktywni albo zaznaczony" też jest już unitowany
      (`is-active-ref.test.ts`), więc DOM broni tu wyłącznie podpięcia.
- [x] · ZDEGRADUJ · `EX-568` · Wybór płaszczyzny narzędziowej etapu → przebudowa podsumowania.
      Matematyka (kto widzi który etap, ile wynosi razem, kiedy podnosi się flaga) jest już w
      całości unitowana w `subcontractor-due-by-plane.test.ts`, więc zostały dwa czytania z ekranu:
      `stage-header-plane.test.tsx` (5) — nagłówek znakuje etap bez rozliczenia, zdejmuje znak po
      wyborze, oddaje wybór z menu, a roster czeka na rozliczenie zamiast milczeć; plus dwa testy
      dopisane do `blocks/subcontractor-summary.test.tsx` — znak przy „Suma wykonanej pracy", gdy
      któryś etap nie ma rozliczenia.
      **Nieaktualne w issue:** punkt o „nie dotyczy" w komórkach ilości poza płaszczyzną — dziś etap
      spoza widoku nie dostaje kolumny w ogóle (`stagesForView`), więc nie ma czego oznaczać ani
      odblokowywać; a blok podsumowania nie jest już przełącznikiem widoku cen, tylko zakładką
      „Podwykonawcy".
- [x] · ZDEGRADUJ · `EX-740` · Przestawianie kolumn przetrwa przeładowanie. Sam drag przez
      `framer-motion` jest przeglądarkowy, ale algebra rang i localStorage są już unitowane —
      zostaje asercja o kolejności po remount, czyli jsdom.
      `components/ui/data-table/data-table-column-order.test.tsx` (6): kolejność zadeklarowana bez
      zapisu, przestawienie widoczne od razu i zapisane, świeże montowanie odtwarza zapis (czyli
      przeładowanie), zapis wstawiony z zewnątrz też jest czytany, „Przywróć domyślną kolejność"
      wraca do deklaracji i czyści klucz, a schowana kolumna zostaje schowana — dwa osobne klucze.
      **Świadomie niepokryte:** sam pointer-drag w `Reorder.Group`. Spec sięga tam, gdzie sięga
      `onDragEnd` dialogu, czyli do `setRank` z policzoną rangą; gest myszy zostaje bez testu.

### Kasacje i scalenia — wykonane po zgodzie 2026-09-15 (6)

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
- [x] · **ANULOWANE (scalone w `EX-520`)** · `EX-510` · „Blokada usunięcia etapu z wpisanymi
      ilościami". Ryzyko zniknęło razem z blokadą: EX-477 odwrócił politykę — dziś żadne usunięcie
      nie jest odmawiane, wszystkie idą przez jedno `ConfirmDialog` z wymuszonym snapshotem. Nie ma
      czego asertować poza tym, co robi już `e2e/kosztorys-deletes.spec.ts`.

### Bez zmian — zostają jak są (4)

- [x] · ZOSTAJE · `EX-781` · Kolejność na ekranie = kolejność na wydruku.
      `e2e/transfer-sort-and-print.spec.ts`. Regresja z EX-777 polegała na tym, że obie kolejności
      były z osobna poprawne: tabela sortowała stu pobranych wierszy, a „Drukuj" dociągał cały zbiór
      i sortował **drugą, niezależną** instancję. Rozjazd widać dopiero, gdy postawi się je obok
      siebie — czego żadna warstwa niżej nie zrobi, bo jedną kolejność produkuje serwerowy
      `payload.find`, a drugą klient, i nigdy nie spotykają się w jednym procesie. Asercje: klik
      w nagłówek „Kwota" dociera do URL-a (kierunek **odczytany** z parametru, nie założony — to
      domyślka TanStacka, nie przedmiot testu), druga strona **kontynuuje** pierwszą (sort po
      załadowanej stronie zaczynałby od nowa), a wydruk otwiera się tymi samymi ID w tej samej
      kolejności co ekran. Powierzchnia: „Kasa główna Bartek" — jedyna, która ma oba składniki
      naraz (kilkaset transakcji, czyli wiele stron, i przycisk „Drukuj", którego pulpit nie
      renderuje). `window.print` wygaszony init-scriptem: headless blokuje na nim **okno otwierające**,
      bo stamtąd leci wywołanie. Poza zakresem (pokryte niżej): gramatyka `?sort=`, zgodność
      whitelisty z kolumnami UI, sort obejmujący cały zbiór (`transfer-sort-spans-dataset.db.test.ts`).
- [x] · ZOSTAJE · `EX-502` · Rabat globalny. `e2e/kosztorys-global-discount-overrides.spec.ts`,
      przepisany — issue opisywało stan, którego już nie ma. Dwie jego przesłanki padły: **nie ma
      dwóch powierzchni sum** (pasek z figurą zniknął, został przycisk „Pokaż podsumowanie" bez
      liczby, więc ryzyko „obie sumy się rozjeżdżają" nie ma dziś dwóch stron), a **„%" przestało
      być trybem** — to jednorazowy stempel wpisujący ten sam procent w rabat każdej pozycji,
      nieodwracalny, z dialogiem zamiast undo. Zostaje samo nadpisanie, z obu stron: „Kwotowy"
      **omija** rabaty per pozycja, nie kasując ich (`applyDiscount` zwiera na `globalDiscountActive`)
      i wyciąga cztery kolumny rabatu z siatki (`column-selection.ts` → `DISCOUNT_COLUMN_IDS`) —
      poprzednia nota mówiła, że kolumny zostają „bezczynne"; to nieprawda, `perItemDiscountInert`
      dotyczy wpisów w „Problemy", nie kolumn. Powrót na „Wyłączony" musi oddać i kolumny, i 50 zł
      z pozycji, bo dane nigdy nie zostały ruszone. Liczby (`globalDiscountAmount`, `applyDiscount`)
      są pokryte jednostkowo — spec pilnuje wyłącznie okablowania: jeden wybór w „Opcje rozliczenia"
      sięga w tym samym renderze kolumn siatki i figur panelu, a reload mówi, co naprawdę trafiło do
      Postgresa. Poza zakresem: rollback nieudanego zapisu (`kosztorys-global-discount-failed-save`).
- [x] · ZOSTAJE · `EX-627` · Kafelek „Suma wybranych transakcji" = suma wierszy.
      `e2e/transfer-sum-tile.spec.ts`. Ryzyko przeniesione z `/raporty` — strona jest wygaszona
      („W budowie", czeka na EX-598), a kafelek żyje dziś na każdej tabeli transferów i pokazuje się
      tylko przy aktywnym filtrze. Spec celuje w **pulpit**, bo jego `where` to samo
      `buildTransferFilters`: kasa/inwestycja/pracownik dodatkowo zawężają po polu, którego wiersz
      CANCELLATION nie niesie, więc ucinałyby dokładnie ten wiersz, o który chodzi. Szew jest
      niewidoczny niżej: lista to Payloadowy `Where`, kafelek to drugi strzał surowym SQL-em
      (`sumFilteredByType`) zbudowany z tego samego `Where` przez `stripCancelledFilters` — rozjazd
      z EX-574 (+71 %) brał się stąd, że anulowanie kopiuje kwotę oryginału i ma `cancelled = false`.
      Dwa tryby, ta sama umowa: domyślnie kafelek **równa się** sumie widocznych „Kwot" i nie ma
      dymka; z „pokaż anulowane" lista rozszerza się o wiersze, których suma z definicji nie liczy —
      i wtedy aplikacja mówi to wprost dymkiem, zamiast wydrukować cichy rozjazd. Kwota dwucyfrowa po
      przecinku (trafienie dokładne), a asercja porównuje kafelek z tym, co lista pokazuje, nigdy
      z literałem — dump może nieść ten sam grosz.
- [x] · ZOSTAJE · `EX-528` · Status „Planowana". `e2e/investment-planowana-status.spec.ts`, zawężony
      z pięciu proponowanych asercji do jednej. Trzy odpadają, bo mają tańszy strażnika albo pilnują
      nie-funkcji: widoki filtra statusu to dokładnie to, co już sprawdza
      `src/__tests__/use-status-filter.test.ts` (domyślnie active + planowana, „Planowane" izoluje,
      „Wszystkie" pokazuje wszystko), „badge jest read-only" to asercja o `<span>`, a zerowe figury
      świeżej inwestycji wynikają z braku transakcji, nie ze statusu. Zostaje jeden fakt czytany przez
      **dwie powierzchnie**, które nie mogą się rozjechać: prospekt **nie jest** aktywną inwestycją —
      jest na liście i da się go otworzyć, ale licznik „N aktywnych" go pomija, a picker „Inwestycja"
      w dialogu wydatku go nie oferuje, bo pieniądze nie mogą wylądować na nieuzgodnionym deal’u. Oba
      odczyty idą z tego samego cache’u `fetchReferenceData` (`active: status === 'active'`), więc
      promocja musi przestawić je **naraz** — i to jest test zarówno zapisu, jak i rewalidacji, którą
      akcja jest mu winna: formularz → server action → Postgres → tag cache’u → dwa re-rendery. Picker
      jest pytany z kontrolą na znanym pozytywie („Plac Hallera 6" musi być w tej samej otwartej
      liście), żeby „nie ma prospektu" nie przechodziło na pustym pickerze. Poza zakresem:
      `activeOrSelected` z odznaczonym „Aktywne" (`is-active-ref.test.ts`) i blokada zakończonej
      inwestycji (`investment-lock.spec.ts`).
- [x] · ZOSTAJE · `EX-756` · Katalog prac — cała powierzchnia zmiany jest przeglądarkowa i nie ma
      ani jednego specu. → `e2e/work-catalogue.spec.ts` (2 testy) + fixture
      `src/scripts/seed-work-catalogue.ts` (`pnpm seed:work-catalogue`, dwie inwestycje po dwie
      sekcje, opisy ze stemplem czasu — katalog jest globalny i przeżywa przebieg).
      Z pięciu ryzyk issue zostały dwa; reszta ma tańszy dowód i nie jest powtarzana: gałęzie zapisu
      (nowa/nadpisanie, „Zostaw kategorię z katalogu", odmowa pracy bez j.m.) —
      `work-catalogue-save.test.ts`; tożsamość i kolizja klucza — `work-catalogue.test.ts`;
      „dopisuje na koniec sekcji" — `work-catalogue-insert.test.ts`; składanie klucza, porównanie i
      „jest już w kosztorysie" — własne specy funkcji czystych.
      Test 1 (zapis): dialog pokazuje kwoty z podglądu SERWERA, drugi zapis na tym samym kluczu
      wchodzi w gałąź „Nadpisz…", „Anuluj" naprawdę blokuje zapis (katalog nie trzyma historii), a
      po potwierdzeniu /katalog-prac ma nadal DOKŁADNIE JEDEN wiersz — z nową ceną.
      Test 2 (wstawienie): praca wybrana z katalogu ląduje na końcu pasma tej sekcji, z której
      otwarto picker, i przeżywa przeładowanie; kontrola na znanym pozytywie — najpierw sprawdzamy,
      że „Ukryj już dodane" ją ukrywa, żeby późniejsze kliknięcie nie przechodziło na pustym pickerze.
      Oba testy zakładają wiersz katalogu PRZEZ UI, nie przez seed: cennik to jeden wpis
      `unstable_cache` w serwerze Next i unieważnia go tylko własna akcja zapisu.
- [x] · ZOSTAJE · `EX-716` · Flota — przeglądy. Z listy to-do issue nie zostało nic w oryginalnym
      kształcie: wspólny `formId` szkicu przeglądu już nie istnieje (`inspectionDraftId(vehicleId)`
      + własny test jednostkowy), a pole „Wymiana przy (km)" zostało skasowane razem z całą
      powierzchnią, której pilnowało. Okno kosztów, wykluczenie ODOMETER, „brak ceny" ≠ „0 zł",
      klasyfikacja terminów i czytanie zwolnień mają dowody w `src/__tests__/lib/fleet/`
      (`costs`, `rows`, `deadlines`, `exemptions`) i nie są powtarzane wyżej.
      Reszta ryzyka poszła na najtańszą warstwę, która daje sygnał — DOM (flota nie miała ani
      jednego specu DOM ani przeglądarkowego):
      `inspection-form.test.tsx` (6 testów) — rodzaj przestawia resztę formularza: podpowiedź
      terminu z interwału przy KAŻDEJ zmianie rodzaju, nietykalność daty wybranej ręcznie,
      „Odczyt licznika" chowający i czyszczący termin oraz koszt, czyszczenie danych polisy przy
      wyjściu z OC, oraz ostrzeżenie o niższym przebiegu niż ostatni zapisany (i jego cisza przy
      wyższym) — z kontrolą, że mimo ostrzeżenia formularz da się wysłać;
      `deadline-cell.test.tsx` (5) — trzy rodzaje pustki („bezterminowo" wygrywające ze starym
      zdarzeniem, „brak danych", „bez terminu") plus wariant po terminie i wyciszony RETIRED;
      `fleet-data-table.test.tsx` (2) — stopka „Razem" zgodna z wyszukiwarką i znikająca razem
      z kolumną „Koszty".
      **Test na czerwono złapał prawdziwy błąd produkcyjny i został jako strażnik:**
      `prefillNextDue` pytał `field.isTouched`, a TanStack Form znaczy KAŻDE pole jako dotknięte
      przy pierwszym przebiegu walidacji — więc podpowiedź zamarzała na tym, co zaproponowała
      PIERWSZA zmiana rodzaju (poprawka OC → „Przegląd gwarancyjny" zostawiała 12-miesięczną datę
      na 24-miesięcznym przeglądzie). Naprawione refem `suggestedNextDue` — nadpisujemy tylko
      własną poprzednią podpowiedź (`src/components/forms/inspection-form/inspection-form.tsx`).
      W przeglądarce zostały dwa fakty, które istnieją dopiero po przekroczeniu granicy:
      `e2e/fleet-inspections.spec.ts` (2 testy) + fixture `src/scripts/seed-fleet.ts`
      (`pnpm seed:fleet`, dwa świeże pojazdy ze wspólnym prefiksem rejestracji ze stemplem czasu —
      lista jest globalna, a `registration` unikalne) — „Nie dotyczy (bezterminowo)" z formularza
      pojazdu docierające przez akcję i tag cache’u do kolumny na `/flota` (kontrola na znanym
      pozytywie: najpierw „brak danych"), oraz okno `?from=&to=` zawężające JEDNYM zapytaniem
      kolumnę „Koszty" i stopkę „Razem" (kontrola: najpierw suma obu przeglądów, bo przegląd spoza
      okna jest w fixture celowo).

---

## Bilans

| Werdykt                                     | Ile |
| ------------------------------------------- | --- |
| Anulowane od razu                           | 4   |
| Anulowane / scalone po zgodzie              | 6   |
| Naprawione (zepsute narzędzie, nie backlog) | 1   |
| Zostaje w E2E                               | 26  |
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
`src/__tests__/components/kosztorys/editor/grid/cells/section-header-cell.test.tsx` (7 testów,
**150 ms**) pokrywa dokładnie tę pozycję, którą przy scalaniu wyciąłem z EX-472 jako „nie-E2E":
pasek sekcji jest `role="button"`, a input do zmiany nazwy siedzi w środku, więc każdy klawisz
wpisywany w nazwę dociera też do handlera paska. Ta kolizja weszła na produkcję 2026-09-14 —
spacja zwijała sekcję zamiast wpisać odstęp — i przeszła bez testu z jednego powodu: repo nie
miało renderera DOM. Teraz ma.

Dla porównania: ten sam fakt w Playwrighcie to pełny `pnpm build`, wstanie serwera, baza na 5435
i logowanie — kilka minut na asercję, którą jsdom rozstrzyga w 150 ms.

## Co dalej

Grupa „ZDEGRADUJ" jest domknięta — wszystkie 23 pozycje mają specki DOM/unit, zamknięte w Linearze
i zdjęte z etykiety `e2e-backlog`. Każda była odwracana: zepsucie źródła wywalało dokładnie ten
test, który je pilnuje.

Otwarte zostaje to, co audyt od początku zostawiał przeglądarce: 28 pozycji „ZOSTAJE" plus 4 „bez
zmian". Tam jsdom nie jest przyrządem i degradacja niczego by nie kupiła.
