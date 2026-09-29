import { EmptyState } from '@/components/ui/empty-state'
import { TrashSection } from '@/components/trash/trash-section'
import type { TrashedInvestmentT } from '@/lib/queries/trash'

export function TrashContents({ rows }: { rows: TrashedInvestmentT[] }) {
  if (rows.length === 0) return <EmptyState title="Kosz jest pusty" />

  const investments = rows.filter((row) => !row.isTemplate)
  const templates = rows.filter((row) => row.isTemplate)

  return (
    <div className="flex flex-col gap-6">
      {investments.length > 0 && <TrashSection title="Inwestycje" rows={investments} />}
      {templates.length > 0 && <TrashSection title="Szablony" rows={templates} />}
    </div>
  )
}
