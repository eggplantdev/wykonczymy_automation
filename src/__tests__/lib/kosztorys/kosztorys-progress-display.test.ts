import { describe, expect, it } from 'vitest'
import {
  COLUMN_LABELS,
  COLUMN_MONEY_AXIS,
  COLUMN_PROGRESS_DISPLAY,
} from '@/lib/kosztorys/column-config'
import { formatPercent, formatPercentPrecise } from '@/lib/kosztorys/format'
import { progressDisplayAllows, type ProgressDisplayT } from '@/lib/kosztorys/progress-display'

describe('progressDisplayAllows', () => {
  it('"values" keeps the stage money columns and drops the percent one', () => {
    expect(progressDisplayAllows('stageValueNet', 'values')).toBe(true)
    expect(progressDisplayAllows('stageValueGross', 'values')).toBe(true)
    expect(progressDisplayAllows('stageValuePercent', 'values')).toBe(false)
  })

  it('"percent" swaps both stage money columns for the single percent one', () => {
    expect(progressDisplayAllows('stageValueNet', 'percent')).toBe(false)
    expect(progressDisplayAllows('stageValueGross', 'percent')).toBe(false)
    expect(progressDisplayAllows('stageValuePercent', 'percent')).toBe(true)
  })

  it('"both" keeps every stage-value column (kwoty + %)', () => {
    expect(progressDisplayAllows('stageValueNet', 'both')).toBe(true)
    expect(progressDisplayAllows('stageValueGross', 'both')).toBe(true)
    expect(progressDisplayAllows('stageValuePercent', 'both')).toBe(true)
  })

  it('"none" hides every tagged stage-value column', () => {
    expect(progressDisplayAllows('stageValueNet', 'none')).toBe(false)
    expect(progressDisplayAllows('stageValueGross', 'none')).toBe(false)
    expect(progressDisplayAllows('stageValuePercent', 'none')).toBe(false)
  })

  it('untagged columns survive every mode except stay-open (fail-open)', () => {
    const untagged = ['stages', 'net', 'gross', 'remaining', 'donePercent', 'description']
    for (const display of ['values', 'percent', 'both', 'none'] as ProgressDisplayT[]) {
      for (const key of untagged) expect(progressDisplayAllows(key, display)).toBe(true)
    }
  })
})

// Catches the rename that silently un-tags a column, and the tag that would put a percentage on the
// netto/brutto axis — where it does not belong, being the same number on either side.
describe('COLUMN_PROGRESS_DISPLAY', () => {
  it('every tagged key is a real column', () => {
    for (const key of Object.keys(COLUMN_PROGRESS_DISPLAY))
      expect(COLUMN_LABELS).toHaveProperty(key)
  })

  it('percent columns are neutral on the netto/brutto axis', () => {
    expect(COLUMN_MONEY_AXIS).not.toHaveProperty('stageValuePercent')
    expect(COLUMN_MONEY_AXIS).not.toHaveProperty('donePercent')
  })
})

describe('formatPercent / formatPercentPrecise', () => {
  it('fraction → percent; integer for the grid, one decimal for the headline', () => {
    expect(formatPercent(0.75)).toBe('75%')
    expect(formatPercentPrecise(0.746)).toBe('74,6%') // pl-PL comma
  })

  it('rounds rather than truncates', () => {
    expect(formatPercent(0.756)).toBe('76%')
    expect(formatPercentPrecise(0.7456)).toBe('74,6%')
  })

  it('no denominator (null) → dash, never 0%', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercentPrecise(null)).toBe('—')
  })

  it('zero is a real 0%, not a dash', () => {
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercentPrecise(0)).toBe('0,0%')
  })

  it('overshoot past 100% shows literally', () => {
    expect(formatPercent(1.2)).toBe('120%')
  })
})
