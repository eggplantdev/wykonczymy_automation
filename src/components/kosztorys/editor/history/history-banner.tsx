'use client'

import { History } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { itemNoun } from '@/lib/kosztorys/counted-nouns'
import { formatQty } from '@/lib/kosztorys/format'
import { discountText } from '@/lib/kosztorys/history/summarize-change'
import type { DiscountChangeT, PastVersionT } from '@/lib/kosztorys/history/types'
import { formatPLDate } from '@/lib/utils/format-date'

// A version stored before the rabat was captured has none to compare, and „0,00 zł" would be a claim
// nobody made.
function discountLine(discount: DiscountChangeT): string {
  if (discount.state === 'unknown') return 'Rabat nieznany'
  if (discount.state === 'same') return `Rabat: ${discountText(discount.discount)}`
  return `Rabat: ${discountText(discount.before)} → ${discountText(discount.after)}`
}

// Null for the present, so the body mounts it unconditionally and the gate lives in one place.
export function HistoryBanner({ version }: { version: PastVersionT | null }) {
  const pathname = usePathname()
  if (!version) return null

  const day = formatPLDate(version.day)
  const { added, discount } = version.diff
  return (
    <div
      role="status"
      className="bg-muted/50 border-border flex shrink-0 flex-col gap-1 border-b px-4 py-2 text-sm sm:px-5"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <History className="size-4 shrink-0" aria-hidden />
        <span className="font-medium">
          {version.label ? `Wersja „${version.label}" z ${day}` : `Wersja z ${day}`}
        </span>
        <span className="text-muted-foreground">— porównanie z bieżącą ·</span>
        <Link href={pathname} className="text-primary font-medium underline underline-offset-2">
          Wróć do bieżącej
        </Link>
      </p>
      <p className="text-muted-foreground">{discountLine(discount)}</p>
      {/* Listed rather than drawn: the past grid has no row for a praca that did not exist yet. */}
      {added.length > 0 && (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer">
            Dodane od tego dnia: {added.length} {itemNoun(added.length)}
          </summary>
          <ul className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto pl-4">
            {added.map((item) => (
              <li key={item.id}>
                {item.sectionName} · {item.description ?? '—'} ·{' '}
                {[formatQty(item.plannedQty), item.unit].filter(Boolean).join(' ')}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
