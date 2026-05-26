import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES } from '@/lib/auth/roles'
import { getInvestmentsForKosztorys } from '@/lib/queries/investments'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { cn } from '@/lib/cn'

export default async function KosztorysyListPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')

  // TODO: add filtering (by status, linked/unlinked, name search) — for now we
  // only surface investments that already have a linked kosztorys sheet.
  const investments = (await getInvestmentsForKosztorys()).filter((inv) => inv.hasSheet)

  return (
    <PageWrapper title="Kosztorysy" description="Wybierz inwestycję, aby otworzyć jej kosztorys.">
      {investments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Brak powiązanych kosztorysów.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {investments.map((investment) => (
            <li key={investment.id}>
              <Link
                href={`/inwestycje/${investment.id}/kosztorys`}
                className="border-border hover:bg-accent flex items-center justify-between gap-3 rounded-md border px-4 py-3 transition-colors"
              >
                <span className="text-foreground font-medium">{investment.name}</span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={investment.status} />
                  <SheetBadge hasSheet={investment.hasSheet} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageWrapper>
  )
}

const BADGE_BASE = 'inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium'

function StatusBadge({ status }: { status: 'active' | 'completed' }) {
  const isActive = status === 'active'
  return (
    <span
      className={cn(
        BADGE_BASE,
        isActive
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      )}
    >
      {isActive ? 'Aktywna' : 'Zakończona'}
    </span>
  )
}

function SheetBadge({ hasSheet }: { hasSheet: boolean }) {
  return (
    <span
      className={cn(
        BADGE_BASE,
        hasSheet
          ? 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      )}
    >
      {hasSheet ? 'Powiązany' : 'Brak kosztorysu'}
    </span>
  )
}
