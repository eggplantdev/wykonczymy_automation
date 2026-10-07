'use client'

import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format, isValid, parse } from 'date-fns'
import { pl } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils/cn'
import { FormControlPropsT } from '../types/form-types'
import FormBase from './form-base'
import { useFieldContext } from '../hooks/form-hooks'

export function FormDatePicker(props: FormControlPropsT) {
  const field = useFieldContext<string>()
  const [open, setOpen] = useState(false)

  const parsed = field.state.value ? parse(field.state.value, 'yyyy-MM-dd', new Date()) : undefined
  const selected = parsed && isValid(parsed) ? parsed : undefined

  function handleSelect(date: Date | undefined) {
    field.handleChange(date ? format(date, 'yyyy-MM-dd') : '')
    field.handleBlur()
    setOpen(false)
  }

  return (
    <FormBase {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={field.name}
            type="button"
            variant="outline"
            align="start"
            disabled={props.disabled}
            aria-invalid={field.state.meta.errors.length > 0}
            className={cn('w-full font-normal', props.className)}
          >
            <CalendarIcon />
            {selected ? (
              format(selected, 'd MMM yyyy', { locale: pl })
            ) : (
              <span className="text-muted-foreground">{props.placeholder ?? 'Wybierz datę'}</span>
            )}
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
    </FormBase>
  )
}
