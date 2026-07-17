import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetSetupDialog } from './sheet-setup-dialog'

type PropsT = {
  investmentId: number
  hasSheet: boolean
}

// The single kosztorys entry point, identical on the investments listing and the
// individual investment view: a prominent "Otwórz" link when a sheet is linked,
// or a quieter "Dodaj kosztorys" trigger (same setup dialog) when it isn't.
export function SheetButton({ investmentId, hasSheet }: PropsT) {
  if (hasSheet) {
    return (
      <Button size="sm" asChild>
        <Link href={`/inwestycje/${investmentId}/kosztorys`}>
          <FileSpreadsheet className="size-4" />
          Otwórz
        </Link>
      </Button>
    )
  }

  return (
    <SheetSetupDialog
      investmentId={investmentId}
      trigger={
        <Button size="sm" variant="outline">
          <FileSpreadsheet className="size-4" />
          Dodaj kosztorys
        </Button>
      }
    />
  )
}
