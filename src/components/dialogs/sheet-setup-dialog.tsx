'use client'

import { type ReactNode, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Description } from '@/components/ui/description'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { getServiceAccountEmailAction, linkSheetAction } from '@/lib/actions/investments'
import { ExternalLink } from '../ui/external-link'
import { ALL_SHEETS_URL } from '@/lib/constants/sheets'

type PropsT = {
  investmentId: number
  trigger?: ReactNode
}

// Create-from-template is not offered: the service account has no Drive quota to create sheets.
export function SheetSetupDialog({ investmentId, trigger }: PropsT) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [saEmail, setSaEmail] = useState('')
  const [pending, startTransition] = useTransition()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && !saEmail)
      void getServiceAccountEmailAction()
        .then(setSaEmail)
        .catch(() => {})
  }

  const finish = (message: string) => {
    toastMessage(message, 'success')
    setOpen(false)
    setLink('')
  }

  const onLink = () => {
    if (!link.trim()) return
    startTransition(async () => {
      const res = await settleAction(() => linkSheetAction(investmentId, link))
      if (!res.success) return toastMessage(res.error, 'error')
      finish(`Dodano kosztorys „${res.data.title}”.`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Dodaj kosztorys</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader title="Kosztorys inwestycji" description="Dodaj istniejący arkusz Google." />

        <div className="space-y-6 text-sm">
          <section className="space-y-2">
            <p>
              <ExternalLink href={ALL_SHEETS_URL}>Otwórz arkusze google ↗</ExternalLink>
            </p>
            <Description size="xs">
              Najpierw udostępnij arkusz <strong>jako Edytujący</strong> dla konta usługi, a
              następnie wklej jego link poniżej.
            </Description>
            {saEmail && (
              <Description size="xs" withIcon={false}>
                Konto usługi:{' '}
                <code className="bg-muted rounded px-1 py-0.5 text-xs break-all select-all">
                  {saEmail}
                </code>
              </Description>
            )}
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              disabled={pending}
            />
            <Button
              onClick={onLink}
              disabled={pending || !link.trim()}
              variant="outline"
              className="w-full"
            >
              {pending ? 'Sprawdzam…' : 'Dodaj kosztorys'}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
