import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'

describe('DecisionProgressBadge', () => {
  it('shows all three counts when each is above zero', () => {
    render(<DecisionProgressBadge accepted={2} rejected={1} pending={3} />)

    expect(screen.getByText('Przyjęte 2')).toBeInTheDocument()
    expect(screen.getByText('Odrzucone 1')).toBeInTheDocument()
    expect(screen.getByText('Do sprawdzenia 3')).toBeInTheDocument()
  })

  it('hides the parts at zero', () => {
    render(<DecisionProgressBadge accepted={4} rejected={0} pending={0} />)

    expect(screen.getByText('Przyjęte 4')).toBeInTheDocument()
    expect(screen.queryByText(/Odrzucone/)).toBeNull()
    expect(screen.queryByText(/Do sprawdzenia/)).toBeNull()
  })

  it('reports the toggled status when it filters a list', async () => {
    const onToggle = vi.fn()
    render(
      <DecisionProgressBadge
        accepted={1}
        rejected={0}
        pending={2}
        hidden={new Set(['accepted'])}
        onToggle={onToggle}
      />,
    )

    expect(screen.getByRole('button', { name: 'Przyjęte 1' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await userEvent.setup().click(screen.getByRole('button', { name: 'Do sprawdzenia 2' }))

    expect(onToggle).toHaveBeenCalledWith('pending')
  })
})
