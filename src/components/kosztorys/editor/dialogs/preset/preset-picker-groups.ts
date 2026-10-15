import type { TemplateSectionMetaT } from '@/lib/db/templates'

export const getPresetName = (group: PresetGroupT) => group.templateName

export type PresetGroupT = {
  templateId: number
  templateName: string
  metas: TemplateSectionMetaT[]
  selectedCount: number
}

// Takes `undefined` because the picker derives this above its own loading/empty guard — there is no
// active group while the szablon list is fetching, nor when the library is empty.
export function isGroupFullySelected(group: PresetGroupT | undefined): boolean {
  if (!group) return false

  return group.selectedCount === group.metas.length
}

// Consecutive metas sharing a templateId form one group. Grouping never re-sorts: the query's order IS
// the left pane's order (newest szablon first).
export function groupPresetSections(
  metas: TemplateSectionMetaT[],
  selected: Set<number>,
): PresetGroupT[] {
  const groups: PresetGroupT[] = []
  for (const meta of metas) {
    const last = groups.at(-1)
    if (!last || last.templateId !== meta.templateId) {
      groups.push({
        templateId: meta.templateId,
        templateName: meta.templateName,
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
