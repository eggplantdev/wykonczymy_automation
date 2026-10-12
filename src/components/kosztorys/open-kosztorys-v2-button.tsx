import Link from 'next/link'
import { Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PropsT = {
  investmentId: number
  label?: string
  size?: 'xs' | 'sm'
}

// Kosztorys_v2 (the in-app editor) always exists for every investment, so this is a plain
// "Otwórz" link — no create/empty distinction like the legacy sheet (SheetButton) carries.
export function OpenKosztorysV2Button({
  investmentId,
  label = 'Otwórz kosztorys_v2',
  size = 'xs',
}: PropsT) {
  return (
    <Button size={size} variant="outline" asChild>
      <Link href={`/inwestycje/${investmentId}/kosztorys_v2`}>
        <Table2 />
        {label}
      </Link>
    </Button>
  )
}
