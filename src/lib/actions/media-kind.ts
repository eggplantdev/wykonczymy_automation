'use server'

import { protectedAction } from './run-action'
import type { ActionResultT } from '@/types/action'
import type { MediaKindT } from '@/types/media'

export async function setMediaKindAction(
  mediaId: number,
  kind: MediaKindT,
): Promise<ActionResultT> {
  return protectedAction(
    'setMediaKindAction',
    async ({ payload }) => {
      // The gate is `protectedAction`'s MANAGEMENT_ROLES check above, not `media.access.update`.
      await payload.update({
        collection: 'media',
        id: mediaId,
        data: { kind },
        overrideAccess: true,
      })
      return { success: true }
    },
    ['media', 'investments', 'leads'],
  )
}
