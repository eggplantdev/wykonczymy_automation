'use client'

import { useState } from 'react'

export type DialogToggleT = {
  open: boolean
  setOpen: (open: boolean) => void
}

export function useDialogToggle(): DialogToggleT {
  const [open, setOpen] = useState(false)
  return { open, setOpen }
}
