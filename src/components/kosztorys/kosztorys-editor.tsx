'use client'

import { useCallback, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ColumnToggle } from '@/components/ui/column-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toastMessage } from '@/components/toasts'
import { useDebouncedSave } from '@/components/kosztorys/use-debounced-save'
import { buildKosztorysColumns } from '@/lib/tables/kosztorys-columns'
import {
  addItemAction,
  addStageAction,
  removeItemAction,
  setStageProgressAction,
  updateItemFieldAction,
  updateSectionFieldAction,
  type ItemPatchT,
} from '@/lib/actions/kosztorys'
import type { KosztorysEditorRowT, KosztorysStageT, KosztorysTreeT } from '@/types/kosztorys'

type PropsT = { investmentId: number; tree: KosztorysTreeT }

function flatten(tree: KosztorysTreeT): KosztorysEditorRowT[] {
  const progressByItem = new Map<number, Record<number, number>>()
  for (const p of tree.progress) {
    const m = progressByItem.get(p.itemId) ?? {}
    m[p.stageId] = p.qtyDone
    progressByItem.set(p.itemId, m)
  }
  const rows: KosztorysEditorRowT[] = []
  for (const section of tree.sections) {
    for (const item of section.items) {
      rows.push({
        ...item,
        sectionName: section.name,
        sectionOrder: section.displayOrder,
        sectionVatRate: section.vatRate,
        sectionDefaultCostVariant: section.defaultCostVariant,
        stageQty: progressByItem.get(item.id) ?? {},
      })
    }
  }
  return rows
}

export function KosztorysEditor({ investmentId, tree }: PropsT) {
  const [rows, setRows] = useState<KosztorysEditorRowT[]>(() => flatten(tree))
  const [stages, setStages] = useState<KosztorysStageT[]>(tree.stages)
  const [search, setSearch] = useState('')
  const save = useDebouncedSave(500)

  const onEditItem = useCallback(
    (rowId: number, patch: Partial<KosztorysEditorRowT>) => {
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
      const field = Object.keys(patch)[0]
      save(`item:${rowId}:${field}`, () => updateItemFieldAction(rowId, patch as ItemPatchT))
    },
    [save],
  )

  const onEditStage = useCallback(
    (rowId: number, stageId: number, qty: number) => {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, stageQty: { ...r.stageQty, [stageId]: qty } } : r,
        ),
      )
      save(`progress:${rowId}:${stageId}`, () => setStageProgressAction(rowId, stageId, qty))
    },
    [save],
  )

  const onRenameSection = useCallback(
    (sectionId: number, name: string) => {
      setRows((prev) =>
        prev.map((r) => (r.sectionId === sectionId ? { ...r, sectionName: name } : r)),
      )
      save(`section:${sectionId}:name`, () => updateSectionFieldAction(sectionId, { name }))
    },
    [save],
  )

  const onDeleteItem = useCallback(async (rowId: number) => {
    const r = await removeItemAction(rowId)
    if (!r.success) return toastMessage(r.error, 'error', 5000)
    setRows((prev) => prev.filter((row) => row.id !== rowId))
  }, [])

  const columns = useMemo(
    () => buildKosztorysColumns({ stages, onEditItem, onEditStage, onRenameSection, onDeleteItem }),
    [stages, onEditItem, onEditStage, onRenameSection, onDeleteItem],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        (r.description ?? '').toLowerCase().includes(q) ||
        r.sectionName.toLowerCase().includes(q) ||
        (r.unit ?? '').toLowerCase().includes(q),
    )
  }, [rows, search])

  async function addStage() {
    const r = await addStageAction(investmentId)
    if (!r.success) return toastMessage(r.error, 'error', 5000)
    setStages((prev) => [...prev, { id: r.data.id, ordinal: r.data.ordinal, label: null }])
  }

  async function addItem() {
    // Dodaj do ostatniej sekcji (flat view). Brak sekcji → nic.
    const last = rows[rows.length - 1]
    if (!last) return toastMessage('Najpierw zaimportuj lub dodaj sekcję', 'warning', 4000)
    const r = await addItemAction(investmentId, last.sectionId)
    if (!r.success) return toastMessage(r.error, 'error', 5000)
    setRows((prev) => [
      ...prev,
      {
        id: r.data.id,
        sectionId: last.sectionId,
        displayOrder: r.data.displayOrder,
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
        sectionName: last.sectionName,
        sectionOrder: last.sectionOrder,
        sectionVatRate: last.sectionVatRate,
        sectionDefaultCostVariant: last.sectionDefaultCostVariant,
        stageQty: {},
      },
    ])
  }

  const grandNet = useMemo(
    () => filtered.reduce((sum, r) => sum + r.measuredQty * r.clientPrice, 0),
    [filtered],
  )

  return (
    <div className="space-y-3">
      <DataTable
        data={filtered}
        columns={columns}
        storageKey="kosztorys-editor"
        enableVirtualization
        virtualRowHeight={40}
        toolbar={(table, cv) => (
          <div className="flex w-full items-center gap-2">
            <Input
              placeholder="Szukaj pozycji / sekcji…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 max-w-xs"
            />
            <span className="text-muted-foreground text-sm">
              {filtered.length} pozycji · netto{' '}
              {grandNet.toLocaleString('pl-PL', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="size-4" /> Pozycja
              </Button>
              <Button size="sm" variant="outline" onClick={addStage}>
                <Plus className="size-4" /> Etap
              </Button>
              <ColumnToggle table={table} columnVisibility={cv} />
            </div>
          </div>
        )}
      />
    </div>
  )
}
