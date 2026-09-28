import { describe, expect, it } from 'vitest'
import { warsawToday } from '@/lib/utils/days'

describe('warsawToday', () => {
  // 00:00–02:00 in Poland is still the previous day in UTC — a form opened then must not default
  // to yesterday.
  it('is the Warsaw calendar day in the hours UTC is still on the previous one', () => {
    expect(warsawToday(new Date('2026-09-27T22:30:00Z'))).toBe('2026-09-28')
    expect(warsawToday(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15')
  })
})
