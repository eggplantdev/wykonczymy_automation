'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { countCatalogueUsage } from '@/lib/queries/catalogue-usage'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { CatalogueUsageT } from '@/lib/kosztorys/work-catalogue/types'

// A click, not a load: the read walks every kosztorys, and the answer is only worth its cost to
// whoever is about to prune the cennik.
export function CountUsageButton({ onCounted }: { onCounted: (usage: CatalogueUsageT) => void }) {
  const [pending, startTransition] = useTransition()

  const count = () =>
    startTransition(async () => {
      const result = await settleAction(countCatalogueUsage)
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      onCounted(result.data)
    })

  return (
    <Button size="sm" variant="outline" onClick={count} disabled={pending}>
      {pending ? 'Liczę…' : 'Policz użycia'}
    </Button>
  )
}
