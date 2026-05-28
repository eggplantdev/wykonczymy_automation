import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileSpreadsheet, Plus } from 'lucide-react'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES } from '@/lib/auth/roles'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { fetchAllKosztoryses, type KosztorysRowT } from '@/lib/queries/kosztoryses'
import { AddKosztorysDialog } from '@/components/dialogs/add-kosztorys-dialog'
import { LinkKosztorysToInvestmentDialog } from '@/components/dialogs/link-kosztorys-to-investment-dialog'
import { KosztorysSetupDialog } from '@/components/dialogs/kosztorys-setup-dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/ui/external-link'
import { PageWrapper } from '@/components/ui/page-wrapper'

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
        <ExternalLink className="mr-auto" href={ALL_SHEETS_URL}>
          Otwórz w arkuszach google ↗
        </ExternalLink>
        <AddKosztorysDialog
          trigger={
            <Button size="sm">
              <Plus className="size-4" />
              Dodaj kosztorys bez inwestycji
            </Button>
          }
        />
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

// ── section + row primitives ─────────────────────────────────────────────

type SectionPropsT<T> = {
  title: string
  emptyMessage: string
  rows: T[]
  renderRow: (row: T) => React.ReactNode
}

function Section<T>({ title, emptyMessage, rows, renderRow }: SectionPropsT<T>) {
  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-lg font-medium">
        {title} <span className="text-muted-foreground text-sm">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <ul className="grid gap-2">{rows.map(renderRow)}</ul>
      )}
    </section>
  )
}

function LinkedRow({ kosztorys }: { kosztorys: KosztorysRowT }) {
  const inv = kosztorys.investment!
  return (
    <li className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{inv.name}</p>
        <p className="text-muted-foreground truncate text-xs">{kosztorys.name}</p>
      </div>
      <Button size="sm" asChild>
        <Link href={`/inwestycje/${inv.id}/kosztorys`}>
          <FileSpreadsheet className="size-4" />
          Otwórz
        </Link>
      </Button>
    </li>
  )
}

function UnlinkedRow({
  kosztorys,
  availableInvestments,
}: {
  kosztorys: KosztorysRowT
  availableInvestments: Array<{ id: number; name: string }>
}) {
  return (
    <li className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{kosztorys.name}</p>
        <p className="text-muted-foreground text-xs">Bez przypisanej inwestycji</p>
      </div>
      <LinkKosztorysToInvestmentDialog
        kosztorysId={kosztorys.id}
        kosztorysName={kosztorys.name}
        availableInvestments={availableInvestments}
      />
    </li>
  )
}

function NoKosztorysRow({
  investmentId,
  investmentName,
}: {
  investmentId: number
  investmentName: string
}) {
  return (
    <li className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{investmentName}</p>
        <p className="text-muted-foreground text-xs">Brak kosztorysu</p>
      </div>
      <KosztorysSetupDialog
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
