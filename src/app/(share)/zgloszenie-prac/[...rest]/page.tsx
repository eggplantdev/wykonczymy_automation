import { notFound } from 'next/navigation'
import { REPORT_VIEWPORT } from '@/components/kosztorys/worker-report/report-viewport'

export const viewport = REPORT_VIEWPORT

export default function RetiredReportLink() {
  notFound()
}
