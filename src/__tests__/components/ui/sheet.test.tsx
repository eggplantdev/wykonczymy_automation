import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

function renderSheet() {
  return render(
    <Sheet>
      <SheetTrigger>Menu</SheetTrigger>
      <SheetContent>
        <SheetTitle>Nawigacja</SheetTitle>
        <SheetDescription>Menu</SheetDescription>
        <button type="button">Link</button>
      </SheetContent>
    </Sheet>,
  )
}

describe('Sheet', () => {
  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    renderSheet()
    const trigger = screen.getByRole('button', { name: 'Menu' })

    await user.click(trigger)
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
})
