import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetSetupDialog } from './sheet-setup-dialog'

type PropsT = {
  investmentId: number
  hasSheet: boolean
  size?: 'xs' | 'sm'
}

export function SheetButton({ investmentId, hasSheet, size = 'xs' }: PropsT) {
  if (hasSheet) {
    return (
      <Button size={size} asChild>
        <Link href={`/inwestycje/${investmentId}/kosztorys`}>
          <FileSpreadsheet />
          Otwórz
        </Link>
      </Button>
    )
  }

  return (
    <SheetSetupDialog
      investmentId={investmentId}
      trigger={
        <Button size={size} variant="outline">
          <FileSpreadsheet />
          Dodaj
        </Button>
      }
    />
  )
}
