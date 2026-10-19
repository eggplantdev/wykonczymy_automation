import { describe, it, expect } from 'vitest'
import {
  buildArchiveName,
  buildArchiveMessage,
  buildUniqueFilename,
  flattenArchiveRows,
  sanitizeForFilename,
} from '@/lib/media/file-archive'
import { FILE_ARCHIVE_COPY, INVOICE_ARCHIVE_COPY } from '@/lib/media/wording'

describe('sanitizeForFilename', () => {
  it.each([
    ['replaces spaces with underscores', 'materiały budowlane', 'materiały_budowlane'],
    ['collapses multiple underscores', 'a   b', 'a_b'],
    ['trims leading and trailing underscores', ' hello ', 'hello'],
    ['handles empty string', '', ''],
    ['removes all dangerous characters', 'file<>:"/\\|?*name', 'filename'],
  ])('%s', (_case, input, expected) => {
    expect(sanitizeForFilename(input)).toBe(expected)
  })
})

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
})

describe('buildArchiveName', () => {
  it.each([
    ['falls back to prefix and date when no parts are given', [], 'faktury-2026-07-25.zip'],
    [
      'joins parts between the prefix and the date',
      ['Kowalski', 'Wydatki inwestycyjne'],
      'faktury-Kowalski-Wydatki_inwestycyjne-2026-07-25.zip',
    ],
    [
      'strips characters that are illegal in a filename',
      ['ul. Polna 3/5: etap "A"'],
      'faktury-ul._Polna_35_etap_A-2026-07-25.zip',
    ],
    ['drops a part that sanitizes to nothing', ['???', 'Etap'], 'faktury-Etap-2026-07-25.zip'],
  ])('%s', (_case, parts, expected) => {
    expect(buildArchiveName(parts, '2026-07-25', 'faktury')).toBe(expected)
  })
})

describe('buildArchiveMessage', () => {
  it.each([
    [
      'counts pages, not rows, when a row carries several',
      [5, 5, 9, 9],
      INVOICE_ARCHIVE_COPY,
      'Pobrano 9 faktur',
    ],
    [
      'names the shortfall when some rows carry no invoice',
      [5, 3, 3, 3],
      INVOICE_ARCHIVE_COPY,
      'Pobrano 3 z 3 — 2 pozycje bez faktury',
    ],
    [
      'names the shortfall when some pages failed to download',
      [5, 5, 7, 5],
      INVOICE_ARCHIVE_COPY,
      'Pobrano 5 z 7 — 2 nie do pobrania',
    ],
    [
      'names both shortfalls when they occur together',
      [6, 4, 4, 3],
      INVOICE_ARCHIVE_COPY,
      'Pobrano 3 z 4 — 2 pozycje bez faktury, 1 nie do pobrania',
    ],
    [
      'says nothing was attachable when no row carries an invoice',
      [4, 0, 0, 0],
      INVOICE_ARCHIVE_COPY,
      'Brak faktur do pobrania',
    ],
    [
      'distinguishes a total download failure from having nothing to download',
      [4, 2, 2, 0],
      INVOICE_ARCHIVE_COPY,
      'Nie udało się pobrać żadnej faktury',
    ],
    [
      'takes its noun from the caller, not from faktury',
      [1, 1, 3, 3],
      FILE_ARCHIVE_COPY,
      'Pobrano 3 pliki',
    ],
    [
      "qualifies an empty row in the caller's own words",
      [3, 1, 1, 1],
      FILE_ARCHIVE_COPY,
      'Pobrano 1 z 1 — 2 pozycje bez pliku',
    ],
    [
      "says nothing was packable in the caller's own words",
      [1, 0, 0, 0],
      FILE_ARCHIVE_COPY,
      'Brak plików do pobrania',
    ],
  ] as const)(
    '%s',
    (_case, [rows, rowsWithFile, expectedFiles, downloadedFiles], copy, expected) => {
      expect(
        buildArchiveMessage({ rows, rowsWithFile, expectedFiles, downloadedFiles }, copy),
      ).toBe(expected)
    },
  )
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
