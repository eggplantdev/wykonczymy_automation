'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialog } from '@/components/ui/form-dialog'
import { buildDraftPrefill } from '@/components/worker-expenses/draft-prefill'
import { OpenExpenseDraftButton } from '@/components/worker-expenses/open-expense-draft-button'
import {
  ExpenseDraftDuplicateHints,
  type DuplicateHintsStateT,
} from '@/components/worker-expenses/expense-draft-duplicate-hints'
import { ExpenseForm, type ExpenseFormPrefillT } from '@/components/forms/expense-form/expense-form'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import {
  readExpenseDraftAction,
  rejectExpenseDraftAction,
} from '@/lib/actions/worker-expense-drafts'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import { findExpenseDraftDuplicates } from '@/lib/queries/expense-draft-duplicates'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'
import type { ExpenseDraftMediaT, ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { sameItems } from '@/lib/utils/same-items'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { warsawToday } from '@/lib/utils/days'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { usePendingStore } from '@/stores/pending-store'
import type { ReferenceDataT } from '@/types/reference-data'

type AcceptingT = {
  draft: ExpenseDraftRowT
  prefill: ExpenseFormPrefillT
  duplicates: DuplicateHintsStateT
  hasPages: boolean
}

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
    // Needs only the id, so it runs alongside the page download.
    const duplicatesRequest = draft.aiRead ? requestDuplicates(draft.id) : undefined
    let files: File[] = []
    let hasPages = true
    try {
      files = await downloadPages(draft.media)
    } catch {
      // Still opened: the dialog is the only place a zgłoszenie is rejected.
      hasPages = false
      toastMessage('Nie udało się pobrać zdjęć — zgłoszenie można tylko odrzucić', 'warning')
    } finally {
      setLoadingId(undefined)
    }

    // The server reads the same pages, so a failed download skips the read too.
    const isReading = hasPages && !draft.aiRead && draft.media.length > 0
    const duplicates: DuplicateHintsStateT = isReading
      ? { status: 'reading' }
      : draft.aiRead
        ? { status: 'checking' }
        : { status: 'no-read' }
    setAccepting({ draft, prefill: prefillFor(draft, files), duplicates, hasPages })
    openDialog(formIdOf(draft.id), false)
    // A reopen mid-read stays on „reading"; the read already in flight loads the duplicates.
    if (isReading && !readsInFlight.current.has(draft.id)) await readOnOpen(draft, files)
    else if (duplicatesRequest) await loadDuplicates(draft.id, duplicatesRequest)
  }

  const requestDuplicates = (draftId: number) =>
    settleAction(() => findExpenseDraftDuplicates(draftId))

  // Awaited only once the dialog state exists — a result landing earlier would find no dialog.
  async function loadDuplicates(draftId: number, request = requestDuplicates(draftId)) {
    const result = await request
    setAccepting((prev) => {
      if (prev?.draft.id !== draftId) return prev
      if (!result.success) {
        return { ...prev, duplicates: { status: 'error', message: result.error } }
      }
      const receipts = [...prev.prefill.receiptMediaIds]
      const paragons = result.data.flatMap((paragon) => {
        const itemId = receipts.find(([, mediaIds]) => sameItems(mediaIds, paragon.mediaIds))?.[0]
        return itemId ? [{ ...paragon, itemId }] : []
      })
      return { ...prev, duplicates: { status: 'ready', paragons } }
    })
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
              ...prev,
              prefill: aiRead ? prefillFor({ ...draft, aiRead }, files) : prev.prefill,
              duplicates: aiRead ? { status: 'checking' } : { status: 'no-read' },
            }
          : prev,
      )
      // The list's copy of the draft still has no read; without the refresh a reopen pays again.
      if (aiRead) {
        router.refresh()
        await loadDuplicates(draft.id)
      }
    } finally {
      readsInFlight.current.delete(draft.id)
      usePendingStore.getState().stop(pendingKey)
    }
  }

  async function handleReject(draftId: number, duplicateOf?: DuplicateOfT) {
    const result = await settleAction(() => rejectExpenseDraftAction(draftId, duplicateOf))
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }
    toastMessage(duplicateOf ? 'Zgłoszenie odrzucone jako duplikat' : 'Zgłoszenie odrzucone')
    closeDialog()
    setAccepting(undefined)
    router.refresh()
  }

  const isPrefillReading = accepting?.duplicates.status === 'reading'

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
          className="sm:max-w-dialog-2xl"
        >
          {(onSubmitSuccess) => (
            <ExpenseForm
              // The form seeds from `prefill` once; a landed read needs a fresh mount.
              key={String(isPrefillReading)}
              referenceData={referenceData}
              onSubmitSuccess={onSubmitSuccess}
              formId={formIdOf(accepting.draft.id)}
              prefill={accepting.prefill}
              isPrefillReading={isPrefillReading}
              isSaveBlocked={!accepting.hasPages}
              onRemoveLastItem={(duplicateOf) =>
                duplicateOf
                  ? handleReject(accepting.draft.id, duplicateOf)
                  : setRejecting(accepting.draft)
              }
              renderAboveLineItems={({ lineItemIds, markDuplicate }) => (
                <ExpenseDraftDuplicateHints
                  state={accepting.duplicates}
                  lineItemIds={lineItemIds}
                  onMarkDuplicate={markDuplicate}
                />
              )}
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
