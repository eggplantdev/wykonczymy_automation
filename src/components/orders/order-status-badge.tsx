'use client'

import { useOptimistic, useTransition } from 'react'
import { Badge, BadgeButton, type BadgeToneT } from '@/components/ui/badge'
import { setOrderStatusAction } from '@/lib/actions/order-status'
import type { OrderStatusT } from '@/lib/constants/orders'
import type { TranslatorT } from '@/lib/i18n/translations'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

const STATUS_TONES: Record<OrderStatusT, BadgeToneT> = {
  awaiting: 'pending',
  delivered: 'positive',
}

const NEXT_STATUS: Record<OrderStatusT, OrderStatusT> = {
  awaiting: 'delivered',
  delivered: 'awaiting',
}

type PropsT = {
  transferId: number
  status: OrderStatusT
  cancelled: boolean
  canFlip: boolean
  translator: TranslatorT<'transfers'>
}

export function OrderStatusBadge({ transferId, status, cancelled, canFlip, translator }: PropsT) {
  const [shown, setShown] = useOptimistic(status)
  const [isPending, startTransition] = useTransition()
  const label = translator.t(`orderStatus_${shown}`)
  const tone = cancelled ? 'muted' : STATUS_TONES[shown]

  if (cancelled || !canFlip) return <Badge tone={tone}>{label}</Badge>

  function flip() {
    const next = NEXT_STATUS[shown]
    startTransition(async () => {
      setShown(next)
      const result = await settleAction(() => setOrderStatusAction(transferId, next))
      if (!result.success) toastMessage(result.error, 'error')
    })
  }

  return (
    <BadgeButton
      tone={tone}
      title={translator.t('orderStatusToggle')}
      disabled={isPending}
      onClick={flip}
    >
      {label}
    </BadgeButton>
  )
}
