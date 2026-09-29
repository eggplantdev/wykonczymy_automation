import { describe, expect, it } from 'vitest'
import { buildWorkerPrintHtml } from '@/lib/kosztorys/print/worker'
import { workerPrintColumns } from '@/lib/kosztorys/print/worker-columns'
import { WORKER_DOCUMENT_COLUMNS } from '@/lib/kosztorys/worker-view/columns'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { computeWorkerSummary } from '@/lib/kosztorys/worker-view/summary'
import type { WorkerViewSettingsT } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'

const WORKER = 5
const CLIENT_PRICES = [37, 23]
const OWN_RATE = 9.75
const RATE = 12.5

// The projection as the server hands it over: the worker's two etapy only. Another crew's etap on item 1
// (qty 3) survives solely in `executedQtyByItem`, which is what „Pozostało" reads.
const stages: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: 'Tynki', plane: 'w_tools', workerId: WORKER },
  { id: 102, ordinal: 3, label: null, plane: 'w_tools', workerId: WORKER },
]
const rates = { wToolsOverrideValue: RATE, ownToolsOverrideValue: OWN_RATE }
const tree = makeTree({
  sections: [
    {
      id: 10,
      name: 'Łazienka',
      displayOrder: 0,
      color: null,
      items: [
        { ...baseItem, ...rates, id: 1, description: 'Tynk', plannedQty: 5, clientPrice: 37 },
        { ...baseItem, ...rates, id: 2, description: 'Gładź', plannedQty: 4, clientPrice: 23 },
        { ...baseItem, ...rates, id: 3, description: 'Pusta', plannedQty: 0, clientPrice: 50 },
      ],
    },
  ],
  stages,
  progress: [
    { itemId: 1, stageId: 100, qtyDone: 2 },
    { itemId: 2, stageId: 102, qtyDone: 1 },
  ],
})

function projection(
  settings: Partial<WorkerViewSettingsT> = {},
  paid: number[] = [],
): Extract<WorkerKosztorysT, { kind: 'ready' }> {
  return {
    kind: 'ready',
    investmentId: 1,
    investmentName: 'Mieszkanie na Kazimierzu',
    tree,
    worker: {
      workerId: WORKER,
      name: 'Anna Nowak',
      plane: 'w_tools',
      summary: computeWorkerSummary({
        rows: treeToRows(tree),
        stages,
        plane: 'w_tools',
        workerId: WORKER,
        payoutRows: paid.map((amount, index) => ({
          workerId: WORKER,
          amount,
          date: `2026-09-0${index + 1}`,
          description: 'notatka wewnętrzna',
        })),
      }),
      settings: { hiddenColumns: [], hideEmptyRows: true, columnRanks: {}, ...settings },
      executedQtyByItem: { 1: 5, 2: 1 },
    },
  }
}

const html = (data = projection()) =>
  buildWorkerPrintHtml({ data, logoUrl: '/logo.png', fillByColorKey: new Map() })

const footerLine = (label: string, amount: number) =>
  `<td class="label">${label}</td><td class="value">${formatPLN(amount)}</td>`

describe('buildWorkerPrintHtml', () => {
  it('names the worker and the investment', () => {
    const out = html()

    expect(out).toContain('Kosztorys — Anna Nowak')
    expect(out).toContain('<title>Mieszkanie na Kazimierzu — Anna Nowak</title>')
  })

  it('prints the worker’s stawka and never the client price or the other rozliczenie’s rate', () => {
    const out = html()

    expect(out).toContain(formatPLN(RATE))
    for (const price of CLIENT_PRICES) expect(out).not.toContain(formatPLN(price))
    expect(out).not.toContain(formatPLN(OWN_RATE))
    expect(out).not.toContain('Cena j.m.')
  })

  it('totals the przedmiar and the executed work to the summary’s own figures', () => {
    const data = projection()
    const out = html(data)
    const { summary } = data.worker

    expect(summary.plannedNet).toBe((5 + 4) * RATE)
    expect(out).toContain(footerLine('Wartość przedmiaru (Twoja stawka)', summary.plannedNet))
    expect(out).toContain(footerLine('Wykonane razem', summary.executedNet))
    expect(out).toContain(`Razem — Łazienka</td><td class="num">${formatPLN(summary.plannedNet)}`)
  })

  it('prints in the owner’s stored order, the stawka under its plane-agnostic key', () => {
    const out = html(
      projection({ columnRanks: { description: 99, plannedNetForPlane: -2, rate: -1 } }),
    )
    const headers = [...out.matchAll(/<th(?:\s[^>]*)?><span>(.*?)<\/span><\/th>/g)].map((m) => m[1])

    expect(headers[0]).toBe('Opis prac')
    expect(headers[1]).toBe('Wartość przedmiaru')
    expect(headers[2]).toBe('Stawka j.m.')
  })

  it('places the section total under the money column after a reorder', () => {
    const data = projection({ columnRanks: { plannedNetForPlane: -1 } })
    const out = html(data)
    const totalRow = /<tr class="band-total">(.*?)<\/tr>/.exec(out)?.[1] ?? ''

    expect(totalRow).toContain('colspan="1"')
    expect(totalRow).toContain(
      `Razem — Łazienka</td><td class="num">${formatPLN(data.worker.summary.plannedNet)}`,
    )
  })

  it('hides an empty pozycja without moving a total', () => {
    const hidden = html(projection({ hideEmptyRows: true }))
    const shown = html(projection({ hideEmptyRows: false }))
    const totalsOf = (out: string) => out.slice(out.indexOf('Razem — '))

    expect(hidden).not.toContain('Pusta')
    expect(shown).toContain('Pusta')
    expect(totalsOf(hidden)).toBe(totalsOf(shown))
  })

  it('names an overpayment „Nadpłata” with a positive amount', () => {
    const data = projection({}, [50])
    const out = html(data)

    expect(data.worker.summary.owed).toBeLessThan(0)
    expect(out).toContain(footerLine('Nadpłata', -data.worker.summary.owed))
    expect(out).not.toContain('Pozostało do wypłaty')
  })

  it('reads „Pozostało” off every crew’s work, not only the worker’s', () => {
    // Item 1: 5 planned, 5 done across the investment (2 by this worker) — nothing owed on it.
    const out = html(projection({ hiddenColumns: ['description', 'plannedQty', 'unit'] }))
    const firstRow = out.slice(out.indexOf('<tr><td'), out.indexOf('</tr>', out.indexOf('<tr><td')))

    expect(firstRow.endsWith(`${formatPLN(0)}</td>`)).toBe(true)
  })

  it('drops a column the worker settings hide', () => {
    const out = html(projection({ hiddenColumns: ['rate'] }))

    expect(out).not.toContain('Stawka j.m.')
    expect(out).toContain('Wartość przedmiaru')
  })
})

// A key without a print mapping would vanish from the worker's paper silently — on their link, missing from the PDF.
it.each(WORKER_DOCUMENT_COLUMNS)('„%s" ma kolumnę na wydruku pracownika', (key) => {
  const columns = workerPrintColumns({
    plane: 'w_tools',
    stages,
    hiddenColumns: WORKER_DOCUMENT_COLUMNS.filter((other) => other !== key),
    columnRanks: {},
    executedQtyByItem: {},
  })
  expect(columns.length).toBeGreaterThan(0)
})
