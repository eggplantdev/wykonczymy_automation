# Kosztorys v2 — edytowalność strukturalna, Slice 1 (add/remove pozycji + sekcji) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zdjąć `lockRows` jako blokadę struktury — pozwolić dodawać/usuwać pozycje i sekcje oraz zmieniać nazwę sekcji w edytorze v2, sterowane z panelu „Sekcje" (pulpit) i kolumny akcji w siatce.

**Architecture:** Strukturę zmieniamy **wyłącznie optymistycznym splice'em na `rows` (`setRows`)** — `lockRows` ZOSTAJE włączone (nie dotykamy mechaniki wierszy dsg). dsg dalej tylko renderuje reaktywne `value`. Serwerowe akcje (`add*/remove*/updateSectionFieldAction`) lecą w tle; ich zwroty (`{ id, displayOrder }`) zasilają budowę optymistycznego wiersza. „Widok pojedynczej sekcji" = tryb filtra na `activeSectionId`, nie osobna powierzchnia.

**Tech Stack:** Next.js (App Router, server actions), React (React Compiler enabled), `react-datasheet-grid` 4.x, Payload CMS, TypeScript, Tailwind v4, Shadcn UI, lucide-react.

## Global Constraints

- **Polish UI, English code** (kod + identyfikatory po angielsku; teksty UI po polsku).
- **`lockRows` pozostaje** na `<DataSheetGrid>` — struktura zmieniana tylko własnymi przyciskami + `setRows`, nigdy mechaniką wierszy dsg.
- **Typy z sufiksem `T`**, `type` zamiast `interface`, brak `any` poza istniejącym mostem biblioteki, brak `readonly` na propsach/typach, `undefined` zamiast `null` dla nowych pól opcjonalnych (istniejące `null` z modelu pozycji zostają — to kontrakt DB/Payload).
- **Bez ręcznego `useMemo`/`useCallback`** — React Compiler to ogarnia.
- **Bez `useEffect`** (reguła projektu) — synchronizacja `rowsRef` przez przypisanie w trakcie renderu.
- **Inwariant: sekcja ma ≥1 pozycję.** Usunięcie ostatniej pozycji sekcji jest zablokowane (kosz nieaktywny).
- **Testy odłożone** (decyzja właściciela 2026-06-20) — brak kroków TDD; weryfikacja ręczna w przeglądarce. Gdy testy wrócą: jednostkowo czyste helpery z Task 1 + inwariant „≥1 pozycja".
- **Commit tylko własne zmiany, po jawnej ścieżce** (równoległe agenty w jednym drzewie — nigdy `git add -A`). Nie pushować.

## Odchylenie od specu (świadome, zatwierdzić w trakcie)

Spec (§Model stanu, „Sekcje") zakłada, że po add/remove sekcji `router.refresh()` **reseeduje** `rows` ze świeżego `tree`. **To nieprawda przy obecnym kodzie:** `rows` to `useState(() => treeToRows(tree))` — inicjalizator odpala się **raz**; `router.refresh()` podmienia prop `tree`, ale `useState` ignoruje nowy initializer, więc `rows` się NIE przeseeduje. Dlatego ten plan robi **sekcje też optymistycznym splice'em** (spójnie z pozycjami), bez polegania na reseedzie:

- **Add sekcji** — znamy z `addSectionAction` defaulty (`name='Nowa sekcja'`, `vatRate=0.08`, `defaultCostVariant='w_tools'`) i z `addItemAction` zwrot `{ id, displayOrder }` → budujemy pusty wiersz lokalnie i dopinamy.
- **Remove sekcji** — filtrujemy `rows` po `sectionId` lokalnie.
- **Rename sekcji** — nadpisujemy zdenormalizowane `sectionName` we wszystkich wierszach sekcji lokalnie.

Konsekwencja: **`router.refresh()` dla operacji strukturalnych jest zbędny** (subtotale/`grandNet` liczone z lokalnych `rows`, nie z serwera) i go **nie wywołujemy** — mniej migotania, brak zależności od reseedu. Po mount `tree` nie jest już źródłem prawdy poza `tree.stages` (stałe w Slice 1).

---

## Pliki — mapa odpowiedzialności

- **`src/lib/kosztorys/v2-rows.ts`** (modify) — czyste helpery struktury: `buildBlankRow`, `applyAddItem`, `applyRemoveItem`, `sectionItemCount` + stała `NEW_SECTION_DEFAULTS`. Bez Reacta, jednostkowo testowalne.
- **`src/lib/tables/kosztorys-v2-columns.tsx`** (modify) — kolumna akcji (kosz, fixed 44px, nie-resizable, nie-toggleable), `sectionName` → `disabled: true`; nowe pola w `BuildV2ColumnsOptsT`.
- **`src/components/kosztorys/kosztorys-section-summary.tsx`** (modify) — panel read-only → pulpit: ＋sekcja, rename inline, kosz+confirm, klik nazwy=filtr, ＋pozycja, „Pokaż wszystkie".
- **`src/components/kosztorys/kosztorys-editor-v2.tsx`** (modify) — `activeSectionId`, `rowsRef`, handlery struktury, filtr w `viewRows`, przekazanie callbacków do panelu i `buildV2Columns`, destrukturyzacja `investmentId`, ＋pozycja na górnym pasku gdy zafiltrowano.

Bez zmian w `src/lib/actions/kosztorys.ts` — wszystkie potrzebne akcje już istnieją; defaulty sekcji mirrorujemy w `NEW_SECTION_DEFAULTS` (`'use server'` nie pozwala eksportować stałych, więc duplikat z komentarzem-kotwicą jest konieczny).

---

### Task 1: Czyste helpery struktury w `v2-rows.ts`

**Files:**

- Modify: `src/lib/kosztorys/v2-rows.ts`

**Interfaces:**

- Consumes: `KosztorysV2RowT`, `KosztorysStageT`, `CostVariantT` z `@/types/kosztorys`; istniejące `stageKey`.
- Produces:
  - `NEW_SECTION_DEFAULTS: { name: string; vatRate: number; defaultCostVariant: CostVariantT }`
  - `buildBlankRow(input: BlankRowInputT): KosztorysV2RowT`, gdzie `BlankRowInputT = { id: number; displayOrder: number; sectionId: number; sectionName: string; sectionVatRate: number; sectionDefaultCostVariant: CostVariantT; stages: KosztorysStageT[] }`
  - `applyAddItem(rows: KosztorysV2RowT[], row: KosztorysV2RowT): KosztorysV2RowT[]`
  - `applyRemoveItem(rows: KosztorysV2RowT[], itemId: number): KosztorysV2RowT[]`
  - `sectionItemCount(rows: KosztorysV2RowT[], sectionId: number): number`

- [ ] **Step 1: Rozszerz import typów o `CostVariantT`**

W `src/lib/kosztorys/v2-rows.ts` zmień linię importu typów:

```ts
import type {
  CostVariantT,
  KosztorysStageT,
  KosztorysTreeT,
  KosztorysV2RowT,
} from '@/types/kosztorys'
```

- [ ] **Step 2: Dopisz stałą defaultów sekcji i helpery struktury (na końcu pliku)**

```ts
// Domyślne wartości nowej sekcji. MUSZĄ odpowiadać addSectionAction w
// src/lib/actions/kosztorys.ts — pliku 'use server' nie wolno eksportować stałych,
// więc trzymamy mirror tu i budujemy z niego optymistyczny wiersz (bez czekania na refresh).
export const NEW_SECTION_DEFAULTS = {
  name: 'Nowa sekcja',
  vatRate: 0.08,
  defaultCostVariant: 'w_tools',
} as const satisfies { name: string; vatRate: number; defaultCostVariant: CostVariantT }

export type BlankRowInputT = {
  id: number
  displayOrder: number
  sectionId: number
  sectionName: string
  sectionVatRate: number
  sectionDefaultCostVariant: CostVariantT
  stages: KosztorysStageT[]
}

// Pusty wiersz pozycji = serwerowe defaulty addItemAction + zdenormalizowane pola sekcji
// + stage_*=0. Budowany optymistycznie ze znanego id/displayOrder zwróconego przez akcję.
export function buildBlankRow(input: BlankRowInputT): KosztorysV2RowT {
  const stageFields: Record<string, number> = {}
  for (const st of input.stages) stageFields[stageKey(st.id)] = 0
  return {
    id: input.id,
    sectionId: input.sectionId,
    displayOrder: input.displayOrder,
    description: null,
    unit: null,
    plannedQty: 0,
    measuredQty: 0,
    discountType: null,
    discountValue: 0,
    clientPrice: 0,
    subcontractorWToolsPrice: 0,
    subcontractorOwnToolsPrice: 0,
    costVariant: null,
    vatRate: null,
    hiddenInExport: false,
    note: null,
    sectionName: input.sectionName,
    sectionVatRate: input.sectionVatRate,
    sectionDefaultCostVariant: input.sectionDefaultCostVariant,
    ...stageFields,
  } as KosztorysV2RowT
}

export function applyAddItem(rows: KosztorysV2RowT[], row: KosztorysV2RowT): KosztorysV2RowT[] {
  return [...rows, row]
}

export function applyRemoveItem(rows: KosztorysV2RowT[], itemId: number): KosztorysV2RowT[] {
  return rows.filter((r) => r.id !== itemId)
}

// Liczba pozycji sekcji w pełnym zbiorze — strażnik inwariantu „sekcja ma ≥1 pozycję".
export function sectionItemCount(rows: KosztorysV2RowT[], sectionId: number): number {
  return rows.reduce((n, r) => (r.sectionId === sectionId ? n + 1 : n), 0)
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (brak błędów).

- [ ] **Step 4: Commit**

```bash
git add src/lib/kosztorys/v2-rows.ts
git commit -m "feat(kosztorys): czyste helpery struktury v2 (buildBlankRow/applyAddItem/applyRemoveItem/sectionItemCount)"
```

---

### Task 2: Kolumna akcji (kosz) + `sectionName` read-only w `kosztorys-v2-columns.tsx`

**Files:**

- Modify: `src/lib/tables/kosztorys-v2-columns.tsx`

**Interfaces:**

- Consumes: `buildBlankRow` nieużywane tu; `sectionItemCount` NIE wołane tu (count dostarcza editor przez callback) — kolumna dostaje gotowe callbacki.
- Produces (rozszerzenie `BuildV2ColumnsOptsT`):
  - `onRemoveItem?: (row: KosztorysV2RowT) => void`
  - `getSectionItemCount?: (sectionId: number) => number`
  - Kolumna o `id: 'actions'` jako pierwsza, gdy `onRemoveItem` podane.

- [ ] **Step 1: Dodaj import ikony kosza**

W bloku importów na górze pliku dodaj:

```ts
import { Trash2 } from 'lucide-react'
```

- [ ] **Step 2: Rozszerz `BuildV2ColumnsOptsT` o callbacki akcji**

Do typu `BuildV2ColumnsOptsT` (po polach resize) dopisz:

```ts
  // Akcje na wierszu: usuwanie pozycji + odczyt liczby pozycji sekcji (do blokady
  // inwariantu „≥1 pozycja"). Oba czytają świeży stan z editora (ref) — bo dsg zamraża
  // `columns` na montażu, więc closure MUSI czytać aktualne dane, nie snapshot z mountu.
  onRemoveItem?: (row: KosztorysV2RowT) => void
  getSectionItemCount?: (sectionId: number) => number
```

- [ ] **Step 3: Ustaw `sectionName` jako read-only**

W `buildV2Columns`, w tablicy `left`, do `rest` kolumny `sectionName` dodaj `disabled: true` (nazwę sekcji zmienia się wyłącznie z panelu — edycja per-wiersz zmieniałaby tylko kopię tego wiersza, ukryty bug):

```ts
    keyCol('sectionName', textColumn, {
      id: 'sectionName',
      title: title('sectionName', 'Sekcja', opts),
      minWidth: 140,
      disabled: true,
    }),
```

- [ ] **Step 4: Dodaj fabrykę kolumny akcji (przed `buildV2Columns`)**

```tsx
// Kolumna akcji: kosz usuwający pozycję. Sztywne 44px, nie-resizable, nie-toggleable.
// Kosz nieaktywny gdy to ostatnia pozycja sekcji (inwariant „sekcja ma ≥1 pozycję").
function actionColumn(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT> {
  const onRemove = opts.onRemoveItem
  const getCount = opts.getSectionItemCount
  return {
    id: 'actions',
    title: '',
    basis: 44,
    grow: 0,
    shrink: 0,
    minWidth: 44,
    maxWidth: 44,
    disabled: true,
    component: ({ rowData }) => {
      const isLast = getCount ? getCount(rowData.sectionId) <= 1 : false
      return (
        <div className="flex size-full items-center justify-center">
          <button
            type="button"
            disabled={isLast}
            title={isLast ? 'Sekcja musi mieć co najmniej jedną pozycję' : 'Usuń pozycję'}
            onClick={() => onRemove?.(rowData)}
            className="text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    },
  }
}
```

- [ ] **Step 5: Wepnij kolumnę akcji jako pierwszą w zwrocie `buildV2Columns`**

Zamień końcowy `return` w `buildV2Columns`:

```ts
const base = [...left, ...stageCols, ...computed].map((c) => withResize(c, opts))
return opts.onRemoveItem ? [actionColumn(opts), ...base] : base
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/tables/kosztorys-v2-columns.tsx
git commit -m "feat(kosztorys): kolumna akcji (kosz) + read-only Sekcja w siatce v2"
```

---

### Task 3: Panel „Sekcje" jako pulpit — `kosztorys-section-summary.tsx`

**Files:**

- Modify: `src/components/kosztorys/kosztorys-section-summary.tsx`

**Interfaces:**

- Consumes: `SectionSubtotalT` (ma `sectionId`, `sectionName`, `net`, `share`, `itemCount`).
- Produces (nowy `PropsT`):
  - `subtotals: SectionSubtotalT[]`, `grandNet: number`, `activeSectionId: number | null`, `onClose: () => void`
  - `onAddSection: () => void`, `onAddItem: (sectionId: number) => void`
  - `onRenameSection: (sectionId: number, name: string) => void`
  - `onRemoveSection: (sectionId: number) => void`
  - `onFilterSection: (sectionId: number | null) => void`

> **Uwaga koordynacyjna:** ten plik jest aktualnie rozwijany (prawy panel subtotali, commit `5b56a8b`). Przed edycją zrób `git diff src/components/kosztorys/kosztorys-section-summary.tsx` i potwierdź brak niezacommitowanej pracy nad nim; jeśli jest — wstrzymaj się i zgłoś konflikt zamiast nadpisywać.

- [ ] **Step 1: Zastąp całą zawartość pliku wersją-pulpitem**

```tsx
'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SectionSubtotalT } from '@/types/kosztorys'

type PropsT = {
  subtotals: SectionSubtotalT[]
  grandNet: number
  activeSectionId: number | null
  onClose: () => void
  onAddSection: () => void
  onAddItem: (sectionId: number) => void
  onRenameSection: (sectionId: number, name: string) => void
  onRemoveSection: (sectionId: number) => void
  onFilterSection: (sectionId: number | null) => void
}

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function KosztorysSectionSummary({
  subtotals,
  grandNet,
  activeSectionId,
  onClose,
  onAddSection,
  onAddItem,
  onRenameSection,
  onRemoveSection,
  onFilterSection,
}: PropsT) {
  // Inline rename: id edytowanej sekcji + bufor nazwy. null = nic nie edytujemy.
  const [editId, setEditId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')

  function startEdit(sectionId: number, name: string) {
    setEditId(sectionId)
    setDraft(name)
  }

  function commitEdit() {
    const name = draft.trim()
    if (editId != null && name) onRenameSection(editId, name)
    setEditId(null)
  }

  function confirmRemove(s: SectionSubtotalT) {
    if (window.confirm(`Usunąć sekcję „${s.sectionName}"? Usunie też ${s.itemCount} pozycji.`)) {
      onRemoveSection(s.sectionId)
    }
  }

  return (
    <aside className="border-border flex w-72 shrink-0 flex-col overflow-hidden border-l">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
        <h2 className="text-foreground text-sm font-medium">Sekcje</h2>
        <div className="flex items-center gap-1">
          {activeSectionId != null && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              onClick={() => onFilterSection(null)}
            >
              Pokaż wszystkie
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
        {subtotals.map((s) => {
          const isActive = s.sectionId === activeSectionId
          const isEditing = s.sectionId === editId
          return (
            <li key={s.sectionId} className={`px-3 py-2 ${isActive ? 'bg-accent/40' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                {isEditing ? (
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit()
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    className="h-7 text-sm"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => onFilterSection(isActive ? null : s.sectionId)}
                    className="text-foreground truncate text-left text-sm hover:underline"
                    title="Filtruj do tej sekcji"
                  >
                    {s.sectionName}
                  </button>
                )}
                <span className="text-foreground shrink-0 text-sm tabular-nums">{fmt(s.net)}</span>
              </div>

              <div className="text-muted-foreground mt-1 flex items-center justify-between text-xs">
                <span>
                  {s.itemCount} poz. · {(s.share * 100).toFixed(1)}%
                </span>
                <div className="flex items-center gap-0.5">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={commitEdit}
                        title="Zapisz nazwę"
                        className="hover:text-foreground p-1"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        title="Anuluj"
                        className="hover:text-foreground p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onAddItem(s.sectionId)}
                        title="Dodaj pozycję"
                        className="hover:text-foreground p-1"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(s.sectionId, s.sectionName)}
                        title="Zmień nazwę"
                        className="hover:text-foreground p-1"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmRemove(s)}
                        title="Usuń sekcję"
                        className="hover:text-destructive p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="border-border shrink-0 border-t p-2">
        <Button size="sm" variant="outline" className="w-full" onClick={onAddSection}>
          <Plus className="mr-1 h-4 w-4" /> Nowa sekcja
        </Button>
      </div>
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
Expected: błąd w `kosztorys-editor-v2.tsx` — `KosztorysSectionSummary` wołane bez nowych wymaganych propsów. To **oczekiwane**, zostanie naprawione w Task 4. Sam plik panelu kompiluje się czysto.

- [ ] **Step 3: Commit**

```bash
git add src/components/kosztorys/kosztorys-section-summary.tsx
git commit -m "feat(kosztorys): panel Sekcje jako pulpit (add/rename/remove/filtr/+pozycja)"
```

---

### Task 4: Wpięcie handlerów struktury w `kosztorys-editor-v2.tsx`

**Files:**

- Modify: `src/components/kosztorys/kosztorys-editor-v2.tsx`

**Interfaces:**

- Consumes: `buildBlankRow`, `applyAddItem`, `applyRemoveItem`, `sectionItemCount`, `NEW_SECTION_DEFAULTS` z `@/lib/kosztorys/v2-rows`; akcje `addItemAction`, `removeItemAction`, `addSectionAction`, `removeSectionAction`, `updateSectionFieldAction` z `@/lib/actions/kosztorys`; nowe propsy panelu (Task 3) i opts kolumn (Task 2).
- Produces: kompletny edytor z `activeSectionId`, `rowsRef`, handlerami i ＋pozycja na pasku.

- [ ] **Step 1: Destrukturyzuj `investmentId` z propsów**

```ts
export function KosztorysEditorV2({ investmentId, tree, investmentName }: PropsT) {
```

- [ ] **Step 2: Rozszerz importy**

W imporcie z `@/lib/kosztorys/v2-rows` dodaj nowe helpery:

```ts
import {
  applyAddItem,
  applyRemoveItem,
  buildBlankRow,
  diffRow,
  filterRows,
  NEW_SECTION_DEFAULTS,
  revertField,
  rowDoneNetForView,
  sectionItemCount,
  sortRows,
  stageKey,
  treeToRows,
  type SortDirT,
} from '@/lib/kosztorys/v2-rows'
```

W imporcie z `@/lib/actions/kosztorys` dodaj akcje struktury:

```ts
import {
  addItemAction,
  addSectionAction,
  removeItemAction,
  removeSectionAction,
  setStageProgressAction,
  updateItemFieldAction,
  updateSectionFieldAction,
  type ItemPatchT,
} from '@/lib/actions/kosztorys'
```

- [ ] **Step 3: Dodaj stan `activeSectionId` i `rowsRef` (obok pozostałych stanów)**

Po `const [sort, setSort] = useState<SortStateT>(null)` dodaj:

```ts
const [activeSectionId, setActiveSectionId] = useState<number | null>(null)
```

Po linii `const prevById = useRef(...)` dodaj ref na świeże `rows` (czytany przez frozen-closure kolumny akcji — dsg zamraża `columns`, więc callback MUSI czytać ref, nie snapshot):

```ts
// Świeży zbiór wierszy dla closure'ów kolumny akcji (dsg zamraża `columns` na montażu).
const rowsRef = useRef(rows)
rowsRef.current = rows
```

- [ ] **Step 4: Dodaj handlery struktury (przed `function onChange`)**

```ts
async function handleAddItem(sectionId: number) {
  const res = await addItemAction(investmentId, sectionId)
  if (!res.success) return
  const sample = rowsRef.current.find((r) => r.sectionId === sectionId)
  const row = buildBlankRow({
    id: res.data.id,
    displayOrder: res.data.displayOrder,
    sectionId,
    sectionName: sample?.sectionName ?? NEW_SECTION_DEFAULTS.name,
    sectionVatRate: sample?.sectionVatRate ?? NEW_SECTION_DEFAULTS.vatRate,
    sectionDefaultCostVariant:
      sample?.sectionDefaultCostVariant ?? NEW_SECTION_DEFAULTS.defaultCostVariant,
    stages: tree.stages,
  })
  prevById.current.set(row.id, row)
  setRows((rs) => applyAddItem(rs, row))
}

function handleRemoveItem(row: KosztorysV2RowT) {
  // Inwariant: sekcja ma ≥1 pozycję — nie usuwaj ostatniej (kosz i tak nieaktywny).
  if (sectionItemCount(rowsRef.current, row.sectionId) <= 1) return
  prevById.current.delete(row.id)
  setRows((rs) => applyRemoveItem(rs, row.id))
  void removeItemAction(row.id)
}

async function handleAddSection() {
  const sec = await addSectionAction(investmentId)
  if (!sec.success) return
  // Nowa sekcja od razu dostaje pustą pozycję (pusta sekcja = 0 wierszy = niewidoczna).
  const item = await addItemAction(investmentId, sec.data.id)
  if (!item.success) return
  const row = buildBlankRow({
    id: item.data.id,
    displayOrder: item.data.displayOrder,
    sectionId: sec.data.id,
    sectionName: NEW_SECTION_DEFAULTS.name,
    sectionVatRate: NEW_SECTION_DEFAULTS.vatRate,
    sectionDefaultCostVariant: NEW_SECTION_DEFAULTS.defaultCostVariant,
    stages: tree.stages,
  })
  prevById.current.set(row.id, row)
  setRows((rs) => applyAddItem(rs, row))
}

function handleRemoveSection(sectionId: number) {
  setRows((rs) => rs.filter((r) => r.sectionId !== sectionId))
  for (const [id, r] of prevById.current) {
    if (r.sectionId === sectionId) prevById.current.delete(id)
  }
  if (activeSectionId === sectionId) setActiveSectionId(null)
  void removeSectionAction(sectionId)
}

function handleRenameSection(sectionId: number, name: string) {
  // Nazwa zdenormalizowana na każdym wierszu sekcji — nadpisz lokalnie wszystkie.
  setRows((rs) => rs.map((r) => (r.sectionId === sectionId ? { ...r, sectionName: name } : r)))
  for (const [id, r] of prevById.current) {
    if (r.sectionId === sectionId) prevById.current.set(id, { ...r, sectionName: name })
  }
  void updateSectionFieldAction(sectionId, { name })
}
```

- [ ] **Step 5: Dołóż callbacki akcji do `buildV2Columns`**

W obiekcie opts przekazywanym do `buildV2Columns` dodaj dwa pola:

```ts
const allColumns = buildV2Columns({
  stages: tree.stages,
  view,
  sort,
  onToggleSort: toggleSort,
  widths,
  onGuide: setGuideX,
  onCommitColumn: setWidth,
  onRemoveItem: handleRemoveItem,
  getSectionItemCount: (sid) => sectionItemCount(rowsRef.current, sid),
})
```

- [ ] **Step 6: Wpnij `activeSectionId` w filtr `viewRows`**

Zamień ciało memo `viewRows`:

```ts
const viewRows = useMemo(() => {
  const scoped =
    activeSectionId == null ? rows : rows.filter((r) => r.sectionId === activeSectionId)
  const filtered = filterRows(scoped, search)
  if (!sort) return filtered
  return sortRows(filtered, (r) => sortValue(r, sort.field, view, tree.stages), sort.dir)
}, [rows, activeSectionId, search, sort, view, tree.stages])
```

- [ ] **Step 7: Dodaj ＋pozycja na górnym pasku gdy zafiltrowano do sekcji**

W górnym pasku, zaraz po bloku `<Input ... />` (przed `<span>` z licznikiem), wstaw:

```tsx
{
  activeSectionId != null && (
    <Button size="sm" variant="outline" onClick={() => handleAddItem(activeSectionId)}>
      ＋ pozycja
    </Button>
  )
}
```

- [ ] **Step 8: Przekaż nowe propsy do `<KosztorysSectionSummary>`**

Zamień wywołanie panelu:

```tsx
{
  summaryOpen && (
    <KosztorysSectionSummary
      subtotals={subtotals}
      grandNet={totalNet}
      activeSectionId={activeSectionId}
      onClose={() => setSummaryOpen(false)}
      onAddSection={handleAddSection}
      onAddItem={handleAddItem}
      onRenameSection={handleRenameSection}
      onRemoveSection={handleRemoveSection}
      onFilterSection={setActiveSectionId}
    />
  )
}
```

- [ ] **Step 9: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS (zero błędów; w szczególności panel z Task 3 ma teraz komplet propsów).

- [ ] **Step 10: Commit**

```bash
git add src/components/kosztorys/kosztorys-editor-v2.tsx
git commit -m "feat(kosztorys): edytowalność strukturalna v2 (add/remove pozycji+sekcji, filtr sekcji)"
```

---

### Task 5: Ręczna weryfikacja w przeglądarce (POC — testy odłożone)

**Files:** brak zmian kodu (chyba że QA ujawni regresję → osobny fix-commit).

> Login lokalny bywa zależny od fixture'ów — patrz notatka „project_local_login_and_test_fixtures" (tymczasowy OWNER skryptem Local API, dev często na :3001, użyć istniejących test-kosztorysów). DB to lokalny Docker (port bazy POC `wykonczymy-poc`).

- [ ] **Step 1: Odpal dev i otwórz edytor v2**

Run: `pnpm dev` → otwórz `/inwestycje/<id>/kosztorys-edytor-v2` dla istniejącego test-kosztorysu.

- [ ] **Step 2: Przejdź checklistę akceptacyjną (każdy punkt = obserwowalny efekt)**

- [ ] Kolumna „Sekcja" w siatce jest **nieedytowalna** (klik nie wchodzi w edycję).
- [ ] Kosz w wierszu usuwa pozycję natychmiast; przy sekcji z **jedną** pozycją kosz jest **wyszarzony** (inwariant ≥1).
- [ ] „Nowa sekcja" w panelu tworzy sekcję z **jedną pustą pozycją**, widoczną od razu w siatce.
- [ ] ＋pozycja w panelu (przy sekcji) dopina pusty wiersz z poprawną nazwą/VAT sekcji.
- [ ] Ołówek → edycja inline → Enter zmienia nazwę sekcji we **wszystkich** jej wierszach w siatce.
- [ ] Kosz przy sekcji pyta o potwierdzenie („usunie też N pozycji") i po OK usuwa sekcję + jej wiersze; jeśli była zafiltrowana → filtr czyści się na „wszystkie".
- [ ] Klik nazwy sekcji w panelu **filtruje** siatkę do tej sekcji; „Pokaż wszystkie" / ＋pozycja na pasku działają w trybie filtra.
- [ ] Filtr + szukajka + sort komponują się; edycja pola w odfiltrowanym/posortowanym widoku zapisuje się i nie gubi ukrytych wierszy (autosave bez błędu w konsoli).
- [ ] Przełączanie widoków ceny (Robocizna / Z narzędziami / Bez narzędzi) nadal pokazuje właściwą cenę (regresja z `view` w `key` nietknięta).
- [ ] Po odświeżeniu strony (F5) struktura utrzymana (akcje serwerowe zapisały dane).

- [ ] **Step 3: Jeśli wszystko zielone — zaktualizuj status slajsu**

Jeśli Linear MCP podłączony → ustaw issue slajsu na Done; w przeciwnym razie zaktualizuj `Status` w `context/foundation/roadmap.md` (zgodnie z AGENTS.md). Brak commita kodu w tym kroku poza ewentualną aktualizacją roadmapy.

---

## Self-Review

**1. Spec coverage:**

- Dodaj sekcję (z pustą pozycją) → Task 4 `handleAddSection` + Task 3 przycisk. ✓
- Zmień nazwę sekcji (panel, inline, denormalizacja na wierszach) + kolumna „Sekcja" read-only → Task 4 `handleRenameSection` + Task 2 `disabled` + Task 3 inline. ✓
- Usuń sekcję (confirm „N pozycji", czyść filtr) → Task 3 `confirmRemove` + Task 4 `handleRemoveSection`. ✓
- Filtruj do sekcji (klik nazwy, „Pokaż wszystkie", AND z szukajką/sortem) → Task 3 + Task 4 Step 6. ✓
- Dodaj pozycję (panel per-sekcja + pasek gdy zafiltrowano) → Task 3 ＋ + Task 4 Step 7 + `handleAddItem`. ✓
- Usuń pozycję (kosz w wierszu, blokada ostatniej) → Task 2 `actionColumn` + Task 4 `handleRemoveItem`. ✓
- Model: optymistyczny splice, `lockRows` zostaje, `prevById` w rytm splice'u → Task 4 (każdy handler aktualizuje `prevById`). ✓
- Inwariant „sekcja ≥1 pozycja" → Task 1 `sectionItemCount` + Task 2 wyszarzenie + Task 4 strażnik. ✓
- Odchylenie od reseedu-na-refresh udokumentowane i obsłużone optymistycznie. ✓
- `addSectionWithItemAction` — spec dopuszcza sekwencję po stronie klienta; wybrano sekwencję (Task 4), bez zmian w pliku akcji. ✓

**2. Placeholder scan:** Brak „TBD/handle edge cases/itp." — każdy krok ma pełny kod lub konkretną komendę. ✓

**3. Type consistency:** `buildBlankRow`/`applyAddItem`/`applyRemoveItem`/`sectionItemCount`/`NEW_SECTION_DEFAULTS` używane w Task 4 dokładnie z sygnaturami z Task 1; `onRemoveItem`/`getSectionItemCount` z Task 2 zgodne z przekazaniem w Task 4 Step 5; propsy panelu z Task 3 zgodne z Task 4 Step 8. ✓
