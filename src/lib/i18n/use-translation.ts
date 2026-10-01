'use client'

import { useI18nContext } from '@/lib/i18n/i18n-context'
import { createTranslator, type NamespaceT } from '@/lib/i18n/translations'

export function useTranslation<NS extends NamespaceT>(namespace: NS) {
  const { locale } = useI18nContext()
  return createTranslator(locale, namespace)
}
