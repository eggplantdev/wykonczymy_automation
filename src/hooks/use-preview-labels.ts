'use client'

import { useI18nContext, useTranslation } from '@/hooks/use-translation'
import { buildPreviewLabels } from '@/lib/media/wording'
import type { PreviewLabelsT } from '@/types/media'

// Polish keeps the caller's own wording (a lead strip says WHICH side „usuń" acts on); another
// language rebuilds the set from the dictionary by kind, so a call site never needs a translator.
export function usePreviewLabels(labels: PreviewLabelsT): PreviewLabelsT {
  const { locale } = useI18nContext()
  const translator = useTranslation('media')
  return locale === 'pl' ? labels : buildPreviewLabels(labels.archive, translator)
}
