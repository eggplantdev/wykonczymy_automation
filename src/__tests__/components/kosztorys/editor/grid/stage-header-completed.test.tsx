import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StageHeader } from '@/components/kosztorys/editor/grid/stage-header'
import { makeStage } from '@/__tests__/helpers/kosztorys-tree'

const STAGE_ID = 7

const stage = (completed: boolean) => makeStage({ id: STAGE_ID, label: 'Łazienka', completed })

const OPS = {
  rename: vi.fn(),
  remove: vi.fn(),
  setPlane: vi.fn(),
  setCompleted: vi.fn(),
  setSplit: vi.fn(),
}

function renderEditorHeader(completed: boolean) {
  render(<StageHeader stage={stage(completed)} ops={OPS} />)
  return userEvent.setup()
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByTitle('Opcje etapu'))

const completedRow = () => screen.getByRole('menuitemcheckbox', { name: 'Etap zakończony' })

beforeEach(() => vi.clearAllMocks())

describe('Nagłówek etapu — etap zakończony (EX-1034)', () => {
  it('zaznacza „Etap zakończony" tylko na etapie zakończonym', async () => {
    const user = renderEditorHeader(true)
    await openMenu(user)

    expect(completedRow()).toHaveAttribute('aria-checked', 'true')
  })

  it('zamyka otwarty etap z menu', async () => {
    const user = renderEditorHeader(false)
    await openMenu(user)

    expect(completedRow()).toHaveAttribute('aria-checked', 'false')
    await user.click(completedRow())

    expect(OPS.setCompleted).toHaveBeenCalledWith(STAGE_ID, true)
  })

  it('otwiera ponownie etap zakończony', async () => {
    const user = renderEditorHeader(true)
    await openMenu(user)
    await user.click(completedRow())

    expect(OPS.setCompleted).toHaveBeenCalledWith(STAGE_ID, false)
  })

  it('podgląd nie dostaje menu etapu', () => {
    render(<StageHeader stage={stage(true)} />)

    expect(screen.queryByTitle('Opcje etapu')).toBeNull()
  })

  it.each([
    ['edytor', () => renderEditorHeader(true)],
    ['podgląd', () => render(<StageHeader stage={stage(true)} />)],
  ])('%s oznacza etap zakończony znacznikiem ✓', (_mount, mount) => {
    mount()

    expect(screen.getByTitle('Etap zakończony')).toBeInTheDocument()
  })

  it('otwarty etap nie ma znacznika', () => {
    render(<StageHeader stage={stage(false)} />)

    expect(screen.queryByTitle('Etap zakończony')).toBeNull()
  })
})
