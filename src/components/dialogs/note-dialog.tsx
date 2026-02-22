'use client'

import { useState, useTransition } from 'react'
import { MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { updateTransferNoteAction } from '@/lib/actions/transfers'
import { toastMessage } from '@/components/toasts'

type NoteCellPropsT = {
  readonly transactionId: number
  readonly note: string | null
}

export function NoteCell({ transactionId, note }: NoteCellPropsT) {
  const [open, setOpen] = useState(false)
  const [savedNote, setSavedNote] = useState(note)
  const [value, setValue] = useState(note ?? '')
  const [isPending, startTransition] = useTransition()

  const hasNote = !!savedNote

  function handleOpen() {
    setValue(savedNote ?? '')
    setOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      const trimmed = value.trim()
      const result = await updateTransferNoteAction(transactionId, trimmed)
      if (result.success) {
        setSavedNote(trimmed || null)
        toastMessage('Notatka zapisana', 'success')
        setOpen(false)
      } else {
        toastMessage(result.error, 'error')
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleOpen}
        className={hasNote ? 'text-foreground' : 'text-muted-foreground'}
        aria-label={hasNote ? 'Edytuj notatkę' : 'Dodaj notatkę'}
      >
        <MessageSquareText />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader
            title="Notatka do przelewu"
            description="Dodaj lub edytuj notatkę do tej transakcji."
          />

          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Wpisz notatkę..."
            rows={4}
            disabled={isPending}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Anuluj
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Zapisywanie...' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
