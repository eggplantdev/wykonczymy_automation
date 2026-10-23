import { describe, expect, it } from 'vitest'

import { buildOfferPrintHtml, type OfferPrintArgsT } from '@/lib/kosztorys/print/offer'
import { offerPrintColumns, printableKeys, zloty } from '@/lib/kosztorys/print/offer-columns'
import { columnLabelForView } from '@/lib/kosztorys/columns/column-config'
import {
  CLIENT_DOCUMENT_COLUMNS,
  CLIENT_GROSS_TWINS,
  PREVIEW_VISIBLE_COLUMNS,
} from '@/lib/kosztorys/client-view/columns'
import { planePriceKeysFor } from '@/lib/kosztorys/plane-price-keys'
import {
  STAGE_VALUE_NET_COLUMN_GROUP,
  STAGES_COLUMN_GROUP,
  stageKey,
} from '@/lib/kosztorys/stage-keys'
import { stageLabel } from '@/lib/kosztorys/stage-label'
import { columnTotalsForRows } from '@/lib/kosztorys/columns/column-totals'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { sanitizeClientViewSettings } from '@/lib/kosztorys/client-view/settings'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'

const VAT_RATE = 0.08

// `column-totals.ts` pinning `plannedNet` to 'client' internally — an
// invariant declared in another module. Fixing the oracle at 'client' would let that pin be deleted
// with this spec still green, so one case below drives it from a subcontractor plane.
function editorTotals(rows: KosztorysV2RowT[], view: PriceViewT = 'client') {
  return {
    columnTotals: columnTotalsForRows(rows, CTX.stages, view, VAT_RATE),
    sectionColumnTotals: new Map(
      [...groupBySection(rows)].map(([sectionId, rowsOfSection]) => [
        sectionId,
        columnTotalsForRows(rowsOfSection, CTX.stages, view, VAT_RATE),
      ]),
    ),
  }
}
const netOf = (totals: ReadonlyMap<string, number> | undefined) => totals?.get('plannedNet') ?? 0

const DEFAULT_SETTINGS = sanitizeClientViewSettings({})
const hiding = (...keys: string[]) => ({
  settings: { ...DEFAULT_SETTINGS, hiddenColumns: [...DEFAULT_SETTINGS.hiddenColumns, ...keys] },
})
const showing = (...keys: string[]) => ({
  settings: {
    ...DEFAULT_SETTINGS,
    hiddenColumns: DEFAULT_SETTINGS.hiddenColumns.filter((key) => !keys.includes(key)),
  },
})

// „Pozostało" prints only once an etap has an entry.
const withEntry = (fields: Partial<KosztorysV2RowT>) =>
  row({ ...fields, [stageKey(CTX.stages[0]!.id)]: 1 })
const SETTLEMENT_KEYS = [
  STAGES_COLUMN_GROUP,
  STAGE_VALUE_NET_COLUMN_GROUP,
  'stageQtySum',
  'net',
  'donePercent',
  'currentPlannedQty',
]
const showingRemainingOnly = () => ({
  settings: {
    ...DEFAULT_SETTINGS,
    hiddenColumns: [
      ...DEFAULT_SETTINGS.hiddenColumns.filter((key) => key !== 'remaining'),
      ...SETTLEMENT_KEYS,
    ],
  },
})

function html(rows: KosztorysV2RowT[], overrides: Partial<OfferPrintArgsT> = {}): string {
  return buildOfferPrintHtml({
    rows,
    stages: CTX.stages,
    settings: DEFAULT_SETTINGS,
    investmentName: 'Mieszkanie na Kazimierzu',
    logoUrl: '/logo-wykonczymy.png',
    fillByColorKey: new Map([['blue', 'rgb(0, 0, 255)']]),
    ...editorTotals(rows),
    ...overrides,
  })
}

const header = (label: string) =>
  new RegExp(`<th[^>]*><span>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span></th>`)

const headersOf = (out: string) =>
  [...out.matchAll(/<th(?:\s[^>]*)?><span>(.*?)<\/span><\/th>/g)].map((m) => m[1])

const bandTotalSpans = (out: string) => {
  const totalRow = /<tr class="band-total">(.*?)<\/tr>/.exec(out)?.[1] ?? ''
  const spans = [...totalRow.matchAll(/<td([^>]*)>/g)].map((m) =>
    Number(/colspan="(\d+)"/.exec(m[1])?.[1] ?? 1),
  )
  return { totalRow, spanSum: spans.reduce((sum, span) => sum + span, 0) }
}

describe('buildOfferPrintHtml — dokument', () => {
  it('grupuje tysiące także w czterocyfrowej kwocie', () => {
    expect(zloty(1500)).toBe('1\u00a0500 zł')
  })

  it('otwiera samodzielny dokument nazwany inwestycją', () => {
    const out = html([row()])

    expect(out.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(out).toContain('<title>Mieszkanie na Kazimierzu</title>')
  })

  it('bez pozycji drukuje sam nagłówek', () => {
    const out = html([])

    expect(out).toContain('<th><span>Opis prac</span></th>')
    expect(out).toContain('<td class="sheet-cell"></td>')
  })

  it('escapuje wolny tekst i nazwę inwestycji, więc żaden nie otwiera znacznika', () => {
    const out = html([row({ description: '<script>a & b</script>' })], {
      investmentName: 'Dom <b>',
    })

    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;script&gt;a &amp; b&lt;/script&gt;')
    expect(out).toContain('<title>Dom &lt;b&gt;</title>')
  })

  it('otwiera pasmo raz na sekcję, w kolejności wierszy', () => {
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Podłogi' }),
      row({ id: 2, sectionId: 10, sectionName: 'Podłogi' }),
      row({ id: 3, sectionId: 20, sectionName: 'Ściany' }),
    ]

    const out = html(rows)

    expect(out.match(/class="band-name"/g)).toHaveLength(2)
    expect(out.indexOf('>Podłogi<')).toBeLessThan(out.indexOf('>Ściany<'))
  })
})

describe('buildOfferPrintHtml — sumy przychodzą z edytora', () => {
  const rows = [
    row({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 95, clientPrice: 100 }),
    row({ id: 2, sectionId: 10, sectionName: 'Podłogi', plannedQty: 12, clientPrice: 250 }),
    row({ id: 3, sectionId: 20, sectionName: 'Ściany', plannedQty: 40, clientPrice: 33.33 }),
  ]

  it('„Razem netto" to figura edytora, nie suma zaokrąglonych wierszy', () => {
    const totalNet = netOf(editorTotals(rows).columnTotals)

    const out = html(rows)

    expect(out).toContain(`<td class="value">${zloty(totalNet)}</td>`)
  })

  it('suma sekcji to wpis tej sekcji w mapie', () => {
    const { sectionColumnTotals } = editorTotals(rows)

    const out = html(rows)

    expect(out).toContain(
      `Razem — Podłogi</td><td class="num">${zloty(netOf(sectionColumnTotals.get(10)))}`,
    )
    expect(out).toContain(
      `Razem — Ściany</td><td class="num">${zloty(netOf(sectionColumnTotals.get(20)))}`,
    )
  })

  it('sekcja bez wpisu w mapie nie dostaje wiersza sumy — zamiast zmyślonego 0 zł', () => {
    const out = html(rows, {
      sectionColumnTotals: new Map([[10, new Map([['plannedNet', 1000]])]]),
    })

    expect(out).toContain('Razem — Podłogi')
    expect(out).not.toContain('Razem — Ściany')
  })

  it('pozycja pusta na obu osiach znika przy „ukryj puste", a suma się nie rusza', () => {
    const withEmpty = [
      ...rows,
      row({ id: 4, sectionId: 20, plannedQty: undefined, clientPrice: 0 }),
    ]
    const totalNet = netOf(editorTotals(withEmpty).columnTotals)

    const out = html(withEmpty)

    expect(out.match(/<tr><td/g)).toHaveLength(3)
    expect(out).toContain(`<td class="value">${zloty(totalNet)}</td>`)
  })

  it('ukryta „Wartość netto" zabiera wszystkie sumy, a nie przenosi ich do stopki', () => {
    const out = html(rows, hiding('plannedNet'))

    expect(out).not.toContain('Razem netto')
    expect(out).not.toContain('<tr class="band-total">')
  })
})

describe('buildOfferPrintHtml — papier pokazuje to, co ekran', () => {
  it('drukuje „Pozostało", gdy właściciel ją pokazuje', () => {
    const only = row({ id: 1, plannedQty: 10, clientPrice: 100, [stageKey(CTX.stages[0]!.id)]: 4 })

    const out = html([only], showing('remaining'))

    expect(out).toMatch(header('Pozostało'))
    expect(out).toContain(zloty(600))
  })

  it('suma sekcji stoi pod „Wartość netto", nie pod kolumną obok', () => {
    const rows = [
      withEntry({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 3, clientPrice: 100 }),
    ]
    const { sectionColumnTotals } = editorTotals(rows)

    const out = html(rows, showingRemainingOnly())

    expect(out).toContain(
      `Razem — Podłogi</td><td class="num">${zloty(netOf(sectionColumnTotals.get(10)))}</td><td></td></tr>`,
    )
  })

  it('ukryta „Pozostało" nie przesuwa sumy sekcji', () => {
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 3, clientPrice: 100 }),
    ]
    const { sectionColumnTotals } = editorTotals(rows)

    const out = html(rows, hiding('remaining'))

    expect(out).not.toContain('Pozostało')
    expect(out).toContain(
      `Razem — Podłogi</td><td class="num">${zloty(netOf(sectionColumnTotals.get(10)))}</td></tr>`,
    )
  })
})

describe('buildOfferPrintHtml — kolumny rozliczenia dopiero z wpisami', () => {
  const [stage1, stage2] = CTX.stages

  it('drukuje etap z wpisem i sumy, a pusty etap pomija', () => {
    const out = html([row({ id: 1, plannedQty: 10, clientPrice: 100, [stageKey(stage1!.id)]: 4 })])

    expect(out).toMatch(header(stageLabel(stage1!)))
    expect(out).toMatch(header(`${stageLabel(stage1!)} netto`))
    expect(out).not.toMatch(header(stageLabel(stage2!)))
    expect(out).not.toMatch(header(`${stageLabel(stage2!)} netto`))
    expect(out).toMatch(header(columnLabelForView('net', 'client')))
  })

  // Pomiar 4 against ofertowy 10 and Aktualizacja 12: the two percentages differ, so a column that
  // printed the neighbour's figure under its own header would fail here.
  it('drukuje zaznaczony % wykonania względem przedmiaru ofertowego obok istniejącego', () => {
    const percentRow = row({
      id: 1,
      plannedQty: 10,
      currentPlannedQty: 12,
      clientPrice: 100,
      [stageKey(stage1!.id)]: 4,
    })
    const label = columnLabelForView('plannedDonePercent', 'client')

    expect(html([percentRow])).not.toMatch(header(label))
    const out = html([percentRow], showing('plannedDonePercent'))
    expect(out).toMatch(header(label))
    expect(out).toMatch(/>40%<\/td>/)
    expect(out).toMatch(/>33,3%<\/td>/)
  })
})

describe('buildOfferPrintHtml — oferta przed pierwszym wpisem', () => {
  const ticked = showing('remaining', 'currentPlannedNet')
  const updatedRows = [
    row({
      id: 1,
      plannedQty: 10,
      currentPlannedQty: 12,
      clientPrice: 100,
      [stageKey(CTX.stages[0]!.id)]: 4,
    }),
  ]

  it('bez wpisów drukuje Opis, Przedmiar ofertowy, j.m., Cena j.m. i Wartość netto', () => {
    const out = html([row({ id: 1, plannedQty: 10, clientPrice: 100 })], ticked)

    expect(headersOf(out)).toEqual([
      'Opis prac',
      'Przedmiar ofertowy',
      'Jednostka miary',
      'Cena j.m.',
      'Wartość netto',
    ])
  })

  it('po pierwszym wpisie dokłada Aktualizację przedmiaru, a jej wartość zostawia odznaczoną', () => {
    const out = html(updatedRows)

    expect(out).toMatch(header('Aktualizacja przedmiaru'))
    expect(out).not.toMatch(header(columnLabelForView('currentPlannedNet', 'client')))
  })

  it('zaznaczona wartość aktualizacji drukuje się po pierwszym wpisie', () => {
    const out = html(updatedRows, ticked)

    expect(out).toMatch(header(columnLabelForView('currentPlannedNet', 'client')))
    expect(out).toContain(zloty(1200))
  })
})

describe('buildOfferPrintHtml — oferta jest dokumentem klienta', () => {
  it('drukuje sumę klienta, nawet gdy edytor stoi na płaszczyźnie podwykonawcy', () => {
    const rows = [
      row({
        id: 1,
        sectionId: 10,
        sectionName: 'Podłogi',
        plannedQty: 10,
        clientPrice: 100,
        discountType: 'percent',
        discountValue: 5,
      }),
    ]
    const client = editorTotals(rows)
    const fromSubcontractorPlane = editorTotals(rows, 'w_tools')

    const clientNet = netOf(client.columnTotals)

    expect(netOf(fromSubcontractorPlane.columnTotals)).toBe(clientNet)
    expect(fromSubcontractorPlane.columnTotals.get('plannedDiscountAmount')).toBe(50)
    expect(html(rows, fromSubcontractorPlane)).toContain(zloty(clientNet))
  })
})

describe('buildOfferPrintHtml — struktura tabeli', () => {
  it('colspan sumy sekcji nie schodzi poniżej 1, gdy „Opis prac" jest ukryty', () => {
    const out = html([row()], hiding('description', 'plannedQty', 'unit', 'price'))

    expect(out).toContain('colspan="1"')
    expect(out).not.toContain('colspan="0"')
  })

  it('wiersz sumy sekcji mieści się w kolumnach, gdy „Wartość netto" jest pierwsza', () => {
    const rows = [
      withEntry({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 2, clientPrice: 50 }),
    ]
    const { settings } = showingRemainingOnly()
    const out = html(rows, {
      settings: {
        ...settings,
        hiddenColumns: [...settings.hiddenColumns, 'description', 'plannedQty', 'unit', 'price'],
      },
    })

    expect(out.match(/<th(?:\s[^>]*)?>/g) ?? []).toHaveLength(2)
    expect(bandTotalSpans(out).spanSum).toBe(2)
  })

  it('drukuje kolumny w kolejności zapisanej dla oferty, „Opis prac" zawsze pierwszy', () => {
    const out = html([row()], {
      settings: { ...DEFAULT_SETTINGS, columnRanks: { description: 99, plannedNet: -2, unit: -1 } },
    })

    expect(headersOf(out).slice(0, 3)).toEqual(['Opis prac', 'Wartość netto', 'Jednostka miary'])
  })

  it('suma sekcji idzie za kolumną wartości, gdy ta stoi tuż za „Opis prac"', () => {
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 2, clientPrice: 50 }),
    ]
    const out = html(rows, { settings: { ...DEFAULT_SETTINGS, columnRanks: { plannedNet: -1 } } })
    const { totalRow, spanSum } = bandTotalSpans(out)

    expect(totalRow).toContain(`colspan="1"`)
    expect(totalRow).toContain(`Razem — Podłogi</td><td class="num">${zloty(100)}`)
    expect(spanSum).toBe((out.match(/<th(?:\s[^>]*)?>/g) ?? []).length)
  })

  it('escapuje kolor sekcji i adres logo, więc żaden nie zamyka atrybutu', () => {
    const out = html([row({ sectionColor: 'blue' })], {
      fillByColorKey: new Map([['blue', 'rgb(0,0,255)" onload="alert(1)']]),
      logoUrl: '/logo.png" onerror="alert(1)',
    })

    expect(out).not.toContain('onerror="alert(1)"')
    expect(out).not.toContain('onload="alert(1)"')
    expect(out).toContain('&quot;')
  })
})

describe('sufit ujawniania', () => {
  const GROSS_KEYS = Object.values(CLIENT_GROSS_TWINS)

  it('każda kolumna dokumentu inwestora mieści się w PREVIEW_VISIBLE_COLUMNS', () => {
    for (const key of CLIENT_DOCUMENT_COLUMNS) expect(PREVIEW_VISIBLE_COLUMNS.has(key)).toBe(true)
  })

  it.each([
    ['AI przedmiar', 'aiPlannedQty'],
    ['stawka podwykonawcy', planePriceKeysFor('w_tools')[0]],
  ])('%s nie przechodzi, nawet wpisana wprost do listy', (_label, key) => {
    expect(printableKeys([key], [])).toEqual([])
  })

  it('kolumna z sufitu przechodzi, dopóki właściciel jej nie ukryje', () => {
    expect(printableKeys(['price'], [])).toEqual(['price'])
    expect(printableKeys(['price'], ['price'])).toEqual([])
  })

  // A key without a print mapping would vanish from the paper silently — shown on the screen, missing
  // from the PDF.
  it.each(printableKeys(CLIENT_DOCUMENT_COLUMNS, GROSS_KEYS))(
    '„%s" ma kolumnę na wydruku',
    (key) => {
      const others = CLIENT_DOCUMENT_COLUMNS.filter((other) => other !== key)
      expect(offerPrintColumns(CTX.stages, others, {}, false).length).toBeGreaterThan(0)
    },
  )

  it('zaznaczone kolumny brutto nie trafiają na wydruk — PDF jest netto', () => {
    const allButGross = CLIENT_DOCUMENT_COLUMNS.filter((key) => !GROSS_KEYS.includes(key))
    expect(offerPrintColumns(CTX.stages, allButGross, {}, false)).toEqual([])
  })
})

describe('rabat globalny', () => {
  const discountRow = (globalDiscountActive: boolean) =>
    row({ discountType: 'percent', discountValue: 10, globalDiscountActive })
  const header = `>${columnLabelForView('discountValue', 'client')}</span></th>`

  it('chowa kolumny rabatu pozycji, gdy rabat globalny jest aktywny', () => {
    expect(html([discountRow(true)], showing('discountValue'))).not.toContain(header)
  })

  it('drukuje je bez rabatu globalnego', () => {
    expect(html([discountRow(false)], showing('discountValue'))).toContain(header)
  })
})

describe('rabat kwota na przedmiarze', () => {
  const discounted = row({
    id: 1,
    plannedQty: 30,
    clientPrice: 45,
    discountType: 'percent',
    discountValue: 5,
  })
  const plain = row({ id: 1, plannedQty: 30, clientPrice: 45 })
  const amountHeader = header('Rabat kwota netto (przedmiar)')

  it('drukuje zaznaczoną kwotę rabatu i „Wartość netto — po rabacie"', () => {
    const out = html([discounted], showing('plannedDiscountAmount'))

    expect(out).toMatch(amountHeader)
    expect(out).toContain(`>${zloty(67.5)}</td>`) // 30 × 45 − 1282,50
    expect(out).toMatch(header('Wartość netto — po rabacie'))
  })

  it('bez rabatu nie drukuje ani kolumny, ani dopisku', () => {
    const out = html([plain], showing('plannedDiscountAmount'))

    expect(out).not.toMatch(amountHeader)
    expect(out).toMatch(header('Wartość netto'))
    expect(out).not.toContain('po rabacie')
  })

  it('na domyślnych ustawieniach kolumna jest ukryta', () => {
    expect(html([discounted])).not.toMatch(amountHeader)
  })

  it('rabat globalny zabiera kolumnę i dopisek', () => {
    const global = { ...discounted, globalDiscountActive: true }
    const out = html([global], showing('plannedDiscountAmount'))

    expect(out).not.toMatch(amountHeader)
    expect(out).not.toContain('po rabacie')
    expect(out).not.toContain('W tym rabat')
  })

  it('suma sekcji stoi też pod kwotą rabatu, a stopka dopisuje „W tym rabat"', () => {
    const out = html([discounted], showing('plannedDiscountAmount'))

    expect(out).toContain(
      `<td class="num">${zloty(1282.5)}</td><td class="num">${zloty(67.5)}</td>`,
    )
    expect(out).toContain(`<td class="label">W tym rabat</td><td class="value">${zloty(67.5)}</td>`)
  })

  it('ukryta kolumna rabatu nie zostawia „W tym rabat" w stopce', () => {
    const out = html([discounted])

    expect(out).toContain('Razem netto')
    expect(out).not.toContain('W tym rabat')
  })

  it('ukryta „Wartość netto" zabiera też sumy rabatu', () => {
    const out = html([discounted], {
      settings: {
        ...showing('plannedDiscountAmount').settings,
        hiddenColumns: [...showing('plannedDiscountAmount').settings.hiddenColumns, 'plannedNet'],
      },
    })

    expect(out).toMatch(amountHeader)
    expect(out).not.toContain('<tr class="band-total">')
    expect(out).not.toContain('W tym rabat')
  })
})
