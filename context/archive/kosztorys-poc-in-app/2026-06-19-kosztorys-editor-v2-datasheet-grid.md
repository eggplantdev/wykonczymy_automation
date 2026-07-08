# Kosztorys edytor v2 (react-datasheet-grid) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować drugą wersję edytora rozpiski robocizny na `react-datasheet-grid` obok istniejącej v1 (TanStack), do bake-offu „która siatka daje lepszy sheet-feel", z **przełącznikiem trzech widoków cen** (robocizna / z narzędziami / bez narzędzi) nad jednym zbiorem danych. v2 = docelowy fundament POC.

**Architecture:** v2 to nowa trasa `/inwestycje/[id]/kosztorys-edytor-v2` i nowy komponent kliencki, który **reużywa cały rdzeń v1** (query `getKosztorysTree`, akcje `lib/actions/kosztorys.ts`, formuły `lib/kosztorys/calc.ts`, typy). Różni się wyłącznie warstwą siatki: płaskie wiersze pozycji + zdenormalizowana sekcja + spłaszczone ilości etapów (`stage_<id>`), edytowane przez `DynamicDataSheetGrid`. Autosave wisi na `onChange(value, operations)`: operacja `UPDATE` → diff zmienionego wiersza → istniejące akcje pól z debounce → `router.refresh()`. **Przełącznik widoku** zmienia aktywną kolumnę ceny (`clientPrice` / `subcontractorWToolsPrice` / `subcontractorOwnToolsPrice`) i jej wartości liczone — to ten sam wiersz, więc trzy „kosztorysy" = trzy widoki, zero duplikacji (warunek podstawowy POC).

**Tech Stack:** Next 16.1, React 19.2 (React Compiler), Payload, react-datasheet-grid (DOM), Vitest.

## Global Constraints

- **Baza = `wykonczymy-poc` tylko.** Zero kontaktu z Neon/prod. Migracje już są (schemat istnieje); ten plan nie tyka schematu ani migracji.
- **Polish UI, English code.** Suffix typów `T` (`RowT`), `type` nie `interface`, brak `enum` (→ `as const`/union), brak `readonly` na propsach/typach, `undefined` zamiast `null` dla nowych opcjonalnych (istniejące `| null` z query zostają — nie przepisujemy rdzenia).
- **v1 nietknięta.** Żadne pliki v1 (`kosztorys-editor.tsx`, `editable-cell.tsx`, `kosztorys-columns.tsx`, trasa `kosztorys-edytor`) nie są modyfikowane. Wspólny rdzeń (`calc.ts`, `actions/kosztorys.ts`, `queries/kosztorys.ts`, `types/kosztorys.ts`) modyfikujemy tylko addytywnie (nowe eksporty), bez zmiany istniejących sygnatur.
- **Instalacja zależności na arm64:** dodać paczkę **ręcznie do `package.json`**, potem `pnpm install`. Przy pęknięciu CSS-build (`lightningcss`): `pnpm install --force` + `rm -rf .next`. Nigdy `pnpm remove`.
- **Mutacje przez `protectedAction`** (już zaimplementowane). v2 nie pisze nowych akcji — reużywa istniejące.
- **Reużyj `useDebouncedSave`** (`src/components/kosztorys/use-debounced-save.ts`, sygnatura `save(key: string, run: () => Promise<ActionResultT>)`).
- **Single-file command testów:** `pnpm exec vitest run <plik>` (pnpm 10 nie forwarduje `--`).
- **Nie commituj `src/payload-types.ts`** (gitignored). Ten plan i tak nie zmienia typów Payload.
- Login do weryfikacji manualnej: `PORT=3001 pnpm dev`, temp OWNER `poc@local.test` / `poc12345`; dane: `node --env-file=.env --import tsx src/scripts/poc-seed-kosztorys.ts` (inwestycja 6).

---

## File Structure

- `package.json` — dodać `react-datasheet-grid` (Task 1).
- `src/types/kosztorys.ts` — **dodać** `KosztorysV2RowT` + typy diffu (addytywnie, Task 2).
- `src/lib/kosztorys/v2-rows.ts` (nowy) — czyste funkcje: `treeToRows`, `diffRow`, `stageKey` (Task 2).
- `src/lib/kosztorys/calc.ts` — **dodać addytywnie** `PriceViewT`, `viewPrice`, `rowNetForView` (Task 3); istniejących funkcji nie zmieniać.
- `src/lib/tables/kosztorys-v2-columns.tsx` (nowy) — budowa kolumn datasheet-grid zależna od widoku: statyczne + aktywna cena widoku + dynamiczne etapy + liczone read-only (Task 3).
- `src/components/kosztorys/kosztorys-editor-v2.tsx` (nowy) — komponent kliencki: `DynamicDataSheetGrid` + autosave (Task 4).
- `src/app/(frontend)/inwestycje/[id]/kosztorys-edytor-v2/page.tsx` (nowy) — trasa + bramka ról (Task 5).
- `src/app/(frontend)/inwestycje/[id]/page.tsx:91-93` — link wejścia obok v1 (Task 5).
- `src/__tests__/kosztorys-v2-rows.test.ts` (nowy) — testy adaptera (Task 2).
- `context/changes/kosztorys-poc-in-app/change.md` — wpis decyzji bake-offu (Task 6).

---

## Task 1: Bramka zgodności — instalacja + smoke-render w Next 16

**Cel:** Potwierdzić, że `react-datasheet-grid` w ogóle montuje się i edytuje pod React 19.2 / Next 16.1 / React Compiler, ZANIM zbudujemy resztę. Jeśli pęknie — STOP i fallback na react-data-grid (decyzja właściciela).

**Files:**

- Modify: `package.json` (dependencies)
- Create (tymczasowy): `src/app/(frontend)/inwestycje/[id]/kosztorys-edytor-v2/page.tsx`
- Create (tymczasowy): `src/components/kosztorys/kosztorys-editor-v2.tsx`

**Interfaces:**

- Produces: trasa `/inwestycje/[id]/kosztorys-edytor-v2` (smoke) i komponent `KosztorysEditorV2` (smoke) — rozbudowywane w Task 4–5.

- [ ] **Step 1: Dodać zależność ręcznie do `package.json`**

W sekcji `dependencies` dodać (wersję ustalić jako najnowszą stabilną z npm w momencie wykonania; sprawdź `npm view react-datasheet-grid version`):

```jsonc
"react-datasheet-grid": "^4.11.4",
```

- [ ] **Step 2: Zainstalować**

Run: `pnpm install`
Expected: instalacja przechodzi. Jeśli po niej `pnpm dev` wywala błąd CSS o `src/styles/globals.css` / `lightningcss` → `pnpm install --force` && `rm -rf .next` (lekcja arm64).

- [ ] **Step 3: Smoke komponent**

Create `src/components/kosztorys/kosztorys-editor-v2.tsx`:

```tsx
'use client'

import 'react-datasheet-grid/dist/style.css'
import { useState } from 'react'
import { DataSheetGrid, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'

type SmokeRowT = { description: string; measuredQty: number | null }

const columns = [
  { ...keyColumn<SmokeRowT, 'description'>('description', textColumn), title: 'Opis' },
  { ...keyColumn<SmokeRowT, 'measuredQty'>('measuredQty', floatColumn), title: 'Pomiar' },
]

export function KosztorysEditorV2() {
  const [rows, setRows] = useState<SmokeRowT[]>([
    { description: 'Wiersz A', measuredQty: 1 },
    { description: 'Wiersz B', measuredQty: 2 },
  ])
  return <DataSheetGrid value={rows} onChange={setRows} columns={columns} />
}
```

- [ ] **Step 4: Smoke trasa**

Create `src/app/(frontend)/inwestycje/[id]/kosztorys-edytor-v2/page.tsx`:

```tsx
import { KosztorysEditorV2 } from '@/components/kosztorys/kosztorys-editor-v2'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default function KosztorysEditorV2SmokePage() {
  return (
    <PageWrapper title="Kosztorys v2 (smoke)">
      <KosztorysEditorV2 />
    </PageWrapper>
  )
}
```

- [ ] **Step 5: Weryfikacja typów i buildu**

Run: `pnpm typecheck`
Expected: PASS (brak błędów typów z importu datasheet-grid).

Run: `pnpm exec next build` (lub `pnpm build` jeśli migracje na poc są spójne)
Expected: build przechodzi; brak błędów SSR/ESM o `react-datasheet-grid`.

- [ ] **Step 6: Smoke manualny (BRAMKA)**

`PORT=3001 pnpm dev`, wejdź `/inwestycje/6/kosztorys-edytor-v2`.
Expected:

- siatka się renderuje (2 wiersze, 2 kolumny),
- dblclick/Enter wchodzi w edycję komórki, Esc wychodzi,
- **strzałki przesuwają zaznaczenie** między komórkami, Tab przechodzi w prawo,
- wpisanie liczby w „Pomiar" działa, copy/paste (Ctrl+C/Ctrl+V) między komórkami działa.

**STOP GATE:** Jeśli którykolwiek z powyższych pęka pod React 19 i nie da się obejść trywialnie — zatrzymaj plan, zgłoś właścicielowi, rozważ fallback react-data-grid (reszta planu: zamiana `columns`/`onChange` na `Column[]`/`onRowsChange`, struktura tasków bez zmian).

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/kosztorys/kosztorys-editor-v2.tsx "src/app/(frontend)/inwestycje/[id]/kosztorys-edytor-v2/page.tsx"
git commit -m "feat(kosztorys): smoke react-datasheet-grid v2 — bramka zgodności React 19/Next 16"
```

---

## Task 2: Adapter drzewa → płaskie wiersze + diff (czyste funkcje, TDD)

**Cel:** Jedyne miejsce mapujące `KosztorysTreeT` na płaskie wiersze datasheet-grid i z powrotem na patche akcji. Czyste, testowalne — to serce autosave.

**Files:**

- Modify: `src/types/kosztorys.ts` (dodać typy v2)
- Create: `src/lib/kosztorys/v2-rows.ts`
- Test: `src/__tests__/kosztorys-v2-rows.test.ts`

**Interfaces:**

- Consumes: `KosztorysTreeT`, `KosztorysItemT`, `CostVariantT`, `DiscountTypeT` z `@/types/kosztorys`; `ItemPatchT` z `@/lib/actions/kosztorys`.
- Produces:
  - `type KosztorysV2RowT` (płaski wiersz; klucze etapów `stage_${number}: number`).
  - `stageKey(stageId: number): \`stage\_${number}\`` → string klucza kolumny etapu.
  - `treeToRows(tree: KosztorysTreeT): KosztorysV2RowT[]` → płaskie wiersze (kolejność: sekcje po `displayOrder`, w sekcji pozycje po `displayOrder`).
  - `type RowDiffT = { itemPatch?: ItemPatchT; stageChanges?: { stageId: number; qty: number }[] }`.
  - `diffRow(prev: KosztorysV2RowT, next: KosztorysV2RowT): RowDiffT` → tylko zmienione pola pozycji + zmienione ilości etapów.

- [ ] **Step 1: Dodać typy v2 do `src/types/kosztorys.ts`** (addytywnie na końcu pliku)

```ts
// --- Wariant v2 (react-datasheet-grid): płaski wiersz z etapami spłaszczonymi
// do kluczy stage_<stageId>, żeby keyColumn mapował 1:1. ---
export type KosztorysV2RowBaseT = KosztorysItemT & {
  sectionName: string
  sectionVatRate: number
  sectionDefaultCostVariant: CostVariantT
}

export type KosztorysV2RowT = KosztorysV2RowBaseT & {
  [stageKey: `stage_${number}`]: number
}
```

- [ ] **Step 2: Napisać failing test**

Create `src/__tests__/kosztorys-v2-rows.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { treeToRows, diffRow, stageKey } from '@/lib/kosztorys/v2-rows'
import type { KosztorysTreeT } from '@/types/kosztorys'

const baseItem = {
  id: 1,
  sectionId: 10,
  displayOrder: 0,
  description: 'Malowanie',
  unit: 'm2',
  plannedQty: 5,
  measuredQty: 5,
  discountType: null,
  discountValue: 0,
  clientPrice: 20,
  subcontractorWToolsPrice: 12,
  subcontractorOwnToolsPrice: 10,
  costVariant: null,
  vatRate: null,
  hiddenInExport: false,
  note: null,
}

const tree: KosztorysTreeT = {
  sections: [
    {
      id: 10,
      name: 'Sekcja A',
      displayOrder: 0,
      vatRate: 0.08,
      defaultCostVariant: 'w_tools',
      items: [baseItem],
    },
  ],
  stages: [
    { id: 100, ordinal: 1, label: null },
    { id: 101, ordinal: 2, label: null },
  ],
  progress: [{ itemId: 1, stageId: 100, qtyDone: 2 }],
}

describe('treeToRows', () => {
  it('spłaszcza pozycję z sekcją i etapami', () => {
    const rows = treeToRows(tree)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id: 1,
      sectionId: 10,
      sectionName: 'Sekcja A',
      sectionVatRate: 0.08,
      description: 'Malowanie',
    })
    expect(rows[0][stageKey(100)]).toBe(2)
    expect(rows[0][stageKey(101)]).toBe(0) // brak postępu → 0
  })
})

describe('diffRow', () => {
  it('wykrywa zmianę pola pozycji', () => {
    const [prev] = treeToRows(tree)
    const next = { ...prev, measuredQty: 8 }
    expect(diffRow(prev, next)).toEqual({ itemPatch: { measuredQty: 8 } })
  })

  it('wykrywa zmianę ilości etapu', () => {
    const [prev] = treeToRows(tree)
    const next = { ...prev, [stageKey(101)]: 3 }
    expect(diffRow(prev, next)).toEqual({ stageChanges: [{ stageId: 101, qty: 3 }] })
  })

  it('bez zmian → pusty diff', () => {
    const [prev] = treeToRows(tree)
    expect(diffRow(prev, { ...prev })).toEqual({})
  })
})
```

- [ ] **Step 3: Uruchomić — ma faliować**

Run: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`
Expected: FAIL („treeToRows is not a function" / brak modułu).

- [ ] **Step 4: Implementacja `src/lib/kosztorys/v2-rows.ts`**

```ts
import type { ItemPatchT } from '@/lib/actions/kosztorys'
import type { KosztorysTreeT, KosztorysV2RowT } from '@/types/kosztorys'

export function stageKey(stageId: number): `stage_${number}` {
  return `stage_${stageId}`
}

// Pola pozycji edytowalne w siatce (= klucze ItemPatchT). Diff porównuje tylko je.
const ITEM_FIELDS = [
  'description',
  'unit',
  'plannedQty',
  'measuredQty',
  'discountType',
  'discountValue',
  'clientPrice',
  'subcontractorWToolsPrice',
  'subcontractorOwnToolsPrice',
  'costVariant',
  'vatRate',
  'hiddenInExport',
  'note',
] as const satisfies readonly (keyof ItemPatchT)[]

export function treeToRows(tree: KosztorysTreeT): KosztorysV2RowT[] {
  const progressByItem = new Map<number, Record<number, number>>()
  for (const p of tree.progress) {
    const m = progressByItem.get(p.itemId) ?? {}
    m[p.stageId] = p.qtyDone
    progressByItem.set(p.itemId, m)
  }

  const rows: KosztorysV2RowT[] = []
  for (const section of tree.sections) {
    for (const item of section.items) {
      const qty = progressByItem.get(item.id) ?? {}
      const stageFields: Record<string, number> = {}
      for (const st of tree.stages) stageFields[stageKey(st.id)] = qty[st.id] ?? 0
      rows.push({
        ...item,
        sectionName: section.name,
        sectionVatRate: section.vatRate,
        sectionDefaultCostVariant: section.defaultCostVariant,
        ...stageFields,
      } as KosztorysV2RowT)
    }
  }
  return rows
}

export type RowDiffT = {
  itemPatch?: ItemPatchT
  stageChanges?: { stageId: number; qty: number }[]
}

export function diffRow(prev: KosztorysV2RowT, next: KosztorysV2RowT): RowDiffT {
  const itemPatch: Record<string, unknown> = {}
  for (const f of ITEM_FIELDS) {
    if (prev[f] !== next[f]) itemPatch[f] = next[f]
  }

  const stageChanges: { stageId: number; qty: number }[] = []
  for (const k of Object.keys(next)) {
    if (!k.startsWith('stage_')) continue
    const nextVal = next[k as `stage_${number}`]
    if (prev[k as `stage_${number}`] !== nextVal) {
      stageChanges.push({ stageId: Number(k.slice('stage_'.length)), qty: Number(nextVal) || 0 })
    }
  }

  const diff: RowDiffT = {}
  if (Object.keys(itemPatch).length > 0) diff.itemPatch = itemPatch as ItemPatchT
  if (stageChanges.length > 0) diff.stageChanges = stageChanges
  return diff
}
```

- [ ] **Step 5: Uruchomić — ma przejść**

Run: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`
Expected: PASS (4 testy).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/kosztorys.ts src/lib/kosztorys/v2-rows.ts src/__tests__/kosztorys-v2-rows.test.ts
git commit -m "feat(kosztorys): adapter v2 drzewo→płaskie wiersze + diffRow (TDD)"
```

---

## Task 3: Budowa kolumn datasheet-grid (statyczne + etapy + liczone + rabat)

**Cel:** Zdefiniować kolumny siatki v2 **zależne od aktywnego widoku** (robocizna / z narzędziami / bez narzędzi): edytowalne pola, aktywna kolumna ceny widoku, dynamiczne kolumny etapów, read-only kolumny liczone (netto/brutto) — wszystko z reuse `calc.ts`.

**Files:**

- Modify: `src/lib/kosztorys/calc.ts` (dodać addytywnie `PriceViewT`, `viewPrice`, `rowNetForView`)
- Create: `src/lib/tables/kosztorys-v2-columns.tsx`
- Test: dopisać do `src/__tests__/kosztorys-v2-rows.test.ts` (netto per widok; liczba kolumn etapów)

**Interfaces:**

- Consumes: `KosztorysV2RowT`, `stageKey` (Task 2); `effectiveVat`, `applyDiscount` (prywatne — używane wewnątrz `calc.ts`) z `@/lib/kosztorys/calc`; `KosztorysItemT`, `KosztorysSectionT`, `KosztorysStageT` z typów. Typy kolumn (`Column`, `keyColumn`, `textColumn`, `floatColumn`) z `react-datasheet-grid`.
- Produces:
  - `type PriceViewT = 'client' | 'w_tools' | 'own_tools'`.
  - `viewPrice(item: KosztorysItemT, view: PriceViewT): number`.
  - `rowNetForView(item: KosztorysItemT, view: PriceViewT): number`.
  - `buildV2Columns(stages: KosztorysStageT[], view: PriceViewT): Column<KosztorysV2RowT>[]`.

- [ ] **Step 1: Dodać helper widoku do `src/lib/kosztorys/calc.ts`** (na końcu pliku — `applyDiscount` jest w tym samym module)

```ts
// --- Widoki cenowe (jeden zbiór → trzy widoki: klient / podwykonawca z/bez narzędzi) ---
export type PriceViewT = 'client' | 'w_tools' | 'own_tools'

export function viewPrice(item: KosztorysItemT, view: PriceViewT): number {
  if (view === 'w_tools') return item.subcontractorWToolsPrice
  if (view === 'own_tools') return item.subcontractorOwnToolsPrice
  return item.clientPrice
}

/** Netto wiersza wg ceny wybranego widoku (pomiar × cena widoku − rabat). */
export function rowNetForView(item: KosztorysItemT, view: PriceViewT): number {
  return applyDiscount(item.measuredQty * viewPrice(item, view), item)
}
```

- [ ] **Step 2: Napisać failing test netto-per-widok** do `src/__tests__/kosztorys-v2-rows.test.ts`:

```ts
import { rowNetForView } from '@/lib/kosztorys/calc'

describe('rowNetForView', () => {
  const item = {
    ...baseItem,
    measuredQty: 10,
    clientPrice: 20,
    subcontractorWToolsPrice: 12,
    subcontractorOwnToolsPrice: 10,
    discountType: null,
    discountValue: 0,
  }
  it('liczy netto wg ceny widoku', () => {
    expect(rowNetForView(item, 'client')).toBe(200)
    expect(rowNetForView(item, 'w_tools')).toBe(120)
    expect(rowNetForView(item, 'own_tools')).toBe(100)
  })
})
```

Run: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`
Expected: FAIL („rowNetForView is not a function").

- [ ] **Step 3: Implementacja `src/lib/tables/kosztorys-v2-columns.tsx`**

> Uwaga: `calc.ts` liczy z `KosztorysItemT` + `KosztorysSectionT`. `KosztorysV2RowT` ma pola pozycji + zdenormalizowane `sectionVatRate`/`sectionDefaultCostVariant`, więc rekonstruujemy minimalny obiekt sekcji dla calc. Aktywna kolumna ceny zależy od `view`.

```tsx
'use client'

import { Column, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { effectiveVat, rowNetForView, type PriceViewT } from '@/lib/kosztorys/calc'
import { stageKey } from '@/lib/kosztorys/v2-rows'
import type {
  KosztorysItemT,
  KosztorysSectionT,
  KosztorysStageT,
  KosztorysV2RowT,
} from '@/types/kosztorys'

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Pole ceny renderowane jako aktywna kolumna „Cena" zależnie od widoku.
const PRICE_FIELD: Record<PriceViewT, keyof KosztorysV2RowT> = {
  client: 'clientPrice',
  w_tools: 'subcontractorWToolsPrice',
  own_tools: 'subcontractorOwnToolsPrice',
}

// Rekonstrukcja inputów dla calc.ts z płaskiego wiersza.
function asSection(r: KosztorysV2RowT): KosztorysSectionT {
  return {
    id: r.sectionId,
    name: r.sectionName,
    displayOrder: 0,
    vatRate: r.sectionVatRate,
    defaultCostVariant: r.sectionDefaultCostVariant,
  }
}

// Kolumna liczona, read-only: własny component renderujący wartość z calc.
function computedColumn(
  id: string,
  title: string,
  compute: (r: KosztorysV2RowT) => number,
): Column<KosztorysV2RowT> {
  return {
    id,
    title,
    disabled: true,
    component: ({ rowData }) => (
      <span style={{ paddingRight: 8, textAlign: 'right', width: '100%' }}>
        {fmt(compute(rowData))}
      </span>
    ),
  }
}

export function buildV2Columns(
  stages: KosztorysStageT[],
  view: PriceViewT,
): Column<KosztorysV2RowT>[] {
  const left: Column<KosztorysV2RowT>[] = [
    {
      ...keyColumn<KosztorysV2RowT, 'sectionName'>('sectionName', textColumn),
      title: 'Sekcja',
      minWidth: 140,
    },
    {
      ...keyColumn<KosztorysV2RowT, 'description'>('description', textColumn),
      title: 'Opis',
      minWidth: 240,
      grow: 2,
    },
    { ...keyColumn<KosztorysV2RowT, 'unit'>('unit', textColumn), title: 'J.m.', minWidth: 64 },
    {
      ...keyColumn<KosztorysV2RowT, 'plannedQty'>('plannedQty', floatColumn),
      title: 'Przedmiar',
      minWidth: 90,
    },
    {
      ...keyColumn<KosztorysV2RowT, 'measuredQty'>('measuredQty', floatColumn),
      title: 'Pomiar',
      minWidth: 90,
    },
    // Aktywna cena zależna od widoku (ten sam wiersz, inna kolumna ceny).
    { ...keyColumn(PRICE_FIELD[view], floatColumn), title: 'Cena', minWidth: 90 },
    {
      ...keyColumn<KosztorysV2RowT, 'discountValue'>('discountValue', floatColumn),
      title: 'Rabat',
      minWidth: 80,
    },
  ]

  const stageCols: Column<KosztorysV2RowT>[] = stages.map((st) => ({
    ...keyColumn(stageKey(st.id), floatColumn),
    title: `E${st.ordinal}`,
    minWidth: 64,
  }))

  const computed: Column<KosztorysV2RowT>[] = [
    computedColumn('net', 'Netto', (r) => rowNetForView(r as unknown as KosztorysItemT, view)),
    computedColumn('gross', 'Brutto', (r) => {
      const item = r as unknown as KosztorysItemT
      return rowNetForView(item, view) * (1 + effectiveVat(item, asSection(r)))
    }),
  ]

  return [...left, ...stageCols, ...computed]
}
```

> Decyzja zakresowa: kolumna „Pozostało" i select typu rabatu (`percent|amount`) są w v1; w v2 wystarczą do oceny sheet-feel kolumny liczone netto/brutto per widok + edytowalne pola. „Pozostało" dodaj analogicznie przez `computedColumn` jeśli zostanie czas. Select rabatu = follow-on (custom `component` wg wzoru react-select z docs), nie warunek bramki.

- [ ] **Step 4: Dopisać test liczby kolumn etapów** do `src/__tests__/kosztorys-v2-rows.test.ts`:

```ts
import { buildV2Columns } from '@/lib/tables/kosztorys-v2-columns'

describe('buildV2Columns', () => {
  it('dokłada jedną kolumnę na każdy etap', () => {
    const cols0 = buildV2Columns([], 'client')
    const cols2 = buildV2Columns(
      [
        { id: 100, ordinal: 1, label: null },
        { id: 101, ordinal: 2, label: null },
      ],
      'client',
    )
    expect(cols2.length - cols0.length).toBe(2)
  })
})
```

- [ ] **Step 5: Uruchomić testy**

Run: `pnpm exec vitest run src/__tests__/kosztorys-v2-rows.test.ts`
Expected: PASS (6 testów: 4 adaptera + `rowNetForView` + `buildV2Columns`).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/kosztorys/calc.ts src/lib/tables/kosztorys-v2-columns.tsx src/__tests__/kosztorys-v2-rows.test.ts
git commit -m "feat(kosztorys): kolumny v2 zależne od widoku ceny + helper rowNetForView (TDD)"
```

---

## Task 4: Komponent v2 z autosave (`DynamicDataSheetGrid` + onChange → akcje)

**Cel:** Zastąpić smoke z Task 1 realnym edytorem: dynamiczne kolumny, value/onChange wpięte w diff + akcje pól z debounce, `router.refresh()` po zapisie, revert+toast na błąd.

**Files:**

- Modify: `src/components/kosztorys/kosztorys-editor-v2.tsx` (przebudowa ze smoke)

**Interfaces:**

- Consumes: `KosztorysTreeT` (prop `tree`), `investmentId` (prop); `treeToRows`, `diffRow`, `stageKey` (Task 2); `buildV2Columns`, `PriceViewT` (Task 3); `updateItemFieldAction`, `setStageProgressAction`, `ItemPatchT` z `@/lib/actions/kosztorys`; `useDebouncedSave`; `Button` z `@/components/ui/button`; `useRouter` z `next/navigation`.
- Produces: `KosztorysEditorV2({ investmentId, tree }: { investmentId: number; tree: KosztorysTreeT })` z przełącznikiem widoku (`PriceViewT`).

- [ ] **Step 1: Przebudować `src/components/kosztorys/kosztorys-editor-v2.tsx`**

```tsx
'use client'

import 'react-datasheet-grid/dist/style.css'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DynamicDataSheetGrid } from 'react-datasheet-grid'
import { useDebouncedSave } from '@/components/kosztorys/use-debounced-save'
import { Button } from '@/components/ui/button'
import { buildV2Columns } from '@/lib/tables/kosztorys-v2-columns'
import { diffRow, treeToRows } from '@/lib/kosztorys/v2-rows'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import {
  setStageProgressAction,
  updateItemFieldAction,
  type ItemPatchT,
} from '@/lib/actions/kosztorys'
import type { KosztorysTreeT, KosztorysV2RowT } from '@/types/kosztorys'

type PropsT = { investmentId: number; tree: KosztorysTreeT }

// Trzy widoki nad jednym zbiorem: zmieniają tylko aktywną cenę i jej liczone.
const VIEWS: { value: PriceViewT; label: string }[] = [
  { value: 'client', label: 'Robocizna' },
  { value: 'w_tools', label: 'Z narzędziami' },
  { value: 'own_tools', label: 'Bez narzędzi' },
]

export function KosztorysEditorV2({ tree }: PropsT) {
  const router = useRouter()
  const save = useDebouncedSave(500)
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  const [view, setView] = useState<PriceViewT>('client')
  // Snapshot poprzednich wierszy do diffu (po id pozycji).
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))

  const columns = useMemo(() => buildV2Columns(tree.stages, view), [tree.stages, view])

  const onChange = useCallback(
    (next: KosztorysV2RowT[]) => {
      setRows(next)
      for (const row of next) {
        const prev = prevById.current.get(row.id)
        if (!prev) continue
        const diff = diffRow(prev, row)
        if (diff.itemPatch) {
          const patch = diff.itemPatch
          for (const field of Object.keys(patch)) {
            save(`item:${row.id}:${field}`, () =>
              updateItemFieldAction(row.id, { [field]: patch[field as keyof ItemPatchT] }),
            )
          }
        }
        for (const sc of diff.stageChanges ?? []) {
          save(`progress:${row.id}:${sc.stageId}`, () =>
            setStageProgressAction(row.id, sc.stageId, sc.qty),
          )
        }
        prevById.current.set(row.id, row)
      }
      // Pociągnij przeliczone sumy z serwera po ciszy zapisu (lekcja fire-and-forget).
      setTimeout(() => router.refresh(), 700)
    },
    [router, save],
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {VIEWS.map((v) => (
          <Button
            key={v.value}
            size="sm"
            variant={v.value === view ? 'default' : 'outline'}
            onClick={() => setView(v.value)}
          >
            {v.label}
          </Button>
        ))}
      </div>
      <DynamicDataSheetGrid value={rows} onChange={onChange} columns={columns} />
    </div>
  )
}
```

> Uwaga: przełącznik zmienia tylko `view` → `columns` (aktywna cena + jej liczone). Wiersze (`rows`) i autosave są wspólne dla wszystkich widoków — to dowód „jeden zbiór, trzy widoki". `useDebouncedSave` już pokazuje toast na `!res.success`. Revert lokalny przy błędzie pomijamy w POC (snapshot serwerowy przyjdzie z `router.refresh()`); jeśli okaże się migotliwe podczas oceny — dodać revert z `prevById`.

- [ ] **Step 2: Podmienić smoke-trasę na realny render (tymczasowo zostaje z Task 1, finalizowane w Task 5)**

Na tym etapie trasa nadal renderuje `<KosztorysEditorV2 />` bez propsów — typecheck to wyłapie. Trasa dostaje propsy w Task 5; tu tylko potwierdzamy, że komponent się kompiluje. Jeśli chcesz render pośredni, tymczasowo w trasie podaj `tree` z `getKosztorysTree` (patrz Task 5 Step 1) — i tak to docelowy kształt.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (po wpięciu trasy w Task 5; jeśli robisz Task 4 i 5 łącznie — zrób je razem przed typecheck).

- [ ] **Step 4: Commit**

```bash
git add src/components/kosztorys/kosztorys-editor-v2.tsx
git commit -m "feat(kosztorys): edytor v2 — DynamicDataSheetGrid + autosave + przełącznik widoków"
```

---

## Task 5: Trasa v2 z bramką ról + link wejścia

**Cel:** Finalna trasa serwerowa (jak v1) pobierająca drzewo i renderująca `KosztorysEditorV2`, plus link wejścia obok v1 na stronie detalu inwestycji.

**Files:**

- Modify: `src/app/(frontend)/inwestycje/[id]/kosztorys-edytor-v2/page.tsx` (z smoke na realny)
- Modify: `src/app/(frontend)/inwestycje/[id]/page.tsx:91-93`

**Interfaces:**

- Consumes: `requireAuth`, `MANAGEMENT_ROLES`, `getInvestment`, `getKosztorysTree`, `KosztorysEditorV2`, `PageWrapper`.
- Produces: trasa `/inwestycje/[id]/kosztorys-edytor-v2` (server component, gate EMPLOYEE-out).

- [ ] **Step 1: Przepisać trasę na realną** (wzór 1:1 z v1 `kosztorys-edytor/page.tsx`)

```tsx
import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getInvestment } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { KosztorysEditorV2 } from '@/components/kosztorys/kosztorys-editor-v2'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function KosztorysEditorV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')

  const { id } = await params
  const investmentId = Number(id)
  if (!Number.isFinite(investmentId) || investmentId <= 0) notFound()

  const investment = await getInvestment(id)
  if (!investment) notFound()

  const tree = await getKosztorysTree(investmentId)

  return (
    <PageWrapper title={`Kosztorys v2 — ${investment.name}`}>
      <KosztorysEditorV2 investmentId={investmentId} tree={tree} />
    </PageWrapper>
  )
}
```

- [ ] **Step 2: Dodać link wejścia** w `src/app/(frontend)/inwestycje/[id]/page.tsx` zaraz po istniejącym (linia 91-93):

```tsx
        <Button asChild variant="outline" size="sm">
          <Link href={`/inwestycje/${id}/kosztorys-edytor`}>Kosztorys (edytor)</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/inwestycje/${id}/kosztorys-edytor-v2`}>Kosztorys (v2)</Link>
        </Button>
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm exec next build`
Expected: PASS (obie trasy budują się; brak błędu SSR datasheet-grid — komponent jest `'use client'`).

- [ ] **Step 4: Weryfikacja manualna**

`PORT=3001 pnpm dev`; seed inwestycji 6; wejdź `/inwestycje/6/kosztorys-edytor-v2`.
Expected:

- siatka z realnymi danymi (sekcje/pozycje, dynamiczne kolumny etapów, netto/brutto liczone),
- **przełącznik Robocizna / Z narzędziami / Bez narzędzi** zmienia kolumnę „Cena" i przelicza netto/brutto na cenę wybranego widoku; pozostałe pola (pomiar, etapy) bez zmian — to ten sam wiersz,
- edycja ceny w jednym widoku zapisuje się do właściwej kolumny (`clientPrice`/`subcontractorWToolsPrice`/`subcontractorOwnToolsPrice`); przełączenie widoku pokazuje cenę tej kolumny,
- edycja „Pomiar"/„Cena" zapisuje się (po odświeżeniu trwałe; netto/brutto przeliczone),
- edycja ilości etapu zapisuje się (po odświeżeniu trwała),
- EMPLOYEE: brak dostępu (redirect/odmowa),
- w logach `[PERF]` zapis dotyczy jednego rekordu, nie całego arkusza.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/inwestycje/[id]/kosztorys-edytor-v2/page.tsx" "src/app/(frontend)/inwestycje/[id]/page.tsx"
git commit -m "feat(kosztorys): trasa v2 z bramką ról + link wejścia obok v1"
```

---

## Task 6: Bake-off — pomiar wg kryteriów i zapis decyzji

**Cel:** Przejść kryteria oceny ze specu na obu wersjach i zapisać werdykt + uzasadnienie. To bramka „idziemy dalej" — nie kod, lecz decyzja.

**Files:**

- Modify: `context/changes/kosztorys-poc-in-app/change.md` (sekcja decyzji bake-offu)

- [ ] **Step 1: Przejść kryteria na `/inwestycje/6/kosztorys-edytor` (v1) i `/inwestycje/6/kosztorys-edytor-v2` (v2)** i zanotować dla każdej:
  - **jeden zbiór, trzy widoki (warunek podstawowy):** przełącznik zmienia aktywną cenę i liczone; dodanie pozycji/etapu jest natychmiast we wszystkich widokach; nic nie wymaga osobnego dodania (v1 nie ma jeszcze przełącznika — odnotować jako brak),
  - keyboard-nav po całej siatce (strzałki/Tab/Enter/pisanie/copy-paste), w tym wiersze wirtualizowane,
  - edycja pola przy ~1000 wierszy bez janku; `[PERF]` = zapis jednego rekordu,
  - resize kolumn + zmienna wysokość wiersza,
  - autosave niezawodny (brak utraty wpisów; toast na błąd),
  - subiektywny „sheet-feel" (ocena właściciela).

> Jeśli inwestycja 6 ma <1000 wierszy, dla testu perf tymczasowo rozszerz seed albo zduplikuj pozycje w `wykonczymy-poc` (tylko lokalnie). Nie commituj zmian danych.

- [ ] **Step 2: Zapisać werdykt** w `change.md` (sekcja `## Bake-off siatki edytora`): wybór v1/v2, wynik per kryterium, uzasadnienie. Jeśli **v2 wygrywa** (oczekiwane — v2 to docelowy fundament): „v2 = baza, dokładamy na niej resztę planu POC (subtotale, plan-vs-actual, pokoje, PDF, dodawanie/usuwanie sekcji/etapów) oraz forward-scope deliverable (read-only wydatki z transferów); v1 do usunięcia po sportowaniu". Jeśli **v2 odpada** (bramka zgodności pęka): „v1 zostaje, usunąć trasę/komponent/zależność v2", rozważyć react-data-grid.

- [ ] **Step 3: Commit**

```bash
git add context/changes/kosztorys-poc-in-app/change.md
git commit -m "docs(kosztorys): werdykt bake-offu edytora v1 vs v2"
```

---

## Self-Review (autor planu)

- **Pokrycie specu:** Problem/dwutrybowość → Task 1 (smoke dowodzi natywnej dwutrybowości) + Task 4. **Warunek podstawowy „jeden zbiór, trzy widoki"** → `viewPrice`/`rowNetForView`/widoko-zależne kolumny (Task 3) + przełącznik w komponencie (Task 4) + kryterium (Task 6). Wspólny rdzeń (query/actions/calc) → reużyty w Task 2–5, zero duplikacji (calc tknięty tylko addytywnie). Osobna trasa `-v2` → Task 1/5. Zakres v2 (płaski wiersz, stage\_<id>, autosave przez onChange) → Task 2–4. Kryteria oceny → Task 6. Ryzyko zgodności → Task 1 (bramka STOP). Ryzyko arm64 → Global Constraints + Task 1 Step 2. **Forward-scope (deliverable + wydatki read-only)** świadomie poza tym planem — zapisane w `change.md`. ✔
- **Placeholdery:** brak „TBD/TODO"; kod podany dla każdego kroku kodowego. „Pozostało"/select rabatu świadomie oznaczone jako follow-on (nie warunek bramki), z konkretną ścieżką realizacji. ✔
- **Spójność typów:** `KosztorysV2RowT`, `stageKey`, `RowDiffT`, `treeToRows`, `diffRow`, `buildV2Columns`, `KosztorysEditorV2({investmentId, tree})` — nazwy używane identycznie w Task 2→3→4→5. `ItemPatchT` importowane z istniejącego `lib/actions/kosztorys.ts`. ✔
- **Ryzyko otwarte (świadome):** dokładna wersja `react-datasheet-grid` i drobne nazwy z jej API (`Column`, `keyColumn`, `floatColumn`, `DynamicDataSheetGrid`, `CellProps`) potwierdzone z docs, ale finalny TS-fit zależy od zainstalowanej wersji — dlatego Task 1 jest bramką przed resztą.
