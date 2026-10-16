import { describe, it, expect } from 'vitest'
import { kmSinceOilChange, latestByType, latestOdometerReading } from '@/lib/fleet/deadlines'
import { INSPECTION_TYPES, SCHEDULED_INSPECTION_TYPES } from '@/lib/fleet/inspection-types'
import { event } from '@/__tests__/helpers/fleet'

describe('latestByType', () => {
  it('returns an entry for every type, null where nothing was recorded', () => {
    const latest = latestByType([])

    expect(Object.keys(latest).sort()).toEqual([...INSPECTION_TYPES].sort())
    for (const type of INSPECTION_TYPES) expect(latest[type]).toBeNull()
  })

  it('takes the newest event by performedAt even when an older one is due later', () => {
    const older = event('TECHNICAL', '2025-08-01', { nextDueAt: '2027-08-01' })
    const newer = event('TECHNICAL', '2026-08-01', { nextDueAt: '2026-09-01' })

    expect(latestByType([newer, older]).TECHNICAL?.id).toBe(newer.id)
  })

  it('keeps the five types independent', () => {
    const technical = event('TECHNICAL', '2026-08-01', { nextDueAt: '2027-08-01' })
    const insurance = event('INSURANCE', '2026-02-01', { nextDueAt: '2027-02-01' })

    const latest = latestByType([technical, insurance])

    expect(latest.TECHNICAL?.nextDueAt).toBe('2027-08-01')
    expect(latest.INSURANCE?.nextDueAt).toBe('2027-02-01')
    expect(latest.OIL_CHANGE).toBeNull()
  })
})

describe('latestOdometerReading', () => {
  it('is the newest reading across all types, not just the oil changes', () => {
    const oil = event('OIL_CHANGE', '2026-01-01', { odometer: 100_000 })
    const technical = event('TECHNICAL', '2026-06-01', { odometer: 108_000 })
    const unknown = event('TYRES', '2026-07-01')

    expect(latestOdometerReading([oil, technical, unknown])).toBe(108_000)
  })

  it('is null when no event carries a reading', () => {
    expect(latestOdometerReading([event('TYRES', '2026-07-01')])).toBeNull()
  })
})

describe('kmSinceOilChange', () => {
  it('measures the newest reading of any type against the last oil change', () => {
    const oil = event('OIL_CHANGE', '2026-01-01', { odometer: 100_000 })
    const technical = event('TECHNICAL', '2026-06-01', { odometer: 208_000 })

    expect(kmSinceOilChange([oil, technical])).toBe(108_000)
  })

  it('measures from the NEWEST oil change, not the first one', () => {
    const older = event('OIL_CHANGE', '2025-01-01', { odometer: 40_000 })
    const newer = event('OIL_CHANGE', '2026-01-01', { odometer: 100_000 })
    const technical = event('TECHNICAL', '2026-06-01', { odometer: 108_000 })

    expect(kmSinceOilChange([older, newer, technical])).toBe(8_000)
  })

  it('is null when the oil change carries no reading', () => {
    const oil = event('OIL_CHANGE', '2026-01-01')
    const technical = event('TECHNICAL', '2026-06-01', { odometer: 108_000 })

    expect(kmSinceOilChange([oil, technical])).toBeNull()
  })

  it('is null when the car has never had an oil change recorded', () => {
    expect(kmSinceOilChange([event('TECHNICAL', '2026-06-01', { odometer: 108_000 })])).toBeNull()
  })
})

// „Odczyt licznika" exists so a mileage can be recorded without inventing a service that never
// happened. It must therefore count everywhere mileage is read, and nowhere a deadline is decided.
describe('ODOMETER readings', () => {
  it('is the newest reading when it is the newest event', () => {
    const oil = event('OIL_CHANGE', '2026-01-01', { odometer: 160_000 })
    const reading = event('ODOMETER', '2026-08-01', { odometer: 177_500 })

    expect(latestOdometerReading([oil, reading])).toBe(177_500)
    expect(kmSinceOilChange([oil, reading])).toBe(17_500)
  })

  it('never becomes a deadline of its own', () => {
    const reading = event('ODOMETER', '2026-08-01', { odometer: 177_500 })

    expect(latestByType([reading]).ODOMETER).toBe(reading)
    expect(SCHEDULED_INSPECTION_TYPES).not.toContain('ODOMETER')
  })
})
