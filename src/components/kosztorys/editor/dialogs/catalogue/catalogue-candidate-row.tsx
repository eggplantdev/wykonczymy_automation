'use client'

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { formatPLN } from '@/lib/utils/format-currency'
import type { CatalogueHintT } from '@/lib/kosztorys/work-catalogue/types'

/**
 * 168 prace in the local dataset carry a name the cennik ALREADY has and differ only by j.m., and
 * over such a praca „może chodzi o «Montaż syfonów»" reads as the application malfunctioning. Where
 * the names fold to the same string, the sentence has to be about the j.m. instead.
 */
export function hintLead(row: {
  description: string
  hints: readonly Pick<CatalogueHintT, 'description'>[]
}): string {
  const folded = foldDescription(row.description)
  const sameName = row.hints.every((hint) => foldDescription(hint.description) === folded)
  return sameName ? 'ta sama nazwa, inna j.m.:' : 'może chodzi o:'
}

type CandidateEntryT = Pick<CatalogueHintT, 'description' | 'unit' | 'clientPrice'>

// The j.m. and the cena sit in their own columns, never in the sentence: candidates for one praca
// are routinely the SAME name, so those two are the whole difference between them and have to line
// up down the list to be comparable at all.
export function CandidateRow({
  entry,
  readOnly,
  onClick,
}: {
  entry: CandidateEntryT
  readOnly: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1 text-left">{entry.description}</span>
      <span className="text-muted-foreground w-16 shrink-0 text-right">
        {entry.unit || 'bez j.m.'}
      </span>
      <span className="w-20 shrink-0 text-right tabular-nums">{formatPLN(entry.clientPrice)}</span>
    </>
  )

  // A candidate a read-only viewer cannot accept is still worth reading — it is the explanation for
  // why the praca is in this block at all.
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
      {/* Amber on the glyph alone. On the whole wiersz it was 100+ amber lines in one fold, where
          the colour stopped meaning „this is the offer" and became the background. */}
      <ArrowRight className="shrink-0 self-start text-amber-600" />
      {body}
    </Button>
  )
}
