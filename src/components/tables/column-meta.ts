import '@tanstack/react-table'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Override label for column toggle dropdown. Falls back to header string, then column id. */
    label?: string
    /** If false, column cannot be hidden by the user. Default: true. */
    canHide?: boolean
    /** Cell text alignment. Default: left. */
    align?: 'left' | 'right' | 'center'
  }
}
