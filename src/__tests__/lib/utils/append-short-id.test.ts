import { describe, it, expect } from 'vitest'
import { splitExtension } from '@/lib/utils/append-short-id'

describe('splitExtension', () => {
  it.each([
    ['splits a filename into base and extension', 'faktura.pdf', 'faktura', '.pdf'],
    ['splits on the last dot, not the first', 'archive.tar.gz', 'archive.tar', '.gz'],
    ['reports no extension for a bare name', 'Makefile', 'Makefile', ''],
    ['reports no extension for an empty name', '', '', ''],
    ['treats a leading dot as part of the name', '.gitignore', '.gitignore', ''],
  ])('%s', (_case, filename, base, ext) => {
    expect(splitExtension(filename)).toEqual({ base, ext })
  })
})
