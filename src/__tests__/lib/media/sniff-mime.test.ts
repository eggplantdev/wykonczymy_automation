import { describe, it, expect } from 'vitest'
import { sniffMime } from '@/lib/media/sniff-mime'

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(
    parts.flatMap((part) =>
      typeof part === 'string' ? [...part].map((char) => char.charCodeAt(0)) : part,
    ),
  )

describe('sniffMime', () => {
  it.each([
    ['JPEG', bytes([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]), 'image/jpeg'],
    ['PNG', bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), 'image/png'],
    ['GIF87a', bytes('GIF87a', [1, 0]), 'image/gif'],
    ['GIF89a', bytes('GIF89a', [1, 0]), 'image/gif'],
    ['WebP', bytes('RIFF', [0x24, 0, 0, 0], 'WEBPVP8 '), 'image/webp'],
    ['HEIC', bytes([0, 0, 0, 0x18], 'ftypheic', [0, 0, 0, 0]), 'image/heic'],
    ['HEIF', bytes([0, 0, 0, 0x18], 'ftypmif1', [0, 0, 0, 0]), 'image/heic'],
    ['AVIF', bytes([0, 0, 0, 0x1c], 'ftypavif', [0, 0, 0, 0]), 'image/avif'],
    ['an AVIF sequence', bytes([0, 0, 0, 0x1c], 'ftypavis', [0, 0, 0, 0]), 'image/avif'],
    ['little-endian TIFF', bytes('II', [0x2a, 0, 8, 0, 0, 0]), 'image/tiff'],
    ['big-endian TIFF', bytes('MM', [0, 0x2a, 0, 0, 0, 8]), 'image/tiff'],
    ['PDF', bytes('%PDF-1.7\n'), 'application/pdf'],
    ['a PDF behind a BOM', bytes([0xef, 0xbb, 0xbf], '%PDF-1.4\n'), 'application/pdf'],
    ['a PDF behind leading junk', bytes(' '.repeat(900), '%PDF-1.4\n'), 'application/pdf'],
  ])('recognises %s', (_, head, mime) => {
    expect(sniffMime(head)).toBe(mime)
  })

  it.each([
    ['HTML', bytes('<!DOCTYPE html><html>')],
    ['SVG', bytes('<svg xmlns="http://www.w3.org/2000/svg">')],
    ['plain text', bytes('hello world')],
    ['a RIFF that is not WebP', bytes('RIFF', [0x24, 0, 0, 0], 'WAVEfmt ')],
    ['an ftyp box of another brand', bytes([0, 0, 0, 0x18], 'ftypisom', [0, 0, 0, 0])],
    ['empty input', bytes()],
    ['a truncated JPEG marker', bytes([0xff, 0xd8])],
    ['a PDF header past the first KB', bytes(' '.repeat(1024), '%PDF-1.4\n')],
  ])('refuses %s', (_, head) => {
    expect(sniffMime(head)).toBeNull()
  })
})
