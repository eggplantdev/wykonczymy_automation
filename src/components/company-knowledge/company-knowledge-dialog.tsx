'use client'

import { CompanyKnowledgeBook } from '@/components/company-knowledge/company-knowledge-book'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { BlockLoading } from '@/components/ui/inline-loading'
import type { CompanyKnowledgeEntryT } from '@/lib/company-knowledge/types'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: CompanyKnowledgeEntryT[] | null
}

export function CompanyKnowledgeDialog({ open, onOpenChange, entries }: PropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog">
        <DialogHeader
          title="Manual Wykończymy"
          description={
            <>
              Zasady firmy — wszystko, co AI musi wiedzieć, żeby wycenić inwestycję, np.:
              <br />
              „Gdy wysokość pomieszczeń jest nieznana, zakładamy:
              <br />— stan deweloperski: 2,68 m,
              <br />— rynek wtórny: 2,60 m”.
            </>
          }
        />
        {entries ? <CompanyKnowledgeBook initialEntries={entries} /> : <BlockLoading />}
      </DialogContent>
    </Dialog>
  )
}
