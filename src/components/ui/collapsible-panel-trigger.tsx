import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
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
        'group hover:bg-muted/40 flex w-full shrink-0 cursor-pointer items-baseline gap-3 px-4 py-1.5 text-left text-sm',
        className,
      )}
    >
      <ChevronDown className="text-muted-foreground size-4 shrink-0 self-center transition-transform duration-200 group-data-[state=open]:rotate-180" />
      <span className="font-medium">{label}</span>
    </Collapsible.Trigger>
  )
}
