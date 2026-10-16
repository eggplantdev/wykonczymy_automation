export const MEDIA_KINDS = ['faktura', 'projekt', 'zdjecie', 'inne'] as const
export type MediaKindT = (typeof MEDIA_KINDS)[number]

export type PreviewFileT = {
  // Absent on a locally picked file that hasn't been uploaded yet.
  id?: number
  url: string
  filename: string | null
  mimeType: string | null
}

export type MediaFileT = PreviewFileT & {
  id: number
  thumbnailUrl: string | null
  kind: MediaKindT | null
}

export type ArchiveCopyT = {
  prefix: string
  kind: 'invoice' | 'file'
}

/**
 * Every field is required so a new caller has to name its own wording — a default set would
 * quietly re-introduce „faktura" for site photos.
 */
export type PreviewLabelsT = {
  fallbackTitle: string
  previewAria: string
  unit: string
  empty: string
  archive: ArchiveCopyT
  removeOne: string
  removeOneOfMany: string
  preview: string
  removeAll: string
  add: string
}
