import type { Metadata, Viewport } from 'next'

// Both shells: the home-screen app opens on `/zaloguj` before it ever reaches the app.
export const PWA_METADATA: Metadata = {
  appleWebApp: { capable: true, title: 'Wykończymy', statusBarStyle: 'default' },
}

export const PWA_VIEWPORT: Viewport = { themeColor: '#ffffff' }
