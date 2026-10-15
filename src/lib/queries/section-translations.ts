import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { listSectionTranslations } from '@/lib/db/section-translations'
import type { SectionTranslationMapT } from '@/lib/i18n/section-translations'

// The whole list in one argument-free entry: ~two dozen rows, and the report page's client-side
// language switcher needs every language at once. Expired by `saveSectionTranslationsAction`.
export const getSectionTranslations = cached(
  async (): Promise<SectionTranslationMapT> => {
    const payload = await getPayload({ config })
    return listSectionTranslations(await getDb(payload))
  },
  ['section-translations'],
  { tags: [CACHE_TAGS.sectionTranslations] },
)
