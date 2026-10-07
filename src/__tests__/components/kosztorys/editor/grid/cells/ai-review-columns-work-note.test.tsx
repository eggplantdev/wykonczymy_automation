import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CellProps } from 'react-datasheet-grid'
import { afterEach, describe, expect, it } from 'vitest'

import { workNoteColumn } from '@/components/kosztorys/editor/grid/cells/ai-review-columns'
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
    render(<Cell {...(props as unknown as CellProps<KosztorysV2RowT, typeof column.columnData>)} />)
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
