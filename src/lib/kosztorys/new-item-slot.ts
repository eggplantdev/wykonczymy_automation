import 'server-only'
import { ITEM_NOT_FOUND, SECTION_NOT_FOUND } from '@/lib/constants/not-found'
import type { DbExecutorT } from '@/lib/db/get-db'
import { resolveInsertSlot, shiftDisplayOrderFrom } from '@/lib/kosztorys/display-order'
import type { NewItemPlacementT } from '@/lib/kosztorys/types'

export async function resolveNewItemSlot(
  db: DbExecutorT,
  scope: 'kosztorys-items' | 'template-items',
  placement: NewItemPlacementT,
  nextItemOrder: (
    db: DbExecutorT,
    sectionId: number,
  ) => Promise<{ nextDisplayOrder: number } | undefined>,
): Promise<{ sectionId: number; displayOrder: number } | { error: string }> {
  if (placement.kind === 'end') {
    const owner = await nextItemOrder(db, placement.sectionId)
    if (!owner) return { error: SECTION_NOT_FOUND }
    return { sectionId: placement.sectionId, displayOrder: owner.nextDisplayOrder }
  }
  const slot = await resolveInsertSlot(db, scope, placement.anchorItemId, placement.dir)
  if (!slot) return { error: ITEM_NOT_FOUND }
  await shiftDisplayOrderFrom(db, scope, slot.ownerId, slot.at)
  return { sectionId: slot.ownerId, displayOrder: slot.at }
}
