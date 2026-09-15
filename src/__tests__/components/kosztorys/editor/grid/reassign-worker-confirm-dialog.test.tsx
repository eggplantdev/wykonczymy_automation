import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ReassignWorkerConfirmDialog } from '@/components/kosztorys/editor/grid/reassign-worker-confirm-dialog'
import type { WorkerRefT } from '@/types/reference-data'

const ANNA = 1
const BARTEK = 2

const worker = (id: number, name: string): WorkerRefT => ({
  id,
  name,
  role: 'EMPLOYEE',
  email: `${name.toLowerCase()}@t.test`,
})

const WORKERS = [worker(ANNA, 'Anna'), worker(BARTEK, 'Bartek')]

const onConfirm = vi.fn()
const onCancel = vi.fn()

function renderDialog(targetWorkerId: number | null | undefined, currentWorkerName?: string) {
  render(
    <ReassignWorkerConfirmDialog
      targetWorkerId={targetWorkerId}
      stageLabel="Etap 2"
      executedValue={3_200}
      currentWorkerName={currentWorkerName}
      workers={WORKERS}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return userEvent.setup()
}

beforeEach(() => vi.clearAllMocks())

// Reassigning an etap that already carries executed prace moves money between two rozliczenia: the
// kwota comes off the previous person's due, their wypłaty stay, so their „pozostało do wypłaty"
// goes below zero. A question naming neither person nor kwota is not a question about that
// decision.
describe('Potwierdzenie przepisania etapu', () => {
  it('nazywa kwotę, poprzednią osobę i nową', () => {
    renderDialog(BARTEK, 'Anna')

    const description = screen.getByText(/Etap „Etap 2" ma wykonane prace/)
    expect(description).toHaveTextContent(/3 ?200/)
    expect(description).toHaveTextContent('przypisane do: Anna')
    expect(description).toHaveTextContent('Przepisać na: Bartek')
  })

  // „Bez przypisania" is a full target, not an absence of choice — the etap returns to the
  // unassigned rest and has to name itself that way instead of reading as an unknown worker.
  it('nazywa zdjęcie przypisania po imieniu', () => {
    renderDialog(null, 'Anna')

    expect(screen.getByText(/Przepisać na: Bez przypisania/)).toBeInTheDocument()
  })

  it('mówi „nieznana osoba" tam, gdzie poprzedniej nie ma', () => {
    renderDialog(BARTEK)

    expect(screen.getByText(/przypisane do: nieznana osoba/)).toBeInTheDocument()
  })

  it('nie stoi na ekranie, dopóki nic nie jest w toku', () => {
    renderDialog(undefined, 'Anna')

    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('oddaje wybraną osobę, a nie samo „tak"', async () => {
    const user = renderDialog(BARTEK, 'Anna')

    await user.click(screen.getByRole('button', { name: 'Przepisz' }))

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(BARTEK)
  })

  it('oddaje zdjęcie przypisania jako null, nie jako brak wywołania', async () => {
    const user = renderDialog(null, 'Anna')

    await user.click(screen.getByRole('button', { name: 'Przepisz' }))

    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(null)
  })
})
