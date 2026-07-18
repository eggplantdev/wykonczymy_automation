'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format, parse } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type DateFilterButtonPropsT = {
  label: string
  value: string
  onChange: (value: string) => void
}

export function DateFilterButton({ label, value, onChange }: DateFilterButtonPropsT) {
  const [open, setOpen] = useState(false)

  const selected = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined

  function handleSelect(date: Date | undefined) {
    onChange(date ? format(date, 'yyyy-MM-dd') : '')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={value ? 'activeFilter' : 'outline'}
          size="sm"
          className="min-w-40 justify-start gap-1.5"
        >
          <CalendarIcon />
          {selected ? format(selected, 'd MMM yyyy', { locale: pl }) : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
          locale={pl}
        />
      </PopoverContent>
    </Popover>
  )
}
