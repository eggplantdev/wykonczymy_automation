import type { MetadataRoute } from 'next'
import { PWA_NAME, PWA_THEME_COLOR } from '@/lib/pwa/head'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: PWA_NAME,
    short_name: PWA_NAME,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: PWA_THEME_COLOR,
    theme_color: PWA_THEME_COLOR,
    lang: 'pl',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Lists the app as its own related app, so `getInstalledRelatedApps` can hide the install
    // button once the icon is on the home screen. Relative, so it resolves against whichever origin
    // serves the manifest — preview included.
    related_applications: [{ platform: 'webapp', url: '/manifest.webmanifest' }],
    prefer_related_applications: false,
  }
}
