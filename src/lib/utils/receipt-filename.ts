import { sanitizeFileName } from './sanitize-filename'
import { splitExtension } from './append-short-id'

// Build the stored filename from the extracted Opis (vendor + date, e.g. "Leroy Merlin
// 11.07.2026"). Collapse the date's dots and the spaces to dashes and lowercase, so the date
// can't read as a file extension. Falls back to "paragon" if the Opis sanitizes to nothing.
// The collision-avoidance short id is added once at the upload boundary (uniqueFileName), so this
// stays clean — appending it here too double-stamped the label.
export function buildReceiptFileName(description: string, originalName: string): string {
  const { ext } = splitExtension(originalName)
  const base =
    sanitizeFileName(description.replace(/\./g, '-'))
      .toLowerCase()
      .replace(/^-+|-+$/g, '') || 'paragon'
  return `${base}${ext.toLowerCase()}`
}

// One invoice's pages share its name; page 2 on gets a `-2` suffix.
export function pageFilename(name: string, index: number): string {
  if (index === 0) return name
  const { base, ext } = splitExtension(name)
  return `${base}-${index + 1}${ext}`
}
