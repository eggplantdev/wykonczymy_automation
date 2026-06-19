import { createColumnHelper, type ColumnDef } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import { EditableCell } from '@/components/kosztorys/editable-cell'
import { rowNet, rowRemaining, stageValue } from '@/lib/kosztorys/calc'
import type { DiscountTypeT, KosztorysEditorRowT, KosztorysStageT } from '@/types/kosztorys'

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export type KosztorysHandlersT = {
  stages: KosztorysStageT[]
  onEditItem: (rowId: number, patch: Partial<KosztorysEditorRowT>) => void
  onEditStage: (rowId: number, stageId: number, qty: number) => void
  onRenameSection: (sectionId: number, name: string) => void
  onDeleteItem: (rowId: number) => void
}

function doneNet(row: KosztorysEditorRowT, stages: KosztorysStageT[]): number {
  return stages.reduce((sum, st) => sum + stageValue(row, row.stageQty[st.id] ?? 0), 0)
}

const DISCOUNT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'zł' },
]

const col = createColumnHelper<KosztorysEditorRowT>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildKosztorysColumns(
  h: KosztorysHandlersT,
): ColumnDef<KosztorysEditorRowT, any>[] {
  const left = [
    col.accessor('sectionName', {
      id: 'section',
      header: 'Sekcja',
      meta: { label: 'Sekcja' },
      cell: (i) => (
        <EditableCell
          className="min-w-36"
          value={i.getValue() ?? ''}
          onCommit={(v) => h.onRenameSection(i.row.original.sectionId, v)}
        />
      ),
    }),
    col.accessor('description', {
      id: 'description',
      header: 'Opis',
      meta: { label: 'Opis' },
      cell: (i) => (
        <EditableCell
          className="min-w-80"
          value={i.getValue() ?? ''}
          onCommit={(v) => h.onEditItem(i.row.original.id, { description: v || null })}
        />
      ),
    }),
    col.accessor('unit', {
      id: 'unit',
      header: 'J.m.',
      meta: { label: 'J.m.' },
      cell: (i) => (
        <EditableCell
          className="min-w-16"
          value={i.getValue() ?? ''}
          onCommit={(v) => h.onEditItem(i.row.original.id, { unit: v || null })}
        />
      ),
    }),
    col.accessor('plannedQty', {
      id: 'plannedQty',
      header: 'Przedmiar',
      meta: { label: 'Przedmiar', align: 'right' },
      cell: (i) => (
        <EditableCell
          type="number"
          align="right"
          className="min-w-20"
          value={i.getValue()}
          onCommit={(v) => h.onEditItem(i.row.original.id, { plannedQty: Number(v) || 0 })}
        />
      ),
    }),
    col.accessor('measuredQty', {
      id: 'measuredQty',
      header: 'Pomiar',
      meta: { label: 'Pomiar', align: 'right' },
      cell: (i) => (
        <EditableCell
          type="number"
          align="right"
          className="min-w-20"
          value={i.getValue()}
          onCommit={(v) => h.onEditItem(i.row.original.id, { measuredQty: Number(v) || 0 })}
        />
      ),
    }),
    col.accessor('clientPrice', {
      id: 'clientPrice',
      header: 'Cena',
      meta: { label: 'Cena klient', align: 'right' },
      cell: (i) => (
        <EditableCell
          type="number"
          align="right"
          className="min-w-24"
          value={i.getValue()}
          onCommit={(v) => h.onEditItem(i.row.original.id, { clientPrice: Number(v) || 0 })}
        />
      ),
    }),
    col.accessor('discountType', {
      id: 'discountType',
      header: 'Rabat',
      meta: { label: 'Typ rabatu' },
      enableSorting: false,
      cell: (i) => (
        <EditableCell
          options={DISCOUNT_OPTIONS}
          value={i.getValue() ?? ''}
          onCommit={(v) =>
            h.onEditItem(i.row.original.id, { discountType: (v || null) as DiscountTypeT | null })
          }
        />
      ),
    }),
    col.accessor('discountValue', {
      id: 'discountValue',
      header: 'Rabat wart.',
      meta: { label: 'Wartość rabatu', align: 'right' },
      cell: (i) => (
        <EditableCell
          type="number"
          align="right"
          value={i.getValue()}
          onCommit={(v) => h.onEditItem(i.row.original.id, { discountValue: Number(v) || 0 })}
        />
      ),
    }),
  ]

  const stageCols = h.stages.map((st) =>
    col.accessor((row) => row.stageQty[st.id] ?? 0, {
      id: `stage_${st.id}`,
      header: `E${st.ordinal}`,
      meta: { label: `Etap ${st.ordinal}`, align: 'right' },
      cell: (i) => (
        <EditableCell
          type="number"
          align="right"
          className="min-w-14"
          value={i.getValue() as number}
          onCommit={(v) => h.onEditStage(i.row.original.id, st.id, Number(v) || 0)}
        />
      ),
    }),
  )

  const computed = [
    col.accessor((r) => rowNet(r), {
      id: 'net',
      header: 'Netto',
      meta: { label: 'Netto', align: 'right' },
      cell: (i) => <span className="font-medium">{fmt(i.getValue())}</span>,
    }),
    col.accessor((r) => rowNet(r) * (1 + (r.vatRate ?? r.sectionVatRate)), {
      id: 'gross',
      header: 'Brutto',
      meta: { label: 'Brutto', align: 'right' },
      cell: (i) => fmt(i.getValue()),
    }),
    col.accessor((r) => rowRemaining(r, doneNet(r, h.stages)), {
      id: 'remaining',
      header: 'Pozostało',
      meta: { label: 'Pozostało', align: 'right' },
      cell: (i) => <span className="text-muted-foreground">{fmt(i.getValue())}</span>,
    }),
    col.display({
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { canHide: false },
      cell: (i) => (
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive"
          title="Usuń pozycję"
          onClick={() => h.onDeleteItem(i.row.original.id)}
        >
          <Trash2 className="size-4" />
        </button>
      ),
    }),
  ]

  return [...left, ...stageCols, ...computed]
}
