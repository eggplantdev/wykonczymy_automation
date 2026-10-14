'use client'

import { createContext, use, useTransition, type ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { PlusIcon } from 'lucide-react'
import { Checkbox, checkedState } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertIcon } from '@/components/ui/alert-icon'
import { HintTooltip } from '@/components/ui/tooltip'
import { SearchSelect, type SearchSelectItemT } from '@/components/ui/search-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { CandidateRow } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-candidate-row'
import { ColumnToggle } from '@/components/tables/data-table/column-toggle'
import { DataTable } from '@/components/tables/data-table/data-table'
import { SectionPill } from '@/components/worker-reports/section-pill'
import { WorkerDescription } from '@/components/worker-reports/worker-description'
import {
  acceptedQtyNote,
  previewQtyChange,
  UNDO_CATALOGUE_SWAP,
  type ItemFiguresT,
  type LineDraftT,
  type LineGroupT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import { reviewedDescription } from '@/lib/kosztorys/worker-report/reviewed-description'
import { formatQty, formatQtyWithUnit } from '@/lib/kosztorys/format'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { sectionColorRail, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import type { CatalogueHintT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import { formatFormRef } from '@/lib/kosztorys/worker-report/check-digit'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import type { ReportLineT } from '@/lib/kosztorys/worker-report/types'
import { cn } from '@/lib/utils/cn'

export type ReviewRowT = Omit<ReportLineT, 'sectionName'> & {
  sectionName: string
  sectionColor: SectionColorKeyT | null
  sectionOrder: number
  // The pozycja's number from the printed form — the one link between a worker's own-language page
  // and the Polish rozpiska.
  ref: number | undefined
  // Figures of the pozycja the line adds to — its own, or the one it was re-pointed to.
  figures: ItemFiguresT | undefined
  itemDescription: string | undefined
  // The opis as the worker reads it: the pozycja's translation into his language, or — for a praca
  // spoza rozpiski — what he wrote before it was translated. Undefined when it is the Polish itself.
  workerDescription: string | undefined
  workerDescriptionLanguage: string | undefined
  // Its own pozycja is gone from the rozpiska, so the kierownik points it at one by hand.
  isUnassigned: boolean
  // Already in an etap: its pozycja is settled, its ilość stays editable and unticking takes it out.
  isAccepted: boolean
  // The etap and the pozycja it went to both still exist, so an untick has a figure to take back.
  isFigureLive: boolean
  // Scans: the same pozycja read twice — two photos of one page, most likely — so neither is ticked
  // in bulk.
  isDuplicateItem: boolean
  // Scans: a praca spoza rozpiski in a j.m. the kosztorys has not got.
  isUnitMissing: boolean
}

type ReviewTablePropsT = {
  rows: ReviewRowT[]
  drafts: Record<number, LineDraftT>
  onChange: (lineId: number, patch: Partial<LineDraftT>) => void
  itemOptions: SearchSelectItemT[]
  catalogue: WorkCatalogueItemT[]
  onOpenCatalogue: (lineId: number, entryId?: number) => void
  hintsByLine: Record<number, CatalogueHintT[]>
  stageTitle: string
  // Undefined once the report is decided: only a pending report's extras can be retranslated.
  onRetranslate: ((lineId: number) => Promise<void>) | undefined
}

type ReviewTableContextT = ReviewTablePropsT & {
  catalogueById: Map<number, WorkCatalogueItemT>
}

// `flexRender` mounts a `cell` function as a component, so
// columns rebuilt per keystroke would remount the input under the caret.
const ReviewTableContext = createContext<ReviewTableContextT | undefined>(undefined)

function useReviewTable() {
  const context = use(ReviewTableContext)
  if (!context) throw new Error('useReviewTable must be used inside ReviewLinesTable')
  return context
}

// Bulk only accepts: a line is odrzucona one by one, and the bulk tick leaves those alone.
function TickHeader() {
  const { rows, drafts, onChange } = useReviewTable()
  const bulkRows = rows.filter((row) => !row.isDuplicateItem && !drafts[row.id].isRejected)
  const tickedCount = bulkRows.filter((row) => drafts[row.id].isTicked).length
  return (
    <Checkbox
      aria-label="Zaznacz wszystkie"
      checked={checkedState(tickedCount, bulkRows.length)}
      onCheckedChange={(checked) =>
        bulkRows.forEach((row) => onChange(row.id, { isTicked: checked === true }))
      }
    />
  )
}

function TickCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange } = useReviewTable()
  return (
    <Checkbox
      aria-label={`Przyjmij: ${row.description}`}
      checked={drafts[row.id].isTicked}
      onCheckedChange={(checked) =>
        onChange(
          row.id,
          checked === true ? { isTicked: true, isRejected: false } : { isTicked: false },
        )
      }
    />
  )
}

// A second click sends the line back to waiting.
function RejectCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange } = useReviewTable()
  const { isRejected } = drafts[row.id]
  return (
    <Button
      variant="ghost"
      size="xs"
      aria-pressed={isRejected}
      className={cn('whitespace-nowrap', isRejected ? 'text-destructive' : 'text-muted-foreground')}
      onClick={() =>
        onChange(row.id, isRejected ? { isRejected: false } : { isRejected: true, isTicked: false })
      }
    >
      {isRejected ? 'Odrzucona · cofnij' : 'Odrzuć'}
    </Button>
  )
}

function AcceptedQtyCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange } = useReviewTable()
  const draft = drafts[row.id]
  const note = acceptedQtyNote(row, draft, row.isFigureLive)
  return (
    <>
      <Input
        aria-label={`Przyjmowana ilość: ${row.description}`}
        inputMode="decimal"
        value={draft.qty}
        disabled={!draft.isTicked}
        aria-invalid={draft.isTicked && parseReportQty(draft.qty).kind !== 'value'}
        onChange={(event) => onChange(row.id, { qty: event.target.value })}
        className="mx-auto h-8 w-20 tabular-nums"
      />
      {note && (
        <span className="text-muted-foreground block text-xs whitespace-nowrap">{note}</span>
      )}
    </>
  )
}

const WARNING_NOTE = 'block text-xs text-amber-600 dark:text-amber-400'

function ScanFlags({ row }: { row: ReviewRowT }) {
  const { drafts } = useReviewTable()
  return (
    <>
      {row.isUncertain && (
        <span className={WARNING_NOTE}>Niepewny odczyt — sprawdź na zdjęciu</span>
      )}
      {row.isDuplicateItem && (
        <span className={WARNING_NOTE}>Ta pozycja jest w zgłoszeniu więcej niż raz</span>
      )}
      {row.isUnitMissing && drafts[row.id].matchedItemIds.length === 0 && (
        <span className="text-destructive block text-xs">
          Brak j.m. — wybierz pracę z katalogu albo dodaj nową
        </span>
      )}
    </>
  )
}

function RozpiskaDescriptionCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, itemOptions } = useReviewTable()
  const draft = drafts[row.id]
  if (draft.matchedItemIds.length > 0) {
    return (
      <>
        <MatchedDescription row={row} />
        <ScanFlags row={row} />
      </>
    )
  }
  return (
    <>
      <span className="block leading-snug">{row.description}</span>
      <ScanFlags row={row} />
      {row.isUnassigned && (
        <span className="text-destructive block text-xs">
          {row.scannedRef === undefined
            ? 'Pozycja usunięta z rozpiski — do przypisania ręcznie'
            : `Nr ${row.scannedRef} nie pasuje do rozpiski — do przypisania ręcznie`}
        </span>
      )}
      {row.isUnassigned && !row.isAccepted && (
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
            onClick={() => onChange(row.id, { isExtra: true, itemId: undefined, isTicked: false })}
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

// A decision moves the etap and so the pomiar: the manager sees what is there and what it becomes.
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
  const added = previewQtyChange(row, useReviewTable().drafts[row.id], row.isFigureLive)
  if (!row.figures) return null
  return <GrowingQty before={row.figures.stageQty} added={added} />
}

function StageQtySumAfterCell({ row }: { row: ReviewRowT }) {
  const added = previewQtyChange(row, useReviewTable().drafts[row.id], row.isFigureLive)
  if (!row.figures) return null
  return <GrowingQty before={row.figures.measuredQty} added={added} />
}

function MeasuredCell({ row }: { row: ReviewRowT }) {
  const added = previewQtyChange(row, useReviewTable().drafts[row.id], row.isFigureLive)
  if (!row.figures) return null
  const { measuredQty, currentPlannedQty } = row.figures
  const measuredAfter = measuredQty + added
  if (currentPlannedQty === 0) return formatQty(measuredAfter)
  const figure = (
    <span className="whitespace-nowrap">
      {formatQty(measuredAfter)} / {formatQty(currentPlannedQty)}
    </span>
  )
  if (measuredAfter <= currentPlannedQty) return figure
  return (
    <HintTooltip
      content="Przekroczono aktualizację przedmiaru"
      className="flex-col items-center text-amber-600 dark:text-amber-400"
    >
      {figure}
      <span className="inline-flex items-center gap-1 text-xs">
        <AlertIcon className="size-3 text-current" />
        przekroczono
      </span>
    </HintTooltip>
  )
}

// „Cofnij podmianę” leaves the pozycja it went to in the rozpiska — empty, it shows on no page the
// client sees.
function SwapNote({ row }: { row: ReviewRowT }) {
  const { drafts, onChange } = useReviewTable()
  const source = drafts[row.id].catalogueId === undefined ? 'Zgłoszono' : 'Z katalogu · zgłoszono'
  return (
    <>
      <span className="text-muted-foreground block text-xs">
        {source} „{reviewedDescription(row)}”
      </span>
      {!row.isAccepted && (
        <Button
          variant="link"
          size="xs"
          className="h-auto p-0"
          onClick={() => onChange(row.id, UNDO_CATALOGUE_SWAP)}
        >
          Cofnij podmianę
        </Button>
      )}
    </>
  )
}

// A katalog praca the rozpiska already holds: the line adds to that pozycja.
function MatchedDescription({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, itemOptions, catalogueById } = useReviewTable()
  const draft = drafts[row.id]
  const entry = draft.catalogueId === undefined ? undefined : catalogueById.get(draft.catalogueId)
  const choices = itemOptions.filter((option) =>
    draft.matchedItemIds.includes(Number(option.value)),
  )
  return (
    <>
      <span className="block leading-snug">
        {row.itemDescription ?? entry?.description ?? row.description}
      </span>
      <SwapNote row={row} />
      {choices.length > 1 && !row.isAccepted && (
        <SimpleSelect
          value={draft.itemId === undefined ? '' : String(draft.itemId)}
          onValueChange={(value) => onChange(row.id, { itemId: Number(value) })}
          options={choices}
          placeholder="Która pozycja?"
          className={cn('mt-1 h-8 max-w-80', draft.itemId === undefined && 'border-destructive')}
        />
      )}
    </>
  )
}

function TranslationNote({ row }: { row: ReviewRowT }) {
  const { onRetranslate } = useReviewTable()
  const [isTranslating, startTranslating] = useTransition()
  // A recognised language — Polish included — means the AI already answered; a retry is only for a
  // line it never reached, which could otherwise land in the rozpiska in Cyrillic.
  if (row.descriptionLanguage !== undefined) return undefined
  return (
    <>
      <span className="text-muted-foreground block text-xs">Brak tłumaczenia</span>
      {onRetranslate && !row.isAccepted && (
        <Button
          variant="link"
          size="xs"
          className="h-auto p-0"
          disabled={isTranslating}
          onClick={() => startTranslating(() => onRetranslate(row.id))}
        >
          {isTranslating ? 'Tłumaczę…' : 'Przetłumacz'}
        </Button>
      )}
    </>
  )
}

function ManualDescriptionCell({ row }: { row: ReviewRowT }) {
  const { drafts, catalogueById } = useReviewTable()
  const { catalogueId } = drafts[row.id]
  const swapped = catalogueId === undefined ? undefined : catalogueById.get(catalogueId)
  if (!swapped) {
    return (
      <>
        <span className="block leading-snug">{reviewedDescription(row)}</span>
        <TranslationNote row={row} />
        <ScanFlags row={row} />
      </>
    )
  }
  return (
    <>
      <span className="block leading-snug">{swapped.description}</span>
      <SwapNote row={row} />
      <ScanFlags row={row} />
    </>
  )
}

// A praca spoza rozpiski is accepted only once it is in the rozpiska, so this is its one way in. A
// podpowiedź opens the window on that praca, with the szukajka still there to look further — so the
// plain button is only for a line with nothing to suggest.
function CatalogueHintsCell({ row }: { row: ReviewRowT }) {
  const { onOpenCatalogue, hintsByLine } = useReviewTable()
  if (row.isAccepted) return null
  const hints = hintsByLine[row.id] ?? []
  if (hints.length === 0) {
    return (
      <Button variant="outline" size="xs" onClick={() => onOpenCatalogue(row.id)}>
        <PlusIcon />
        Dodaj do rozpiski
      </Button>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      {hints.map((hint) => (
        <CandidateRow
          key={hint.id}
          entry={hint}
          readOnly={false}
          showFigures={false}
          onClick={() => onOpenCatalogue(row.id, hint.id)}
        />
      ))}
    </div>
  )
}

const col = createColumnHelper<ReviewRowT>()

const DESCRIPTION_MIN_WIDTH = 'min-w-96'

const tickColumn = col.display({
  id: 'tick',
  enableHiding: false,
  header: () => <TickHeader />,
  meta: { align: 'center' },
  cell: ({ row }) => <TickCell row={row.original} />,
})
const rejectColumn = col.display({
  id: 'reject',
  enableHiding: false,
  header: 'Akcje',
  meta: { align: 'center' },
  cell: ({ row }) => <RejectCell row={row.original} />,
})
const refColumn = col.accessor((row) => row.ref ?? 0, {
  id: 'ref',
  header: 'Nr',
  meta: { align: 'center' },
  cell: ({ row }) =>
    row.original.ref !== undefined && (
      <span className="whitespace-nowrap tabular-nums">{formatFormRef(row.original.ref)}</span>
    ),
})
// Sorted by the rozpiska's own section order, not alphabetically — that is the order both people know.
const sectionColumn = col.accessor((row) => row.sectionOrder, {
  id: 'section',
  header: 'Sekcja',
  meta: { align: 'center' },
  cell: ({ row }) => <SectionPill name={row.original.sectionName} />,
})
const reviewDescriptionColumn = col.accessor('description', {
  header: 'Opis prac',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.description, second.original.description),
  meta: { fill: true, minWidth: DESCRIPTION_MIN_WIDTH },
  cell: ({ row }) => <RozpiskaDescriptionCell row={row.original} />,
})
const workerDescriptionColumn = col.accessor('workerDescription', {
  header: 'Opis w języku pracownika',
  meta: { minWidth: 'min-w-64' },
  cell: ({ row }) => (
    <WorkerDescription
      description={row.original.workerDescription}
      language={row.original.workerDescriptionLanguage}
    />
  ),
})
const reportedColumn = col.accessor('reportedQty', {
  header: 'Zgłoszono',
  meta: { align: 'center', vertical: true },
  cell: ({ row }) => (
    <span className="whitespace-nowrap tabular-nums">
      {formatQtyWithUnit(row.original.reportedQty, row.original.unit)}
    </span>
  ),
})
// „Spoza rozpiski” has one figure, so its header has the width to lie flat.
const extraReportedColumn = {
  ...reportedColumn,
  meta: { align: 'center' },
} satisfies typeof reportedColumn
const acceptedColumn = col.display({
  id: 'accepted',
  header: 'Przyjmuję',
  meta: { align: 'center', vertical: true },
  cell: ({ row }) => <AcceptedQtyCell row={row.original} />,
})
const stageColumn = col.accessor((row) => row.figures?.stageQty ?? 0, {
  id: 'stage',
  header: () => <StageHeader />,
  meta: {
    align: 'center',
    label: 'Etap',
    description: 'wartości etapu, do którego przyjmujesz zgłoszenie',
    vertical: true,
  },
  cell: ({ row }) => <StageCell row={row.original} />,
})
const OFFERED_PLANNED_ID = 'plannedQty'
const offeredPlannedColumn = col.accessor((row) => row.figures?.plannedQty ?? 0, {
  id: OFFERED_PLANNED_ID,
  header: COLUMN_LABELS.plannedQty,
  meta: { align: 'center', vertical: true },
  cell: ({ row }) => row.original.figures && formatQty(row.original.figures.plannedQty),
})
const plannedColumn = col.accessor((row) => row.figures?.currentPlannedQty ?? 0, {
  id: 'planned',
  header: COLUMN_LABELS.currentPlannedQty,
  meta: { align: 'center', vertical: true },
  cell: ({ row }) =>
    row.original.figures &&
    (row.original.figures.currentPlannedQty > 0 ? (
      formatQty(row.original.figures.currentPlannedQty)
    ) : (
      <span className="text-muted-foreground">—</span>
    )),
})
const STAGE_QTY_SUM_LABEL = 'Pomiar z natury'
const stageQtySumColumn = col.accessor((row) => row.figures?.measuredQty ?? 0, {
  id: 'stageQtySum',
  header: STAGE_QTY_SUM_LABEL,
  meta: {
    align: 'center',
    vertical: true,
    description: 'ile jest aktualnie zgłoszone',
  },
  cell: ({ row }) => row.original.figures && formatQty(row.original.figures.measuredQty),
})
const stageQtySumAfterColumn = col.display({
  id: 'stageQtySumAfter',
  header: STAGE_QTY_SUM_LABEL,
  meta: {
    align: 'center',
    vertical: true,
    label: `${STAGE_QTY_SUM_LABEL} po przyjęciu`,
    description: 'po przyjęciu zgłoszenia',
  },
  cell: ({ row }) => <StageQtySumAfterCell row={row.original} />,
})
const MEASURED_LABEL = `Pomiar z natury / ${COLUMN_LABELS.currentPlannedQty}`
const measuredColumn = col.accessor((row) => row.figures?.measuredQty ?? 0, {
  id: 'measured',
  header: MEASURED_LABEL,
  meta: { align: 'center', vertical: true },
  cell: ({ row }) => <MeasuredCell row={row.original} />,
})
// The worker's opis and its podpowiedź are read side by side, so they split the width evenly rather
// than by whichever happens to be longer.
const EXTRA_TEXT_WIDTH = 'min-w-80 w-1/3'
const manualDescriptionColumn = col.accessor('description', {
  header: 'Opis prac',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.description, second.original.description),
  meta: { minWidth: EXTRA_TEXT_WIDTH },
  cell: ({ row }) => <ManualDescriptionCell row={row.original} />,
})
const catalogueHintsColumn = col.display({
  id: 'catalogueHints',
  header: 'Może chodzi o',
  meta: { minWidth: EXTRA_TEXT_WIDTH },
  cell: ({ row }) => <CatalogueHintsCell row={row.original} />,
})

const COLUMNS_BY_GROUP = {
  rozpiska: [
    tickColumn,
    refColumn,
    sectionColumn,
    reviewDescriptionColumn,
    workerDescriptionColumn,
    stageQtySumColumn,
    reportedColumn,
    acceptedColumn,
    stageColumn,
    stageQtySumAfterColumn,
    offeredPlannedColumn,
    plannedColumn,
    measuredColumn,
    rejectColumn,
  ],
  extra: [
    rejectColumn,
    manualDescriptionColumn,
    catalogueHintsColumn,
    workerDescriptionColumn,
    extraReportedColumn,
  ],
}

// The group's title and hint share the column picker's row, so the picker takes no line of its own.
// Collapsed keeps the heading row, so the column picker stays reachable with the table hidden.
type PropsT = ReviewTablePropsT & {
  group: LineGroupT
  heading: ReactNode
  isCollapsed?: boolean
  // Decided over the whole report, not the searched rows, so the column holds still while typing.
  hasWorkerDescription: boolean
}

export function ReviewLinesTable({
  group,
  heading,
  isCollapsed = false,
  hasWorkerDescription,
  ...props
}: PropsT) {
  const catalogueById = new Map(props.catalogue.map((entry) => [entry.id, entry]))
  return (
    <ReviewTableContext value={{ ...props, catalogueById }}>
      <DataTable
        data={props.rows}
        columns={
          hasWorkerDescription
            ? COLUMNS_BY_GROUP[group]
            : COLUMNS_BY_GROUP[group].filter((column) => column !== workerDescriptionColumn)
        }
        storageKey={`worker-report-${group}`}
        defaultColumnVisibility={{ [OFFERED_PLANNED_ID]: false }}
        renderRows={isCollapsed ? () => null : undefined}
        // Read across the row, figure against figure.
        className="[&_td+td]:border-border [&_th+th]:border-border [&_td+td]:border-l [&_th+th]:border-l"
        defaultTextSize="xs"
        toolbar={({ table, columnVisibility, ...order }) => (
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">{heading}</div>
            <ColumnToggle table={table} columnVisibility={columnVisibility} {...order} />
          </div>
        )}
        getRowClassName={(row) =>
          cn(
            'worker-report-rail',
            sectionColorRail(row.sectionColor),
            props.drafts[row.id].isTicked && 'bg-primary/5',
            props.drafts[row.id].isRejected && 'bg-destructive/5',
          )
        }
      />
    </ReviewTableContext>
  )
}
