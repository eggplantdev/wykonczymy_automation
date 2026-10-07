import { describe, expect, it } from 'vitest'

import { buildOfferPrintHtml, type OfferPrintArgsT } from '@/lib/kosztorys/print/offer'
import { offerPrintColumns, printableKeys } from '@/lib/kosztorys/print/offer-columns'
import { columnLabelForView } from '@/lib/kosztorys/columns/column-config'
import {
  CLIENT_DOCUMENT_COLUMNS,
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

// The oracle for every sum is the editor's own figure, never a hand-added column — that equality IS
// the contract this module was rewritten for: the paper prints the application's number.
//
// `view` defaults to 'client' but is a PARAMETER, because production hands `columnTotalsForRows` the
// editor's ACTIVE plane, which can be a subcontractor one. The offer is a client document either way,
// and what makes that true is `column-totals.ts` pinning `plannedNet` to 'client' internally — an
// invariant declared in another module. Fixing the oracle at 'client' would let that pin be deleted
// with this spec still green, so one case below drives it from a subcontractor plane.
function editorTotals(rows: KosztorysV2RowT[], view: PriceViewT = 'client') {
  return {
    totalNet: columnTotalsForRows(rows, CTX.stages, view, VAT_RATE).get('plannedNet') ?? 0,
    sectionNetById: new Map(
      [...groupBySection(rows)].map(([sectionId, rowsOfSection]) => [
        sectionId,
        columnTotalsForRows(rowsOfSection, CTX.stages, view, VAT_RATE).get('plannedNet') ?? 0,
      ]),
    ),
  }
}

// The offer as an owner who never opened the dialog gets it; `hiding` takes columns off that and
// `showing` puts back one the default hides.
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

// „Pozostało" prints only once an etap has an entry. A case about the money column's neighbours gets
// that entry with every settlement column hidden, so the table keeps the offer's narrow layout.
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

const zloty = (n: number) =>
  `${Math.round(n).toLocaleString('pl-PL', { maximumFractionDigits: 0, useGrouping: 'always' })} zł`

describe('buildOfferPrintHtml — dokument', () => {
  it('otwiera samodzielny dokument nazwany inwestycją', () => {
    const out = html([row()])

    expect(out.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(out).toContain('<title>Mieszkanie na Kazimierzu</title>')
  })

  it('bez pozycji drukuje sam nagłówek', () => {
    const out = html([])

    expect(out).toContain('<th><span>Opis prac</span></th>')
    expect(out).toContain('<tbody></tbody>')
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
    const { totalNet } = editorTotals(rows)

    const out = html(rows)

    expect(out).toContain(`<td class="value">${zloty(totalNet)}</td>`)
  })

  it('suma sekcji to wpis tej sekcji w mapie', () => {
    const { sectionNetById } = editorTotals(rows)

    const out = html(rows)

    expect(out).toContain(`Razem — Podłogi</td><td class="num">${zloty(sectionNetById.get(10)!)}`)
    expect(out).toContain(`Razem — Ściany</td><td class="num">${zloty(sectionNetById.get(20)!)}`)
  })

  it('sekcja bez wpisu w mapie nie dostaje wiersza sumy — zamiast zmyślonego 0 zł', () => {
    const out = html(rows, { sectionNetById: new Map([[10, 1000]]) })

    expect(out).toContain('Razem — Podłogi')
    expect(out).not.toContain('Razem — Ściany')
  })

  it('pozycja pusta na obu osiach znika przy „ukryj puste", a suma się nie rusza', () => {
    const withEmpty = [
      ...rows,
      row({ id: 4, sectionId: 20, plannedQty: undefined, clientPrice: 0 }),
    ]
    const { totalNet } = editorTotals(withEmpty)

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
    const { sectionNetById } = editorTotals(rows)

    const out = html(rows, showingRemainingOnly())

    // The label spans everything left of the money column and the cells to its right are empty, so the
    // figure lands under its own heading however many columns the offer grows.
    expect(out).toContain(
      `Razem — Podłogi</td><td class="num">${zloty(sectionNetById.get(10)!)}</td><td></td></tr>`,
    )
  })

  it('ukryta „Pozostało" nie przesuwa sumy sekcji', () => {
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 3, clientPrice: 100 }),
    ]
    const { sectionNetById } = editorTotals(rows)

    const out = html(rows, hiding('remaining'))

    expect(out).not.toContain('Pozostało')
    expect(out).toContain(
      `Razem — Podłogi</td><td class="num">${zloty(sectionNetById.get(10)!)}</td></tr>`,
    )
  })
})

// The same rule the podgląd applies (`investorEmptyColumnIds`), so paper and screen agree column
// for column.
describe('buildOfferPrintHtml — kolumny rozliczenia dopiero z wpisami', () => {
  const [stage1, stage2] = CTX.stages

  it('bez wpisów drukuje samą ofertę', () => {
    const out = html([row({ id: 1, plannedQty: 10, clientPrice: 100 })])

    for (const key of ['stageQtySum', 'net', 'donePercent']) {
      expect(out).not.toMatch(header(columnLabelForView(key, 'client')))
    }
    expect(out).not.toMatch(header(stageLabel(stage1!)))
    expect(out).toMatch(header('Opis prac'))
  })

  it('drukuje etap z wpisem i sumy, a pusty etap pomija', () => {
    const out = html([row({ id: 1, plannedQty: 10, clientPrice: 100, [stageKey(stage1!.id)]: 4 })])

    expect(out).toMatch(header(stageLabel(stage1!)))
    expect(out).toMatch(header(`${stageLabel(stage1!)} netto`))
    expect(out).not.toMatch(header(stageLabel(stage2!)))
    expect(out).not.toMatch(header(`${stageLabel(stage2!)} netto`))
    expect(out).toMatch(header(columnLabelForView('net', 'client')))
  })
})

// EX-921: before the first entry the investor gets the pure offer — no Aktualizacja przedmiaru and no
// „Pozostało", even ticked. After it the Aktualizacja joins, ticked by default; its value stays off.
describe('buildOfferPrintHtml — oferta przed pierwszym wpisem', () => {
  const ticked = showing('remaining', 'currentPlannedNet')

  it('bez wpisów drukuje Opis, Przedmiar ofertowy, j.m., Cena j.m. i Wartość netto', () => {
    const out = html([row({ id: 1, plannedQty: 10, clientPrice: 100 })], ticked)
    const headers = [...out.matchAll(/<th(?:\s[^>]*)?><span>(.*?)<\/span><\/th>/g)].map((m) => m[1])

    expect(headers).toEqual([
      'Opis prac',
      'Przedmiar ofertowy',
      'Jednostka miary',
      'Cena j.m.',
      'Wartość netto',
    ])
  })

  it('po pierwszym wpisie dokłada Aktualizację przedmiaru, a jej wartość zostawia odznaczoną', () => {
    const rows = [
      row({
        id: 1,
        plannedQty: 10,
        currentPlannedQty: 12,
        clientPrice: 100,
        [stageKey(CTX.stages[0]!.id)]: 4,
      }),
    ]
    const out = html(rows)

    expect(out).toMatch(header('Aktualizacja przedmiaru'))
    expect(out).not.toMatch(header(columnLabelForView('currentPlannedNet', 'client')))
  })

  it('zaznaczona wartość aktualizacji drukuje się po pierwszym wpisie', () => {
    const rows = [
      row({
        id: 1,
        plannedQty: 10,
        currentPlannedQty: 12,
        clientPrice: 100,
        [stageKey(CTX.stages[0]!.id)]: 4,
      }),
    ]
    const out = html(rows, ticked)

    expect(out).toMatch(header(columnLabelForView('currentPlannedNet', 'client')))
    expect(out).toContain(zloty(1200))
  })
})

describe('buildOfferPrintHtml — oferta jest dokumentem klienta', () => {
  it('drukuje sumę klienta, nawet gdy edytor stoi na płaszczyźnie podwykonawcy', () => {
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 10, clientPrice: 100 }),
    ]
    const client = editorTotals(rows)
    const fromSubcontractorPlane = editorTotals(rows, 'w_tools')

    expect(fromSubcontractorPlane.totalNet).toBe(client.totalNet)
    expect(html(rows, fromSubcontractorPlane)).toContain(zloty(client.totalNet))
  })
})

describe('buildOfferPrintHtml — struktura tabeli', () => {
  it('colspan sumy sekcji nie schodzi poniżej 1, gdy „Opis prac" jest ukryty', () => {
    const out = html([row()], hiding('description', 'plannedQty', 'unit', 'price'))

    expect(out).toContain('colspan="1"')
    expect(out).not.toContain('colspan="0"')
  })

  it('wiersz sumy sekcji mieści się w kolumnach, gdy „Wartość netto" jest pierwsza', () => {
    // Everything left of „Wartość netto" hidden: two columns remain, and the „Razem" label still has to
    // take one of them. The colspan floor and the filler count were derived from two different figures,
    // so the row carried a third cell into a two-column table and the browser grew a phantom column.
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

    const headerCells = out.match(/<th(?:\s[^>]*)?>/g) ?? []
    const totalRow = /<tr class="band-total">(.*?)<\/tr>/.exec(out)?.[1] ?? ''
    const spans = [...totalRow.matchAll(/<td[^>]*?(?:colspan="(\d+)")?[^>]*>/g)].map((m) =>
      Number(m[1] ?? 1),
    )

    expect(headerCells).toHaveLength(2)
    expect(spans.reduce((sum, span) => sum + span, 0)).toBe(2)
  })

  it('drukuje kolumny w kolejności zapisanej dla oferty, „Opis prac" zawsze pierwszy', () => {
    const out = html([row()], {
      settings: { ...DEFAULT_SETTINGS, columnRanks: { description: 99, plannedNet: -2, unit: -1 } },
    })
    const headers = [...out.matchAll(/<th(?:\s[^>]*)?><span>(.*?)<\/span><\/th>/g)].map((m) => m[1])

    expect(headers.slice(0, 3)).toEqual(['Opis prac', 'Wartość netto', 'Jednostka miary'])
  })

  it('suma sekcji idzie za kolumną wartości, gdy ta stoi tuż za „Opis prac"', () => {
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 2, clientPrice: 50 }),
    ]
    const out = html(rows, { settings: { ...DEFAULT_SETTINGS, columnRanks: { plannedNet: -1 } } })
    const headerCount = (out.match(/<th(?:\s[^>]*)?>/g) ?? []).length
    const totalRow = /<tr class="band-total">(.*?)<\/tr>/.exec(out)?.[1] ?? ''
    const spans = [...totalRow.matchAll(/<td[^>]*?(?:colspan="(\d+)")?[^>]*>/g)].map((m) =>
      Number(m[1] ?? 1),
    )

    expect(totalRow).toContain(`colspan="1"`)
    expect(totalRow).toContain(`Razem — Podłogi</td><td class="num">${zloty(100)}`)
    expect(spans.reduce((sum, span) => sum + span, 0)).toBe(headerCount)
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

  it('ukrycie kolumny w ustawieniach podglądu zabiera ją i z papieru', () => {
    const out = html([row()], hiding('price'))

    expect(out).not.toMatch(header('Cena j.m.'))
    expect(out).toContain('<th><span>Opis prac</span></th>')
  })
})

describe('sufit ujawniania', () => {
  // The one that fails when someone adds a column: the client's document may never outgrow the set
  // the client-view dialog is built from.
  it('każda kolumna dokumentu inwestora mieści się w PREVIEW_VISIBLE_COLUMNS', () => {
    for (const key of CLIENT_DOCUMENT_COLUMNS) expect(PREVIEW_VISIBLE_COLUMNS.has(key)).toBe(true)
  })

  it.each([
    ['„komentarz" właściciela', 'note'],
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
  it.each(printableKeys(CLIENT_DOCUMENT_COLUMNS, []))('„%s" ma kolumnę na wydruku', (key) => {
    const others = CLIENT_DOCUMENT_COLUMNS.filter((other) => other !== key)
    expect(offerPrintColumns(CTX.stages, others, {}).length).toBeGreaterThan(0)
  })
})

// The grid's own rule (`column-selection.ts`): while the global discount is on, the per-item rabat
// fields are bypassed, so their columns would print a rabat beside a zero kwota rabatu.
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
