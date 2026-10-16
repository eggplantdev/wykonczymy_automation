import type { CollectionAfterDeleteHook } from 'payload'
import { uploadFieldIds } from '@/lib/media/upload-field'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'

/**
 * `req` is deliberately NOT passed down: enlisting a best-effort delete in the expense-delete
 * transaction means one Postgres-level failure aborts that transaction, and no `.catch` can undo
 * that — the delete this hook is meant to be harmless to would roll back with an unrelated error.
 */
export const deleteInvoiceMediaAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  await deleteUnreferencedMedia(req.payload, uploadFieldIds(doc.invoice))
  return doc
}
