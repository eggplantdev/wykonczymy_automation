export type InstallStateT = 'hidden' | 'ready' | 'waiting' | 'ios' | 'manual'

type InstallSignalsT = {
  /** Running as the home-screen app: `display-mode: standalone`, or `navigator.standalone` on iOS. */
  isStandalone: boolean
  /** `getInstalledRelatedApps()` found the app on this device. */
  isInstalled: boolean
  isIos: boolean
  /** A `beforeinstallprompt` event is held. */
  hasPrompt: boolean
  /** The wait for that event ran out. */
  waitedOut: boolean
}

// iOS never fires `beforeinstallprompt`, so it gets the guide rather than a wait; a prompt arriving
// after the wait ran out still wins over the menu hint.
export const resolveInstallState = ({
  isStandalone,
  isInstalled,
  isIos,
  hasPrompt,
  waitedOut,
}: InstallSignalsT): InstallStateT => {
  if (isStandalone || isInstalled) return 'hidden'
  if (isIos) return 'ios'
  if (hasPrompt) return 'ready'
  if (waitedOut) return 'manual'
  return 'waiting'
}

// iPadOS reports itself as a Mac; the touch screen is what gives it away.
export const isIosDevice = (userAgent: string, maxTouchPoints: number): boolean =>
  /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
