'use client'

import { useEffect } from 'react'
// Loaded with the shell, so the one `beforeinstallprompt` of a page load is caught whichever page it fires on.
import '@/stores/install-prompt-store'
import { logError } from '@/lib/utils/log-error'

// Production only: a service worker in dev would sit between the browser and HMR.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => logError('[ServiceWorkerRegistration] register failed:', err))
  }, [])

  return null
}
