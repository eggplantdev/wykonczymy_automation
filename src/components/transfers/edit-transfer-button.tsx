'use client'

import { useState, useTransition } from 'react'
import { Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { updateTransferAction } from '@/lib/actions/transfers'
import { toastMessage } from '@/components/toasts'
import {
  TRANSFER_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  showsInvestment,
  needsExpenseCategory,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/format-currency'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'

type EditTransferButtonPropsT = {
  readonly row: TransferRowT
  readonly referenceData: ReferenceDataBaseT
  readonly canEdit: boolean
}

export function EditTransferButton({ row, referenceData, canEdit }: EditTransferButtonPropsT) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Form state
  const [description, setDescription] = useState(row.description)
  const [date, setDate] = useState(row.date)
  const [paymentMethod, setPaymentMethod] = useState<string>(row.paymentMethod)
  const [investment, setInvestment] = useState<string>(
    row.investmentId ? String(row.investmentId) : '',
  )
  const [expenseCategory, setExpenseCategory] = useState<string>(
    row.expenseCategoryId ? String(row.expenseCategoryId) : '',
  )
  const [otherCategory, setOtherCategory] = useState<string>(
    row.otherCategoryId ? String(row.otherCategoryId) : '',
  )
  const [otherDescription, setOtherDescription] = useState(row.otherDescription)
  const [invoiceNote, setInvoiceNote] = useState(row.invoiceNote ?? '')

  function handleOpen() {
    // Reset to current row values
    setDescription(row.description)
    setDate(row.date)
    setPaymentMethod(row.paymentMethod)
    setInvestment(row.investmentId ? String(row.investmentId) : '')
    setExpenseCategory(row.expenseCategoryId ? String(row.expenseCategoryId) : '')
    setOtherCategory(row.otherCategoryId ? String(row.otherCategoryId) : '')
    setOtherDescription(row.otherDescription)
    setInvoiceNote(row.invoiceNote ?? '')
    setOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateTransferAction(row.id, {
        description,
        date,
        paymentMethod: paymentMethod as PaymentMethodT,
        investment: investment ? Number(investment) : undefined,
        expenseCategory: expenseCategory ? Number(expenseCategory) : undefined,
        otherCategory: otherCategory ? Number(otherCategory) : undefined,
        otherDescription: otherDescription || undefined,
        invoiceNote: invoiceNote || undefined,
      })

      if (result.success) {
        toastMessage('Transakcja zaktualizowana', 'success')
        setOpen(false)
        router.refresh()
      } else {
        toastMessage(result.error, 'error')
      }
    })
  }

  const editButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleOpen}
      disabled={!canEdit}
      aria-label="Edytuj transakcję"
    >
      <Pencil className="h-4 w-4" />
    </Button>
  )

  return (
    <>
      {canEdit ? (
        editButton
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{editButton}</span>
            </TooltipTrigger>
            <TooltipContent>Możesz edytować tylko swoje transakcje</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader
            title="Edytuj transakcję"
            description={`${TRANSFER_TYPE_LABELS[row.type]} · ${formatPLN(row.amount)}`}
          />

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Opis</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Metoda płatności</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showsInvestment(row.type) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Inwestycja</label>
                <Select value={investment} onValueChange={setInvestment} disabled={isPending}>
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz inwestycję" />
                  </SelectTrigger>
                  <SelectContent>
                    {referenceData.investments.map((inv) => (
                      <SelectItem key={inv.id} value={String(inv.id)}>
                        {inv.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {needsExpenseCategory(row.type) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Typ wydatku inwestycyjnego</label>
                <Select
                  value={expenseCategory}
                  onValueChange={setExpenseCategory}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wybierz typ wydatku" />
                  </SelectTrigger>
                  <SelectContent>
                    {referenceData.expenseCategories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Kategoria</label>
              <Select value={otherCategory} onValueChange={setOtherCategory} disabled={isPending}>
                <SelectTrigger>
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {referenceData.otherCategories.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Opis kategorii</label>
              <Textarea
                value={otherDescription}
                onChange={(e) => setOtherDescription(e.target.value)}
                disabled={isPending}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notatka</label>
              <Textarea
                value={invoiceNote}
                onChange={(e) => setInvoiceNote(e.target.value)}
                placeholder="Wpisz notatkę..."
                rows={3}
                disabled={isPending}
              />
            </div>
          </div>

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
