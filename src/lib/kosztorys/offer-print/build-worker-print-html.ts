import { escapeHtml } from '@/lib/utils/escape-html'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { columnTotalsForRows } from '@/lib/kosztorys/column-totals'
import {
  buildKosztorysPrintHtml,
  offeredRows,
} from '@/lib/kosztorys/offer-print/build-offer-print-html'
import { WIDE_PRINT_STYLES } from '@/lib/kosztorys/offer-print/styles'
import { workerPrintColumns } from '@/lib/kosztorys/offer-print/worker-columns'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import type { WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'

export type WorkerPrintArgsT = {
  data: Extract<WorkerKosztorysT, { kind: 'ready' }>
  logoUrl: string
  fillByColorKey: ReadonlyMap<string, string>
}

const footerRow = (label: string, amount: number, rowClass = '') =>
  `<tr${rowClass ? ` class="${rowClass}"` : ''}><td class="label">${escapeHtml(label)}</td>` +
  `<td class="value">${formatPLN(amount)}</td></tr>`

// The web page's `WorkerSummary`, on paper: the same figures in the same order, so the two documents
// a worker may hold side by side read alike.
function workerFooterHtml(summary: WorkerSummaryT): string {
  const rows = [
    footerRow('Wartość przedmiaru (Twoja stawka)', summary.plannedNet),
    ...summary.executedByStage.map((stage) => footerRow(stage.label, stage.net, 'sub')),
    footerRow('Wykonane razem', summary.executedNet),
    ...summary.payouts.map((payout) => footerRow(formatPLDate(payout.date), payout.amount, 'sub')),
    footerRow('Wypłacone', summary.paidNet),
    footerRow(
      summary.isOverpaid ? 'Nadpłata' : 'Pozostało do wypłaty',
      Math.abs(summary.owed),
      'grand',
    ),
  ]
  return `
<div class="totals"><table><tbody>
${rows.join('\n')}
</tbody></table></div>`
}

/**
 * The worker's PDF, built off the same projection his link renders — never the editor's rows, which
 * carry every etap and the client price. The totals are the projection's own: the grand total is the
 * summary's `plannedNet`, so the paper cannot add up to a figure the footer contradicts.
 */
export function buildWorkerPrintHtml({ data, logoUrl, fillByColorKey }: WorkerPrintArgsT): string {
  const { tree, worker, investmentName } = data
  const rows = treeToRows(tree)
  const { stages } = tree
  const sectionNetById = new Map(
    [...groupBySection(rows)].map(([sectionId, rowsOfSection]) => [
      sectionId,
      columnTotalsForRows(rowsOfSection, stages, worker.plane, tree.vatRate).get(
        'plannedNetForPlane',
      ) ?? 0,
    ]),
  )

  return buildKosztorysPrintHtml({
    // The link's own empty-rows rule: an empty pozycja is worth nothing at any stawka, so dropping
    // it moves no total.
    rows: offeredRows(rows, stages, worker.settings),
    stages,
    columns: workerPrintColumns({
      plane: worker.plane,
      stages,
      hiddenColumns: worker.settings.hiddenColumns,
      columnRanks: worker.settings.columnRanks,
      executedQtyByItem: worker.executedQtyByItem,
    }),
    priceView: worker.plane,
    documentKind: `Kosztorys — ${worker.name}`,
    title: investmentName,
    pageTitle: `${investmentName} — ${worker.name}`,
    logoUrl,
    fillByColorKey,
    moneyKey: 'plannedNetForPlane',
    money: formatPLN,
    totalNet: worker.summary.plannedNet,
    sectionNetById,
    extraStyles: WIDE_PRINT_STYLES,
    footerHtml: workerFooterHtml(worker.summary),
  })
}
