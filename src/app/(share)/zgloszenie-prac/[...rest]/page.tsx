import { notFound } from 'next/navigation'
import { REPORT_VIEWPORT } from '@/components/kosztorys/worker-report/report-viewport'

export const viewport = REPORT_VIEWPORT

// The report link's home before /z/. A worker may still hold one, and he has no account to log in
// with — so it lands on the link's own „link nieaktywny”, not the login page.
export default function RetiredReportLink() {
  notFound()
}
