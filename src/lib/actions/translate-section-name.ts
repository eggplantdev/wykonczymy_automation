import 'server-only'
import { revalidateTag } from 'next/cache'
import type { Payload } from 'payload'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'
import { getDb, type DbExecutorT } from '@/lib/db/get-db'
import { fillSectionTranslations, getSectionTranslations } from '@/lib/db/section-translations'
import { sectionLanguagesToFill, sectionTemplateFill } from '@/lib/i18n/ai-translation-fill'
import { sectionNameKey } from '@/lib/i18n/section-translations'
import { logError } from '@/lib/utils/log-error'
import { translateTexts } from '@/lib/ai/translate'

/**
 * Fills the languages each name's template still lacks. One name per key: „Łazienka 1" and
 * „Łazienka 2" share a template, so translating both is waste. Never rejects on an AI failure — that
 * comes back in `failed`.
 */
export async function fillSectionNameTranslations(
  db: DbExecutorT,
  names: readonly string[],
): Promise<{ written: number; failed: number }> {
  const byKey = new Map<string, string>()
  for (const name of names) {
    const trimmed = name.trim()
    if (trimmed && !byKey.has(sectionNameKey(trimmed))) byKey.set(sectionNameKey(trimmed), trimmed)
  }
  const stored = await getSectionTranslations(db, [...byKey.keys()])
  const pending = [...byKey].filter(([key]) => sectionLanguagesToFill(stored[key]).length > 0)
  if (pending.length === 0) return { written: 0, failed: 0 }
  const ai = await translateTexts(pending.map(([, name]) => name))

  let written = 0
  let failed = 0
  for (const [key, name] of pending) {
    const fill = sectionTemplateFill(name, stored[key], ai.get(name))
    failed += fill.failed
    if (Object.keys(fill.filled).length === 0) continue
    await fillSectionTranslations(db, key, fill.filled)
    written++
  }
  return { written, failed }
}

// `revalidateTag`, not `updateTag`: it runs from `after()`, the response has gone, and the readers are
// the worker pages and the PDF, never the editor that sent the rename.
export async function translateSectionName(payload: Payload, name: string): Promise<void> {
  try {
    const { written } = await fillSectionNameTranslations(await getDb(payload), [name])
    if (written > 0) revalidateTag(CACHE_TAGS.sectionTranslations, EXPIRE_NOW)
  } catch (error) {
    logError('translateSectionName', error)
  }
}
