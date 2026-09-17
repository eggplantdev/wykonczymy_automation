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

// EX-716: `rows.test.ts` decides WHICH of the three „nothing here" states a car is in; this covers
// that each one still renders as its own distinct cell rather than collapsing into one empty cell.
describe('Flota — komórka terminu rozróżnia trzy rodzaje pustki', () => {
  it('„bezterminowo", gdy typ nie dotyczy pojazdu — nawet ze starym przeglądem w historii', () => {
    cell({ exempt: true })

    // Exempt outranks the event: a przyczepa excused from przegląd techniczny keeps that status
    // even with an old date in history.
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
