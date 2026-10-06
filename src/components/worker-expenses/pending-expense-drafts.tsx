'use client'

import { Loader2 } from 'lucide-react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import { Button } from '@/components/ui/button'
import { useExpenseDraftAcceptance } from '@/components/worker-expenses/use-expense-draft-acceptance'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { ReferenceDataT } from '@/types/reference-data'

type PropsT = {
  drafts: ExpenseDraftRowT[]
  referenceData: ReferenceDataT
}

export function PendingExpenseDrafts({ drafts, referenceData }: PropsT) {
  const { open, loadingId, dialogs } = useExpenseDraftAcceptance(referenceData)
  const columns = useExpenseDraftColumns({
    isManagerView: true,
    isPendingQueue: true,
    actions: (draft) => (
      <Button size="sm" disabled={loadingId !== undefined} onClick={() => open(draft)}>
        {loadingId === draft.id && <Loader2 className="animate-spin" />}
        Zobacz
      </Button>
    ),
  })

  if (drafts.length === 0) return null

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Wydatki zgłoszone przez pracowników</h2>
      <DataTable data={drafts} columns={columns} storageKey="pending-expense-drafts" />
      {dialogs}
    </section>
  )
}
