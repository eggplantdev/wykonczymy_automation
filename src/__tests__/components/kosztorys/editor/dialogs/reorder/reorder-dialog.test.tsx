import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReorderDialog } from '@/components/kosztorys/editor/dialogs/reorder/reorder-dialog'
import { useUndoKeyboard } from '@/components/kosztorys/editor/hooks/use-undo-keyboard'
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

const renderDialog = () => render(<ReorderDialog onClose={vi.fn()} />)

const row = (description: string) => screen.getByText(description)
const sectionHeader = (name: string) =>
  screen.getByText(name).closest('[data-section-id]') as HTMLElement
const saveButton = () => screen.getByRole('button', { name: 'Zapisz kolejność' })
const moveHere = (name: string) =>
  userEvent.click(within(sectionHeader(name)).getByRole('button', { name: /Przenieś tutaj/ }))

describe('ReorderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    editor.flushPendingSaves.mockResolvedValue(undefined)
    writeLayout.mockResolvedValue({ success: true })
  })

  it('a Shift-click selects the whole range from the last clicked row, across sections', () => {
    renderDialog()

    fireEvent.click(row('Malowanie'))
    fireEvent.click(row('Glazura'), { shiftKey: true })

    expect(screen.getByText('Zaznaczone: 3')).toBeInTheDocument()
  })

  it('the section checkbox selects all its rows, and shows a partial selection as mixed', async () => {
    renderDialog()
    const salonCheckbox = within(sectionHeader('Salon')).getByRole('checkbox')

    fireEvent.click(row('Gruntowanie'))
    expect(salonCheckbox).toHaveAttribute('aria-checked', 'mixed')

    await userEvent.click(salonCheckbox)
    expect(salonCheckbox).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Zaznaczone: 3')).toBeInTheDocument()
  })

  it('keeps „Zapisz kolejność” disabled while nothing has moved', () => {
    renderDialog()

    fireEvent.click(row('Malowanie'))

    expect(saveButton()).toBeDisabled()
  })

  it('„Przenieś tutaj” appends the selection to that section in its order, and the save sends that layout', async () => {
    renderDialog()

    fireEvent.click(row('Listwy'))
    fireEvent.click(row('Gruntowanie'))
    await moveHere('Kuchnia')
    await userEvent.click(saveButton())

    await waitFor(() => expect(writeLayout).toHaveBeenCalledTimes(1))
    expect(writeLayout).toHaveBeenCalledWith(7, [
      { sectionId: SALON, itemIds: [11] },
      { sectionId: KUCHNIA, itemIds: [20, 10, 12] },
    ])
    expect(editor.onTreeReplaced).toHaveBeenCalledWith({ refetch: false })
  })

  it('writes the layout only after the pending cell saves have settled', async () => {
    let settle!: () => void
    editor.flushPendingSaves.mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve
      }),
    )
    renderDialog()

    fireEvent.click(row('Gruntowanie'))
    await moveHere('Kuchnia')
    await userEvent.click(saveButton())

    expect(editor.flushPendingSaves).toHaveBeenCalledTimes(1)
    expect(writeLayout).not.toHaveBeenCalled()

    settle()
    await waitFor(() => expect(writeLayout).toHaveBeenCalledTimes(1))
  })

  it('„Cofnij” takes back the last move and „Ponów” brings it back, before anything is saved', async () => {
    renderDialog()
    fireEvent.click(row('Gruntowanie'))
    await moveHere('Kuchnia')
    fireEvent.click(row('Gruntowanie'))
    fireEvent.click(row('Malowanie'))
    await moveHere('Kuchnia')

    await userEvent.click(screen.getByRole('button', { name: 'Cofnij' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cofnij' }))
    expect(saveButton()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cofnij' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Ponów' }))
    await userEvent.click(saveButton())

    await waitFor(() => expect(writeLayout).toHaveBeenCalledTimes(1))
    expect(writeLayout).toHaveBeenCalledWith(7, [
      { sectionId: SALON, itemIds: [11, 12] },
      { sectionId: KUCHNIA, itemIds: [20, 10] },
    ])
    expect(editor.flushPendingSaves).toHaveBeenCalledTimes(1)
  })

  it('Ctrl+Z undoes the move inside the dialog and leaves the editor’s grid undo alone', async () => {
    const gridUndo = vi.fn()
    renderHook(() => useUndoKeyboard(gridUndo, vi.fn()))
    renderDialog()
    fireEvent.click(row('Gruntowanie'))
    await moveHere('Kuchnia')
    expect(saveButton()).toBeEnabled()

    await userEvent.keyboard('{Control>}z{/Control}')

    expect(saveButton()).toBeDisabled()
    expect(gridUndo).not.toHaveBeenCalled()
  })
})
