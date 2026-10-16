import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchFilterInput } from '@/components/filters/search-filter-input'

const DEBOUNCE_MS = 40
const SETTLED = DEBOUNCE_MS * 5

const onChange = vi.fn()

const settle = () => act(async () => void vi.advanceTimersByTime(SETTLED))

function SearchHost({ debounceMs = DEBOUNCE_MS }: { debounceMs?: number }) {
  const [value, setValue] = useState('')
  return (
    <>
      <SearchFilterInput
        value={value}
        onChange={(next) => {
          onChange(next)
          setValue(next)
        }}
        debounceMs={debounceMs}
      />
      <button type="button" onClick={() => setValue('')}>
        Wyczyść
      </button>
    </>
  )
}

function renderInput(props: Parameters<typeof SearchHost>[0] = {}) {
  const view = render(<SearchHost {...props} />)
  return {
    ...view,
    user: userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) }),
    input: screen.getByRole('textbox'),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Testing Library decides whether to pump a frozen clock by looking for a global `jest`, and under
  // Vitest there is none — so it awaits a `setTimeout(…, 0)` that nobody will ever advance and every
  // interaction hangs until the spec times out.
  vi.stubGlobal('jest', { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Pole wyszukiwania — odpytywanie po ciszy', () => {
  it('pisze do rodzica raz, po ostatnim znaku', async () => {
    const { user, input } = renderInput()

    await user.type(input, 'kafl')
    expect(onChange).not.toHaveBeenCalled()

    await settle()

    expect(onChange).toHaveBeenCalledExactlyOnceWith('kafl')
  })

  it('bez opóźnienia oddaje każdy znak od razu', async () => {
    const { user, input } = renderInput({ debounceMs: 0 })

    await user.type(input, 'ab')

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('ab')
  })
})

describe('Pole wyszukiwania — czyszczenie w trakcie odliczania', () => {
  // Chip „Szukaj" stoi dopiero wtedy, gdy fraza doszła do rodzica — stąd pierwsze odczekanie; dopiero
  // kolejny znak jest tym, którego timer biegnie jeszcze w chwili kliknięcia w X.
  it('nie przywraca frazy, gdy ktoś wyczyścił pole przed upływem opóźnienia', async () => {
    const { user, input } = renderInput()

    await user.type(input, 'kafl')
    await settle()

    await user.type(input, 'e')
    await user.click(screen.getByRole('button', { name: 'Wyczyść' }))

    expect(input).toHaveValue('')

    await settle()

    expect(input).toHaveValue('')
    expect(onChange).toHaveBeenCalledExactlyOnceWith('kafl')
  })

  it('przyjmuje frazę wpisaną zaraz po wyczyszczeniu', async () => {
    const { user, input } = renderInput()

    await user.type(input, 'kafl')
    await settle()
    await user.click(screen.getByRole('button', { name: 'Wyczyść' }))
    await user.type(input, 'gres')
    await settle()

    expect(onChange).toHaveBeenLastCalledWith('gres')
    expect(input).toHaveValue('gres')
  })
})

describe('Pole wyszukiwania — zamknięte w trakcie pisania', () => {
  it('nie odpytuje po odmontowaniu', async () => {
    const { user, input, unmount } = renderInput()

    await user.type(input, 'kafl')
    unmount()
    await settle()

    expect(onChange).not.toHaveBeenCalled()
  })
})
