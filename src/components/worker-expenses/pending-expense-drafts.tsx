'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DataTable } from '@/components/tables/data-table/data-table'
import { SelectedIdsContext } from '@/components/tables/data-table/select-column'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import { useTranslation } from '@/hooks/use-translation'
import { useExpenseDraftAcceptance } from '@/components/worker-expenses/use-expense-draft-acceptance'
import { mergeExpenseDraftsAction } from '@/lib/actions/worker-expense-drafts'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { failureMessage } from '@/lib/i18n/failure-message'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import type { ReferenceDataT } from '@/types/reference-data'

const NO_SELECTION: ReadonlySet<number> = new Set()

type PropsT = {
  drafts: ExpenseDraftRowT[]
  referenceData: ReferenceDataT
  // Per surface, so collapsing the queue on one page leaves it open on the other.
  storageKey?: string
  // A link from the duplicate finder; its dialog opens once, on arrival.
  openDraftId?: number
}

export function PendingExpenseDrafts({
  drafts,
  referenceData,
  storageKey = 'pending-expense-drafts',
  openDraftId,
}: PropsT) {
  const router = useRouter()
  const { t, tp, locale } = useTranslation('expenseDrafts')
  const { open, openButton, dialogs } = useExpenseDraftAcceptance(referenceData)
  const hasOpenedFromUrl = useRef(false)
  // Pruned to the rows still listed whenever `drafts` changes, so a merged-away id drops out.
  const [selection, setSelection] = useState({ drafts, ids: NO_SELECTION })
  if (selection.drafts !== drafts) {
    const listed = new Set(drafts.map((draft) => draft.id))
    setSelection({ drafts, ids: new Set([...selection.ids].filter((id) => listed.has(id))) })
  }
  const selectedIds = selection.ids
  const [isConfirming, setIsConfirming] = useState(false)
  const [isMerging, setIsMerging] = useState(false)

  const columns = useExpenseDraftColumns({
    isManagerView: true,
    isPendingQueue: true,
    actions: openButton,
    selection: {
      onToggle: (id) => setSelection((prev) => ({ ...prev, ids: toggleInSet(prev.ids, id) })),
      onTogglePage: (pageIds) =>
        setSelection((prev) => ({
          ...prev,
          ids: pageIds.every((id) => prev.ids.has(id)) ? NO_SELECTION : new Set(pageIds),
        })),
    },
  })

  // Above the empty-queue return: a link to a zgłoszenie decided since must still say so.
  useEffect(() => {
    if (openDraftId === undefined || hasOpenedFromUrl.current) return
    hasOpenedFromUrl.current = true
    const linked = drafts.find((draft) => draft.id === openDraftId)
    if (linked) void open(linked)
    else toastMessage('To zgłoszenie jest już rozpatrzone', 'warning')
    // Dropped so a refresh or a back navigation does not open it again.
    const params = new URLSearchParams(window.location.search)
    params.delete('zgloszenie')
    const query = params.toString()
    router.replace(`${window.location.pathname}${query ? `?${query}` : ''}`, { scroll: false })
  })

  async function merge() {
    setIsConfirming(false)
    setIsMerging(true)
    try {
      const result = await settleAction(() => mergeExpenseDraftsAction([...selectedIds]))
      if (!result.success) {
        toastMessage(failureMessage(locale, result), 'error')
        return
      }
      toastMessage(tp('mergedToast', selectedIds.size))
      setSelection((prev) => ({ ...prev, ids: NO_SELECTION }))
      router.refresh()
    } finally {
      setIsMerging(false)
    }
  }

  if (drafts.length === 0) return null

  return (
    <section>
      <CollapsibleSection
        title={t('queueTitle')}
        hint={t('mergeHint')}
        size="sm"
        withSeparator={false}
        storageKey={`${storageKey}:open`}
        action={
          selectedIds.size > 1 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isMerging}
              onClick={() => setIsConfirming(true)}
            >
              {t('merge', { count: selectedIds.size })}
            </Button>
          )
        }
      >
        <SelectedIdsContext value={selectedIds}>
          <DataTable data={drafts} columns={columns} storageKey={storageKey} />
        </SelectedIdsContext>
      </CollapsibleSection>
      <ConfirmDialog
        open={isConfirming}
        title={tp('mergeConfirmTitle', selectedIds.size)}
        description={t('mergeConfirmBody')}
        confirmLabel={t('mergeConfirm')}
        variant="neutral"
        onConfirm={() => void merge()}
        onCancel={() => setIsConfirming(false)}
      />
      {dialogs}
    </section>
  )
}
