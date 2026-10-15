import { cache } from 'react'
import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { selectUserLanguage } from '@/lib/db/user-language'
import { DEFAULT_LANGUAGE, type LanguageT } from '@/lib/i18n/languages'

/** The language the logged-in app speaks to this account; read by the shell on every full request. */
export const fetchUserLanguage = cache(
  (userId: number): Promise<LanguageT> =>
    cached(
      async () => {
        const payload = await getPayload({ config })
        return (await selectUserLanguage(await getDb(payload), userId)) ?? DEFAULT_LANGUAGE
      },
      ['user-language', String(userId)],
      { tags: [CACHE_TAGS.users] },
    )(),
)
