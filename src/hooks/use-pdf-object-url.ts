'use client'

import { useEffect, useState } from 'react'

export type PdfSourceT =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error' }

type FetchedT = { from: string; source: PdfSourceT }

/**
 * The PDF fetched whole and handed to the iframe as a local blob: URL. Pointed at the server URL,
 * the browser's PDF viewer may drop the response and re-load it in byte ranges (the file is served
 * with `accept-ranges: bytes`), and on that path the frame neither paints nor fires `load` — on prod
 * a 30-file rzut set spun forever on first open (2026-10-15). Local bytes leave the viewer nothing
 * to range-load, and the wait becomes a fetch whose end and failure we can see.
 */
export function usePdfObjectUrl(url: string | undefined): PdfSourceT | undefined {
  const [fetched, setFetched] = useState<FetchedT>()
  const isLocal = url?.startsWith('blob:') ?? false

  useEffect(() => {
    if (!url || isLocal) return
    const controller = new AbortController()
    let objectUrl: string | undefined

    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`PDF preview fetch failed: ${response.status}`)
        return response.blob()
      })
      .then((bytes) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        setFetched({ from: url, source: { status: 'ready', url: objectUrl } })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setFetched({ from: url, source: { status: 'error' } })
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url, isLocal])

  if (!url) return undefined
  if (isLocal) return { status: 'ready', url }
  return fetched?.from === url ? fetched.source : { status: 'loading' }
}
