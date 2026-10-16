'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { catalogueSaveState } from '@/lib/queries/work-catalogue'
import type { CatalogueSavePreviewT } from '@/lib/kosztorys/work-catalogue/types'
import type { ActionResultT } from '@/types/action'

export async function catalogueSavePreview(
  itemId: number,
): Promise<ActionResultT<CatalogueSavePreviewT>> {
  return protectedAction('catalogueSavePreview', async ({ payload }) => {
    const state = await catalogueSaveState(payload, itemId)
    if ('error' in state) return { success: false, error: state.error }

    return { success: true, data: state }
  })
}
