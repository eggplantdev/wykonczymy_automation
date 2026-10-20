import { render, screen } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { Button } from '@/components/ui/button'

describe('Button pending', () => {
  it('disables the button and marks it busy', () => {
    render(
      <Button pending>
        <Plus />
        Zapisz
      </Button>,
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('renders exactly one status, replacing the leading icon', () => {
    const { container } = render(
      <Button pending>
        <Plus data-testid="icon" />
        Zapisz
      </Button>,
    )

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.queryByTestId('icon')).toBeNull()
    expect(container.querySelectorAll('svg')).toHaveLength(0)
  })

  it('renders no status and stays enabled when idle', () => {
    render(
      <Button>
        <Plus />
        Zapisz
      </Button>,
    )

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button')).toBeEnabled()
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy')
  })
})
