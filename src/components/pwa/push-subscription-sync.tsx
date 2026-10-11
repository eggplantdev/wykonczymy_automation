'use client'

import { useEffect } from 'react'
import { VAPID_PUBLIC_KEY } from '@/lib/env'
import { syncPushSubscription } from '@/lib/pwa/push-client'
import { usePushSubscriptionStore } from '@/stores/push-subscription-store'

export function PushSubscriptionSync() {
  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return
    void syncPushSubscription(VAPID_PUBLIC_KEY).then((subscribed) =>
      usePushSubscriptionStore.setState({ subscribed }),
    )
  }, [])

  return null
}
