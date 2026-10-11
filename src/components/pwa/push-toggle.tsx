'use client'

import { useState, useSyncExternalStore, useTransition } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/use-translation'
import { VAPID_PUBLIC_KEY } from '@/lib/env'
import { isPushSupported, subscribeThisDevice, unsubscribeThisDevice } from '@/lib/pwa/push-client'
import { readPlatform, subscribeNever } from '@/lib/pwa/read-platform'
import { logError } from '@/lib/utils/log-error'
import { toastMessage } from '@/lib/utils/toast'
import { usePushSubscriptionStore } from '@/stores/push-subscription-store'

const readPermission = () => (isPushSupported() ? Notification.permission : 'unsupported')

type PushTogglePropsT = {
  className?: string
}

export function PushToggle({ className }: PushTogglePropsT) {
  const { t } = useTranslation('workerPage')
  const platform = useSyncExternalStore(subscribeNever, readPlatform, () => undefined)
  const permission = useSyncExternalStore(subscribeNever, readPermission, () => undefined)
  const subscribed = usePushSubscriptionStore((s) => s.subscribed)
  const [refused, setRefused] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Safari outside the home-screen app has no push at all, so the install button is the way there.
  if (!VAPID_PUBLIC_KEY || !platform || platform === 'ios') return null
  if (!permission || permission === 'unsupported' || subscribed === undefined) return null

  if (permission === 'denied' || refused) {
    return <p className="text-muted-foreground self-center text-sm">{t('pushBlocked')}</p>
  }

  const publicKey = VAPID_PUBLIC_KEY

  // The subscribe path must start inside the click: iOS shows the permission prompt only from a
  // user gesture, and `startTransition` runs its callback synchronously.
  const handleClick = () =>
    startTransition(async () => {
      if (subscribed) {
        await unsubscribeThisDevice()
        usePushSubscriptionStore.setState({ subscribed: false })
        toastMessage(t('pushDisabled'))
        return
      }
      try {
        const result = await subscribeThisDevice(publicKey)
        // A dismissed prompt can be asked again; only a refusal sends the worker to the settings.
        if (result === 'denied') return setRefused(Notification.permission === 'denied')
        if (!result.success) return toastMessage(t('pushFailed'), 'error')
        usePushSubscriptionStore.setState({ subscribed: true })
        toastMessage(t('pushEnabled'))
      } catch (err) {
        // TODO(EX-449) SENTRY-REQUIRED: push subscribe failed in the browser
        logError('[PUSH] subscribe failed', err)
        toastMessage(t('pushFailed'), 'error')
      }
    })

  const Icon = isPending ? Loader2 : subscribed ? BellOff : Bell

  return (
    <Button
      size="sm"
      variant="outline"
      className={className}
      disabled={isPending}
      onClick={handleClick}
    >
      <Icon className={isPending ? 'animate-spin' : undefined} />
      {subscribed ? t('pushDisable') : t('pushEnable')}
    </Button>
  )
}
