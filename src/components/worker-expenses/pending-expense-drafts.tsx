'use client'

import { Fragment } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  SUMMARY_LABEL_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
} from '@/components/ui/summary-grid'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { useExpenseDraftAcceptance } from '@/components/worker-expenses/use-expense-draft-acceptance'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { formatPLDateTime } from '@/lib/utils/format-date'
import type { ReferenceDataT } from '@/types/reference-data'

type PropsT = {
  drafts: ExpenseDraftRowT[]
  referenceData: ReferenceDataT
}

const COLS = `auto ${SUMMARY_LABEL_COL} auto auto minmax(min(16rem, 40vw), 1fr) auto`

export function PendingExpenseDrafts({ drafts, referenceData }: PropsT) {
  const { open, loadingId, dialogs } = useExpenseDraftAcceptance(referenceData)

  if (drafts.length === 0) return null

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
              <Button size="sm" disabled={loadingId !== undefined} onClick={() => open(draft)}>
                {loadingId === draft.id && <Loader2 className="animate-spin" />}
                Zobacz
              </Button>
            </SummaryLabelCell>
          </Fragment>
        ))}
      </SummaryTable>
      {dialogs}
    </section>
  )
}
