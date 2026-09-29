import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_ROLES } from '@/lib/auth/roles'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * Wygaszone do czasu EX-598. Raport sumował transakcje wielu inwestycji naraz, a obniżka za
 * rozliczanie wydatków po kwocie netto jest ustawiana per inwestycja — marża i bilans nigdy nie
 * zgadzały się z sumą kart inwestycji. Ostrzeżenie o tym stało w bannerze, ale liczby i tak były
 * czytane; strona bez wejścia w menu i bez figur nie kłamie.
 *
 * Poprzednia wersja (staty + tabela transakcji) siedzi w historii gita — EX-598 przywraca ją razem
 * z policzoną obniżką, zamiast pisać ją od zera.
 */
export default async function TransactionsReportPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_ROLES)
  if (!session.success) redirect('/zaloguj')

  return (
    <PageWrapper title={PAGE_TITLES.reports}>
      <EmptyState
        title="W budowie"
        description="Raport jest wyłączony — marża i bilans nie uwzględniały obniżek za rozliczanie wydatków po kwocie netto, więc nie zgadzały się z kartami inwestycji. Wróci, gdy będą liczone poprawnie."
      />
    </PageWrapper>
  )
}
