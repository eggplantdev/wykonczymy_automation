# Subtotale per sekcja (panel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dodać do edytora kosztorysu v2 prawy zwijany panel z subtotalami netto per sekcja (wg aktywnego widoku cenowego), liczonymi zawsze po pełnym zbiorze.

**Architecture:** Czysta funkcja `sectionSubtotalsForView` w `calc.ts` grupuje płaskie wiersze v2 po sekcji i sumuje `rowNetForView`. Prezentacyjny komponent `KosztorysSectionSummary` renderuje listę. Edytor okabla stan otwarcia + toggle + layout flex-row, zachowując definitywną szerokość siatki (anti-migotanie).

**Tech Stack:** React 19.2, Next 16.1, react-datasheet-grid, shadcn/ui, Tailwind v4, Vitest.

## Global Constraints

- Polish UI, English code (project rule).
- TS: `type` nie `interface`, sufiks `T`, brak `any`/`enum`, `undefined` nie `null`, brak `readonly` na propsach, alias `@/*` (brak `../../`).
- Brak ręcznych `useMemo`/`useCallback` tam, gdzie React Compiler sobie radzi — ale `subtotals` zostaje w `useMemo` bo to jawna, kosztowna agregacja po 1000 wierszy wpięta w prop (parytet z istniejącym `grandNet`/`viewRows`).
- **Anti-migotanie (load-bearing):** wrapper siatki MUSI zachować `grid grid-cols-[minmax(0,1fr)]` i dostać `min-w-0`; panel ma stałą szerokość `w-72 shrink-0`. Nie wolno dopuścić, by siatka negocjowała szerokość z treścią.
- Funkcja liczy po **pełnym zbiorze `rows`**, NIE `viewRows` — ignoruje `search` i `sort`.
- Single-file test: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`.

---

### Task 1: `sectionSubtotalsForView` + typ `SectionSubtotalT`

**Files:**

- Modify: `src/types/kosztorys.ts` (dodaj typ na końcu)
- Modify: `src/lib/kosztorys/calc.ts` (dodaj funkcję na końcu, addytywnie)
- Test: `src/__tests__/kosztorys-calc.test.ts` (dodaj `describe`)

**Interfaces:**

- Consumes: `rowNetForView(item, view)` i `PriceViewT` z `calc.ts`; `KosztorysV2RowT` z `types/kosztorys.ts` (niesie `sectionId`, `sectionName`, `displayOrder` pozycji).
- Produces:
  - `type SectionSubtotalT = { sectionId: number; sectionName: string; net: number; share: number; itemCount: number }`
  - `function sectionSubtotalsForView(rows: KosztorysV2RowT[], view: PriceViewT): SectionSubtotalT[]`

- [ ] **Step 1: Dodaj typ `SectionSubtotalT`**

W `src/types/kosztorys.ts`, na końcu pliku:

```ts
export type SectionSubtotalT = {
  sectionId: number
  sectionName: string
  net: number
  share: number // 0..1, udział w sumie netto wszystkich sekcji
  itemCount: number
}
```

- [ ] **Step 2: Napisz failing test**

W `src/__tests__/kosztorys-calc.test.ts` dopisz na górze import i fixture wierszy v2, a niżej `describe`:

```ts
// dołącz do istniejących importów:
import { sectionSubtotalsForView } from '@/lib/kosztorys/calc'
import type { KosztorysV2RowT } from '@/types/kosztorys'

// fixture: 2 sekcje, sekcja A (id 10) ma 2 pozycje, sekcja B (id 20) 1 pozycję
const v2Rows: KosztorysV2RowT[] = [
  {
    ...item, // item z górnej części pliku: sectionId 10, measuredQty 10, clientPrice 20, wTools 12
    id: 1,
    sectionId: 10,
    sectionName: 'Sekcja A',
    sectionVatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
  },
  {
    ...item,
    id: 2,
    sectionId: 10,
    sectionName: 'Sekcja A',
    sectionVatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
    measuredQty: 5,
    clientPrice: 10,
    discountType: 'percent',
    discountValue: 20, // 5×10 = 50 − 20% = 40
  },
  {
    ...item,
    id: 3,
    sectionId: 20,
    sectionName: 'Sekcja B',
    sectionVatRate: 0.08,
    sectionDefaultCostVariant: 'w_tools',
    clientPrice: 100, // 10×100 = 1000
  },
]

describe('sectionSubtotalsForView', () => {
  it('sumuje netto per sekcja, nie miesza sekcji', () => {
    const r = sectionSubtotalsForView(v2Rows, 'client')
    // Sekcja A: poz1 10×20=200 + poz2 40 = 240; Sekcja B: 1000
    expect(r.map((s) => [s.sectionId, s.net, s.itemCount])).toEqual([
      [10, 240, 2],
      [20, 1000, 1],
    ])
  })

  it('view-awareness: w_tools daje inne netto', () => {
    const r = sectionSubtotalsForView(v2Rows, 'w_tools')
    // poz1 10×12=120; poz2 5×12=60 −20% = 48 → A=168; B 10×12=120
    expect(r[0].net).toBe(168)
    expect(r[1].net).toBe(120)
  })

  it('share sumuje do ~1 gdy grandNet > 0', () => {
    const r = sectionSubtotalsForView(v2Rows, 'client')
    expect(r.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1, 10)
    expect(r[1].share).toBeCloseTo(1000 / 1240, 10)
  })

  it('guard: grandNet = 0 → share 0, bez NaN', () => {
    const zero = v2Rows.map((row) => ({ ...row, clientPrice: 0 }))
    const r = sectionSubtotalsForView(zero, 'client')
    expect(r.every((s) => s.share === 0)).toBe(true)
  })
})
```

- [ ] **Step 3: Uruchom test — ma FAILOWAĆ**

Run: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`
Expected: FAIL — `sectionSubtotalsForView is not a function` / brak eksportu.

- [ ] **Step 4: Implementacja w `calc.ts`**

Na końcu `src/lib/kosztorys/calc.ts` (po `rowRemainingForView`):

```ts
import type { KosztorysV2RowT, SectionSubtotalT } from '@/types/kosztorys'

/**
 * Subtotale netto per sekcja wg aktywnego widoku cenowego. Liczone po pełnym
 * zbiorze (ignoruje filtr/sort). Kolejność = pierwszego wystąpienia sekcji w
 * `rows` (treeToRows daje już porządek sekcja→displayOrder).
 */
export function sectionSubtotalsForView(
  rows: KosztorysV2RowT[],
  view: PriceViewT,
): SectionSubtotalT[] {
  const bySection = new Map<number, SectionSubtotalT>()
  for (const row of rows) {
    let acc = bySection.get(row.sectionId)
    if (!acc) {
      acc = {
        sectionId: row.sectionId,
        sectionName: row.sectionName,
        net: 0,
        share: 0,
        itemCount: 0,
      }
      bySection.set(row.sectionId, acc)
    }
    acc.net += rowNetForView(row, view)
    acc.itemCount += 1
  }
  const result = [...bySection.values()]
  const grandNet = result.reduce((sum, s) => sum + s.net, 0)
  if (grandNet > 0) for (const s of result) s.share = s.net / grandNet
  return result
}
```

> Import `KosztorysV2RowT`/`SectionSubtotalT` dołącz do istniejącego importu z `@/types/kosztorys` na górze `calc.ts` (obecnie importuje `CostVariantT, KosztorysItemT, KosztorysSectionT`).

- [ ] **Step 5: Uruchom test — ma PRZEJŚĆ**

Run: `pnpm exec vitest run src/__tests__/kosztorys-calc.test.ts`
Expected: PASS (wszystkie `describe`, w tym istniejące).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: brak błędów.

```bash
git add src/types/kosztorys.ts src/lib/kosztorys/calc.ts src/__tests__/kosztorys-calc.test.ts
git commit -m "feat(kosztorys): sectionSubtotalsForView — subtotale netto per sekcja wg widoku"
```

---

### Task 2: Komponent panelu `KosztorysSectionSummary`

**Files:**

- Create: `src/components/kosztorys/kosztorys-section-summary.tsx`

**Interfaces:**

- Consumes: `SectionSubtotalT` z `types/kosztorys.ts`; `Button` z `@/components/ui/button`.
- Produces: `function KosztorysSectionSummary(props: PropsT)` gdzie
  `PropsT = { subtotals: SectionSubtotalT[]; grandNet: number; onClose: () => void }`.

> Brak testu jednostkowego — komponent czysto prezentacyjny, weryfikacja w przeglądarce w Task 3. Logika liczenia jest w Task 1 (pokryta).

- [ ] **Step 1: Utwórz komponent**

`src/components/kosztorys/kosztorys-section-summary.tsx`:

```tsx
'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SectionSubtotalT } from '@/types/kosztorys'

type PropsT = {
  subtotals: SectionSubtotalT[]
  grandNet: number
  onClose: () => void
}

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function KosztorysSectionSummary({ subtotals, grandNet, onClose }: PropsT) {
  return (
    <aside className="border-border flex w-72 shrink-0 flex-col overflow-hidden border-l">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
        <h2 className="text-foreground text-sm font-medium">Sekcje</h2>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
        {subtotals.map((s) => (
          <li key={s.sectionId} className="px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground truncate text-sm">{s.sectionName}</span>
              <span className="text-foreground shrink-0 text-sm tabular-nums">{fmt(s.net)}</span>
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{s.itemCount} poz.</span>
              <span className="tabular-nums">{(s.share * 100).toFixed(1)}%</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-border flex shrink-0 items-baseline justify-between border-t px-3 py-2">
        <span className="text-foreground text-sm font-medium">Suma netto</span>
        <span className="text-foreground text-sm font-medium tabular-nums">{fmt(grandNet)}</span>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: brak błędów. (`X` z `lucide-react` — sprawdź że jest w zależnościach; w repo jest, używany w innych komponentach.)

- [ ] **Step 3: Commit**

```bash
git add src/components/kosztorys/kosztorys-section-summary.tsx
git commit -m "feat(kosztorys): panel KosztorysSectionSummary (prezentacja subtotali)"
```

---

### Task 3: Okablowanie w edytorze v2 (stan, toggle, layout)

**Files:**

- Modify: `src/components/kosztorys/kosztorys-editor-v2.tsx`

**Interfaces:**

- Consumes: `sectionSubtotalsForView` (Task 1), `KosztorysSectionSummary` (Task 2).
- Produces: brak — to wpięcie końcowe.

> Brak nowego unit-testu (UI pochodne; logika w Task 1). Weryfikacja w przeglądarce — kroki niżej.

- [ ] **Step 1: Importy**

W `src/components/kosztorys/kosztorys-editor-v2.tsx` dołącz:

```tsx
import { KosztorysSectionSummary } from '@/components/kosztorys/kosztorys-section-summary'
```

oraz do istniejącego importu z `@/lib/kosztorys/calc` dopisz `sectionSubtotalsForView`:

```tsx
import {
  rowNetForView,
  rowRemainingForView,
  sectionSubtotalsForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
```

- [ ] **Step 2: Stan + grandNet pełnego zbioru + subtotale**

W ciele komponentu, obok istniejących `useState`:

```tsx
const [summaryOpen, setSummaryOpen] = useState(true)
```

Subtotale liczone z PEŁNEGO `rows` (nie `viewRows`) — pełna, stabilna rozpiska:

```tsx
const subtotals = useMemo(() => sectionSubtotalsForView(rows, view), [rows, view])
const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])
```

> `grandNet` (istniejące, filtro-świadome z `viewRows`) ZOSTAJE w toolbarze bez zmian. `totalNet` (pełny zbiór) idzie do panelu — dwa różne liczniki, celowo.

- [ ] **Step 3: Przycisk-toggle w toolbarze**

W toolbarze, w `<div className="ml-auto">` zmień na grupę dwóch kontrolek:

```tsx
<div className="ml-auto flex items-center gap-1">
  <Button
    size="sm"
    variant={summaryOpen ? 'default' : 'outline'}
    onClick={() => setSummaryOpen((o) => !o)}
  >
    Sekcje
  </Button>
  <DatasheetColumnToggle columns={toggleable} hidden={hidden} onToggle={toggleColumn} />
</div>
```

- [ ] **Step 4: Layout flex-row — siatka + panel**

Owiń istniejący `<div ref={gridRef} ...>` (wrapper siatki) i panel we wspólny flex-row. Zmień blok renderujący siatkę tak:

```tsx
<div className="flex min-h-0 flex-1 overflow-hidden">
  {/* Wrapper siatki: min-w-0 + grid minmax(0,1fr) = definitywna szerokość (anti-migotanie). */}
  <div
    ref={gridRef}
    className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden"
  >
    <DataSheetGrid
      className="kosztorys-grid"
      value={viewRows}
      onChange={onChange}
      columns={columns}
      height={gridHeight}
      rowHeight={32}
      headerRowHeight={32}
      lockRows
      rowKey={({ rowData }) => String(rowData.id)}
    />
  </div>
  {summaryOpen && (
    <KosztorysSectionSummary
      subtotals={subtotals}
      grandNet={totalNet}
      onClose={() => setSummaryOpen(false)}
    />
  )}
</div>
```

> Kluczowe różnice vs obecny kod: (a) nowy zewnętrzny `flex` owija siatkę+panel i przejmuje `min-h-0 flex-1`; (b) wrapper siatki traci `flex-1` na rzecz nowego rodzica, ale ZACHOWUJE `grid grid-cols-[minmax(0,1fr)]` i dodaje `min-w-0` — to chroni przed migotaniem. `useElementHeight` dalej mierzy wrapper siatki (ref bez zmian).

- [ ] **Step 5: Typecheck + build**

Run: `pnpm typecheck`
Expected: brak błędów.

Run: `pnpm exec next build`
Expected: PASS (trasa edytora kompiluje się).

- [ ] **Step 6: Weryfikacja w przeglądarce**

`PORT=3001 pnpm dev`, login temp OWNER `poc@local.test` / `poc12345`, wejdź na `/inwestycje/7/kosztorys-edytor-v2` („test kosztorys Sienicka", 224 poz.).

Sprawdź:

- Panel po prawej domyślnie otwarty, lista sekcji z netto + % + liczbą pozycji; stopka „Suma netto".
- Przełącznik widoku (Robocizna / Z narzędziami / Bez narzędzi) → panel przelicza netto. (Uwaga: dla inw. 7 widoki narzędziowe pokazują 0 — arkusz ma tylko ceny klienta; to oczekiwane.)
- Szukajka „kominek" → siatka i toolbar grand-net reagują, **panel pozostaje stabilny** (pełen zestaw sekcji, niezmieniony).
- Sort kolumny → panel niezmieniony.
- Toggle „Sekcje" zwija/rozwija panel; siatka odzyskuje pełną szerokość.
- **Anti-migotanie:** otwarty panel, DevTools → Issues ~0/s, szerokość siatki stała (brak oscylacji navbara/„Kolumny").

- [ ] **Step 7: Commit**

```bash
git add src/components/kosztorys/kosztorys-editor-v2.tsx
git commit -m "feat(kosztorys): prawy panel subtotali w edytorze v2 (toggle, layout flex-row)"
```

---

## Self-Review

**Spec coverage:**

- Decyzja A (panel, nie wiersze) → Task 2 + 3. ✅
- Prawy panel zwijany, domyślnie otwarty → Task 3 Step 2–4. ✅
- Subtotale pełny zbiór, niezależne od filtra/sortu → Task 1 (czysta fn) + Task 3 Step 2 (`rows`, nie `viewRows`). ✅
- Metryki: nazwa/netto/udział %/liczba pozycji + stopka suma → Task 2. ✅
- Gotcha anti-migotanie → Global Constraints + Task 3 Step 4 (zachowany `grid-cols-[minmax(0,1fr)]` + `min-w-0`). ✅
- Testy: sumy/kolejność/view-awareness/rabat/share/guard → Task 1 Step 2. Browser-verify → Task 3 Step 6. ✅

**Placeholder scan:** Brak TODO/TBD; fixture w Task 1 Step 2 podany jednoznacznie (komplet pól sekcji w każdym wierszu).

**Type consistency:** `SectionSubtotalT` (Task 1) używany identycznie w Task 2 (`PropsT.subtotals`) i Task 3. `sectionSubtotalsForView(rows, view)` — sygnatura spójna we wszystkich taskach. `onClose: () => void`, `grandNet`/`totalNet` — `totalNet` (pełny zbiór) świadomie podawany jako prop `grandNet` panelu (panel nie wie o filtrze).
