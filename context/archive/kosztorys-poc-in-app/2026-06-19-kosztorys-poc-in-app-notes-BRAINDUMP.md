# Kosztorys POC — in-app transition — WORKING NOTES (brain dump)

> **Status (2026-06-19): ŻYWE NOTATKI z brainstormu. NIE finalny spec.**
> Dokładane na bieżąco w trakcie rozmowy. Decyzje mogą się jeszcze zmienić.
> Nie zaczynać implementacji z tego dokumentu — najpierw promocja do spec + akceptacja.

## Cel

POC „pełnego przejścia z Google Sheets do aplikacji". End-to-end replacement:
edytowalny kosztorys robocizny w aplikacji, czysty start (bez importu arkuszy),
zero kontaktu z Sheets dla nowych robót. Jakość POC — wolno iść skrótami.

## Środowisko (zrobione)

- **Worktree:** `.claude/worktrees/poc-kosztorys-in-app`, gałąź
  `worktree-poc-kosztorys-in-app` (zsync do lokalnego main `8d419ac`).
- **Nowa baza:** `wykonczymy-poc` w lokalnym Dockerze (kontener `wykonczymy`,
  port 5433), seed z dumpa Neona 2026-06-19 17:38 (2468 tx, 80 inwestycji,
  34 kosztorysy). `wykonczymy-db` nietknięta. Worktree `.env`
  `DB_POSTGRES_URL → wykonczymy-poc`.
- **Uwaga:** nie odpalać `docker compose up` z worktree (próbuje stawiać
  konkurencyjny projekt; kontener jest współdzielony).
- Skrypt inspekcji: `scripts/inspect-sheet.mjs` (formuły + wartości, pełne
  wiersze, litery kolumn AA+). Read-only.

## Zweryfikowane fakty (inspekcja realnych arkuszy: `testy_full_kosztorys` + Siennicka 160)

- **Arkusz = actuals z appki (mirror) + ręczna rozpiska robocizny.**
- Aplikacja **już** liczy wszystkie actuals z transakcji: wydatki inwestycyjne,
  wpłaty, wypłaty, materiały, korekty, straty. Zakładki `wydatki (ro)` i
  `transfery (ro)` to zrzuty appki (formuły SUMIF w arkuszu).
- **Materiały w arkuszu = rejestr zakupów = INVESTMENT_EXPENSE** (już w appce).
  Brak osobnej tabeli materiałów w POC.
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

```
A ordinal | B opis | C–H 1–6 etap ilość (wykonano) | I Przedmiar | J Pomiar z natury
K j.m. | L Cena j.m. (klient) | M rabat % | N Wartość netto | O komentarz
P–U 1–6 etap wartość | V pozostało do rozliczenia / bilans
```

- Wiersz-nagłówek sekcji: A = nazwa sekcji, N = suma sekcji.
- Wartość = **pomiar (J)** × cena (np. 57 m² × 70 = 3990), nie przedmiar.
- Zakładki `zakres pracy z narzędziami` / `bez narzędzi` = te same pozycje,
  inne ceny (cennik z narzędziami N, bez narzędzi P). Ceny podwykonawcy NIE są
  stałym % klienta (raz 65%, raz 58%) → niezależne.

## Schemat POC (rdzeń robocizny)

```
kosztorys_sections   investment_id, name, display_order
kosztorys_items      investment_id, section_id, display_order,
                     description, unit, planned_qty (przedmiar), measured_qty (pomiar),
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

- wartość wiersza = `pomiar × cena` minus rabat (procent lub kwota — patrz wyżej)
- „pozostało/bilans" (V) = wartość pozycji − Σ wartości wykonanych etapów
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
— poza POC, do rozważenia.

## Decyzje zamknięte

- **Dostęp (POC prosto):** **ADMIN, OWNER, MANAGER** — widzą i edytują wszystko.
  **EMPLOYEE — zero dostępu, nie widzi kosztorysu w ogóle.** **Follow-on:**
  ukrycie wrażliwych komórek (najpewniej ceny podwykonawcy = koszt/marża) przed
  MANAGEREM — tylko OWNER/ADMIN (P10).
- **Sekcje w pełni edytowalne:** dodawanie, zmiana nazwy, zmiana kolejności
  (`display_order`); nagłówek + suma sekcji (liczona). Dowolna liczba pozycji
  w sekcji (bez limitu).
- **Przedmiar vs pomiar = dwie zwykłe kolumny**, obie edytowalne, obie zapisane,
  niezależne. Przedmiar = ilość z wyceny; pomiar z natury = ilość zmierzona.
  **Wartość liczy się z pomiaru.** Bez „nadpisywania", bez dwóch sum (w szablonie
  pomiar startuje skopiowany z przedmiaru, żeby nie był pusty — to wszystko).
- **Lista prac dynamiczna** (wiersze, bez limitu).
- **Etapy dynamiczne** (wiersze `kosztorys_stages`; kolumny siatki renderowane
  z danych). Usunięcie etapu z wpisanym postępem → **BLOKADA** (najpierw wyczyść).
  Etap = ordinal + **opcjonalna nazwa** (może być, nie musi), edytowalne później.
  Związek etap ↔ płatność (transfery „etap 1-4") — **nieistotny teraz, parking.**
- **Ceny:** każda cena wariantu per pozycja = **niezależna, edytowalna liczba
  (snapshot)**. Relacja nie jest formułą (czasem %, czasem inna absolutna,
  czasem niezwiązana). Źródło prawdy = wpisana liczba.
- **Default ceny = cienka podpowiedź, ODŁOŻONA.** W POC wpisujemy ceny ręcznie.
  Podpowiadarka przyjdzie z szablonami.
- **VAT (netto/brutto):** ceny wpisywane **netto**; **brutto = netto × (1 + vat)**
  liczone, nie przechowywane. Nadpisuje wcześniejsze „netto bez VAT".
- **`vat_rate` jako kaskada:** globalny **default** → nadpisanie **per
  kategoria/sekcja** → pozycja **dziedziczy** stawkę swojej sekcji. Czyli
  `vat_rate` siedzi na `kosztorys_sections` (+ globalny default w konfiguracji),
  nie na pozycji. (Otwarte: czy potrzebny też override per pojedyncza pozycja.)
- **Rabat dwutrybowy:** `discount_type` ∈ {procent, kwota} + `discount_value`.
  - procent: `wartość = ilość × cena × (1 − %)`
  - kwota: `wartość = ilość × cena − kwota`

## Domyślne POC

PLN • netto+brutto z `vat_rate` per pozycja • hard-delete • reorder strzałkami
(bez drag) • etapy zmienne (zwykle 6) • współistnienie z zakładką „Arkusz" •
bez `work_catalogue`.

## Otwarte / odłożone (jawnie POZA POC)

- **A vs B (przechowywanie cen):** 3 sztywne kolumny vs dynamiczna tabela
  `price_variants` + `item_prices`. Rekomendacja A (taniej, migracja A→B
  mechaniczna). User skłania się ku elastyczności. **NIEROZSTRZYGNIĘTE.**
- **Linkage `LABOR_COST`:** czy suma rozpiski steruje `LABOR_COST`, czy stoi
  obok (plan vs actual)? **OTWARTE.** POC nie wymaga rozstrzygnięcia.
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
- `work_catalogue`, multi-waluta, drag-reorder, teardown Sheets (Phase 3b),
  synchronizacja dwukierunkowa.

## Pytania do właściciela (do rozstrzygnięcia biznesowo)

Pytania wymagające wiedzy domenowej właściciela — nie do rozstrzygnięcia z kodu.

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
- **P8.** Brutto/VAT dotyczy **wszystkich** wariantów ceny (też podwykonawcy),
  czy tylko ceny klienta (oferta)?

### Pozostało do rozliczenia / bilans

- **P9. [ROZSTRZYGNIĘTE]** Kolumna „pozostało do rozliczenia" (V) = **kontrola
  postępu robót**: ile wartościowo zostało do zrobienia w pozycji. Nie figura
  rozliczeniowa z klientem — wskaźnik „jak idzie robota". Formuła: wartość
  pozycji − Σ wartości wykonanych etapów. W aplikacji: kolumna wyliczana
  (informacyjna, postępowa). Rozważyć nazwę „pozostało do wykonania".

### Robocizna ↔ rozliczenia

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

```

```
