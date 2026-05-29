import { Plus } from 'lucide-react'
import { SheetSetupDialog } from '@/components/dialogs/sheet-setup-dialog'
import { Button } from '@/components/ui/button'

type PropsT = {
  investmentId: number
  investmentName: string
}

// An investment with no kosztorys yet. Reuses the per-investment setup dialog
// (auto-provision OR link an existing sheet) — same flow as the no-sheet
// banner on the investment page.
export function NoSheetRow({ investmentId, investmentName }: PropsT) {
  return (
    <li className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{investmentName}</p>
        <p className="text-muted-foreground text-xs">Brak kosztorysu</p>
      </div>
      <SheetSetupDialog
        investmentId={investmentId}
        investmentName={investmentName}
        trigger={
          <Button size="sm" variant="outline">
            <Plus className="size-4" />
            Dodaj kosztorys
          </Button>
        }
      />
    </li>
  )
}
