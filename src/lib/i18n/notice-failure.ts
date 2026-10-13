import { pl } from '@/lib/i18n/dictionaries/pl'
import { interpolate, type MessageKeyT, type TranslationParamsT } from '@/lib/i18n/translations'

export type NoticeKeyT = MessageKeyT<'notices'>

// Worded by the Polish dictionary, so the key a translating surface reads can never drift from the
// Polish `error` every other caller shows.
export const noticeFailure = (key: NoticeKeyT, messageParams?: TranslationParamsT) => ({
  success: false as const,
  error: interpolate(pl.notices[key], messageParams),
  messageKey: key,
  ...(messageParams && { messageParams }),
})

// A Zod refusal carries only its sentence. Schemas that word theirs from the Polish dictionary get
// the key back from it.
export const noticeKeyOf = (text: string): NoticeKeyT | undefined =>
  (Object.keys(pl.notices) as NoticeKeyT[]).find((key) => pl.notices[key] === text)
