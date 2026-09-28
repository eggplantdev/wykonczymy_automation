import { EmptyState } from '@/components/ui/empty-state'
import { TrashedInvestmentActions } from '@/components/trash/trashed-investment-actions'
import { formatPLDate } from '@/lib/utils/format-date'
import type { TrashedInvestmentT } from '@/lib/queries/trash'

function fateOf(investment: TrashedInvestmentT): string {
  if (investment.daysLeft === null) return 'kosztorys w użyciu — tylko ręcznie'
  if (investment.daysLeft === 0) return 'usunie się samo przy najbliższym sprzątaniu'
  return `usunie się samo za ${investment.daysLeft} ${investment.daysLeft === 1 ? 'dzień' : 'dni'}`
}

export function TrashedInvestmentsList({ investments }: { investments: TrashedInvestmentT[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-base font-semibold">Inwestycje</h2>
      {investments.length === 0 ? (
        <EmptyState title="Kosz jest pusty" />
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {investments.map((investment) => (
            <li
              key={investment.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground font-medium">{investment.name}</span>
                <span className="text-muted-foreground text-sm">
                  W koszu od {formatPLDate(investment.trashedAt)} · {fateOf(investment)}
                </span>
              </div>
              <TrashedInvestmentActions investment={investment} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
