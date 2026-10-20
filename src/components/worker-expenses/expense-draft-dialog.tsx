'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Description } from '@/components/ui/description'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { FileInput } from '@/components/ui/file-input'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import { Loader } from '@/components/ui/loader/loader'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Textarea } from '@/components/ui/textarea'
import { useFilePickIngest } from '@/hooks/use-file-pick-ingest'
import { sendExpenseDraftAction } from '@/lib/actions/worker-expense-drafts'
import { submitWithUploads } from '@/lib/media/submit-with-uploads'
import { toastMessage } from '@/lib/utils/toast'
import { useTranslation } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'
import { MAX_DRAFT_PAGES, NO_INVESTMENT } from '@/lib/constants/worker-expense-drafts'
import type { WorkerStageInvestmentT } from '@/lib/db/stage-memberships'
import type { CashRegisterRefT } from '@/types/reference-data'

type InvestmentOptionT = Pick<WorkerStageInvestmentT, 'investmentId' | 'name'>

type PropsT = {
  investments: InvestmentOptionT[]
  registers: CashRegisterRefT[]
  defaultRegisterId?: number
  canSkipInvestment: boolean
  triggerClassName?: string
}

function initialRegisterId(registers: CashRegisterRefT[], defaultRegisterId?: number) {
  if (registers.length === 1) return String(registers[0]?.id)
  return registers.some((register) => register.id === defaultRegisterId)
    ? String(defaultRegisterId)
    : ''
}

export function ExpenseDraftDialog({
  investments,
  registers,
  defaultRegisterId,
  canSkipInvestment,
  triggerClassName,
}: PropsT) {
  const { locale, t } = useTranslation('expenseDrafts')
  const offeredIds = [
    ...investments.map((investment) => String(investment.investmentId)),
    ...(canSkipInvestment ? [NO_INVESTMENT] : []),
  ]
  const onlyOfferedId = offeredIds.length === 1 ? (offeredIds[0] ?? '') : ''
  const [open, setOpen] = useState(false)
  const [investmentId, setInvestmentId] = useState(onlyOfferedId)
  const [cashRegisterId, setCashRegisterId] = useState(() =>
    initialRegisterId(registers, defaultRegisterId),
  )
  const [note, setNote] = useState('')
  const [isSending, setIsSending] = useState(false)
  const { files, isIngesting, inputKey, reset, fileInputProps } = useFilePickIngest()

  // The server refuses the same count, but only after every photo went up over the phone's data.
  const hasTooManyPhotos = files.length > MAX_DRAFT_PAGES
  const canSend =
    investmentId !== '' &&
    cashRegisterId !== '' &&
    files.length > 0 &&
    !hasTooManyPhotos &&
    !isIngesting &&
    !isSending

  function close() {
    setOpen(false)
    setNote('')
    reset()
  }

  function handleOpenChange(next: boolean) {
    if (isSending) return
    if (!next) return close()
    // A pick kept from the last send can vanish under a refresh (flag cleared, investment or kasa
    // gone) while „Wyślij" still counts it as chosen — and a lone kasa has no select to fix it in.
    if (!offeredIds.includes(investmentId)) setInvestmentId(onlyOfferedId)
    if (!registers.some((register) => String(register.id) === cashRegisterId)) {
      setCashRegisterId(initialRegisterId(registers, defaultRegisterId))
    }
    setOpen(true)
  }

  function submit() {
    const fields = {
      investmentId: investmentId === NO_INVESTMENT ? null : Number(investmentId),
      cashRegisterId: Number(cashRegisterId),
      note,
    }
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
      toastMessage(t('sentToast'), 'success')
      close()
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className={triggerClassName}>
          <Plus />
          {t('add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-dialog-sm" aria-describedby={undefined}>
        <Loader
          loading={isIngesting || isSending}
          loaderComponent={<GradientSpinner className="size-12" />}
          portal
        />
        <DialogHeader title={t('newTitle')} />
        <DialogBody>
          <Field gap="md">
            <FieldLabel htmlFor="expense-draft-investment">{t('investment')}</FieldLabel>
            <SimpleSelect
              id="expense-draft-investment"
              value={investmentId}
              onValueChange={setInvestmentId}
              placeholder={t('chooseInvestment')}
              className="w-full"
              options={[
                ...investments.map((investment) => ({
                  value: String(investment.investmentId),
                  label: investment.name,
                })),
                ...(canSkipInvestment ? [{ value: NO_INVESTMENT, label: t('noInvestment') }] : []),
              ]}
            />
          </Field>
          {registers.length > 1 && (
            <Field gap="md">
              <FieldLabel htmlFor="expense-draft-register">{t('register')}</FieldLabel>
              <SimpleSelect
                id="expense-draft-register"
                value={cashRegisterId}
                onValueChange={setCashRegisterId}
                placeholder={t('chooseRegister')}
                className="w-full"
                options={registers.map((register) => ({
                  value: String(register.id),
                  label: register.name,
                }))}
              />
            </Field>
          )}
          <FileInput
            key={inputKey}
            label={t('photoInput')}
            multiple
            className="h-28 flex-col"
            {...fileInputProps}
          />
          {hasTooManyPhotos ? (
            <Description size="xs" tone="error" withIcon role="alert">
              {t('tooManyPhotos', { max: MAX_DRAFT_PAGES })}
            </Description>
          ) : (
            <Description size="xs">{t('photoLimit', { max: MAX_DRAFT_PAGES })}</Description>
          )}
          <Field gap="md">
            <FieldLabel htmlFor="expense-draft-note">{t('noteOptional')}</FieldLabel>
            <Textarea
              id="expense-draft-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button onClick={handleSend} disabled={!canSend}>
            {t(isSending ? 'sending' : 'send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
