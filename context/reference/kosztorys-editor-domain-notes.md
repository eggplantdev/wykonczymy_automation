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

Czysto na odczyt, per inwestycja. Niezależny od P5 (linkage LABOR_COST).

| Wiersz                   | Źródło                                                      |
| ------------------------ | ----------------------------------------------------------- |
| Plan robocizny (klient)  | Σ `pomiar × cena_klient` z rozpiski                         |
| Wykonano (postęp)        | Σ wartości odhaczonych etapów (klient) + % planu            |
| Zafakturowano            | `LABOR_COST` inwestycji                                     |
| Wypłacono ekipie         | `PAYOUT` inwestycji                                         |
| Plan kosztu podwykonawcy | Σ `pomiar × cena_wariantu_kosztu_pozycji`                   |
| **Marża planowana**      | plan klient − plan podwykonawcy                             |
| **Marża rzeczywista**    | wzór aplikacji: `robocizna − wypłaty − rabat − strata`      |
| Materiały (actuals)      | `INVESTMENT_EXPENSE` — bez planu (materiałów nie planujemy) |

- **Wariant kosztu PER POZYCJA** (z narzędziami | bez) — w jednej inwestycji
  mogą występować oba (jedna ekipa z narzędziami, druga bez), więc wybór NIE jest
  per inwestycja. Każda pozycja wskazuje, która cena podwykonawcy jest jej
  rzeczywistym kosztem. Kaskada jak VAT: **default na sekcji → pozycja dziedziczy
  → można nadpisać** (zwykle ekipa robi całą sekcję, więc default sekcji łapie
  większość). Default sekcji → P11.

## Edytor — zapis i edycja (D)

UX siatki = zwykła tabela (TanStack); sednem nie jest wygląd, tylko zapis.

**Zapisywane = tylko inputy, nigdy wyliczane** (formuły w kodzie):

```
inputy: pozycja (opis, jednostka, przedmiar, pomiar, 3 ceny, discount_type+value,
        cost_variant, note, hidden_in_export, display_order);
        sekcja (nazwa, display_order, vat_rate, default cost_variant);
        etap (ordinal, label); stage_progress (item, stage → ilość)
liczone na żywo: wartość wiersza, sumy sekcji/całości, V, marża, brutto
```

**Zapis: AUTOSAVE per pole, optymistycznie.**

- edycja inline; na blur/zmianę → zapis przez `protectedAction` + `updateTag`,
- UI natychmiast przez `useOptimisticFormStore` (optymistycznie), zapis w tle,
- debounce dla tekstów/liczb (nie strzelać per znak),
- dodanie/usunięcie pozycji/sekcji/etapu = osobna mutacja, też optymistyczna,
- **bez przycisku „Zapisz"** — feel arkusza + skala (1000+ wierszy: zapisujemy
  tylko zmienione pole, nie cały arkusz).

## Druk / eksport (G) — KONFIGUROWALNY, edytowalny

Wydruk = **oferta dla klienta** (tylko ceny klienta: netto / VAT / brutto; bez
cen podwykonawcy, marży, postępu, „pozostało"). Mechanizm: `buildPrintHtml` +
`printViaIframe` → druk przeglądarki → PDF. Zero nowych zależności.

**Eksport jest EDYTOWALNY (krok „przygotuj eksport"):** dziś owner bierze
kosztorys i ręcznie ukrywa wybrane pozycje przed klientem. Odwzorowanie:

- każda pozycja ma flagę widoczności w eksporcie (`hidden_in_export`),
- krok „przygotuj eksport" pokazuje kosztorys z togglami widoczności per pozycja,
- **część pozycji domyślnie ukryta** (reguła default → P12),
- owner odkrywa / ukrywa więcej, potem generuje PDF (tylko widoczne).

Otwarte: która ilość na ofercie — przedmiar (oferta wstępna) czy pomiar
(rozliczenie) → P13. Drugi tryb wydruku „raport postępu" (wewnętrzny, z etapami)
— do rozważenia.

## Decyzje zamknięte

- **Dostęp (prosto):** **ADMIN, OWNER, MANAGER** — widzą i edytują wszystko.
  **EMPLOYEE — zero dostępu, nie widzi kosztorysu w ogóle.** **Follow-on:**
  ukrycie wrażliwych komórek (najpewniej ceny podwykonawcy = koszt/marża) przed
  MANAGEREM — tylko OWNER/ADMIN (P10).
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
  - **„Pozostało do rozliczenia"** = `S − T`; przy pustym Przedmiarze „—" (brak mianownika).
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
  - **Płaszczyzna księgi (actuals):** transakcje i wydatki są **netto, bez VAT** — schemat
    transferów nie ma osi VAT. `LABOR_COST`, `RABAT`, materiały (`INVESTMENT_EXPENSE`),
    korekty (`CORRECTION`), wpłaty, wypłaty — wszystkie renderują się w **wartości nominalnej,
    bez doliczania VAT**. „Wpłaty to pieniądze już wpłacone przez inwestora — nie ma czego
    gruntować"; korekta i wydatki tak samo.
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
  - **Skutek dla rekoncyliacji (strona inwestycji „z kosztorysu", EX-535):** porównanie idzie
    **netto ↔ netto** dla obu figur — kosztorys suma prac (netto) ↔ Σ `LABOR_COST`, kosztorys
    rabat (netto) ↔ Σ `RABAT`. Strony kosztorysowej **nie gruntujemy**. To usuwa fałszywy
    rozjazd o VAT (rabat 100 netto mylnie porównywany z „102 brutto") — sygnalizacja świeci
    tylko przy realnej różnicy ≥ 1 gr. **Założenie do potwierdzenia:** że transakcja `RABAT`
    (i `LABOR_COST`) jest wpisywana **netto**. Jeśli właściciel wpisuje rabat myśląc brutto
    („100% z brutto"), rekoncyliacja musiałaby gruntować stronę kosztorysową dla rabatu —
    otwarte pytanie EX-539, siostra EX-536 (zaliczka netto/brutto). Patrz
    `context/changes/robocizna-from-kosztorys/open-questions.md` (Q2).
- **Rabat dwutrybowy:** `discount_type` ∈ {procent, kwota} + `discount_value`.
  - procent: `wartość = ilość × cena × (1 − %)`
  - kwota: `wartość = ilość × cena − kwota`

## Domyślne

PLN • netto+brutto z `vat_rate` per pozycja • hard-delete • reorder strzałkami
(bez drag) • etapy zmienne (w szablonie 10) • współistnienie z zakładką „Arkusz" •
bez `work_catalogue`.

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

- **Kosztorys = dokument dla klienta; docelowo wchłania całe koszty inwestycji**
  (właściciel, 2026-07-15). „To kosztorys finalnie trafia do klienta. Tam mamy
  wszystkie prace, plus wydatki na materiały i tak dalej, plus koszt robocizny."
  Czyli rozpiska prac to **część** docelowego kosztorysu, nie całość: dochodzą
  materiały (`INVESTMENT_EXPENSE`) i robocizna (`LABOR_COST`).

  **Oderwany jest edytor v2 — nie V1**, gdzie lustro `INVESTMENT_EXPENSE` (PRD
  FR-014, `prd.md:30`) już te koszty wnosi. Skutek dla v2, ważny przy każdej
  figurze pieniężnej w edytorze: **marża liczy się wyłącznie z transferów**
  (`robocizna − wypłaty − rabat − strata`), a kosztorys v2 w nią nie wchodzi —
  rabat wpisany w edytorze obniża tylko wartość kosztorysu. To nie bug edytora,
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

- **P10.** Które dokładnie komórki/kolumny ukryć przed MANAGEREM (follow-on)?
  Hipoteza: ceny podwykonawcy (z narzędziami / bez) = koszt i marża. Cena
  klienta, przedmiar/pomiar, postęp etapów — widoczne dla MANAGERA?

### Plan-vs-actual

- **P11.** Domyślny wariant kosztu podwykonawcy (z narzędziami vs bez) — jako
  default sekcji, od którego dziedziczą pozycje (nadpisywalny per pozycja)?

### Druk / eksport

- **P12.** Które pozycje mają być **domyślnie ukryte** w eksporcie dla klienta?
  (reguła: np. wiersze zerowe/puste, pozycje wewnętrzne, konkretne sekcje?)
- **P13.** Oferta drukuje ilość z **przedmiaru** (oferta wstępna) czy **pomiaru**
  (rozliczenie)? Jeden tryb czy przełącznik?
