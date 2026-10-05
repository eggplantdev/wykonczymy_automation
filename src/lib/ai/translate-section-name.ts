import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { fillSectionTranslations, listSectionTranslations } from '@/lib/db/section-translations'
import { sectionLanguagesToFill, sectionTemplateFill } from '@/lib/i18n/ai-translation-fill'
import { sectionNameKey } from '@/lib/i18n/section-translations'
import { logError } from '@/lib/utils/log-error'
import { translateTexts } from './translate'

/**
 * Run from `after()` on a section create or rename: fills the languages that name's key has no
 * template for. `revalidateTag`, not `updateTag` — by now the response has gone, and the readers are
 * the worker pages and the PDF, never the editor that sent the rename.
 */
export async function translateSectionName(payload: Payload, name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  try {
    const db = await getDb(payload)
    const key = sectionNameKey(trimmed)
    const stored = (await listSectionTranslations(db))[key]
    if (sectionLanguagesToFill(stored).length === 0) return

    const ai = await translateTexts([trimmed])
    const { filled } = sectionTemplateFill(trimmed, stored, ai.get(trimmed))
    if (Object.keys(filled).length === 0) return
    await fillSectionTranslations(db, key, filled)
    revalidateTag(CACHE_TAGS.sectionTranslations, EXPIRE_NOW)
  } catch (error) {
    logError('translateSectionName', error)
  }
}
