'use client'

import { Check, Ban } from 'lucide-react'

import { TextButton } from '@/components/ui/text-link'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { SECTION_COLORS, type SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  value: SectionColorKeyT | null
  onChange: (color: SectionColorKeyT | null) => void
}

// Swatches are buttons, not DropdownMenuItems — an item would close the menu on select.
export function SectionColorPicker({ value, onChange }: PropsT) {
  return (
    <div className="px-2 py-1.5">
      <div className="grid grid-cols-9 gap-1">
        {SECTION_COLORS.map((color) => (
          <SimpleTooltip key={color.key} content={color.label}>
            {/* eslint-disable-next-line local/no-hand-rolled-ui -- a colour swatch; no Button variant fits */}
            <button
              type="button"
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
          </SimpleTooltip>
        ))}
      </div>
      <TextButton
        onClick={() => onChange(null)}
        disabled={value == null}
        className="mt-1.5 gap-1.5"
      >
        <Ban className="size-3" />
        Bez koloru
      </TextButton>
    </div>
  )
}
