import { describe, it, expect } from 'vitest'
import { describeVehicleTrash } from '@/lib/fleet/describe-trash'

describe('describeVehicleTrash', () => {
  it('warns a car in use with history about both the reminders and the inspections', () => {
    expect(
      describeVehicleTrash({ registration: 'WX 1000A', status: 'ACTIVE', inspectionCount: 3 }),
    ).toBe(
      'Przenieść „WX 1000A" do kosza? Możesz go przywrócić z Kosza. Przypomnienia o przeglądach przestaną przychodzić. Po 30 dniach zniknie razem z historią przeglądów (3).',
    )
  })

  it('adds no warning for a retired car with no history', () => {
    expect(
      describeVehicleTrash({ registration: 'WX 1000A', status: 'RETIRED', inspectionCount: 0 }),
    ).toBe('Przenieść „WX 1000A" do kosza? Możesz go przywrócić z Kosza.')
  })
})
