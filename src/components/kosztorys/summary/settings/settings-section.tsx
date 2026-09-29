'use client'

import type { ReactNode } from 'react'
import { InfoTooltip } from '@/components/ui/info-tooltip'

type PropsT = {
  // The figure this block governs — „Robocizna", „Materiały", „VAT", „Rabat". Deliberately the domain
  // noun and not the control's name: the owner opens this popover looking for a figure, not a setting.
  title: string
  // What the control below asks for. Carries the (i) rather than the title, because the hint explains
  // the choice being made, not the figure it belongs to.
  subtitle: string
  // The picked option's explanation, behind an (i) rather than printed underneath — four paragraphs
  // of prose made the popover a wall to scroll past instead of a form to fill.
  hint?: ReactNode
  children: ReactNode
}

// One block of the Opcje rozliczenia popover. Owns its own padding so the popover can drop its own
// (`p-0`) and let the divider between blocks run the full width, as a section rule should.
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
