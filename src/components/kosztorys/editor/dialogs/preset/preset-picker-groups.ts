import type { PresetSectionMetaT } from '@/lib/db/presets'

export const getPresetName = (group: PresetGroupT) => group.presetName

export type PresetGroupT = {
  presetId: number
  presetName: string
  metas: PresetSectionMetaT[]
  selectedCount: number
}

// A meta's stable identity across all presets — a section id is only unique WITHIN its preset.
export const metaKey = (meta: PresetSectionMetaT) => `${meta.presetId}:${meta.sectionId}`

// Takes `undefined` because the picker derives this above its own loading/empty guard — there is no
// active group while the szablon list is fetching, nor when the library is empty.
export function isGroupFullySelected(group: PresetGroupT | undefined): boolean {
  if (!group) return false

  return group.selectedCount === group.metas.length
}

// Consecutive metas sharing a presetId form one group. Grouping never re-sorts: the query's order IS
// the left pane's order (newest szablon first).
export function groupPresetSections(
  metas: PresetSectionMetaT[],
  selected: Set<string>,
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
    if (selected.has(metaKey(meta))) group.selectedCount += 1
  }
  return groups
}
