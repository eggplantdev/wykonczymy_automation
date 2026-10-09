'use client'

import { CompanyKnowledgeBook } from '@/components/company-knowledge/company-knowledge-book'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ContentLoading } from '@/components/ui/loader/page-loading'
import type { CompanyKnowledgeEntryT } from '@/types/company-knowledge'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: CompanyKnowledgeEntryT[] | null
}

export function CompanyKnowledgeDialog({ open, onOpenChange, entries }: PropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader
          title="Wiedza firmowa"
          description="Zasady firmy, które nie należą do jednej pracy z katalogu."
        />
        {entries ? (
          <CompanyKnowledgeBook initialEntries={entries} />
        ) : (
          <div className="flex justify-center py-8">
            <ContentLoading />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
