import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { decimalColumn } from '@/components/kosztorys/editor/grid/cells/decimal-column'
import { numericFieldPolicy } from '@/lib/kosztorys/cell-edit'
import { decimalText } from '@/lib/utils/decimal-text'
import { toastMessage } from '@/lib/utils/toast'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type QtyRowT = KosztorysV2RowT & { plannedQty: number }

const POLICY = numericFieldPolicy<'plannedQty', QtyRowT>('plannedQty', decimalText)
const COLUMN = decimalColumn('plannedQty', 'Przedmiar', POLICY)
const CAPPED_COLUMN = decimalColumn('plannedQty', 'Przedmiar', {
  ...POLICY,
  guard: (row) => (row.plannedQty > 100 ? { severity: 'refuse', message: 'za dużo' } : null),
})

const ENTRY_QTY = 8

type HostPropsT = {
  mounted?: boolean
  column?: typeof COLUMN
  onWrite?: (row: QtyRowT) => void
}

function CellHost({ mounted = true, column = COLUMN, onWrite }: HostPropsT) {
  const [row, setRow] = useState<QtyRowT>({ id: 1, plannedQty: ENTRY_QTY } as QtyRowT)
  const DecimalCell = column.component as React.ComponentType<Record<string, unknown>>
  return (
    <>
      {mounted && (
        <DecimalCell
          rowData={row}
          setRowData={(next: QtyRowT) => {
            onWrite?.(next)
            setRow(next)
          }}
          columnData={column.columnData}
          focus
          disabled={false}
          stopEditing={vi.fn()}
        />
      )}
      <output>{decimalText(row.plannedQty)}</output>
    </>
  )
}

function renderCell(props: HostPropsT = {}) {
  const onWrite = vi.fn()
  const view = render(<CellHost onWrite={onWrite} {...props} />)
  return {
    ...view,
    onWrite,
    user: userEvent.setup(),
    input: screen.getByRole('textbox'),
    storedQty: () => screen.getByRole('status').textContent,
  }
}

describe('DecimalCell — the row is written once, when the cell is left', () => {
  it('writes nothing while typing and once on Tab', async () => {
    const { user, input, storedQty, onWrite } = renderCell()

    await user.clear(input)
    await user.type(input, '123')
    expect(onWrite).not.toHaveBeenCalled()
    expect(storedQty()).toBe(decimalText(ENTRY_QTY))

    await user.tab()

    expect(onWrite).toHaveBeenCalledTimes(1)
    expect(storedQty()).toBe('123')
  })

  it('stores 12,5 when the comma is typed', async () => {
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
  it('leaves the quantity alone and stays quiet on unreadable text', async () => {
    const { user, input, storedQty, onWrite } = renderCell()

    await user.clear(input)
    await user.type(input, '12x')
    await user.tab()

    expect(storedQty()).toBe(decimalText(ENTRY_QTY))
    expect(onWrite).not.toHaveBeenCalled()
    expect(toastMessage).not.toHaveBeenCalled()
  })

  it('leaves the quantity alone and says so when the guard refuses', async () => {
    const { user, input, storedQty, onWrite } = renderCell({ column: CAPPED_COLUMN })

    await user.clear(input)
    await user.type(input, '150')
    await user.tab()

    expect(storedQty()).toBe(decimalText(ENTRY_QTY))
    expect(onWrite).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledTimes(1)
    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringContaining('przywrócono'),
      'error',
      expect.any(Number),
    )
  })

  it('drops the edit on Escape without a word', async () => {
    const { user, input, storedQty, onWrite } = renderCell()

    await user.clear(input)
    await user.type(input, '99{Escape}')

    expect(storedQty()).toBe(decimalText(ENTRY_QTY))
    expect(onWrite).not.toHaveBeenCalled()
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

describe('DecimalCell — the row is scrolled out from under the caret', () => {
  it('commits a readable draft on unmount, once', async () => {
    const { user, input, rerender, onWrite } = renderCell()

    await user.clear(input)
    await user.type(input, '42')
    rerender(<CellHost mounted={false} onWrite={onWrite} />)

    expect(screen.getByRole('status').textContent).toBe('42')
    expect(onWrite).toHaveBeenCalledTimes(1)
  })

  it('announces a refused draft on unmount, once, and writes nothing', async () => {
    const { user, input, rerender, onWrite } = renderCell({ column: CAPPED_COLUMN })

    await user.clear(input)
    await user.type(input, '150')
    rerender(<CellHost mounted={false} column={CAPPED_COLUMN} onWrite={onWrite} />)

    expect(screen.getByRole('status').textContent).toBe(decimalText(ENTRY_QTY))
    expect(onWrite).not.toHaveBeenCalled()
    expect(toastMessage).toHaveBeenCalledTimes(1)
  })
})
