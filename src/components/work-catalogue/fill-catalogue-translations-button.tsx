'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { fillCatalogueTranslationsAction } from '@/lib/actions/work-catalogue'
import { NOTICE_MS, translationFillNotice } from '@/lib/utils/notice'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

export function FillCatalogueTranslationsButton() {
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

  return (
    <Button size="sm" variant="outline" onClick={fill} disabled={pending}>
      {pending ? 'Tłumaczę…' : 'Uzupełnij tłumaczenia (AI)'}
    </Button>
  )
}
