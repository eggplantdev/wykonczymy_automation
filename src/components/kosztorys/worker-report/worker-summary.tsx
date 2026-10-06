'use client'

import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { stageShareLabel, type WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'

// Drawn like the printed PDF's footer (`print/worker.ts`), not like the grid: ruled tables under a
// gridded sheet read as more of the sheet, and the worker holding both documents should see one.
const TABLE = 'w-auto min-w-64 max-sm:text-xs'
const CELL = 'py-1.5 pl-7 first:pl-0'
const LABEL = cn(CELL, 'text-muted-foreground text-left')
const VALUE = cn(CELL, 'text-right font-medium whitespace-nowrap tabular-nums')
const HEAD = 'border-border text-muted-foreground border-b text-xs [&>td]:font-normal'
const GRAND =
  'border-foreground border-t text-base max-sm:text-sm [&>td]:pt-2.5 [&>td]:font-semibold'

// An overpayment is named rather than printed as a minus — „Pozostało do wypłaty −300" reads as a
// debt the firm owes, which is the opposite of what it is.
export function WorkerSummary({ summary }: { summary: WorkerSummaryT }) {
  // Nobody shares his etapy: the whole etap and 100% would only repeat his own amount.
  const hasSharedStage = summary.executedByStage.some((stage) => stage.share)
  const { t } = useTranslation('report')
  const gridDictionary = useTranslation('grid')

  return (
    <div className="flex flex-col items-end gap-6">
      <table className={TABLE}>
        <tbody>
          <tr className={HEAD}>
            <td className={LABEL}>{t('summaryExecuted')}</td>
            {hasSharedStage && (
              <>
                <td className={VALUE}>{t('summaryStageValue')}</td>
                <td className={VALUE}>{t('summaryShare')}</td>
              </>
            )}
            <td className={VALUE}>{t('summaryNet')}</td>
          </tr>
          {summary.executedByStage.map((stage) => (
            <tr key={stage.stageId}>
              <td className={LABEL}>{stageLabel(stage, gridDictionary)}</td>
              {hasSharedStage && (
                <>
                  <td className={cn(VALUE, 'text-muted-foreground')}>
                    {formatNet(stage.wholeNet)}
                  </td>
                  <td className={cn(VALUE, 'text-muted-foreground')}>{stageShareLabel(stage)}</td>
                </>
              )}
              <td className={VALUE}>{formatNet(stage.net)}</td>
            </tr>
          ))}
          <tr>
            <td className={LABEL}>{t('summaryTotal')}</td>
            {hasSharedStage && (
              <>
                <td className={cn(VALUE, 'text-muted-foreground')}>
                  {formatNet(summary.stagesWholeNet)}
                </td>
                <td className={VALUE} />
              </>
            )}
            <td className={VALUE}>{formatNet(summary.executedNet)}</td>
          </tr>
        </tbody>
      </table>

      <table className={TABLE}>
        <tbody>
          <tr className={HEAD}>
            <td className={LABEL}>{t('summaryBalance')}</td>
            <td className={VALUE}>{t('summaryNet')}</td>
          </tr>
          <tr>
            <td className={LABEL}>{t('summaryExecutedTotal')}</td>
            <td className={VALUE}>{formatNet(summary.executedNet)}</td>
          </tr>
          {summary.bonusNet !== 0 && (
            <tr>
              <td className={LABEL}>{t('summaryBonus')}</td>
              <td className={VALUE}>{formatNet(summary.bonusNet)}</td>
            </tr>
          )}
          <tr>
            <td className={LABEL}>{t('summaryPaid')}</td>
            <td className={cn(VALUE, 'text-chart-green')}>{formatNet(summary.paidNet)}</td>
          </tr>
          <tr className={GRAND}>
            <td className={cn(CELL, 'text-left')}>
              {summary.isOverpaid ? t('summaryOverpaid') : t('summaryOwed')}
            </td>
            <td className={cn(VALUE, summary.isOverpaid && 'text-destructive')}>
              {formatNet(Math.abs(summary.owed))}
            </td>
          </tr>
        </tbody>
      </table>

      {summary.payouts.length > 0 && (
        <table className={TABLE}>
          <tbody>
            <tr className={HEAD}>
              <td className={LABEL}>{t('summaryPayouts')}</td>
              <td className={LABEL}>{t('summaryPayoutDescription')}</td>
              <td className={VALUE}>{t('summaryNet')}</td>
            </tr>
            {summary.payouts.map((payout, index) => (
              <tr key={`${payout.date}-${index}`}>
                <td className={cn(LABEL, 'whitespace-nowrap')}>{formatPLDate(payout.date)}</td>
                <td className={cn(LABEL, 'max-w-80')}>{payout.description}</td>
                <td className={VALUE}>{formatNet(payout.amount)}</td>
              </tr>
            ))}
            <tr>
              <td className={LABEL} colSpan={2}>
                {t('summaryTotal')}
              </td>
              <td className={VALUE}>{formatNet(summary.paidNet)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
