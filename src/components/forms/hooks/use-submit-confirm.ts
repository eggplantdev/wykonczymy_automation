import { useState, type ComponentProps } from 'react'

import type { ConfirmDialog } from '@/components/ui/confirm-dialog'

/** The copy of a confirm step raised by the values themselves, not by the button that was pressed. */
export type SubmitConfirmCopyT = Pick<
  ComponentProps<typeof ConfirmDialog>,
  'title' | 'description' | 'confirmLabel' | 'cancelLabel' | 'variant'
>

/**
 * `ask` is awaited INSIDE onSubmit rather than staging the write for later: the submit then keeps
 * running as one flow, so the pending state, the toast and the store reset stay where every other
 * form has them.
 */
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
    // Spreadable onto ConfirmDialog. Empty title while closed — the dialog renders nothing then.
    dialogProps: {
      ...asked?.copy,
      open: asked !== null,
      title: asked?.copy.title ?? '',
      onConfirm: () => asked?.answer(true),
      onCancel: () => asked?.answer(false),
    },
  }
}
