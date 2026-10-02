import 'server-only'
import type { Payload } from 'payload'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { uploadFieldIds } from '@/lib/media/upload-field'
import type { DeleteForeverResultT } from '@/types/trash'
import { logError } from '@/lib/utils/log-error'

const LEAD_NOT_TRASHED_MESSAGE = 'Najpierw przenieś zgłoszenie do kosza.'

/**
 * „Usuń na zawsze" for a lead empties the row instead of deleting it. The leads-reconcile cron
 * re-fetches Meta's recent leads and dedupes on (source, externalId); a deleted row would come back
 * the next night as a fresh lead and mail sales again. So the tombstone keeps exactly those two
 * columns and loses everything that identifies a person.
 *
 * The files go only where nothing else holds them: a lead promoted to an inwestycja shares its media
 * rows with it, and the reference scan is what keeps the inwestycja's gallery intact. Awaited, not
 * deferred — the purge cron calls this outside a request, and the caller's next read must already
 * see the reclaim.
 */
export async function eraseTrashedLead(
  payload: Payload,
  leadId: number,
): Promise<DeleteForeverResultT> {
  try {
    const lead = await payload.findByID({
      collection: 'leads',
      id: leadId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    if (!lead) return { ok: false, reason: 'error', message: 'Zgłoszenie nie istnieje.' }
    if (lead.erasedAt) return { ok: true }
    if (!lead.trashedAt) {
      return { ok: false, reason: 'not-trashed', message: LEAD_NOT_TRASHED_MESSAGE }
    }

    const assetIds = uploadFieldIds(lead.assets)
    await payload.update({
      collection: 'leads',
      id: leadId,
      data: {
        name: null,
        email: null,
        phone: null,
        address: null,
        scope: null,
        area: null,
        rawData: null,
        formQuestions: null,
        assets: [],
        erasedAt: new Date().toISOString(),
      },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    await deleteUnreferencedMedia(payload, assetIds)
    return { ok: true }
  } catch (err) {
    logError(`[eraseTrashedLead] ${leadId}`, err)
    return { ok: false, reason: 'error', message: 'Nie udało się usunąć zgłoszenia.' }
  }
}
