'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { catalogueSaveState } from '@/lib/queries/work-catalogue'
import type { CatalogueSavePreviewT } from '@/lib/kosztorys/work-catalogue/types'
import type { ActionResultT } from '@/types/action'

// Fetch-on-open for the „Zapisz do katalogu…" dialogs: what would be written, and what is already
// there under that klucz.
export async function catalogueSavePreview(
  itemId: number,
): Promise<ActionResultT<CatalogueSavePreviewT>> {
  return protectedAction('catalogueSavePreview', async ({ payload }) => {
    const state = await catalogueSaveState(payload, itemId)
    if ('error' in state) return { success: false, error: state.error }

    return { success: true, data: state }
  })
}
