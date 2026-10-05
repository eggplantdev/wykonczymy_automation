import { pl } from '@/lib/i18n/dictionaries/pl'
import type { MessageKeyT } from '@/lib/i18n/translations'

export type NoticeKeyT = MessageKeyT<'notices'>

// Worded by the Polish dictionary, so the key a translating surface reads can never drift from the
// Polish `error` every other caller shows.
export const noticeFailure = (key: NoticeKeyT) => ({
  success: false as const,
  error: pl.notices[key],
  messageKey: key,
})

// A Zod refusal carries only its sentence. Schemas that word theirs from the Polish dictionary get
// the key back from it.
export const noticeKeyOf = (text: string): NoticeKeyT | undefined =>
  (Object.keys(pl.notices) as NoticeKeyT[]).find((key) => pl.notices[key] === text)
