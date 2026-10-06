import { describe, expect, it } from 'vitest'
import {
  FULL_PANEL_FRACTION,
  gridHeightBesidePanel,
  isStoredPanelFraction,
  panelTop,
  snapPanelFraction,
} from '@/lib/kosztorys/totals-panel-height'

describe('snapPanelFraction', () => {
  it('folds the panel below 15 % and keeps it open from 15 %', () => {
    expect(snapPanelFraction(0.149)).toEqual({ open: false })
    expect(snapPanelFraction(0.15)).toEqual({ open: true, fraction: 0.15 })
  })

  it('snaps to full height from 90 % and keeps the dragged height below it', () => {
    expect(snapPanelFraction(0.899)).toEqual({ open: true, fraction: 0.899 })
    expect(snapPanelFraction(0.9)).toEqual({ open: true, fraction: FULL_PANEL_FRACTION })
  })
})

describe('gridHeightBesidePanel', () => {
  it('keeps the whole grid height when the panel is folded or at full height', () => {
    expect(gridHeightBesidePanel(800, { open: false, fraction: 0.5 })).toBe(800)
    expect(gridHeightBesidePanel(800, { open: true, fraction: FULL_PANEL_FRACTION })).toBe(800)
  })

  it('gives the grid what the open panel leaves', () => {
    expect(gridHeightBesidePanel(800, { open: true, fraction: 0.25 })).toBe(600)
  })

  it('puts the panel top exactly where the grid ends, rounding included', () => {
    const split = { open: true, fraction: 1 / 3 }

    expect(gridHeightBesidePanel(701, split)).toBe(panelTop(split.fraction, 701))
    expect(Number.isInteger(panelTop(split.fraction, 701))).toBe(true)
  })
})

describe('panelTop', () => {
  it('parks a folded panel below the grid area and pins a full one to its top', () => {
    expect(panelTop(0, 800)).toBe('100%')
    expect(panelTop(FULL_PANEL_FRACTION, 800)).toBe(0)
    expect(panelTop(0.25, 800)).toBe(600)
  })
})

describe('isStoredPanelFraction', () => {
  it('accepts only a height snapping could have written', () => {
    expect(isStoredPanelFraction(0.15)).toBe(true)
    expect(isStoredPanelFraction(1)).toBe(true)
    expect(isStoredPanelFraction(0)).toBe(false)
    expect(isStoredPanelFraction(1.01)).toBe(false)
    expect(isStoredPanelFraction(Number.NaN)).toBe(false)
  })
})
