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
