import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertTemplateSnapshot } from '@/lib/db/template-snapshots'
import {
  deleteTemplateSections,
  insertTemplateLayout,
  readTemplateLayout,
} from '@/lib/db/template-structure'
import { markTemplateTreeReplaced } from '@/lib/db/templates'
import type { SnapshotKindT } from '@/lib/kosztorys/snapshot-format'
import type { TemplateSnapshotPayloadT } from './snapshot-payload'

// Swap a szablon's whole layout, reversibly: a version of what stands is written first, on the
// caller's transaction, so a rollback takes it too and the overwrite stays one click back in
// „Wersje" — a labelled `manual` one by default, an `auto` one as a restore's restore point. The
// stamp write comes first: it locks the szablon row before the read, so the version describes
// exactly the layout the wipe deletes.
export async function replaceTemplateLayout(
  db: DbExecutorT,
  templateId: number,
  {
    label,
    takenBy,
    layout,
    kind = 'manual',
  }: {
    label: string | null
    takenBy: number
    layout: TemplateSnapshotPayloadT
    kind?: SnapshotKindT
  },
): Promise<void> {
  await markTemplateTreeReplaced(db, templateId)
  await insertTemplateSnapshot(db, {
    templateId,
    kind,
    label,
    takenBy,
    payload: await readTemplateLayout(db, templateId),
  })
  await deleteTemplateSections(db, templateId)
  await insertTemplateLayout(db, templateId, layout)
}
