'use client'

import { CompanyKnowledgeBook } from '@/components/company-knowledge/company-knowledge-book'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
        <DialogHeader>
          <DialogTitle>Manual Wykończymy</DialogTitle>
          <DialogDescription>
            Zasady firmy — wszystko, co AI musi wiedzieć, żeby wycenić inwestycję, np.:
            <br />
            „Gdy wysokość pomieszczeń jest nieznana, zakładamy:
            <br />— stan deweloperski: 2,68 m,
            <br />— rynek wtórny: 2,60 m”.
          </DialogDescription>
        </DialogHeader>
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
