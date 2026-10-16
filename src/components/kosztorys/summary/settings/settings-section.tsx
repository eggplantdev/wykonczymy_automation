'use client'

import type { ReactNode } from 'react'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type PropsT = {
  title: string
  subtitle: string
  hint?: ReactNode
  children: ReactNode
}

// Owns its own padding so the popover can drop its own (`p-0`) and let the divider between blocks
// run the full width.
export function SettingsSection({ title, subtitle, hint, children }: PropsT) {
  return (
    <section className="flex flex-col items-start gap-2 px-4 py-3">
      <div className="flex flex-col items-start gap-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {subtitle}
          {hint && <InfoTooltip content={hint} label={`Więcej o: ${subtitle}`} />}
        </div>
      </div>
      {children}
    </section>
  )
}
