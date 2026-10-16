'use client'

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPLN } from '@/lib/utils/format-currency'
import type { CatalogueHintT } from '@/lib/kosztorys/work-catalogue/types'
import { unitLabel } from '@/lib/kosztorys/format'

type CandidateEntryT = Pick<CatalogueHintT, 'description' | 'unit' | 'clientPrice'>

export function CandidateRow({
  entry,
  readOnly,
  showFigures = true,
  onClick,
}: {
  entry: CandidateEntryT
  readOnly: boolean
  showFigures?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1 text-left">{entry.description}</span>
      {showFigures && (
        <>
          <span className="text-muted-foreground w-16 shrink-0 text-right">
            {unitLabel(entry.unit)}
          </span>
          <span className="w-20 shrink-0 text-right tabular-nums">
            {formatPLN(entry.clientPrice)}
          </span>
        </>
      )}
    </>
  )

  if (readOnly)
    return (
      <div className="flex items-baseline gap-2 px-1 py-1">
        <span className="w-4 shrink-0 self-start" />
        {body}
      </div>
    )

  return (
    <Button
      variant="ghost"
      size="xs"
      className="h-auto w-full items-baseline gap-2 px-1 py-1 font-normal whitespace-normal"
      onClick={onClick}
    >
      <ArrowRight className="shrink-0 self-start text-amber-600" />
      {body}
    </Button>
  )
}
