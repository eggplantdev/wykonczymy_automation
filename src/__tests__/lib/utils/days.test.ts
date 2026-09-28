import { describe, expect, it } from 'vitest'
import { endOfPreviousWarsawDay, toWarsawDay, warsawToday } from '@/lib/utils/days'

describe('warsawToday', () => {
  // 00:00–02:00 in Poland is still the previous day in UTC — a form opened then must not default
  // to yesterday.
  it('is the Warsaw calendar day in the hours UTC is still on the previous one', () => {
    expect(warsawToday(new Date('2026-09-27T22:30:00Z'))).toBe('2026-09-28')
    expect(warsawToday(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15')
  })
})

// Both cron firings: 23:15 UTC is 00:15 Warsaw in winter and 01:15 in summer. Either way the version
// belongs to the Warsaw day that just ended.
describe('endOfPreviousWarsawDay', () => {
  it.each([
    ['winter', '2026-01-14T23:15:00.000Z', '2026-01-14', '2026-01-14T22:59:59.999Z'],
    ['summer', '2026-07-14T23:15:00.000Z', '2026-07-14', '2026-07-14T21:59:59.999Z'],
    // The night the clocks go forward: the day that ended was still on winter time.
    ['spring DST night', '2026-03-29T23:15:00.000Z', '2026-03-29', '2026-03-29T21:59:59.999Z'],
    ['autumn DST night', '2026-10-25T23:15:00.000Z', '2026-10-25', '2026-10-25T22:59:59.999Z'],
  ])('%s run stamps the last instant of the Warsaw day before', (_, now, day, instant) => {
    const takenAt = endOfPreviousWarsawDay(new Date(now))
    expect(takenAt.toISOString()).toBe(instant)
    expect(toWarsawDay(takenAt)).toBe(day)
  })
})
