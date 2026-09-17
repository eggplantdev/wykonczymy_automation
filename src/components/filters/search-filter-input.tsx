'use client'

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils/cn'

/** The width every toolbar search field shares — a layout value, so the caller passes it in.
 * Full width below `sm`: a fixed 160px basis shrinks to a few characters in a crowded toolbar. */
export const SEARCH_FILTER_TOOLBAR_WIDTH = 'w-full sm:w-40 lg:w-56'

type SearchFilterInputPropsT = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputMode?: 'text' | 'decimal' | 'numeric' | 'search'
  debounceMs?: number
}

export function SearchFilterInput({
  value,
  onChange,
  placeholder = 'Szukaj...',
  className,
  inputMode,
  debounceMs,
}: SearchFilterInputPropsT) {
  const [localValue, setLocalValue] = useState(value)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  // An external write wins over anything still in flight: a „Wyczyść" button that clears the value
  // while a keystroke's debounce is pending would otherwise see the stale timer fire straight after
  // and put the phrase back.
  //
  // Split in two because the compiler's rules pull apart: the new value is adopted during render (no
  // effect may just assign state), while the timer it invalidates is cancelled after commit (no
  // render may touch a ref). Order is safe either way — the cancel lands within the same tick, and
  // the timer it is racing is at least a debounce interval away.
  const [lastExternalValue, setLastExternalValue] = useState(value)
  if (value !== lastExternalValue) {
    setLastExternalValue(value)
    setLocalValue(value)
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
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
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
      <Input
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="h-8 pl-8"
      />
    </div>
  )
}
