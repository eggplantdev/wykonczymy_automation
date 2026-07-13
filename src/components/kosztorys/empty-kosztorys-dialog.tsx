'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { SeedFromPresetButton } from '@/components/kosztorys/seed-from-preset-button'
import { seedBlankSectionAction } from '@/lib/actions/kosztorys'
import { NEW_SECTION_DEFAULTS } from '@/lib/kosztorys/v2-rows'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  // Called after the first section lands so the shell can refresh + remount the populated grid.
  onCreated: () => void
}

// TODO(EX-463) TEMPORARY: delete this whole component once the new-investment auto-seed + import slice
// (S-12) cover every empty kosztorys; also drop its render in kosztorys-editor-v2.tsx.
// Temporary dogfooding stopgap: a fresh/empty kosztorys is a dead end — no section means the
// toolbar's "＋ pozycja" is hidden and there's no discoverable way in. This non-dismissible dialog
// forces the first section (named) or a preset seed before the editor is usable. Superseded by the
// durable new-investment auto-seed once the import slice (S-12) covers existing empties.
export function EmptyKosztorysDialog({ investmentId, onCreated }: PropsT) {
  const [name, setName] = useState<string>(NEW_SECTION_DEFAULTS.name)
  const [creating, setCreating] = useState(false)

  const canCreate = name.trim().length > 0 && !creating

  async function handleCreate() {
    if (!canCreate) return
    setCreating(true)
    const res = await seedBlankSectionAction(investmentId, name)
    setCreating(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się utworzyć sekcji', 'error', 4000)
      return
    }
    onCreated()
  }

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-sm"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader
          title="Zacznij kosztorys"
          description="Kosztorys jest pusty. Dodaj pierwszą sekcję, aby zacząć wypełniać pozycje."
        />
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nazwa sekcji"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCreate) void handleCreate()
          }}
        />
        <Button onClick={() => void handleCreate()} disabled={!canCreate}>
          Utwórz sekcję
        </Button>
        <div className="flex items-center gap-2">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs">lub</span>
          <span className="bg-border h-px flex-1" />
        </div>
        <SeedFromPresetButton investmentId={investmentId} onSeeded={onCreated} />
      </DialogContent>
    </Dialog>
  )
}
