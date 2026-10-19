import { describe, expect, it } from 'vitest'
import {
  resolveLaborColumns,
  type ResolvedLaborColumnsT,
  type LaborColumnsFailureT,
} from '@/lib/kosztorys/sheet-import/resolve-columns'
import { col } from '@/__tests__/fixtures/kosztorys-sheet/grid'
import {
  BIALOSTOCKA_LABOR_HEADER,
  UNNAMED_NET_VALUE_LABOR_HEADER,
} from '@/__tests__/fixtures/kosztorys-sheet/header-blocks'

function expectResolved(
  result: ResolvedLaborColumnsT | LaborColumnsFailureT,
): asserts result is ResolvedLaborColumnsT {
  if (!result.ok) expect.fail(`expected a resolved header, got: ${result.problems.join(' | ')}`)
}

describe('resolveLaborColumns with a stored column pointing', () => {
  it('resolves a column the header name could not', () => {
    const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER, { netValue: col('S') })
    expectResolved(result)

    expect(result.columns.netValue).toBe(col('S'))
    expect(result.pointedFields).toEqual(['netValue'])
    expect(result.missingFields).toEqual([])
  })

  it('lets a corrected header name win over a pointing at another column', () => {
    const result = resolveLaborColumns(BIALOSTOCKA_LABOR_HEADER, { netValue: col('AE') })
    expectResolved(result)

    expect(result.columns.netValue).toBe(col('S'))
    expect(result.pointedFields).toEqual([])
  })

  it.each([
    ['at a column another field already owns', col('Q')],
    ['at a column read off the etapy position', col('B')],
    ['past the header block', col('S') + 500],
  ])('ignores a pointing %s', (_case, netValue) => {
    const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER, { netValue })

    expect(result.ok).toBe(false)
    expect(result.missingFields).toEqual([{ field: 'netValue', required: true, reason: 'absent' }])
  })

  it('runs unmarked etapy up to a Przedmiar the owner pointed at', () => {
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => [...row])
    for (const column of ['J', 'K', 'L', 'M']) grid[1][col(column)] = ''
    for (const row of [0, 2]) grid[row][col('N')] = 'Przesyłam wstępny kosztorys.'

    const result = resolveLaborColumns(grid, { plannedQty: col('N') })
    expectResolved(result)

    expect(result.columns.plannedQty).toBe(col('N'))
    expect(result.stages).toEqual({ firstColumn: col('D'), count: 10 }) // D–M
  })

  it('names only the fields that came from the pointing', () => {
    const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER, {
      netValue: col('S'),
      plannedQty: col('T'),
    })
    expectResolved(result)

    expect(result.pointedFields).toEqual(['netValue'])
    expect(result.columns.plannedQty).toBe(col('N'))
  })
})
