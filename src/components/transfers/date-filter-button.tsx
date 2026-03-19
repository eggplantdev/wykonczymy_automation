'use client'

import { useRef } from 'react'
import { Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'

type DateFilterButtonPropsT = {
  label: string
  value: string
  onChange: (value: string) => void
}

export function DateFilterButton({ label, value, onChange }: DateFilterButtonPropsT) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Button
      variant={value ? 'activeFilter' : 'outline'}
      size="sm"
      className="w-fit min-w-40 justify-start gap-1.5"
      onClick={() => inputRef.current?.showPicker()}
    >
      <Calendar className="size-4" />
      {value || label}
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
    </Button>
  )
}
