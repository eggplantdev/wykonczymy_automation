'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { sendExpenseDraftAction } from '@/lib/actions/worker-expense-drafts'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { toastMessage } from '@/lib/utils/toast'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { CashRegisterRefT } from '@/types/reference-data'

type PropsT = {
  investments: WorkerStageInvestmentT[]
  registers: CashRegisterRefT[]
  defaultRegisterId?: number
}

function initialRegisterId(registers: CashRegisterRefT[], defaultRegisterId?: number) {
  if (registers.length === 1) return String(registers[0]?.id)
  return registers.some((register) => register.id === defaultRegisterId)
    ? String(defaultRegisterId)
    : ''
}

export function AddExpenseDraftDialog({ investments, registers, defaultRegisterId }: PropsT) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [investmentId, setInvestmentId] = useState(
    investments.length === 1 ? String(investments[0]?.investmentId) : '',
  )
  const [cashRegisterId, setCashRegisterId] = useState(() =>
    initialRegisterId(registers, defaultRegisterId),
  )
  const [note, setNote] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { files, isIngesting, inputKey, reset, fileInputProps } = useFilePickIngest()

  const canSend =
    investmentId !== '' && cashRegisterId !== '' && files.length > 0 && !isIngesting && !isSending

  function close() {
    setOpen(false)
    setNote('')
    reset()
  }

  function handleOpenChange(next: boolean) {
    if (isSending) return
    if (next) setOpen(true)
    else close()
  }

  async function handleSend() {
    if (!canSend) return
    setIsSending(true)
    try {
      const result = await submitWithUploads(
        files,
        (mediaIds) =>
          sendExpenseDraftAction({
            investmentId: Number(investmentId),
            cashRegisterId: Number(cashRegisterId),
            note,
            mediaIds,
          }),
        'faktura',
      )
      if (!result.success) {
        toastMessage(result.error, 'error')
        return
      }
      toastMessage('Wydatek wysłany do kierownika', 'success')
      close()
      router.refresh()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Dodaj wydatek
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader title="Nowy wydatek" />
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
          <FileInput
            key={inputKey}
            label="Zdjęcie paragonu lub faktury"
            multiple
            className="h-28 flex-col"
            {...fileInputProps}
          />
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
            {isSending ? 'Wysyłanie...' : 'Wyślij'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
