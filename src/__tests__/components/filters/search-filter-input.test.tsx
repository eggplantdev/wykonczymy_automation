import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SearchFilterInput } from '@/components/filters/search-filter-input'

// Real timers: `userEvent` runs on the same clock, and the test is one timer racing another.
// 40ms stands in for the toolbar's 500ms and costs nothing.
const DEBOUNCE_MS = 40
const SETTLED = DEBOUNCE_MS * 5

const onChange = vi.fn()

const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLED))

// Mirrors the real controlled shape: the parent owns the phrase, the input debounces toward it.
// „Wyczyść" writes the parent value directly — that's the race under test below.
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
  return { ...view, user: userEvent.setup(), input: screen.getByRole('textbox') }
}

beforeEach(() => vi.clearAllMocks())

describe('Pole wyszukiwania — odpytywanie po ciszy', () => {
  it('pisze do rodzica raz, po ostatnim znaku', async () => {
    const { user, input } = renderInput()

    await user.type(input, 'kafl')
    expect(onChange).not.toHaveBeenCalled()

    await waitFor(() => expect(onChange).toHaveBeenCalledExactlyOnceWith('kafl'))
  })

  it('bez opóźnienia oddaje każdy znak od razu', async () => {
    const { user, input } = renderInput({ debounceMs: 0 })

    await user.type(input, 'ab')

    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('ab')
  })
})

// Błąd z bramki 2026-08-18 (naprawiony bez testu): X czyści frazę u rodzica, ale timer ostatniego
// znaku wciąż biegnie i pół sekundy później wpisuje ją z powrotem.
describe('Pole wyszukiwania — czyszczenie w trakcie odliczania', () => {
  // Chip „Szukaj" stoi dopiero wtedy, gdy fraza doszła do rodzica — stąd pierwsze odczekanie; dopiero
  // kolejny znak jest tym, którego timer biegnie jeszcze w chwili kliknięcia w X.
  it('nie przywraca frazy, gdy ktoś wyczyścił pole przed upływem opóźnienia', async () => {
    const { user, input } = renderInput()

    await user.type(input, 'kafl')
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('kafl'))

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
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('kafl'))
    await user.click(screen.getByRole('button', { name: 'Wyczyść' }))
    await user.type(input, 'gres')

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('gres'))
    expect(input).toHaveValue('gres')
  })
})

// Odmontowanie to trzecie wyjście: dialogi z wyszukiwarką zamykają się w trakcie pisania, a timer
// przeżywający zamknięcie odpytywałby o frazę, której nikt już nie widzi.
describe('Pole wyszukiwania — zamknięte w trakcie pisania', () => {
  it('nie odpytuje po odmontowaniu', async () => {
    const { user, input, unmount } = renderInput()

    await user.type(input, 'kafl')
    unmount()
    await settle()

    expect(onChange).not.toHaveBeenCalled()
  })
})
