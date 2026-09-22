'use server'

import { protectedAction } from './run-action'
import type { ActionResultT } from '@/types/action'
import type { MediaKindT } from '@/types/media'

/**
 * Marks a file that is already stored. The upload-time marker (`useMediaUpload`) cannot reach the
 * files that matter most here: a rzut promoted from a lead arrives as the landing's UNCOMPRESSED
 * original, which is the best material an AI will ever get, and nobody ticked a box for it.
 *
 * Deliberately one file at a time — this is someone pointing at a specific plik, not a backfill of
 * history, which is rejected for good (`change.md`).
 */
export async function setMediaKindAction(
  mediaId: number,
  kind: MediaKindT,
): Promise<ActionResultT> {
  return protectedAction(
    'setMediaKindAction',
    async ({ payload }) => {
      // The gate is `protectedAction`'s MANAGEMENT_ROLES check above, not `media.access.update` —
      // which stays on `isAdminOrOwner` because opening it would also hand MANAGER the `/admin`
      // file swap, and a swap runs the storage plugin's `handleDelete` over the old bytes.
      // The gate is `protectedAction`'s MANAGEMENT_ROLES check, not `media.access.update` — which
      // stays on `isAdminOrOwner` because opening it would also hand MANAGER the `/admin` file swap,
      // and a swap runs the storage plugin's `handleDelete` over the old bytes.
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
