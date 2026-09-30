'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import { unitOptions } from '@/lib/kosztorys/worker-report/unit-options'

type PropsT = {
  extras: ExtraWorkT[]
  commonUnits: string[]
  onSave: (extra: ExtraWorkT) => void
  onRemove: (key: string) => void
}

// Work from outside the rozpiska as plain rows — typed in place, one row per work.
export function ExtraWorkRows({ extras, commonUnits, onSave, onRemove }: PropsT) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:gap-2">
        {extras.map((extra) => (
          <div key={extra.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Input
              aria-label="Opis prac"
              value={extra.description}
              onChange={(event) => onSave({ ...extra, description: event.target.value })}
              placeholder="Opis prac"
              className="h-9 min-w-0 basis-full sm:flex-1 sm:basis-0"
            />
            <SimpleSelect
              value={extra.unit}
              onValueChange={(unit) => onSave({ ...extra, unit })}
              options={unitOptions(commonUnits, extra.unit).map((option) => ({
                value: option,
                label: option,
              }))}
              placeholder="J.m."
              className="h-9 min-w-0 flex-1 sm:w-28 sm:flex-none"
            />
            <Input
              aria-label="Zgłaszam"
              inputMode="decimal"
              value={extra.qty}
              onChange={(event) => onSave({ ...extra, qty: event.target.value })}
              aria-invalid={parseReportQty(extra.qty).kind === 'invalid'}
              placeholder="Ilość"
              className="h-9 min-w-0 flex-1 text-right tabular-nums sm:w-24 sm:flex-none"
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Usuń pracę"
              onClick={() => onRemove(extra.key)}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={() => onSave({ key: crypto.randomUUID(), description: '', unit: '', qty: '' })}
      >
        <Plus />
        Dodaj więcej
      </Button>
    </div>
  )
}
