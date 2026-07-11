'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listPresetsAction, seedFromPresetAction } from '@/lib/actions/kosztorys-presets'
import type { PresetMetaT } from '@/lib/db/presets'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  // Called after a successful seed so the shell can refresh + remount the editor (dsg grid-reseed).
  onSeeded: () => void
}

// "Wypełnij z presetu" — populate an empty kosztorys from a saved template. Shown only when the tree
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
      toastMessage(res.error ?? 'Nie udało się wypełnić z presetu', 'error', 4000)
      return
    }
    toastMessage('Wypełniono z presetu', 'success')
    setOpen(false)
    onSeeded()
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => void handleOpenChange(true)}>
        Wypełnij z presetu
      </Button>
      <Dialog open={open} onOpenChange={(next) => void handleOpenChange(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader
            title="Wypełnij z presetu"
            description="Utwórz kosztorys na podstawie zapisanego szablonu."
          />
          {presets.length === 0 ? (
            <p className="text-muted-foreground text-sm">Brak zapisanych presetów.</p>
          ) : (
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz preset" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={String(preset.id)}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
