'use client'

import { useState } from 'react'
import { LanguageSelect } from '@/components/ui/language-select'
import { usePersistedEnum } from '@/hooks/use-persisted-value'
import { useI18nContext } from '@/hooks/use-translation'
import { changeOwnLanguageAction } from '@/lib/actions/account-language'
import { failureMessage } from '@/lib/i18n/failure-message'
import { LANGUAGES, reportLanguageStorageKey, type LanguageT } from '@/lib/i18n/languages'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  userId: number
  language: LanguageT
}

export function AccountLanguageSelect({ userId, language }: PropsT) {
  const { locale } = useI18nContext()
  const [shown, setShown] = useState(language)
  const [isSaving, setIsSaving] = useState(false)
  // The report remembers a per-device choice that beats the account; changing the account here
  // overwrites it, or this device would keep opening the report in the old language.
  const [, storeReportLanguage] = usePersistedEnum(
    reportLanguageStorageKey(userId),
    LANGUAGES,
    language,
  )

  const change = async (next: LanguageT) => {
    setShown(next)
    setIsSaving(true)
    const result = await settleAction(() => changeOwnLanguageAction(next))
    setIsSaving(false)
    if (!result.success) {
      setShown(language)
      toastMessage(failureMessage(locale, result), 'error', 6000)
      return
    }
    storeReportLanguage(next)
  }

  return <LanguageSelect value={shown} onValueChange={change} disabled={isSaving} />
}
