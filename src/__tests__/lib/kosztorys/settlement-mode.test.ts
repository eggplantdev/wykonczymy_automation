import { describe, expect, it } from 'vitest'
import {
  effectiveMaterialsNetRate,
  SETTLEMENT_MODES,
  settlementModeToMoneyAxis,
} from '@/lib/kosztorys/settlement-mode'
import { isOffPlaneDeposit } from '@/lib/kosztorys/off-plane-deposits'
import { computeAmountDue } from '@/lib/kosztorys/summary-economics'

const NO_DEPOSITS = { net: 0, gross: 0 }

describe('settlement mode projections', () => {
  it('settles Mieszane on netto, the plane its wpłaty share', () => {
    expect(settlementModeToMoneyAxis('MIXED')).toBe('net')
  })

  it('projects a single-plane mode to that plane', () => {
    expect(settlementModeToMoneyAxis('NET')).toBe('net')
    expect(settlementModeToMoneyAxis('GROSS')).toBe('gross')
  })

  it('gives every tryb exactly one money column — never both, never none', () => {
    for (const mode of SETTLEMENT_MODES) {
      expect(['net', 'gross']).toContain(settlementModeToMoneyAxis(mode))
    }
  })
})

describe('effectiveMaterialsNetRate', () => {
  it('goes inert under GROSS whatever rate is saved', () => {
    expect(effectiveMaterialsNetRate('GROSS', 0.25)).toBeNull()
    expect(effectiveMaterialsNetRate('GROSS', 0)).toBeNull()
    expect(effectiveMaterialsNetRate('GROSS', null)).toBeNull()
  })

  it('hands the saved rate through untouched under NET and MIXED', () => {
    expect(effectiveMaterialsNetRate('NET', 0.25)).toBe(0.25)
    expect(effectiveMaterialsNetRate('MIXED', 0.25)).toBe(0.25)
    expect(effectiveMaterialsNetRate('NET', null)).toBeNull()
    expect(effectiveMaterialsNetRate('MIXED', null)).toBeNull()
  })
})

describe('the stored mode still changes the reading at VAT 0%', () => {
  const VAT_ZERO = 0

  it('bills materiały differently under NET than under GROSS', () => {
    const materials = { grossBase: 1230, netBilled: 0 }
    const underNet = computeAmountDue(1000, NO_DEPOSITS, materials, VAT_ZERO, 0.23)
    const underGross = computeAmountDue(1000, NO_DEPOSITS, materials, VAT_ZERO, null)

    expect(underNet.net).not.toBe(underGross.net)
    expect(underNet.gross).not.toBe(underGross.gross)
    expect(underGross.gross - underNet.gross).toBeCloseTo(230)
  })

  it('keeps Mieszane a different reading from tryb netto — this is why the third mode exists', () => {
    const przelew = { vatPlane: 'GROSS' as const }

    expect(isOffPlaneDeposit(przelew, 'NET')).toBe(true)
    expect(isOffPlaneDeposit(przelew, 'MIXED')).toBe(false)
  })
})
