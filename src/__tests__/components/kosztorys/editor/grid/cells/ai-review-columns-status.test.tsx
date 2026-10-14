import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CellProps } from 'react-datasheet-grid'
import { describe, expect, it } from 'vitest'

import { row } from '@/__tests__/lib/kosztorys/row-conditions/fixtures'
import { reviewStatusColumn } from '@/components/kosztorys/editor/grid/cells/ai-review-columns'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

async function openStatusMenu(rowData: KosztorysV2RowT) {
  const Cell = reviewStatusColumn('Status').component!
  const props = { rowData, setRowData: () => {}, disabled: false }
  render(<Cell {...(props as unknown as CellProps<KosztorysV2RowT, unknown>)} />)
  await userEvent.setup().click(screen.getByRole('button'))
  return screen.getAllByRole('menuitem').map((item) => item.textContent)
}

describe('Status — the menu offers only what a pick can change', () => {
  it('offers „Do sprawdzenia" while the row is still to check', async () => {
    const options = await openStatusMenu(row({ aiPlannedQty: 12, plannedQty: 0 }))
    expect(options).toContain('Do sprawdzenia')
  })

  // The same quantities read Zaakceptowana with no status stored, so clearing it would change nothing.
  it('drops it where AI przedmiar equals the Przedmiar', async () => {
    const options = await openStatusMenu(
      row({ aiPlannedQty: 12, plannedQty: 12, reviewStatus: 'accepted' }),
    )
    expect(options).not.toContain('Do sprawdzenia')
    expect(options).toContain('Zaakceptowana')
  })
})

describe("Status — a later round's recheck flag (EX-1057)", () => {
  function renderCell(
    rowData: KosztorysV2RowT,
    setRowData: (row: KosztorysV2RowT) => void,
    disabled = false,
  ) {
    const Cell = reviewStatusColumn('Status').component!
    const props = { rowData, setRowData, disabled }
    render(<Cell {...(props as unknown as CellProps<KosztorysV2RowT, unknown>)} />)
  }

  it("shows the flag above the owner's Status, which stays readable", () => {
    renderCell(
      row({ aiPlannedQty: 12, plannedQty: 8, reviewStatus: 'edited', aiRecheck: true }),
      () => {},
    )
    expect(screen.getByText('Do ponownego sprawdzenia')).toBeTruthy()
    expect(screen.getByRole('button').textContent).toContain('Edytowana')
  })

  it('shows it on a disabled cell too', () => {
    renderCell(
      row({ aiPlannedQty: 12, plannedQty: 8, reviewStatus: 'edited', aiRecheck: true }),
      () => {},
      true,
    )
    expect(screen.getByText('Do ponownego sprawdzenia')).toBeTruthy()
  })

  it('shows nothing extra on an unflagged row', () => {
    renderCell(row({ aiPlannedQty: 12, plannedQty: 8, reviewStatus: 'edited' }), () => {})
    expect(screen.queryByText('Do ponownego sprawdzenia')).toBeNull()
  })

  it('re-picking the stored Status lowers the flag', async () => {
    const written: KosztorysV2RowT[] = []
    renderCell(
      row({ aiPlannedQty: 12, plannedQty: 8, reviewStatus: 'edited', aiRecheck: true }),
      (next) => written.push(next),
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('menuitem', { name: /Edytowana/ }))
    expect(written.at(-1)).toMatchObject({ reviewStatus: 'edited', aiRecheck: false })
  })

  it('Delete lowers it as well', () => {
    const column = reviewStatusColumn('Status')
    const flagged = row({
      aiPlannedQty: 12,
      plannedQty: 8,
      reviewStatus: 'edited',
      aiRecheck: true,
    })
    expect(column.deleteValue!({ rowData: flagged, rowIndex: 0 })).toMatchObject({
      reviewStatus: null,
      aiRecheck: false,
    })
  })
})
