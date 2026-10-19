'use client'

import { useOptimistic, useTransition } from 'react'
import { SELECT_NONE, SimpleSelect } from '@/components/ui/simple-select'
import { setInvestmentSiteManagerAction } from '@/lib/actions/investments'
import { activeOrSelected } from '@/lib/utils/is-active-ref'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { WorkerRefT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  siteManagerId: number | undefined
  workers: WorkerRefT[]
}

export function InvestmentSiteManagerSelect({ investmentId, siteManagerId, workers }: PropsT) {
  const [selectedId, setSelectedId] = useOptimistic(siteManagerId)
  const [isPending, startTransition] = useTransition()

  const options = [
    { value: SELECT_NONE, label: '— brak —' },
    ...activeOrSelected(workers, true, siteManagerId).map((worker) => ({
      value: String(worker.id),
      label: worker.name,
    })),
  ]

  function handleChange(value: string) {
    const next = value === SELECT_NONE ? undefined : Number(value)
    startTransition(async () => {
      setSelectedId(next)
      const result = await settleAction(() =>
        setInvestmentSiteManagerAction(investmentId, next ?? null),
      )
      if (!result.success) toastMessage(result.error, 'error')
    })
  }

  return (
    <SimpleSelect
      value={selectedId === undefined ? SELECT_NONE : String(selectedId)}
      onValueChange={handleChange}
      options={options}
      disabled={isPending}
      variant="toolbarSm"
    />
  )
}
