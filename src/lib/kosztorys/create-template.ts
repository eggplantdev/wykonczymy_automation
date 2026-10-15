import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { insertTemplateLayout } from '@/lib/db/template-structure'
import { insertTemplate, templateNameHolder, type TemplateNameHolderT } from '@/lib/db/templates'
import type { TemplateSnapshotPayloadT } from './templates/snapshot-payload'

// Both ways a szablon is born — empty, or „Zapisz jako nowy szablon" from a kosztorys — go through
// here. THE CALLER OWNS THE TRANSACTION (`db` on its handle), so a failed tree insert takes the new
// szablon with it. The name check words the refusal in Polish; `templates_name_idx` stays the real
// guard against a concurrent create with the same name.
export async function createTemplate(
  db: DbExecutorT,
  { name, layout }: { name: string; layout?: TemplateSnapshotPayloadT },
): Promise<{ id: number } | TemplateNameHolderT> {
  const holder = await templateNameHolder(db, name)
  if (holder) return holder

  const id = await insertTemplate(db, name)
  if (layout) await insertTemplateLayout(db, id, layout)
  return { id }
}
