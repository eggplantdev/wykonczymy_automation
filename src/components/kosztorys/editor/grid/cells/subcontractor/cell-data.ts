import type { ToolPlaneT } from '@/lib/kosztorys/types'

export type SubcontractorCellDataT = {
  view: ToolPlaneT
  isDocument?: boolean
}

export const cellData = (view: ToolPlaneT, isDocument = false): SubcontractorCellDataT => ({
  view,
  isDocument,
})
