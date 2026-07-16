'use client'

import { type ReactNode, useRef, useState } from 'react'
import { Column, type CellProps, keyColumn, textColumn, floatColumn } from 'react-datasheet-grid'
import { CellSelectMenu } from '@/components/kosztorys/cell-select-menu'
import { SortHeader } from '@/components/kosztorys/sort-header'
import { StageHeader } from '@/components/kosztorys/stage-header'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysRowActionsMenu } from '@/components/kosztorys/kosztorys-row-actions-menu'
import { ResizableHeader } from '@/components/kosztorys/column-resize-handle'
import {
  effectiveCoeff,
  rowDiscountForView,
  rowDoneFraction,
  rowPlannedNetForView,
  stageDoneFraction,
  stageValueForView,
  toGross,
  viewPrice,
  type PriceViewT,
} from '@/lib/kosztorys/calc'
import { Combobox } from '@/components/ui/combobox'
import { discountFromType, discountFromValue } from '@/lib/kosztorys/discount-edit'
import { parseDecimalInput } from '@/lib/kosztorys/parse-decimal-input'
import { type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import {
  COLUMN_LABELS,
  NON_HIDEABLE_COLUMNS,
  STAGE_QTY_PREFIX,
  STAGE_VALUE_GROSS_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGE_VALUE_PERCENT_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
  UNIT_SUGGESTIONS,
  stageValueGrossKey,
  stageValueNetKey,
  stageValuePercentKey,
} from '@/lib/kosztorys/constants'
import { LAYER_DEFAULT, layerAllows, type LayerT } from '@/lib/kosztorys/layer'
import { MONEY_AXIS_DEFAULT, axisAllows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import {
  PROGRESS_DISPLAY_DEFAULT,
  progressDisplayAllows,
  type ProgressDisplayT,
} from '@/lib/kosztorys/progress-display'
import { formatNet as fmt, formatPercent } from '@/lib/kosztorys/format'
import {
  hasStagesOverPlanned,
  rowRemainingForView,
  rowTotalQtyDone,
  rowValueForView,
  stageKey,
  type SortDirT,
} from '@/lib/kosztorys/v2-rows'
import type {
  DiscountTypeT,
  KosztorysStageT,
  KosztorysV2RowT,
  SubcontractorOverrideTypeT,
  ViewPricingT,
} from '@/types/kosztorys'

// floatColumn right-aligns by default; the grid reads cleaner with every cell left-aligned under
// its (left-aligned) header, so numbers don't float at the far edge of wide columns.
const floatColumnLeft = {
  ...floatColumn,
  columnData: { ...floatColumn.columnData, alignRight: false },
}

const DISCOUNT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Bez rabatu' },
  { value: 'percent', label: '%' },
  { value: 'amount', label: 'zł' },
]

// Where the subcontractor price comes from (a column in the subcontractor views). Labels name the
// SOURCE of the multiplier, not the arithmetic: auto and 'coeff' both compute clientPrice × n and
// differ only in whether n is inherited — labels describing the maths read as synonyms.
const SUB_MODE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'auto' },
  { value: 'coeff', label: 'własny mnożnik' },
  { value: 'amount', label: 'kwota stała' },
]

const OVERRIDE_FIELDS: Record<
  'w_tools' | 'own_tools',
  { type: keyof KosztorysV2RowT; value: keyof KosztorysV2RowT }
> = {
  w_tools: { type: 'wToolsOverrideType', value: 'wToolsOverrideValue' },
  own_tools: { type: 'ownToolsOverrideType', value: 'ownToolsOverrideValue' },
}

export type V2SortStateT = { field: string; dir: SortDirT } | null

export type BuildV2ColumnsOptsT = {
  view: PriceViewT
  // Stages (etapy) render as dynamic editable columns; a trailing "Pozostało" reads out the
  // remaining net.
  stages: KosztorysStageT[]
  onRemoveStage?: (stageId: number) => void
  onRenameStage?: (stageId: number, label: string) => void
  sort?: V2SortStateT
  onSetSort?: (field: string, dir: SortDirT | null) => void
  // Column picker: true = this column is off — by the user's stored choice OR by
  // DEFAULT_HIDDEN_COLUMNS, which the caller resolves; the two are indistinguishable here. Keyed by
  // column id, except stage columns, which answer to one of the three stage groups (constants.ts).
  isHidden?: (id: string) => boolean
  // Money axis: narrows the picker's answer further, never widens it. Omitted = 'both' = every
  // column the picker allows, which is what buildV2ToggleItems (axis-blind by design) assumes.
  moneyAxis?: MoneyAxisT
  // Progress display: narrows the same way the money axis does, on the other axis — a stage's
  // progress reads either as money or as a percentage, never as both at once.
  progressDisplay?: ProgressDisplayT
  // Layer: narrows to the working columns or the progress tracker. Omitted = 'both' = no narrowing.
  layer?: LayerT
  // Resize: pinned column widths (id→px) + drag callbacks. When provided, every column
  // gets a handle; pinned ones get basis/grow:0 (the rest stay on flex).
  widths?: Record<string, number>
  onGuide?: (x: number | null) => void
  onCommitColumn?: (id: string, width: number) => void
  // Row actions: removing an item + reading a section's item count (to enforce the
  // "≥1 item" invariant).
  onRemoveItem?: (row: KosztorysV2RowT) => void
  // Reason the row's delete is blocked (disabled + tooltip), or undefined if removable.
  getRemoveBlockReason?: (row: KosztorysV2RowT) => string | undefined
  // Reordering items within a section (Przesuń w górę/dół). Greyed out while a column sort is
  // active — "up/down" has no meaning against a price-sorted list.
  onReorderItem?: (row: KosztorysV2RowT, dir: 'up' | 'down') => void
  // Inserting a blank item above/below the row within its section.
  onInsertItem?: (row: KosztorysV2RowT, dir: 'above' | 'below') => void
  // Renaming the whole section from its (denormalized) name cell. Routes through the same fan-out
  // as the section panel — never a per-row setRowData, which would desync the other rows' copies.
  onRenameSection?: (sectionId: number, name: string) => void
  // Global discount active → the four per-item discount columns are overridden, so drop them from
  // the grid and the picker (the underlying data stays and returns when the discount is cleared).
  globalDiscountActive?: boolean
}

// The four per-item rabat columns hidden while the global discount overrides them.
const DISCOUNT_COLUMN_IDS = new Set([
  'discountValue',
  'discountType',
  'discountAmount',
  'discountAmountGross',
])

// keyColumn requires column: Column<Row[K]>. floatColumn/textColumn are nullable
// (Column<number|null> / <string|null>), whereas the item fields are non-null. The cell type is
// invariant (rowData covariant + setRowData contravariant), so no concrete type other than an
// exact match will pass — the only safe bridge is `any` at the library boundary. The cells are
// null-safe at runtime; we return a ready Column<KosztorysV2RowT>.
function keyCol(
  key: keyof KosztorysV2RowT,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Partial<Column<any>>,
  rest: Partial<Column<KosztorysV2RowT>>,
): Column<KosztorysV2RowT> {
  return { ...(keyColumn(key, column) as Column<KosztorysV2RowT>), ...rest }
}

// Audit aid (may be temporary): each header explains the column's intent + the formula that
// drives it, so mismatches between intent and calc are visible.
const HEADER_TIPS: Record<string, string> = {
  sectionName:
    'Sekcja — nazwa sekcji kosztorysu.\nEdycja tutaj zmienia nazwę całej sekcji (wartość jest zdenormalizowana na każdym wierszu). Zatwierdź Enterem lub wyjściem z pola, Escape cofa.',
  description: 'Opis — nazwa/opis pozycji robót lub materiału. Nie wchodzi do obliczeń.',
  unit: 'J.m. — jednostka miary (m², szt., mb…). Etykieta, nie wchodzi do obliczeń.',
  plannedQty:
    'Przedmiar — ilość planowana (z przedmiaru/oferty).\nNapędza Wartość przedmiaru (= Przedmiar × Cena − Rabat). Netto liczone jest z Pomiaru.',
  stageQtySum:
    'Pomiar — ilość faktycznie wykonana.\nTylko do odczytu: liczona automatycznie jako suma ilości ze wszystkich etapów. Napędza Netto = Pomiar × Cena − Rabat.',
  price:
    'Cena j.m. — cena jednostkowa przy aktywnym widoku cen (klient lub podwykonawca).\nW widokach wykonawcy edytowalna tylko przy „kwota stała" — w pozostałych trybach jest wyliczana (Cena klienta × Mnożnik).',
  priceCoeff:
    'Mnożnik — przez ile mnożona jest Cena klienta, by dać cenę wykonawcy.\n1 = tyle co Cena klienta · 0.65 = 65% ceny klienta · 1.2 = 120% ceny klienta.\n\nSzary kursywą = dziedziczony (z sekcji, a gdy nieustawiony — domyślny z inwestycji). Wpisanie własnego przestawia wiersz na „własny mnożnik".\n„—" przy „kwota stała": cena jest wpisana wprost, mnożnik się nie stosuje.',
  priceMode:
    'Źródło ceny wykonawcy — skąd bierze się mnożnik.\n\nAuto = mnożnik dziedziczony: z sekcji, a gdy nieustawiony — domyślny z inwestycji.\nWłasny mnożnik = mnożnik wpisany w tym wierszu.\nKwota stała = cena wpisana wprost, nie podąża za Ceną klienta.\n\nAuto i własny mnożnik liczą tak samo (Cena klienta × mnożnik) — różni je tylko pochodzenie mnożnika.',
  discountType:
    'Rabat — typ rabatu: — brak · % procent · zł kwota.\nUstawienie „Bez rabatu" czyści też Rabat wart.',
  discountValue:
    'Rabat wart. — wartość rabatu.\nDla % = punkty procentowe (10 = 10%); dla zł = kwota odjęta od Netto.\nWpisanie wartości przy „Bez rabatu" ustawia typ na %. Wyczyszczenie pola kasuje rabat.',
  discountAmount:
    'Rabat kwota netto — ile złotych faktycznie schodzi z tej pozycji (Pomiar × Cena j.m. − Netto).\nPrzy rabacie % przelicza punkty procentowe na złotówki; przy rabacie zł jest równy wpisanej kwocie.\nZależy od aktywnego widoku cen — ten sam rabat % daje inną kwotę przy cenie klienta i przy cenie wykonawcy.',
  discountAmountGross: 'Rabat kwota brutto = Rabat kwota netto × (1 + VAT).',
  priceGross:
    'Cena j.m. brutto = Cena j.m. netto × (1 + VAT).\nStawka VAT jest jedna na całą inwestycję — ta kolumna to przelicznik, nie osobna dana.',
  plannedNet:
    'Wartość przedmiaru netto = Przedmiar × Cena − Rabat. Wartość ofertowa pozycji — ile miało wejść wg przedmiaru.\nRabat jest w kwocie zawarty (jak w arkuszu). Różnica Netto − Wartość przedmiaru to sama korekta ilości: obie kwoty niosą już rabat.',
  plannedGross: 'Wartość przedmiaru brutto = Wartość przedmiaru netto × (1 + VAT).',
  net: 'Netto = Pomiar × Cena − Rabat. Wartość pozycji przy aktywnym widoku cen.\nPomiar jest sumą etapów, więc Netto mówi, ile faktycznie wykonano — pusta pozycja jest warta 0.',
  gross: 'Brutto = Netto × (1 + VAT). Jedna stawka VAT na inwestycję, zdenormalizowana na wierszu.',
  remaining:
    'Pozostało netto = Wartość netto przedmiar − Netto.\nIle z oferty nie zostało jeszcze wykonane. Pusty wiersz etapów = cała oferta zostaje.\nNa minusie = zrobiono więcej, niż przewidywał Przedmiar. „—" = pozycja nie ma Przedmiaru, więc nie ma oferty, od której odejmować.',
  remainingGross: 'Pozostało brutto = Pozostało netto × (1 + VAT).',
  donePercent:
    '% wykonania = suma ilości ze wszystkich etapów ÷ Przedmiar.\nIle procent oferty jest zrobione. Nie zależy od widoku cen ani od netto/brutto — to stosunek ilości, cena i rabat go nie ruszają.\n„—" = brak Przedmiaru, więc nie ma czego dzielić (to nie to samo co 0%). Powyżej 100% = zrobiono więcej, niż przewidywał Przedmiar; wartość nie jest przycinana, bo to jest ta informacja.\nNa czerwono = to samo przekroczenie, widoczne z daleka.',
  // The three stage axes key by column GROUP, not by column id — every stage's column shares its
  // axis's tip, because the only thing that differs between them is the stage's name.
  [STAGES_COLUMN_GROUP]:
    'Etap — ilość wykonana w tym etapie (wpisywana w wierszu).\nWartość etapu = ilość × Cena − udział etapu w rabacie (proporcjonalny do ilości). Suma ukończonych etapów pomniejsza kolumnę Pozostało.',
  [STAGE_VALUE_NET_COLUMN_GROUP]:
    'Etap — kwota netto = ilość wykonana w tym etapie × Cena j.m. − udział etapu w rabacie.\nUdział jest proporcjonalny do ilości (rabat zł jest rabatem od całego wiersza, więc etap niesie tylko swoją część). Kwoty wszystkich etapów sumują się do Netto pozycji.\nZależy od aktywnego widoku cen.',
  [STAGE_VALUE_GROSS_COLUMN_GROUP]: 'Etap — kwota brutto = Etap — kwota netto × (1 + VAT).',
  [STAGE_VALUE_PERCENT_COLUMN_GROUP]:
    'Etap — % wykonania = ilość wykonana w tym etapie ÷ Przedmiar.\nIle z oferty dowiózł ten etap. Ta sama liczba przy każdym widoku cen i po obu stronach netto/brutto — to stosunek ilości. Kolumny procentowe etapów sumują się do kolumny „% wykonania".\n„—" = brak Przedmiaru.',
}

function withTip(node: ReactNode, tip: string): ReactNode {
  return (
    <SimpleTooltip content={tip}>
      <span className="flex size-full items-center">{node}</span>
    </SimpleTooltip>
  )
}

// Column title as a sort-menu header (when onSetSort is provided), wrapped in an explanatory
// tooltip when the field has one in HEADER_TIPS.
function title(field: string, label: string, opts: BuildV2ColumnsOptsT): ReactNode {
  const active = opts.sort?.field === field ? opts.sort.dir : null
  const tip = HEADER_TIPS[field]
  // The tip goes ONTO the sort trigger (same element), not around it — a second wrapping trigger
  // would fight the dropdown for the click. Plain-label columns have no trigger, so wrap directly.
  if (opts.onSetSort) {
    return (
      <SortHeader
        label={label}
        active={active}
        tip={tip}
        onSort={(dir) => opts.onSetSort?.(field, dir)}
      />
    )
  }
  const node = <span>{label}</span>
  return tip ? withTip(node, tip) : node
}

// `null` = the figure has no answer for this row (no denominator), rendered as a dash by every
// formatter here rather than as a 0 that would read as a real measurement.
const fmtOrDash = (value: number | null) => (value == null ? '—' : fmt(value))

type ComputedCellDataT = {
  compute: (r: KosztorysV2RowT) => number | null
  className: string | ((r: KosztorysV2RowT) => string)
  format: (value: number | null) => string
}

// Module-level so every computed column shares ONE component identity. An inline `component:
// ({rowData}) => …` is a fresh function type on each assembleV2Columns call (every render), which
// makes react-datasheet-grid remount each computed cell's DOM instead of reconciling it — the
// per-cell compute/format travels via `columnData` instead. Not a remount `key` (see EX-422,
// lessons.md:119-135): identity is stabilised, the grid stays reactive.
function ComputedCell({ rowData, columnData }: CellProps<KosztorysV2RowT, ComputedCellDataT>) {
  const { compute, className, format } = columnData
  return (
    <span
      className={`block w-full px-2 text-left ${typeof className === 'function' ? className(rowData) : className}`}
    >
      {format(compute(rowData))}
    </span>
  )
}

function computedColumn(
  id: string,
  titleNode: ReactNode,
  compute: (r: KosztorysV2RowT) => number | null,
  className: string | ((r: KosztorysV2RowT) => string) = 'text-muted-foreground',
  format: (value: number | null) => string = fmtOrDash,
): Column<KosztorysV2RowT> {
  return {
    id,
    title: titleNode,
    disabled: true,
    columnData: { compute, className, format },
    component: ComputedCell,
  }
}

// Header of a per-stage value column: a read-only mirror of the stage's name. One source for the
// name, so a rename moves all three of the stage's headers and a delete takes all three columns.
// Deliberately not `title(...)` — sort is wired only for price/net/remaining (see sortValue in
// use-kosztorys-editor), so a sort trigger here would render an arrow that does nothing. Deliberately
// not `StageHeader` — a mirror carries no rename/delete affordance of its own.
function stageValueHeader(stage: KosztorysStageT, suffix: string, tip: string): ReactNode {
  // truncate, not wrap: the label is the user's free text and the suffix trails it, so an
  // unbounded header would push the row's height around as stages get renamed.
  return withTip(
    <span className="truncate text-sm">{`${stage.label || `Etap ${stage.ordinal}`} — ${suffix}`}</span>,
    tip,
  )
}

// Discount-type select cell (—/%/zł). setRowData feeds the diff → autosave.
// The type/value transitions live in discount-edit.ts — see there for why they're paired.
function DiscountTypeCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <CellSelectMenu
      value={rowData.discountType ?? ''}
      options={DISCOUNT_OPTIONS}
      hideChevron
      onChange={(next) =>
        setRowData({
          ...rowData,
          ...discountFromType(rowData, (next || null) as DiscountTypeT | null),
        })
      }
    />
  )
}

// Discount-value cell: a hand-rolled input rather than floatColumn, because an edit here has to
// reach discountType too (discount-edit.ts), which a keyColumn can't do.
function DiscountValueCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <input
      className="size-full bg-transparent px-2 text-left text-sm outline-none"
      value={String(rowData.discountValue ?? '')}
      inputMode="decimal"
      onChange={(e) => {
        const next = discountFromValue(rowData, e.target.value)
        if (next) setRowData({ ...rowData, ...next })
      }}
    />
  )
}

function discountValueColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountValue',
    title: titleNode,
    minWidth: 80,
    keepFocus: true,
    component: DiscountValueCell,
    copyValue: ({ rowData }) => String(rowData.discountValue ?? ''),
    deleteValue: ({ rowData }) => ({ ...rowData, discountType: null, discountValue: 0 }),
  }
}

// Unit (j.m.) creatable combobox cell: pick a canonical unit or type a custom one.
// setRowData feeds the diff → autosave.
function UnitCell({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) {
  return (
    <Combobox
      value={rowData.unit ?? ''}
      onChange={(next) => setRowData({ ...rowData, unit: next || null })}
      options={UNIT_SUGGESTIONS}
      allowCustom
      hideChevron
      className="hover:bg-accent size-full cursor-pointer px-2"
    />
  )
}

function unitColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'unit',
    title: titleNode,
    minWidth: 64,
    component: UnitCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.unit ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, unit: null }),
    pasteValue: ({ rowData, value }) => ({ ...rowData, unit: value.trim() || null }),
  }
}

// Section-name cell: renames the WHOLE section, so it commits through opts.onRenameSection (the same
// fan-out the section panel uses) — never setRowData, which would rewrite only this row's copy of the
// denormalized name. Local draft while editing; the row's canonical value shows otherwise, so an
// external rename (from the panel) is reflected without a mount-time snapshot going stale. Enter/blur
// commit, Escape reverts. A stray grid Delete is a no-op (deleteValue returns the row) so it can't
// blank the section.
function SectionNameCell({
  rowData,
  opts,
}: {
  rowData: KosztorysV2RowT
  opts: BuildV2ColumnsOptsT
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  // Escape sets this before blur so the shared onBlur commit knows to skip the rename.
  const cancelRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <input
      ref={inputRef}
      className="size-full bg-transparent px-2 text-left text-sm outline-none"
      value={editing ? draft : (rowData.sectionName ?? '')}
      onFocus={() => {
        cancelRef.current = false
        setDraft(rowData.sectionName ?? '')
        setEditing(true)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (editing && !cancelRef.current) opts.onRenameSection?.(rowData.sectionId, draft)
        setEditing(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          inputRef.current?.blur()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          cancelRef.current = true
          inputRef.current?.blur()
        }
      }}
    />
  )
}

function discountTypeColumn(titleNode: ReactNode): Column<KosztorysV2RowT> {
  return {
    id: 'discountType',
    title: titleNode,
    minWidth: 110,
    component: DiscountTypeCell,
    keepFocus: true,
    copyValue: ({ rowData }) => rowData.discountType ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, discountType: null }),
    pasteValue: ({ rowData, value }) => ({
      ...rowData,
      discountType: (value === 'percent' || value === 'amount'
        ? value
        : null) as DiscountTypeT | null,
    }),
  }
}

// The "Cena" column in the subcontractor view: shows either the derived price (greyed out when
// the override is null) or the entered override value. Entering a value while in the null state
// creates an 'amount' (flat) override; clearing it reverts to the derived price (null). The
// coeff vs amount mode is set by a separate "Tryb" column.
// Mnożnik and Cena j.m. both write the SAME pair of fields (overrideType + overrideValue) — the
// column you type into is what picks the type. That's why each is editable only in the modes where
// it carries the input: a mnożnik is meaningless under 'amount' (flat price), and a hand-typed price
// is meaningless under 'coeff'/auto (it's derived). The read-only side still renders its value so
// the row is legible in every mode.
function subcontractorCoeffColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceCoeff',
    title: titleNode,
    minWidth: 90,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => {
      const type = rowData[typeField] as SubcontractorOverrideTypeT | null
      if (type === 'amount') {
        return <span className="text-muted-foreground block w-full px-2 text-left">—</span>
      }
      // auto: the row carries no multiplier of its own — show the inherited one as a placeholder
      // (section coeff, else the investment default), italic to read as "not set here".
      const inherited = type == null
      return (
        <input
          className={`size-full bg-transparent px-2 text-left text-sm outline-none ${inherited ? 'text-muted-foreground italic' : ''}`}
          value={inherited ? '' : String(rowData[valueField] ?? '')}
          placeholder={
            inherited ? String(effectiveCoeff(rowData as unknown as ViewPricingT, view)) : ''
          }
          inputMode="decimal"
          onChange={(e) => {
            const parsed = parseDecimalInput(e.target.value)
            if (parsed.kind === 'empty') {
              setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
              return
            }
            if (parsed.kind === 'invalid') return
            setRowData({ ...rowData, [typeField]: 'coeff', [valueField]: parsed.value })
          }}
        />
      )
    },
    copyValue: ({ rowData }) =>
      (rowData[typeField] as string | null) === 'amount'
        ? ''
        : String(effectiveCoeff(rowData as unknown as ViewPricingT, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

function subcontractorPriceColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'price',
    title: titleNode,
    minWidth: 90,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => {
      const type = rowData[typeField] as SubcontractorOverrideTypeT | null
      const price = viewPrice(rowData as unknown as ViewPricingT, view)
      if (type !== 'amount') {
        return (
          <span className="text-muted-foreground block w-full px-2 text-left">{fmt(price)}</span>
        )
      }
      return (
        <input
          className="size-full bg-transparent px-2 text-left text-sm outline-none"
          value={String(rowData[valueField] ?? '')}
          inputMode="decimal"
          onChange={(e) => {
            const parsed = parseDecimalInput(e.target.value)
            if (parsed.kind === 'empty') {
              setRowData({ ...rowData, [typeField]: null, [valueField]: 0 })
              return
            }
            if (parsed.kind === 'invalid') return
            setRowData({ ...rowData, [typeField]: 'amount', [valueField]: parsed.value })
          }}
        />
      )
    },
    copyValue: ({ rowData }) => String(viewPrice(rowData as unknown as ViewPricingT, view)),
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

// Switching to auto zeroes the override value. Switching auto→coeff seeds the inherited multiplier
// as the starting point — leaving it at 0 would silently collapse the row's price to zero.
function subcontractorModeColumn(
  view: 'w_tools' | 'own_tools',
  titleNode: ReactNode,
): Column<KosztorysV2RowT> {
  const { type: typeField, value: valueField } = OVERRIDE_FIELDS[view]
  return {
    id: 'priceMode',
    title: titleNode,
    // Fits the header label next to the sort icon — below this the title truncates.
    minWidth: 185,
    keepFocus: true,
    component: ({ rowData, setRowData }: CellProps<KosztorysV2RowT, unknown>) => (
      <CellSelectMenu
        value={(rowData[typeField] as string | null) ?? ''}
        options={SUB_MODE_OPTIONS}
        onChange={(value) => {
          const next = (value || null) as SubcontractorOverrideTypeT | null
          const seed =
            next === 'coeff' && !rowData[valueField]
              ? { [valueField]: effectiveCoeff(rowData as unknown as ViewPricingT, view) }
              : {}
          setRowData({
            ...rowData,
            [typeField]: next,
            ...(next === null ? { [valueField]: 0 } : seed),
          })
        }}
      />
    ),
    copyValue: ({ rowData }) => (rowData[typeField] as string | null) ?? '',
    deleteValue: ({ rowData }) => ({ ...rowData, [typeField]: null, [valueField]: 0 }),
  }
}

// Applies a pinned width (basis/grow:0) to a column and wraps its title in a resize handle.
// Without the drag callbacks (onResizeColumn) it returns the column unchanged — resize disabled.
function withResize(
  col: Column<KosztorysV2RowT>,
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT> {
  if (!opts.onGuide || !opts.onCommitColumn || !col.id) return col
  const min = col.minWidth ?? 100
  const pinned = opts.widths?.[col.id]
  // Pinning = a rigid width independent of dsg's flex algorithm: min=max=basis=W,
  // grow/shrink 0. (dsg ignored `basis` alone on overflow — it fell back to minWidth.)
  const sized: Column<KosztorysV2RowT> =
    pinned != null
      ? { ...col, basis: pinned, grow: 0, shrink: 0, minWidth: pinned, maxWidth: pinned }
      : col
  return {
    ...sized,
    title: (
      <ResizableHeader
        colId={col.id}
        minWidth={min}
        onGuide={opts.onGuide}
        onCommit={opts.onCommitColumn}
      >
        {col.title}
      </ResizableHeader>
    ),
  }
}

// Insert/move disabled under an active sort (no display_order mapping); delete disabled with a
// reason (last item in a section, or a populated row) surfaced via tooltip.
function RowActionsCell({
  rowData,
  opts,
}: {
  rowData: KosztorysV2RowT
  opts: BuildV2ColumnsOptsT
}) {
  const sortActive = opts.sort != null
  const removeBlockReason = opts.getRemoveBlockReason?.(rowData)

  return (
    <KosztorysRowActionsMenu
      sortActive={sortActive}
      removeBlockReason={removeBlockReason}
      onInsertAbove={() => opts.onInsertItem?.(rowData, 'above')}
      onInsertBelow={() => opts.onInsertItem?.(rowData, 'below')}
      onMoveUp={() => opts.onReorderItem?.(rowData, 'up')}
      onMoveDown={() => opts.onReorderItem?.(rowData, 'down')}
      onRemove={() => opts.onRemoveItem?.(rowData)}
    />
  )
}

function actionColumn(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT> {
  return {
    id: 'actions',
    title: <span className="px-1 font-medium">Akcje</span>,
    basis: 64,
    grow: 0,
    shrink: 0,
    minWidth: 64,
    maxWidth: 64,
    disabled: true,
    component: ({ rowData }) => <RowActionsCell rowData={rowData} opts={opts} />,
  }
}

// Every data column in sheet order, before any hiding. Split out from buildV2Columns so the picker
// can enumerate what EXISTS while the grid renders what's visible — one list, no second registry of
// "which columns are there in this view" to drift.
function assembleV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  const { stages, view } = opts
  // Client view: a simple editable price. Subcontractor views: a "Źródło ceny" column (override)
  // + "Cena" showing the derived/override price.
  const priceCols: Column<KosztorysV2RowT>[] =
    view === 'client'
      ? [
          keyCol('clientPrice', floatColumnLeft, {
            id: 'price',
            title: title('price', COLUMN_LABELS.price, opts),
            minWidth: 90,
          }),
        ]
      : [
          subcontractorModeColumn(view, title('priceMode', COLUMN_LABELS.priceMode, opts)),
          subcontractorCoeffColumn(view, title('priceCoeff', COLUMN_LABELS.priceCoeff, opts)),
          subcontractorPriceColumn(view, title('price', COLUMN_LABELS.price, opts)),
        ]
  const identity: Column<KosztorysV2RowT>[] = [
    {
      id: 'sectionName',
      title: title('sectionName', COLUMN_LABELS.sectionName, opts),
      minWidth: 140,
      keepFocus: true,
      component: ({ rowData }: CellProps<KosztorysV2RowT, unknown>) => (
        <SectionNameCell rowData={rowData} opts={opts} />
      ),
      copyValue: ({ rowData }) => rowData.sectionName ?? '',
      // Delete on a selected Sekcja cell is a no-op — an accidental keypress must not blank a whole
      // section. Only an explicit in-cell clear-and-commit renames it.
      deleteValue: ({ rowData }) => rowData,
    },
    keyCol('description', textColumn, {
      id: 'description',
      title: title('description', COLUMN_LABELS.description, opts),
      minWidth: 240,
      grow: 2,
    }),
  ]

  const measure: Column<KosztorysV2RowT>[] = [
    keyCol('plannedQty', floatColumnLeft, {
      id: 'plannedQty',
      title: title('plannedQty', COLUMN_LABELS.plannedQty, opts),
      minWidth: 90,
    }),
    {
      ...computedColumn('stageQtySum', title('stageQtySum', COLUMN_LABELS.stageQtySum, opts), (r) =>
        rowTotalQtyDone(r, stages),
      ),
      minWidth: 90,
    },
    unitColumn(title('unit', COLUMN_LABELS.unit, opts)),
  ]

  const pricing: Column<KosztorysV2RowT>[] = [
    ...priceCols,
    computedColumn('priceGross', title('priceGross', COLUMN_LABELS.priceGross, opts), (r) =>
      toGross(viewPrice(r as unknown as ViewPricingT, view), r.vatRate),
    ),
    discountValueColumn(title('discountValue', COLUMN_LABELS.discountValue, opts)),
    discountTypeColumn(title('discountType', COLUMN_LABELS.discountType, opts)),
    computedColumn(
      'discountAmount',
      title('discountAmount', COLUMN_LABELS.discountAmount, opts),
      (r) => rowDiscountForView(r as unknown as ViewPricingT, rowTotalQtyDone(r, stages), view),
    ),
    computedColumn(
      'discountAmountGross',
      title('discountAmountGross', COLUMN_LABELS.discountAmountGross, opts),
      (r) =>
        toGross(
          rowDiscountForView(r as unknown as ViewPricingT, rowTotalQtyDone(r, stages), view),
          r.vatRate,
        ),
    ),
  ]

  const stageCols: Column<KosztorysV2RowT>[] = stages.map((st) =>
    keyCol(stageKey(st.id), floatColumnLeft, {
      id: stageKey(st.id),
      title: (
        <StageHeader
          stage={st}
          onRename={opts.onRenameStage}
          onRemove={opts.onRemoveStage}
          tip={HEADER_TIPS[STAGES_COLUMN_GROUP]}
        />
      ),
      minWidth: 80,
    }),
  )

  // The sheet's V–AE: the value of each stage's recorded qty at the view's price, post-discount.
  // Computed at render, never a row field — hence the separate id namespace (constants.ts).
  const stageValueNetCols: Column<KosztorysV2RowT>[] = stages.map((st) => {
    const qtyKey = stageKey(st.id)
    return computedColumn(
      stageValueNetKey(st.id),
      stageValueHeader(st, 'netto', HEADER_TIPS[STAGE_VALUE_NET_COLUMN_GROUP]),
      (r) => stageValueForView(r, r[qtyKey] ?? 0, rowTotalQtyDone(r, stages), view),
    )
  })

  const stageValueGrossCols: Column<KosztorysV2RowT>[] = stages.map((st) => {
    const qtyKey = stageKey(st.id)
    return computedColumn(
      stageValueGrossKey(st.id),
      stageValueHeader(st, 'brutto', HEADER_TIPS[STAGE_VALUE_GROSS_COLUMN_GROUP]),
      (r) =>
        toGross(stageValueForView(r, r[qtyKey] ?? 0, rowTotalQtyDone(r, stages), view), r.vatRate),
    )
  })

  // The percent reading of the same stage block: one column per stage instead of the netto/brutto
  // pair, since a percentage is the same figure on either side of the VAT.
  const stageValuePercentCols: Column<KosztorysV2RowT>[] = stages.map((st) => {
    const qtyKey = stageKey(st.id)
    return computedColumn(
      stageValuePercentKey(st.id),
      stageValueHeader(st, '%', HEADER_TIPS[STAGE_VALUE_PERCENT_COLUMN_GROUP]),
      (r) => stageDoneFraction(r as unknown as ViewPricingT, r[qtyKey] ?? 0),
      'text-muted-foreground',
      formatPercent,
    )
  })

  // The row's headline figure — available in both display modes, hence untagged: it answers "how far
  // along is this position", which the money columns never say outright.
  const donePercent: Column<KosztorysV2RowT>[] = [
    computedColumn(
      'donePercent',
      title('donePercent', COLUMN_LABELS.donePercent, opts),
      (r) => rowDoneFraction(r as unknown as ViewPricingT, rowTotalQtyDone(r, stages)),
      // Red = more was executed than was offered. The percentage says so too (>100%), but only this
      // cell says it at a glance across a thousand rows.
      (r) =>
        hasStagesOverPlanned(r, stages)
          ? 'text-destructive font-medium'
          : 'text-muted-foreground font-medium',
      formatPercent,
    ),
  ]

  const computed: Column<KosztorysV2RowT>[] = [
    computedColumn('plannedNet', title('plannedNet', COLUMN_LABELS.plannedNet, opts), (r) =>
      rowPlannedNetForView(r as unknown as ViewPricingT, view),
    ),
    computedColumn('plannedGross', title('plannedGross', COLUMN_LABELS.plannedGross, opts), (r) =>
      toGross(rowPlannedNetForView(r as unknown as ViewPricingT, view), r.vatRate),
    ),
    computedColumn(
      'net',
      title('net', COLUMN_LABELS.net, opts),
      (r) => rowValueForView(r, stages, view),
      'text-muted-foreground font-medium',
    ),
    computedColumn('gross', title('gross', COLUMN_LABELS.gross, opts), (r) =>
      toGross(rowValueForView(r, stages, view), r.vatRate),
    ),
  ]

  const remaining: Column<KosztorysV2RowT>[] = [
    computedColumn('remaining', title('remaining', COLUMN_LABELS.remaining, opts), (r) =>
      rowRemainingForView(r, stages, view),
    ),
    computedColumn(
      'remainingGross',
      title('remainingGross', COLUMN_LABELS.remainingGross, opts),
      // The dash must survive the VAT step: toGross(null) would read 0 — "settled" — on a row that
      // has no przedmiar to settle against.
      (r) => {
        const net = rowRemainingForView(r, stages, view)
        return net === null ? null : toGross(net, r.vatRate)
      },
    ),
  ]

  // Both blocks keep sheet order: the stage qty columns lead (the sheet's D–M), then Przedmiar (N)
  // and Pomiar z natury (O), then the value block (V–AE right before AF "pozostało").
  return [
    ...identity,
    ...stageCols,
    ...measure,
    ...pricing,
    ...computed,
    ...stageValueNetCols,
    ...stageValueGrossCols,
    ...stageValuePercentCols,
    ...donePercent,
    ...remaining,
  ]
}

// A stage column answers to its axis's shared "Etapy — …" picker entry, not to its own id. The three
// prefixes are mutually exclusive (none is a prefix of another), so the order of these tests carries
// no meaning — the qty prefix last is not load-bearing.
function toggleKey(columnId: string): string {
  if (columnId.startsWith(`${STAGE_VALUE_NET_COLUMN_GROUP}_`)) return STAGE_VALUE_NET_COLUMN_GROUP
  if (columnId.startsWith(`${STAGE_VALUE_GROSS_COLUMN_GROUP}_`)) {
    return STAGE_VALUE_GROSS_COLUMN_GROUP
  }
  if (columnId.startsWith(`${STAGE_VALUE_PERCENT_COLUMN_GROUP}_`)) {
    return STAGE_VALUE_PERCENT_COLUMN_GROUP
  }
  return columnId.startsWith(STAGE_QTY_PREFIX) ? STAGES_COLUMN_GROUP : columnId
}

// Hide/axis/resize selection over an already-assembled column list. Split from the assembly so the
// grid and the picker can share ONE assembleV2Columns pass (buildV2Grid) instead of two.
function selectV2Columns(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): Column<KosztorysV2RowT>[] {
  const axis = opts.moneyAxis ?? MONEY_AXIS_DEFAULT
  const display = opts.progressDisplay ?? PROGRESS_DISPLAY_DEFAULT
  const layer = opts.layer ?? LAYER_DEFAULT
  const base = assembled
    .filter((c) => {
      const key = toggleKey(c.id ?? '')
      if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(key)) return false
      return (
        !opts.isHidden?.(key) &&
        axisAllows(key, axis) &&
        progressDisplayAllows(key, display) &&
        layerAllows(key, layer)
      )
    })
    .map((c) => withResize(c, opts))
  return opts.onRemoveItem || opts.onReorderItem ? [actionColumn(opts), ...base] : base
}

// Picker entries for the columns this view actually has, in grid order. Stage columns collapse into
// their axis's "Etapy — …" entry — hence the dedupe.
function selectV2ToggleItems(
  assembled: Column<KosztorysV2RowT>[],
  opts: BuildV2ColumnsOptsT,
): ColumnToggleItemT[] {
  const items: ColumnToggleItemT[] = []
  for (const col of assembled) {
    const id = toggleKey(col.id ?? '')
    if (NON_HIDEABLE_COLUMNS.has(id) || items.some((i) => i.id === id)) continue
    if (opts.globalDiscountActive && DISCOUNT_COLUMN_IDS.has(id)) continue
    items.push({ id, label: COLUMN_LABELS[id] ?? id, visible: !opts.isHidden?.(id) })
  }
  return items
}

export function buildV2Columns(opts: BuildV2ColumnsOptsT): Column<KosztorysV2RowT>[] {
  return selectV2Columns(assembleV2Columns(opts), opts)
}

export function buildV2ToggleItems(opts: BuildV2ColumnsOptsT): ColumnToggleItemT[] {
  return selectV2ToggleItems(assembleV2Columns(opts), opts)
}

// The grid + its picker in one assembly pass — assembleV2Columns is the O(columns·stages) build, and
// running it twice per render (once per export) was pure waste. Callers that need only one still use
// the single-purpose exports above.
export function buildV2Grid(opts: BuildV2ColumnsOptsT): {
  columns: Column<KosztorysV2RowT>[]
  columnToggleItems: ColumnToggleItemT[]
} {
  const assembled = assembleV2Columns(opts)
  return {
    columns: selectV2Columns(assembled, opts),
    columnToggleItems: selectV2ToggleItems(assembled, opts),
  }
}
