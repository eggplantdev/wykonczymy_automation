import type { CellProps } from 'react-datasheet-grid'

// dsg's own handover callback, borrowed from its `CellProps` rather than re-typed: four files had
// hand-written copies that a library bump would have silently desynced.
export type StopEditingT = CellProps<unknown, unknown>['stopEditing']
