import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES } from '@/lib/auth/roles'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchAllKosztoryses } from '@/lib/queries/kosztoryses'
import { AddKosztorysDialog } from '@/components/dialogs/add-kosztorys-dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/ui/external-link'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { LinkedRow } from './linked-row'
import { NoKosztorysRow } from './no-kosztorys-row'
import { Section } from './section'
import { UnlinkedRow } from './unlinked-row'

// Owner's Sheets file picker — used by both the listing header and the
// AddKosztorysDialog so the user can create a fresh sheet in a new tab and
// paste its URL back without losing their place in the app.
const ALL_SHEETS_URL = 'https://docs.google.com/spreadsheets/u/0/'

export default async function KosztorysyListPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')

  const [refData, kosztoryses] = await Promise.all([fetchReferenceData(), fetchAllKosztoryses()])

  const linked = kosztoryses.filter((k) => k.investment !== undefined)
  const unlinked = kosztoryses.filter((k) => k.investment === undefined)

  // Investments eligible for linking = those without a kosztorys. Reused both
  // for section 3 (rendering them) and for the dialog (the picker's options).
  const investmentsWithoutSheet = refData.investments
    .filter((i) => !i.hasSheet)
    .map((i) => ({ id: i.id, name: i.name }))

  return (
    <PageWrapper title="Kosztorysy">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <AddKosztorysDialog
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
        renderRow={(k) => <LinkedRow key={k.id} kosztorys={k} />}
      />

      <Section
        title="Kosztorysy bez inwestycji"
        emptyMessage="Wszystkie kosztorysy mają przypisaną inwestycję."
        rows={unlinked}
        renderRow={(k) => (
          <UnlinkedRow key={k.id} kosztorys={k} availableInvestments={investmentsWithoutSheet} />
        )}
      />

      <Section
        title="Inwestycje bez kosztorysu"
        emptyMessage="Każda inwestycja ma już kosztorys."
        rows={investmentsWithoutSheet}
        renderRow={(inv) => (
          <NoKosztorysRow key={inv.id} investmentId={inv.id} investmentName={inv.name} />
        )}
      />
    </PageWrapper>
  )
}
