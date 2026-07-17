'use client'

import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { LinkSheetToInvestmentDialog } from '@/components/dialogs/link-sheet-to-investment-dialog'
import { LinkedSheetActions } from '@/components/sheets/linked-sheet-actions'
import { SheetSetupDialog } from '@/components/dialogs/sheet-setup-dialog'
import { SHEET_STATUS_LABELS, type SheetStatusT } from '@/lib/constants/sheets'

// A kosztorys is a real Google Sheet registered in the app — either linked to an
// investment or standing alone. This is a distinct entity from an investment
// that simply has no kosztorys yet (see InvestmentWithoutSheetRowT), which is why
// the two now render as separate tables instead of one status-discriminated list.
export type KosztorysRowT = {
  id: string
  status: SheetStatusT
  name: string
  sheetId: number
  sheetName: string
  googleSheetId: string
  investmentId?: number
  investmentName?: string
}

// An investment with no kosztorys yet — the target for "Dodaj kosztorys".
export type InvestmentWithoutSheetRowT = {
  id: string
  investmentId: number
  name: string
}

type InvestmentOptionT = { id: number; name: string }

const kosztorysCol = createColumnHelper<KosztorysRowT>()
const investmentCol = createColumnHelper<InvestmentWithoutSheetRowT>()

// Columns for the Kosztorysy table: name, sortable status, and per-row actions
// (linked → open/unlink/delete; unlinked → link to an investment).
export function getKosztorysColumns({
  availableInvestments,
}: {
  availableInvestments: InvestmentOptionT[]
}) {
  return [
    kosztorysCol.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      meta: { canHide: false },
      cell: (info) => {
        const row = info.row.original
        if (row.investmentId !== undefined)
          return (
            <Link href={`/inwestycje/${row.investmentId}`} className="font-medium hover:underline">
              {info.getValue()}
            </Link>
          )
        return <span className="font-medium">{info.getValue()}</span>
      },
    }),

    // Accessor on the label (not the raw status) so the sort follows the visible
    // Polish text rather than the internal enum value.
    kosztorysCol.accessor((row) => SHEET_STATUS_LABELS[row.status], {
      id: 'status',
      header: 'Status',
      cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
    }),

    kosztorysCol.display({
      id: 'actions',
      header: 'Akcje',
      meta: { canHide: false, align: 'right' },
      cell: (info) => {
        const row = info.row.original

        if (row.status === 'linked')
          return (
            <LinkedSheetActions
              sheetId={row.sheetId}
              investmentId={row.investmentId!}
              investmentName={row.investmentName!}
            />
          )

        return (
          <LinkSheetToInvestmentDialog
            sheetId={row.sheetId}
            sheetName={row.sheetName}
            availableInvestments={availableInvestments}
            trigger={
              <Button size="sm" variant="outline">
                Powiąż inwestycję
              </Button>
            }
          />
        )
      },
    }),
  ]
}

// Columns for the "Inwestycje bez kosztorysu" table: investment name + the
// action to attach a kosztorys (link existing; auto-create stays disabled).
export function getInvestmentWithoutSheetColumns() {
  return [
    investmentCol.accessor('name', {
      id: 'name',
      header: 'Inwestycja',
      meta: { canHide: false },
      cell: (info) => {
        const row = info.row.original
        return (
          <Link href={`/inwestycje/${row.investmentId}`} className="font-medium hover:underline">
            {info.getValue()}
          </Link>
        )
      },
    }),

    investmentCol.display({
      id: 'actions',
      header: 'Akcje',
      meta: { canHide: false, align: 'right' },
      cell: (info) => {
        const row = info.row.original
        return (
          <SheetSetupDialog
            investmentId={row.investmentId}
            trigger={
              <Button size="sm" variant="outline">
                Dodaj kosztorys
              </Button>
            }
          />
        )
      },
    }),
  ]
}
