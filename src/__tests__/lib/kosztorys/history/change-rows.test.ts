import { describe, expect, it } from 'vitest'
import {
  countChangeRows,
  differenceSummary,
  versionChangeRows,
} from '@/lib/kosztorys/history/change-rows'
import { diffVersions } from '@/lib/kosztorys/history/diff-versions'
import { item, version } from '@/__tests__/helpers/kosztorys-history'

describe('versionChangeRows', () => {
  it('names a typed change by its column', () => {
    const rows = versionChangeRows(
      diffVersions(version([item(1, 'Płytki', 12, 100)]), version([item(1, 'Płytki', 14, 100)])),
    )
    expect(rows).toEqual([
      expect.objectContaining({
        description: 'Płytki',
        what: 'Przedmiar ofertowy',
        before: '12 m2',
        after: '14 m2',
      }),
    ])
  })

  it('reads „follows the ofertowy" as a dash, a typed aktualizacja with its unit', () => {
    const rows = versionChangeRows(
      diffVersions(
        version([item(1, 'Płytki', 12, 100)]),
        version([item(1, 'Płytki', 12, 100, { currentPlannedQty: 120 })]),
      ),
    )
    expect(rows).toEqual([
      expect.objectContaining({ what: 'Aktualizacja przedmiaru', before: '—', after: '120 m2' }),
    ])
  })

  it('lists a pozycja whose only change is its own rabat, never „Bez różnic"', () => {
    const past = version([item(1, 'Płytki', 12, 100)])
    const current = version([
      item(1, 'Płytki', 12, 100, { discountType: 'amount', discountValue: 200 }),
    ])
    const diff = diffVersions(past, current)
    expect(versionChangeRows(diff).map(({ description }) => description)).toContain('Płytki')
    expect(differenceSummary(countChangeRows(diff))).not.toBe('Bez różnic względem bieżącej')
  })
})

describe('versionChangeRows — rabat', () => {
  const items = [item(1, 'Płytki', 10, 100)]

  it('pokazuje kwotę w netto i brutto, każdą po stawce VAT swojej wersji', () => {
    const past = version(items, [], [], {
      globalDiscount: { type: 'amount', value: 1000 },
      vatRate: 0.23,
    })
    const current = version(items, [], [], {
      globalDiscount: { type: 'amount', value: 5000 / 1.08 },
      vatRate: 0.08,
    })
    const [row] = versionChangeRows(diffVersions(past, current))
    expect(row).toMatchObject({ what: 'Rabat' })
    expect(row.before).toMatch(/^1\s?000,00\szł netto \/ 1\s?230,00\szł brutto$/)
    expect(row.after).toMatch(/^4\s?629,63\szł netto \/ 5\s?000,00\szł brutto$/)
  })

  it('brak rabatu to „brak"', () => {
    const past = version(items)
    const current = version(items, [], [], { globalDiscount: { type: 'amount', value: 100 } })
    expect(versionChangeRows(diffVersions(past, current))[0]).toMatchObject({ before: 'brak' })
  })
})

describe('countChangeRows', () => {
  it('counts exactly the rows the version view lists', () => {
    const past = version([item(1, 'Płytki', 12, 100), item(2, 'Fugi', 3, 50)])
    const current = version([item(1, 'Płytki', 14, 120), item(3, 'Silikon', 2, 30)], [], [], {
      globalDiscount: { type: 'amount', value: 100 },
    })
    const diff = diffVersions(past, current)
    expect(countChangeRows(diff)).toBe(versionChangeRows(diff).length)
  })
})
