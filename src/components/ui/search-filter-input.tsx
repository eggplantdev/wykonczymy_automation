'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

type SearchFilterInputPropsT = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  inputMode?: 'text' | 'decimal' | 'numeric' | 'search'
  debounceMs?: number
}

export function SearchFilterInput({
  value,
  onChange,
  placeholder = 'Szukaj...',
  className,
  inputClassName,
  inputMode,
  debounceMs,
}: SearchFilterInputPropsT) {
  const [localValue, setLocalValue] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // Sync external value → local state
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function handleChange(next: string) {
    if (!debounceMs) {
      onChange(next)
      return
    }

    setLocalValue(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange(next)
    }, debounceMs)
  }

  const displayValue = debounceMs ? localValue : value

  return (
    <div className={cn('relative', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={cn('h-8 w-40 pl-8 text-sm lg:w-56', inputClassName)}
      />
    </div>
  )
}
