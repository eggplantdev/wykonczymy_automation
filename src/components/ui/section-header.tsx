import type { ReactNode } from 'react'
import { Description } from '@/components/ui/description'

type SectionHeaderPropsT = {
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
}

// py-2 on the text block, not a min-height on the row: it matches a large CollapsibleSection trigger
// and keeps the gap under the LAST line the same whether that line is the title or a hint.
export function SectionHeader({ title, hint, action }: SectionHeaderPropsT) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="py-2">
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        {hint && <Description size="xs">{hint}</Description>}
      </div>
      {action}
    </div>
  )
}
