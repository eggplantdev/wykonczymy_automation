import { useEffect, type MouseEvent, type ReactNode } from 'react'
import type { CellProps, Column } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { EditableCellInput } from '@/components/ui/datasheet-grid/editable-cell-input'
import type { StopEditingT } from '@/components/ui/datasheet-grid/types'
import { useInlineRename } from '@/components/kosztorys/editor/hooks/use-inline-rename'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Renames the WHOLE section, so it commits through onRename — never setRowData, which would rewrite
// only this row's copy of the denormalized name.
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
  focus?: boolean
  stopEditing?: StopEditingT
}) {
  const { editing, start, close, inputProps } = useInlineRename(
    (name) => onRename?.(rowData.sectionId, name),
    stopEditing,
  )

  // The grid ends an edit by dropping the cell's editing flag — no blur fires, so without this the
  // name just typed is lost.
  useEffect(() => {
    if (focus === false) close()
  }, [focus, close])

  if (disabled || focus === false)
    return <ReadOnlyCellText>{rowData.sectionName ?? ''}</ReadOnlyCellText>

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
    columnData: { onRename },
    component: SectionNameGridCell,
    copyValue: ({ rowData }) => rowData.sectionName ?? '',
    // Delete on a selected Sekcja cell is a no-op — an accidental keypress must not blank a whole
    // section.
    deleteValue: ({ rowData }) => rowData,
  }
}
