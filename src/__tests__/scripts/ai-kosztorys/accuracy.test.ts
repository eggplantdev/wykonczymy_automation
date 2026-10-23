import { describe, expect, it } from 'vitest'
import { scoreCases } from '@/lib/kosztorys/ai-accuracy'
import { toCsv, toCsvTables } from '../../../../scripts/ai-kosztorys/accuracy'

describe('toCsvTables', () => {
  const tables = scoreCases([
    {
      investmentId: 100,
      label: 'mieszkanie-mokotow',
      items: [
        {
          aiPlannedQty: 1,
          plannedQty: 3,
          clientPrice: 10,
          changeReason: null,
          description: 'Malowanie',
        },
      ],
    },
  ])

  it('keys the per-case tables by ai-cases case number, the slug next to it', () => {
    const csv = toCsvTables(tables, new Map([[100, 7]]))
    expect(toCsv(csv.cases)).toBe(
      'case,slug,ai_zl,owner_zl,too_high_zl,too_low_zl\n7,mieszkanie-mokotow,10,30,0,20\n',
    )
    expect(toCsv(csv.reasons)).toBe('case,wrong_zl,no_reason_zl\n7,20,20\n')
    expect(toCsv(csv.error_types)).toBe('case,missed_zl,extra_zl,qty_zl\n7,0,0,20\n')
  })

  it('refuses an investment with no ai-cases case', () => {
    expect(() => toCsvTables(tables, new Map())).toThrow('investment 100')
  })
})

describe('toCsv', () => {
  it('quotes a cell holding a comma or a quote', () => {
    expect(toCsv([{ pozycja: 'a, b', note: 'say "x"', n: 1 }])).toBe(
      'pozycja,note,n\n"a, b","say ""x""",1\n',
    )
  })
})
