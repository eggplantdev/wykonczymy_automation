import { describe, expect, it } from 'vitest'
import { planePriceKey } from '@/lib/kosztorys/plane-price-keys'
import {
  sameClientViewSettings,
  sanitizeClientViewSettings,
  type ClientViewSettingsT,
} from '@/lib/kosztorys/client-view-settings'
import { PREVIEW_VISIBLE_COLUMNS } from '@/lib/kosztorys/column-config'

const visibleColumns = (settings: ClientViewSettingsT) => {
  const hidden = new Set(settings.hiddenColumns)
  return [...PREVIEW_VISIBLE_COLUMNS].filter((key) => !hidden.has(key))
}

describe('sanitizeClientViewSettings', () => {
  // The settlement columns are in the default because they hide themselves until there is an
  // entry; „Pozostało" is not, because nothing hides it on the owner's behalf (owner, 2026-09-28).
  it('answers an empty source with the code default', () => {
    const settings = sanitizeClientViewSettings({})

    expect(visibleColumns(settings).sort()).toEqual(
      [
        'description',
        'plannedQty',
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
    expect(settings.hideEmptyRows).toBe(true)
  })

  // The stored value is the HIDDEN set, so „no usable list" must never be read as „hide nothing" —
  // that would serve the whole allowlist. NULL is what a row carries until someone saves a choice.
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

  // A crew's rate id resembles the client's `price` — it is that key plus a plane — and the stored
  // set is the HIDDEN one, so a key that survived here would be read as „the owner chose to hide
  // this", implying the allowlist could show it. The ceiling matches the full id, never the base.
  it('drops a subcontractor rate key hand-added to the stored settings', () => {
    const settings = sanitizeClientViewSettings({
      hiddenColumns: ['price', planePriceKey('price', 'w_tools'), 'priceCoeff__own_tools'],
    })

    expect(settings.hiddenColumns).toEqual(['price'])
  })
})

describe('sameClientViewSettings', () => {
  it('ignores the order of the hidden set', () => {
    const settings = sanitizeClientViewSettings({})
    const reordered = { ...settings, hiddenColumns: [...settings.hiddenColumns].reverse() }

    expect(sameClientViewSettings(settings, reordered)).toBe(true)
    expect(sameClientViewSettings(settings, { ...settings, hideEmptyRows: false })).toBe(false)
  })
})
