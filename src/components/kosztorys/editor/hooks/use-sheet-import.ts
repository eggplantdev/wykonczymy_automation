'use client'

import { useState } from 'react'
import { previewKosztorysImport, type ImportPreviewT } from '@/lib/queries/kosztorys-import-preview'
import type { OnTreeReplacedT } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

type OptionsT = {
  investmentId: number
  onTreeReplaced?: OnTreeReplacedT
}

// a programmatically-opened Radix dialog never fires `onOpenChange`, so it cannot fetch its own report.
export function useSheetImport({ investmentId, onTreeReplaced }: OptionsT) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<ImportPreviewT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  function readPreview() {
    setLoaded(false)
    setPreview(null)
    setError(null)
    void previewKosztorysImport(investmentId)
      .then((res) => {
        setPreview(res.success ? res.data : null)
        setError(res.success ? null : res.error)
      })
      .catch(() => {
        setPreview(null)
        setError('Nie udało się odczytać arkusza Google.')
      })
      .finally(() => setLoaded(true))
  }

  function openImport() {
    setOpen(true)
    readPreview()
  }

  const onImported: OnTreeReplacedT = (opts) => {
    setPreview(null)
    onTreeReplaced?.(opts)
  }

  return {
    openImport,
    importDialogProps: {
      investmentId,
      open,
      onOpenChange: setOpen,
      preview,
      error,
      loaded,
      onMappingSaved: readPreview,
      onImported,
    },
  }
}
