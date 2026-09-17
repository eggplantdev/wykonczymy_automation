import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ColumnDef } from '@tanstack/react-table'

import { DataTable, type DataTableToolbarContextT } from '@/components/tables/data-table/data-table'
import { rankForMove } from '@/lib/table/column-order'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}))

const STORAGE_KEY = 'transfers'
const ORDER_KEY = `table-column-order:${STORAGE_KEY}`
const VISIBILITY_KEY = `table-columns:${STORAGE_KEY}`

type RowT = { date: string; amount: number; note: string }

const COLUMNS: ColumnDef<RowT, unknown>[] = [
  { id: 'date', header: 'Data', accessorKey: 'date' },
  { id: 'amount', header: 'Kwota', accessorKey: 'amount' },
  { id: 'note', header: 'Opis', accessorKey: 'note' },
]

const ROWS: RowT[] = [{ date: '2026-09-01', amount: 100, note: 'zaliczka' }]

// The pointer drag is the one genuinely browser-level piece, so the spec reaches the same commit
// the dialog's `onDragEnd` reaches — the rank algebra behind it is unit-tested.
function moveTo(ctx: DataTableToolbarContextT<RowT>, key: string, index: number) {
  const keys = ctx.table.getAllLeafColumns().map((column) => column.id)
  const dropped = [...keys.filter((id) => id !== key)]
  dropped.splice(index, 0, key)
  ctx.setRank(key, rankForMove(keys, key, index, ctx.ranks, ctx.baseRanks))
  return dropped
}

function renderTable() {
  const view = render(
    <DataTable
      data={ROWS}
      columns={COLUMNS}
      storageKey={STORAGE_KEY}
      toolbar={(ctx) => (
        <>
          <button onClick={() => moveTo(ctx, 'note', 0)}>Opis na początek</button>
          <button onClick={() => ctx.table.getColumn('amount')?.toggleVisibility(false)}>
            Ukryj kwotę
          </button>
          <button onClick={ctx.resetOrder}>Przywróć domyślną kolejność</button>
        </>
      )}
    />,
  )
  return { user: userEvent.setup(), ...view }
}

const headerOrder = () =>
  screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim() ?? '')

const click = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('button', { name }))

beforeEach(() => localStorage.clear())

// Kolejność kolumn jest ustawieniem czytelnika, nie sesji — gdyby nie wracała po przeładowaniu,
// każde wejście na listę zaczynałoby się od układania jej od nowa.
describe('Kolejność kolumn — przeżywa przeładowanie', () => {
  it('startuje w kolejności zadeklarowanej, gdy nic nie zapisano', () => {
    renderTable()

    expect(headerOrder()).toEqual(['Data', 'Kwota', 'Opis'])
  })

  it('zapisuje przestawienie i pokazuje je od razu', async () => {
    const { user } = renderTable()

    await click(user, 'Opis na początek')

    expect(headerOrder()).toEqual(['Opis', 'Data', 'Kwota'])
    expect(JSON.parse(localStorage.getItem(ORDER_KEY) ?? '{}')).toHaveProperty('note')
  })

  it('odtwarza zapisaną kolejność na świeżym montowaniu', async () => {
    const { user, unmount } = renderTable()
    await click(user, 'Opis na początek')
    unmount()

    renderTable()

    expect(headerOrder()).toEqual(['Opis', 'Data', 'Kwota'])
  })

  it('czyta kolejność zapisaną przez kogoś innego, nie tylko własną', () => {
    localStorage.setItem(ORDER_KEY, JSON.stringify({ note: -1 }))

    renderTable()

    expect(headerOrder()).toEqual(['Opis', 'Data', 'Kwota'])
  })
})

// Kolejność i widoczność to dwa osobne klucze — „Przywróć domyślną kolejność" jest tylko o kolejności,
// więc odkrycie schowanej kolumny byłoby cofnięciem decyzji, której nikt nie cofał.
describe('Kolejność kolumn — przywrócenie domyślnej', () => {
  it('wraca do kolejności zadeklarowanej i czyści zapis', async () => {
    const { user } = renderTable()
    await click(user, 'Opis na początek')

    await click(user, 'Przywróć domyślną kolejność')

    expect(headerOrder()).toEqual(['Data', 'Kwota', 'Opis'])
    expect(JSON.parse(localStorage.getItem(ORDER_KEY) ?? '{}')).toEqual({})
  })

  it('zostawia schowaną kolumnę schowaną', async () => {
    const { user } = renderTable()
    await click(user, 'Ukryj kwotę')
    await click(user, 'Opis na początek')

    await click(user, 'Przywróć domyślną kolejność')

    expect(headerOrder()).toEqual(['Data', 'Opis'])
    expect(JSON.parse(localStorage.getItem(VISIBILITY_KEY) ?? '{}')).toEqual({ amount: false })
  })
})
