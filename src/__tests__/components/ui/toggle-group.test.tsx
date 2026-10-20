import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ToggleGroup } from '@/components/ui/toggle-group'

const OPTIONS = [
  { value: 'a', label: 'Alfa', icon: <svg data-testid="icon-a" /> },
  { value: 'b', label: 'Beta', icon: <svg data-testid="icon-b" /> },
]

describe('ToggleGroup — icon options', () => {
  it('names the option through a tooltip, not a native title', async () => {
    const user = userEvent.setup()
    render(<ToggleGroup options={OPTIONS} value="a" onChange={vi.fn()} variant="muted" />)

    const item = screen.getByRole('radio', { name: 'Alfa' })
    expect(item).not.toHaveAttribute('title')

    await user.hover(item)
    expect(await screen.findAllByText('Alfa')).not.toHaveLength(0)
  })

  it('keeps the selected state on the item the tooltip wraps', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ToggleGroup options={OPTIONS} value="a" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: 'Alfa' })).toHaveAttribute('data-state', 'on')
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('data-state', 'off')

    await user.click(screen.getByRole('radio', { name: 'Beta' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})
