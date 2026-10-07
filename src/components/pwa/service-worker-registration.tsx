'use client'

import { useEffect } from 'react'

// Production only: a service worker in dev would sit between the browser and HMR.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    void navigator.serviceWorker.register('/sw.js', { scope: '/' })
  }, [])

  return null
}
