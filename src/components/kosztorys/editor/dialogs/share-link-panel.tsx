'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Description } from '@/components/ui/description'
import { copyToClipboard } from '@/lib/utils/copy-to-clipboard'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

type PropsT = {
  loaded: boolean
  token: string | null
  url: string
  generate: () => Promise<ActionResultT<string>>
  revoke: () => Promise<ActionResultT>
  onTokenChange: (token: string | null) => void
  revokeTitle: string
  revokeDescription: string
  // Rendered under the controls in every state but „Sprawdzanie…" — the investor's „Wróć do ustawień".
  children?: ReactNode
}

// The link step of both share dialogs (investor, worker): one token lifecycle, so one set of buttons.
export function ShareLinkPanel({
  loaded,
  token,
  url,
  generate,
  revoke,
  onTokenChange,
  revokeTitle,
  revokeDescription,
  children,
}: PropsT) {
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [pending, startTransition] = useTransition()

  const runGenerate = () =>
    startTransition(async () => {
      const res = await generate()
      if (!res.success) return toastMessage(res.error, 'error')
      onTokenChange(res.data)
      toastMessage('Link gotowy. Poprzedni (jeśli był) przestał działać.', 'success')
    })

  const runRevoke = () =>
    startTransition(async () => {
      const res = await revoke()
      if (!res.success) return toastMessage(res.error, 'error')
      onTokenChange(null)
      setConfirmingRevoke(false)
      toastMessage('Link wyłączony.', 'success')
    })

  if (!loaded) return <p className="text-muted-foreground text-sm">Sprawdzanie…</p>

  return (
    <>
      {token ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copyToClipboard(url, 'Skopiowano link.')}
              aria-label="Kopiuj link"
            >
              <Copy />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runGenerate} disabled={pending}>
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
          <Description size="xs">
            „Wygeneruj nowy" unieważnia obecny link — stary adres przestaje działać.
          </Description>
          {children}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button size="sm" onClick={runGenerate} disabled={pending} className="self-start">
            Wygeneruj link
          </Button>
          {children}
        </div>
      )}
      <ConfirmDialog
        open={confirmingRevoke}
        title={revokeTitle}
        description={revokeDescription}
        confirmLabel="Wyłącz link"
        pending={pending}
        pendingLabel="Wyłączanie…"
        onConfirm={runRevoke}
        onCancel={() => setConfirmingRevoke(false)}
      />
    </>
  )
}
