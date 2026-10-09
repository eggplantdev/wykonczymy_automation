'use client'

import { BookOpen } from 'lucide-react'
import { useState } from 'react'
import { CompanyKnowledgeDialog } from '@/components/company-knowledge/company-knowledge-dialog'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isManagementRole } from '@/lib/auth/roles'
import { fetchCompanyKnowledge } from '@/lib/queries/company-knowledge'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { CompanyKnowledgeEntryT } from '@/types/company-knowledge'

// Placed twice — the top bar and the mobile menu — so it hides itself. `onOpen` lets the mobile menu
// close first: its drawer stacks above every dialog.
export function CompanyKnowledgeButton({
  onOpen,
  className,
}: {
  onOpen?: () => void
  className?: string
}) {
  const user = useCurrentUser()
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<CompanyKnowledgeEntryT[] | null>(null)

  if (!isManagementRole(user.role)) return null

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

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={openBook}>
        <BookOpen />
        Manual Wykończymy
      </Button>
      <CompanyKnowledgeDialog open={open} onOpenChange={setOpen} entries={entries} />
    </>
  )
}
