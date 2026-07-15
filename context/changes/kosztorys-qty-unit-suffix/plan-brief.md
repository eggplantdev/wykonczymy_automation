# Sufiks jednostki w komórce Pomiar — Plan Brief

> Full plan: `context/changes/kosztorys-qty-unit-suffix/plan.md`
> Design (frame + grounding): `context/changes/kosztorys-qty-unit-suffix/design.md`

## What & Why

W siatce kosztorysu jednostka miary mieszka we własnej kolumnie **J.m.**, a ilości renderują się
jako gołe liczby. Czytając wiersz trzeba przeskoczyć wzrokiem kilka kolumn w bok, żeby dowiedzieć
się, czy „11,0" to metry kwadratowe czy sztuki. Dane już są — brakuje ich zestawienia w jednej
komórce.

## Starting Point

Kolumna **Pomiar** to `keyCol('measuredQty', floatColumnLeft, …)`
(`src/lib/tables/kosztorys-v2-columns.tsx:494`) — liczba bez sufiksu. `unit` ma osobną kolumnę z
creatable comboboxem (`:219`). Siatka to `react-datasheet-grid`.

## Desired End State

Komórka Pomiar pokazuje `11,0  m²` — liczbę bez zmian w edycji i formatowaniu, obok wyszarzonej,
nieklikalnej jednostki z tego wiersza. Kolumna J.m. działa jak dotąd i pozostaje jedynym miejscem
edycji jednostki; zmiana tam natychmiast odbija się w sufiksie.

## Key Decisions Made

| Decision            | Choice                                        | Why (1 sentence)                                                                                                  | Source |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| Kolumna J.m.        | Zostaje; sufiks to nieedytowalne echo         | Usunięcie kolumny jest odwracalne w jedną stronę — najpierw sprawdzamy, czy sam sufiks się broni.                 | Design |
| Zakres              | Tylko `measuredQty`                           | Napędza wszystkie obliczenia, więc najczęściej oglądana — najszybciej da sygnał, czy wzorzec pomaga czy zaśmieca. | Design |
| `keyColumn`         | Porzucony na tej jednej kolumnie              | Zawęża `rowData` do jednego pola, więc `unit` jest pod nim strukturalnie niewidoczne.                             | Design |
| Parsowanie liczb    | Reużyć `floatColumn.component`, nie przepisać | Zachowuje przecinek dziesiętny, formatowanie i zachowanie przy focusie bez kopiowania kodu dsg.                   | Design |
| Wrapper layoutu     | Żaden — fragment wystarczy                    | `.dsg-cell` jest już flexem, `.dsg-input` ma `flex:1; min-width:0` — input sam się skurczy obok spana.            | Plan   |
| Pusty Pomiar + unit | Sufiks zostaje widoczny                       | Podpowiada, w czym wpisać, zanim zaczniesz, i nie migocze przy pierwszej cyfrze.                                  | Plan   |
| Testy automatyczne  | Brak                                          | Kryterium sukcesu jest wizualne; wraca przy rozlaniu wzorca na 4 kolumny.                                         | Plan   |

## Scope

**In scope:**

- Komponent komórki Pomiar renderujący `floatColumn.component` + sufiks `unit`
- Ręcznie złożona kolumna `measuredQty` z odtworzonym kontraktem (`copyValue` / `pasteValue` /
  `deleteValue` / `isCellEmpty`)

**Out of scope:**

- Kolumna J.m. — bez zmian
- `plannedQty`, kolumny etapów, `discountValue` (`10 %` / `250 zł`) — następna decyzja
- `src/lib/kosztorys/calc.ts` — sufiks jest prezentacyjny, żaden wynik się nie zmienia
- Testy automatyczne, migracje, zmiany schematu

## Architecture / Approach

Odtworzyć to, co `keyColumn` robi wewnątrz, ale z dostępem do pełnego wiersza:

```
.dsg-cell (flex, już istnieje)
├── <FloatCell>            ← floatColumn.component z podstawionym
│                            rowData=measuredQty, setRowData→pełny wiersz
│                            (flex:1, min-width:0 — kurczy się)
└── <span>m²</span>        ← rowData.unit, wyszarzony, pointer-events-none
```

Kolumna zachowuje `id: 'measuredQty'`, więc column-picker, sortowanie i resize działają bez
zmian.

## Phases at a Glance

| Phase                             | What it delivers                                | Key risk                                                           |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------ |
| 1. Komórka Pomiar z sufiksem j.m. | Działający sufiks + odtworzony kontrakt kolumny | Cicha regresja w copy/paste/delete — `keyColumn` dawał je za darmo |

**Prerequisites:** działający dev + kosztorys z danymi (`INV=6 … seed-kosztorys.ts`)
**Estimated effort:** jedna sesja, jeden plik, ~40 linii

## Open Risks & Assumptions

- **Kontrakt kolumny to największe ryzyko.** `keyColumn` dawał `copyValue`, `pasteValue`,
  `deleteValue` **i `isCellEmpty`** za darmo. Pominięcie któregokolwiek nie wywali typechecka —
  zepsuje kopiowanie do arkusza albo Delete po cichu. Stąd każde z nich jest osobnym punktem
  weryfikacji ręcznej.
- **Szerokość.** `minWidth: 90` przy sufiksie i szerokiej liczbie może ścisnąć input. Reakcja
  dopiero po obejrzeniu — nie zgadujemy.
- **Wydajność.** Komórka traci optymalizację re-renderu z `keyColumn`. Świadome i nie do
  obejścia bez duplikowania `unit`; dsg wirtualizuje wiersze, więc przy 1000+ pozycji dotyczy to
  tylko widocznych.

## Success Criteria (Summary)

- Wiersz da się przeczytać bez skakania wzrokiem do kolumny J.m.
- Edycja, kopiowanie i wklejanie liczb działają dokładnie jak przed zmianą — sufiks nigdzie nie
  wycieka do danych
- Siatka nie robi się ciaśniejsza ani wolniejsza
