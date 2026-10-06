import type { LanguageT } from '@/lib/i18n/languages'
import type { SectionTranslationMapT } from '@/lib/i18n/section-translations'
import { createTranslator, getTranslations, type TranslatorT } from '@/lib/i18n/translations'
import { escapeHtml } from '@/lib/utils/escape-html'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { columnTotalsForRows } from '@/lib/kosztorys/columns/column-totals'
import { workerFormColumns } from '@/lib/kosztorys/print/worker-form-columns'
import { buildKosztorysPrintHtml } from '@/lib/kosztorys/print/build-html'
import { documentRows } from '@/lib/kosztorys/print/document-rows'
import { WIDE_PRINT_STYLES } from '@/lib/kosztorys/print/styles'
import { workerPrintColumns } from '@/lib/kosztorys/print/worker-columns'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { workerDataHiddenColumns } from '@/lib/kosztorys/worker-view/columns'
import { translateTree } from '@/lib/kosztorys/worker-view/translate-tree'
import { stageShareLabel, type WorkerSummaryT } from '@/lib/kosztorys/worker-view/summary'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'

export type WorkerPrintArgsT = {
  data: Extract<WorkerKosztorysT, { kind: 'ready' }>
  logoUrl: string
  fillByColorKey: ReadonlyMap<string, string>
  // The worker's stored language: the paper reads like the link, amounts and dates stay pl-PL.
  locale: LanguageT
  sectionTranslations: SectionTranslationMapT
}

const row = (labels: string[], values: string[], rowClass = '') =>
  `<tr${rowClass ? ` class="${rowClass}"` : ''}>` +
  labels.map((label) => `<td class="label">${escapeHtml(label)}</td>`).join('') +
  values.map((value) => `<td class="value">${escapeHtml(value)}</td>`).join('') +
  '</tr>'

const WORKER_PRINT_STYLES = `
.totals tr.head td { font-size: 6pt; color: #a1a1aa; border-bottom: 1px solid #e4e4e7; }
`

// The web page's `WorkerSummary`, on paper: the same tables in the same order and the same labels,
// so the two documents a worker may hold side by side read alike.
function workerFooterHtml(summary: WorkerSummaryT, grid: TranslatorT<'grid'>): string {
  const labels = getTranslations(grid.locale).report
  const balance = [
    row([labels.summaryExecutedTotal], [formatPLN(summary.executedNet)]),
    ...(summary.bonusNet !== 0 ? [row([labels.summaryBonus], [formatPLN(summary.bonusNet)])] : []),
    row([labels.summaryPaid], [formatPLN(summary.paidNet)]),
    row(
      [summary.isOverpaid ? labels.summaryOverpaid : labels.summaryOwed],
      [formatPLN(Math.abs(summary.owed))],
      'grand',
    ),
  ]
  const hasSharedStage = summary.executedByStage.some((stage) => stage.share)
  const executed = [
    row(
      [labels.summaryExecuted],
      hasSharedStage
        ? [labels.summaryStageValue, labels.summaryShare, labels.summaryNet]
        : [labels.summaryNet],
      'head',
    ),
    ...summary.executedByStage.map((stage) =>
      row(
        [stageLabel(stage, grid)],
        hasSharedStage
          ? [formatPLN(stage.wholeNet), stageShareLabel(stage), formatPLN(stage.net)]
          : [formatPLN(stage.net)],
      ),
    ),
    row(
      [labels.summaryTotal],
      hasSharedStage
        ? [formatPLN(summary.stagesWholeNet), '', formatPLN(summary.executedNet)]
        : [formatPLN(summary.executedNet)],
    ),
  ]
  const payouts = [
    row([labels.summaryPayouts, labels.summaryPayoutDescription], [labels.summaryNet], 'head'),
    ...summary.payouts.map((payout) =>
      row([formatPLDate(payout.date), payout.description ?? ''], [formatPLN(payout.amount)]),
    ),
    row([labels.summaryTotal, ''], [formatPLN(summary.paidNet)]),
  ]
  const table = (rows: string[]) => `<table><tbody>\n${rows.join('\n')}\n</tbody></table>`
  return `
<div class="totals">${table(executed)}${table(balance)}${summary.payouts.length ? table(payouts) : ''}</div>`
}

/**
 * The worker's PDF, built off the same projection his link renders — never the editor's rows, which
 * carry every etap and the client price. The totals are the projection's own: the grand total is the
 * summary's figure for the money column, so the paper cannot add up to one the footer contradicts.
 * On a shared etap the rows are the whole etap's, so the executed grand total is too.
 */
export function buildWorkerPrintHtml({
  data,
  logoUrl,
  fillByColorKey,
  locale,
  sectionTranslations,
}: WorkerPrintArgsT): string {
  const { worker, investmentName } = data
  const grid = createTranslator(locale, 'grid')
  const tree = translateTree(data.tree, locale, sectionTranslations)
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
      dictionary: grid,
    }).filter((column) => !dataHidden.has(column.key)),
    documentKind: createTranslator(locale, 'report').t('documentKind', { name: worker.name }),
    title: investmentName,
    pageTitle: `${investmentName} — ${worker.name}`,
    logoUrl,
    fillByColorKey,
    moneyKey,
    money: formatPLN,
    totalNet: moneyKey === 'net' ? worker.summary.stagesWholeNet : worker.summary.plannedNet,
    sectionNetById,
    extraStyles: WIDE_PRINT_STYLES + WORKER_PRINT_STYLES,
    footerHtml: workerFooterHtml(worker.summary, grid),
    lang: locale,
    totalLabel: grid.t('total'),
  })
}

const FORM_EXTRA_ROWS = 10

// `.ref` beats WIDE_PRINT_STYLES' 5.5pt cells: the number is what the scan reads back, so it stays
// legible. The written-in column must stay white for a pen, whatever stripe its index gets.
const WORKER_FORM_STYLES = `
td.ref { font-size: 7pt; color: #52525b; white-space: nowrap; }
td.write, th.write { background-color: transparent; }
col.c-ref { width: 16mm; }
col.c-write { width: 40mm; }
.extras { margin-top: 24px; break-inside: avoid; }
.extras h2 { font-size: 7pt; font-weight: 600; margin: 0 0 4px; }
.extras td { height: 7mm; border-bottom: 1px solid #a1a1aa; }
`

function workerFormFooterHtml(locale: LanguageT): string {
  const labels = getTranslations(locale).report
  const head = [labels.descriptionPlaceholder, labels.unitPlaceholder, labels.qtyPlaceholder]
    .map((label) => `<th><span>${escapeHtml(label)}</span></th>`)
    .join('')
  const blank = '<tr><td></td><td></td><td></td></tr>'.repeat(FORM_EXTRA_ROWS)
  return `
<div class="extras"><h2>${escapeHtml(labels.extrasTitle)}</h2>
<table><colgroup><col><col class="c-unit"><col class="c-write"></colgroup>
<thead><tr>${head}</tr></thead><tbody>${blank}</tbody></table></div>`
}

/**
 * The paper a worker fills in by hand: his PDF's rows with the pozycja's number in place of the money.
 * The number is the only thing the scan resolves a line by, so a pozycja without an opis — nothing a
 * worker could recognise — is left off rather than numbered.
 */
export function buildWorkerFormHtml({
  data,
  logoUrl,
  fillByColorKey,
  locale,
  sectionTranslations,
}: WorkerPrintArgsT): string {
  const { worker, investmentName } = data
  const tree = translateTree(data.tree, locale, sectionTranslations)
  const rows = documentRows(treeToRows(tree), tree.stages, worker.settings.hideEmptyRows).filter(
    (row) => (row.description ?? '').trim() !== '',
  )
  const report = createTranslator(locale, 'report')

  return buildKosztorysPrintHtml({
    rows,
    columns: workerFormColumns(locale),
    documentKind: report.t('formDocumentKind', { name: worker.name }),
    title: investmentName,
    pageTitle: `${investmentName} — ${worker.name}`,
    logoUrl,
    fillByColorKey,
    // No column carries money, so no section totals.
    moneyKey: 'net',
    money: formatPLN,
    totalNet: 0,
    sectionNetById: new Map(),
    extraStyles: WIDE_PRINT_STYLES + WORKER_FORM_STYLES,
    footerHtml: workerFormFooterHtml(locale),
    lang: locale,
  })
}
