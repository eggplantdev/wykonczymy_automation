import type { CollectionAfterDeleteHook } from 'payload'
import { uploadFieldIds } from '@/lib/media/upload-field'
import { reclaimUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'

// Deferred: a scan before the expense delete commits still sees its own `_rels` row and keeps the faktura.
export const deleteInvoiceMediaAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await reclaimUnreferencedMedia(req.payload, uploadFieldIds(doc.invoice))
  return doc
}
