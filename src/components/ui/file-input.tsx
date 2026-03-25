'use client'

import * as React from 'react'
import { useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/cn'
import { FieldLabel } from '@/components/ui/field'

type FileInputPropsT = React.ComponentProps<'input'> & {
  label?: string
  placeholder?: string
  fieldClassName?: string
}

function FileInput({
  className,
  label,
  placeholder = 'Przeciągnij lub kliknij',
  fieldClassName,
  onChange,
  accept = 'image/*,application/pdf',
  ref,
  ...props
}: FileInputPropsT) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState<string>()
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
    setIsDragOver(false)
  }

  function setFileOnInput(file: File) {
    if (!inputRef.current) return
    const dt = new DataTransfer()
    dt.items.add(file)
    inputRef.current.files = dt.files
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    if (accept && !matchesAccept(file, accept)) {
      setError(`Nieobsługiwany format pliku. Dozwolone: ${humanizeAccept(accept)}`)
      return
    }
    setError(undefined)

    // Sync file to the hidden input (so form reads and ref.files work)
    setFileOnInput(file)
    setFileName(file.name ?? '')

    // Fire onChange directly — native dispatchEvent doesn't reliably trigger React's synthetic handler
    if (onChange && inputRef.current) {
      const syntheticEvent = {
        target: inputRef.current,
        currentTarget: inputRef.current,
      } as React.ChangeEvent<HTMLInputElement>
      onChange(syntheticEvent)
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? '')
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
          isDragOver && 'border-primary bg-muted/50',
          className,
        )}
      >
        <Upload className="size-4" />
        <span className="text-sm">{fileName ?? placeholder}</span>

        <input
          ref={setRefs}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="sr-only"
          {...props}
        />
      </div>
      {error && (
        <div role="alert" className="text-destructive mt-1 text-xs">
          {error}
        </div>
      )}
    </div>
  )
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
