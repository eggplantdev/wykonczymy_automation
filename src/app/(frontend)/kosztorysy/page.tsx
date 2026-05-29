import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES } from '@/lib/auth/roles'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchAllSheets } from '@/lib/queries/sheets'
import { ALL_SHEETS_URL } from '@/lib/constants/sheets'
import { ExternalLink } from '@/components/ui/external-link'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { KosztorysDataTable } from '@/components/sheets/kosztorys-data-table'
import { InvestmentsWithoutSheetTable } from '@/components/sheets/investments-without-sheet-table'
import type { KosztorysRowT, InvestmentWithoutSheetRowT } from '@/lib/tables/sheets'

export default async function SheetsListPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')

  const [refData, sheets] = await Promise.all([fetchReferenceData(), fetchAllSheets()])

  // Investments eligible for linking = those without a kosztorys. Reused both
  // for the second table and as the picker options in the link dialog.
  const investmentsWithoutSheet = refData.investments
    .filter((i) => !i.hasSheet)
    .map((i) => ({ id: i.id, name: i.name }))

  // Table 1: actual kosztorysy (real sheets), linked or not.
  const kosztorysRows: KosztorysRowT[] = sheets.map(
    (s): KosztorysRowT =>
      s.investment !== undefined
        ? {
            id: `sheet-${s.id}`,
            status: 'linked',
            name: s.investment.name,
            investmentId: s.investment.id,
            investmentName: s.investment.name,
            sheetId: s.id,
            sheetName: s.name,
            googleSheetId: s.googleSheetId,
          }
        : {
            id: `sheet-${s.id}`,
            status: 'unlinked',
            name: s.name,
            sheetId: s.id,
            sheetName: s.name,
            googleSheetId: s.googleSheetId,
          },
  )

  // Table 2: investments that have no kosztorys yet.
  const investmentRows: InvestmentWithoutSheetRowT[] = investmentsWithoutSheet.map((inv) => ({
    id: `inv-${inv.id}`,
    investmentId: inv.id,
    name: inv.name,
  }))

  return (
    <PageWrapper title="Kosztorysy">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ExternalLink href={ALL_SHEETS_URL}>Otwórz arkusze google ↗</ExternalLink>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Kosztorysy</h2>
        <KosztorysDataTable data={kosztorysRows} availableInvestments={investmentsWithoutSheet} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Inwestycje bez kosztorysu</h2>
        <InvestmentsWithoutSheetTable data={investmentRows} />
      </section>
    </PageWrapper>
  )
}
