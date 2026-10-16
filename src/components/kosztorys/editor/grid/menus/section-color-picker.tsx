'use client'

import { Check, Ban } from 'lucide-react'

import { SECTION_COLORS, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  value: SectionColorKeyT | null
  onChange: (color: SectionColorKeyT | null) => void
}

// Rendered inside the open dropdown, so each swatch is a plain button — a DropdownMenuItem would
// close the menu on select.
export function SectionColorPicker({ value, onChange }: PropsT) {
  return (
    <div className="px-2 py-1.5">
      <div className="grid grid-cols-9 gap-1">
        {SECTION_COLORS.map((color) => (
          <button
            key={color.key}
            type="button"
            title={color.label}
            aria-label={color.label}
            aria-pressed={value === color.key}
            onClick={() => onChange(color.key)}
            className={cn(
              'ring-offset-background focus-visible:ring-ring flex size-5 cursor-pointer items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none',
              color.swatch,
            )}
          >
            {value === color.key && <Check className="size-3 text-white drop-shadow-sm" />}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange(null)}
        disabled={value == null}
        className="text-muted-foreground hover:text-foreground mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs disabled:cursor-default disabled:opacity-50"
      >
        <Ban className="size-3" />
        Bez koloru
      </button>
    </div>
  )
}
