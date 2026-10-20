import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Combobox } from '@/components/ui/combobox'

describe('Combobox — field variant', () => {
  it('marks the trigger invalid', () => {
    render(
      <Combobox variant="field" invalid value="" options={['m²']} onChange={vi.fn()} placeholder="Jm" />,
    )
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('is not invalid by default', () => {
    render(<Combobox value="m²" options={['m²']} onChange={vi.fn()} />)
    expect(screen.getByRole('combobox')).not.toHaveAttribute('aria-invalid')
  })
})
