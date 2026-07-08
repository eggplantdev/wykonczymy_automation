# Kosztorys w aplikacji — POC przejścia z Google Sheets (spec)

> **Status (2026-06-19): SPEC do przeglądu.** Zakres, schemat i decyzje ustalone
> w brainstormie. Pytania do właściciela (P1–P13) i dwie decyzje techniczne
> (A/B ceny, linkage `LABOR_COST`) są jawnie otwarte i NIE blokują POC.
> Notatki źródłowe (brain dump): `2026-06-19-kosztorys-poc-in-app-notes.md`.

## 1. Cel

POC „pełnego przejścia z Google Sheets do aplikacji". Edytowalna **rozpiska
robocizny** w aplikacji, czysty start (bez importu arkuszy), zero kontaktu z
Sheets dla nowych robót. Dowodzi, że aplikacja może w pełni zastąpić arkusz w
tej części, której dziś nie obejmuje. Jakość POC — wolno iść skrótami.

## 2. Kontekst — co wynika z inspekcji realnych arkuszy

Zweryfikowane na dwóch arkuszach (`testy_full_kosztorys`, Siennicka 160),
łącznie z formułami:

- **Arkusz = actuals z aplikacji (mirror) + ręczna rozpiska robocizny.**
- Aplikacja **już** liczy wszystkie actuals z transakcji: wydatki inwestycyjne,
  wpłaty, wypłaty, materiały, korekty, straty. Zakładki `wydatki (ro)` i
  `transfery (ro)` to zrzuty aplikacji do arkusza (formuły `SUMIF`).
- **Materiały w arkuszu = rejestr zakupów = `INVESTMENT_EXPENSE`** (już w
  aplikacji). POC nie buduje osobnej tabeli materiałów.
- **Arkusz dryfuje od bazy (NIE jest 1:1):** Siennicka miała 5 z 17 wydatków
  (brak backfillu), a ID w `transfery` kolidowały z niepowiązanymi rekordami
  (prawdopodobnie reużycie `serial` po odtworzeniu Neona z backupu). Wniosek:
  **źródłem prawdy jest baza aplikacji, nie arkusz** — import odrzucony.
- **Robocizna:** aplikacja ma tylko **kwotę zbiorczą** `LABOR_COST`; arkusz ma
  **rozpiskę** (sekcje → pozycje → ceny → etapy). Edytor przejmuje rozpiskę.

```
rozpiska robocizny (arkusz)  ──suma──▶  LABOR_COST (kwota zbiorcza w aplikacji)
   ← TO przejmuje edytor                  ← to aplikacja już ma
```

## 3. Zakres

**W POC:** edytor rozpiski robocizny (sekcje, pozycje, 3 ceny, przedmiar/pomiar,
rabat, VAT, dynamiczne etapy + postęp), tabela pomiarów pokoi, panel
plan-vs-actual (pełny, z marżą planowaną), konfigurowalny eksport PDF dla
klienta, autosave optymistyczny, współistnienie z istniejącą zakładką „Arkusz".

**Poza POC:** import arkusza, teardown Sheets (Phase 3b), synchronizacja
dwukierunkowa, `work_catalogue`, multi-waluta, drag-reorder, szablony i
auto-tworzenie kosztorysu (follow-on), ukrywanie komórek przed MANAGEREM
(follow-on), auto-link pokój → pozycja.

## 4. Schemat danych

Wszystko per inwestycja (poza relacjami). Hard-delete. PLN.

```
kosztorys_sections   id, investment_id, name, display_order,
                     vat_rate,            -- default VAT dla pozycji sekcji
                     default_cost_variant -- 'w_tools' | 'own_tools'

kosztorys_items      id, investment_id, section_id, display_order,
                     description, unit,
                     planned_qty,         -- przedmiar
                     measured_qty,        -- pomiar z natury
                     discount_type,       -- 'percent' | 'amount'
                     discount_value,
                     -- CENY (decyzja A/B, §9): wariant A = 3 kolumny:
                     client_price,
                     subcontractor_w_tools_price,
                     subcontractor_own_tools_price,
                     cost_variant,        -- 'w_tools' | 'own_tools' (dziedziczy z sekcji)
                     vat_rate,            -- opcjonalny override sekcji (otwarte)
                     hidden_in_export,    -- domyślnie wg reguły P12
                     note

kosztorys_stages     id, investment_id, ordinal, label?    UNIQUE(investment_id, ordinal)
                     -- DYNAMICZNE, wspólne dla pozycji (jak kolumny arkusza)

stage_progress       id, item_id, stage_id, qty_done       UNIQUE(item_id, stage_id)
                     -- rzadkie: brak wiersza = 0

kosztorys_rooms      id, investment_id, name, floor_m2, perimeter, height,
                     wall_m2, ceiling_decor_m2, baseboard_m
                     -- ewidencja pomiarów; bez auto-linku do pozycji w POC
```

Globalny **default VAT** i **default cost_variant** — w konfiguracji aplikacji.
BRAK tabeli materiałów (→ `INVESTMENT_EXPENSE`). BRAK `work_catalogue`.

## 5. Wartości liczone (nigdy nie przechowywane)

Decyzja: formuły w kodzie, nie w komórkach. Zapisujemy tylko inputy.

- **wartość wiersza (netto)** = `pomiar × cena` minus rabat:
  - procent: `pomiar × cena × (1 − discount_value)`
  - kwota: `pomiar × cena − discount_value`
- **brutto** = `netto × (1 + vat_rate)`
- **wartość etapu k** = `ilość_wykonana_w_etapie_k × cena` (z rabatem)
- **„pozostało do wykonania" (V)** = wartość pozycji − Σ wartości wykonanych
  etapów = **kontrola postępu robót** (informacyjna).
- **sumy sekcji / całości** = redukcja w kodzie.

Uwaga: formuły w arkuszu mają miejscami błędy copy-paste w późnych kolumnach
etapów — w kodzie liczymy czysto, nie odwzorowujemy cudzych błędów komórek.

### Przedmiar vs pomiar

Dwie zwykłe, niezależne kolumny: przedmiar = ilość z wyceny; pomiar z natury =
ilość zmierzona. **Wartość liczy się z pomiaru.** W szablonie pomiar startuje
skopiowany z przedmiaru (żeby nie był pusty) — to jedyna „magia".

## 6. Edycja i zapis

- UX = zwykła tabela (TanStack Table; grupowanie po sekcji; kolumny etapów
  renderowane z `kosztorys_stages`; przełącznik wariantu ceny; netto/brutto).
- **Zapisywane = tylko inputy** (§4); wartości/sumy/marża/brutto/V liczone na żywo.
- **Autosave per pole, optymistycznie:** edycja inline → na blur/zmianę zapis
  przez `protectedAction` + `updateTag`; UI natychmiast przez
  `useOptimisticFormStore`; debounce dla tekstów/liczb; bez przycisku „Zapisz".
- Dodanie/usunięcie pozycji/sekcji/etapu = osobna mutacja, optymistyczna.
- **Usunięcie etapu z wpisanym postępem → BLOKADA** (komunikat „najpierw wyczyść
  ilości"). Etap = ordinal + opcjonalna nazwa, edytowalny później.
- Lista prac i etapów **dynamiczna** (wiersze, bez limitu; 1000+ wierszy OK —
  autosave zapisuje tylko zmienione pole).
- Sekcje w pełni edytowalne: dodawanie, zmiana nazwy, kolejność.

## 7. Dostęp i widoczność

- **POC:** ADMIN, OWNER, MANAGER — widzą i edytują wszystko. **EMPLOYEE — zero
  dostępu, nie widzi kosztorysu.**
- **Follow-on:** ukrycie wrażliwych komórek (najpewniej ceny podwykonawcy =
  koszt/marża) przed MANAGEREM — tylko OWNER/ADMIN (P10).

## 8. Panel plan-vs-actual (pełny, z marżą planowaną)

Czysto na odczyt, per inwestycja. Niezależny od linkage `LABOR_COST`.

| Wiersz                   | Źródło                                                 |
| ------------------------ | ------------------------------------------------------ |
| Plan robocizny (klient)  | Σ `pomiar × cena_klient` z rozpiski                    |
| Wykonano (postęp)        | Σ wartości odhaczonych etapów (klient) + % planu       |
| Zafakturowano            | `LABOR_COST` inwestycji                                |
| Wypłacono ekipie         | `PAYOUT` inwestycji                                    |
| Plan kosztu podwykonawcy | Σ `pomiar × cena_wariantu_kosztu_pozycji`              |
| **Marża planowana**      | plan klient − plan podwykonawcy                        |
| **Marża rzeczywista**    | wzór aplikacji: `robocizna − wypłaty − rabat − strata` |
| Materiały (actuals)      | `INVESTMENT_EXPENSE` — bez planu                       |

**Wariant kosztu PER POZYCJA** (`w_tools` | `own_tools`): w jednej inwestycji
mogą wystąpić oba (jedna ekipa z narzędziami, druga bez). Kaskada jak VAT:
default na sekcji → pozycja dziedziczy → override per pozycja.

## 9. Druk / eksport (konfigurowalny, edytowalny)

Wydruk = **oferta dla klienta**: tylko ceny klienta (netto / VAT / brutto); bez
cen podwykonawcy, marży, postępu, „pozostało". Mechanizm: `buildPrintHtml` +
`printViaIframe` → druk przeglądarki → PDF (zero nowych zależności).

**Eksport edytowalny — krok „przygotuj eksport":** każda pozycja ma flagę
`hidden_in_export`; krok pokazuje kosztorys z togglami widoczności per pozycja;
część domyślnie ukryta (reguła → P12); owner odkrywa/ukrywa, potem generuje PDF
z widocznych pozycji.

## 10. Szablony (follow-on, NIE w POC)

Odwzorowanie dzisiejszego „kosztorys wzór → kopia → edycja". Podejście: **bierze
się istniejący kosztorys jako wzorzec i „czyści do defaultów"** (granularnie:
prace / etapy / wpisane wartości). = klon + selektywny reset — potwierdza model
snapshot, zero osobnej tabeli „templates". Domyślny szablon **wstępnie
zaznaczony** na liście (user potwierdza). Wymaga najpierw rdzenia edytora.

## 11. Otwarte decyzje techniczne

- **A vs B (przechowywanie cen).** A = 3 sztywne kolumny (w schemacie wyżej);
  B = dynamiczna tabela `price_variants` + `item_prices`. Rekomendacja **A**
  (taniej, migracja A→B mechaniczna). Zależy od P4.
- **Linkage `LABOR_COST`.** Czy suma rozpiski steruje `LABOR_COST`, czy stoi
  obok (plan vs actual)? POC nie wymaga rozstrzygnięcia (zob. P5).

## 12. Pytania do właściciela (biznesowe, nie blokują POC)

- **P1.** Pokoje: luźny kalkulator (jak arkusz) czy wpiąć pomiar w przedmiar pozycji?
- **P2.** Wysokość ścian stała (2,58 m) czy per pokój/robota?
- **P3.** „Powierzchnia malowania" = ściany − pomieszczenia mokre: reguła stała czy ręczna?
- **P4.** Zestaw modeli ceny stały (3) czy dynamiczny? (decyduje A vs B)
- **P5.** Suma rozpiski steruje `LABOR_COST`, czy osobna ręczna transakcja?
- **P6.** Auto-tworzenie kosztorysu przy nowej (sub)inwestycji?
- **P7.** Domyślna stawka VAT nowej pozycji (8% vs 23%)?
- **P8.** Brutto/VAT dla wszystkich wariantów ceny, czy tylko klienta?
- **P9. [ROZSTRZYGNIĘTE]** „Pozostało" (V) = kontrola postępu robót.
- **P10.** Które komórki ukryć przed MANAGEREM (follow-on)?
- **P11.** Domyślny wariant kosztu podwykonawcy (default sekcji)?
- **P12.** Które pozycje domyślnie ukryte w eksporcie dla klienta?
- **P13.** Oferta drukuje przedmiar czy pomiar? Jeden tryb czy przełącznik?

## 13. Środowisko (gotowe)

- **Worktree:** `.claude/worktrees/poc-kosztorys-in-app`, gałąź
  `worktree-poc-kosztorys-in-app` (na lokalnym main `8d419ac`).
- **Baza:** `wykonczymy-poc` w lokalnym Dockerze (kontener `wykonczymy`, 5433),
  seed z dumpa Neona 2026-06-19. `wykonczymy-db` nietknięta. Worktree `.env`
  `DB_POSTGRES_URL → wykonczymy-poc`. Migracja POC tylko tutaj — zero prod.
- Inspekcja arkuszy: `scripts/inspect-sheet.mjs` (read-only).
