import { describe, expect, it } from 'vitest'
import {
  sanitizeClientViewSettings,
  toStoredClientViewSettings,
} from '@/lib/kosztorys/client-view/settings'

// An owner may have hidden every rabat column on purpose, so it must reach no existing document unasked.
const NEW_COLUMN = 'plannedDiscountAmount'

describe('a column outside the legacy set', () => {
  it('is hidden by default', () => {
    expect(sanitizeClientViewSettings({}).hiddenColumns).toContain(NEW_COLUMN)
  })

  it('stays hidden on a stored map that does not mention it', () => {
    const stored = { hiddenColumns: { price: false, discountAmount: false } }
    expect(sanitizeClientViewSettings(stored).hiddenColumns).toContain(NEW_COLUMN)
  })

  it('stays hidden on a legacy array, even one hiding nothing', () => {
    expect(sanitizeClientViewSettings({ hiddenColumns: [] }).hiddenColumns).toContain(NEW_COLUMN)
  })

  it('stores the owner showing it', () => {
    const defaults = sanitizeClientViewSettings({})
    const shown = defaults.hiddenColumns.filter((key) => key !== NEW_COLUMN)
    const stored = toStoredClientViewSettings({ ...defaults, hiddenColumns: shown })

    expect(stored.hiddenColumns[NEW_COLUMN]).toBe(false)
    expect(sanitizeClientViewSettings(stored).hiddenColumns).not.toContain(NEW_COLUMN)
  })

  it('stores the owner hiding it again', () => {
    const stored = toStoredClientViewSettings(sanitizeClientViewSettings({}))

    expect(stored.hiddenColumns[NEW_COLUMN]).toBe(true)
  })
})
