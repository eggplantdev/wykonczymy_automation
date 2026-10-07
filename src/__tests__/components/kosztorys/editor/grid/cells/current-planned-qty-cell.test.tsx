import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { currentPlannedQtyColumn } from '@/components/kosztorys/editor/grid/cells/current-planned-qty-cell'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const COLUMN = currentPlannedQtyColumn('Aktualizacja przedmiaru')
const Cell = COLUMN.component as React.ComponentType<Record<string, unknown>>

const GREY = 'text-muted-foreground'

// Stands in for react-datasheet-grid, including the Delete it routes through `deleteValue`.
function CellHost({ initial }: { initial: number | null }) {
  const [row, setRow] = useState(
    () => ({ id: 1, plannedQty: 10, currentPlannedQty: initial }) as KosztorysV2RowT,
  )
  return (
    <>
      <Cell
        rowData={row}
        setRowData={setRow}
        columnData={COLUMN.columnData}
        focus
        disabled={false}
        stopEditing={vi.fn()}
      />
      <button
        type="button"
        onClick={() =>
          setRow(COLUMN.deleteValue!({ rowData: row, rowIndex: 0 }) as KosztorysV2RowT)
        }
      >
        delete
      </button>
    </>
  )
}

describe('Aktualizacja przedmiaru cell', () => {
  it('shows the ofertowy in grey while it follows', () => {
    render(<CellHost initial={null} />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('10')
    expect(input).toHaveClass(GREY)
  })

  it('shows a stored value in black', () => {
    render(<CellHost initial={15} />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveValue('15')
    expect(input).not.toHaveClass(GREY)
  })

  it('turns black once typed, and grey again after Delete', async () => {
    const user = userEvent.setup()
    render(<CellHost initial={null} />)

    await user.clear(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), '120')
    await user.tab()
    expect(screen.getByRole('textbox')).toHaveValue('120')
    expect(screen.getByRole('textbox')).not.toHaveClass(GREY)

    await user.click(screen.getByRole('button', { name: 'delete' }))
    expect(screen.getByRole('textbox')).toHaveValue('10')
    expect(screen.getByRole('textbox')).toHaveClass(GREY)
  })
})
