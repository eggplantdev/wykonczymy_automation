'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SectionSubtotalT } from '@/types/kosztorys'

type PropsT = {
  subtotals: SectionSubtotalT[]
  grandNet: number
  onClose: () => void
}

const fmt = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function KosztorysSectionSummary({ subtotals, grandNet, onClose }: PropsT) {
  return (
    <aside className="border-border flex w-72 shrink-0 flex-col overflow-hidden border-l">
      <div className="border-border flex shrink-0 items-center justify-between border-b px-3 py-2">
        <h2 className="text-foreground text-sm font-medium">Sekcje</h2>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="divide-border min-h-0 flex-1 divide-y overflow-y-auto">
        {subtotals.map((s) => (
          <li key={s.sectionId} className="px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-foreground truncate text-sm">{s.sectionName}</span>
              <span className="text-foreground shrink-0 text-sm tabular-nums">{fmt(s.net)}</span>
            </div>
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{s.itemCount} poz.</span>
              <span className="tabular-nums">{(s.share * 100).toFixed(1)}%</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="border-border flex shrink-0 items-baseline justify-between border-t px-3 py-2">
        <span className="text-foreground text-sm font-medium">Suma netto</span>
        <span className="text-foreground text-sm font-medium tabular-nums">{fmt(grandNet)}</span>
      </div>
    </aside>
  )
}
