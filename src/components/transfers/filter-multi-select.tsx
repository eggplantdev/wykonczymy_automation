'use client'

import { CheckIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type OptionT = { value: string; label: string }

type FilterMultiSelectPropsT = {
  values: string[]
  onValuesChange: (values: string[]) => void
  options: OptionT[]
}

export function FilterMultiSelect({ values, onValuesChange, options }: FilterMultiSelectPropsT) {
  function toggleValue(value: string) {
    const next = values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value]
    onValuesChange(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="min-w-40 justify-start gap-1.5">
          {values.length === 0 ? 'Wszystkie' : `Wybrano (${values.length})`}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={(e) => e.preventDefault()}
            onClick={() => toggleValue(opt.value)}
          >
            <CheckIcon
              className={cn('size-4', !values.includes(opt.value) && 'opacity-0')}
            />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
