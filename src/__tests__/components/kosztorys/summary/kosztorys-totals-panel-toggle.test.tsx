import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'

describe('KosztorysTotalsPanelToggle', () => {
  it('reports whether the panel is open', async () => {
    render(<KosztorysTotalsPanelToggle hasRows />)
    const toggle = screen.getByRole('button', { name: /Podsumowanie/ })

    const initial = toggle.getAttribute('aria-expanded')
    expect(initial === 'true' || initial === 'false').toBe(true)

    await userEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe(initial === 'true' ? 'false' : 'true')
  })

  it('explains why it is disabled in a tooltip a pointer can reach', async () => {
    render(<KosztorysTotalsPanelToggle hasRows={false} disabled />)
    const toggle = screen.getByRole('button', { name: /Podsumowanie/ })
    expect(toggle).toBeDisabled()

    await userEvent.hover(toggle.parentElement!)
    expect(
      await screen.findByRole('tooltip', { name: /nie ma czego podsumować/ }),
    ).toBeInTheDocument()
  })
})
