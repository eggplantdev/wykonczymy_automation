# Sufiks jednostki w komórce Pomiar — Implementation Plan

## Overview

Kolumna **Pomiar** (`measuredQty`) w siatce kosztorysu dostaje nieedytowalny sufiks z jednostką
miary (`11,0  m²`). Jednostka jest czytana z `rowData.unit` — tego samego pola, które napędza
kolumnę **J.m.**, i to ona pozostaje jedynym miejscem edycji.

Prototyp na jednej kolumnie. Cel: ocenić na żywo, czy wzorzec pomaga czy zaśmieca, zanim
rozleje się go na `plannedQty`, kolumny etapów i `discountValue`.

## Current State Analysis

Siatka to `react-datasheet-grid` (dsg), kolumny budowane w
`src/lib/tables/kosztorys-v2-columns.tsx`.

- `measuredQty` powstaje jako `keyCol('measuredQty', floatColumnLeft, …)`
  (`kosztorys-v2-columns.tsx:494`) — czyli `keyColumn(key, floatColumn)` z wyłączonym
  `alignRight` (`floatColumnLeft`, `:38`).
- `unit` ma własną kolumnę: `unitColumn` → `UnitCell`, creatable `Combobox` z `UNIT_SUGGESTIONS`
  (`kosztorys-v2-columns.tsx:206,219`; `src/lib/kosztorys/constants.ts:15`). Zostaje bez zmian.
- Wartość może być `null` — `KosztorysV2RowT.measuredQty` i `.unit` są nullowalne, komórki dsg
  są null-safe (`floatColumn` typuje `Column<number | null>`).

### Kluczowe ograniczenie: `keyColumn` zasłania resztę wiersza

`keyColumn(key, column)` podmienia `component` na własny `KeyComponent`, który przekazuje w dół
`rowData: rowData[key]` — samą liczbę, nie wiersz
(`node_modules/react-datasheet-grid/dist/columns/keyColumn.js`). To celowa optymalizacja dsg:
komórka nie re-renderuje się, gdy zmienia się inne pole wiersza.

Sufiks potrzebuje `rowData.unit` — innego pola tego samego wiersza — więc pod `keyColumn` jest
ono strukturalnie niewidoczne. Kolumna musi zostać złożona ręcznie.

**Świadomy koszt:** komórka Pomiar zaczyna re-renderować się przy każdej zmianie w swoim
wierszu, nie tylko przy zmianie `measuredQty`. To dokładnie ta optymalizacja, którą oddajemy —
i jest to oddanie zamierzone: sufiks z definicji zależy od dwóch pól.

## Desired End State

Komórka Pomiar renderuje liczbę (bez zmian w formatowaniu i edycji) oraz — przy prawej krawędzi
— wyszarzoną, nieklikalną jednostkę z tego wiersza. Kolumna J.m. działa jak dotąd; zmiana
jednostki tam natychmiast odbija się w sufiksie.

Weryfikacja: `pnpm typecheck` + `pnpm lint` przechodzą, a w przeglądarce kolumna Pomiar pokazuje
jednostkę, zachowując edycję, kopiowanie i wklejanie samych liczb.

### Key Discoveries:

- **`.dsg-cell` jest już flexem** — `display:flex; align-items:center`
  (`node_modules/react-datasheet-grid/dist/style.css:58`), a `.dsg-input` ma `flex:1;
min-width:0` (`:504`). Komponent kolumny renderuje się bezpośrednio jako dziecko `.dsg-cell`
  (`dist/components/Cell.js`). **Żaden wrapper nie jest potrzebny** — fragment z inputem i
  spanem jako rodzeństwem wystarczy, input sam się skurczy.
- **`keyColumn` daje za darmo cztery rzeczy, nie trzy** — `copyValue`, `pasteValue`,
  `deleteValue` **i `isCellEmpty`**. `floatColumn`/`createTextColumn` definiuje wszystkie na
  wartości (`dist/columns/textColumn.js`). Porzucając `keyColumn`, trzeba odtworzyć komplet.
- **`floatColumn` opiera się na `createTextColumn` z niekontrolowanym inputem**
  (`defaultValue` + `ref` + `useLayoutEffect` na `focus`). Podstawienie `rowData` = liczba,
  `setRowData` = zapis na pełny wiersz jest dokładnie tym, co robi `KeyComponent` — żadnych
  pułapek z formatowaniem czy focusem.
- **`.dsg-input-suffix` istnieje w stylach dsg, ale jest martwa** — zdefiniowana w
  `style.css:517`, nieużywana nigdzie w `dist`. Nie używamy jej: projekt styluje Tailwindem
  (`~/.claude/rules/styling.md`), a klasa niosłaby `opacity:.5` zamiast tokena motywu.
- **`floatColumnLeft` (`kosztorys-v2-columns.tsx:38`) zostaje** — to on wyłącza `alignRight`,
  jego `columnData` przekazujemy do komponentu bez zmian.

## What We're NOT Doing

- **Kolumna J.m.** — bez zmian. Zostaje źródłem prawdy i jedynym miejscem edycji jednostki.
  Sufiks jest echem, nie kontrolką.
- **`plannedQty`, kolumny etapów, `discountValue`** — bez zmian. To następna decyzja, nie ten
  change.
- **`src/lib/kosztorys/calc.ts`** — bez zmian. Sufiks jest czysto prezentacyjny; żadna wartość
  nie zmienia znaczenia, żadne obliczenie nie zmienia wyniku.
- **Testy automatyczne** — kryterium sukcesu jest wizualne („czy to pomaga czy zaśmieca"), a
  tego test nie rozstrzygnie. Jeśli wzorzec przejdzie i rozleje się na resztę kolumn, wtedy
  wraca pytanie o E2E.

## Implementation Approach

Złożyć kolumnę ręcznie zamiast przez `keyColumn`, odtwarzając to, co `keyColumn` robi wewnątrz,
ale z dostępem do pełnego wiersza. Parsowanie liczb reużyć w całości — renderować
`floatColumn.component` z podstawionymi propsami, nie przepisywać go.

## Phase 1: Komórka Pomiar z sufiksem j.m.

### Overview

Nowy komponent komórki + ręcznie złożona kolumna, podmieniona w `assembleV2Columns`.

### Changes Required:

#### 1. Komórka Pomiar

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Dodać komponent komórki, który renderuje input `floatColumn` obok wyszarzonego
sufiksu z `rowData.unit`. Umieścić go przy istniejących `UnitCell` / `DiscountTypeCell` — plik
już trzyma komórki, konwencja zostaje.

**Contract**: `CellProps<KosztorysV2RowT, unknown>` → fragment z dwoma dziećmi `.dsg-cell`:
komponent `floatColumnLeft` (z `rowData` = `measuredQty`, `setRowData` zapisującym z powrotem
na pełny wiersz, `columnData` = `floatColumnLeft.columnData`) oraz `<span>` z jednostką.

Sufiks renderuje się wtedy i tylko wtedy, gdy `rowData.unit` jest niepuste — **niezależnie od
tego, czy `measuredQty` ma wartość**. Pusty Pomiar z ustawioną jednostką nadal pokazuje sufiks:
podpowiada, w czym wpisać, zanim zaczniesz, i nie migocze przy pierwszej cyfrze.

Styl spana: wyszarzony tokenem motywu (`text-muted-foreground`), `pointer-events-none`, odstęp
od prawej krawędzi w rytmie `padding: 0 10px` inputu dsg. **Bez `shrink`** — sufiks trzyma
szerokość, kurczy się input (ma `min-width: 0`).

Snippet — bo podstawianie propsów pod `floatColumn.component` jest nieoczywiste i to ono jest
sednem tej zmiany:

```tsx
const FloatCell = floatColumnLeft.component!

function MeasuredQtyCell({ rowData, setRowData, ...rest }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <>
      <FloatCell
        {...rest}
        rowData={rowData.measuredQty}
        setRowData={(value) => setRowData({ ...rowData, measuredQty: value })}
        columnData={floatColumnLeft.columnData}
      />
      {rowData.unit ? <span className="…">{rowData.unit}</span> : null}
    </>
  )
}
```

#### 2. Kolumna Pomiar

**File**: `src/lib/tables/kosztorys-v2-columns.tsx`

**Intent**: Zastąpić `keyCol('measuredQty', floatColumnLeft, …)` (`:494`) ręcznie złożoną
kolumną używającą nowej komórki. Zachować `id: 'measuredQty'`, `title(...)` i `minWidth: 90` —
kolumna musi nadal odpowiadać column-pickerowi (`buildV2ToggleItems` czyta `col.id`),
sortowaniu i resize'owi (`withResize`).

**Contract**: `Column<KosztorysV2RowT>` z `component: MeasuredQtyCell` oraz **czterema**
odtworzonymi funkcjami, wszystkie operujące na **samej liczbie, bez sufiksu** — skopiowanie
„11 m²" do arkusza byłoby regresją:

- `copyValue` → `measuredQty` (nie sformatowana liczba z jednostką)
- `pasteValue` → parsuje wklejony tekst na `measuredQty`, reszta wiersza bez zmian
- `deleteValue` → `measuredQty: null`, `unit` **nietknięty** (Delete na Pomiarze nie może
  kasować jednostki — to pole innej kolumny)
- `isCellEmpty` → `measuredQty == null` (`keyColumn` mapował je na wartość; bez tego dsg
  błędnie oceni pustość komórki przy zaznaczaniu i wklejaniu zakresów)

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm lint`

#### Manual Verification:

- Kolumna Pomiar pokazuje jednostkę z wiersza (`11,0  m²`), wyszarzoną, przy prawej krawędzi
- Zmiana jednostki w kolumnie J.m. natychmiast odbija się w sufiksie tego samego wiersza
- Edycja liczby działa jak dotąd: focus zaznacza tekst, przecinek dziesiętny parsuje się, blur
  formatuje
- Sufiks jest nieklikalny — klik w niego wchodzi w edycję komórki, nie zjada zdarzenia
- Kopiowanie komórki i wklejenie do arkusza daje samą liczbę, bez „m²"
- Delete na komórce Pomiar czyści liczbę, ale **nie** jednostkę
- Wiersz z pustym Pomiarem i ustawioną jednostką pokazuje sam sufiks
- Wiersz bez jednostki nie pokazuje nic dodatkowego
- Przy `minWidth: 90` i szerokiej liczbie input nie jest ścinany do nieczytelności

**Implementation Note**: Po przejściu weryfikacji automatycznej zatrzymaj się i poczekaj na
ręczne potwierdzenie od człowieka — kryterium sukcesu tego change'u jest z definicji wizualne.

## Testing Strategy

Bez testów automatycznych — patrz „What We're NOT Doing". Zmiana jest czysto prezentacyjna, w
jednym pliku, a jej kryterium sukcesu („czy sufiks pomaga czy zaśmieca") jest oceną wizualną,
której test nie rozstrzygnie. Regresje, które test MÓGŁBY złapać (kontrakt copy/paste/delete),
są tańsze do sprawdzenia ręcznie na tym etapie i i tak wymagają oka przy siatce.

Jeśli prototyp przejdzie i wzorzec rozleje się na `plannedQty`, etapy i `discountValue` — wtedy
wraca pytanie o E2E na kontrakcie kopiowania, bo powtórzony wzorzec w 4 kolumnach to już realna
powierzchnia regresji.

### Manual Testing Steps:

1. Odpal dev, otwórz edytor kosztorysu na zainwestowanej inwestycji z danymi
   (`INV=6 node --env-file=.env --import tsx src/scripts/seed-kosztorys.ts`, jeśli trzeba
   zasiać).
2. Przejdź listę z `#### Manual Verification:` wyżej.
3. Zwróć uwagę na wiersze z długimi liczbami i na świeżo wstawiony pusty wiersz.

## Performance Considerations

Komórka Pomiar traci optymalizację `keyColumn` (re-render tylko przy zmianie własnego pola) i
re-renderuje się przy każdej zmianie w swoim wierszu. Świadome — sufiks zależy od dwóch pól,
więc to nie jest do obejścia bez zduplikowania `unit` w wartości komórki.

Skala: kosztorys potrafi mieć 1000+ pozycji
(`context/foundation/lessons.md`, pamięć projektu), ale dsg wirtualizuje wiersze — renderują
się tylko widoczne. Re-render dotyczy jednego wiersza na raz podczas edycji. Jeśli mimo to coś
zwolni — to sygnał, i wraca w ocenie prototypu.

## Migration Notes

Brak. Zero zmian w schemacie, zero migracji, zero dotknięcia danych.

## References

- Design (frame + grounding): `context/changes/kosztorys-qty-unit-suffix/design.md`
- Kolumny siatki: `src/lib/tables/kosztorys-v2-columns.tsx:494` (`measuredQty`),
  `:206,219` (`UnitCell` / `unitColumn`), `:38` (`floatColumnLeft`)
- Wzorzec ręcznie złożonej kolumny z pełnym wierszem: `subcontractorPriceColumn`
  (`kosztorys-v2-columns.tsx:304`) — ta sama technika, tyle że bez reużycia `floatColumn`
- Prior art: `context/changes/kosztorys-unit-select/`
- dsg internals: `node_modules/react-datasheet-grid/dist/columns/keyColumn.js`,
  `dist/columns/textColumn.js`, `dist/style.css:58,504`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not
> rename step titles. See `references/progress-format.md`.

### Phase 1: Komórka Pomiar z sufiksem j.m.

> **Zaparkowana 2026-07-15 — nic nie wylądowało.** Faza była zaimplementowana, `pnpm typecheck`
> i `pnpm lint` przeszły, ale kod cofnięto przed obejrzeniem go na żywo. Boxy zostają puste, bo
> nie stoi za nimi żaden commit. Kontekst i mechanika: `change.md`.

#### Automated

- [ ] 1.1 Type checking passes: `pnpm typecheck`
- [ ] 1.2 Linting passes: `pnpm lint`
