import { discardOrphanedUploads } from '@/lib/invoices/discard-orphaned-uploads'
import {
  InvoiceUploadError,
  resolveInvoiceMediaIds,
  resolveInvoicePageIds,
} from '@/lib/invoices/invoice-page-uploads'
import type { ActionResultT } from '@/types/action'
import type { MediaKindT } from '@/types/media'

/**
 * Pages land in Blob before the row that references them exists, so every path where the mutation
 * does not attach them must hand them back — Blob has no undelete. A throw from the mutation is
 * re-thrown rather than folded into a failure result, so the caller still sees it as a throw.
 */
async function withOrphanCleanup<TIds>(
  resolve: () => Promise<TIds>,
  flatten: (ids: TIds) => number[],
  submit: (ids: TIds) => Promise<ActionResultT>,
): Promise<ActionResultT> {
  let ids: TIds
  try {
    ids = await resolve()
  } catch (err) {
    if (err instanceof InvoiceUploadError) discardOrphanedUploads(err.uploadedIds)
    return {
      success: false,
      // Only the upload error phrases itself for this UI; anything else is transport or a
      // chunk-load failure, whose message is not something to put in front of the user.
      error:
        err instanceof InvoiceUploadError
          ? err.message
          : 'Nie udało się przesłać plików — spróbuj ponownie.',
    }
  }

  let result: ActionResultT
  try {
    result = await submit(ids)
  } catch (err) {
    discardOrphanedUploads(flatten(ids))
    throw err
  }
  if (!result.success) discardOrphanedUploads(flatten(ids))
  return result
}

export function submitWithInvoicePages(
  files: File[],
  submit: (invoicePageIds: number[]) => Promise<ActionResultT>,
  kind?: MediaKindT,
): Promise<ActionResultT> {
  if (files.length === 0) return submit([])
  return withOrphanCleanup(
    () => resolveInvoicePageIds(files, kind),
    (ids) => ids,
    submit,
  )
}

/** Pages per line-item row, positional — `rows[i]` are the pages of `lineItems[i]`. */
export function submitWithInvoicePageRows(
  rowCount: number,
  files: Map<number, File[]>,
  submit: (invoicePageRows: number[][] | undefined) => Promise<ActionResultT>,
): Promise<ActionResultT> {
  if (files.size === 0) return submit(undefined)
  return withOrphanCleanup(
    () => resolveInvoiceMediaIds(rowCount, files),
    (rows) => rows.flat(),
    submit,
  )
}
