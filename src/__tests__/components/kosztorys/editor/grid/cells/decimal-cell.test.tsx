import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'
import { decimalText } from '@/lib/utils/decimal-text'
import { toastMessage } from '@/lib/utils/toast'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

type QtyRowT = KosztorysV2RowT & { plannedQty: number }

const POLICY = numericFieldPolicy<'plannedQty', QtyRowT>('plannedQty', decimalText)
const COLUMN = decimalColumn('plannedQty', 'Przedmiar', POLICY)
// The column is the public surface; its cell component is what the contract actually lives in.
const DecimalCell = COLUMN.component as React.ComponentType<Record<string, unknown>>

const ENTRY_QTY = 8

// Stands in for react-datasheet-grid: holds the row, feeds it back, and can drop the cell the way
// virtualization does when the edited row scrolls out of the window.
function CellHost({ mounted = true }: { mounted?: boolean }) {
  const [row, setRow] = useState<QtyRowT>({ id: 1, plannedQty: ENTRY_QTY } as QtyRowT)
  return (
    <>
      {mounted && (
        <DecimalCell
          rowData={row}
          setRowData={setRow}
          columnData={COLUMN.columnData}
          focus
          disabled={false}
          stopEditing={vi.fn()}
        />
      )}
      <output>{decimalText(row.plannedQty)}</output>
    </>
  )
}

function renderCell() {
  const view = render(<CellHost />)
  return {
    ...view,
    user: userEvent.setup(),
    input: screen.getByRole('textbox'),
    storedQty: () => screen.getByRole('status').textContent,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('DecimalCell — a separator must survive the keystroke that commits before it', () => {
  it('stores 12,5 rather than 125 when the comma is typed', async () => {
    const { user, input, storedQty } = renderCell()

    await user.clear(input)
    await user.type(input, '12,5')
    expect(input).toHaveValue('12,5')

    await user.tab()

    expect(storedQty()).toBe('12,5')
  })

  it('reads a dot the same way and shows the value back with a comma', async () => {
    const { user, input, storedQty } = renderCell()

    await user.clear(input)
    await user.type(input, '12.5')
    await user.tab()

    expect(storedQty()).toBe('12,5')
    expect(screen.getByRole('textbox')).toHaveValue('12,5')
  })
})

describe('DecimalCell — what a refused value leaves behind', () => {
  // Keystrokes commit as they go, so „12" is already on the row by the time the „x" makes the whole
  // text unreadable — walking away must not leave that prefix standing as if it had been chosen.
  it('restores the quantity and says so when the committed prefix is rejected', async () => {
    const { user, input, storedQty } = renderCell()

    await user.clear(input)
    await user.type(input, '12x')
    await user.tab()

    expect(storedQty()).toBe(decimalText(ENTRY_QTY))
    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringContaining('przywrócono'),
      'error',
      expect.any(Number),
    )
  })

  it('stays quiet when the garbage displaced nothing', async () => {
    const { user, input, storedQty } = renderCell()

    await user.clear(input)
    await user.type(input, '-')
    await user.tab()

    expect(storedQty()).toBe(decimalText(ENTRY_QTY))
    expect(toastMessage).not.toHaveBeenCalled()
  })

  it('drops the edit on Escape without a word', async () => {
    const { user, input, storedQty } = renderCell()

    await user.clear(input)
    await user.type(input, '99{Escape}')

    expect(storedQty()).toBe(decimalText(ENTRY_QTY))
    expect(toastMessage).not.toHaveBeenCalled()
  })

  it('commits an emptied cell as zero rather than as garbage', async () => {
    const { user, input, storedQty } = renderCell()

    await user.clear(input)
    await user.tab()

    expect(storedQty()).toBe('0')
    expect(toastMessage).not.toHaveBeenCalled()
  })
})

// EX-735: removing a focused element fires no blur, so the exit that never ran the rollback is the
// one virtualization takes — the edited row scrolls out of the window and the input is unmounted.
describe('DecimalCell — the row is scrolled out from under the caret', () => {
  it('settles the refused draft on unmount, once', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<CellHost />)
    const input = screen.getByRole('textbox')

    await user.clear(input)
    await user.type(input, '12x')
    rerender(<CellHost mounted={false} />)

    expect(screen.getByRole('status').textContent).toBe(decimalText(ENTRY_QTY))
    expect(toastMessage).toHaveBeenCalledTimes(1)
  })
})
