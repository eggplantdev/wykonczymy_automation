import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES } from '@/lib/auth/roles'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchAllSheets } from '@/lib/queries/sheets'
import { ALL_SHEETS_URL } from '@/lib/constants/sheets'
import { ExternalLink } from '@/components/ui/external-link'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { SheetDataTable } from '@/components/sheets/sheet-data-table'
import type { SheetTableRowT } from '@/lib/tables/sheets'

export default async function SheetsListPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')

  const [refData, sheets] = await Promise.all([fetchReferenceData(), fetchAllSheets()])

  // Investments eligible for linking = those without a kosztorys. Reused both
  // for the no-sheet rows and as the picker options in the link dialog.
  const investmentsWithoutSheet = refData.investments
    .filter((i) => !i.hasSheet)
    .map((i) => ({ id: i.id, name: i.name }))

  // Flatten the three former sections into one discriminated row set.
  const linkedRows: SheetTableRowT[] = sheets
    .filter((s) => s.investment !== undefined)
    .map((s) => ({
      id: `sheet-${s.id}`,
      status: 'linked',
      name: s.investment!.name,
      investmentId: s.investment!.id,
      investmentName: s.investment!.name,
      sheetId: s.id,
      sheetName: s.name,
      googleSheetId: s.googleSheetId,
    }))

  const unlinkedRows: SheetTableRowT[] = sheets
    .filter((s) => s.investment === undefined)
    .map((s) => ({
      id: `sheet-${s.id}`,
      status: 'unlinked',
      name: s.name,
      sheetId: s.id,
      sheetName: s.name,
      googleSheetId: s.googleSheetId,
    }))

  const noSheetRows: SheetTableRowT[] = investmentsWithoutSheet.map((inv) => ({
    id: `inv-${inv.id}`,
    status: 'no-sheet',
    name: inv.name,
    investmentId: inv.id,
    investmentName: inv.name,
  }))

  const rows = [...linkedRows, ...unlinkedRows, ...noSheetRows]

  return (
    <PageWrapper title="Kosztorysy">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ExternalLink href={ALL_SHEETS_URL}>Otwórz w arkuszach google ↗</ExternalLink>
      </div>

      <SheetDataTable data={rows} availableInvestments={investmentsWithoutSheet} />
    </PageWrapper>
  )
}
