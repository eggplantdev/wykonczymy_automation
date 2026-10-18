'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { canViewRegister } from '@/lib/auth/roles'
import { revalidateCollections, revalidateEntities } from '@/lib/cache/revalidate'
import { investmentEntityOpts } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { fetchDetachedFiles, type DetachedFileRowT } from '@/lib/db/media-detachments'
import { fileRestoreBlockedReason, fileUploadTarget } from '@/lib/media/file-trash'
import { appendUploadIds, setUploadField } from '@/lib/media/set-upload-field'
import type { ActionResultT } from '@/types/action'

const FILE_GONE_MESSAGE = 'Tego pliku nie ma już w Koszu.'

// The tags follow the source, known only once the entry is read — the same ones its attaching action expires.
function revalidateSource(parent: DetachedFileRowT['parent']) {
  if (parent.kind === 'investment') revalidateEntities(investmentEntityOpts(parent.id).entityTags)
  else revalidateCollections([parent.kind === 'lead' ? 'leads' : 'transfers'])
}

export async function restoreDetachedFileAction(detachmentId: number): Promise<ActionResultT> {
  return protectedAction('restoreDetachedFileAction', async ({ payload, user }) => {
    const [file] = await fetchDetachedFiles(await getDb(payload), detachmentId)
    const isHidden =
      file?.parent.kind === 'transaction' && !canViewRegister(user.role, file.parent.registerType)
    if (!file || isHidden) return { success: false, error: FILE_GONE_MESSAGE }

    const blocked = fileRestoreBlockedReason(file.parent)
    if (blocked) return { success: false, error: blocked }

    await setUploadField(payload, fileUploadTarget(file.parent), appendUploadIds([file.mediaId]))
    revalidateSource(file.parent)
    return { success: true }
  })
}
