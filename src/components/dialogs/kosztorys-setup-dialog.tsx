'use client'

import { type ReactNode, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toastMessage } from '@/components/toasts'
import {
  getServiceAccountEmailAction,
  linkKosztorysSheetAction,
  provisionKosztorysAction,
} from '@/lib/actions/investments'

type PropsT = {
  investmentId: number
  investmentName?: string
  trigger?: ReactNode
}

// Two ways to give an investment a kosztorys: create a fresh sheet from the
// template, or link an existing one by pasting its URL/id. Shared by the
// investment page banner and the investments table cell.
export function KosztorysSetupDialog({ investmentId, investmentName, trigger }: PropsT) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [saEmail, setSaEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Load the service-account email when the dialog opens, so the link section can
  // tell the user exactly who to share their sheet with (fetched lazily, once).
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && !saEmail) void getServiceAccountEmailAction().then(setSaEmail)
  }

  const finish = (message: string) => {
    toastMessage(message, 'success')
    setOpen(false)
    setLink('')
    router.refresh()
  }

  const onCreate = () => {
    startTransition(async () => {
      const res = await provisionKosztorysAction(investmentId)
      if (!res.success) return toastMessage(res.error, 'error')
      finish(`Utworzono kosztorys${investmentName ? ` dla „${investmentName}”` : ''}.`)
    })
  }

  const onLink = () => {
    if (!link.trim()) return
    startTransition(async () => {
      const res = await linkKosztorysSheetAction(investmentId, link)
      if (!res.success) return toastMessage(res.error, 'error')
      finish(`Powiązano arkusz „${res.data.title}”.`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Dodaj kosztorys</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kosztorys inwestycji</DialogTitle>
          <DialogDescription>
            Utwórz nowy arkusz z szablonu albo powiąż istniejący arkusz Google.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 text-sm">
          <section className="space-y-2">
            <h3 className="font-medium">Nowy kosztorys</h3>
            <p className="text-muted-foreground text-xs">
              Tworzy kopię szablonu i przypisuje ją do tej inwestycji.
            </p>
            <Button onClick={onCreate} disabled={pending} className="w-full">
              {pending ? 'Pracuję…' : 'Utwórz nowy kosztorys'}
            </Button>
          </section>

          <div className="border-t" />

          <section className="space-y-2">
            <h3 className="font-medium">Powiąż istniejący arkusz</h3>
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
              {pending ? 'Sprawdzam…' : 'Powiąż arkusz'}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
