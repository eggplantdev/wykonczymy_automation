import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES } from '@/lib/auth/roles'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchAllSheets } from '@/lib/queries/sheets'
import { ALL_SHEETS_URL } from '@/lib/constants/sheets'
import { AddSheetDialog } from '@/components/dialogs/add-sheet-dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/ui/external-link'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { LinkedRow } from '@/components/sheets/linked-row'
import { NoSheetRow } from '@/components/sheets/no-sheet-row'
import { Section } from '@/components/sheets/section'
import { UnlinkedRow } from '@/components/sheets/unlinked-row'

export default async function SheetsListPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')

  const [refData, sheets] = await Promise.all([fetchReferenceData(), fetchAllSheets()])

  const linked = sheets.filter((k) => k.investment !== undefined)
  const unlinked = sheets.filter((k) => k.investment === undefined)

  // Investments eligible for linking = those without a kosztorys. Reused both
  // for section 3 (rendering them) and for the dialog (the picker's options).
  const investmentsWithoutSheet = refData.investments
    .filter((i) => !i.hasSheet)
    .map((i) => ({ id: i.id, name: i.name }))

  return (
    <PageWrapper title="Kosztorysy">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <AddSheetDialog
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Dodaj kosztorys bez inwestycji
              </Button>
            }
          />
        </div>
        <ExternalLink href={ALL_SHEETS_URL}>Otwórz w arkuszach google ↗</ExternalLink>
      </div>

      <Section
        title="Inwestycje z kosztorysami"
        emptyMessage="Żadna inwestycja nie ma jeszcze kosztorysu."
        rows={linked}
        renderRow={(k) => <LinkedRow key={k.id} sheet={k} />}
      />

      <Section
        title="Kosztorysy bez inwestycji"
        emptyMessage="Wszystkie kosztorysy mają przypisaną inwestycję."
        rows={unlinked}
        renderRow={(k) => (
          <UnlinkedRow key={k.id} sheet={k} availableInvestments={investmentsWithoutSheet} />
        )}
      />

      <Section
        title="Inwestycje bez kosztorysu"
        emptyMessage="Każda inwestycja ma już kosztorys."
        rows={investmentsWithoutSheet}
        renderRow={(inv) => (
          <NoSheetRow key={inv.id} investmentId={inv.id} investmentName={inv.name} />
        )}
      />
    </PageWrapper>
  )
}
