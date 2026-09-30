import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StageHeader } from '@/components/kosztorys/editor/grid/stage-header'
import { STAGE_HEADER_COPY as COPY } from '@/components/kosztorys/editor/grid/stage-header-copy'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import type { WorkerRefT } from '@/types/reference-data'

const STAGE_ID = 7
const ANNA = 1

const WORKERS: WorkerRefT[] = [{ id: ANNA, name: 'Anna', role: 'EMPLOYEE', email: 'anna@t.test' }]

const stage = (plane: ToolPlaneT | null): KosztorysStageT => ({
  id: STAGE_ID,
  ordinal: 1,
  label: 'Łazienka',
  plane,
  split: null,
})

const onSetPlane = vi.fn()
const onSetSplit = vi.fn()

function renderHeader(plane: ToolPlaneT | null) {
  render(
    <StageHeader
      stage={stage(plane)}
      onRename={vi.fn()}
      onRemove={vi.fn()}
      onSetPlane={onSetPlane}
      workers={WORKERS}
      onSetSplit={onSetSplit}
    />,
  )
  return userEvent.setup()
}

const openMenu = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByTitle('Opcje etapu'))

const UNCONFIRMED_BADGE = 'Rozliczenie etapu niepotwierdzone'

beforeEach(() => vi.clearAllMocks())

// An etap with no rozliczenie enters no crew's account, so the header has to say it in the column
// itself — not in the panel beside it, which nobody looks at while typing quantities.
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

// Splitting an etap with no rozliczenie would divide a silent 0 zł — the settlement pass rejects such
// an etap before computing any kwota. So the split waits, rather than staying silent.
describe('Nagłówek etapu — podział czeka na rozliczenie', () => {
  it('blokuje „Pracownicy etapu…", dopóki rozliczenia nie ma, i mówi dlaczego', async () => {
    const user = renderHeader(null)
    await openMenu(user)

    const menu = within(screen.getByRole('menu'))
    expect(menu.getByText(COPY.workerNeedsPlane)).toBeInTheDocument()
    expect(menu.getByRole('menuitem', { name: COPY.splitAction })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('otwiera okno podziału, gdy rozliczenie jest wybrane', async () => {
    const user = renderHeader('w_tools')
    await openMenu(user)

    const menu = within(screen.getByRole('menu'))
    expect(menu.queryByText(COPY.workerNeedsPlane)).toBeNull()

    await user.click(menu.getByRole('menuitem', { name: COPY.splitAction }))
    expect(screen.getByRole('dialog', { name: /Pracownicy etapu/ })).toBeInTheDocument()
  })
})

describe('Nagłówek etapu — kto pracuje', () => {
  const BOB = 2
  const TWO: WorkerRefT[] = [
    ...WORKERS,
    { id: BOB, name: 'Bob', role: 'EMPLOYEE', email: 'b@t.test' },
  ]

  it('pokazuje osobę z resztą i liczbę pozostałych', () => {
    render(
      <StageHeader
        stage={{
          ...stage('w_tools'),
          split: {
            mode: 'percent',
            members: [
              { workerId: BOB, value: 30, takesRest: false },
              { workerId: ANNA, value: 0, takesRest: true },
            ],
          },
        }}
        workers={TWO}
        onSetSplit={onSetSplit}
      />,
    )
    expect(screen.getByText('Anna +1')).toBeInTheDocument()
  })

  it('oznacza podział do poprawienia', () => {
    render(
      <StageHeader
        stage={{ ...stage('w_tools'), split: oneWorkerSplit(ANNA) }}
        workers={WORKERS}
        onSetSplit={onSetSplit}
        scaledDown
      />,
    )
    expect(screen.getByLabelText('Podział etapu do poprawienia')).toBeInTheDocument()
    expect(screen.getByText('Anna')).toBeInTheDocument()
  })
})
