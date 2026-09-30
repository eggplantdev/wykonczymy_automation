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

  it('ignores a pointing at a column another field already owns', () => {
    const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER, { netValue: col('Q') })

    expect(result.ok).toBe(false)
    expect(result.missingFields).toEqual([{ field: 'netValue', required: true, reason: 'absent' }])
  })

  it('runs unmarked etapy up to a Przedmiar the owner pointed at', () => {
    // Markers on D–I only and the Przedmiar header overwritten: the pointing is the only thing that
    // says where the etapy stop, and N itself must stay free to be pointed at.
    const grid = BIALOSTOCKA_LABOR_HEADER.map((row) => [...row])
    for (const column of ['J', 'K', 'L', 'M']) grid[1][col(column)] = ''
    for (const row of [0, 2]) grid[row][col('N')] = 'Przesyłam wstępny kosztorys.'

    const result = resolveLaborColumns(grid, { plannedQty: col('N') })
    expectResolved(result)

    expect(result.columns.plannedQty).toBe(col('N'))
    expect(result.stages).toEqual({ firstColumn: col('D'), count: 10 }) // D–M
  })

  it('ignores a pointing at a column read off the etapy position', () => {
    // B is the ordinal between „nazwa sekcji" and „opis pracy" — no field's own, but not free either.
    const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER, { netValue: col('B') })

    expect(result.ok).toBe(false)
    expect(result.missingFields).toEqual([{ field: 'netValue', required: true, reason: 'absent' }])
  })

  it('ignores a pointing past the header block', () => {
    const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER, { netValue: col('S') + 500 })

    expect(result.ok).toBe(false)
    expect(result.missingFields).toEqual([{ field: 'netValue', required: true, reason: 'absent' }])
  })

  it('names only the fields that came from the pointing', () => {
    const result = resolveLaborColumns(UNNAMED_NET_VALUE_LABOR_HEADER, {
      netValue: col('S'),
      // Already matched by name — riding along in the pointing changes nothing.
      plannedQty: col('T'),
    })
    expectResolved(result)

    expect(result.pointedFields).toEqual(['netValue'])
    expect(result.columns.plannedQty).toBe(col('N'))
  })
})
