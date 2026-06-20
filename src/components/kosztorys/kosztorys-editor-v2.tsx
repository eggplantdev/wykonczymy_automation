'use client'

import 'react-datasheet-grid/dist/style.css'
import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DataSheetGrid } from 'react-datasheet-grid'
import { useDebouncedSave } from '@/components/kosztorys/use-debounced-save'
import { useHiddenColumns } from '@/components/kosztorys/use-hidden-columns'
import { useColumnWidths } from '@/components/kosztorys/use-column-widths'
import { DatasheetColumnToggle } from '@/components/kosztorys/datasheet-column-toggle'
import { KosztorysSectionSummary } from '@/components/kosztorys/kosztorys-section-summary'
import { KosztorysCsvButton } from '@/components/kosztorys/kosztorys-csv-button'
import { useElementHeight } from '@/hooks/use-element-height'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buildV2Columns, v2ToggleableColumns } from '@/lib/tables/kosztorys-v2-columns'
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
import {
  rowNetForView,
  rowRemainingForView,
  sectionSubtotalsForView,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
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

export function KosztorysEditorV2({ investmentId, tree, investmentName }: PropsT) {
  const router = useRouter()
  const save = useDebouncedSave(500)
  const [gridRef, gridHeight] = useElementHeight()
  const [rows, setRows] = useState<KosztorysV2RowT[]>(() => treeToRows(tree))
  const [view, setView] = useState<PriceViewT>('client')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortStateT>(null)
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const { hidden, toggle: toggleColumn } = useHiddenColumns()
  // Szerokości kolumn: trwałe w localStorage. Commit (na puść uchwytu) zapisuje i przez
  // `key` remountuje siatkę z nową szerokością — react-datasheet-grid nie przelicza sizing
  // bez remountu (jego wewnętrzne memo). W trakcie dragu pokazujemy tylko pionową prowadnicę
  // (guideX = X kursora), bez dotykania grida.
  const { widths, setWidth } = useColumnWidths()
  const [guideX, setGuideX] = useState<number | null>(null)
  // Snapshot poprzednich wierszy do diffu (po id pozycji) — pełny zbiór, nie widok.
  // Pełni też rolę „świeżego zbioru" czytanego w event-handlerach struktury (count sekcji):
  // utrzymywany przy każdym add/remove/edit, więc nie potrzeba osobnego ref na rows.
  const prevById = useRef(new Map(rows.map((r) => [r.id, r])))

  function toggleSort(field: string) {
    setSort((prev) => {
      if (prev?.field !== field) return { field, dir: 'asc' }
      if (prev.dir === 'asc') return { field, dir: 'desc' }
      return null
    })
  }

  // onRemoveItem (handleRemoveItem) czyta prevById.current — stabilny ref — wyłącznie z
  // onClick komórki, nigdy podczas renderu. Reguła nie potrafi tego dowieść przez zwykłe
  // wywołanie funkcji (inaczej niż dla propa JSX jak onChange), stąd celowe wyciszenie.
  // eslint-disable-next-line react-hooks/refs
  const allColumns = buildV2Columns({
    stages: tree.stages,
    view,
    sort,
    onToggleSort: toggleSort,
    widths,
    onGuide: setGuideX,
    onCommitColumn: setWidth,
    onRemoveItem: handleRemoveItem,
  })
  const columns = allColumns.filter((c) => !(c.id && hidden.has(c.id)))
  const toggleable = v2ToggleableColumns(tree.stages)
  // Sygnatura szerokości — zmiana wymusza remount siatki (patrz key na DataSheetGrid).
  const widthsKey = JSON.stringify(widths)

  // Widok = filtr + sort. Edycja mapowana z powrotem do pełnego zbioru po id.
  const viewRows = useMemo(() => {
    const scoped =
      activeSectionId == null ? rows : rows.filter((r) => r.sectionId === activeSectionId)
    const filtered = filterRows(scoped, search)
    if (!sort) return filtered
    return sortRows(filtered, (r) => sortValue(r, sort.field, view, tree.stages), sort.dir)
  }, [rows, activeSectionId, search, sort, view, tree.stages])

  const grandNet = useMemo(
    () => viewRows.reduce((sum, r) => sum + rowNetForView(r, view), 0),
    [viewRows, view],
  )

  // Subtotale per sekcja: PEŁNY zbiór (nie viewRows) — stabilna rozpiska niezależna od
  // filtra/sortu. `totalNet` (suma pełnego zbioru) ≠ `grandNet` (filtro-świadomy w toolbarze).
  const subtotals = useMemo(() => sectionSubtotalsForView(rows, view), [rows, view])
  const totalNet = useMemo(() => subtotals.reduce((s, x) => s + x.net, 0), [subtotals])

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

  async function handleAddItem(sectionId: number) {
    const res = await addItemAction(investmentId, sectionId)
    if (!res.success) return
    // Zdenormalizowane pola sekcji bierzemy z dowolnego istniejącego wiersza tej sekcji.
    const sample = [...prevById.current.values()].find((r) => r.sectionId === sectionId)
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
    // Inwariant: sekcja ma ≥1 pozycję. Count z prevById (świeży zbiór, event-time read —
    // kolumny dsg są zamrożone na montażu, więc tu, nie wizualnym disabled, pilnujemy reguły).
    if (sectionItemCount([...prevById.current.values()], row.sectionId) <= 1) {
      window.alert(
        'Sekcja musi mieć co najmniej jedną pozycję. Aby ją usunąć, użyj kosza sekcji w panelu.',
      )
      return
    }
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
        {activeSectionId != null && (
          <Button size="sm" variant="outline" onClick={() => handleAddItem(activeSectionId)}>
            ＋ pozycja
          </Button>
        )}
        <span className="text-muted-foreground text-sm">
          {viewRows.length} pozycji · netto{' '}
          {grandNet.toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant={summaryOpen ? 'default' : 'outline'}
            onClick={() => setSummaryOpen((o) => !o)}
          >
            Sekcje
          </Button>
          <KosztorysCsvButton
            rows={viewRows}
            stages={tree.stages}
            hidden={hidden}
            view={view}
            subtotals={subtotals}
            investmentName={investmentName}
          />
          <DatasheetColumnToggle columns={toggleable} hidden={hidden} onToggle={toggleColumn} />
        </div>
      </div>
      {/* Mierzymy wysokość kontenera (flex-1) i podajemy ją siatce — datasheet-grid
          wymaga px do wirtualizacji; bez tego renderuje wszystkie 1000 wierszy.
          Tor grid `minmax(0,1fr)` daje DEFINITYWNĄ szerokość (= viewport): siatka nie
          rozpycha kontenera do sumy kolumn (~1650px), tylko przewija je wewnętrznie.
          Bez tego szerokość oscylowała viewport↔treść i resize-detector grida mrugał. */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* min-w-0 pozwala wrapperowi kurczyć się poniżej treści w kontekście flex;
            grid-cols-[minmax(0,1fr)] dalej daje siatce definitywną szerokość (anti-migotanie). */}
        <div
          ref={gridRef}
          className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-hidden"
        >
          <DataSheetGrid
            // Remount przy zmianie szerokości kolumn ORAZ widoku: dsg zamraża `columns`
            // na montażu i nie podnosi nowych wiązań (cena→pole, netto wg widoku) bez
            // remountu — bez `view` w kluczu wszystkie 3 widoki pokazywały cenę klienta.
            key={`${view}:${widthsKey}`}
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
            activeSectionId={activeSectionId}
            onClose={() => setSummaryOpen(false)}
            onAddSection={handleAddSection}
            onAddItem={handleAddItem}
            onRenameSection={handleRenameSection}
            onRemoveSection={handleRemoveSection}
            onFilterSection={setActiveSectionId}
          />
        )}
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
