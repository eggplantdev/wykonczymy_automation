'use client'

import { History } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HistoryChangesTable } from '@/components/kosztorys/editor/history/history-changes-table'
import { differenceSummary, versionChangeRows } from '@/lib/kosztorys/history/change-rows'
import type { PastVersionT } from '@/lib/kosztorys/history/types'
import { formatPLDate } from '@/lib/utils/format-date'

export function HistoryBanner({ version }: { version: PastVersionT | null }) {
  const pathname = usePathname()
  if (!version) return null

  const day = formatPLDate(version.day)
  const rows = versionChangeRows(version.diff)
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
      {version.diff.discount.state === 'unknown' && (
        <p className="text-muted-foreground">Rabat nieznany — ta wersja nie zapisała rabatu</p>
      )}
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{differenceSummary(0)}</p>
      ) : (
        // Open on arrival — the list is why the version was opened; folding it gives the grid room.
        <details open>
          <summary className="cursor-pointer font-medium">{differenceSummary(rows.length)}</summary>
          <div className="mt-1 max-h-64 overflow-auto">
            <HistoryChangesTable rows={rows} />
          </div>
        </details>
      )}
    </div>
  )
}
