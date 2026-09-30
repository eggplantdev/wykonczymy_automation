import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StageSplitDialog } from '@/components/kosztorys/editor/dialogs/stage-split/stage-split-dialog'
import type { StageSplitT } from '@/lib/kosztorys/types'
import { formatPLN } from '@/lib/utils/format-currency'
import type { WorkerRefT } from '@/types/reference-data'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const ANNA = 1
const BOB = 2
const CEZARY = 3
const WORKERS: WorkerRefT[] = [
  { id: ANNA, name: 'Anna', role: 'EMPLOYEE', email: 'a@t.test' },
  { id: BOB, name: 'Bob', role: 'EMPLOYEE', email: 'b@t.test' },
  { id: CEZARY, name: 'Cezary', role: 'EMPLOYEE', email: 'c@t.test' },
]

// Anna holds the rest; Bob and Cezary are listed after her, so their inputs are textboxes 0 and 1.
const SPLIT: StageSplitT = {
  mode: 'percent',
  members: [
    { workerId: ANNA, value: 0, takesRest: true },
    { workerId: BOB, value: 30, takesRest: false },
    { workerId: CEZARY, value: 0, takesRest: false },
  ],
}

const onSave = vi.fn()

function renderDialog(split: StageSplitT = SPLIT) {
  render(
    <StageSplitDialog
      stageLabel="Łazienka"
      split={split}
      pool={1000}
      workers={WORKERS}
      onSave={onSave}
      onClose={vi.fn()}
    />,
  )
  return userEvent.setup()
}

const saveButton = () => screen.getByRole('button', { name: 'Zapisz' })
const shares = () => screen.getAllByTestId('member-share').map((cell) => cell.textContent)

async function type(user: ReturnType<typeof userEvent.setup>, index: number, text: string) {
  const input = screen.getAllByRole('textbox')[index]
  await user.clear(input)
  await user.type(input, `${text}{Enter}`)
}

beforeEach(() => vi.clearAllMocks())

describe('„Pracownicy etapu…"', () => {
  it('shows each person their złote from the pool as the values change', async () => {
    const user = renderDialog()
    expect(shares()).toEqual([formatPLN(700), formatPLN(300), formatPLN(0)])

    await type(user, 1, '20')
    expect(shares()).toEqual([formatPLN(500), formatPLN(300), formatPLN(200)])
  })

  it('refuses „Zapisz" while the percentages pass 100', async () => {
    const user = renderDialog()
    await type(user, 1, '80')
    expect(saveButton()).toBeDisabled()
  })

  it('refuses „Zapisz" while a value is not a number', async () => {
    const user = renderDialog()
    await type(user, 1, 'abc')
    expect(saveButton()).toBeDisabled()
    expect(shares()).toEqual([formatPLN(700), formatPLN(300), formatPLN(0)])
  })

  it('refuses „Zapisz" while the fixed amounts pass the pool', async () => {
    const user = renderDialog()
    await user.click(screen.getByRole('radio', { name: 'Kwotowo' }))
    // The typed kwota IS the share, so there is no separate „Udział" to show next to it.
    expect(screen.queryByText('Udział')).toBeNull()
    await type(user, 0, '1200')
    expect(saveButton()).toBeDisabled()
  })

  it('refuses „Zapisz" once the rest holder is removed, until someone else takes the rest', async () => {
    const user = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Usuń Anna' }))
    expect(saveButton()).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: 'Główny — Bob' }))
    expect(saveButton()).toBeEnabled()
  })

  it('offers no split for one person — they take the whole pool', async () => {
    const user = renderDialog({
      mode: 'percent',
      members: [
        { workerId: ANNA, value: 0, takesRest: true },
        { workerId: BOB, value: 30, takesRest: false },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'Usuń Anna' }))

    expect(screen.queryByRole('radio', { name: 'Kwotowo' })).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(shares()).toEqual([formatPLN(1000)])
    expect(saveButton()).toBeEnabled()
  })

  it('saves the whole split once', async () => {
    const user = renderDialog()
    await type(user, 1, '20')
    await user.click(saveButton())

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({
      mode: 'percent',
      members: [
        { workerId: ANNA, value: 0, takesRest: true },
        { workerId: BOB, value: 30, takesRest: false },
        { workerId: CEZARY, value: 20, takesRest: false },
      ],
    })
  })
})
