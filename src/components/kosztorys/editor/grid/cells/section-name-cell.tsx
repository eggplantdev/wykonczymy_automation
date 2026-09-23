import { useEffect, type MouseEvent, type ReactNode } from 'react'
import type { CellProps, Column } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import type { StopEditingT } from '@/components/ui/datasheet-grid/types'
import { useInlineRename } from '@/components/kosztorys/editor/hooks/use-inline-rename'
import { wrapColumnClass } from '@/lib/kosztorys/row-content-lines'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Renames the WHOLE section, so it commits through onRename (the same fan-out the section panel uses)
// — never setRowData, which would rewrite only this row's copy of the denormalized name. A stray grid
// Delete is a no-op (deleteValue returns the row) so it can't blank the section.
export function SectionNameCell({
  rowData,
  onRename,
  disabled,
  className,
  onClick,
  focus,
  stopEditing,
}: {
  rowData: KosztorysV2RowT
  onRename?: (sectionId: number, name: string) => void
  disabled?: boolean
  className?: string
  onClick?: (event: MouseEvent<HTMLInputElement>) => void
  // Both absent in the section band, which is chrome rather than a cell: it keeps its input
  // permanently live and has no grid to hand back to.
  focus?: boolean
  stopEditing?: StopEditingT
}) {
  const { editing, start, close, inputProps } = useInlineRename(
    (name) => onRename?.(rowData.sectionId, name),
    stopEditing,
  )

  // The grid ends an edit by dropping the cell's editing flag, which unmounts the input below while
  // this component stays put — no blur fires and the hook's own unmount guard never runs. Clicking
  // another cell is that path, so without this the name just typed is lost.
  useEffect(() => {
    if (focus === false) close()
  }, [focus, close])

  // An input renders one line whatever the row's height, so the name is text at rest and a field only
  // while it is being typed — the same swap „Opis prac" makes, and what lets a long name wrap instead
  // of being cut.
  if (disabled || focus === false)
    return <ReadOnlyCellText>{rowData.sectionName ?? ''}</ReadOnlyCellText>

  // The cell stays mounted when not editing, so it shows the row's canonical name — an external
  // rename (from the section panel) can't go stale behind a leftover draft.
  const shown = editing ? String(inputProps.value ?? '') : (rowData.sectionName ?? '')

  return (
    <EditableCellInput
      {...inputProps}
      className={className}
      focus={focus}
      value={shown}
      // Fallback for engines without `field-sizing: content` (which the band relies on to hug the
      // name): without it an input ignores its value and renders at a fixed ~20-character default.
      size={Math.max(shown.length, 1)}
      onFocus={() => start(rowData.sectionName ?? '')}
      onClick={onClick}
    />
  )
}

// `onRename` rides `columnData` so this component keeps ONE identity across renders — dsg answers a
// changed `component` type with a remount (EX-422, lessons.md), which here dropped a half-typed
// section name whenever anything else in the editor changed mid-rename.
type SectionNameCellDataT = { onRename?: (sectionId: number, name: string) => void }

function SectionNameGridCell({
  rowData,
  columnData,
  disabled,
  focus,
  stopEditing,
}: CellProps<KosztorysV2RowT, SectionNameCellDataT>) {
  return (
    <SectionNameCell
      rowData={rowData}
      onRename={columnData.onRename}
      disabled={disabled}
      focus={focus}
      stopEditing={stopEditing}
    />
  )
}

export function sectionNameColumn(
  titleNode: ReactNode,
  onRename?: (sectionId: number, name: string) => void,
): Column<KosztorysV2RowT> {
  return {
    id: 'sectionName',
    title: titleNode,
    keepFocus: true,
    cellClassName: wrapColumnClass('sectionName'),
    // The header too: it is the node the width measurement queries, and a column nothing measures
    // never grows a row.
    headerClassName: wrapColumnClass('sectionName'),
    columnData: { onRename },
    component: SectionNameGridCell,
    copyValue: ({ rowData }) => rowData.sectionName ?? '',
    // Delete on a selected Sekcja cell is a no-op — an accidental keypress must not blank a whole
    // section. Only an explicit in-cell clear-and-commit renames it.
    deleteValue: ({ rowData }) => rowData,
  }
}
