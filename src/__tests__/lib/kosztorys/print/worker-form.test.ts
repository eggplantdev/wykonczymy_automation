import { describe, expect, it } from 'vitest'
import { buildWorkerFormHtml } from '@/lib/kosztorys/print/worker'
import { treeToRows } from '@/lib/kosztorys/v2-rows'
import { computeWorkerSummary } from '@/lib/kosztorys/worker-view/summary'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import { formatFormRef } from '@/lib/kosztorys/worker-report/check-digit'
import { getTranslations } from '@/lib/i18n/translations'
import type { LanguageT } from '@/lib/i18n/languages'
import { baseItem, makeTree } from '@/__tests__/helpers/kosztorys-tree'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'

const WORKER = 5
const stages: KosztorysStageT[] = [
  { id: 100, ordinal: 1, label: 'Tynki', plane: 'w_tools', split: oneWorkerSplit(WORKER) },
]
const rates = { wToolsOverrideValue: 12.5, ownToolsOverrideValue: 9.75 }
const tree = makeTree({
  sections: [
    {
      id: 10,
      name: 'Łazienka',
      displayOrder: 0,
      color: null,
      items: [
        {
          ...baseItem,
          ...rates,
          id: 1,
          ref: 35812,
          description: 'Tynk',
          unit: 'm2',
          plannedQty: 5,
          clientPrice: 37,
        },
        {
          ...baseItem,
          ...rates,
          id: 2,
          ref: 40071,
          description: 'Gładź',
          unit: 'm2',
          plannedQty: 4,
          clientPrice: 23,
        },
        {
          ...baseItem,
          ...rates,
          id: 3,
          ref: 40072,
          description: 'Pusta',
          plannedQty: 0,
          clientPrice: 50,
        },
        {
          ...baseItem,
          ...rates,
          id: 4,
          ref: 40073,
          description: '  ',
          plannedQty: 2,
          clientPrice: 50,
        },
      ],
    },
  ],
  stages,
  progress: [{ itemId: 1, stageId: 100, qtyDone: 2 }],
})

const projection: Extract<WorkerKosztorysT, { kind: 'ready' }> = {
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
      payoutRows: [],
    }),
    settings: {
      hiddenColumns: [],
      hideEmptyRows: true,
      hidePlannedOnceExecuted: true,
      columnRanks: {},
    },
    executedQtyByItem: { 1: 2 },
  },
}

const html = (locale: LanguageT = 'pl') =>
  buildWorkerFormHtml({
    data: projection,
    logoUrl: '/logo.png',
    fillByColorKey: new Map(),
    locale,
    sectionTranslations: {},
  })

describe('buildWorkerFormHtml', () => {
  it('numbers every listed pozycja with its check digit and prints no money', () => {
    const out = html()

    expect(out).toContain(formatFormRef(35812))
    expect(out).toContain(formatFormRef(40071))
    expect(out).toContain('Do wypełnienia — Anna Nowak')
    expect(out.slice(out.indexOf('<body>'))).not.toMatch(/\d zł/)
    expect(out).not.toContain('Tynki')
  })

  it('leaves off a pozycja the empty-rows rule hides and one with no opis', () => {
    const out = html()

    expect(out).not.toContain('Pusta')
    expect(out).not.toContain(formatFormRef(40072))
    expect(out).not.toContain(formatFormRef(40073))
  })

  it('prints the link’s report columns in its order, with his figures beside the blank one', () => {
    const out = html()
    const headers = [...out.matchAll(/<th[^>]*><span>([^<]*)<\/span><\/th>/g)].map((m) => m[1])

    expect(headers.slice(0, 6)).toEqual([
      'Nr',
      'Opis prac',
      'Wykonano do tej pory (razem etapy)',
      'Zgłaszam',
      'Postęp (wykonano / przedmiar)',
      'Jednostka miary',
    ])
    expect(out).toMatch(/Tynk[\s\S]*?>2<\/td>[\s\S]*?>2 \/ 5<\/td>/)
    expect(out).toMatch(/Gładź[\s\S]*?>0<\/td>[\s\S]*?>0 \/ 4<\/td>/)
  })

  it('ends with blank rows for prace spoza rozpiski', () => {
    const out = html()
    const extras = out.slice(out.indexOf('Prace spoza rozpiski'))

    expect(extras.match(/<tr><td><\/td><td><\/td><td><\/td><\/tr>/g)).toHaveLength(10)
  })

  it('reads in the worker’s language', () => {
    const out = html('uk')
    const { report } = getTranslations('uk')

    expect(out).toContain('Для заповнення — Anna Nowak')
    expect(out).toContain(`<span>${report.reportColumn}</span>`)
    expect(out).toContain(report.extrasTitle)
    expect(out).toContain('<html lang="uk">')
  })
})
