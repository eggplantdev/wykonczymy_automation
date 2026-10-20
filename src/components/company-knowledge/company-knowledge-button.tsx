'use client'

import { BookOpen } from 'lucide-react'
import { CompanyKnowledgeDialog } from '@/components/company-knowledge/company-knowledge-dialog'
import { Button } from '@/components/ui/button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useCompanyKnowledgeBook } from '@/hooks/use-company-knowledge-book'
import { isManagementRole } from '@/lib/auth/roles'

export function CompanyKnowledgeTrigger({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  const user = useCurrentUser()
  if (!isManagementRole(user.role)) return null

  return (
    <Button variant="outline" size="sm" className={className} onClick={onClick}>
      <BookOpen />
      Manual Wykończymy
    </Button>
  )
}

export function CompanyKnowledgeButton({ className }: { className?: string }) {
  const book = useCompanyKnowledgeBook()

  return (
    <>
      <CompanyKnowledgeTrigger onClick={book.openBook} className={className} />
      <CompanyKnowledgeDialog {...book.dialog} />
    </>
  )
}
