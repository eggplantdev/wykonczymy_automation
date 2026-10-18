'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { revalidateCollections, revalidateEntities } from '@/lib/cache/revalidate'
import { investmentEntityOpts } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { fetchDetachedFiles, type DetachedFileRowT } from '@/lib/db/media-detachments'
import { canViewDetachedFile, fileRestoreBlockedReason } from '@/lib/media/file-trash'
import { appendUploadIds, setUploadField } from '@/lib/media/set-upload-field'
import type { ActionResultT } from '@/types/action'

const FILE_GONE_MESSAGE = 'Tego pliku nie ma już w Koszu.'

// The tags follow the source, known only once the entry is read.
function revalidateSource(parent: DetachedFileRowT['parent']) {
  if (parent.kind === 'investment') revalidateEntities(investmentEntityOpts(parent.id).entityTags)
  else revalidateCollections([parent.kind === 'lead' ? 'leads' : 'transfers'])
}

export async function restoreDetachedFileAction(detachmentId: number): Promise<ActionResultT> {
  return protectedAction('restoreDetachedFileAction', async ({ payload, user }) => {
    const [file] = await fetchDetachedFiles(await getDb(payload), detachmentId)
    if (!file || !canViewDetachedFile(user.role, file.parent)) {
      return { success: false, error: FILE_GONE_MESSAGE }
    }

    const blocked = fileRestoreBlockedReason(file.parent)
    if (blocked) return { success: false, error: blocked }

    await setUploadField(payload, file.source, appendUploadIds([file.mediaId]))
    revalidateSource(file.parent)
    return { success: true }
  })
}
