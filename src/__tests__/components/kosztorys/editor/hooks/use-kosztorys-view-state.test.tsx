import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useKosztorysViewState } from '@/components/kosztorys/editor/hooks/use-kosztorys-view-state'

// The stored plane outlives the screen that wrote it: it is keyed per investment and only `pickView`
// ever writes it. So every surface that shows no plane switch has to pin its own, or a browser parked
// on a crew plane stays there with no control to come back.

const INVESTMENT_ID = 4242

beforeEach(() => {
  localStorage.clear()
})

const parkOn = (view: string) => localStorage.setItem(`kosztorys-view:${INVESTMENT_ID}`, view)

describe('useKosztorysViewState — płaszczyzna cen', () => {
  it('reopens the editor on the plane the owner left it on', () => {
    parkOn('w_tools')

    const { result } = renderHook(() =>
      useKosztorysViewState({ investmentId: INVESTMENT_ID, preview: false }),
    )

    expect(result.current.view).toBe('w_tools')
  })

  it('pins the szablon workbench to the base plane, whatever is stored', () => {
    parkOn('own_tools')

    const { result } = renderHook(() =>
      useKosztorysViewState({ investmentId: INVESTMENT_ID, preview: false, isWorkshop: true }),
    )

    expect(result.current.view).toBe('client')
  })

  // The problem overlay is the gesture that walks the reader to a fault, and a stawka problem only
  // renders on its own plane — so it still rides above the pin.
  it('still lets an engaged problem take the workbench to the plane it judges', () => {
    const { result } = renderHook(() =>
      useKosztorysViewState({ investmentId: INVESTMENT_ID, preview: false, isWorkshop: true }),
    )

    act(() => result.current.toggleConditionExclusive('negative-rate-own-tools', []))

    expect(result.current.view).toBe('own_tools')
  })

  // The other half of the disclosure lock: the public page ships the full tree, so a client who set
  // the key by hand must still be shown client prices.
  it('pins the client preview even against a stored crew plane', () => {
    parkOn('w_tools')

    const { result } = renderHook(() =>
      useKosztorysViewState({ investmentId: INVESTMENT_ID, preview: true }),
    )

    expect(result.current.view).toBe('client')
  })
})

describe('useKosztorysViewState — „Pokaż wszystkie pozycje"', () => {
  const CLIENT_VIEW = { hiddenColumns: [], hideEmptyRows: true }

  it('lifts the stored hide while on and restores it when switched back off', () => {
    const { result } = renderHook(() =>
      useKosztorysViewState({
        investmentId: INVESTMENT_ID,
        preview: true,
        clientView: CLIENT_VIEW,
      }),
    )
    expect([...result.current.engagedConditionIds]).toEqual(['client-empty'])

    act(() => result.current.setShowAllRows(true))
    expect([...result.current.engagedConditionIds]).toEqual([])

    act(() => result.current.setShowAllRows(false))
    expect([...result.current.engagedConditionIds]).toEqual(['client-empty'])
  })

  it('leaves the owner grid on its own filters', () => {
    const { result } = renderHook(() =>
      useKosztorysViewState({
        investmentId: INVESTMENT_ID,
        preview: false,
        clientView: CLIENT_VIEW,
      }),
    )

    act(() => result.current.setShowAllRows(true))

    expect(result.current.engagedConditionIds.has('client-empty')).toBe(false)
  })
})
