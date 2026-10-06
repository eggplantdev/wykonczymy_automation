'use client'

import { createContext, use, useState, useTransition } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { SearchIcon } from 'lucide-react'
import { Checkbox, checkedState } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchSelect, type SearchSelectItemT } from '@/components/ui/search-select'
import { SimpleSelect, type SelectOptionT } from '@/components/ui/simple-select'
import { CandidateRow } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-candidate-row'
import { CatalogueSwapDialog } from '@/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog'
import { DataTable } from '@/components/tables/data-table/data-table'
import {
  acceptedQtyNote,
  isLineReady,
  previewQtyChange,
  UNDO_CATALOGUE_SWAP,
  type ItemFiguresT,
  type LineDraftT,
  type LineGroupT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import { reviewedDescription } from '@/lib/kosztorys/worker-report/reviewed-description'
import { isLanguage, LANGUAGE_SHORT } from '@/lib/i18n/languages'
import { formatQty, formatQtyWithUnit } from '@/lib/kosztorys/format'
import { COLUMN_LABELS } from '@/lib/kosztorys/columns/column-config'
import { sectionColorRail, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import type { KosztorysItemRefT } from '@/lib/kosztorys/work-catalogue/already-in-kosztorys'
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
  itemDescription: string | undefined
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
  sectionOptions: SelectOptionT[]
  itemOptions: SearchSelectItemT[]
  catalogue: WorkCatalogueItemT[]
  kosztorysItems: readonly KosztorysItemRefT[]
  onCatalogueSwap: (lineId: number, entry: WorkCatalogueItemT) => void
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

function TickHeader() {
  const { rows, drafts, onChange } = useReviewTable()
  const bulkRows = rows.filter((row) => !row.isDuplicateItem)
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
      onCheckedChange={(checked) => onChange(row.id, { isTicked: checked === true })}
    />
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
        className="h-8 w-20 tabular-nums"
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
      {row.isUnitMissing && drafts[row.id].catalogueId === undefined && (
        <span className="text-destructive block text-xs">
          Brak j.m. w kosztorysie — wybierz pracę z katalogu
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

function MeasuredCell({ row }: { row: ReviewRowT }) {
  const added = previewQtyChange(row, useReviewTable().drafts[row.id], row.isFigureLive)
  if (!row.figures) return null
  const { measuredQty, plannedQty } = row.figures
  const isOverPlanned = plannedQty > 0 && measuredQty + added > plannedQty
  return (
    <span className="whitespace-nowrap">
      <span className={cn(isOverPlanned && 'text-amber-600 dark:text-amber-400')}>
        <GrowingQty before={measuredQty} added={added} />
      </span>
      {isOverPlanned && <span className={WARNING_NOTE}>Przekroczono przedmiar</span>}
    </span>
  )
}

// Where the worker's words were swapped for a katalog praca: what he wrote stays in view, and so
// does a j.m. that disagrees with the katalog's — the ilość is his, counted in his unit.
function SwapNote({ row, unit }: { row: ReviewRowT; unit: string | undefined }) {
  const { drafts, onChange } = useReviewTable()
  const isSwapped = drafts[row.id].catalogueId !== undefined
  return (
    <>
      <span className="text-muted-foreground block text-xs">
        {isSwapped ? 'Z katalogu · zgłoszono' : 'Zgłoszono'} „{reviewedDescription(row)}”
        {row.polishDescription !== undefined &&
          ` (${languageShort(row.descriptionLanguage)}: „${row.description}”)`}
      </span>
      {unit !== undefined && unit !== row.unit && (
        <span className={WARNING_NOTE}>
          j.m. katalogu: {unit}, zgłoszono w {row.unit}
        </span>
      )}
      {isSwapped && !row.isAccepted && (
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

// A katalog praca the rozpiska already holds: the line adds to that pozycja. In several sekcje, the
// kierownik says which.
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
      <SwapNote row={row} unit={entry?.unit} />
      {choices.length > 1 && !row.isAccepted && (
        <SimpleSelect
          value={draft.itemId === undefined ? '' : String(draft.itemId)}
          onValueChange={(value) => onChange(row.id, { itemId: Number(value) })}
          options={choices}
          placeholder="W której sekcji?"
          className={cn('mt-1 h-8 max-w-80', draft.itemId === undefined && 'border-destructive')}
        />
      )}
    </>
  )
}

const languageShort = (language: string | undefined) =>
  isLanguage(language) ? LANGUAGE_SHORT[language] : 'inny język'

function TranslationNote({ row }: { row: ReviewRowT }) {
  const { onRetranslate } = useReviewTable()
  const [isTranslating, startTranslating] = useTransition()
  const isTranslated = row.polishDescription !== undefined
  return (
    <>
      {isTranslated && (
        <span className="text-muted-foreground block text-xs">
          Zgłoszono ({languageShort(row.descriptionLanguage)}): „{row.description}”
        </span>
      )}
      {row.descriptionLanguage === undefined && (
        <span className="text-muted-foreground block text-xs">Brak tłumaczenia</span>
      )}
      {onRetranslate && !row.isAccepted && (
        <Button
          variant="link"
          size="xs"
          className="h-auto p-0"
          disabled={isTranslating}
          onClick={() => startTranslating(() => onRetranslate(row.id))}
        >
          {isTranslating ? 'Tłumaczę…' : isTranslated ? 'Przetłumacz ponownie' : 'Przetłumacz'}
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
      <SwapNote row={row} unit={swapped.unit} />
      <ScanFlags row={row} />
    </>
  )
}

// The worker names a praca in his own words; the manager often recognises a katalog wpis in them.
// Swapping it in carries the katalog's opis, j.m. and cena, so the new pozycja is priced like any
// other instead of by hand.
function CatalogueCell({ row }: { row: ReviewRowT }) {
  const { drafts, catalogue, catalogueById, kosztorysItems, onCatalogueSwap, hintsByLine } =
    useReviewTable()
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  if (row.isAccepted || drafts[row.id].catalogueId !== undefined) return null

  const hints = hintsByLine[row.id] ?? []
  return (
    <div className="flex flex-col items-start gap-1">
      {hints.length > 0 && <span className="text-muted-foreground text-xs">Może chodzi o:</span>}
      {hints.map((hint) => (
        <CandidateRow
          key={hint.id}
          entry={hint}
          readOnly={false}
          onClick={() => {
            const entry = catalogueById.get(hint.id)
            if (entry) onCatalogueSwap(row.id, entry)
          }}
        />
      ))}
      <Button variant="outline" size="sm" onClick={() => setIsPickerOpen(true)}>
        <SearchIcon />
        Szukaj w katalogu…
      </Button>
      {isPickerOpen && (
        <CatalogueSwapDialog
          catalogue={catalogue}
          kosztorysItems={kosztorysItems}
          reported={{ description: reviewedDescription(row), unit: row.unit }}
          onPick={(entry) => onCatalogueSwap(row.id, entry)}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  )
}

// Reads `--section-rail` from the row, so the pill takes the same colour as the rail beside it.
function SectionPill({ name }: { name: string }) {
  return (
    <span className="worker-report-section inline-block max-w-40 truncate rounded px-1.5 py-0.5 text-xs font-medium max-sm:max-w-24">
      {name}
    </span>
  )
}

function TargetSectionCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange, sectionOptions } = useReviewTable()
  const draft = drafts[row.id]
  return (
    <SimpleSelect
      value={draft.sectionId}
      onValueChange={(sectionId) => onChange(row.id, { sectionId })}
      options={sectionOptions}
      placeholder="Wybierz sekcję"
      disabled={row.isAccepted || !draft.isTicked}
      className={cn(
        'h-8 w-44',
        draft.isTicked && draft.sectionId === '' && !row.isAccepted && 'border-destructive',
      )}
    />
  )
}

function UnitPriceCell({ row }: { row: ReviewRowT }) {
  const { drafts, onChange } = useReviewTable()
  const draft = drafts[row.id]
  const isPriceMissing =
    draft.isTicked && draft.sectionId !== '' && !isLineReady(row, draft, undefined)
  return (
    <Input
      aria-label={`Cena j.m.: ${row.description}`}
      inputMode="decimal"
      placeholder="zł"
      value={draft.unitPrice}
      disabled={row.isAccepted || !draft.isTicked}
      aria-invalid={isPriceMissing}
      onChange={(event) => onChange(row.id, { unitPrice: event.target.value })}
      className="h-8 w-24 text-right tabular-nums"
    />
  )
}

const col = createColumnHelper<ReviewRowT>()

const DESCRIPTION_MIN_WIDTH = 'min-w-96'

const tickColumn = col.display({
  id: 'tick',
  header: () => <TickHeader />,
  cell: ({ row }) => <TickCell row={row.original} />,
})
// Sorted by the rozpiska's own section order, not alphabetically — that is the order both people know.
const sectionColumn = col.accessor((row) => row.sectionOrder, {
  id: 'section',
  header: 'Sekcja',
  cell: ({ row }) => <SectionPill name={row.original.sectionName} />,
})
const reviewDescriptionColumn = col.accessor('description', {
  header: 'Opis prac',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.description, second.original.description),
  meta: { fill: true, minWidth: DESCRIPTION_MIN_WIDTH },
  cell: ({ row }) => <RozpiskaDescriptionCell row={row.original} />,
})
const reportedColumn = col.accessor('reportedQty', {
  header: 'Zgłoszono',
  cell: ({ row }) => (
    <span className="whitespace-nowrap tabular-nums">
      {formatQtyWithUnit(row.original.reportedQty, row.original.unit)}
    </span>
  ),
})
const acceptedColumn = col.display({
  id: 'accepted',
  header: 'Przyjmuję',
  cell: ({ row }) => <AcceptedQtyCell row={row.original} />,
})
const stageColumn = col.accessor((row) => row.figures?.stageQty ?? 0, {
  id: 'stage',
  header: () => <StageHeader />,
  cell: ({ row }) => <StageCell row={row.original} />,
})
const plannedColumn = col.accessor((row) => row.figures?.plannedQty ?? 0, {
  id: 'planned',
  header: COLUMN_LABELS.plannedQty,
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
  cell: ({ row }) => <TargetSectionCell row={row.original} />,
})
const manualDescriptionColumn = col.accessor('description', {
  header: 'Opis prac',
  sortingFn: (first, second) =>
    compareDescriptions(first.original.description, second.original.description),
  meta: { fill: true, minWidth: DESCRIPTION_MIN_WIDTH },
  cell: ({ row }) => <ManualDescriptionCell row={row.original} />,
})
const catalogueColumn = col.display({
  id: 'catalogue',
  header: 'Katalog',
  cell: ({ row }) => <CatalogueCell row={row.original} />,
})
const unitPriceColumn = col.display({
  id: 'unitPrice',
  header: 'Cena j.m.',
  meta: { align: 'right' },
  cell: ({ row }) => <UnitPriceCell row={row.original} />,
})

const COLUMNS_BY_GROUP = {
  rozpiska: [
    tickColumn,
    sectionColumn,
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
    catalogueColumn,
    reportedColumn,
    acceptedColumn,
    targetSectionColumn,
    unitPriceColumn,
  ],
}

type PropsT = ReviewTablePropsT & { group: LineGroupT }

export function ReviewLinesTable({ group, ...props }: PropsT) {
  const catalogueById = new Map(props.catalogue.map((entry) => [entry.id, entry]))
  return (
    <ReviewTableContext value={{ ...props, catalogueById }}>
      <DataTable
        data={props.rows}
        columns={COLUMNS_BY_GROUP[group]}
        getRowClassName={(row) =>
          cn(
            'worker-report-rail',
            sectionColorRail(row.sectionColor),
            props.drafts[row.id].isTicked && 'bg-primary/5',
          )
        }
      />
    </ReviewTableContext>
  )
}
