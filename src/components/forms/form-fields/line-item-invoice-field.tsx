'use client'

import { useEffect, useRef, useState } from 'react'
import { FileInput } from '@/components/ui/file-input'
import { FieldLabel } from '@/components/ui/field'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import { cn } from '@/lib/utils/cn'

const NO_FILES: File[] = []

// Picked files have no URL yet — mint one blob URL per page and revoke them when the page list
// changes/unmounts. Create AND revoke in the same effect so StrictMode's mount→cleanup→remount
// can't leave us holding URLs it already revoked (splitting create into useMemo does).
function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    if (files.length === 0) {
      // Drop the previous run's URLs — the cleanup already revoked them, and leaving them in state
      // would let the pairing guard below match new files against dead handles.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrls((previous) => (previous.length === 0 ? previous : []))
      return
    }
    const objectUrls = files.map((file) => URL.createObjectURL(file))
    // Surfacing the external blob handles into state is the sanctioned effect use — creation
    // must live in the effect so their revoke and these URLs share one lifecycle (StrictMode-safe).

    setUrls(objectUrls)
    return () => objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
  }, [files])
  return urls
}

type LineItemInvoiceFieldPropsT = {
  id: string
  files?: File[]
  fieldClassName?: string
  onFileChange: (id: string, e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (id: string, index: number) => void
}

export function LineItemInvoiceField({
  id,
  files = NO_FILES,
  fieldClassName,
  onFileChange,
  onRemoveFile,
}: LineItemInvoiceFieldPropsT) {
  const urls = useObjectUrls(files)
  const addInputRef = useRef<HTMLInputElement>(null)

  // The URLs land one render after their files, so pair only as far as both go — a page rendered
  // against the previous render's URL would show the wrong image for a frame.
  const pages = files
    .slice(0, urls.length)
    .map((file, index) => ({ url: urls[index], filename: file.name, mimeType: file.type }))

  if (pages.length === 0) {
    return (
      <FileInput
        label="FV"
        fieldClassName={fieldClassName}
        accept="image/*,application/pdf"
        multiple
        onChange={(e) => onFileChange(id, e)}
      />
    )
  }

  return (
    <div className={cn('flex w-full flex-col gap-1', fieldClassName)}>
      <FieldLabel>FV</FieldLabel>
      <MediaPreviewButton
        labels={INVOICE_PREVIEW_LABELS}
        files={pages}
        // No `closePreview` — the picked pages land in place, so the preview keeps showing them.
        onAdd={() => addInputRef.current?.click()}
        onRemove={(invoice) =>
          onRemoveFile(
            id,
            pages.findIndex((page) => page.url === invoice.url),
          )
        }
      />

      {/* Add further pages from inside the preview modal („Dodaj stronę"). */}
      <input
        ref={addInputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        onChange={(e) => onFileChange(id, e)}
      />
    </div>
  )
}
