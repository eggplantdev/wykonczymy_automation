'use client'

import { useEffect, useState } from 'react'
import { fetchPdfObjectUrl } from '@/lib/media/pdf-object-url'

type PdfSourceT = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error' }

type FetchedT = { from: string; source: PdfSourceT }

export function usePdfObjectUrl(url: string | undefined): PdfSourceT | undefined {
  const [fetched, setFetched] = useState<FetchedT>()

  useEffect(() => {
    if (!url || url.startsWith('blob:')) return
    const controller = new AbortController()
    let objectUrl: string | undefined

    fetchPdfObjectUrl(url, controller.signal)
      .then((created) => {
        if (controller.signal.aborted) return URL.revokeObjectURL(created)
        objectUrl = created
        setFetched({ from: url, source: { status: 'ready', url: created } })
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setFetched({ from: url, source: { status: 'error' } })
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      // Paging back to this PDF would otherwise hand the frame the URL just revoked.
      setFetched(undefined)
    }
  }, [url])

  if (!url) return undefined
  if (url.startsWith('blob:')) return { status: 'ready', url }
  return fetched?.from === url ? fetched.source : { status: 'loading' }
}
