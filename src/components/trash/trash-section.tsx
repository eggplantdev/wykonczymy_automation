import { TrashedInvestmentLinks } from '@/components/trash/trashed-investment-links'
import { TrashedRowActions } from '@/components/trash/trashed-row-actions'
import { daysLabel } from '@/lib/utils/deadline-label'
import { formatPLDate } from '@/lib/utils/format-date'
import type { TrashRowT } from '@/types/trash'

function fateOf(row: TrashRowT): string {
  if (!row.autoPurges) return 'kosztorys w użyciu — tylko ręcznie'
  if (row.daysLeft === 0) return 'usunie się samo przy najbliższym sprzątaniu'
  return `usunie się samo ${daysLabel(row.daysLeft)}`
}

export function TrashSection({ title, rows }: { title: string; rows: TrashRowT[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-foreground text-base font-semibold">{title}</h2>
      <ul className="divide-border border-border divide-y rounded-md border">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground font-medium">{row.name}</span>
              <span className="text-muted-foreground text-sm">
                W koszu od {formatPLDate(row.trashedAt)} · {fateOf(row)}
              </span>
              {row.kind === 'investment' && <TrashedInvestmentLinks row={row} />}
            </div>
            <TrashedRowActions row={row} />
          </li>
        ))}
      </ul>
    </section>
  )
}
