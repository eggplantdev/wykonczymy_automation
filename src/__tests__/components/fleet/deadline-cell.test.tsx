import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeadlineCell } from '@/components/fleet/deadline-cell'
import { OVERDUE } from '@/lib/fleet/thresholds'
import type { FleetDeadlineT } from '@/types/fleet'

const RECORDED: FleetDeadlineT = {
  nextDueAt: '2026-04-20',
  daysLeft: 12,
  bucket: 30,
  hasEvent: true,
  exempt: false,
}

const cell = (deadline: Partial<FleetDeadlineT>, muted?: boolean) =>
  render(<DeadlineCell deadline={{ ...RECORDED, ...deadline }} muted={muted} />)

// EX-716 — the cell is the only place the three kinds of „nothing here" are told apart, and the whole
// przeglądy module exists because they are not the same thing. `rows.test.ts` already decides WHICH
// of them a car is in; what has no guard below the browser is that each one reaches the screen as its
// own answer instead of collapsing into an empty cell.
describe('Flota — komórka terminu rozróżnia trzy rodzaje pustki', () => {
  it('„bezterminowo", gdy typ nie dotyczy pojazdu — nawet ze starym przeglądem w historii', () => {
    cell({ exempt: true })

    // Exempt outranks the event: a przyczepa excused from przegląd techniczny keeps whatever it once
    // had, and resurrecting that date would make the one legitimately termin-less car a permanent
    // false alarm.
    expect(screen.getByText('bezterminowo')).toBeInTheDocument()
    expect(screen.queryByText(/20\.04/)).not.toBeInTheDocument()
  })

  it('„brak danych", gdy nic nie zapisano', () => {
    cell({ hasEvent: false, nextDueAt: null, daysLeft: null, bucket: null })

    // The blind spot the module is for: nothing recorded must never read like nothing due.
    expect(screen.getByText('brak danych')).toBeInTheDocument()
  })

  it('„bez terminu", gdy przegląd był, ale nic z niego nie wynika', () => {
    cell({ nextDueAt: null, daysLeft: null, bucket: null })

    expect(screen.getByText('bez terminu')).toBeInTheDocument()
  })

  it('datę i odległość w dniach, gdy termin jest znany', () => {
    cell({})

    expect(screen.getByText('20.04.2026')).toBeInTheDocument()
    expect(screen.getByText('za 12 dni')).toBeInTheDocument()
  })

  it('po terminie woła alarmem, a wycofany pojazd nie', () => {
    const { unmount } = cell({ daysLeft: -3, bucket: OVERDUE })
    const overdue = screen.getByText('3 dni po terminie')
    expect(overdue.className).toContain('text-destructive')
    unmount()

    // A retired car's deadlines are history, not a to-do list — the same figures, no urgency.
    cell({ daysLeft: -3, bucket: OVERDUE }, true)
    expect(screen.getByText('3 dni po terminie').className).not.toContain('text-destructive')
  })
})
