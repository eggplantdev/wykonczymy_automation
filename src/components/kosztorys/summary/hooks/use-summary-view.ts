'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'
import {
  ALL_SUMMARY_VIEWS,
  type SummaryViewT,
} from '@/components/kosztorys/summary/model/summary-views'

const STORAGE_KEY = 'table-columns:kosztorys-summary-view'
// The client document keeps its own key: the owner's last tab still cannot decide which panel that
// document opens on.
const PREVIEW_STORAGE_KEY = 'kosztorys-preview:summary-view'
const SUMMARY_VIEW_DEFAULT: SummaryViewT = 'summary'

export function useSummaryView(preview = false): [SummaryViewT, (view: SummaryViewT) => void] {
  return usePersistedEnum(
    preview ? PREVIEW_STORAGE_KEY : STORAGE_KEY,
    ALL_SUMMARY_VIEWS,
    SUMMARY_VIEW_DEFAULT,
  )
}
