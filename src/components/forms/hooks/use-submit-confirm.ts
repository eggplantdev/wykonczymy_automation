import { useState, type ComponentProps } from 'react'

import type { ConfirmDialog } from '@/components/ui/confirm-dialog'

export type SubmitConfirmCopyT = Pick<
  ComponentProps<typeof ConfirmDialog>,
  'title' | 'description' | 'confirmLabel' | 'cancelLabel' | 'variant'
>

export function useSubmitConfirm() {
  const [asked, setAsked] = useState<{
    copy: SubmitConfirmCopyT
    answer: (confirmed: boolean) => void
  } | null>(null)

  async function ask(copy: SubmitConfirmCopyT) {
    const confirmed = await new Promise<boolean>((answer) => setAsked({ copy, answer }))
    setAsked(null)
    return confirmed
  }

  return {
    ask,
    dialogProps: {
      ...asked?.copy,
      open: asked !== null,
      title: asked?.copy.title ?? '',
      onConfirm: () => asked?.answer(true),
      onCancel: () => asked?.answer(false),
    },
  }
}
