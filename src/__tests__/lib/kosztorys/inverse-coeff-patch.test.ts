import { describe, expect, it } from 'vitest'
import { inverseGlobalCoeffPatch, inverseSectionCoeffPatch } from '@/lib/kosztorys/v2-rows'

// The panel-edit undo commands (handleGlobalCoeffChange / handleSectionCoeffChange) reverse a change
// by re-issuing the same action with these before-patches. The contract they must satisfy: restore
// ONLY the keys the forward edit touched, with the row's pre-change value.

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

describe('inverseSectionCoeffPatch', () => {
  const current = { sectionWToolsCoeff: 1.4 as number | null, sectionOwnToolsCoeff: null }

  it('mirrors only the touched key', () => {
    expect(inverseSectionCoeffPatch({ wToolsCoeff: 2 }, current)).toEqual({ wToolsCoeff: 1.4 })
  })

  it('restores null (inherit-the-global) — keyed by presence, not != null', () => {
    // The forward edit set ownToolsCoeff to a number; its before value was null. Undo must carry the
    // null back, so `null` here must survive as a present key rather than being dropped.
    expect(inverseSectionCoeffPatch({ ownToolsCoeff: 2 }, current)).toEqual({ ownToolsCoeff: null })
  })

  it('mirrors both keys', () => {
    expect(inverseSectionCoeffPatch({ wToolsCoeff: 2, ownToolsCoeff: 3 }, current)).toEqual({
      wToolsCoeff: 1.4,
      ownToolsCoeff: null,
    })
  })

  it('empty section → no current row → null', () => {
    expect(inverseSectionCoeffPatch({ wToolsCoeff: 2 }, undefined)).toEqual({ wToolsCoeff: null })
  })
})
