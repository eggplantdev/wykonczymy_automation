import { pl } from '@/lib/i18n/dictionaries/pl'
import { interpolate, type MessageKeyT, type TranslationParamsT } from '@/lib/i18n/translations'

export type NoticeKeyT = MessageKeyT<'notices'>

export const noticeFailure = (key: NoticeKeyT, messageParams?: TranslationParamsT) => ({
  success: false as const,
  error: interpolate(pl.notices[key], messageParams),
  messageKey: key,
  ...(messageParams && { messageParams }),
})

export const noticeKeyOf = (text: string): NoticeKeyT | undefined =>
  (Object.keys(pl.notices) as NoticeKeyT[]).find((key) => pl.notices[key] === text)
