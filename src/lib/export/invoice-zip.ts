export function buildUniqueFilename(
  date: string,
  description: string,
  originalFilename: string | null,
  usedNames: Set<string>,
): string {
  const dateStr = date.slice(0, 10).replace(/-/g, '')
  const safeDesc = sanitizeForFilename(description).slice(0, 40)
  const ext = getExtension(originalFilename)
  const base = `${dateStr}_${safeDesc}`

  let name = `${base}${ext}`
  let counter = 1
  while (usedNames.has(name)) {
    name = `${base}_${counter}${ext}`
    counter++
  }

  usedNames.add(name)
  return name
}

export function sanitizeForFilename(str: string): string {
  return str
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

export function getExtension(filename: string | null): string {
  if (!filename) return ''
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex >= 0 ? filename.slice(dotIndex) : ''
}

export function pluralizeInvoice(count: number): string {
  if (count === 1) return 'fakturę'
  const lastTwo = count % 100
  const lastOne = count % 10
  if (lastOne >= 2 && lastOne <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'faktury'
  return 'faktur'
}
