'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, Ellipsis, Loader2, Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { useTranslation } from '@/hooks/use-translation'
import { isIosDevice, resolveInstallState, type PlatformT } from '@/lib/pwa/install-state'
import { useInstallPromptStore } from '@/stores/install-prompt-store'

// Chrome fires `beforeinstallprompt` only once its engagement checks pass, which can take a while
// on a cold page — past this the button gives way to the browser-menu path.
const PROMPT_WAIT_MS = 60_000

const readPlatform = (): PlatformT => {
  const nav = navigator as Navigator & { standalone?: boolean }
  if (matchMedia('(display-mode: standalone)').matches || nav.standalone === true) {
    return 'standalone'
  }
  return isIosDevice(nav.userAgent, nav.maxTouchPoints) ? 'ios' : 'browser'
}

const subscribeNever = () => () => {}

export function InstallAppButton() {
  const { t } = useTranslation('workerPage')
  const platform = useSyncExternalStore(subscribeNever, readPlatform, () => undefined)
  const hasPrompt = useInstallPromptStore((s) => s.held !== undefined)
  const promptUsed = useInstallPromptStore((s) => s.promptUsed)
  const installed = useInstallPromptStore((s) => s.installed)
  const showInstallPrompt = useInstallPromptStore((s) => s.showInstallPrompt)
  const [waitedOut, setWaitedOut] = useState(false)

  useEffect(() => {
    if (platform !== 'browser') return
    const timer = setTimeout(() => setWaitedOut(true), PROMPT_WAIT_MS)
    return () => clearTimeout(timer)
  }, [platform])

  if (!platform) return null

  const state = resolveInstallState({ platform, installed, hasPrompt, promptUsed, waitedOut })

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

  return (
    <Button
      size="sm"
      variant="outline"
      className="w-fit"
      disabled={state === 'waiting'}
      onClick={showInstallPrompt}
    >
      {state === 'waiting' ? <Loader2 className="animate-spin" /> : <Download />}
      {t('installApp')}
    </Button>
  )
}
