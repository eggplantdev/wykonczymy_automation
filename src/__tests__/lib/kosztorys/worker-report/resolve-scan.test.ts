import { describe, expect, it } from 'vitest'
import { formatFormRef } from '@/lib/kosztorys/worker-report/check-digit'
import { resolveScanLines } from '@/lib/kosztorys/worker-report/resolve-scan'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type { ScanPageT } from '@/lib/kosztorys/worker-report/types'

const item = (id: number, ref: number, description: string, unit: string) =>
  ({ id, ref, description, unit }) as KosztorysItemT

const tree = {
  sections: [
    {
      id: 1,
      name: 'Salon',
      displayOrder: 0,
      color: null,
      items: [item(11, 35812, 'Malowanie ścian', 'm2'), item(12, 35813, 'Gruntowanie', 'm2')],
    },
  ],
}
const units = new Set(['m2', 'mb', 'szt'])

const page = (rows: ScanPageT['rows'], extras: ScanPageT['extras'] = []): ScanPageT => ({
  rows,
  extras,
})
const row = (ref: string, qty: number | null, isUncertain = false) => ({ ref, qty, isUncertain })

describe('resolveScanLines', () => {
  it('a valid number becomes a line of its pozycja, worded by the rozpiska', () => {
    const lines = resolveScanLines(
      [page([{ ...row(formatFormRef(35812), 12.5, true), description: 'Фарбування' }])],
      tree,
      units,
    )
    expect(lines).toEqual([
      {
        kind: 'rozpiska',
        itemId: 11,
        description: 'Malowanie ścian',
        unit: 'm2',
        sectionName: 'Salon',
        reportedQty: 12.5,
        isUncertain: true,
      },
    ])
  })

  it('a wrong check digit or an unknown number lands unassigned, keeping what the paper said', () => {
    const wrongDigit = `35812-${(Number(formatFormRef(35812).slice(-1)) + 1) % 10}`
    const unknown = formatFormRef(99999)
    const lines = resolveScanLines(
      [page([{ ...row(wrongDigit, 3), description: 'Malowanie' }, row(unknown, 4)])],
      tree,
      units,
    )
    expect(
      lines.map(({ itemId, scannedRef, description }) => ({ itemId, scannedRef, description })),
    ).toEqual([
      { itemId: null, scannedRef: wrongDigit, description: 'Malowanie' },
      { itemId: null, scannedRef: unknown, description: unknown },
    ])
  })

  it('a number read on two pages stays two lines, never a sum', () => {
    const ref = formatFormRef(35813)
    const lines = resolveScanLines([page([row(ref, 2)]), page([row(ref, 2)])], tree, units)
    expect(lines.map((line) => [line.itemId, line.reportedQty])).toEqual([
      [12, 2],
      [12, 2],
    ])
  })

  it('an extra keeps its j.m. only when the kosztorys lists it', () => {
    const lines = resolveScanLines(
      [
        page(
          [],
          [
            { description: 'Listwy', unit: 'mb', qty: 6, isUncertain: false },
            { description: 'Wywóz gruzu', unit: 'kurs', qty: 1, isUncertain: false },
            { description: 'Silikon', unit: null, qty: 2, isUncertain: true },
          ],
        ),
      ],
      tree,
      units,
    )
    expect(lines.map(({ kind, unit }) => [kind, unit])).toEqual([
      ['extra', 'mb'],
      ['extra', ''],
      ['extra', ''],
    ])
  })

  it('drops a row or an extra with no positive ilość', () => {
    const lines = resolveScanLines(
      [
        page(
          [
            row(formatFormRef(35812), null),
            row(formatFormRef(35813), 0),
            row(formatFormRef(35812), -1),
          ],
          [
            { description: 'Listwy', unit: 'mb', qty: 0.0000001, isUncertain: false },
            { description: '  ', unit: 'mb', qty: 3, isUncertain: false },
          ],
        ),
      ],
      tree,
      units,
    )
    expect(lines).toEqual([])
  })
})
