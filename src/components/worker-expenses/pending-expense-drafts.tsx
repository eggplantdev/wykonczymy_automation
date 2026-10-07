'use client'

import { DataTable } from '@/components/tables/data-table/data-table'
import { useExpenseDraftColumns } from '@/components/tables/expense-drafts'
import { useExpenseDraftAcceptance } from '@/components/worker-expenses/use-expense-draft-acceptance'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { ReferenceDataT } from '@/types/reference-data'

type PropsT = {
  drafts: ExpenseDraftRowT[]
  referenceData: ReferenceDataT
}

export function PendingExpenseDrafts({ drafts, referenceData }: PropsT) {
  const { openButton, dialogs } = useExpenseDraftAcceptance(referenceData)
  const columns = useExpenseDraftColumns({
    isManagerView: true,
    isPendingQueue: true,
    actions: openButton,
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
