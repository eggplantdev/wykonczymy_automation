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
import { ExternalLink } from '@/components/ui/external-link'
import { getServiceAccountEmailAction } from '@/lib/actions/investments'
import { addUnlinkedKosztorysAction } from '@/lib/actions/kosztoryses'

// Same constant as on /kosztorysy: shortcut to the owner's Google Sheets file
// picker so the user can spin up a fresh sheet and paste its URL back here.
const ALL_SHEETS_URL = 'https://docs.google.com/spreadsheets/u/0/'

type PropsT = {
  trigger?: ReactNode
}

// Register an existing Google Sheet as a kosztorys, no investment attached.
// Trimmed clone of the "Powiąż istniejący arkusz" half of KosztorysSetupDialog —
// no "create new" tab (that path needs an investment to name the file).
export function AddKosztorysDialog({ trigger }: PropsT) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [saEmail, setSaEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next && !saEmail)
      void getServiceAccountEmailAction()
        .then(setSaEmail)
        .catch(() => {})
  }

  const onSubmit = () => {
    if (!link.trim()) return
    startTransition(async () => {
      const res = await addUnlinkedKosztorysAction(link, name || undefined)
      if (!res.success) return toastMessage(res.error, 'error')
      toastMessage(`Dodano kosztorys „${res.data.name}".`, 'success')
      setOpen(false)
      setLink('')
      setName('')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Dodaj kosztorys</Button>}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nowy kosztorys</DialogTitle>
          <DialogDescription>
            Powiąż istniejący arkusz Google. Inwestycję podepniesz później z listy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground text-xs">
            Najpierw udostępnij arkusz <strong>jako Edytujący</strong> dla konta usługi, a następnie
            wklej jego link poniżej.
          </p>
          <ExternalLink href={ALL_SHEETS_URL}>Otwórz wszystkie arkusze ↗</ExternalLink>
          {saEmail && (
            <p className="text-muted-foreground text-xs">
              Konto usługi:{' '}
              <code className="bg-muted rounded px-1 py-0.5 text-xs break-all select-all">
                {saEmail}
              </code>
            </p>
          )}
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="kosztorys-link">
              Link do arkusza
            </label>
            <Input
              id="kosztorys-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium" htmlFor="kosztorys-name">
              Nazwa (opcjonalnie)
            </label>
            <Input
              id="kosztorys-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Domyślnie: tytuł arkusza"
              disabled={pending}
            />
          </div>
          <Button onClick={onSubmit} disabled={pending || !link.trim()} className="w-full">
            {pending ? 'Sprawdzam…' : 'Dodaj kosztorys'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
