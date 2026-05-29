'use client'

import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LinkSheetToInvestmentDialog } from '@/components/dialogs/link-sheet-to-investment-dialog'
import { SheetSetupDialog } from '@/components/dialogs/sheet-setup-dialog'

// The three former card-lists collapse into one row type discriminated by
// `status`. Optional fields are present only for the states that own them
// (see the mapping in the kosztorysy page). `status` has no column of its own —
// the Akcje button already names the state — but it still drives the filter.
export type SheetStatusT = 'linked' | 'unlinked' | 'no-sheet'

export type SheetTableRowT = {
  id: string
  status: SheetStatusT
  name: string
  investmentId?: number
  investmentName?: string
  sheetId?: number
  sheetName?: string
  googleSheetId?: string
}

type InvestmentOptionT = { id: number; name: string }

type SheetColumnOptionsT = {
  availableInvestments: InvestmentOptionT[]
}

const col = createColumnHelper<SheetTableRowT>()

export function getSheetColumns({ availableInvestments }: SheetColumnOptionsT) {
  return [
    col.accessor('name', {
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

    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { canHide: false, align: 'right' },
      cell: (info) => {
        const row = info.row.original

        if (row.status === 'linked')
          return (
            <Button size="sm" asChild>
              <Link href={`/inwestycje/${row.investmentId}/kosztorys`}>
                <FileSpreadsheet className="size-4" />
                Otwórz
              </Link>
            </Button>
          )

        if (row.status === 'unlinked')
          return (
            <LinkSheetToInvestmentDialog
              sheetId={row.sheetId!}
              sheetName={row.sheetName!}
              availableInvestments={availableInvestments}
            />
          )

        return (
          <SheetSetupDialog
            investmentId={row.investmentId!}
            investmentName={row.investmentName}
            trigger={
              <Button size="sm" variant="outline">
                Dodaj
              </Button>
            }
          />
        )
      },
    }),
  ]
}
