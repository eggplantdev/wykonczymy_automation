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
