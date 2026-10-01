import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OpenKosztorysV2Button } from '@/components/kosztorys/open-kosztorys-v2-button'
import type { TrashRowT } from '@/types/trash'

// All three open read-only — a trashed investment is inspected here, not restored to be looked at.
export function TrashedInvestmentLinks({ row }: { row: TrashRowT }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Button size="xs" variant="outline" asChild>
        <Link href={`/inwestycje/${row.id}`}>Inwestycja</Link>
      </Button>
      {row.hasSheet && (
        <Button size="xs" variant="outline" asChild>
          <Link href={`/inwestycje/${row.id}/kosztorys`}>
            <FileSpreadsheet />
            Kosztorys v1
          </Link>
        </Button>
      )}
      <OpenKosztorysV2Button investmentId={row.id} label="Kosztorys v2" />
    </div>
  )
}
