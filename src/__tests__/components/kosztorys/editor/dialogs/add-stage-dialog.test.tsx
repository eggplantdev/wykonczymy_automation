import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddStageDialog } from '@/components/kosztorys/editor/dialogs/add-stage-dialog'
import { KosztorysEditorProvider } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

type EditorContextT = Parameters<typeof KosztorysEditorProvider>[0]['editor']

const workers = [
  { id: 5, name: 'Ekipa Nowak', active: true, role: 'EMPLOYEE', email: 'nowak@example.test' },
  { id: 6, name: 'Jan Kowalski', active: true, role: 'EMPLOYEE', email: 'jan@example.test' },
]

function renderDialog(stages: KosztorysStageT[]) {
  const handleAddStage = vi.fn()
  const editor = { stages, workers, handleAddStage } as unknown as EditorContextT
  render(
    <KosztorysEditorProvider editor={editor}>
      <AddStageDialog open onOpenChange={vi.fn()} />
    </KosztorysEditorProvider>,
  )
  return handleAddStage
}

describe('AddStageDialog', () => {
  // Etapy are added one after another for the same crew on the same terms, so the last one's
  // rozliczenie and pracownik are the likeliest answer for the next.
  it('proposes the last etap’s rozliczenie and pracownik', async () => {
    const handleAddStage = renderDialog([
      { id: 11, ordinal: 1, label: null, plane: 'w_tools', workerId: 6 },
      { id: 12, ordinal: 2, label: null, plane: 'own_tools', workerId: 5 },
    ])

    expect(screen.getByText('Bez narzędzi (pracownik)')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /Pracownik/ })).toHaveTextContent('Ekipa Nowak')

    await userEvent.click(screen.getByRole('button', { name: 'Dodaj' }))

    expect(handleAddStage).toHaveBeenCalledWith('own_tools', 5)
  })

  // With nothing to copy, any default would be a guess the owner confirms without reading.
  it('waits for a rozliczenie on the first etap', () => {
    renderDialog([])

    expect(screen.getByRole('button', { name: 'Dodaj' })).toBeDisabled()
  })
})
