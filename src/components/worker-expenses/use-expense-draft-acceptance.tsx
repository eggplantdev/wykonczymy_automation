'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialog } from '@/components/ui/form-dialog'
import { buildDraftPrefill } from '@/components/worker-expenses/draft-prefill'
import { OpenExpenseDraftButton } from '@/components/worker-expenses/open-expense-draft-button'
import { ExpenseDraftDuplicateHints } from '@/components/worker-expenses/expense-draft-duplicate-hints'
import type { ExpenseDuplicateRowT } from '@/components/tables/expense-duplicates'
import { ExpenseForm, type ExpenseFormPrefillT } from '@/components/forms/expense-form/expense-form'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import {
  markReceiptDuplicateAction,
  readExpenseDraftAction,
  rejectExpenseDraftAction,
} from '@/lib/actions/worker-expense-drafts'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import {
  findExpenseDraftDuplicates,
  type ParagonDuplicatesT,
} from '@/lib/queries/expense-draft-duplicates'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'
import type { ExpenseDraftMediaT, ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { warsawToday } from '@/lib/utils/days'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { usePendingStore } from '@/stores/pending-store'
import type { ReferenceDataT } from '@/types/reference-data'

type AcceptingT = {
  draft: ExpenseDraftRowT
  // The downloaded pages, in `draft.media` order.
  files: File[]
  prefill: ExpenseFormPrefillT
  isReading: boolean
  duplicates?: ParagonDuplicatesT[]
  // Bumped when a paragon leaves the form, so the form remounts on the shorter prefill.
  revision: number
}

const DRAFT_READ_PENDING_KEY = 'expense-draft-read'

const formIdOf = (draftId: number) => `expense-draft-${draftId}`

// A paragon refused as a duplicate is decided already; accepting the rest must not book it again.
function withoutPages(draft: ExpenseDraftRowT, mediaIds: number[]): ExpenseDraftRowT {
  const removed = new Set(mediaIds)
  return { ...draft, media: draft.media.filter((page) => !removed.has(page.id)) }
}

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
  async function open(listedDraft: ExpenseDraftRowT) {
    const draft = withoutPages(listedDraft, listedDraft.skippedMediaIds ?? [])
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
    setAccepting({ draft, files, prefill: prefillFor(draft, files), isReading, revision: 0 })
    openDialog(formIdOf(draft.id), false)
    if (isReading && !readsInFlight.current.has(draft.id)) await readOnOpen(draft, files)
    else await loadDuplicates(draft.id)
  }

  // SPIKE (EX-1025): the comparison needs the AI read, so it runs once the read is in.
  async function loadDuplicates(draftId: number) {
    const duplicates = await findExpenseDraftDuplicates(draftId)
    setAccepting((prev) => (prev?.draft.id === draftId ? { ...prev, duplicates } : prev))
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
              draft: aiRead ? { ...prev.draft, aiRead } : prev.draft,
              prefill: aiRead ? prefillFor({ ...draft, aiRead }, files) : prev.prefill,
              isReading: false,
              duplicates: undefined,
            }
          : prev,
      )
      // The list's copy of the draft still has no read; without the refresh a reopen pays again.
      if (aiRead) router.refresh()
      if (aiRead) await loadDuplicates(draft.id)
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

  // SPIKE (EX-1025): refused on the click — the last paragon takes the whole zgłoszenie with it.
  async function handleMarkDuplicate(current: AcceptingT, row: ExpenseDuplicateRowT) {
    const duplicateOf = { source: row.source, id: row.id }
    if (current.prefill.values.lineItems.length === 1) {
      await handleReject(current.draft.id, duplicateOf)
      return
    }
    const result = await settleAction(() =>
      markReceiptDuplicateAction({
        draftId: current.draft.id,
        mediaIds: row.paragonMediaIds,
        duplicateOf,
      }),
    )
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }
    const refused = new Set(row.paragonMediaIds)
    const draft = withoutPages(current.draft, row.paragonMediaIds)
    const files = current.files.filter((_, index) => !refused.has(current.draft.media[index].id))
    setAccepting((prev) =>
      prev?.draft.id === draft.id
        ? {
            ...prev,
            draft,
            files,
            prefill: prefillFor(draft, files),
            duplicates: undefined,
            revision: prev.revision + 1,
          }
        : prev,
    )
    toastMessage('Paragon odrzucony jako duplikat')
    router.refresh()
    await loadDuplicates(draft.id)
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
          className="sm:max-w-[96vw]"
        >
          {(onSubmitSuccess) => (
            <div className="flex flex-col gap-8">
              <ExpenseDraftDuplicateHints
                paragons={accepting.duplicates}
                onMarkDuplicate={(row) => handleMarkDuplicate(accepting, row)}
              />
              <ExpenseForm
                // The form seeds from `prefill` once; a landed read or a refused paragon needs a fresh mount.
                key={`${accepting.isReading}-${accepting.revision}`}
                referenceData={referenceData}
                onSubmitSuccess={onSubmitSuccess}
                formId={formIdOf(accepting.draft.id)}
                prefill={accepting.prefill}
                isPrefillReading={accepting.isReading}
                onRemoveLastItem={() => setRejecting(accepting.draft)}
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
            </div>
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
