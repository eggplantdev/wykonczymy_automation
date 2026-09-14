# Wysokość wiersza — z niewidocznego dwukliku do menu wiersza

## Overview

Dwuklik na uchwycie wiersza („dopasuj do treści") znika. Jego komenda i nowa komenda odwrotna
(„przywróć domyślną wysokość") lądują w menu ⋯ pozycji, gdzie widać, że istnieją.

## Current State Analysis

- `ui/datasheet-grid/row-resize-handle.tsx` — pasek 8 px w rynience. `onPointerUp` commituje tylko
  przy `moved !== 0`, wprost po to, żeby dwa kliknięcia dwukliku nie przypięły wysokości przed
  dopasowaniem. `title` rozróżnia wiersz od nagłówka **przez obecność `onFit`** — nagłówek jest
  jedynym uchwytem bez dopasowania.
- `grid/ordinal-gutter-column.tsx` — `RowResizeApiT = { onGuide, onCommit, onFit }`; uchwyt dostaje
  każdy wiersz poza `SPACER_ROW_ID` / `TOTALS_ROW_ID`, w tym paski sekcji i wiersz nagłówka.
- `kosztorys-editor-body.tsx:257` — `contentLinesFor(row)` = `rowContentLines(row, wrap.widths, …)`;
  `wrap` pochodzi z `useWrapColumnWidths(gridNode, columnIds)`, czyli **mierzy wyrenderowany DOM
  gridu**. Nie da się go policzyć w `use-kosztorys-editor.ts`, który buduje kolumny przed renderem.
- `kosztorys-editor-body.tsx:294` — `rowResize.onFit` = `setRowHeight(id, max(resting, heightForLines(lines)))`.
- `lib/kosztorys/row-height.ts` — `resolveRowHeight` stawia nadpisanie ponad wszystkim: paskiem
  sekcji, treścią i przełącznikiem „Dopasuj wysokość wierszy". **Nic tego wpisu nie kasuje** poza
  `dropHeight` wołanym przy usunięciu pozycji.
- `hooks/use-row-heights.ts` — `{ heights, setHeight, dropHeight }` nad `createJsonMapStore`;
  `setHeight` / `dropHeight` są stabilnymi funkcjami modułu, nie closure'ami.
- `grid/menus/kosztorys-row-actions-menu.tsx` — po `kosztorys-section-menu-split` niesie już tylko
  grupę „Praca", bez separatora. `DropdownMenuContent` montuje się dopiero przy otwarciu.
- `actions/catalogue-picker-host.tsx` — precedens: komenda menu, której zaplecze nie może dojechać
  na `columnData`, jedzie kontekstem czytanym z komórki.

## Desired End State

Uchwyt wiersza wyłącznie przeciąga. Menu ⋯ pozycji niesie na dole, za separatorem:

- **„Dopasuj wysokość do treści"** — zawsze; to, co robił dwuklik.
  Komenda odwrotna (kasująca nadpisanie) była w planie i została zaimplementowana, po czym **wypadła
  na decyzję właściciela** — patrz `change.md` pkt 3. Nadpisania nadal nie da się zdjąć z UI.

### Key Discoveries

- Pomiar musi zostać w ciele edytora (mierzy DOM), a komenda jest w komórce — stąd kontekst, jak przy
  `CataloguePickerHost`. Konsumentem jest wyłącznie **otwarte** menu, więc zmiana identyczności
  wartości nie przerysowuje gridu; to NIE jest churn z EX-496.
- Po wyjęciu `onFit` `title` uchwytu nie ma już czym rozróżnić wiersza od nagłówka → `title` staje
  się propem wołającego.

## What We're NOT Doing

- **Nie ruszamy przełącznika „Dopasuj wysokość wierszy"** ani `resolveRowHeight` — nadpisanie dalej
  wygrywa z treścią — i dalej nie ma z UI drogi, żeby je zdjąć (patrz change.md pkt 3).
- **Nie dodajemy komend wysokości do menu sekcji ani nagłówka tabeli.** Pasek sekcji i wiersz
  nagłówka (klucz `header`) też mają uchwyt i też mogą zostać z nieodwracalnym nadpisaniem — do
  zgłoszenia po fazie 3, nie do dorzucenia po cichu. Zgłoszone: **EX-776**.
- Nie piszemy specu E2E.

## Implementation Approach

Najpierw wyjąć pomiar do `lib/kosztorys/row-height.ts` (faza 1) — wtedy komenda menu i dawny dwuklik
liczą jedną funkcją, nie dwoma kopiami `Math.max(...)`. Potem podłączyć menu (faza 2) i dopiero na
końcu skasować dwuklik (faza 3), żeby nie było commita, w którym dopasowania nie ma nigdzie.

## Phase 1: Pomiar jako funkcja biblioteki

### Changes Required

#### 1. `fitRowHeight`

**File**: `src/lib/kosztorys/row-height.ts`

**Intent**: `Math.max(restingRowHeight(id), heightForLines(lines))` z ciała edytora dostaje nazwę i
dom obok `resolveRowHeight` — będzie miała dwóch wołających.

**Contract**: `fitRowHeight(rowId: number, contentLines: number): number`. Podłoga to wysokość
spoczynkowa **tego** wiersza, więc pasek sekcji nie da się dopasować poniżej 52 px.

#### 2. Wołający

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Contract**: `rowResize.onFit` woła `fitRowHeight(row.id, contentLinesFor(row))`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-height.test.ts` — nowe przypadki: podłoga
  pozycji (32), podłoga paska sekcji (52), wzrost z liczby linii.

## Phase 2: Komendy w menu wiersza

### Changes Required

#### 1. Kontekst dopasowania

**File**: `src/components/kosztorys/editor/actions/row-height-fit-context.tsx` (nowy — plan mówił
`grid/`, bramka przeniosła do `actions/`, gdzie mieszkają obie istniejące pary provider+hook)

**Intent**: Jedna funkcja z ciała edytora (`(row) => void`) osiągalna z komórki. Wzorzec i
uzasadnienie jak `CataloguePickerHost`.

**Contract**: `RowHeightFitProvider` + `useRowHeightFit()`; hook zwraca `null` poza providerem
(widok klienta), a nie rzuca — kolumny „Akcje" tam nie ma, ale nie chcę tego zależnego wywracania.

#### 2. Pozycje menu

**File**: `src/components/kosztorys/editor/grid/menus/row-height-menu-items.tsx` (nowy)

**Intent**: Osobny plik, bo to jedyny fragment menu czytający store wysokości — subskrypcja ma żyć
tylko gdy menu jest otwarte.

**Contract**: `RowHeightMenuItems({ row })` — cały wiersz, nie samo id: pomiar czyta jego treść.
Renderuje separator + „Dopasuj wysokość do treści". Zwraca `null`, gdy kontekst dopasowania jest
pusty.

#### 3. Menu wiersza

**Files**: `src/components/kosztorys/editor/grid/menus/kosztorys-row-actions-menu.tsx`,
`src/components/kosztorys/editor/grid/row-actions-column.tsx`

**Contract**: Menu renderuje `<RowHeightMenuItems row={…} />` przed „Usuń pozycję" (destrukcyjna
zostaje ostatnia). Nowy prop `row: KosztorysV2RowT` — `RowActionsCell` ma `rowData`.

#### 4. Provider w ciele edytora

**File**: `src/components/kosztorys/editor/kosztorys-editor-body.tsx`

**Contract**: `RowHeightFitProvider` opakowuje ciało edytora, wartość = `fitRowToContent`
(`undefined` w podglądzie klienta). `onFit` wychodzi przy okazji z `RowResizeApiT` — po fazie 3 nie
ma tam już konsumenta, a typ jest kontraktem rynienki.

### Success Criteria

#### Automated Verification

- `pnpm typecheck`

#### Manual Verification

- Menu ⋯ pozycji: „Dopasuj wysokość do treści" rozwija wiersz dokładnie tak jak dwuklik
- Dopasowanie przeżywa przeładowanie (wpis siedzi w `kosztorys-v2-row-heights`)

## Phase 3: Dwuklik wypada

### Changes Required

#### 1. Uchwyt

**File**: `src/components/ui/datasheet-grid/row-resize-handle.tsx`

**Intent**: `onFit`, `onDoubleClick` i ternary w `title` znikają; `title` przychodzi z zewnątrz.
Ostrożność w `onPointerUp` (`moved !== 0`) **zostaje** — chroni też przed przypięciem wysokości
zwykłym kliknięciem w uchwyt.

**Contract**: `PropsT` bez `onFit`, z wymaganym `title: string`.

#### 2. Kolumna rynienki

**File**: `src/components/kosztorys/editor/grid/ordinal-gutter-column.tsx`

**Contract**: `RowResizeApiT` bez `onFit`; oba wywołania `RowResizeHandle` podają własny `title`.

### Success Criteria

#### Automated Verification

- `pnpm typecheck`
- `pnpm lint`

#### Manual Verification

- Dwuklik na uchwycie nie zmienia wysokości i nie zapisuje nic do localStorage
- Przeciąganie i prowadnica działają jak dotąd, uchwyt nagłówka też
- Tooltip uchwytu wiersza nie obiecuje już dwukliku

## Progress

#### Automated

- [x] Phase 1 — `row-height.test.ts` (16 passed, 3 nowe przypadki `fitRowHeight`)
- [x] Phase 2 — `pnpm typecheck`
- [x] Phase 3 — `pnpm typecheck` + `pnpm lint` (0 errors) + `vitest src/__tests__/components/kosztorys` (202 passed)
