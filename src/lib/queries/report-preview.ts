'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { isManagementRole, ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { readReportPreview } from '@/lib/db/worker-reports'
import { buildReportPreview } from '@/lib/kosztorys/worker-report/report-preview'
import type { ReportPreviewT } from '@/lib/kosztorys/worker-report/types'
import { getSectionTranslations } from '@/lib/queries/section-translations'
import { fetchUserLanguage } from '@/lib/queries/user-language'

// The viewer comes from the session, never from the client: the read checks it against the report's
// stored worker, so another worker's id answers `null` like a missing one.
export async function fetchReportPreview(reportId: number): Promise<ReportPreviewT | null> {
  const session = await requireAuth(ROLES)
  if (!session.success) throw new Error('Nie jesteś zalogowany')
  const isManagement = isManagementRole(session.user.role)

  const payload = await getPayload({ config })
  const read = await readReportPreview(await getDb(payload), reportId, {
    id: session.user.id,
    isManagement,
  })
  if (!read) return null

  const [viewerLanguage, sectionTranslations] = await Promise.all([
    fetchUserLanguage(session.user.id),
    getSectionTranslations(),
  ])
  return buildReportPreview(read, { viewerLanguage, isManagement, sectionTranslations })
}
