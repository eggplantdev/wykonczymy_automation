import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KosztorysAddMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

const handleAddStage = vi.hoisted(() => vi.fn())
const editor = vi.hoisted(() => ({ stages: [] as KosztorysStageT[] }))

vi.mock('@/components/kosztorys/editor/use-kosztorys-editor-context', () => ({
  useKosztorysEditorContext: () => ({
    investmentId: 7,
    sections: [],
    stages: editor.stages,
    isTemplate: false,
    handleAddItem: vi.fn(),
    handleAddSection: vi.fn(),
    handleAppendedSections: vi.fn(),
    handleAddStage,
  }),
}))
vi.mock('@/components/kosztorys/editor/actions/catalogue-picker-host', () => ({
  useCataloguePicker: () => vi.fn(),
}))

async function openMenu() {
  render(<KosztorysAddMenu />)
  await userEvent.click(screen.getByRole('button', { name: 'Dodaj' }))
}

describe('KosztorysAddMenu — „Etap"', () => {
  beforeEach(() => handleAddStage.mockClear())

  // Etapy are opened one after another for the same crew on the same terms, so a new one copies
  // the last one's rozliczenie and wykonawca instead of asking.
  it('adds an etap with the last etap’s rozliczenie and wykonawca', async () => {
    editor.stages = [
      { id: 11, ordinal: 1, label: null, plane: 'w_tools', workerId: 6 },
      { id: 12, ordinal: 2, label: null, plane: 'own_tools', workerId: 5 },
    ]
    await openMenu()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Etap' }))

    expect(handleAddStage).toHaveBeenCalledWith('own_tools', 5)
  })

  it('asks for the rozliczenie when there is no etap to copy', async () => {
    editor.stages = []
    await openMenu()

    expect(screen.queryByRole('menuitem', { name: 'Etap' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: /Etap — bez narzędzi/ }))

    expect(handleAddStage).toHaveBeenCalledWith('own_tools', null)
  })
})
