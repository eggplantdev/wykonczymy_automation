# „Pomiar z natury" z sumy etapów; „Pozostało" na Przedmiarze — Plan Brief

> Pełny plan: `context/changes/kosztorys-stages-source-of-truth/plan.md`
> Change: `context/changes/kosztorys-stages-source-of-truth/change.md`
> Rozstrzygnięcie: [EX-494](https://linear.app/ex-plant/issue/EX-494) · otwarte: [EX-495](https://linear.app/ex-plant/issue/EX-495)

## What & Why

Nasz edytor ma **trzy niezależne wejścia** tam, gdzie arkusz właściciela ma **dwa**. „Pomiar z natury"
jest u nas polem wpisywanym; w arkuszu to formuła `=SUM(D:M)` — suma etapów, zweryfikowana na 435 z 435
wierszy. Z tej jednej rozbieżności wynika reszta: wartość wiersza rozgałęzia się na pomiar-albo-etapy,
„Pozostało" nie ma sensownej kotwicy, a licznik grozi degeneracją do 100%.

Rolę planu — tego, wobec czego mierzymy postęp — pełni **Przedmiar**, nie pomiar.

## Starting Point

`rowValueForView` (`v2-rows.ts:346`) schodzi na etapy **tylko** gdy pomiar = 0; inaczej zwraca
`pomiar × cena − rabat`. Pozostałość po EX-489, który zobaczył wąski objaw (wiersz bez pomiaru
wyceniany na 0 przy naliczanych etapach → licznik 150%) i wyprowadził z szerokiego uzasadnienia wąską
regułę. Warstwy, które wtedy ustawił — `calc.ts` cenowa i ślepa na etapy, `v2-rows.ts` rozliczeniowa —
zostają i są tu pomocne.

Osobno: `rowPlannedNetForView` (`calc.ts:72`) **pomija rabat**, choć arkusz go stosuje (`S = N×Q − N×Q×R`).

## Desired End State

```
Przedmiar  (wpisywany)  → „Wartość netto przedmiar"  = Przedmiar × cena − rabat   [oferta]
etapy      (wpisywane)  → „Pomiar z natury"          = Σ etapów        (read-only)
                        → „Wartość netto"            = Σ etapów × cena − rabat     [wykonanie]
                        → „Pozostało do rozliczenia" = oferta − wykonanie
                        → licznik „Wykonano"         = wykonanie / oferta
```

Obie kwoty istnieją **równolegle**, jak `S456` i `T456` w stopce arkusza. „Pozostało" może być ujemne,
licznik może przekroczyć 100%.

## Key Decisions Made

| Decyzja                               | Wybór                                         | Dlaczego                                                                                                                | Źródło                                                                  |
| ------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| „Pomiar z natury"                     | **suma etapów, read-only**                    | W arkuszu to formuła, nie pole. Pomiar i etapy nie konkurują — to jedna liczba                                          | Właściciel 2026-07-16                                                   |
| Kotwica „Pozostało"                   | **Przedmiar**                                 | Kotwica w wykonaniu daje `x − x` = 0 — to jest skamielina `AF` z arkusza, martwa kolumna. Przedmiar ją ożywia           | Właściciel 2026-07-16                                                   |
| Mianownik licznika „Wykonano"         | **Przedmiar**                                 | Ta sama degeneracja; spójny z „Pozostało" — obie figury mierzą postęp wobec oferty                                      | Właściciel 2026-07-16                                                   |
| „Wartość netto przedmiar"             | **obejmuje rabat**, z tooltipem               | Parytet z `S` w arkuszu                                                                                                 | Właściciel 2026-07-16 — **z zastrzeżeniem: „może się jeszcze zmienić"** |
| Czerwień wiersza                      | **`Σ etapów > Przedmiar`**                    | Dzisiejszy próg (etapy vs pomiar) po zmianie porównuje liczbę z samą sobą — sygnał umarłby po cichu                     | Właściciel 2026-07-16                                                   |
| „Pozostało" jako kwota z minusem      | **zostaje na razie**                          | Alternatywa: sam procent. Nie blokuje, zmiana lokalna                                                                   | **ON HOLD → EX-495**                                                    |
| „Pozostało" bez Przedmiaru            | **„—"** (nie 0, nie minus)                    | Brak oferty = pytanie bezprzedmiotowe                                                                                   | Plan                                                                    |
| Kolumna „Rabat wart."                 | idzie za etapami                              | Inaczej pokazuje rabat naliczony od ilości, której nikt nie użył                                                        | Właściciel                                                              |
| Kształt `calc.ts`                     | prymityw `netForQtyForView`, ilość parametrem | Wszystkie figury to ta sama operacja z inną ilością; decyzja „która ilość jest prawdą" należy do warstwy znającej etapy | Plan                                                                    |
| `rowNetForView` / `rowDoneNetForView` | usunięte                                      | Po zmianie liczą to samo co `rowValueForView`; trzy nazwy na jedną figurę to dług                                       | Plan                                                                    |
| `measuredQty` w bazie                 | **zostaje**, przestaje być czytana            | Właściciel odpowiadał o kolumnie w siatce, nie o schemacie. Kasowanie = migracja prod przy wciąż otwartej decyzji #2    | Plan                                                                    |

## Scope

**In scope:** „Pomiar z natury" → read-only z sumy etapów · „Wartość netto"/„Brutto" wiersza · podsumy
sekcji (druga figura) · wartości etapów (`V–AE`) · „Rabat wart." · „Pozostało" (kotwica + „—") ·
licznik „Wykonano" i `%` sekcji · **rabat w „Wartość netto przedmiar" + tooltip** · próg czerwieni ·
docstringi + notatka domenowa `:227`.

**Out of scope:** globalny rabat (`kosztorys-global-discount`) · roadmap 12(b) „suma etapu" · migracja
kasująca `measuredQty` · błąd `Z8` w arkuszu (nie nasz plik).

## Architecture / Approach

Wyciągnąć z `calc.ts` jeden prymityw `netForQtyForView(row, qty, view)` = `applyDiscount(qty × cena)`
i przestawić wszystkie figury tak, żeby **ilość przychodziła z zewnątrz** zamiast być czytana z wiersza.
`calc.ts` przestaje mieć zdanie o tym, która ilość jest prawdą — decyzja przenosi się do `v2-rows.ts`,
jedynej warstwy znającej etapy. To zacieśnia granicę z EX-489, a nie rozmywa.

Prymityw zamyka rozbieżność rabatu **mimochodem**: `rowPlannedNetForView` przestaje mieć własną
arytmetykę, więc nie ma jak pominąć `applyDiscount`.

Rozdzielenie kotwic jest sednem: „Wartość netto" czyta `Σ etapów`, „Pozostało" i licznik czytają
`plannedQty`. Dwie figury, dwa źródła, jeden prymityw.

## Phases at a Glance

| Faza            | Co dowozi                                                                                    | Kluczowe ryzyko                                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. `calc.ts`    | Prymityw; ilość parametrem; rabat w figurze przedmiaru                                       | **Testy nie pękną same** — suita `:57-104` broni starego niezmiennika i przy `Σ etapów == measuredQty` przechodzi z obu reguł. Zostaje zielona i pilnuje nieaktualnej zasady |
| 2. `v2-rows.ts` | Pomiar = Σ etapów; „Pozostało" na Przedmiarze; `plannedNet` w podsumach; nowy próg czerwieni | Zmiana typu „Pozostało" na `number \| null` dotyka sortowania (`:126`)                                                                                                       |
| 3. UI           | „Pomiar z natury" read-only; tooltip o rabacie; „—"; licznik dzieli przez Przedmiar          | `formatPercentPrecise` nie może uciąć > 100%; ścieżka zapisu `measuredQty` musi ucichnąć                                                                                     |

**Prerequisites:** brak — zmiana czysto obliczeniowa, bez migracji i bez zależności od proda.
**Estimated effort:** ~1 sesja, 3 fazy. Typecheck jest **celowo czerwony** między fazą 1 a 3 (sygnatury
w `calc.ts` łamią wołających do czasu ich przestawienia) — to nie regres.

## Open Risks & Assumptions

- **Zielone testy na starej regule** — największe ryzyko całej zmiany. Fixture'y **muszą** mieć
  `Σ etapów ≠ plannedQty`, a jeden musi mieć `measuredQty` **sprzeczny** z sumą etapów — inaczej
  niezmiennik jest niefalsyfikowalny.
- **Decyzja #2 (rabat w przedmiarze) ma znak zapytania** od właściciela. Stąd osobny, jawny test —
  żeby cofnięcie było jednolinijkowe, a nie archeologią.
- **Kwoty zmienią się bez edycji** — każdy wiersz z `measuredQty ≠ Σ etapów` i każdy kosztorys
  z niezerowym rabatem pokaże po deployu inne liczby. To cel; właściciel ma wiedzieć, kiedy to wejdzie.
- **`measuredQty` zostaje jako martwa kolumna** — świadomy dług, do rozstrzygnięcia osobno.
- **Read-only „Pomiar z natury" to ryzyko browser-level** — unit go nie dosięgnie. E2E do autoryzacji
  przy bramce review albo do `e2e-backlog`.
- **Zakładam**, że `sectionDoneNetForView` / `kosztorysDoneNetForView` stają się martwe po fazie 3.
  Gate na `pnpm typecheck`, nie na grepie.

## Success Criteria (Summary)

- „Pomiar z natury" nie przyjmuje wpisu i zmienia się sam po edycji etapu
- Wiersz z etapami przekraczającymi Przedmiar: „Pozostało" ujemne, komórka czerwona, licznik > 100%
  (nieucięty) — a „Wartość netto przedmiar" stoi w miejscu
- Wiersz bez Przedmiaru: „Pozostało" = „—", brak czerwieni
- „Wartość netto przedmiar" przy rabacie 10% jest o 10% niższa niż `Przedmiar × cena`, a tooltip mówi dlaczego
- Suma kolumn wartości etapów = „Wartość netto" wiersza co do grosza, przy rabacie kwotowym
  i procentowym, na wszystkich trzech widokach ceny
