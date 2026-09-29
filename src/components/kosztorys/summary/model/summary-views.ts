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

type SummaryViewDescriptorT = {
  value: string
  label: string
  // Required, not defaulted: a new view must say whether the client document may offer it, so an
  // owner-only view cannot reach the share link by someone forgetting to gate it.
  clientVisible: boolean
  // The data the view renders from reached this host; without it the tab would render nothing.
  requires?: (disclosure: ViewDisclosureT) => boolean
}

// Toggle order.
export const SUMMARY_VIEWS = [
  { value: 'summary', label: 'Podsumowanie', clientVisible: true },
  { value: 'expenses', label: 'Materiały', clientVisible: true },
  { value: 'stages', label: 'Robocizna', clientVisible: true },
  { value: 'subcontractors', label: 'Podwykonawcy', clientVisible: false },
  {
    value: 'margin',
    label: 'Marża',
    clientVisible: false,
    requires: ({ hasMarginInputs }) => hasMarginInputs,
  },
  {
    // An internal note is not for the inwestor.
    value: 'investment',
    label: 'Inwestycja',
    clientVisible: false,
    requires: ({ hasInvestmentInfo }) => hasInvestmentInfo,
  },
] as const satisfies readonly SummaryViewDescriptorT[]

export type SummaryViewT = (typeof SUMMARY_VIEWS)[number]['value']

const DESCRIPTORS: readonly (SummaryViewDescriptorT & { value: SummaryViewT })[] = SUMMARY_VIEWS

export const ALL_SUMMARY_VIEWS: SummaryViewT[] = DESCRIPTORS.map(({ value }) => value)

export function allowedSummaryViews(views: SummaryViewT[], disclosure: ViewDisclosureT) {
  return DESCRIPTORS.filter(
    (descriptor) =>
      views.includes(descriptor.value) &&
      (descriptor.clientVisible || !disclosure.preview) &&
      (descriptor.requires?.(disclosure) ?? true),
  )
}
