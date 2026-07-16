'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { SimpleSelect } from '@/components/ui/simple-select'
import { listPresetsAction, seedFromPresetAction } from '@/lib/actions/kosztorys-presets'
import type { PresetMetaT } from '@/lib/db/presets'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  // Called after a successful seed so the shell can refresh + remount the editor (dsg grid-reseed).
  onSeeded: () => void
}

// "Wypełnij z szablonu" — populate an empty kosztorys from a saved template. Shown only when the tree
// is empty (the shell gates it). Fetch-on-open preset list; on success the shell remounts the grid.
export function SeedFromPresetButton({ investmentId, onSeeded }: PropsT) {
  const [open, setOpen] = useState(false)
  const [presets, setPresets] = useState<PresetMetaT[]>([])
  const [presetId, setPresetId] = useState('')
  const [seeding, setSeeding] = useState(false)

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) return
    setPresetId('')
    const res = await listPresetsAction()
    if (res.success) setPresets(res.data)
  }

  async function handleSeed() {
    const id = Number(presetId)
    if (!id) return
    setSeeding(true)
    const res = await seedFromPresetAction(investmentId, id)
    setSeeding(false)
    if (!res.success) {
      toastMessage(res.error ?? 'Nie udało się wypełnić z szablonu', 'error', 4000)
      return
    }
    toastMessage('Wypełniono z szablonu', 'success')
    setOpen(false)
    onSeeded()
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void handleOpenChange(true)}>
        Wypełnij z szablonu
      </Button>
      <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader
            title="Wypełnij z szablonu"
            description="Utwórz kosztorys na podstawie zapisanego szablonu."
          />
          {presets.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak zapisanych szablonów.</p>
          ) : (
            <SimpleSelect
              value={presetId}
              onValueChange={setPresetId}
              placeholder="Wybierz szablon"
              options={presets.map((preset) => ({ value: String(preset.id), label: preset.name }))}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button onClick={() => void handleSeed()} disabled={!presetId || seeding}>
              Wypełnij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
