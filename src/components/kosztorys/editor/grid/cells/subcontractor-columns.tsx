import { useState } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { decimalText } from '@/lib/utils/decimal-text'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { overrideCoeffFor, priceSourceOf, viewPrice } from '@/lib/kosztorys/calc'
import { checkSubcontractorPrice } from '@/lib/kosztorys/subcontractor-price-guard'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import { FLAGGED_TONE } from '@/lib/kosztorys/constants'
import {
  sourceChange,
  subcontractorCoeffPolicy,
  subcontractorPolicy,
} from '@/lib/kosztorys/subcontractor-price-edit'
import { cellPaste } from '@/lib/kosztorys/cell-edit'
import { useCellDraft } from '@/components/kosztorys/editor/grid/cells/use-cell-draft'
import type { KosztorysV2RowT, PriceSourceT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { ReactNode } from 'react'

// Where the subcontractor price comes from (a column in the subcontractor views). Labels name the
// SOURCE, not the arithmetic: auto derives the rate from the investment's mnożnik, „własny mnożnik"
// is this praca's own multiple of the cena j.m., „kwota stała" is a frozen number.
//
// The values ARE `PriceSourceT`, so the menu and `priceSourceOf` cannot drift into two vocabularies —
// nothing is stored to name the source, it is read off the pair of columns (EX-766, EX-865).
const SUB_MODE_OPTIONS: { value: PriceSourceT; label: string }[] = [
  { value: 'auto', label: 'auto' },
  { value: 'coeff', label: 'własny mnożnik' },
  { value: 'amount', label: 'kwota stała' },
]

// Everything the cells need to know about which plane they are editing. Travels via
// `columnData` so each component keeps ONE identity across renders — an inline `component:
// ({rowData}) => …` is a fresh function type on every assembleV2Columns call, which makes
// react-datasheet-grid remount the cell's DOM instead of reconciling it, losing both the typed text
// and the rejection state below (EX-422, lessons.md — „A `react-datasheet-grid` column's `component`
// must be a STABLE reference").
type SubcontractorCellDataT = {
  view: ToolPlaneT
}

const cellData = (view: ToolPlaneT): SubcontractorCellDataT => ({ view })

// `kosztorys-cell-input-body` (globals.css) keeps this wrapper geometrically invisible: the grid
// shapes a cell's direct span into the wrapping, clipping, margined box that read-only TEXT needs,
// and an input pushed through that box sits a few pixels off the same figure in the cell next door.
const CELL_WRAPPER = 'kosztorys-cell-input-body size-full'

// A derived price carries the float tail of client × coeff; the cell edits grosze, not the tail.
const priceText = (value: number): string => decimalText(roundToCents(value))

// The verdict explains itself where the user is typing rather than in a corner toast, mirroring the
// blocked-action tooltip in kosztorys-row-actions-menu.tsx. `open` is forced while a REFUSAL stands
// because nobody hovers a cell they are typing into. A warning does not force it: that value was
// written, so the red figure carries it until the settle toast names it.
//
// The tree shape NEVER varies with `message`: returning bare children when there is nothing to say
// would change the element type at this position the moment a verdict appears, and React answers a
// changed type by unmounting the subtree — which destroys the input the user is typing into, one
// keystroke after they cross the threshold. Same reason `open` is driven by our own hover state
// rather than left uncontrolled some of the time: Radix would be switching controlled modes.
function CellTooltip({
  message,
  forceOpen,
  children,
}: {
  message: string | null
  forceOpen: boolean
  children: ReactNode
}) {
  const [reveal, setReveal] = useState(false)
  return (
    <SimpleTooltip content={message ?? ''} open={message != null && (forceOpen || reveal)}>
      <span
        className={CELL_WRAPPER}
        onPointerEnter={() => setReveal(true)}
        onPointerLeave={() => setReveal(false)}
        // Taking `open` over from Radix took its focus handling with it, and a keyboard user tabbing
        // into a refused cell was left with a red number and no sentence.
        onFocusCapture={() => setReveal(true)}
        onBlurCapture={() => setReveal(false)}
      >
        {children}
      </span>
    </SimpleTooltip>
  )
}

// The "Cena" column in the subcontractor view. Editable in both modes — a hand-typed price IS „kwota
// stała", so the keystroke carries the mode with it rather than making the user set „Źródło" first.
// Clearing it reverts the row to „auto".
//
// This is also the one cell carrying the guard's STANDING verdict on a kwota stała: the rule is about
// the price, and a breach caused from outside these columns — a lowered client price — has to surface
// without anyone opening them. On „auto" it says nothing, because the author of that figure is the
// investment's mnożnik, which is judged once in its own field instead of once per pozycja.
function SubcontractorPriceCell({
  rowData,
  setRowData,
  columnData,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view } = columnData
  const edit = useCellDraft(
    rowData,
    setRowData,
    subcontractorPolicy<KosztorysV2RowT>(view),
    stopEditing,
  )

  const source = priceSourceOf(rowData, view)
  // A live rejection outranks the standing verdict: it describes the value on screen, which the row
  // has not accepted.
  const message = edit.blockReason ?? checkSubcontractorPrice(rowData, view)?.message ?? null

  // At „własny mnożnik" the stawka is an OUTPUT — the mnożnik cell authors it. Leaving this one
  // editable would give one figure two authors, and a keystroke here writes a kwota, which silently
  // switches the row's source back.
  const body =
    source === 'coeff' ? (
      <ReadOnlyCellText muted danger={message != null}>
        {priceText(viewPrice(rowData, view))}
      </ReadOnlyCellText>
    ) : (
      <EditableCellInput
        {...edit.inputProps}
        className={
          message ? FLAGGED_TONE : source === 'auto' ? 'text-muted-foreground italic' : undefined
        }
        value={edit.draft ?? priceText(viewPrice(rowData, view))}
        focus={focus}
      />
    )

  // Red figure plus the sentence on hover, and nothing else in the box: a glyph beside the number
  // took width from the input and put the figure on a different height than its neighbours (owner,
  // 2026-09-01).
  return (
    <CellTooltip message={message} forceOpen={edit.blockReason != null}>
      {body}
    </CellTooltip>
  )
}

function SubcontractorModeCell({
  rowData,
  setRowData,
  columnData,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view } = columnData
  // Two ways in, one way out. The grid opens the menu through `focus` (Enter, or typing over the
  // cell); a click opens it through Radix's own trigger, which the grid never sees — hence the local
  // flag, without which wiring `focus` alone would have cost mouse users the single click they have
  // today. Either way the close is what tells the grid the edit is over: leave it out and the cell
  // stays „editing" with nothing on screen, so the next Enter closes an already-closed menu.
  const [openedByClick, setOpenedByClick] = useState(false)
  return (
    <CellSelectMenu
      value={priceSourceOf(rowData, view)}
      options={SUB_MODE_OPTIONS}
      open={focus || openedByClick}
      onOpenChange={(open) => {
        setOpenedByClick(open)
        // Explicit, because the grid's own default is `nextRow: true` — picking a source must leave
        // the cursor on the row whose source was just picked.
        if (!open) stopEditing({ nextRow: false })
      }}
      onChange={(value) => setRowData(sourceChange(rowData, value as PriceSourceT, view))}
    />
  )
}

// „Mnożnik" — the multiplier itself, editable ONLY where it is the source. Elsewhere the cell is
// empty rather than showing the multiple the row happens to sit at: a number here reads as „this is
// what the row is set to", and at „auto" or „kwota stała" nothing of the sort is stored.
function SubcontractorCoeffCell({
  rowData,
  setRowData,
  columnData,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SubcontractorCellDataT>) {
  const { view } = columnData
  const edit = useCellDraft(
    rowData,
    setRowData,
    subcontractorCoeffPolicy<KosztorysV2RowT>(view),
    stopEditing,
  )

  if (priceSourceOf(rowData, view) !== 'coeff') {
    return <ReadOnlyCellText muted>{''}</ReadOnlyCellText>
  }

  return (
    <CellTooltip message={edit.blockReason} forceOpen={edit.blockReason != null}>
      <EditableCellInput
        {...edit.inputProps}
        className={edit.blockReason ? FLAGGED_TONE : undefined}
        value={edit.draft ?? decimalText(overrideCoeffFor(rowData, view))}
        focus={focus}
      />
    </CellTooltip>
  )
}

export function subcontractorPriceColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const policy = subcontractorPolicy<KosztorysV2RowT>(view)
  return {
    id: planePriceKey('price', view),
    title: titleNode,
    columnData: cellData(view),
    component: SubcontractorPriceCell,
    copyValue: ({ rowData }) => priceText(viewPrice(rowData, view)),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
  }
}

export function subcontractorModeColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { clear } = subcontractorPolicy<KosztorysV2RowT>(view)
  return {
    id: planePriceKey('priceMode', view),
    title: titleNode,
    // Fits the header label next to the sort icon — below this the title truncates.
    minWidth: 185,
    // The menu is a portal outside the grid, so a click on one of its items reads as a click away —
    // without this the grid would end the edit before the pick lands.
    keepFocus: true,
    // Hands Enter and the arrow keys to the open menu; the grid claims them otherwise and the
    // keyboard could open the list but never walk it.
    disableKeys: true,
    columnData: cellData(view),
    component: SubcontractorModeCell,
    copyValue: ({ rowData }) => priceSourceOf(rowData, view),
    deleteValue: ({ rowData }) => clear(rowData),
  }
}

export function subcontractorCoeffColumn(
  view: ToolPlaneT,
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const policy = subcontractorCoeffPolicy<KosztorysV2RowT>(view)
  return {
    id: planePriceKey('priceCoeff', view),
    title: titleNode,
    columnData: cellData(view),
    component: SubcontractorCoeffCell,
    copyValue: ({ rowData }) => decimalText(overrideCoeffFor(rowData, view)),
    pasteValue: ({ rowData, value }) => cellPaste(value, rowData, policy),
    deleteValue: ({ rowData }) => policy.clear(rowData),
  }
}
