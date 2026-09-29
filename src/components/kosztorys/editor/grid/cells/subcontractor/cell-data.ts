import type { ToolPlaneT } from '@/lib/kosztorys/types'

// Everything the cells need to know about which plane they are editing. Travels via
// `columnData` so each component keeps ONE identity across renders — an inline `component:
// ({rowData}) => …` is a fresh function type on every assembleV2Columns call, which makes
// react-datasheet-grid remount the cell's DOM instead of reconciling it, losing both the typed text
// and the rejection state (EX-422, lessons.md — „A `react-datasheet-grid` column's `component`
// must be a STABLE reference").
export type SubcontractorCellDataT = {
  view: ToolPlaneT
}

export const cellData = (view: ToolPlaneT): SubcontractorCellDataT => ({ view })
