import type { CollectionAfterDeleteHook } from 'payload'
import { uploadFieldIds } from '@/lib/media/upload-field'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'

/**
 * Deleting an expense unreachable-izes its invoice pages — nothing can open the file again and it
 * just keeps costing Blob storage. A hook rather than a server action because expense deletion has
 * no action path: it happens in the Payload admin panel, which reaches the collection directly.
 *
 * `req` is deliberately NOT passed down: enlisting a best-effort delete in the expense-delete
 * transaction means one Postgres-level failure aborts that transaction, and no `.catch` can undo
 * that — the delete this hook is meant to be harmless to would roll back with an unrelated error.
 */
export const deleteInvoiceMediaAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await deleteUnreferencedMedia(req.payload, uploadFieldIds(doc.invoice))
  return doc
}
