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
