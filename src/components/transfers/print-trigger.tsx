'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { HeaderFieldT } from '@/types/export'

type PrintTriggerPropsT = {
  readonly headerFields: HeaderFieldT[]
}

export function PrintTrigger({ headerFields }: PrintTriggerPropsT) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(headerFields.map((f) => [f.label, true])),
  )

  const toggle = (label: string) => setVisible((prev) => ({ ...prev, [label]: !prev[label] }))

  return (
    <>
      {/* Controls bar — hidden during print */}
      <div className="fixed top-0 right-0 left-0 z-50 border-b bg-white px-8 py-3 print:hidden">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-4">
          {headerFields.map((field) => (
            <label key={field.label} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={visible[field.label]}
                onCheckedChange={() => toggle(field.label)}
              />
              {field.label}
            </label>
          ))}
          <Button size="sm" className="ml-auto gap-1.5" onClick={() => window.print()}>
            <Printer className="size-4" />
            Drukuj
          </Button>
        </div>
      </div>

      {/* Spacer to push content below the fixed bar */}
      <div className="h-14 print:hidden" />

      {/* Inject inline styles to hide unchecked fields during print */}
      <style>
        {headerFields
          .filter((f) => !visible[f.label])
          .map((f) => `[data-stat="${CSS.escape(f.label)}"] { display: none !important; }`)
          .join('\n')}
      </style>
    </>
  )
}
