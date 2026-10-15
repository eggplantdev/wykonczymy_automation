import { describe, expect, it, vi } from 'vitest'
import {
  sanitizeClientViewSettings,
  toStoredClientViewSettings,
} from '@/lib/kosztorys/client-view/settings'

// A column added after the stored shape stopped being a hidden ARRAY. Today the ceiling equals the
// frozen legacy set, so only a ceiling widened here reaches the branch a real new column will take.
vi.mock('@/lib/kosztorys/client-view/columns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/kosztorys/client-view/columns')>()
  return {
    ...actual,
    PREVIEW_VISIBLE_COLUMNS: new Set([...actual.PREVIEW_VISIBLE_COLUMNS, 'futureColumn']),
  }
})

describe('toStoredClientViewSettings — a column outside the legacy set', () => {
  it('stores the owner showing a column the code hides by default', () => {
    const defaults = sanitizeClientViewSettings({})
    expect(defaults.hiddenColumns).toContain('futureColumn')

    const shown = defaults.hiddenColumns.filter((key) => key !== 'futureColumn')
    const stored = toStoredClientViewSettings({ ...defaults, hiddenColumns: shown })

    expect(stored.hiddenColumns.futureColumn).toBe(false)
    expect(sanitizeClientViewSettings(stored).hiddenColumns).not.toContain('futureColumn')
  })

  it('stores the owner hiding it again', () => {
    const defaults = sanitizeClientViewSettings({})
    const stored = toStoredClientViewSettings(defaults)

    expect(stored.hiddenColumns.futureColumn).toBe(true)
  })
})
