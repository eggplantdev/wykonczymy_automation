# Wydruk oferty — utwardzenie spike'u · Plan Brief

> Pełny plan: `context/changes/2026-09-23-wydruk-oferty/plan.md`
> Riserczy: `context/changes/2026-09-23-wydruk-oferty/research.md`

## What & Why

Wydruk oferty z kosztorysu jest zbudowany i działa. Riserczy pokazały, że liczy sumy po swojemu
zamiast czytać te, które edytor ma policzone i pokazuje klientowi, że nowa powierzchnia renderu nie
ma zamka ujawniania i że nie ma żadnych testów. Ten change zamyka dokładnie to — nie dokłada
funkcji.

## Starting Point

Trzy pliki (dwa nieśledzone). Pozycja „Wygeneruj ofertę w PDF" w menu „Inwestor" otwiera popup,
czyta zapisane ustawienia podglądu klienta i buduje kompletny dokument HTML z pasmami sekcji,
szynami kolorystycznymi i stopką. Układ jest zatwierdzony przez właściciela i nietykalny.

## Desired End State

Wydruk nie zawiera ani jednego własnego wyliczenia — kwoty to wartości komórek i gotowe sumy
z edytora. Kolumna nie może wyjść poza `PREVIEW_VISIBLE_COLUMNS` bez wywalenia testu. Papier
pokazuje to samo co podgląd ofertowy.

## Key Decisions Made

| Decyzja                 | Wybór                                                                    | Dlaczego                                                                                                                     | Źródło           |
| ----------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Skąd biorą się sumy     | Z edytora (`columnTotals` / `sectionColumnTotals`), wydruk nie liczy nic | Papier ma drukować figurę aplikacji, nie własne zwinięcie tych samych wierszy                                                | Właściciel       |
| Rabat globalny          | Nie dotyczy wydruku                                                      | Suma oferty stoi na przedmiarze; rabat globalny z założenia nie wchodzi do tej kolumny i schodzi raz w panelu rozliczeniowym | Weryfikacja kodu |
| Zaokrąglenia            | Bez zmian — wiersze i suma zaokrąglane niezależnie                       | Suma to figura aplikacji sformatowana bez groszy; zgodność z aplikacją bije zgodność dodawanej kolumny                       | Plan             |
| Zamek ujawniania        | Filtr przez `PREVIEW_VISIBLE_COLUMNS` + spec node                        | `selectV2Columns` zwraca deskryptory siatki z rendererami React — wydruk potrzebuje stringa                                  | Riserczy         |
| Wspólna powłoka wydruku | Nie teraz                                                                | Oferta ma pasma i szyny, transfery płaską tabelę — wspólny builder wyszedłby parametryzowany pod jednego konsumenta          | Riserczy         |
| Tryb podglądu           | Wydruk zawsze czyta wariant OFERTA                                       | Pozycja menu nazywa się „Wygeneruj ofertę"; dziś tryb ROZLICZENIE daje zbiór kolumn, którego właściciel nigdy nie widział    | Plan             |
| Precyzja kwot           | Bez groszy, jak dziś                                                     | Arkusz ofertowy właściciela drukuje bez groszy — to referencja dla papieru                                                   | Riserczy         |
| E2E                     | Odroczone do `e2e-backlog`                                               | Pełny przebieg ~1 h; jedyne genuine przejście klient→serwer→DB to sam popup                                                  | Riserczy         |

## Scope

**W zakresie:** sumy czytane z edytora · `colspan` · sufit `PREVIEW_VISIBLE_COLUMNS` ·
kolumna „Pozostało" · odczyt wariantu OFERTA · jeden odczyt ustawień zamiast dwóch · spec node ·
spec DOM · zapis odwrócenia cięcia S-14 · issue `e2e-backlog`

**Poza zakresem:** wykres kołowy udziału sekcji · telefon/e-mail/adres w nagłówku · ekstrakcja
wspólnej powłoki wydruku · `zloty()` do `format.ts` · etykiety z `COLUMN_LABELS` · bramka roli
(pytanie do właściciela) · puste sekcje z `0 zł` · E2E · przypadek 2 wydruku

## Architecture / Approach

Nic się nie przenosi. `build-offer-print-html.ts` zostaje tam, gdzie jest (sibling
`lib/transfers/build-transfers-print-html.ts`), dostaje gotowe sumy zamiast własnych akumulatorów,
filtr sufitu na liście kolumn i poprawkę `colspan`. Akcja przestaje strzelać drugim
odczytem ustawień i czyta wariant OFERTA. Dochodzą dwa pliki testów.

## Phases at a Glance

| Faza                    | Co dowozi                                           | Ryzyko                                                                              |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Wydruk nic nie liczy | Sumy czytane z edytora, zero arytmetyki na papierze | Sumy edytora liczone na pełnym zbiorze — zweryfikowane, że filtr wydruku wnosi zero |
| 2. Zamek                | Kolumna nie wyjdzie poza sufit                      | Żadne — faza zamknięta testem                                                       |
| 3. Papier == ekran      | „Pozostało", wariant OFERTA, jeden odczyt           | Zmiana wariantu zmienia to, co widzi klient — trafia do manualnych checków          |
| 4. Zapis                | Roadmapa spójna z kodem, dług E2E w trackerze       | Linear MCP niedostępny → wpis w `roadmap.md` i jawna informacja                     |

**Prerequisites:** żadne — cały kod jest lokalny, bez migracji i bez zmian schematu.
**Estimated effort:** jedna sesja.

## Open Risks & Assumptions

- **Wariant OFERTA zamiast aktywnego** to zmiana tego, co drukuje się właścicielowi stojącemu
  w trybie ROZLICZENIE. Obecne zachowanie jest niespójne (settlementowy zbiór ukryć nałożony na
  ofertowy zestaw kolumn), więc zmiana jest naprawą, ale właściciel powinien ją zobaczyć.
- **Bramka roli** — MANAGER może dziś wydrukować dokument klienta, sąsiednie pozycje menu są dla
  niego wygaszone. Nie ruszam bez potwierdzenia intencji.
- **Dodawanie kolumny na kartce** może dać różnicę kilku złotych wobec drukowanej sumy, bo wiersze
  i suma zaokrąglane są niezależnie. Świadomy wybór: papier ma się zgadzać z aplikacją, nie sam
  ze sobą. Siatka zachowuje się tak samo.

## Success Criteria (Summary)

- „Razem netto" na wydruku == „Razem" pod kolumną „Wartość netto przedmiar" w podglądzie klienta
- W `build-offer-print-html.ts` nie ma już `+=` na kwocie
- Dopisanie kolumny spoza `PREVIEW_VISIBLE_COLUMNS` do wydruku wywala test
