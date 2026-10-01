import { afterEach, describe, expect, it, vi } from 'vitest'

import { whenOnline } from '@/lib/utils/when-online'

const setOnline = (isOnline: boolean) =>
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(isOnline)

afterEach(() => vi.restoreAllMocks())

describe('odświeżenie po przerwanym zapisie', () => {
  it('z siecią odświeża od razu', () => {
    setOnline(true)
    const refresh = vi.fn()

    whenOnline(refresh)

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('bez sieci czeka na jej powrót — raz, nie przy każdym kolejnym', () => {
    setOnline(false)
    const refresh = vi.fn()

    whenOnline(refresh)
    expect(refresh).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('online'))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
