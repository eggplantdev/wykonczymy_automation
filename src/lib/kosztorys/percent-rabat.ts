import { z } from 'zod'

// Input for the percent-rabat bulk-apply tool. The percent is not stored state — clicking „Zastosuj"
// writes `percent X` into every item's per-item rabat, so the only input is the percent.
//
// `gt(0)`: a 0% "apply" would mass-clear every rabat, a destructive side effect the owner did not ask
// for — clearing rabaty is a separate explicit feature, not a silent consequence of applying 0. `max(100)`:
// a rabat over 100% would price the row negative.
export const applyPercentRabatSchema = z.object({
  percent: z.coerce.number().gt(0).max(100),
})
