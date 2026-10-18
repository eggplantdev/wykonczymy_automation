import { describe, it, expect } from 'vitest'
import { buildReceiptFileName } from '@/lib/utils/receipt-filename'

describe('buildReceiptFileName', () => {
  it('returns the clean Opis-based name with no random short id', () => {
    expect(buildReceiptFileName('Praga 17.06.2026', 'photo.jpg')).toBe('praga-17-06-2026.jpg')
  })

  it('lowercases the extension and falls back to "paragon" on an empty Opis', () => {
    expect(buildReceiptFileName('', 'SCAN.PNG')).toBe('paragon.png')
  })
})
