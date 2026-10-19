'use client'

import { useState } from 'react'
import { getPresetOptions } from '@/lib/queries/preset-pickers'
import { settleAction } from '@/lib/utils/settle-action'
import type { TemplateMetaT } from '@/lib/db/templates'

export type SavePresetActionT = {
  open: boolean
  setOpen: (open: boolean) => void
  existingPresets: TemplateMetaT[]
  requestOpen: () => void
}

export function useSavePresetAction(): SavePresetActionT {
  const [open, setOpen] = useState(false)
  const [existingPresets, setExistingPresets] = useState<TemplateMetaT[]>([])

  function requestOpen() {
    setOpen(true)
    void settleAction(getPresetOptions).then((res) => {
      if (res.success) setExistingPresets(res.data)
    })
  }

  return { open, setOpen, existingPresets, requestOpen }
}
