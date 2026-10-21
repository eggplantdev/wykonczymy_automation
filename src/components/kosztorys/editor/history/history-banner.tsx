'use client'

import { useState } from 'react'
import { History } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HistoryChangesTable } from '@/components/kosztorys/editor/history/history-changes-table'
import * as Collapsible from '@/components/ui/collapsible'
import { Description } from '@/components/ui/description'
import { TextLink } from '@/components/ui/text-link'
import { differenceSummary, versionChangeRows } from '@/lib/kosztorys/history/change-rows'
import type { PastVersionT } from '@/lib/kosztorys/history/types'
import { formatPLDate } from '@/lib/utils/format-date'

export function HistoryBanner({ version }: { version: PastVersionT | null }) {
  const pathname = usePathname()
  const [changesOpen, setChangesOpen] = useState(true)
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
        <TextLink asChild className="font-medium">
          <Link href={pathname}>Wróć do bieżącej</Link>
        </TextLink>
      </p>
      {version.diff.discount.state === 'unknown' && (
        <Description withIcon={false}>Rabat nieznany — ta wersja nie zapisała rabatu</Description>
      )}
      {rows.length === 0 ? (
        <Description withIcon={false}>{differenceSummary(0)}</Description>
      ) : (
        <Collapsible.Root open={changesOpen} onOpenChange={setChangesOpen}>
          <Collapsible.Trigger className="flex cursor-pointer items-center gap-1 font-medium">
            <Collapsible.Chevron open={changesOpen} className="size-4" />
            {differenceSummary(rows.length)}
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-1 max-h-64 overflow-auto">
            <HistoryChangesTable rows={rows} />
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </div>
  )
}
