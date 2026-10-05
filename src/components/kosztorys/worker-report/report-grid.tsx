'use client'

import { useState } from 'react'
import { KosztorysEditorBody } from '@/components/kosztorys/editor/kosztorys-editor-body'
import { WorkerSummary } from '@/components/kosztorys/worker-report/worker-summary'
import { BrandedHeader } from '@/components/kosztorys/worker-report/branded-header'
import { DraftExtraWorks } from '@/components/kosztorys/worker-report/draft-extra-works'
import { ExtraWorksDialogButton } from '@/components/kosztorys/worker-report/extra-works-dialog-button'
import { ReportBar } from '@/components/kosztorys/worker-report/report-bar'
import {
  ReportModeFooter,
  type ReportViewModeT,
} from '@/components/kosztorys/worker-report/report-mode-footer'
import { SendBar, type SentT } from '@/components/kosztorys/worker-report/send-bar'
import { SentReports } from '@/components/kosztorys/worker-report/sent-reports'
import type { useReportDraft } from '@/components/kosztorys/worker-report/use-report-draft'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { translateTree } from '@/lib/kosztorys/worker-report/translate-tree'
import type { SectionTranslationMapT } from '@/lib/i18n/section-translations'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'
import { decimalText } from '@/lib/utils/decimal-text'
import { parseDecimalInput } from '@/lib/utils/parse-decimal-input'
import type { WorkerReportRowT } from '@/lib/db/worker-reports'
import type { WorkerReportFormDataT } from '@/lib/kosztorys/worker-report/types'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'

type PropsT = {
  // Absent on the owner's Podgląd: he sees the worker's whole surface but sends nothing as him.
  token?: string
  data: WorkerReportFormDataT
  document: Extract<WorkerKosztorysT, { kind: 'ready' }>
  draft: ReturnType<typeof useReportDraft>
  sentReports: WorkerReportRowT[]
  sectionTranslations: SectionTranslationMapT
  onSent: (sent: SentT) => void
}

// Not `parseReportQty`: a negative it refuses must still show in the column, or „Popraw błędy”
// blocks the send with nothing on screen to correct.
function draftQtyByItem(qtyByItem: Record<number, string>): Record<number, number> {
  return Object.fromEntries(
    Object.entries(qtyByItem).flatMap(([itemId, raw]) => {
      const parsed = parseDecimalInput(raw)
      return parsed.kind === 'value' && parsed.value !== 0 ? [[itemId, parsed.value]] : []
    }),
  )
}

// Mount it only once the draft has loaded — the grid
// seeds from it once.
export function ReportGrid({
  token,
  data,
  document,
  draft,
  sentReports,
  sectionTranslations,
  onSent,
}: PropsT) {
  const [mode, setMode] = useState<ReportViewModeT>('report')
  const isReport = mode === 'report'
  const hasRows = data.sections.some((section) => section.items.length > 0)
  const { locale, t, tp } = useTranslation('report')
  const qtyByItem = draftQtyByItem(draft.draft.qtyByItem)

  return (
    <>
      {/* The body seeds its rows once, so a language or mode switch remounts it — reseeded from the
          draft as it is now, or what he typed since the first mount would vanish from the column. The
          remount also drops a search or „Tylko zgłaszane przeze mnie” left over from the other mode. */}
      <KosztorysEditorBody
        key={`${locale}-${mode}`}
        preview
        worker={document.worker}
        investmentId={document.investmentId}
        investmentName={document.investmentName}
        tree={translateTree(document.tree, locale, sectionTranslations)}
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
          initialQtyByItem: qtyByItem,
          isSummary: !isReport,
          // A negative stays in the draft as typed, so the send bar can refuse it.
          onReportQty: (itemId, qty) => draft.setQty(itemId, qty === 0 ? '' : decimalText(qty)),
          header: (controls) => (
            <div className={cn('sticky left-0', !isReport && 'w-screen')}>
              <BrandedHeader data={data} />
              {draft.droppedCount > 0 && (
                <p className="border-border border-b px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
                  {tp('draftDropped', draft.droppedCount)}
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
                      {t('allWorks')}
                      {controls.hiddenRowCount > 0 && ` (+${controls.hiddenRowCount})`}
                    </Label>
                    {isReport && (
                      <Label className="gap-2 text-xs font-normal">
                        <Switch
                          checked={controls.reportedOnly}
                          onCheckedChange={controls.onReportedOnly}
                        />
                        {t('reportedOnly')} ({Object.keys(qtyByItem).length})
                      </Label>
                    )}
                  </>
                }
              />
            </div>
          ),
          footer: (
            // The full sheet is wider than the screen; screen-wide, its contents stay in view. The
            // bottom padding keeps the fixed mode footer off the last line.
            <div className={cn('sticky left-0', hasRows && 'pb-20', !isReport && 'w-screen')}>
              {isReport ? (
                <>
                  <DraftExtraWorks extras={draft.draft.extras} />
                  <div className="flex items-center justify-end gap-2 px-4 py-4">
                    <ExtraWorksDialogButton
                      extras={draft.draft.extras}
                      commonUnits={data.commonUnits}
                      onSave={draft.saveExtra}
                      onRemove={draft.removeExtra}
                    />
                    {token && <SendBar token={token} data={data} draft={draft} onSent={onSent} />}
                  </div>
                  <SentReports reports={sentReports} />
                </>
              ) : (
                hasRows && (
                  <div className="px-4 py-10">
                    <WorkerSummary summary={document.worker.summary} />
                  </div>
                )
              )}
            </div>
          ),
        }}
      />
      {/* Outside the body: the body remounts on every mode switch, and the switch must not. */}
      {hasRows && (
        <ReportModeFooter
          mode={mode}
          onModeChange={(next) => {
            setMode(next)
            window.scrollTo({ top: 0 })
          }}
        />
      )}
    </>
  )
}
