'use client'

import * as React from 'react'
import { useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/cn'

type FileInputPropsT = React.ComponentProps<'input'> & {
  label?: string
}

function FileInput({ className, label, onChange, accept, ref, ...props }: FileInputPropsT) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState<string>()
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  function setRefs(node: HTMLInputElement | null) {
    inputRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) (ref as React.RefObject<HTMLInputElement | null>).current = node
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

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (!file) return

    // Validate against accept prop
    if (accept && !matchesAccept(file, accept)) return

    // Set the file on the input element and fire onChange
    const dt = new DataTransfer()
    dt.items.add(file)
    if (inputRef.current) {
      inputRef.current.files = dt.files
      const event = new Event('change', { bubbles: true })
      inputRef.current.dispatchEvent(event)
    }
    setFileName(file.name)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setFileName(file?.name)
    onChange?.(e)
  }

  return (
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
        'flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 transition-colors',
        'text-muted-foreground hover:border-primary/50 hover:bg-muted/50',
        isDragOver && 'border-primary bg-muted/50',
        className,
      )}
    >
      <Upload className="mb-2 size-6" />
      <span className="text-sm">
        {fileName ?? label ?? 'Przeciągnij plik lub kliknij'}
      </span>
      <input
        ref={setRefs}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="sr-only"
        {...props}
      />
    </div>
  )
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
