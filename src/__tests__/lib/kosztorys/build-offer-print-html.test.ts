import { describe, expect, it } from 'vitest'

import { buildOfferPrintHtml, type OfferPrintArgsT } from '@/lib/kosztorys/build-offer-print-html'
import { columnTotalsForRows } from '@/lib/kosztorys/column-totals'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { CTX, row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'

const VAT_RATE = 0.08

// The oracle for every sum is the editor's own figure, never a hand-added column — that equality IS
// the contract this module was rewritten for: the paper prints the application's number.
function editorTotals(rows: KosztorysV2RowT[]) {
  return {
    totalNet: columnTotalsForRows(rows, CTX.stages, 'client', VAT_RATE).get('plannedNet') ?? 0,
    sectionNetById: new Map(
      [...groupBySection(rows)].map(([sectionId, rowsOfSection]) => [
        sectionId,
        columnTotalsForRows(rowsOfSection, CTX.stages, 'client', VAT_RATE).get('plannedNet') ?? 0,
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
    fillByColorKey: { blue: 'rgb(0, 0, 255)' },
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
    const withEmpty = [...rows, row({ id: 4, sectionId: 20, plannedQty: null, clientPrice: 0 })]
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

  it('ukrycie kolumny w ustawieniach podglądu zabiera ją i z papieru', () => {
    const out = html([row()], { settings: { hiddenColumns: ['price'], hideEmptyRows: true } })

    expect(out).not.toContain('<th class="num">Cena j.m.</th>')
    expect(out).toContain('<th>Opis prac</th>')
  })
})
