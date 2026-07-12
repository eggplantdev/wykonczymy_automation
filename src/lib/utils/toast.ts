import type { ReactNode } from 'react'
import { Bounce, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export type ToastPosition = 'bottom-center' | 'top-center'

export function toastMessage(
  message: ReactNode,
  type: ToastType = 'success',
  autoClose: number = 2000,
  position: ToastPosition = 'bottom-center',
) {
  toast[type](message, {
    position: position,
    hideProgressBar: true,
    autoClose: autoClose,
    closeOnClick: true,
    pauseOnHover: false,
    draggable: true,
    progress: undefined,
    theme: 'dark',
    transition: Bounce,
  })
}
