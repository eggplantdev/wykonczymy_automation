# Design — sufiks jednostki w komórce Pomiar (prototyp)

Data: 2026-07-15
Status: approved, not implemented

## Problem

W siatce kosztorysu jednostka miary (`unit`) mieszka we własnej kolumnie **J.m.**, a ilości
(`plannedQty`, `measuredQty`, kolumny etapów) renderują się jako gołe liczby. Czytając wiersz
trzeba przeskoczyć wzrokiem kilka kolumn w bok, żeby dowiedzieć się, czy „11,0" to metry
kwadratowe czy sztuki. Ta sama luka dotyczy rabatu: `discountValue` nie pokazuje, czy to
procenty czy złote — typ siedzi w osobnej kolumnie **Rabat**.

Dane już istnieją. Brakuje ich zestawienia w jednej komórce.

## Zakres

Prototyp na **jednej** kolumnie: `measuredQty` (Pomiar) → sufiks `unit`.

Wybrana świadomie, bo to kolumna napędzająca wszystkie obliczenia (`Netto = Pomiar × Cena −
Rabat`), więc najczęściej oglądana — najszybciej da sygnał, czy wzorzec pomaga, czy zaśmieca.

Rozlanie wzorca na `plannedQty`, kolumny etapów i `discountValue` to osobna decyzja, podjęta
dopiero po obejrzeniu prototypu na żywo.

## Decyzja: echo, nie zastąpienie

Kolumna **J.m.** zostaje i pozostaje jedynym miejscem edycji jednostki. Sufiks w komórce Pomiar
jest **nieedytowalnym echem** — czysto prezentacyjnym.

Rozważane i odrzucone:

- _Zastąpić kolumnę sufiksem_ (edycja przez kliknięcie sufiksu) — węższa siatka, ale traci
  kolumnę do sortowania i masowej edycji, i wymaga nowego wzorca interakcji przed sprawdzeniem,
  czy sam sufiks w ogóle się broni.
- _Zastąpić, ale zostawić kolumnę w column-pickerze_ — to samo ryzyko, tylko odroczone.

Koszt echa: ta sama informacja w dwóch miejscach. Akceptowalny na etapie prototypu — jest
odwracalny w jedną stronę (usunięcie kolumny), a nie w drugą.

## Implementacja

### Dlaczego `keyColumn` musi zniknąć z tej kolumny

Dziś: `keyCol('measuredQty', floatColumnLeft, …)` w `src/lib/tables/kosztorys-v2-columns.tsx`.

`keyColumn(key, column)` zawęża `rowData` przekazywany do komórki z całego wiersza do wartości
jednego pola. Sufiks potrzebuje `rowData.unit` — innego pola tego samego wiersza — więc pod
`keyColumn` jest ono niewidoczne.

Kolumna składana jest zatem ręcznie: komórka dostaje pełny `KosztorysV2RowT` i sama podstawia
wartość do komponentu `floatColumn`. To nie obejście — to dokładnie to, co `keyColumn` robi
wewnątrz, tyle że z dostępem do reszty wiersza.

### Komórka

Nowy komponent w `kosztorys-v2-columns.tsx`, obok istniejących `UnitCell` / `DiscountTypeCell`
(plik już trzyma komórki — konwencja zostaje).

```
┌──────────────────────────┐
│ 11,0                  m² │
└──────────────────────────┘
  ^ input floatColumn        ^ sufiks przy prawej krawędzi
    (flex-1, min-w-0)
```

- Sufiks: `text-muted-foreground`, `pointer-events-none`, `pr-2`, wyrównany do prawej krawędzi.
- `unit` puste → sufiks się nie renderuje. Nie „—": to kolumna liczbowa, nie pole ze stanem
  „brak".
- Sufiks zostaje widoczny podczas edycji — to dokładnie ten moment, w którym jednostka jest
  potrzebna.

### Reużycie `floatColumn`

Parsowanie liczb nie jest przepisywane. Komórka renderuje `floatColumn.component` z
podstawionymi `rowData` (liczba), `setRowData` (zapis z powrotem na pełny wiersz) i
`columnData` (`floatColumnLeft.columnData`). Przecinek dziesiętny, formatowanie i zachowanie
przy focusie zostają bez zmian.

### Kontrakt kolumny

`copyValue` / `pasteValue` / `deleteValue` — przepisane ręcznie, bo `keyColumn` dawał je za
darmo. Operują na **samej liczbie, bez sufiksu**: skopiowanie „11 m²" do arkusza byłoby
regresją.

## Poza zakresem

- Kolumna J.m. — bez zmian.
- `plannedQty`, kolumny etapów, `discountValue` — bez zmian.
- `src/lib/kosztorys/calc.ts` — bez zmian. Sufiks jest prezentacyjny; żadna wartość nie zmienia
  znaczenia, żadne obliczenie nie zmienia wyniku.

## Ryzyko

Szerokość. `minWidth: 90` przy sufiksie i szerokiej liczbie może ścisnąć input. Reakcja
(podniesienie `minWidth`) dopiero po obejrzeniu na żywo — nie zgadujemy przed prototypem.

## Kryterium sukcesu

Wiersz da się przeczytać bez skakania wzrokiem do kolumny J.m., a siatka nie robi się ciaśniejsza
ani wolniejsza. Ocena wizualna na żywo, nie automatyczna — stąd prototyp na jednej kolumnie.
