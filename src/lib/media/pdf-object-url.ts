/**
 * The PDF fetched whole and handed out as a local blob: URL. Pointed at the server URL, the browser's
 * PDF viewer may drop the response and re-load it in byte ranges (the file is served with
 * `accept-ranges: bytes`), and on that path the frame neither paints nor fires `load` — on prod a
 * 30-file rzut set spun forever on first open (2026-10-15). Local bytes leave the viewer nothing to
 * range-load. The caller owns the URL and revokes it.
 */
export async function fetchPdfObjectUrl(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`)
  const bytes = await response.blob()
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
}
