/**
 * Pointed at the server URL, the browser's PDF viewer may drop the response and re-load it in byte
 * ranges (the file is served with `accept-ranges: bytes`), and on that path the frame neither paints
 * nor fires `load`
 */
export async function fetchPdfObjectUrl(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`PDF fetch failed: ${response.status}`)
  const bytes = await response.blob()
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
}
