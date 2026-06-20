# Eksport kosztorysu do CSV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać do edytora kosztorysu v2 eksport bieżącego widocznego stanu do CSV w dwóch wariantach (płaski + grupowany) do bake-offu, ładnie ładujących się w Google Sheets.

**Architecture:** Wspólny rdzeń — rejestr kolumn eksportu (id↔label z `v2ToggleableColumns`, getValue per id) + snapshot (viewRows, widoczne kolumny, widok ceny). Na nim dwa czyste buildery CSV i przycisk w pasku edytora. Reuse `escapeCsv`/`triggerDownload`/`formatPLN`.

**Tech Stack:** React 19.2, Next 16.1, TypeScript, shadcn/ui.

## Global Constraints

- Polish UI, English code. TS: `type` nie `interface`, sufiks `T`, brak `any`/`enum`, `undefined` nie `null`, brak `readonly` na propsach, alias `@/*`.
- **POC — BEZ TESTÓW.** POC może pójść do piachu; testy dochodzą na MVP. Bramka jakości: `pnpm typecheck` + `pnpm exec next build` + weryfikacja w przeglądarce. Plan nie ma kroków testowych.
- Kolumny eksportu = **dokładnie kolumny przełącznika** (`v2ToggleableColumns(stages)`) — ten sam zestaw id/label/kolejność. Snapshot WYSIWYG: widoczne kolumny minus `hidden`.
- Kwoty przez `formatPLN` (parytet z eksportem transferów/wydatków). Ilości jako `String(n)`.
- CSV: BOM `﻿` + `text/csv;charset=utf-8` (Sheets/Excel UTF-8).
- Nie ruszać logiki siatki/autosave w edytorze — tylko dołożyć przycisk i listę widocznych id.

---

### Task 1: Wspólny `escapeCsv` (refactor)

**Files:**

- Create: `src/lib/export/csv-cell.ts`
- Modify: `src/lib/export/csv.ts` (usuń lokalny `escapeCsv`, importuj wspólny)

**Interfaces:**

- Produces: `export function escapeCsv(value: string): string`

- [ ] **Step 1: Utwórz `src/lib/export/csv-cell.ts`**

```ts
/** Cytuje komórkę CSV gdy zawiera przecinek, cudzysłów lub nową linię (RFC 4180). */
export function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
```

- [ ] **Step 2: Przełącz `csv.ts` na wspólny helper**

W `src/lib/export/csv.ts` usuń lokalną funkcję `escapeCsv` (linie 4–9) i dodaj import na górze:

```ts
import { escapeCsv } from '@/lib/export/csv-cell'
```

Reszta pliku (`buildTransferCsv`) bez zmian — używa `escapeCsv` jak dotąd.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: brak błędów.

```bash
git add src/lib/export/csv-cell.ts src/lib/export/csv.ts
git commit -m "refactor(export): wyciągnij escapeCsv do wspólnego csv-cell.ts"
```

---

### Task 2: Rejestr kolumn eksportu kosztorysu

**Files:**

- Create: `src/lib/export/kosztorys-export-columns.ts`

**Interfaces:**

- Consumes: `v2ToggleableColumns(stages)` z `@/lib/tables/kosztorys-v2-columns`; `viewPrice`/`rowNetForView`/`rowRemainingForView`/`effectiveVat`/`type PriceViewT` z `@/lib/kosztorys/calc`; `rowDoneNetForView`/`stageKey` z `@/lib/kosztorys/v2-rows`; `formatPLN` z `@/lib/format-currency`.
- Produces:
  - `type KosztorysExportColumnT = { id: string; label: string; getValue: (row: KosztorysV2RowT, view: PriceViewT) => string }`
  - `function buildKosztorysExportColumns(stages: KosztorysStageT[]): KosztorysExportColumnT[]`

- [ ] **Step 1: Utwórz plik z rejestrem**

`src/lib/export/kosztorys-export-columns.ts`:

```ts
import { v2ToggleableColumns } from '@/lib/tables/kosztorys-v2-columns'
import {
  effectiveVat,
  rowNetForView,
  rowRemainingForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { rowDoneNetForView, stageKey } from '@/lib/kosztorys/v2-rows'
import { formatPLN } from '@/lib/format-currency'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  KosztorysV2RowT,
} from '@/types/kosztorys'

export type KosztorysExportColumnT = {
  id: string
  label: string
  getValue: (row: KosztorysV2RowT, view: PriceViewT) => string
}

const DISCOUNT_LABEL: Record<string, string> = { percent: '%', amount: 'zł' }

// Rekonstrukcja sekcji dla calc.ts z płaskiego wiersza (VAT/wariant dziedziczone).
function asSection(r: KosztorysV2RowT): KosztorysSectionT {
  return {
    id: r.sectionId,
    name: r.sectionName,
    displayOrder: 0,
    vatRate: r.sectionVatRate,
    defaultCostVariant: r.sectionDefaultCostVariant,
  }
}

function grossForView(r: KosztorysV2RowT, view: PriceViewT): number {
  const item = r as unknown as KosztorysItemT
  return rowNetForView(item, view) * (1 + effectiveVat(item, asSection(r)))
}

// getValue per id. Etapy (stage_<id>) i nieznane id → odczyt liczbowy z wiersza.
function getValueForId(id: string): KosztorysExportColumnT['getValue'] {
  switch (id) {
    case 'sectionName':
      return (r) => r.sectionName
    case 'description':
      return (r) => r.description ?? ''
    case 'unit':
      return (r) => r.unit ?? ''
    case 'plannedQty':
      return (r) => String(r.plannedQty)
    case 'measuredQty':
      return (r) => String(r.measuredQty)
    case 'price':
      return (r, view) => formatPLN(viewPrice(r as unknown as KosztorysItemT, view))
    case 'discountType':
      return (r) => (r.discountType ? DISCOUNT_LABEL[r.discountType] : '')
    case 'discountValue':
      return (r) => String(r.discountValue)
    case 'net':
      return (r, view) => formatPLN(rowNetForView(r as unknown as KosztorysItemT, view))
    case 'gross':
      return (r, view) => formatPLN(grossForView(r, view))
    case 'remaining':
      return (r, view) =>
        formatPLN(
          rowRemainingForView(r as unknown as KosztorysItemT, rowDoneNetForView(r, [], view), view),
        )
    default:
      // stage_<id>: ilość wykonana w etapie (klucz spłaszczony na wierszu v2).
      return (r) => {
        const v = r[id as `stage_${number}`]
        return v == null ? '' : String(v)
      }
  }
}

/**
 * Kolumny eksportu = kolumny przełącznika widoczności (ten sam id/label/kolejność),
 * każda z getValue. Snapshot WYSIWYG: konsument odfiltrowuje ukryte po id.
 */
export function buildKosztorysExportColumns(stages: KosztorysStageT[]): KosztorysExportColumnT[] {
  return v2ToggleableColumns(stages).map(({ id, label }) => ({
    id,
    label,
    getValue: getValueForId(id),
  }))
}
```

> Uwaga `remaining`: `rowDoneNetForView(r, stages, view)` wymaga listy etapów do zsumowania wykonanych. W eksporcie liczymy „pozostało" po sumie etapów zapisanych na wierszu — `rowDoneNetForView` i tak iteruje po `stages`; przekazanie `[]` dałoby 0 wykonanych. Jeśli kolumna „Pozostało" jest widoczna w eksporcie, getValue musi dostać `stages`. Rozwiązanie: w Step 2 poniżej.

- [ ] **Step 2: Przekaż `stages` do getValue „pozostało"**

Zmień `getValueForId` na `getValueForId(id, stages)` i w `remaining` użyj `rowDoneNetForView(r, stages, view)`. W `buildKosztorysExportColumns` wołaj `getValueForId(id, stages)`:

```ts
function getValueForId(id: string, stages: KosztorysStageT[]): KosztorysExportColumnT['getValue'] {
  // ...case 'remaining':
  return (r, view) =>
    formatPLN(
      rowRemainingForView(
        r as unknown as KosztorysItemT,
        rowDoneNetForView(r, stages, view),
        view,
      ),
    )
  // ...
}
// w buildKosztorysExportColumns:
getValue: getValueForId(id, stages),
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: brak błędów.

```bash
git add src/lib/export/kosztorys-export-columns.ts
git commit -m "feat(kosztorys): rejestr kolumn eksportu CSV (id/label z toggle + getValue)"
```

---

### Task 3: Buildery CSV — płaski i grupowany

**Files:**

- Create: `src/lib/export/kosztorys-csv.ts`

**Interfaces:**

- Consumes: `escapeCsv` (Task 1); `KosztorysExportColumnT` (Task 2); `sectionSubtotalsForView`/`type PriceViewT` z `calc`; `SectionSubtotalT`, `KosztorysV2RowT` z types.
- Produces:
  - `function buildKosztorysCsvFlat(rows, columns, view): string`
  - `function buildKosztorysCsvGrouped(rows, columns, view, subtotals): string`

- [ ] **Step 1: Utwórz buildery**

`src/lib/export/kosztorys-csv.ts`:

```ts
import { escapeCsv } from '@/lib/export/csv-cell'
import type { KosztorysExportColumnT } from '@/lib/export/kosztorys-export-columns'
import { rowNetForView, type PriceViewT } from '@/lib/kosztorys/calc'
import { effectiveVat } from '@/lib/kosztorys/calc'
import type { KosztorysItemT, KosztorysV2RowT, SectionSubtotalT } from '@/types/kosztorys'

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function headerLine(columns: KosztorysExportColumnT[]): string {
  return columns.map((c) => escapeCsv(c.label)).join(',')
}

function rowLine(
  row: KosztorysV2RowT,
  columns: KosztorysExportColumnT[],
  view: PriceViewT,
): string {
  return columns.map((c) => escapeCsv(c.getValue(row, view))).join(',')
}

/** Płaski: nagłówek + jeden wiersz na pozycję; sekcja jako kolumna. */
export function buildKosztorysCsvFlat(
  rows: KosztorysV2RowT[],
  columns: KosztorysExportColumnT[],
  view: PriceViewT,
): string {
  return [headerLine(columns), ...rows.map((r) => rowLine(r, columns, view))].join('\n')
}

/**
 * Grupowany: per sekcja → nagłówek sekcji, pozycje, subtotal sekcji; na końcu
 * suma netto/VAT/brutto. Wiersze nie-pozycyjne wyrównane do liczby kolumn.
 */
export function buildKosztorysCsvGrouped(
  rows: KosztorysV2RowT[],
  columns: KosztorysExportColumnT[],
  view: PriceViewT,
  subtotals: SectionSubtotalT[],
): string {
  const width = columns.length
  const pad = (cells: string[]): string =>
    Array.from({ length: width }, (_, i) => escapeCsv(cells[i] ?? '')).join(',')

  const lines: string[] = [headerLine(columns)]
  let grossTotal = 0
  for (const sub of subtotals) {
    const secRows = rows.filter((r) => r.sectionId === sub.sectionId)
    if (secRows.length === 0) continue // sekcja odfiltrowana z widoku — pomiń
    lines.push(pad([sub.sectionName]))
    for (const r of secRows) lines.push(rowLine(r, columns, view))
    lines.push(pad([`Subtotal ${sub.sectionName}`, '', '', '', '', '', '', '', fmtPLN(sub.net)]))
    for (const r of secRows) {
      const item = r as unknown as KosztorysItemT
      grossTotal += rowNetForView(item, view) * (1 + effectiveVat(item, sectionOf(r)))
    }
  }
  const netTotal = subtotals
    .filter((s) => rows.some((r) => r.sectionId === s.sectionId))
    .reduce((sum, s) => sum + s.net, 0)
  lines.push(pad([]))
  lines.push(pad(['Suma netto', '', '', '', '', '', '', '', fmtPLN(netTotal)]))
  lines.push(pad(['Suma VAT', '', '', '', '', '', '', '', fmtPLN(grossTotal - netTotal)]))
  lines.push(pad(['Suma brutto', '', '', '', '', '', '', '', fmtPLN(grossTotal)]))
  return lines.join('\n')
}

function sectionOf(r: KosztorysV2RowT) {
  return {
    id: r.sectionId,
    name: r.sectionName,
    displayOrder: 0,
    vatRate: r.sectionVatRate,
    defaultCostVariant: r.sectionDefaultCostVariant,
  }
}
```

> Uwaga o wyrównaniu subtotalu: `fmtPLN(sub.net)` wstawiamy w stałą pozycję (indeks 8 = „Netto" w pełnym zestawie). Gdy kolumny są ukryte, indeks może nie trafić w kolumnę „Netto" — ale to eksport WYSIWYG dla bake-offu; subtotale i tak są w panelu. Jeśli okaże się mylące, w bake-offie przejdziemy na wyrównanie po realnym indeksie kolumny `net` w `columns` (znajdź `columns.findIndex(c => c.id === 'net')`). Na razie prostota.

- [ ] **Step 2: Wyrównaj subtotal/sumy po realnym indeksie kolumny `net`**

Zamiast sztywnego indeksu 8, policz indeks raz i wstaw wartość tam:

```ts
const netIdx = columns.findIndex((c) => c.id === 'net')
const labelIdx = 0
const put = (label: string, value: string): string => {
  const cells: string[] = []
  cells[labelIdx] = label
  if (netIdx >= 0) cells[netIdx] = value
  else cells[Math.max(1, width - 1)] = value // gdy „Netto" ukryte — ostatnia kolumna
  return pad(cells)
}
```

Użyj `put(...)` dla wierszy „Subtotal …", „Suma netto/VAT/brutto" zamiast ręcznych tablic z indeksem 8.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm typecheck`
Expected: brak błędów.

```bash
git add src/lib/export/kosztorys-csv.ts
git commit -m "feat(kosztorys): buildery CSV płaski + grupowany (snapshot widoku)"
```

---

### Task 4: Przycisk eksportu + wpięcie w edytor

**Files:**

- Create: `src/components/kosztorys/kosztorys-csv-button.tsx`
- Modify: `src/components/kosztorys/kosztorys-editor-v2.tsx`

**Interfaces:**

- Consumes: buildery (Task 3), `buildKosztorysExportColumns` (Task 2), `triggerDownload`.
- Produces: `function KosztorysCsvButton(props: PropsT)`.

- [ ] **Step 1: Utwórz przycisk**

`src/components/kosztorys/kosztorys-csv-button.tsx`:

```tsx
'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buildKosztorysExportColumns } from '@/lib/export/kosztorys-export-columns'
import { buildKosztorysCsvFlat, buildKosztorysCsvGrouped } from '@/lib/export/kosztorys-csv'
import { triggerDownload } from '@/lib/export/download'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysStageT, KosztorysV2RowT, SectionSubtotalT } from '@/types/kosztorys'

type PropsT = {
  rows: KosztorysV2RowT[]
  stages: KosztorysStageT[]
  hidden: Set<string>
  view: PriceViewT
  subtotals: SectionSubtotalT[]
  investmentName: string
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'kosztorys'

export function KosztorysCsvButton({
  rows,
  stages,
  hidden,
  view,
  subtotals,
  investmentName,
}: PropsT) {
  function download(variant: 'plaski' | 'grupowany') {
    const columns = buildKosztorysExportColumns(stages).filter((c) => !hidden.has(c.id))
    const csv =
      variant === 'plaski'
        ? buildKosztorysCsvFlat(rows, columns, view)
        : buildKosztorysCsvGrouped(rows, columns, view, subtotals)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const date = new Date().toISOString().slice(0, 10)
    triggerDownload(blob, `kosztorys-${slug(investmentName)}-${date}-${variant}.csv`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => download('plaski')}>CSV płaski</DropdownMenuItem>
        <DropdownMenuItem onClick={() => download('grupowany')}>CSV grupowany</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

> `dropdown-menu` jest w `src/components/ui/` (shadcn) — używany w `DatasheetColumnToggle`. Jeśli import nie istnieje, sprawdź ścieżkę w `datasheet-column-toggle.tsx` i dopasuj.

- [ ] **Step 2: Wepnij w pasek edytora**

W `src/components/kosztorys/kosztorys-editor-v2.tsx` dodaj import:

```tsx
import { KosztorysCsvButton } from '@/components/kosztorys/kosztorys-csv-button'
```

W toolbarze, w `<div className="ml-auto flex items-center gap-1">` przed `DatasheetColumnToggle` dodaj:

```tsx
<KosztorysCsvButton
  rows={viewRows}
  stages={tree.stages}
  hidden={hidden}
  view={view}
  subtotals={subtotals}
  investmentName={investmentName}
/>
```

> `viewRows` (nie `rows`) — eksport bierze WYSIWYG: przefiltrowane + posortowane wiersze. `subtotals` liczone z pełnego zbioru (panel) — w wariancie grupowanym builder i tak pomija sekcje bez wierszy w `viewRows`.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck`
Expected: brak błędów.

Run: `pnpm exec next build`
Expected: PASS (trasa `kosztorys-edytor-v2` kompiluje się).

- [ ] **Step 4: Weryfikacja w przeglądarce**

`/inwestycje/7/kosztorys-edytor-v2` (lub `/6/`). Sprawdź:

- przycisk „CSV" w pasku → dropdown „CSV płaski" / „CSV grupowany";
- pobierz oba, otwórz w Google Sheets:
  - płaski: nagłówek + pozycje, „Sekcja" jako kolumna, kwoty w zł, escaping opisów z przecinkami OK;
  - grupowany: nagłówki sekcji, pozycje, „Subtotal …", na końcu Suma netto/VAT/brutto;
- ukryj kolumnę (toggle „Kolumny") → znika z CSV; przełącz widok ceny → ceny/netto w CSV się zmieniają; filtr „kominek" → CSV zawiera tylko przefiltrowane wiersze.

- [ ] **Step 5: Commit**

```bash
git add src/components/kosztorys/kosztorys-csv-button.tsx src/components/kosztorys/kosztorys-editor-v2.tsx
git commit -m "feat(kosztorys): przycisk eksportu CSV (płaski/grupowany) w edytorze v2"
```

---

## Self-Review

**Spec coverage:**

- Snapshot WYSIWYG (viewRows + widoczne kolumny + widok) → Task 4 Step 2. ✅
- Wspólny `escapeCsv` → Task 1. ✅
- Rejestr kolumn = kolumny toggle → Task 2 (`buildKosztorysExportColumns` z `v2ToggleableColumns`). ✅
- Płaski + grupowany builder → Task 3. ✅
- Przycisk w pasku, BOM, triggerDownload, nazwa z wariantem → Task 4. ✅
- Bez druku HTML / osobnej strony / migracji → cały plan lokalny. ✅
- POC bez testów → Global Constraints, brak kroków testowych. ✅

**Placeholder scan:** Brak TODO/TBD. Task 2 i Task 3 mają po dwóch krokach „utwórz → popraw" (stages w getValue; wyrównanie po indeksie `net`) — to świadome refinementy, oba z pełnym kodem.

**Type consistency:** `KosztorysExportColumnT` spójny Task 2↔3↔4. `buildKosztorysExportColumns(stages)` → filtr `hidden` → buildery. `viewPrice`/`rowNetForView` przyjmują `KosztorysItemT`, wiersz rzutowany `as unknown as KosztorysItemT` (parytet z `kosztorys-v2-columns.tsx`). `PriceViewT` jeden z `calc`.
