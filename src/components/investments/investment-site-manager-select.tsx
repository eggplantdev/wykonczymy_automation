'use client'

import { useOptimistic, useTransition } from 'react'
import { SimpleSelect } from '@/components/ui/simple-select'
import { setInvestmentSiteManagerAction } from '@/lib/actions/investments'
import { activeOrSelected } from '@/lib/utils/is-active-ref'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { WorkerRefT } from '@/types/reference-data'

// Radix Select refuses an empty-string item value.
const NONE = 'none'

type PropsT = {
  investmentId: number
  siteManagerId: number | undefined
  workers: WorkerRefT[]
}

export function InvestmentSiteManagerSelect({ investmentId, siteManagerId, workers }: PropsT) {
  const [selectedId, setSelectedId] = useOptimistic(siteManagerId)
  const [isPending, startTransition] = useTransition()

  const options = [
    { value: NONE, label: '— brak —' },
    ...activeOrSelected(workers, true, siteManagerId).map((worker) => ({
      value: String(worker.id),
      label: worker.name,
    })),
  ]

  function handleChange(value: string) {
    const next = value === NONE ? undefined : Number(value)
    startTransition(async () => {
      setSelectedId(next)
      const result = await settleAction(() =>
        setInvestmentSiteManagerAction(investmentId, next ?? null),
      )
      if (!result.success) toastMessage(result.error, 'error')
    })
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Kierownik budowy</span>
      <SimpleSelect
        value={selectedId === undefined ? NONE : String(selectedId)}
        onValueChange={handleChange}
        options={options}
        disabled={isPending}
        variant="soft"
      />
    </label>
  )
}
