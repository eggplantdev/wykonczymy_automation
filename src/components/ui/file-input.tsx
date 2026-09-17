'use client'

import * as React from 'react'
import { useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Description } from '@/components/ui/description'
import { FieldLabel } from '@/components/ui/field'
import {
  FILE_DRAG_ARMED_CLASS,
  FILE_DRAG_OVER_CLASS,
  useWindowFileDrag,
} from '@/hooks/use-window-file-drag'

type FileInputPropsT = React.ComponentProps<'input'> & {
  label?: string
  placeholder?: string
  fieldClassName?: string
  // For a file attached outside this uncontrolled input (batch-registered receipts). Only read at
  // mount — remount via key to update it.
  initialFileName?: string
}

function FileInput({
  className,
  label,
  placeholder = 'Przeciągnij lub kliknij',
  fieldClassName,
  onChange,
  accept = 'image/*,application/pdf',
  initialFileName,
  multiple,
  disabled,
  ref,
  ...props
}: FileInputPropsT) {
  const isFileDragActive = useWindowFileDrag()
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState<string | undefined>(initialFileName)
  const [error, setError] = useState<string>()
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  function setRefs(node: HTMLInputElement | null) {
    inputRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    // Leaving for a child (the icon, the filename) is not leaving the zone — without this the
    // strong state flickers as the cursor crosses them.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setIsDragOver(false)
  }

  function setFilesOnInput(files: File[]) {
    if (!inputRef.current) return
    const dt = new DataTransfer()
    for (const file of files) dt.items.add(file)
    inputRef.current.files = dt.files
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    // `disabled` reaches the hidden input, which kills the click path but not this one. Callers that
    // disable mid-ingest would otherwise get a second concurrent batch through the drop target.
    if (disabled) return

    const dropped = [...e.dataTransfer.files].slice(0, multiple ? undefined : 1)
    if (dropped.length === 0) return

    if (accept && dropped.some((file) => !matchesAccept(file, accept))) {
      setError(`Nieobsługiwany format pliku. Dozwolone: ${humanizeAccept(accept)}`)
      return
    }
    setError(undefined)

    // So form reads and ref.files see them.
    setFilesOnInput(dropped)
    setFileName(joinFileNames(dropped))

    // Native dispatchEvent doesn't reliably trigger React's synthetic handler.
    if (onChange && inputRef.current) {
      const syntheticEvent = {
        target: inputRef.current,
        currentTarget: inputRef.current,
      } as React.ChangeEvent<HTMLInputElement>
      onChange(syntheticEvent)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileName(joinFileNames([...(e.target.files ?? [])]))
    setError(undefined)
    onChange?.(e)
  }

  return (
    <div className={cn('flex w-full flex-col gap-1', fieldClassName)}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'border-input bg-background flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border px-3 transition-colors',
          'text-muted-foreground hover:border-primary/50 hover:bg-muted/50',
          isFileDragActive && !isDragOver && !disabled && FILE_DRAG_ARMED_CLASS,
          isDragOver && cn(FILE_DRAG_OVER_CLASS, 'bg-muted/50'),
          disabled && 'pointer-events-none opacity-50',
          className,
        )}
      >
        <Upload />
        <span className="line-clamp-1 min-w-0 text-sm break-all">{fileName ?? placeholder}</span>

        <input
          ref={setRefs}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleChange}
          className="sr-only"
          {...props}
        />
      </div>
      {error && (
        <Description role="alert" tone="error" size="xs" className="mt-1">
          {error}
        </Description>
      )}
    </div>
  )
}

function joinFileNames(files: File[]): string {
  return files.map((file) => file.name).join(', ')
}

const MIME_LABELS: Record<string, string> = {
  'image/*': 'obrazy',
  'application/pdf': 'PDF',
  'video/*': 'wideo',
  'audio/*': 'audio',
  'text/*': 'tekst',
}

function humanizeAccept(accept: string): string {
  return accept
    .split(',')
    .map((s) => s.trim())
    .map((pattern) => MIME_LABELS[pattern] ?? pattern)
    .join(', ')
}

function matchesAccept(file: File, accept: string): boolean {
  const allowed = accept.split(',').map((s) => s.trim())
  return allowed.some((pattern) => {
    if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern.toLowerCase())
    if (pattern.endsWith('/*')) return file.type.startsWith(pattern.replace('/*', '/'))
    return file.type === pattern
  })
}

export { FileInput }
