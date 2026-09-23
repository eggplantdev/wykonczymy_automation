'use client'

import { useEffect, useState, type ChangeEvent } from 'react'

import { useLatestRequest } from '@/hooks/use-latest-request'
import { reportBlockedFiles } from '@/lib/media/blocked-files-message'
import { ingestPickedFiles } from '@/lib/media/ingest-picked-files'
import { toastMessage } from '@/lib/utils/toast'

/**
 * File custody for the pick surfaces that carry one invoice's pages OUTSIDE the form value. Files
 * stay out of the value because they are unserialisable — a persisted draft would either drop them
 * silently or refuse to rehydrate.
 *
 * What is held here is already ingested — HEIC decoded, compressed — so the submit path only ever
 * uploads files Blob will accept. `isIngesting` is what a caller does NOT get
 * to ignore: a file still converting is not in `files` yet, so submitting mid-ingest would save the
 * row without its attachment. Disable submit on it AND re-check it in the action, because a keyboard
 * Enter bypasses the button.
 *
 * `inputKey` is the second thing a caller cannot ignore: put it on the `FileInput`'s `key`. The
 * picker shows the names it was handed, not the ones that survived, so after a rejected file it
 * would otherwise keep advertising an attachment that is not in `files` — the same "you think it
 * attached and it didn't" failure this hook exists to end, one layer up at the display. Everything
 * else the picker needs is `fileInputProps`, spread onto it: the pick handler and the mid-ingest
 * disable travel together so neither call site can wire up half the contract.
 */
export function useFilePickIngest() {
  const [files, setFiles] = useState<File[]>([])
  const [isIngesting, setIsIngesting] = useState(false)
  const [inputKey, setInputKey] = useState(0)
  // Two overlapping picks would otherwise race: last-write-wins on `files`, and whichever settles
  // first re-enables submit while the other is still converting. Both call sites disable the picker
  // mid-ingest, so this is the contract holding itself up rather than trusting them to.
  const request = useLatestRequest()

  // The `finally` is load-bearing: an unexpected rejection (e.g. a chunk-load failure on the lazy
  // HEIC import) must still release the form, or submit stays disabled until a reload.
  async function ingestPicked(picked: File[]) {
    const isCurrent = request.start()
    setIsIngesting(true)
    try {
      const { files: ingested, blocked } = await ingestPickedFiles(picked)
      if (!isCurrent()) return
      reportBlockedFiles(blocked)
      setFiles(ingested)
      // Only a TOTAL refusal remounts the picker: after a partial block the remount would blank the
      // label and hide the existing-invoice preview, so the survivors would ride along invisibly.
      if (ingested.length === 0) setInputKey((key) => key + 1)
    } catch {
      if (!isCurrent()) return
      // TODO(EX-449) SENTRY-REQUIRED: unexpected ingest failure (not a BlockedFileError) — capture
      // once Sentry is wired; for now the user gets a generic retry toast.
      toastMessage('Nie udało się przetworzyć pliku — spróbuj ponownie.', 'error', 6000)
      setFiles([])
      setInputKey((key) => key + 1)
    } finally {
      if (isCurrent()) setIsIngesting(false)
    }
  }

  // An ingest outliving the form would land on a toast about a picker no longer on screen.
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
