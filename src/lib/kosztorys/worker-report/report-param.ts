export const REPORT_PARAM = 'zgloszenie'

export const reportHref = (investmentId: number, reportId: number): string =>
  `/inwestycje/${investmentId}/kosztorys_v2?${REPORT_PARAM}=${reportId}`
