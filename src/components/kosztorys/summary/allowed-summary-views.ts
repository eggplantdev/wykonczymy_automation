import type { SummaryViewT } from '@/components/kosztorys/summary/hooks/use-summary-view'

type ViewDisclosureT = {
  // Read-only client render. The panel also mounts under (share), which carries no session at all,
  // so the reader's identity reaches this decision as flags the host set — never as a role lookup.
  preview: boolean
  // Both company-plane inputs „Marża" is made of are present. Withholding them is the real gate — it
  // keeps the figures out of the RSC payload rather than merely off the screen — and this flag only
  // stops the tab from offering a view that would then render nothing.
  hasMarginInputs: boolean
  // Absent on the szablon workbench, which prices rows that belong to no investment at all, and on
  // both shares.
  hasInvestmentInfo: boolean
}

export function allowedSummaryViews(
  views: SummaryViewT[],
  { preview, hasMarginInputs, hasInvestmentInfo }: ViewDisclosureT,
): SummaryViewT[] {
  return views.filter((value) => {
    if (value === 'subcontractors') return !preview
    if (value === 'margin') return !preview && hasMarginInputs
    // An internal note is not for the inwestor, so the client document never offers this tab.
    if (value === 'investment') return !preview && hasInvestmentInfo
    return true
  })
}
