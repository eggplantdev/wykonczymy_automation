import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KosztorysGlobalSettings } from '@/components/kosztorys/editor/toolbar/kosztorys-global-settings'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/utils/toast', () => ({ toastMessage: vi.fn() }))

const onGlobalCoeffChange = vi.fn()

const OVER_CEILING = /przekracza 65%/

function renderSettings(coeffs = { wTools: 0.6, ownTools: 0.5 }) {
  render(
    <KosztorysGlobalSettings globalCoeffs={coeffs} onGlobalCoeffChange={onGlobalCoeffChange} />,
  )
  const [wTools, ownTools] = screen.getAllByRole('textbox')
  return { user: userEvent.setup(), wTools: wTools as HTMLInputElement, ownTools }
}

const retype = async (
  user: ReturnType<typeof userEvent.setup>,
  input: HTMLElement,
  next: string,
) => {
  await user.clear(input)
  await user.type(input, next)
  await user.tab()
}

beforeEach(() => vi.clearAllMocks())

describe('Mnożnik ceny — sufit ostrzega, nie odmawia', () => {
  it('zapisuje mnożnik powyżej sufitu i ostrzega raz', async () => {
    const { user, wTools } = renderSettings()

    await retype(user, wTools, '0,9')

    expect(onGlobalCoeffChange).toHaveBeenCalledWith({ wToolsCoeff: 0.9 })
    expect(toastMessage).toHaveBeenCalledTimes(1)
    expect(toastMessage).toHaveBeenCalledWith(
      expect.stringMatching(OVER_CEILING),
      'warning',
      expect.any(Number),
    )
  })

  it('przyjmuje mnożnik dokładnie na suficie bez słowa', async () => {
    const { user, ownTools } = renderSettings()

    await retype(user, ownTools, '0,65')

    expect(onGlobalCoeffChange).toHaveBeenCalledWith({ ownToolsCoeff: 0.65 })
    expect(toastMessage).not.toHaveBeenCalled()
  })

  // Asserts the snap-back too, not just the absent commit: DecimalField rejects out of range by
  // writing the old text back, so without it this passes just as well when `type` never landed.
  it('nadal odmawia mnożnika ujemnego', async () => {
    const { user, wTools } = renderSettings()

    await retype(user, wTools, '-0,2')

    expect(onGlobalCoeffChange).not.toHaveBeenCalled()
    expect(toastMessage).not.toHaveBeenCalled()
    expect(wTools).toHaveValue('0.6')
  })

  // DecimalField commits on every blur — it re-parses the input instead of comparing it to the value
  // it was given — so dropping `max` turned „wejdź i wyjdź" on a stored 0,9 into a real save: a toast,
  // a server round-trip and a „Zmiana współczynnika" on the undo stack, for a change nobody made.
  it('milczy, gdy mnożnik ponad sufitem tylko przechodzi przez focus', async () => {
    const { user, wTools, ownTools } = renderSettings({ wTools: 0.9, ownTools: 0.5 })

    await user.click(wTools)
    await user.click(ownTools)

    expect(toastMessage).not.toHaveBeenCalled()
    expect(onGlobalCoeffChange).not.toHaveBeenCalled()
  })

  it('trzyma mnożnik ponad sufitem na czerwono, zanim ktokolwiek go dotknie', () => {
    const { wTools } = renderSettings({ wTools: 0.9, ownTools: 0.5 })

    expect(wTools).toHaveClass('text-destructive')
  })
})
