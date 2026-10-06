import { describe, expect, it } from 'vitest'
import {
  FULL_PANEL_FRACTION,
  gridHeightBesidePanel,
  isStoredPanelFraction,
  panelTopPx,
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

  // The grid's height and the panel's top edge are one figure, so a rounded split can't leave a
  // 1px seam or overlap between them.
  it('puts the panel top exactly where the grid ends, rounding included', () => {
    const split = { open: true, fraction: 1 / 3 }

    expect(gridHeightBesidePanel(701, split)).toBe(panelTopPx(split.fraction, 701))
    expect(Number.isInteger(panelTopPx(split.fraction, 701))).toBe(true)
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
