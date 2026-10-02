import { escapeHtml } from '@/lib/utils/escape-html'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { columnTotalsForRows } from '@/lib/kosztorys/columns/column-totals'
import { buildKosztorysPrintHtml } from '@/lib/kosztorys/print/build-html'
import { documentRows } from '@/lib/kosztorys/print/document-rows'
import { WIDE_PRINT_STYLES } from '@/lib/kosztorys/print/styles'
import { workerPrintColumns } from '@/lib/kosztorys/print/worker-columns'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { workerDataHiddenColumns } from '@/lib/kosztorys/worker-view/columns'
import { stageShareLabel, type WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'

export type WorkerPrintArgsT = {
  data: Extract<WorkerKosztorysT, { kind: 'ready' }>
  logoUrl: string
  fillByColorKey: ReadonlyMap<string, string>
}

const row = (labels: string[], values: string[], rowClass = '') =>
  `<tr${rowClass ? ` class="${rowClass}"` : ''}>` +
  labels.map((label) => `<td class="label">${escapeHtml(label)}</td>`).join('') +
  values.map((value) => `<td class="value">${escapeHtml(value)}</td>`).join('') +
  '</tr>'

// The breakdowns under the balance rather than inside it, so an etap or a payout is never read as one
// of the balance's own figures.
const WORKER_PRINT_STYLES = `
.totals { flex-direction: column; align-items: flex-end; gap: 6mm; }
.totals tr.head td { font-size: 6pt; color: #a1a1aa; border-bottom: 1px solid #e4e4e7; }
`

// The web page's `WorkerSummary`, on paper: the same tables in the same order, so the two documents
// a worker may hold side by side read alike.
function workerFooterHtml(summary: WorkerSummaryT): string {
  const balance = [
    row(['Wykonane razem'], [formatPLN(summary.executedNet)]),
    row(['Wypłacone'], [formatPLN(summary.paidNet)]),
    row(
      [summary.isOverpaid ? 'Nadpłata' : 'Pozostało do wypłaty'],
      [formatPLN(Math.abs(summary.owed))],
      'grand',
    ),
  ]
  const hasSharedStage = summary.executedByStage.some((stage) => stage.share)
  const executed = [
    row(
      ['Wykonane'],
      hasSharedStage ? ['Wartość etapu', 'Twój udział', 'Kwota netto'] : ['Kwota netto'],
      'head',
    ),
    ...summary.executedByStage.map((stage) =>
      row(
        [stage.label],
        hasSharedStage
          ? [formatPLN(stage.wholeNet), stageShareLabel(stage), formatPLN(stage.net)]
          : [formatPLN(stage.net)],
      ),
    ),
    row(
      ['Razem'],
      hasSharedStage
        ? [formatPLN(summary.stagesWholeNet), '', formatPLN(summary.executedNet)]
        : [formatPLN(summary.executedNet)],
    ),
  ]
  const payouts = [
    row(['Wypłaty', 'Opis'], ['Kwota netto'], 'head'),
    ...summary.payouts.map((payout) =>
      row([formatPLDate(payout.date), payout.description ?? ''], [formatPLN(payout.amount)]),
    ),
    `<tr><td class="label" colspan="2">Razem</td><td class="value">${formatPLN(summary.paidNet)}</td></tr>`,
  ]
  const table = (rows: string[]) => `<table><tbody>\n${rows.join('\n')}\n</tbody></table>`
  return `
<div class="totals">${table(executed)}${table(balance)}${summary.payouts.length ? table(payouts) : ''}</div>`
}

/**
 * The worker's PDF, built off the same projection his link renders — never the editor's rows, which
 * carry every etap and the client price. The totals are the projection's own: the grand total is the
 * summary's figure for the money column, so the paper cannot add up to one the footer contradicts.
 * On a shared etap the rows are the whole etap's, so the executed grand total is too — his share is
 * a footer line of its own.
 */
export function buildWorkerPrintHtml({ data, logoUrl, fillByColorKey }: WorkerPrintArgsT): string {
  const { tree, worker, investmentName } = data
  const rows = treeToRows(tree)
  const { stages } = tree
  const dataHidden = workerDataHiddenColumns(rows, stages, worker.settings.hidePlannedOnceExecuted)
  // With the przedmiar's value off the paper, the section totals follow the executed value — left on
  // „Wartość przedmiaru" they would vanish with it (build-html prints them under the money column).
  const moneyKey = dataHidden.has('plannedNetForPlane') ? 'net' : 'plannedNetForPlane'
  const sectionNetById = new Map(
    [...groupBySection(rows)].map(([sectionId, rowsOfSection]) => [
      sectionId,
      columnTotalsForRows(rowsOfSection, stages, worker.plane, tree.vatRate).get(moneyKey) ?? 0,
    ]),
  )

  return buildKosztorysPrintHtml({
    // The link's own empty-rows rule: an empty pozycja is worth nothing at any stawka, so dropping
    // it moves no total.
    rows: documentRows(rows, stages, worker.settings.hideEmptyRows),
    columns: workerPrintColumns({
      plane: worker.plane,
      stages,
      hiddenColumns: worker.settings.hiddenColumns,
      columnRanks: worker.settings.columnRanks,
      executedQtyByItem: worker.executedQtyByItem,
    }).filter((column) => !dataHidden.has(column.key)),
    documentKind: `Kosztorys — ${worker.name}`,
    title: investmentName,
    pageTitle: `${investmentName} — ${worker.name}`,
    logoUrl,
    fillByColorKey,
    moneyKey,
    money: formatPLN,
    totalNet: moneyKey === 'net' ? worker.summary.stagesWholeNet : worker.summary.plannedNet,
    sectionNetById,
    extraStyles: WIDE_PRINT_STYLES + WORKER_PRINT_STYLES,
    footerHtml: workerFooterHtml(worker.summary),
  })
}
