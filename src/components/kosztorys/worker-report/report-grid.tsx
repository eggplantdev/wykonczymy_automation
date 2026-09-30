'use client'

import { useState } from 'react'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import { BrandedHeader } from '@/components/kosztorys/worker-report/branded-header'
import { ExtraWorksDialogButton } from '@/components/kosztorys/worker-report/extra-works-dialog-button'
import { ReportBar } from '@/components/kosztorys/worker-report/report-bar'
import { POZYCJA_FORMS, SendBar, type SentT } from '@/components/kosztorys/worker-report/send-bar'
import { SentReports } from '@/components/kosztorys/worker-report/sent-reports'
import type { useReportDraft } from '@/components/kosztorys/worker-report/use-report-draft'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils/cn'
import { pluralize } from '@/lib/utils/polish-plural'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import type { WorkerReportRowT } from '@/lib/db/worker-reports'
import type { WorkerReportFormDataT } from '@/lib/kosztorys/worker-report/types'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'

type PropsT = {
  token: string
  data: WorkerReportFormDataT
  document: Extract<WorkerKosztorysT, { kind: 'ready' }>
  draft: ReturnType<typeof useReportDraft>
  pendingQtyByItem: Record<number, number>
  sentReports: WorkerReportRowT[]
  onSent: (sent: SentT) => void
}

const VANISHED_FORMS = ['zniknęła', 'zniknęły', 'zniknęło'] as const

function draftQtyByItem(qtyByItem: Record<number, string>): Record<number, number> {
  return Object.fromEntries(
    Object.entries(qtyByItem).flatMap(([itemId, raw]) => {
      const parsed = parseReportQty(raw)
      return parsed.kind === 'value' ? [[itemId, parsed.value]] : []
    }),
  )
}

// The report typed straight into his rozpiska. Mount it only once the draft has loaded — the grid
// seeds from it once.
export function ReportGrid({
  token,
  data,
  document,
  draft,
  pendingQtyByItem,
  sentReports,
  onSent,
}: PropsT) {
  const [isAllColumns, setIsAllColumns] = useState(false)
  const [initialQtyByItem] = useState(() => draftQtyByItem(draft.draft.qtyByItem))

  return (
    <KosztorysEditorBody
      preview
      worker={document.worker}
      investmentId={document.investmentId}
      investmentName={document.investmentName}
      tree={document.tree}
      materialsGrossBase={0}
      materialsNetBilled={0}
      materialsBreakdown={[]}
      settledBreakdown={[]}
      laborCostsNetFromTransactions={0}
      discountNetFromTransactions={0}
      investmentLoss={0}
      depositTransactions={[]}
      materialTransactions={[]}
      report={{
        initialQtyByItem,
        pendingQtyByItem,
        isCompact: !isAllColumns,
        // A negative stays in the draft as typed, so the send bar can refuse it.
        onReportQty: (itemId, qty) =>
          draft.setQty(itemId, qty === 0 ? '' : String(qty).replace('.', ',')),
        header: (controls) => (
          <>
            <BrandedHeader data={data} />
            {draft.droppedCount > 0 && (
              <p className="border-border border-b px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
                {draft.droppedCount} {pluralize(draft.droppedCount, POZYCJA_FORMS)} ze szkicu{' '}
                {pluralize(draft.droppedCount, VANISHED_FORMS)} z rozpiski.
              </p>
            )}
            <ReportBar
              search={controls.search}
              onSearch={controls.onSearch}
              className="border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:gap-6"
              chips={
                <>
                  <Label className="gap-2 text-xs font-normal">
                    <Switch
                      checked={controls.showAllRows}
                      onCheckedChange={controls.onShowAllRows}
                    />
                    Wszystkie prace
                  </Label>
                  <Label className="gap-2 text-xs font-normal">
                    <Switch checked={isAllColumns} onCheckedChange={setIsAllColumns} />
                    Wszystkie kolumny
                  </Label>
                </>
              }
            />
          </>
        ),
        footer: (
          // All columns are wider than the screen; screen-wide, the buttons stay in view.
          <div className={cn('sticky left-0', isAllColumns && 'w-screen')}>
            <div className="flex items-center justify-end gap-2 px-4 py-4">
              <ExtraWorksDialogButton
                extras={draft.draft.extras}
                commonUnits={data.commonUnits}
                onSave={draft.saveExtra}
                onRemove={draft.removeExtra}
              />
              <SendBar token={token} data={data} draft={draft} onSent={onSent} />
            </div>
            <SentReports reports={sentReports} />
          </div>
        ),
      }}
    />
  )
}
