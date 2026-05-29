import { LinkKosztorysToInvestmentDialog } from '@/components/dialogs/link-kosztorys-to-investment-dialog'
import type { KosztorysRowT } from '@/lib/queries/kosztoryses'

type PropsT = {
  kosztorys: KosztorysRowT
  availableInvestments: Array<{ id: number; name: string }>
}

// A kosztorys without an investment FK. The CTA opens a picker of
// investments without a kosztorys; on confirm the FK is set and the sheet
// gets back-filled with the investment's expenses.
export function UnlinkedRow({ kosztorys, availableInvestments }: PropsT) {
  return (
    <li className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{kosztorys.name}</p>
        <p className="text-muted-foreground text-xs">Bez przypisanej inwestycji</p>
      </div>
      <LinkKosztorysToInvestmentDialog
        kosztorysId={kosztorys.id}
        kosztorysName={kosztorys.name}
        availableInvestments={availableInvestments}
      />
    </li>
  )
}
