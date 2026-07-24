import { describe, expect, it } from 'vitest'
import { inverseGlobalCoeffPatch } from '@/lib/kosztorys/v2-rows'

// The panel-edit undo command (handleGlobalCoeffChange) reverses a change by re-issuing the same
// action with these before-patches. The contract it must satisfy: restore ONLY the keys the forward
// edit touched, with the row's pre-change value.

describe('inverseGlobalCoeffPatch', () => {
  const current = { globalWToolsCoeff: 1.5, globalOwnToolsCoeff: 1.2 }

  it('mirrors only the touched key', () => {
    expect(inverseGlobalCoeffPatch({ wToolsCoeff: 2 }, current)).toEqual({ wToolsCoeff: 1.5 })
    expect(inverseGlobalCoeffPatch({ ownToolsCoeff: 2 }, current)).toEqual({ ownToolsCoeff: 1.2 })
  })

  it('mirrors both when both change', () => {
    expect(inverseGlobalCoeffPatch({ wToolsCoeff: 2, ownToolsCoeff: 3 }, current)).toEqual({
      wToolsCoeff: 1.5,
      ownToolsCoeff: 1.2,
    })
  })

  it('leaves an untouched key absent (undo must not stomp it)', () => {
    const before = inverseGlobalCoeffPatch({ wToolsCoeff: 2 }, current)
    expect('ownToolsCoeff' in before).toBe(false)
  })

  it('empty grid → no current row → undefined value', () => {
    expect(inverseGlobalCoeffPatch({ wToolsCoeff: 2 }, undefined)).toEqual({
      wToolsCoeff: undefined,
    })
  })
})
