import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  label: string
  className?: string
}

// Header row for a bottom Collapsible panel: a chevron that rotates with the open state + a dynamic
// label. The chevron keys off the trigger's Radix `data-state` via a `group`, so no open prop is
// threaded through — the component stays state-free and reusable across panels.
export function CollapsiblePanelTrigger({ label, className }: PropsT) {
  return (
    <Collapsible.Trigger
      className={cn(
        'group hover:bg-muted/40 border-border flex w-full shrink-0 cursor-pointer items-baseline gap-3 border-b px-4 py-4 text-left text-lg data-[state=closed]:border-transparent',
        className,
      )}
    >
      {/* -my-1 keeps the oversized icons from stretching the row past its text-driven height. */}
      <ChevronDown className="text-muted-foreground -my-1 size-8 shrink-0 self-center transition-transform duration-200 group-data-[state=open]:rotate-180" />
      <span className="font-medium">{label}</span>
      {/* Close affordance only — the whole row is the trigger, so this is a plain icon, not a
          nested button. */}
      <X className="text-muted-foreground -my-1 ml-auto hidden size-8 shrink-0 self-center group-data-[state=open]:block" />
    </Collapsible.Trigger>
  )
}
