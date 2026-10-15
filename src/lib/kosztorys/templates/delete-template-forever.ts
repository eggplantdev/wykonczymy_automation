import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import { deleteTrashedTemplateRow } from '@/lib/db/template-trash'
import { logError } from '@/lib/utils/log-error'
import type { DeleteForeverResultT } from '@/types/trash'

// No refusal branch: a kosztorys seeded from a szablon keeps its own copy, so nothing points back.
export async function deleteTrashedTemplate(
  db: DbExecutorT,
  templateId: number,
): Promise<DeleteForeverResultT> {
  try {
    if (await deleteTrashedTemplateRow(db, templateId)) return { ok: true }
    return { ok: false, reason: 'not-trashed', message: 'Najpierw przenieś szablon do kosza.' }
  } catch (err) {
    logError(`[deleteTrashedTemplate] ${templateId}`, err)
    return { ok: false, reason: 'error', message: 'Nie udało się usunąć szablonu.' }
  }
}
