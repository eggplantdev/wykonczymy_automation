'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataSheetGrid } from 'react-datasheet-grid'
import { useDebouncedSave } from '@/components/kosztorys/use-debounced-save'
import { useHiddenColumns } from '@/components/kosztorys/use-hidden-columns'
import { useColumnWidths } from '@/components/kosztorys/use-column-widths'
import { DatasheetColumnToggle } from '@/components/kosztorys/datasheet-column-toggle'
import { useElementHeight } from '@/hooks/use-element-height'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buildV2Columns, v2ToggleableColumns } from '@/lib/tables/kosztorys-v2-columns'
import {
  diffRow,
  filterRows,
  revertField,
  rowDoneNetForView,
  sortRows,
  stageKey,
  treeToRows,
  type SortDirT,
} from '@/lib/kosztorys/v2-rows'
import {
  rowNetForView,
  rowRemainingForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import {
  setStageProgressAction,
  updateItemFieldAction,
  type ItemPatchT,
} from '@/lib/actions/kosztorys'
import type { KosztorysStageT, KosztorysTreeT, KosztorysV2RowT } from '@/types/kosztorys'

type PropsT = { investmentId: number; tree: KosztorysTreeT; investmentName: string }

// Trzy widoki nad jednym zbiorem: zmieniają tylko aktywną cenę i jej liczone.
const VIEWS: { value: PriceViewT; label: string }[] = [
  { value: 'client', label: 'Robocizna' },
  { value: 'w_tools', label: 'Z narzędziami' },
  { value: 'own_tools', label: 'Bez narzędzi' },
]

type SortStateT = { field: string; dir: SortDirT } | null

// Wartość do sortowania po danym polu — liczone (cena/netto/brutto/pozostało) wg widoku.
function sortValue(
  row: KosztorysV2RowT,
  field: string,
  view: PriceViewT,
  stages: KosztorysStageT[],
): string | number {
  switch (field) {
    case 'price':
      return viewPrice(row, view)
    case 'net':
      return rowNetForView(row, view)
    case 'gross':
      return rowNetForView(row, view) * (1 + (row.vatRate ?? row.sectionVatRate))
    case 'remaining':
      return rowRemainingForView(row, rowDoneNetForView(row, stages, view), view)
    default: {
      const v = row[field as keyof KosztorysV2RowT]
      return (typeof v === 'number' ? v : (v ?? '')) as string | number
    }
  }
}

export function KosztorysEditorV2({ tree, investmentName }: PropsT) {
  const router = useRouter()
  const save = useDebouncedSave(500)
  const [gridRef, gridHeight] = useElementHeight()
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  const [view, setView] = useState<PriceViewT>('client')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortStateT>(null)
  const { hidden, toggle: toggleColumn } = useHiddenColumns()
  // Szerokości kolumn: trwałe w localStorage. Commit (na puść uchwytu) zapisuje i przez
  // `key` remountuje siatkę z nową szerokością — react-datasheet-grid nie przelicza sizing
  // bez remountu (jego wewnętrzne memo). W trakcie dragu pokazujemy tylko pionową prowadnicę
  // (guideX = X kursora), bez dotykania grida.
  const { widths, setWidth } = useColumnWidths()
  const [guideX, setGuideX] = useState<number | null>(null)
  // Snapshot poprzednich wierszy do diffu (po id pozycji) — pełny zbiór, nie widok.
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))

  function toggleSort(field: string) {
    setSort((prev) => {
      if (prev?.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      return null
    })
  }

  const allColumns = buildV2Columns({
    stages: tree.stages,
    view,
    sort,
    onToggleSort: toggleSort,
    widths,
    onGuide: setGuideX,
    onCommitColumn: setWidth,
  })
  const columns = allColumns.filter((c) => !(c.id && hidden.has(c.id)))
  const toggleable = v2ToggleableColumns(tree.stages)
  // Sygnatura szerokości — zmiana wymusza remount siatki (patrz key na DataSheetGrid).
  const widthsKey = JSON.stringify(widths)

  // Widok = filtr + sort. Edycja mapowana z powrotem do pełnego zbioru po id.
  const viewRows = useMemo(() => {
    const filtered = filterRows(rows, search)
    if (!sort) return filtered
    return sortRows(filtered, (r) => sortValue(r, sort.field, view, tree.stages), sort.dir)
  }, [rows, search, sort, view, tree.stages])

  const grandNet = useMemo(
    () => viewRows.reduce((sum, r) => sum + rowNetForView(r, view), 0),
    [viewRows, view],
  )

  // revert-on-error: cofnij optymistyczną edycję pola do wartości sprzed zapisu
  // (rows + snapshot diffu), gdy serwer odrzuci. Guard „current === attempted" jest
  // w revertField — nie deptamy świeższej edycji.
  function revertOne(
    id: number,
    field: keyof KosztorysV2RowT,
    prevVal: unknown,
    attempted: unknown,
  ) {
    setRows((rs) => revertField(rs, id, field, prevVal, attempted))
    const snap = prevById.current.get(id)
    if (snap && snap[field] === attempted) {
      prevById.current.set(id, { ...snap, [field]: prevVal } as KosztorysV2RowT)
    }
  }

  function onChange(next: KosztorysV2RowT[]) {
    const changedById = new Map<number, KosztorysV2RowT>()
    for (const row of next) {
      const prev = prevById.current.get(row.id)
      if (!prev) continue
      const diff = diffRow(prev, row)
      if (diff.itemPatch) {
        const patch = diff.itemPatch
        for (const field of Object.keys(patch)) {
          const key = field as keyof KosztorysV2RowT
          const prevVal = prev[key]
          const attempted = row[key]
          save(
            `item:${row.id}:${field}`,
            () => updateItemFieldAction(row.id, { [field]: patch[field as keyof ItemPatchT] }),
            () => revertOne(row.id, key, prevVal, attempted),
          )
        }
      }
      for (const sc of diff.stageChanges ?? []) {
        const key = stageKey(sc.stageId)
        const prevVal = prev[key]
        save(
          `progress:${row.id}:${sc.stageId}`,
          () => setStageProgressAction(row.id, sc.stageId, sc.qty),
          () => revertOne(row.id, key, prevVal, sc.qty),
        )
      }
      if (diff.itemPatch || diff.stageChanges) changedById.set(row.id, row)
      prevById.current.set(row.id, row)
    }
    if (changedById.size > 0) {
      // Scal zmiany z widoku do pełnego zbioru po id (filtr/sort nie gubią ukrytych wierszy).
      setRows((master) => master.map((r) => changedById.get(r.id) ?? r))
      // Pociągnij przeliczone sumy z serwera po ciszy zapisu (tylko gdy realnie coś
      // zmieniono — bezwarunkowy refresh przy spurious onChange potrafił zapętlić render).
      setTimeout(() => router.refresh(), 700)
    }
  }

  return (
    // Pełna wysokość strony jak widok arkusza: kompaktowy pasek na górze + siatka na resztę.
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="border-border flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
        <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
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
        <Input
          placeholder="Szukaj pozycji / sekcji…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        <span className="text-muted-foreground text-sm">
          {viewRows.length} pozycji · netto{' '}
          {grandNet.toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <div className="ml-auto">
          <DatasheetColumnToggle columns={toggleable} hidden={hidden} onToggle={toggleColumn} />
        </div>
      </div>
      {/* Mierzymy wysokość kontenera (flex-1) i podajemy ją siatce — datasheet-grid
          wymaga px do wirtualizacji; bez tego renderuje wszystkie 1000 wierszy.
          Tor grid `minmax(0,1fr)` daje DEFINITYWNĄ szerokość (= viewport): siatka nie
          rozpycha kontenera do sumy kolumn (~1650px), tylko przewija je wewnętrznie.
          Bez tego szerokość oscylowała viewport↔treść i resize-detector grida mrugał. */}
      <div ref={gridRef} className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden">
        <DataSheetGrid
          // Remount przy zmianie szerokości kolumn: dsg nie przelicza sizing bez tego.
          key={widthsKey}
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
      {/* Pionowa prowadnica podczas przeciągania krawędzi kolumny (fixed = X kursora). */}
      {guideX !== null && (
        <div
          className="bg-primary/70 pointer-events-none fixed inset-y-0 z-50 w-px"
          style={{ left: guideX }}
        />
      )}
    </div>
  )
}
