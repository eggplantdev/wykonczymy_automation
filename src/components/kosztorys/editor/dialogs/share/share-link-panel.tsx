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
  revoke: () => Promise<ActionResultT>
  onTokenChange: (token: string | null) => void
  revokeTitle: string
  revokeDescription: string
  // Set when the audience's view cannot be priced: a live token outlives the block, so only
  // switching it off is offered — handing out a link whose page shows a notice would be pointless.
  blockReason?: string
  children?: ReactNode
}

export function ShareLinkPanel({
  loaded,
  token,
  urlFor,
  generate,
  revoke,
  onTokenChange,
  revokeTitle,
  revokeDescription,
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

  const runRevoke = () =>
    startTransition(async () => {
      const res = await settleAction(revoke)
      if (!res.success) return toastMessage(res.error, 'error')
      onTokenChange(null)
      setConfirmingRevoke(false)
      toastMessage('Link wyłączony.', 'success')
    })

  if (!loaded) return <p className="text-muted-foreground text-sm">Sprawdzanie…</p>

  const url = token ? urlFor(token) : ''

  const revokeButton = (
    <Button
      variant="destructive"
      size="sm"
      onClick={() => setConfirmingRevoke(true)}
      disabled={pending}
    >
      Wyłącz link
    </Button>
  )

  return (
    <>
      {blockReason !== undefined ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-destructive text-sm">{blockReason}</p>
          {token ? revokeButton : <Description size="xs">Link nie jest wydany.</Description>}
        </div>
      ) : token ? (
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
            {revokeButton}
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
        onConfirm={runRevoke}
        onCancel={() => setConfirmingRevoke(false)}
      />
    </>
  )
}
