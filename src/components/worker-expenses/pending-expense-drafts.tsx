'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormDialog } from '@/components/ui/form-dialog'
import { ExpenseForm, type ExpenseFormPrefillT } from '@/components/forms/expense-form/expense-form'
import { makeLineItem } from '@/components/forms/expense-form/bulk-expense-form'
import { resolveExpenseCategoryId } from '@/components/forms/expense-form/resolve-expense-category-id'
import { rejectExpenseDraftAction } from '@/lib/actions/worker-expense-drafts'
import { DEFAULT_EXPENSE_CATEGORY_NAME } from '@/lib/constants/transfers'
import type { ExpenseDraftMediaT, ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { warsawToday } from '@/lib/utils/days'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { ReferenceDataT } from '@/types/reference-data'

type PropsT = {
  drafts: ExpenseDraftRowT[]
  referenceData: ReferenceDataT
}

type AcceptingT = { draft: ExpenseDraftRowT; prefill: ExpenseFormPrefillT }

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
  const [loadingId, setLoadingId] = useState<number | undefined>()
  const [accepting, setAccepting] = useState<AcceptingT | undefined>()
  const [rejecting, setRejecting] = useState<ExpenseDraftRowT | undefined>()

  if (drafts.length === 0) return null

  // The pages are re-uploaded on save rather than reused by id: „Generuj" renames the files, and the
  // regular upload path is what files a page under its row.
  async function handleAccept(draft: ExpenseDraftRowT) {
    setLoadingId(draft.id)
    try {
      const files = await downloadPages(draft.media)
      const expenseCategory = resolveExpenseCategoryId(
        DEFAULT_EXPENSE_CATEGORY_NAME,
        referenceData.expenseCategories,
      )
      setAccepting({
        draft,
        prefill: {
          expenseDraftId: draft.id,
          files: new Map([[0, files]]),
          values: {
            date: warsawToday(),
            type: 'INVESTMENT_EXPENSE',
            paymentMethod: 'CASH',
            sourceRegister: String(draft.cashRegisterId),
            targetRegister: '',
            investment: String(draft.investmentId),
            worker: '',
            settled: false,
            lineItems: [makeLineItem({ expenseCategory })],
          },
        },
      })
      openDialog(formIdOf(draft.id), false)
    } catch {
      toastMessage('Nie udało się pobrać zdjęć zgłoszenia', 'error')
    } finally {
      setLoadingId(undefined)
    }
  }

  async function handleReject(draftId: number) {
    const result = await settleAction(() => rejectExpenseDraftAction(draftId))
    if (!result.success) {
      toastMessage(result.error, 'error')
      return
    }
    toastMessage('Zgłoszenie odrzucone')
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Wydatki zgłoszone przez pracowników</h2>
      <ul className="flex flex-col divide-y rounded-md border text-sm">
        {drafts.map((draft) => (
          <li
            key={draft.id}
            className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium">
                {draft.workerName} · {draft.investmentName}
              </div>
              <div className="text-muted-foreground text-xs">
                {formatPLDateTime(draft.sentAt)} · zdjęć: {draft.media.length}
              </div>
              {draft.note && <div className="mt-1 break-words">{draft.note}</div>}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                disabled={loadingId !== undefined}
                onClick={() => handleAccept(draft)}
              >
                {loadingId === draft.id && <Loader2 className="animate-spin" />}
                Przyjmij
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejecting(draft)}>
                Odrzuć
              </Button>
            </div>
          </li>
        ))}
      </ul>

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
              referenceData={referenceData}
              onSubmitSuccess={onSubmitSuccess}
              formId={formIdOf(accepting.draft.id)}
              prefill={accepting.prefill}
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
