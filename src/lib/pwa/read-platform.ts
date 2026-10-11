import { isIosDevice, type PlatformT } from '@/lib/pwa/install-state'

export const readPlatform = (): PlatformT => {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (matchMedia('(display-mode: standalone)').matches || nav.standalone === true) {
    return 'standalone'
  }
  return isIosDevice(nav.userAgent, nav.maxTouchPoints) ? 'ios' : 'browser'
}

export const subscribeNever = () => () => {}
