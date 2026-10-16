type InstallStateT = 'hidden' | 'ready' | 'waiting' | 'ios' | 'manual'

export type PlatformT = 'standalone' | 'ios' | 'browser'

type InstallSignalsT = {
  platform: PlatformT
  installed: boolean
  hasPrompt: boolean
  promptUsed: boolean
  waitedOut: boolean
}

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

export const readPlatform = (): PlatformT => {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (matchMedia('(display-mode: standalone)').matches || nav.standalone === true) {
    return 'standalone'
  }
  return isIosDevice(nav.userAgent, nav.maxTouchPoints) ? 'ios' : 'browser'
}
