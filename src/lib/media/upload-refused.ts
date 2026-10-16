import { translate, type MessageKeyT, type TranslationParamsT } from '@/lib/i18n/translations'

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
