import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { ColumnWidthHeaderItems } from '@/components/kosztorys/editor/actions/column-width-header-items'

function renderItems(count: number) {
  const onOpenDialog = vi.fn()
  const onReset = vi.fn()
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <ColumnWidthHeaderItems count={count} onOpenDialog={onOpenDialog} onReset={onReset} />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  return { onOpenDialog, onReset, user: userEvent.setup() }
}

describe('menu kolumny — szerokość zaznaczonych kolumn', () => {
  it('przy kilku kolumnach „Szerokość kolumn" podaje ich liczbę i otwiera okno', async () => {
    const { onOpenDialog, user } = renderItems(3)

    await user.click(screen.getByRole('menuitem', { name: 'Szerokość kolumn (3)…' }))

    expect(onOpenDialog).toHaveBeenCalled()
  })

  it('przy kilku kolumnach przywracanie podaje ich liczbę i przywraca je wszystkie', async () => {
    const { onReset, user } = renderItems(3)

    await user.click(screen.getByRole('menuitem', { name: 'Przywróć domyślną szerokość (3)' }))

    expect(onReset).toHaveBeenCalled()
  })

  it('przy jednej kolumnie podpowiada, jak zaznaczyć kilka, i nie pokazuje liczby', () => {
    renderItems(1)

    expect(screen.getByText('Szerokość kolumny…')).toBeInTheDocument()
    expect(screen.getByText(/Shift\+klik/)).toBeInTheDocument()
    expect(
      screen.getByRole('menuitem', { name: 'Przywróć domyślną szerokość' }),
    ).toBeInTheDocument()
  })
})
