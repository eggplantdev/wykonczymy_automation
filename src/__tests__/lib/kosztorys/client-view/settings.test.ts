import { describe, expect, it } from 'vitest'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  sanitizeClientViewSettings,
  toStoredClientViewSettings,
  type ClientViewSettingsT,
} from '@/lib/kosztorys/client-view/settings'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/client-view/columns'

const visibleColumns = (settings: ClientViewSettingsT) => {
  const hidden = new Set(settings.hiddenColumns)
  return [...PREVIEW_VISIBLE_COLUMNS].filter((key) => !hidden.has(key))
}

describe('sanitizeClientViewSettings', () => {
  it('answers an empty source with the code default', () => {
    const settings = sanitizeClientViewSettings({})

    expect(visibleColumns(settings).sort()).toEqual(
      [
        'description',
        'plannedQty',
        'currentPlannedQty',
        'unit',
        'price',
        'plannedNet',
        'stageQtySum',
        'net',
        'stages',
        'stageValueNet',
        'donePercent',
      ].sort(),
    )
    expect(settings.hiddenColumns).toContain('remaining')
    expect(settings.hiddenColumns).toContain('currentPlannedNet')
    // An AI draft writes its sources into the komentarz, so no kosztorys shows it unasked.
    expect(settings.hiddenColumns).toContain('note')
    expect(settings.hiddenColumns).toContain('plannedDonePercent')
    expect(settings.hideEmptyRows).toBe(true)
  })

  // The stored value is the HIDDEN set, so „no usable list" must never be read as „hide nothing" —
  // that would serve the whole allowlist.
  it.each([
    ['no source at all', null],
    ['a row with no hidden set', { hideEmptyRows: true }],
    ['a hidden set that is not an array', { hiddenColumns: 'price' }],
    ['a null hidden set', { hiddenColumns: null }],
  ])('falls back to the default hidden set on %s', (_label, source) => {
    expect(sanitizeClientViewSettings(source).hiddenColumns).toEqual(
      sanitizeClientViewSettings({}).hiddenColumns,
    )
  })

  it('keeps an explicitly empty hidden set — that is a real choice, not a malformed one', () => {
    expect(
      sanitizeClientViewSettings({ hiddenColumns: [], hideEmptyRows: true }).hiddenColumns,
    ).toEqual([])
  })

  it('keeps „hide empty rows" off only when it is stored as false', () => {
    expect(
      sanitizeClientViewSettings({ hiddenColumns: [], hideEmptyRows: false }).hideEmptyRows,
    ).toBe(false)
    expect(
      sanitizeClientViewSettings({ hiddenColumns: [], hideEmptyRows: null }).hideEmptyRows,
    ).toBe(true)
  })

  it('drops a stored key that is outside the disclosure ceiling', () => {
    expect(
      sanitizeClientViewSettings({ hiddenColumns: ['price', 'subcontractorPrice'] }).hiddenColumns,
    ).toEqual(['price'])
  })

  it('drops a subcontractor rate key hand-added to the stored settings', () => {
    const settings = sanitizeClientViewSettings({
      hiddenColumns: ['price', planePriceKey('price', 'w_tools'), 'priceCoeff__own_tools'],
    })

    expect(settings.hiddenColumns).toEqual(['price'])
  })

  it('never lets „Opis prac" be hidden', () => {
    expect(
      sanitizeClientViewSettings({ hiddenColumns: ['description', 'unit'] }).hiddenColumns,
    ).toEqual(['unit'])
  })

  it.each([
    ['a key outside the ceiling', { aiPlannedQty: 1, price: 2 }],
    ['a rank on the pinned column', { description: 9, price: 2 }],
    ['a rank that is not a finite number', { price: 2, unit: Number.NaN, net: 'x' }],
  ])('drops %s from the stored order', (_label, columnRanks) => {
    expect(sanitizeClientViewSettings({ hiddenColumns: [], columnRanks }).columnRanks).toEqual({
      price: 2,
    })
  })

  it.each([undefined, null, 'x', 42])('reads a non-object order (%s) as never ordered', (raw) => {
    expect(sanitizeClientViewSettings({ columnRanks: raw }).columnRanks).toEqual({})
  })
})

describe('stored client view settings', () => {
  it('reads a column the stored map does not mention as its code default', () => {
    const settings = sanitizeClientViewSettings({ hiddenColumns: { price: true, net: false } })

    expect(settings.hiddenColumns).toEqual(
      expect.arrayContaining(['price', 'note', 'plannedDonePercent']),
    )
    expect(settings.hiddenColumns).not.toContain('net')
  })

  it('stores one choice per offered column and reads back to the same settings', () => {
    const settings = sanitizeClientViewSettings({
      hiddenColumns: ['price', 'note'],
      columnRanks: { net: 1 },
    })
    const stored = toStoredClientViewSettings(settings)

    expect(stored.hiddenColumns).toMatchObject({ price: true, note: true, net: false })
    expect(Object.keys(stored.hiddenColumns)).not.toContain('description')
    expect(sanitizeClientViewSettings(stored)).toEqual(settings)
  })
})
