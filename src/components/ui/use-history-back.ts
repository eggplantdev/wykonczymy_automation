'use client'

import { useRouter } from 'next/navigation'
import { hasInAppHistory, type NavigationHistoryLikeT } from '@/lib/nav/in-app-history'

// A direct load (shared link, refresh, new tab) has no in-app history to pop, so a bare
// `router.back()` leaves the user stranded — it either does nothing or walks them out of the app.
// Shared by the two back affordances so neither can drift back to the unguarded version.
export function useHistoryBack(fallbackHref: string) {
  const router = useRouter()

  return function goBack() {
    const navigation = (window as unknown as { navigation?: NavigationHistoryLikeT }).navigation
    if (hasInAppHistory(navigation, window.location.origin, window.history.length)) {
      router.back()
      return
    }
    router.push(fallbackHref)
  }
}
