import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkerQuickActions } from '@/components/users/worker-quick-actions'

vi.mock('@/components/worker-expenses/expense-draft-dialog', () => ({
  ExpenseDraftDialog: () => <button type="button">Wydatek</button>,
}))

const REGISTERS = [{ id: 3, name: 'Kasa Jana', active: true }] as never

describe('WorkerQuickActions „Wydatek”', () => {
  it('shows for a flagged worker with a kasa and no investment', () => {
    render(
      <WorkerQuickActions
        investmentLinks={[]}
        sendableRegisters={REGISTERS}
        canSkipInvestment
        locale="pl"
      />,
    )

    expect(screen.getByRole('button', { name: 'Wydatek' })).toBeInTheDocument()
  })

  it('is hidden for an unflagged worker with no investment', () => {
    render(
      <WorkerQuickActions
        investmentLinks={[]}
        sendableRegisters={REGISTERS}
        canSkipInvestment={false}
        locale="pl"
      />,
    )

    expect(screen.queryByRole('button', { name: 'Wydatek' })).not.toBeInTheDocument()
  })

  it('is hidden for a flagged worker with no kasa to send from', () => {
    render(
      <WorkerQuickActions
        investmentLinks={[]}
        sendableRegisters={[]}
        canSkipInvestment
        locale="pl"
      />,
    )

    expect(screen.queryByRole('button', { name: 'Wydatek' })).not.toBeInTheDocument()
  })
})
