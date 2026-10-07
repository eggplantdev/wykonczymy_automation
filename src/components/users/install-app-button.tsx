'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, Ellipsis, Loader2, Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/hooks/use-translation'
import { isIosDevice, resolveInstallState } from '@/lib/pwa/install-state'

type BeforeInstallPromptEventT = Event & { prompt: () => Promise<void> }

type PwaNavigatorT = Navigator & {
  standalone?: boolean
  getInstalledRelatedApps?: () => Promise<unknown[]>
}

// Chrome fires `beforeinstallprompt` only once its engagement checks pass, which can take a while
// on a cold page — past this the button gives way to the browser-menu path.
const PROMPT_WAIT_MS = 60_000

type PlatformT = 'standalone' | 'ios' | 'browser'

const readPlatform = (): PlatformT => {
  const nav = navigator as PwaNavigatorT
  if (matchMedia('(display-mode: standalone)').matches || nav.standalone === true) {
    return 'standalone'
  }
  return isIosDevice(nav.userAgent, nav.maxTouchPoints) ? 'ios' : 'browser'
}

const subscribeNever = () => () => {}

export function InstallAppButton() {
  const { t } = useTranslation('workerPage')
  const platform = useSyncExternalStore(subscribeNever, readPlatform, () => undefined)
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEventT>()
  const [isInstalled, setIsInstalled] = useState(false)
  const [waitedOut, setWaitedOut] = useState(false)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEventT)
    }
    const onInstalled = () => setIsInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    void (navigator as PwaNavigatorT)
      .getInstalledRelatedApps?.()
      .then((apps) => setIsInstalled(apps.length > 0))
      .catch(() => {})
    const timer = setTimeout(() => setWaitedOut(true), PROMPT_WAIT_MS)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      clearTimeout(timer)
    }
  }, [])

  if (!platform) return null

  const state = resolveInstallState({
    isStandalone: platform === 'standalone',
    isInstalled,
    isIos: platform === 'ios',
    hasPrompt: promptEvent !== undefined,
    waitedOut,
  })

  if (state === 'hidden') return null

  if (state === 'manual') {
    return <p className="text-muted-foreground self-center text-sm">{t('installManual')}</p>
  }

  if (state === 'ios') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="w-fit">
            <Download />
            {t('installApp')}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader title={t('installIosTitle')} />
          <ol className="flex flex-col gap-4">
            {[
              { icon: Ellipsis, text: t('installIosStep1') },
              { icon: Share, text: t('installIosStep2') },
              { icon: SquarePlus, text: t('installIosStep3') },
            ].map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-center gap-3">
                <span className="text-muted-foreground w-4 shrink-0 text-right">{index + 1}.</span>
                <Icon className="size-6 shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    )
  }

  // The event can prompt only once, so it is dropped whatever the answer.
  const install = () => {
    void promptEvent?.prompt()
    setPromptEvent(undefined)
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="w-fit"
      disabled={state === 'waiting'}
      onClick={install}
    >
      {state === 'waiting' ? <Loader2 className="animate-spin" /> : <Download />}
      {t('installApp')}
    </Button>
  )
}
