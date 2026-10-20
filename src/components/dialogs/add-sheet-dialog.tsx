'use client'

import { type ReactNode, useState, useTransition } from 'react'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { copyToClipboard } from '@/lib/utils/copy-to-clipboard'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import { ExternalLink } from '@/components/ui/external-link'
import { fetchServiceAccountEmail } from '@/lib/queries/service-account-email'
import { addUnlinkedSheetAction } from '@/lib/actions/sheets'
import { ALL_SHEETS_URL } from '@/lib/constants/sheets'
import { Description } from '@/components/ui/description'

type PropsT = {
  trigger?: ReactNode
}

export function AddSheetDialog({ trigger }: PropsT) {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [saEmail, setSaEmail] = useState('')
  const [pending, startTransition] = useTransition()

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setLink('')
      setName('')
      if (!saEmail)
        void fetchServiceAccountEmail()
          .then(setSaEmail)
          .catch(() => {})
    }
  }

  const copyEmail = () => copyToClipboard(saEmail, 'Skopiowano adres konta usługi.')

  const onSubmit = () => {
    if (!link.trim()) return
    startTransition(async () => {
      const res = await settleAction(() => addUnlinkedSheetAction(link, name || undefined))
      if (!res.success) return toastMessage(res.error, 'error')
      toastMessage(`Dodano kosztorys „${res.data.name}".`, 'success')
      setOpen(false)
      setLink('')
      setName('')
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger ?? <Button size="sm">Dodaj kosztorys</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-dialog-sm">
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
              <Description withIcon={false} size="xs">
                Konto usługi:
              </Description>
              <div className="flex items-center gap-2">
                <code className="bg-muted flex-1 rounded px-1 py-0.5 text-xs break-all select-all">
                  {saEmail}
                </code>
                <Button
                  type="button"
                  size="iconSm"
                  variant="outline"
                  className="shrink-0"
                  onClick={copyEmail}
                  aria-label="Kopiuj adres konta usługi"
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
          <Field gap="md">
            <FieldLabel htmlFor="kosztorys-link">Link do arkusza</FieldLabel>
            <Input
              id="kosztorys-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              disabled={pending}
            />
          </Field>
          <Field gap="md">
            <FieldLabel htmlFor="kosztorys-name">Nazwa (opcjonalnie)</FieldLabel>
            <Input
              id="kosztorys-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Domyślnie: tytuł arkusza"
              disabled={pending}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button onClick={onSubmit} pending={pending} disabled={!link.trim()}>
            {pending ? 'Sprawdzam…' : 'Dodaj kosztorys'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
