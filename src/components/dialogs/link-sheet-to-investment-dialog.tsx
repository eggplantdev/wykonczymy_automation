'use client'

import { type ReactNode, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toastMessage } from '@/components/toasts'
import { linkSheetToInvestmentAction } from '@/lib/actions/sheets'

type InvestmentOptionT = { id: number; name: string }

type PropsT = {
  sheetId: number
  sheetName: string
  availableInvestments: InvestmentOptionT[]
  trigger?: ReactNode
}

// Pick an investment with no kosztorys and link this unlinked row to it. The
// caller decides which investments are eligible (typically hasSheet=false).
export function LinkSheetToInvestmentDialog({
  sheetId,
  sheetName,
  availableInvestments,
  trigger,
}: PropsT) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const onSubmit = () => {
    if (!selectedId) return
    const investmentId = Number(selectedId)
    startTransition(async () => {
      const res = await linkSheetToInvestmentAction(sheetId, investmentId)
      if (!res.success) return toastMessage(res.error, 'error')
      const investment = availableInvestments.find((i) => i.id === investmentId)
      toastMessage(`Dodano „${sheetName}” do inwestycji „${investment?.name ?? ''}”.`, 'success')
      setOpen(false)
      setSelectedId('')
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            Dodaj kosztorys
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj kosztorys do inwestycji</DialogTitle>
          <DialogDescription>
            Wybierz inwestycję bez kosztorysu. Po dodaniu, wydatki inwestycji zostaną
            zsynchronizowane do kosztorysu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          {availableInvestments.length === 0 ? (
            <p className="text-muted-foreground">
              Brak inwestycji bez kosztorysu. Dodaj inwestycję albo odepnij istniejący kosztorys.
            </p>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId} disabled={pending}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz inwestycję…" />
              </SelectTrigger>
              <SelectContent>
                {availableInvestments.map((inv) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>
                    {inv.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={onSubmit}
            disabled={pending || !selectedId || availableInvestments.length === 0}
          >
            {pending ? 'Dodaję…' : 'Dodaj kosztorys'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
