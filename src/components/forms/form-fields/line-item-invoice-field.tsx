'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { FileText, Search } from 'lucide-react'
import { FileInput } from '@/components/ui/file-input'
import { FieldLabel } from '@/components/ui/field'
import { cn } from '@/lib/utils/cn'

const InvoicePreviewDialog = dynamic(() =>
  import('@/components/dialogs/invoice-preview-dialog').then((m) => ({
    default: m.InvoicePreviewDialog,
  })),
)

// A picked file has no URL yet — mint a blob URL for the preview and revoke it when the
// file changes/unmounts. Create AND revoke in the same effect so StrictMode's mount→cleanup→
// remount can't leave us holding a URL it already revoked (splitting create into useMemo does).
function useObjectUrl(file?: File): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    // No file → leave `url` as-is; only rendered when `file` is set, so a stale URL is never shown.
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    // Surfacing the external blob handle into state is the sanctioned effect use — creation
    // must live in the effect so its revoke and this URL share one lifecycle (StrictMode-safe).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])
  return file ? url : undefined
}

type LineItemInvoiceFieldPropsT = {
  index: number
  file?: File
  fieldClassName?: string
  // Bumped to remount the (uncontrolled) FileInput so it re-reads its filename from the ref.
  fileInputKey: number
  onFileChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void
}

export function LineItemInvoiceField({
  index,
  file,
  fieldClassName,
  fileInputKey,
  onFileChange,
}: LineItemInvoiceFieldPropsT) {
  const url = useObjectUrl(file)
  const [previewOpen, setPreviewOpen] = useState(false)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // Empty row → the plain upload control (click or drag to attach).
  if (!file || !url) {
    return (
      <FileInput
        key={`file-${fileInputKey}-${index}`}
        label="FV"
        fieldClassName={fieldClassName}
        accept="image/*,application/pdf"
        onChange={(e) => onFileChange(index, e)}
      />
    )
  }

  const isImage = file.type.startsWith('image/')

  return (
    <div className={cn('flex w-full flex-col gap-1', fieldClassName)}>
      <FieldLabel>FV</FieldLabel>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        aria-label={`Podgląd: ${file.name}`}
        className="border-input text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/50 flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md border px-3 transition-colors"
      >
        {isImage ? (
          <Search className="size-4 shrink-0" />
        ) : (
          <FileText className="size-4 shrink-0" />
        )}
        <span className="truncate text-sm">{file.name}</span>
      </button>

      {/* Swap the receipt from inside the preview modal (Zamień). */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => onFileChange(index, e)}
      />

      {previewOpen && (
        <InvoicePreviewDialog
          url={url}
          filename={file.name}
          mimeType={file.type}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          unoptimized
          onReplace={() => replaceInputRef.current?.click()}
        />
      )}
    </div>
  )
}
