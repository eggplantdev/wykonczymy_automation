'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialog } from '@/components/ui/form-dialog'
import {
  SUMMARY_LABEL_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { buildDraftPrefill } from '@/components/worker-expenses/draft-prefill'
import { ExpenseForm, type ExpenseFormPrefillT } from '@/components/forms/expense-form/expense-form'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import {
  readExpenseDraftAction,
  rejectExpenseDraftAction,
} from '@/lib/actions/worker-expense-drafts'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'
import type { ExpenseDraftMediaT, ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { warsawToday } from '@/lib/utils/days'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { usePendingStore } from '@/stores/pending-store'
import type { ReferenceDataT } from '@/types/reference-data'

type PropsT = {
  drafts: ExpenseDraftRowT[]
  referenceData: ReferenceDataT
}

const COLS = `auto ${SUMMARY_LABEL_COL} auto auto minmax(min(16rem, 40vw), 1fr) auto`

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

export function PendingExpenseDrafts({ drafts, referenceData }: PropsT) {
  const router = useRouter()
  const openDialog = useOptimisticFormStore((s) => s.openDialog)
  const closeDialog = useOptimisticFormStore((s) => s.closeDialog)
  const [loadingId, setLoadingId] = useState<number | undefined>()
  const [accepting, setAccepting] = useState<AcceptingT | undefined>()
  const [rejecting, setRejecting] = useState<ExpenseDraftRowT | undefined>()

  if (drafts.length === 0) return null

  function prefillFor(draft: ExpenseDraftRowT, files: File[]): ExpenseFormPrefillT {
    const expenseCategory = resolveExpenseCategoryId(
      DEFAULT_EXPENSE_CATEGORY_NAME,
      referenceData.expenseCategories,
    )
    const { lineItems, files: rowFiles } = buildDraftPrefill(draft, files, expenseCategory)
    return {
      expenseDraftId: draft.id,
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
  async function handleOpen(draft: ExpenseDraftRowT) {
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
    if (isReading) await readOnOpen(draft, files)
  }

  // The send-time read is still running, failed, or predates the draft. Reading here instead of on
  // the form's mount keeps the spend on the click; the dialog is already open, its rows locked
  // until the read lands, so nothing the manager types is overwritten by the refill.
  async function readOnOpen(draft: ExpenseDraftRowT, files: File[]) {
    usePendingStore.getState().start(DRAFT_READ_PENDING_KEY, 'Odczytywanie paragonów…')
    try {
      const result = await settleAction(() => readExpenseDraftAction(draft.id))
      const aiRead = result.success ? result.data.aiRead : undefined
      if (!aiRead) toastMessage('Nie odczytano zdjęć zgłoszenia', 'warning')
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
      usePendingStore.getState().stop(DRAFT_READ_PENDING_KEY)
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

  return (
    <section className="flex max-w-4xl flex-col gap-2">
      <h2 className="text-sm font-semibold">Wydatki zgłoszone przez pracowników</h2>
      <SummaryTable cols={COLS}>
        <SummaryHeaderCell variant="label">Pracownik</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">Inwestycja</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">Wysłano</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">Załączniki</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">Notatka</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">{null}</SummaryHeaderCell>
        {drafts.map((draft) => (
          <Fragment key={draft.id}>
            <SummaryLabelCell className="flex items-center">{draft.workerName}</SummaryLabelCell>
            <SummaryLabelCell className="flex items-center">
              {draft.investmentName}
            </SummaryLabelCell>
            <SummaryLabelCell className="flex items-center">
              {formatPLDateTime(draft.sentAt)}
            </SummaryLabelCell>
            <SummaryLabelCell className="flex items-center justify-center">
              <MediaPreviewButton
                labels={INVOICE_PREVIEW_LABELS}
                files={draft.media}
                variant="compact"
              />
            </SummaryLabelCell>
            <SummaryLabelCell className="flex items-center break-words">
              {draft.note ?? '—'}
            </SummaryLabelCell>
            <SummaryLabelCell className="flex items-center">
              <Button
                size="sm"
                disabled={loadingId !== undefined}
                onClick={() => handleOpen(draft)}
              >
                {loadingId === draft.id && <Loader2 className="animate-spin" />}
                Zobacz
              </Button>
            </SummaryLabelCell>
          </Fragment>
        ))}
      </SummaryTable>

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
    </section>
  )
}
