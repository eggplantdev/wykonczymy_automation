export type FilterConfigT = {
  readonly cashRegisters?: { id: number; name: string }[]
  readonly investments?: { id: number; name: string }[]
  readonly users?: { id: number; name: string }[]
  readonly showTypeFilter?: boolean
}
