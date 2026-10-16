import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { templateOwnersOfSections } from '@/lib/db/templates'
import type { SnapshotPayloadT } from '@/lib/kosztorys/snapshot-format'
import { serializeTemplate } from './serialize-template'

type TemplateSectionSliceT = {
  section: SnapshotPayloadT['sections'][number]
  items: SnapshotPayloadT['items'][number][]
}

// „Sekcja z szablonu" on either plane: the picked sections with their prace, resolved from the
// katalog. A szablon can contribute several sections, so each is serialized once; the result keeps
// the client's order so appended sections land in the order they were picked. `undefined` when any
// picked section is not in a live szablon.
export async function resolveSectionSlices(
  db: DbExecutorT,
  sectionIds: number[],
): Promise<TemplateSectionSliceT[] | undefined> {
  const owners = await templateOwnersOfSections(db, sectionIds)
  const trees = new Map<number, SnapshotPayloadT>()
  const slices: TemplateSectionSliceT[] = []
  for (const sectionId of sectionIds) {
    const templateId = owners.get(sectionId)
    if (templateId == null) return undefined
    let tree = trees.get(templateId)
    if (!tree) {
      tree = await serializeTemplate(db, templateId)
      if (!tree) return undefined
      trees.set(templateId, tree)
    }
    const section = tree.sections.find((s) => s.id === sectionId)
    if (!section) return undefined
    slices.push({ section, items: tree.items.filter((item) => item.sectionId === sectionId) })
  }
  return slices
}
