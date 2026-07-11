import { sanitizeFileName } from './sanitize-filename'

// Build the stored filename from the extracted Opis (vendor + date, e.g. "Leroy Merlin
// 11.07.2026"). Collapse the date's dots and the spaces to dashes and lowercase, so the date
// can't read as a file extension, then append a short random id before the real extension —
// same-vendor/same-date receipts would otherwise collide and race Payload's auto-rename (the
// ValidationError we already hit). Falls back to "paragon" if the Opis sanitizes to nothing.
export function buildReceiptFileName(description: string, originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const ext = dot > 0 ? originalName.slice(dot).toLowerCase() : ''
  const base =
    sanitizeFileName(description.replace(/\./g, '-'))
      .toLowerCase()
      .replace(/^-+|-+$/g, '') || 'paragon'
  const shortId = crypto.randomUUID().slice(0, 6)
  return `${base}-${shortId}${ext}`
}
