import { describe, expect, it } from 'vitest'

import {
  buildOfferPrintHtml,
  OFFER_COLUMN_KEYS,
  printableOfferColumns,
  type OfferColumnT,
  type OfferPrintArgsT,
} from '@/lib/kosztorys/build-offer-print-html'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'
import { planePriceKeysFor } from '@/lib/kosztorys/plane-price-keys'
import { columnTotalsForRows } from '@/lib/kosztorys/column-totals'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { rowRemainingForView } from '@/lib/kosztorys/settlement-rows'
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

function html(rows: KosztorysV2RowT[], overrides: Partial<OfferPrintArgsT> = {}): string {
  return buildOfferPrintHtml({
    rows,
    stages: CTX.stages,
    settings: { hiddenColumns: [], hideEmptyRows: true },
    investmentName: 'Mieszkanie na Kazimierzu',
    logoUrl: '/logo-wykonczymy.png',
    fillByColorKey: new Map([['blue', 'rgb(0, 0, 255)']]),
    ...editorTotals(rows),
    ...overrides,
  })
}

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

    expect(out).toContain('<th>Opis prac</th>')
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
    const out = html(rows, { settings: { hiddenColumns: ['plannedNet'], hideEmptyRows: true } })

    expect(out).not.toContain('Razem netto')
    expect(out).not.toContain('<tr class="band-total">')
  })
})

describe('buildOfferPrintHtml — papier pokazuje to, co ekran', () => {
  it('drukuje „Pozostało" — kolumnę, którą podgląd oferty pokazuje', () => {
    const only = row({ id: 1, plannedQty: 10, clientPrice: 100 })

    const out = html([only])

    expect(out).toContain('<th class="num">Pozostało</th>')
    expect(out).toContain(zloty(rowRemainingForView(only, CTX.stages, 'client')))
  })

  it('suma sekcji stoi pod „Wartość netto", nie pod kolumną obok', () => {
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 3, clientPrice: 100 }),
    ]
    const { sectionNetById } = editorTotals(rows)

    const out = html(rows)

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

    const out = html(rows, { settings: { hiddenColumns: ['remaining'], hideEmptyRows: true } })

    expect(out).not.toContain('Pozostało')
    expect(out).toContain(
      `Razem — Podłogi</td><td class="num">${zloty(sectionNetById.get(10)!)}</td></tr>`,
    )
  })
})

describe('buildOfferPrintHtml — oferta jest dokumentem klienta', () => {
  it('drukuje sumę klienta, nawet gdy edytor stoi na płaszczyźnie podwykonawcy', () => {
    // Produkcja podaje wyrocznię AKTYWNĄ płaszczyznę edytora. „Razem netto" na papierze ma i tak być
    // figurą klienta — trzyma to przypięcie `plannedNet` do 'client' w `column-totals.ts`.
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
    const out = html([row()], {
      settings: {
        hiddenColumns: ['description', 'plannedQty', 'unit', 'price'],
        hideEmptyRows: true,
      },
    })

    expect(out).toContain('colspan="1"')
    expect(out).not.toContain('colspan="0"')
  })

  it('wiersz sumy sekcji mieści się w kolumnach, gdy „Wartość netto" jest pierwsza', () => {
    // Wszystko na lewo od „Wartość netto" ukryte: zostają dwie kolumny, a etykieta „Razem" i tak
    // musi zająć jedną. Podłoga colspanu i licznik wypełniaczy liczyły z dwóch różnych wartości, więc
    // wiersz niósł trzecią komórkę na dwukolumnową tabelę — przeglądarka doszywała widmową kolumnę.
    const rows = [
      row({ id: 1, sectionId: 10, sectionName: 'Podłogi', plannedQty: 2, clientPrice: 50 }),
    ]
    const out = html(rows, {
      settings: {
        hiddenColumns: ['description', 'plannedQty', 'unit', 'price'],
        hideEmptyRows: true,
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
    const out = html([row()], { settings: { hiddenColumns: ['price'], hideEmptyRows: true } })

    expect(out).not.toContain('<th class="num">Cena j.m.</th>')
    expect(out).toContain('<th>Opis prac</th>')
  })
})

describe('sufit ujawniania', () => {
  const barred: OfferColumnT = {
    key: 'note',
    label: 'Komentarz',
    colClass: '',
    cellClass: '',
    headerClass: '',
    cell: (row) => String(row.note ?? ''),
  }
  const subcontractorRate: OfferColumnT = {
    ...barred,
    key: planePriceKeysFor('w_tools')[0],
    label: 'Stawka wykonawcy',
  }

  // The one that fails when someone adds a column: the offer's own list may never outgrow the set the
  // client-view dialog is built from.
  it('każda kolumna oferty mieści się w PREVIEW_VISIBLE_COLUMNS', () => {
    for (const key of OFFER_COLUMN_KEYS) expect(PREVIEW_VISIBLE_COLUMNS.has(key)).toBe(true)
  })

  it.each([
    ['„komentarz" właściciela', barred],
    ['stawka podwykonawcy', subcontractorRate],
  ])('%s nie przechodzi, nawet wpisana wprost do listy', (_label, column) => {
    expect(printableOfferColumns([column], [])).toEqual([])
  })

  it('kolumna z sufitu przechodzi, dopóki właściciel jej nie ukryje', () => {
    const price = { ...barred, key: 'price' }

    expect(printableOfferColumns([price], [])).toEqual([price])
    expect(printableOfferColumns([price], ['price'])).toEqual([])
  })
})
