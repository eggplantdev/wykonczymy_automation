type InstallStateT = 'hidden' | 'ready' | 'waiting' | 'ios' | 'manual'

export type PlatformT = 'standalone' | 'ios' | 'browser'

type InstallSignalsT = {
  platform: PlatformT
  installed: boolean
  hasPrompt: boolean
  promptUsed: boolean
  waitedOut: boolean
}

// iOS never fires `beforeinstallprompt`, so it gets the guide rather than a wait; a prompt arriving
// after the wait ran out still wins over the menu hint. A dismissed prompt cannot be shown again on
// this page load, so after one the menu is the only path left.
export const resolveInstallState = ({
  platform,
  installed,
  hasPrompt,
  promptUsed,
  waitedOut,
}: InstallSignalsT): InstallStateT => {
  if (platform === 'standalone' || installed) return 'hidden'
  if (platform === 'ios') return 'ios'
  if (hasPrompt) return 'ready'
  if (waitedOut || promptUsed) return 'manual'
  return 'waiting'
}

// iPadOS reports itself as a Mac; the touch screen is what gives it away.
export const isIosDevice = (userAgent: string, maxTouchPoints: number): boolean =>
  /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
