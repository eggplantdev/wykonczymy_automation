# Przywrócenie „własnego mnożnika" stawki wykonawcy — brief

## Co i po co

„Źródło ceny wykonawcy" ma dziś dwie opcje: „auto" (globalny mnożnik inwestycji) i „kwota stała".
Brakuje trzeciej — **własnego mnożnika per pozycja**. Bez niej jedyny sposób na odejście od globalnego
współczynnika na jednej pracy to zamrożenie kwoty, która potem nie rusza się przy zmianie ceny dla
inwestora. Przywracamy trzecie źródło w rozpiskie **i** w katalogu prac.

Mnożnik jest **per pojedyncza praca**. Per sekcja nie ma i nie będzie.

## Punkt wyjścia

- Trzecie źródło zostało skasowane razem z kolumnami `*_override_type`
  (`src/migrations/20260902_0_collapse_kosztorys_tool_overrides.ts`, EX-766). Nie ma czego odwracać —
  nie ma gdzie zapisać „ta liczba jest mnożnikiem".
- Powód kasacji trzyma się do dziś: siatka zapisuje **jedno pole na wywołanie akcji**
  (`grid-change-plan.ts:40` → `use-kosztorys-editor.ts:1169-1179`), więc dwie kolumny niosące jedno
  pojęcie zapisywały się jako dwa nieuporządkowane zapisy, a stan pośredni był trwały i **cichy**.
- Katalog prac nie zna pojęcia mnożnika w ogóle — stawka to `number | null`, a porównanie z katalogiem
  koduje rodzaj dwoma boolami.
- Odcisk golden mastera koduje rodzaj literalnie (`'amount:' || …`) i przy zmianie kolumny **po cichu
  wypisuje inwestycje z porównania** zamiast paść na czerwono.

## Stan docelowy

Trzy źródła w menu: „auto" / „własny mnożnik" / „kwota stała". Przy mnożniku edytowalna jest nowa
kolumna „Mnożnik" (zapis dziesiętny), a „Cena j.m." pokazuje wyliczoną kwotę wyszarzoną i
nieedytowalną — dokładnie jak przy „auto". Stawka przesuwa się razem z ceną dla inwestora.

Sufit 65% ocenia taką pozycję po wynikowej stawce. Filtry rozpiski mają trzeci wpis na płaszczyznę.
Diagnostyka „liczone według formuły" wraca do swojej pierwotnej reguły. W katalogu prac praca może
nieść mnożnik i wstawia się do rozpiski jako mnożnik.

## Podjęte decyzje

| Decyzja          | Wybór                                                                               | Dlaczego                                                                                      | Źródło              |
| ---------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------- |
| Znaczenie        | **Śledzi cenę** — przechowywany jako mnożnik, stawka liczona przy każdym odczycie   | Gdyby zamrażał kwotę, byłby drugą nazwą na „kwotę stałą"                                      | właściciel          |
| Zapis            | **Druga kolumna `numeric NULL` na płaszczyznę**, mnożnik ma pierwszeństwo           | Trzy czytniki SQL zostają arytmetyką zamiast parsować tagowaną wartość                        | analiza             |
| Atomowość        | **`updateItemFieldAction` normalizuje parę** — jedna zmiana pola = zapis obu kolumn | To ścieżka zapisu, nie liczba kolumn, czyniła EX-766 niebezpiecznym                           | analiza             |
| Sufit            | **Tak** — ocenia wynikową stawkę, czerwień na obu komórkach                         | Przepłacenie wygląda tak samo, niezależnie od notacji                                         | właściciel          |
| Import z arkusza | **Bez zmian** — `deriveOverride` zachowuje dwie gałęzie                             | Formuła o innym stosunku nie ma być zgadywana jako mnożnik                                    | właściciel          |
| Katalog prac     | **Tak** — mnożnik jedzie w obie strony                                              | Cała wartość cennika globalnego to przeniesienie reguły, nie liczby                           | właściciel          |
| Kolumna          | **Nowa „Mnożnik"** per płaszczyzna; „Cena j.m." tylko do odczytu przy tym źródle    | Dwie edytowalne komórki nad jednym pojęciem nadpisywałyby sobie źródło                        | właściciel          |
| Filtry           | **Trzeci wpis na płaszczyznę**                                                      | Trzy rozłączne źródła, więc negowane bliźniaki dalej się domykają                             | właściciel          |
| Notacja          | **Dziesiętna** (`0,55`), jak globalny mnożnik                                       | Ta sama decyzja w dwóch notacjach o pasek od siebie to wklejenie pomylone 100×                | właściciel          |
| Zakres           | **Jedna zmiana** — rozpiska, potem katalog, ta sama gałąź                           | Katalog bez rozpiski nie ma czego przenosić                                                   | właściciel          |
| Diagnostyka      | **Przywrócić** regułę „wszystko, co nie jest płaską kwotą"                          | Tak brzmiał komentarz EX-708; dzisiejszy węższy test był równoważny tylko przy dwóch źródłach | `registry.ts:58-93` |
| Backfill         | **Brak**                                                                            | Nikt nie zgadnie wstecz, która kwota „miała być" mnożnikiem                                   | analiza             |

## Zakres

**W zakresie:** migracja (dwie tabele), wycena, normalizacja zapisu, trzy czytniki SQL, siatka
(źródło + kolumna + tryb tylko do odczytu), sufit, filtry, diagnostyka, katalog prac (formularz,
tabela, przenoszenie, porównanie), odcisk parity, dokumentacja.

**Poza zakresem:** globalny mnożnik inwestycji, import z arkusza, mnożnik per sekcja, backfill
istniejących danych, `buildCatalogueSeed` (martwy moduł), E2E (należność zapisywana na bramce
przeglądu), EX-864 (zaokrąglanie stawki „auto").

## Podejście

Najpierw liczba, potem zapis, potem ekran. Trzecie źródło powstaje w czystej arytmetyce, gdzie
testuje się je bez renderu i bez bazy; dopiero domknięta ścieżka zapisu czyni drugą kolumnę
bezpieczną; ekran, werdykty i katalog stoją już na atomowym fundamencie.

Faza 0 stoi przed wszystkim, bo odcisk golden mastera psuje się cicho — bez świeżego baseline'u nie
da się odróżnić zmiany kolumny od zmiany liczby.

## Fazy

| Faza                           | Co dowozi                                                         | Główne ryzyko                                                  |
| ------------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| 0 — Baseline parity            | Świeża baza testowa + przeliczony fixture                         | Zastany dryf przypisany naszej zmianie                         |
| 1 — Schemat i arytmetyka       | Kolumny w obu tabelach, `priceSourceOf`, pierwszeństwo w wycenie  | Mnożnik `0` potraktowany jako „auto" zamiast jako zero złotych |
| 2 — Atomowa ścieżka zapisu     | Normalizacja pary w akcji, trzy czytniki SQL, diff/blank/snapshot | Pominięty czytnik daje dwie niezgodne kopie reguły ceny        |
| 3 — Ekran                      | Trzecie źródło, kolumna „Mnożnik", „Cena j.m." tylko do odczytu   | Wyciek kolumny do widoku klienta lub podglądu inwestora        |
| 4 — Sufit, filtry, diagnostyka | Werdykty znają trzy źródła                                        | Rozjazd predykatu sufitu z orzeczeniem w rejestrze filtrów     |
| 5 — Katalog prac               | Mnożnik w cenniku i w obie strony przenoszenia                    | Dwa boole `isAuto` zostawione gdzieś w porównaniu              |
| 6 — Domknięcie                 | Odcisk parity, dokumentacja, bramka drzewa                        | Regeneracja fixture'a przyjęta na wiarę zamiast obejrzana      |

## Otwarte ryzyka i założenia

- **Niezmiennik „najwyżej jedna z pary jest nie-null" nie jest pilnowany przez typy.** Surowy SQL
  i `/admin` mogą złamać go po cichu. Wycena jest odporna (mnożnik wygrywa), ale nikt tego nie zgłosi —
  świadomy koszt kształtu dwukolumnowego.
- **Regeneracja fixture'a parity to ręczny krok na obu końcach.** Pominięcie fazy 0 sprawia, że fazy 6
  nie da się zinterpretować.
- **EX-864 nie jest naprawiane**, a pozycja z mnożnikiem odziedziczy jego zachowanie. Jeśli faza 1
  pokaże, że zaokrąglenie psuje mnożnik bardziej niż „auto" — wracamy z tym do właściciela.
- **Migracja jest addytywna**, więc trafia na produkcję **przed** wdrożeniem kodu; uruchamia ją
  człowiek przez `pnpm db:migrate:prod`.

## Kryteria sukcesu

- Pozycja z „własnym mnożnikiem" przesuwa stawkę razem ze zmianą „Cena j.m."; kwota stała stoi.
- Przełączenie źródła tam i z powrotem nigdy nie zostawia martwej liczby pod spodem — ani w bazie,
  ani po odświeżeniu.
- Praca zapisana do cennika z mnożnikiem wraca do innej inwestycji jako mnożnik.
- Sufit i „Problemy" mówią o pozycji z mnożnikiem to samo co o pozycji z kwotą stałą.
- Mnożnika nie widać nigdzie na powierzchniach klienta ani inwestora.
