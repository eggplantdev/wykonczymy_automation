import { describe, expect, it } from 'vitest'
import { buildWorkerPrintHtml } from '@/lib/kosztorys/print/worker'
import { workerPrintColumns } from '@/lib/kosztorys/print/worker-columns'
import { WORKER_DOCUMENT_COLUMNS } from '@/lib/kosztorys/worker-view/columns'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { computeWorkerSummary } from '@/lib/kosztorys/worker-view/summary'
import type { WorkerViewSettingsT } from '@/lib/kosztorys/worker-view/settings'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { formatPLN } from '@/lib/utils/format-currency'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'

const WORKER = 5
const CLIENT_PRICES = [37, 23]
const OWN_RATE = 9.75
const RATE = 12.5

// The projection as the server hands it over: the worker's two etapy only. Another crew's etap on item 1
// (qty 3) survives solely in `executedQtyByItem`, which is what „Pozostało" reads.
const stages: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: 'Tynki', plane: 'w_tools', split: oneWorkerSplit(WORKER) },
  { id: 102, ordinal: 3, label: null, plane: 'w_tools', split: oneWorkerSplit(WORKER) },
]
const rates = { wToolsOverrideValue: RATE, ownToolsOverrideValue: OWN_RATE }
const treeWith = (progress: { itemId: number; stageId: number; qtyDone: number }[]) =>
  makeTree({
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
    progress,
  })
const tree = treeWith([
  { itemId: 1, stageId: 100, qtyDone: 2 },
  { itemId: 2, stageId: 102, qtyDone: 1 },
])

function projection(
  settings: Partial<WorkerViewSettingsT> = {},
  paid: number[] = [],
  sourceTree = tree,
): Extract<WorkerKosztorysT, { kind: 'ready' }> {
  return {
    kind: 'ready',
    investmentId: 1,
    investmentName: 'Mieszkanie na Kazimierzu',
    tree: sourceTree,
    worker: {
      workerId: WORKER,
      name: 'Anna Nowak',
      plane: 'w_tools',
      summary: computeWorkerSummary({
        rows: treeToRows(sourceTree),
        stages,
        plane: 'w_tools',
        workerId: WORKER,
        payoutRows: paid.map((amount, index) => ({
          workerId: WORKER,
          amount,
          date: `2026-09-0${index + 1}`,
          description: 'ZUS lipiec',
        })),
      }),
      settings: {
        hiddenColumns: [],
        hideEmptyRows: true,
        hidePlannedOnceExecuted: true,
        columnRanks: {},
        ...settings,
      },
      executedQtyByItem: { 1: 5, 2: 1 },
    },
  }
}

const html = (data = projection()) =>
  buildWorkerPrintHtml({ data, logoUrl: '/logo.png', fillByColorKey: new Map() })

const headersOf = (out: string) =>
  [...out.matchAll(/<th(?:\s[^>]*)?><span>(.*?)<\/span><\/th>/g)].map((m) => m[1])

const sectionTotal = (amount: number) => `Razem — Łazienka</td><td class="num">${formatPLN(amount)}`

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

  it('totals the table to the przedmiar, the footer to the executed work alone', () => {
    const data = projection({ hidePlannedOnceExecuted: false })
    const out = html(data)
    const { summary } = data.worker

    expect(summary.plannedNet).toBe((5 + 4) * RATE)
    expect(out).not.toContain('Twoja stawka)')
    expect(out).toContain(footerLine('Wykonane razem', summary.executedNet))
    expect(out).toContain(sectionTotal(summary.plannedNet))
  })

  // Sharing etap 100 (2 × 12,5 = 25 zł) 40/60 with worker 9: the rows stay the whole etap's, so the
  // section and grand totals do too, and the footer's etap table carries his share beside the whole.
  it('totals a shared etap whole and prints his share beside it in the etap table', () => {
    const sharedStages: KosztorysStageT[] = [
      {
        ...stages[0],
        split: {
          mode: 'percent',
          members: [
            { workerId: WORKER, value: 40, takesRest: false },
            { workerId: 9, value: 0, takesRest: true },
          ],
        },
      },
      stages[1],
    ]
    const sharedTree = { ...tree, stages: sharedStages }
    const data = projection({}, [], sharedTree)
    data.worker.summary = computeWorkerSummary({
      rows: treeToRows(sharedTree),
      stages: sharedStages,
      plane: 'w_tools',
      workerId: WORKER,
      payoutRows: [],
    })
    const out = html(data)
    const whole = 2 * RATE + 1 * RATE

    expect(out).toContain(sectionTotal(whole))
    const { summary } = data.worker
    const values = (...cells: string[]) =>
      cells.map((cell) => `<td class="value">${cell}</td>`).join('')

    expect(out).toContain(
      `<td class="label">Tynki</td>${values(formatPLN(2 * RATE), '40,0%', formatPLN(0.4 * 2 * RATE))}`,
    )
    expect(out).toContain(
      `<td class="label">Razem</td>${values(formatPLN(whole), '', formatPLN(summary.executedNet))}`,
    )
    expect(out).toContain(footerLine('Wykonane razem', summary.executedNet))
    expect(summary.executedNet).toBe(0.4 * 2 * RATE + RATE)
    expect(out.indexOf('>Wykonane<')).toBeLessThan(out.indexOf('Wykonane razem'))
  })

  it('prints in the owner’s stored order, the stawka under its plane-agnostic key', () => {
    const out = html(
      projection({
        hidePlannedOnceExecuted: false,
        columnRanks: { description: 99, plannedNetForPlane: -2, rate: -1 },
      }),
    )
    const headers = headersOf(out)

    expect(headers[0]).toBe('Opis prac')
    expect(headers[1]).toBe('Wartość przedmiaru')
    expect(headers[2]).toBe('Stawka j.m.')
  })

  it('places the section total under the money column after a reorder', () => {
    const data = projection({
      hidePlannedOnceExecuted: false,
      columnRanks: { plannedNetForPlane: -1 },
    })
    const out = html(data)
    const totalRow = /<tr class="band-total">(.*?)<\/tr>/.exec(out)?.[1] ?? ''

    expect(totalRow).toContain('colspan="1"')
    expect(totalRow).toContain(sectionTotal(data.worker.summary.plannedNet))
  })

  it('hides an empty pozycja without moving a total', () => {
    const hidden = html(projection({ hideEmptyRows: true }))
    const shown = html(projection({ hideEmptyRows: false }))
    const totalsOf = (out: string) => out.slice(out.indexOf('Razem — '))

    expect(hidden).not.toContain('Pusta')
    expect(shown).toContain('Pusta')
    expect(totalsOf(hidden)).toBe(totalsOf(shown))
  })

  it('prints the payouts in a table of their own, after the balance', () => {
    const out = html(projection({}, [50]))
    const payoutRow = `<td class="label">01.09.2026</td><td class="label">ZUS lipiec</td><td class="value">${formatPLN(50)}</td>`

    expect(out).toContain(payoutRow)
    expect(out).toContain(
      `<td class="label">Razem</td><td class="label"></td><td class="value">${formatPLN(50)}</td>`,
    )
    expect(out.indexOf('</table>', out.indexOf('Wypłacone'))).toBeLessThan(out.indexOf(payoutRow))
  })

  it('prints no payouts table when nothing was paid', () => {
    expect(html(projection({}, []))).not.toContain('>Wypłaty<')
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
    const out = html(projection({ hiddenColumns: ['rate'], hidePlannedOnceExecuted: false }))

    expect(out).not.toContain('Stawka j.m.')
    expect(out).toContain('Wartość przedmiaru')
  })

  describe('columns the data takes off — the same rule the link renders by', () => {
    const [tynki, second] = stages.map((each) => stageLabel(each))

    it('prints the offer shape before any entry in his etapy, whatever the checkbox says', () => {
      for (const hidePlannedOnceExecuted of [true, false]) {
        const headers = headersOf(html(projection({ hidePlannedOnceExecuted }, [], treeWith([]))))

        expect(headers).toContain('Przedmiar')
        expect(headers).toContain('Wartość przedmiaru')
        for (const gone of ['Pomiar (razem etapy)', 'Wartość wykonana netto', tynki, second]) {
          expect(headers, gone).not.toContain(gone)
        }
      }
    })

    it('once his etapy carry entries, drops the przedmiar pair and every empty etap', () => {
      const data = projection({}, [], treeWith([{ itemId: 1, stageId: 100, qtyDone: 2 }]))
      const out = html(data)
      const headers = headersOf(out)

      expect(headers).not.toContain('Przedmiar')
      expect(headers).not.toContain('Wartość przedmiaru')
      expect(headers).toContain(tynki)
      expect(headers).toContain('Pomiar (razem etapy)')
      expect(headers).toContain('Wartość wykonana netto')
      expect(headers).not.toContain(second)
      expect(headers).not.toContain(`${second} netto`)
      expect(out).toContain(sectionTotal(data.worker.summary.executedNet))
    })

    it('keeps the przedmiar pair beside the settlement columns with the checkbox off', () => {
      const headers = headersOf(html(projection({ hidePlannedOnceExecuted: false })))

      expect(headers).toContain('Przedmiar')
      expect(headers).toContain('Wartość przedmiaru')
      expect(headers).toContain('Wartość wykonana netto')
    })
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
