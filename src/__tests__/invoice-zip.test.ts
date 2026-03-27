import { describe, it, expect } from 'vitest'
import {
  buildUniqueFilename,
  sanitizeForFilename,
  getExtension,
  pluralizeInvoice,
} from '@/lib/export/invoice-zip'

// ── sanitizeForFilename ─────────────────────────────────────────────────

describe('sanitizeForFilename', () => {
  it('replaces spaces with underscores', () => {
    expect(sanitizeForFilename('materiały budowlane')).toBe('materiały_budowlane')
  })

  it('removes illegal filename characters', () => {
    expect(sanitizeForFilename('faktura/2026:01')).toBe('faktura202601')
  })

  it('collapses multiple underscores', () => {
    expect(sanitizeForFilename('a   b')).toBe('a_b')
  })

  it('trims leading and trailing underscores', () => {
    expect(sanitizeForFilename(' hello ')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(sanitizeForFilename('')).toBe('')
  })

  it('removes all dangerous characters', () => {
    expect(sanitizeForFilename('file<>:"/\\|?*name')).toBe('filename')
  })
})

// ── getExtension ────────────────────────────────────────────────────────

describe('getExtension', () => {
  it('returns .pdf for PDF files', () => {
    expect(getExtension('faktura.pdf')).toBe('.pdf')
  })

  it('returns .jpg for image files', () => {
    expect(getExtension('photo.jpg')).toBe('.jpg')
  })

  it('returns last extension for double-dotted files', () => {
    expect(getExtension('archive.tar.gz')).toBe('.gz')
  })

  it('returns empty string for null', () => {
    expect(getExtension(null)).toBe('')
  })

  it('returns empty string for file without extension', () => {
    expect(getExtension('Makefile')).toBe('')
  })
})

// ── buildUniqueFilename ─────────────────────────────────────────────────

describe('buildUniqueFilename', () => {
  it('builds filename from date, description, and original extension', () => {
    const used = new Set<string>()
    const name = buildUniqueFilename('2026-03-15', 'Cegły', 'faktura.pdf', used)
    expect(name).toBe('20260315_Cegły.pdf')
  })

  it('truncates long descriptions to 40 chars', () => {
    const used = new Set<string>()
    const longDesc = 'A'.repeat(60)
    const name = buildUniqueFilename('2026-01-01', longDesc, 'doc.pdf', used)
    const base = name.replace('.pdf', '')
    // 8 chars date + 1 underscore + 40 chars desc = 49
    expect(base).toBe(`20260101_${'A'.repeat(40)}`)
  })

  it('appends counter for duplicate names', () => {
    const used = new Set<string>()
    const name1 = buildUniqueFilename('2026-01-01', 'Test', 'f.pdf', used)
    const name2 = buildUniqueFilename('2026-01-01', 'Test', 'f.pdf', used)
    const name3 = buildUniqueFilename('2026-01-01', 'Test', 'f.pdf', used)

    expect(name1).toBe('20260101_Test.pdf')
    expect(name2).toBe('20260101_Test_1.pdf')
    expect(name3).toBe('20260101_Test_2.pdf')
  })

  it('handles missing original filename (no extension)', () => {
    const used = new Set<string>()
    const name = buildUniqueFilename('2026-06-01', 'Zakup', null, used)
    expect(name).toBe('20260601_Zakup')
  })

  it('sanitizes special characters in description', () => {
    const used = new Set<string>()
    const name = buildUniqueFilename('2026-01-01', 'Faktura/2026:01', 'f.pdf', used)
    expect(name).toBe('20260101_Faktura202601.pdf')
  })

  it('tracks all generated names in the usedNames set', () => {
    const used = new Set<string>()
    buildUniqueFilename('2026-01-01', 'A', 'x.pdf', used)
    buildUniqueFilename('2026-01-01', 'A', 'x.pdf', used)

    expect(used.size).toBe(2)
    expect(used.has('20260101_A.pdf')).toBe(true)
    expect(used.has('20260101_A_1.pdf')).toBe(true)
  })
})

// ── pluralizeInvoice ────────────────────────────────────────────────────

describe('pluralizeInvoice', () => {
  it('returns "fakturę" for 1', () => {
    expect(pluralizeInvoice(1)).toBe('fakturę')
  })

  it('returns "faktury" for 2-4', () => {
    expect(pluralizeInvoice(2)).toBe('faktury')
    expect(pluralizeInvoice(3)).toBe('faktury')
    expect(pluralizeInvoice(4)).toBe('faktury')
  })

  it('returns "faktur" for 5+', () => {
    expect(pluralizeInvoice(5)).toBe('faktur')
    expect(pluralizeInvoice(10)).toBe('faktur')
    expect(pluralizeInvoice(47)).toBe('faktur')
    expect(pluralizeInvoice(100)).toBe('faktur')
  })

  it('returns "faktur" for teens (12-14)', () => {
    expect(pluralizeInvoice(12)).toBe('faktur')
    expect(pluralizeInvoice(13)).toBe('faktur')
    expect(pluralizeInvoice(14)).toBe('faktur')
  })

  it('returns "faktury" for compound 2-4 (22-24, 102-104)', () => {
    expect(pluralizeInvoice(22)).toBe('faktury')
    expect(pluralizeInvoice(23)).toBe('faktury')
    expect(pluralizeInvoice(24)).toBe('faktury')
    expect(pluralizeInvoice(102)).toBe('faktury')
    expect(pluralizeInvoice(103)).toBe('faktury')
  })

  it('returns "faktur" for compound teens (112-114)', () => {
    expect(pluralizeInvoice(112)).toBe('faktur')
    expect(pluralizeInvoice(113)).toBe('faktur')
    expect(pluralizeInvoice(114)).toBe('faktur')
  })
})
