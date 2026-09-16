import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ColumnDef } from '@tanstack/react-table'
import { describe, expect, it, vi } from 'vitest'

import { DataTable } from '@/components/tables/data-table/data-table'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

type RowT = { name: string; net: number; stage: string }

const DATA: RowT[] = [
  { name: 'Wylewka', net: 1200, stage: 'Etap 1' },
  { name: 'Tynki', net: 3400, stage: 'Etap 2' },
]

const COLUMNS: ColumnDef<RowT, string | number>[] = [
  { id: 'name', accessorKey: 'name', header: 'Nazwa' },
  { id: 'net', accessorKey: 'net', header: 'Netto' },
  { id: 'stage', accessorKey: 'stage', header: 'Etap' },
]

// The toolbar is the only handle on visibility from outside, and it is also how the real callers
// toggle a column — a checkbox list built on the same `table` instance.
function renderTable() {
  render(
    <DataTable
      data={DATA}
      columns={COLUMNS}
      toolbar={({ table }) => (
        <>
          {table.getAllLeafColumns().map((column) => (
            <button key={column.id} onClick={() => column.toggleVisibility()}>
              {`toggle:${column.id}`}
            </button>
          ))}
        </>
      )}
    />,
  )
  return userEvent.setup()
}

function headerTexts() {
  return screen.getAllByRole('columnheader').map((cell) => cell.textContent)
}

function firstBodyRow() {
  return screen.getAllByRole('row')[1]
}

function firstRowTexts() {
  return [...firstBodyRow().querySelectorAll('td')].map((cell) => cell.textContent)
}

describe('DataTable — header and body agree on which columns are visible', () => {
  it('drops the hidden column from both planes and keeps every figure under its own heading', async () => {
    const user = renderTable()
    expect(headerTexts()).toEqual(['Nazwa', 'Netto', 'Etap'])

    await user.click(screen.getByText('toggle:net'))

    expect(headerTexts()).toEqual(['Nazwa', 'Etap'])
    expect(firstRowTexts()).toEqual(['Wylewka', 'Etap 1'])
  })

  it('restores the column in place when it is toggled back on', async () => {
    const user = renderTable()

    await user.click(screen.getByText('toggle:name'))
    expect(firstRowTexts()).toEqual(['1200', 'Etap 1'])

    await user.click(screen.getByText('toggle:name'))
    expect(headerTexts()).toEqual(['Nazwa', 'Netto', 'Etap'])
    expect(firstRowTexts()).toEqual(['Wylewka', '1200', 'Etap 1'])
  })

  it('leaves no orphan cells when every column is hidden', async () => {
    const user = renderTable()

    for (const id of ['name', 'net', 'stage']) await user.click(screen.getByText(`toggle:${id}`))

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
    expect(firstBodyRow().querySelectorAll('td')).toHaveLength(0)
  })
})

// The symptom above cannot be reproduced here: it only appears in a compiled build, where the React
// Compiler's babel plugin memoizes <DataTableRow> and a visibility toggle changes none of its props.
// Vitest goes through esbuild with no such plugin, so the row re-renders regardless and the three
// assertions above pass with or without the fix. What IS observable in jsdom is the mechanism the fix
// relies on — the visible-column set is part of the row's key, so changing it remounts the row rather
// than handing the memoized one back.
describe('DataTable — the row key that defeats the compiler cache', () => {
  it('replaces the row element when the visible-column set changes', async () => {
    const user = renderTable()
    const before = firstBodyRow()

    await user.click(screen.getByText('toggle:net'))

    expect(firstBodyRow()).not.toBe(before)
  })

  it('reuses the row element on a re-render that leaves the columns alone', async () => {
    const user = renderTable()
    const before = firstBodyRow()

    // Sorting ascending by etap re-renders the table and leaves this data in the order it was
    // already in, so the row is the same row in the same slot — a stable key, and React keeps
    // the node. Without that half the previous assertion would pass on any re-render.
    await user.click(screen.getByText('Etap'))

    expect(firstRowTexts()).toEqual(['Wylewka', '1200', 'Etap 1'])
    expect(firstBodyRow()).toBe(before)
  })
})
