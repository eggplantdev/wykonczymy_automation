'use client'

import { useState } from 'react'
import { ArrowUpDown, ChevronDown, Pencil, Trash2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import { HeaderLabel } from '@/components/ui/datasheet-grid/header-label'
import { CellSelectMenu } from '@/components/ui/datasheet-grid/cell-select-menu'
import { LongTextCell } from '@/components/ui/datasheet-grid/long-text-cell'
import { ReadOnlyLongText } from '@/components/ui/datasheet-grid/read-only-long-text'
import { CellTooltip } from '@/components/ui/datasheet-grid/cell-tooltip'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import { HeaderMenu } from '@/components/ui/datasheet-grid/header-menu'
import { ResizableHeader } from '@/components/ui/datasheet-grid/column-resize-handle'
import { RowResizeHandle } from '@/components/ui/datasheet-grid/row-resize-handle'
import { ShowcaseRow } from '../showcase-row'
import { ShowcaseSection } from '../showcase-section'
import { OpenPreview } from '../open-preview'

const CELL_CLASS = 'bg-background relative flex h-10 w-40 items-center overflow-hidden border'
const HEADER_CELL_CLASS = 'bg-muted relative flex h-10 w-40 items-center border px-1'

const UNIT_OPTIONS = [
  { value: 'm2', label: 'm²' },
  { value: 'mb', label: 'mb' },
  { value: 'szt', label: 'szt.' },
]

const LONG_TEXT =
  'Gruntowanie ścian i sufitów, dwukrotne malowanie farbą lateksową wraz z zabezpieczeniem podłóg i stolarki.'

const COLUMN_MIN_WIDTH = 80
const ROW_MIN_HEIGHT = 40

type SampleCellSelectPropsT = {
  value: string
  onChange: (value: string) => void
}

function SampleCellSelect({ value, onChange }: SampleCellSelectPropsT) {
  return (
    <div className={CELL_CLASS}>
      <CellSelectMenu value={value} options={UNIT_OPTIONS} onChange={onChange} />
    </div>
  )
}

function SampleCellMenu() {
  return (
    <div className="bg-background relative flex size-10 items-center border">
      <DropdownMenu>
        <CellMenuTrigger title="Akcje wiersza" />
        <DropdownMenuContent align="start" className="min-w-40">
          <DropdownMenuItem>
            <Pencil />
            Edytuj
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive">
            <Trash2 />
            Usuń wiersz
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function SampleHeaderMenu() {
  return (
    <div className={HEADER_CELL_CLASS}>
      <HeaderMenu
        label={<HeaderLabel>Przedmiar</HeaderLabel>}
        icon={<ChevronDown className="size-3.5 opacity-50" />}
        tip="Kliknij, aby otworzyć menu kolumny"
      >
        <DropdownMenuItem>
          <ArrowUpDown />
          Sortuj
        </DropdownMenuItem>
        <DropdownMenuItem>Ukryj kolumnę</DropdownMenuItem>
      </HeaderMenu>
    </div>
  )
}

export function GridCellsSection() {
  const [inputValue, setInputValue] = useState('12,50')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [unit, setUnit] = useState('m2')
  const [hideChevronUnit, setHideChevronUnit] = useState('szt')
  const [longText, setLongText] = useState<string | null>(LONG_TEXT)
  const [isLongTextFocused, setIsLongTextFocused] = useState(false)
  const [columnWidth, setColumnWidth] = useState(160)
  const [rowHeight, setRowHeight] = useState(ROW_MIN_HEIGHT)
  const [guideX, setGuideX] = useState<number | null>(null)
  const [guideY, setGuideY] = useState<number | null>(null)

  return (
    <ShowcaseSection id="grid-cells">
      <ShowcaseRow
        title="ReadOnlyCellText"
        source="ui/datasheet-grid/read-only-cell-text.tsx"
        className="flex flex-wrap items-center gap-0"
      >
        <div className={CELL_CLASS}>
          <ReadOnlyCellText>Domyślny</ReadOnlyCellText>
        </div>
        <div className={CELL_CLASS}>
          <ReadOnlyCellText muted>muted</ReadOnlyCellText>
        </div>
        <div className={CELL_CLASS}>
          <ReadOnlyCellText danger>danger</ReadOnlyCellText>
        </div>
        <div className={CELL_CLASS}>
          <ReadOnlyCellText emphasize>emphasize</ReadOnlyCellText>
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="EditableCellInput — kliknij, Enter/Esc kończy edycję"
        source="ui/datasheet-grid/editable-cell-input.tsx"
      >
        <div className={CELL_CLASS} onClick={() => setIsInputFocused(true)}>
          <EditableCellInput
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            focus={isInputFocused}
            onEnter={() => setIsInputFocused(false)}
            onEscape={() => setIsInputFocused(false)}
            onBlur={() => setIsInputFocused(false)}
          />
        </div>
        <div className={CELL_CLASS}>
          <EditableCellInput placeholder="focus={undefined}" />
        </div>
      </ShowcaseRow>
      <ShowcaseRow title="HeaderLabel" source="ui/datasheet-grid/header-label.tsx">
        <div className={HEADER_CELL_CLASS}>
          <HeaderLabel>Cena j.m.</HeaderLabel>
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="Menu w komórkach"
        source="ui/datasheet-grid/cell-select-menu.tsx, cell-menu-trigger.tsx, header-menu.tsx, header-menu-trigger.tsx"
      >
        <SampleCellSelect value={unit} onChange={setUnit} />
        <div className={CELL_CLASS}>
          <CellSelectMenu
            value={hideChevronUnit}
            options={UNIT_OPTIONS}
            onChange={setHideChevronUnit}
            hideChevron
          />
        </div>
        <SampleCellMenu />
        <SampleHeaderMenu />
        <OpenPreview backdrop={false} className="h-48 justify-start gap-x-16">
          <SampleCellSelect value={unit} onChange={setUnit} />
          <SampleCellMenu />
          <SampleHeaderMenu />
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow
        title="Długi tekst — LongTextCell (kliknij), ReadOnlyLongText (ucięty → popover)"
        source="ui/datasheet-grid/long-text-cell.tsx, read-only-long-text.tsx"
      >
        <div
          className="bg-background relative flex h-10 w-48 items-center border"
          onClick={() => setIsLongTextFocused(true)}
        >
          <LongTextCell
            value={longText}
            focus={isLongTextFocused}
            onCommit={setLongText}
            stopEditing={() => setIsLongTextFocused(false)}
          />
        </div>
        <div className="bg-background flex h-10 w-48 overflow-hidden border">
          <ReadOnlyLongText value={LONG_TEXT} />
        </div>
        <OpenPreview backdrop={false} className="justify-start">
          <div className="bg-background flex h-10 w-48 overflow-hidden border">
            <ReadOnlyLongText value={LONG_TEXT} />
          </div>
        </OpenPreview>
      </ShowcaseRow>
      <ShowcaseRow
        title="CellTooltip"
        source="ui/datasheet-grid/cell-tooltip.tsx"
        className="flex flex-wrap items-center gap-2 pt-10"
      >
        <div className={CELL_CLASS}>
          <CellTooltip message="Wartość poza zakresem" forceOpen>
            <ReadOnlyCellText danger>forceOpen</ReadOnlyCellText>
          </CellTooltip>
        </div>
        <div className={CELL_CLASS}>
          <CellTooltip message="Najechanie pokazuje komunikat" forceOpen={false}>
            <ReadOnlyCellText>na najechanie</ReadOnlyCellText>
          </CellTooltip>
        </div>
      </ShowcaseRow>
      <ShowcaseRow
        title="Zmiana rozmiaru — przeciągnij krawędź"
        source="ui/datasheet-grid/column-resize-handle.tsx, row-resize-handle.tsx"
        className="flex flex-wrap items-start gap-6"
      >
        <div
          className="dsg-cell-header bg-muted relative flex h-10 items-center border px-1"
          style={{ width: columnWidth }}
        >
          <ResizableHeader
            colId="price"
            minWidth={COLUMN_MIN_WIDTH}
            onGuide={setGuideX}
            onCommit={(_, width) => setColumnWidth(width)}
          >
            <HeaderLabel>{columnWidth}px</HeaderLabel>
          </ResizableHeader>
        </div>
        <div
          className="dsg-row bg-background relative flex w-48 items-center border"
          style={{ height: rowHeight }}
        >
          <ReadOnlyCellText>{rowHeight}px</ReadOnlyCellText>
          <RowResizeHandle
            rowId="row"
            minHeight={ROW_MIN_HEIGHT}
            onGuide={setGuideY}
            onCommit={(_, height) => setRowHeight(height)}
            title="Przeciągnij, aby zmienić wysokość wiersza"
          />
        </div>
        {guideX !== null && (
          <span
            className="bg-primary pointer-events-none fixed inset-y-0 w-px"
            style={{ left: guideX }}
          />
        )}
        {guideY !== null && (
          <span
            className="bg-primary pointer-events-none fixed inset-x-0 h-px"
            style={{ top: guideY }}
          />
        )}
      </ShowcaseRow>
    </ShowcaseSection>
  )
}
