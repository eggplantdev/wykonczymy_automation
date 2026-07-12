import { describe, it, expect } from 'vitest'
import { buildReceiptFileName } from '@/lib/utils/receipt-filename'

// Regression guard (manual-checks follow-up): media labels were polluted by stacked
// disambiguators. The Opis-derived name must stay clean and deterministic — the single
// collision-avoidance id is added once at the upload boundary (uploadFile → uniqueFileName),
// not here. See append-short-id.ts.
describe('buildReceiptFileName', () => {
  it('returns the clean Opis-based name with no random short id', () => {
    expect(buildReceiptFileName('Praga 17.06.2026', 'photo.jpg')).toBe('praga-17-06-2026.jpg')
  })

  it('is deterministic across calls (no per-call random suffix)', () => {
    const a = buildReceiptFileName('Leroy Merlin 11.07.2026', 'x.jpeg')
    const b = buildReceiptFileName('Leroy Merlin 11.07.2026', 'x.jpeg')
    expect(a).toBe(b)
  })

  it('lowercases the extension and falls back to "paragon" on an empty Opis', () => {
    expect(buildReceiptFileName('', 'SCAN.PNG')).toBe('paragon.png')
  })
})
