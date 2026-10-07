import { translate, type MessageKeyT, type TranslationParamsT } from '@/lib/i18n/translations'

/**
 * An upload refused for a reason worded for the user — the only failure whose message reaches a
 * toast. `message` is Polish; the key lets a worker's screen word it in their language.
 */
export class UploadRefusedError extends Error {
  name = 'UploadRefusedError'

  constructor(
    message: string,
    readonly messageKey?: MessageKeyT<'notices'>,
    readonly messageParams?: TranslationParamsT,
  ) {
    super(message)
  }
}

export const refused = (key: MessageKeyT<'notices'>, params?: TranslationParamsT) =>
  new UploadRefusedError(translate('pl', 'notices', key, params), key, params)
