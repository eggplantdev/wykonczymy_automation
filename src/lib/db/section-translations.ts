import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { TRANSLATION_LANGUAGES } from '@/lib/i18n/languages'
import type { SectionTranslationMapT, SectionTranslationsT } from '@/lib/i18n/section-translations'
import type { DbExecutorT } from './get-db'

function toTranslations(value: unknown): SectionTranslationsT {
  const stored = (value ?? {}) as Record<string, unknown>
  const translations: SectionTranslationsT = {}
  for (const language of TRANSLATION_LANGUAGES) {
    const text = stored[language]
    if (typeof text === 'string' && text.trim() !== '') translations[language] = text
  }
  return translations
}

export async function listSectionTranslations(db: DbExecutorT): Promise<SectionTranslationMapT> {
  const res = await db.execute(sql`
    SELECT name_key, translations FROM kosztorys_section_translations
  `)
  return Object.fromEntries(
    res.rows.map((row) => [String(row.name_key), toTranslations(row.translations)]),
  )
}

export async function upsertSectionTranslations(
  db: DbExecutorT,
  key: string,
  translations: SectionTranslationsT,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO kosztorys_section_translations (name_key, translations)
    VALUES (${key}, ${JSON.stringify(translations)}::jsonb)
    ON CONFLICT (name_key) DO UPDATE SET translations = EXCLUDED.translations, updated_at = now()
  `)
}

export async function deleteSectionTranslations(db: DbExecutorT, key: string): Promise<void> {
  await db.execute(sql`DELETE FROM kosztorys_section_translations WHERE name_key = ${key}`)
}

// The AI fill's writer: a language already stored — typed by a manager, possibly during the AI wait —
// wins over the one the model just produced.
export async function fillSectionTranslations(
  db: DbExecutorT,
  key: string,
  translations: SectionTranslationsT,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO kosztorys_section_translations (name_key, translations)
    VALUES (${key}, ${JSON.stringify(translations)}::jsonb)
    ON CONFLICT (name_key) DO UPDATE
    SET translations = EXCLUDED.translations || kosztorys_section_translations.translations,
        updated_at = now()
  `)
}
