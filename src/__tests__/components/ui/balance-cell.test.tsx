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

  it('paints a settled balance green at zero', () => {
    render(<BalanceCell value={0} settled />)

    expect(screen.getByText(/0,00\s*zł/)).toHaveClass('text-chart-green')
  })

  it('paints a rounding residue green when settled', () => {
    render(<BalanceCell value={-1e-13} settled />)

    const cell = screen.getByText(/0,00\s*zł/)
    expect(cell).toHaveClass('text-chart-green')
    expect(cell).not.toHaveClass('text-destructive')
  })

  it('keeps a non-zero balance off green when settled', () => {
    render(<BalanceCell value={12.5} settled />)

    expect(screen.getByText(/12,50\s*zł/)).not.toHaveClass('text-chart-green')
  })

  it('still colours a negative balance when settled', () => {
    render(<BalanceCell value={-5} settled />)

    expect(screen.getByText(/-5,00\s*zł/)).toHaveClass('text-destructive')
  })
})
