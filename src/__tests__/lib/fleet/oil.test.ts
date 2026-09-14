import { describe, it, expect } from 'vitest'
import { shouldNotify } from '@/lib/fleet/should-notify'
import { isOilChangeOverdue, OIL_CHANGE_INTERVAL_KM } from '@/lib/fleet/thresholds'
import { kmSinceOilChange } from '@/lib/fleet/deadlines'
import { event } from '@/__tests__/helpers/fleet'
import { toWarsawDay } from '@/lib/utils/days'

const TODAY = toWarsawDay('2026-08-26')

/**
 * The digest decides per inspection row, the app per vehicle, and they used to decide on two
 * different rules: the mail honoured a typed „następna wymiana przy", the badge always counted the
 * flat interval. So one car came out overdue in the mail and clean in the table, or the reverse
 * (EX-745). One rule now — the interval — and every case here asks BOTH: a disagreement is the bug.
 */
const verdicts = (oilChange: ReturnType<typeof event>, latestOdometer: number) => {
  const events = [oilChange, event('TECHNICAL', '2026-08-01', { odometer: latestOdometer })]

  return {
    mail: shouldNotify({ row: oilChange, today: TODAY, latestOdometer }).odometer,
    app: isOilChangeOverdue(kmSinceOilChange(events)),
  }
}

const changedAt = (odometer: number) => event('OIL_CHANGE', '2026-01-01', { odometer })

describe('the oil alarm — mail and app answer alike', () => {
  it('stays quiet inside the interval', () => {
    expect(verdicts(changedAt(100_000), 109_000)).toEqual({ mail: false, app: false })
  })

  it('fires once the interval is behind us', () => {
    expect(verdicts(changedAt(100_000), 110_001)).toEqual({ mail: true, app: true })
  })

  // The interval's last kilometre is still inside it — the work is owed once it is passed, not on it.
  it('treats the interval mark itself as not yet due', () => {
    expect(verdicts(changedAt(100_000), 100_000 + OIL_CHANGE_INTERVAL_KM)).toEqual({
      mail: false,
      app: false,
    })
  })

  // The whole point of the simplification (owner, 2026-08-26): nobody types a target any more, so
  // there is nothing that could pull the two surfaces apart again.
  it('measures from the change itself, so a distant reading is what makes it due', () => {
    expect(verdicts(changedAt(200_000), 209_000)).toEqual({ mail: false, app: false })
    expect(verdicts(changedAt(200_000), 211_000)).toEqual({ mail: true, app: true })
  })

  it('says nothing about a change entered without a reading', () => {
    const noReading = event('OIL_CHANGE', '2026-01-01')

    expect(verdicts(noReading, 150_000)).toEqual({ mail: false, app: false })
  })
})
