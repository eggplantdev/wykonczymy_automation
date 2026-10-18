import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useRegisterBalance } from '@/components/forms/hooks/use-register-balance'
import { getRegisterBalance } from '@/lib/queries/register-balance'
import { toastMessage } from '@/lib/utils/toast'

vi.mock('@/lib/queries/register-balance', () => ({ getRegisterBalance: vi.fn() }))

const balance = (registerBalance: number) => ({ registerBalance })

describe('Saldo kasy — wyścig przestawień', () => {
  it('pokazuje saldo, gdy nic go nie wyprzedziło', async () => {
    vi.mocked(getRegisterBalance).mockResolvedValue(balance(1_200))
    const { result } = renderHook(() => useRegisterBalance())

    await act(() => result.current.fetchRegisterBalance('7'))

    expect(result.current.registerBalance).toBe(1_200)
    expect(result.current.isRegisterBalanceLoading).toBe(false)
  })

  it('nie wpisuje salda kasy, którą w międzyczasie wyczyszczono', async () => {
    const late = Promise.withResolvers<{ registerBalance: number }>()
    vi.mocked(getRegisterBalance).mockReturnValue(late.promise)
    const { result } = renderHook(() => useRegisterBalance())

    act(() => void result.current.fetchRegisterBalance('7'))
    act(() => result.current.resetRegisterBalance())
    await act(async () => late.resolve(balance(1_200)))

    expect(result.current.registerBalance).toBeNull()
  })

  // Wyparte zapytanie ma własne `finally` bezsilne, więc to reset musi zgasić spinner — inaczej pole
  // kręci się w nieskończoność i formularz wygląda na zawieszony.
  it('gasi spinner od razu przy czyszczeniu, nie czekając na odpowiedź', async () => {
    const late = Promise.withResolvers<{ registerBalance: number }>()
    vi.mocked(getRegisterBalance).mockReturnValue(late.promise)
    const { result } = renderHook(() => useRegisterBalance())

    act(() => void result.current.fetchRegisterBalance('7'))
    await waitFor(() => expect(result.current.isRegisterBalanceLoading).toBe(true))

    act(() => result.current.resetRegisterBalance())
    expect(result.current.isRegisterBalanceLoading).toBe(false)

    await act(async () => late.resolve(balance(1_200)))
    expect(result.current.isRegisterBalanceLoading).toBe(false)
  })

  it('zostawia na ekranie saldo nowszej kasy, choćby starsza wróciła później', async () => {
    const first = Promise.withResolvers<{ registerBalance: number }>()
    const second = Promise.withResolvers<{ registerBalance: number }>()
    vi.mocked(getRegisterBalance)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => useRegisterBalance())

    act(() => void result.current.fetchRegisterBalance('7'))
    act(() => void result.current.fetchRegisterBalance('9'))
    await act(async () => second.resolve(balance(900)))
    await act(async () => first.resolve(balance(1_200)))

    expect(result.current.registerBalance).toBe(900)
  })

  it('milczy, gdy przewrócone zapytanie padnie', async () => {
    const late = Promise.withResolvers<{ registerBalance: number }>()
    vi.mocked(getRegisterBalance).mockReturnValue(late.promise)
    const { result } = renderHook(() => useRegisterBalance())

    act(() => void result.current.fetchRegisterBalance('7'))
    act(() => result.current.resetRegisterBalance())
    await act(async () => {
      late.reject(new Error('brak sieci'))
      await late.promise.catch(() => {})
    })

    expect(toastMessage).not.toHaveBeenCalled()
  })

  it('czyści zamiast odpytywać, gdy kasy nie wybrano', async () => {
    const { result } = renderHook(() => useRegisterBalance())

    await act(() => result.current.fetchRegisterBalance(''))

    expect(getRegisterBalance).not.toHaveBeenCalled()
    expect(result.current.registerBalance).toBeNull()
    expect(result.current.isRegisterBalanceLoading).toBe(false)
  })
})
