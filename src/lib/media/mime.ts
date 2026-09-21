// Whether an invoice page can be rendered at all, and how. Predicates rather than inline
// `startsWith` checks because the preview asks the same question three times — for the page on
// screen, for the printable subset, and again inside the print loop.
// `mimeType` is nullable: a media row uploaded before the field existed carries none.

export function isImageMime(mimeType: string | null | undefined): boolean {
  return mimeType?.startsWith('image/') ?? false
}

export function isPdfMime(mimeType: string | null | undefined): boolean {
  return mimeType === 'application/pdf'
}

export function isPreviewableMime(mimeType: string | null | undefined): boolean {
  return isImageMime(mimeType) || isPdfMime(mimeType)
}
