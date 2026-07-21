'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import {
  sectionPieSlices,
  type SectionPieBaseT,
  type SectionSliceInputT,
} from '@/lib/kosztorys/chart-slices'
import { SlicePie } from '@/components/kosztorys/slice-pie'

const BASES: { key: SectionPieBaseT; label: string }[] = [
  { key: 'przedmiar', label: 'Przedmiar' },
  { key: 'wykonane', label: 'Wykonane' },
]

// Sekcje as a share-of-whole pie, with a live Przedmiar ↔ Wykonane base toggle. Fed the client-priced,
// view-invariant subtotals so switching base is a source-selection, never a re-calculation.
export function SectionSharePie({ subtotals }: { subtotals: SectionSliceInputT[] }) {
  const [base, setBase] = useState<SectionPieBaseT>('przedmiar')

  return (
    <SlicePie
      caption={
        <figcaption className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">Udział sekcji — {base}</span>
          <div className="border-border flex rounded-md border text-xs">
            {BASES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setBase(key)}
                className={cn(
                  'px-2 py-0.5 first:rounded-l-md last:rounded-r-md',
                  base === key ? 'bg-foreground text-background' : 'text-muted-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </figcaption>
      }
      slices={sectionPieSlices(subtotals, base)}
    />
  )
}
