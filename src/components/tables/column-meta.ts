import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Override label for column toggle dropdown. Falls back to header string, then column id. */
    label?: string
    /** Cell text alignment. Default: left. */
    align?: 'left' | 'right' | 'center'
    /** Renders an (i) info icon next to the header label with this hover/click content. */
    tooltip?: string
    /** Tailwind min-w-* utility class applied to the header and cell. */
    minWidth?: string
    /** The column's print form. Its ABSENCE is the exclusion mechanism — a column without it never
     * reaches the printout, keeping interactive widgets off paper with no exclusion list. */
    printValue?: (row: TData) => string
  }
}
