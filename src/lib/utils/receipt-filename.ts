import { sanitizeFileName } from './sanitize-filename'
import { splitExtension } from './append-short-id'

// Collapse the date's dots to dashes, so the date can't read as a file extension.
export function buildReceiptFileName(description: string, originalName: string): string {
  const { ext } = splitExtension(originalName)
  const base =
    sanitizeFileName(description.replace(/\./g, '-'))
      .toLowerCase()
      .replace(/^-+|-+$/g, '') || 'paragon'
  return `${base}${ext.toLowerCase()}`
}

function pageFilename(name: string, index: number): string {
  if (index === 0) return name
  const { base, ext } = splitExtension(name)
  return `${base}-${index + 1}${ext}`
}

export function renamePages(pages: File[], name: string): File[] {
  return pages.map(
    (file, index) => new File([file], pageFilename(name, index), { type: file.type }),
  )
}
