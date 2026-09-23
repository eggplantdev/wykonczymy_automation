import { describe, it, expect } from 'vitest'
import {
  buildArchiveName,
  buildArchiveMessage,
  buildUniqueFilename,
  flattenArchiveRows,
  sanitizeForFilename,
} from '@/lib/media/file-archive'
import { FILE_ARCHIVE_COPY, INVOICE_ARCHIVE_COPY } from '@/lib/media/wording'

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

describe('buildArchiveName', () => {
  it('falls back to prefix and date when no parts are given', () => {
    expect(buildArchiveName([], '2026-07-25', 'faktury')).toBe('faktury-2026-07-25.zip')
  })

  it('joins parts between the prefix and the date', () => {
    expect(buildArchiveName(['Kowalski', 'Wydatki inwestycyjne'], '2026-07-25', 'faktury')).toBe(
      'faktury-Kowalski-Wydatki_inwestycyjne-2026-07-25.zip',
    )
  })

  it('strips characters that are illegal in a filename', () => {
    expect(buildArchiveName(['ul. Polna 3/5: etap "A"'], '2026-07-25', 'faktury')).toBe(
      'faktury-ul._Polna_35_etap_A-2026-07-25.zip',
    )
  })

  it('drops a part that sanitizes to nothing', () => {
    expect(buildArchiveName(['???', 'Etap'], '2026-07-25', 'faktury')).toBe(
      'faktury-Etap-2026-07-25.zip',
    )
  })
})

describe('buildArchiveMessage', () => {
  it('reports a plain count when every row was packed', () => {
    expect(
      buildArchiveMessage(
        {
          rows: 5,
          rowsWithFile: 5,
          expectedFiles: 5,
          downloadedFiles: 5,
        },
        INVOICE_ARCHIVE_COPY,
      ),
    ).toBe('Pobrano 5 faktur')
  })

  // The bug the row/file split exists to kill: five rows yielding nine pages used to print
  // „Pobrano 9 z 5".
  it('counts pages, not rows, when a row carries several', () => {
    expect(
      buildArchiveMessage(
        {
          rows: 5,
          rowsWithFile: 5,
          expectedFiles: 9,
          downloadedFiles: 9,
        },
        INVOICE_ARCHIVE_COPY,
      ),
    ).toBe('Pobrano 9 faktur')
  })

  it('names the shortfall when some rows carry no invoice', () => {
    expect(
      buildArchiveMessage(
        {
          rows: 5,
          rowsWithFile: 3,
          expectedFiles: 3,
          downloadedFiles: 3,
        },
        INVOICE_ARCHIVE_COPY,
      ),
    ).toBe('Pobrano 3 z 3 — 2 pozycje bez faktury')
  })

  it('names the shortfall when some pages failed to download', () => {
    expect(
      buildArchiveMessage(
        {
          rows: 5,
          rowsWithFile: 5,
          expectedFiles: 7,
          downloadedFiles: 5,
        },
        INVOICE_ARCHIVE_COPY,
      ),
    ).toBe('Pobrano 5 z 7 — 2 nie do pobrania')
  })

  it('names both shortfalls when they occur together', () => {
    expect(
      buildArchiveMessage(
        {
          rows: 6,
          rowsWithFile: 4,
          expectedFiles: 4,
          downloadedFiles: 3,
        },
        INVOICE_ARCHIVE_COPY,
      ),
    ).toBe('Pobrano 3 z 4 — 2 pozycje bez faktury, 1 nie do pobrania')
  })

  it('says nothing was attachable when no row carries an invoice', () => {
    expect(
      buildArchiveMessage(
        {
          rows: 4,
          rowsWithFile: 0,
          expectedFiles: 0,
          downloadedFiles: 0,
        },
        INVOICE_ARCHIVE_COPY,
      ),
    ).toBe('Brak faktur do pobrania')
  })

  it('distinguishes a total download failure from having nothing to download', () => {
    expect(
      buildArchiveMessage(
        {
          rows: 4,
          rowsWithFile: 2,
          expectedFiles: 2,
          downloadedFiles: 0,
        },
        INVOICE_ARCHIVE_COPY,
      ),
    ).toBe('Nie udało się pobrać żadnej faktury')
  })

  // The dialog packs lead photos and rzuty through the same path, so the noun rides in with the
  // caller — it toasted „Pobrano 3 faktury" over a set of zdjęcia until it did.
  it('takes its noun from the caller, not from faktury', () => {
    expect(
      buildArchiveMessage(
        { rows: 1, rowsWithFile: 1, expectedFiles: 3, downloadedFiles: 3 },
        FILE_ARCHIVE_COPY,
      ),
    ).toBe('Pobrano 3 pliki')
  })

  // A lead's gallery reported „2 pozycje bez faktury" over rows that never had one.
  it("qualifies an empty row in the caller's own words", () => {
    expect(
      buildArchiveMessage(
        { rows: 3, rowsWithFile: 1, expectedFiles: 1, downloadedFiles: 1 },
        FILE_ARCHIVE_COPY,
      ),
    ).toBe('Pobrano 1 z 1 — 2 pozycje bez pliku')
  })

  it("says nothing was packable in the caller's own words", () => {
    expect(
      buildArchiveMessage(
        { rows: 1, rowsWithFile: 0, expectedFiles: 0, downloadedFiles: 0 },
        FILE_ARCHIVE_COPY,
      ),
    ).toBe('Brak plików do pobrania')
  })
})

describe('flattenArchiveRows', () => {
  const page = (filename: string) => ({ url: `/media/${filename}`, filename, mimeType: null })

  it('yields one entry per page, in row then page order', () => {
    const files = flattenArchiveRows([
      { date: '2026-03-15', description: 'Cegły', invoices: [page('a.jpg'), page('b.jpg')] },
      { date: '2026-03-16', description: 'Piasek', invoices: [page('c.pdf')] },
    ])

    expect(files).toEqual([
      { url: '/media/a.jpg', name: '20260315_Cegły.jpg' },
      { url: '/media/b.jpg', name: '20260315_Cegły_1.jpg' },
      { url: '/media/c.pdf', name: '20260316_Piasek.pdf' },
    ])
  })

  it('skips a row with no pages rather than emitting an empty entry', () => {
    expect(
      flattenArchiveRows([{ date: '2026-03-15', description: 'Bez faktury', invoices: [] }]),
    ).toEqual([])
  })

  it('dedupes names across rows, not just within one', () => {
    const files = flattenArchiveRows([
      { date: '2026-03-15', description: 'Cegły', invoices: [page('a.jpg')] },
      { date: '2026-03-15', description: 'Cegły', invoices: [page('b.jpg')] },
    ])

    expect(files.map((file) => file.name)).toEqual(['20260315_Cegły.jpg', '20260315_Cegły_1.jpg'])
  })
})
