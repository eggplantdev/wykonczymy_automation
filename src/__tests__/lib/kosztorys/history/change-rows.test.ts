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
        what: 'Przedmiar',
        before: '12 m2',
        after: '14 m2',
      }),
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
