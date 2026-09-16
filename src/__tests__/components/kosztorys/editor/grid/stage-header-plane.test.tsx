import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StageHeader } from '@/components/kosztorys/editor/grid/stage-header'
import { STAGE_HEADER_COPY as COPY } from '@/components/kosztorys/editor/grid/stage-header-copy'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'

const STAGE_ID = 7
const ANNA = 1

const WORKERS: WorkerRefT[] = [
  { id: ANNA, name: 'Anna', role: 'EMPLOYEE', email: 'anna@t.test' },
]

const stage = (plane: ToolPlaneT | null): KosztorysStageT => ({
  id: STAGE_ID,
  ordinal: 1,
  label: 'Łazienka',
  plane,
  workerId: null,
})

const onSetPlane = vi.fn()
const onSetWorker = vi.fn()

function renderHeader(plane: ToolPlaneT | null) {
  render(
    <StageHeader
      stage={stage(plane)}
      onRename={vi.fn()}
      onRemove={vi.fn()}
      onSetPlane={onSetPlane}
      workers={WORKERS}
      onSetWorker={onSetWorker}
    />,
  )
  return userEvent.setup()
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByTitle('Opcje etapu'))

const UNCONFIRMED_BADGE = 'Rozliczenie etapu niepotwierdzone'

beforeEach(() => vi.clearAllMocks())

// An etap with no rozliczenie enters no crew's account, so the header has to shout that in the
// column itself — not in the panel beside it, which nobody looks at while typing quantities.
describe('Nagłówek etapu — rozliczenie niepotwierdzone', () => {
  it('oznacza etap bez rozliczenia w samym nagłówku', () => {
    renderHeader(null)

    expect(screen.getByLabelText(UNCONFIRMED_BADGE)).toBeInTheDocument()
  })

  it('zdejmuje ostrzeżenie, gdy etap ma rozliczenie', () => {
    renderHeader('w_tools')

    expect(screen.queryByLabelText(UNCONFIRMED_BADGE)).toBeNull()
  })

  it('oddaje wybór rozliczenia z menu etapu', async () => {
    const user = renderHeader(null)
    await openMenu(user)

    await user.click(screen.getByRole('menuitemcheckbox', { name: PLANE_LABELS.own_tools }))

    expect(onSetPlane).toHaveBeenCalledWith(STAGE_ID, 'own_tools')
  })
})

// Assigning a person to an etap with no rozliczenie would name them owed 0 zł: the settlement pass
// rejects such an etap before it computes any kwota. So the roster waits for a rozliczenie rather
// than staying silent.
describe('Nagłówek etapu — roster czeka na rozliczenie', () => {
  it('nie daje kogo przypisać, dopóki rozliczenia nie ma, i mówi dlaczego', async () => {
    const user = renderHeader(null)
    await openMenu(user)

    const menu = within(screen.getByRole('menu'))
    expect(menu.getByText(COPY.workerNeedsPlane)).toBeInTheDocument()
    expect(menu.queryByRole('menuitemcheckbox', { name: 'Anna' })).toBeNull()
    expect(menu.queryByRole('menuitemcheckbox', { name: COPY.workerUnassigned })).toBeNull()
  })

  it('otwiera roster, gdy rozliczenie jest wybrane', async () => {
    const user = renderHeader('w_tools')
    await openMenu(user)

    const menu = within(screen.getByRole('menu'))
    expect(menu.queryByText(COPY.workerNeedsPlane)).toBeNull()

    await user.click(menu.getByRole('menuitemcheckbox', { name: 'Anna' }))
    expect(onSetWorker).toHaveBeenCalledWith(STAGE_ID, ANNA)
  })
})
