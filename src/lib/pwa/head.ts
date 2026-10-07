import type { Metadata, Viewport } from 'next'

export const PWA_NAME = 'Wykończymy'
export const PWA_THEME_COLOR = '#ffffff'

// Both shells: the home-screen app opens on `/zaloguj` before it ever reaches the app.
export const PWA_METADATA: Metadata = {
  appleWebApp: { capable: true, title: PWA_NAME, statusBarStyle: 'default' },
}

export const PWA_VIEWPORT: Viewport = { themeColor: PWA_THEME_COLOR }
