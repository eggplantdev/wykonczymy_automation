'use client'

import { useTransition } from 'react'
import { WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { fillCatalogueTranslationsAction } from '@/lib/actions/work-catalogue'
import { NOTICE_MS, translationFillNotice } from '@/lib/utils/notice'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

export function FillCatalogueTranslationsButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition()

  const fill = () =>
    startTransition(async () => {
      const result = await settleAction(fillCatalogueTranslationsAction)
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      const { message, kind } = translationFillNotice(result.data)
      toastMessage(message, kind, NOTICE_MS)
    })

  if (count === 0) return null

  return (
    <Button size="sm" variant="ai" onClick={fill} disabled={pending}>
      {pending ? <GradientSpinner /> : <WandSparkles className="text-neon-cyan" />}
      <span className="text-neon-cyan font-semibold">
        {pending ? 'Tłumaczę…' : `Uzupełnij tłumaczenia (AI) · ${count}`}
      </span>
    </Button>
  )
}
