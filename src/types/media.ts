/**
 * What a media row IS, as opposed to what it looks like. It exists so a later reader — an AI asked
 * to price a remont from an investment's files — can ask for the rysunki without opening every
 * faktura. The collection's select options are typed against it, so the two cannot drift.
 */
export const MEDIA_KINDS = ['faktura', 'projekt', 'zdjecie', 'inne'] as const
export type MediaKindT = (typeof MEDIA_KINDS)[number]

/**
 * One file, already resolved to something openable. A media row whose `url` is null is dropped
 * upstream rather than carried as a hole — every consumer (preview, ZIP) needs the URL, so a file
 * without one is not a file.
 */
export type PreviewFileT = {
  // The media id, so a single file can be detached. Absent on a locally picked file that hasn't
  // been uploaded yet — there is nothing to detach from.
  id?: number
  url: string
  filename: string | null
  mimeType: string | null
}

/**
 * An openable file plus the small rendition a thumbnail strip shows; PDFs have no rendition.
 *
 * Cross-cutting: produced by the investment and lead queries, consumed by `MediaStrip`.
 */
export type MediaFileT = PreviewFileT & {
  id: number
  thumbnailUrl: string | null
  kind: MediaKindT | null
}

/**
 * Everything the ZIP flow says out loud, per surface. The preview dialog serves faktury on the
 * transfers side and site photos / plans on the lead and investment side, so the wording is a
 * parameter, not a constant — the archive *name* was already parameterised while the toasts still
 * announced „Pobieranie faktur..." over a set of zdjęcia.
 */
export type ArchiveCopyT = {
  // What the archive calls itself: `faktury-…zip` / `pliki-…zip`.
  prefix: string
  // The opening toast, shown before the file count is known.
  progress: string
  // Accusative — the noun only ever appears as the object of „Pobrano".
  noun: readonly [string, string, string]
  // Qualifies a row that carried nothing: „3 pozycje <bez faktury>".
  rowWithoutFile: string
  empty: string
  failed: string
}

/**
 * What a preview surface calls the files it is showing. Every field is required so a new caller
 * has to name its own wording — a default set would quietly re-introduce „faktura" for site photos.
 */
export type PreviewLabelsT = {
  fallbackTitle: string
  // Opens the preview: „Podgląd faktury: <nazwa>".
  previewAria: string
  // What one entry of the set is called — names a file the upload never gave one: „strona-2".
  unit: string
  empty: string
  archive: ArchiveCopyT
  removeOne: string
  removeOneOfMany: string
  preview: string
  removeAll: string
  add: string
}
