# Kosztorys editor — domain notes

> Working notes from the design brainstorm behind the in-app kosztorys editor
> (sections/items/stages/pricing/VAT/export). Still a valid reference for the
> domain shape, verified facts, closed decisions, and the open questions in
> `context/foundation/roadmap.md` — read alongside it, not a replacement.

## Cel

Pełne przejście z Google Sheets do aplikacji. End-to-end replacement:
edytowalny kosztorys robocizny w aplikacji, czysty start (bez importu arkuszy),
zero kontaktu z Sheets dla nowych robót.

## Zweryfikowane fakty (inspekcja realnych arkuszy: `testy_full_kosztorys` + Siennicka 160)

> Read-only sheet inspector: `scripts/inspect-sheet.mjs` (dumps formuły + wartości,
> pełne wiersze, litery kolumn AA+). Run:
> `SHEET_ID=<id> node --env-file=./.env scripts/inspect-sheet.mjs > /tmp/dump.txt`
> (needs `GOOGLE_SERVICE_ACCOUNT_JSON`; defaults to `KOSZTORYS_TEMPLATE_SHEET_ID`).
>
> **Dostęp (2026-07-15):** service account
> `kosztorys-sheets@wykonczymy-kosztorys-bk.iam.gserviceaccount.com` ma **Viewera** na
> `KOSZTORYS_TEMPLATE_SHEET_ID`. Wcześniej inspector zwracał `403 PERMISSION_DENIED` —
> jeśli znowu zwróci, arkusz stracił udostępnienie (nadaj Viewera w UI, SA nie zrobi tego samo).
> **Nie zgaduj ze screenshotów — odpal inspector.** Ten plik był już raz źle „poprawiony"
> na podstawie przyciętego obrazka.

- **Arkusz = actuals z appki (mirror) + ręczna rozpiska robocizny.**
- Aplikacja **już** liczy wszystkie actuals z transakcji: wydatki inwestycyjne,
  wpłaty, wypłaty, materiały, korekty, straty. Zakładki `wydatki (ro)` i
  `transfery (ro)` to zrzuty appki (formuły SUMIF w arkuszu).
- **Materiały w arkuszu = rejestr zakupów = INVESTMENT_EXPENSE** (już w appce).
  Brak osobnej tabeli materiałów.
- **Arkusz dryfuje od bazy (NIE 1:1):**
  - Siennicka `wydatki`: 5 z 17 wydatków (brak backfillu; hook dopisuje tylko
    nowe po podpięciu).
  - Siennicka `transfery`: ID kolidują z niepowiązanymi rekordami w bazie
    (id 3015 = OTHER, 3017 = PAYOUT inw.46) — prawdopodobnie reużycie `serial`
    po odtworzeniu Neona z backupu. Suma wypłat arkusz 24 570 vs baza 17 570.
  - Wniosek: **arkusz niewiarygodny jako źródło; baza appki = prawda.** Import
    odrzucony (słusznie).
- **Robocizna:** appka ma tylko **kwotę zbiorczą** `LABOR_COST`; arkusz ma
  **rozpiskę** (sekcje → pozycje → ceny → etapy). Edytor przejmuje rozpiskę.
- Struktura stabilna na 2 arkuszach (te same zakładki/kolumny).

## Mapa kolumn arkusza `kosztorys_robocizny` (klient)

**Zweryfikowane na formułach 2026-07-15** (inspector, nie screenshot). Etapów jest **10, nie 6** —
poprzednia wersja tej mapy (`C–H` / `P–U`, 6 etapów) była nieaktualna i przesunięta o kolumnę.

```
A sekcja | B ordinal (na wierszu sekcji: nazwa sekcji) | C opis
D–M   1–10 etap ilość (wykonano)      ← inputy
N Przedmiar | O Pomiar z natury | P j.m. | Q Cena j.m. (klient) | R rabat %
S wartość przedmiaru | T Wartość netto | U komentarz
V–AE  1–10 etap wartość               ← liczone
AF    pozostało do rozliczenia / bilans
```

- **Wiersz-nagłówek sekcji:** A/B/C = nazwa sekcji, `T4 = SUM(T5:T21)` = suma sekcji,
  `U4 = T4` (lustro — po `U` sumuje `SUMIF` z zakładki `Podsumowanie`).
  Kolumny etapów (`V`–`AE`) w wierszu sekcji są **puste** — patrz niżej.
- Wartość = **pomiar (O)** × cena (np. 57 m² × 70 = 3990), nie przedmiar.
- Zakładki `zakres pracy z narzędziami` / `bez narzędzi` = te same pozycje,
  inne ceny (cennik z narzędziami N, bez narzędzi P). Ceny podwykonawcy NIE są
  stałym % klienta (raz 65%, raz 58%) → niezależne.

### Nagłówki się rozjeżdżają między arkuszami — rozpoznawanie po nazwie nie wystarcza (EX-690)

Nie każdy klient nazywa kolumny tak samo. Żupnicza 18/73 (inwestycja 84) rozbija wartość netto na
dwie kolumny — „Wartość netto przedmiar" (`S`) i „Wartość netto pomiar z natury" (`T`) — więc żadna
nie trafia w dokładne dopasowanie. To dowód z natury dla całej awaryjnej ścieżki wskazywania kolumn;
bez niego zmiana opierałaby się na wymyślonej próbce.

**Dlaczego wybór `S` vs `T` jest niegroźny.** Kolumna wartości netto **nie wchodzi do żadnej pracy** —
czytają ją tylko `footer-totals.ts` (współrzędna liczby w wierszu podsumowania) i skan błędów formuł.
Wartość każdej pracy liczy `calc.ts` z ilości, ceny i rabatu. Porównanie sum dodatkowo zestawia
odczytaną liczbę po kolei ze wszystkimi trzema sumami, które umiemy policzyć, i samo raportuje,
z którą się zgadza. Import odmawiał więc przez kolumnę, która nie wnosi do kosztorysu ani złotówki.

**Czego świadomie nie zrobiliśmy:**

- **Nie poluzowaliśmy dopasowania po nazwie.** Dopasowanie po prefiksie złapałoby na Żupniczej `S`
  i `T` naraz — odmowa „nie znaleziono kolumny" zamieniłaby się w odmowę „pasuje do 2 kolumn", czyli
  ten sam ślepy zaułek pod inną nazwą.
- **Żadnego globalnego słownika nagłówków.** Arkusze należą do klientów i żaden nie jest zbudowany
  tak samo; słownik z definicji nadążałby za ostatnim arkuszem, który ktoś zgłosił.
- **Kolumny opcjonalne nie blokują pobrania.** Arkusz bez rabatu ma się wczytywać jak dotąd — brak
  takiej kolumny to informacja w raporcie, nie odmowa.

### Formuły (dosłownie z arkusza, wiersz 390)

```
T  = O*Q - (Q*R)*O                     wartość netto  = pomiar × cena − rabat
V  = D*$Q - (D*$Q*$R)                  wartość etapu  = ilość_wykonana × cena − rabat
AF = T - V - W - X - Y - Z - AA…AE     bilans         = wartość − Σ etapów
```

Appka jest z tym **1:1**: `stageValueForView` = `V`, `rowRemainingForView` = `AF`
(`src/lib/kosztorys/calc.ts:52,61`). Potwierdza P9.

### BRAK sumy per etap — zweryfikowane

Arkusz **nie sumuje osi etapów nigdzie**: 0 formuł `SUM` nad `V`–`AE` w całych 464 wierszach.
Sumuje wyłącznie oś sekcji (`T4`) i sekcje w zakładce `Podsumowanie`. Czyli „podsumowanie etapu"
(ile zapłacić za dany etap) to **nowa figura, nie parytet** — nie ma czego skopiować, wymaga
decyzji właściciela (cena klienta = faktura vs cena podwykonawcy = wypłata). Roadmap: pytanie 12b.

### `Pomiar z natury` przepisany z `Przedmiaru` — normalne w starych arkuszach (2026-08-15, potwierdzone z właścicielem)

W starszych arkuszach `O` (pomiar) bywa zwykłym `=N<ten sam wiersz>` zamiast `=SUM(D:M)` — tak się je
wtedy budowało. Na żywym arkuszu wychodzi 241 z 336 prac, więc to **stan normalny, nie awaria arkusza
i nie błąd odczytu**.

**Odwrócone 2026-08-20 (właściciel).** Do tej daty z tego zdania wyprowadzaliśmy wniosek „dla takiego
wiersza nie ma czego zapisać jako pomiar" — i to on, nie sama reguła, był powodem, dla którego zero
rozjazdów przy „Porównaj z arkuszem" niczego nie dowodziło. Wniosek był nasz, nie właściciela.
Komórka, którą właściciel wypełnił, JEST pomiarem niezależnie od tego, co wyprodukowało liczbę: pomiar
przepisany z Przedmiaru postawiony obok sumy etapów to prawdziwe porównanie, nie tautologia. Import
pomija dziś wyłącznie formułę sięgającą do kolumn etapów. Skanem po 56 podpiętych arkuszach: suma
etapów w komórce pomiaru to 2 wiersze w całej bazie, `=N{wiersz}` — 267–448 wierszy na arkusz.

Konsekwencja dla raportu: ta klasa nie jest defektem do poprawienia i nie zasługuje na listę wiersz po
wierszu (właściciel, 2026-08-14) — sam licznik odpowiada na pytanie.

## Zakładka `Podsumowanie` (2026-07-15 — wcześniej nieudokumentowana)

Pełna lista zakładek (9, zweryfikowana na żywym arkuszu 2026-07-15 — wcześniej
wymienialiśmy 6, bez luster): `kosztorys_robocizny` · **`Podsumowanie`** ·
`materiały` · `pokoje` · `zakres pracy z narzędziami` · `zakres pracy z bez narzędzi` ·
`wydatki inwestycyjne (tylko do odczytu)` · `transfery (tylko do odczytu)` ·
`rozliczone R+M (tylko do odczytu)`.

```
Robocizna / Materiały / Łącznie      (B6 = robocizny!T395, B7 = robocizny!T398)
Prace dodatkowe            8 400 zł   54,9%
Wyburzenia i demontaże     6 900 zł   45,1%
… 13 sekcji …
Łącznie                   15 300 zł   (=SUM(B11:B23))
```

- Suma per sekcja: `=SUMIF(kosztorys_robocizny!B:B; <nazwa sekcji>; kosztorys_robocizny!U:U)` —
  stąd lustro `U4 = T4` w wierszu sekcji.
- **Udział %** per sekcja (`=B11/$B$25`) — appka tego nie ma.
- Rozbicie **Robocizna / Materiały / Łącznie** — appka tego nie ma.
- Panel sum w appce (`kosztorys-section-summary.tsx`) pokrywa tylko sumy sekcji + Suma netto/brutto.
  Reszta = luka parytetu, bez slice'a. Roadmap: pytanie 12a.

- **`Materiały` (`B7`) ciągnie z lustra, nie z zakładki `materiały`** — widoczne dopiero na żywym
  arkuszu (Altowa 12, 2026-07-15): `B7 → kosztorys_robocizny!S459 → 'wydatki inwestycyjne (tylko do
odczytu)'!H3 → =SUM(E:E)`. Czyli klient w V1 **już** widzi wydatki z apki, a v2 nie odtwarza
  połączenia od zera, tylko przenosi je do bazy. Lustro ma gotowy rozbiór `Materiały budowlane` /
  `Pozostałe koszty` — kandydat na kształt figury w v2.
- **`rozliczone R+M` NIE wchodzi do `Materiały` w `Podsumowaniu`** (sprawdzone 2026-07-18): lustro
  `rozliczone R+M` ma identyczne kolumny `H/I/J/K` (`SUM` + trzy `SUMIF` po kategorii) co
  `wydatki inwestycyjne`, ale `B7` ciągnie **wyłącznie** z tego drugiego. Ta sama granica stoi po
  stronie appki — `totalSettled` jest wycięte z `totalMaterialCosts` i z bilansu, wchodzi tylko do
  marży. Czyli **materiały rozliczone to figura marżowa, nigdy klientowa** — na obu płaszczyznach
  osobna powierzchnia, nigdy dodana do materiałów w ofercie.
- **`transfery!K3 = SUMIF(C:C; "Rabat"; E:E)` istnieje i nikt go nie czyta** — żadna formuła nie
  sięga po tę sumę. Miejsce na podpięcie rabatu stoi gotowe i puste.
- **Rabatu za całość w V1 nie ma** (sprawdzone na wzorcu i na żywym arkuszu): `Podsumowanie` to
  `Robocizna + Materiały = Łącznie`, jedyny działający rabat to `R` — procent per wiersz. Globalny
  rabat (`kosztorys-global-discount`) jest więc **nową robotą bez parytetu**.

**Uwaga — w szablonie te referencje są zepsute:** `B6`/`B7` wskazują na `T395`/`T398`, czyli
**wiersze pozycji** (pusta pozycja w „Kuchnia", „Sufit podwieszany" w „Wiatrołap"), a nie na sumy
całkowite → `Robocizna = 0 zł` i `#DIV/0!` w udziale, a wiersz `check, ok` (`B26 = B25-B6`) kłamie.
Ręczne referencje gniją przy wstawianiu wierszy — argument za liczeniem tych sum w kodzie.

## Schemat (rdzeń robocizny)

```
kosztorys_sections   investment_id, name, display_order
kosztorys_items      investment_id, section_id, display_order,
                     description, unit, planned_qty (przedmiar),
                     -- „pomiar z natury" NIE jest kolumną: = Σ stage_progress.qty_done (arkusz: O=SUM(D:M))
                     discount_type (%|kwota) + discount_value (rabat),
                     vat_rate? (override per pozycja — otwarte),
                     <CENY: patrz decyzja A/B otwarta>, note
kosztorys_stages     investment_id, ordinal, label?     UNIQUE(investment_id, ordinal)
                     -- DYNAMICZNE, wspólne dla wszystkich pozycji (jak kolumny)
stage_progress       item_id, stage_id, qty_done        UNIQUE(item_id, stage_id)
                     -- rzadkie: brak wiersza = 0
kosztorys_rooms      investment_id, name, floor_m2, perimeter, height,
                     wall_m2, ceiling_decor_m2, baseboard_m
                     -- prosta ewidencja pomiarów; auto-link do pozycji = pytanie otwarte
```

BRAK tabeli materiałów (→ INVESTMENT_EXPENSE).

### Pokoje — zweryfikowany fakt (oba arkusze)

**Zero powiązań formułowych pokoje ↔ robocizna.** Zakładka „pokoje" to
samodzielny kalkulator metrażu; właściciel ręcznie przepisuje wynik do
przedmiaru. Wewnętrzne formuły pokoi (do ew. odwzorowania w kodzie):

```
obwód              = (bok_a + bok_b) * 2
m² ścian           = obwód * wysokość (w arkuszu 2,58 m)
sztukateria/listwa = obwód
powierzchnia malowania = Σ ścian − ściany pomieszczeń mokrych (łazienki/WC)
```

## Wartości liczone (nie przechowywane)

- wartość wiersza = `pomiar × cena` minus rabat (procent lub kwota — patrz wyżej),
  **a przy braku pomiaru = Σ wartości etapów** — patrz „Pomiar ≠ etapy" niżej
- „pozostało/bilans" (AF) = wartość pozycji − Σ wartości wykonanych etapów
  = **kontrola postępu robót** (ile zostało do wykonania); informacyjna (P9)
- sumy sekcja / całość = redukcja w kodzie
- plan-vs-actual = porównanie na odczyt (patrz sekcja „Panel plan-vs-actual").

## Panel plan-vs-actual (F) — PEŁNY, z marżą planowaną

> **Nieaktualne od EX-649 (2026-08-18).** Ten szkic zastąpiła zakładka „Marża" w podsumowaniu
> kosztorysu. Zrealizowane inaczej niż tu opisano: „marża planowana" to **prognoza** liczona z
> **przedmiaru** (nie z pomiaru) po pełnej cenie, jako scenariusz „z narzędziami / bez narzędzi";
> „marża rzeczywista" wycenia ekipę z kosztorysu (należne za wykonane etapy), a nie z wypłat, i
> odmawia podania kwoty, gdy któryś etap z pracą nie ma rozliczenia. Wierszy „Zafakturowano" i
> „Wypłacono ekipie" w niej nie ma. Tabela niżej zostaje jako zapis pierwotnego pomysłu.

Czysto na odczyt, per inwestycja. Niezależny od P5 (linkage LABOR_COST).

| Wiersz                   | Źródło                                                      |
| ------------------------ | ----------------------------------------------------------- |
| Plan robocizny (klient)  | Σ `pomiar × cena_klient` z rozpiski                         |
| Wykonano (postęp)        | Σ wartości odhaczonych etapów (klient) + % planu            |
| Zafakturowano            | `LABOR_COST` inwestycji                                     |
| Wypłacono ekipie         | `PAYOUT` inwestycji                                         |
| Plan kosztu podwykonawcy | Σ po etapach (ilość etapu × stawka wariantu etapu)          |
| **Marża planowana**      | plan klient − plan podwykonawcy                             |
| **Marża rzeczywista**    | wzór aplikacji: `robocizna − wypłaty − rabat − strata`      |
| Materiały (actuals)      | `INVESTMENT_EXPENSE` — bez planu (materiałów nie planujemy) |

- **Wariant kosztu PER ETAP** (z narzędziami | bez) — w jednej inwestycji mogą
  występować oba (jedna ekipa z narzędziami, druga bez), a ta sama praca może mieć
  etapy 1–2 zrobione z narzędziami, a 3–4 bez. Wybór siedzi więc na etapie i to on
  mówi, która cena podwykonawcy jest kosztem danej ilości (EX-565, patrz sekcja
  „Wariant «z narzędziami / bez narzędzi»").

## Edytor — zapis i edycja (D)

UX siatki = zwykła tabela (TanStack); sednem nie jest wygląd, tylko zapis.

**Zapisywane = tylko inputy, nigdy wyliczane** (formuły w kodzie):

```
inputy: pozycja (opis, jednostka, przedmiar, pomiar, 3 ceny, discount_type+value,
        note, display_order);
        sekcja (nazwa, display_order, vat_rate);
        etap (ordinal, label, plane); stage_progress (item, stage → ilość)
liczone na żywo: wartość wiersza, sumy sekcji/całości, V, marża, brutto
```

**Zapis: AUTOSAVE per pole, optymistycznie.**

- edycja inline; na blur/zmianę → zapis przez `protectedAction` + `updateTag`,
- UI natychmiast przez `useOptimisticFormStore` (optymistycznie), zapis w tle,
- debounce dla tekstów/liczb (nie strzelać per znak),
- dodanie/usunięcie pozycji/sekcji/etapu = osobna mutacja, też optymistyczna,
- **bez przycisku „Zapisz"** — feel arkusza + skala (1000+ wierszy: zapisujemy
  tylko zmienione pole, nie cały arkusz).

## Druk / eksport (G) — CIĘTE (2026-08-15)

> **Cała ta sekcja jest nieaktualna.** Eksport kosztorysu wycięty w całości:
> CSV (EX-400) oraz PDF + żywy arkusz z formułami (EX-666). Obie role, które
> wydruk miał pełnić — oferta przy podpisaniu i podgląd postępu dla klienta —
> przejmuje **widok klienta** (S-13, link tokenowy + „Podgląd dla klienta").
> Poniższe zostaje jako zapis intencji ownera z POC: reguły „co klient widzi"
> przenoszą się na widok klienta, mechanizm (`buildPrintHtml`, PDF, plik) nie.
> Flaga `hidden_in_export` nigdy nie dostała czytelnika — kolumna skasowana 2026-08-18,
> EX-549 anulowane; ukrywanie pozycji przed klientem weszło jako reguła („ukryj puste pozycje",
> EX-695), nie jako flaga per wiersz.

Wydruk = **oferta dla klienta** (tylko ceny klienta: netto / VAT / brutto; bez
cen podwykonawcy, marży, postępu, „pozostało"). Mechanizm: `buildPrintHtml` +
`printViaIframe` → druk przeglądarki → PDF. Zero nowych zależności.

**Eksport jest EDYTOWALNY (krok „przygotuj eksport"):** dziś owner bierze
kosztorys i ręcznie ukrywa wybrane pozycje przed klientem. Odwzorowanie:

- każda pozycja ma flagę widoczności w eksporcie,
- krok „przygotuj eksport" pokazuje kosztorys z togglami widoczności per pozycja,
- **część pozycji domyślnie ukryta** (reguła default → P12),
- owner odkrywa / ukrywa więcej, potem generuje PDF (tylko widoczne).

Otwarte: która ilość na ofercie — przedmiar (oferta wstępna) czy pomiar
(rozliczenie) → P13. Drugi tryb wydruku „raport postępu" (wewnętrzny, z etapami)
— do rozważenia.

## Co widzi klient — ustawienie, nie stała (EX-695, 2026-08-15)

Zestaw kolumn widoku klienta przestał być stałą w kodzie. Rozstrzygnięcie idzie w kolejności:
własny wiersz inwestycji (`kosztorys-client-view`) → globalne domyślne firmy
(`kosztorys-client-view-defaults`) → domyślne z kodu (nic nie ukryte, puste pozycje ukryte).
Rozwiązywane w `src/lib/queries/kosztorys-client-view.ts`.

Dwie reguły trzymają to razem:

- **`PREVIEW_VISIBLE_COLUMNS` pozostaje sufitem.** Zapisany klucz może tylko _odjąć_ kolumnę,
  nigdy dodać — sanityzacja przy zapisie i przy odczycie odrzuca klucz spoza allowlisty, więc
  ustawienie nie staje się drugą, rozjeżdżającą się odpowiedzią na pytanie „co klient może
  zobaczyć". Klucze są `toggleKey`, więc jeden wpis bierze całą rodzinę per-etap.
- **Ukrywanie pustych pozycji to jedna reguła, nie dwie** (`client-empty`, `kind: 'client'`):
  pozycja bez przedmiaru **i** bez wykonanej pracy nie wnosi nic do żadnej z dwóch kwot, które
  klient czyta, więc jej ukrycie nie rusza podsumowania. Każdy z dwóch filtrów osobno byłby
  bezpieczny tylko dla jednej z nich.

**Podgląd nie zna trybu rozliczenia** (EX-631, rozstrzygnięte 2026-08-12). Dokument klienta niesie
netto i brutto obok siebie także na inwestycji rozliczanej netto — `settlementMode` NIE wraca jako
bramka prawdy. O ujawnieniu decyduje wyłącznie allowlista (i zapisane ustawienie widoku klienta pod
nią); oś kwot jest preferencją czytania, a preferencja jednego czytelnika nie może decydować, co widzi
drugi. Odwrotnie niż `globalDiscountActive`, który do gałęzi podglądu wrócił właśnie dlatego, że jest
stanem inwestycji, a nie preferencją.

Ustawienia czytane są **obok** cache'owanego payloadu podglądu (jeden indeksowany odczyt), więc
zapis działa od następnego żądania bez tagu cache, a zmiana domyślnych firmy nie unieważnia drzewa
żadnej inwestycji.

## Decyzje zamknięte

- **Dostęp (prosto):** **ADMIN, OWNER, MANAGER** — widzą i edytują wszystko.
  **EMPLOYEE — zero dostępu, nie widzi kosztorysu w ogóle.** Rozważany follow-on
  (ukrycie cen podwykonawcy przed MANAGEREM) **odpadł** — P10.
- **Sekcje w pełni edytowalne:** dodawanie, zmiana nazwy, zmiana kolejności
  (`display_order`); nagłówek + suma sekcji (liczona). Dowolna liczba pozycji
  w sekcji (bez limitu).
- **Dwa wejścia, nie trzy** (arkusz właściciela; EX-494, 2026-07-16). Właściciel wpisuje
  **Przedmiar** (oferowany zakres) i **etapy** (faktycznie wykonana ilość). „Pomiar z natury"
  **nie jest wpisywany** — w arkuszu to formuła `O = SUM(D:M)`, czyli **suma etapów**; nasz
  edytor pokazuje ją jako kolumnę read-only. Wcześniej mieliśmy tu czwarte, niezależne pole
  (`measured_qty`) — usunięte, bo dublowało sumę etapów i rozjeżdżało się z nią po cichu.
  Kanon domenowy: `AGENTS.md` → „The Owner's Reference Sheet".

- **Oferta i wykonanie to dwie równoległe kwoty** (arkusz: `S` i `T`):
  - **„Wartość netto przedmiar"** = `applyDiscount(Przedmiar × cena)` = arkuszowe `S` — oferta.
  - **„Wartość netto"** = `applyDiscount(Σ etapów × cena)` = arkuszowe `T` — wykonanie.
  - **„Pozostało netto (względem przedmiaru)"** = `S − T`; przy pustym Przedmiarze „—" (brak
    mianownika). Nie mylić z „Rozjazdem między arkuszem Google a apką" — tamten odejmuje sumę
    etapów od Pomiaru z natury z arkusza, a nie od Przedmiaru.
  - **„% wykonania"** = `Σ etapów / Przedmiar` (nie z sumy etapów — inaczej `Σ/Σ = 100%` wszędzie).

  Konsekwencja architektoniczna: wartość wykonania zależy od etapów, więc `calc.ts` (czysta
  warstwa cenowa, `ViewPricingT` nie widzi etapów) **nie może** jej policzyć. Warstwa
  rozliczeniowa — `rowValueForView`, `rowRemainingForView`, `sectionSubtotalsForView` — mieszka
  w `v2-rows.ts`, które etapy zna. `rowPlannedNetForView` (oferta = z Przedmiaru) zostaje w
  `calc.ts`, bo jej ilością jest Przedmiar, a nie etapy.

  Rozjazd zostaje **widoczny, nie wygładzony**: komórka `% wykonania` świeci na czerwono
  (`hasStagesOverPlanned`), gdy `Σ etapów > Przedmiar` — praca przekroczyła oferowany zakres.
  Częściowo zrobiony wiersz (`Σ etapów < Przedmiar`) to normalna praca w toku i czerwony **nie**
  jest — inaczej cała siatka świeciłaby na zdrowym kosztorysie.

  **Rozjazd nie ma wyjścia awaryjnego per wiersz** (właściciel, 2026-08-13). Rozjazd między
  zaimportowanym Pomiarem z natury a sumą etapów zamyka się **tylko** przez poprawę arkusza albo
  uzupełnienie etapów — akcja „Etapy są prawdą", która kasowała liczbę odniesienia na jednym
  wierszu, została usunięta. Przycisk zgadzający dwie liczby przez skasowanie tej niewygodnej
  udaje, że dane się zgadzają, i zabiera jedyny sygnał, że gdzieś jest błąd.

  **„Porównaj z arkuszem" odpowiada na to, na co zapisana liczba odpowiedzieć nie może.** Liczba
  odniesienia jest zamrożona w chwili importu i wie tylko o tych pozycjach, które wtedy istniały.
  Odczyt na żywo dokłada: ile obie strony liczą (oferta i wykonanie, przez te same wejścia
  `calc.ts`), które pozycje są tylko po jednej stronie, oraz — z siatki formuł, nie z wartości —
  na ilu wierszach Pomiar jest przepisany z Przedmiaru, czyli na ilu kolumna „Rozjazd między
  arkuszem Google a apką" **strukturalnie** milczy. Ten sam odczyt odświeża przy okazji zapisane liczby
  odniesienia — i **czyści** te, których arkusz przestał podawać ręcznie. Osobnej akcji już nie ma:
  skoro arkusz właśnie został przeczytany, „zostaw nieaktualną kopię" nie jest odpowiedzią, którą
  ktokolwiek by wybrał (właściciel, 2026-08-14).

  **Kolumna nazywa się „Rozjazd między arkuszem Google a apką"** (2026-08-18; wcześniej krótko
  „Rozjazd", potem „Pozostało do rozliczenia"). Odejmowanie było i jest to samo — Pomiar z natury
  z arkusza minus suma etapów w aplikacji — a nazwa mówi wprost, które dwie strony się porównuje.
  Jedyny sposób, żeby ją wyzerować, to wpisać ilości w etapy, czyli zadeklarować pracę jako
  wykonaną. Kolumna jest **odpowiedzią na przycisk „z pomiarem do rozpisania na etapy"**
  — pojawia się razem z nim i znika, gdy się go odciśnie. Poza tym gestem siatka pokazuje wszystkie
  pozycje, więc kolumna byłaby pasem „—"; o istnieniu rozjazdu mówi licznik na samym przycisku.
  Z tego samego powodu nie ma jej w liście „Kolumny": widoczność należy do filtra, więc zapisany
  ptaszek nie może go zawetować. Komórka „Pomiar (razem etapy)" nie ma już podpowiedzi
  z rozbiciem arkusz/etapy — liczby czyta się w kolumnie, nie z dymka.

  **„Wartość netto" w podsumowaniu arkusza liczy się z Pomiaru, nie z Przedmiaru.** Wcześniej
  zestawialiśmy ją z wartością przedmiaru — czyli z liczbą, której arkusz nigdzie nie sumuje.
  U części klientów ten sam wiersz sumuje jednak ofertę, więc porównanie najpierw sprawdza, którą
  z naszych sum wiersz faktycznie trafia, i dopiero wtedy go opisuje.

- **Lista prac dynamiczna** (wiersze, bez limitu).
- **Etapy dynamiczne** (wiersze `kosztorys_stages`; kolumny siatki renderowane
  z danych). Usunięcie etapu z wpisanym postępem → **BLOKADA** (najpierw wyczyść).
  Etap = ordinal + **opcjonalna nazwa** (może być, nie musi), edytowalne później.
  Związek etap ↔ płatność (transfery „etap 1-4") — **nieistotny teraz, parking.**
- **Ceny:** każda cena wariantu per pozycja = **niezależna, edytowalna liczba
  (snapshot)**. Relacja nie jest formułą (czasem %, czasem inna absolutna,
  czasem niezwiązana). Źródło prawdy = wpisana liczba.
- **Default ceny = cienka podpowiedź, ODŁOŻONA.** Ceny wpisywane ręcznie.
  Podpowiadarka przyjdzie z szablonami.
- **Import cennika podwykonawcy z arkusza: pusta stawka = 0, nie default** (Białostocka 5,
  blueprint EX-554). Zakładki `zakres pracy z/bez narzędzi` mają stawkę per pozycja albo jako
  formułę (`P×0,65`, a bez narzędzi `R−R×0,15`), albo **pustą — a pusta w arkuszu znaczy 0**: `suma wykonanej
pracy` (`SUM(W:AF)`) nie dolicza takiego wiersza. Arkusz **nie zna pojęcia „dziedzicz
  domyślny współczynnik"** — każda stawka jest jawna. Wniosek dla seeda: importuj **każdą
  jawną wartość** (override kwotą stałą), **nigdy `null`** — `null` w `calc.ts` znaczy
  „dziedzicz sekcyjny/globalny współczynnik" i wymyśliłby koszt, którego arkusz nie ma
  (dawało +~9 000 na `suma wykonanej pracy`, plan „bez narzędzi": 65 638 zamiast ~57 114 ≈
  56 431 z arkusza). Pusta stawka → `{ type: 'amount', value: 0 }`.
- **Import: o rodzaju override'u decyduje FORMUŁA komórki, nie jej liczba** (zweryfikowane na
  Białostockiej 2026-08-17, EX-554). W arkuszu stawka jest albo policzona (`=P×0,65`), albo
  **wpisana z palca** — i to drugie jest w cenniku `z narzędziami` **większością** (229 z 336
  wierszy, `bez narzędzi` 63). Odczyt `UNFORMATTED_VALUE` zwraca w obu wypadkach samą liczbę, więc
  dzielenie jej przez cenę klienta wiązało każdą ręczną stawkę z „Cena j.m." ilorazem typu
  `0,294118`: powiązaniem, którego właściciel nigdy nie wybrał, wracającym do wartości rozjechanej
  o ogon zaokrąglenia i **wędrującym przy każdej edycji „Cena j.m."**. Reguła: **tylko policzona może
  trafić na „auto", wpisana zawsze zamarza kwotą stałą w wartości nominalnej**. Dlatego import czyta
  zakładkę cennika **drugi raz pod renderem `FORMULA`** (`readRateRows`).
- **`bez narzędzi` nie jest niezależną stawką — to `z narzędziami` minus 15%** (`=R−R*0,15`, 309
  z 309 formuł w Białostockiej; `z narzędziami` to `=P×0,65`, 138 z 138 — żadnego innego wariantu).
  Stąd domyślne `0,65 × 0,85 = 0,5525` względem ceny klienta (`DEFAULT_COEFFS`), i stąd **konsekwencja
  dla importu**: gdy `R` jest wpisane z palca, `T` też jest kwotą zamrożoną, mimo że samo jest
  formułą — śledzi `R`, nie cenę klienta.
- **Import wyjmuje globalny mnożnik z formuł cennika i przestawia nim inwestycję**
  (`sheet-coeffs.ts`). Arkusz nie ma komórki z narzutką — jest ona powielona w setkach kopii tej
  samej formuły, więc jedyny sposób jej odczytania to **policzyć dominujący iloraz `stawka / Cena
j.m.` wśród wierszy policzonych** (wpisane z palca są wykluczone: to decyzje o jednej pracy).
  Dopiero to pozwala wierszom zgodnym z tą narzutką wejść jako **`null` = „auto"** zamiast zamarzać
  kwotą stałą — kolumna „Źródło ceny wykonawcy" pokazuje wtedy „kwota stała" wyłącznie na prawdziwych
  wyjątkach, a globalna zmiana narzutki działa jak w arkuszu. To **jedyny** przypadek, w którym `null` jest bezpieczny mimo reguły
  z EX-554 wyżej: znaczy dokładnie tę samą liczbę, bo globalny mnożnik został właśnie ustawiony na
  arkuszowy. Cennik bez ani jednej formuły śledzącej cenę → mnożniki inwestycji zostają nietknięte.
  VAT nie ma w arkuszu odpowiednika i zawsze przechodzi z inwestycji.
  **Pułapka (znaleziona na żywym imporcie):** `replaceTreeWithSnapshot` domyślnie **nadpisuje**
  `tree.settings` ustawieniami inwestycji (żeby preset jednej roboty nie przeniósł konfiguracji na
  drugą) — więc import musi jawnie podać `takeSettingsFromTree: true`. Bez tego pozycje wchodzą jako
  „auto", ale mnożnik zostaje stary i **151 stawek po cichu przelicza się o pół procenta** (0,55
  zamiast 0,5525) wyglądając na w pełni świadomą decyzję.
- **Gdy oba cenniki podają inną kwotę, import NIE wybiera — praca wchodzi bez stawki** (właściciel,
  2026-08-17). Wcześniej wygrywała zakładka pierwsza w arkuszu, a druga kwota lądowała w raporcie jako
  „pominięto": kosztorys dostawał wtedy stawkę, której nikt nie zatwierdził, i po imporcie nie było już
  po niej śladu. Teraz `decide()` zwraca `kind: 'conflict'` z **zerową** stawką i listą `candidates`
  (wszystkie kwoty + zakładka + „wpisana ręcznie / z formuły"), a `deriveOverride` zapisuje
  `amount 0` — nigdy `null`, bo „auto" wymyśliłoby kwotę z globalnego mnożnika dokładnie tam, gdzie
  arkusz żadnej nie podał. Trzy konsekwencje: raport pokazuje **tabelkę per zakładka** (przy dwóch
  cennikach to cztery kwoty), „Porównaj z arkuszem" **pomija** te prace przy „Stawki inne niż w
  cenniku" (nie ma z czym porównywać), a w kosztorysie znajduje się je diagnostyką **„bez ceny
  wykonawcy"** (per widok, jak `negative-rate-*`; ta diagnostyka czyta **kwotę stałą**, a import
  zapisuje właśnie zero jako kwotę, więc zdanie z raportu importu dalej prowadzi tam, gdzie
  obiecuje). **Pusta para vs wypełniona to też konflikt**: arkusz
  renderuje niewypełnioną komórkę jako 0, więc „za darmo" i „nikt nie wypełnił" to ta sama liczba i
  tylko właściciel je rozróżni. **Od 2026-08-19 KAŻDA różnica jest konfliktem** (właściciel): padły
  dwa ostatnie automaty — „wpisana ręcznie bije formułę" i „para niemożliwa (bez narzędzi > z
  narzędziami) jest odrzucana, a reszta się zgadza, więc bierzemy resztę". Ręcznie wpisana stawka
  wchodziła NIŻSZA od formuły, którą pokonywała, czyli odwrotnie niż zakładała reguła, a „ręcznie
  wpisane" wygląda tak samo jak źle odczytany wiersz — więc żadna z tych przesłanek nie rozstrzyga.
  `kind: 'auto'` zniknął; w raporcie zostaje fold „Stawki z jednego cennika" (praca jest tylko w
  jednej zakładce — nie ma z czym się nie zgadzać). Konflikty niosą `conflictReason`
  (`'disagree' | 'incoherent'`) i mają **osobny fold na powód**: „cenniki podają różne kwoty" to
  pytanie o arkusz, „para niemożliwa" to pytanie o NASZ odczyt arkusza — każde chce innego akapitu
  pod tabelką, a per wiersz byłoby tym samym zdaniem powtórzonym w kółko.
- **Import zastępuje w całości i NIC nie przenosi ze starego drzewa — także tego, czego arkusz nie
  ma** (właściciel, 2026-08-24; zamyka EX-717 jako „nie robimy"). Dla pracy, którą import rozpoznał
  jako tę samą, przepada etykieta etapu, plan „z narzędziami / bez narzędzi", przypisany pracownik
  i wpisane w aplikacji wykonanie — arkusz żadnego z nich nie zna, więc nie są zastępowane, tylko
  znikają. To **nie jest** przeoczenie do naprawienia: „zastąp" znaczy zastąp, a przenoszenie
  metadanych dla części prac zrobiłoby z jednego przycisku dwa różne zachowania zależne od tego, czy
  klucz się trafił. Kto chce stan sprzed importu, sięga po „Wersje" — po to jest migawka robiona
  przed importem. Rozstrzygnięcie dotyczy całego planu importu (`buildImportPlan`), nie jednego pola.
- **Wypłaty podwykonawcy w arkuszu = ręczny rejestr, NIE wyliczenie** (Białostocka 5, zweryfikowane
  na formułach zakładki `zakres pracy bez narzędzi`, wiersze 396–400). Po stronie podwykonawcy arkusz
  liczy **tylko jedno**: „suma wykonanej pracy" (r398 `=SUM(W396:AF396)` = Σ etapów × stawka „bez
  narzędzi"). Pojedyncze wypłaty (zaliczki, multisport, zus…) to **literały wpisywane z palca**;
  „suma wypłat" (r400 `=sum(W397:AE401)` = 56 440) i „pozostało do wypłaty" (r399
  `=SUM(U398)-SUM(W397:AB400)` = −9) tylko sumują te ręczne wpisy. **Wniosek:** app **nie ma się
  zgadzać** z arkuszową „suma wypłat" — to tylko tyle, ile właściciel zdążył wpisać. App bierze realne
  transakcje PAYOUT (per podwykonawca), co jest **wiarygodniejszym** źródłem niż ręczna lista.
  Jedyna kwota, która MUSI się zgadzać, to „suma wykonanej pracy" (po naprawie buga stawki, na planie
  „bez narzędzi").
- **VAT (netto/brutto):** ceny wpisywane **netto**; **brutto = netto × (1 + vat)**
  liczone, nie przechowywane. Nadpisuje wcześniejsze „netto bez VAT".
- **`vat_rate` jako kaskada:** globalny **default** → nadpisanie **per
  kategoria/sekcja** → pozycja **dziedziczy** stawkę swojej sekcji. Czyli
  `vat_rate` siedzi na `kosztorys_sections` (+ globalny default w konfiguracji),
  nie na pozycji. (Otwarte: czy potrzebny też override per pojedyncza pozycja.)
- **VAT dotyczy WYŁĄCZNIE prac (robocizna) — dwie płaszczyzny** (właściciel, 2026-07-19).
  Oś netto/brutto jest pojęciem **cennika prac**, nie księgi. Rozstrzyga powracające
  zamieszanie (rabat „100 vs 102", brutto na wydatkach):
  - **Płaszczyzna cen klienta (prace):** ceny wpisywane netto, `brutto = netto × (1 + vat)`
    liczone. Oś netto/brutto istnieje TYLKO tu i obejmuje wszystkie 3 warianty ceny
    (klient + oba podwykonawcy) po stawce inwestycji — spójne z P8 (2026-07-15).
    - **DOPRECYZOWANIE — rozliczenie z podwykonawcą idzie BEZ VAT** (właściciel, 2026-07-21,
      EX-558). Ekipa nie wystawia faktury VAT, więc na jej stronie netto = brutto. Powyższe „3
      warianty ceny na osi netto/brutto" mówi tylko o tym, że **silnik** potrafi wyliczyć brutto
      dla każdego cennika — nie o tym, że taka oś ma sens w rozliczeniu z ekipą. Skutek dla UI:
      blok „Podsumowanie podwykonawców" **nie ma** przełącznika netto/brutto, tylko jedną kolumnę
      „Kwota"; przełącznik zostaje wyłącznie w widoku Klient. „Suma wykonanej pracy" po stronie
      podwykonawcy się nie gruntuje, tak jak zaliczki.
  - **Płaszczyzna księgi (actuals):** transakcje i wydatki są **netto, bez VAT** — schemat
    transferów nie ma osi VAT. `LABOR_COST`, `RABAT`, materiały (`INVESTMENT_EXPENSE`),
    korekty (`CORRECTION`), wpłaty, wypłaty — wszystkie renderują się w **wartości nominalnej,
    bez doliczania VAT**. „Wpłaty to pieniądze już wpłacone przez inwestora — nie ma czego
    gruntować"; korekta i wydatki tak samo.
    - **WYJĄTEK — zaliczka (deposit) (właściciel, 2026-07-21, EX-536): obie osie, netto I brutto.**
      Odpowiedź na „zaliczka netto czy brutto" = **obie**. To rewiduje regułę „wpłaty face value"
      **tylko dla zaliczki/deposit**. **Mechanika — ROZSTRZYGNIĘTA (EX-536):** każda wpłata niesie
      przechowywany, trójstanowy znacznik `vatPlane` (`NET` / `GROSS` / `null`), wybierany per wpłata
      przy tworzeniu (create-only, immutable), a nie wyliczany jedna z drugiej. `null` w rozliczeniu
      mieszanym traktowane jest jako **netto** (właściciel, 2026-07-23, odwrócone z wcześniejszego
      null→brutto): tylko `GROSS` idzie na część fakturowaną, `NET` i `null` spłacają gotówkę.
      **Formularz wymusza wybór (2026-07-25):** opcja „— nie określono —" zniknęła, „Netto" jest
      preselektowane, więc `null` zostaje już tylko na wpłatach zaksięgowanych wcześniej. Pole nazywa
      się wszędzie tak samo — **„Rozliczenie netto/brutto"** (formularz, kolumna w transakcjach, admin,
      tabela wpłat w Podsumowaniu) — z opisem: _„Określ czy wpłata ma trafić do puli netto czy brutto.
      Na tej podstawie określamy wartość rozliczenia mieszanego (część brutto, część netto)."_
      Kwota gotówki nie jest wpisywana — wynika z sumy wpłat netto. Kod:
      `src/collections/transfers.ts` (pole `vatPlane`) + `src/lib/kosztorys/summary-economics.ts`
      (`bucketDepositsByPlane`) + migracja `20260721_1`.
  - **Rabat też jest na płaszczyźnie prac — gruntuje się** (właściciel, 2026-07-19). Rabat to
    **obniżka prac**, a nie ruch gotówki ani koszt materiału, więc dzieli oś netto/brutto z
    pracami: `rabat_brutto = rabat_netto × (1 + vat)`. Dowód z arkusza: `S = N × cena − rabat`,
    a na osi brutto cała ta linia gruntuje, więc efektywny rabat brutto = `rabat × (1+vat)`.
    To **odróżnia rabat** od materiałów / korekty / wpłat (te są nominalne). Bez tego brutto-
    kaskada się nie spina: „Suma prac" brutto − rabat nominalny ≠ „Robocizna" brutto.
  - **Skutek dla `Podsumowania` (edytor):** kolumna brutto dotyczy wierszy z płaszczyzny prac —
    „Suma prac wykonanych", **„Rabat"** oraz „Robocizna/Do zapłaty" (gruntowana po rabacie).
    Materiały budowlane/wykończeniowe, korekta i wpłaty = wartość nominalna (brak wiersza
    brutto). (Bug 1: wcześniej wszystko gruntowane hurtem przez `toGross(cały net)`; bug 2:
    rabat błędnie zrzucony do `faceValue` — powinien `moneyPair(…, vatRate)`.)
  - **WYJĄTEK od „materiały nominalnie" — wydatek typu netto (wdrożone 2026-08-07).**
    Reguła „wartość nominalna" mówi, że nie **wymyślamy** VAT-u, którego nie było na dokumencie —
    a nie że materiał nigdy nie ma dwóch osi. Wydatek zapisany jako **netto** ma brutto policzone:
    `brutto = netto × (1 + (materialsNetRate ?? vatRate))`, tą samą stawką, która w drugą stronę
    rządzi kolumną Netto. Kierunek wynika z tego, na której płaszczyźnie wydatek zapisano; paragon
    brutto dalej stoi po face value na obu osiach.
    **Pułapka, którą to przywraca:** model „zapisane `netAmount`" wybrano właśnie po to, żeby
    skasować dryf zaokrągleń (`ROUND` Postgresa vs `Math.round` JS-a) łamiący „lista === podsumowanie"
    — brutto liczone wskrzesza dokładnie to ryzyko, więc niezmiennik Σ testuje się **na moście**
    między płaszczyznami, nie po jednym teście na płaszczyznę.
    **Konsekwencja w rozliczeniu mieszanym:** „Pozostało brutto" **nie** jest gruntowaniem kwoty
    nierozliczonej — to gruntowałoby materiały razem z pracami. Liczy się z „Łącznie", gdzie
    materiały już stoją po face value na obu osiach (`resztaGross = combined.gross − paidNet`).
  - **Skutek dla rekoncyliacji (strona inwestycji „z kosztorysu", EX-535):** porównanie idzie
    **netto ↔ netto** dla obu figur — kosztorys suma prac (netto) ↔ Σ `LABOR_COST`, kosztorys
    rabat (netto) ↔ Σ `RABAT`. Strony kosztorysowej **nie gruntujemy**. To usuwa fałszywy
    rozjazd o VAT (rabat 100 netto mylnie porównywany z „102 brutto") — sygnalizacja świeci
    tylko przy realnej różnicy ≥ 1 gr.

    **POTWIERDZONE (właściciel, 2026-07-21): transakcja `RABAT` w zasadzie znika.**
    Rabat nie jest już ręczną transakcją — staje się kwotą **readonly z arkusza**
    (kosztorysu), pokazywaną w **widoku inwestycji** i wchodzącą w **podsumowanie tej
    inwestycji**. Skutek: nie ma już `Σ RABAT` do rekoncyliacji — rabat inwestycji =
    rabat kosztorysowy wprost. **To rozpuszcza otwarte pytanie EX-539** (transakcja
    `RABAT` netto vs brutto) — bez ręcznej transakcji `RABAT` nie ma osi wpisu do
    rozstrzygnięcia. (EX-536 / zaliczka pozostaje osobno.) Do zbudowania w widoku
    inwestycji — należy do EX-535.

- **Rabat dwutrybowy:** `discount_type` ∈ {procent, kwota} + `discount_value`.
  - procent: `wartość = ilość × cena × (1 − %)`
  - kwota: `wartość = ilość × cena − kwota`

### Rabat globalny — kontrakt sterowania (EX-605, 2026-07-27)

O zastąpieniu rabatów per pozycja decyduje **tryb, nie kwota**: „Kwotowy" wyłącza rabaty
per pozycja przy **każdej** wartości, łącznie z 0 zł. Stąd wybór trybu **od razu zapisuje** —
czekanie na kwotę zostawiało listę obiecującą zastąpienie, którego silnik nie robił.

- **Kwota startowa = suma rabatów per pozycja** przy aktywnym widoku, więc przełączenie
  na „Kwotowy" nie rusza żadnej liczby na ekranie: użytkownik najpierw wybiera mechanizm,
  potem zmienia liczbę. (0 zł też by działało, ale czytałoby się jak „skasuj rabaty".)
- **Odwracalne**: rabaty per pozycja nigdy nie są kasowane, tylko pomijane w liczeniu —
  „Wyłączony" przywraca je w całości. To jedyny powód, dla którego wybór trybu może
  zapisywać od razu.
- **Ctrl+Z cofa zmianę trybu i kwoty** — rabat globalny chodzi tą samą ścieżką zapisu co
  stawka VAT, sposób rozliczenia i stawka netto wydatków (`saveSetting`).
- **Oba tryby zatwierdza się przyciskiem „Zapisz"** (lub Enterem). Nic nie zapisuje się na
  wyjściu z pola: rabat to ustalenie handlowe, więc samo opuszczenie pola nie może go zmienić.
- **„%" pozostaje destrukcyjne i niecofalne** — jednorazowo nadpisuje rabat każdej pozycji,
  Ctrl+Z tego nie cofa (decyzja właściciela, podtrzymana 2026-07-27 przy EX-606). Zamiast
  cofania: **okno potwierdzenia** przed zapisem, mówiące co ginie i gdzie jest droga powrotna.
  Droga powrotna istnieje i jest starsza od tej decyzji — `applyPercentRabatToAllItemsAction`
  robi automatyczny zapis wersji kosztorysu przed każdym nadpisaniem, tak samo jak usunięcie
  sekcji. **Nie zgłaszaj ponownie „brak cofania" jako buga** — to wybór, a stan da się odzyskać
  z listy wersji.
- **Migawki (wersje) nie niosą ustawień rabatu globalnego** — rabat to ustalenie per inwestycja i
  nigdy nie podróżuje przez przywrócenie wersji ani przez preset. Przywrócenie starej wersji zostawia
  bieżący rabat kwotowy nietknięty (wiersze migawki mają swoje własne rabaty per pozycja).

### Pusta komórka liczbowa to zero, nie „brak" (2026-08-25)

Wyczyszczenie „Przedmiaru", „Ceny j.m." czy „ilości" etapu zapisuje **0**, a nie pustkę — w arkuszu
właściciela pusta pozycja liczy się jako zero i tak wchodzi do sum sekcji. Dlatego kasowanie treści
komórki nie jest sygnałem „nie wiem", tylko wpisem zerowym, i tak samo działa `Delete` na
zaznaczeniu kilku komórek: wpisuje zera, nie usuwa wierszy.

Wyjątek pilnowany osobno: wyczyszczenie „Rabat wart." zdejmuje też **typ** rabatu — pozycja wraca na
„Bez rabatu", bo rabat 0 zł i rabat 0% to w stopce ta sama informacja, a zostawiony typ udawałby
udzieloną zniżkę.

### Sufit rabatu per pozycja — 0–100%, twardo (EX-736, 2026-08-25)

Rabat procentowy w pozycji **nie może przekroczyć 100%** (właściciel, 2026-08-25). 100% przechodzi —
to praca oddana gratis, normalna decyzja handlowa. Powyżej wartość netto wiersza schodzi na minus i ta
ujemna liczba idzie dalej w sumy sekcji i w stopkę, gdzie czyta się jako „inwestorowi należy się za
wykonaną robotę".

- **Odrzucenie, nie ostrzeżenie.** Czerwona liczba z dymkiem w trakcie pisania, wycofanie
  z komunikatem po wyjściu, wklejenie odrzucone. Ta sama maszyna co sufit ceny podwykonawcy, ale
  **inny stopień**: od 2026-09-20 sufit podwykonawcy tylko ostrzega (wartość zostaje w wierszu),
  a rabat powyżej 100% nadal się wycofuje — patrz „Sufit ceny podwykonawcy" niżej.
- **Sufit jest tylko na osi procentowej.** Rabat kwotowy nie ma progu — „250" to tam 250 zł, liczba
  jak każda inna. Dlatego guard czyta parę (typ + wartość), a nie samą wartość.
- **Przełączenie typu na „%" przycina wartość do 100.** Rabat 150 zł przestawiony w kolumnie „Rabat"
  na procenty był jedyną drogą do 150% bez ani jednego klawisza przez guard — ta sama luka, którą
  „Źródło" ma u podwykonawcy (wspólny slot na wartość, czytany pod nowymi regułami). Przycięcie, nie
  wyzerowanie: przełączenie typu to zmiana jednostki, a nie kasowanie wpisanego rabatu.
- **Rabat globalny „%" miał zakres `[0, 100]` od początku** (`applyPercentDiscountSchema`), więc
  komórka była jedyną dziurą. Oba wejścia mówią teraz to samo.

### Sufit ceny podwykonawcy — 65%, ostrzeżenie (2026-09-20)

Podwykonawca może dostać najwyżej **65% ceny dla inwestora**. Sufit liczy się od ceny **przed
rabatem** (właściciel, 2026-07-28): rabat to oddanie części własnej marży, więc gdyby ciągnął sufit
w dół, zniżka przecenialaby wstecz ekipę, która się na nią nie pisała.

- **Ostrzeżenie, nie odrzucenie** (właściciel, 2026-09-20). Ekipa naprawdę bywa droższa niż 65%,
  a kosztorys, który nie umie tego zapisać, kłamie. Wartość **zostaje w wierszu**: komórka jest
  czerwona, a komunikat wychodzi raz, przy wyjściu z komórki.
- **Jedyna twarda odmowa to stawka ujemna.** Tej nikt nigdy nie chciał — wraca do stanu sprzed
  edycji i wklejenie jej nie przechodzi. To ona, nie sufit, została w „Problemach" jako
  „z ujemną stawką wykonawcy".
- **Sufit sądzi kwotę stałą, nie mnożnik** (EX-820, 2026-09-22). Na wierszu ze źródłem „auto"
  strażnik milczy: stawka jest tam iloczynem globalnego mnożnika, więc czerwień na każdej pozycji
  byłaby jednym werdyktem powtórzonym tysiąc razy. Mnożnik odpowiada za siebie sam, raz, w swoim
  polu w ustawieniach — `coeffWarning` czerwieni je powyżej 0,65 **i przy 0** (zero daje ekipie 0 zł
  na każdej pozycji „auto").
- **Sufit to gest czytania, nie alarm** (EX-820). Przeszedł z „Problemów" do „Filtrów" jako para
  dopełniających się wierszy na płaszczyznę — „z kwotą stałą powyżej sufitu" i „bez kwoty stałej
  powyżej sufitu". Katalog prac już sygnalizuje udział przy ratyfikacji stawki, a lista problemów
  ma pokazywać to, co jest zepsute; kwota ratyfikowana w katalogu zepsuta nie jest.
- **Jeden próg, jeden dom.** Werdykt liczy `checkSubcontractorPrice`; katalog prac **i oba filtry
  sufitu** pytają o ten sam próg przez `isOverCeiling`, żeby udział na `/katalog-prac`, filtr
  i czerwona komórka nie mogły się rozjechać na zaokrągleniu.
- **Globalny mnożnik też już nie odmawia twardo** (2026-09-21). Pole „mnożnik" przyjmuje wartość
  powyżej 0,65 i tylko ostrzega — ostatnia powierzchnia, która trzymała się starej odpowiedzi,
  zrównała się z resztą.

### Zasięg filtrów na stronie inwestycji (EX-600, 2026-07-28)

Panel podsumowania na `/inwestycje/<id>` pokazuje obok siebie liczby z dwóch źródeł, a filtry z
adresu (data, typ, kasa, …) sięgają tylko do jednego z nich:

- **Płaszczyzna transakcji** — Materiały, marża i **Wpłaty** — zwęża się razem z filtrem. Wpłaty
  dołączyły do tej grupy dopiero teraz; wcześniej czytały całą inwestycję niezależnie od filtra,
  co było regresją względem odczytu v1, gdzie ta sama liczba filtrowi podlegała.
- **Płaszczyzna kosztorysu** — Robocizna, Rabat, Łącznie, „Do zapłaty" — filtrowi podlegać nie
  może: pozycja kosztorysu nie ma daty, typu ani kasy, po których dałoby się ciąć. Przy aktywnym
  filtrze każda taka liczba dostaje `*`, a panel raz drukuje przypis, co ta gwiazdka znaczy.
- **Werdykty porównujące obie płaszczyzny** — krzyk o rozjeździe robocizny/rabatu z transakcjami
  oraz ostrzeżenie o trybie mieszanym — przy aktywnym filtrze milkną. Zestawiają całość kosztorysu
  z zawężoną księgą, więc pod filtrem zgłaszałyby sam filtr jako lukę.

Reguła generalna dla nowych liczb w tym panelu: jeśli liczba pochodzi z kosztorysu, oznacz ją
gwiazdką; jeśli porównuje kosztorys z transakcjami — wycisz ją pod filtrem.

### Picker „Dodaj pracę z katalogu" — rozstrzygnięcia właściciela (2026-09-01)

Cztery decyzje, o które przy kolejnej zmianie w tym oknie nie trzeba pytać drugi raz — wszystkie
padły wprost od właściciela, nie są domysłem implementacji:

- **Cennik pokazuje przy pracy cenę i obie stawki, ale NIE oba `%` udziału stawki w cenie klienta.**
  Kolumny procentowe to narzędzie do układania cennika na `/katalog-prac`, nie do wybierania pracy.
  Świadomy koszt: ostrzeżenie o przekroczonym pułapie udziału pojawia się dopiero **toastem po
  wstawieniu**, nie przed.
- **„Już dodane" liczymy dla CAŁEGO kosztorysu, nie dla sekcji docelowej.** Ta sama praca legalnie
  stoi w kilku pokojach, ale właściciel chce ją mieć z drogi — nie chodzi o zapobieganie
  duplikatowi, bo przełącznik wolno odznaczyć i dodać ją drugi raz.
- **Dopasowanie idzie po `matchKey` katalogu** — tą samą regułą, co „Porównaj z katalogiem" i indeks
  UNIQUE (opis + j.m., po sfałdowaniu). Znany i zaakceptowany skutek: pozycja z **ręcznie zmienioną
  nazwą** przestaje się liczyć jako dodana i wraca na listę. To ta sama martwa strefa, co
  w porównaniu z katalogiem — jedna reguła, nie druga do pamiętania.
- **Select sekcji docelowej nie pokazuje licznika `(n poz.)`** — tak samo jak menu „Dodaj", gdzie
  właściciel to zaakceptował. Koszt: dwie sekcje o tej samej nazwie są w selekcie nierozróżnialne.

## Domyślne

PLN • netto+brutto z `vat_rate` per pozycja • hard-delete • reorder strzałkami
(bez drag) • etapy zmienne (w szablonie 10) • współistnienie z zakładką „Arkusz" •
bez `work_catalogue`.

## Wariant „z narzędziami / bez narzędzi" — ROZSTRZYGNIĘTE, wdrożone (EX-565)

**Problem (właściciel, 2026-07-21).** Cena podwykonawcy „z narzędziami" i „bez narzędzi" to **NIE
dwie równoległe ceny tej samej pracy**. Dana praca jest wykonana **albo** z narzędziami **albo** bez
— **OR, nie AND**. W „Podsumowaniu podwykonawców" nie może być dwóch osobnych kwot per wariant; ma być
**jedna** kwota, w której każda praca liczy się po **swoim** wariancie.

**Eskalacja: wariant zmienia się per etap — POTWIERDZONE realnym przypadkiem (2026-07-21).** Kilka
ekip na inwestycji, część pracuje z narzędziami, część bez. Ta sama praca: „etapy 1–2 robił ktoś
z narzędziami, etapy 3–4 bez". Czyli grain wyboru wariantu to **etap**, nie praca. Wtedy model app się
**rozwalał** — nie było gdzie tego zapisać.

**Kierunek rozwiązania (czysty, zaskakująco mały).** Stawki i tak są **dwie na pracę** (z i bez, obie
własne — już importowane). Nie trzeba „dowolnej stawki per etap" — trzeba jednej nowej rzeczy:
**oznaczenia wariantu na etapie**, które wybiera, która z dwóch stawek pracy obowiązuje na daną ilość.

- **Koszt pracy = Σ po etapach (ilość_etapu × stawka wariantu tego etapu).**
- „Podsumowanie podwykonawców" = **jedna** zsumowana kwota z realnych miksów; globalny przełącznik
  z/bez miał wtedy **zniknąć** — ostatecznie zostaje jako widełki, patrz „Co wdrożono" niżej.
- Dane jednorazowe do dogfoodingu → czysty dopis kolumny, bez migracji/backfillu.
- Przykład (malowanie, stawki 18/15): (e1+e2)×18 + (e3+e4)×15. Ani „całość z" (×18), ani „całość bez"
  (×15) tego nie odda — prawda leży pomiędzy.

**Widoki — czwarty „mieszany", z/bez zostają jako widełki** (2026-07-21, właściciel; **wciąż otwarte**,
już pod wdrożonym modelem per etap). Zamiast usuwać globalne z/bez, **dokładamy czwarty widok
„mieszany"** = rzeczywistość (każdy etap po swoim wariancie). Własności:

- Mieszany **zawsze leży między** „całość z" a „całość bez" → z/bez przestają być dwiema równoległymi
  prawdami (odrzucone AND), stają się **widełkami-hipotezą**.
- Przy **jednorodnej** inwestycji mieszany == widok podstawowy (wszystkie komórki jeden wariant), więc
  nic nie tracimy — mieszany tylko uogólnia. Dlatego z/bez zostają (większość inwestycji jednorodna);
  ich ewentualne wchłonięcie przez mieszany — dopiero „jak się sprawdzi".
- UI mieszanego = powierzchnia przypisania ekip: kolumna etapu **kolorowana jego wariantem**, wybór
  wariantu w nagłówku etapu. Wiersz pokazuje samą **kwotę** (nie „cenę j.m." — etapy mieszają stawki).

**GATE rozliczenia (twarda konsekwencja).** „należne − wypłaty = pozostało do wypłaty" żyje **tylko
w widoku mieszanym**. To był źródłowy błąd 78 033 vs 56 431: podsumowanie liczyło należne w widoku
**z narzędziami** (całość × stawka z = 78k) i zestawiało z **realnymi** wypłatami — jabłko do
pomarańczy. W z/bez suma należnego to hipoteza → **bez** bloku „pozostało do wypłaty"; pełne
rozliczenie tylko w mieszanym. (Ten sam per-widokowy gating panel już stosuje dla „scream" recon,
przypiętego do widoku klienta.)

**Rozliczenie per pracownik jest osobną warstwą.** Wypłaty i tak idą z realnych transakcji PAYOUT per
pracownik (patrz notatka „Wypłaty = ręczny rejestr…"), nie z arkusza. Wariant per etap daje poprawną
**sumę kosztu**; przypięcie „kto zrobił który etap" do konkretnej ekipy (dla rozliczenia per pracownik)
to dalsza, opcjonalna warstwa — nie mieszać jej do tej zmiany.

**Ta warstwa jest już wdrożona (EX-613).** Przypisanie siedzi na **etapie** (nullowalne, obok
`plane`), nie na transakcji — bo most transakcja→etap raz już istniał i został wyrwany (EX-536,
migracja `20260721_0`), a domknięcie go kosztowało dwie poprawki na spójność tagów, gdy wiersz
nadrzędny się przesuwał. Przypisanie na etapie tego problemu nie ma.

Dwie konsekwencje, które łatwo przeoczyć:

- **Warstwa rozliczenia jest świadoma etapów, warstwa wyceny nie** (granica z EX-489). Figura per
  pracownik to sprawa rozliczenia — nic z niej nie schodzi do wyceny pozycji.
- **Dwie nullowalne osie na jednym etapie = dwa niezależne braki**, które potrafią wystąpić naraz.
  Dominuje `plane`: etap bez wariantu nikomu nic nie zarabia, więc „brak osoby" jest na nim
  twierdzeniem o zerze — i dlatego etap bez wariantu nie przyjmuje przypisania. Odwrotnie niż przy
  `plane`, brak osoby **nigdy** nie blokuje wpisywania ilości.

**Co wdrożono (EX-565).** Wariant siedzi na **etapie** (`kosztorys_stages.plane`) — dokładnie ten
grain, który właściciel potwierdził. Rozliczenie podwykonawcy liczy się po wariancie etapu, więc
„koszt = Σ po etapach" jest już policzalne z danych. Etap bez wybranego wariantu nie należy do
żadnego rachunku podwykonawcy i nie wchodzi do żadnej z dwóch sum.

Globalny przełącznik z/bez **zostaje** jako widok wyceny (widełki-hipoteza, patrz wyżej) — nie jest
już drugim miejscem zapisu wariantu. Wariantu **nie ma** ani na pracy, ani na sekcji — kolumny, które kiedyś miały go tam nieść, były
martwe od pierwszego dnia i zostały usunięte (EX-575, migracja `20260728_0`). Kaskada
sekcja → (sekcja × etap) → praca nigdy nie powstała i nie jest planowana.

Otwarte pod wdrożonym modelem: **skąd import zna wariant** — arkusz ma obie zakładki („zakres pracy
z/bez narzędzi") dla **wszystkich** prac, bez znacznika per etap; potrzebna reguła od właściciela.
Powiązane: EX-554 („Podsumowanie podwykonawców").

**Widok podwykonawcy to rachunek jednej ekipy, nie ta sama rozpiska po innej cenie (EX-570, 2026-07-25).**
W „Z narzędziami" / „Bez narzędzi" **„Pomiar z natury" liczy tylko etapy tego wariantu** — a że pomiar
JEST sumą etapów (EX-494), poprawia się od razu wszystko, co z niego wynika: wartość wiersza, sumy
sekcji, stopki per etap, „Razem". Kolumny drugiego wariantu **znikają**, nie są wygaszane: wersję
„nie dotyczy" zbudowano i odrzucono — ściana martwych komórek, w której kolumny ilości dalej pokazywały
liczby, jakby się liczyły.

**Przedmiar nie ma wariantu**, bo jest wpisywany raz na wiersz na cały oferowany zakres. Dlatego
w widokach podwykonawcy nie ma go w żadnej postaci — ani ilości, ani wartości, ani „% wykonania", ani
„Pozostało": porównanie przefiltrowanego pomiaru z całym przedmiarem nic nie znaczy. Ilości wprowadza
się w widoku klienta, który pokazuje wszystkie etapy, więc zwężenie kolumn niczego nie odbiera.

**Konsekwencja przyjęta świadomie:** dopóki jakiś etap nie ma wybranego wariantu, dwa rachunki **nie
sumują się** do całości pracy wykonanej — brakującą kwotę zgłasza tylko plakietka ostrzeżenia. Lepsza
brakująca kwota niż kwota dopisana ekipie, której nikt nie wskazał.

### Stawka wykonawcy ma dwa źródła: „auto" i „kwota stała" (2026-09-01)

„Źródło ceny wykonawcy" odpowiada na jedno pytanie: czy ta pozycja idzie za mnożnikiem inwestycji, czy
niesie własną kwotę.

- **„auto"** — cena wylicza się z ceny klienta przez mnożnik inwestycji (osobny per plan, domyślnie
  `0,65` z narzędziami i `0,5525` bez). Zmiana narzutki przelicza wszystkie takie pozycje naraz.
- **„kwota stała"** — pozycja niesie własną stawkę w złotówkach i żadna zmiana narzutki ani ceny
  klienta jej nie rusza.

Wpisanie liczby w „Cena j.m." wykonawcy **samo** przestawia źródło na „kwota stała", a wyczyszczenie
komórki wraca na „auto" — kolumna źródła jest podglądem tej decyzji i drogą powrotną, nie osobnym
krokiem, który trzeba wykonać przed wpisaniem ceny. W podglądzie inwestora kolumna źródła nie składa
się w ogóle: dokument klienta nie pokazuje, skąd firma bierze stawkę ekipy.

**Trzecie źródło — „własny mnożnik" per pozycja — zostało wycięte** (właściciel, 2026-09-01). Nie
używał go nikt: zero wierszy w jakiejkolwiek bazie, katalog prac nigdy go nie przechowywał (zapisuje
stawkę wyliczoną, nie iloraz), a import z arkusza sprowadzał się do niego tylko przez to samo
dzielenie przez „Cena j.m.", które opisano wyżej jako pułapkę. Kosztem był wspólny slot na wartość,
w którym „200" znaczyło raz 200 zł, a raz mnożnik ×200 — i sześć kolumn ceny wykonawcy w siatce
zamiast czterech. Dane były jednorazowe, więc cięcie poszło bez migracji: gdyby taki wiersz gdzieś
został, policzy się z mnożnika inwestycji.

**Sama kolumna „Źródło ceny wykonawcy" ZOSTAJE — wycięcie rozważano i odrzucono dwa razy**
(właściciel, 2026-09-01 przy cięciu trzeciego trybu, i ponownie 2026-09-02 przy EX-766). Argument za
wycięciem jest za każdym razem ten sam i za każdym razem przegrywa: skoro wpisanie liczby ustawia
kwotę stałą, a Delete wraca na auto, kolumna „tylko duplikuje Delete". Przegrywa, bo **„auto" nie
jest stanem, który widać — to brak wartości**, więc pusta komórka, która magicznie znaczy „idzie za
mnożnikiem", jest nieodkrywalna dla kogoś, kto tej reguły nie zna. Nazwana opcja bije podpowiedź
w nagłówku.

Nie mylić tego z **cennikiem klienta, gdzie „Źródła" nie ma celowo** i Delete faktycznie jest jedyną
drogą powrotu (właściciel, 2026-09-01, bramka review). To świadomy kompromis dla **jednego** widoku,
w którym właściciel pracuje i regułę zna — nie precedens do rozciągnięcia. Skasowanie kolumny
awansowałoby ten lokalny wyjątek do jedynego mechanizmu wszędzie, czyli odwróciłoby decyzję, a nie
rozszerzyło ją.

### Pozycja z materiałem w cenie j.m. dostaje stawkę podwykonawcy kwotą stałą (EX-649, 2026-08-17)

Konwencja właściciela, nie reguła w kodzie: gdy materiał jest wliczony w cenę jednostkową pozycji,
stawkę podwykonawcy wpisuje się **ręcznie, kwotą stałą** — po to, żeby ekipa nie brała procentu od
materiału. Taka pozycja zostawiona na domyślnym współczynniku (0,65 / 0,5525) po cichu przepłaca ekipę
i zaburza obie marże. Kosztorys nie wie, które pozycje niosą materiał, więc tego nie da się wymusić
automatem — stąd konwencja i ewentualne podpowiedzenie w edytorze.

### Należne podwykonawcy jest PRZED rabatem (EX-554, 2026-07-21)

Rabat to ustępstwo handlowe wobec klienta, wchłaniane przez marżę firmy — **ekipie należy się jej
cena niezależnie od tego, ile właściciel odpuścił klientowi**. Stąd „Suma wykonanej pracy" w
„Podsumowaniu podwykonawców" liczy się przed rabatem, i to jest łatwe do pomylenia, bo dwie
sąsiednie figury już rabat **mają w środku**:

- **nie** suma wartości netto (rabat per pozycja jest w niej zaszyty — `netForQtyForView`
  przepuszcza wartość przez `applyDiscount`),
- **nie** robocizna z kosztorysu (odejmuje na wierzchu jeszcze rabat globalny),
- **tak**: `Σ(net + discount)` po podsumowaniach sekcji **aktywnego widoku** — ta sama konstrukcja
  „dodaj rabat z powrotem", której używa „Suma prac" po stronie klienta. Przy rabacie globalnym
  `net` jest już pełną kwotą, a `discount` = 0, więc tożsamość dalej się trzyma.

Baza to zawsze prace **wykonane** (pomiar / odhaczone etapy), nie przedmiar, i zawsze cena
podwykonawcy **aktywnego** widoku (z narzędziami / bez) — nie cena klienta.

**Cała płaszczyzna podwykonawcy jest wolna od rabatu, nie tylko suma** (2026-07-24). Reguła siedzi
w jednym punkcie wyceny — `netForQtyForView` odejmuje rabat wyłącznie przy `view === 'client'` — a
że przez ten punkt przechodzą wszystkie figury podwykonawcy (wartości komórek, wartości etapów,
podsumowania sekcji), zeruje je jednym ruchem. Cztery kolumny rabatowe w ogóle się nie składają w
widokach Z/Bez narzędzi, bo pokazywałyby zera.

### Ręcznie wpisany „Pomiar z natury" w arkuszu klienta — liczba odniesienia, nie druga prawda (EX-686, 2026-08-13)

W arkuszu kanonicznym „Pomiar z natury" to formuła `=SUM(D:M)`, więc pomiar JEST sumą etapów i import
niczego nie gubi. W arkuszach klientów bywa **wpisany ręcznie** — wtedy niesie pracę, której właściciel
nie rozbił na etapy, a import bierze wyłącznie etapy i ta praca znika bez śladu (inwestycja 31:
41 377 zł w 32 pozycjach).

**Odrzucone: syntetyczny etap-kubełek** wchłaniający różnicę. Właściciel: „zmieniamy w chuj model
danych, żeby obsłużyć import starych arkuszy". Poza tym kubełek nie dawał się opróżnić — wpisanie
brakującej ilości w prawdziwy etap **dodaje** do sumy, nie debetuje kubełka, więc suma przeskakuje
ponad wpisany pomiar. Trzy dalsze konsekwencje wychodziły z tego samego korzenia (`plane: null`):
kubełek wyciekał do oferty klienta, blokował własne komórki, a `compareFooterTotals` — diagnostyka,
która ten defekt w ogóle wykryła — stawała się tautologią, bo obie stopki zgadzałyby się z definicji.

**Przyjęte:** import zapisuje obok tego liczbę odniesienia (`sheetMeasuredQty`), która **niczego nie
liczy** — nie wchodzi do robocizny, marży, rozliczeń z ekipami ani żadnej sumy; służy wyłącznie
porównaniu. Rozjazd jest wyliczany na żywo (`measureDiscrepancy`), więc lista kurczy się sama w miarę
wpisywania ilości w etapy — nikt nic nie kasuje, żeby ostrzeżenie zniknęło. Nazwa świadomie nawiązuje
do skasowanego `measured_qty` (EX-494), bo to **ta sama liczba** z arkusza; różni ją to, że jest
martwa. To **nie jest** cofnięcie EX-494 — suma etapów pozostaje jedyną prawdą o pracy wykonanej.

Pusta komórka musi dać `null`, nie `0`: dla liczby odniesienia `0` znaczy „arkusz twierdzi, że nic nie
zrobiono", a to jest twierdzenie, którego pusta komórka nie stawia.

**Formuła sumująca etapy = brak odniesienia, nie odniesienie równe jej wynikowi.** Zapisanie wyniku
`=SUM(D:M)` dałoby porównanie sumy etapów z sumą etapów — funkcję robiącą nic. Dlatego import czyta
formuły zakładki `kosztorys_robocizny` (wcześniej pobierał ją wyłącznie po wartościach) i pomija
komórkę wtedy i tylko wtedy, gdy jej formuła sięga do kolumn etapów — w dowolnym kształcie
(`=SUM(D5:M5)`, `=SUM(D:M)`, `=D5+E5`) i budowana z rozpoznanego zakresu etapów, nie z literału
(wąskie układy mają etapy `D–I`).

**Zawężone 2026-08-20 (właściciel).** Pierwotna reguła odrzucała KAŻDĄ formułę i tak trafiła do kodu,
choć argument istniał tylko dla sumy etapów. Kosztowało to strukturalną ślepotę na ~750 pozycjach
w ~20 inwestycjach — patrz `context/reference/kosztorys-sheet/formula-anomalies.md`, wniosek 2, i
sekcja o `=N#` wyżej. Rozkład, na którym oparto pierwotną ankietę (435/435, 0/245, 0/253), mierzył
wyłącznie jeden kształt formuły i dlatego wyszedł binarny.

## Filtry edytora — gramatyka „ptaszek znaczy widoczne" (2026-08-14, EX-665)

**Skąd to się wzięło:** „Zwiń puste sekcje" chowało sekcje po jednej liczbie —
`roundToCents(section.net) === 0`. Ta liczba zeruje się z dwóch niezależnych powodów: nic nie
wykonano **albo** nic nie wyceniono. Drugi przypadek jest szkodliwy — sekcja w całości wykonana, ale
bez ceny j.m., sumuje się do zera, więc przycisk zwijał dokładnie tę sekcję, która wymagała uwagi.
Stąd rozbicie jednej liczby na nazwane warunki i stąd zasada, że sekcja lifted się przez **∀** (każdy
wiersz pasuje), a nie przez sumę: suma dochodzi do zera przypadkiem, „wszystkie" nie. Brak ceny j.m.
został przy tym **diagnostyką, nie zwinięciem** — to defekt do znalezienia, nie stan do schowania.

Reszta rozstrzygnięta przy kliencie, po przetestowaniu wersji przeciwnej. Warunki chowania pozycji siedzą
w jednym rejestrze (`ROW_CONDITIONS`), a menu „Filtry" renderuje się z niego — ale kluczowa jest
**gramatyka ptaszka**, nie rejestr.

- **Ptaszek = widoczne.** Wiersz filtru jest domyślnie **zaznaczony**; odptaszkowanie chowa to, co
  pasuje. Pierwsza wersja miała odwrotnie („zaznacz, żeby zawęzić") i owner czytał ją źle za każdym
  razem — menu wyglądało wtedy na puste przy pełnej liście, a zaznaczenie jednej pozycji sprawiało
  wrażenie, że reszta zniknęła przypadkiem.
- **Filtry chodzą parami dopełniającymi** („bez przedmiaru" / „z przedmiarem"). Cztery warunki stały
  się sześcioma. Bez pary odptaszkowanie jednej strony nie ma czym się odwrócić, a użytkownik nie ma
  jak zapytać o dopełnienie.
- **Filtry odejmują (AND), diagnostyki zostawiają (OR).** Diagnostyka to przycisk w pasku, domyślnie
  wyłączony, po włączeniu zostawia **wyłącznie** swoje trafienia. Stąd rozdział `kind` w rejestrze i
  słowo **„engaged", nie „active"** w kodzie: dla filtru stanem domyślnym jest włączony, więc
  „aktywny" nazywałby połowie rejestru stan przeciwny.
- **Liczniki liczą się po całym kosztorysie, nigdy po ocalałych** — licznik ocalałych byłby liczbą
  samego siebie. To ta sama zasada, co przy sumach: `SUM` w arkuszu liczy ukryte wiersze.
- **Zwinięcie sekcji tłumi szukanie i zawężający filtr — nie ustawienie widoku klienta**
  (uzupełnione 2026-08-18, EX-713). Pierwotnie tłumiło **tylko** szukanie, choć notatka twierdziła
  inaczej; rozbieżność była niewidoczna, dopóki pasek chipów nie postawił obu stanów obok siebie.
  Zrównanie musiało jednak minąć „ukryj puste pozycje" z widoku klienta: to ustawienie jest domyślnie
  włączone i nie jest gestem czytelnika, więc liczone jako zawężenie rozwijało klientowi wszystkie
  sekcje — właściciel nie mógł wysłać zwiniętej oferty. Tłumi **kind: 'filter'** i szukanie, nic
  więcej.
- **Sekcja, którą filtr opróżnił, znika w całości** — z pasem i sumą. Ostry filtr inaczej zakopuje
  pięć trafień pod jedenastoma pustymi ramkami.
- **Jeden „Zresetuj filtry" cofa i warunki, i zwinięcia.** Dwa półresety zostawiają użytkownika
  dalej przed krótką listą, nie wiedzącego, którego z nich brakuje.

Numery pozycji liczą się po **pełnym, nieposortowanym** zbiorze — dziura w numeracji jest sygnałem,
że coś jest schowane. Numeracja przeliczana per widok czyniłaby filtr niewidocznym (1…N tak czy
inaczej).

**Grupa „Problemy" — sześć defektów pod jednym trójkątem (2026-08-17, EX-706).** Diagnostyki
przestały być luźnymi przyciskami w pasku i zebrały się w jedną listę, a nad nią stoi czerwony
trójkąt zapalany **danymi, nie kliknięciem** — „czy coś jest nie tak z tym kosztorysem" ma jedną
odpowiedź w jednym miejscu, zanim ktokolwiek cokolwiek otworzy. Wiersz pojawia się tylko przy
liczniku > 0, a przy czystym kosztorysie znika cała grupa. Rozstrzygnięcia, które łatwo odkręcić
w złą stronę:

- **Problemy są jednokrotnego wyboru** — drugi wybór zastępuje pierwszy. Stąd `toggleConditionExclusive`
  i stąd `engagedPlane` w ogóle da się odpowiedzieć: przy wielokrotnym wyborze nie byłoby jednej
  płaszczyzny, na której czyta się wynik.
- **Zaangażowany problem zostaje na liście, nawet gdy jego licznik spadnie do zera.** Inaczej
  naprawienie ostatniego trafienia zabierało jedyny przycisk zdejmujący zawężenie — siatka zostawała
  przycięta bez wyjścia. To była 🔴 tej bramki.
- **Stawka wykonawcy to dwa wiersze, po jednym na płaszczyznę** — liczone niezależnie od
  aktywnego widoku. Defekt na płaszczyźnie, na którą akurat nie patrzysz, dalej jest defektem, więc
  jeden wiersz pytający o widok nigdy nie pokazałby stawki drugiej ekipy. Odsłania kolumny swojej
  płaszczyzny, nie obu — od 2026-09-01 stawki obu płaszczyzn składają się w KAŻDYM widoku (domyślnie
  ukryte, do włączenia w pikerze), więc odsłonięcie obu odpowiadałoby na pytanie o jedną ekipę
  liczbami drugiej. Do podglądu inwestora żadna z nich nie ma wstępu — trzyma je wyłącznie allowlista
  `PREVIEW_VISIBLE_COLUMNS`, bo przypięcie płaszczyzny ceny już ich nie dotyczy.
  **Pyta o stawkę UJEMNĄ, nie o sufit** (EX-820, 2026-09-22): sufit wyprowadził się stąd do
  „Filtrów", bo kwota ratyfikowana w katalogu prac nie jest defektem, a jeden klawisz w mnożniku
  wrzucał całą rozpiskę na listę problemów. Tam para wierszy na płaszczyznę jest **dopełniająca**
  („z kwotą stałą powyżej sufitu" / „bez…"), bo filtry ukrywają trafienia i muszą dać się złożyć
  z powrotem w komplet; tu wiersz ujemnej stawki stoi sam, bo problem nie ma dopełnienia.
- **Problem etapowy zawęża kolumny etapów**, nie wiersze. Zakaz „widoczności per etap" dotyczy stanu
  **utrwalonego**; filtr jest przejściowy, więc go nie łamie.
- **Etap bez płaszczyzny liczy się dwa razy** (jest też etapem bez pracownika) — świadomie, żeby każdy
  wiersz czytał się dosłownie. Gdyby te liczniki kiedyś zasiliły jedną nagłówkową liczbę, trzeba to
  przemyśleć od nowa.
- **Podgląd inwestora nie ma problemów w ogóle** — ani grupy, ani trójkąta. Dokument klienta nie nosi
  księgowych wątpliwości firmy.

**Pasek aktywnych filtrów — co go kształtuje (2026-08-18, EX-713/EX-714).** Pasek nazywa każde
źródło, które właśnie skraca siatkę, i każde zdejmuje się jednym kliknięciem. Dwie decyzje warto
znać, zanim ktoś je odkręci:

- **Pasek zawija się, a siatka nie przelicza wysokości.** Wysokość siatki mierzy się przy montażu i
  przy zmianie okna — **bez ResizeObserver**, bo ten zapętlał się z detektorem
  react-datasheet-grid (wpis o migotaniu w `lessons.md`). Pasek nad siatką przesuwa `rect.top` nie
  wyzwalając żadnego z dwóch pomiarów, więc dolna krawędź siatki siedzi niżej, gdy filtry są
  włączone. Przeliczanie **było** zbudowane i zostało wycofane decyzją właściciela razem z wersją
  jednoliniową: chip za prawą krawędzią to dokładnie ten filtr, o którym nikt nie wie, a to
  przekreśla sens paska.
- **„Wyczyść wszystko" zdejmuje wszystko, co pasek pokazuje** — warunki, problem, zwinięcia i frazę —
  ale **nie sortowanie**, bo sortowanie niczego nie chowa.

**Filtry wartościowe (wykonawca / etap) odrzucone na merit, nie z braku czasu** (2026-08-18). Jeden
etap niesie dokładnie jednego wykonawcę, więc kolumna etapu **jest już** osią ekipy. Co gorsza, przy
najczęstszej pracy na tym ekranie — wpisywaniu tygodniowego postępu ekipy — filtr „wiersze, gdzie
ekipa X ma ilość > 0" chowa dokładnie te wiersze, w które nowa ilość ma trafić. Nie ma dla nich
issue i nie powinno powstać.

**Pasy sekcji a zakres sortowania.** Pas presuponuje, że wiersze sekcji stoją obok siebie, więc
sortowanie „w całym kosztorysie" zdejmuje pasy (i razem z nimi zwinięcia — inaczej zwinięta sekcja
nie miałaby czym się rozwinąć). Sortowanie „w sekcjach" zostawia wiersze na miejscu, więc pasy,
sumy i zwinięcia zostają.

## Wpłaty a tryb rozliczenia (czwarty przebieg, 2026-08-23)

**Nic nie przechodzi przez VAT.** Wpłata niesie wyłącznie te kwoty, które naprawdę miała:

- **gotówka** — jedna kwota netto, **brak kwoty brutto**. Lista wpłat drukuje w kolumnie brutto „×",
  nigdy 0,00: zero czyta się jak wpłata warta nic, a prawda jest taka, że tej kwoty nie ma.
- **przelew** — obie kwoty prosto z faktury: brutto i netto, które ta faktura nazywa. Netto jest
  podpowiadane stawką inwestycji i pozostaje do nadpisania. Kolumna `net_amount` istniała wcześniej
  (to kolumna wydatku netto), więc nie było migracji.

Powód: rachunek stoi na **dwóch stawkach** — przy rozliczeniu brutto materiały wchodzą stawką ze
sklepu, a robocizna narasta stawką z faktury — więc nie ma jednej stawki, którą dałoby się przeliczyć
wpłatę. Wcześniejsze przeliczanie zawyżało zaliczenie klientowi (w przykładzie kontrolnym ok. 73 zł
na wpłacie 10 000; przy rachunku złożonym z samych materiałów — cały VAT). Konsekwencja przyjęta
świadomie: „Razem" na liście wpłat przestało być parą związaną VAT-em, więc **zniknęło z pierwszej
tabelki**; suma na płaszczyźnie trybu i tak stoi w wierszu „Wpłaty" w rozliczeniu wyżej.

**Nazwa tagu mówi o formie, nie o płaszczyźnie.** „Netto"/„brutto" znaczyło na jednym ekranie dwie
różne rzeczy — tryb, w którym rozliczany jest cały rachunek, i tor, którym przyszła jedna wpłata.
Przechowywana wartość się nie zmieniła (`vatPlane` = NET/GROSS); zmieniła się etykieta:
„Gotówka"/„Przelew" (`DEPOSIT_PLANE_LABELS`). Tryb dalej nazywa się netto/brutto
(`VAT_PLANE_LABELS`). Wpłata bez oznaczenia liczy się jako gotówka.

**Tag wpłaty jest nieedytowalny.** Przetagowanie przesuwa dług o wartość VAT-u — ta sama klasa
decyzji co zmiana kwoty, której formularz edycji dla wpłat i tak odmawia. Transfer nie ma historii
wersji (edycja nadpisuje w miejscu), więc jedyna droga zostawiająca ślad to anulowanie
i zaksięgowanie na nowo. Pilnują tego trzy warstwy naraz, bo żadna nie wystarcza sama: pole
w kolekcji (`access.update`), schemat aktualizacji i akcja serwerowa — Local API z
`overrideAccess: true` przechodzi obok pierwszej z nich.

### Dwa predykaty, celowo obok siebie

- `isOffPlaneDeposit(wiersz, tryb)` — „czy tryb wciąż mówi prawdę". Oba kierunki. Zapala czerwony
  wiersz na liście wpłat i czerwony tekst pod rozliczeniem.
- `strandsDeposit(forma, tryb)` — „czy ta wpłata przepada". Wyłącznie **gotówka przy rozliczeniu
  brutto**: tam wpłata nie ma kwoty brutto, a nic już nie przelicza przez VAT, więc nie spłaca nic.
  Tylko to zatrzymuje księgowanie pytaniem.

Kierunek odwrotny (przelew tam, gdzie rachunek jest netto) spłaca dług kwotą netto z faktury — nic
nie ginie, więc jest sygnałem o trybie, nie stratą.

**Nigdzie nie blokujemy — pytamy.** Wpłata fizycznie się wydarzyła; odmowa zapisania faktu nauczyłaby
tylko przekłamywać formę płatności, żeby przejść przez drzwi — tym bardziej, że tagu nie da się potem
poprawić. Dialog stoi w dwóch miejscach: przy księgowaniu wpłaty i przy przestawianiu trybu
rozliczenia (to drugie wycenia, ile wpłat i za ile przestanie się liczyć). Panel admina i wywołanie
akcji wprost są świadomie nieobjęte — skoro nigdzie nie blokujemy, warstwa serwerowa nie zyskuje
nowej reguły.

### Lekarstwem jest tryb, nie wpłata

Jeśli na inwestycję wpływa i gotówka, i przelew, to ta inwestycja **jest mieszana** — nie nadążył
tryb, a nie wpłata jest zła. Dlatego wszystkie trzy komunikaty proponują „ustaw rozliczenie
mieszane", a nie „przeksięguj wpłatę": przestawienie trybu naprawdę ratuje tę kwotę (rachunek idzie
wtedy netto, gdzie każda forma ma kwotę), a kazanie przeksięgować gotówkę na przelew znaczyłoby
wpisać fakturę, której nie ma.

### Dlaczego tryb mieszany zostaje

Po usunięciu przeliczania mieszany różni się od netto **tylko** tym, że nie uznaje wpłaty przelewem
za niezgodną — kwoty liczy identycznie (`settlementModeToMoneyAxis`: MIXED → netto, dokładnie jak NET).
Zostaje mimo to, bo jest jedyną odpowiedzią, którą mają do zaproponowania trzy ostrzeżenia powyżej:
bez trzeciego trybu właściciel, który przyjmuje obie formy, nie ma dokąd przestawić inwestycji i
czerwony tekst zostaje na stałe. Mieszany nazywa fakt o inwestycji — „tu obie formy są legalne" — a
nie inną arytmetykę.

**Lista inwestycji pokazuje jeden bilans na tryb.** Widoczna jest kolumna tego trybu, w którym
inwestycja jest rozliczana; druga mówi „nie dotyczy". Mieszane idzie na **netto**, dokładnie jak
panel: bilans brutto odliczyłby wyłącznie przelewy i po cichu zgubił każdą gotówkę (na jednej
inwestycji testowej to różnica między +1 162,22 a −53 500). W trybie brutto ta różnica jest uczciwa —
te wpłaty są tam już zaznaczone na czerwono. W mieszanym gotówka jest legalna, więc ta sama liczba
byłaby po prostu fałszywa. To ta sama projekcja co oś panelu, nie druga jej kopia: lista nie może
pokazać kwoty, której panel pokazać odmawia. Obie kwoty liczą się dalej dla każdego wiersza — tryb
jest faktem, który właściciel może przestawić, i kolumna wraca razem z nim.

## Otwarte / odłożone

- **A vs B (przechowywanie cen):** 3 sztywne kolumny vs dynamiczna tabela
  `price_variants` + `item_prices`. Rekomendacja A (taniej, migracja A→B
  mechaniczna). User skłania się ku elastyczności. **NIEROZSTRZYGNIĘTE.**
- **Linkage `LABOR_COST`:** czy suma rozpiski steruje `LABOR_COST`, czy stoi
  obok (plan vs actual)? **OTWARTE.**
- **Szablony / „wzorzec":** seed nowego kosztorysu z wzorca. Podejście wybrane
  przez usera (najbardziej elastyczne): **bierzemy konkretny istniejący
  kosztorys jako wzorzec i „czyścimy do defaultów"** z granularnymi opcjami:
  - wyczyść prace → domyślne,
  - wyczyść etapy → domyślne,
  - wyczyść wpisane wartości (ilości/postęp) → domyślne (zostaw strukturę).
    = klon + selektywny reset. Potwierdza model snapshot (klon = kopia wierszy).
    **FOLLOW-ON** — warstwa NAD edytorem; wymaga najpierw rdzenia.
  - **Domyślny szablon (default):** jeden wyróżniony wzorzec **wstępnie
    zaznaczony** na liście wyboru przy tworzeniu nowego kosztorysu — user i tak
    potwierdza („użyj"), ale nie musi za każdym razem szukać; można wybrać inny.
- Auto-tworzenie kosztorysu przy dodaniu (sub)inwestycji.
- `work_catalogue`, multi-waluta, drag-reorder, teardown Sheets, synchronizacja
  dwukierunkowa.

## Pytania do właściciela (do rozstrzygnięcia biznesowo)

Pytania wymagające wiedzy domenowej właściciela — nie do rozstrzygnięcia z kodu.
Tracked live in `context/foundation/roadmap.md` (Open Roadmap Questions) —
this section is the original phrasing/context for those questions.

### Pokoje

- **P1.** W arkuszu pokoje to samodzielny kalkulator (brak powiązania z pozycjami).
  W aplikacji zostawiamy tak samo — luźny notatnik metrażu — czy chcemy pójść
  dalej i **wpiąć pomiar pokoju w przedmiar pozycji** (np. „malowanie ścian"
  bierze m² ze wskazanych pomieszczeń)? To ulepszenie ponad arkusz.
- **P2.** Wysokość ścian — stała (w arkuszu 2,58 m) czy wpisywana per pokój / per
  robota?
- **P3.** „Powierzchnia malowania" = ściany minus pomieszczenia mokre. To reguła
  stała (zawsze łazienki/WC odejmujemy) czy ustalana ręcznie za każdym razem?

### Ceny

- **P4.** Zestaw modeli ceny to stałe 3 (klient / podwyk. z narzędziami / bez),
  czy spodziewasz się dodawać/usuwać warianty? (decyduje schemat: A vs B)
- **P7.** Domyślna stawka VAT dla nowej pozycji (8% remont mieszkań vs 23%)?
- **P8. [ROZSTRZYGNIĘTE — właściciel 2026-07-15]** Brutto/VAT dotyczy
  **wszystkich trzech** wariantów ceny (klient + oba podwykonawcy), po stawce
  inwestycji. Uzasadnienie właściciela: „czytam brutto podwykonawcy".
  Rozstrzyga sprzeczność w zapisach slice'u S-05: `plan-brief.md:33`
  (`context/archive/2026-07-10-kosztorys-vat/`) nazywał brutto „figurą decyzji
  klienta" (sugerując tylko widok klienta), a wdrożony `plan.md:232` tego samego
  slice'u mówi „Brutto consistent across all three price views" — **wygrywa
  zachowanie wdrożone**, które jest zgodne z odpowiedzią właściciela.

### Pozostało do rozliczenia / bilans

- **P9. [ROZSTRZYGNIĘTE — potwierdzone formułą `AF` 2026-07-15]** Kolumna „pozostało do rozliczenia" (AF) = **kontrola
  postępu robót**: ile wartościowo zostało do zrobienia w pozycji. Nie figura
  rozliczeniowa z klientem — wskaźnik „jak idzie robota". Formuła: wartość
  pozycji − Σ wartości wykonanych etapów. W aplikacji: kolumna wyliczana
  (informacyjna, postępowa). Rozważyć nazwę „pozostało do wykonania".

### Robocizna ↔ rozliczenia

- **POTWIERDZONE (właściciel, 2026-07-21, EX-551): robocizna = cena klienta za
  prace, PO RABACIE.** Model marży spinający kosztorys z inwestycją:
  - **robocizna** = Σ ceny klienta wykonanych prac, **po rabacie** (widok „Klient").
  - **wypłaty** = cena podwykonawcy = cena klienta × współczynnik (domyślnie `0,65`
    z narzędziami / `0,5525` bez; override na sekcji / pozycji) = to, co właściciel
    płaci ekipie.
  - **marża** = robocizna − wypłaty (przy domyślnym współczynniku strukturalnie
    35% / 44,75% wartości oferty — nigdy 0).

  **POTWIERDZONE (właściciel, 2026-07-21): wypłaty należne = ceny podwykonawcy z
  kosztorysu; realne wypłaty (`PAYOUT`) zmniejszają „kwotę do zapłaty
  podwykonawcy".** Czyli istnieją **obie** figury i wchodzą w relację spłaty:
  - **wypłaty należne** = Σ cena podwykonawcy (z kosztorysu) — ile ekipie się należy,
  - **kwota do zapłaty podwykonawcy** = należne − Σ zrealizowanych `PAYOUT` —
    każda realna wypłata spłaca to, co ekipie należne z kosztorysu.

  To domyka otwarty wcześniej wybór „należne vs wypłacone" z EX-551: nie jest to
  albo/albo — cena podwykonawcy definiuje należne, `PAYOUT` je spłaca.

  **DO ZBUDOWANIA (właściciel, 2026-07-21):** figury „kwota do zapłaty
  podwykonawcy" jeszcze nie ma — trzeba ją dodać do **`Podsumowania`** edytora.
  Linear: EX-554.

- **Kosztorys = dokument dla klienta; docelowo wchłania całe koszty inwestycji**
  (właściciel, 2026-07-15). „To kosztorys finalnie trafia do klienta. Tam mamy
  wszystkie prace, plus wydatki na materiały i tak dalej, plus koszt robocizny."
  Czyli rozpiska prac to **część** docelowego kosztorysu, nie całość: dochodzą
  materiały (`INVESTMENT_EXPENSE`) i robocizna (`LABOR_COST`).

  **Oderwany jest edytor v2 — nie V1**, gdzie lustro `INVESTMENT_EXPENSE` (PRD
  FR-014, `prd.md:30`) już te koszty wnosi.

  > **Nieaktualne od EX-555 i EX-649.** Akapit niżej opisywał stan, w którym kosztorys
  > nie wchodził do żadnej marży. Dziś robocizna i rabat na liście inwestycji czytane są
  > **z kosztorysu** (EX-555), a obok starej marży stoi marża rzeczywista liczona z
  > kosztorysu razem z prognozą z przedmiaru (EX-649). Stara marża transferowa została
  > nietknięta i dalej jest tym, co widać na v1 i `/raporty` — dwie figury obok siebie,
  > nie zamiana jednej na drugą.

  ~~Skutek dla v2, ważny przy każdej
  figurze pieniężnej w edytorze: **marża liczy się wyłącznie z transferów**
  (`robocizna − wypłaty − rabat − strata`), a kosztorys v2 w nią nie wchodzi —
  rabat wpisany w edytorze obniża tylko wartość kosztorysu.~~ To nie bug edytora,
  to nieodtworzone połączenie. Pierwszy kawałek = parytet `Podsumowania`
  (roadmap 12a); slice'a na samo łączenie brak.

  Konsekwencja dla P5 niżej: to nie jest wąskie pytanie „czy suma ustawia
  `LABOR_COST`", tylko **kierunek zależności między dwiema płaszczyznami**, które
  mają się zejść. Parytet zakładki `Podsumowanie` (roadmap 12a, `roadmap.md:546`)
  jest tego pierwszym kawałkiem — arkusz **już** dzieli na Robocizna/Materiały/
  Łącznie, appka ma tylko sumy sekcji. Brak slice'a na samo łączenie.

- **P5.** Czy suma rozpiski robocizny ma **automatycznie** ustawiać kwotę
  `LABOR_COST` (Koszty robocizny), czy zostaje ona osobną, ręczną transakcją
  (rozpiska = plan, `LABOR_COST` = zafakturowano)?
- **P6.** Czy kosztorys ma się **auto-tworzyć** przy dodaniu nowej (sub)inwestycji?

### Dostęp / widoczność

- **P10.** ~~Które dokładnie komórki/kolumny ukryć przed MANAGEREM (follow-on)?
  Hipoteza: ceny podwykonawcy (z narzędziami / bez) = koszt i marża. Cena
  klienta, przedmiar/pomiar, postęp etapów — widoczne dla MANAGERA?~~
  **ROZSTRZYGNIĘTE (owner, 2026-08-18): żadnych — MANAGER widzi wszystko.**
  Jedyne, czego nie widzi, to zakładka Marża, i to już działa (gate po roli na
  stronie inwestycji i w Podsumowaniu v2). Ukrywanie kolumn dotyczy **klienta**,
  nie roli — weszło jako per-inwestycyjne ustawienia widoku klienta (EX-695).
  Slice S-10 `kosztorys-column-rbac` wycięty w całości; pytanie o wiersze nigdy
  nie było tu zadane — dopisano je przez symetrię do kolumn.

### Plan-vs-actual

- **P11.** ~~Domyślny wariant kosztu podwykonawcy (z narzędziami vs bez) — jako
  default sekcji, od którego dziedziczą pozycje?~~ **ROZSTRZYGNIĘTE (EX-565):**
  wariant siedzi na **etapie**; defaultu sekcji ani dziedziczenia na pozycji nie ma.

### Druk / eksport — eksport cięty (2026-08-15), pytania przechodzą na widok klienta

- **P12.** ~~Które pozycje mają być **domyślnie ukryte** w eksporcie dla klienta?~~
  Bezprzedmiotowe w tej formie — nie ma eksportu. Wraca tylko wtedy, gdy widok
  klienta dostanie ukrywanie pozycji (EX-549, sparkowane, czeka na decyzję ownera).
- **P13.** **Nadal otwarte, przeniesione na widok klienta:** klient widzi ilość
  z **przedmiaru** (oferta wstępna) czy z **pomiaru** (rozliczenie)? Jeden tryb czy
  przełącznik? To samo pytanie, inna powierzchnia — widok jest żywy, więc „jeden
  tryb" znaczy teraz „ten sam ekran przez całą inwestycję".

## Fakty domenowe z weryfikacji manualnej (destylat 2026-09-15)

Wyciągnięte z `context/foundation/manual-checks.md` przy jego przycięciu; pełny rejestr leży w
`context/archive/manual-checks/2026-09-15-pelny-rejestr.md`.

**Etap bez planu (`plane = NULL`) jest nie do utworzenia z UI — i tak ma być.** Rozstrzygnięcie
właściciela (2026-09-14): każdy etap zakładany w aplikacji dostaje `w_tools` albo `own_tools`.
NULL istnieje wyłącznie jako dane zastane sprzed wprowadzenia planów. Żeby taki etap zobaczyć na
oczy w środowisku testowym, trzeba go **wstawić SQL-em** — brak ścieżki w UI nie jest luką do
zgłoszenia.

**MIXED rozlicza się na JEDNYM planie — netto.** Mieszane są **wpłaty**, nie rachunek: klient może
wpłacać brutto i netto, ale rozliczenie liczy się na płaszczyźnie netto. Nie szukaj w trybie MIXED
dwóch równoległych sum.

**`/k/<token>` pokazuje klientowi dokładnie trzy widoki**: Podsumowanie, Materiały, Robocizna.
Podwykonawcy i Marża są wyłącznie dla właściciela i nie mają się tam pojawić w żadnym trybie.
Dodatkowo każda liczba diagnostyczna jest w trybie `preview` twardo zerowana, więc przycisk
„Problemy" w widoku klienta **nigdy się nie montuje** — jego brak to nie defekt renderu.

**`SlicePie` zwraca `null` poniżej dwóch niezerowych wycinków.** Brak wykresu przy jednej sekcji jest
zamierzony.

**`Przedmiar` celowo nigdy nie jest sumowany per sekcja** — kolumna miesza jednostki miary, więc suma
nie miałaby znaczenia. Brak podsumowania w nagłówku sekcji to decyzja, nie przeoczenie.

**Dopasowanie zakładki `LABOR_TAB` zostaje dokładne — to decyzja, nie luka.** 56 z 57 zrzuconych
arkuszy klienckich niesie kanoniczne `kosztorys_robocizny`; jedynym wyjątkiem jest wypełniony arkusz
testowy `1qN68vcevWgq0fXckdh4cuyBJ4iGZNlivVuHDvLuzWy4`, gdzie nazwa rozjechała się do
`"kosztorys_robocizny(dla inwestora) "`. **Nie rozluźniaj** dopasowania w
`src/lib/kosztorys/sheet-import/read-sheet.ts` pod ten jeden arkusz — dopasowanie po prefiksie
zaczęłoby łapać cudze zakładki w 56 pozostałych.

## Destylat z zamkniętych zmian 22–23.09.2026

Wyciągnięte z `research.md` / `plan.md` czterech zmian skasowanych przy archiwizacji
(`szablon-autosave`, `stawka-problems-and-filters`, `filtry-bez-widoku`, `kosztorys-editor-assets`).
Pełny tekst zostaje w historii gita pod `context/archive/2026-09-2*/`.

**Zaangażowane warunki to nieopatrzona wersją baza danych użytkownika.** `engagedConditionIds` żyje
w localStorage pod `kosztorys-filters:<investmentId>`, bez klucza wersji, a nieznane id **nigdy nie
są usuwane** (świadomie — id wraca po przełączeniu widoku). Skutek: **przejęcie id istniejącego
warunku jest migracją cudzych danych bez migracji.** Gdyby para „powyżej sufitu" odziedziczyła
`overpriced-*`, zapisany ptaszek „pokaż tylko zepsute" stałby się „ukryj zepsute" — dokładne
odwrócenie. Nowy warunek dostaje **nowe id**, stare zostają porzucone.

**Warsztat to jedna inwestycja dla wszystkich szablonów**, a ten sam klucz jest kluczowany po
`investmentId` — więc ptaszek ustawiony przy szablonie A jest wciąż włączony po otwarciu B.

**Bramka bywa ergonomią, nie niezmiennikiem — sprawdź, czy trwały stan już ją omija.** Bramka
płaszczyzny w `offeredFilterConditions` wyglądała na ochronę spójności; nie była. Zaangażowany filtr
obcej płaszczyzny przeżywa zmianę widoku i przeładowanie, więc stan „filtr drugiej płaszczyzny tnie
siatkę" był osiągalny zawsze — bramka utrudniała wejście w niego o jedno kliknięcie. Jej prawdziwym
zadaniem (EX-714) była **długość listy**. Kasując taką bramkę, trzeba przejąć jej prawdziwe zadanie
(tu: próg licznika), a nie to, na które wygląda.

**„Lista kolumn jest zamknięta" nie znaczy „widok nic nie robi".** `WORKSHOP_VISIBLE_COLUMNS` mrozi
kolumny warsztatu, ale `sort-value.ts` czyta `view` **poza** zestawem kolumn — warsztat sortował po
stawce wykonawcy, wyświetlając cenę klienta. Pochodne widoku żyją poza listą kolumn.

**`pickView` jest jedynym zapisującym klucz widoku** (`kosztorys-view:<mirrorId>`). Ukrycie samego
przycisku zamraża na zawsze każdą przeglądarkę, która wcześniej stanęła na obcej płaszczyźnie —
zdjęcie kontrolki i przypięcie płaszczyzny muszą iść w jednej zmianie. Przypięciu podlega
`persistedView`, nie całe wyrażenie widoku: ulotna nakładka z „Problemów" ma zostać, bo to ona
prowadzi czytelnika do wady.

**`investmentAction` jest jedynym punktem, przez który przechodzi każdy zapis w drzewo** — ~36
ścieżek. Kliencki `dispatch` w `use-debounced-save` łapie **~4 z nich**. Każda funkcja typu „zrób coś
przy każdej zmianie drzewa" musi siadać w akcji, nie w edytorze.

**Licznik `revision` udaje sygnał „brudne", a nim nie jest** — jest ślepy na etapy, dodawanie
pozycji, ustawienia i hurtowe zastąpienie. Wiszą już na nim undo/redo i bramka auto-snapshotu; każda
kolejna funkcja oparta na nim dziedziczy tę dziurę.

**Koszt jednego lustra szablonu — zmierzony (2026-09-22).** `kosztorys_presets.payload` to ~310–325 B
tekstu JSON na pozycję (~58–65 B po TOAST); największe lokalne drzewo (379 pozycji) = 124 530 B.
Kolumna ma `attstorage = 'x'`, więc **HOT update jest niemożliwy** — każdy zapis to nowy łańcuch
TOAST. Jedno lustro ≈ 250 KB ruchu do Neona, a wklejka w 50 komórek bez dławika = 50 równoległych
luster ≈ 12,5 MB na jedno Ctrl-V. Dlatego dławik siedzi w **bazie** (`mirrored_at`), nie w timerze:
serverless nie utrzyma timera między requestami.

**Serializacja szablonu jest stratna, a warsztat o tym nie mówi.** `serialize-preset.ts` zeruje
`plannedQty`, `sheetMeasuredQty`, `discountType`, `discountValue`, `note` i wyrzuca całe `stages`
i `progress` — a menu „Dodaj" w warsztacie oferuje „Etap — …" i pełną siatkę. Pod autozapisem strata
przestaje być jednym świadomym kliknięciem i staje się ciągłym, niewidocznym rozjazdem. Zamknięta
lista kolumn warsztatu jest odpowiedzią na to, nie kosmetyką.

**Kosztorysy zasiane z szablonu są kopiami zamrożonymi** — edycja szablonu nigdy nie rusza
istniejących kosztorysów. To zdanie znosi jedyny argument, który mógłby bronić jawnego „Zapisz"
w warsztacie.
