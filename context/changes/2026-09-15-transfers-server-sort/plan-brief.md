# Sortowanie tabeli transakcji na serwerze — brief

> Pełny plan: `context/changes/2026-09-15-transfers-server-sort/plan.md`
> Notatka zakresowa: `context/changes/2026-09-15-transfers-server-sort/change.md`

## Co i po co

Klik w nagłówek tabeli transakcji sortuje dziś wyłącznie sto wierszy pobranych na bieżącą stronę,
a przycisk „Drukuj" sortuje cały przefiltrowany zbiór. Przy inwestycji z więcej niż jedną stroną
wyników **wydruk wychodzi w innej kolejności niż ekran, z którego został zamówiony** — czytelnik
papieru widzi „dziesięć największych kwot", a osoba przy ekranie „dziesięć największych na tej
stronie". Slice przenosi sortowanie do bazy i sprawia, że obie drogi korzystają z tej samej.

## Punkt wyjścia

`DataTable` trzyma sortowanie w lokalnym stanie i przepuszcza wiersze przez `getSortedRowModel()` —
nie ma `manualSorting`, więc sortowanie nigdy nie opuszcza przeglądarki. `findTransfersRaw` **już**
przyjmuje parametr `sort` i ma go w kluczu cache'a; nikt go nie podaje. Wydruk dociąga pełny zbiór
i przesortowuje go u siebie przez `sortTransferRows`.

## Stan docelowy

Klik w nagłówek zapisuje `?sort=` w URL-u, wraca pierwsza strona kolejności policzonej na całym
przefiltrowanym zbiorze, trzeci klik zdejmuje sortowanie. Wydruk pobiera dane już posortowane przez
bazę — w repo nie ma drugiego miejsca sortującego transakcje. Siedem kolumn, których wartość leży
w innej tabeli, nie ma klikalnego nagłówka i zawęża się je filtrami; każda taka kolumna filtr ma.

## Podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
| --- | --- | --- | --- |
| Kolumny relacyjne | Sortowanie wyłączone | Sortowanie po nazwie z innej tabeli wymaga przepisania listy na SQL z JOIN-ami — odrzucone | change.md |
| Kolejność na wydruku | Ustala serwer | Dwie instancje sortujące to ten sam defekt, tylko węższy (kolacja `pl` vs Postgres na `description`) | Plan |
| Zasięg | Wszystkie cztery hosty | Ta sama tabela musi znaczyć to samo na każdej stronie | Plan |
| Trzeci klik | Wraca do domyślnej kolejności | Zachowanie nagłówka nie zmienia się względem dzisiejszego; jest droga powrotna | Plan |
| Filtr „Pracownik" | Multi-select, `equals` → `in` | Jedyna z siedmiu kolumn bez filtra; reszta filtrów jest multi | Plan |
| Etykieta „Kasa źródłowa" | Na „Kasa" | Filtr zawęża źródłową **lub** docelową — po zabraniu sortowania to jedyna droga do „Kasa docelowa" | Plan |
| Domyślna kolejność | Jedna stała `-id` dla listy i eksportu | Inaczej rozjazd zostaje dla stanu domyślnego, czyli najczęstszego | Plan |
| E2E | Do backlogu (`e2e-backlog`) | Przechwycenie okna wydruku jest drogie; ryzyko kolejności pokryte integracyjnie | Właściciel |

## Zakres

**W zakresie:** parametr `?sort=` z białą listą ośmiu kolumn; opt-in na sterowane sortowanie w
`DataTable`; wyłączenie sortowania w siedmiu kolumnach relacyjnych; wydruk pobierający dane
posortowane przez bazę; usunięcie `sortTransferRows`; filtr „Pracownik"; etykieta „Kasa".

**Poza zakresem:** przepisanie listy transakcji na surowy SQL z JOIN-ami; sortowanie w pozostałych
tabelach na `DataTable`; osobny filtr „Kasa docelowa"; spec E2E; indeksy pod sortowanie.

## Podejście

Jedna instancja sortuje — baza. Prowadzi do niej jeden kanał: `?sort=` przepuszczony przez białą
listę, ten sam dla listy na ekranie i dla zbioru pod wydruk. Kolumny, których baza nie umie
posortować, przestają udawać, że umieją.

```
nagłówek → ?sort= → parseTransferSort (biała lista) → findTransfersRaw → strona
                 ↘ fetchFilteredTransfers → findAllTransfersForExport → wydruk
```

## Fazy

| Faza | Co dowozi | Główne ryzyko |
| --- | --- | --- |
| 1. Sort serwerowy | `?sort=` działa end-to-end; siedem kolumn traci nagłówek | Zmiana kontraktu `DataTable` dotyka siedmiu innych tabel — musi być opt-in |
| 2. Wydruk na tym samym kluczu | Wydruk sortuje baza; `sortTransferRows` usunięty | Ścieżka eksportu obsługuje też ZIP z fakturami |
| 3. Filtr „Pracownik" + etykieta | Jedyna kolumna bez filtra go dostaje | `equals` → `in` nie może zepsuć linku `?worker=3` z karty inwestycji |

**Warunki wstępne:** brak — żadnej migracji, żadnej zmiany schematu.
**Szacowany rozmiar:** jedna sesja, trzy commity.

## Ryzyka i założenia

- Domyślna kolejność **wydruku** zmienia się z `-date` na `-id` — widoczne tylko tam, gdzie
  transakcje wpisywano wstecznie. Świadomy koszt ujednolicenia jednej domyślnej kolejności.
- `description` sortuje się kolacją Postgresa, nie polską — ogonki mogą wypaść inaczej niż dotąd na
  wydruku. Za to ekran i wydruk zgadzają się co do joty.
- Każdy klik w nagłówek to round trip. Amortyzuje go cache z `sort` w kluczu, `scroll: false`
  i `useTransition`.

## Kryteria sukcesu

- Na `/inwestycje/26` sortowanie po kwocie wyrzuca na górę największe kwoty **z całej inwestycji**,
  nie z pierwszej setki wierszy
- Wydruk zamówiony z posortowanego widoku ma tę samą kolejność co ekran
- Żadna kolumna nie pozwala kliknąć w nagłówek bez pokrycia w bazie, i każda taka kolumna ma filtr
