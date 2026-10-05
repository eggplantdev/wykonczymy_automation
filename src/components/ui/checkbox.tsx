'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { CheckIcon, MinusIcon } from 'lucide-react'

import { cn } from '@/lib/utils/cn'

// `ai` matches the `ai` button: `gradient-border` paints the background itself, so the default's
// fills would fight it rather than merge — the two variants share no colour classes.
const CHECKBOX_VARIANT_CLASSES = {
  default:
    'border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary border',
  ai: 'gradient-border neon-glow-duo text-neon-cyan',
} as const

export type CheckboxVariantT = keyof typeof CHECKBOX_VARIANT_CLASSES

function Checkbox({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & { variant?: CheckboxVariantT }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer group focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] shadow-xs transition-shadow outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-2',
        CHECKBOX_VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        {/* Radix renders the indicator for `indeterminate` too, so without a second glyph a
            half-selected group claims to be fully selected. */}
        <CheckIcon className="size-3.5 group-data-[state=indeterminate]:hidden" />
        <MinusIcon className="hidden size-3.5 group-data-[state=indeterminate]:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

// Radix's own three-way value, so a group box says „część" instead of claiming the whole group.
const checkedState = (selected: number, total: number): boolean | 'indeterminate' =>
  selected === 0 ? false : selected === total ? true : 'indeterminate'

export { Checkbox, checkedState }
