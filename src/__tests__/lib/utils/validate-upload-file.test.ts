import { describe, expect, it } from 'vitest'

import { validateUploadFile } from '@/lib/utils/validate-upload-file'

function file(name: string, type: string, size = 4) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('validateUploadFile', () => {
  it.each([
    ['zdjęcie', file('rzut.jpg', 'image/jpeg')],
    ['HEIC', file('rzut.heic', 'image/heic')],
    ['PDF', file('faktura.pdf', 'application/pdf')],
  ])('accepts %s', (_label, picked) => {
    expect(validateUploadFile(picked)).toBe('')
  })

  // The bytes now reach Blob before the row is created, so a type the collection refuses would bank
  // a blob with no `media` row — and orphan cleanup works on rows, so nothing could find it.
  it.each([
    ['dokument Worda', file('oferta.docx', 'application/vnd.openxmlformats-officedocument')],
    ['archiwum', file('paczka.zip', 'application/zip')],
  ])('refuses %s, which the media collection would reject after the PUT', (_label, picked) => {
    expect(validateUploadFile(picked)).toMatch(/zdjęcia i pliki PDF/)
  })

  it('refuses a file with no type at all', () => {
    expect(validateUploadFile(file('nieznany', ''))).toBe('Nierozpoznany typ pliku')
  })

  it('refuses an empty file', () => {
    expect(validateUploadFile(file('pusty.jpg', 'image/jpeg', 0))).toBe('Plik jest pusty')
  })
})
