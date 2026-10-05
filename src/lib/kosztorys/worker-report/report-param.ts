export const REPORT_PARAM = 'zgloszenie'

/** The editor, opened on this zgłoszenie's verification. */
export const reportHref = (investmentId: number, reportId: number): string =>
  `/inwestycje/${investmentId}/kosztorys_v2?${REPORT_PARAM}=${reportId}`
