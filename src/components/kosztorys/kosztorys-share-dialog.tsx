'use client'

import { useState, useTransition } from 'react'
import { Copy, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import {
  generateShareLinkAction,
  getShareLinkAction,
  revokeShareLinkAction,
} from '@/lib/actions/kosztorys-share'
import { FRONTEND_URL } from '@/lib/env'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = { investmentId: number }

/**
 * Mint / copy / rotate / revoke the public `/k/<token>` link.
 *
 * The current token is fetched when the dialog opens rather than threaded down from the page: the
 * editor's server page would otherwise carry a secret it never renders, and the state is only ever
 * looked at here. Same lazy-on-open shape as KosztorysActionsMenu's preset list.
 */
export function KosztorysShareDialog({ investmentId }: PropsT) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [pending, startTransition] = useTransition()

  const url = token ? `${FRONTEND_URL}/k/${token}` : ''

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) return
    setLoaded(false)
    void getShareLinkAction(investmentId).then((res) => {
      if (res.success) setToken(res.data)
      setLoaded(true)
    })
  }

  const generate = () =>
    startTransition(async () => {
      const res = await generateShareLinkAction(investmentId)
      if (!res.success) return toastMessage(res.error, 'error')
      setToken(res.data)
      toastMessage('Link gotowy. Poprzedni (jeśli był) przestał działać.', 'success')
    })

  const revoke = () =>
    startTransition(async () => {
      const res = await revokeShareLinkAction(investmentId)
      if (!res.success) return toastMessage(res.error, 'error')
      setToken(null)
      toastMessage('Link wyłączony.', 'success')
    })

  const copy = () => {
    void navigator.clipboard
      .writeText(url)
      .then(() => toastMessage('Skopiowano link.', 'success'))
      .catch(() => toastMessage('Nie udało się skopiować.', 'error'))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2 />
          Udostępnij
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader
          title="Udostępnij klientowi"
          description="Kto ma link, ten widzi kosztorys — bez logowania. Ceny podwykonawców nigdy się w nim nie pojawiają."
        />
        {!loaded ? (
          <p className="text-muted-foreground text-sm">Sprawdzanie…</p>
        ) : token ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
              <Button variant="outline" size="icon" onClick={copy} aria-label="Kopiuj link">
                <Copy />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
                Wygeneruj nowy
              </Button>
              <Button variant="destructive" size="sm" onClick={revoke} disabled={pending}>
                Wyłącz link
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              „Wygeneruj nowy" unieważnia obecny link — stary adres przestaje działać.
            </p>
          </div>
        ) : (
          <Button size="sm" onClick={generate} disabled={pending} className="self-start">
            Wygeneruj link
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
