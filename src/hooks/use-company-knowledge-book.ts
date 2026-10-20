'use client'

import { useState } from 'react'
import { fetchCompanyKnowledge } from '@/lib/queries/company-knowledge'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { CompanyKnowledgeEntryT } from '@/lib/company-knowledge/types'

export function useCompanyKnowledgeBook(onOpen?: () => void) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<CompanyKnowledgeEntryT[] | null>(null)

  async function openBook() {
    onOpen?.()
    setEntries(null)
    setOpen(true)
    const result = await settleAction(() => fetchCompanyKnowledge())
    if (result.success) {
      setEntries(result.data)
      return
    }
    setOpen(false)
    toastMessage(result.error, 'error', 4000)
  }

  return { openBook, dialog: { open, onOpenChange: setOpen, entries } }
}
