import type { PresetSectionMetaT } from '@/lib/db/presets'

export const getPresetName = (group: PresetGroupT) => group.presetName

export type PresetGroupT = {
  presetId: number
  presetName: string
  metas: PresetSectionMetaT[]
  selectedCount: number
}

export function isGroupFullySelected(group: PresetGroupT | undefined): boolean {
  if (!group) return false

  return group.selectedCount === group.metas.length
}

export function groupPresetSections(
  metas: PresetSectionMetaT[],
  selected: Set<number>,
): PresetGroupT[] {
  const groups: PresetGroupT[] = []
  for (const meta of metas) {
    const last = groups.at(-1)
    if (!last || last.presetId !== meta.presetId) {
      groups.push({
        presetId: meta.presetId,
        presetName: meta.presetName,
        metas: [],
        selectedCount: 0,
      })
    }
    const group = groups[groups.length - 1]
    group.metas.push(meta)
    if (selected.has(meta.sectionId)) group.selectedCount += 1
  }
  return groups
}
