'use client'

import { type ReactNode, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { toastMessage } from '@/lib/utils/toast'
import { getServiceAccountEmailAction, linkSheetAction } from '@/lib/actions/investments'
import { ExternalLink } from '../ui/external-link'
import { ALL_SHEETS_URL } from '@/lib/constants/sheets'

type PropsT = {
  investmentId: number
  trigger?: ReactNode
}

// Give an investment a kosztorys by linking an existing Google Sheet (paste its URL/id). Shared by
// the investment page banner and the investments table cell. Create-from-template is not offered:
// the service account has no Drive quota to create sheets.
export function SheetSetupDialog({ investmentId, trigger }: PropsT) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [saEmail, setSaEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Load the service-account email when the dialog opens, so the link section can
  // tell the user exactly who to share their sheet with (fetched lazily, once).
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
    router.refresh()
  }

  const onLink = () => {
    if (!link.trim()) return
    startTransition(async () => {
      const res = await linkSheetAction(investmentId, link)
      if (!res.success) return toastMessage(res.error, 'error')
      finish(`Dodano kosztorys „${res.data.title}”.`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Dodaj kosztorys</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader title="Kosztorys inwestycji" description="Dodaj istniejący arkusz Google." />

        <div className="space-y-6 text-sm">
          <section className="space-y-2">
            <p>
              <ExternalLink href={ALL_SHEETS_URL}>Otwórz arkusze google ↗</ExternalLink>
            </p>
            <p className="text-muted-foreground text-xs">
              Najpierw udostępnij arkusz <strong>jako Edytujący</strong> dla konta usługi, a
              następnie wklej jego link poniżej.
            </p>
            {saEmail && (
              <p className="text-muted-foreground text-xs">
                Konto usługi:{' '}
                <code className="bg-muted rounded px-1 py-0.5 text-xs break-all select-all">
                  {saEmail}
                </code>
              </p>
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
