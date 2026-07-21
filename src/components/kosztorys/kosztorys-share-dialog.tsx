'use client'

import { useState, useTransition } from 'react'
import { Copy, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import {
  generateShareLinkAction,
  getShareLinkAction,
  revokeShareLinkAction,
} from '@/lib/actions/kosztorys-share'
import { FRONTEND_URL } from '@/lib/env'
import { copyToClipboard } from '@/lib/utils/copy-to-clipboard'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = { investmentId: number }

/**
 * The current token is fetched when the dialog opens rather than threaded down from the page: the
 * editor's server page would otherwise carry a secret it never renders, and the state is only ever
 * looked at here. Same lazy-on-open shape as KosztorysActionsMenu's preset list.
 */
export function KosztorysShareDialog({ investmentId }: PropsT) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [pending, startTransition] = useTransition()

  const url = token ? `${FRONTEND_URL}/k/${token}` : ''

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) return
    setLoaded(false)
    // Clear on every failure path. Keeping a token from a previous open would render a link that
    // may since have been rotated or revoked elsewhere as though it were still live.
    void getShareLinkAction(investmentId)
      .then((res) => {
        setToken(res.success ? res.data : null)
        if (!res.success) toastMessage(res.error, 'error')
      })
      .catch(() => {
        setToken(null)
        toastMessage('Nie udało się sprawdzić linku', 'error')
      })
      .finally(() => setLoaded(true))
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
      setConfirmingRevoke(false)
      toastMessage('Link wyłączony.', 'success')
    })

  const copy = () => copyToClipboard(url, 'Skopiowano link.')

  return (
    <>
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
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmingRevoke(true)}
                  disabled={pending}
                >
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
      <ConfirmDialog
        open={confirmingRevoke}
        title="Wyłączyć link dla klienta?"
        description="Klient natychmiast straci dostęp do kosztorysu. Tej akcji nie da się cofnąć — aby przywrócić dostęp, musisz wygenerować nowy link (stary adres już nie zadziała)."
        confirmLabel="Wyłącz link"
        pending={pending}
        pendingLabel="Wyłączanie…"
        onConfirm={revoke}
        onCancel={() => setConfirmingRevoke(false)}
      />
    </>
  )
}
