import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { KosztorysRowT } from '@/lib/queries/kosztoryses'

type PropsT = {
  kosztorys: KosztorysRowT
}

// A kosztorys attached to an investment. The "Otwórz" CTA jumps to the
// per-investment kosztorys page (embedded sheet + sync controls). We assert
// `investment` is set — the listing page filters this in before rendering.
export function LinkedRow({ kosztorys }: PropsT) {
  const inv = kosztorys.investment!
  return (
    <li className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{inv.name}</p>
        <p className="text-muted-foreground truncate text-xs">{kosztorys.name}</p>
      </div>
      <Button size="sm" asChild>
        <Link href={`/inwestycje/${inv.id}/kosztorys`}>
          <FileSpreadsheet className="size-4" />
          Otwórz
        </Link>
      </Button>
    </li>
  )
}
