'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EditButton } from '@/components/ui/row-actions/edit-button'
import { Dialog, DialogContent, DialogHeader, DialogTrigger } from '@/components/ui/dialog'
import { FileInput } from '@/components/ui/file-input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useFilePickIngest } from '@/components/forms/hooks/use-file-pick-ingest'
import { ExpenseDraftPagesCell } from '@/components/worker-expenses/expense-draft-pages-cell'
import {
  sendExpenseDraftAction,
  updateExpenseDraftAction,
} from '@/lib/actions/worker-expense-drafts'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { toastMessage } from '@/lib/utils/toast'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { CashRegisterRefT } from '@/types/reference-data'

type PropsT = {
  investments: WorkerStageInvestmentT[]
  registers: CashRegisterRefT[]
  defaultRegisterId?: number
  draft?: ExpenseDraftRowT
}

function initialRegisterId(registers: CashRegisterRefT[], defaultRegisterId?: number) {
  if (registers.length === 1) return String(registers[0]?.id)
  return registers.some((register) => register.id === defaultRegisterId)
    ? String(defaultRegisterId)
    : ''
}

function initialInvestmentId(investments: WorkerStageInvestmentT[]) {
  return investments.length === 1 ? String(investments[0]?.investmentId) : ''
}

export function ExpenseDraftDialog({ investments, registers, defaultRegisterId, draft }: PropsT) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [investmentId, setInvestmentId] = useState(() =>
    draft ? String(draft.investmentId) : initialInvestmentId(investments),
  )
  const [cashRegisterId, setCashRegisterId] = useState(() =>
    draft ? String(draft.cashRegisterId) : initialRegisterId(registers, defaultRegisterId),
  )
  const [note, setNote] = useState(draft?.note ?? '')
  const [isSending, setIsSending] = useState(false)
  const { files, isIngesting, inputKey, reset, fileInputProps } = useFilePickIngest()

  const hasPhotos = draft !== undefined || files.length > 0
  const canSend =
    investmentId !== '' && cashRegisterId !== '' && hasPhotos && !isIngesting && !isSending

  function close() {
    setOpen(false)
    setNote('')
    reset()
  }

  function handleOpenChange(next: boolean) {
    if (isSending) return
    if (!next) return close()
    // Reopening starts from the saved draft, not from an edit that was cancelled.
    if (draft) {
      setInvestmentId(String(draft.investmentId))
      setCashRegisterId(String(draft.cashRegisterId))
      setNote(draft.note ?? '')
    }
    setOpen(true)
  }

  function submit() {
    const fields = {
      investmentId: Number(investmentId),
      cashRegisterId: Number(cashRegisterId),
      note,
    }
    if (draft) return updateExpenseDraftAction({ draftId: draft.id, ...fields })
    return submitWithUploads(
      files,
      (mediaIds) => sendExpenseDraftAction({ ...fields, mediaIds }),
      'faktura',
    )
  }

  async function handleSend() {
    if (!canSend) return
    setIsSending(true)
    try {
      const result = await submit()
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      toastMessage(draft ? 'Wydatek zapisany' : 'Wydatek wysłany do kierownika', 'success')
      close()
      router.refresh()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Opened by hand: the row button wraps itself in a tooltip, which `asChild` would trigger. */}
      {draft ? (
        <EditButton label="Edytuj wydatek" onClick={() => handleOpenChange(true)} />
      ) : (
        <DialogTrigger asChild>
          <Button>
            <Plus />
            Dodaj wydatek
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader title={draft ? 'Edytuj wydatek' : 'Nowy wydatek'} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Inwestycja</Label>
            <Select value={investmentId} onValueChange={setInvestmentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Wybierz inwestycję" />
              </SelectTrigger>
              <SelectContent>
                {investments.map((investment) => (
                  <SelectItem key={investment.investmentId} value={String(investment.investmentId)}>
                    {investment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {registers.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label>Kasa</Label>
              <Select value={cashRegisterId} onValueChange={setCashRegisterId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Wybierz kasę" />
                </SelectTrigger>
                <SelectContent>
                  {registers.map((register) => (
                    <SelectItem key={register.id} value={String(register.id)}>
                      {register.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {draft ? (
            <div className="flex flex-col gap-2">
              <Label>Zdjęcia</Label>
              <ExpenseDraftPagesCell
                draftId={draft.id}
                media={draft.media}
                isEditable
                variant="field"
              />
            </div>
          ) : (
            <FileInput
              key={inputKey}
              label="Zdjęcie paragonu lub faktury"
              multiple
              className="h-28 flex-col"
              {...fileInputProps}
            />
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-draft-note">Notatka (opcjonalnie)</Label>
            <Textarea
              id="expense-draft-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <Button onClick={handleSend} disabled={!canSend}>
            {isSending ? (draft ? 'Zapisywanie...' : 'Wysyłanie...') : draft ? 'Zapisz' : 'Wyślij'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
