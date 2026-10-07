'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
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
import { ToggleGroup } from '@/components/ui/toggle-group'
import { useFilePickIngest } from '@/components/forms/hooks/use-file-pick-ingest'
import { ExpenseDraftPagesCell } from '@/components/worker-expenses/expense-draft-pages-cell'
import {
  sendExpenseDraftAction,
  updateExpenseDraftAction,
} from '@/lib/actions/worker-expense-drafts'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'
import type { ScanModeT } from '@/lib/constants/receipt-scan'
import { MAX_DRAFT_PAGES } from '@/lib/constants/worker-expense-drafts'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { CashRegisterRefT } from '@/types/reference-data'

type PropsT = {
  investments: WorkerStageInvestmentT[]
  registers: CashRegisterRefT[]
  defaultRegisterId?: number
  draft?: ExpenseDraftRowT
  triggerClassName?: string
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

export function ExpenseDraftDialog({
  investments,
  registers,
  defaultRegisterId,
  draft,
  triggerClassName,
}: PropsT) {
  const router = useRouter()
  const { locale, t } = useTranslation('expenseDrafts')
  const [open, setOpen] = useState(false)
  const [investmentId, setInvestmentId] = useState(() =>
    draft ? String(draft.investmentId) : initialInvestmentId(investments),
  )
  const [cashRegisterId, setCashRegisterId] = useState(() =>
    draft ? String(draft.cashRegisterId) : initialRegisterId(registers, defaultRegisterId),
  )
  const savedScanMode: ScanModeT = draft?.scanMode ?? 'one-invoice'
  const [note, setNote] = useState(draft?.note ?? '')
  const [scanMode, setScanMode] = useState(savedScanMode)
  const [isSending, setIsSending] = useState(false)
  const { files, isIngesting, inputKey, reset, fileInputProps } = useFilePickIngest()

  const photoCount = draft ? draft.media.length : files.length
  const isScanModeShown = photoCount >= 2
  // The server refuses the same count, but only after every photo went up over the phone's data.
  const hasTooManyPhotos = !draft && files.length > MAX_DRAFT_PAGES
  const canSend =
    investmentId !== '' &&
    cashRegisterId !== '' &&
    photoCount > 0 &&
    !hasTooManyPhotos &&
    !isIngesting &&
    !isSending

  function close() {
    setOpen(false)
    setNote('')
    setScanMode(savedScanMode)
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
      setScanMode(savedScanMode)
    }
    setOpen(true)
  }

  function submit() {
    const fields = {
      investmentId: Number(investmentId),
      cashRegisterId: Number(cashRegisterId),
      note,
      // Hidden under 2 photos, where both modes read the same; an edit keeps the draft's own so a
      // note change doesn't count as a mode change and re-read.
      scanMode: isScanModeShown ? scanMode : savedScanMode,
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
        toastMessage(failureMessage(locale, result), 'error')
        return
      }
      toastMessage(t(draft ? 'savedToast' : 'sentToast'), 'success')
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
        <EditButton label={t('edit')} onClick={() => handleOpenChange(true)} />
      ) : (
        <DialogTrigger asChild>
          <Button className={triggerClassName}>
            <Plus />
            {t('add')}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader title={t(draft ? 'edit' : 'newTitle')} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('investment')}</Label>
            <Select value={investmentId} onValueChange={setInvestmentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('chooseInvestment')} />
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
              <Label>{t('register')}</Label>
              <Select value={cashRegisterId} onValueChange={setCashRegisterId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('chooseRegister')} />
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
              <Label>{t('photos')}</Label>
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
              label={t('photoInput')}
              multiple
              className="h-28 flex-col"
              {...fileInputProps}
            />
          )}
          {hasTooManyPhotos && (
            <Description size="xs" tone="error" role="alert">
              {t('tooManyPhotos', { max: MAX_DRAFT_PAGES })}
            </Description>
          )}
          {isScanModeShown && (
            <div className="flex flex-col gap-2">
              <ToggleGroup
                options={[
                  { value: 'one-invoice', label: t('scanModeOneInvoice') },
                  { value: 'one-per-photo', label: t('scanModeOnePerPhoto') },
                ]}
                value={scanMode}
                onChange={setScanMode}
                isEqualWidth
              />
              <Description size="xs">
                {t(
                  scanMode === 'one-invoice' ? 'scanModeOneInvoiceHint' : 'scanModeOnePerPhotoHint',
                )}
              </Description>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-draft-note">{t('noteOptional')}</Label>
            <Textarea
              id="expense-draft-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <Button onClick={handleSend} disabled={!canSend}>
            {t(isSending ? (draft ? 'saving' : 'sending') : draft ? 'save' : 'send')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
