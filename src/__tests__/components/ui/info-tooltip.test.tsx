import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { InfoTooltip } from '@/components/ui/info-tooltip'

describe('InfoTooltip', () => {
  it('stays open after a click on its button', async () => {
    const user = userEvent.setup()
    render(<InfoTooltip content="Wyjaśnienie" />)

    await user.click(screen.getByRole('button', { name: 'Więcej informacji' }))

    expect(screen.getByRole('tooltip')).toHaveTextContent('Wyjaśnienie')
  })
})
