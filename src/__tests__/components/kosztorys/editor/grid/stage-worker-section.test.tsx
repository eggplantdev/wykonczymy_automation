import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DropdownMenu, DropdownMenuContent } from '@/components/ui/dropdown-menu'
import { StageWorkerSection } from '@/components/kosztorys/editor/grid/stage-worker-section'
import type { WorkerRefT } from '@/types/reference-data'

const ANNA = 1
const BARTEK = 2
const CELINA = 3

const worker = (id: number, name: string, active?: boolean): WorkerRefT => ({
  id,
  name,
  role: 'EMPLOYEE',
  email: `${name.toLowerCase()}@t.test`,
  ...(active === undefined ? {} : { active }),
})

// Anna left mid-investment but still holds her etap; Celina left and holds nothing.
const WORKERS = [worker(ANNA, 'Anna', false), worker(BARTEK, 'Bartek'), worker(CELINA, 'Celina', false)]

const onPick = vi.fn()

function renderSection(selectedId: number | null) {
  render(
    <DropdownMenu open>
      <DropdownMenuContent>
        <StageWorkerSection workers={WORKERS} selectedId={selectedId} onPick={onPick} />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
  return userEvent.setup()
}

const widenToEveryone = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('checkbox', { name: 'Aktywni' }))

beforeEach(() => vi.clearAllMocks())

// „Aktywni" is a narrowing the user can widen, not an exclusion they cannot see. Dropping the
// person who holds an etap out of the list reads as no assignment at all, and the next save writes
// that emptiness to the DB.
describe('Roster etapu — kto jest na liście', () => {
  it('zostawia na liście osobę, która etap trzyma, choć już tu nie pracuje', () => {
    renderSection(ANNA)

    expect(screen.getByRole('menuitemcheckbox', { name: 'Anna' })).toBeChecked()
  })

  it('chowa osobę wygaszoną, która nic nie trzyma, dopóki lista nie zostanie rozszerzona', async () => {
    const user = renderSection(ANNA)

    expect(screen.queryByRole('menuitemcheckbox', { name: 'Celina' })).toBeNull()
    await widenToEveryone(user)

    expect(screen.getByRole('menuitemcheckbox', { name: 'Celina' })).toBeInTheDocument()
  })

  // Clearing an assignment is a command, not a name to find — so no narrowing of the list takes it
  // away, because otherwise an etap cannot be freed without clearing the search first.
  it('trzyma „Bez przypisania" poza wyszukiwaniem', async () => {
    const user = renderSection(ANNA)

    await user.type(screen.getByPlaceholderText('Szukaj pracownika...'), 'zzz')

    expect(screen.getByText('Nie znaleziono pracownika.')).toBeInTheDocument()
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Bez przypisania' }))

    expect(onPick).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('oddaje wybraną osobę', async () => {
    const user = renderSection(null)

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Bartek' }))

    expect(onPick).toHaveBeenCalledExactlyOnceWith(BARTEK)
  })
})
