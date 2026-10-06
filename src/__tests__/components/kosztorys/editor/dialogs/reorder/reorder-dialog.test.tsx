import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReorderDialog } from '@/components/kosztorys/editor/dialogs/reorder/reorder-dialog'
import { writeKosztorysLayoutAction } from '@/lib/actions/kosztorys'
import { editorNoun } from '@/lib/kosztorys/editor-noun'

const SALON = 1
const KUCHNIA = 2

const editor = vi.hoisted(() => ({
  flushPendingSaves: vi.fn<() => Promise<void>>(),
  onTreeReplaced: vi.fn(),
}))

vi.mock('@/lib/actions/kosztorys', () => ({ writeKosztorysLayoutAction: vi.fn() }))
vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))
vi.mock('@/components/kosztorys/editor/actions/kosztorys-actions-context', () => ({
  useKosztorysActions: () => ({ reorder: { open: true, setOpen: vi.fn() } }),
}))
vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    investmentId: 7,
    noun: editorNoun(true),
    sections: [
      { sectionId: SALON, sectionName: 'Salon', sectionColor: null },
      { sectionId: KUCHNIA, sectionName: 'Kuchnia', sectionColor: null },
    ],
    rows: [
      { id: 10, sectionId: SALON, description: 'Gruntowanie', unit: 'm2' },
      { id: 11, sectionId: SALON, description: 'Malowanie', unit: 'm2' },
      { id: 12, sectionId: SALON, description: 'Listwy', unit: 'mb' },
      { id: 20, sectionId: KUCHNIA, description: 'Glazura', unit: 'm2' },
    ],
    ...editor,
  }),
}))

const writeLayout = vi.mocked(writeKosztorysLayoutAction)

const row = (description: string) => screen.getByText(description)
const sectionHeader = (name: string) =>
  screen.getByText(name).closest('[data-section-id]') as HTMLElement
const saveButton = () => screen.getByRole('button', { name: 'Zapisz kolejność' })

describe('ReorderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    editor.flushPendingSaves.mockResolvedValue(undefined)
    writeLayout.mockResolvedValue({ success: true })
  })

  it('a Shift-click selects the whole range from the last clicked row, across sections', () => {
    render(<ReorderDialog />)

    fireEvent.click(row('Malowanie'))
    fireEvent.click(row('Glazura'), { shiftKey: true })

    expect(screen.getByText('Zaznaczone: 3')).toBeInTheDocument()
  })

  it('the section checkbox selects all its rows, and shows a partial selection as mixed', async () => {
    render(<ReorderDialog />)
    const salonCheckbox = within(sectionHeader('Salon')).getByRole('checkbox')

    fireEvent.click(row('Gruntowanie'))
    expect(salonCheckbox).toHaveAttribute('aria-checked', 'mixed')

    await userEvent.click(salonCheckbox)
    expect(salonCheckbox).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Zaznaczone: 3')).toBeInTheDocument()
  })

  it('keeps „Zapisz kolejność” disabled while nothing has moved', () => {
    render(<ReorderDialog />)

    fireEvent.click(row('Malowanie'))

    expect(saveButton()).toBeDisabled()
  })

  it('„Przenieś tutaj” appends the selection to that section in its order, and the save sends that layout', async () => {
    render(<ReorderDialog />)

    fireEvent.click(row('Listwy'))
    fireEvent.click(row('Gruntowanie'))
    await userEvent.click(
      within(sectionHeader('Kuchnia')).getByRole('button', { name: /Przenieś tutaj/ }),
    )
    await userEvent.click(saveButton())

    await waitFor(() => expect(writeLayout).toHaveBeenCalledTimes(1))
    expect(writeLayout).toHaveBeenCalledWith(7, [
      { sectionId: SALON, itemIds: [11] },
      { sectionId: KUCHNIA, itemIds: [20, 10, 12] },
    ])
    expect(editor.onTreeReplaced).toHaveBeenCalledWith({ refetch: false })
  })

  // The write reseeds the grid from the server, so a cell typed a moment ago must be stored first.
  it('writes the layout only after the pending cell saves have settled', async () => {
    let settle!: () => void
    editor.flushPendingSaves.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve
      }),
    )
    render(<ReorderDialog />)

    fireEvent.click(row('Gruntowanie'))
    await userEvent.click(
      within(sectionHeader('Kuchnia')).getByRole('button', { name: /Przenieś tutaj/ }),
    )
    await userEvent.click(saveButton())

    expect(editor.flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(writeLayout).not.toHaveBeenCalled()

    settle()
    await waitFor(() => expect(writeLayout).toHaveBeenCalledTimes(1))
  })
})
