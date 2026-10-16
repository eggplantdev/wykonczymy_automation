import { subscribePushAction, unsubscribePushAction } from '@/lib/actions/push'
import { fetchOwnPendingPayoutCount } from '@/lib/queries/pending-payouts'
import { logError } from '@/lib/utils/log-error'
import type { ActionResultT } from '@/types/action'

export const isPushSupported = (): boolean =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const base64UrlToBytes = (base64Url: string): Uint8Array<ArrayBuffer> => {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

const isSubscribedWithKey = (subscription: PushSubscription, publicKey: string): boolean => {
  const current = subscription.options.applicationServerKey
  if (!current) return false
  const expected = base64UrlToBytes(publicKey)
  const actual = new Uint8Array(current)
  return (
    actual.length === expected.length && actual.every((byte, index) => byte === expected[index])
  )
}

// outside production no worker is registered, and `ready` would then
// never settle — holding the logout that waits on this forever.
async function getPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

const toSubscriptionInput = (subscription: PushSubscription) => {
  const { endpoint, keys } = subscription.toJSON()
  return { endpoint: endpoint ?? '', keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' } }
}

/**
 * Call straight from the click handler: iOS grants the permission prompt only inside a user gesture,
 * so the permission request is the first thing this does.
 */
export async function subscribeThisDevice(publicKey: string): Promise<ActionResultT | 'denied'> {
  if ((await Notification.requestPermission()) !== 'granted') return 'denied'
  // `ready` only settles once a worker is registered; without one the toggle would spin forever.
  if (!(await navigator.serviceWorker.getRegistration())) {
    return { success: false, error: 'Brak service workera' }
  }
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToBytes(publicKey),
  })
  return subscribePushAction(toSubscriptionInput(subscription))
}

/**
 * iOS has no `pushsubscriptionchange`, so every app open re-registers the device
 */
export async function syncPushSubscription(publicKey: string): Promise<boolean> {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return false
    const subscription = await getPushSubscription()
    if (!subscription) return false
    if (!isSubscribedWithKey(subscription, publicKey)) {
      await subscription.unsubscribe()
      return false
    }
    return (await subscribePushAction(toSubscriptionInput(subscription))).success
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: a failed re-registration silently stops this device's pushes.
    logError('[PUSH] subscription sync failed', err)
    return false
  }
}

export async function unsubscribeThisDevice(): Promise<void> {
  try {
    if (!isPushSupported()) return
    const subscription = await getPushSubscription()
    if (!subscription) return
    const { endpoint } = subscription
    await subscription
      .unsubscribe()
      .catch((err: unknown) => logError('[PUSH] browser unsubscribe failed', err))
    await unsubscribePushAction(endpoint)
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: a device left subscribed keeps getting the logged-out account's pushes.
    logError('[PUSH] unsubscribe failed', err)
  }
}

export async function syncAppBadge(): Promise<void> {
  if (!('setAppBadge' in navigator)) return
  try {
    const count = await fetchOwnPendingPayoutCount()
    await (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge())
  } catch (err) {
    logError('[PUSH] badge sync failed', err)
  }
}
