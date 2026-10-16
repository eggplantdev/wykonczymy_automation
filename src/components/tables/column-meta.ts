import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    label?: string
    align?: 'left' | 'right' | 'center'
    tooltip?: string
    description?: string
    /** Header reads bottom-to-top, so a long label stops setting a narrow column's width. */
    vertical?: boolean
    minWidth?: string
    fill?: boolean
    /** Its ABSENCE is the exclusion mechanism — a column without it never reaches the printout. */
    printValue?: (row: TData) => string
  }
}
