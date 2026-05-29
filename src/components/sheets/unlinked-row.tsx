import { LinkSheetToInvestmentDialog } from '@/components/dialogs/link-sheet-to-investment-dialog'
import type { SheetRowT } from '@/lib/queries/sheets'

type PropsT = {
  sheet: SheetRowT
  availableInvestments: Array<{ id: number; name: string }>
}

// A sheet without an investment FK. The CTA opens a picker of
// investments without a sheet; on confirm the FK is set and the sheet
// gets back-filled with the investment's expenses.
export function UnlinkedRow({ sheet, availableInvestments }: PropsT) {
  return (
    <li className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{sheet.name}</p>
        <p className="text-muted-foreground text-xs">Bez przypisanej inwestycji</p>
      </div>
      <LinkSheetToInvestmentDialog
        sheetId={sheet.id}
        sheetName={sheet.name}
        availableInvestments={availableInvestments}
      />
    </li>
  )
}
