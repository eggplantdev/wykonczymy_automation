import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CellProps } from 'react-datasheet-grid'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { workNoteColumn } from '@/components/kosztorys/editor/grid/cells/ai-review-columns'
import { withSyntheticRows } from '@/components/kosztorys/editor/grid/kosztorys-synthetic-rows'
import { withDocumentListener } from '@/__tests__/helpers/document-listener'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// The dialog opens from a click on a grid cell, so that cell stays the grid's active cell, and the
// grid listens on `document`: a key it saw would drive the grid underneath — Backspace deletes the
// selection, Ctrl+A selects every cell — instead of editing the comment.
describe('Komentarz do pracy — what never reaches the grid', () => {
  const stops: (() => void)[] = []
  afterEach(() => stops.splice(0).forEach((stop) => stop()))

  function documentSees(type: string, key?: string) {
    const { seen, stop } = withDocumentListener(type, key)
    stops.push(stop)
    return seen
  }

  async function openDialog() {
    const column = workNoteColumn(
      'Komentarz do pracy',
      new Map([[1, { id: 1, note: 'Skuć do cegły' }]]),
      true,
    )
    const Cell = column.component!
    const props = { rowData: { id: 1 }, columnData: column.columnData, disabled: false }
    render(
      <Cell
        {...(props as unknown as CellProps<KosztorysV2RowT, NonNullable<typeof column.columnData>>)}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Skuć do cegły' }))
    return { user, textarea: screen.getByRole('textbox') }
  }

  it.each(['Backspace', 'Delete', 'ArrowLeft', 'Enter', 'a'])(
    'keeps %s to the comment',
    async (key) => {
      const seen = documentSees('keydown', key)
      const { user, textarea } = await openDialog()

      await user.click(textarea)
      await user.keyboard(`{${key}}`)

      expect(seen).not.toHaveBeenCalled()
    },
  )

  it('keeps a key on the dialog buttons from the grid too', async () => {
    const seen = documentSees('keydown', 'Backspace')
    const { user } = await openDialog()

    screen.getByRole('button', { name: 'Anuluj' }).focus()
    await user.keyboard('{Backspace}')

    expect(seen).not.toHaveBeenCalled()
  })

  it('keeps a paste to the comment', async () => {
    const seen = documentSees('paste')
    const { user, textarea } = await openDialog()

    await user.click(textarea)
    await user.paste(' i zagruntować')

    expect(seen).not.toHaveBeenCalled()
    expect(textarea).toHaveValue('Skuć do cegły i zagruntować')
  })

  it('still closes on Escape', async () => {
    const { user } = await openDialog()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('textbox')).toBeNull()
  })
})

// Regression: the grid wraps every column in `withSyntheticRows`, which spreads `columnData` into an
// object. A bare Map came out of the spread with no `.get`, so turning „Przegląd AI" on crashed the
// whole editor.
describe('workNoteColumn behind withSyntheticRows', () => {
  it('still finds the katalog entry, so its comment shows in the cell', () => {
    const column = withSyntheticRows(
      workNoteColumn('Komentarz do pracy', new Map([[1, { id: 1, note: 'Skuć do cegły' }]]), true),
      {
        totals: new Map(),
        totalLabel: 'Razem',
        sectionHeader: {
          figures: new Map(),
          collapsedSectionIds: new Set<number>(),
          onToggleCollapsed: vi.fn(),
          sortActive: false,
          labelColumnId: 'description',
        },
        sectionFooter: { figures: new Map(), labelColumnId: 'description' },
      },
    )
    const Cell = column.component as React.ComponentType<Record<string, unknown>>
    const rowData = { id: 1, sectionId: 1 } as unknown as KosztorysV2RowT

    render(<Cell rowData={rowData} columnData={column.columnData} focus={false} disabled={false} />)

    expect(screen.getByText('Skuć do cegły')).toBeTruthy()
  })
})
