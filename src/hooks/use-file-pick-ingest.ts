'use client'

import { useEffect, useState, type ChangeEvent } from 'react'

import { useLatestRequest } from '@/hooks/use-latest-request'
import { useTranslation } from '@/hooks/use-translation'
import { reportBlockedFiles } from '@/lib/media/blocked-files-message'
import { ingestPickedFiles } from '@/lib/media/ingest-picked-files'
import { toastMessage } from '@/lib/utils/toast'

/**
 * `isIngesting` is what a caller does NOT get
 * to ignore: a file still converting is not in `files` yet, so submitting mid-ingest would save the
 * row without its attachment.
 */
export function useFilePickIngest() {
  const translator = useTranslation('media')
  const [files, setFiles] = useState<File[]>([])
  const [isIngesting, setIsIngesting] = useState(false)
  const [inputKey, setInputKey] = useState(0)
  const request = useLatestRequest()

  async function ingestPicked(picked: File[]) {
    const isCurrent = request.start()
    setIsIngesting(true)
    try {
      const { files: ingested, blocked } = await ingestPickedFiles(picked)
      if (!isCurrent()) return
      reportBlockedFiles(blocked, translator)
      setFiles(ingested)
      // Only a TOTAL refusal remounts the picker: after a partial block the remount would blank the
      // label and hide the existing-invoice preview, so the survivors would ride along invisibly.
      if (ingested.length === 0) setInputKey((key) => key + 1)
    } catch {
      if (!isCurrent()) return
      // TODO(EX-958) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
      // once Sentry is wired; for now the user gets a generic retry toast.
      toastMessage(translator.t('ingestFailed'), 'error', 6000)
      setFiles([])
      setInputKey((key) => key + 1)
    } finally {
      if (isCurrent()) setIsIngesting(false)
    }
  }

  useEffect(() => request.disown, [request])

  function reset() {
    // Disowning the in-flight ingest also makes its own `finally` a no-op, so the reset has to clear
    // the busy flag itself — otherwise clearing the form mid-convert wedges submit until a reload.
    request.disown()
    setFiles([])
    setIsIngesting(false)
    setInputKey((key) => key + 1)
  }

  return {
    files,
    isIngesting,
    inputKey,
    reset,
    fileInputProps: {
      disabled: isIngesting,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(event.target.files ?? [])
        // Allow re-picking the same file after a reset or a failed ingest.
        event.target.value = ''
        void ingestPicked(picked)
      },
    },
  }
}
