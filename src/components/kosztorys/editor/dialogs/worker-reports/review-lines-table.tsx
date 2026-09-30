'use client'

import { createContext, use } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchSelect, type SearchSelectItemT } from '@/components/ui/search-select'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { CandidateRow } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-candidate-row'
import { DataTable } from '@/components/tables/data-table/data-table'
import {
  acceptedQty,
  isLineReady,
  qtyInputText,
  type ItemFiguresT,
  type LineDraftT,
  type LineGroupT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import { sectionColumn } from '@/components/kosztorys/worker-report/report-columns'
import { reportRowClassName } from '@/components/kosztorys/worker-report/report-row-class-name'
import { formatQty, formatQtyWithUnit } from '@/lib/kosztorys/format'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import type { CatalogueHintT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import type { ReportLineT } from '@/lib/kosztorys/worker-report/types'
import { cn } from '@/lib/utils/cn'

export type ReviewRowT = Omit<ReportLineT, 'sectionName'> & {
  sectionName: string
  sectionColor: SectionColorKeyT | null
  sectionOrder: number
  // Figures of the pozycja the line adds to — its own, or the one it was re-pointed to.
  figures: ItemFiguresT | undefined
  // Its own pozycja is gone from the rozpiska, so the kierownik points it at one by hand.
  isUnassigned: boolean
}

type ReviewTableContextT = {
  rows: ReviewRowT[]
  drafts: Record<number, LineDraftT>
  onChange: (lineId: number, patch: Partial<LineDraftT>) => void
  sectionOptions: SelectOptionT[]
  itemOptions: SearchSelectItemT[]
  catalogue: WorkCatalogueItemT[]
  catalogueOptions: SearchSelectItemT[]
  hintsByLine: Record<number, CatalogueHintT[]>
  isReadOnly: boolean
  stageTitle: string
}

// A context, not props on the columns: `flexRender` mounts a `cell` function as a component, so
// columns rebuilt per keystroke would remount the input under the caret.
const ReviewTableContext = createContext<ReviewTableContextT | undefined>(undefined)

function useReviewTable() {
  const context = use(ReviewTableContext)
  if (!context) throw new Error('useReviewTable must be used inside ReviewLinesTable')
  return context
}

function TickHeader() {
  const { rows, drafts, onChange, isReadOnly } = useReviewTable()
  const tickedCount = rows.filter((row) => drafts[row.id].isTicked).length
  return (
    <Checkbox
      aria-label="Zaznacz wszystkie"
      checked={tickedCount === 0 ? false : tickedCount === rows.length || 'indeterminate'}
      disabled={isReadOnly || rows.length === 0}
      onCheckedChange={(checked) =>
        rows.forEach((row) => onChange(row.id, { isTicked: checked === true }))
      }
    />
  )
}

function TickCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, isReadOnly } = useReviewTable()
  return (
    <Checkbox
      aria-label={`Przyjmij: ${row.description}`}
      checked={drafts[row.id].isTicked}
      disabled={isReadOnly}
      onCheckedChange={(checked) => onChange(row.id, { isTicked: checked === true })}
    />
  )
}

function AcceptedQtyCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, catalogue, isReadOnly } = useReviewTable()
  const draft = drafts[row.id]
  if (isReadOnly) {
    const unit = catalogue.find((entry) => entry.id === draft.catalogueId)?.unit ?? row.unit
    return (
      <span className="whitespace-nowrap tabular-nums">
        {draft.isTicked ? formatQtyWithUnit(acceptedQty(draft), unit) : 'odrzucono'}
      </span>
    )
  }
  return (
    <Input
      aria-label={`Przyjmowana ilość: ${row.description}`}
      inputMode="decimal"
      value={draft.qty}
      disabled={!draft.isTicked}
      aria-invalid={draft.isTicked && parseReportQty(draft.qty).kind !== 'value'}
      onChange={(event) => onChange(row.id, { qty: event.target.value })}
      className="h-8 text-right tabular-nums"
    />
  )
}

function RozpiskaDescriptionCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, itemOptions, isReadOnly } = useReviewTable()
  const draft = drafts[row.id]
  return (
    <>
      <span className="block leading-snug">{row.description}</span>
      {row.isUnassigned && (
        <span className="text-destructive block text-xs">
          Pozycja usunięta z rozpiski — do przypisania ręcznie
        </span>
      )}
      {row.isUnassigned && !isReadOnly && (
        <div className="mt-1 flex flex-col items-start gap-1">
          <SearchSelect
            value={draft.itemId === undefined ? '' : String(draft.itemId)}
            onChange={(value) => onChange(row.id, { itemId: Number(value) })}
            items={itemOptions}
            placeholder="Wybierz pozycję z rozpiski…"
            searchPlaceholder="Opis pracy…"
            className="h-8 max-w-80"
          />
          <Button
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={() => onChange(row.id, { isExtra: true, itemId: undefined })}
          >
            Przenieś do prac spoza rozpiski
          </Button>
        </div>
      )}
    </>
  )
}

function StageHeader() {
  return useReviewTable().stageTitle
}

// Acceptance adds to the etap and so to the pomiar: the manager sees what is there and what it becomes.
function GrowingQty({ before, added }: { before: number; added: number }) {
  if (added === 0) return formatQty(before)
  return (
    <span className="whitespace-nowrap">
      <span className="text-muted-foreground">{formatQty(before)} → </span>
      <span className="font-medium">{formatQty(before + added)}</span>
    </span>
  )
}

function StageCell({ row }: { row: ReviewRowT }) {
  const added = acceptedQty(useReviewTable().drafts[row.id])
  if (!row.figures) return null
  return <GrowingQty before={row.figures.stageQty} added={added} />
}

function MeasuredCell({ row }: { row: ReviewRowT }) {
  const added = acceptedQty(useReviewTable().drafts[row.id])
  if (!row.figures) return null
  const { measuredQty, plannedQty } = row.figures
  const isOverPlanned = plannedQty > 0 && measuredQty + added > plannedQty
  return (
    <span className="whitespace-nowrap">
      <span className={cn(isOverPlanned && 'text-amber-600 dark:text-amber-400')}>
        <GrowingQty before={measuredQty} added={added} />
      </span>
      {isOverPlanned && (
        <span className="block text-xs text-amber-600 dark:text-amber-400">
          Przekroczono przedmiar
        </span>
      )}
    </span>
  )
}

// The worker names a praca in his own words; the manager often recognises a katalog wpis in them.
// Swapping it in carries the katalog's opis, j.m. and cena, so the new pozycja is priced like any
// other instead of by hand.
function ManualDescriptionCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, catalogue, catalogueOptions, hintsByLine, isReadOnly } =
    useReviewTable()
  const draft = drafts[row.id]
  const swapped = catalogue.find((entry) => entry.id === draft.catalogueId)
  const swap = (entry: { id: number; clientPrice: number }) =>
    onChange(row.id, { catalogueId: entry.id, unitPrice: qtyInputText(entry.clientPrice) })

  if (swapped) {
    return (
      <>
        <span className="block leading-snug">{swapped.description}</span>
        <span className="text-muted-foreground block text-xs">
          Z katalogu · zgłoszono „{row.description}”
        </span>
        {swapped.unit !== row.unit && (
          <span className="block text-xs text-amber-600 dark:text-amber-400">
            j.m. katalogu: {swapped.unit}, zgłoszono w {row.unit}
          </span>
        )}
        {!isReadOnly && (
          <Button
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={() => onChange(row.id, { catalogueId: undefined, unitPrice: '' })}
          >
            Cofnij podmianę
          </Button>
        )}
      </>
    )
  }

  const hints = hintsByLine[row.id] ?? []
  return (
    <>
      <span className="block leading-snug">{row.description}</span>
      {!isReadOnly && (
        <div className="mt-1 flex flex-col gap-1">
          {hints.length > 0 && (
            <span className="text-muted-foreground text-xs">Może chodzi o:</span>
          )}
          {hints.map((hint) => (
            <CandidateRow key={hint.id} entry={hint} readOnly={false} onClick={() => swap(hint)} />
          ))}
          <SearchSelect
            value=""
            onChange={(value) => {
              const entry = catalogue.find((candidate) => String(candidate.id) === value)
              if (entry) swap(entry)
            }}
            items={catalogueOptions}
            placeholder="Szukaj w katalogu…"
            searchPlaceholder="Opis pracy…"
            className="h-8 max-w-80"
          />
        </div>
      )}
    </>
  )
}

function TargetSectionCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, sectionOptions, isReadOnly } = useReviewTable()
  const draft = drafts[row.id]
  return (
    <SimpleSelect
      value={draft.sectionId}
      onValueChange={(sectionId) => onChange(row.id, { sectionId })}
      options={sectionOptions}
      placeholder="Wybierz sekcję"
      disabled={isReadOnly || !draft.isTicked}
      className={cn(
        'h-8 w-full',
        draft.isTicked && draft.sectionId === '' && !isReadOnly && 'border-destructive',
      )}
    />
  )
}

function UnitPriceCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, isReadOnly } = useReviewTable()
  const draft = drafts[row.id]
  const isPriceMissing =
    draft.isTicked && draft.sectionId !== '' && !isLineReady(row, draft, undefined)
  return (
    <Input
      aria-label={`Cena j.m.: ${row.description}`}
      inputMode="decimal"
      placeholder="zł"
      value={draft.unitPrice}
      disabled={isReadOnly || !draft.isTicked}
      aria-invalid={isPriceMissing}
      onChange={(event) => onChange(row.id, { unitPrice: event.target.value })}
      className="h-8 text-right tabular-nums"
    />
  )
}

const col = createColumnHelper<ReviewRowT>()

const tickColumn = col.display({
  id: 'tick',
  header: () => <TickHeader />,
  cell: ({ row }) => <TickCell row={row.original} />,
})
const reviewSectionColumn = sectionColumn<ReviewRowT>()
const reviewDescriptionColumn = col.accessor('description', {
  header: 'Opis prac',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.description, second.original.description),
  meta: { fill: true },
  cell: ({ row }) => <RozpiskaDescriptionCell row={row.original} />,
})
const reportedColumn = col.accessor('reportedQty', {
  header: 'Zgłoszono',
  meta: { align: 'right' },
  cell: ({ row }) => (
    <span className="whitespace-nowrap tabular-nums">
      {formatQtyWithUnit(row.original.reportedQty, row.original.unit)}
    </span>
  ),
})
const acceptedColumn = col.display({
  id: 'accepted',
  header: 'Przyjmuję',
  meta: { minWidth: 'min-w-28' },
  cell: ({ row }) => <AcceptedQtyCell row={row.original} />,
})
const stageColumn = col.accessor((row) => row.figures?.stageQty ?? 0, {
  id: 'stage',
  header: () => <StageHeader />,
  meta: { align: 'right' },
  cell: ({ row }) => <StageCell row={row.original} />,
})
const plannedColumn = col.accessor((row) => row.figures?.plannedQty ?? 0, {
  id: 'planned',
  header: COLUMN_LABELS.plannedQty,
  meta: { align: 'right' },
  cell: ({ row }) =>
    row.original.figures &&
    (row.original.figures.plannedQty > 0 ? (
      formatQty(row.original.figures.plannedQty)
    ) : (
      <span className="text-muted-foreground">—</span>
    )),
})
const measuredColumn = col.accessor((row) => row.figures?.measuredQty ?? 0, {
  id: 'measured',
  header: COLUMN_LABELS.stageQtySum,
  meta: { align: 'right' },
  cell: ({ row }) => <MeasuredCell row={row.original} />,
})
const targetSectionColumn = col.display({
  id: 'targetSection',
  header: 'Do sekcji',
  meta: { minWidth: 'min-w-48' },
  cell: ({ row }) => <TargetSectionCell row={row.original} />,
})
const manualDescriptionColumn = col.accessor('description', {
  header: 'Opis prac',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.description, second.original.description),
  meta: { fill: true },
  cell: ({ row }) => <ManualDescriptionCell row={row.original} />,
})
const unitPriceColumn = col.display({
  id: 'unitPrice',
  header: 'Cena j.m.',
  meta: { minWidth: 'min-w-28' },
  cell: ({ row }) => <UnitPriceCell row={row.original} />,
})

const COLUMNS_BY_GROUP = {
  rozpiska: [
    tickColumn,
    reviewSectionColumn,
    reviewDescriptionColumn,
    reportedColumn,
    acceptedColumn,
    stageColumn,
    plannedColumn,
    measuredColumn,
  ],
  extra: [
    tickColumn,
    manualDescriptionColumn,
    reportedColumn,
    acceptedColumn,
    targetSectionColumn,
    unitPriceColumn,
  ],
}

type PropsT = ReviewTableContextT & { group: LineGroupT }

export function ReviewLinesTable({ group, ...context }: PropsT) {
  return (
    <ReviewTableContext value={context}>
      <DataTable
        data={context.rows}
        columns={COLUMNS_BY_GROUP[group]}
        getRowClassName={(row) => {
          const isTicked = context.drafts[row.id].isTicked
          return cn(
            reportRowClassName(row.sectionColor, isTicked),
            context.isReadOnly && !isTicked && 'opacity-60',
          )
        }}
      />
    </ReviewTableContext>
  )
}
