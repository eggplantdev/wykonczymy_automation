import { create } from 'zustand'

type PushSubscriptionStoreT = {
  /** `undefined` until the open-time sync has read this device's subscription. */
  subscribed: boolean | undefined
}

export const usePushSubscriptionStore = create<PushSubscriptionStoreT>()(() => ({
  subscribed: undefined,
}))
