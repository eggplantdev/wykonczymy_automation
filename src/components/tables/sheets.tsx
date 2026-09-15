'use client'

import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { Link2, Plus } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { OptionalLink } from '@/components/ui/optional-link'
import { LinkSheetToInvestmentDialog } from '@/components/dialogs/link-sheet-to-investment-dialog'
import { LinkedSheetActions } from '@/components/sheets/linked-sheet-actions'
import { OpenKosztorysV2Button } from '@/components/kosztorys/open-kosztorys-v2-button'
import { SheetSetupDialog } from '@/components/dialogs/sheet-setup-dialog'
import { SHEET_STATUS_LABELS } from '@/lib/constants/sheets'
import type { InvestmentWithoutSheetRowT, KosztorysRowT } from '@/types/table-rows'

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

// Columns for the "Inwestycje bez kosztorysu" table: investment name + the
// action to attach a kosztorys (link existing; auto-create stays disabled). The
// kosztorys_v2 link is still offered — the in-app editor exists regardless of a sheet.
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
          <div className="flex items-center justify-end gap-2">
            <OpenKosztorysV2Button investmentId={row.investmentId} label="kosztorys_v2" />

            <SheetSetupDialog
              investmentId={row.investmentId}
              trigger={<RowActionButton icon={Plus} label="Dodaj kosztorys" />}
            />
          </div>
        )
      },
    }),
  ]
}
