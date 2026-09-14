import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { ADMIN_OR_OWNER_MANAGER_ROLES } from '@/lib/auth/roles'
import { getPresets, getPresetSections } from '@/lib/queries/presets'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PresetsDataTable } from '@/components/presets/presets-data-table'
import type { PresetRowT } from '@/components/tables/presets'

export default async function PresetsPage() {
  const session = await requireAuth(ADMIN_OR_OWNER_MANAGER_ROLES)
  if (!session.success) redirect('/')

  // Both reads share the `presets` cache tag, so the section metas cost no extra query — the
  // per-szablon section and item tallies are an aggregation of a read the pickers already warm.
  const [presets, sections] = await Promise.all([getPresets(), getPresetSections()])

  const tallies = new Map<number, { sections: number; items: number }>()
  for (const section of sections) {
    const tally = tallies.get(section.presetId) ?? { sections: 0, items: 0 }
    tally.sections += 1
    tally.items += section.itemCount
    tallies.set(section.presetId, tally)
  }

  const rows: PresetRowT[] = presets.map((preset) => ({
    ...preset,
    sectionCount: tallies.get(preset.id)?.sections ?? 0,
    itemCount: tallies.get(preset.id)?.items ?? 0,
  }))

  return (
    <PageWrapper title="Szablony">
      <PresetsDataTable data={rows} />
    </PageWrapper>
  )
}
