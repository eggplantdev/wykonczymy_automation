'use client'

import { useState } from 'react'
import {
  removeAllTransferInvoicesAction,
  removeTransferInvoiceAction,
} from '@/lib/actions/transfers'
import { toastMessage } from '@/lib/utils/toast'
import type { InvoiceFileT } from '@/types/transfers'

/**
 * Page removal for one expense's invoice, shared by every surface that shows the preview with a
 * „usuń" affordance (the transfers cell, the edit form). The optimistic set is what makes it a hook
 * rather than a helper: the server row doesn't refresh until the table revalidates, so removing one
 * page of three has to hide that page locally, per id.
 *
 * `removalConfirm` is spread onto a `ConfirmDialog` by each consumer, so the question is asked in the
 * app's own window.
 */
export function useInvoiceRemoval(transactionId: number, invoices: InvoiceFileT[]) {
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())
  const [staged, setStaged] = useState<{ title: string; run: () => Promise<void> } | null>(null)
  const [pending, setPending] = useState(false)

  const visibleInvoices = invoices.filter(
    (invoice) => invoice.id === undefined || !removedIds.has(invoice.id),
  )

  function handleRemove(invoice: InvoiceFileT, closePreview: () => void) {
    const invoiceId = invoice.id
    if (invoiceId === undefined) return

    // Removing the only page removes the invoice — say that, rather than „stronę" for a single photo.
    const isLastPage = visibleInvoices.length === 1

    setStaged({
      title: isLastPage
        ? 'Czy na pewno chcesz usunąć fakturę?'
        : 'Czy na pewno chcesz usunąć tę stronę?',
      run: async () => {
        const result = await removeTransferInvoiceAction(transactionId, invoiceId)
        if (!result.success) {
          toastMessage(result.error ?? 'Nie udało się usunąć faktury', 'error')
          return
        }

        setRemovedIds((previous) => new Set(previous).add(invoiceId))
        if (isLastPage) closePreview()
      },
    })
  }

  function handleRemoveAll(closePreview: () => void) {
    setStaged({
      title: 'Czy na pewno chcesz usunąć całą fakturę?',
      run: async () => {
        const result = await removeAllTransferInvoicesAction(transactionId)
        if (!result.success) {
          toastMessage(result.error ?? 'Nie udało się usunąć faktury', 'error')
          return
        }

        closePreview()
        setRemovedIds(
          new Set(invoices.map((invoice) => invoice.id).filter((id) => id !== undefined)),
        )
      },
    })
  }

  return {
    visibleInvoices,
    handleRemove,
    handleRemoveAll,
    // Spreadable onto ConfirmDialog. Empty title while closed — the dialog renders nothing then.
    removalConfirm: {
      open: staged !== null,
      title: staged?.title ?? '',
      confirmLabel: 'Usuń',
      pending,
      pendingLabel: 'Usuwanie…',
      onConfirm: () => {
        if (!staged) return
        setPending(true)
        // `run` toasts a REFUSED delete but not a rejected one, and `finally` closes the dialog
        // either way — leaving an invoice on screen the user was told nothing about.
        void staged
          .run()
          .catch(() => toastMessage('Nie udało się usunąć faktury', 'error'))
          .finally(() => {
            setPending(false)
            setStaged(null)
          })
      },
      onCancel: () => setStaged(null),
    },
  }
}
