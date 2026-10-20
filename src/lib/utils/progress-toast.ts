import type { ReactNode } from 'react'
import { toast, type Id } from 'react-toastify'
import { toastMessage, type ToastType } from '@/lib/utils/toast'

// Not in toast.ts: the dom setup mocks that module as `{ toastMessage }` alone.

export type ProgressToastIdT = Id

export function startProgressToast(message: ReactNode): ProgressToastIdT {
  return toast.info(message, { autoClose: false, position: 'bottom-center', theme: 'dark' })
}

export function updateProgressToast(
  id: ProgressToastIdT | null,
  message: string,
  type: ToastType,
  autoClose: number | false = 2000,
) {
  if (id === null) {
    toastMessage(message, type)
    return
  }
  toast.update(id, { render: message, type, autoClose, theme: 'dark' })
}
