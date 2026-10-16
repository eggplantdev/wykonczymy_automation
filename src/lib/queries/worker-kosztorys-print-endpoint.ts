'use server'

import { DEFAULT_LANGUAGE, type LanguageT } from '@/lib/i18n/languages'
import type { SectionTranslationMapT } from '@/lib/i18n/section-translations'
import type { WorkerKosztorysT } from '@/lib/kosztorys/worker-view/types'
import { fetchReferenceData, findWorkerRef } from '@/lib/queries/reference-data'
import { getSectionTranslations } from '@/lib/queries/section-translations'
import { getWorkerKosztorysPreview } from '@/lib/queries/worker-kosztorys'

export type WorkerKosztorysPrintDataT = {
  data: WorkerKosztorysT
  language: LanguageT
  sectionTranslations: SectionTranslationMapT
}

// The session gate is inside the wrapped read.
export async function getWorkerKosztorysPrintData(
  investmentId: number,
  workerId: number,
): Promise<WorkerKosztorysPrintDataT | null> {
  const [data, referenceData, sectionTranslations] = await Promise.all([
    getWorkerKosztorysPreview(investmentId, workerId),
    fetchReferenceData(),
    getSectionTranslations(),
  ])
  if (!data) return null
  const language = findWorkerRef(referenceData, workerId)?.language ?? DEFAULT_LANGUAGE
  return { data, language, sectionTranslations }
}
