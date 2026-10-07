'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialog } from '@/components/ui/form-dialog'
import { buildDraftPrefill } from '@/components/worker-expenses/draft-prefill'
import { OpenExpenseDraftButton } from '@/components/worker-expenses/open-expense-draft-button'
import { ExpenseForm, type ExpenseFormPrefillT } from '@/components/forms/expense-form/expense-form'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import {
  readExpenseDraftAction,
  rejectExpenseDraftAction,
} from '@/lib/actions/worker-expense-drafts'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'
import type { ExpenseDraftMediaT, ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { warsawToday } from '@/lib/utils/days'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { usePendingStore } from '@/stores/pending-store'
import type { ReferenceDataT } from '@/types/reference-data'

type AcceptingT = { draft: ExpenseDraftRowT; prefill: ExpenseFormPrefillT; isReading: boolean }

const DRAFT_READ_PENDING_KEY = 'expense-draft-read'

const formIdOf = (draftId: number) => `expense-draft-${draftId}`

async function downloadPages(media: ExpenseDraftMediaT[]): Promise<File[]> {
  return Promise.all(
    media.map(async (page) => {
      const response = await fetch(page.url)
      if (!response.ok) throw new Error(`${page.filename}: ${response.status}`)
      return new File([await response.blob()], page.filename, { type: page.mimeType })
    }),
  )
}

export function useExpenseDraftAcceptance(referenceData: ReferenceDataT) {
  const router = useRouter()
  const openDialog = useOptimisticFormStore((s) => s.openDialog)
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)
  const [loadingId, setLoadingId] = useState<number | undefined>()
  const [accepting, setAccepting] = useState<AcceptingT | undefined>()
  const [rejecting, setRejecting] = useState<ExpenseDraftRowT | undefined>()
  // A reopen mid-read waits for the read already paid for; its landing finds the dialog by draft id.
  const readsInFlight = useRef(new Set<number>())

  function prefillFor(draft: ExpenseDraftRowT, files: File[]): ExpenseFormPrefillT {
    const expenseCategory = resolveExpenseCategoryId(
      DEFAULT_EXPENSE_CATEGORY_NAME,
      referenceData.expenseCategories,
    )
    const {
      lineItems,
      files: rowFiles,
      receiptMediaIds,
    } = buildDraftPrefill(draft, files, expenseCategory)
    return {
      expenseDraftId: draft.id,
      receiptMediaIds,
      files: rowFiles,
      values: {
        date: warsawToday(),
        type: 'INVESTMENT_EXPENSE',
        paymentMethod: 'CASH',
        sourceRegister: String(draft.cashRegisterId),
        targetRegister: '',
        investment: String(draft.investmentId),
        worker: '',
        settled: false,
        lineItems,
      },
    }
  }

  // The pages are re-uploaded on save rather than reused by id: „Generuj" renames the files, and the
  // regular upload path is what files a page under its row.
  async function open(draft: ExpenseDraftRowT) {
    setLoadingId(draft.id)
    let files: File[]
    try {
      files = await downloadPages(draft.media)
    } catch {
      toastMessage('Nie udało się pobrać zdjęć zgłoszenia', 'error')
      return
    } finally {
      setLoadingId(undefined)
    }

    const isReading = !draft.aiRead && draft.media.length > 0
    setAccepting({ draft, prefill: prefillFor(draft, files), isReading })
    openDialog(formIdOf(draft.id), false)
    if (isReading && !readsInFlight.current.has(draft.id)) await readOnOpen(draft, files)
  }

  // Reading here keeps the spend on the click.
  async function readOnOpen(draft: ExpenseDraftRowT, files: File[]) {
    const pendingKey = `${DRAFT_READ_PENDING_KEY}-${draft.id}`
    readsInFlight.current.add(draft.id)
    usePendingStore.getState().start(pendingKey, 'Odczytywanie paragonów…')
    try {
      const result = await settleAction(() => readExpenseDraftAction(draft.id))
      const aiRead = result.success ? result.data.aiRead : undefined
      if (!result.success) toastMessage(result.error, 'warning')
      else if (!aiRead) toastMessage('Nie odczytano zdjęć zgłoszenia', 'warning')
      setAccepting((prev) =>
        prev?.draft.id === draft.id
          ? {
              draft: prev.draft,
              prefill: aiRead ? prefillFor({ ...draft, aiRead }, files) : prev.prefill,
              isReading: false,
            }
          : prev,
      )
      // The list's copy of the draft still has no read; without the refresh a reopen pays again.
      if (aiRead) router.refresh()
    } finally {
      readsInFlight.current.delete(draft.id)
      usePendingStore.getState().stop(pendingKey)
    }
  }

  async function handleReject(draftId: number) {
    const result = await settleAction(() => rejectExpenseDraftAction(draftId))
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }
    toastMessage('Zgłoszenie odrzucone')
    closeDialog()
    setAccepting(undefined)
    router.refresh()
  }

  const dialogs = (
    <>
      {accepting && (
        <FormDialog
          key={accepting.draft.id}
          formId={formIdOf(accepting.draft.id)}
          trigger={null}
          showKeepOpen={false}
          title="Nowy wydatek"
          description={accepting.draft.note ?? undefined}
          className="sm:max-w-dialog-lg"
        >
          {(onSubmitSuccess) => (
            <ExpenseForm
              // The form seeds from `prefill` once; the landed read needs a fresh mount.
              key={String(accepting.isReading)}
              referenceData={referenceData}
              onSubmitSuccess={onSubmitSuccess}
              formId={formIdOf(accepting.draft.id)}
              prefill={accepting.prefill}
              isPrefillReading={accepting.isReading}
              secondaryAction={
                <Button
                  type="button"
                  variant="destructive"
                  className="ml-auto"
                  onClick={() => setRejecting(accepting.draft)}
                >
                  Odrzuć
                </Button>
              }
            />
          )}
        </FormDialog>
      )}

      <ConfirmDialog
        open={rejecting !== undefined}
        title="Odrzucić zgłoszenie?"
        description={rejecting && `${rejecting.workerName} · ${rejecting.investmentName}`}
        confirmLabel="Odrzuć"
        onConfirm={() => rejecting && handleReject(rejecting.id)}
        onCancel={() => setRejecting(undefined)}
      />
    </>
  )

  const openButton = (draft: ExpenseDraftRowT) => (
    <OpenExpenseDraftButton
      isLoading={loadingId === draft.id}
      disabled={loadingId !== undefined}
      onClick={() => open(draft)}
    />
  )

  return { openButton, dialogs }
}
