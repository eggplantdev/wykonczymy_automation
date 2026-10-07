import type { MetadataRoute } from 'next'
import { FRONTEND_URL } from '@/lib/env'

const WHITE = '#ffffff'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Wykończymy',
    short_name: 'Wykończymy',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: WHITE,
    theme_color: WHITE,
    lang: 'pl',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Lists the app as its own related app, so `getInstalledRelatedApps` can hide the install
    // button once the icon is on the home screen.
    related_applications: [
      { platform: 'webapp', url: new URL('/manifest.webmanifest', FRONTEND_URL).href },
    ],
    prefer_related_applications: false,
  }
}
