'use client'

import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { Link2, Plus } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { OptionalLink } from '@/components/ui/optional-link'
import { LinkSheetToInvestmentDialog } from '@/components/dialogs/link-sheet-to-investment-dialog'
import { LinkedSheetActions } from '@/components/sheets/linked-sheet-actions'
import { SheetSetupDialog } from '@/components/dialogs/sheet-setup-dialog'
import { SHEET_STATUS_LABELS } from '@/lib/constants/sheets'
import type { InvestmentWithoutSheetRowT, KosztorysRowT } from '@/types/table-rows'

type InvestmentOptionT = { id: number; name: string }

const kosztorysCol = createColumnHelper<KosztorysRowT>()
const investmentCol = createColumnHelper<InvestmentWithoutSheetRowT>()

export function getKosztorysColumns({
  availableInvestments,
}: {
  availableInvestments: InvestmentOptionT[]
}) {
  return [
    kosztorysCol.accessor('name', {
      id: 'name',
      header: 'Nazwa',
      cell: (info) => {
        const row = info.row.original
        return (
          <span className="font-medium">
            <OptionalLink
              href={row.investmentId !== undefined ? `/inwestycje/${row.investmentId}` : undefined}
            >
              {info.getValue()}
            </OptionalLink>
          </span>
        )
      },
    }),

    // Accessor on the label so the sort follows the visible Polish text, not the enum value.
    kosztorysCol.accessor((row) => SHEET_STATUS_LABELS[row.status], {
      id: 'status',
      header: 'Status',
      cell: (info) => <span className="text-muted-foreground text-sm">{info.getValue()}</span>,
    }),

    kosztorysCol.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
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
            trigger={<RowActionButton icon={Link2} label="Powiąż z inwestycją" />}
          />
        )
      },
    }),
  ]
}

export function getInvestmentWithoutSheetColumns() {
  return [
    investmentCol.accessor('name', {
      id: 'name',
      header: 'Inwestycja',
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
      meta: { align: 'right' },
      cell: (info) => {
        const row = info.row.original
        return (
          <SheetSetupDialog
            investmentId={row.investmentId}
            trigger={<RowActionButton icon={Plus} label="Dodaj kosztorys" />}
          />
        )
      },
    }),
  ]
}
