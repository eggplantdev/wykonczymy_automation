'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Description } from '@/components/ui/description'
import { copyToClipboard, copyToClipboardAsync } from '@/lib/utils/copy-to-clipboard'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { ActionResultT } from '@/types/action'

type PropsT = {
  loaded: boolean
  token: string | null
  urlFor: (token: string) => string
  generate: () => Promise<ActionResultT<string>>
  onTokenChange: (token: string | null) => void
  // Absent for a worker: his link is also the door to his own page, so it is only ever rotated.
  revoke?: { action: () => Promise<ActionResultT>; title: string; description: string }
  // Set when the audience's view cannot be priced; the link still works, its page shows the notice.
  blockReason?: string
  children?: ReactNode
}

export function ShareLinkPanel({
  loaded,
  token,
  urlFor,
  generate,
  onTokenChange,
  revoke,
  blockReason,
  children,
}: PropsT) {
  const [confirmingRevoke, setConfirmingRevoke] = useState(false)
  const [pending, startTransition] = useTransition()

  const runGenerate = () => {
    const generated = settleAction(generate)
    copyToClipboardAsync(
      generated.then((res) => {
        if (!res.success) throw new Error(res.error)
        return urlFor(res.data)
      }),
      'Link skopiowany do schowka. Poprzedni (jeśli był) przestał działać.',
    )
    startTransition(async () => {
      const res = await generated
      if (!res.success) return toastMessage(res.error, 'error')
      onTokenChange(res.data)
    })
  }

  const runRevoke = (action: () => Promise<ActionResultT>) =>
    startTransition(async () => {
      const res = await settleAction(action)
      if (!res.success) return toastMessage(res.error, 'error')
      onTokenChange(null)
      setConfirmingRevoke(false)
      toastMessage('Link wyłączony.', 'success')
    })

  if (!loaded) return <p className="text-muted-foreground text-sm">Sprawdzanie…</p>

  const url = token ? urlFor(token) : ''

  return (
    <>
      {blockReason !== undefined && <p className="text-destructive mb-3 text-sm">{blockReason}</p>}
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
            {revoke && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmingRevoke(true)}
                disabled={pending}
              >
                Wyłącz link
              </Button>
            )}
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
      {revoke && (
        <ConfirmDialog
          open={confirmingRevoke}
          title={revoke.title}
          description={revoke.description}
          confirmLabel="Wyłącz link"
          onConfirm={() => runRevoke(revoke.action)}
          onCancel={() => setConfirmingRevoke(false)}
        />
      )}
    </>
  )
}
