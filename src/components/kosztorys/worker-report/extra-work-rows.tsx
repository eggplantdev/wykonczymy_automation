'use client'

import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { blankExtra, extraState } from '@/components/kosztorys/worker-report/extra-state'
import type { ExtraWorkT } from '@/components/kosztorys/worker-report/types'
import { parseReportQty } from '@/lib/kosztorys/worker-report/parse-report-qty'
import { unitOptions } from '@/lib/kosztorys/worker-report/unit-options'

type PropsT = {
  extras: ExtraWorkT[]
  commonUnits: string[]
  onSave: (extra: ExtraWorkT) => void
  onRemove: (key: string) => void
  // Off until he tries to close: a row he is still typing into would otherwise read as an error.
  showsMissing: boolean
}

export function ExtraWorkRows({ extras, commonUnits, onSave, onRemove, showsMissing }: PropsT) {
  return (
    <div>
      <div className="flex flex-col gap-4 sm:gap-2">
        {extras.map((extra) => {
          const isMissing = showsMissing && extraState(extra) === 'invalid'
          const qty = parseReportQty(extra.qty)
          return (
            <div key={extra.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <Input
                aria-label="Opis prac"
                value={extra.description}
                onChange={(event) => onSave({ ...extra, description: event.target.value })}
                placeholder="Opis prac"
                aria-invalid={isMissing && extra.description.trim() === ''}
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
                invalid={isMissing && extra.unit === ''}
                className="h-9 min-w-0 flex-1 sm:w-28 sm:flex-none"
              />
              <Input
                aria-label="Zgłaszam"
                inputMode="decimal"
                value={extra.qty}
                onChange={(event) => onSave({ ...extra, qty: event.target.value })}
                aria-invalid={qty.kind === 'invalid' || (isMissing && qty.kind === 'empty')}
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
          )
        })}
      </div>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => onSave(blankExtra())}>
        <Plus />
        Dodaj więcej
      </Button>
    </div>
  )
}
