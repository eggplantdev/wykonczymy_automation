'use client'

import { History } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import type { HistoryEntryT } from '@/lib/kosztorys/history/types'
import { formatPLDate } from '@/lib/utils/format-date'

// The URL is the state: an entry is a link, so a version can be sent to someone and the back button
// returns to the list's page.
export function HistoryDialog({ entries }: { entries: readonly HistoryEntryT[] }) {
  const pathname = usePathname()
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          <History />
          {/* Icon-only on a phone, where the logo and „Podsumowanie" already fill the row. */}
          <span className="max-sm:sr-only">Historia zmian</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader
          title="Historia zmian"
          description="Wybierz dzień, aby zobaczyć kosztorys z tamtej chwili i co zmieniło się od tego czasu."
        />
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak zmian do pokazania</p>
        ) : (
          <ol className="flex flex-col divide-y">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`${pathname}?wersja=${entry.id}`}
                  className="hover:bg-muted flex flex-col gap-0.5 rounded-md px-2 py-2"
                >
                  <span className="font-medium">{entry.label ?? formatPLDate(entry.day)}</span>
                  {entry.label && (
                    <span className="text-muted-foreground text-xs">{formatPLDate(entry.day)}</span>
                  )}
                  <span className="text-muted-foreground text-sm">{entry.summary}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
