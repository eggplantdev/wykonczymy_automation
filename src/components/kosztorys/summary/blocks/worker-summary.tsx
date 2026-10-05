'use client'

import { cn } from '@/lib/utils/cn'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
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

  return (
    <div className="flex flex-col items-end gap-6">
      <table className={TABLE}>
        <tbody>
          <tr className={HEAD}>
            <td className={LABEL}>Wykonane</td>
            {hasSharedStage && (
              <>
                <td className={VALUE}>Wartość etapu</td>
                <td className={VALUE}>Twój udział</td>
              </>
            )}
            <td className={VALUE}>Kwota netto</td>
          </tr>
          {summary.executedByStage.map((stage) => (
            <tr key={stage.stageId}>
              <td className={LABEL}>{stage.label}</td>
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
            <td className={LABEL}>Razem</td>
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
            <td className={LABEL}>Twoje rozliczenie</td>
            <td className={VALUE}>Kwota netto</td>
          </tr>
          <tr>
            <td className={LABEL}>Wykonane razem</td>
            <td className={VALUE}>{formatNet(summary.executedNet)}</td>
          </tr>
          {summary.bonusNet !== 0 && (
            <tr>
              <td className={LABEL}>Premia</td>
              <td className={VALUE}>{formatNet(summary.bonusNet)}</td>
            </tr>
          )}
          <tr>
            <td className={LABEL}>Wypłacone</td>
            <td className={cn(VALUE, 'text-chart-green')}>{formatNet(summary.paidNet)}</td>
          </tr>
          <tr className={GRAND}>
            <td className={cn(CELL, 'text-left')}>
              {summary.isOverpaid ? 'Nadpłata' : 'Pozostało do wypłaty'}
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
              <td className={LABEL}>Wypłaty</td>
              <td className={LABEL}>Opis</td>
              <td className={VALUE}>Kwota netto</td>
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
                Razem
              </td>
              <td className={VALUE}>{formatNet(summary.paidNet)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
