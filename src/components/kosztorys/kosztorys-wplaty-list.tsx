'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import { VAT_PLANE_LABELS } from '@/lib/constants/transfers'
import type { DepositRowT } from '@/types/reference-data'

type PropsT = {
  rows: DepositRowT[]
  investmentId: number
  // Read-only client render: drop the per-row link to the transaction view (plain text instead).
  clientView?: boolean
}

// A wpłata's plane tag. Netto/Brutto share the chart-green accent — the label carries the distinction;
// a legacy (NULL-plane) deposit reads amber, matching the „bez oznaczenia" line in the Do zapłaty block.
function planeTag(vatPlane: DepositRowT['vatPlane']) {
  if (vatPlane === null) {
    return { label: 'bez oznaczenia', className: 'text-chart-orange' }
  }
  return { label: VAT_PLANE_LABELS[vatPlane], className: 'text-chart-green' }
}

// The per-wpłata list under the Podsumowanie — every INVESTOR_DEPOSIT for the investment, newest first,
// with its netto/brutto/legacy plane tag. Each row links to the investment's filtered deposit view
// (owner only; the client preview renders plain text). Reduced-to-buckets counterpart lives in the
// Wpłaty / Do zapłaty block — this surface shows the individual movements behind those sums.
export function KosztorysWplatyList({ rows, investmentId, clientView = false }: PropsT) {
  if (rows.length === 0) return null

  return (
    <div className="border-border text-foreground shrink-0 border-t px-4 pt-4 pb-2 text-sm">
      <span className="text-muted-foreground text-xs">Wpłaty</span>
      <ul className="mt-2 flex flex-col gap-y-1">
        {rows.map((row) => {
          const tag = planeTag(row.vatPlane)
          const content = (
            <>
              <span className="text-muted-foreground tabular-nums">{formatPLDate(row.date)}</span>
              <span className={cn(tag.className, 'text-xs')}>{tag.label}</span>
              <span className="text-foreground ml-auto tabular-nums">{formatNet(row.amount)}</span>
            </>
          )
          return (
            <li key={row.id}>
              {clientView ? (
                <span className="flex w-full max-w-md items-baseline gap-x-3">{content}</span>
              ) : (
                <Link
                  href={`/inwestycje/${investmentId}?type=INVESTOR_DEPOSIT`}
                  className="hover:bg-muted/40 flex w-full max-w-md items-baseline gap-x-3 rounded-sm"
                >
                  {content}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
