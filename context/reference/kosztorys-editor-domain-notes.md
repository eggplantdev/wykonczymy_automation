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

**Rozbicie `S`/`T` okazało się szablonem, nie wyjątkiem (2026-09-28).** Z 15 czytelnych arkuszy
podpiętych od lipca 7 ma ten układ, kanoniczny też — ręczne wskazywanie przy prawie każdym nowym
arkuszu było ślepym zaułkiem w innym miejscu. Import rozpoznaje więc sam kolumnę po stronie Pomiaru:
„Wartość netto pomiar z natury" (wiersz 1) / „Wartość pomiar z natury" (wiersz 3). To ją arkusz
liczy — suma sekcji to `SUM(T)`, „pozostało do rozliczenia" to `T − Σ etapów` — a `S` wycenia tylko
przedmiar. W tym szablonie Pomiar (`O`) jest wpisywany ręcznie (albo `=N`), nie `SUM(D:M)`.

**Czego świadomie nie zrobiliśmy:**

- **Nie poluzowaliśmy dopasowania po nazwie.** Dopasowanie po prefiksie „wartość netto" złapałoby
  `S` i `T` naraz — odmowa „nie znaleziono kolumny" zamieniłaby się w odmowę „pasuje do 2 kolumn".
  Dopisane są dokładne nazwy strony Pomiaru, `S` celowo nie pasuje.
- **Żadnego słownika pod pojedyncze arkusze.** Wariant nazwy trafia do matchera dopiero, gdy jest
  szablonem powtarzanym w wielu arkuszach; jednorazowy układ obsługuje ręczne wskazanie kolumny.
- **Kolumny opcjonalne nie blokują pobrania.** Arkusz bez rabatu ma się wczytywać jak dotąd — brak
  takiej kolumny to informacja w raporcie, nie odmowa.

### Formuły (dosłownie z arkusza, wiersz 390)

```
T  = O*Q - (Q*R)*O                     wartość netto  = pomiar × cena − rabat
V  = D*$Q - (D*$Q*$R)                  wartość etapu  = ilość_wykonana × cena − rabat
AF = T - V - W - X - Y - Z - AA…AE     bilans         = wartość − Σ etapów
```

Appka jest z tym 1:1 w `V` (`stageValueForView`). **Nie** w `AF`: skoro `O` = Σ etapów, arkuszowe
`AF` = `T − Σ(V:AE)` jest tożsamościowo zerem, więc „Pozostało" (`rowRemainingForExecutedQty`) celowo
kotwiczy do `S` (oferty), nie do `T` — patrz „Oferta i wykonanie" niżej. Potwierdza P9.

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

**A settings save that throws reverts like `{success:false}`** (owner, 2026-09-15, EX-597): revert
and toast, never keep-and-reload. Accepted tradeoff: if the connection drops after the request reached
the server, the write may persist while the screen shows the reverted value — a narrower risk than
two different failure behaviours.

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

## Co widzi klient — ustawienie, nie stała (EX-695, 2026-08-15; jeden zestaw od 2026-09-28)

Zestaw kolumn widoku klienta przestał być stałą w kodzie. Rozstrzygnięcie idzie w kolejności:
własny wiersz inwestycji (`kosztorys-client-view`) → globalne domyślne firmy
(`kosztorys-client-view-defaults`) → domyślne z kodu. Rozwiązywane w
`src/lib/queries/kosztorys-client-view.ts`.

**Jeden zestaw, bez wariantów** (właściciel, 2026-09-28). Warianty „Oferta / Rozliczenie" zniknęły:
inwestor ma jeden zestaw kolumn, a o tym, czy widzi rozliczenie, decydują dane, nie przełącznik.
Kolumny rozliczenia — „Pomiar z natury", każdy etap (ilość i wartość), „Razem netto", „Rabat kwota",
„% wykonania" — pokazują się dopiero, gdy są w nich wpisy: etap bez wpisów znika w całości, a sumy
rozliczenia znikają, dopóki żaden etap nie ma wpisu. Oferta wysłana przed pracą jest więc
czysta bez żadnego klikania, a pierwszy wpis w etapie dociera do linku, który inwestor już ma.
„Pozostało" do tej reguły nie należy: przed pracą to cały przedmiar, liczba prawdziwa — domyślnie jest
ukryte i ukrywa je tylko wybór właściciela. Ta sama reguła obowiązuje podgląd, link, PDF i zakładkę
„Robocizna" w podsumowaniu inwestora („Brak etapów.", gdy żaden nie ma wpisów); widok pracownika
stosuje ją nad swoimi etapami (niżej). Liczona z NIEPRZEFILTROWANYCH pozycji (`settlement-columns.ts`), żeby kolumna nie
pojawiała się i nie znikała, gdy inwestor przełącza „Pokaż wszystkie pozycje".

Reguły, które trzymają to razem:

- **`PREVIEW_VISIBLE_COLUMNS` pozostaje sufitem.** Zapisany klucz i reguła wpisów mogą tylko
  _odjąć_ kolumnę, nigdy dodać — sanityzacja przy zapisie i przy odczycie odrzuca klucz spoza
  allowlisty, więc ustawienie nie staje się drugą, rozjeżdżającą się odpowiedzią na pytanie „co
  klient może zobaczyć". Klucz zapisany przez właściciela jest `toggleKey` i bierze całą rodzinę
  per-etap; reguła wpisów odejmuje pełne identyfikatory kolumn, bo pusty etap znika sam, nie z
  wypełnionymi.
- **Brak zapisanego zestawu ukrywa zestaw domyślny, nie „nic"** (fail-closed). Przechowywany jest
  zestaw UKRYTY, więc NULL albo nie-tablica czytane jako „nic nie ukryte" serwowałyby całą
  allowlistę, z rabatem włącznie.
- **Ukrywanie pustych pozycji to jedna reguła, nie dwie** (`client-empty`, `kind: 'client'`):
  pozycja bez przedmiaru **i** bez wykonanej pracy nie wnosi nic do żadnej z dwóch kwot, które
  klient czyta, więc jej ukrycie nie rusza podsumowania. Każdy z dwóch filtrów osobno byłby
  bezpieczny tylko dla jednej z nich.
- **Przełącznik „Pokaż wszystkie pozycje" (inwestor) numeruje ujawnione pozycje od nowa**, w
  kolejności dokumentu — więc przy włączonym przełączniku numeracja rozjeżdża się z wydrukiem oferty,
  który czyta zapisane ustawienie, nigdy stanu przełącznika. Zaakceptowane: przełącznik to gest
  czytania na jedną wizytę, nie część dokumentu.
- **„Udostępnij" kopiuje link już przy kliknięciu** — tworzy go tylko wtedy, gdy inwestycja żadnego
  nie ma, i nigdy nie podmienia istniejącego (to odcięłoby inwestora, który go trzyma). Okno
  udostępniania nie ma już kroku ustawień; prowadzi do nich przycisk „Ustawienia podglądu…".
- **Kolejność kolumn ustawia właściciel, „Opis prac" zawsze pierwszy** (EX-884, 2026-09-28). Zapisana
  razem z zestawem, na „Zapisz", osobno dla każdej oferty i raz dla pracowników; obowiązuje podgląd,
  link i PDF. Kolejność przechowywana jest jako rangi względem listy dokumentu w kodzie, więc wpięcie
  nowej kolumny w środek tej listy przesuwa miejsce kolumn bez rangi — nowa kolumna ląduje tam, gdzie
  stoi w kodzie, a nie na końcu. Oferta zapisana przed EX-884 ma własny wiersz bez kolejności, a wiersz
  inwestycji wygrywa w całości — więc pokazuje kolejność wbudowaną, nie kolejność firmy, dopóki
  właściciel nie kliknie „Przywróć domyślną kolejność".
- **Na dokumencie inwestora nie ma żadnej kwoty brutto** (właściciel, 2026-09-28). Oferta jest netto,
  więc kolumny brutto nie da się nawet zaznaczyć w ustawieniach, a znacznik brutto zapisany wcześniej
  odpada przy sanityzacji.

**Podgląd nie zna trybu rozliczenia** (EX-631, rozstrzygnięte 2026-08-12). `settlementMode` NIE wraca
jako bramka prawdy. O ujawnieniu decyduje wyłącznie allowlista (i zapisane ustawienie widoku klienta pod
nią); oś kwot jest preferencją czytania, a preferencja jednego czytelnika nie może decydować, co widzi
drugi. Odwrotnie niż `globalDiscountActive`, który do gałęzi podglądu wrócił właśnie dlatego, że jest
stanem inwestycji, a nie preferencją.

Ustawienia czytane są **obok** cache'owanego payloadu podglądu (jeden indeksowany odczyt), więc
zapis działa od następnego żądania bez tagu cache, a zmiana domyślnych firmy nie unieważnia drzewa
żadnej inwestycji.

**„Pobierz faktury" on the investor link is intended** (owner, EX-569, 2026-07-25). Supplier invoices
— names, prices, hence the margin — in the client's hands is the point of the feature, not an
oversight. Caveat: Blob URLs are public, unguessable and permanent (`read: () => true` on media), so
revoking the share token does not revoke an invoice URL already obtained; closing that means a proxy
or signed URLs, a separate decision.

## Widok pracownika — link imienny i PDF, tylko odczyt (EX-875, 2026-09-28)

Pracownik / podwykonawca dostaje od ownera **imienny** widok kosztorysu inwestycji: link
`/z/⟨inwestycja⟩/⟨nazwisko⟩/[token]` albo PDF, oba z menu „Pracownicy" w edytorze. Link i PDF
generuje ADMIN / OWNER / MANAGER (jak u inwestora); ustawienia widoku pracownika są **jedne na
firmę** i zapisuje je tylko ADMIN / OWNER. Kliknięcie „Link do zgłoszeń" działa jak „Udostępnij"
inwestora: oddaje żywy link albo wydaje nowy i kopiuje go do schowka — u pracownika zablokowanego
tylko pokazuje link do wyłączenia. „Podgląd" otwiera ten sam widok bez wysyłki zgłoszeń.

- **Zakres = przypisanie etapu.** Pracownik widzi wszystkie pozycje (Przedmiar nie dzieli się na
  etapy), ale tylko kolumny swoich etapów — także etapu, który dzieli z innymi (EX-943). Na takim
  etapie ilości i kwoty w wierszach są **całego etapu**; jego część stoi w podsumowaniu w kolumnie
  „Twój udział", a współpracowników dokument nie wymienia z imienia ani kwoty. Etap bez rozliczenia albo etapy na dwóch rozliczeniach →
  menu blokuje link i PDF („Ustaw rozliczenie etapu" / „Etapy pracownika mają różne rozliczenia");
  pracownik bez etapów → link działa i mówi „Brak przypisanych etapów". Odwołanie tylko świadomie,
  także po dezaktywacji pracownika — i zawsze osiągalne: blokada wyłącza generowanie linku, nie jego
  wyłączenie, a pracownik odpięty od wszystkich etapów zostaje w menu, dopóki ma żywy link (EX-888).
  Token przeżywa blokadę, więc bez tego stary link po jej zdjęciu znów pokazałby ceny.
  Automatycznego odwołania przy odpięciu ostatniego etapu świadomie nie ma: ponowne przypięcie
  wymagałoby wtedy nowego linku. Kto ma żywy link, menu czyta przy każdym otwarciu, a nie z propsów
  edytora. Dzięki temu po odwołaniu dane są świeże i nie ma przeciągania przez kontekst (EX-496).
- **Stawka wynika z rozliczenia jego etapów** — nikt jej nie wybiera, a widok jest do niej
  przypięty: zła stawka to wyjątek, nie cicha naprawa. Ceny klienta, „Wartości netto" po cenie
  klienta, rabatu, brutto, mnożnika i cudzych etapów nie da się włączyć żadnym ustawieniem —
  allowlista pracownika jest sufitem, ustawienia tylko z niej ujmują.
- **„Wartość przedmiaru netto — ⟨rozliczenie⟩"** to Przedmiar × stawka rozliczenia: ile ekipa
  zarobi, jeśli wykona cały przedmiar. W edytorze stoi **obok** „Wartości przedmiaru netto" (która
  liczy po cenie klienta w każdym widoku), tylko w widokach „Z narzędziami" / „Bez narzędzi"; w
  widoku inwestora jej nie ma, bo byłaby kopią. Tylko netto — wypłaty podwykonawców są bez VAT.
- **„Pozostało" liczy pracę wszystkich etapów**, nie tylko jego: pozycja dokończona przez inną ekipę
  pokazuje 0, bo to lista „co jeszcze do zrobienia", nie „co jeszcze zrobię ja". Suma w stopce
  pomija wiersze na minusie, jak u właściciela (EX-885).
- **Puste pozycje** — ta sama dwuosiowa reguła co u inwestora, z osią „wykonane" = jego etapy, więc
  ukrycie nie rusza żadnej sumy podsumowania.
- **Kolumny rozliczenia pojawiają się po pierwszym wpisie w JEGO etapach** (właściciel, 2026-09-29 —
  odwraca wcześniejsze „pusty etap inwestora to nie powód, by ukryć go przed ekipą"). Reguła
  inwestora: przed pracą „Pomiar (razem etapy)", „Wartość wykonana" i kolumny etapów znikają, a etap
  bez wpisów nie pojawia się nigdy. Wpis innej ekipy nie zmienia jego dokumentu — projekcja zna tylko
  jego etapy. Do tego checkbox firmowy „Ukryj przedmiar i wartość przedmiaru, gdy w etapach są już
  wpisy" (domyślnie zaznaczony): po pierwszym wpisie „Przedmiar" i „Wartość przedmiaru netto"
  schodzą z dokumentu, a sumy sekcji w PDF liczą wtedy wartość wykonaną. „Pozostało" i podsumowanie
  nie podlegają checkboxowi. Jedna funkcja (`workerDataHiddenColumns`) karmi link, Podgląd i PDF.
- **Podsumowanie** (bez wartości przedmiaru — pracownik rozliczany jest z pracy wykonanej): trzy
  tabele jedna pod drugą, w linku i w PDF w tej samej kolejności. (1) „Wykonane": etap | Wartość
  etapu | Twój udział | Kwota netto + „Razem" pod obiema kwotami; dwie środkowe kolumny są tylko,
  gdy któryś jego etap jest wspólny, a jego kwota to udział po ewentualnym proporcjonalnym
  zmniejszeniu, więc „Razem" sumuje udziały. (2) „Twoje rozliczenie": wykonane razem → wypłacone →
  pozostało do wypłaty; nadwyżka wypłat to „Nadpłata" z dodatnią kwotą, nigdy liczba ujemna.
  (3) „Wypłaty": data | opis (pisany dla pracownika) | kwota + „Razem".
- **PDF** to ten sam generator co oferta, z projekcji pracownika (nigdy z wierszy edytora, które
  niosą cenę klienta): A4 poziomo, bo każdy etap dokłada dwie kolumny; kwoty z groszami, bo stawka
  7,50 zł zaokrąglona do „8 zł" to inna stawka. Na papier idą te same kolumny, w tej samej
  kolejności, co w podglądzie pracownika — po tej samej regule wpisów, więc „Σ etapów" i „Wartość
  wykonana" pojawiają się dopiero po pierwszym wpisie.

### Zgłoszenia wykonanych prac — pracownik zgłasza ilości, kierownik przyjmuje (EX-947, 2026-09-30)

- **Jeden link (EX-966).** „Zgłoszenie prac" (`/z/⟨inwestycja⟩/⟨nazwisko⟩/[token]`) jest jedynym
  widokiem pracownika. Oba człony nazwy to ozdoba — rozwiązuje sam token, a pusta nazwa daje `-`.
  Osobna rozpiska `/p/…` z EX-875 została usunięta bez przekierowania, a linki
  `/zgloszenie-prac/…` przestały działać 2026-10-05 (właściciel: bez przekierowania, wysyła linki
  ponownie z menu „Pracownicy" — token się nie zmienia). Oba stare adresy dają tę samą stronę
  „link nieaktywny" co nieznany token, nie logowanie — pracownik nie ma konta. Kto nie może mieć
  rozpiski (brak etapu, etap bez rozliczenia, mieszane rozliczenia), ten nie zgłasza. Działa na
  telefonie — jedyny wyjątek od wąskiego zakresu telefonu.
- **Granica prywatności jest w jednym miejscu.** „Tylko jego etapy" egzekwuje `withWorkerSettings`
  (`lib/queries/worker-kosztorys.ts`) — jedyny builder pod linkiem „Zgłoszenie prac" i pod
  „Podglądem pracownika". Nowy widok pracownika ma przejść przez niego, nie składać własnego
  odczytu; testy prywatności stoją na `getWorkerKosztorysByReportShare`.
- **Dwa tryby w stopce** (przypięta do dołu ekranu, przyciski równej szerokości): „Zgłaszam pracę"
  — opis prac, kolumna „Zgłaszam", „Nowa praca" i „Wyślij"; „Inwestycja" — cała rozpiska bez
  „Zgłaszam" i bez wysyłki, a pod nią rozliczenie w układzie stopki PDF. Wpisane ilości przeżywają
  przełączenie trybu. Liczniki: „Tylko zgłaszane przeze mnie (N)" liczy pozycje z wpisaną ilością,
  „Wyślij (N)" — wszystkie linie wysyłki, także kompletne „Nowe prace", a „Wszystkie prace (+N)" —
  wiersze, które ukrywa reguła pustych pozycji (przy 0 bez licznika). W nagłówku nie ma tytułu.
- **Pracownik wpisuje ilość w j.m. pozycji** w kolumnie „Zgłaszam" na swojej rozpisce, plus prace
  spoza rozpiski (opis, j.m., ilość). Szkic żyje w przeglądarce; do bazy trafia dopiero wysłane
  zgłoszenie. Wysłane jest ostateczne — poprawka to nowe zgłoszenie, a złe kierownik odrzuca. Na
  zakończonej inwestycji wysyłka jest zablokowana.
- **Kierownik** widzi zgłoszenia w nawigacji („Zgłoszenia wykonanych prac", z licznikiem oczekujących we
  wszystkich inwestycjach) i w przycisku na pasku rozpiski. Przyjęcie dzieje się w rozpisce: wybiera
  etap zgłaszającego albo „Nowy etap" (następny numer, zgłaszający na 100%), może poprawić ilości,
  a pracom spoza rozpiski daje sekcję i Cenę j.m. Nigdy do etapu innej ekipy.
- **Przyjęcie DODAJE** do ilości etapu — pracownik zgłasza do tego samego etapu wiele razy. Przed
  przyjęciem zapisuje się automatyczna wersja, więc da się je cofnąć z „Wczytaj".
- **Decyzję da się zmienić.** Przyjęta praca zostaje zaznaczona i edytowalna: zmiana ilości
  przesuwa etap o różnicę, odznaczenie zdejmuje ją z etapu. Odrzucone zgłoszenie — i odznaczona
  praca — można przyjąć później. Póki coś w zgłoszeniu jest przyjęte, resztę dodaje się do tego
  samego etapu; jeśli ten etap usunięto albo pracownika w nim już nie ma, najpierw trzeba odznaczyć
  przyjęte prace. Zmiana zrobiona w innym oknie odmawia zapisu z prośbą o odświeżenie.
- **„Przyjęte" nie wraca po przywróceniu wersji.** Przywrócenie wersji sprzed przyjęcia zdejmuje
  dodane ilości, a zgłoszenie dalej czyta „Przyjęte" — świadomie przyjęta rozbieżność.
- **Zgłoszenie przeżywa podmianę rozpiski** (przywrócenie wersji, import, „Wczytaj szablon",
  „Wyczyść kosztorys"): linia, której pozycja zniknęła, przychodzi jako „do przypisania ręcznie".
  Szkic takie linie po prostu gubi, z komunikatem.
- **Przyjęta praca spoza rozpiski** staje się pozycją bez przedmiaru z wykonaną pracą, więc pojawia
  się w „Problemach" jako „wykonane bez przedmiaru" — to sygnał, że ofertę trzeba uzupełnić.

### Tłumaczenia dla pracownika — ukraiński i rosyjski (EX-948, 2026-10-01)

~90% ekipy to Ukraińcy, więc polski jest wyjątkiem, nie domyślnym przypadkiem. Ta zmiana tłumaczy
**link „Zgłoszenie prac"** w całości: obie siatki, „Prace spoza rozpiski", wysyłkę, historię
wysłanych i strony z komunikatami. Rozpiska `/p`, PDF pracownika i „Podgląd pracownika" przyjdą
w kolejnych częściach EX-946, na tym samym rusztowaniu.

- **Język pracownika jest opcjonalny** (Polski / Українська / Русский); pusty = polski, kierownik
  nie musi go wypełniać. Na stronie jest przełącznik języka — wybór pamięta przeglądarka, osobno dla
  każdego pracownika, i ma pierwszeństwo przed językiem zapisanym. Nowy język to wpis na liście
  i słownik, bez migracji.
- **Tłumaczenie opisu prac żyje na wierszu**, jedno na język — osobno na pozycji i na wpisie
  katalogu. Rozpiska ma kolumny „Opis prac (UA)" / „Opis prac (RU)" (ukryte domyślnie), katalog —
  „Opis pracy (UA)" / „Opis pracy (RU)". Bez tłumaczenia pracownik widzi polski opis. Polskiego oryginału pod tłumaczeniem nie
  ma — do tego służy przełącznik.
- **Kopiuje się jak opis**: wybór pracy z katalogu i import z arkusza (dla opisów zgodnych
  z katalogiem) przenoszą tłumaczenie katalogu do wiersza. Potem to zwykły tekst na wierszu —
  poprawka w katalogu nie rusza istniejących pozycji, tak jak z opisem.
- **Zmiana polskiego opisu NIE kasuje tłumaczenia.** Tłumaczenie pamięta opis, z którego powstało;
  gdy opis się zmieni, rozpiska pokazuje je w „Problemach" jako „z nieaktualnym tłumaczeniem",
  a powrót do starego opisu sam gasi ostrzeżenie. Ostrzega się tylko kierownika — pracownik widzi
  nieaktualne tłumaczenie takie, jakie jest. Katalog ma w „Problemach" „bez tłumaczenia" i „z
  nieaktualnym tłumaczeniem", osobno dla każdego języka. Uzupełnianie przez AI doszło z EX-992
  (niżej).
- **„Popraw literówki" utrzymuje aktualne tłumaczenie aktualnym** — literówka nie zmienia sensu.
  Tłumaczenie, które już było nieaktualne, zostaje nieaktualne.
- **„Zapisz do katalogu" nad istniejącym wpisem**: dla każdego języka osobno wygrywa tłumaczenie
  pozycji, jeśli je ma; inaczej katalog zachowuje swoje.
- **Prace spoza rozpiski wpisane po ukraińsku** — od EX-992 kierownik widzi je po polsku,
  z oryginałem obok (niżej).
- **Uzupełnianie hurtem to skrypt do powtarzania, nie jednorazowa migracja**
  (`src/scripts/fill-description-translations.ts`, opis uruchomienia w nagłówku). Liczy braki sam,
  z aktualnych danych, dopasowuje po polskim tekście opisu, wypełnia **tylko puste** tłumaczenia
  i nigdy nie nadpisuje wpisanego ręcznie — drugie uruchomienie wypełnia 0. Zakres: katalog
  i pozycje otwartych inwestycji (z szablonami). Bez `--apply` niczego nie zapisuje; na produkcji
  uruchamia go człowiek. Zapisuje z pominięciem cache — katalog i rozpiski pokazują nowe teksty po
  pierwszej edycji katalogu albo komórki rozpiski.
- **Nazwy sekcji to jedna wspólna lista, nie pole na wierszu** (EX-965, 2026-10-02). „Kuchnia"
  w każdej rozpisce to ta sama kuchnia, więc tłumaczenie wpisuje się raz — klucz to nazwa po
  ujednoliceniu (wielkość liter, spacje). **Samodzielna liczba w nazwie jest zmienną**: „Łazienka 1"
  i „Łazienka 2" dzielą jeden wpis, a każda sekcja dostaje z powrotem swoją liczbę. Kierownik wpisuje
  prawdziwe liczby, a zapis odrzuca tłumaczenie z innymi liczbami niż w nazwie (albo w innej
  kolejności) — inaczej dwa pokoje mogłyby się zamienić. „230V" czy „c.o." to zwykły tekst.
  Pole na wierszu sekcji (jak przy opisach) odrzucono: id sekcji nie przeżywa przywrócenia,
  szablonu ani importu, więc tłumaczenie musiałoby jechać przez ~9 ścieżek kopiowania, a nazw jest
  tylko ~22. Dwie pisownie z przeredagowanego szablonu („…i oświetlenie" / „…i oświetleniowa") to
  po prostu dwa wpisy. Sekcja nazwana dosłownie „#" ma własny wpis, nie wspólny z numerowanymi
  pokojami.
- **Edycja: „Tłumaczenie sekcji…" w menu sekcji.** Pokazuje to, co zobaczy pracownik dla tej
  sekcji; puste pola zapisane razem usuwają wpis. Lista startowa (nazwy z szablonów) przyszła
  z migracją; każdą nową nazwę uzupełnia się w tym oknie, bez wdrożenia.
- **Brak tłumaczenia nazwy = polska nazwa, bez wpisu w „Problemach"** — nazw jest kilkadziesiąt
  i powtarzają się, więc brak widać od razu na linku, a ostrzeżenie w każdej rozpisce byłoby szumem.
  Zakres na razie to link „Zgłoszenie prac"; `/p`, „Podgląd pracownika" i PDF (EX-966) użyją tej
  samej funkcji renderującej (`renderSectionName`).

### Tłumaczenia AI — uzupełnianie UA/RU i prace spoza rozpiski po polsku (EX-992, 2026-10-05)

Odwraca „aplikacja nie woła AI" z EX-948. Tłumaczy aplikacja, przez istniejący OpenRouter
(`src/lib/ai/translate.ts`). **Bez kroku zatwierdzania** — tłumaczenie AI jest ostateczne, błędy
właściciel poprawia ręcznie.

- **Hurtem: „Uzupełnij tłumaczenia (AI)"** w „Opcjach" kosztorysu (opisy + nazwy sekcji tej
  rozpiski) i w Katalogu prac. Wypełnia **tylko brakujące i nieaktualne** — aktualnego, także ręcznie
  poprawionego, nigdy nie nadpisuje. Licznik przy przycisku liczy prace (nie pary praca × język);
  przy zerze przycisk znika. „Problemy → Tłumaczenia" w rozpisce pokazuje teraz też „bez
  tłumaczenia", nie tylko nieaktualne.
- **Najpierw katalog, potem AI**: aktualne tłumaczenie katalogu dla tego samego opisu (po
  ujednoliceniu) jest brane za darmo; AI dostaje resztę, każdy odrębny tekst raz.
- **Przy dodawaniu pracy** („Dodaj pracę" w rozpisce, „Nowa praca w katalogu") — pole „Tłumacz
  automatycznie przy pomocy AI", domyślnie włączone i zapamiętywane. **Późniejsza edycja opisu nie
  woła AI**: siatka zapisuje każdą komórkę osobno, więc odpowiedź AI przychodząca po kilku sekundach
  ścigałaby się z następną edycją, a opis poprawiany po kawałku kosztowałby wywołanie na każdy krok.
  Tłumaczenie robi się nieaktualne, trafia do „Problemów" i naprawia je przycisk hurtowy.
- **Nieudane AI nigdy nie blokuje zapisu ani wysyłki** — wiersz zapisuje się bez tłumaczenia i wychodzi
  jako brakujący. AI działa przed otwarciem transakcji zapisu; żadna transakcja nie czeka na model.
- **Spóźniona odpowiedź przegrywa.** Zapis tłumaczenia jest warunkowy: trafia tylko wtedy, gdy wiersz
  ma wciąż ten opis, który AI tłumaczyło, a dany język jest wciąż pusty lub nieaktualny. Edycja
  w siatce albo ręczne tłumaczenie wpisane w trakcie czekania na AI wygrywa. Dlatego hurt nie używa
  zwykłego zapisu tekstów pozycji — ten nadpisałby opis.
- **Nazwy sekcji**: przy utworzeniu / zmianie nazwy tłumaczone w `after()` (autozapis zmiany nazwy
  ma zostać bez renderu, a czytelnikami są strony pracownika i PDF — inne trasy). Odpowiedź AI musi
  przejść tę samą kontrolę liczb co okno ręczne; „Łazienka 2" → „Ванна 1" jest odrzucana i nazwa
  zostaje bez tłumaczenia. Istniejące języki szablonu wygrywają z AI.
- **Prace spoza rozpiski** wpisane przez pracownika po ukraińsku/rosyjsku są tłumaczone na polski
  w `after()` wysyłki (wysyłka pracownika ma zostać szybka). Język rozpoznaje AI, nie ustawienie
  pracownika — przełącznik na stronie może się różnić od zapisanego języka. Kierownik w przeglądzie
  widzi polski opis i „Zgłoszono (UA): …" z oryginałem; „Przetłumacz" / „Przetłumacz ponownie" idzie
  od razu do mocniejszego modelu (ponowienie następuje po złej odpowiedzi, a tani model ją powtarza)
  i działa też, gdy automatyczne tłumaczenie padło. Zapis z `after()` trafia tylko na linię jeszcze
  nieprzetłumaczoną, więc nie nadpisze ponowienia kierownika, które skończyło się wcześniej. **Strona
  pracownika nie pokazuje żadnego stanu tłumaczenia ani przycisku** — widzi swój tekst.
- **Przyjęcie** takiej pracy: polski staje się opisem pozycji, a słowa pracownika — jej aktualnym
  tłumaczeniem UA/RU (ekipa czyta słowa kolegi).
- **Poza zakresem świadomie**: nazwy etapów, notatki, jednostki, napisy UI; globalna akcja dla
  wszystkich nazw sekcji; „Problemy" dla nazw sekcji; limit wywołań na publicznej wysyłce (link
  z tokenem, grosze).
- **Skala**: odrębne teksty w paczkach po 40, 4 naraz, 30 s na wywołanie + jeden model zapasowy —
  rozpiska na 1000 wierszy mieści się w limicie 300 s jednej akcji (szacunek, nie pomiar).

## Protokół odbioru prac — druk z menu „Inwestor" (2026-09-28)

Protokół, który właściciel podpisuje z klientem na budowie, wychodzi z aplikacji wstępnie
wypełniony: „Inwestor → Protokół odbioru…" otwiera formularz z podpowiedziami, podglądem zakresu
i rozliczenia, a „Generuj" drukuje go tym samym mechanizmem co ofertę. Nic się nie zapisuje —
protokół jest dokumentem na papier, nie bytem w bazie.

- **Zakres prac = pozycje z wykonaną pracą.** Pomiar z natury JEST sumą etapów, więc pozycja trafia
  na protokół dokładnie wtedy, gdy któryś etap ją wykonał (`scope-rows.ts`). Bez nazw sekcji, bez
  kolumny „Zgodnie z umową?", tylko podgląd — kosztorys zostaje jedynym źródłem.
- **Rozliczenie to kolumna netto z „Podsumowania"**, złożona z tych samych funkcji
  (`protocolSettlement` → `laborCostsNetPreDiscount`, `billedMaterials`, `sumDeposits`,
  `computeAmountDue`): Robocizna **przed rabatem**, Rabat, Materiały, Suma, Wpłaty, Strata,
  Pozostało do zapłaty / Nadpłata. Protokół rozjeżdżający się z podsumowaniem o grosz to ten, który
  klient podpisuje — dlatego nie liczy po swojemu.
- **Generowanie nigdy nie edytuje inwestycji.** Poprawki w formularzu żyją w formularzu; osobny
  przycisk „Zaktualizuj dane inwestycji" zapisuje **wyłącznie** osobę kontaktową i adres, nigdy
  całego rekordu. Niezmieniona podpowiedź Zamawiającego (nazwa inwestycji) nie trafia do osoby
  kontaktowej.
- **Podpowiedzi zamiast pustych pól**, bo dane bywają puste: adres ma 35/138 inwestycji, osoba
  kontaktowa 9/138. Zamawiający = osoba kontaktowa, a gdy jej nie ma — nazwa inwestycji (zwykle
  niesie klienta). Wykonawca to stała w kodzie (`CONTRACTOR_NAME`), nie pole w bazie. Rodzaj odbioru
  domyślnie „końcowy", miejscowość „Warszawa", rękojmia od = data odbioru.
- **Ze wzoru wypadły** stopka denwi.pl, „Reprezentowany przez" (obie strony), „Inne osoby obecne",
  pkt 7, „Kwota zatrzymana" i linia umowy — firma nie podpisuje numerowanych umów. pkt 2 to pusta
  numerowana tabela na 5 wierszy, pkt 4 (usterki) na 10: pola do wypełnienia długopisem na miejscu.

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
  - **„Pozostało netto (względem przedmiaru)"** = `S − T`; pusty Przedmiar to oferta zerowa, więc
    wiersz czyta −wykonane. Wiersz poniżej −0,005 zł (praca ponad przedmiar) jest **na czerwono**,
    a stopka sekcji i „Razem" sumują **tylko wiersze nie ponad przedmiar** — suma mówi „ile oferty
    zostało do zrobienia" (EX-885, odwraca EX-686, gdzie nadwyżka pomniejszała sumę). Nie mylić z „Rozjazdem między arkuszem Google a apką" — tamten odejmuje sumę
    etapów od Pomiaru z natury z arkusza, a nie od Przedmiaru.
  - **„% wykonania"** = `Σ etapów / Przedmiar` (nie z sumy etapów — inaczej `Σ/Σ = 100%` wszędzie).
    It stays next to the summary's „Postęp prac" on purpose (EX-703, owner re-confirmed 2026-08-17):
    the summary is value-weighted over the whole kosztorys, the column is quantity-weighted per row,
    so only the column says which position lags.

  Konsekwencja architektoniczna: wartość wykonania zależy od etapów, więc `calc.ts` (czysta
  warstwa cenowa, `ViewPricingT` nie widzi etapów) **nie może** jej policzyć. Warstwa
  rozliczeniowa — `rowValueForView`, `rowRemainingForExecutedQty`, `sectionSubtotalsForView` — mieszka
  w `v2-rows.ts`, które etapy zna. `rowPlannedNetForView` (oferta = z Przedmiaru) zostaje w
  `calc.ts`, bo jej ilością jest Przedmiar, a nie etapy.

  Rozjazd zostaje **widoczny, nie wygładzony**: komórka `% wykonania` świeci na czerwono
  (`hasStagesOverPlanned`), gdy `Σ etapów > Przedmiar` — praca przekroczyła oferowany zakres.
  Częściowo zrobiony wiersz (`Σ etapów < Przedmiar`) to normalna praca w toku i czerwony **nie**
  jest — inaczej cała siatka świeciłaby na zdrowym kosztorysie.

  Drugi czerwony sygnał to ujemne **„Pozostało"** (netto, brutto, pracownika;
  `isRemainingOverrun`) — ten sam predykat, który wyjmuje wiersz z sumy w stopce. Łapie też pracę
  bez Przedmiaru, której „% wykonania" nie pokaże (tam „—"). Wydruki zostają czarne.

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
  **No alarm styling** (owner, 2026-09-15): the column appears only under that filter and only on
  rows that differ, so its presence is the signal — no red header or background.

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
  jako tę samą, przepada etykieta etapu, plan „z narzędziami / bez narzędzi", podział etapu na pracowników
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
    pracami: `rabat_brutto = rabat_netto × (1 + vat)`. Arkusz tego nie rozstrzyga — jego rabat
    (kolumna R) to procent, a procent nie ma osi; podstawą jest orzeczenie właściciela.
    To **odróżnia rabat** od materiałów / korekty / wpłat (te są nominalne). Bez tego brutto-
    kaskada się nie spina: „Suma prac" brutto − rabat nominalny ≠ „Robocizna" brutto.
  - **Rabat kwotowy wpisuje się na dowolnej osi (2026-09-29, EX-933).** Gruntowanie to reguła
    liczenia, nie reguła wpisu. Przy rozliczeniu brutto właściciel umawia się na „5000 zł mniej"
    brutto — pole przyjmowało tylko netto, więc 5000 stawało się −5400,00 w Podsumowaniu (inw. 112,
    VAT 8%). Rabat globalny ma teraz dwa pola, netto i brutto, jedno „Zapisz"; drugie przelicza się
    na żywo po stawce VAT inwestycji. **Zapisujemy tylko netto** — wpis brutto jako
    `brutto / (1 + vat)` z sześcioma miejscami po przecinku, żeby po gruntowaniu wrócił co do grosza
    (netto zaokrąglone do groszy potrafi zgubić grosz). Wszystkie odczyty bez zmian, bez migracji.
    Zmiana stawki VAT przesuwa więc brutto rabatu, a netto zostaje — spójnie z pracami. Rabat per
    pozycja zostaje netto (osobna decyzja, nieruszona). Rabaty wpisane przed zmianą są netto i tak
    zostają; inw. 112 wymaga ręcznego przepisania 5000 w pole brutto.
    Odrzucone: pole idące za trybem rozliczenia ze znacznikiem osi przy kwocie — oś wybiera
    właściciel przy wpisie, a po zmianie VAT brutto ma się przesunąć, więc nie ma czego kotwiczyć;
    oraz kwota nominalna na obu osiach, jak strata — rozspójnia fakturę (brutto ≠ netto × (1 + vat),
    na inw. 112 o 400 zł).
  - **Skutek dla `Podsumowania` (edytor):** kolumna brutto dotyczy wierszy z płaszczyzny prac —
    „Suma prac wykonanych", **„Rabat"** oraz „Robocizna/Do zapłaty" (gruntowana po rabacie).
    Materiały budowlane/wykończeniowe, korekta i wpłaty = wartość nominalna (brak wiersza
    brutto). (Bug 1: wcześniej wszystko gruntowane hurtem przez `toGross(cały net)`; bug 2:
    rabat błędnie zrzucony do `faceValue` — powinien `moneyPair(…, vatRate)`.)
  - **WYJĄTEK od „materiały nominalnie" — wydatek typu netto (2026-08-07, poprawione 2026-09-23).**
    Reguła „wartość nominalna" mówi, że nie **wymyślamy** VAT-u, którego nie było na dokumencie —
    a nie że materiał nigdy nie ma dwóch osi. Wydatek zapisany jako **netto** ma na fakturze obie
    kwoty i **obie bierzemy z faktury**: netto = Σ `net_amount`, brutto = Σ `amount`. Żadna stawka
    materiałów (8%, 12%, 23%…) nie rusza ani netto, ani brutto, ani Różnicy wiersza „… netto" —
    przesuwają się tylko wiersze zapisane brutto (właściciel, 2026-09-23). Odwraca to decyzję
    z 2026-08-07, która liczyła brutto jako `netto × (1 + stawka)` i ważyła wyłącznie stawki, nie
    zapisaną kwotę `amount` — przy 23% inwestycja 146 pokazywała 5477,60 brutto wobec 4809,60
    na fakturze.
    **Bez stawki** (brak zapisanej albo rozliczenie brutto) tabela ma jedną kolumnę „Kwota", a wiersz
    „… netto" pokazuje w niej swoje netto — to kwota, którą płaci klient, więc „Razem" dalej równa
    się „Materiały" w Podsumowaniu.
    Zmiana jest tylko w wyświetlaniu: bilans, marża, „Łącznie" i lista inwestycji czytają netto,
    które się nie zmieniło. A skoro obie kwoty są zapisane, wraca gwarancja, dla której wybrano model
    „zapisane `netAmount`": brak dryfu zaokrągleń między listą a podsumowaniem.
    **„Różnica" znaczy na tych dwóch osiach co innego.** Na wierszu brutto to obniżka materiałowa
    (paragon minus rozliczona kwota) — firma ją daje. Na wierszu „… netto" to VAT z faktury — tego
    firma nie oddaje. „Razem Różnica" sumuje obie pod jedną etykietą; tak było i wcześniej, ale
    brutto liczone ze stawki to maskowało.
    **Konsekwencja w rozliczeniu mieszanym:** „Pozostało brutto" **nie** jest gruntowaniem kwoty
    nierozliczonej — to gruntowałoby materiały razem z pracami. Liczy się z „Łącznie", gdzie
    materiały już stoją po face value na obu osiach (`resztaGross = combined.gross − paidNet`).
  - **Widok inwestora zakładki „Materiały" (2026-09-23).** Podział brutto / netto jest sprawą
    firmy, nie inwestora — więc w podglądzie (`preview`, nigdy `priceView`):
    - „Wydatki inwestycyjne" ma **jeden wiersz na kategorię** (budowlane / wykończeniowe /
      pozostałe) + „Razem" — wiersz „… netto" jest doliczony do swojej kategorii **po wycenie**,
      więc „Razem" jest identyczne jak w widoku managera.
    - Lista wydatków to **jedna lista po brutto**: bez przełącznika zestawów, bez kolumny Netto,
      „Razem" = Σ `amount`. Wydatek netto stoi na niej po brutto z faktury, więc „Razem" listy jest
      **≥** „Materiały" rozliczonym w Podsumowaniu — celowo, na korzyść inwestora (właściciel,
      2026-09-23). Tych dwóch sum się nie uzgadnia. Materiały wliczone w robociznę dalej nie trafiają
      do podglądu.
      Wyjątek od „≥": ujemna korekta (nota kredytowa) na osi brutto przy ustawionej stawce rozlicza
      się jako `korekta / (1 + stawka)`, więc ten jeden wiersz stoi na liście poniżej rozliczonego.
      Suma odwraca się dopiero, gdy korekty przewyższą zakupy — nierealny kosztorys, niepilnowany
      testem.
    - **Bez stawki breakdown i lista liczą wydatek netto inaczej — celowo.** Wiersz kategorii bierze
      go po netto (styka się z „Materiały" w Podsumowaniu), lista po brutto z faktury. Odrzucone:
      breakdown po brutto (zrywa styk z Podsumowaniem i bilansem) oraz stałe Netto / Brutto / Różnica
      przy fakturze netto (odwraca ustalenie z `zamrozone-brutto-wydatku-netto` i musiałoby objąć też
      widok managera).
  - **Skutek dla rekoncyliacji (strona inwestycji „z kosztorysu", EX-535):** porównanie idzie
    **netto ↔ netto** dla obu figur — kosztorys suma prac (netto) ↔ Σ `LABOR_COST`, kosztorys
    rabat (netto) ↔ Σ `RABAT`. Strony kosztorysowej **nie gruntujemy**. To usuwa fałszywy
    rozjazd o VAT (rabat 100 netto mylnie porównywany z „102 brutto") — sygnalizacja świeci
    tylko przy realnej różnicy ≥ 1 gr.

    **POTWIERDZONE (właściciel, 2026-07-21): transakcja `RABAT` w zasadzie znika.**
    Rabat nie jest już ręczną transakcją — staje się kwotą **readonly z arkusza**
    (kosztorysu), pokazywaną w **widoku inwestycji** i wchodzącą w **podsumowanie tej
    inwestycji**. Skutek: nie ma już `Σ RABAT` do rekoncyliacji — rabat inwestycji =
    rabat kosztorysowy wprost. To rozpuszcza pytanie o oś transakcji `RABAT` — bez ręcznej
    transakcji nie ma osi wpisu do rozstrzygnięcia (oś wpisu rabatu kosztorysowego rozstrzyga
    EX-933, wyżej). (EX-536 / zaliczka pozostaje osobno.) Do zbudowania w widoku
    inwestycji — należy do EX-535.

- **Rabat dwutrybowy:** `discount_type` ∈ {procent, kwota} + `discount_value`.
  - procent: `wartość = ilość × cena × (1 − %)`
  - kwota: `wartość = ilość × cena − kwota`

### Rabat globalny — kontrakt sterowania (EX-605, 2026-07-27)

O zastąpieniu rabatów per pozycja decyduje **tryb, nie kwota**: „Kwotowy" wyłącza rabaty
per pozycja przy **każdej** wartości, łącznie z 0 zł. Stąd wybór trybu **od razu zapisuje** —
czekanie na kwotę zostawiało listę obiecującą zastąpienie, którego silnik nie robił.

- **Kwota wpisuje się w netto albo w brutto, zapisuje się netto** — patrz sekcja VAT wyżej (EX-933).
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
- **Rabat globalny nie podróżuje przez przywrócenie wersji ani przez preset** — to ustalenie per
  inwestycja. Przywrócenie starej wersji zostawia bieżący rabat kwotowy nietknięty (wiersze migawki
  mają swoje własne rabaty per pozycja). Od 2026-09-28 (EX-881) migawka **zapisuje** rabat globalny
  (`globalDiscount` w payloadzie), ale wyłącznie do wyświetlenia w historii inwestora — przywracanie
  go ignoruje, tak jak przedtem.

### Historia zmian dla inwestora (2026-09-28, EX-881)

Inwestor na swoim linku (`/k/[token]`) i właściciel w „Podgląd dla inwestora" widzą ten sam ekran:
„Opcje" → „Zobacz historię zmian" z listą dni, w których kosztorys się zmienił, i widok wybranego
dnia porównany z **bieżącym** stanem (nie z poprzednim dniem). Każdy wpis na liście liczy różnice
względem bieżącej wersji — to samo porównanie, które pokazuje widok dnia. Adres jest stanem:
`?wersja=<id>`.

**Rodzaje wersji i dla kogo są** (`kosztorys_snapshots.kind`):

| Rodzaj   | Skąd                                                                                                                               | Kto widzi                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `auto`   | co 10 min, gdy edytor jest otwarty                                                                                                 | właściciel („Wersje") + historia sprzed wdrożenia |
| `manual` | „Zapisz jako…" sprzed wdrożenia                                                                                                    | tylko właściciel                                  |
| `named`  | „Zapisz jako…" od wdrożenia — kamień milowy z etykietą                                                                             | właściciel + inwestor                             |
| `daily`  | nocny cron (`/api/cron/daily-snapshots`, 23:15 UTC) — stan z końca dnia warszawskiego, tylko gdy różni się od poprzedniego `daily` | inwestor                                          |

Historia sprzed wdrożenia to najnowszy `auto` z każdego dnia, który przetrwał przerzedzanie.
**Stare reguły dla starych wierszy:** przeszłe `manual` nie stają się kamieniami milowymi, a przeszłe
`auto` dalej przerzedzają się i wygasają pasmami.

**Dlaczego jedna wersja z końca dnia**, a nie wersje 10-minutowe ani lista wybrana przez właściciela:
wersje co 10 min pokazują stany w połowie edycji, a lista układana przez właściciela pozwalałaby mu
wybierać, co inwestor może sprawdzić. Z tego samego powodu właściciel nie może ukryć dnia.

**Retencja** (`gcSnapshots`): `auto`/`manual` bez zmian (30 dni wszystko → dzień do 120 → tydzień do
365 → koniec). `daily` i `named` nie podlegają pasmom ani limitowi 365 dni: żyją, dopóki inwestycja
jest w Wycenie, Planowana lub Aktywna, a po Zakończonej jeszcze rok od `investments.completed_at` (ustawiane
przy przejściu na Zakończoną, zerowane przy ponownym otwarciu). Zakończona bez `completed_at` trzyma
historię — brak danych nigdy jej nie kasuje. Planowana liczy się jako żywa, bo to negocjacje, kiedy
zmiany oferty ważą najbardziej; `named` żyją tak samo, bo to je inwestor najbardziej chce odnaleźć
(„Oferta podpisana"), a wcześniej ginęły po 365 dniach jak wszystko. Inwestycja w koszu nie potrzebuje
osobnej reguły: nocny job jej nie obejmuje, a `selectPurgeableInvestmentIds` kasuje tylko te
z nieużywanym kosztorysem — użyta inwestycja zachowuje `daily`/`named` do przywrócenia z kosza.

**Porównywanie wersji odwraca decyzję S-06 „bez diffowania"** (`2026-07-10-kosztorys-snapshots` (archive deleted 2026-09-29; git history)),
ale tylko na potrzeby wyświetlenia — przywracanie działa jak przedtem. Pozycje dopasowuje się po id,
a to, czego id nie sparowały (przywrócenie albo „wczytaj szablon" nadaje nowe), po nazwie sekcji +
opisie + j.m. — per pozycja, więc przywrócenie z dopisanymi potem pozycjami też się paruje. Świadomie przyjęty skutek uboczny: usunięcie pozycji i dodanie takiej
samej (sekcja + opis + j.m.) czyta się jako jedną zmienioną — tak samo widzi to inwestor na papierze.
Zmiana „Pomiaru z natury" liczy się per etap. Wersja zapisana, zanim migawka niosła
rabat, pokazuje „Rabat nieznany", nigdy „0,00 zł" — brak pola w payloadzie JEST tym znacznikiem.
Kolumny i wiersze dnia z przeszłości idą za **dzisiejszymi** ustawieniami widoku klienta; panel
„Podsumowanie" (wpłaty, bilans) jest wtedy ukryty, bo czyta dzisiejsze kwoty.

**Odczyt jest publiczny, ale zawężony do tokenu:** `getPreviewHistoryByToken` przyjmuje id wersji
z adresu i filtruje po inwestycji i rodzaju w samym `WHERE` — id cudzej inwestycji, wersja `manual`
albo śmieci w `?wersja=` dają widok bieżący, nie błąd. Otwiera się każdy wiersz `auto`/`daily`/`named`
tej inwestycji, także `auto` spoza listy — świadomie (decyzja z 2026-09-28); unieważniony token kończy się 404 jak
przedtem. Widok ekipy (`worker`) historii nie dostaje w ogóle.

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
- **Nazwa sekcji JEST jej tożsamością** (właściciel, 2026-09-22) — dwie sekcje o tej samej nazwie nie
  mają sensu, więc picker keyuje po nazwie, nie po id, a serwer przy zapisie dokłada prace do
  istniejącej sekcji zamiast zakładać bliźniaka (lista w dialogu to migawka — reguła tożsamości może
  się trzymać tylko po stronie serwera). Trzy zaakceptowane skutki: **w danych stoi już jedna para
  duplikatów** (1 ze 185 sekcji) i jej druga sekcja jest z pickera nieosiągalna do czasu
  przemianowania; **inline rename w siatce wciąż potrafi zrobić bliźniaka** — bramki unikalności tam
  nie ma; dopasowanie jest **case-insensitive**, czyli nazwy różniące się wielkością liter to dla
  właściciela jedna sekcja.

### Pozycja ↔ katalog: tożsamość zostaje tekstowa, bez linku po id (2026-10-01)

Link `kosztorys_items` → `work_catalogue_items` (nullable FK) był proponowany **dwa razy** i dwa razy
odpadł: `katalog-prac-identity` (2026-09-17, „katalog doradczy", powód tylko w `3baa7e09`) oraz
`kosztorys-item-catalogue-link` (2026-10-01, decyzja przy EX-948). Pomiar na kopii prod (dump
2026-09-30) mówi, że link naprawiłby niewiele:

- **Parowanie psuje tekst legacy, a id go nie naprawi.** 514 z 529 niesparowanych używanych pozycji
  siedzi w 20 kosztorysach z importu arkusza — żadna nie powstała z katalogu. Kosztorysy z szablonu
  „Kosztorys 2026" parują się w ~94,5% (używane) / ~98% (wszystkie) bez żadnego linku. Backfill
  wymagałby właśnie tego fuzzy-dopasowania, którego link miał unikać (93 ze 195 „zawierających się"
  kandydatów ma więcej niż jeden wpis).
- **Tekst myli się bezpiecznie, link niebezpiecznie.** Przez 17 dni snapshotów tylko **10** pozycji
  przeszło z „sparowana" na „niesparowana" — i część to prawdziwa zmiana zakresu („Montaż WC
  podwieszanego" → „Montaż WC", „przed gładziami" → „przed tynkami"). Tekst daje „brak w katalogu";
  zachowany link dałby pewny rozjazd ceny względem złej pracy, a „Aktualizuj kosztorys" wpisałby
  ceny starej pracy w przemianowany wiersz (dziś `STALE_CATALOGUE_ERROR` to blokuje).
- **Link to druga reguła na stałe** („link, inaczej tekst"), bo import arkusza odtwarza drzewo bez id.
  Do tego: snapshot z usuniętym wpisem katalogu nie dałby się przywrócić (FK 23503, jak EX-641 —
  potrzebny bliźniak `liveWorkerIds`), a `ON DELETE SET NULL` pisałby w zamknięte inwestycje.
- **Jedyny przypadek, który link wygrywa:** przemianowanie wpisu przez „Edytuj" w katalogu rozparowuje
  jego pozycje wszędzie naraz. Jeśli zacznie gryźć — poprawka tekstowa, bez drugiej reguły: przy
  zmianie opisu/j.m. w katalogu zaproponować przepisanie ich na pozycje sparowane starym kluczem.
- **Kiedy wrócić do tematu:** dopiero po EX-780 i zamknięciu inwestycji z arkusza — wtedy większość
  wierszy rodzi się z katalogu/szablonu i fallback tekstowy się kurczy.

Tłumaczenia (EX-948) kluczują po polskim tekście i linku nie potrzebują.

### „Nowa praca" — formularz zamiast pustego wiersza (EX-951, 2026-09-30)

Każde wejście, które dodaje pracę ręcznie — „Wstaw powyżej/poniżej" w menu wiersza, „Dodaj pracę" na
pasku sekcji i w jej menu, „Dodaj → Praca → [sekcja]" w pasku narzędzi — otwiera formularz: opis,
j.m., „Cena j.m." i obie stawki podwykonawcy (źródło „auto" / kwota / mnożnik, jak w katalogu).
Praca powstaje dopiero przy zapisie, **od razu wypełniona** — pusty wiersz „Nowa praca" do
dopisywania w siatce zniknął ze wszystkich ścieżek. Rozstrzygnięcia właściciela:

- **Miejsce:** „Wstaw powyżej/poniżej" kładzie pracę przy wierszu, z którego go wywołano; pozostałe
  wejścia — na koniec sekcji. Bez żadnej sekcji „Dodaj → Praca" najpierw zakłada sekcję.
- **Bez pola „Przedmiar"** — przedmiar wpisuje się w siatce, jak dotąd. „auto" przy stawce znaczy
  „bez nadpisania", nie zero.
- **„Nie zamykaj po zapisaniu"** czyści formularz; następna praca ląduje **pod właśnie zapisaną**,
  a „na koniec sekcji" zostaje na końcu. Zwinięta sekcja rozwija się po zapisie. Stawka powyżej
  65% ceny daje ostrzeżenie toastem (ten sam sufit, co wyżej). Dodanie nie wchodzi na stos
  „Cofnij".
- **„Dodaj pracę do katalogu prac"** — ptaszek, zawsze odznaczony na starcie. Dopiero z nim pojawia
  się „Kategoria", podpowiedziana nazwą sekcji bez numeru porządkowego. Wpis w katalogu zapisuje się
  w **tej samej transakcji** co praca — albo oba, albo nic.
- **Kolizja w katalogu** (ten sam opis + j.m., reguła `matchKey`) nie jest błędem, tylko pytaniem
  z trzema odpowiedziami, z cenami „stare → nowe": **„Nadpisz w katalogu"**, **„Tylko do
  kosztorysu"** i **„Wróć"** (Escape i klik obok to też „Wróć"). „Tylko do kosztorysu" istnieje,
  bo odmowa nadpisania katalogu nie jest odmową pracy: właściciel chce wtedy pracę w kosztorysie,
  a katalog nietknięty — tak/nie tego nie wyrazi. Escape nigdy niczego nie zapisuje. Przy
  nadpisaniu kategoria z katalogu **zostaje** domyślnie (przełącznik „Zostaw kategorię
  z katalogu").

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

**Kilku pracowników na etap (EX-943).** Etap ma **podział**: listę osób (`kosztorys_stage_workers`)
i tryb — procentowo albo kwotowo — jeden na etap. Każda osoba poza jedną ma wpisaną wartość, a jedna
bierze **resztę**. Dzielona pula to wykonana praca etapu na jego rozliczeniu, przed rabatem
(pomiar × stawka podwykonawcy) — ta sama liczba, która wcześniej szła w całości do jednej osoby.
Reguły właściciela (2026-09-30):

- **Nie dzielimy pieniędzy, których nie ma.** Pula 0 → każdy ma 0; stała kwota nie może przy zapisie
  przekroczyć bieżącej puli, suma procentów nie może przekroczyć 100, żaden udział nie jest ujemny.
- **Pula spadła po zapisie** (pomiar poprawiony w dół, tańsze rozliczenie) — tej edycji nikt nie
  blokuje, więc stałe kwoty kurczą się proporcjonalnie, reszta dostaje 0, a etap dostaje znacznik
  „popraw podział" w nagłówku i w filtrze problemów („z podziałem do poprawienia").
- **Etap bez rozliczenia nikomu nic nie liczy** i flaguje każdego członka podziału.
- **„Dodaj etap" kopiuje podział ostatniego**: procenty przechodzą, kwoty się zerują (nowy etap nie
  ma puli, a limit odrzuciłby każdą kwotę).
- Jedna reguła arytmetyczna (`splitStagePool`) dla obu ścieżek pieniędzy — panelu edytora i
  „Rozlicz wypłaty" — żeby ekran nie mógł przypisać komuś innej kwoty niż wypłaty.

Istniejące przypisania przeszły migracją jako podział jednoosobowy (ta osoba bierze resztę), więc
żadna liczba się nie ruszyła. `kosztorys_stages.worker_id` zostaje do osobnej, destrukcyjnej migracji.

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

### Stawka wykonawcy ma trzy źródła: „auto", „kwota stała" i „własny mnożnik" (EX-865, 2026-09-23)

„Źródło ceny wykonawcy" odpowiada na jedno pytanie: czy ta pozycja idzie za mnożnikiem inwestycji,
niesie własną kwotę, czy ma własną krotność ceny klienta.

- **„auto"** — cena wylicza się z ceny klienta przez mnożnik inwestycji (osobny per plan, domyślnie
  `0,65` z narzędziami i `0,5525` bez). Zmiana narzutki przelicza wszystkie takie pozycje naraz.
- **„kwota stała"** — pozycja niesie własną stawkę w złotówkach i żadna zmiana narzutki ani ceny
  klienta jej nie rusza.
- **„własny mnożnik"** — pozycja niesie własną krotność, a stawka liczy się jako `cena j.m. ×
mnożnik` przy każdym odczycie. Mnożnik inwestycji jej nie dotyczy, ale **podniesienie ceny dla
  inwestora podnosi z nią stawkę ekipy** — to jedyna rzecz, której zamrożona kwota nie umie.

Własny mnożnik ustawia się **na pojedynczą pracę** — mnożnika na sekcję nie ma „i nie będzie"
(właściciel, 2026-09-23).

**Pierwszeństwo: mnożnik > kwota > auto**, rozstrzygane w jednym miejscu na płaszczyznę
(`priceSourceOf` dla rozpiski, `catalogueSourceOf` dla cennika). Wiersz niosący obie kolumny naraz
to stan, którego zapis nie dopuszcza — `normalizeOverridePatch` czyści drugą kolumnę w tym samym
UPDATE co pierwszą, więc para nigdy nie trafia do bazy rozjechana.

Wpisanie liczby w „Cena j.m." wykonawcy **samo** przestawia źródło na „kwota stała", a wyczyszczenie
komórki wraca na „auto" — kolumna źródła jest podglądem tej decyzji i drogą powrotną, nie osobnym
krokiem, który trzeba wykonać przed wpisaniem ceny. W podglądzie inwestora kolumna źródła nie składa
się w ogóle: dokument klienta nie pokazuje, skąd firma bierze stawkę ekipy.

Mnożnik wiersza wpisuje się **dziesiętnie (`0,55`), nie procentowo** — tak jak globalny mnożnik
inwestycji o jeden pasek narzędzi obok. Ta sama decyzja w dwóch notacjach to wklejenie pomylone o 100×.

**Trzecie źródło było wycięte przez trzy tygodnie i wróciło** (właściciel: cięcie 2026-09-01/EX-766,
przywrócenie 2026-09-23/EX-865). Wycięto je, bo nie używał go nikt — zero wierszy w jakiejkolwiek
bazie — a kosztem był **wspólny slot na wartość**, w którym „200" znaczyło raz 200 zł, a raz ×200.
Wróciło, bo braku nie da się obejść: zamrożona kwota odpada od ceny inwestora w chwili, w której ta
cena drgnie, a jedyną alternatywą było ręczne przepisywanie stawek po każdej zmianie cennika.

Powrót **nie jest cofnięciem EX-766** — powód cięcia adresuje inna rzecz niż liczba kolumn. Slot
jest teraz rozdzielony: mnożnik ma **własną kolumnę** (`*_override_coeff`) obok kwoty
(`*_override_value`), więc „200" nigdy nie znaczy dwóch rzeczy, a atomowość pary pilnuje **ścieżka
zapisu**, nie liczba kolumn — to był prawdziwy zarzut z EX-766 (dwa nieuporządkowane zapisy nad
jednym pojęciem), i odpowiada na niego `normalizeOverridePatch`, a nie skasowanie trybu.

**Komórka „Mnożnik" nie jest pusta poza swoim źródłem** (właściciel, 2026-09-23, `cc7baeed` —
odwrócenie kontraktu z planu EX-865). Przy „auto" pokazuje **mnożnik inwestycji**, wyszarzony
kursywą: wiersz JEST liczony mnożnikiem, tylko nie swoim, a pusta komórka kazałaby zgadywać. Przy
„kwocie stałej" — kreskę „nie dotyczy": zamrożona kwota nie idzie za ceną j.m., więc wypisanie
krotności, w której akurat siedzi, obiecywałoby związek zrywany pierwszą zmianą ceny; pusta komórka
z kolei czyta się jak pole do wypełnienia. Który to z trzech odczytów, rozstrzyga `shownCoeff`
(`lib/kosztorys/calc.ts`) — jedno miejsce dla komórki, `copyValue` i **sortowania**, bo sortowanie po
własnym mnożniku wpychało wiersz pokazujący 0,65 pod wiersz pokazujący 0,4. Katalog prac odpowiada na
to samo pytanie własną kolumną „Źródło" na płaszczyznę: stawka źródło tylko implikuje — „×0,65"
nazywa się samo, „8,50 zł" czyta się jak każda inna liczba.

Katalog prac zna te same trzy źródła: cennikowy wpis niesie parę kolumn `w_tools_rate` /
`w_tools_rate_coeff` (i bliźniaczą bez narzędzi), „auto" to brak obu, a mnożnik wstawiony do
rozpiski **przelicza się od ceny j.m., na którą trafi** — nie zamraża kwoty z katalogu.

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
- **A revealed column overrides only the column-picker checkbox** — never the amount axis, the layer
  or the client view. While a problem is engaged, unticking its revealed column is a **dead click on
  purpose**: the checkbox shows the stored state (ticked would lie about it; greyed out would need a
  third state nobody asked for).
- **The latch that keeps a row visible while you fix it bypasses conditions only, never search** — a
  search is a question asked now. Deferring the refilter until blur was rejected: the row still
  vanished the moment Tab moved to the next column.
- **„Bez ceny j.m." does not switch the view** (owner): the price is typed on the investor side but
  repaired in subcontractor-only columns, so there is no one right view. Same for „z pomiarem do
  rozpisania" and both stage problems.

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

**„Zapisz kolejność" saves the result (`display_order`), never the sort rule** (EX-688). A stored rule
stays live and overrides positions, so a ▲/▼ move would vanish on reload — two sources of truth for
one order. It lives in the column header, not the section menu, because one section can't be sorted
in isolation.

## Katalog prac: Filtry, Problemy i „Policz użycia" (2026-09-29, EX-863 / EX-873)

`/katalog-prac` dostał te same dwa menu co edytor i tę samą semantykę: w „Filtrach" zaznaczone =
widoczne, a włączony filtr chowa swoje trafienia; „Problemy" są wyłączne i włączony problem
zostawia tylko swoje trafienia. Liczniki idą po całym katalogu, więc nie drgają, gdy zmienia się
szukanie czy „Kategoria". Obok „Kategorii" stoi filtr „j.m.", a pusta j.m. ma własną opcję
„bez j.m.".

- **Sufit jest per płaszczyzna, nie „65 %".** „Ponad" i „w granicy" czytają ten sam predykat co
  czerwona komórka udziału: 65 % z narzędziami i 55,25 % bez narzędzi.
- **„W granicy" nie obejmuje „auto" ani prac bez ceny j.m.** „Auto" nie nazywa żadnej stawki, bo
  wycenia się z inwestycji, do której trafi, a liczenie jej „w granicy" obiecywałoby limit, którego
  nikt nie sprawdził. Na każdej płaszczyźnie cztery kubełki składają się w cały katalog: ponad,
  w granicy, auto oraz nie-auto bez ceny.
- **Problemy to „bez ceny j.m." i „stawka 0 zł" na każdej płaszczyźnie.** Stawka 0 liczy się tylko
  przy kwocie albo mnożniku, bo przy „auto" zera nikt nie wpisał.

**„Policz użycia" — co znaczy „używana".** Praca z katalogu jest używana w inwestycji, gdy któraś
pozycja jej kosztorysu ma przedmiar > 0 albo postęp na którymkolwiek etapie. Dopasowanie idzie po
kluczu opis + j.m., tak jak porównanie z katalogiem. Wyceny się liczą. Poza zakresem są inwestycje
w koszu i o statusie „szablon". Liczba w kolumnie „Kosztorysy" to **liczba różnych inwestycji**, nie
pozycji: praca powtórzona w pięciu łazienkach jednego mieszkania to dalej jeden kosztorys.

- **Na kliknięcie, nie przy wejściu.** Odczyt przechodzi przez wszystkie kosztorysy, a odpowiedź
  ma wartość tylko dla kogoś, kto właśnie porządkuje cennik. Ponowne kliknięcie liczy od nowa.
- **Grupa „Użycie" nie jest zapamiętywana.** Po przeładowaniu nie ma liczby, po której dałoby się
  filtrować. Zapamiętane „nieużywane" filtrowałoby więc albo po niczym, albo po liczbie, której
  nikt nie policzył. Dlatego zwykłe filtry siedzą w localStorage, a „Użycie" tylko w stanie strony.
- **Podpowiedzi nigdy się nie liczą.** Lista „Używane, a brak w katalogu" pokazuje przy każdej
  pracy do trzech kandydatów z katalogu („może chodzi o…"). To tylko wskazówka: kolumna „Kosztorysy"
  liczy wyłącznie dokładne dopasowania, bo bliskie trafienie zawyżyłoby wpis, którego nikt nie użył.
  Tak samo znacznik „występuje z inną j.m." jedynie nazywa prawie-duplikat i niczego nie dolicza.

**„Z możliwym duplikatem" — porównanie po słowach, nie po literach.** Dokładnego duplikatu w
cenniku być nie może, bo wpis jest unikalny po opisie i j.m. Ten problem łapie więc to, czego
porównanie opisów nie widzi, i to niezależnie od j.m., kategorii i ceny. Pod opisem każdej takiej
pracy stoi linia z bliźniakiem, jego j.m., ceną i kategorią.

- **„Prawie ten sam opis"** to te same słowa z inną końcówką („syfonu" / „syfonów", „kratki
  wentylacyjnej" / „kratek wentylacyjnych"), albo j.m. wpisana w opis („Skucie posadzki mb").
  **„Podobny opis"** to jedno słowo więcej lub mniej. Ta druga grupa jest głośniejsza i to jest
  przyjęte.
- **Liczba rozstrzyga.** W tym cenniku wariant zapisuje się liczbą: „do 12 / 18 / 24 modułów",
  „5 / 7,5 cm", „Q3 / Q4". Opisy różniące się liczbą nigdy nie są duplikatem. Właśnie dlatego
  podobieństwo po literach się nie nadaje: takie pary ocenia najwyżej ze wszystkich.
- **Liczone przy każdym wejściu**, więc wybrany problem można zapamiętać, inaczej niż „Użycie".
  Nie ma „to nie duplikat" ani scalania. Fałszywy alarm znika dopiero po zmianie opisu.

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
inwestycja jest rozliczana; druga nazywa tryb („rozliczenie brutto / netto / mieszane"). Mieszane idzie na **netto**, dokładnie jak
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
  (`2026-07-10-kosztorys-vat` (archive deleted 2026-09-29; git history)) nazywał brutto „figurą decyzji
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

Wyciągnięte z `context/foundation/manual-checks.md` przy jego przycięciu; pełny rejestr:
`git show d426e567^:context/foundation/manual-checks.md`.

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

Ten sam klucz jest kluczowany po `investmentId`, a szablon jest własną inwestycją (EX-893), więc
ptaszki każdego szablonu żyją osobno. Do 2026-09-29 wszystkie szablony dzieliły jeden warsztat
i ptaszek z A był wciąż włączony po otwarciu B.

**Bramka bywa ergonomią, nie niezmiennikiem — sprawdź, czy trwały stan już ją omija.** Bramka
płaszczyzny w `offeredFilterConditions` wyglądała na ochronę spójności; nie była. Zaangażowany filtr
obcej płaszczyzny przeżywa zmianę widoku i przeładowanie, więc stan „filtr drugiej płaszczyzny tnie
siatkę" był osiągalny zawsze — bramka utrudniała wejście w niego o jedno kliknięcie. Jej prawdziwym
zadaniem (EX-714) była **długość listy**. Kasując taką bramkę, trzeba przejąć jej prawdziwe zadanie
(tu: próg licznika), a nie to, na które wygląda.

**„Lista kolumn jest zamknięta" nie znaczy „widok nic nie robi".** `WORKSHOP_VISIBLE_COLUMNS` mrozi
kolumny szablonu, ale `sort-value.ts` czyta `view` **poza** zestawem kolumn — szablon sortował po
stawce wykonawcy, wyświetlając cenę klienta. Pochodne widoku żyją poza listą kolumn.

**`pickView` jest jedynym zapisującym klucz widoku** (`kosztorys-view:<investmentId>`). Ukrycie samego
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

**Odcięcie pól per budowa dzieje się przy odczycie szablonu, nie przy zapisie.**
`serialize-preset.ts` zeruje przedmiar, pomiar z arkusza i rabat, i wyrzuca etapy z wykonaniem —
za każdym razem, gdy szablon zasiewa nową inwestycję, jest „Wczytany" albo oddaje sekcje. Drzewo
samego szablonu trzyma to, co w nim wpisano, więc zamknięta lista kolumn szablonu
(`WORKSHOP_VISIBLE_COLUMNS`) nie jest kosmetyką: pole, którego nie da się wpisać, nie zniknie
potem po cichu przy użyciu szablonu.

## Szablon jest inwestycją o statusie `szablon` (EX-893, 2026-09-29)

Treść szablonu to **drzewo kosztorysu jego własnej inwestycji** — ta sama tabela sekcji i prac, te
same akcje, te same „Wersje". Nie ma już biblioteki jsonb (`kosztorys_presets`), wspólnego warsztatu
ani wskaźnika „który szablon jest teraz otwarty". Cała seria błędów tamtego modelu brała się z tego,
że id warsztatu **zmieniało znaczenie w czasie**: każdy czytelnik (punkty przywracania, klucze
localStorage, lustro, cache) musiał wiedzieć, który szablon warsztat akurat trzyma.

- **Status jest nieodwołalny w obie strony.** Szablon rodzi się wyłącznie przez `createTemplate`,
  a `guardTemplateStatus` odmawia nadania albo zdjęcia `szablon` przy edycji.
- **Szablon trafia do kosza (EX-914)**, tą samą drogą co inwestycja. Znika wtedy z listy szablonów
  i z każdego wyboru szablonu, a jego nazwa **zostaje zajęta** — próba jej użycia mówi, że szablon
  jest w koszu. „Usuń na zawsze" zawsze wymaga wpisania nazwy, bo szablon nigdy nie ma Przedmiaru,
  więc test „kosztorys w użyciu" by go nie złapał. Po 30 dniach usuwa go sprzątanie, a kaskada
  zabiera drzewo i punkty przywracania. Kosztorysy założone z szablonu zostają — mają własną kopię.
  Nazwy nie zwalniamy celowo (`investments_szablon_name_idx` nie patrzy na `trashed_at`). Wolna
  nazwa przeniosłaby kolizję na „Przywróć", a `restoreInvestmentAction` to goły `payload.update`,
  więc 23505 trafiłby do toastu po angielsku. Zajęta nazwa nie wymaga migracji, a przywrócenie
  nigdy się nie zderzy.
- **Nazwa jest tożsamością**: unikalna wśród szablonów bez względu na wielkość liter i spacje na
  brzegach (`investments_szablon_name_idx`).
- **„Ostatnia edycja" na liście to `content_edited_at`**, nie `updated_at` — ten drugi jest tokenem
  remountu edytora, więc zapis w szablonie go nie rusza.
- **Nadpisanie szablonu** („Zapisz jako szablon" → „Nadpisz istniejący") zostawia na nim punkt
  „Przed nadpisaniem: <źródło>", więc jest odwracalne z jego „Wersji".

**Wdrożenie na produkcję (29.09): najpierw deploy, potem jeden `payload migrate`.** Migracja
`20260929_1_szablon_as_investment` jest addytywna, a `20260929_2_drop_kosztorys_presets` destrukcyjna.
Między nimi stoi jeszcze `20260929_0` (EX-886, też destrukcyjna). `payload migrate` puszcza wszystko,
co czeka, więc „1 przed pushem, 2 po deployu” było niewykonalne. Poszedł więc deploy, a po nim jeden
przebieg wszystkich trzech. Stary kod nie mógł zobaczyć migracji `_2`, bo czyta `template_preset_id`
w każdym `payload.find` na inwestycjach (42703). Nowy kod bez `_1` psuje tylko szablony, i to na te
kilka minut.
`_2` rozpoznaje warsztat jako najstarszy `szablon` bez nazwy z biblioteki, nigdy po wskaźniku:
usunięcie otwartego szablonu zeruje wskaźnik, i tak właśnie było na prodzie 29.09.

**Kosztorysy zasiane z szablonu są kopiami zamrożonymi** — edycja szablonu nigdy nie rusza
istniejących kosztorysów. To zdanie znosi jedyny argument, który mógłby bronić jawnego „Zapisz"
w szablonie.

## Destylat: jedna wartość na kolumnę liczoną (EX-894, 2026-09-29)

**Kolumna liczona ma jedną funkcję wartości — `column-values.ts` — i czytają ją wszyscy:** komórka,
klucz sortowania, sumy kolumn, sumy sekcji i oba wydruki. Dryf komórka↔sortowanie zdarzył się dwa
razy (EX-487, EX-894), za każdym razem, bo liczba była składana osobno w kilku miejscach. Test
zgodności iteruje kolumny, które siatka **faktycznie składa**, a nie ręczną listę — lista sama by
dryfowała, a nowa kolumna liczona jest objęta testem od dnia dodania.

**Czego w niej nie ma, i dlaczego.** Kolumny edytowalne (cena, stawki, współczynniki, źródło ceny)
nie mają złożonej wartości, która mogłaby się rozjechać — dzielą z sortowaniem prymitywy z `calc.ts`
(`viewPrice`, `shownCoeff`, `priceSourceOf`). „Rozbieżność" też zostaje poza nią: jej komórka czyta
cały obiekt `measureDiscrepancy`, sortowanie tylko `.net`.

**Sumy etapów zostają na `stageAxisForView`**, bo wycenia wiersz raz dla wszystkich etapów naraz —
przejście przez funkcję wartości kolumna po kolumnie byłoby O(|etapy|²) na wierszu. Zgodność z
komórkami pilnuje test w `column-totals.test.ts`.

**Widok pracownika nie ma sortowania**, więc klucz sortowania nigdy nie dostaje ilości wykonanej
przez wszystkie ekipy i „Pozostało" pracownika nie da się po nim posortować. Dołożenie sortowania
tam wymaga podania `executedQtyByItem` do `sortValueGetter`.

## Sekcja bez pozycji (2026-09-29)

**Sekcja istnieje niezależnie od swoich prac.**

- „Dodaj → Sekcja" i „Wstaw sekcję powyżej/poniżej" tworzą samą belkę, bez pustej pracy w środku.
- Usunięcie ostatniej pracy zostawia sekcję na miejscu. Kaskady „ostatnia praca zabiera sekcję" już
  nie ma, a sekcję usuwa się tylko jawnie, z jej menu ⋯.
- Właściciel dostał to wprost, bo tak działa jego arkusz: nagłówek sekcji stoi nad pustymi wierszami.

**W edytorze to sama belka**: kropka, nazwa, „(0 poz.)" i przycisk „+ Dodaj pracę".

- Nie ma strzałki, bo nie ma czego zwijać.
- Klik w belkę nic nie robi.
- „Dodaj pracę" jest też w menu ⋯ każdej sekcji.
- Sekcja bez pozycji jest celem dla „Dodaj → Praca" i dla katalogu.

**Znika tam, gdzie nie ma nic do pokazania.**

- W edytorze znika, gdy działa wyszukiwarka albo filtr, bo nie pasuje do żadnego zapytania.
- W każdym wyjściu do klienta: podglądzie, linku, „Wydruku oferty" i druku pracownika. Oferta
  bez prac to szum.

**Nazwa: „bez pozycji", nie „pusta".** „Pusta sekcja" znaczy już u właściciela sekcję, której
prace nie mają wpisanych wartości. W kodzie to `itemless`.

**„Wersje" nie pokazuje dodania ani usunięcia sekcji bez pozycji.** Porównanie wersji idzie po
pracach (`history/diff-versions.ts`), więc sekcja bez prac nie daje wiersza różnicy. Zostaje tak,
dopóki właściciel nie poprosi.

## Wypłaty per para inwestycja × pracownik (EX-919, 2026-09-29)

„Pozostało do wypłaty" na liście pracowników i dialog „Rozlicz wypłaty" liczą na **parze
inwestycja × pracownik**: wykonane na jego etapach po jego stawce − jego wypłaty na tej inwestycji.
Ten sam wzór co blok Podwykonawcy, tylko rozcięty na pary. Pełne zasady liczby:
`context/foundation/investment-financials-and-discount.md` § „Pozostało do wypłaty" per worker.

- **„Nieprzypisane"** — etapy bez pracownika i wypłaty bez pracownika tworzą jedną szarą pozycję
  („przypisz, żeby wypłacić"). Tak samo grupuje je blok Podwykonawcy, więc wiersze dialogu z listy
  inwestycji sumują się do kolumny. Wypłaty bez pracownika to tylko stare wpisy (III–IV 2026);
  dziś wypłaty bez pracownika nie da się zapisać.
- **Stany pary, w tej kolejności:** nieprzypisane → bez rozliczenia etapu („ustaw rozliczenie
  etapu") → inwestycja zakończona („przywróć na Aktywna") → nadpłata → rozliczone → do wypłaty.
  Wypłacić można tylko trzy ostatnie.
- **Zaliczka** — kwota ponad wykonaną pracę jest dozwolona, ale jawna: czerwone „nadpłata X" przy
  wierszu, zdanie „X ponad wykonaną pracę — zapisze się jako zaliczka", a opis wypłaty dostaje
  „w tym zaliczka X zł". Słowo zostaje mimo znaczenia „wpłata inwestora" w słowniku — kontekst
  wypłaty dla pracownika je rozstrzyga. Wiersz już nadpłacony startuje odznaczony i pusty.
