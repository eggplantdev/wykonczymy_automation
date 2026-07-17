'use client'

import { type ReactNode, useState, useTransition } from 'react'
import { Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { toastMessage } from '@/lib/utils/toast'
import { ExternalLink } from '@/components/ui/external-link'
import { getServiceAccountEmailAction } from '@/lib/actions/investments'
import { addUnlinkedSheetAction } from '@/lib/actions/sheets'
import { ALL_SHEETS_URL } from '@/lib/constants/sheets'

type PropsT = {
  trigger?: ReactNode
}

// Register an existing Google Sheet as a kosztorys, no investment attached.
// Trimmed clone of the "Powiąż istniejący arkusz" half of SheetSetupDialog —
// no "create new" tab (that path needs an investment to name the file).
export function AddSheetDialog({ trigger }: PropsT) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [saEmail, setSaEmail] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      // Reset inputs on every open so a previously-added link never lingers.
      setLink('')
      setName('')
      if (!saEmail)
        void getServiceAccountEmailAction()
          .then(setSaEmail)
          .catch(() => {})
    }
  }

  const copyEmail = () => {
    void navigator.clipboard
      .writeText(saEmail)
      .then(() => toastMessage('Skopiowano adres konta usługi.', 'success'))
      .catch(() => toastMessage('Nie udało się skopiować.', 'error'))
  }

  const onSubmit = () => {
    if (!link.trim()) return
    startTransition(async () => {
      const res = await addUnlinkedSheetAction(link, name || undefined)
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
        <DialogHeader
          title="Nowy kosztorys"
          description="Powiąż istniejący arkusz Google. Inwestycję podepniesz później z listy."
        />

        <div className="space-y-4 text-sm">
          <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-xs">
            <li>
              Stwórz nową kopię <strong>„Kosztorys Wzór"</strong> w Arkuszach Google.
            </li>
            <li>
              Udostępnij arkusz <strong>jako Edytujący</strong> dla konta usługi (poniżej).
            </li>
          </ol>
          <ExternalLink href={ALL_SHEETS_URL}>Otwórz wszystkie arkusze ↗</ExternalLink>
          {saEmail && (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Konto usługi:</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted flex-1 rounded px-1 py-0.5 text-xs break-all select-all">
                  {saEmail}
                </code>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-7 shrink-0"
                  onClick={copyEmail}
                  aria-label="Kopiuj adres konta usługi"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
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
