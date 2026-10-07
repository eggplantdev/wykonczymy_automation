import { describe, expect, it } from 'vitest'

import { uploadFileProblem } from '@/lib/media/validate-upload-file'

function file(name: string, type: string, size = 4) {
  return new File([new Uint8Array(size)], name, { type })
}

describe('uploadFileProblem', () => {
  it.each([
    ['zdjęcie', file('rzut.jpg', 'image/jpeg')],
    ['PNG', file('rzut.png', 'image/png')],
    ['HEIC', file('rzut.heic', 'image/heic')],
    ['PDF', file('faktura.pdf', 'application/pdf')],
  ])('accepts %s', (_label, picked) => {
    expect(uploadFileProblem(picked)).toBeUndefined()
  })

  it.each([
    ['dokument Worda', file('oferta.docx', 'application/vnd.openxmlformats-officedocument')],
    ['archiwum', file('paczka.zip', 'application/zip')],
  ])('refuses %s before the upload', (_label, picked) => {
    expect(uploadFileProblem(picked)).toBe('uploadNotImageOrPdf')
  })

  // An image the browser can show but the server's byte sniff refuses: an SVG is markup, and a
  // public blob served as markup is how an upload becomes a script.
  it.each([
    ['SVG', file('logo.svg', 'image/svg+xml')],
    ['BMP', file('skan.bmp', 'image/bmp')],
    ['ICO', file('favicon.ico', 'image/x-icon')],
  ])('refuses %s before the upload, not after it', (_label, picked) => {
    expect(uploadFileProblem(picked)).toBe('uploadNotImageOrPdf')
  })

  it('refuses a file with no type at all', () => {
    expect(uploadFileProblem(file('nieznany', ''))).toBe('uploadNoType')
  })

  it('refuses an empty file', () => {
    expect(uploadFileProblem(file('pusty.jpg', 'image/jpeg', 0))).toBe('uploadEmpty')
  })
})
