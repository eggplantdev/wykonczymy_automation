import { describe, it, expect } from 'vitest'
import { dayBound } from '@/lib/utils/date-range'

describe('dayBound', () => {
  it('keeps a calendar day, leap day included', () => {
    expect(dayBound('2026-04-01')).toBe('2026-04-01')
    expect(dayBound('2028-02-29')).toBe('2028-02-29')
  })

  // The picker anchors on `new Date(bound + 'T00:00:00')`: 2026-13-45 renders „NaN", 2026-02-30 rolls into March.
  it.each(['2026-13-45', '2026-02-30', '2026-02-29', '2026-00-10', '2026-04-31'])(
    'drops %s, shaped like a day but not one',
    (value) => expect(dayBound(value)).toBeUndefined(),
  )

  it.each([undefined, '', '2026-4-1', '01.04.2026', ['2026-04-01', '2026-04-02']])(
    'drops %j',
    (value) => expect(dayBound(value)).toBeUndefined(),
  )
})
