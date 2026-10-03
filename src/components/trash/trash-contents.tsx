import { EmptyState } from '@/components/ui/empty-state'
import { TrashSection } from '@/components/trash/trash-section'
import { TRASH_KIND_ORDER, TRASH_KINDS } from '@/components/trash/trash-kinds'
import type { TrashRowT } from '@/types/trash'

export function TrashContents({ rows }: { rows: TrashRowT[] }) {
  if (rows.length === 0) return <EmptyState title="Kosz jest pusty" />

  return (
    <div className="flex flex-col gap-6">
      {TRASH_KIND_ORDER.map((kind) => {
        const kindRows = rows.filter((row) => row.kind === kind)
        if (kindRows.length === 0) return null
        return <TrashSection key={kind} title={TRASH_KINDS[kind].sectionTitle} rows={kindRows} />
      })}
    </div>
  )
}
