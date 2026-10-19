import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BalanceCell } from '@/components/ui/balance-cell'

describe('BalanceCell', () => {
  it('leaves a residue that rounds to zero uncoloured', () => {
    render(<BalanceCell value={-0.004} />)

    const cell = screen.getByText(/0,00\s*zł/)
    expect(cell).not.toHaveClass('text-destructive')
  })

  it('colours a negative balance', () => {
    render(<BalanceCell value={-0.01} />)

    expect(screen.getByText(/-0,01\s*zł/)).toHaveClass('text-destructive')
  })
})
