export type AllowedMimeT =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'image/heic'
  | 'application/pdf'

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])

const ascii = (head: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...head.subarray(from, to))

const startsWith = (head: Uint8Array, signature: number[]) =>
  head.length >= signature.length && signature.every((byte, i) => head[i] === byte)

/**
 * The stored type, decided from the file's first bytes rather than the browser's declared type —
 * the fast path writes the row itself, so nothing downstream re-checks it. An allowlist: anything
 * not recognised (SVG, HTML, a renamed text file) is refused, because a public blob served with an
 * attacker-chosen type is how an upload becomes a script.
 */
export function sniffMime(head: Uint8Array): AllowedMimeT | null {
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (ascii(head, 0, 6) === 'GIF87a' || ascii(head, 0, 6) === 'GIF89a') return 'image/gif'
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'image/webp'
  if (ascii(head, 4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(head, 8, 12))) return 'image/heic'
  if (ascii(head, 0, 5) === '%PDF-') return 'application/pdf'
  return null
}
